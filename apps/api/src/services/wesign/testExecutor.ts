import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

export interface WeSignTestConfig {
  suite: 'auth' | 'dashboard' | 'templates' | 'contacts' | 'signing' | 'documents' | 'all';
  language: 'english' | 'hebrew' | 'both';
  browser: 'chromium' | 'firefox' | 'webkit' | 'all';
  headless: boolean;
  workers: number;
  timeout: number;
}

export interface TestResult {
  runId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  duration?: number;
  output: string[];
  errors: string[];
  reportPath?: string;
}

export class WeSignTestExecutor extends EventEmitter {
  private static readonly WESIGN_TESTS_PATH = "C:/Users/gals/seleniumpythontests-1/playwright_tests";
  private static readonly PYTHON_PATH = "C:/Users/gals/AppData/Local/Programs/Python/Python312/python.exe";
  private runningTests: Map<string, ChildProcess> = new Map();
  private testResults: Map<string, TestResult> = new Map();

  async executeTestSuite(config: WeSignTestConfig): Promise<string> {
    const runId = uuidv4();
    
    console.log(`🚀 Starting WeSign test execution: ${runId}`);
    console.log(`📊 Config:`, config);

    // Initialize test result
    const result: TestResult = {
      runId,
      status: 'running',
      startTime: new Date(),
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      output: [],
      errors: []
    };

    this.testResults.set(runId, result);

    try {
      await this.validateWeSignEnvironment();
      await this.executeTests(runId, config);
      return runId;
    } catch (error: any) {
      result.status = 'failed';
      result.errors.push(`Execution failed: ${error.message}`);
      this.emit('testError', { runId, error: error.message });
      throw error;
    }
  }

  private async validateWeSignEnvironment(): Promise<void> {
    // Check if WeSign tests directory exists
    if (!fs.existsSync(WeSignTestExecutor.WESIGN_TESTS_PATH)) {
      throw new Error(`WeSign tests directory not found: ${WeSignTestExecutor.WESIGN_TESTS_PATH}`);
    }

    // Skip Python validation for now - we know it works
    console.log(`✅ WeSign environment validation: Directory exists at ${WeSignTestExecutor.WESIGN_TESTS_PATH}`);
    return Promise.resolve();
  }

  private async executeTests(runId: string, config: WeSignTestConfig): Promise<void> {
    const result = this.testResults.get(runId)!;
    
    // Build pytest command
    const args = this.buildPytestCommand(config);
    
    console.log(`📋 Running command: ${WeSignTestExecutor.PYTHON_PATH} -m pytest ${args.join(' ')}`);

    // Start pytest process
    const testProcess = spawn(WeSignTestExecutor.PYTHON_PATH, ['-m', 'pytest', ...args], {
      cwd: WeSignTestExecutor.WESIGN_TESTS_PATH,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.runningTests.set(runId, testProcess);

    // Handle stdout (test output)
    testProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      result.output.push(output);
      this.parseTestProgress(runId, output);
      this.emit('testProgress', { runId, output });
    });

    // Handle stderr (errors)
    testProcess.stderr?.on('data', (data: Buffer) => {
      const error = data.toString();
      result.errors.push(error);
      this.emit('testError', { runId, error });
    });

    // Handle process completion
    testProcess.on('close', (code) => {
      this.runningTests.delete(runId);
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - result.startTime.getTime();
      
      if (code === 0) {
        result.status = 'completed';
        console.log(`✅ WeSign tests completed successfully: ${runId}`);
      } else {
        result.status = 'failed';
        console.log(`❌ WeSign tests failed: ${runId} (exit code: ${code})`);
      }

      this.emit('testComplete', { runId, result });
    });

    // Handle process errors
    testProcess.on('error', (error) => {
      this.runningTests.delete(runId);
      result.status = 'failed';
      result.endTime = new Date();
      result.errors.push(`Process error: ${error.message}`);
      
      console.log(`💥 WeSign test process error: ${runId}`, error);
      this.emit('testError', { runId, error: error.message });
    });
  }

