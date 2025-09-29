import { spawn } from 'child_process';
import { join } from 'path';
import { mkdirSync, existsSync, copyFileSync, readdirSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '@/database/database';
import { enterpriseDb } from '../database/enterprise-database';
import { SchedulerError, ExecutionResult, ExecutionContext } from '@/types/scheduler';
import { schedulerLogger as logger } from '@/utils/logger';
import { getSelfHealingService } from './selfHealingService';
import { testSuiteRegistry, WESIGN_TESTS_BASE_PATH } from './testSuiteRegistry';

/**
 * Execute a scheduled test suite run
 */
export async function executeSchedule(
  scheduleId: string,
  options?: {
    notes?: string;
    execution_options?: any;
  }
): Promise<any> {
  const db = getDatabase();
  const schedule = db.getScheduleById(scheduleId);
  if (!schedule) {
    throw new SchedulerError('NOT_FOUND', `Schedule ${scheduleId} not found`);
  }

  logger.info('Starting schedule execution', { scheduleId, suiteId: schedule.suite_id });

  // Create execution context
  const workerId = process.env.WORKER_ID || `worker_${uuidv4().slice(0, 8)}`;
  const artifactsDir = join(process.cwd(), 'artifacts', 'schedules', scheduleId);
  const tempDir = join(artifactsDir, 'temp');

  // Ensure directories exist
  mkdirSync(artifactsDir, { recursive: true });
  mkdirSync(tempDir, { recursive: true });

  // Create schedule run record
  const run = await db.createScheduleRun({
    schedule_id: scheduleId,
    started_at: new Date().toISOString(),
    status: 'running',
    attempt_number: 1,
    environment: 'staging',
  });

  // Update schedule status
  await db.updateSchedule(scheduleId, {
    status: 'running',
    last_run_id: run.id
  });

  const executionContext: ExecutionContext = {
    schedule,
    run,
    worker_id: workerId,
    artifacts_dir: artifactsDir,
    temp_dir: tempDir
  };

  try {
    // Parse execution options
    const baseOptions = schedule.execution_options ? JSON.parse(schedule.execution_options) : {};
    const overrideOptions = options?.execution_options || {};
    const execOptions = { ...baseOptions, ...overrideOptions };

    logger.info('Executing test suite', {
      scheduleId,
      suiteId: schedule.suite_id,
      options: execOptions,
      artifactsDir
    });

    // Execute the test suite
    const result = await runTestSuite(executionContext, execOptions);

    // Process failures for self-healing if any tests failed
    if (!result.success && result.tests_failed > 0) {
      await captureTestFailures(executionContext, result, execOptions);
    }

    // Update run with results
    const updatedRun = await db.updateScheduleRun(run.id, {
      finished_at: new Date().toISOString(),
      duration_ms: result.duration_ms,
      status: result.success ? 'completed' : 'failed',
      exit_code: result.exit_code,
      error_message: result.error_message,
      tests_total: result.tests_total,
      tests_passed: result.tests_passed,
      tests_failed: result.tests_failed,
      tests_skipped: result.tests_skipped,
      artifacts_path: result.artifacts_path,
      log_output: result.log_output,
      result_summary: JSON.stringify(result.summary),
    });

    // Update schedule status
    await db.updateSchedule(scheduleId, {
      status: result.success ? 'completed' : 'failed',
      retry_count: 0 // Reset on completion
    });

    logger.info('Schedule execution completed', {
      scheduleId,
      runId: run.id,
      success: result.success,
      duration: result.duration_ms,
      testsTotal: result.tests_total,
      testsPassed: result.tests_passed,
      testsFailed: result.tests_failed
    });

    return updatedRun;

  } catch (error) {
    logger.error('Schedule execution failed', { scheduleId, runId: run.id, error });

    // Update run with failure
    await db.updateScheduleRun(run.id, {
      finished_at: new Date().toISOString(),
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Unknown error',
      log_output: `Execution failed: ${error}`
    });

    // Handle retries
    const shouldRetry = schedule.retry_count < schedule.max_retries;
    if (shouldRetry) {
      logger.info('Scheduling retry', { 
        scheduleId, 
        attempt: schedule.retry_count + 1, 
        maxRetries: schedule.max_retries 
      });

      await db.updateSchedule(scheduleId, {
        status: 'scheduled', // Reset to scheduled for retry
        retry_count: schedule.retry_count + 1,
        claimed_at: undefined,
        claimed_by: undefined
      });
    } else {
      await db.updateSchedule(scheduleId, {
        status: 'failed'
      });
    }

    throw error;
  }
}

/**
 * Execute the actual test suite using the real test runner
 */
async function runTestSuite(
  context: ExecutionContext,
  options: any = {}
): Promise<ExecutionResult> {
  const startTime = Date.now();
  
  logger.info('Preparing test suite execution', {
    scheduleId: context.schedule.id,
    suiteId: context.schedule.suite_id,
    options
  });

  try {
    // Initialize test suite registry if not done
    await testSuiteRegistry.initialize();
    
    // Get the actual test suite definition
    const testSuite = testSuiteRegistry.getSuite(context.schedule.suite_id);
    if (!testSuite) {
      throw new SchedulerError('NOT_FOUND', `Test suite not found: ${context.schedule.suite_id}`);
    }

    // Validate the test suite can be executed
    const validation = testSuiteRegistry.validateSuite(context.schedule.suite_id);
    if (!validation.valid) {
      throw new SchedulerError('VALIDATION_ERROR', `Test suite validation failed: ${validation.errors.join(', ')}`);
    }

    logger.info('Executing real test suite', {
      scheduleId: context.schedule.id,
      suiteName: testSuite.name,
      testFiles: testSuite.testFiles.length,
      category: testSuite.category,
      estimatedDuration: testSuite.estimatedDurationMs
    });
    
    // Build and execute the real test command
    const command = buildRealTestCommand(context, testSuite, options);
    const result = await executeCommand(command, context);
    
    // Process artifacts after execution
    const artifacts = await processTestArtifacts(context, testSuite);
    
    const duration = Date.now() - startTime;
    
    return {
      success: result.exitCode === 0,
      exit_code: result.exitCode,
      duration_ms: duration,
      tests_total: result.stats.total || 0,
      tests_passed: result.stats.passed || 0,
      tests_failed: result.stats.failed || 0,
      tests_skipped: result.stats.skipped || 0,
      artifacts_path: context.artifacts_dir,
      log_output: result.stdout + '\n' + result.stderr,
      summary: {
        suite_id: context.schedule.suite_id,
        suite_name: context.schedule.suite_name,
        test_suite: testSuite.name,
        category: testSuite.category,
        execution_time: duration,
        estimated_duration: testSuite.estimatedDurationMs,
        artifacts_generated: artifacts,
        test_files_executed: testSuite.testFiles.length,
        markers: testSuite.markers,
        ...result.stats
      }
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Test suite execution failed', {
      scheduleId: context.schedule.id,
      suiteId: context.schedule.suite_id,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration
    });
    
    return {
      success: false,
      exit_code: error instanceof SchedulerError ? -2 : -1,
      duration_ms: duration,
      tests_total: 0,
      tests_passed: 0,
      tests_failed: 0,
      tests_skipped: 0,
      error_message: error instanceof Error ? error.message : 'Unknown execution error',
      log_output: `Execution failed after ${duration}ms: ${error}`,
      summary: {
        error: true,
        error_type: error instanceof SchedulerError ? error.code : 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown execution error',
        suite_id: context.schedule.suite_id
      }
    };
  }
}

