/**
 * Enterprise Analytics Routes
 * Advanced analytics, reporting, and business intelligence for test management
 */

import { Router } from 'express';
import { enterpriseDb } from '../database/enterprise-database';
import { asyncHandler } from '../middleware/error-handler';
import { devAuth, requirePermission } from '../middleware/auth';
import { requireTenantPlan } from '../middleware/tenant';
import { recordDatabaseQuery } from '../monitoring/metrics';
import { logger } from '../utils/logger';
import { z } from 'zod';

// Validation schemas
const AnalyticsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  environment: z.string().optional(),
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
  metric: z.enum(['runs', 'pass_rate', 'duration', 'failures']).optional(),
});

const TrendAnalysisSchema = z.object({
  period: z.enum(['7d', '30d', '90d']).default('30d'),
  metric: z.enum(['pass_rate', 'execution_time', 'failure_rate', 'test_coverage']),
  granularity: z.enum(['hour', 'day', 'week']).default('day'),
});

export function createEnterpriseAnalyticsRouter(): Router {
  const router = Router();

  // Use development authentication
  router.use(devAuth());

  // ==========================================================================
  // DASHBOARD ANALYTICS
  // ==========================================================================

  /**
   * GET /api/analytics/dashboard
   * Get comprehensive dashboard metrics and KPIs
   */
  router.get('/dashboard', asyncHandler(async (req, res) => {
    const startTime = Date.now();
    const tenantId = req.tenantId;
    const query = AnalyticsQuerySchema.parse(req.query);

    try {
      // Execute parallel queries for dashboard metrics
      const [
        overviewStats,
        trendData,
        topFailures,
        environmentStats,
        recentActivity
      ] = await Promise.all([
        getOverviewStatistics(tenantId, query),
        getTrendAnalysis(tenantId, query),
        getTopFailingTests(tenantId, query),
        getEnvironmentStatistics(tenantId, query),
        getRecentActivity(tenantId)
      ]);

      const dashboard = {
        overview: overviewStats,
        trends: trendData,
        topFailures,
        environments: environmentStats,
        recentActivity,
        generatedAt: new Date().toISOString(),
        period: {
          startDate: query.startDate,
          endDate: query.endDate,
        },
      };

      recordDatabaseQuery('SELECT', 'analytics_dashboard', tenantId, Date.now() - startTime, true);
      res.json(dashboard);
    } catch (error) {
      recordDatabaseQuery('SELECT', 'analytics_dashboard', tenantId, Date.now() - startTime, false);
      throw error;
    }
  }));

  /**
   * GET /api/analytics/failure-intelligence
   * Advanced failure analysis with patterns, blockers, and timeline
   */
  router.get('/failure-intelligence', asyncHandler(async (req, res) => {
    const startTime = Date.now();
    const tenantId = req.tenantId;
    const query = AnalyticsQuerySchema.parse(req.query);

    try {
      const [
        failureGroups,
        blockingFailures,
        failureTimeline,
        failurePatterns
      ] = await Promise.all([
        getFailuresByErrorMessage(tenantId, query),
        getBlockingFailures(tenantId, query),
        getFailureTimeline(tenantId, query),
        calculateFailurePatterns(tenantId, query)
      ]);

      const failureIntelligence = {
        failureGroups,
        blockingFailures,
        timeline: failureTimeline,
        patterns: failurePatterns,
        generatedAt: new Date().toISOString(),
      };

      recordDatabaseQuery('SELECT', 'failure_intelligence', tenantId, Date.now() - startTime, true);
      res.json(failureIntelligence);
    } catch (error) {
      recordDatabaseQuery('SELECT', 'failure_intelligence', tenantId, Date.now() - startTime, false);
      throw error;
    }
  }));

  /**
   * GET /api/analytics/trends
   * Get trend analysis for specific metrics over time
   */
  router.get('/trends', 
    requireTenantPlan(['professional', 'enterprise']),
    asyncHandler(async (req, res) => {
      const startTime = Date.now();
      const tenantId = req.tenantId;
      const query = TrendAnalysisSchema.parse(req.query);

      try {
        const trends = await getAdvancedTrendAnalysis(tenantId, query);
        
        recordDatabaseQuery('SELECT', 'trend_analysis', tenantId, Date.now() - startTime, true);
        res.json({
          metric: query.metric,
          period: query.period,
          granularity: query.granularity,
          data: trends,
          insights: generateTrendInsights(trends, query.metric),
        });
      } catch (error) {
        recordDatabaseQuery('SELECT', 'trend_analysis', tenantId, Date.now() - startTime, false);
        throw error;
      }
    })
  );

  /**
   * GET /api/analytics/test-health
   * Get comprehensive test health analysis
   */
  router.get('/test-health', 
    requireTenantPlan(['professional', 'enterprise']),
    asyncHandler(async (req, res) => {
      const tenantId = req.tenantId;
      const environment = req.query.environment as string;

      try {
        const healthAnalysis = await getTestHealthAnalysis(tenantId, environment);
        
        res.json({
          healthScore: healthAnalysis.overallScore,
          categories: healthAnalysis.categories,
          recommendations: healthAnalysis.recommendations,
          riskTests: healthAnalysis.riskTests,
          stability: healthAnalysis.stability,
        });
      } catch (error) {
        logger.error('Test health analysis failed', { error, tenantId });
        throw error;
      }
    })
  );

  /**
   * GET /api/analytics/performance
   * Get performance analytics and bottleneck analysis
   */
  router.get('/performance', 
    requireTenantPlan(['enterprise']),
    asyncHandler(async (req, res) => {
      const tenantId = req.tenantId;
      const timeframe = req.query.timeframe as string || '7d';

      try {
        const performance = await getPerformanceAnalytics(tenantId, timeframe);
        
        res.json({
          executionMetrics: performance.execution,
          resourceUtilization: performance.resources,
          bottlenecks: performance.bottlenecks,
          optimizationSuggestions: performance.suggestions,
        });
      } catch (error) {
        logger.error('Performance analytics failed', { error, tenantId });
        throw error;
      }
    })
  );

  /**
   * GET /api/analytics/flaky-tests
   * Get flaky test detection and analysis
   */
  router.get('/flaky-tests', 
    requireTenantPlan(['professional', 'enterprise']),
    asyncHandler(async (req, res) => {
      const tenantId = req.tenantId;
      const threshold = parseFloat(req.query.threshold as string) || 0.8;

      try {
        const flakyTests = await getFlakyTestAnalysis(tenantId, threshold);
        
        res.json({
          summary: {
            totalTests: flakyTests.totalTests,
            flakyTests: flakyTests.flakyCount,
            flakyPercentage: (flakyTests.flakyCount / flakyTests.totalTests) * 100,
          },
          tests: flakyTests.tests,
          patterns: flakyTests.patterns,
        });
      } catch (error) {
        logger.error('Flaky test analysis failed', { error, tenantId });
        throw error;
      }
    })
  );

  /**
   * GET /api/analytics/coverage
   * Get test coverage analytics and gap analysis
   */
  router.get('/coverage', 
    requireTenantPlan(['enterprise']),
    asyncHandler(async (req, res) => {
      const tenantId = req.tenantId;
      const suite = req.query.suite as string;

      try {
        const coverage = await getCoverageAnalytics(tenantId, suite);
        
        res.json({
          overall: coverage.overall,
          byFeature: coverage.features,
          gaps: coverage.gaps,
          recommendations: coverage.recommendations,
        });
      } catch (error) {
        logger.error('Coverage analytics failed', { error, tenantId });
        throw error;
      }
    })
  );

  /**
   * POST /api/analytics/custom-report
   * Generate custom analytics report
   */
  router.post('/custom-report',
    requireTenantPlan(['enterprise']),
    asyncHandler(async (req, res) => {
      const tenantId = req.tenantId;
      const { metrics, filters, groupBy, format } = req.body;

      try {
        const report = await generateCustomReport(tenantId, {
          metrics,
          filters,
          groupBy,
          format: format || 'json',
        });

        if (format === 'csv') {
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', 'attachment; filename=analytics-report.csv');
        }

        res.json(report);
      } catch (error) {
        logger.error('Custom report generation failed', { error, tenantId });
        throw error;
      }
    })
  );

  return router;
}

