/**
 * Test Execution API Routes
 * Direct test execution endpoints for frontend integration
 */

import { Router } from 'express';
import { spawn } from 'child_process';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler } from '../middleware/error-handler';
import { logger } from '../utils/logger';
import { getSelfHealingService } from '../services/selfHealingService';

const router = Router();

/**
 * POST /api/execute/pytest
 * Execute Python tests directly with pytest
 */
router.post('/pytest', asyncHandler(async (req, res) => {
  const { 
    testFiles = [],
    markers = [],
    browser = 'chromium',
    mode = 'headless',
    environment = 'devtest.comda.co.il',
    options = {},
    retries = undefined  // Accept retries parameter for suite execution
  } = req.body;

  const executionId = uuidv4();
  const artifactsDir = join(process.cwd(), 'artifacts', 'executions', executionId);
  
  // Ensure artifacts directory exists
  mkdirSync(artifactsDir, { recursive: true });

  logger.info('Starting pytest execution', { 
    executionId, 
    testFiles, 
    markers, 
    browser, 
    mode,
    environment
  });

  try {
    // Build pytest command using system python
    const pythonPath = 'C:\\Users\\gals\\AppData\\Local\\Programs\\Python\\Python312\\python.exe';
    const command = [pythonPath, '-m', 'pytest'];
    
    // Add test files or default to tests directory
    if (testFiles.length > 0) {
      command.push(...testFiles);
    } else {
      command.push('tests/');
    }

    // Add markers
    if (markers.length > 0) {
      command.push('-m', markers.join(' or '));
    }

    // Add browser selection
    if (browser !== 'all') {
      command.push('--browser', browser);
    }

    // Add execution mode
    if (mode === 'headed') {
      command.push('--headed');
    }

    // Add retry configuration
    // For single tests (no retries parameter or undefined), explicitly disable retries
    // For suites, use the configured retry count
    if (retries !== undefined && retries > 0) {
      command.push('--reruns', String(retries));
      logger.info('Adding retry configuration', { retries, executionId });
    } else {
      // Explicitly disable retries for single test execution
      command.push('--reruns', '0');
      logger.info('Disabling retries for single test execution', { executionId });
    }

    // Add reporting options
    command.push('--tb=short');
    command.push('--disable-warnings');
    command.push('-v'); // Verbose for better tracking

    // Add artifacts
    const junitPath = join(artifactsDir, 'junit.xml');
    const htmlPath = join(artifactsDir, 'report.html');
    const allureResultsPath = join(artifactsDir, 'allure-results');
    
    command.push('--junit-xml', junitPath);
    command.push('--html', htmlPath);
    command.push('--alluredir', allureResultsPath);
    command.push('--clean-alluredir');
    command.push('--screenshot=only-on-failure');
    command.push('--video=retain-on-failure');

    // Execute in background and return execution ID immediately
    const execution = executeTestsAsync(executionId, command, artifactsDir, environment);
    
    // Store execution promise for status checking
    activeExecutions.set(executionId, execution);

    res.status(202).json({
      executionId,
      status: 'started',
      command: command.join(' '),
      artifactsDir,
      message: 'Test execution started. Use /api/execute/status/:id to check progress.'
    });

  } catch (error) {
    logger.error('Failed to start test execution', { error, executionId });
    res.status(500).json({
      error: 'Failed to start test execution',
      executionId,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * GET /api/execute/status/:executionId
 * Get status of running test execution
 */
router.get('/status/:executionId', asyncHandler(async (req, res) => {
  const { executionId } = req.params;
  
  if (!activeExecutions.has(executionId) && !completedExecutions.has(executionId)) {
    return res.status(404).json({
      error: 'Execution not found',
      executionId
    });
  }

  // Return completed result if available
  if (completedExecutions.has(executionId)) {
    const result = completedExecutions.get(executionId);
    return res.json(result);
  }

  // Return running status
  const execution = activeExecutions.get(executionId);
  if (execution) {
    res.json({
      executionId,
      status: 'running',
      startedAt: execution.startedAt,
      message: 'Test execution in progress...'
    });
  }
}));

/**
 * GET /api/execute/history
 * Get execution history
 */
router.get('/history', asyncHandler(async (req, res) => {
  const history = Array.from(completedExecutions.values())
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    .slice(0, 50); // Last 50 executions

  res.json({
    executions: history,
    total: history.length
  });
}));

/**
 * DELETE /api/execute/:executionId
 * Cancel running execution
 */
router.delete('/:executionId', asyncHandler(async (req, res) => {
  const { executionId } = req.params;
  
  const execution = activeExecutions.get(executionId);
  if (!execution) {
    return res.status(404).json({
      error: 'Execution not found or already completed',
      executionId
    });
  }

  try {
    // Kill the process if it exists
    if (execution.process && !execution.process.killed) {
      execution.process.kill('SIGTERM');
      logger.info('Test execution cancelled', { executionId });
    }

    activeExecutions.delete(executionId);
    
    res.json({
      executionId,
      status: 'cancelled',
      message: 'Test execution cancelled successfully'
    });

  } catch (error) {
    logger.error('Failed to cancel execution', { error, executionId });
    res.status(500).json({
      error: 'Failed to cancel execution',
      executionId
    });
  }
}));

// Storage for active and completed executions
const activeExecutions = new Map();
const completedExecutions = new Map();

/**
 * Execute tests asynchronously and track results
 */
async function executeTestsAsync(
  executionId: string,
  command: string[],
  artifactsDir: string,
  environment: string
): Promise<any> {
  
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    logger.info('Executing pytest command', { 
      executionId, 
      command: command.join(' '),
      cwd: process.cwd()
    });

    // Create clean environment for pytest (avoid backend env conflicts)
    const cleanEnv = {
      PATH: process.env.PATH,
      PYTHONPATH: process.cwd(),
      SystemRoot: process.env.SystemRoot,
      TEMP: process.env.TEMP,
      TMP: process.env.TMP,
      ARTIFACTS_DIR: artifactsDir,
      TEST_ENVIRONMENT: environment,
      EXECUTION_ID: executionId,
      // Basic Windows env vars
      USERPROFILE: process.env.USERPROFILE,
      HOMEDRIVE: process.env.HOMEDRIVE,
      HOMEPATH: process.env.HOMEPATH
    };

    const child = spawn(command[0], command.slice(1), {
      cwd: 'C:\\Users\\gals\\seleniumpythontests-1\\playwright_tests', // Run from WeSign test directory
      env: cleanEnv,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      logger.debug('Test stdout', { executionId, output: output.trim() });
    });

    child.stderr.on('data', (data) => {
      const error = data.toString();
      stderr += error;
      logger.debug('Test stderr', { executionId, error: error.trim() });
    });

    child.on('close', async (code) => {
      const duration = Date.now() - startTime;
      
      logger.info('Test execution completed', { 
        executionId,
        exitCode: code,
        duration,
        stdoutLength: stdout.length,
        stderrLength: stderr.length
      });

      // Parse test results
      const stats = parseTestResults(stdout + stderr);
      
      // Capture test failures for self-healing if any tests failed
      if (code !== 0 && stats.failed > 0) {
        await captureTestFailuresForHealing(executionId, stdout, stderr, stats);
      }
      
      // Generate Allure HTML report if results exist
      const allureResultsPath = join(artifactsDir, 'allure-results');
      const allureReportPath = join(artifactsDir, 'allure-report');
      let allureGenerated = false;
      
      if (existsSync(allureResultsPath)) {
        try {
          logger.info('Generating Allure HTML report', { executionId, allureResultsPath });
          
          // Generate Allure HTML report synchronously
          const allureCommand = ['allure', 'generate', allureResultsPath, '-o', allureReportPath, '--clean'];
          
          await new Promise<void>((resolve, reject) => {
            const allureProcess = spawn(allureCommand[0], allureCommand.slice(1), {
              cwd: process.cwd(),
              stdio: ['pipe', 'pipe', 'pipe']
            });
            
            let stdout = '';
            let stderr = '';
            
            allureProcess.stdout?.on('data', (data) => {
              stdout += data.toString();
            });
            
            allureProcess.stderr?.on('data', (data) => {
              stderr += data.toString();
            });
            
            allureProcess.on('close', (allureCode) => {
              if (allureCode === 0) {
                allureGenerated = true;
                logger.info('Allure report generated successfully', { 
                  executionId, 
                  allureReportPath,
                  stdout: stdout.slice(-200), // Last 200 chars for logging
                  stderr: stderr.slice(-200)
                });
              } else {
                logger.warn('Allure report generation failed', { 
                  executionId, 
                  exitCode: allureCode,
                  stdout: stdout.slice(-200),
                  stderr: stderr.slice(-200)
                });
              }
              resolve();
            });
            
            allureProcess.on('error', (allureError) => {
              logger.warn('Allure command failed', { executionId, error: allureError.message });
              resolve(); // Don't fail the entire process
            });
          });
        } catch (error) {
          logger.warn('Allure report generation error', { executionId, error });
        }
      }
      
      const result = {
        executionId,
        status: code === 0 ? 'completed' : 'failed',
        exitCode: code,
        duration,
        stats,
        artifacts: {
          directory: artifactsDir,
          junit: join(artifactsDir, 'junit.xml'),
          html: join(artifactsDir, 'report.html'),
          allureResults: allureResultsPath,
          allureReport: allureGenerated ? allureReportPath : null,
          screenshots: join(artifactsDir, 'screenshots'),
          videos: join(artifactsDir, 'videos'),
          logs: join(artifactsDir, 'logs')
        },
        output: {
          stdout: stdout.slice(-5000), // Last 5KB for display
          stderr: stderr.slice(-5000)
        },
        command: command.join(' '),
        startedAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString()
      };

      // Move to completed executions
      activeExecutions.delete(executionId);
      completedExecutions.set(executionId, result);

      // Clean up old completed executions (keep last 100)
      if (completedExecutions.size > 100) {
        const entries = Array.from(completedExecutions.entries());
        const sorted = entries.sort((a, b) => 
          new Date(b[1].completedAt).getTime() - new Date(a[1].completedAt).getTime()
        );
        completedExecutions.clear();
        sorted.slice(0, 100).forEach(([id, result]) => {
          completedExecutions.set(id, result);
        });
      }

      resolve(result);
    });

    child.on('error', (error) => {
      logger.error('Test execution process error', { 
        executionId,
        error: error.message,
        command: command.join(' ')
      });
      
      activeExecutions.delete(executionId);
      reject(error);
    });

    // Store process reference for cancellation
    const execution = {
      startedAt: new Date(startTime).toISOString(),
      process: child,
      command: command.join(' ')
    };
    
    activeExecutions.set(executionId, execution);

    // Set timeout (default 10 minutes)
    const timeoutMs = 10 * 60 * 1000;
    setTimeout(() => {
      if (!child.killed) {
        logger.warn('Test execution timeout, killing process', { executionId, timeoutMs });
        child.kill('SIGKILL');
      }
    }, timeoutMs);
  });
}

/**
 * Parse test results from pytest output
 */
function parseTestResults(output: string): {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  errors: number;
} {
  const stats = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    errors: 0
  };

  // Parse pytest summary line
  // Example: "=== 12 passed, 3 failed, 1 skipped in 45.67s ==="
  const pytestMatch = output.match(/===\s*(?:(\d+)\s*passed)?(?:,\s*(\d+)\s*failed)?(?:,\s*(\d+)\s*skipped)?(?:,\s*(\d+)\s*error)?\s*.*in\s*[\d.]+s\s*===/);
  
  if (pytestMatch) {
    stats.passed = pytestMatch[1] ? parseInt(pytestMatch[1], 10) : 0;
    stats.failed = pytestMatch[2] ? parseInt(pytestMatch[2], 10) : 0;
    stats.skipped = pytestMatch[3] ? parseInt(pytestMatch[3], 10) : 0;
    stats.errors = pytestMatch[4] ? parseInt(pytestMatch[4], 10) : 0;
    stats.total = stats.passed + stats.failed + stats.skipped + stats.errors;
  }

  // Alternative: count individual test results
  if (stats.total === 0) {
    const testLines = output.split('\n');
    stats.passed = testLines.filter(line => line.includes('PASSED')).length;
    stats.failed = testLines.filter(line => line.includes('FAILED')).length;
    stats.skipped = testLines.filter(line => line.includes('SKIPPED')).length;
    stats.errors = testLines.filter(line => line.includes('ERROR')).length;
    stats.total = stats.passed + stats.failed + stats.skipped + stats.errors;
  }

  logger.debug('Parsed test statistics', stats);
  return stats;
}

/**
 * Capture test failures and send them to self-healing system
 */
async function captureTestFailuresForHealing(
  executionId: string,
  stdout: string,
  stderr: string,
  stats: any
): Promise<void> {
  const healingService = getSelfHealingService();
  
  logger.info('Capturing test failures for self-healing analysis', {
    executionId,
    testsFailed: stats.failed,
    testsTotal: stats.total
  });

  try {
    // Parse test output to extract individual test failures
    const failures = parseIndividualFailures(stdout, stderr);
    
    for (const failure of failures) {
      logger.debug('Processing test failure for healing', { 
        executionId,
        testName: failure.testName,
        error: failure.error.substring(0, 100) + '...'
      });

      // Create error object
      const error = new Error(failure.error);
      
      // Get real DOM content for the failure context
      const domContent = await getRealDOMContentForHealing();
      
      // Build failure context
      const failureContext = {
        dom: domContent,
        screenshot: Buffer.alloc(0), // Could be enhanced to capture actual screenshots
        consoleErrors: failure.consoleErrors || [],
        networkLogs: [],
        error: failure.error,
        url: 'https://devtest.comda.co.il',
        selector: failure.selector || 'unknown',
        testId: `execution_${executionId}_${failure.testName}`,
        testName: failure.testName,
        filePath: failure.filePath || `execution_${executionId}`,
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
        executionId,
        testId: failureContext.testId,
        testName: failure.testName
      });
    }
    
  } catch (error) {
    logger.error('Failed to capture test failures for healing', { 
      executionId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Parse test output to extract individual test failures
 */
function parseIndividualFailures(stdout: string, stderr: string): Array<{
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
  
  const output = stdout + '\n' + stderr;
  const lines = output.split('\n');
  let currentTest = '';
  let currentError = '';
  let inFailureSection = false;
  
  for (const line of lines) {
    // Look for test failure patterns
    const failedTestMatch = line.match(/^(.*\.py::\w+)\s+FAILED/) || 
                           line.match(/^(test_[^\s]+)\s+FAILED/) ||
                           line.match(/^(\w+::\w+)\s+FAILED/);
    
    if (failedTestMatch) {
      // Save previous failure if exists
      if (currentTest && currentError) {
        failures.push({
          testName: currentTest,
          error: currentError,
          selector: extractSelectorFromError(currentError),
          filePath: extractFilePathFromTest(currentTest)
        });
      }
      
      currentTest = failedTestMatch[1];
      currentError = '';
      inFailureSection = true;
      continue;
    }
    
    // Look for Playwright error patterns
    const playwrightErrorMatch = line.match(/TimeoutError:|Error:|playwright\._impl\._errors/);
    if (playwrightErrorMatch && !inFailureSection) {
      // Single error without specific test name
      if (!currentTest) {
        currentTest = 'Unknown Test';
      }
      inFailureSection = true;
    }
    
    // Collect error details
    if (inFailureSection && line.trim()) {
      if (line.includes('___') || line.includes('=====') || line.includes('short test summary')) {
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
      selector: extractSelectorFromError(currentError),
      filePath: extractFilePathFromTest(currentTest)
    });
  }
  
  return failures;
}

/**
 * Extract selector from error message
 */
function extractSelectorFromError(error: string): string | undefined {
  const selectorPatterns = [
    /waiting for locator\("([^"]+)"\)/,
    /locator\("([^"]+)"\)/,
    /waiting for selector "([^"]+)"/,
    /element not found: ([^\s]+)/,
    /selector not found: ([^\s]+)/,
    /TimeoutError: Locator\.[\w]+: Timeout.*locator\("([^"]+)"\)/,
    /input\.[\w-]+\[name='([^']+)'\]/,
    /button\.[\w-]+\[data-cy='([^']+)'\]/
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
function extractFilePathFromTest(testName: string): string | undefined {
  const match = testName.match(/^([^:]+\.py)/);
  return match ? match[1] : undefined;
}

/**
 * Get real DOM content by connecting to WeSign application
 */
async function getRealDOMContentForHealing(): Promise<string> {
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
      logger.warn('Failed to get real DOM content for healing, using fallback', { 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
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
    logger.error('Failed to get real DOM content for healing', { 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return '<div>Error retrieving DOM content</div>';
  }
}

export { router as testExecutionRouter };