/**
 * Build the real test command using TestSuiteRegistry
 */
function buildRealTestCommand(context: ExecutionContext, testSuite: any, options: any): string[] {
  // Use python instead of py for better compatibility
  const command = ['python', '-m', 'pytest'];
  
  // Add specific test files from the suite
  command.push(...testSuite.testFiles);
  
  // Add markers from the test suite
  if (testSuite.markers && testSuite.markers.length > 0) {
    // Use the first marker as the primary marker
    command.push('-m', testSuite.markers[0]);
  }

  // Add execution options (Playwright-specific)
  if (options.mode === 'headed') {
    command.push('--headed');
  }
  // Note: headless is default for Playwright, no need to specify

  // Execution mode - sequential vs parallel (pytest-xdist)
  if (options.execution === 'sequential') {
    // Sequential execution - no pytest-xdist
    // Don't add -n flag
  } else {
    // Parallel execution with pytest-xdist
    const maxWorkers = options.max_workers || 'auto';
    command.push('-n', maxWorkers);
  }

  // Browser selection (Playwright-specific)
  if (options.browser && options.browser !== 'all') {
    command.push('--browser', options.browser);
  }
  // Default browser is handled by pytest configuration

  // Output and logging options
  command.push('--tb=short'); // Short traceback format
  command.push('--disable-warnings'); // Reduce noise
  command.push('-v'); // Verbose mode for better tracking
  command.push('--strict-markers'); // Ensure markers are defined

  // Artifacts and reporting configuration
  command.push('--screenshot=only-on-failure');
  command.push('--video=retain-on-failure');
  
  // JUnit XML report for CI integration
  const reportPath = join(context.artifacts_dir, 'junit.xml');
  command.push('--junit-xml', reportPath);

  // HTML report for detailed analysis
  const htmlReportPath = join(context.artifacts_dir, 'report.html');
  command.push('--html', htmlReportPath, '--self-contained-html');

  // Allure reporting if available
  const allureResultsPath = join(context.artifacts_dir, 'allure-results');
  command.push('--alluredir', allureResultsPath);

  // Timeout configuration
  const timeoutMs = options.timeout_ms || 30000; // 30 second default
  command.push('--timeout', Math.floor(timeoutMs / 1000).toString());

  // Additional pytest options for stability
  command.push('--maxfail=5'); // Stop after 5 failures
  command.push('--capture=no'); // Don't capture stdout/stderr for real-time logs
  
  logger.info('Built real test command', { 
    command: command.join(' '),
    suiteId: testSuite.id,
    testFiles: testSuite.testFiles.length,
    category: testSuite.category
  });
  
  return command;
}

