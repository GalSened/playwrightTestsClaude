/**
 * WeSign Framework Adapter - Phase 2 Implementation
 * Adapts WeSign/pytest framework to work with UnifiedTestEngine
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../../../utils/logger';
import {
  TestFrameworkAdapter,
  TestCommand,
  ExecutionArtifacts
} from '../UnifiedTestEngine';
import {
  UnifiedTestConfig,
  TestResult
} from '../types';

export class WeSignAdapter implements TestFrameworkAdapter {
  readonly name = 'wesign';
  private readonly pythonPath = 'C:/Users/gals/AppData/Local/Programs/Python/Python312/python.exe';
  private readonly testDirectory = 'C:/Users/gals/Desktop/playwrightTestsClaude/new_tests_for_wesign';

  supports(config: UnifiedTestConfig): boolean {
    return config.framework === 'wesign';
  }

  async buildCommand(config: UnifiedTestConfig, executionId: string): Promise<TestCommand> {
    logger.info('Building WeSign command', { executionId, config });

    const args = ['-m', 'pytest'];

    // Add test selection
    if (config.tests.testIds && config.tests.testIds.length > 0) {
      config.tests.testIds.forEach(testId => {
        // Handle both absolute paths and relative test identifiers
        if (path.isAbsolute(testId)) {
          args.push(path.relative(this.testDirectory, testId));
        } else {
          args.push(testId);
        }
      });
    } else if (config.tests.suites && config.tests.suites.length > 0) {
      config.tests.suites.forEach(suite => {
        args.push(`tests/${suite}/`);
      });
    } else if (config.tests.categories && config.tests.categories.length > 0) {
      // Use markers for categories
      const categoryMarkers = config.tests.categories.join(' or ');
      args.push('-m', categoryMarkers);
    } else if (config.tests.pattern) {
      args.push(config.tests.pattern);
    } else {
      args.push('tests/'); // Default to all tests
    }

    // Add execution configuration
    this.addExecutionOptions(args, config);

    // Add reporting and output options
    this.addReportingOptions(args, executionId);

    const command: TestCommand = {
      executable: this.pythonPath,
      args,
      cwd: this.testDirectory,
      env: {
        PYTHONPATH: this.testDirectory,
        EXECUTION_ID: executionId,
        WESIGN_BASE_URL: process.env.WESIGN_BASE_URL || 'https://devtest.comda.co.il',
        PYTEST_CURRENT_TEST: '',
        ...this.getBrowserEnvironment(config)
      },
      timeout: config.execution.timeout || 300000 // 5 minute default
    };

    logger.debug('Built WeSign command', { command });
    return command;
  }

  parseResults(stdout: string, stderr: string): TestResult[] {
    logger.debug('Parsing WeSign test results', {
      stdoutLength: stdout.length,
      stderrLength: stderr.length
    });

    const results: TestResult[] = [];
    const lines = stdout.split('\n');

    let currentTest: Partial<TestResult> = {};
    let inTestSection = false;

    for (const line of lines) {
      // Parse individual test results
      // Example: tests/auth/test_login.py::test_successful_login PASSED [100%] 0.85s
      const testResultMatch = line.match(/^([^:]+)::[^:]+::([^:\s]+)\s+(PASSED|FAILED|SKIPPED)(?:\s+\[[\d%]+\])?\s*([\d.]+s)?/);

      if (testResultMatch) {
        const [, filePath, testFunction, status, duration] = testResultMatch;

        const testResult: TestResult = {
          testId: `${filePath}::${testFunction}`,
          testName: testFunction,
          status: this.mapTestStatus(status),
          duration: this.parseDuration(duration || '0s'),
          artifacts: {
            screenshots: [],
            videos: [],
            traces: [],
            logs: []
          }
        };

        // If previous test was being processed and had failures, include error
        if (currentTest.testId === testResult.testId && currentTest.error) {
          testResult.error = currentTest.error;
        }

        results.push(testResult);
        currentTest = {};
        continue;
      }

      // Parse test failures
      const failureMatch = line.match(/^FAILED\s+([^:]+)::[^:]+::([^:\s]+)/);
      if (failureMatch) {
        const [, filePath, testFunction] = failureMatch;
        currentTest = {
          testId: `${filePath}::${testFunction}`,
          testName: testFunction,
          status: 'failed'
        };
        inTestSection = true;
        continue;
      }

      // Capture error details
      if (inTestSection && line.trim()) {
        if (line.includes('========') || line.includes('___')) {
          inTestSection = false;
        } else if (currentTest.testId) {
          if (!currentTest.error) {
            currentTest.error = '';
          }
          currentTest.error += line.trim() + '\n';
        }
      }

      // Parse summary statistics
      const summaryMatch = line.match(/=+\s*(\d+)\s+(passed|failed|skipped)(?:,\s*(\d+)\s+(passed|failed|skipped))*.*in\s*([\d.]+s)/);
      if (summaryMatch) {
        // Summary information is useful for validation but individual results are already parsed
        logger.debug('Test execution summary found', { line: line.trim() });
      }
    }

    // Handle stderr for additional error information
    if (stderr && stderr.trim()) {
      this.parseStderrErrors(stderr, results);
    }

    logger.info('Parsed WeSign test results', {
      totalTests: results.length,
      passed: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed').length,
      skipped: results.filter(r => r.status === 'skipped').length
    });

    return results;
  }

  async getArtifacts(executionId: string): Promise<ExecutionArtifacts> {
    logger.debug('Collecting WeSign artifacts', { executionId });

    const artifacts: ExecutionArtifacts = {
      screenshots: [],
      videos: [],
      traces: [],
      reports: [],
      logs: []
    };

    try {
      // Check for pytest-generated artifacts
      const artifactPaths = [
        path.join(this.testDirectory, 'test-results'),
        path.join(this.testDirectory, 'screenshots'),
        path.join(this.testDirectory, 'videos'),
        path.join(this.testDirectory, 'traces'),
        path.join(this.testDirectory, 'reports'),
        path.join(this.testDirectory, 'allure-results'),
        path.join(this.testDirectory, '.pytest_cache')
      ];

      for (const artifactPath of artifactPaths) {
        if (fs.existsSync(artifactPath)) {
          await this.collectArtifactsFromDirectory(artifactPath, artifacts);
        }
      }

      // Look for specific report files
      const reportFiles = [
        'pytest-report.html',
        'coverage.xml',
        'junit.xml',
        'allure-report.html'
      ];

      for (const reportFile of reportFiles) {
        const reportPath = path.join(this.testDirectory, reportFile);
        if (fs.existsSync(reportPath)) {
          artifacts.reports.push(reportPath);
        }
      }

      logger.debug('Collected WeSign artifacts', {
        executionId,
        screenshots: artifacts.screenshots.length,
        videos: artifacts.videos.length,
        traces: artifacts.traces.length,
        reports: artifacts.reports.length,
        logs: artifacts.logs.length
      });

    } catch (error) {
      logger.warn('Failed to collect some WeSign artifacts', {
        executionId,
        error: error instanceof Error ? error.message : error
      });
    }

    return artifacts;
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Check Python availability
      const pythonCheck = await this.checkPython();
      if (!pythonCheck) {
        return false;
      }

      // Check pytest availability
      const pytestCheck = await this.checkPytest();
      if (!pytestCheck) {
        return false;
      }

      // Check test directory
      if (!fs.existsSync(this.testDirectory)) {
        logger.error('WeSign test directory not found', { directory: this.testDirectory });
        return false;
      }

      // Check for required dependencies
      const depCheck = await this.checkDependencies();
      if (!depCheck) {
        return false;
      }

      return true;

    } catch (error) {
      logger.error('WeSign adapter health check failed', {
        error: error instanceof Error ? error.message : error
      });
      return false;
    }
  }

  private addExecutionOptions(args: string[], config: UnifiedTestConfig): void {
    // Browser configuration
    if (config.execution.browser) {
      args.push(`--browser=${config.execution.browser}`);
    }

    // Headless mode
    if (config.execution.headless === false) {
      args.push('--headed');
    }

    // Parallel execution
    if (config.execution.mode === 'parallel' && config.execution.workers) {
      args.push('-n', config.execution.workers.toString());
    }

    // Timeout configuration
    if (config.execution.timeout) {
      args.push('--timeout', Math.ceil(config.execution.timeout / 1000).toString());
    }

    // Additional pytest options
    args.push(
      '--tb=short',           // Short traceback format
      '--verbose',            // Verbose output
      '--strict-markers',     // Strict marker checking
      '--disable-warnings',   // Reduce noise
      '--maxfail=10'         // Stop after 10 failures
    );

    // AI and monitoring options
    if (config.ai.enabled) {
      args.push('--capture=no'); // Don't capture output for real-time monitoring
    }

    // Add tags/markers if specified
    if (config.tests.tags && config.tests.tags.length > 0) {
      const tagExpression = config.tests.tags.join(' or ');
      args.push('-m', tagExpression);
    }
  }

  private addReportingOptions(args: string[], executionId: string): void {
    // JUnit XML for CI integration
    args.push('--junit-xml', `reports/junit-${executionId}.xml`);

    // HTML report
    args.push('--html', `reports/report-${executionId}.html`);
    args.push('--self-contained-html');

    // Allure reporting
    args.push('--alluredir', `allure-results/${executionId}`);

    // Coverage if available
    args.push('--cov=.', `--cov-report=html:reports/coverage-${executionId}`);
  }

  private getBrowserEnvironment(config: UnifiedTestConfig): Record<string, string> {
    const env: Record<string, string> = {};

    if (config.execution.browser) {
      env.BROWSER = config.execution.browser;
    }

    if (config.execution.headless !== undefined) {
      env.HEADLESS = config.execution.headless.toString();
    }

    return env;
  }

  private mapTestStatus(pytestStatus: string): TestResult['status'] {
    switch (pytestStatus.toUpperCase()) {
      case 'PASSED':
        return 'passed';
      case 'FAILED':
        return 'failed';
      case 'SKIPPED':
        return 'skipped';
      default:
        return 'failed';
    }
  }

  private parseDuration(durationStr: string): number {
    const match = durationStr.match(/([\d.]+)([a-z]+)/);
    if (!match) {
      return 0;
    }

    const value = parseFloat(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'ms':
        return value;
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      default:
        return value * 1000; // Default to seconds
    }
  }

  private parseStderrErrors(stderr: string, results: TestResult[]): void {
    const lines = stderr.split('\n');
    let currentTestId: string | null = null;

    for (const line of lines) {
      // Look for test identifiers in stderr
      const testIdMatch = line.match(/([^:]+)::[^:]+::([^:\s]+)/);
      if (testIdMatch) {
        currentTestId = `${testIdMatch[1]}::${testIdMatch[2]}`;
      }

      // If we have an error line and a current test, add it
      if (currentTestId && (line.includes('ERROR') || line.includes('Exception') || line.includes('AssertionError'))) {
        const result = results.find(r => r.testId === currentTestId);
        if (result) {
          if (!result.error) {
            result.error = '';
          }
          result.error += line.trim() + '\n';
        }
      }
    }
  }

  private async collectArtifactsFromDirectory(dirPath: string, artifacts: ExecutionArtifacts): Promise<void> {
    try {
      const items = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(dirPath, item.name);

        if (item.isFile()) {
          const ext = path.extname(item.name).toLowerCase();

          switch (ext) {
            case '.png':
            case '.jpg':
            case '.jpeg':
              artifacts.screenshots.push(fullPath);
              break;
            case '.mp4':
            case '.webm':
              artifacts.videos.push(fullPath);
              break;
            case '.zip':
            case '.har':
              artifacts.traces.push(fullPath);
              break;
            case '.html':
            case '.xml':
            case '.json':
              artifacts.reports.push(fullPath);
              break;
            case '.log':
            case '.txt':
              artifacts.logs.push(fullPath);
              break;
          }
        } else if (item.isDirectory()) {
          // Recursively collect from subdirectories
          await this.collectArtifactsFromDirectory(fullPath, artifacts);
        }
      }
    } catch (error) {
      logger.warn('Failed to collect artifacts from directory', {
        directory: dirPath,
        error: error instanceof Error ? error.message : error
      });
    }
  }

  private async checkPython(): Promise<boolean> {
    return new Promise((resolve) => {
      const process = spawn(this.pythonPath, ['--version'], { stdio: 'pipe' });

      process.on('close', (code) => {
        resolve(code === 0);
      });

      process.on('error', () => {
        resolve(false);
      });

      setTimeout(() => {
        process.kill('SIGTERM');
        resolve(false);
      }, 5000);
    });
  }

  private async checkPytest(): Promise<boolean> {
    return new Promise((resolve) => {
      const process = spawn(this.pythonPath, ['-m', 'pytest', '--version'], { stdio: 'pipe' });

      process.on('close', (code) => {
        resolve(code === 0);
      });

      process.on('error', () => {
        resolve(false);
      });

      setTimeout(() => {
        process.kill('SIGTERM');
        resolve(false);
      }, 5000);
    });
  }

  private async checkDependencies(): Promise<boolean> {
    const requiredPackages = ['playwright', 'pytest', 'pytest-html', 'pytest-xdist'];

    for (const pkg of requiredPackages) {
      const hasPackage = await this.checkPythonPackage(pkg);
      if (!hasPackage) {
        logger.warn('Required Python package not found', { package: pkg });
        return false;
      }
    }

    return true;
  }

  private async checkPythonPackage(packageName: string): Promise<boolean> {
    return new Promise((resolve) => {
      const process = spawn(this.pythonPath, ['-c', `import ${packageName}`], { stdio: 'pipe' });

      process.on('close', (code) => {
        resolve(code === 0);
      });

      process.on('error', () => {
        resolve(false);
      });

      setTimeout(() => {
        process.kill('SIGTERM');
        resolve(false);
      }, 3000);
    });
  }
}