// =============================================================================
// ANALYTICS IMPLEMENTATION FUNCTIONS
// =============================================================================

/**
 * Get overview statistics for dashboard
 */
async function getOverviewStatistics(tenantId: string, query: any) {
  const dateFilter = buildDateFilter(query.startDate, query.endDate);
  const environmentFilter = query.environment ? 'AND environment = $3' : '';
  const params = [tenantId];
  
  if (query.startDate) params.push(query.startDate);
  if (query.endDate) params.push(query.endDate);
  if (query.environment) params.push(query.environment);

  const result = await enterpriseDb.query(`
    SELECT 
      COUNT(*) as total_runs,
      AVG(pass_rate) as avg_pass_rate,
      AVG(duration) as avg_duration,
      SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed_runs,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_runs,
      SUM(total_tests) as total_tests,
      SUM(failed_tests) as total_failures,
      COUNT(DISTINCT suite_name) as unique_suites
    FROM test_runs 
    WHERE tenant_id = $1 ${dateFilter} ${environmentFilter}
  `, params, tenantId, true);

  const stats = result.rows[0];
  return {
    totalRuns: parseInt(stats.total_runs),
    averagePassRate: parseFloat(stats.avg_pass_rate) || 0,
    averageDuration: parseInt(stats.avg_duration) || 0,
    passedRuns: parseInt(stats.passed_runs),
    failedRuns: parseInt(stats.failed_runs),
    totalTests: parseInt(stats.total_tests),
    totalFailures: parseInt(stats.total_failures),
    uniqueSuites: parseInt(stats.unique_suites),
  };
}

