/**
 * Database Synchronization Script
 *
 * Synchronizes test database with file system state
 * - Scans configured test directories
 * - Adds new tests
 * - Updates existing tests
 * - Marks deleted tests as inactive
 * - Tracks file metadata (hash, size, modified date)
 * - Logs all sync operations
 */

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getDatabase } from '../database/database';
import { logger } from '../utils/logger';
import { testDiscoveryService, TestInfo } from '../services/testDiscoveryService';

interface TestSource {
  id: number;
  name: string;
  path: string;
  type: string;
  enabled: boolean;
  priority: number;
}

interface SyncStats {
  filesFound: number;
  testsFound: number;
  databaseRecords: number;
  testsAdded: number;
  testsUpdated: number;
  testsRemoved: number;
  errors: string[];
}

export class TestDatabaseSynchronizer {
  private db: any;
  private stats: Map<string, SyncStats> = new Map();

  constructor() {
    this.db = getDatabase();
  }

  /**
   * Main synchronization method
   */
  async synchronize(): Promise<void> {
    const startTime = Date.now();
    logger.info('Starting database synchronization with file system');

    try {
      // Get all enabled test sources
      const sources = await this.getTestSources();
      logger.info(`Found ${sources.length} test sources to sync`);

      // Synchronize each source
      for (const source of sources) {
        await this.syncTestSource(source);
      }

      // Generate summary report
      this.generateSummaryReport(startTime);

      logger.info('Database synchronization completed successfully');
    } catch (error) {
      logger.error('Database synchronization failed', { error });
      throw error;
    }
  }

  /**
   * Get all enabled test sources from database
   */
  private async getTestSources(): Promise<TestSource[]> {
    try {
      const stmt = (this.db as any).db.prepare(`
        SELECT id, name, path, type, enabled, priority
        FROM test_sources
        WHERE enabled = 1
        ORDER BY priority DESC, name ASC
      `);

      const sources = stmt.all() as TestSource[];

      // If no sources in database, use default paths
      if (sources.length === 0) {
        logger.warn('No test sources found in database, using defaults');
        return [
          {
            id: 1,
            name: 'wesign-official',
            path: process.env.WESIGN_TEST_SUITE_PATH || 'C:/Users/gals/seleniumpythontests-1/playwright_tests/',
            type: 'local',
            enabled: true,
            priority: 1
          },
          {
            id: 2,
            name: 'wesign-local',
            path: 'C:/Users/gals/Desktop/playwrightTestsClaude/new_tests_for_wesign',
            type: 'local',
            enabled: true,
            priority: 0
          }
        ];
      }

      return sources;
    } catch (error) {
      logger.error('Failed to get test sources', { error });
      throw error;
    }
  }

