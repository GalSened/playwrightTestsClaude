/**
 * Test Discovery Service
 * Automatically discovers, parses, and manages pytest test files
 */

import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { getDatabase } from '../database/database';
import crypto from 'crypto';

export interface TestInfo {
  id: string;
  filePath: string;
  testName: string;
  className?: string;
  functionName: string;
  description?: string;
  category: string;
  lineNumber?: number;
  tags: string[];
  lastRun?: Date;
  lastStatus?: 'passed' | 'failed' | 'skipped';
  lastDuration?: number;
  testType?: 'python' | 'playwright' | 'unit';
  steps?: string[];
  complexity?: 'low' | 'medium' | 'high';
  estimatedDuration?: number;
}

export interface DiscoveryStats {
  totalFiles: number;
  totalTests: number;
  categories: Record<string, number>;
  tags: Record<string, number>;
  lastScanTime: Date;
}

export class TestDiscoveryService {
  private testRootPath: string;
  private isScanning: boolean = false;
  private autoDiscoveryInterval: NodeJS.Timeout | null = null;
  private fileWatcherActive: boolean = false;
  private lastScanTime: Date | null = null;
  private playwrightTestDirs: string[] = [
    '../playwright-smart/tests',
    '../playwright-system-tests/tests',
    '../tests-enterprise/src'
  ];
  private wesignTestDir: string = 'C:/Users/gals/Desktop/playwrightTestsClaude/new_tests_for_wesign'; // Updated to new test directory

  constructor(testRootPath: string = '../tests') {
    this.testRootPath = path.resolve(testRootPath);
    logger.info('Test Discovery Service initialized', {
      testRootPath: this.testRootPath,
      playwrightTestDirs: this.playwrightTestDirs,
      wesignTestDir: this.wesignTestDir
    });

    // Initialize automatic discovery
    this.initializeAutoDiscovery();
  }

  /**
   * Initialize automatic test discovery
   */
  private async initializeAutoDiscovery(): Promise<void> {
    try {
      // Initial scan on startup
      setTimeout(async () => {
        logger.info('Starting initial test discovery scan...');
        await this.performFullScan();

        // Set up periodic scanning every 5 minutes
        this.autoDiscoveryInterval = setInterval(async () => {
          try {
            logger.info('Running periodic test discovery...');
            await this.performFullScan();
          } catch (error) {
            logger.error('Periodic test discovery failed', { error });
          }
        }, 5 * 60 * 1000); // 5 minutes

        logger.info('Automatic test discovery initialized - running every 5 minutes');
      }, 10000); // Wait 10 seconds for server to fully start

    } catch (error) {
      logger.error('Failed to initialize automatic discovery', { error });
    }
  }

  /**
   * Stop automatic discovery
   */
  public stopAutoDiscovery(): void {
    if (this.autoDiscoveryInterval) {
      clearInterval(this.autoDiscoveryInterval);
      this.autoDiscoveryInterval = null;
      logger.info('Automatic test discovery stopped');
    }
  }

  /**
   * Get last scan time
   */
  public getLastScanTime(): Date | null {
    return this.lastScanTime;
  }

  /**
   * Initialize database tables for test discovery with migration support
   */
  async initializeDatabase(): Promise<void> {
    try {
      const db = getDatabase();

      if (!db || !db.db) {
        throw new Error('Database connection not available');
      }

      logger.info('Initializing test discovery database with schema migration');

      // First, check if we need to migrate the schema
      try {
        const checkResult = (db as any).db.prepare("PRAGMA table_info(tests)").all();
        const hasTagsColumn = checkResult.some((col: any) => col.name === 'tags');

        if (!hasTagsColumn && checkResult.length > 0) {
          logger.info('Migrating database schema - adding tags column');
          (db as any).db.exec("ALTER TABLE tests ADD COLUMN tags TEXT");
        }
      } catch (migrationError) {
        logger.warn('Schema migration check failed, proceeding with fresh creation', { migrationError });
      }

      // Create test discovery tables with proper error handling
      const statements = [
        `CREATE TABLE IF NOT EXISTS tests (
          id TEXT PRIMARY KEY,
          file_path TEXT NOT NULL,
          test_name TEXT NOT NULL,
          class_name TEXT,
          function_name TEXT NOT NULL,
          description TEXT,
          category TEXT NOT NULL,
          line_number INTEGER,
          last_run DATETIME,
          last_status TEXT,
          last_duration INTEGER,
          test_type TEXT DEFAULT 'python',
          steps TEXT,
          complexity TEXT DEFAULT 'medium',
          estimated_duration INTEGER DEFAULT 60,
          tags TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          is_active BOOLEAN DEFAULT TRUE
        )`,

        `CREATE TABLE IF NOT EXISTS test_tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          test_id TEXT NOT NULL,
          tag_name TEXT NOT NULL,
          tag_type TEXT NOT NULL DEFAULT 'marker',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(test_id, tag_name)
        )`,

        `CREATE INDEX IF NOT EXISTS idx_tests_category ON tests(category)`,
        `CREATE INDEX IF NOT EXISTS idx_tests_file_path ON tests(file_path)`,
        `CREATE INDEX IF NOT EXISTS idx_tests_file_test ON tests(file_path, test_name)`,
        `CREATE INDEX IF NOT EXISTS idx_test_tags_test_id ON test_tags(test_id)`,
        `CREATE INDEX IF NOT EXISTS idx_test_tags_name ON test_tags(tag_name)`
      ];

      for (const statement of statements) {
        try {
          (db as any).db.exec(statement);
        } catch (statementError) {
          logger.warn('Statement execution failed', { statement, error: statementError });
        }
      }

      logger.info('Test discovery database initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize test discovery database', { error });
      // Don't throw error - allow system to continue with fallback behavior
    }
  }