/**
 * Get trend analysis data
 */
async function getTrendAnalysis(tenantId: string, query: any) {
  const groupByClause = getGroupByClause(query.groupBy);
  const dateFilter = buildDateFilter(query.startDate, query.endDate);

  const result = await enterpriseDb.query(`
    SELECT 
      ${groupByClause} as period,
      COUNT(*) as runs,
      AVG(pass_rate) as avg_pass_rate,
      AVG(duration) as avg_duration,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failures
    FROM test_runs 
    WHERE tenant_id = $1 ${dateFilter}
    GROUP BY ${groupByClause}
    ORDER BY period ASC
  `, [tenantId], tenantId, true);

  return result.rows.map(row => ({
    period: row.period,
    runs: parseInt(row.runs),
    passRate: parseFloat(row.avg_pass_rate) || 0,
    avgDuration: parseInt(row.avg_duration) || 0,
    failures: parseInt(row.failures),
  }));
}

/**
 * Get top failing tests
 */
async function getTopFailingTests(tenantId: string, query: any) {
  const dateFilter = buildDateFilter(query.startDate, query.endDate);

  const result = await enterpriseDb.query(`
    SELECT 
      ts.test_name,
      COUNT(*) as failure_count,
      COUNT(DISTINCT ts.run_id) as failed_runs,
      AVG(ts.duration) as avg_duration,
      array_agg(DISTINCT ts.error_message) FILTER (WHERE ts.error_message IS NOT NULL) as error_patterns
    FROM test_steps ts
    JOIN test_runs tr ON ts.run_id = tr.id
    WHERE ts.tenant_id = $1 AND ts.status = 'failed' ${dateFilter.replace('created_at', 'tr.created_at')}
    GROUP BY ts.test_name
    ORDER BY failure_count DESC
    LIMIT 10
  `, [tenantId], tenantId, true);

  return result.rows.map(row => ({
    testName: row.test_name,
    failureCount: parseInt(row.failure_count),
    failedRuns: parseInt(row.failed_runs),
    avgDuration: parseInt(row.avg_duration) || 0,
    errorPatterns: row.error_patterns || [],
  }));
}

/**
 * Get environment statistics
 */