  /**
   * Synchronize a single test source
   */
  private async syncTestSource(source: TestSource): Promise<void> {
    const syncStartTime = Date.now();
    logger.info(`Syncing test source: ${source.name} at ${source.path}`);

    const stats: SyncStats = {
      filesFound: 0,
      testsFound: 0,
      databaseRecords: 0,
      testsAdded: 0,
      testsUpdated: 0,
      testsRemoved: 0,
      errors: []
    };

    try {
      // Check if directory exists
      try {
        await fs.access(source.path);
      } catch (error) {
        logger.error(`Test source directory not accessible: ${source.path}`, { error });
        stats.errors.push(`Directory not accessible: ${source.path}`);
        this.stats.set(source.name, stats);
        await this.logSyncOperation(source, stats, Date.now() - syncStartTime, 'failed', `Directory not accessible: ${source.path}`);
        return;
      }

      // Get current database records for this source
      const dbTestsStmt = (this.db as any).db.prepare(`
        SELECT id, file_path, test_name, file_hash, file_exists
        FROM tests
        WHERE source_directory = ? AND is_active = 1
      `);
      const dbTests = dbTestsStmt.all(source.path);
      stats.databaseRecords = dbTests.length;

      logger.info(`Found ${dbTests.length} existing database records for ${source.name}`);

      // Scan file system for tests
      const fileTests = await this.scanDirectory(source.path, source.name);
      stats.filesFound = fileTests.size;
      stats.testsFound = Array.from(fileTests.values()).reduce((sum, tests) => sum + tests.length, 0);

      logger.info(`Found ${stats.testsFound} tests in ${stats.filesFound} files from ${source.name}`);

      // Create maps for quick lookup
      const dbTestMap = new Map(dbTests.map((t: any) => [t.file_path + ':' + t.test_name, t]));
      const fileTestMap = new Map<string, TestInfo>();

      for (const tests of fileTests.values()) {
        for (const test of tests) {
          fileTestMap.set(test.filePath + ':' + test.testName, test);
        }
      }

      // Find tests to add (in files but not in DB)
      const testsToAdd: TestInfo[] = [];
      for (const [key, test] of fileTestMap.entries()) {
        if (!dbTestMap.has(key)) {
          testsToAdd.push(test);
        }
      }

      // Find tests to update (in both, check hash)
      const testsToUpdate: TestInfo[] = [];
      for (const [key, test] of fileTestMap.entries()) {
        const dbTest = dbTestMap.get(key);
        if (dbTest) {
          // Check if file hash changed
          const fileHash = await this.calculateFileHash(test.filePath);
          if (fileHash !== dbTest.file_hash) {
            testsToUpdate.push(test);
          }
        }
      }

      // Find tests to remove (in DB but not in files)
      const testsToRemove: string[] = [];
      for (const [key, dbTest] of dbTestMap.entries()) {
        if (!fileTestMap.has(key)) {
          testsToRemove.push(dbTest.id);
        }
      }

      logger.info(`Sync plan for ${source.name}: Add ${testsToAdd.length}, Update ${testsToUpdate.length}, Remove ${testsToRemove.length}`);

      // Execute sync operations
      await this.addTests(testsToAdd, source.path);
      stats.testsAdded = testsToAdd.length;

      await this.updateTests(testsToUpdate, source.path);
      stats.testsUpdated = testsToUpdate.length;

      await this.markTestsInactive(testsToRemove);
      stats.testsRemoved = testsToRemove.length;

      // Update test source last_scan and total_tests
      const updateSourceStmt = (this.db as any).db.prepare(`
        UPDATE test_sources
        SET last_scan = datetime('now', 'utc'),
            total_tests = ?,
            updated_at = datetime('now', 'utc')
        WHERE id = ?
      `);
      updateSourceStmt.run(stats.testsFound, source.id);

      // Log sync operation
      const syncDuration = Date.now() - syncStartTime;
      await this.logSyncOperation(source, stats, syncDuration, 'success');

      this.stats.set(source.name, stats);
      logger.info(`Successfully synced ${source.name} in ${syncDuration}ms`);

    } catch (error: any) {
      logger.error(`Failed to sync test source: ${source.name}`, { error });
      stats.errors.push(error.message || String(error));
      this.stats.set(source.name, stats);

      const syncDuration = Date.now() - syncStartTime;
      await this.logSyncOperation(source, stats, syncDuration, 'failed', error.message);
    }
  }

