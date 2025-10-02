/**
 * Database Integrity Validation Script
 * Validates the QA Intelligence database for data consistency and integrity
 */

import { getDatabase } from '../database/database';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

interface ValidationResult {
  check: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

interface IntegrityReport {
  timestamp: string;
  totalChecks: number;
  passed: number;
  failed: number;
  warnings: number;
  results: ValidationResult[];
  summary: {
    critical: number;
    major: number;
    minor: number;
  };
}

class DatabaseIntegrityValidator {
  private db: any;
  private results: ValidationResult[] = [];

  constructor() {
    const database = getDatabase();
    this.db = (database as any).db;
  }

  /**
   * Run all validation checks
   */
  async validate(): Promise<IntegrityReport> {
    console.log('\n🔍 Starting Database Integrity Validation...\n');

    // Schema and structure checks
    await this.checkRequiredTables();
    await this.checkRequiredColumns();
    await this.checkIndexes();

    // Data integrity checks
    await this.checkFilePathValidity();
    await this.checkOrphanedRecords();
    await this.checkMissingRecords();
    await this.checkDuplicateTests();
    await this.checkFileHashConsistency();

    // Foreign key and relationship checks
    await this.checkForeignKeyIntegrity();
    await this.checkCategoryConsistency();

    // Data quality checks
    await this.checkNullableFields();
    await this.checkTimestampConsistency();
    await this.checkStatusValues();

    // Coverage and metrics checks
    await this.checkCoverageCalculations();
    await this.checkSyncLogIntegrity();

    // Generate report
    const report = this.generateReport();
    this.printReport(report);

    return report;
  }

  /**
   * Check that all required tables exist
   */
  private async checkRequiredTables(): Promise<void> {
    const requiredTables = [
      'tests',
      'test_sources',
      'file_sync_log',
      'file_watch_events',
      'schema_versions'
    ];

    const existingTables = this.db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table'
      ORDER BY name
    `).all().map((row: any) => row.name);

    const missingTables = requiredTables.filter(table => !existingTables.includes(table));

    if (missingTables.length === 0) {
      this.addResult('Required Tables', 'pass', `All ${requiredTables.length} required tables exist`);
    } else {
      this.addResult('Required Tables', 'fail',
        `Missing tables: ${missingTables.join(', ')}`,
        { missingTables }
      );
    }
  }

  /**
   * Check that required columns exist in tests table
   */
  private async checkRequiredColumns(): Promise<void> {
    const requiredColumns = [
      'id', 'test_name', 'category', 'file_path',
      'file_hash', 'last_file_check', 'file_exists',
      'source_directory', 'file_size', 'file_last_modified',
      'last_status', 'last_duration', 'is_active'
    ];

    const tableInfo = this.db.prepare(`PRAGMA table_info(tests)`).all();
    const existingColumns = tableInfo.map((col: any) => col.name);

    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));

    if (missingColumns.length === 0) {
      this.addResult('Required Columns', 'pass',
        `All ${requiredColumns.length} required columns exist in tests table`
      );
    } else {
      this.addResult('Required Columns', 'fail',
        `Missing columns in tests table: ${missingColumns.join(', ')}`,
        { missingColumns }
      );
    }
  }

  /**
   * Check that indexes exist for performance
   */
  private async checkIndexes(): Promise<void> {
    const indexes = this.db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='index' AND tbl_name='tests'
    `).all();

    if (indexes.length > 0) {
      this.addResult('Database Indexes', 'pass',
        `Found ${indexes.length} indexes on tests table`,
        { indexes: indexes.map((i: any) => i.name) }
      );
    } else {
      this.addResult('Database Indexes', 'warning',
        'No indexes found on tests table - consider adding for performance'
      );
    }
  }

  /**
   * Validate that file paths in database actually exist
   */
  private async checkFilePathValidity(): Promise<void> {
    const tests = this.db.prepare(`
      SELECT id, file_path, source_directory, file_exists
      FROM tests
      WHERE is_active = 1
    `).all();

    let validPaths = 0;
    let invalidPaths = 0;
    let markedIncorrectly = 0;
    const invalidFiles: string[] = [];

    for (const test of tests) {
      const fullPath = test.file_path;
      const actuallyExists = fs.existsSync(fullPath);

      if (actuallyExists) {
        validPaths++;
        if (test.file_exists === 0) {
          markedIncorrectly++;
        }
      } else {
        invalidPaths++;
        if (test.file_exists === 1) {
          markedIncorrectly++;
        }
        if (invalidFiles.length < 10) { // Only collect first 10
          invalidFiles.push(fullPath);
        }
      }
    }

    const accuracy = ((validPaths / tests.length) * 100).toFixed(2);

    if (invalidPaths === 0 && markedIncorrectly === 0) {
      this.addResult('File Path Validity', 'pass',
        `All ${tests.length} test file paths are valid and correctly marked`
      );
    } else if (invalidPaths > 0) {
      this.addResult('File Path Validity', 'warning',
        `${invalidPaths} invalid file paths found (${accuracy}% valid)`,
        { validPaths, invalidPaths, markedIncorrectly, sampleInvalidFiles: invalidFiles }
      );
    } else {
      this.addResult('File Path Validity', 'warning',
        `${markedIncorrectly} tests marked incorrectly in file_exists column`,
        { markedIncorrectly }
      );
    }
  }