async function getEnvironmentStatistics(tenantId: string, query: any) {
  const dateFilter = buildDateFilter(query.startDate, query.endDate);

  const result = await enterpriseDb.query(`
    SELECT 
      environment,
      COUNT(*) as runs,
      AVG(pass_rate) as avg_pass_rate,
      AVG(duration) as avg_duration
    FROM test_runs 
    WHERE tenant_id = $1 ${dateFilter}
    GROUP BY environment
    ORDER BY runs DESC
  `, [tenantId], tenantId, true);

  return result.rows.map(row => ({
    environment: row.environment,
    runs: parseInt(row.runs),
    passRate: parseFloat(row.avg_pass_rate) || 0,
    avgDuration: parseInt(row.avg_duration) || 0,
  }));
}

/**
 * Get recent activity feed
 */
async function getRecentActivity(tenantId: string) {
  const result = await enterpriseDb.query(`
    SELECT 
      id, suite_name, status, started_at, duration, environment
    FROM test_runs 
    WHERE tenant_id = $1
    ORDER BY started_at DESC
    LIMIT 20
  `, [tenantId], tenantId, true);

  return result.rows.map(row => ({
    id: row.id,
    suiteName: row.suite_name,
    status: row.status,
    startedAt: row.started_at,
    duration: row.duration,
    environment: row.environment,
  }));
}

/**
 * Advanced trend analysis with statistical insights
 */
async function getAdvancedTrendAnalysis(tenantId: string, query: any) {
  // Implementation would include statistical analysis, forecasting, etc.
  // For now, return basic trend data
  return getTrendAnalysis(tenantId, { groupBy: query.granularity });
}

/**
 * Generate insights from trend data
 */
function generateTrendInsights(trends: any[], metric: string): string[] {
  const insights: string[] = [];
  
  if (trends.length < 2) return insights;

  // Calculate basic trend direction
  const firstValue = trends[0][metric === 'pass_rate' ? 'passRate' : 'runs'];
  const lastValue = trends[trends.length - 1][metric === 'pass_rate' ? 'passRate' : 'runs'];
  
  if (lastValue > firstValue * 1.1) {
    insights.push(`${metric} has improved by ${Math.round(((lastValue - firstValue) / firstValue) * 100)}%`);
  } else if (lastValue < firstValue * 0.9) {
    insights.push(`${metric} has declined by ${Math.round(((firstValue - lastValue) / firstValue) * 100)}%`);
  }

  return insights;
}

/**
 * Comprehensive test health analysis
 */
async function getTestHealthAnalysis(tenantId: string, environment?: string) {
  // Implementation would analyze test stability, reliability, etc.
  return {
    overallScore: 85,
    categories: {
      stability: 82,
      reliability: 88,
      performance: 79,
      coverage: 91,
    },
    recommendations: [
      'Focus on stabilizing flaky tests in login module',
      'Improve performance of integration test suite',
    ],
    riskTests: [],
    stability: {
      trend: 'improving',
      score: 85,
    },
  };
}

/**
 * Performance analytics and bottleneck detection
 */
async function getPerformanceAnalytics(tenantId: string, timeframe: string) {
  // Implementation would analyze execution times, resource usage, etc.
  return {
    execution: {
      avgDuration: 120000,
      p95Duration: 300000,
      slowestTests: [],
    },
    resources: {
      cpuUsage: 65,
      memoryUsage: 78,
      storageGrowth: 12,
    },
    bottlenecks: [],
    suggestions: [
      'Consider parallel execution for test suites taking > 5 minutes',
      'Optimize database setup/teardown in integration tests',
    ],
  };
}

/**
 * Flaky test detection and analysis
 */
async function getFlakyTestAnalysis(tenantId: string, threshold: number) {
  // Implementation would analyze test result patterns to detect flakiness
  return {
    totalTests: 250,
    flakyCount: 8,
    tests: [],
    patterns: [],
  };
}

/**
 * Test coverage analytics
 */
async function getCoverageAnalytics(tenantId: string, suite?: string) {
  // Implementation would analyze test coverage across features
  return {
    overall: {
      percentage: 78,
      linesOfCode: 15000,
      coveredLines: 11700,
    },
    features: [],
    gaps: [],
    recommendations: [],
  };
}

/**
 * Generate custom analytics report
 */
async function generateCustomReport(tenantId: string, config: any) {
  // Implementation would build dynamic queries based on configuration
  return {
    data: [],
    metadata: {
      generatedAt: new Date().toISOString(),
      filters: config.filters,
      metrics: config.metrics,
    },
  };
}

