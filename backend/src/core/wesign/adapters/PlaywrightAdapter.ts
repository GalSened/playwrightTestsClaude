/**
 * Playwright Framework Adapter - Phase 2 Implementation
 * Adapts Playwright framework to work with UnifiedTestEngine
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

export class PlaywrightAdapter implements TestFrameworkAdapter {
  readonly name = 'playwright';
  private readonly testDirectory = process.cwd();

  supports(config: UnifiedTestConfig): boolean {
    return config.framework === 'playwright';
  }

  async buildCommand(config: UnifiedTestConfig, executionId: string): Promise<TestCommand> {
    logger.info('Building Playwright command', { executionId, config });

    const args = ['playwright', 'test'];

    // Add test selection
    if (config.tests.testIds && config.tests.testIds.length > 0) {
      config.tests.testIds.forEach(testId => {
        args.push(testId);
      });
    } else if (config.tests.pattern) {
      args.push(config.tests.pattern);
    }

    // Add execution configuration
    this.addExecutionOptions(args, config);

    // Add reporting options
    this.addReportingOptions(args, executionId);

    const command: TestCommand = {
      executable: 'npx',
      args,
      cwd: this.testDirectory,
      env: {
        EXECUTION_ID: executionId,
        PWTEST_OUTPUT_DIR: `test-results-${executionId}`,
        ...this.getBrowserEnvironment(config)
      },
      timeout: config.execution.timeout || 300000
    };

    logger.debug('Built Playwright command', { command });
    return command;
  }

  parseResults(stdout: string, stderr: string): TestResult[] {
    logger.debug('Parsing Playwright test results', {
      stdoutLength: stdout.length,
      stderrLength: stderr.length
    });

    const results: TestResult[] = [];
    const lines = stdout.split('\n');

    for (const line of lines) {
      // Parse individual test results
      // Example: ✓ tests/example.spec.ts:3:5 › test name (1.2s)
      const testResultMatch = line.match(/^[✓✗⚠]\s+([^›]+)›\s+([^(]+)(?:\s*\(([^)]+)\))?/);

      if (testResultMatch) {
        const [, filePath, testName, duration] = testResultMatch;
        const status = line.startsWith('✓') ? 'passed' :
                      line.startsWith('✗') ? 'failed' : 'skipped';

        const testResult: TestResult = {
          testId: `${filePath.trim()}::${testName.trim()}`,
          testName: testName.trim(),
          status: status as TestResult['status'],
          duration: this.parseDuration(duration || '0ms'),
          artifacts: {
            screenshots: [],
            videos: [],
            traces: [],
            logs: []
          }
        };

        results.push(testResult);
        continue;
      }

      // Parse JSON reporter output if available
      try {
        if (line.trim().startsWith('{')) {
          const jsonResult = JSON.parse(line.trim());
          if (jsonResult.type === 'testEnd') {
            const testResult = this.parseJsonTestResult(jsonResult);
            if (testResult) {
              results.push(testResult);
            }
          }
        }
      } catch {
        // Not JSON, continue parsing other formats
      }
    }

    // Parse summary for validation
    this.parseTestSummary(stdout);

    logger.info('Parsed Playwright test results', {
      totalTests: results.length,
      passed: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed').length,
      skipped: results.filter(r => r.status === 'skipped').length
    });

    return results;
  }

  async getArtifacts(executionId: string): Promise<ExecutionArtifacts> {
    logger.debug('Collecting Playwright artifacts', { executionId });

    const artifacts: ExecutionArtifacts = {
      screenshots: [],
      videos: [],
      traces: [],
      reports: [],
      logs: []
    };

    try {
      // Check for Playwright-generated artifacts
      const artifactPaths = [
        path.join(this.testDirectory, 'test-results'),
        path.join(this.testDirectory, `test-results-${executionId}`),
        path.join(this.testDirectory, 'playwright-report'),
        path.join(this.testDirectory, 'traces')
      ];

      for (const artifactPath of artifactPaths) {
        if (fs.existsSync(artifactPath)) {
          await this.collectPlaywrightArtifacts(artifactPath, artifacts);
        }
      }

      // Look for specific Playwright files
      const reportFiles = [
        'playwright-report/index.html',
        'test-results.json',
        'junit-results.xml'
      ];

      for (const reportFile of reportFiles) {
        const reportPath = path.join(this.testDirectory, reportFile);
        if (fs.existsSync(reportPath)) {
          artifacts.reports.push(reportPath);
        }
      }

      logger.debug('Collected Playwright artifacts', {
        executionId,
        screenshots: artifacts.screenshots.length,
        videos: artifacts.videos.length,
        traces: artifacts.traces.length,
        reports: artifacts.reports.length,
        logs: artifacts.logs.length
      });

    } catch (error) {
      logger.warn('Failed to collect some Playwright artifacts', {
        executionId,
        error: error instanceof Error ? error.message : error
      });
    }

    return artifacts;
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Check if Playwright is installed
      const playwrightCheck = await this.checkPlaywright();
      if (!playwrightCheck) {
        return false;
      }

      // Check if browsers are installed
      const browserCheck = await this.checkBrowsers();
      if (!browserCheck) {
        logger.warn('Playwright browsers not installed, run: npx playwright install');
        return false;
      }

      // Check for playwright.config file
      const configExists = this.checkPlaywrightConfig();
      if (!configExists) {
        logger.warn('Playwright config file not found');
      }

      return true;

    } catch (error) {
      logger.error('Playwright adapter health check failed', {
        error: error instanceof Error ? error.message : error
      });
      return false;
    }
  }

  private addExecutionOptions(args: string[], config: UnifiedTestConfig): void {
    // Browser configuration
    if (config.execution.browser) {
      args.push('--project', config.execution.browser);
    }

    // Headless mode
    if (config.execution.headless === false) {
      args.push('--headed');
    }

    // Parallel execution
    if (config.execution.mode === 'parallel' && config.execution.workers) {
      args.push('--workers', config.execution.workers.toString());
    } else if (config.execution.mode === 'single') {
      args.push('--workers', '1');
    }

    // Timeout configuration
    if (config.execution.timeout) {
      args.push('--timeout', config.execution.timeout.toString());
    }

    // Additional options
    args.push('--reporter=json,html,junit');

    // Debug mode for development
    if (process.env.NODE_ENV === 'development') {
      args.push('--debug');
    }

    // Retry configuration
    args.push('--retries=1'); // One retry by default

    // Add grep pattern if specified
    if (config.tests.pattern) {
      args.push('--grep', config.tests.pattern);
    }
  }

  private addReportingOptions(args: string[], executionId: string): void {
    // HTML report
    args.push('--reporter=html');

    // JSON report for parsing
    args.push('--reporter=json');

    // JUnit for CI integration
    args.push('--reporter=junit');

    // Output directory
    args.push('--output-dir', `test-results-${executionId}`);
  }

  private getBrowserEnvironment(config: UnifiedTestConfig): Record<string, string> {
    const env: Record<string, string> = {};

    if (config.execution.browser) {
      env.PLAYWRIGHT_BROWSER = config.execution.browser;
    }

    if (config.execution.headless !== undefined) {
      env.PLAYWRIGHT_HEADLESS = config.execution.headless.toString();
    }

    return env;
  }

  private parseDuration(durationStr: string): number {
    if (!durationStr) return 0;

    const match = durationStr.match(/([\d.]+)([a-z]+)/i);
    if (!match) {
      return 0;
    }

    const value = parseFloat(match[1]);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 'ms':
        return value;
      case 's':
        return value * 1000;
      case 'm':
      case 'min':
        return value * 60 * 1000;
      default:
        return value;
    }
  }

  private parseJsonTestResult(jsonResult: any): TestResult | null {
    try {
      if (!jsonResult.test || !jsonResult.result) {
        return null;
      }

      const test = jsonResult.test;
      const result = jsonResult.result;

      return {
        testId: `${test.location.file}::${test.title}`,
        testName: test.title,
        status: this.mapPlaywrightStatus(result.status),
        duration: result.duration || 0,
        error: result.error?.message,
        artifacts: {
          screenshots: result.attachments?.filter((a: any) => a.name === 'screenshot')?.map((a: any) => a.path) || [],
          videos: result.attachments?.filter((a: any) => a.name === 'video')?.map((a: any) => a.path) || [],
          traces: result.attachments?.filter((a: any) => a.name === 'trace')?.map((a: any) => a.path) || [],
          logs: []
        }
      };
    } catch (error) {
      logger.warn('Failed to parse JSON test result', { error });
      return null;
    }
  }

  private parseTestSummary(output: string): void {
    const summaryMatch = output.match(/(\d+) passed.*(\d+) failed.*(\d+) skipped/);
    if (summaryMatch) {
      logger.debug('Playwright test summary', {
        passed: parseInt(summaryMatch[1]),
        failed: parseInt(summaryMatch[2]),
        skipped: parseInt(summaryMatch[3])
      });
    }
  }

  private mapPlaywrightStatus(status: string): TestResult['status'] {
    switch (status) {
      case 'passed':
        return 'passed';
      case 'failed':
      case 'timedOut':
      case 'interrupted':
        return 'failed';
      case 'skipped':
        return 'skipped';
      default:
        return 'failed';
    }
  }

  private async collectPlaywrightArtifacts(dirPath: string, artifacts: ExecutionArtifacts): Promise<void> {
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
            case '.webm':
            case '.mp4':
              artifacts.videos.push(fullPath);
              break;
            case '.zip':
              if (item.name.includes('trace')) {
                artifacts.traces.push(fullPath);
              }
              break;
            case '.html':
            case '.json':
            case '.xml':
              artifacts.reports.push(fullPath);
              break;
            case '.log':
            case '.txt':
              artifacts.logs.push(fullPath);
              break;
          }
        } else if (item.isDirectory()) {
          await this.collectPlaywrightArtifacts(fullPath, artifacts);
        }
      }
    } catch (error) {
      logger.warn('Failed to collect Playwright artifacts from directory', {
        directory: dirPath,
        error: error instanceof Error ? error.message : error
      });
    }
  }

  private async checkPlaywright(): Promise<boolean> {
    return new Promise((resolve) => {
      const process = spawn('npx', ['playwright', '--version'], { stdio: 'pipe' });

      process.on('close', (code) => {
        resolve(code === 0);
      });

      process.on('error', () => {
        resolve(false);
      });

      setTimeout(() => {
        process.kill('SIGTERM');
        resolve(false);
      }, 10000);
    });
  }

  private async checkBrowsers(): Promise<boolean> {
    return new Promise((resolve) => {
      const process = spawn('npx', ['playwright', 'install', '--dry-run'], { stdio: 'pipe' });

      let output = '';
      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        // If dry-run succeeds and doesn't show downloads needed, browsers are installed
        const needsInstall = output.includes('downloading') || output.includes('installing');
        resolve(code === 0 && !needsInstall);
      });

      process.on('error', () => {
        resolve(false);
      });

      setTimeout(() => {
        process.kill('SIGTERM');
        resolve(false);
      }, 15000);
    });
  }

  private checkPlaywrightConfig(): boolean {
    const configFiles = [
      'playwright.config.js',
      'playwright.config.ts',
      'playwright.config.mjs'
    ];

    return configFiles.some(configFile =>
      fs.existsSync(path.join(this.testDirectory, configFile))
    );
  }
}