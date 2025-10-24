// Real-time Analytics Endpoints (BUG-002 FIX)
// These endpoints provide real-time predictions and insights for the dashboard

import { Router } from 'express';
import { getDatabase } from '../database/database';
import { AnalyticsService } from '../services/analyticsService';
import { asyncHandler } from '../middleware/error-handler';
import { logger } from '../utils/logger';

const realtimeRouter = Router();
const analyticsService = new AnalyticsService();

// Real-time predictions endpoint
realtimeRouter.get('/predictions', asyncHandler(async (req, res) => {
  try {
    const { timeframe = 30 } = req.query;
    const timeframeDays = parseInt(timeframe as string);

    logger.info('Fetching real-time predictions', { timeframe: timeframeDays });

    const db = getDatabase();
    const recentRuns = await db.getAllTestRuns(100);

    if (recentRuns.length === 0) {
      return res.json({
        failureRate: 0,
        executionTime: 0,
        healingSuccess: 0,
        nextFailures: [],
        confidence: 0,
        message: 'Insufficient data for predictions'
      });
    }

    const totalRuns = recentRuns.length;
    const failedRuns = recentRuns.filter(r => r.status === 'failed').length;
    const avgDuration = recentRuns.reduce((sum, r) => sum + (r.duration || 0), 0) / totalRuns;
    const healedRuns = recentRuns.filter(r => r.healingApplied).length;

    const recent10 = recentRuns.slice(0, 10);
    const previous10 = recentRuns.slice(10, 20);

    const recentFailRate = recent10.filter(r => r.status === 'failed').length / 10;
    const previousFailRate = previous10.length > 0
      ? previous10.filter(r => r.status === 'failed').length / previous10.length
      : recentFailRate;

    const failureTrend = recentFailRate - previousFailRate;

    const failureFrequency: { [key: string]: number } = {};
    recentRuns
      .filter(r => r.status === 'failed')
      .forEach(r => {
        const testName = r.testFile || 'unknown';
        failureFrequency[testName] = (failureFrequency[testName] || 0) + 1;
      });

    const nextFailures = Object.entries(failureFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);

    const predictions = {
      failureRate: Math.round(recentFailRate * 100),
      failureTrend: failureTrend > 0 ? 'increasing' : failureTrend < 0 ? 'decreasing' : 'stable',
      executionTime: Math.round(avgDuration / 1000),
      healingSuccess: totalRuns > 0 ? Math.round((healedRuns / totalRuns) * 100) : 0,
      nextFailures,
      confidence: totalRuns >= 20 ? 0.85 : totalRuns >= 10 ? 0.7 : 0.5,
      dataPoints: totalRuns,
      timestamp: new Date().toISOString()
    };

    logger.info('Generated predictions', predictions);
    res.json(predictions);

  } catch (error) {
    logger.error('Failed to generate predictions', { error });
    res.status(500).json({ error: 'Failed to generate predictions' });
  }
}));

// Real-time insights endpoint
realtimeRouter.get('/insights', asyncHandler(async (req, res) => {
  try {
    logger.info('Fetching real-time insights');

    const db = getDatabase();
    const recentRuns = await db.getAllTestRuns(50);
    const analytics = await analyticsService.getSmartAnalytics();

    const insights: any[] = [];

    // Performance insight
    if (recentRuns.length > 0) {
      const avgDuration = recentRuns.reduce((sum, r) => sum + (r.duration || 0), 0) / recentRuns.length;
      const avgDurationMinutes = Math.round(avgDuration / 60000);

      if (avgDurationMinutes > 5) {
        insights.push({
          type: 'performance',
          severity: 'warning',
          title: 'Slow Test Execution',
          message: `Average test duration is ${avgDurationMinutes} minutes`,
          recommendation: 'Consider parallelization or test optimization',
          impact: 'high',
          timestamp: new Date().toISOString()
        });
      }
    }

    // Healing insight
    const healedCount = recentRuns.filter(r => r.healingApplied).length;
    const healingRate = recentRuns.length > 0 ? (healedCount / recentRuns.length) * 100 : 0;

    if (healingRate < 80 && healedCount > 0) {
      insights.push({
        type: 'healing',
        severity: 'critical',
        title: 'Low Self-Healing Success Rate',
        message: `Self-healing success rate is ${Math.round(healingRate)}%`,
        recommendation: 'Review and update healing patterns',
        impact: 'critical',
        timestamp: new Date().toISOString()
      });
    } else if (healingRate >= 80) {
      insights.push({
        type: 'healing',
        severity: 'success',
        title: 'Excellent Self-Healing Performance',
        message: `Self-healing success rate is ${Math.round(healingRate)}%`,
        recommendation: 'Continue current healing strategies',
        impact: 'positive',
        timestamp: new Date().toISOString()
      });
    }

    // Coverage insight
    if (analytics.summary.overallCoverage < 70) {
      insights.push({
        type: 'coverage',
        severity: 'warning',
        title: 'Low Test Coverage',
        message: `Overall coverage is ${Math.round(analytics.summary.overallCoverage)}%`,
        recommendation: 'Add tests for uncovered functionality',
        impact: 'medium',
        timestamp: new Date().toISOString()
      });
    }

    // Test health insight
    const failedRuns = recentRuns.filter(r => r.status === 'failed').length;
    const failureRate = recentRuns.length > 0 ? (failedRuns / recentRuns.length) * 100 : 0;

    if (failureRate > 20) {
      insights.push({
        type: 'reliability',
        severity: 'critical',
        title: 'High Test Failure Rate',
        message: `${Math.round(failureRate)}% of recent tests are failing`,
        recommendation: 'Investigate and fix failing tests',
        impact: 'critical',
        timestamp: new Date().toISOString()
      });
    }

    if (insights.length === 0) {
      insights.push({
        type: 'general',
        severity: 'success',
        title: 'System Health Excellent',
        message: 'All metrics are within acceptable ranges',
        recommendation: 'Continue current testing practices',
        impact: 'positive',
        timestamp: new Date().toISOString()
      });
    }

    logger.info('Generated insights', { count: insights.length });
    res.json({
      insights,
      count: insights.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get insights', { error });
    res.status(500).json({ error: 'Failed to get insights' });
  }
}));

export { realtimeRouter };