  /**
   * Perform full test discovery scan
   */
  async performFullScan(): Promise<DiscoveryStats> {
    if (this.isScanning) {
      logger.warn('Test discovery scan already in progress, skipping');
      return {
        totalFiles: 0,
        totalTests: 0,
        categories: {},
        tags: {},
        lastScanTime: this.lastScanTime || new Date()
      };
    }

    this.isScanning = true;
    const scanStartTime = new Date();
    logger.info('Starting full test discovery scan', {
      rootPath: this.testRootPath,
      wesignDir: this.wesignTestDir,
      scanTime: scanStartTime.toISOString()
    });

    try {
      // Initialize database first
      await this.initializeDatabase();

      const stats: DiscoveryStats = {
        totalFiles: 0,
        totalTests: 0,
        categories: {},
        tags: {},
        lastScanTime: scanStartTime
      };

      // Find all test files (WeSign only)
      const testFiles = await this.findTestFiles();
      logger.info(`Found ${testFiles.length} WeSign test files for processing`);

      // Process each file
      for (const filePath of testFiles) {
        try {
          const tests = await this.scanTestFile(filePath);
          if (tests.length > 0) {
            stats.totalFiles++;
            stats.totalTests += tests.length;

            // Update category and tag counts
            tests.forEach(test => {
              stats.categories[test.category] = (stats.categories[test.category] || 0) + 1;
              test.tags.forEach(tag => {
                stats.tags[tag] = (stats.tags[tag] || 0) + 1;
              });
            });

            // Store in database with improved error handling
            await this.storeTests(tests);
          }

        } catch (error) {
          logger.warn('Failed to scan test file', {
            filePath,
            error: error instanceof Error ? error.message : error
          });
        }
      }

      // Update last scan time
      this.lastScanTime = scanStartTime;

      logger.info('Full test discovery scan completed successfully', {
        stats,
        duration: Date.now() - scanStartTime.getTime() + 'ms'
      });

      return stats;

    } catch (error) {
      logger.error('Full test discovery scan failed', {
        error: error instanceof Error ? error.message : error,
        duration: Date.now() - scanStartTime.getTime() + 'ms'
      });
      throw error;
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Find all test files recursively (WeSign tests only)
   */
  private async findTestFiles(): Promise<string[]> {
    const testFiles: string[] = [];

    // ONLY scan WeSign Playwright tests - no fallbacks
    try {
      await fs.access(this.wesignTestDir);
      logger.info('Scanning ONLY WeSign test directory', { wesignTestDir: this.wesignTestDir });
      await this.scanDirectoryForTests(this.wesignTestDir, testFiles, 'python', 'wesign');
      logger.info(`Found ${testFiles.length} WeSign tests - discovery limited to WeSign only`);
    } catch (error) {
      logger.error('WeSign test directory not accessible', { wesignTestDir: this.wesignTestDir, error });
      throw new Error(`Cannot access WeSign test directory: ${this.wesignTestDir}`);
    }

    return testFiles;
  }

  private async scanDirectoryForTests(
    dirPath: string, 
    testFiles: string[], 
    testType: 'python' | 'playwright',
    basePath?: string
  ): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          // Skip cache and temp directories
          const skipDirs = ['__pycache__', '.pytest_cache', '.coverage', 'htmlcov', 'node_modules', '.git'];
          if (!skipDirs.includes(entry.name)) {
            await this.scanDirectoryForTests(fullPath, testFiles, testType, basePath);
          }
        } else if (entry.isFile()) {
          // For WeSign tests (absolute path), use full path; for others use relative path
          let filePath: string;
          if (dirPath.includes('new_tests_for_wesign')) {
            // Use absolute path for WeSign tests so they can be identified later
            filePath = fullPath.replace(/\\/g, '/');
          } else {
            // Use relative path for other tests
            filePath = basePath
              ? path.relative(path.resolve(basePath), fullPath).replace(/\\/g, '/')
              : path.relative(this.testRootPath, fullPath).replace(/\\/g, '/');
          }

          // Include test files based on type and naming conventions
          if (testType === 'python' && (entry.name.match(/^test_.*\.py$/) || entry.name.match(/.*_test\.py$/))) {
            testFiles.push(filePath);
          } else if (testType === 'playwright' && (entry.name.match(/.*\.spec\.ts$/) || entry.name.match(/.*\.test\.ts$/))) {
            testFiles.push(filePath);
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to scan directory', { dirPath, error });
    }
  }

  /**
   * Scan a single test file and extract test information
   */
  private async scanTestFile(filePath: string): Promise<TestInfo[]> {
    // Determine the actual file path - check if it's a relative path from playwright dirs
    let fullPath: string;
    let testType: 'python' | 'playwright' = 'python';
    
    // Check if this is a WeSign test file
    if (filePath.includes('new_tests_for_wesign') || filePath.includes('wesign') || path.isAbsolute(filePath)) {
      fullPath = filePath;
      testType = 'python'; // WeSign tests are Python-based Playwright tests
    } else if (filePath.endsWith('.ts') || filePath.endsWith('.spec.ts') || filePath.endsWith('.test.ts')) {
      testType = 'playwright';
      // For playwright files, find the correct base directory
      for (const playwrightDir of this.playwrightTestDirs) {
        const potentialPath = path.resolve(path.join(playwrightDir, filePath));
        try {
          await fs.access(potentialPath);
          fullPath = potentialPath;
          break;
        } catch {
          continue;
        }
      }
      
      if (!fullPath) {
        // Fallback - try to find the file in project root
        fullPath = path.resolve(filePath);
      }
    } else {
      fullPath = path.join(this.testRootPath, filePath);
    }
    
    try {
      const content = await fs.readFile(fullPath, 'utf8');
      const tests = testType === 'playwright' 
        ? await this.parsePlaywrightTestFile(filePath, content)
        : await this.parsePythonTestFile(filePath, content);
      return tests;
    } catch (error) {
      logger.error('Failed to scan test file', { filePath, fullPath, error });
      return [];
    }
  }

  /**
   * Parse Python test file and extract test functions and markers
   */
  private async parsePythonTestFile(filePath: string, content: string): Promise<TestInfo[]> {
    const tests: TestInfo[] = [];
    const lines = content.split('\n');
    
    let currentClass: string | undefined;
    let currentMarkers: string[] = [];
    let lineNumber = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      lineNumber = i + 1;

      // Extract pytest markers
      const markerMatch = line.match(/@pytest\.mark\.(\w+)/);
      if (markerMatch) {
        currentMarkers.push(markerMatch[1]);
        continue;
      }

      // Extract class definitions
      const classMatch = line.match(/^class\s+(\w+)/);
      if (classMatch) {
        currentClass = classMatch[1];
        currentMarkers = [];
        continue;
      }

      // Extract test function definitions (both sync and async)
      const testMatch = line.match(/^\s*(async\s+)?def\s+(test_\w+)/);
      if (testMatch) {
        const functionName = testMatch[2];
        const testName = currentClass ? `${currentClass}::${functionName}` : functionName;
        
        // Extract docstring
        let description: string | undefined;
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          if (nextLine.startsWith('"""') || nextLine.startsWith("'''")) {
            const quote = nextLine.substring(0, 3);
            let docstring = nextLine.substring(3);
            let j = i + 1;
            
            while (j < lines.length && !docstring.includes(quote)) {
              j++;
              if (j < lines.length) {
                docstring += '\n' + lines[j];
              }
            }
            
            description = docstring.replace(quote, '').trim();
          }
        }

        const testInfo: TestInfo = {
          id: uuidv4(),
          filePath,
          testName,
          className: currentClass,
          functionName,
          description,
          category: this.extractCategoryFromPath(filePath),
          lineNumber,
          tags: [...currentMarkers]
        };

        tests.push(testInfo);
        currentMarkers = [];
      }
    }

