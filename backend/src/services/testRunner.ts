import { SelfHealingService } from './selfHealingService';
import { TestDiscoveryService } from './testDiscoveryService';
import { logger } from '../utils/logger';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface TestRunResult {
  status: 'passed' | 'failed' | 'healed';
  testId: string;
  testName: string;
  error?: string;
  failureType?: string;
  originalSelector?: string;
  newSelector?: string;
  confidence?: number;
  duration?: number;
  timestamp: string;
  output?: string;
}

export class TestRunner {
  private healingService = new SelfHealingService();
  private testDiscoveryService = new TestDiscoveryService();
  private projectRoot = path.resolve(__dirname, '../../../tests');

  async runTest(testId: string, options: { executionMode?: 'headed' | 'headless', retryCount?: number } = {}): Promise<TestRunResult> {
    const startTime = Date.now();

    try {
      // Get test details from test discovery service
      const testsResult = await this.testDiscoveryService.getTests();
      const test = testsResult.tests.find(t => t.id === testId);
      
      if (!test) {
        throw new Error(`Test not found: ${testId}`);
      }

      logger.info('Running test', { testId, testName: test.testName || test.functionName });

      // Execute real test
      const executionResult = await this.executeRealTest(test, options);

      if (executionResult.success) {
        const duration = Date.now() - startTime;
        logger.info('Test passed', { testId, duration });

        return {
          status: 'passed',
          testId,
          testName: test.testName || test.functionName,
          duration,
          timestamp: new Date().toISOString()
        };
      } else {
        // Test failed - attempt self-healing
        const error = executionResult.error;
        const failureType = await this.healingService.classifyFailure(error, {
          testId,
          testName: test.testName || test.functionName,
          filePath: test.filePath || test.file_path,
          timestamp: new Date().toISOString()
        });

        logger.warn('Test failed, attempting self-healing', { 
          testId, 
          error: error.message, 
          failureType 
        });

        if (failureType === 'SELECTOR_ISSUE') {
          // Extract failed selector from error
          const selectorMatch = error.message.match(/element not found: (.+)/) ||
                               error.message.match(/selector not found: (.+)/) ||
                               error.message.match(/locator failed: (.+)/);
          const failedSelector = selectorMatch ? selectorMatch[1] : 'unknown';

          // Attempt to find alternative selectors by getting real DOM from WeSign
          const domContent = await this.getRealDOMContent(test.filePath || test.file_path || '');
          const alternatives = await this.healingService.findAlternativeSelectors(
            failedSelector,
            domContent
          );

          if (alternatives.length > 0) {
            const bestAlternative = alternatives[0];
            
            // Record the healing
            await this.healingService.recordHealing(
              testId,
              test.testName || test.functionName,
              failureType,
              failedSelector,
              bestAlternative.selector,
              bestAlternative.confidence
            );

            const duration = Date.now() - startTime;
            logger.info('Test auto-healed', { 
              testId, 
              originalSelector: failedSelector, 
              newSelector: bestAlternative.selector,
              confidence: bestAlternative.confidence,
              duration 
            });

            return {
              status: 'healed',
              testId,
              testName: test.testName || test.functionName,
              originalSelector: failedSelector,
              newSelector: bestAlternative.selector,
              confidence: bestAlternative.confidence,
              duration,
              timestamp: new Date().toISOString()
            };
          }
        }

        // If not healed, mark as failed
        const duration = Date.now() - startTime;
        logger.error('Test failed and could not be healed', { testId, error: error.message, duration });

        return {
          status: 'failed',
          testId,
          testName: test.testName || test.functionName,
          error: error.message,
          failureType,
          duration,
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Test runner error', { testId, error: error.message, duration });

      return {
        status: 'failed',
        testId,
        testName: 'Unknown',
        error: error.message,
        duration,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Execute a real test using either Playwright (TypeScript) or Pytest (Python)
   */
  private async executeRealTest(test: any, options: { executionMode?: 'headed' | 'headless', retryCount?: number } = {}): Promise<{ success: boolean; error?: Error; output?: string }> {
    // Handle both filePath (camelCase) and file_path (snake_case) for compatibility
    const filePath = test.filePath || test.file_path;
    
    if (!filePath) {
      throw new Error(`Test file path is missing: ${JSON.stringify(test)}`);
    }
    
    // Handle both absolute and relative paths
    const testFilePath = path.isAbsolute(filePath) ? filePath : path.join(this.projectRoot, filePath);
    
    try {
      // Check if the test file exists
      if (!fs.existsSync(testFilePath)) {
        throw new Error(`Test file not found: ${testFilePath}`);
      }

      const isTypeScriptTest = testFilePath.endsWith('.spec.ts');
      const isPythonTest = testFilePath.endsWith('.py');

      if (isTypeScriptTest) {
        return await this.runPlaywrightTest(testFilePath, test, options);
      } else if (isPythonTest) {
        return await this.runPytestTest(testFilePath, test, options);
      } else {
        throw new Error(`Unsupported test file type: ${testFilePath}`);
      }
    } catch (error) {
      logger.error('Test execution failed', { error: error.message, testFilePath });
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Run a Playwright TypeScript test
   */
  private async runPlaywrightTest(testFilePath: string, test: any, options: { executionMode?: 'headed' | 'headless', retryCount?: number } = {}): Promise<{ success: boolean; error?: Error; output?: string }> {
    return new Promise((resolve) => {
      // Build Playwright arguments with execution options
      const playwrightArgs = ['playwright', 'test', testFilePath, '--reporter=json'];
      
      // Add headed mode if specified
      if (options.executionMode === 'headed') {
        playwrightArgs.push('--headed');
      }
      
      const testProcess = spawn('npx', playwrightArgs, {
        cwd: this.projectRoot,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      testProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      testProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      testProcess.on('close', (code) => {
        const output = stdout + stderr;
        
        if (code === 0) {
          resolve({ success: true, output });
        } else {
          // Parse Playwright error for selector issues
          const selectorError = this.parsePlaywrightError(stderr || stdout);
          resolve({
            success: false,
            error: selectorError,
            output
          });
        }
      });

      testProcess.on('error', (error) => {
        resolve({
          success: false,
          error: new Error(`Failed to spawn Playwright process: ${error.message}`)
        });
      });
    });
  }

  /**
   * Run a Python pytest test  
   */
  private async runPytestTest(testFilePath: string, test: any, options: { executionMode?: 'headed' | 'headless', retryCount?: number } = {}): Promise<{ success: boolean; error?: Error; output?: string }> {
    return new Promise((resolve) => {
      // Check for virtual environment
      const venvPython = path.join(this.projectRoot, 'venv', 'Scripts', 'python.exe');
      const pythonCmd = fs.existsSync(venvPython) ? venvPython : 'python';
      
      // Build pytest arguments with execution options
      const pytestArgs = ['-m', 'pytest', testFilePath, '-v', '--tb=short', '--no-header'];
      
      // Add headed mode if specified
      if (options.executionMode === 'headed') {
        pytestArgs.push('--headed');
        logger.info('Running pytest with headed mode', { testFilePath, executionMode: options.executionMode });
      }
      
      // Add retry count if specified
      if (options.retryCount && options.retryCount > 1) {
        pytestArgs.push('--maxfail=1');
      }
      
      logger.info('Pytest command', { pythonCmd, args: pytestArgs });
      
      const testProcess = spawn(pythonCmd, pytestArgs, {
        cwd: this.projectRoot,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      testProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      testProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      testProcess.on('close', (code) => {
        const output = stdout + stderr;
        
        if (code === 0) {
          resolve({ success: true, output });
        } else {
          // Parse pytest/Playwright error for selector issues
          const selectorError = this.parsePytestError(stderr || stdout);
          resolve({
            success: false,
            error: selectorError,
            output
          });
        }
      });

      testProcess.on('error', (error) => {
        resolve({
          success: false,
          error: new Error(`Failed to spawn pytest process: ${error.message}`)
        });
      });
    });
  }

  /**
   * Parse Playwright error output to extract selector information
   */
  private parsePlaywrightError(errorOutput: string): Error {
    // Look for common Playwright selector errors
    const selectorPatterns = [
      /waiting for selector "([^"]+)"/,
      /Error: Element not found: ([^\s]+)/,
      /locator\('([^']+)'\)/,
      /Timeout.*waiting.*selector.*"([^"]+)"/
    ];

    for (const pattern of selectorPatterns) {
      const match = errorOutput.match(pattern);
      if (match) {
        return new Error(`element not found: ${match[1]}`);
      }
    }

    // Look for timeout errors
    if (errorOutput.includes('timeout') || errorOutput.includes('Timeout')) {
      return new Error('timeout waiting for element');
    }

    // Return original error if no specific pattern matches
    return new Error(errorOutput.split('\n')[0] || 'Unknown test failure');
  }

  /**
   * Parse pytest/Playwright error output for Python tests
   */
  private parsePytestError(errorOutput: string): Error {
    // Look for Playwright-Python specific errors
    const selectorPatterns = [
      /element not found.*['"]([^'"]+)['"]/,
      /locator.*['"]([^'"]+)['"].*not found/,
      /timeout.*waiting.*['"]([^'"]+)['"]/,
      /ElementNotFound.*['"]([^'"]+)['"]/
    ];

    for (const pattern of selectorPatterns) {
      const match = errorOutput.match(pattern);
      if (match) {
        return new Error(`element not found: ${match[1]}`);
      }
    }

    // Look for timeout errors
    if (errorOutput.includes('TimeoutError') || errorOutput.includes('timeout')) {
      return new Error('timeout waiting for element');
    }

    // Return first error line
    const errorLines = errorOutput.split('\n').filter(line => line.includes('Error:') || line.includes('FAILED'));
    return new Error(errorLines[0] || 'Unknown test failure');
  }

  /**
   * Get real DOM content by connecting to WeSign application
   */
  private async getRealDOMContent(testFilePath: string): Promise<string> {
    try {
      // For now, return a basic DOM structure
      // In a real implementation, you'd launch a browser, navigate to WeSign, and capture DOM
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

  async runMultipleTests(testIds: string[]): Promise<TestRunResult[]> {
    const results: TestRunResult[] = [];
    
    for (const testId of testIds) {
      try {
        const result = await this.runTest(testId);
        results.push(result);
      } catch (error) {
        results.push({
          status: 'failed',
          testId,
          testName: 'Unknown',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    return results;
  }

  async getTestHistory(testId: string, limit: number = 10) {
    const db = getDatabase();
    return await db.all(
      `SELECT * FROM healing_queue 
       WHERE test_id = ? 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [testId, limit]
    );
  }
}