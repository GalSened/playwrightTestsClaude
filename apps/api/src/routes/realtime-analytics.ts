import { Router, Request, Response } from 'express';
import { logger } from '@/utils/logger';
import Database from 'better-sqlite3';
import { join } from 'path';
import PredictiveFailureAnalysis from '@/services/ai/predictive-failure-analysis';

const router = Router();

// Database for real-time analytics
const analyticsDb = new Database(join(process.cwd(), 'data/realtime-analytics.db'));

// Initialize analytics tables
analyticsDb.exec(`
  CREATE TABLE IF NOT EXISTS test_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT UNIQUE,
    suite TEXT,
    language TEXT,
    browser TEXT,
    workers INTEGER,
    status TEXT,
    start_time DATETIME,
    end_time DATETIME,
    total_tests INTEGER DEFAULT 0,
    passed_tests INTEGER DEFAULT 0,
    failed_tests INTEGER DEFAULT 0,
    skipped_tests INTEGER DEFAULT 0,
    duration INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS system_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    cpu_usage REAL,
    memory_usage REAL,
    disk_usage REAL,
    network_throughput REAL,
    active_connections INTEGER,
    queue_size INTEGER
  );

  CREATE TABLE IF NOT EXISTS execution_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT,
    event_type TEXT,
    event_data TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (run_id) REFERENCES test_executions(run_id)
  );
`);

/**
 * GET /api/realtime/metrics
 * Get real-time system and test metrics
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    // Get active executions
    const activeExecutions = analyticsDb.prepare(`
      SELECT COUNT(*) as count
      FROM test_executions
      WHERE status = 'running'
    `).get() as { count: number };

    // Get today's executions
    const todayExecutions = analyticsDb.prepare(`
      SELECT COUNT(*) as count
      FROM test_executions
      WHERE DATE(start_time) = DATE('now')
    `).get() as { count: number };

    // Get success rate for last 24 hours
    const successRate = analyticsDb.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM test_executions
      WHERE start_time >= datetime('now', '-24 hours')
    `).get() as { total: number; completed: number };

    // Get average execution time
    const avgTime = analyticsDb.prepare(`
      SELECT AVG(duration) as avg_duration
      FROM test_executions
      WHERE status = 'completed' AND duration IS NOT NULL
      AND start_time >= datetime('now', '-24 hours')
    `).get() as { avg_duration: number | null };

    // Get current throughput (tests per minute in last hour)
    const throughput = analyticsDb.prepare(`
      SELECT
        COUNT(*) as executions,
        SUM(total_tests) as total_tests
      FROM test_executions
      WHERE start_time >= datetime('now', '-1 hour')
    `).get() as { executions: number; total_tests: number };

    // Get queued executions (pending status)
    const queuedExecutions = analyticsDb.prepare(`
      SELECT COUNT(*) as count
      FROM test_executions
      WHERE status = 'pending'
    `).get() as { count: number };

    // Get latest system metrics
    const systemMetrics = analyticsDb.prepare(`
      SELECT * FROM system_metrics
      ORDER BY timestamp DESC
      LIMIT 1
    `).get() as any;

    // Calculate current throughput per minute
    const currentThroughput = throughput.total_tests > 0 ? Math.round(throughput.total_tests / 60) : 0;

    // Get real system metrics using Node.js APIs
    const os = require('os');
    const process = require('process');

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryUsage = (usedMem / totalMem) * 100;

    const cpuUsage = process.cpuUsage();
    const uptime = process.uptime() * 1000; // Convert to milliseconds

    const metrics = {
      activeExecutions: activeExecutions.count,
      totalExecutionsToday: todayExecutions.count,
      successRate: successRate.total > 0 ? Number(((successRate.completed / successRate.total) * 100).toFixed(1)) : 0,
      avgExecutionTime: avgTime.avg_duration || 0,
      currentThroughput,
      queuedExecutions: queuedExecutions.count,
      systemHealth: {
        cpu: systemMetrics?.cpu_usage || 0,
        memory: Number(memoryUsage.toFixed(1)),
        disk: systemMetrics?.disk_usage || 0,
        network: systemMetrics?.network_throughput || 0,
        uptime: uptime
      }
    };

    res.json({
      success: true,
      metrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get real-time metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get real-time metrics'
    });
  }
});

/**
 * GET /api/realtime/executions
 * Get currently active test executions with real-time progress
 */
