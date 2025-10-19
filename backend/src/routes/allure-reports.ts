/**
 * Allure Reports API Routes
 * Handles Allure report generation, serving, and management
 */

import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);
const router = express.Router();

// Base paths for Allure reports
const WESIGN_TESTS_ROOT = path.resolve(__dirname, '../../../../new_tests_for_wesign');
const ALLURE_RESULTS_BASE = path.join(WESIGN_TESTS_ROOT, 'reports', 'allure-results');
const ALLURE_REPORTS_BASE = path.join(WESIGN_TESTS_ROOT, 'reports', 'allure-reports');

/**
 * Generate Allure HTML report from results
 * POST /api/allure/generate
 */
router.post('/generate', async (req, res) => {
  try {
    const { resultsPath, outputPath, reportName } = req.body;

    const actualResultsPath = resultsPath || ALLURE_RESULTS_BASE;
    const reportId = reportName || `report-${Date.now()}`;
    const actualOutputPath = outputPath || path.join(ALLURE_REPORTS_BASE, reportId);

    logger.info('Generating Allure report', {
      resultsPath: actualResultsPath,
      outputPath: actualOutputPath,
      reportId
    });

    // Ensure output directory exists
    await fs.mkdir(path.dirname(actualOutputPath), { recursive: true });

    // Generate Allure report using allure-commandline
    const command = `npx allure generate "${actualResultsPath}" -o "${actualOutputPath}" --clean`;
    logger.info('Executing Allure command', { command });

    const { stdout, stderr } = await execAsync(command, {
      cwd: WESIGN_TESTS_ROOT,
      timeout: 60000 // 1 minute timeout
    });

    if (stderr && !stderr.includes('Report successfully generated')) {
      logger.warn('Allure generation stderr', { stderr });
    }

    logger.info('Allure report generated successfully', { reportId, stdout });

    // Check if report was actually created
    const reportIndexPath = path.join(actualOutputPath, 'index.html');
    try {
      await fs.access(reportIndexPath);
    } catch {
      throw new Error('Report index.html not found after generation');
    }

    res.json({
      success: true,
      reportId,
      reportPath: actualOutputPath,
      reportUrl: `/api/allure/view/${reportId}`,
      message: 'Allure report generated successfully'
    });
  } catch (error: any) {
    logger.error('Failed to generate Allure report', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: 'Failed to generate Allure report',
      details: error.message
    });
  }
});

/**
 * Serve Allure report HTML (static files)
 * GET /api/allure/view/:reportId
 */
router.get('/view/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;
    const reportPath = path.join(ALLURE_REPORTS_BASE, reportId);

    logger.info('Serving Allure report', { reportId, reportPath });

    // Check if report exists
    try {
      await fs.access(reportPath);
    } catch {
      return res.status(404).json({
        success: false,
        error: 'Report not found',
        reportId
      });
    }

    // Redirect to static file server (served by express.static in server.ts)
    res.redirect(`/allure-reports/${reportId}/index.html`);
  } catch (error: any) {
    logger.error('Failed to serve Allure report', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to serve report',
      details: error.message
    });
  }
});

/**
 * List all available Allure reports
 * GET /api/allure/list
 */
