import { Router } from 'express';
import { AnalyticsService } from '../services/analyticsService';
import { database, getDatabase } from '../database/database';
import { asyncHandler } from '../middleware/error-handler';
import { logger } from '../utils/logger';

const router = Router();
const analyticsService = new AnalyticsService();

// Get comprehensive smart analytics with real database data
router.get('/smart', async (req, res) => {
  try {
    console.log('Analytics API: Fetching smart analytics...');
    const analytics = await analyticsService.getSmartAnalytics();
    
    console.log('Analytics API: Successfully fetched smart analytics:', {
      totalTests: analytics.summary.totalTests,
      modules: analytics.summary.totalModules,
      coverage: analytics.summary.overallCoverage,
      healthScore: analytics.summary.healthScore
    });
    
    res.json(analytics);
  } catch (error) {
    console.error('Analytics API: Error fetching smart analytics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch smart analytics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get coverage metrics (for existing frontend compatibility)
router.get('/coverage', async (req, res) => {
  try {
    console.log('Analytics API: Fetching coverage metrics...');
    const coverage = await analyticsService.getCoverageMetrics();
    res.json(coverage);
  } catch (error) {
    console.error('Analytics API: Error fetching coverage:', error);
    res.status(500).json({ 
      error: 'Failed to fetch coverage data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get gap analysis (for existing frontend compatibility)
router.get('/gaps', async (req, res) => {
  try {
    console.log('Analytics API: Fetching gap analysis...');
    const gaps = await analyticsService.getGapAnalysis();
    res.json(gaps);
  } catch (error) {
    console.error('Analytics API: Error fetching gaps:', error);
    res.status(500).json({ 
      error: 'Failed to fetch gap analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get AI insights (for existing frontend compatibility)
router.get('/insights', async (req, res) => {
  try {
    console.log('Analytics API: Fetching insights...');
    const insights = await analyticsService.getInsightAnalysis();
    res.json(insights);
  } catch (error) {
    console.error('Analytics API: Error fetching insights:', error);
    res.status(500).json({ 
      error: 'Failed to fetch insights',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get comprehensive PRD coverage analysis
router.get('/prd-coverage', async (req, res) => {
  try {
    console.log('Analytics API: Fetching PRD coverage analysis...');
    
    // Get smart analytics to trigger PRD analysis
    await analyticsService.getSmartAnalytics();
    
    // Get the PRD coverage results
    const prdCoverage = await analyticsService.getPRDCoverageAnalysis();
    
    console.log('Analytics API: Successfully fetched PRD coverage:', {
      totalRequirements: prdCoverage.summary.totalRequirements,
      coveredRequirements: prdCoverage.summary.coveredRequirements,
      overallCoverage: prdCoverage.summary.overallCoverage,
      criticalCoverage: prdCoverage.summary.criticalCoverage
    });
    
    res.json(prdCoverage);
  } catch (error) {
    console.error('Analytics API: Error fetching PRD coverage:', error);
    res.status(500).json({ 
      error: 'Failed to fetch PRD coverage analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Advanced failure intelligence analytics
router.get('/failure-intelligence', async (req, res) => {
  try {
    console.log('Analytics API: Fetching failure intelligence...');
    
    const [
      failureGroups,
      blockingFailures,
      failureTimeline,
      failurePatterns
    ] = await Promise.all([
      getFailuresByErrorMessage(),
      getBlockingFailures(),
      getFailureTimeline(),
      calculateFailurePatterns()
    ]);

    const failureIntelligence = {
      failureGroups,
      blockingFailures,
      timeline: failureTimeline,
      patterns: failurePatterns,
      generatedAt: new Date().toISOString(),
    };

    console.log('Analytics API: Successfully fetched failure intelligence:', {
      failureGroupsCount: failureGroups.length,
      blockingFailuresCount: blockingFailures.length,
      timelineEntries: failureTimeline.length,
      patternTypes: Object.keys(failurePatterns).length
    });

    res.json(failureIntelligence);
  } catch (error) {
    console.error('Analytics API: Error fetching failure intelligence:', error);
    res.status(500).json({ 
      error: 'Failed to fetch failure intelligence',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Helper functions for failure intelligence
async function getFailuresByErrorMessage() {
  // Mock implementation for now - would use real database queries
  return [
    {
      errorPattern: "Timeout waiting for element [NUMBER]ms",
      occurrenceCount: 45,
      affectedTests: 12,
      affectedRuns: 23,
      testNames: ["test_login_ui", "test_dashboard_load", "test_contact_search"],
      firstSeen: "2024-08-01T10:00:00Z",
      lastSeen: "2024-09-01T14:30:00Z",
      avgDuration: 65000
    },
    {
      errorPattern: "Expected element to be visible but was hidden",
      occurrenceCount: 32,
      affectedTests: 8,
      affectedRuns: 18,
      testNames: ["test_form_validation", "test_modal_display"],
      firstSeen: "2024-08-15T09:00:00Z",
      lastSeen: "2024-09-01T12:15:00Z",
      avgDuration: 45000
    }
  ];
}

async function getBlockingFailures() {
  return [
    {
      blockingTest: "test_database_setup",
      timesBlockedOthers: 15,
      uniqueTestsBlocked: 8,
      blockedTests: ["test_user_creation", "test_data_validation", "test_cleanup"],
      severity: "high"
    },
    {
      blockingTest: "test_authentication_token",
      timesBlockedOthers: 7,
      uniqueTestsBlocked: 12,
      blockedTests: ["test_api_calls", "test_user_profile", "test_permissions"],
      severity: "medium"
    }
  ];
}

async function getFailureTimeline() {
  return [
    {
      period: "2024-08-28T00:00:00Z",
      totalFailures: 12,
      newFailures: 3,
      newFailingTests: [
        { testName: "test_new_feature", count: 2 },
        { testName: "test_integration_api", count: 1 }
      ]
    },
    {
      period: "2024-08-29T00:00:00Z", 
      totalFailures: 18,
      newFailures: 1,
      newFailingTests: [
        { testName: "test_edge_case", count: 3 }
      ]
    },
    {
      period: "2024-09-01T00:00:00Z",
      totalFailures: 25,
      newFailures: 2,
      newFailingTests: [
        { testName: "test_timeout_handling", count: 4 },
        { testName: "test_error_recovery", count: 2 }
      ]
    }
  ];
}

async function calculateFailurePatterns() {
  return {
    hourly: [
      { hour: 9, failures: 15, uniqueTests: 8 },
      { hour: 10, failures: 22, uniqueTests: 12 },
      { hour: 14, failures: 18, uniqueTests: 9 },
      { hour: 16, failures: 28, uniqueTests: 15 }
    ],
    daily: [
      { dayOfWeek: 1, failures: 45, uniqueTests: 20 }, // Monday
      { dayOfWeek: 2, failures: 38, uniqueTests: 18 }, // Tuesday
      { dayOfWeek: 3, failures: 42, uniqueTests: 19 }, // Wednesday
      { dayOfWeek: 4, failures: 35, uniqueTests: 16 }, // Thursday
      { dayOfWeek: 5, failures: 28, uniqueTests: 14 }  // Friday
    ]
  };
}

/**
 * GET /analytics/dashboard
 * Get comprehensive analytics dashboard data with AI-powered insights
 */
router.get('/dashboard', asyncHandler(async (req, res) => {
  try {
    console.log('Analytics Dashboard API: Fetching AI-powered analytics...');

    // Use the new AI-powered analytics service
    const smartAnalytics = await analyticsService.getSmartAnalytics();

    // Get execution statistics for compatibility
    const db = getDatabase();
    const dbInstance = (db as any).db;

    const executionStats = await dbInstance.prepare(`
      SELECT
        COUNT(*) as totalRuns,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as passedRuns,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failedRuns,
        AVG(CASE WHEN duration_ms IS NOT NULL THEN duration_ms END) as avgDuration
      FROM schedule_runs
      WHERE started_at >= datetime('now', '-30 days')
    `).get() as any;

    // Get daily execution trends
    const trendData = await dbInstance.prepare(`
      SELECT
        DATE(started_at) as date,
        COUNT(*) as executions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as passed,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        AVG(duration_ms) as avgDuration
      FROM schedule_runs
      WHERE started_at >= datetime('now', '-14 days')
      GROUP BY DATE(started_at)
      ORDER BY date DESC
    `).all() as any[];

    // Calculate AI-enhanced metrics
    const aiPassRate = parseFloat(smartAnalytics.summary.overallCoverage);

    const response = {
      summary: {
        totalTests: smartAnalytics.summary.totalTests, // Real count from file system (685)
        totalRuns: executionStats.totalRuns || 0,
        successRate: Math.round(aiPassRate), // AI-calculated pass rate
        averageDuration: Math.round(executionStats.avgDuration || 0),
        testCoverage: Math.round(aiPassRate), // Use AI pass rate as coverage
        healthScore: smartAnalytics.summary.healthScore // AI health score
      },
      categories: smartAnalytics.moduleBreakdown.map(module => ({
        category: module.module,
        testCount: module.total,
        runCount: 0, // No run data available in simplified schema
        successRate: module.total > 0 ? Math.round((module.passed / module.total) * 100) : 0,
        avgDuration: Math.round(module.avg_duration)
      })),
      trends: trendData.map(day => ({
        date: day.date,
        executions: day.executions,
        successRate: day.executions > 0 ? Math.round((day.passed / day.executions) * 100) : 0,
        avgDuration: Math.round(day.avgDuration || 0)
      })),
      aiInsights: {
        totalTests: smartAnalytics.summary.totalTests,
        aiPassRate: aiPassRate,
        healthScore: smartAnalytics.summary.healthScore,
        risks: smartAnalytics.risks.slice(0, 3), // Top 3 risks
        gaps: smartAnalytics.gaps.slice(0, 3), // Top 3 gaps
        flakyTests: smartAnalytics.flakyTests.length
      },
      timestamp: new Date().toISOString()
    };

    console.log('Analytics Dashboard API: Successfully returned AI-powered data:', {
      totalTests: response.summary.totalTests,
      aiPassRate: aiPassRate,
      healthScore: response.summary.healthScore,
      categories: response.categories.length
    });

    res.json(response);
  } catch (error) {
    console.error('Analytics Dashboard API: Error fetching AI analytics:', error);
    logger.error('Failed to get analytics dashboard', { error });
    res.status(500).json({
      error: 'Failed to get analytics dashboard',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * GET /analytics/trends
 * Get historical trend analysis with advanced metrics
 */
router.get('/trends', asyncHandler(async (req, res) => {
  const { period = '30d', metric = 'success_rate' } = req.query;

  try {
    const db = getDatabase();
    const dbInstance = (db as any).db;
    let periodCondition = '';
    let groupBy = '';

    // Set period and grouping
    switch (period) {
      case '24h':
        periodCondition = "WHERE tr.started_at >= datetime('now', '-1 day')";
        groupBy = "strftime('%Y-%m-%d %H:00:00', tr.started_at)";
        break;
      case '7d':
        periodCondition = "WHERE tr.started_at >= datetime('now', '-7 days')";
        groupBy = "DATE(tr.started_at)";
        break;
      case '30d':
        periodCondition = "WHERE tr.started_at >= datetime('now', '-30 days')";
        groupBy = "DATE(tr.started_at)";
        break;
      case '90d':
        periodCondition = "WHERE tr.started_at >= datetime('now', '-90 days')";
        groupBy = "strftime('%Y-%W', tr.started_at)"; // Weekly grouping
        break;
    }

    const trendQuery = `
      SELECT
        ${groupBy} as period,
        COUNT(*) as totalRuns,
        COUNT(CASE WHEN tr.status = 'completed' THEN 1 END) as passed,
        COUNT(CASE WHEN tr.status = 'failed' THEN 1 END) as failed,
        COUNT(CASE WHEN tr.status = 'skipped' THEN 1 END) as skipped,
        AVG(tr.duration_ms) as avgDuration,
        MIN(tr.duration_ms) as minDuration,
        MAX(tr.duration_ms) as maxDuration,
        COUNT(DISTINCT tr.test_id) as uniqueTests
      FROM schedule_runs tr
      ${periodCondition}
      GROUP BY ${groupBy}
      ORDER BY period DESC
    `;

    const trendData = await dbInstance.prepare(trendQuery).all() as any[];

    // Calculate additional metrics based on requested metric
    const processedTrends = trendData.map(trend => {
      const successRate = trend.totalRuns > 0 ? (trend.passed / trend.totalRuns) * 100 : 0;
      const failureRate = trend.totalRuns > 0 ? (trend.failed / trend.totalRuns) * 100 : 0;

      return {
        period: trend.period,
        totalRuns: trend.totalRuns,
        passed: trend.passed,
        failed: trend.failed,
        skipped: trend.skipped,
        successRate: Math.round(successRate),
        failureRate: Math.round(failureRate),
        avgDuration: Math.round(trend.avgDuration || 0),
        minDuration: trend.minDuration || 0,
        maxDuration: trend.maxDuration || 0,
        uniqueTests: trend.uniqueTests,
        efficiency: trend.totalRuns > 0 ? Math.round((trend.uniqueTests / trend.totalRuns) * 100) : 0
      };
    });

    // Calculate trend indicators (improvement/decline)
    const trendsWithIndicators = processedTrends.map((current, index) => {
      if (index === processedTrends.length - 1) return { ...current, trend: 'stable' };

      const previous = processedTrends[index + 1];
      let trend = 'stable';

      switch (metric) {
        case 'success_rate':
          if (current.successRate > previous.successRate + 5) trend = 'improving';
          else if (current.successRate < previous.successRate - 5) trend = 'declining';
          break;
        case 'duration':
          if (current.avgDuration < previous.avgDuration - 1000) trend = 'improving';
          else if (current.avgDuration > previous.avgDuration + 1000) trend = 'declining';
          break;
        case 'volume':
          if (current.totalRuns > previous.totalRuns) trend = 'improving';
          else if (current.totalRuns < previous.totalRuns) trend = 'declining';
          break;
      }

      return { ...current, trend };
    });

    const response = {
      period,
      metric,
      trends: trendsWithIndicators,
      summary: {
        totalPeriods: trendsWithIndicators.length,
        avgSuccessRate: Math.round(
          trendsWithIndicators.reduce((sum, t) => sum + t.successRate, 0) / trendsWithIndicators.length
        ),
        improvingPeriods: trendsWithIndicators.filter(t => t.trend === 'improving').length,
        decliningPeriods: trendsWithIndicators.filter(t => t.trend === 'declining').length
      },
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to get analytics trends', { error });
    res.status(500).json({
      error: 'Failed to get analytics trends',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * GET /analytics/test-health
 * Get test health metrics and flaky test detection
 */
router.get('/test-health', asyncHandler(async (req, res) => {
  const { threshold = 80 } = req.query; // Success rate threshold for healthy tests

  try {
    const db = getDatabase();
    const dbInstance = (db as any).db;

    // Get test health statistics
    const testHealthQuery = `
      SELECT
        t.id,
        t.title,
        t.category,
        t.file_path,
        COUNT(tr.id) as totalRuns,
        COUNT(CASE WHEN tr.status = 'completed' THEN 1 END) as passed,
        COUNT(CASE WHEN tr.status = 'failed' THEN 1 END) as failed,
        COUNT(CASE WHEN tr.status = 'skipped' THEN 1 END) as skipped,
        AVG(tr.duration_ms) as avgDuration,
        MIN(tr.started_at) as firstRun,
        MAX(tr.started_at) as lastRun
      FROM tests t
      LEFT JOIN schedule_runs tr ON t.id = tr.test_id
      WHERE tr.started_at >= datetime('now', '-30 days')
      GROUP BY t.id
      HAVING COUNT(tr.id) >= 3
      ORDER BY totalRuns DESC
    `;

    const testHealth = await dbInstance.prepare(testHealthQuery).all() as any[];

    // Categorize tests by health status
    const healthyTests = [];
    const flakyTests = [];
    const failingTests = [];
    const staleTests = [];

    const thresholdNum = parseInt(threshold as string);

    for (const test of testHealth) {
      const successRate = test.totalRuns > 0 ? (test.passed / test.totalRuns) * 100 : 0;
      const failureRate = test.totalRuns > 0 ? (test.failed / test.totalRuns) * 100 : 0;

      const testData = {
        id: test.id,
        title: test.title,
        category: test.category,
        filePath: test.file_path,
        totalRuns: test.totalRuns,
        successRate: Math.round(successRate),
        failureRate: Math.round(failureRate),
        avgDuration: Math.round(test.avgDuration || 0),
        lastRun: test.lastRun
      };

      // Categorize based on success rate and patterns
      if (successRate >= thresholdNum) {
        healthyTests.push(testData);
      } else if (successRate >= 50 && failureRate > 0) {
        // Flaky: has both passes and failures with moderate success rate
        flakyTests.push({
          ...testData,
          flakyScore: Math.round(100 - successRate + (failureRate * 0.5))
        });
      } else if (successRate < 50) {
        failingTests.push(testData);
      }

      // Check for stale tests (no runs in last 7 days)
      const lastRunDate = new Date(test.lastRun);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      if (lastRunDate < sevenDaysAgo) {
        staleTests.push(testData);
      }
    }

    // Sort flaky tests by flaky score (higher = more problematic)
    flakyTests.sort((a, b) => (b as any).flakyScore - (a as any).flakyScore);

    const response = {
      summary: {
        totalTests: testHealth.length,
        healthyTests: healthyTests.length,
        flakyTests: flakyTests.length,
        failingTests: failingTests.length,
        staleTests: staleTests.length,
        overallHealthScore: testHealth.length > 0
          ? Math.round((healthyTests.length / testHealth.length) * 100)
          : 0
      },
      categories: {
        healthy: healthyTests.slice(0, 10), // Top 10 healthy tests
        flaky: flakyTests.slice(0, 10),     // Top 10 flaky tests
        failing: failingTests.slice(0, 10), // Top 10 failing tests
        stale: staleTests.slice(0, 10)      // Top 10 stale tests
      },
      recommendations: generateHealthRecommendations(healthyTests.length, flakyTests.length, failingTests.length, staleTests.length),
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to get test health analytics', { error });
    res.status(500).json({
      error: 'Failed to get test health analytics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

// Helper function to generate health recommendations
function generateHealthRecommendations(healthy: number, flaky: number, failing: number, stale: number) {
  const recommendations = [];

  if (flaky > 5) {
    recommendations.push({
      type: 'flaky_tests',
      priority: 'high',
      message: `${flaky} flaky tests detected. Consider adding wait conditions or improving element selectors.`,
      action: 'Review and stabilize flaky tests'
    });
  }

  if (failing > 3) {
    recommendations.push({
      type: 'failing_tests',
      priority: 'critical',
      message: `${failing} consistently failing tests. Immediate attention required.`,
      action: 'Fix or disable failing tests'
    });
  }

  if (stale > 10) {
    recommendations.push({
      type: 'stale_tests',
      priority: 'medium',
      message: `${stale} tests haven't run recently. Consider test cleanup or scheduling.`,
      action: 'Review test execution strategy'
    });
  }

  if (healthy / (healthy + flaky + failing) < 0.8) {
    recommendations.push({
      type: 'overall_health',
      priority: 'high',
      message: 'Overall test health is below 80%. Consider test maintenance sprint.',
      action: 'Plan test stabilization effort'
    });
  }

  return recommendations;
}

/**
 * GET /analytics/charts/execution-timeline
 * Get data for execution timeline chart
 */
router.get('/charts/execution-timeline', asyncHandler(async (req, res) => {
  const { period = '7d', interval = 'daily' } = req.query;

  try {
    const db = getDatabase();
    const dbInstance = (db as any).db;
    let periodCondition = '';
    let groupBy = '';
    let dateFormat = '';

    // Set period and grouping based on interval
    switch (period) {
      case '24h':
        periodCondition = "WHERE tr.started_at >= datetime('now', '-1 day')";
        groupBy = "strftime('%Y-%m-%d %H:00:00', tr.started_at)";
        dateFormat = '%Y-%m-%d %H:00:00';
        break;
      case '7d':
        periodCondition = "WHERE tr.started_at >= datetime('now', '-7 days')";
        groupBy = "DATE(tr.started_at)";
        dateFormat = '%Y-%m-%d';
        break;
      case '30d':
        periodCondition = "WHERE tr.started_at >= datetime('now', '-30 days')";
        groupBy = "DATE(tr.started_at)";
        dateFormat = '%Y-%m-%d';
        break;
    }

    const timelineQuery = `
      SELECT
        ${groupBy} as period,
        COUNT(*) as totalExecutions,
        COUNT(CASE WHEN tr.status = 'completed' THEN 1 END) as passed,
        COUNT(CASE WHEN tr.status = 'failed' THEN 1 END) as failed,
        COUNT(CASE WHEN tr.status = 'skipped' THEN 1 END) as skipped,
        AVG(tr.duration_ms) as avgDuration
      FROM schedule_runs tr
      ${periodCondition}
      GROUP BY ${groupBy}
      ORDER BY period ASC
    `;

    const timelineData = await dbInstance.prepare(timelineQuery).all() as any[];

    const chartData = timelineData.map(item => ({
      period: item.period,
      totalExecutions: item.totalExecutions,
      passed: item.passed,
      failed: item.failed,
      skipped: item.skipped,
      successRate: item.totalExecutions > 0 ? Math.round((item.passed / item.totalExecutions) * 100) : 0,
      avgDuration: Math.round(item.avgDuration || 0)
    }));

    res.json({
      period,
      interval,
      data: chartData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get execution timeline chart data', { error });
    res.status(500).json({
      error: 'Failed to get execution timeline chart data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * GET /analytics/charts/category-distribution
 * Get data for test category distribution pie chart
 */
router.get('/charts/category-distribution', asyncHandler(async (req, res) => {
  const { period = '30d' } = req.query;

  try {
    const db = getDatabase();
    const dbInstance = (db as any).db;
    const periodCondition = period === 'all' ? '' : `WHERE tr.started_at >= datetime('now', '-${period.replace('d', ' days')}')`;

    const categoryQuery = `
      SELECT
        module as category,
        COUNT(*) as runCount,
        0 as passed,
        0 as failed,
        0 as avgDuration
      FROM tests
      GROUP BY module
      ORDER BY runCount DESC
    `;

    const categoryData = await dbInstance.prepare(categoryQuery).all() as any[];

    const chartData = categoryData.map(item => ({
      category: item.category || 'Uncategorized',
      runCount: item.runCount,
      passed: item.passed,
      failed: item.failed,
      successRate: item.runCount > 0 ? Math.round((item.passed / item.runCount) * 100) : 0,
      avgDuration: Math.round(item.avgDuration || 0),
      percentage: 0 // Will be calculated below
    }));

    // Calculate percentages
    const totalRuns = chartData.reduce((sum, item) => sum + item.runCount, 0);
    chartData.forEach(item => {
      item.percentage = totalRuns > 0 ? Math.round((item.runCount / totalRuns) * 100) : 0;
    });

    res.json({
      period,
      data: chartData,
      totalRuns,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get category distribution chart data', { error });
    res.status(500).json({
      error: 'Failed to get category distribution chart data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * GET /analytics/charts/performance-metrics
 * Get data for performance metrics visualization
 */
router.get('/charts/performance-metrics', asyncHandler(async (req, res) => {
  const { period = '30d', metric = 'duration' } = req.query;

  try {
    const db = getDatabase();
    const dbInstance = (db as any).db;
    const periodCondition = `WHERE tr.started_at >= datetime('now', '-${period.replace('d', ' days')}')`;

    // Get performance data grouped by test
    const performanceQuery = `
      SELECT
        t.title,
        t.category,
        COUNT(tr.id) as runCount,
        AVG(tr.duration_ms) as avgDuration,
        MIN(tr.duration_ms) as minDuration,
        MAX(tr.duration_ms) as maxDuration,
        STDEV(tr.duration_ms) as stdDevDuration
      FROM tests t
      JOIN schedule_runs tr ON t.id = tr.test_id
      ${periodCondition}
      GROUP BY t.id
      HAVING runCount >= 3
      ORDER BY avgDuration DESC
      LIMIT 20
    `;

    const performanceData = await dbInstance.prepare(performanceQuery).all() as any[];

    const chartData = performanceData.map(item => ({
      testName: item.title,
      category: item.category,
      runCount: item.runCount,
      avgDuration: Math.round(item.avgDuration || 0),
      minDuration: Math.round(item.minDuration || 0),
      maxDuration: Math.round(item.maxDuration || 0),
      variability: Math.round(item.stdDevDuration || 0),
      performanceScore: calculatePerformanceScore(item.avgDuration, item.stdDevDuration)
    }));

    res.json({
      period,
      metric,
      data: chartData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get performance metrics chart data', { error });
    res.status(500).json({
      error: 'Failed to get performance metrics chart data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * GET /analytics/charts/flaky-test-trends
 * Get data for flaky test trends over time
 */
router.get('/charts/flaky-test-trends', asyncHandler(async (req, res) => {
  const { period = '30d' } = req.query;

  try {
    const db = getDatabase();
    const dbInstance = (db as any).db;

    // Get daily flaky test data
    const flakyTrendsQuery = `
      SELECT
        DATE(tr.started_at) as date,
        COUNT(DISTINCT t.id) as totalTests,
        COUNT(DISTINCT CASE
          WHEN daily_stats.success_rate > 0 AND daily_stats.success_rate < 90
          THEN t.id
        END) as flakyTests
      FROM schedule_runs tr
      JOIN tests t ON tr.test_id = t.id
      JOIN (
        SELECT
          test_id,
          DATE(created_at) as test_date,
          (COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*)) as success_rate
        FROM schedule_runs
        WHERE created_at >= datetime('now', '-${period.replace('d', ' days')}')
        GROUP BY test_id, DATE(created_at)
      ) daily_stats ON daily_stats.test_id = t.id AND daily_stats.test_date = DATE(tr.started_at)
      WHERE tr.started_at >= datetime('now', '-${period.replace('d', ' days')}')
      GROUP BY DATE(tr.started_at)
      ORDER BY date ASC
    `;

    const trendsData = await dbInstance.prepare(flakyTrendsQuery).all() as any[];

    const chartData = trendsData.map(item => ({
      date: item.date,
      totalTests: item.totalTests,
      flakyTests: item.flakyTests,
      flakyPercentage: item.totalTests > 0 ? Math.round((item.flakyTests / item.totalTests) * 100) : 0,
      stableTests: item.totalTests - item.flakyTests
    }));

    // Calculate trend indicators
    const avgFlakyPercentage = chartData.length > 0
      ? chartData.reduce((sum, item) => sum + item.flakyPercentage, 0) / chartData.length
      : 0;

    const recentAvg = chartData.slice(-7).reduce((sum, item) => sum + item.flakyPercentage, 0) / Math.min(7, chartData.length);
    const trendIndicator = recentAvg > avgFlakyPercentage + 5 ? 'increasing' :
                          recentAvg < avgFlakyPercentage - 5 ? 'decreasing' : 'stable';

    res.json({
      period,
      data: chartData,
      summary: {
        avgFlakyPercentage: Math.round(avgFlakyPercentage),
        recentAvgFlakyPercentage: Math.round(recentAvg),
        trendIndicator,
        totalDataPoints: chartData.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get flaky test trends chart data', { error });
    res.status(500).json({
      error: 'Failed to get flaky test trends chart data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * GET /analytics/charts/success-rate-heatmap
 * Get data for success rate heatmap by day and hour
 */
router.get('/charts/success-rate-heatmap', asyncHandler(async (req, res) => {
  const { period = '30d' } = req.query;

  try {
    const db = getDatabase();
    const dbInstance = (db as any).db;

    const heatmapQuery = `
      SELECT
        strftime('%w', tr.started_at) as dayOfWeek,
        strftime('%H', tr.started_at) as hour,
        COUNT(*) as totalRuns,
        COUNT(CASE WHEN tr.status = 'completed' THEN 1 END) as passed
      FROM schedule_runs tr
      WHERE tr.started_at >= datetime('now', '-${period.replace('d', ' days')}')
      GROUP BY strftime('%w', tr.started_at), strftime('%H', tr.started_at)
      ORDER BY dayOfWeek, hour
    `;

    const heatmapData = await dbInstance.prepare(heatmapQuery).all() as any[];

    // Create 7x24 matrix for heatmap
    const heatmapMatrix = Array(7).fill(null).map(() => Array(24).fill(null));

    heatmapData.forEach(item => {
      const dayIndex = parseInt(item.dayOfWeek);
      const hourIndex = parseInt(item.hour);
      const successRate = item.totalRuns > 0 ? Math.round((item.passed / item.totalRuns) * 100) : 0;

      heatmapMatrix[dayIndex][hourIndex] = {
        totalRuns: item.totalRuns,
        passed: item.passed,
        successRate,
        intensity: successRate / 100 // For color intensity
      };
    });

    // Fill empty cells with default values
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        if (!heatmapMatrix[day][hour]) {
          heatmapMatrix[day][hour] = {
            totalRuns: 0,
            passed: 0,
            successRate: 0,
            intensity: 0
          };
        }
      }
    }

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    res.json({
      period,
      data: heatmapMatrix,
      metadata: {
        dayNames,
        hours: Array.from({ length: 24 }, (_, i) => i),
        totalDataPoints: heatmapData.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get success rate heatmap data', { error });
    res.status(500).json({
      error: 'Failed to get success rate heatmap data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

// Helper function to calculate performance score
function calculatePerformanceScore(avgDuration: number, stdDev: number): number {
  // Performance score based on duration and consistency
  // Lower duration and lower variability = higher score
  const durationScore = Math.max(0, 100 - (avgDuration / 1000)); // Penalty for long duration
  const consistencyScore = Math.max(0, 100 - (stdDev / 100)); // Penalty for high variability

  return Math.round((durationScore + consistencyScore) / 2);
}

export default router;