router.get('/executions', async (req: Request, res: Response) => {
  try {
    const executions = analyticsDb.prepare(`
      SELECT
        run_id,
        suite,
        language,
        browser,
        workers,
        status,
        start_time,
        end_time,
        total_tests,
        passed_tests,
        failed_tests,
        skipped_tests,
        duration
      FROM test_executions
      WHERE status IN ('running', 'pending')
      ORDER BY start_time DESC
    `).all() as any[];

    // Calculate progress for each execution
    const executionsWithProgress = executions.map(execution => {
      const completed = execution.passed_tests + execution.failed_tests + execution.skipped_tests;
      const percentage = execution.total_tests > 0 ? Math.round((completed / execution.total_tests) * 100) : 0;

      return {
        runId: execution.run_id,
        status: execution.status,
        startTime: execution.start_time,
        endTime: execution.end_time,
        totalTests: execution.total_tests,
        passedTests: execution.passed_tests,
        failedTests: execution.failed_tests,
        skippedTests: execution.skipped_tests,
        duration: execution.duration,
        progress: {
          percentage,
          completed,
          total: execution.total_tests
        },
        config: {
          suite: execution.suite,
          language: execution.language,
          browser: execution.browser,
          workers: execution.workers
        }
      };
    });

    res.json({
      success: true,
      executions: executionsWithProgress,
      count: executionsWithProgress.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get active executions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get active executions'
    });
  }
});

/**
 * POST /api/realtime/execution
 * Create or update a test execution record
 */
router.post('/execution', async (req: Request, res: Response) => {
  try {
    const {
      runId,
      suite,
      language,
      browser,
      workers,
      status,
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
      duration
    } = req.body;

    const upsertStmt = analyticsDb.prepare(`
      INSERT OR REPLACE INTO test_executions (
        run_id, suite, language, browser, workers, status,
        start_time, end_time, total_tests, passed_tests,
        failed_tests, skipped_tests, duration, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        COALESCE((SELECT start_time FROM test_executions WHERE run_id = ?), datetime('now')),
        CASE WHEN ? IN ('completed', 'failed', 'cancelled') THEN datetime('now') ELSE NULL END,
        ?, ?, ?, ?, ?, datetime('now')
      )
    `);

    upsertStmt.run(
      runId, suite, language, browser, workers, status,
      runId, // for the COALESCE query
      status, // for the CASE WHEN
      totalTests || 0, passedTests || 0, failedTests || 0, skippedTests || 0, duration
    );

    // Add event log
    const eventStmt = analyticsDb.prepare(`
      INSERT INTO execution_events (run_id, event_type, event_data)
      VALUES (?, ?, ?)
    `);

    eventStmt.run(runId, 'status_update', JSON.stringify({ status, passedTests, failedTests, skippedTests }));

    res.json({
      success: true,
      message: 'Execution updated',
      runId
    });

  } catch (error) {
    logger.error('Failed to update execution:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update execution'
    });
  }
});

/**
 * POST /api/realtime/metrics/system
 * Update system metrics
 */