router.get('/list', async (req, res) => {
  try {
    logger.info('Listing Allure reports', { basePath: ALLURE_REPORTS_BASE });

    // Ensure reports directory exists
    await fs.mkdir(ALLURE_REPORTS_BASE, { recursive: true });

    // Read all report directories
    const entries = await fs.readdir(ALLURE_REPORTS_BASE, { withFileTypes: true });
    const reportDirs = entries.filter(entry => entry.isDirectory());

    // Get metadata for each report
    const reports = await Promise.all(
      reportDirs.map(async (dir) => {
        const reportPath = path.join(ALLURE_REPORTS_BASE, dir.name);
        const indexPath = path.join(reportPath, 'index.html');

        try {
          const stats = await fs.stat(indexPath);
          const widgetsPath = path.join(reportPath, 'widgets', 'summary.json');

          let summary = null;
          try {
            const summaryContent = await fs.readFile(widgetsPath, 'utf-8');
            summary = JSON.parse(summaryContent);
          } catch {
            // Summary not available
          }

          return {
            reportId: dir.name,
            reportName: dir.name.replace(/^report-/, ''),
            createdAt: stats.mtime.toISOString(),
            reportUrl: `/api/allure/view/${dir.name}`,
            summary: summary ? {
              total: summary.statistic?.total || 0,
              passed: summary.statistic?.passed || 0,
              failed: summary.statistic?.failed || 0,
              broken: summary.statistic?.broken || 0,
              skipped: summary.statistic?.skipped || 0,
              unknown: summary.statistic?.unknown || 0
            } : null
          };
        } catch {
          return null;
        }
      })
    );

    // Filter out null entries and sort by creation date (newest first)
    const validReports = reports
      .filter(report => report !== null)
      .sort((a, b) => new Date(b!.createdAt).getTime() - new Date(a!.createdAt).getTime());

    logger.info('Reports listed successfully', { count: validReports.length });

    res.json({
      success: true,
      reports: validReports,
      count: validReports.length
    });
  } catch (error: any) {
    logger.error('Failed to list Allure reports', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to list reports',
      details: error.message
    });
  }
});

/**
 * Delete an Allure report
 * DELETE /api/allure/delete/:reportId
 */
router.delete('/delete/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;
    const reportPath = path.join(ALLURE_REPORTS_BASE, reportId);

    logger.info('Deleting Allure report', { reportId, reportPath });

    // Check if report exists
    try {
      await fs.access(reportPath);
    } catch {
      return res.status(404).json({
        success: false,
        error: 'Report not found',
        reportId
      });
    }

    // Delete report directory recursively
    await fs.rm(reportPath, { recursive: true, force: true });

    logger.info('Report deleted successfully', { reportId });

    res.json({
      success: true,
      message: 'Report deleted successfully',
      reportId
    });
  } catch (error: any) {
    logger.error('Failed to delete Allure report', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to delete report',
      details: error.message
    });
  }
});

/**
 * Get Allure report summary/statistics
 * GET /api/allure/summary/:reportId
 */
router.get('/summary/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;
    const reportPath = path.join(ALLURE_REPORTS_BASE, reportId);
    const summaryPath = path.join(reportPath, 'widgets', 'summary.json');

    logger.info('Getting Allure report summary', { reportId });

    // Check if summary exists
    try {
      await fs.access(summaryPath);
    } catch {
      return res.status(404).json({
        success: false,
        error: 'Report summary not found',
        reportId
      });
    }

    // Read and parse summary
    const summaryContent = await fs.readFile(summaryPath, 'utf-8');
    const summary = JSON.parse(summaryContent);

    logger.info('Report summary retrieved', { reportId });

    res.json({
      success: true,
      reportId,
      summary: {
        total: summary.statistic?.total || 0,
        passed: summary.statistic?.passed || 0,
        failed: summary.statistic?.failed || 0,
        broken: summary.statistic?.broken || 0,
        skipped: summary.statistic?.skipped || 0,
        unknown: summary.statistic?.unknown || 0,
        time: summary.time || {}
      }
    });
  } catch (error: any) {
    logger.error('Failed to get report summary', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get report summary',
      details: error.message
    });
  }
});

/**
 * Health check for Allure service
 * GET /api/allure/health
 */
router.get('/health', async (req, res) => {
  try {
    // Check if allure-commandline is available
    const { stdout } = await execAsync('npx allure --version', {
      cwd: WESIGN_TESTS_ROOT,
      timeout: 10000
    });

    const allureVersion = stdout.trim();

    res.json({
      success: true,
      healthy: true,
      allureVersion,
      resultsPath: ALLURE_RESULTS_BASE,
      reportsPath: ALLURE_REPORTS_BASE,
      message: 'Allure service is healthy'
    });
  } catch (error: any) {
    logger.error('Allure health check failed', { error: error.message });
    res.status(503).json({
      success: false,
      healthy: false,
      error: 'Allure commandline not available',
      details: error.message
    });
  }
});

export { router as allureRouter };
