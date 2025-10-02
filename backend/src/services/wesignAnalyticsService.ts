/**
 * WeSign Analytics Service
 * Provides metrics and insights for WeSign test execution
 */

import { getDatabase } from '../database/database';
import Database from 'better-sqlite3';
import { logger } from '../utils/logger';

export interface ExecutionMetrics {
  totalExecutions: number;
  successRate: number;
  averageDuration: number;
  mostFailedTests: Array<{
    testId: string;
    testName: string;
    failureCount: number;
    failureRate: number;
  }>;
  performanceMetrics: {
    avgTestDuration: number;
    slowestTests: Array<{
      testId: string;
      avgDuration: number;
    }>;
  };
  resourceUtilization: {
    avgMemoryUsage: number;
    avgCpuUsage: number;
    peakUsage: {
      memory: number;
      cpu: number;
    };
  };
}

export interface TestInsights {
  flakiness: Array<{
    testId: string;
    testName: string;
    flakinessScore: number;
    recommendations: string[];
  }>;
  coverage: Array<{
    module: string;
    coverage: number;
    untested: string[];
  }>;
  performance: Array<{
    testId: string;
    trend: 'improving' | 'degrading' | 'stable';
    avgDuration: number;
    percentile95: number;
  }>;
}

export interface AnalyticsOptions {
  timeRange?: {
    start: string;
    end: string;
  };
  module?: string;
  limit?: number;
}

export class WeSignAnalyticsService {
  private db: Database.Database;

  constructor() {
    const database = getDatabase();
    this.db = (database as any).db;
  }

  /**
   * Get execution metrics with optional filters
   */
  async getMetrics(options: AnalyticsOptions = {}): Promise<ExecutionMetrics> {
    try {
      logger.info('WeSignAnalyticsService: Generating execution metrics', { options });

      const { timeRange, module, limit = 10 } = options;

      // Build time range filter
      let timeFilter = '';
      const params: any[] = [];

      if (timeRange) {
        timeFilter = 'AND created_at BETWEEN ? AND ?';
        params.push(timeRange.start, timeRange.end);
      }

      // Get total executions
      const totalExecutions = this.getTotalExecutions(timeFilter, params);

      // Get success rate
      const successRate = this.getSuccessRate(timeFilter, params);

      // Get average duration
      const averageDuration = this.getAverageDuration(timeFilter, params);

      // Get most failed tests
      const mostFailedTests = this.getMostFailedTests(limit, timeFilter, params);

      // Get performance metrics
      const performanceMetrics = this.getPerformanceMetrics(limit, timeFilter, params);

      // Get resource utilization (simulated for now)
      const resourceUtilization = this.getResourceUtilization();

      const metrics: ExecutionMetrics = {
        totalExecutions,
        successRate,
        averageDuration,
        mostFailedTests,
        performanceMetrics,
        resourceUtilization
      };

      logger.info('WeSignAnalyticsService: Metrics generated successfully', {
        totalExecutions,
        successRate: `${successRate.toFixed(2)}%`
      });

      return metrics;

    } catch (error) {
      logger.error('WeSignAnalyticsService: Failed to generate metrics', { error });
      throw error;
    }
  }

  /**
   * Get test insights including flakiness, coverage, and performance trends
   */
  async getInsights(options: AnalyticsOptions = {}): Promise<TestInsights> {
    try {
      logger.info('WeSignAnalyticsService: Generating test insights', { options });

      const { limit = 10 } = options;

      // Get flaky tests
      const flakiness = this.getFlakyTests(limit);

      // Get coverage by module
      const coverage = this.getCoverageByModule();

      // Get performance trends
      const performance = this.getPerformanceTrends(limit);

      const insights: TestInsights = {
        flakiness,
        coverage,
        performance
      };

      logger.info('WeSignAnalyticsService: Insights generated successfully', {
        flakyTestsFound: flakiness.length,
        modulesAnalyzed: coverage.length
      });

      return insights;

    } catch (error) {
      logger.error('WeSignAnalyticsService: Failed to generate insights', { error });
      throw error;
    }
  }

  // ===== PRIVATE HELPER METHODS =====