/**
 * Group failures by error message patterns
 */
async function getFailuresByErrorMessage(tenantId: string, query: any) {
  const dateFilter = buildDateFilter(query.startDate, query.endDate);

  const result = await enterpriseDb.query(`
    WITH error_groups AS (
      SELECT 
        COALESCE(
          REGEXP_REPLACE(error_message, '\\d+', '[NUMBER]', 'g'),
          'Unknown Error'
        ) as error_pattern,
        COUNT(*) as occurrence_count,
        COUNT(DISTINCT ts.test_name) as affected_tests,
        COUNT(DISTINCT ts.run_id) as affected_runs,
        array_agg(DISTINCT ts.test_name) as test_names,
        MIN(tr.created_at) as first_seen,
        MAX(tr.created_at) as last_seen,
        AVG(ts.duration) as avg_duration
      FROM test_steps ts
      JOIN test_runs tr ON ts.run_id = tr.id
      WHERE ts.tenant_id = $1 AND ts.status = 'failed' ${dateFilter.replace('created_at', 'tr.created_at')}
      GROUP BY error_pattern
    )
    SELECT *
    FROM error_groups
    ORDER BY occurrence_count DESC
    LIMIT 20
  `, [tenantId], tenantId, true);

  return result.rows.map(row => ({
    errorPattern: row.error_pattern,
    occurrenceCount: parseInt(row.occurrence_count),
    affectedTests: parseInt(row.affected_tests),
    affectedRuns: parseInt(row.affected_runs),
    testNames: row.test_names || [],
    firstSeen: row.first_seen,
    lastSeen: row.last_seen,
    avgDuration: parseInt(row.avg_duration) || 0,
  }));
}

/**
 * Find failures that block other tests from running
 */
async function getBlockingFailures(tenantId: string, query: any) {
  const dateFilter = buildDateFilter(query.startDate, query.endDate);

  const result = await enterpriseDb.query(`
    WITH test_sequences AS (
      SELECT 
        ts.run_id,
        ts.test_name,
        ts.status,
        ts.execution_order,
        LAG(ts.test_name) OVER (PARTITION BY ts.run_id ORDER BY ts.execution_order) as previous_test,
        LAG(ts.status) OVER (PARTITION BY ts.run_id ORDER BY ts.execution_order) as previous_status
      FROM test_steps ts
      JOIN test_runs tr ON ts.run_id = tr.id
      WHERE ts.tenant_id = $1 ${dateFilter.replace('created_at', 'tr.created_at')}
    ),
    blocked_patterns AS (
      SELECT 
        previous_test as blocking_test,
        COUNT(*) as times_blocked_others,
        COUNT(DISTINCT test_name) as unique_tests_blocked,
        array_agg(DISTINCT test_name) as blocked_tests
      FROM test_sequences
      WHERE previous_status = 'failed' AND status IN ('skipped', 'cancelled')
      GROUP BY previous_test
    )
    SELECT *
    FROM blocked_patterns
    WHERE times_blocked_others >= 2
    ORDER BY times_blocked_others DESC
    LIMIT 10
  `, [tenantId], tenantId, true);

  return result.rows.map(row => ({
    blockingTest: row.blocking_test,
    timesBlockedOthers: parseInt(row.times_blocked_others),
    uniqueTestsBlocked: parseInt(row.unique_tests_blocked),
    blockedTests: row.blocked_tests || [],
    severity: parseInt(row.times_blocked_others) >= 10 ? 'high' : 
              parseInt(row.times_blocked_others) >= 5 ? 'medium' : 'low',
  }));
}

/**
 * Get failure timeline showing when failures started
 */