/**
 * Execute a command and capture output
 */
async function executeCommand(
  command: string[],
  context: ExecutionContext
): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
  stats: {
    total?: number;
    passed?: number;
    failed?: number;
    skipped?: number;
  };
  artifacts?: string[];
}> {
  
  return new Promise((resolve, reject) => {
    // Use WeSign test base directory as working directory
    const workingDir = WESIGN_TESTS_BASE_PATH;
    
    logger.info('Executing test command', { 
      command: command.join(' '), 
      cwd: workingDir,
      scheduleId: context.schedule.id
    });

    const child = spawn(command[0], command.slice(1), {
      cwd: workingDir,
      env: {
        ...process.env,
        PYTHONPATH: workingDir,
        ARTIFACTS_DIR: context.artifacts_dir,
        TEMP_DIR: context.temp_dir,
        SCHEDULE_ID: context.schedule.id,
        RUN_ID: context.run.id,
        // WeSign-specific environment variables
        WESIGN_BASE_URL: 'https://devtest.comda.co.il',
        WESIGN_TEST_MODE: 'scheduled',
        PLAYWRIGHT_BROWSER_PATH: '', // Use system browser
        PYTEST_CURRENT_TEST: '' // Clear any existing test context
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      logger.debug('Test output', { scheduleId: context.schedule.id, output: output.trim() });
    });

    child.stderr.on('data', (data) => {
      const error = data.toString();
      stderr += error;
      logger.debug('Test error output', { scheduleId: context.schedule.id, error: error.trim() });
    });

    child.on('close', (code) => {
      logger.info('Test execution completed', { 
        scheduleId: context.schedule.id,
        exitCode: code,
        stdoutLength: stdout.length,
        stderrLength: stderr.length
      });

      // Parse test statistics from output
      const stats = parseTestResults(stdout + stderr);
      
      resolve({
        exitCode: code || 0,
        stdout,
        stderr,
        stats,
        artifacts: [] // Will be processed separately by processTestArtifacts
      });
    });

    child.on('error', (error) => {
      logger.error('Command execution failed', { 
        command: command.join(' '), 
        error: error.message,
        scheduleId: context.schedule.id,
        workingDir
      });
      
      // Enhanced error context
      const enhancedError = new Error(`Test execution failed: ${error.message}`);
      (enhancedError as any).originalError = error;
      (enhancedError as any).command = command.join(' ');
      (enhancedError as any).workingDir = workingDir;
      (enhancedError as any).scheduleId = context.schedule.id;
      
      reject(enhancedError);
    });

    // Enhanced timeout handling with graceful shutdown
    let timeoutMs = 300000; // 5 minute default
    
    try {
      if (context.schedule.execution_options) {
        const options = JSON.parse(context.schedule.execution_options);
        timeoutMs = options.timeout_ms || timeoutMs;
      }
    } catch (error) {
      logger.warn('Failed to parse execution options, using default timeout', {
        scheduleId: context.schedule.id,
        error: error.message
      });
    }

    const timeoutHandle = setTimeout(() => {
      logger.warn('Test execution timeout, attempting graceful shutdown', { 
        scheduleId: context.schedule.id,
        timeoutMs,
        command: command.join(' ')
      });
      
      // Try graceful shutdown first (SIGTERM)
      child.kill('SIGTERM');
      
      // Force kill after 10 seconds if still running
      setTimeout(() => {
        if (!child.killed) {
          logger.error('Forcefully killing test process after timeout', {
            scheduleId: context.schedule.id
          });
          child.kill('SIGKILL');
        }
      }, 10000);
      
      const timeoutError = new Error(`Test execution timeout after ${timeoutMs}ms`);
      (timeoutError as any).type = 'EXECUTION_TIMEOUT';
      (timeoutError as any).timeoutMs = timeoutMs;
      (timeoutError as any).scheduleId = context.schedule.id;
      
      reject(timeoutError);
    }, timeoutMs);
    
    // Clear timeout when process completes
    child.on('close', () => {
      clearTimeout(timeoutHandle);
    });
  });
}

/**
 * Parse test results from command output
 */
function parseTestResults(output: string): {
  total?: number;
  passed?: number;
  failed?: number;
  skipped?: number;
} {
  const stats: any = {};

  // Parse pytest output format
  // Example: "=== 12 passed, 3 failed, 1 skipped in 45.67s ==="
  const pytestMatch = output.match(/===\s*(\d+)\s*passed(?:,\s*(\d+)\s*failed)?(?:,\s*(\d+)\s*skipped)?\s*in\s*[\d.]+s\s*===/);
  
  if (pytestMatch) {
    stats.passed = parseInt(pytestMatch[1], 10);
    stats.failed = pytestMatch[2] ? parseInt(pytestMatch[2], 10) : 0;
    stats.skipped = pytestMatch[3] ? parseInt(pytestMatch[3], 10) : 0;
    stats.total = stats.passed + stats.failed + stats.skipped;
  }

  // Alternative parsing for other formats
  if (!stats.total) {
    // Try to parse individual test results
    const testLines = output.split('\n').filter(line => 
      line.includes('PASSED') || line.includes('FAILED') || line.includes('SKIPPED')
    );
    
    stats.passed = testLines.filter(line => line.includes('PASSED')).length;
    stats.failed = testLines.filter(line => line.includes('FAILED')).length;
    stats.skipped = testLines.filter(line => line.includes('SKIPPED')).length;
    stats.total = stats.passed + stats.failed + stats.skipped;
  }

  logger.debug('Parsed test statistics', stats);
  return stats;
}

/**
 * Execute a test suite by suite ID using real test execution
 */
export async function executeSuite(
  suiteId: string, 
  options: {
    scheduledId?: string;
    notes?: string;
    environment?: string;
    mode?: 'headed' | 'headless';
    execution?: 'parallel' | 'sequential';
    browser?: string;
  } = {}
): Promise<ExecutionResult> {
  
  logger.info('Executing suite directly', { suiteId, options });

  const startTime = Date.now();
  
  try {
    // Initialize test suite registry
    await testSuiteRegistry.initialize();
    
    // Get the test suite definition
    const testSuite = testSuiteRegistry.getSuite(suiteId);
    if (!testSuite) {
      throw new SchedulerError('NOT_FOUND', `Test suite not found: ${suiteId}`);
    }

    // Validate the test suite
    const validation = testSuiteRegistry.validateSuite(suiteId);
    if (!validation.valid) {
      throw new SchedulerError('VALIDATION_ERROR', `Test suite validation failed: ${validation.errors.join(', ')}`);
    }

    // Create temporary execution context
    const workerId = `direct_${uuidv4().slice(0, 8)}`;
    const artifactsDir = join(process.cwd(), 'artifacts', 'direct', suiteId, Date.now().toString());
    const tempDir = join(artifactsDir, 'temp');
    
    mkdirSync(artifactsDir, { recursive: true });
    mkdirSync(tempDir, { recursive: true });

    const mockSchedule = {
      id: options.scheduledId || `direct_${suiteId}`,
      suite_id: suiteId,
      suite_name: testSuite.name
    };

    const mockRun = {
      id: `run_${uuidv4().slice(0, 8)}`,
      schedule_id: mockSchedule.id,
      started_at: new Date().toISOString()
    };

    const executionContext: ExecutionContext = {
      schedule: mockSchedule as any,
      run: mockRun as any,
      worker_id: workerId,
      artifacts_dir: artifactsDir,
      temp_dir: tempDir
    };

    // Build and execute the real test command
    const command = buildRealTestCommand(executionContext, testSuite, options);
    const result = await executeCommand(command, executionContext);
    
    // Process artifacts
    const artifacts = await processTestArtifacts(executionContext, testSuite);
    
    const duration = Date.now() - startTime;
    
    return {
      success: result.exitCode === 0,
      exit_code: result.exitCode,
      duration_ms: duration,
      tests_total: result.stats.total || 0,
      tests_passed: result.stats.passed || 0,
      tests_failed: result.stats.failed || 0,
      tests_skipped: result.stats.skipped || 0,
      artifacts_path: artifactsDir,
      log_output: result.stdout + '\n' + result.stderr,
      summary: {
        suite_id: suiteId,
        suite_name: testSuite.name,
        category: testSuite.category,
        execution_time: duration,
        estimated_duration: testSuite.estimatedDurationMs,
        artifacts_generated: artifacts,
        test_files_executed: testSuite.testFiles.length,
        environment: options.environment || 'staging',
        markers: testSuite.markers,
        ...result.stats
      }
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Direct suite execution failed', {
      suiteId,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration
    });
    
    return {
      success: false,
      exit_code: error instanceof SchedulerError ? -2 : -1,
      duration_ms: duration,
      tests_total: 0,
      tests_passed: 0,
      tests_failed: 0,
      tests_skipped: 0,
      error_message: error instanceof Error ? error.message : 'Unknown error',
      log_output: `Suite execution failed: ${error}`,
      summary: {
        suite_id: suiteId,
        error: true,
        error_type: error instanceof SchedulerError ? error.code : 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

/**
 * Capture test failures and send them to self-healing system
 */
async function captureTestFailures(
  context: ExecutionContext,
  result: ExecutionResult,
  options: any
): Promise<void> {
  const healingService = getSelfHealingService();
  
  logger.info('Capturing test failures for self-healing analysis', {
    scheduleId: context.schedule.id,
    testsFailed: result.tests_failed,
    exitCode: result.exit_code
  });

  try {
    // Parse test output to extract individual test failures
    const failures = parseTestFailures(result.log_output || '', result.error_message);
    
    for (const failure of failures) {
      logger.debug('Processing test failure', { 
        testName: failure.testName,
        error: failure.error.substring(0, 100) + '...'
      });

      // Create error object
      const error = new Error(failure.error);
      
      // Get real DOM content for the failure context
      const domContent = await getRealDOMContent();
      
      // Build failure context
      const failureContext = {
        dom: domContent,
        screenshot: Buffer.alloc(0), // Could be enhanced to capture actual screenshots
        consoleErrors: failure.consoleErrors || [],
        networkLogs: [],
        error: failure.error,
        url: 'https://devtest.comda.co.il',
        selector: failure.selector || 'unknown',
        testId: `${context.schedule.suite_id}_${failure.testName}`,
        testName: failure.testName,
        filePath: failure.filePath || context.artifacts_dir,
        timestamp: new Date().toISOString()
      };

      // Add to healing queue for analysis
      await healingService.addToHealingQueue(
        failureContext.testId,
        failure.testName,
        error,
        failureContext
      );
      
      logger.info('Added test failure to healing queue', { 
        testId: failureContext.testId,
        testName: failure.testName
      });
    }
    
  } catch (error) {
    logger.error('Failed to capture test failures for healing', { 
      scheduleId: context.schedule.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Parse test output to extract individual test failures
 */
function parseTestFailures(output: string, errorMessage?: string): Array<{
  testName: string;
  error: string;
  selector?: string;
  filePath?: string;
  consoleErrors?: string[];
}> {
  const failures: Array<{
    testName: string;
    error: string;
    selector?: string;
    filePath?: string;
    consoleErrors?: string[];
  }> = [];
  
  // Parse pytest output format
  const lines = output.split('\n');
  let currentTest = '';
  let currentError = '';
  let inFailureSection = false;
  
  for (const line of lines) {
    // Look for test failure patterns
    const failedTestMatch = line.match(/^(.*\.py::\w+)\s+FAILED/);
    if (failedTestMatch) {
      // Save previous failure if exists
      if (currentTest && currentError) {
        failures.push({
          testName: currentTest,
          error: currentError,
          selector: extractSelector(currentError),
          filePath: extractFilePath(currentTest)
        });
      }
      
      currentTest = failedTestMatch[1];
      currentError = '';
      inFailureSection = true;
      continue;
    }
    
    // Collect error details
    if (inFailureSection && line.trim()) {
      if (line.includes('___')) {
        inFailureSection = false;
      } else {
        currentError += line + '\n';
      }
    }
  }
  
  // Add the last failure
  if (currentTest && currentError) {
    failures.push({
      testName: currentTest,
      error: currentError,
      selector: extractSelector(currentError),
      filePath: extractFilePath(currentTest)
    });
  }
  
  // If no specific failures found but we have an error, create a generic failure
  if (failures.length === 0 && errorMessage) {
    failures.push({
      testName: 'Unknown Test',
      error: errorMessage,
      selector: extractSelector(errorMessage)
    });
  }
  
  return failures;
}

/**
 * Extract selector from error message
 */
function extractSelector(error: string): string | undefined {
  const selectorPatterns = [
    /waiting for selector "([^"]+)"/,
    /locator\('([^']+)'\)/,
    /element not found: ([^\s]+)/,
    /selector not found: ([^\s]+)/,
    /locator failed: ([^\s]+)/
  ];
  
  for (const pattern of selectorPatterns) {
    const match = error.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return undefined;
}

/**
 * Extract file path from test name
 */
function extractFilePath(testName: string): string | undefined {
  const match = testName.match(/^([^:]+\.py)/);
  return match ? match[1] : undefined;
}

/**
 * Process and collect test artifacts after execution
 */
async function processTestArtifacts(
  context: ExecutionContext,
  testSuite: any
): Promise<string[]> {
  const artifacts: string[] = [];
  
  logger.debug('Processing test artifacts', {
    scheduleId: context.schedule.id,
    artifactsDir: context.artifacts_dir
  });

  try {
    // Check for common artifact files and directories
    const artifactChecks = [
      'junit.xml',
      'report.html', 
      'allure-results',
      'screenshots',
      'videos',
      'traces',
      'test-results'
    ];

    for (const artifactName of artifactChecks) {
      const artifactPath = join(context.artifacts_dir, artifactName);
      
      if (existsSync(artifactPath)) {
        artifacts.push(artifactPath);
        logger.debug(`Found artifact: ${artifactName}`, { path: artifactPath });
        
        // If it's a directory, count files inside
        try {
          const stat = require('fs').statSync(artifactPath);
          if (stat.isDirectory()) {
            const files = readdirSync(artifactPath);
            logger.debug(`Artifact directory contains ${files.length} files`, {
              artifact: artifactName,
              files: files.slice(0, 5) // Log first 5 files
            });
          }
        } catch (error) {
          // Ignore stat errors
        }
      }
    }

    // Look for additional artifacts in the WeSign test base directory
    try {
      const wesignArtifacts = [
        join(WESIGN_TESTS_BASE_PATH, 'allure-results'),
        join(WESIGN_TESTS_BASE_PATH, 'screenshots'),
        join(WESIGN_TESTS_BASE_PATH, 'downloads')
      ];

      for (const wesignArtifact of wesignArtifacts) {
        if (existsSync(wesignArtifact)) {
          // Copy WeSign artifacts to our artifacts directory
          const targetPath = join(context.artifacts_dir, require('path').basename(wesignArtifact));
          
          try {
            // For directories, we'll create a symlink or copy reference
            artifacts.push(wesignArtifact);
            logger.debug(`Found WeSign artifact: ${wesignArtifact}`);
          } catch (error) {
            logger.warn(`Failed to process WeSign artifact: ${wesignArtifact}`, { error });
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to check WeSign artifacts', { error });
    }

    // Create artifacts summary file
    const summaryPath = join(context.artifacts_dir, 'artifacts-summary.json');
    const summary = {
      execution_id: context.run.id,
      suite_id: context.schedule.suite_id,
      suite_name: testSuite.name,
      artifacts_found: artifacts.length,
      artifacts_list: artifacts,
      generated_at: new Date().toISOString(),
      base_path: context.artifacts_dir
    };

    require('fs').writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    artifacts.push(summaryPath);

    logger.info('Artifacts processing completed', {
      scheduleId: context.schedule.id,
      artifactsFound: artifacts.length,
      summaryPath
    });

  } catch (error) {
    logger.error('Failed to process artifacts', {
      scheduleId: context.schedule.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  return artifacts;
}

/**
 * Get real DOM content by connecting to WeSign application
 */
async function getRealDOMContent(): Promise<string> {
  try {
    const { chromium } = require('playwright');
    
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      // Navigate to WeSign demo environment
      await page.goto('https://devtest.comda.co.il', { 
        waitUntil: 'domcontentloaded',
        timeout: 10000 
      });
      
      // Get the page content
      const domContent = await page.content();
      
      await browser.close();
      return domContent;
    } catch (error) {
      await browser.close();
      logger.warn('Failed to get real DOM content, using fallback', { error: error.message });
      
      // Fallback DOM content with common WeSign elements
      return `
        <html>
          <body>
            <div class="login-container">
              <form class="login-form">
                <input type="email" name="email" placeholder="Email" />
                <input type="password" name="password" placeholder="Password" />
                <button type="submit" class="btn btn-primary login-button">התחבר</button>
                <button type="submit" id="login-btn" class="submit-button">Login</button>
              </form>
            </div>
            <div class="dashboard">
              <button class="upload-document">העלה מסמך</button>
              <button id="upload-btn" class="document-upload">Upload Document</button>
              <div class="document-list">
                <button class="sign-document">חתום</button>
                <button id="sign-btn" class="signature-button">Sign</button>
              </div>
            </div>
          </body>
        </html>
      `;
    }
  } catch (error) {
    logger.error('Failed to get real DOM content', { error: error.message });
    return '<div>Error retrieving DOM content</div>';
  }
}