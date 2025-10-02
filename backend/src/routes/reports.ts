/**
 * Reports API Routes
 * Comprehensive test reports and analytics data with enhanced capabilities
 */

import { Router } from 'express';
import { join } from 'path';
import { existsSync, readFileSync, statSync } from 'fs';
import { asyncHandler } from '../middleware/error-handler';
import { logger } from '../utils/logger';
import { getReportsService } from '../services/reportsService';
import { getDatabase } from '../database/database';

const router = Router();

/**
 * GET /reports/runs/:runId/media/:artifactId
 * Get media artifact for test run
 */
router.get('/runs/:runId/media/:artifactId', asyncHandler(async (req, res) => {
  const { runId, artifactId } = req.params;
  
  logger.info('Media artifact requested', { runId, artifactId });
  
  const reportsService = getReportsService();
  const artifact = await reportsService.getArtifactInfo(runId, artifactId);
  
  if (!artifact) {
    return res.status(404).json({ error: 'Artifact not found' });
  }
  
  // Check if file exists
  if (!existsSync(artifact.path)) {
    return res.status(404).json({ error: 'Artifact file not found' });
  }
  
  // Serve the actual file
  res.sendFile(artifact.path);
}));

/**
 * GET /reports/summary
 * Get test reports summary
 */
router.get('/summary', asyncHandler(async (req, res) => {
  const reportsService = getReportsService();
  const summary = await reportsService.getTestReportsSummary();
  
  res.json(summary);
}));

/**
 * GET /reports/trends
 * Get test trend data
 */
router.get('/trends', asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  
  const reportsService = getReportsService();
  const trends = await reportsService.getTestTrends(parseInt(days as string));
  
  res.json(trends);
}));

/**
 * GET /reports/allure/:executionId
 * Serve Allure HTML report for a specific execution
 */