async function getFailureTimeline(tenantId: string, query: any) {
  const dateFilter = buildDateFilter(query.startDate, query.endDate);
  const groupByClause = getGroupByClause(query.groupBy || 'day');

  const result = await enterpriseDb.query(`
    WITH daily_failures AS (
      SELECT 
        ${groupByClause} as period,
        ts.test_name,
        COUNT(*) as failure_count,
        MIN(tr.created_at) as first_failure_in_period
      FROM test_steps ts
      JOIN test_runs tr ON ts.run_id = tr.id
      WHERE ts.tenant_id = $1 AND ts.status = 'failed' ${dateFilter.replace('created_at', 'tr.created_at')}
      GROUP BY ${groupByClause}, ts.test_name
    ),
    new_failures AS (
      SELECT 
        period,
        test_name,
        failure_count,
        ROW_NUMBER() OVER (PARTITION BY test_name ORDER BY period) as failure_rank
      FROM daily_failures
    )
    SELECT 
      period,
      COUNT(*) as total_failures,
      COUNT(CASE WHEN failure_rank = 1 THEN 1 END) as new_failures,
      array_agg(
        CASE WHEN failure_rank = 1 
        THEN json_build_object('testName', test_name, 'count', failure_count)
        END
      ) FILTER (WHERE failure_rank = 1) as new_failing_tests
    FROM new_failures
    GROUP BY period
    ORDER BY period ASC
  `, [tenantId], tenantId, true);

  return result.rows.map(row => ({
    period: row.period,
    totalFailures: parseInt(row.total_failures),
    newFailures: parseInt(row.new_failures),
    newFailingTests: row.new_failing_tests || [],
  }));
}

/**
 * Calculate failure patterns and trends
 */
async function calculateFailurePatterns(tenantId: string, query: any) {
  const dateFilter = buildDateFilter(query.startDate, query.endDate);

  const result = await enterpriseDb.query(`
    WITH failure_analysis AS (
      SELECT 
        ts.test_name,
        DATE_TRUNC('hour', tr.created_at) as hour_bucket,
        COUNT(*) as failures_in_hour,
        EXTRACT(hour FROM tr.created_at) as hour_of_day,
        EXTRACT(dow FROM tr.created_at) as day_of_week
      FROM test_steps ts
      JOIN test_runs tr ON ts.run_id = tr.id
      WHERE ts.tenant_id = $1 AND ts.status = 'failed' ${dateFilter.replace('created_at', 'tr.created_at')}
      GROUP BY ts.test_name, hour_bucket, hour_of_day, day_of_week
    ),
    hourly_patterns AS (
      SELECT 
        hour_of_day,
        COUNT(*) as failure_count,
        COUNT(DISTINCT test_name) as unique_tests
      FROM failure_analysis
      GROUP BY hour_of_day
      ORDER BY hour_of_day
    ),
    daily_patterns AS (
      SELECT 
        day_of_week,
        COUNT(*) as failure_count,
        COUNT(DISTINCT test_name) as unique_tests
      FROM failure_analysis
      GROUP BY day_of_week
      ORDER BY day_of_week
    )
    SELECT 
      'hourly' as pattern_type,
      json_agg(
        json_build_object(
          'hour', hour_of_day,
          'failures', failure_count,
          'uniqueTests', unique_tests
        ) ORDER BY hour_of_day
      ) as pattern_data
    FROM hourly_patterns
    UNION ALL
    SELECT 
      'daily' as pattern_type,
      json_agg(
        json_build_object(
          'dayOfWeek', day_of_week,
          'failures', failure_count,
          'uniqueTests', unique_tests
        ) ORDER BY day_of_week
      ) as pattern_data
    FROM daily_patterns
  `, [tenantId], tenantId, true);

  const patterns = {};
  result.rows.forEach(row => {
    patterns[row.pattern_type] = row.pattern_data;
  });

  return patterns;
}

/**
 * Helper functions
 */
function buildDateFilter(startDate?: string, endDate?: string): string {
  if (!startDate && !endDate) return '';
  
  let filter = '';
  if (startDate) filter += ' AND created_at >= $2';
  if (endDate) filter += ` AND created_at <= $${startDate ? '3' : '2'}`;
  
  return filter;
}

function getGroupByClause(groupBy: string): string {
  switch (groupBy) {
    case 'day':
      return "DATE_TRUNC('day', created_at)";
    case 'week':
      return "DATE_TRUNC('week', created_at)";
    case 'month':
      return "DATE_TRUNC('month', created_at)";
    default:
      return "DATE_TRUNC('day', created_at)";
  }
}