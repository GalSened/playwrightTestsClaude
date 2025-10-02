/**
 * Unified WeSign API Routes - Phase 2 Implementation
 * Updated to use UnifiedTestEngine, ExecutionManager, and TestScheduler
 * Maintains backward compatibility with existing API consumers
 */

import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';
import { globalEventBus } from '../../core/wesign/EventBus';
import { globalPluginManager } from '../../core/wesign/PluginManager';
import { WeSignPlugin } from '../../core/wesign/plugins/WeSignPlugin';
import { unifiedTestEngine } from '../../core/wesign/UnifiedTestEngine';
import { executionManager } from '../../core/wesign/ExecutionManager';
import { testScheduler } from '../../core/wesign/TestScheduler';
import { UnifiedTestConfig, EventType } from '../../core/wesign/types';
import { logger } from '../../utils/logger';
import { wesignAnalyticsService } from '../../services/wesignAnalyticsService';

const router = Router();

// Initialize WeSign plugin on first use
let wesignPlugin: WeSignPlugin | null = null;
const initializeWeSignPlugin = async () => {
  if (!wesignPlugin) {
    wesignPlugin = new WeSignPlugin();
    await globalPluginManager.register(wesignPlugin);
    logger.info('WeSign plugin initialized and registered');
  }
  return wesignPlugin;
};

/**
 * Unified Test Execution Endpoint - Phase 2
 * Now uses UnifiedTestEngine with intelligent execution management
 * Replaces: /api/test-execution/*, /api/wesign/test/*, /api/test-runs/*
 */
