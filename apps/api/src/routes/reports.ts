/**
 * Reports API Routes
 * Handles test reports and analytics data
 */

import { Router } from 'express';
import { join } from 'path';
import { existsSync, readFileSync, statSync } from 'fs';
import { asyncHandler } from '../middleware/error-handler';
import { logger } from '../utils/logger';
import { getReportsService } from '../services/reportsService';

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

export { router as reportsRouter };