    return tests;
  }

  /**
   * Extract category from file path
   */
  private extractCategoryFromPath(filePath: string): string {
    const pathParts = filePath.split('/').filter(part => part !== '');
    
    // Special handling for WeSign tests
    if (filePath.includes('new_tests_for_wesign') || filePath.includes('wesign')) {
      const fileName = path.basename(filePath, '.py');
      
      // Extract WeSign-specific categories
      if (fileName.includes('signing') || pathParts.includes('signing')) return 'wesign-signing';
      if (fileName.includes('auth') || pathParts.includes('auth')) return 'wesign-auth';
      if (fileName.includes('document') || pathParts.includes('documents')) return 'wesign-documents';
      if (fileName.includes('smart_card')) return 'wesign-smart-card';
      if (fileName.includes('live_signing')) return 'wesign-live-signing';
      if (fileName.includes('integration')) return 'wesign-integration';
      if (fileName.includes('workflow')) return 'wesign-workflows';
      if (fileName.includes('bulk') || pathParts.includes('bulk_operations')) return 'wesign-bulk-operations';
      if (fileName.includes('contact') || pathParts.includes('contacts')) return 'wesign-contacts';
      if (fileName.includes('distribution') || pathParts.includes('distribution')) return 'wesign-distribution';
      if (fileName.includes('report') || pathParts.includes('reports')) return 'wesign-reports';
      if (fileName.includes('profile') || pathParts.includes('profile')) return 'wesign-profile';
      if (fileName.includes('system') || pathParts.includes('system')) return 'wesign-system';
      if (fileName.includes('template') || pathParts.includes('templates')) return 'wesign-templates';
      if (fileName.includes('user') || pathParts.includes('user_management')) return 'wesign-user-management';
      if (fileName.includes('file') || pathParts.includes('file_operations') || pathParts.includes('files')) return 'wesign-files';
      
      return 'wesign-core';
    }
    
    // Look for meaningful directory names
    const meaningfulParts = pathParts.filter(part => 
      !['tests', 'test', '__pycache__'].includes(part) && 
      !part.endsWith('.py')
    );

    if (meaningfulParts.length > 0) {
      return meaningfulParts[0];
    }

    // Extract from filename
    const fileName = path.basename(filePath, '.py');
    if (fileName.startsWith('test_')) {
      const category = fileName.substring(5).replace(/_/g, ' ');
      return category;
    }

    return 'general';
  }

  /**
   * Parse Playwright/TypeScript test file and extract test information
   */
  private async parsePlaywrightTestFile(filePath: string, content: string): Promise<TestInfo[]> {
    const tests: TestInfo[] = [];
    const lines = content.split('\n');
    
    let currentDescribe: string | undefined;
    let lineNumber = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      lineNumber = i + 1;

      // Extract test.describe blocks
      const describeMatch = line.match(/test\.describe\(['"`]([^'"`]+)['"`]/);
      if (describeMatch) {
        currentDescribe = describeMatch[1];
        continue;
      }

      // Extract individual test cases
      const testMatch = line.match(/test\(['"`]([^'"`]+)['"`]/);
      if (testMatch) {
        const testCaseName = testMatch[1];
        const testName = currentDescribe ? `${currentDescribe} > ${testCaseName}` : testCaseName;
        
        // Extract steps from test body
        const steps = this.extractPlaywrightTestSteps(content, i);
        
        const testInfo: TestInfo = {
          id: uuidv4(),
          filePath,
          testName,
          functionName: testCaseName,
          description: testCaseName,
          category: this.extractPlaywrightCategory(filePath, content),
          lineNumber,
          tags: this.extractPlaywrightTags(filePath, content),
          testType: 'playwright',
          steps,
          complexity: this.assessPlaywrightComplexity(content, steps),
          estimatedDuration: this.estimatePlaywrightDuration(content, steps)
        };

        tests.push(testInfo);
      }
    }

    return tests;
  }

  private extractPlaywrightTestSteps(content: string, startLine: number): string[] {
    const steps: string[] = [];
    const lines = content.split('\n');
    
    // Look for steps in the test function body
    let braceCount = 0;
    let inTestBody = false;
    
    for (let i = startLine; i < lines.length && steps.length < 10; i++) {
      const line = lines[i].trim();
      
      if (line.includes('{')) {
        braceCount++;
        inTestBody = true;
      }
      if (line.includes('}')) {
        braceCount--;
        if (braceCount === 0) break;
      }
      
      if (inTestBody) {
        // Extract meaningful Playwright actions
        if (line.match(/await page\.(goto|navigate)/)) {
          steps.push(`Navigate to ${this.extractUrlFromAction(line)}`);
        } else if (line.match(/await page\.(click|tap)/)) {
          steps.push(`Click ${this.extractSelectorFromAction(line)}`);
        } else if (line.match(/await page\.fill/)) {
          steps.push(`Fill ${this.extractSelectorFromAction(line)}`);
        } else if (line.match(/await expect/)) {
          steps.push(`Verify ${this.extractExpectationFromAction(line)}`);
        } else if (line.match(/await page\.waitFor/)) {
          steps.push(`Wait for ${this.extractSelectorFromAction(line)}`);
        } else if (line.match(/\.screenshot/)) {
          steps.push('Take screenshot');
        }
      }
    }
    
    return steps;
  }

  private extractUrlFromAction(line: string): string {
    const match = line.match(/['"`]([^'"`]*\/[^'"`]*)['"`]/);
    return match ? match[1] : 'page';
  }

  private extractSelectorFromAction(line: string): string {
    const match = line.match(/['"`]([^'"`]+)['"`]/);
    return match ? match[1] : 'element';
  }

  private extractExpectationFromAction(line: string): string {
    if (line.includes('toBeVisible')) return 'element visibility';
    if (line.includes('toContainText')) return 'text content';
    if (line.includes('toHaveURL')) return 'page URL';
    if (line.includes('toHaveTitle')) return 'page title';
    return 'assertion';
  }

  private extractPlaywrightCategory(filePath: string, content: string): string {
    const fileName = path.basename(filePath, path.extname(filePath));
    const lowerContent = content.toLowerCase();
    
    // Category based on filename
    if (fileName.includes('security')) return 'security';
    if (fileName.includes('smoke')) return 'smoke';
    if (fileName.includes('validation') || fileName.includes('comprehensive')) return 'validation';
    if (fileName.includes('performance') || fileName.includes('load')) return 'performance';
    if (fileName.includes('e2e') || fileName.includes('integration')) return 'integration';
    
    // Category based on content
    if (lowerContent.includes('xss') || lowerContent.includes('sql injection')) return 'security';
    if (lowerContent.includes('test-bank') || lowerContent.includes('TestBank')) return 'test-management';
    if (lowerContent.includes('suite-builder') || lowerContent.includes('SuiteBuilder')) return 'test-management';
    if (lowerContent.includes('analytics')) return 'analytics';
    
    // Extract from path
    const pathParts = filePath.split('/');
    for (const part of pathParts) {
      if (['security', 'auth', 'admin', 'dashboard', 'analytics', 'reports'].includes(part)) {
        return part;
      }
    }
    
    return 'functional';
  }

  private extractPlaywrightTags(filePath: string, content: string): string[] {
    const tags: string[] = [];
    const fileName = path.basename(filePath);
    
    if (fileName.includes('debug')) tags.push('debug');
    if (fileName.includes('smoke')) tags.push('smoke');
    if (fileName.includes('security')) tags.push('security');
    if (content.includes('test.skip')) tags.push('skip');
    if (content.includes('test.slow')) tags.push('slow');
    if (content.includes('critical')) tags.push('critical');
    
    return tags;
  }

  private assessPlaywrightComplexity(content: string, steps: string[]): 'low' | 'medium' | 'high' {
    const lines = content.split('\n').length;
    const testCount = (content.match(/test\(/g) || []).length;
    const asyncOperations = (content.match(/await/g) || []).length;
    
    const score = lines + (testCount * 20) + (asyncOperations * 3) + (steps.length * 5);
    
    if (score > 300) return 'high';
    if (score > 150) return 'medium';
    return 'low';
  }

  private estimatePlaywrightDuration(content: string, steps: string[]): number {
    let duration = 30; // Base duration
    
    const testCount = (content.match(/test\(/g) || []).length;
    const waitOperations = (content.match(/waitFor|timeout/g) || []).length;
    const navigationOps = (content.match(/goto|navigate/g) || []).length;
    const screenshotOps = (content.match(/screenshot/g) || []).length;
    
    duration += testCount * 20;        // 20 seconds per test
    duration += waitOperations * 5;    // 5 seconds per wait
    duration += navigationOps * 8;     // 8 seconds per navigation
    duration += screenshotOps * 3;     // 3 seconds per screenshot
    duration += steps.length * 2;      // 2 seconds per step
    
    return Math.min(duration, 900);    // Cap at 15 minutes
  }

  /**
   * Store tests in database with improved error handling and conflict resolution
   */
  private async storeTests(tests: TestInfo[]): Promise<void> {
    if (!tests || tests.length === 0) {
      logger.debug('No tests to store');
      return;
    }

    try {
      const db = getDatabase();

      if (!db || !db.db) {
        logger.warn('Database connection not available, skipping test storage');
        return;
      }

      const startTime = Date.now();
      logger.info(`Storing ${tests.length} tests in database`);

      let successCount = 0;
      let errorCount = 0;

      // Process tests in smaller batches to avoid lock issues
      const batchSize = 10;
      for (let i = 0; i < tests.length; i += batchSize) {
        const batch = tests.slice(i, i + batchSize);

        try {
          // Use transaction for each batch
          const transaction = (db as any).db.transaction((testsToStore: TestInfo[]) => {
            for (const test of testsToStore) {
              try {
                // Generate a unique key based on file path and test name
                const uniqueKey = crypto.createHash('md5').update(`${test.filePath}:${test.testName}`).digest('hex');

                // First, try to update existing record
                const updateTestStmt = (db as any).db.prepare(`
                  UPDATE tests SET
                    class_name = ?, function_name = ?, description = ?, category = ?,
                    line_number = ?, test_type = ?, tags = ?, is_active = ?, updated_at = ?
                  WHERE file_path = ? AND test_name = ?
                `);

                const updateResult = updateTestStmt.run(
                  test.className || null,
                  test.functionName,
                  test.description || null,
                  test.category,
                  test.lineNumber || null,
                  test.testType || 'python',
                  JSON.stringify(test.tags),
                  1, // Explicitly set is_active to 1
                  new Date().toISOString(),
                  test.filePath,
                  test.testName
                );

                // If no rows were updated, insert new record
                if (updateResult.changes === 0) {
                  const insertTestStmt = (db as any).db.prepare(`
                    INSERT INTO tests
                    (id, file_path, test_name, class_name, function_name, description, category, line_number,
                     test_type, tags, is_active, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  `);

                  insertTestStmt.run(
                    test.id || uniqueKey,
                    test.filePath,
                    test.testName,
                    test.className || null,
                    test.functionName,
                    test.description || null,
                    test.category,
                    test.lineNumber || null,
                    test.testType || 'python',
                    JSON.stringify(test.tags),
                    1, // Explicitly set is_active to 1
                    new Date().toISOString()
                  );
                }

                // Handle tags table (with better conflict resolution)
                try {
                  const deleteTagsStmt = (db as any).db.prepare('DELETE FROM test_tags WHERE test_id = ?');
                  deleteTagsStmt.run(test.id || uniqueKey);

                  const insertTagStmt = (db as any).db.prepare(`
                    INSERT OR IGNORE INTO test_tags (test_id, tag_name, tag_type)
                    VALUES (?, ?, ?)
                  `);

                  for (const tag of test.tags) {
                    insertTagStmt.run(test.id || uniqueKey, tag, 'marker');
                  }

                  // Add category as a tag
                  if (test.category !== 'general') {
                    insertTagStmt.run(test.id || uniqueKey, test.category, 'category');
                  }
                } catch (tagError) {
                  logger.debug('Tag insertion failed, continuing', { testId: test.id, error: tagError });
                }

                successCount++;

              } catch (testError) {
                errorCount++;
                logger.debug('Failed to store individual test', {
                  testName: test.testName,
                  filePath: test.filePath,
                  error: testError instanceof Error ? testError.message : testError
                });
              }
            }
          });

          // Execute transaction for this batch
          transaction(batch);

        } catch (batchError) {
          errorCount += batch.length;
          logger.warn('Failed to store test batch', {
            batchStart: i,
            batchSize: batch.length,
            error: batchError instanceof Error ? batchError.message : batchError
          });
        }
      }

      const duration = Date.now() - startTime;
      logger.info('Test storage completed', {
        totalTests: tests.length,
        successCount,
        errorCount,
        duration: duration + 'ms',
        categories: [...new Set(tests.map(t => t.category))]
      });

    } catch (error) {
      logger.error('Failed to store tests - database operation failed', {
        error: error instanceof Error ? error.message : error,
        testCount: tests.length
      });
      // Don't throw error - allow discovery to continue
    }
  }

  /**
   * Get all tests with optional filtering
   */
  async getTests(filters?: {
    category?: string;
    tags?: string[];
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ tests: TestInfo[]; total: number }> {
    try {
      const db = getDatabase();

      // Debug: Check if database and table exist
      logger.info('getTests called with filters:', { filters });

      // First check total count without filters for debugging
      const debugCountStmt = (db as any).db.prepare('SELECT COUNT(*) as total FROM tests');
      const debugCount = debugCountStmt.get();
      logger.info('Total tests in database (all):', { total: debugCount?.total || 0 });

      let whereClause = 'WHERE t.is_active = TRUE';
      const params: any[] = [];

      if (filters?.category) {
        whereClause += ` AND t.category = ?`;
        params.push(filters.category);
      }

      if (filters?.status) {
        whereClause += ` AND t.last_status = ?`;
        params.push(filters.status);
      }

      if (filters?.search) {
        whereClause += ` AND (t.test_name LIKE ? OR t.description LIKE ? OR t.file_path LIKE ?)`;
        const searchPattern = `%${filters.search}%`;
        params.push(searchPattern, searchPattern, searchPattern);
      }

      if (filters?.tags && filters.tags.length > 0) {
        const tagPlaceholders = filters.tags.map(() => '?').join(',');
        whereClause += ` AND t.id IN (
          SELECT test_id FROM test_tags 
          WHERE tag_name IN (${tagPlaceholders})
        )`;
        params.push(...filters.tags);
      }

      // Get total count
      const countStmt = (db as any).db.prepare(`
        SELECT COUNT(DISTINCT t.id) as total
        FROM tests t
        ${whereClause}
      `);
      const countResult = countStmt.get(...params);
      const total = countResult?.total || 0;

      // Get tests with pagination
      let query = `
        SELECT DISTINCT
          t.*,
          GROUP_CONCAT(tt.tag_name) as tag_list
        FROM tests t
        LEFT JOIN test_tags tt ON t.id = tt.test_id
        ${whereClause}
        GROUP BY t.id
        ORDER BY t.file_path, t.line_number
      `;

      if (filters?.limit) {
        query += ` LIMIT ${filters.limit}`;
        if (filters?.offset) {
          query += ` OFFSET ${filters.offset}`;
        }
      }

      const stmt = (db as any).db.prepare(query);
      const rows = stmt.all(...params);
      
      const tests: TestInfo[] = rows.map((row: any) => ({
        id: row.id,
        filePath: row.file_path,
        testName: row.test_name,
        className: row.class_name,
        functionName: row.function_name,
        description: row.description,
        category: row.category,
        lineNumber: row.line_number,
        tags: row.tag_list ? row.tag_list.split(',') : [],
        lastRun: row.last_run ? new Date(row.last_run) : undefined,
        lastStatus: row.last_status,
        lastDuration: row.last_duration,
        testType: row.test_type,
        steps: row.steps ? JSON.parse(row.steps) : undefined,
        complexity: row.complexity,
        estimatedDuration: row.estimated_duration
      }));

      return { tests, total };

    } catch (error) {
      logger.error('Failed to get tests', { error, filters });
      throw error;
    }
  }

  /**
   * Get all unique categories
   */
  async getCategories(): Promise<Array<{ name: string; testCount: number }>> {
    try {
      const db = getDatabase();
      const stmt = (db as any).db.prepare(`
        SELECT 
          category as name,
          COUNT(*) as test_count
        FROM tests
        WHERE is_active = TRUE
        GROUP BY category
        ORDER BY test_count DESC
      `);
      
      const rows = stmt.all();
      return rows.map((row: any) => ({
        name: row.name,
        testCount: row.test_count
      }));

    } catch (error) {
      logger.error('Failed to get categories', { error });
      throw error;
    }
  }

  /**
   * Get all unique tags with counts
   */
  async getTags(): Promise<Array<{ name: string; type: string; testCount: number }>> {
    try {
      const db = getDatabase();
      const stmt = (db as any).db.prepare(`
        SELECT 
          tt.tag_name as name,
          tt.tag_type as type,
          COUNT(DISTINCT tt.test_id) as test_count
        FROM test_tags tt
        JOIN tests t ON tt.test_id = t.id
        WHERE t.is_active = TRUE
        GROUP BY tt.tag_name, tt.tag_type
        ORDER BY test_count DESC
      `);

      const rows = stmt.all();
      return rows.map((row: any) => ({
        name: row.name,
        type: row.type,
        testCount: row.test_count
      }));

    } catch (error) {
      logger.error('Failed to get tags', { error });
      throw error;
    }
  }

  /**
   * Get tests by tag
   */
  async getTestsByTag(tagName: string): Promise<TestInfo[]> {
    try {
      const db = getDatabase();
      const stmt = (db as any).db.prepare(`
        SELECT DISTINCT t.*, GROUP_CONCAT(tt2.tag_name) as tag_list
        FROM tests t
        JOIN test_tags tt ON t.id = tt.test_id
        LEFT JOIN test_tags tt2 ON t.id = tt2.test_id
        WHERE tt.tag_name = ? AND t.is_active = TRUE
        GROUP BY t.id
        ORDER BY t.file_path, t.line_number
      `);

      const rows = stmt.all(tagName);
      return rows.map((row: any) => ({
        id: row.id,
        filePath: row.file_path,
        testName: row.test_name,
        className: row.class_name,
        functionName: row.function_name,
        description: row.description,
        category: row.category,
        lineNumber: row.line_number,
        tags: row.tag_list ? row.tag_list.split(',') : [],
        lastRun: row.last_run ? new Date(row.last_run) : undefined,
        lastStatus: row.last_status,
        lastDuration: row.last_duration
      }));

    } catch (error) {
      logger.error('Failed to get tests by tag', { error, tagName });
      throw error;
    }
  }

  /**
   * Get discovery statistics
   */
  async getDiscoveryStats(): Promise<DiscoveryStats> {
    try {
      const db = getDatabase();

      if (!db || !db.db) {
        logger.warn('Database connection not available for stats');
        return {
          totalFiles: 0,
          totalTests: 0,
          categories: {},
          tags: {},
          lastScanTime: this.lastScanTime || new Date()
        };
      }

      // Debug: Check if tests table exists and has data
      try {
        const tableCheckStmt = (db as any).db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tests'");
        const tableExists = tableCheckStmt.get();
        logger.info('Database table check', { tableExists: !!tableExists });

        if (tableExists) {
          // Count all rows (including inactive)
          const totalRowsStmt = (db as any).db.prepare('SELECT COUNT(*) as count FROM tests');
          const totalRowsResult = totalRowsStmt.get();
          logger.info('Total rows in tests table', { totalRows: totalRowsResult.count });

          // Count active rows
          const activeRowsStmt = (db as any).db.prepare('SELECT COUNT(*) as count FROM tests WHERE is_active = 1');
          const activeRowsResult = activeRowsStmt.get();
          logger.info('Active rows in tests table', { activeRows: activeRowsResult.count });
        }
      } catch (debugError) {
        logger.warn('Debug query failed', { debugError });
      }

      const totalFilesStmt = (db as any).db.prepare('SELECT COUNT(DISTINCT file_path) as count FROM tests WHERE is_active = 1');
      const totalTestsStmt = (db as any).db.prepare('SELECT COUNT(*) as count FROM tests WHERE is_active = 1');

      const totalFilesResult = totalFilesStmt.get();
      const totalTestsResult = totalTestsStmt.get();

      logger.info('Discovery stats query results', {
        totalFiles: totalFilesResult?.count || 0,
        totalTests: totalTestsResult?.count || 0
      });

      const categoriesStmt = (db as any).db.prepare(`
        SELECT category, COUNT(*) as count
        FROM tests
        WHERE is_active = 1
        GROUP BY category
      `);

      const tagsStmt = (db as any).db.prepare(`
        SELECT tt.tag_name, COUNT(DISTINCT tt.test_id) as count
        FROM test_tags tt
        JOIN tests t ON tt.test_id = t.id
        WHERE t.is_active = 1
        GROUP BY tt.tag_name
      `);

      const categoriesRows = categoriesStmt.all();
      const tagsRows = tagsStmt.all();

      const categories: Record<string, number> = {};
      categoriesRows.forEach((row: any) => {
        categories[row.category] = row.count;
      });

      const tags: Record<string, number> = {};
      tagsRows.forEach((row: any) => {
        tags[row.tag_name] = row.count;
      });

      return {
        totalFiles: totalFilesResult?.count || 0,
        totalTests: totalTestsResult?.count || 0,
        categories,
        tags,
        lastScanTime: new Date()
      };

    } catch (error) {
      logger.error('Failed to get discovery stats', { error });
      throw error;
    }
  }

  /**
   * Sync test discovery with file system changes
   * Removes inactive tests and updates file tracking
   */
  async syncWithFileSystem(): Promise<{ added: number; removed: number; updated: number }> {
    try {
      logger.info('Starting file system sync');
      
      const db = getDatabase();
      if (!db || !db.db) {
        throw new Error('Database not available');
      }

      // Get all test files from database
      const dbFilesStmt = (db as any).db.prepare(`
        SELECT DISTINCT file_path FROM tests WHERE is_active = 1
      `);
      const dbFiles = dbFilesStmt.all().map((row: any) => row.file_path);

      // Get all actual test files from file system using glob pattern
      const actualFiles: string[] = [];
      const globPattern = path.join(this.testRootPath, '**/*.py');
      const glob = require('glob');
      const foundFiles = glob.sync(globPattern, { 
        ignore: ['**/__pycache__/**', '**/.pytest_cache/**'] 
      });
      // Filter to only include proper test files
      actualFiles.push(...foundFiles
        .map(f => path.relative(this.testRootPath, f))
        .filter(f => f.match(/^test_.*\.py$/) || f.match(/.*_test\.py$/))
      );

      // Find files that exist in DB but not on filesystem (removed files)
      const removedFiles = dbFiles.filter(dbFile => {
        const normalizedDbFile = dbFile.replace(/\\/g, '/');
        return !actualFiles.some(actualFile => 
          actualFile.replace(/\\/g, '/').includes(normalizedDbFile.split('/').pop() || '')
        );
      });

      // Mark tests from removed files as inactive
      let removedCount = 0;
      for (const removedFile of removedFiles) {
        const updateStmt = (db as any).db.prepare(`
          UPDATE tests SET is_active = 0, updated_at = CURRENT_TIMESTAMP 
          WHERE file_path = ?
        `);
        const result = updateStmt.run(removedFile);
        removedCount += result.changes || 0;
        logger.info('Marked tests as inactive for removed file', { 
          filePath: removedFile, 
          testsAffected: result.changes 
        });
      }

      // Re-scan existing files to catch any new/updated tests
      let addedCount = 0;
      let updatedCount = 0;
      
      for (const filePath of actualFiles) {
        try {
          const tests = await this.scanTestFile(filePath);
          if (tests.length > 0) {
            await this.storeTests(tests);
            addedCount += tests.length; // Just count new tests found
          }
        } catch (error) {
          logger.warn('Failed to sync file', { filePath, error });
        }
      }

      const result = { added: addedCount, removed: removedCount, updated: updatedCount };
      logger.info('File system sync completed', result);
      return result;

    } catch (error) {
      logger.error('Failed to sync with file system', { error });
      throw error;
    }
  }
  /**
   * Generate workflow templates based on discovered tests
   */
  async generateWorkflowTemplates(): Promise<Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    steps: Array<{
      id: string;
      type: 'analyze-failures' | 'plan-execution' | 'assess-quality' | 'heal-selectors';
      requirements: string[];
      dependsOn?: string[];
      criticalFailure?: boolean;
    }>;
    estimatedDuration: number;
    testFiles: string[];
  }>> {
    try {
      const { tests } = await this.getTests();
      const templates = [];

      // Group tests by category and type
      const testsByCategory = this.groupTestsByField(tests, 'category');
      const testsByType = this.groupTestsByField(tests, 'testType');

      // Generate WeSign Document Management Workflow
      const documentTests = testsByCategory['documents'] || [];
      if (documentTests.length > 0) {
        templates.push({
          id: 'document-management-workflow',
          name: 'WeSign Document Management Testing',
          description: `Comprehensive testing of document lifecycle management across ${documentTests.length} document tests`,
          category: 'document-management',
          steps: [
            {
              id: 'analyze-document-failures',
              type: 'analyze-failures' as const,
              requirements: ['document-analysis', 'workflow-validation']
            },
            {
              id: 'assess-document-quality',
              type: 'assess-quality' as const,
              requirements: ['document-quality', 'workflow-analysis'],
              dependsOn: ['analyze-document-failures']
            },
            {
              id: 'plan-document-execution',
              type: 'plan-execution' as const,
              requirements: ['document-prioritization', 'workflow-optimization'],
              dependsOn: ['assess-document-quality']
            }
          ],
          estimatedDuration: documentTests.reduce((sum, test) => sum + (test.estimatedDuration || 60), 0),
          testFiles: documentTests.map(test => test.filePath)
        });
      }

      // Generate WeSign Core Functionality Workflow
      const wesignTests = testsByCategory['wesign'] || [];
      if (wesignTests.length > 0) {
        templates.push({
          id: 'wesign-core-workflow',
          name: 'WeSign Core Functionality Testing',
          description: `Core WeSign platform testing across ${wesignTests.length} core functionality tests`,
          category: 'core-functionality',
          steps: [
            {
              id: 'analyze-core-failures',
              type: 'analyze-failures' as const,
              requirements: ['wesign-analysis', 'platform-validation']
            },
            {
              id: 'assess-core-quality',
              type: 'assess-quality' as const,
              requirements: ['platform-quality', 'feature-analysis'],
              dependsOn: ['analyze-core-failures']
            },
            {
              id: 'plan-core-execution',
              type: 'plan-execution' as const,
              requirements: ['feature-prioritization', 'platform-optimization'],
              dependsOn: ['assess-core-quality']
            }
          ],
          estimatedDuration: wesignTests.reduce((sum, test) => sum + (test.estimatedDuration || 90), 0),
          testFiles: wesignTests.map(test => test.filePath)
        });
      }

      // Generate Contact Management Workflow
      const contactTests = testsByCategory['contacts'] || [];
      if (contactTests.length > 0) {
        templates.push({
          id: 'contact-management-workflow',
          name: 'Contact Management Testing',
          description: `Contact and user management testing across ${contactTests.length} contact tests`,
          category: 'contact-management',
          steps: [
            {
              id: 'plan-contact-execution',
              type: 'plan-execution' as const,
              requirements: ['contact-selection', 'user-management']
            },
            {
              id: 'assess-contact-results',
              type: 'assess-quality' as const,
              requirements: ['contact-validation', 'data-integrity'],
              dependsOn: ['plan-contact-execution']
            }
          ],
          estimatedDuration: contactTests.reduce((sum, test) => sum + (test.estimatedDuration || 45), 0),
          testFiles: contactTests.map(test => test.filePath)
        });
      }

      // Generate Playwright E2E Testing Workflow
      const playwrightTests = testsByType['playwright'] || [];
      if (playwrightTests.length > 0) {
        templates.push({
          id: 'playwright-e2e-workflow',
          name: 'Playwright E2E Testing Workflow',
          description: `End-to-end browser testing across ${playwrightTests.length} Playwright tests with intelligent failure analysis`,
          category: 'testing',
          steps: [
            {
              id: 'analyze-playwright-failures',
              type: 'analyze-failures' as const,
              requirements: ['browser-analysis', 'selector-analysis', 'flaky-detection']
            },
            {
              id: 'heal-playwright-selectors',
              type: 'heal-selectors' as const,
              requirements: ['selector-healing', 'dom-analysis'],
              dependsOn: ['analyze-playwright-failures']
            },
            {
              id: 'plan-playwright-execution',
              type: 'plan-execution' as const,
              requirements: ['browser-prioritization', 'parallel-execution'],
              dependsOn: ['heal-playwright-selectors']
            }
          ],
          estimatedDuration: playwrightTests.reduce((sum, test) => sum + (test.estimatedDuration || 120), 0),
          testFiles: playwrightTests.map(test => test.filePath)
        });
      }

      // Generate Reports & Analytics Workflow
      const reportTests = testsByCategory['reports'] || [];
      if (reportTests.length > 0) {
        templates.push({
          id: 'reports-analytics-workflow',
          name: 'Reports & Analytics Testing',
          description: `Comprehensive testing of reporting and analytics features across ${reportTests.length} report tests`,
          category: 'reports-analytics',
          steps: [
            {
              id: 'analyze-report-failures',
              type: 'analyze-failures' as const,
              requirements: ['report-analysis', 'data-validation']
            },
            {
              id: 'assess-report-quality',
              type: 'assess-quality' as const,
              requirements: ['data-accuracy', 'report-integrity'],
              dependsOn: ['analyze-report-failures']
            },
            {
              id: 'plan-report-execution',
              type: 'plan-execution' as const,
              requirements: ['report-prioritization', 'data-optimization'],
              dependsOn: ['assess-report-quality']
            }
          ],
          estimatedDuration: reportTests.reduce((sum, test) => sum + (test.estimatedDuration || 75), 0),
          testFiles: reportTests.map(test => test.filePath)
        });
      }

      // Generate Authentication & Security Workflow
      const authTests = testsByCategory['auth'] || [];
      if (authTests.length > 0) {
        templates.push({
          id: 'auth-security-workflow',
          name: 'Authentication & Security Testing',
          description: `Security and authentication testing across ${authTests.length} auth tests including access control validation`,
          category: 'security',
          steps: [
            {
              id: 'analyze-auth-vulnerabilities',
              type: 'analyze-failures' as const,
              requirements: ['security-analysis', 'auth-validation']
            },
            {
              id: 'assess-auth-coverage',
              type: 'assess-quality' as const,
              requirements: ['security-coverage', 'access-control'],
              dependsOn: ['analyze-auth-vulnerabilities']
            },
            {
              id: 'plan-auth-execution',
              type: 'plan-execution' as const,
              requirements: ['security-prioritization', 'auth-optimization'],
              dependsOn: ['assess-auth-coverage']
            }
          ],
          estimatedDuration: authTests.reduce((sum, test) => sum + (test.estimatedDuration || 90), 0),
          testFiles: authTests.map(test => test.filePath)
        });
      }

      // Generate Template Management Workflow
      const templateTests = testsByCategory['templates'] || [];
      if (templateTests.length > 0) {
        templates.push({
          id: 'template-management-workflow',
          name: 'Template Management Testing',
          description: `Template and configuration management testing across ${templateTests.length} template tests`,
          category: 'template-management',
          steps: [
            {
              id: 'plan-template-execution',
              type: 'plan-execution' as const,
              requirements: ['template-selection', 'config-validation']
            },
            {
              id: 'assess-template-results',
              type: 'assess-quality' as const,
              requirements: ['template-validation', 'config-integrity'],
              dependsOn: ['plan-template-execution']
            }
          ],
          estimatedDuration: templateTests.reduce((sum, test) => sum + (test.estimatedDuration || 50), 0),
          testFiles: templateTests.map(test => test.filePath)
        });
      }

      // Generate Smart Regression Testing Workflow (using high-complexity tests)
      const complexTests = tests.filter(test => test.complexity === 'high');
      if (complexTests.length > 0) {
        templates.push({
          id: 'smart-regression-testing',
          name: 'Smart Regression Testing',
          description: `Intelligent regression test selection from ${complexTests.length} high-complexity tests based on code changes`,
          category: 'testing',
          steps: [
            {
              id: 'analyze-code-impact',
              type: 'analyze-failures' as const,
              requirements: ['change-analysis', 'impact-assessment']
            },
            {
              id: 'select-regression-tests',
              type: 'plan-execution' as const,
              requirements: ['smart-selection', 'regression-prioritization'],
              dependsOn: ['analyze-code-impact']
            },
            {
              id: 'assess-regression-coverage',
              type: 'assess-quality' as const,
              requirements: ['coverage-validation', 'risk-analysis'],
              dependsOn: ['select-regression-tests']
            }
          ],
          estimatedDuration: complexTests.reduce((sum, test) => sum + (test.estimatedDuration || 90), 0),
          testFiles: complexTests.map(test => test.filePath)
        });
      }

      logger.info(`Generated ${templates.length} workflow templates based on ${tests.length} discovered tests`);
      return templates;

    } catch (error) {
      logger.error('Failed to generate workflow templates', { error });
      return [];
    }
  }

  private groupTestsByField<T extends TestInfo>(tests: T[], field: keyof T): Record<string, T[]> {
    return tests.reduce((groups, test) => {
      const key = String(test[field] || 'other');
      if (!groups[key]) groups[key] = [];
      groups[key].push(test);
      return groups;
    }, {} as Record<string, T[]>);
  }
}

// Export singleton instance
export const testDiscoveryService = new TestDiscoveryService();