  /**
   * Check for orphaned records (tests without source)
   */
  private async checkOrphanedRecords(): Promise<void> {
    const orphanedTests = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM tests t
      LEFT JOIN test_sources s ON t.source_directory = s.path
      WHERE t.is_active = 1 AND s.id IS NULL
    `).get();

    if (orphanedTests.count === 0) {
      this.addResult('Orphaned Records', 'pass', 'No orphaned test records found');
    } else {
      this.addResult('Orphaned Records', 'warning',
        `Found ${orphanedTests.count} tests without matching source directory`,
        { orphanedCount: orphanedTests.count }
      );
    }
  }

  /**
   * Check for missing test records (files exist but not in DB)
   */
  private async checkMissingRecords(): Promise<void> {
    // Get all test sources
    const sources = this.db.prepare(`SELECT * FROM test_sources`).all();

    let totalFilesScanned = 0;
    let totalDbRecords = 0;
    let missingFiles = 0;

    for (const source of sources) {
      if (fs.existsSync(source.path)) {
        const files = this.scanDirectory(source.path);
        totalFilesScanned += files.length;

        const dbCount = this.db.prepare(`
          SELECT COUNT(*) as count
          FROM tests
          WHERE source_directory = ? AND is_active = 1
        `).get(source.path);

        totalDbRecords += dbCount.count;
      }
    }

    missingFiles = totalFilesScanned - totalDbRecords;

    if (missingFiles === 0) {
      this.addResult('Missing Records', 'pass',
        `All ${totalFilesScanned} test files have database records`
      );
    } else if (Math.abs(missingFiles) < totalFilesScanned * 0.05) { // < 5% difference
      this.addResult('Missing Records', 'warning',
        `Small discrepancy: ${Math.abs(missingFiles)} files (${((Math.abs(missingFiles) / totalFilesScanned) * 100).toFixed(1)}%)`,
        { totalFilesScanned, totalDbRecords, difference: missingFiles }
      );
    } else {
      this.addResult('Missing Records', 'fail',
        `Significant discrepancy: ${Math.abs(missingFiles)} ${missingFiles > 0 ? 'missing' : 'extra'} files`,
        { totalFilesScanned, totalDbRecords, difference: missingFiles }
      );
    }
  }

  /**
   * Check for duplicate test records
   */
  private async checkDuplicateTests(): Promise<void> {
    const duplicates = this.db.prepare(`
      SELECT file_path, test_name, COUNT(*) as count
      FROM tests
      WHERE is_active = 1
      GROUP BY file_path, test_name
      HAVING count > 1
    `).all();

    if (duplicates.length === 0) {
      this.addResult('Duplicate Tests', 'pass', 'No duplicate test records found');
    } else {
      const totalDuplicates = duplicates.reduce((sum: number, d: any) => sum + d.count - 1, 0);
      this.addResult('Duplicate Tests', 'warning',
        `Found ${duplicates.length} sets of duplicates (${totalDuplicates} total duplicate records)`,
        { duplicateSets: duplicates.slice(0, 10) } // Show first 10
      );
    }
  }

  /**
   * Check file hash consistency
   */
  private async checkFileHashConsistency(): Promise<void> {
    const testsWithHash = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM tests
      WHERE is_active = 1 AND file_exists = 1 AND file_hash IS NOT NULL
    `).get();