router.post('/execute', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config: UnifiedTestConfig = {
      framework: req.body.framework || 'wesign',
      execution: {
        mode: req.body.mode || 'parallel',
        workers: req.body.workers || 2,
        timeout: req.body.timeout || 300000, // 5 minutes default
        browser: req.body.browser || 'chromium',
        headless: req.body.headless !== false
      },
      tests: {
        testIds: req.body.testIds,
        suites: req.body.suites,
        tags: req.body.tags,
        categories: req.body.categories,
        pattern: req.body.pattern
      },
      ai: {
        enabled: req.body.aiEnabled !== false, // AI enabled by default
        autoHeal: req.body.autoHeal !== false,
        generateInsights: req.body.generateInsights !== false,
        predictFlakiness: req.body.predictFlakiness || false
      },
      realTime: {
        monitoring: req.body.realTimeMonitoring !== false,
        notifications: req.body.notifications !== false,
        streaming: req.body.streaming !== false
      }
    };

    // Use priority execution via ExecutionManager for better resource management
    const priority = req.body.priority || 'normal';
    const scheduledTime = req.body.scheduledTime ? new Date(req.body.scheduledTime) : undefined;

    const executionId = await executionManager.queueExecution(
      config,
      {
        priority,
        scheduledTime,
        timeout: config.execution.timeout
      },
      req.body.requestedBy || 'api'
    );

    logger.info('Unified test execution queued', {
      executionId,
      priority,
      config: {
        framework: config.framework,
        mode: config.execution.mode,
        tests: Object.keys(config.tests).filter(key => config.tests[key as keyof typeof config.tests])
      }
    });

    res.json({
      success: true,
      executionId,
      status: 'queued',
      message: 'Test execution queued successfully',
      estimatedStartTime: scheduledTime,
      queuePosition: (await executionManager.getQueueStatus()).totalQueued
    });

  } catch (error) {
    logger.error('Unified test execution failed', {
      error: error instanceof Error ? error.message : error,
      body: req.body
    });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get Execution Status - Phase 2
 * Enhanced with ExecutionManager integration
 */
router.get('/execute/:executionId/status', async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;

    // Check both ExecutionManager and UnifiedTestEngine
    let status = await executionManager.getExecutionStatus(executionId);

    if (!status) {
      status = await unifiedTestEngine.getExecutionStatus(executionId);
    }

    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'Execution not found'
      });
    }

    // Get additional execution details
    const artifacts = await unifiedTestEngine.getExecutionArtifacts(executionId);

    res.json({
      success: true,
      execution: {
        ...status,
        artifacts: artifacts ? {
          screenshots: artifacts.screenshots.length,
          videos: artifacts.videos.length,
          traces: artifacts.traces.length,
          reports: artifacts.reports.length,
          logs: artifacts.logs.length
        } : undefined
      }
    });

  } catch (error) {
    logger.error('Failed to get execution status', {
      executionId: req.params.executionId,
      error: error instanceof Error ? error.message : error
    });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Cancel Execution - Phase 2
 */
router.post('/execute/:executionId/cancel', async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;

    const cancelled = await executionManager.cancelExecution(executionId);

    if (!cancelled) {
      // Try unified engine as fallback
      const cancelledEngine = await unifiedTestEngine.cancelExecution(executionId);
      if (!cancelledEngine) {
        return res.status(404).json({
          success: false,
          error: 'Execution not found or cannot be cancelled'
        });
      }
    }

    res.json({
      success: true,
      message: 'Execution cancelled successfully'
    });

  } catch (error) {
    logger.error('Failed to cancel execution', {
      executionId: req.params.executionId,
      error: error instanceof Error ? error.message : error
    });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get Execution Artifacts
 */
router.get('/execute/:executionId/artifacts', async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;
    const artifacts = await unifiedTestEngine.getExecutionArtifacts(executionId);

    if (!artifacts) {
      return res.status(404).json({
        success: false,
        error: 'Execution or artifacts not found'
      });
    }

    res.json({
      success: true,
      executionId,
      artifacts
    });

  } catch (error) {
    logger.error('Failed to get execution artifacts', {
      executionId: req.params.executionId,
      error: error instanceof Error ? error.message : error
    });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get Queue Status - New Phase 2 Feature
 */
router.get('/queue/status', async (req: Request, res: Response) => {
  try {
    const queueStatus = executionManager.getQueueStatus();
    const resourceUsage = await executionManager.getResourceUsage();

    res.json({
      success: true,
      queue: queueStatus,
      resources: resourceUsage,
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('Failed to get queue status', {
      error: error instanceof Error ? error.message : error
    });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Real-time Event Stream (WebSocket upgrade)
 */
router.get('/execute/:executionId/stream', (req: Request, res: Response, next: NextFunction) => {
  // This will be handled by WebSocket middleware
  // For now, return connection info
  res.json({
    success: true,
    websocketUrl: `/ws/wesign/execute/${req.params.executionId}`,
    message: 'Connect to WebSocket for real-time updates'
  });
});

/**
 * Test Discovery Endpoint
 * Replaces: /api/test-discovery/*
 */
router.post('/discovery/scan', async (req: Request, res: Response) => {
  try {
    const { directories = ['.'], frameworks = ['wesign'] } = req.body;
    const plugin = await initializeWeSignPlugin();

    // Emit scan started event
    await globalEventBus.createAndPublish(
      EventType.DISCOVERY_COMPLETED,
      'WeSignAPI',
      { directories, frameworks, startTime: new Date() }
    );

    const tests = await plugin.discover(directories);
    const scanId = uuidv4();

    logger.info('Test discovery completed', {
      scanId,
      directories,
      discovered: tests.length
    });

    res.json({
      success: true,
      scanId,
      discovered: tests.length,
      tests: tests.slice(0, 100) // Limit response size
    });

  } catch (error) {
    logger.error('Test discovery failed', {
      error: error instanceof Error ? error.message : error
    });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get Tests with Filtering
 */
router.get('/tests', async (req: Request, res: Response) => {
  try {
    const plugin = await initializeWeSignPlugin();
    const tests = await plugin.discover(['.']);

    // Apply filtering based on query parameters
    let filteredTests = tests;

    if (req.query.category) {
      filteredTests = filteredTests.filter(test =>
        test.category === req.query.category
      );
    }

    if (req.query.tag) {
      filteredTests = filteredTests.filter(test =>
        test.tags.includes(req.query.tag as string)
      );
    }

    if (req.query.search) {
      const search = (req.query.search as string).toLowerCase();
      filteredTests = filteredTests.filter(test =>
        test.testName.toLowerCase().includes(search) ||
        test.description?.toLowerCase().includes(search)
      );
    }

    // Pagination
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const paginatedTests = filteredTests.slice(offset, offset + limit);

    res.json({
      success: true,
      tests: paginatedTests,
      total: filteredTests.length,
      limit,
      offset
    });

  } catch (error) {
    logger.error('Failed to get tests', {
      error: error instanceof Error ? error.message : error
    });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Test Scheduling Endpoints - New Phase 2 Features
 */

// Create scheduled test run
router.post('/schedule', async (req: Request, res: Response) => {
  try {
    const scheduleConfig = {
      name: req.body.name,
      description: req.body.description,
      cronExpression: req.body.cronExpression,
      testConfig: req.body.testConfig,
      priority: req.body.priority || 'normal',
      enabled: req.body.enabled !== false,
      retryConfig: req.body.retryConfig,
      notifications: req.body.notifications,
      conditions: req.body.conditions
    };

    const scheduleId = await testScheduler.createSchedule(scheduleConfig);

    res.json({
      success: true,
      scheduleId,
      message: 'Test schedule created successfully'
    });

  } catch (error) {
    logger.error('Failed to create test schedule', {
      error: error instanceof Error ? error.message : error
    });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get all schedules
router.get('/schedules', async (req: Request, res: Response) => {
  try {
    const schedules = testScheduler.getSchedules();

    res.json({
      success: true,
      schedules
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update schedule
router.put('/schedule/:scheduleId', async (req: Request, res: Response) => {
  try {
    const { scheduleId } = req.params;
    const updated = await testScheduler.updateSchedule(scheduleId, req.body);

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Schedule not found'
      });
    }

    res.json({
      success: true,
      message: 'Schedule updated successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete schedule
router.delete('/schedule/:scheduleId', async (req: Request, res: Response) => {
  try {
    const { scheduleId } = req.params;
    const deleted = await testScheduler.deleteSchedule(scheduleId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Schedule not found'
      });
    }

    res.json({
      success: true,
      message: 'Schedule deleted successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Health Check Endpoint - Phase 2 Enhanced
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const plugin = await initializeWeSignPlugin();
    const pluginHealth = await plugin.healthCheck();
    const eventBusStats = globalEventBus.getStats();
    const pluginManagerStats = globalPluginManager.getStats();
    const engineHealth = await unifiedTestEngine.healthCheck();
    const resourceUsage = await executionManager.getResourceUsage();

    const health = {
      status: pluginHealth.status === 'healthy' && engineHealth.healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date(),
      version: '2.0',
      components: {
        wesignPlugin: pluginHealth,
        unifiedEngine: {
          status: engineHealth.healthy ? 'healthy' : 'unhealthy',
          adapters: engineHealth.adapters
        },
        executionManager: {
          status: resourceUsage.available ? 'healthy' : 'degraded',
          queueSize: executionManager.getQueueStatus().totalQueued,
          runningExecutions: executionManager.getQueueStatus().totalRunning,
          resources: {
            memory: `${resourceUsage.memoryMB}MB / ${resourceUsage.limits.maxMemoryMB}MB`,
            cpu: `${resourceUsage.cpuPercentage}% / ${resourceUsage.limits.maxCpuPercentage}%`
          }
        },
        testScheduler: {
          status: 'healthy',
          activeSchedules: testScheduler.getSchedules().filter(s => s.config.enabled).length
        },
        eventBus: {
          status: 'healthy',
          wsClients: eventBusStats.wsClients,
          subscribers: Object.keys(eventBusStats.subscribers).length
        },
        pluginManager: {
          status: 'healthy',
          totalPlugins: pluginManagerStats.totalPlugins
        }
      }
    };

    const httpStatus = health.status === 'healthy' ? 200 : 503;

    res.status(httpStatus).json({
      success: health.status === 'healthy',
      health
    });

  } catch (error) {
    logger.error('Health check failed', {
      error: error instanceof Error ? error.message : error
    });

    res.status(500).json({
      success: false,
      error: 'Health check failed'
    });
  }
});

/**
 * Get Statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const eventBusStats = globalEventBus.getStats();
    const pluginManagerStats = globalPluginManager.getStats();

    res.json({
      success: true,
      stats: {
        eventBus: eventBusStats,
        pluginManager: pluginManagerStats,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Analytics Endpoints - Phase 2.4
 * Provides execution metrics and test insights
 */

/**
 * POST /analytics/metrics
 * Get execution metrics with optional filters
 * Body: { timeRange?: { start, end }, module?: string, limit?: number }
 */
router.post('/analytics/metrics', async (req: Request, res: Response) => {
  try {
    logger.info('Analytics metrics requested', { body: req.body });

    const options = {
      timeRange: req.body.timeRange,
      module: req.body.module,
      limit: req.body.limit || 10
    };

    const metrics = await wesignAnalyticsService.getMetrics(options);

    res.json({
      success: true,
      metrics
    });

  } catch (error) {
    logger.error('Failed to get analytics metrics', {
      error: error instanceof Error ? error.message : error
    });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate metrics'
    });
  }
});

/**
 * POST /analytics/insights
 * Get test insights including flakiness, coverage, and performance trends
 * Body: { limit?: number }
 */
router.post('/analytics/insights', async (req: Request, res: Response) => {
  try {
    logger.info('Analytics insights requested', { body: req.body });

    const options = {
      limit: req.body.limit || 10
    };

    const insights = await wesignAnalyticsService.getInsights(options);

    res.json({
      success: true,
      insights
    });

  } catch (error) {
    logger.error('Failed to get analytics insights', {
      error: error instanceof Error ? error.message : error
    });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate insights'
    });
  }
});

/**
 * GET /analytics/quick-stats
 * Get quick statistics for dashboard display
 */
router.get('/analytics/quick-stats', async (req: Request, res: Response) => {
  try {
    const stats = await wesignAnalyticsService.getQuickStats();

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    logger.error('Failed to get quick stats', {
      error: error instanceof Error ? error.message : error
    });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get quick stats'
    });
  }
});

/**
 * Error handling middleware
 */
router.use((error: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('WeSign API error', {
    path: req.path,
    method: req.method,
    error: error.message,
    stack: error.stack
  });

  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

export { router as wesignRouter };
export default router;