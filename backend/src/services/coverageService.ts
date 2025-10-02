/**
 * Coverage Service
 * Calculates test coverage based on REAL file system data and execution history
 */

import { getDatabase } from '../database/database';
import Database from 'better-sqlite3';
import { logger } from '../utils/logger';

export interface CoverageMetrics {
  totalTests: number; // Total tests from file system
  executedTests: number; // Tests that have been executed at least once
  notExecuted: number; // Tests never executed
  passedTests: number; // Tests that passed in latest execution
  failedTests: number; // Tests that failed in latest execution
  fileBasedCoverage: number; // Percentage of tests executed (executedTests / totalTests)
  passRate: number; // Percentage of executed tests that passed
  overallCoverage: string; // Combined metric for display
}

export interface ModuleCoverage {
  module: string;
  totalTests: number;
  executedTests: number;
  passedTests: number;
  failedTests: number;
  coverage: number; // Percentage executed
  passRate: number; // Percentage of executed that passed
}

export class CoverageService {
  private db: Database.Database;

  constructor() {
    const database = getDatabase();
    this.db = (database as any).db;
  }

  /**
   * Calculate coverage metrics based on file system and execution history
   */
  async getCoverageMetrics(): Promise<CoverageMetrics> {
    try {
      logger.info('CoverageService: Calculating coverage metrics from real data');

      // Get total tests from database (synced with file system)
      const totalTestsQuery = `
        SELECT COUNT(*) as count
        FROM tests
        WHERE is_active = 1 AND file_exists = 1
      `;
      const totalTestsResult = this.db.prepare(totalTestsQuery).get() as { count: number };
      const totalTests = totalTestsResult.count;

      // Get tests that have been executed at least once
      // (tests with last_status not null)
      const executedTestsQuery = `
        SELECT COUNT(*) as count
        FROM tests
        WHERE is_active = 1 AND file_exists = 1 AND last_status IS NOT NULL
      `;
      const executedTestsResult = this.db.prepare(executedTestsQuery).get() as { count: number };
      const executedTests = executedTestsResult.count;

      // Get tests that passed in their latest execution
      const passedTestsQuery = `
        SELECT COUNT(*) as count
        FROM tests
        WHERE is_active = 1 AND file_exists = 1 AND last_status = 'passed'
      `;
      const passedTestsResult = this.db.prepare(passedTestsQuery).get() as { count: number };
      const passedTests = passedTestsResult.count;

      // Get tests that failed in their latest execution
      const failedTestsQuery = `
        SELECT COUNT(*) as count
        FROM tests
        WHERE is_active = 1 AND file_exists = 1 AND last_status = 'failed'
      `;
      const failedTestsResult = this.db.prepare(failedTestsQuery).get() as { count: number };
      const failedTests = failedTestsResult.count;

      // Calculate not executed
      const notExecuted = totalTests - executedTests;

      // Calculate file-based coverage (what percentage of tests have been run)
      const fileBasedCoverage = totalTests > 0 ? (executedTests / totalTests) * 100 : 0;

      // Calculate pass rate (of tests that were executed, what percentage passed)
      const passRate = executedTests > 0 ? (passedTests / executedTests) * 100 : 0;

      // Overall coverage combines both metrics
      const overallCoverage = totalTests > 0
        ? ((passedTests / totalTests) * 100).toFixed(1)
        : '0.0';

      const metrics: CoverageMetrics = {
        totalTests,
        executedTests,
        notExecuted,
        passedTests,
        failedTests,
        fileBasedCoverage: parseFloat(fileBasedCoverage.toFixed(2)),
        passRate: parseFloat(passRate.toFixed(2)),
        overallCoverage
      };

      logger.info('CoverageService: Coverage metrics calculated', {
        totalTests,
        executedTests,
        passedTests,
        fileBasedCoverage: `${fileBasedCoverage.toFixed(2)}%`,
        passRate: `${passRate.toFixed(2)}%`
      });

      return metrics;

    } catch (error) {
      logger.error('CoverageService: Failed to calculate coverage metrics', { error });

      // Return safe defaults
      return {
        totalTests: 0,
        executedTests: 0,
        notExecuted: 0,
        passedTests: 0,
        failedTests: 0,
        fileBasedCoverage: 0,
        passRate: 0,
        overallCoverage: '0.0'
      };
    }
  }

