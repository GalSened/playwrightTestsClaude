import { Router } from 'express';
import { AnalyticsService } from '../services/analyticsService';
import { database } from '../database/database';

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

export default router;