  private getTotalExecutions(timeFilter: string, params: any[]): number {
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM schedule_runs
        WHERE 1=1 ${timeFilter}
      `;

      const result = this.db.prepare(query).get(...params) as { count: number } | undefined;
      return result?.count || 0;
    } catch (error) {
      logger.warn('Failed to get total executions, returning 0', { error });
      return 0;
    }
  }

  private getSuccessRate(timeFilter: string, params: any[]): number {
    try {
      const query = `
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as passed
        FROM schedule_runs
        WHERE 1=1 ${timeFilter}
      `;

      const result = this.db.prepare(query).get(...params) as { total: number; passed: number } | undefined;

      if (!result || result.total === 0) {
        return 0;
      }

      return (result.passed / result.total) * 100;
    } catch (error) {
      logger.warn('Failed to calculate success rate, returning 0', { error });
      return 0;
    }
  }

  private getAverageDuration(timeFilter: string, params: any[]): number {
    try {
      const query = `
        SELECT AVG(duration_ms) as avg_duration
        FROM schedule_runs
        WHERE duration_ms IS NOT NULL ${timeFilter}
      `;

      const result = this.db.prepare(query).get(...params) as { avg_duration: number | null } | undefined;
      return result?.avg_duration || 0;
    } catch (error) {
      logger.warn('Failed to calculate average duration, returning 0', { error });
      return 0;
    }
  }

  private getMostFailedTests(limit: number, timeFilter: string, params: any[]): ExecutionMetrics['mostFailedTests'] {
    try {
      const query = `
        SELECT
          id as testId,
          test_name as testName,
          SUM(CASE WHEN last_status = 'failed' THEN 1 ELSE 0 END) as failureCount,
          COUNT(*) as totalRuns
        FROM tests
        WHERE 1=1 ${timeFilter}
        GROUP BY id, test_name
        HAVING failureCount > 0
        ORDER BY failureCount DESC
        LIMIT ?
      `;

      const results = this.db.prepare(query).all(...params, limit) as Array<{
        testId: string;
        testName: string;
        failureCount: number;
        totalRuns: number;
      }>;

      return results.map(r => ({
        testId: r.testId,
        testName: r.testName,
        failureCount: r.failureCount,
        failureRate: (r.failureCount / r.totalRuns) * 100
      }));
    } catch (error) {
      logger.warn('Failed to get most failed tests, returning empty array', { error });
      return [];
    }
  }

  private getPerformanceMetrics(limit: number, timeFilter: string, params: any[]): ExecutionMetrics['performanceMetrics'] {
    try {
      // Average test duration
      const avgQuery = `
        SELECT AVG(last_duration) as avg_duration
        FROM tests
        WHERE last_duration IS NOT NULL ${timeFilter}
      `;

      const avgResult = this.db.prepare(avgQuery).get(...params) as { avg_duration: number | null } | undefined;
      const avgTestDuration = avgResult?.avg_duration || 0;

      // Slowest tests
      const slowestQuery = `
        SELECT
          id as testId,
          AVG(last_duration) as avgDuration
        FROM tests
        WHERE last_duration IS NOT NULL ${timeFilter}
        GROUP BY id
        ORDER BY avgDuration DESC
        LIMIT ?
      `;

      const slowestTests = this.db.prepare(slowestQuery).all(...params, limit) as Array<{
        testId: string;
        avgDuration: number;
      }>;

      return {
        avgTestDuration,
        slowestTests
      };
    } catch (error) {
      logger.warn('Failed to get performance metrics, returning defaults', { error });
      return {
        avgTestDuration: 0,
        slowestTests: []
      };
    }
  }

  private getResourceUtilization(): ExecutionMetrics['resourceUtilization'] {
    // Simulated resource metrics - in production, collect from actual execution environment
    return {
      avgMemoryUsage: 512, // MB
      avgCpuUsage: 45, // %
      peakUsage: {
        memory: 1024, // MB
        cpu: 85 // %
      }
    };
  }

  private getFlakyTests(limit: number): TestInsights['flakiness'] {
    try {
      // Flaky tests are those with inconsistent pass/fail patterns
      // For now, we'll identify tests with failure rates between 10-90%
      const query = `
        SELECT
          id as testId,
          test_name as testName,
          SUM(CASE WHEN last_status = 'failed' THEN 1 ELSE 0 END) as failures,
          COUNT(*) as totalRuns
        FROM tests
        GROUP BY id, test_name
        HAVING totalRuns >= 3 AND failures > 0
        ORDER BY (CAST(failures AS REAL) / totalRuns) DESC
        LIMIT ?
      `;

      const results = this.db.prepare(query).all(limit) as Array<{
        testId: string;
        testName: string;
        failures: number;
        totalRuns: number;
      }>;

      return results.map(r => {
        const failureRate = r.failures / r.totalRuns;
        const flakinessScore = failureRate > 0.1 && failureRate < 0.9 ? failureRate : 0;

        return {
          testId: r.testId,
          testName: r.testName,
          flakinessScore,
          recommendations: this.generateFlakinessRecommendations(flakinessScore)
        };
      }).filter(t => t.flakinessScore > 0);
    } catch (error) {
      logger.warn('Failed to get flaky tests, returning empty array', { error });
      return [];
    }
  }

  private generateFlakinessRecommendations(flakinessScore: number): string[] {
    const recommendations: string[] = [];

    if (flakinessScore > 0.3) {
      recommendations.push('Consider adding explicit waits or increasing timeout values');
      recommendations.push('Check for race conditions in the test logic');
      recommendations.push('Verify test data setup and cleanup procedures');
    }

    if (flakinessScore > 0.5) {
      recommendations.push('Review for external dependencies that may cause instability');
      recommendations.push('Consider splitting into multiple smaller, focused tests');
    }

    if (flakinessScore > 0.7) {
      recommendations.push('URGENT: Test is highly unreliable and should be rewritten');
    }

    return recommendations;
  }

  private getCoverageByModule(): TestInsights['coverage'] {
    try {
      const query = `
        SELECT
          category as module,
          COUNT(*) as totalTests,
          SUM(CASE WHEN last_status = 'passed' THEN 1 ELSE 0 END) as passedTests
        FROM tests
        WHERE is_active = 1
        GROUP BY category
      `;

      const results = this.db.prepare(query).all() as Array<{
        module: string;
        totalTests: number;
        passedTests: number;
      }>;

      return results.map(r => ({
        module: r.module,
        coverage: r.totalTests > 0 ? (r.passedTests / r.totalTests) * 100 : 0,
        untested: [] // TODO: Track untested features from requirements
      }));
    } catch (error) {
      logger.warn('Failed to get coverage by module, returning empty array', { error });
      return [];
    }
  }

  private getPerformanceTrends(limit: number): TestInsights['performance'] {
    try {
      // Analyze duration trends over time
      // For now, return tests with stable performance
      const query = `
        SELECT
          id as testId,
          AVG(last_duration) as avgDuration,
          MAX(last_duration) as maxDuration,
          MIN(last_duration) as minDuration
        FROM tests
        WHERE last_duration IS NOT NULL
        GROUP BY id
        ORDER BY avgDuration DESC
        LIMIT ?
      `;

      const results = this.db.prepare(query).all(limit) as Array<{
        testId: string;
        avgDuration: number;
        maxDuration: number;
        minDuration: number;
      }>;

      return results.map(r => {
        // Calculate percentile 95 (approximation using max duration)
        const percentile95 = r.avgDuration + ((r.maxDuration - r.avgDuration) * 0.95);

        // Determine trend based on variance
        const variance = r.maxDuration - r.minDuration;
        const varianceRatio = variance / r.avgDuration;

        let trend: 'improving' | 'degrading' | 'stable' = 'stable';
        if (varianceRatio > 0.3) {
          // High variance might indicate degrading performance
          trend = 'degrading';
        } else if (varianceRatio < 0.1) {
          // Low variance indicates stable performance
          trend = 'stable';
        }

        return {
          testId: r.testId,
          trend,
          avgDuration: r.avgDuration,
          percentile95
        };
      });
    } catch (error) {
      logger.warn('Failed to get performance trends, returning empty array', { error });
      return [];
    }
  }

  /**
   * Get quick stats for dashboard
   */
  async getQuickStats(): Promise<{
    totalTests: number;
    totalExecutions: number;
    successRate: number;
    avgDuration: number;
  }> {
    try {
      // Get total active tests
      const totalTests = this.db.prepare('SELECT COUNT(*) as count FROM tests WHERE is_active = 1').get() as { count: number };

      // Get total executions
      const totalExecutions = this.getTotalExecutions('', []);

      // Get success rate
      const successRate = this.getSuccessRate('', []);

      // Get average duration
      const avgDuration = this.getAverageDuration('', []);

      return {
        totalTests: totalTests.count,
        totalExecutions,
        successRate,
        avgDuration
      };
    } catch (error) {
      logger.error('Failed to get quick stats', { error });
      return {
        totalTests: 0,
        totalExecutions: 0,
        successRate: 0,
        avgDuration: 0
      };
    }
  }
}

// Export singleton instance
export const wesignAnalyticsService = new WeSignAnalyticsService();