  /**
   * Scan directory recursively for test files
   */
  private async scanDirectory(dirPath: string, sourceName: string): Promise<Map<string, TestInfo[]>> {
    const testFiles = new Map<string, TestInfo[]>();

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Skip cache and temp directories
          const skipDirs = ['__pycache__', '.pytest_cache', '.coverage', 'htmlcov', 'node_modules', '.git', 'venv', '.venv'];
          if (!skipDirs.includes(entry.name)) {
            const subTests = await this.scanDirectory(fullPath, sourceName);
            for (const [file, tests] of subTests.entries()) {
              testFiles.set(file, tests);
            }
          }
        } else if (entry.isFile()) {
          // Check if it's a test file
          const isTestFile = /^test_.*\.py$|.*_test\.py$|.*\.spec\.ts$|.*\.test\.ts$/.test(entry.name);
          if (isTestFile) {
            try {
              const tests = await this.parseTestFile(fullPath, sourceName);
              if (tests.length > 0) {
                testFiles.set(fullPath, tests);
              }
            } catch (error) {
              logger.warn(`Failed to parse test file: ${fullPath}`, { error });
            }
          }
        }
      }
    } catch (error) {
      logger.error(`Failed to scan directory: ${dirPath}`, { error });
    }

    return testFiles;
  }

  /**
   * Parse a test file and extract test information
   */
  private async parseTestFile(filePath: string, sourceName: string): Promise<TestInfo[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const stats = await fs.stat(filePath);

      // Use testDiscoveryService parser
      // This is a simplified version - you may want to use the full parser
      const tests: TestInfo[] = [];
      const lines = content.split('\n');

      const isPython = filePath.endsWith('.py');
      const testPattern = isPython
        ? /^\s*(async\s+)?def\s+(test_\w+)/
        : /test\(['"`]([^'"`]+)['"`]/;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(testPattern);

        if (match) {
          const testName = match[2] || match[1];
          const normalizedPath = filePath.replace(/\\/g, '/');

          tests.push({
            id: crypto.createHash('md5').update(`${normalizedPath}:${testName}`).digest('hex'),
            filePath: normalizedPath,
            testName,
            functionName: testName,
            category: this.extractCategory(filePath),
            lineNumber: i + 1,
            tags: [],
            testType: isPython ? 'python' : 'playwright',
            estimatedDuration: 60000
          });
        }
      }

      return tests;
    } catch (error) {
      logger.error(`Failed to parse test file: ${filePath}`, { error });
      return [];
    }
  }

  /**
   * Extract category from file path
   */
  private extractCategory(filePath: string): string {
    const normalized = filePath.toLowerCase();
    if (normalized.includes('auth')) return 'auth';
    if (normalized.includes('document')) return 'documents';
    if (normalized.includes('sign')) return 'signing';
    if (normalized.includes('contact')) return 'contacts';
    if (normalized.includes('template')) return 'templates';
    if (normalized.includes('admin')) return 'admin';
    if (normalized.includes('report')) return 'reports';
    return 'general';
  }

  /**
   * Calculate MD5 hash of file content
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath);
      return crypto.createHash('md5').update(content).digest('hex');
    } catch (error) {
      logger.error(`Failed to calculate file hash: ${filePath}`, { error });
      return '';
    }
  }

  /**
   * Add new tests to database
   */
  private async addTests(tests: TestInfo[], sourceDir: string): Promise<void> {
    if (tests.length === 0) return;

    logger.info(`Adding ${tests.length} new tests to database`);

    const insertStmt = (this.db as any).db.prepare(`
      INSERT INTO tests (
        id, file_path, test_name, class_name, function_name, description,
        category, line_number, test_type, tags, is_active,
        source_directory, file_hash, file_exists, file_last_modified,
        created_at, updated_at, last_file_check
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'utc'), datetime('now', 'utc'), datetime('now', 'utc'))
    `);

    for (const test of tests) {
      try {
        const fileHash = await this.calculateFileHash(test.filePath);
        const stats = await fs.stat(test.filePath);

        insertStmt.run(
          test.id,
          test.filePath,
          test.testName,
          test.className || null,
          test.functionName,
          test.description || null,
          test.category,
          test.lineNumber || null,
          test.testType || 'python',
          JSON.stringify(test.tags || []),
          1, // is_active
          sourceDir,
          fileHash,
          1, // file_exists
          stats.mtime.toISOString()
        );
      } catch (error) {
        logger.error(`Failed to add test: ${test.testName}`, { error });
      }
    }
  }

  /**
   * Update existing tests in database
   */
  private async updateTests(tests: TestInfo[], sourceDir: string): Promise<void> {
    if (tests.length === 0) return;

    logger.info(`Updating ${tests.length} existing tests in database`);

    const updateStmt = (this.db as any).db.prepare(`
      UPDATE tests SET
        description = ?,
        category = ?,
        line_number = ?,
        file_hash = ?,
        file_exists = 1,
        file_last_modified = ?,
        updated_at = datetime('now', 'utc'),
        last_file_check = datetime('now', 'utc')
      WHERE file_path = ? AND test_name = ?
    `);

    for (const test of tests) {
      try {
        const fileHash = await this.calculateFileHash(test.filePath);
        const stats = await fs.stat(test.filePath);

        updateStmt.run(
          test.description || null,
          test.category,
          test.lineNumber || null,
          fileHash,
          stats.mtime.toISOString(),
          test.filePath,
          test.testName
        );
      } catch (error) {
        logger.error(`Failed to update test: ${test.testName}`, { error });
      }
    }
  }

  /**
   * Mark tests as inactive (file deleted)
   */
  private async markTestsInactive(testIds: string[]): Promise<void> {
    if (testIds.length === 0) return;

    logger.info(`Marking ${testIds.length} tests as inactive`);

    const updateStmt = (this.db as any).db.prepare(`
      UPDATE tests SET
        is_active = 0,
        file_exists = 0,
        updated_at = datetime('now', 'utc'),
        last_file_check = datetime('now', 'utc')
      WHERE id = ?
    `);

    for (const testId of testIds) {
      try {
        updateStmt.run(testId);
      } catch (error) {
        logger.error(`Failed to mark test inactive: ${testId}`, { error });
      }
    }
  }

  /**
   * Log sync operation to database
   */
  private async logSyncOperation(
    source: TestSource,
    stats: SyncStats,
    durationMs: number,
    status: 'success' | 'partial' | 'failed',
    errorMessage?: string
  ): Promise<void> {
    try {
      const insertStmt = (this.db as any).db.prepare(`
        INSERT INTO file_sync_log (
          source_directory, files_found, tests_found, database_records,
          tests_added, tests_updated, tests_removed, sync_status,
          sync_duration_ms, error_message, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertStmt.run(
        source.path,
        stats.filesFound,
        stats.testsFound,
        stats.databaseRecords,
        stats.testsAdded,
        stats.testsUpdated,
        stats.testsRemoved,
        status,
        durationMs,
        errorMessage || null,
        JSON.stringify({ sourceName: source.name, errors: stats.errors })
      );
    } catch (error) {
      logger.error('Failed to log sync operation', { error });
    }
  }

  /**
   * Generate summary report
   */
  private generateSummaryReport(startTime: number): void {
    const totalDuration = Date.now() - startTime;
    const totalStats = {
      filesFound: 0,
      testsFound: 0,
      databaseRecords: 0,
      testsAdded: 0,
      testsUpdated: 0,
      testsRemoved: 0,
      errors: [] as string[]
    };

    for (const [sourceName, stats] of this.stats.entries()) {
      totalStats.filesFound += stats.filesFound;
      totalStats.testsFound += stats.testsFound;
      totalStats.databaseRecords += stats.databaseRecords;
      totalStats.testsAdded += stats.testsAdded;
      totalStats.testsUpdated += stats.testsUpdated;
      totalStats.testsRemoved += stats.testsRemoved;
      totalStats.errors.push(...stats.errors);
    }

    logger.info('='.repeat(80));
    logger.info('DATABASE SYNCHRONIZATION SUMMARY');
    logger.info('='.repeat(80));
    logger.info(`Total Duration: ${totalDuration}ms`);
    logger.info(`Sources Synced: ${this.stats.size}`);
    logger.info(`Files Scanned: ${totalStats.filesFound}`);
    logger.info(`Tests Found: ${totalStats.testsFound}`);
    logger.info(`Database Records (before): ${totalStats.databaseRecords}`);
    logger.info(`Tests Added: ${totalStats.testsAdded}`);
    logger.info(`Tests Updated: ${totalStats.testsUpdated}`);
    logger.info(`Tests Removed: ${totalStats.testsRemoved}`);
    logger.info(`Total Errors: ${totalStats.errors.length}`);
    logger.info('='.repeat(80));

    if (totalStats.errors.length > 0) {
      logger.warn('Errors encountered during sync:');
      totalStats.errors.forEach((error, index) => {
        logger.warn(`  ${index + 1}. ${error}`);
      });
    }

    // Log per-source breakdown
    for (const [sourceName, stats] of this.stats.entries()) {
      logger.info(`\n${sourceName}:`);
      logger.info(`  Files: ${stats.filesFound}, Tests: ${stats.testsFound}`);
      logger.info(`  Added: ${stats.testsAdded}, Updated: ${stats.testsUpdated}, Removed: ${stats.testsRemoved}`);
    }
  }
}

// Export function to run sync
export async function runDatabaseSync(): Promise<void> {
  const synchronizer = new TestDatabaseSynchronizer();
  await synchronizer.synchronize();
}

// Run if executed directly
if (require.main === module) {
  runDatabaseSync()
    .then(() => {
      console.log('✅ Database synchronization completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Database synchronization failed:', error);
      process.exit(1);
    });
}
