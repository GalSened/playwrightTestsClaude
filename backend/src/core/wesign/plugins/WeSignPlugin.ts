/**
 * WeSign Core Plugin - Phase 2 Implementation
 * Updated to use UnifiedTestEngine and ExecutionManager
 */

import { TestPlugin, PluginMetadata } from './PluginBase';
import {
  UnifiedTestConfig,
  ExecutionHandle,
  TestInfo,
  PluginHealth,
  PluginExecutionConfig,
  EventType
} from '../types';
import { logger } from '../../../utils/logger';
import { unifiedTestEngine } from '../UnifiedTestEngine';
import { executionManager } from '../ExecutionManager';

export class WeSignPlugin extends TestPlugin {
  readonly metadata: PluginMetadata = {
    id: 'wesign-core',
    name: 'WeSign Core Testing Framework',
    version: '2.1.0',
    description: 'Phase 2 - Unified WeSign testing with intelligent execution management',
    author: 'WeSign Team',
    supportedFeatures: [
      'python-tests',
      'playwright-automation',
      'headed-execution',
      'parallel-execution',
      'real-time-monitoring',
      'screenshot-capture',
      'video-recording',
      'ai-enhanced-execution',
      'intelligent-scheduling',
      'auto-healing',
      'concurrent-management'
    ],
    dependencies: ['python', 'pytest', 'playwright']
  };

  async execute(config: PluginExecutionConfig): Promise<ExecutionHandle> {
    logger.info('WeSign plugin executing via UnifiedTestEngine', {
      executionId: config.executionId,
      framework: config.framework,
      tests: config.tests
    });

    try {
      // Convert plugin config to unified config
      const unifiedConfig: UnifiedTestConfig = {
        framework: 'wesign',
        execution: {
          mode: config.execution.mode || 'parallel',
          workers: config.execution.workers,
          timeout: config.execution.timeout,
          browser: config.execution.browser,
          headless: config.execution.headless
        },
        tests: {
          testIds: config.tests.testIds,
          suites: config.tests.suites,
          tags: config.tests.tags,
          categories: config.tests.categories,
          pattern: config.tests.pattern
        },
        ai: {
          enabled: config.ai.enabled,
          autoHeal: config.ai.autoHeal,
          generateInsights: config.ai.generateInsights,
          predictFlakiness: config.ai.predictFlakiness
        },
        realTime: {
          monitoring: config.realTime.monitoring,
          notifications: config.realTime.notifications,
          streaming: config.realTime.streaming
        }
      };

      // Use unified test engine for execution
      const executionHandle = await unifiedTestEngine.executeTests(unifiedConfig);

      logger.info('WeSign plugin execution started via UnifiedTestEngine', {
        executionId: executionHandle.executionId,
        status: executionHandle.status
      });

      return executionHandle;

    } catch (error) {
      logger.error('WeSign plugin execution failed', {
        executionId: config.executionId,
        error: error instanceof Error ? error.message : error
      });

      // Return failed execution handle
      return {
        executionId: config.executionId,
        status: 'failed',
        framework: 'wesign',
        startTime: new Date()
      };
    }
  }

  async discover(paths: string[]): Promise<TestInfo[]> {
    logger.info('WeSign plugin discovering tests', { paths });

    try {
      // Use existing test discovery service functionality
      const { testDiscoveryService } = await import('../../../services/testDiscoveryService');

      if (!testDiscoveryService) {
        logger.warn('TestDiscoveryService not available, using basic discovery');
        return [];
      }

      const { tests } = await testDiscoveryService.getTests({
        category: 'wesign'
      });

      logger.info('WeSign plugin discovered tests', { count: tests.length });
      return tests;

    } catch (error) {
      logger.error('WeSign test discovery failed', {
        error: error instanceof Error ? error.message : error
      });
      return [];
    }
  }

  async healthCheck(): Promise<PluginHealth> {
    try {
      // Check unified test engine health
      const engineHealth = await unifiedTestEngine.healthCheck();

      if (!engineHealth.healthy) {
        return {
          status: 'unhealthy',
          message: 'UnifiedTestEngine health check failed',
          lastCheck: new Date()
        };
      }

      // Check WeSign adapter specifically
      const wesignAdapterHealthy = engineHealth.adapters['wesign'];
      if (!wesignAdapterHealthy) {
        return {
          status: 'unhealthy',
          message: 'WeSign adapter health check failed',
          lastCheck: new Date()
        };
      }

      // Check execution manager
      const resourceUsage = await executionManager.getResourceUsage();
      if (!resourceUsage.available) {
        return {
          status: 'degraded',
          message: 'System resources are at capacity',
          lastCheck: new Date()
        };
      }

      return {
        status: 'healthy',
        message: 'WeSign plugin ready with unified engine support',
        lastCheck: new Date()
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: new Date()
      };
    }
  }

  getConfigSchema(): any {
    return {
      type: 'object',
      properties: {
        execution: {
          type: 'object',
          properties: {
            mode: { type: 'string', enum: ['single', 'parallel'] },
            workers: { type: 'number', minimum: 1, maximum: 10 },
            timeout: { type: 'number', minimum: 1000 },
            browser: { type: 'string', enum: ['chromium', 'firefox', 'webkit'] },
            headless: { type: 'boolean' }
          }
        },
        tests: {
          type: 'object',
          properties: {
            testIds: { type: 'array', items: { type: 'string' } },
            suites: { type: 'array', items: { type: 'string' } },
            categories: { type: 'array', items: { type: 'string' } },
            pattern: { type: 'string' }
          }
        }
      }
    };
  }

  validateConfig(config: any): boolean {
    // Basic validation - could be enhanced with JSON schema validation
    return config && typeof config === 'object';
  }

  async cleanup(): Promise<void> {
    logger.info('WeSign plugin cleaning up...');

    // Cleanup is now handled by the UnifiedTestEngine and ExecutionManager
    // This plugin no longer manages processes directly

    logger.info('WeSign plugin cleanup complete - delegated to unified engine');
  }

  // Get execution status via unified engine
  async getExecutionStatus(executionId: string): Promise<ExecutionHandle | null> {
    try {
      const status = await unifiedTestEngine.getExecutionStatus(executionId);
      return status;
    } catch (error) {
      logger.error('Failed to get execution status', { executionId, error });
      return null;
    }
  }

}