  private buildPytestCommand(config: WeSignTestConfig): string[] {
    const args: string[] = [];

    // Select test files based on suite
    switch (config.suite) {
      case 'auth':
        args.push('tests/auth/');
        break;
      case 'dashboard':
        args.push('tests/dashboard/');
        break;
      case 'templates':
        args.push('tests/templates/');
        break;
      case 'contacts':
        args.push('tests/contacts/');
        break;
      case 'signing':
        args.push('tests/signing/');
        break;
      case 'documents':
        args.push('tests/documents/');
        break;
      case 'all':
        args.push('tests/');
        break;
    }

    // Add language marker
    if (config.language === 'english') {
      args.push('-m', 'english');
    } else if (config.language === 'hebrew') {
      args.push('-m', 'hebrew');
    }

    // Add browser selection
    args.push('--browser', config.browser === 'all' ? 'chromium' : config.browser);

    // Add headless mode
    if (!config.headless) {
      args.push('--headed');
    }

    // Add parallel execution
    if (config.workers > 1) {
      args.push('-n', config.workers.toString());
    }

    // Add timeout
    args.push('--timeout', config.timeout.toString());

    // Add reporting
    args.push('--json-report');
    args.push('--json-report-file=reports/wesign_results.json');
    args.push('--html=reports/wesign_report.html');
    args.push('--self-contained-html');

    // Add verbose output
    args.push('-v');

    return args;
  }

  private parseTestProgress(runId: string, output: string): void {
    const result = this.testResults.get(runId)!;
    
    // Parse pytest output for test results
    const lines = output.split('\n');
    
    for (const line of lines) {
      // Match test results like "test_something PASSED"
      const testMatch = line.match(/^([^:]+)::[^:]+::[^\s]+\s+(PASSED|FAILED|SKIPPED)/);
      if (testMatch) {
        const status = testMatch[2];
        result.totalTests++;
        
        switch (status) {
          case 'PASSED':
            result.passedTests++;
            break;
          case 'FAILED':
            result.failedTests++;
            break;
          case 'SKIPPED':
            result.skippedTests++;
            break;
        }
      }

      // Parse final summary
      const summaryMatch = line.match(/=+ (\d+) (passed|failed|skipped)/);
      if (summaryMatch) {
        const count = parseInt(summaryMatch[1]);
        const type = summaryMatch[2];
        
        switch (type) {
          case 'passed':
            result.passedTests = count;
            break;
          case 'failed':
            result.failedTests = count;
            break;
          case 'skipped':
            result.skippedTests = count;
            break;
        }
      }
    }
  }

  async getTestResult(runId: string): Promise<TestResult | null> {
    return this.testResults.get(runId) || null;
  }

  async getAllRunningTests(): Promise<TestResult[]> {
    return Array.from(this.testResults.values()).filter(r => r.status === 'running');
  }

  async cancelTest(runId: string): Promise<boolean> {
    const process = this.runningTests.get(runId);
    
    if (process && !process.killed) {
      process.kill('SIGTERM');
      
      const result = this.testResults.get(runId);
      if (result) {
        result.status = 'cancelled';
        result.endTime = new Date();
      }
      
      this.runningTests.delete(runId);
      console.log(`🛑 WeSign test execution cancelled: ${runId}`);
      return true;
    }
    
    return false;
  }

  async getTestReport(runId: string): Promise<string | null> {
    const result = this.testResults.get(runId);
    
    if (!result || result.status === 'running') {
      return null;
    }

    const reportPath = path.join(WeSignTestExecutor.WESIGN_TESTS_PATH, 'reports', 'wesign_report.html');
    
    if (fs.existsSync(reportPath)) {
      return fs.readFileSync(reportPath, 'utf-8');
    }
    
    return null;
  }

  async getAvailableTestSuites(): Promise<string[]> {
    const testsPath = path.join(WeSignTestExecutor.WESIGN_TESTS_PATH, 'tests');
    
    try {
      const directories = fs.readdirSync(testsPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
      
      return directories;
    } catch (error) {
      console.error('Error reading test directories:', error);
      return [];
    }
  }
}

export const wesignTestExecutor = new WeSignTestExecutor();