router.post('/metrics/system', async (req: Request, res: Response) => {
  try {
    const {
      cpuUsage,
      memoryUsage,
      diskUsage,
      networkThroughput,
      activeConnections,
      queueSize
    } = req.body;

    const insertStmt = analyticsDb.prepare(`
      INSERT INTO system_metrics (
        cpu_usage, memory_usage, disk_usage, network_throughput,
        active_connections, queue_size
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run(
      cpuUsage, memoryUsage, diskUsage, networkThroughput,
      activeConnections || 0, queueSize || 0
    );

    // Clean up old metrics (keep only last 24 hours)
    const cleanupStmt = analyticsDb.prepare(`
      DELETE FROM system_metrics
      WHERE timestamp < datetime('now', '-24 hours')
    `);
    cleanupStmt.run();

    res.json({
      success: true,
      message: 'System metrics updated'
    });

  } catch (error) {
    logger.error('Failed to update system metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update system metrics'
    });
  }
});

/**
 * GET /api/realtime/events/:runId
 * Get event stream for a specific test execution
 */
router.get('/events/:runId', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;

    const events = analyticsDb.prepare(`
      SELECT event_type, event_data, timestamp
      FROM execution_events
      WHERE run_id = ?
      ORDER BY timestamp DESC
      LIMIT 50
    `).all(runId) as any[];

    const formattedEvents = events.map(event => ({
      type: event.event_type,
      data: JSON.parse(event.event_data || '{}'),
      timestamp: event.timestamp
    }));

    res.json({
      success: true,
      runId,
      events: formattedEvents,
      count: formattedEvents.length
    });

  } catch (error) {
    logger.error('Failed to get execution events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get execution events'
    });
  }
});

/**
 * DELETE /api/realtime/cleanup
 * Clean up old analytics data
 */
router.delete('/cleanup', async (req: Request, res: Response) => {
  try {
    const { daysToKeep = 7 } = req.query;

    // Clean up old executions
    const cleanupExecutions = analyticsDb.prepare(`
      DELETE FROM test_executions
      WHERE start_time < datetime('now', '-${daysToKeep} days')
    `);
    const executionsDeleted = cleanupExecutions.run();

    // Clean up old events
    const cleanupEvents = analyticsDb.prepare(`
      DELETE FROM execution_events
      WHERE timestamp < datetime('now', '-${daysToKeep} days')
    `);
    const eventsDeleted = cleanupEvents.run();

    // Clean up old metrics
    const cleanupMetrics = analyticsDb.prepare(`
      DELETE FROM system_metrics
      WHERE timestamp < datetime('now', '-1 days')
    `);
    const metricsDeleted = cleanupMetrics.run();

    res.json({
      success: true,
      message: 'Analytics data cleaned up',
      deletedRecords: {
        executions: executionsDeleted.changes,
        events: eventsDeleted.changes,
        metrics: metricsDeleted.changes
      }
    });

  } catch (error) {
    logger.error('Failed to cleanup analytics data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup analytics data'
    });
  }
});

/**
 * GET /api/realtime/predictions
 * Get AI-powered failure predictions
 */
router.get('/predictions', async (req: Request, res: Response) => {
  try {
    const { timeframe = 30 } = req.query;
    const days = parseInt(timeframe as string, 10);

    const analyzer = new PredictiveFailureAnalysis();
    const predictions = await analyzer.predictFailures(days);
    analyzer.close();

    res.json({
      success: true,
      predictions,
      count: predictions.length,
      timeframeDays: days,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to generate failure predictions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate failure predictions'
    });
  }
});

/**
 * GET /api/realtime/insights
 * Get predictive insights for dashboard
 */
router.get('/insights', async (req: Request, res: Response) => {
  try {
    const analyzer = new PredictiveFailureAnalysis();
    const insights = await analyzer.generatePredictiveInsights();
    analyzer.close();

    res.json({
      success: true,
      insights,
      count: insights.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to generate predictive insights:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate predictive insights'
    });
  }
});

/**
 * POST /api/realtime/analysis/trigger
 * Trigger comprehensive predictive analysis
 */
router.post('/analysis/trigger', async (req: Request, res: Response) => {
  try {
    const { timeframe = 30, includeInsights = true } = req.body;

    const analyzer = new PredictiveFailureAnalysis();

    const analysisResults = {
      predictions: await analyzer.predictFailures(timeframe),
      insights: includeInsights ? await analyzer.generatePredictiveInsights() : []
    };

    analyzer.close();

    // Store analysis results for historical tracking
    const analysisStmt = analyticsDb.prepare(`
      INSERT INTO execution_events (run_id, event_type, event_data)
      VALUES (?, ?, ?)
    `);

    analysisStmt.run(
      'analysis-' + Date.now(),
      'predictive_analysis',
      JSON.stringify({
        timeframe,
        predictionsCount: analysisResults.predictions.length,
        insightsCount: analysisResults.insights.length,
        avgFailureProbability: analysisResults.predictions.reduce((sum, p) => sum + p.failureProbability, 0) / analysisResults.predictions.length || 0
      })
    );

    res.json({
      success: true,
      analysis: analysisResults,
      summary: {
        predictionsGenerated: analysisResults.predictions.length,
        insightsGenerated: analysisResults.insights.length,
        highRiskPredictions: analysisResults.predictions.filter(p => p.failureProbability > 60).length,
        criticalInsights: analysisResults.insights.filter(i => i.severity === 'critical').length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to trigger predictive analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger predictive analysis'
    });
  }
});

export { router as realtimeAnalyticsRouter };