router.get('/allure/:executionId', asyncHandler(async (req, res) => {
  const { executionId } = req.params;
  const allureReportPath = join(process.cwd(), 'artifacts', 'executions', executionId, 'allure-report');
  const indexPath = join(allureReportPath, 'index.html');
  
  logger.info('Serving Allure report', { executionId, allureReportPath });
  
  if (!existsSync(indexPath)) {
    return res.status(404).json({
      error: 'Allure report not found',
      executionId,
      message: 'Allure report has not been generated for this execution'
    });
  }
  
  try {
    const htmlContent = readFileSync(indexPath, 'utf8');
    res.setHeader('Content-Type', 'text/html');
    res.send(htmlContent);
  } catch (error) {
    logger.error('Failed to serve Allure report', { executionId, error });
    res.status(500).json({
      error: 'Failed to read Allure report',
      executionId,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * GET /reports/allure/:executionId/assets/*
 * Serve Allure report assets (CSS, JS, images)
 */
router.get('/allure/:executionId/assets/*', asyncHandler(async (req, res) => {
  const { executionId } = req.params;
  const assetPath = req.params[0]; // Everything after 'assets/'
  const fullPath = join(process.cwd(), 'artifacts', 'executions', executionId, 'allure-report', assetPath);
  
  if (!existsSync(fullPath)) {
    return res.status(404).json({ error: 'Asset not found' });
  }
  
  try {
    const stat = statSync(fullPath);
    if (stat.isFile()) {
      // Set appropriate content type based on file extension
      const ext = assetPath.split('.').pop()?.toLowerCase();
      const contentTypes: Record<string, string> = {
        'js': 'application/javascript',
        'css': 'text/css',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'svg': 'image/svg+xml',
        'json': 'application/json'
      };
      
      if (ext && contentTypes[ext]) {
        res.setHeader('Content-Type', contentTypes[ext]);
      }
      
      const content = readFileSync(fullPath);
      res.send(content);
    } else {
      res.status(404).json({ error: 'Not a file' });
    }
  } catch (error) {
    logger.error('Failed to serve asset', { executionId, assetPath, error });
    res.status(500).json({ error: 'Failed to read asset' });
  }
}));

/**
 * GET /reports/logs/:executionId
 * Get formatted logs for a specific execution
 */
router.get('/logs/:executionId', asyncHandler(async (req, res) => {
  const { executionId } = req.params;
  const { format = 'json' } = req.query;
  
  // Try to find log files in the execution directory
  const artifactsDir = join(process.cwd(), 'artifacts', 'executions', executionId);
  
  if (!existsSync(artifactsDir)) {
    return res.status(404).json({
      error: 'Execution not found',
      executionId
    });
  }
  
  try {
    // Check for various log files
    const logSources = [
      join(artifactsDir, 'logs', 'test.log'),
      join(artifactsDir, 'pytest.log'),
      join(artifactsDir, 'execution.log')
    ];
    
    const logs = [];
    let rawOutput = '';
    
    // Try to read log files
    for (const logPath of logSources) {
      if (existsSync(logPath)) {
        const content = readFileSync(logPath, 'utf8');
        logs.push({
          source: logPath.split('/').pop(),
          content: content.split('\n').filter(line => line.trim())
        });
        rawOutput += content + '\n';
      }
    }
    
    // If no log files, try to get output from execution status
    if (logs.length === 0) {
      // This would need to be integrated with the execution tracking
      rawOutput = 'No log files found. Check execution status for stdout/stderr output.';
    }
    
    const response = {
      executionId,
      timestamp: new Date().toISOString(),
      logs,
      summary: {
        totalLines: rawOutput.split('\n').length,
        size: rawOutput.length,
        sources: logs.map(log => log.source)
      }
    };
    
    if (format === 'raw') {
      res.setHeader('Content-Type', 'text/plain');
      res.send(rawOutput);
    } else {
      res.json(response);
    }
    
  } catch (error) {
    logger.error('Failed to read logs', { executionId, error });
    res.status(500).json({
      error: 'Failed to read logs',
      executionId,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * GET /reports/artifacts/:executionId
 * List all available artifacts for an execution
 */
router.get('/artifacts/:executionId', asyncHandler(async (req, res) => {
  const { executionId } = req.params;
  const artifactsDir = join(process.cwd(), 'artifacts', 'executions', executionId);
  
  if (!existsSync(artifactsDir)) {
    return res.status(404).json({
      error: 'Execution not found',
      executionId
    });
  }
  
  try {
    const artifacts = [];
    
    // Check for standard artifacts
    const standardArtifacts = [
      { file: 'junit.xml', type: 'junit', name: 'JUnit XML Report' },
      { file: 'report.html', type: 'html', name: 'HTML Test Report' },
      { file: 'allure-report/index.html', type: 'allure', name: 'Allure Report' },
      { file: 'allure-results', type: 'allure-data', name: 'Allure Raw Data' }
    ];
    
    for (const artifact of standardArtifacts) {
      const fullPath = join(artifactsDir, artifact.file);
      if (existsSync(fullPath)) {
        const stat = statSync(fullPath);
        artifacts.push({
          type: artifact.type,
          name: artifact.name,
          path: artifact.file,
          size: stat.isFile() ? stat.size : null,
          isDirectory: stat.isDirectory(),
          url: `/api/reports/serve/${executionId}/${artifact.file}`,
          downloadUrl: `/api/reports/download/${executionId}/${artifact.file}`
        });
      }
    }
    
    res.json({
      executionId,
      artifacts,
      total: artifacts.length,
      directory: artifactsDir
    });
    
  } catch (error) {
    logger.error('Failed to list artifacts', { executionId, error });
    res.status(500).json({
      error: 'Failed to list artifacts',
      executionId,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * GET /reports/execution/:executionId
 * Get detailed execution report with real data
 */
router.get('/execution/:executionId', asyncHandler(async (req, res) => {
  const { executionId } = req.params;
  
  const reportsService = getReportsService();
  const report = await reportsService.getExecutionReport(executionId);
  
  if (!report) {
    return res.status(404).json({
      error: 'Execution report not found',
      executionId
    });
  }
  
  res.json(report);
}));

/**
 * GET /reports/dashboard
 * Get comprehensive dashboard statistics for reports
 */
router.get('/dashboard', asyncHandler(async (req, res) => {
  try {
    const db = getDatabase();
    const dbInstance = (db as any).db;

    // Get execution statistics (using schedule_runs table since test_runs doesn't exist)
    const execStats = await dbInstance.prepare(`
      SELECT
        COUNT(*) as totalExecutions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as passedExecutions,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failedExecutions,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as skippedExecutions,
        AVG(CASE WHEN duration_ms IS NOT NULL THEN duration_ms END) as avgDuration
      FROM schedule_runs
      WHERE started_at >= datetime('now', '-7 days')
    `).get() as any;

    // Get test statistics
    const testStats = await dbInstance.prepare(`
      SELECT
        COUNT(*) as totalTests,
        COUNT(CASE WHEN module = 'auth' THEN 1 END) as authTests,
        COUNT(CASE WHEN module = 'documents' THEN 1 END) as documentTests,
        COUNT(CASE WHEN module = 'templates' THEN 1 END) as templateTests,
        COUNT(CASE WHEN module = 'contacts' THEN 1 END) as contactTests
      FROM tests
    `).get() as any;

    // Calculate success rate
    const successRate = execStats.totalExecutions > 0
      ? Math.round((execStats.passedExecutions / execStats.totalExecutions) * 100)
      : 0;

    // Get recent execution trends (last 7 days) using schedule_runs
    const trendData = await dbInstance.prepare(`
      SELECT
        DATE(started_at) as date,
        COUNT(*) as executions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as passed,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
      FROM schedule_runs
      WHERE started_at >= datetime('now', '-7 days')
      GROUP BY DATE(started_at)
      ORDER BY date DESC
    `).all() as any[];

    const response = {
      summary: {
        totalExecutions: execStats.totalExecutions || 0,
        successRate,
        averageDuration: Math.round(execStats.avgDuration || 0),
        totalTests: testStats.totalTests || 0
      },
      status: {
        passed: execStats.passedExecutions || 0,
        failed: execStats.failedExecutions || 0,
        skipped: execStats.skippedExecutions || 0
      },
      testCategories: {
        auth: testStats.authTests || 0,
        documents: testStats.documentTests || 0,
        templates: testStats.templateTests || 0,
        contacts: testStats.contactTests || 0,
        other: (testStats.totalTests || 0) - (testStats.authTests + testStats.documentTests + testStats.templateTests + testStats.contactTests)
      },
      trends: trendData.map(day => ({
        date: day.date,
        executions: day.executions,
        successRate: day.executions > 0 ? Math.round((day.passed / day.executions) * 100) : 0,
        passed: day.passed,
        failed: day.failed
      })),
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to get reports dashboard', { error });
    res.status(500).json({
      error: 'Failed to get reports dashboard',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * GET /reports/test-execution
 * Get detailed test execution analytics
 */
router.get('/test-execution', asyncHandler(async (req, res) => {
  const { period = '7d', category, status } = req.query;

  try {
    const db = getDatabase();
    let periodCondition = '';

    // Set period condition
    switch (period) {
      case '24h':
        periodCondition = "AND tr.created_at >= datetime('now', '-1 day')";
        break;
      case '7d':
        periodCondition = "AND tr.created_at >= datetime('now', '-7 days')";
        break;
      case '30d':
        periodCondition = "AND tr.created_at >= datetime('now', '-30 days')";
        break;
      case '90d':
        periodCondition = "AND tr.created_at >= datetime('now', '-90 days')";
        break;
    }

    // Build query with filters
    let query = `
      SELECT
        tr.id,
        tr.status,
        tr.duration,
        tr.created_at,
        t.title,
        t.category,
        t.file_path,
        COUNT(CASE WHEN tr.status = 'passed' THEN 1 END) as passCount,
        COUNT(CASE WHEN tr.status = 'failed' THEN 1 END) as failCount
      FROM test_runs tr
      LEFT JOIN tests t ON tr.test_id = t.id
      WHERE 1=1 ${periodCondition}
    `;

    if (category) {
      query += ` AND t.category = ?`;
    }
    if (status) {
      query += ` AND tr.status = ?`;
    }

    query += ` GROUP BY tr.id ORDER BY tr.created_at DESC LIMIT 100`;

    const params = [];
    if (category) params.push(category);
    if (status) params.push(status);

    const executions = await dbInstance.prepare(query).all(...params) as any[];

    // Get summary statistics
    const summaryQuery = `
      SELECT
        COUNT(*) as totalExecutions,
        COUNT(CASE WHEN tr.status = 'passed' THEN 1 END) as passed,
        COUNT(CASE WHEN tr.status = 'failed' THEN 1 END) as failed,
        COUNT(CASE WHEN tr.status = 'skipped' THEN 1 END) as skipped,
        AVG(CASE WHEN tr.duration IS NOT NULL THEN tr.duration END) as avgDuration,
        MAX(tr.duration) as maxDuration,
        MIN(tr.duration) as minDuration
      FROM test_runs tr
      LEFT JOIN tests t ON tr.test_id = t.id
      WHERE 1=1 ${periodCondition}
      ${category ? 'AND t.category = ?' : ''}
      ${status ? 'AND tr.status = ?' : ''}
    `;

    const summary = await dbInstance.prepare(summaryQuery).get(...params) as any;

    const response = {
      period,
      filters: { category, status },
      summary: {
        totalExecutions: summary.totalExecutions || 0,
        passed: summary.passed || 0,
        failed: summary.failed || 0,
        skipped: summary.skipped || 0,
        successRate: summary.totalExecutions > 0
          ? Math.round((summary.passed / summary.totalExecutions) * 100)
          : 0,
        averageDuration: Math.round(summary.avgDuration || 0),
        maxDuration: summary.maxDuration || 0,
        minDuration: summary.minDuration || 0
      },
      executions: executions.map(exec => ({
        id: exec.id,
        status: exec.status,
        duration: exec.duration,
        createdAt: exec.created_at,
        test: {
          title: exec.title,
          category: exec.category,
          filePath: exec.file_path
        }
      })),
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to get test execution report', { error });
    res.status(500).json({
      error: 'Failed to get test execution report',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * GET /reports/performance
 * Get performance analytics and metrics
 */
router.get('/performance', asyncHandler(async (req, res) => {
  const { period = '7d' } = req.query;

  try {
    const db = getDatabase();
    let periodCondition = '';

    switch (period) {
      case '24h':
        periodCondition = "WHERE created_at >= datetime('now', '-1 day')";
        break;
      case '7d':
        periodCondition = "WHERE created_at >= datetime('now', '-7 days')";
        break;
      case '30d':
        periodCondition = "WHERE created_at >= datetime('now', '-30 days')";
        break;
    }

    // Get performance metrics
    const perfMetrics = await dbInstance.prepare(`
      SELECT
        AVG(duration) as avgDuration,
        MIN(duration) as fastestTest,
        MAX(duration) as slowestTest,
        COUNT(*) as totalTests,
        COUNT(CASE WHEN duration > 30000 THEN 1 END) as slowTests,
        COUNT(CASE WHEN duration <= 5000 THEN 1 END) as fastTests
      FROM test_runs
      ${periodCondition}
      AND duration IS NOT NULL
    `).get() as any;

    // Get performance trends by day
    const trendData = await dbInstance.prepare(`
      SELECT
        DATE(created_at) as date,
        AVG(duration) as avgDuration,
        MIN(duration) as minDuration,
        MAX(duration) as maxDuration,
        COUNT(*) as testCount
      FROM test_runs
      ${periodCondition}
      AND duration IS NOT NULL
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `).all() as any[];

    // Get slowest tests
    const slowestTests = await dbInstance.prepare(`
      SELECT
        tr.duration,
        t.title,
        t.category,
        t.file_path,
        tr.created_at
      FROM test_runs tr
      LEFT JOIN tests t ON tr.test_id = t.id
      ${periodCondition}
      AND tr.duration IS NOT NULL
      ORDER BY tr.duration DESC
      LIMIT 10
    `).all() as any[];

    const response = {
      period,
      summary: {
        averageDuration: Math.round(perfMetrics.avgDuration || 0),
        fastestTest: perfMetrics.fastestTest || 0,
        slowestTest: perfMetrics.slowestTest || 0,
        totalTests: perfMetrics.totalTests || 0,
        slowTests: perfMetrics.slowTests || 0,
        fastTests: perfMetrics.fastTests || 0,
        performanceScore: perfMetrics.totalTests > 0
          ? Math.round((perfMetrics.fastTests / perfMetrics.totalTests) * 100)
          : 0
      },
      trends: trendData.map(day => ({
        date: day.date,
        avgDuration: Math.round(day.avgDuration || 0),
        minDuration: day.minDuration || 0,
        maxDuration: day.maxDuration || 0,
        testCount: day.testCount || 0
      })),
      slowestTests: slowestTests.map(test => ({
        duration: test.duration,
        title: test.title,
        category: test.category,
        filePath: test.file_path,
        createdAt: test.created_at
      })),
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to get performance report', { error });
    res.status(500).json({
      error: 'Failed to get performance report',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * GET /reports/export
 * Export reports in various formats (CSV, JSON, PDF)
 */
router.get('/export', asyncHandler(async (req, res) => {
  const { format = 'json', type = 'summary', period = '7d' } = req.query;

  try {
    const db = getDatabase();
    let data: any = {};

    // Generate data based on type
    switch (type) {
      case 'summary':
        data = await dbInstance.prepare(`
          SELECT
            tr.id,
            tr.status,
            tr.duration,
            tr.created_at,
            t.title,
            t.category
          FROM test_runs tr
          LEFT JOIN tests t ON tr.test_id = t.id
          WHERE tr.created_at >= datetime('now', '-${period === '24h' ? '1 day' : period === '7d' ? '7 days' : '30 days'}')
          ORDER BY tr.created_at DESC
        `).all();
        break;

      case 'performance':
        data = await dbInstance.prepare(`
          SELECT
            t.category,
            AVG(tr.duration) as avgDuration,
            MIN(tr.duration) as minDuration,
            MAX(tr.duration) as maxDuration,
            COUNT(*) as testCount
          FROM test_runs tr
          LEFT JOIN tests t ON tr.test_id = t.id
          WHERE tr.created_at >= datetime('now', '-${period === '24h' ? '1 day' : period === '7d' ? '7 days' : '30 days'}')
          AND tr.duration IS NOT NULL
          GROUP BY t.category
        `).all();
        break;
    }

    // Format output based on requested format
    switch (format) {
      case 'csv':
        // Convert to CSV
        if (Array.isArray(data) && data.length > 0) {
          const headers = Object.keys(data[0]).join(',');
          const rows = data.map(row => Object.values(row).join(',')).join('\n');
          const csv = `${headers}\n${rows}`;

          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="report-${type}-${period}-${Date.now()}.csv"`);
          res.send(csv);
        } else {
          res.status(400).json({ error: 'No data available for CSV export' });
        }
        break;

      case 'json':
      default:
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="report-${type}-${period}-${Date.now()}.json"`);
        res.json({
          type,
          period,
          exportedAt: new Date().toISOString(),
          data
        });
        break;
    }
  } catch (error) {
    logger.error('Failed to export report', { error });
    res.status(500).json({
      error: 'Failed to export report',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

export { router as reportsRouter };