  /**
   * Get coverage breakdown by module/category
   */
  async getCoverageByModule(): Promise<ModuleCoverage[]> {
    try {
      logger.info('CoverageService: Calculating coverage by module');

      const query = `
        SELECT
          category as module,
          COUNT(*) as totalTests,
          SUM(CASE WHEN last_status IS NOT NULL THEN 1 ELSE 0 END) as executedTests,
          SUM(CASE WHEN last_status = 'passed' THEN 1 ELSE 0 END) as passedTests,
          SUM(CASE WHEN last_status = 'failed' THEN 1 ELSE 0 END) as failedTests
        FROM tests
        WHERE is_active = 1 AND file_exists = 1
        GROUP BY category
        ORDER BY totalTests DESC
      `;

      const results = this.db.prepare(query).all() as Array<{
        module: string;
        totalTests: number;
        executedTests: number;
        passedTests: number;
        failedTests: number;
      }>;

      const moduleCoverage: ModuleCoverage[] = results.map(r => ({
        module: r.module,
        totalTests: r.totalTests,
        executedTests: r.executedTests,
        passedTests: r.passedTests,
        failedTests: r.failedTests,
        coverage: r.totalTests > 0 ? parseFloat(((r.executedTests / r.totalTests) * 100).toFixed(2)) : 0,
        passRate: r.executedTests > 0 ? parseFloat(((r.passedTests / r.executedTests) * 100).toFixed(2)) : 0
      }));

      logger.info('CoverageService: Module coverage calculated', {
        modules: moduleCoverage.length,
        totalTests: moduleCoverage.reduce((sum, m) => sum + m.totalTests, 0)
      });

      return moduleCoverage;

    } catch (error) {
      logger.error('CoverageService: Failed to calculate module coverage', { error });
      return [];
    }
  }

  /**
   * Get coverage by source directory
   */
  async getCoverageBySource(): Promise<Array<{
    source: string;
    totalTests: number;
    executedTests: number;
    passedTests: number;
    coverage: number;
    passRate: number;
  }>> {
    try {
      const query = `
        SELECT
          COALESCE(source_directory, 'unknown') as source,
          COUNT(*) as totalTests,
          SUM(CASE WHEN last_status IS NOT NULL THEN 1 ELSE 0 END) as executedTests,
          SUM(CASE WHEN last_status = 'passed' THEN 1 ELSE 0 END) as passedTests
        FROM tests
        WHERE is_active = 1 AND file_exists = 1
        GROUP BY source_directory
        ORDER BY totalTests DESC
      `;

      const results = this.db.prepare(query).all() as Array<{
        source: string;
        totalTests: number;
        executedTests: number;
        passedTests: number;
      }>;

      return results.map(r => ({
        source: r.source,
        totalTests: r.totalTests,
        executedTests: r.executedTests,
        passedTests: r.passedTests,
        coverage: r.totalTests > 0 ? parseFloat(((r.executedTests / r.totalTests) * 100).toFixed(2)) : 0,
        passRate: r.executedTests > 0 ? parseFloat(((r.passedTests / r.executedTests) * 100).toFixed(2)) : 0
      }));

    } catch (error) {
      logger.error('CoverageService: Failed to calculate source coverage', { error });
      return [];
    }
  }

  /**
   * Get tests that have never been executed
   */
  async getUntested Tests(): Promise<Array<{
    id: string;
    testName: string;
    category: string;
    filePath: string;
  }>> {
    try {
      const query = `
        SELECT
          id,
          test_name as testName,
          category,
          file_path as filePath
        FROM tests
        WHERE is_active = 1 AND file_exists = 1 AND last_status IS NULL
        ORDER BY category, test_name
        LIMIT 100
      `;

      return this.db.prepare(query).all() as Array<{
        id: string;
        testName: string;
        category: string;
        filePath: string;
      }>;

    } catch (error) {
      logger.error('CoverageService: Failed to get untested tests', { error });
      return [];
    }
  }

  /**
   * Get coverage trend over time
   */
  async getCoverageTrend(days: number = 30): Promise<Array<{
    date: string;
    coverage: number;
    passRate: number;
  }>> {
    try {
      // This would require execution history table
      // For now, return current metrics as single point
      const current = await this.getCoverageMetrics();

      return [{
        date: new Date().toISOString().split('T')[0],
        coverage: current.fileBasedCoverage,
        passRate: current.passRate
      }];

    } catch (error) {
      logger.error('CoverageService: Failed to get coverage trend', { error });
      return [];
    }
  }

  /**
   * Update test status after execution
   * This should be called by the execution service
   */
  async updateTestStatus(testId: string, status: 'passed' | 'failed' | 'skipped', duration?: number): Promise<void> {
    try {
      const updateQuery = `
        UPDATE tests
        SET last_status = ?,
            last_duration = ?,
            updated_at = datetime('now', 'utc'),
            last_file_check = datetime('now', 'utc')
        WHERE id = ?
      `;

      this.db.prepare(updateQuery).run(status, duration || null, testId);

      logger.debug('CoverageService: Test status updated', { testId, status, duration });

    } catch (error) {
      logger.error('CoverageService: Failed to update test status', { testId, status, error });
    }
  }

  /**
   * Bulk update test statuses
   */
  async bulkUpdateTestStatuses(updates: Array<{
    testId: string;
    status: 'passed' | 'failed' | 'skipped';
    duration?: number;
  }>): Promise<void> {
    try {
      const updateQuery = `
        UPDATE tests
        SET last_status = ?,
            last_duration = ?,
            updated_at = datetime('now', 'utc')
        WHERE id = ?
      `;

      const stmt = this.db.prepare(updateQuery);

      const transaction = this.db.transaction(() => {
        for (const update of updates) {
          stmt.run(update.status, update.duration || null, update.testId);
        }
      });

      transaction();

      logger.info('CoverageService: Bulk test status update completed', { count: updates.length });

    } catch (error) {
      logger.error('CoverageService: Failed to bulk update test statuses', { error });
    }
  }
}

// Export singleton instance
export const coverageService = new CoverageService();
