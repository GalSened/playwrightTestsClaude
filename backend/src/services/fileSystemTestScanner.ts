import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface TestFunction {
  id: string;
  name: string;
  filePath: string;
  category: 'e2e' | 'api' | 'load' | 'functional';
  module: string;
  lineNumber: number;
  lastModified: Date;
  fileSize: number;
  language: 'python' | 'javascript' | 'typescript';
  tags: string[];
}

export interface TestScanResult {
  totalTests: number;
  testsByCategory: {
    e2e: number;
    api: number;
    load: number;
    functional: number;
  };
  testsByModule: Record<string, TestFunction[]>;
  lastScanTime: Date;
  scanDuration: number;
  filesScanned: number;
}

export class FileSystemTestScanner {
  private readonly testDirectory: string;
  private readonly patterns = {
    python: /def\s+(test_\w+)\s*\(/g,
    javascript: /(?:test|it)\s*\(\s*['"`]([^'"`]+)['"`]/g,
    typescript: /(?:test|it)\s*\(\s*['"`]([^'"`]+)['"`]/g
  };

  private readonly categoryPatterns = {
    e2e: /(?:e2e|end.*to.*end|ui|browser|selenium|playwright|integration)/i,
    api: /(?:api|request|response|endpoint|rest|http|postman|newman)/i,
    load: /(?:load|performance|stress|concurrent|k6|benchmark|perf)/i
  };

  constructor(testDirectory: string = '../new_tests_for_wesign') {
    this.testDirectory = testDirectory;
  }

  async scanTestFiles(): Promise<TestScanResult> {
    const startTime = Date.now();
    const testFunctions: TestFunction[] = [];
    const filesScanned = { count: 0 };

    console.log('FileSystemTestScanner: Starting comprehensive test scan...');

    try {
      await this.scanDirectory(this.testDirectory, testFunctions, filesScanned);
    } catch (error) {
      console.error('Error scanning test directory:', error);
      throw error;
    }

    const endTime = Date.now();
    const scanDuration = endTime - startTime;

    // Categorize tests
    const testsByCategory = {
      e2e: testFunctions.filter(t => t.category === 'e2e').length,
      api: testFunctions.filter(t => t.category === 'api').length,
      load: testFunctions.filter(t => t.category === 'load').length,
      functional: testFunctions.filter(t => t.category === 'functional').length
    };

    // Group by module
    const testsByModule: Record<string, TestFunction[]> = {};
    testFunctions.forEach(test => {
      if (!testsByModule[test.module]) {
        testsByModule[test.module] = [];
      }
      testsByModule[test.module].push(test);
    });

    const result: TestScanResult = {
      totalTests: testFunctions.length,
      testsByCategory,
      testsByModule,
      lastScanTime: new Date(),
      scanDuration,
      filesScanned: filesScanned.count
    };

    console.log(`FileSystemTestScanner: Scan complete - ${result.totalTests} tests found in ${scanDuration}ms`);
    console.log('Category breakdown:', testsByCategory);

    return result;
  }

  private async scanDirectory(
    dirPath: string,
    testFunctions: TestFunction[],
    filesScanned: { count: number }
  ): Promise<void> {
    const items = readdirSync(dirPath);

    for (const item of items) {
      const fullPath = join(dirPath, item);
      const stats = statSync(fullPath);

      if (stats.isDirectory()) {
        // Skip common non-test directories
        if (!['node_modules', '.git', '__pycache__', '.pytest_cache', 'venv'].includes(item)) {
          await this.scanDirectory(fullPath, testFunctions, filesScanned);
        }
      } else if (stats.isFile()) {
        const ext = extname(item);
        if (['.py', '.js', '.ts'].includes(ext) && this.isTestFile(item)) {
          filesScanned.count++;
          await this.scanTestFile(fullPath, testFunctions);
        }
      }
    }
  }

  private isTestFile(filename: string): boolean {
    return /(?:test_|_test\.|\.test\.|\.spec\.|test\.)/i.test(filename);
  }

  private async scanTestFile(filePath: string, testFunctions: TestFunction[]): Promise<void> {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const stats = statSync(filePath);
      const ext = extname(filePath);

      let language: 'python' | 'javascript' | 'typescript';
      let pattern: RegExp;

      switch (ext) {
        case '.py':
          language = 'python';
          pattern = this.patterns.python;
          break;
        case '.js':
          language = 'javascript';
          pattern = this.patterns.javascript;
          break;
        case '.ts':
          language = 'typescript';
          pattern = this.patterns.typescript;
          break;
        default:
          return;
      }

      const lines = content.split('\n');
      let match;

      while ((match = pattern.exec(content)) !== null) {
        const testName = match[1];
        const lineNumber = this.getLineNumber(content, match.index);
        const category = this.categorizeTest(testName, filePath, content);
        const module = this.extractModule(filePath);
        const tags = this.extractTags(testName, filePath, content);

        const testFunction: TestFunction = {
          id: `${filePath}:${lineNumber}:${testName}`,
          name: testName,
          filePath: filePath.replace(/\\/g, '/'),
          category,
          module,
          lineNumber,
          lastModified: stats.mtime,
          fileSize: stats.size,
          language,
          tags
        };

        testFunctions.push(testFunction);
      }

      // Reset regex lastIndex for next iteration
      pattern.lastIndex = 0;

    } catch (error) {
      console.warn(`Warning: Could not scan file ${filePath}:`, error);
    }
  }

  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  private categorizeTest(testName: string, filePath: string, content: string): 'e2e' | 'api' | 'load' | 'functional' {
    const testContext = (testName + ' ' + filePath + ' ' + content.substring(0, 1000)).toLowerCase();

    if (this.categoryPatterns.e2e.test(testContext)) {
      return 'e2e';
    }
    if (this.categoryPatterns.api.test(testContext)) {
      return 'api';
    }
    if (this.categoryPatterns.load.test(testContext)) {
      return 'load';
    }
    return 'functional';
  }

  private extractModule(filePath: string): string {
    const pathParts = filePath.replace(/\\/g, '/').split('/');

    // Look for meaningful module names in path
    for (let i = pathParts.length - 1; i >= 0; i--) {
      const part = pathParts[i];
      if (part !== 'tests' && part !== 'test' && !part.startsWith('test_') && part !== 'new_tests_for_wesign') {
        return part.replace(/[._-]/g, ' ').replace(/\.[^.]*$/, '');
      }
    }

    // Fallback to directory name
    return pathParts[pathParts.length - 2] || 'unknown';
  }

  private extractTags(testName: string, filePath: string, content: string): string[] {
    const tags: string[] = [];

    // Extract tags from test name
    if (/hebrew|rtl|i18n/i.test(testName)) tags.push('hebrew');
    if (/smoke|basic|core/i.test(testName)) tags.push('smoke');
    if (/critical|important/i.test(testName)) tags.push('critical');
    if (/auth|login|password/i.test(testName)) tags.push('authentication');
    if (/upload|download|file/i.test(testName)) tags.push('file-operations');
    if (/sign|signature/i.test(testName)) tags.push('signature');
    if (/admin|management/i.test(testName)) tags.push('admin');
    if (/mobile|responsive/i.test(testName)) tags.push('mobile');
    if (/cross.*browser|browser/i.test(testName)) tags.push('cross-browser');

    // Extract tags from file path
    if (/auth/i.test(filePath)) tags.push('authentication');
    if (/admin/i.test(filePath)) tags.push('admin');
    if (/doc/i.test(filePath)) tags.push('documents');
    if (/contact/i.test(filePath)) tags.push('contacts');
    if (/template/i.test(filePath)) tags.push('templates');

    return [...new Set(tags)]; // Remove duplicates
  }

  // Fast count methods for dashboard
  async getQuickCounts(): Promise<{ total: number; byCategory: Record<string, number> }> {
    try {
      // Use command line tools for faster counting
      const { stdout: totalTests } = await execAsync(
        `grep -r "def test_" "${this.testDirectory}" --include="*.py" | wc -l`
      );

      const { stdout: e2eTests } = await execAsync(
        `grep -r "def test_" "${this.testDirectory}" --include="*.py" | grep -i -E "(e2e|end.*to.*end|ui|browser|selenium|playwright)" | wc -l`
      );

      const { stdout: apiTests } = await execAsync(
        `grep -r "def test_" "${this.testDirectory}" --include="*.py" | grep -i -E "(api|request|response|endpoint|rest|http)" | wc -l`
      );

      const { stdout: loadTests } = await execAsync(
        `grep -r "def test_" "${this.testDirectory}" --include="*.py" | grep -i -E "(load|performance|stress|concurrent|k6)" | wc -l`
      );

      const { stdout: jsTests } = await execAsync(
        `grep -r -E "(test\\(|it\\(|describe\\()" "${this.testDirectory}" --include="*.js" | wc -l`
      );

      const total = parseInt(totalTests.trim()) + parseInt(jsTests.trim());
      const e2e = parseInt(e2eTests.trim());
      const api = parseInt(apiTests.trim());
      const load = parseInt(loadTests.trim());
      const functional = total - e2e - api - load;

      return {
        total,
        byCategory: {
          e2e,
          api,
          load,
          functional
        }
      };
    } catch (error) {
      console.error('Error getting quick counts:', error);
      return { total: 0, byCategory: { e2e: 0, api: 0, load: 0, functional: 0 } };
    }
  }

  async syncWithDatabase(db: any): Promise<void> {
    console.log('FileSystemTestScanner: Syncing with database...');

    const scanResult = await this.scanTestFiles();

    // Use INSERT OR REPLACE to handle existing test data
    const insertTest = db.prepare(`
      INSERT OR REPLACE INTO tests (
        id, file_path, test_name, function_name, category,
        last_status, last_duration, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    const allTests: TestFunction[] = [];
    Object.values(scanResult.testsByModule).forEach(tests => {
      allTests.push(...tests);
    });

    const transaction = db.transaction(() => {
      allTests.forEach(test => {
        insertTest.run(
          test.id,
          test.filePath,
          test.name,
          test.name,
          test.category,
          'pending', // Default status for newly discovered tests
          Math.floor(Math.random() * 5000) + 1000, // Random duration for demo
          1 // is_active
        );
      });
    });

    transaction();

    console.log(`FileSystemTestScanner: Synced ${allTests.length} tests with database`);
  }
}