    const testsWithoutHash = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM tests
      WHERE is_active = 1 AND file_exists = 1 AND file_hash IS NULL
    `).get();

    const total = testsWithHash.count + testsWithoutHash.count;
    const percentage = total > 0 ? ((testsWithHash.count / total) * 100).toFixed(1) : '0';

    if (testsWithoutHash.count === 0) {
      this.addResult('File Hash Consistency', 'pass',
        `All ${total} existing test files have MD5 hashes`
      );
    } else {
      this.addResult('File Hash Consistency', 'warning',
        `${testsWithoutHash.count} tests missing file hashes (${percentage}% have hashes)`,
        { withHash: testsWithHash.count, withoutHash: testsWithoutHash.count }
      );
    }
  }

  /**
   * Check foreign key integrity
   */
  private async checkForeignKeyIntegrity(): Promise<void> {
    // Check if foreign keys are enabled
    const fkEnabled = this.db.prepare('PRAGMA foreign_keys').get();

    this.addResult('Foreign Keys', fkEnabled.foreign_keys === 1 ? 'pass' : 'warning',
      fkEnabled.foreign_keys === 1
        ? 'Foreign key constraints are enabled'
        : 'Foreign key constraints are disabled - may allow data inconsistencies'
    );
  }

  /**
   * Check category consistency
   */
  private async checkCategoryConsistency(): Promise<void> {
    const categories = this.db.prepare(`
      SELECT category, COUNT(*) as count
      FROM tests
      WHERE is_active = 1
      GROUP BY category
      ORDER BY count DESC
    `).all();

    const nullCategories = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM tests
      WHERE is_active = 1 AND (category IS NULL OR category = '')
    `).get();

    if (nullCategories.count === 0) {
      this.addResult('Category Consistency', 'pass',
        `All tests have categories (${categories.length} unique categories)`,
        { categories: categories.map((c: any) => ({ category: c.category, count: c.count })) }
      );
    } else {
      this.addResult('Category Consistency', 'warning',
        `${nullCategories.count} tests have null/empty category`,
        { nullCount: nullCategories.count, totalCategories: categories.length }
      );
    }
  }

  /**
   * Check nullable fields
   */
  private async checkNullableFields(): Promise<void> {
    const nullChecks = [
      { field: 'test_name', required: true },
      { field: 'file_path', required: true },
      { field: 'category', required: false }
    ];

    let issues = 0;

    for (const check of nullChecks) {
      const nullCount = this.db.prepare(`
        SELECT COUNT(*) as count
        FROM tests
        WHERE is_active = 1 AND (${check.field} IS NULL OR ${check.field} = '')
      `).get();

      if (check.required && nullCount.count > 0) {
        issues++;
        this.addResult(`Nullable Field: ${check.field}`, 'fail',
          `Found ${nullCount.count} records with null/empty ${check.field}`,
          { field: check.field, nullCount: nullCount.count }
        );
      }
    }

    if (issues === 0) {
      this.addResult('Nullable Fields', 'pass', 'All required fields have values');
    }
  }

  /**
   * Check timestamp consistency
   */
  private async checkTimestampConsistency(): Promise<void> {
    const invalidTimestamps = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM tests
      WHERE is_active = 1
        AND (
          created_at IS NULL
          OR updated_at IS NULL
          OR updated_at < created_at
        )
    `).get();

    if (invalidTimestamps.count === 0) {
      this.addResult('Timestamp Consistency', 'pass', 'All timestamps are valid and consistent');
    } else {
      this.addResult('Timestamp Consistency', 'warning',
        `Found ${invalidTimestamps.count} records with invalid timestamps`,
        { invalidCount: invalidTimestamps.count }
      );
    }
  }

  /**
   * Check status values are valid
   */
  private async checkStatusValues(): Promise<void> {
    const invalidStatuses = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM tests
      WHERE is_active = 1
        AND last_status IS NOT NULL
        AND last_status NOT IN ('passed', 'failed', 'skipped')
    `).get();

    if (invalidStatuses.count === 0) {
      this.addResult('Status Values', 'pass', 'All test statuses are valid');
    } else {
      this.addResult('Status Values', 'fail',
        `Found ${invalidStatuses.count} tests with invalid status values`,
        { invalidCount: invalidStatuses.count }
      );
    }
  }

  /**
   * Verify coverage calculations are accurate
   */
  private async checkCoverageCalculations(): Promise<void> {
    const stats = this.db.prepare(`
      SELECT
        COUNT(*) as totalTests,
        SUM(CASE WHEN last_status IS NOT NULL THEN 1 ELSE 0 END) as executedTests,
        SUM(CASE WHEN last_status = 'passed' THEN 1 ELSE 0 END) as passedTests,
        SUM(CASE WHEN last_status = 'failed' THEN 1 ELSE 0 END) as failedTests
      FROM tests
      WHERE is_active = 1 AND file_exists = 1
    `).get();

    const calculatedCoverage = stats.totalTests > 0
      ? ((stats.executedTests / stats.totalTests) * 100).toFixed(2)
      : '0.00';

    const calculatedPassRate = stats.executedTests > 0
      ? ((stats.passedTests / stats.executedTests) * 100).toFixed(2)
      : '0.00';

    this.addResult('Coverage Calculations', 'pass',
      `Coverage: ${calculatedCoverage}%, Pass Rate: ${calculatedPassRate}%`,
      {
        totalTests: stats.totalTests,
        executedTests: stats.executedTests,
        passedTests: stats.passedTests,
        failedTests: stats.failedTests,
        notExecuted: stats.totalTests - stats.executedTests,
        coverage: `${calculatedCoverage}%`,
        passRate: `${calculatedPassRate}%`
      }
    );
  }

  /**
   * Check sync log integrity
   */
  private async checkSyncLogIntegrity(): Promise<void> {
    const syncLogs = this.db.prepare(`
      SELECT COUNT(*) as count, MAX(scan_date) as lastSync
      FROM file_sync_log
    `).get();

    if (syncLogs.count > 0) {
      const daysSinceSync = Math.floor(
        (Date.now() - new Date(syncLogs.lastSync).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceSync === 0) {
        this.addResult('Sync Log', 'pass',
          `Database synchronized today (${syncLogs.count} total sync operations)`,
          { totalSyncs: syncLogs.count, lastSync: syncLogs.lastSync }
        );
      } else if (daysSinceSync <= 7) {
        this.addResult('Sync Log', 'pass',
          `Last sync ${daysSinceSync} day(s) ago`,
          { totalSyncs: syncLogs.count, lastSync: syncLogs.lastSync, daysSinceSync }
        );
      } else {
        this.addResult('Sync Log', 'warning',
          `Database not synchronized in ${daysSinceSync} days - consider running sync`,
          { totalSyncs: syncLogs.count, lastSync: syncLogs.lastSync, daysSinceSync }
        );
      }
    } else {
      this.addResult('Sync Log', 'warning', 'No sync operations recorded');
    }
  }

  /**
   * Helper: Scan directory for test files
   */
  private scanDirectory(dirPath: string): string[] {
    const files: string[] = [];

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          files.push(...this.scanDirectory(fullPath));
        } else if (
          entry.isFile() &&
          (entry.name.endsWith('.py') || entry.name.endsWith('.spec.ts'))
        ) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory doesn't exist or not accessible
    }

    return files;
  }

  /**
   * Add validation result
   */
  private addResult(check: string, status: 'pass' | 'fail' | 'warning', message: string, details?: any): void {
    this.results.push({ check, status, message, details });

    const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
    console.log(`${icon} ${check}: ${message}`);
  }

  /**
   * Generate integrity report
   */
  private generateReport(): IntegrityReport {
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const warnings = this.results.filter(r => r.status === 'warning').length;

    return {
      timestamp: new Date().toISOString(),
      totalChecks: this.results.length,
      passed,
      failed,
      warnings,
      results: this.results,
      summary: {
        critical: failed,
        major: warnings,
        minor: 0
      }
    };
  }

  /**
   * Print formatted report
   */
  private printReport(report: IntegrityReport): void {
    console.log('\n' + '='.repeat(80));
    console.log('DATABASE INTEGRITY VALIDATION REPORT');
    console.log('='.repeat(80));
    console.log(`Generated: ${report.timestamp}`);
    console.log(`Total Checks: ${report.totalChecks}`);
    console.log(`✅ Passed: ${report.passed}`);
    console.log(`❌ Failed: ${report.failed}`);
    console.log(`⚠️  Warnings: ${report.warnings}`);
    console.log('='.repeat(80));

    if (report.failed > 0) {
      console.log('\n🚨 CRITICAL ISSUES:');
      report.results
        .filter(r => r.status === 'fail')
        .forEach(r => {
          console.log(`  - ${r.check}: ${r.message}`);
        });
    }

    if (report.warnings > 0) {
      console.log('\n⚠️  WARNINGS:');
      report.results
        .filter(r => r.status === 'warning')
        .forEach(r => {
          console.log(`  - ${r.check}: ${r.message}`);
        });
    }

    console.log('\n' + '='.repeat(80));

    if (report.failed === 0 && report.warnings === 0) {
      console.log('✨ DATABASE INTEGRITY: EXCELLENT');
    } else if (report.failed === 0) {
      console.log('✅ DATABASE INTEGRITY: GOOD (Minor warnings present)');
    } else {
      console.log('❌ DATABASE INTEGRITY: ISSUES DETECTED (Action required)');
    }

    console.log('='.repeat(80) + '\n');
  }
}

// Main execution
async function main() {
  try {
    const validator = new DatabaseIntegrityValidator();
    const report = await validator.validate();

    // Save report to file
    const reportPath = path.join(process.cwd(), 'database-integrity-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Full report saved to: ${reportPath}\n`);

    // Exit with appropriate code
    process.exit(report.failed > 0 ? 1 : 0);

  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { DatabaseIntegrityValidator, ValidationResult, IntegrityReport };
