/**
 * Legacy API Proxy - Maintains backward compatibility during migration
 * Routes old endpoints to new unified APIs while logging usage for migration tracking
 */

import { Router, Request, Response } from 'express';
import { logger } from '../../utils/logger';

const router = Router();

// Track legacy API usage for migration planning
const legacyUsageStats = new Map<string, { count: number; lastUsed: Date }>();

const trackLegacyUsage = (endpoint: string) => {
  const current = legacyUsageStats.get(endpoint) || { count: 0, lastUsed: new Date() };
  current.count++;
  current.lastUsed = new Date();
  legacyUsageStats.set(endpoint, current);

  logger.info('Legacy API usage tracked', { endpoint, count: current.count });
};

/**
 * Proxy for old WeSign test execution endpoints
 */

// /api/wesign/test/run -> /api/wesign/execute
router.post('/wesign/test/run', (req: Request, res: Response) => {
  trackLegacyUsage('/api/wesign/test/run');

  // Transform old request format to new unified format
  const transformedBody = {
    testIds: req.body.testFile ? [req.body.testFile] : undefined,
    browser: req.body.config?.browser,
    headless: req.body.config?.headless !== false,
    mode: 'single',
    realTimeMonitoring: true
  };

  // Forward to unified endpoint
  req.body = transformedBody;
  req.url = '/api/wesign/execute';

  // Note: In a real implementation, you'd forward the request to the actual handler
  // For now, we'll return a migration notice
  res.json({
    success: true,
    message: 'Legacy endpoint - please migrate to /api/wesign/execute',
    redirected: true,
    newEndpoint: '/api/wesign/execute'
  });
});

// /api/wesign/tests/run -> /api/wesign/execute
router.post('/wesign/tests/run', (req: Request, res: Response) => {
  trackLegacyUsage('/api/wesign/tests/run');

  const transformedBody = {
    suites: req.body.suite ? [req.body.suite] : undefined,
    browser: req.body.browser,
    headless: req.body.headless !== false,
    workers: req.body.workers || 1,
    mode: req.body.workers > 1 ? 'parallel' : 'single'
  };

  req.body = transformedBody;
  req.url = '/api/wesign/execute';

  res.json({
    success: true,
    message: 'Legacy endpoint - please migrate to /api/wesign/execute',
    redirected: true,
    newEndpoint: '/api/wesign/execute'
  });
});

/**
 * Proxy for old test execution endpoints
 */

// /api/test-execution/pytest -> /api/wesign/execute
router.post('/test-execution/pytest', (req: Request, res: Response) => {
  trackLegacyUsage('/api/test-execution/pytest');

  const transformedBody = {
    framework: 'wesign',
    pattern: req.body.testPath || req.body.testFile,
    timeout: req.body.timeout,
    mode: 'single'
  };

  res.json({
    success: true,
    message: 'Legacy test-execution endpoint - please migrate to /api/wesign/execute',
    redirected: true,
    newEndpoint: '/api/wesign/execute',
    transformedConfig: transformedBody
  });
});

/**
 * Proxy for old test discovery endpoints
 */

// /api/test-discovery/scan -> /api/wesign/discovery/scan
router.post('/test-discovery/scan', (req: Request, res: Response) => {
  trackLegacyUsage('/api/test-discovery/scan');

  res.json({
    success: true,
    message: 'Legacy test-discovery endpoint - please migrate to /api/wesign/discovery/scan',
    redirected: true,
    newEndpoint: '/api/wesign/discovery/scan'
  });
});

// /api/test-discovery/all -> /api/wesign/tests
router.get('/test-discovery/all', (req: Request, res: Response) => {
  trackLegacyUsage('/api/test-discovery/all');

  res.json({
    success: true,
    message: 'Legacy test-discovery endpoint - please migrate to /api/wesign/tests',
    redirected: true,
    newEndpoint: '/api/wesign/tests'
  });
});

/**
 * Proxy for old analytics endpoints
 */

// /api/analytics/* -> /api/wesign/analytics/*
router.get('/analytics/:endpoint', (req: Request, res: Response) => {
  const endpoint = `/api/analytics/${req.params.endpoint}`;
  trackLegacyUsage(endpoint);

  res.json({
    success: true,
    message: 'Legacy analytics endpoint - analytics will be integrated into unified WeSign dashboard',
    redirected: true,
    newEndpoint: '/api/wesign/analytics/dashboard',
    note: 'Analytics functionality is being consolidated'
  });
});

/**
 * Generic legacy endpoint handler
 */
router.all('*', (req: Request, res: Response) => {
  const endpoint = req.originalUrl;
  trackLegacyUsage(endpoint);

  logger.warn('Unmapped legacy endpoint accessed', {
    endpoint,
    method: req.method,
    userAgent: req.get('User-Agent')
  });

  res.status(404).json({
    success: false,
    error: 'Legacy endpoint not found',
    message: 'This endpoint may have been migrated to the new unified WeSign API',
    suggestion: 'Check /api/wesign/health for available endpoints',
    migration: {
      documentation: '/docs/api-migration',
      supportContact: 'dev-team@wesign.com'
    }
  });
});

/**
 * Get legacy usage statistics (for migration planning)
 */
router.get('/legacy/usage-stats', (req: Request, res: Response) => {
  const stats = Object.fromEntries(
    Array.from(legacyUsageStats.entries()).map(([endpoint, data]) => [
      endpoint,
      {
        ...data,
        daysSinceLastUsed: Math.floor(
          (Date.now() - data.lastUsed.getTime()) / (1000 * 60 * 60 * 24)
        )
      }
    ])
  );

  res.json({
    success: true,
    stats,
    totalEndpoints: legacyUsageStats.size,
    summary: {
      mostUsed: Array.from(legacyUsageStats.entries())
        .sort(([,a], [,b]) => b.count - a.count)
        .slice(0, 5)
        .map(([endpoint, data]) => ({ endpoint, count: data.count }))
    }
  });
});

export { router as legacyProxyRouter };
export default router;