/**
 * WeSign Core - Central orchestrator for the unified testing platform
 * Main entry point for all WeSign functionality
 */

import { EventBus, globalEventBus } from './EventBus';
import { PluginManager, globalPluginManager } from './PluginManager';
import { WeSignPlugin } from './plugins/WeSignPlugin';
import { UnifiedTestConfig, ExecutionHandle, EventType } from './types';
import { logger } from '../../utils/logger';

export class WeSignCore {
  private eventBus: EventBus;
  private pluginManager: PluginManager;
  private isInitialized = false;
  private wesignPlugin?: WeSignPlugin;

  constructor(
    eventBus: EventBus = globalEventBus,
    pluginManager: PluginManager = globalPluginManager
  ) {
    this.eventBus = eventBus;
    this.pluginManager = pluginManager;
  }

  /**
   * Initialize the WeSign core system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('WeSignCore already initialized');
      return;
    }

    try {
      logger.info('WeSignCore initializing...');

      // Initialize core WeSign plugin (check for duplicates)
      const existingPlugin = this.pluginManager.getByFramework('wesign');
      if (existingPlugin) {
        logger.info('WeSign plugin already registered, skipping registration');
        this.wesignPlugin = existingPlugin as WeSignPlugin;
      } else {
        this.wesignPlugin = new WeSignPlugin();
        await this.pluginManager.register(this.wesignPlugin);
        logger.info('WeSign plugin registered successfully');
      }

      // Set up core event handlers
      this.setupEventHandlers();

      // Emit system ready event
      await this.eventBus.createAndPublish(
        EventType.HEALTH_CHANGED,
        'WeSignCore',
        {
          status: 'healthy',
          message: 'WeSign core system initialized successfully',
          timestamp: new Date()
        }
      );

      this.isInitialized = true;
      logger.info('WeSignCore initialization complete');

    } catch (error) {
      logger.error('WeSignCore initialization failed', {
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Execute tests using unified configuration
   */
  async executeTest(config: UnifiedTestConfig): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('WeSignCore not initialized');
    }

    const executionId = require('uuid').v4();

    try {
      logger.info('WeSignCore starting test execution', {
        executionId,
        framework: config.framework
      });

      // Get the appropriate plugin
      const plugin = this.pluginManager.getByFramework(config.framework);
      if (!plugin) {
        throw new Error(`Plugin not found for framework: ${config.framework}`);
      }

      // Execute the test
      await plugin.execute({
        ...config,
        executionId,
        eventBus: this.eventBus
      });

      return executionId;

    } catch (error) {
      logger.error('WeSignCore test execution failed', {
        executionId,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Get execution status
   */
  async getExecutionStatus(executionId: string): Promise<ExecutionHandle | null> {
    if (!this.wesignPlugin) {
      return null;
    }

    return this.wesignPlugin.getExecutionStatus(executionId);
  }

  /**
   * Discover tests
   */
  async discoverTests(directories: string[] = ['.']): Promise<any> {
    if (!this.isInitialized || !this.wesignPlugin) {
      throw new Error('WeSignCore not initialized');
    }

    try {
      logger.info('WeSignCore discovering tests', { directories });

      const tests = await this.wesignPlugin.discover(directories);

      await this.eventBus.createAndPublish(
        EventType.DISCOVERY_COMPLETED,
        'WeSignCore',
        {
          directories,
          testsFound: tests.length,
          timestamp: new Date()
        }
      );

      return {
        tests,
        total: tests.length,
        directories
      };

    } catch (error) {
      logger.error('WeSignCore test discovery failed', {
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Get system health status
   */
  async getHealth(): Promise<any> {
    try {
      const pluginHealth = await this.pluginManager.healthCheckAll();
      const eventBusStats = this.eventBus.getStats();

      const overallHealth = {
        status: Array.from(pluginHealth.values()).every(h => h.status === 'healthy') ? 'healthy' : 'degraded',
        timestamp: new Date(),
        components: {
          core: {
            status: this.isInitialized ? 'healthy' : 'unhealthy',
            initialized: this.isInitialized
          },
          eventBus: {
            status: 'healthy',
            ...eventBusStats
          },
          plugins: Object.fromEntries(pluginHealth)
        }
      };

      return overallHealth;

    } catch (error) {
      logger.error('WeSignCore health check failed', {
        error: error instanceof Error ? error.message : error
      });

      return {
        status: 'unhealthy',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get system statistics
   */
  getStats(): any {
    return {
      initialized: this.isInitialized,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      eventBus: this.eventBus.getStats(),
      pluginManager: this.pluginManager.getStats(),
      node: {
        version: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };
  }

  /**
   * Shutdown the system gracefully
   */
  async shutdown(): Promise<void> {
    logger.info('WeSignCore shutting down...');

    try {
      // Shutdown plugin manager
      await this.pluginManager.shutdown();

      // Shutdown event bus
      await this.eventBus.shutdown();

      this.isInitialized = false;
      logger.info('WeSignCore shutdown complete');

    } catch (error) {
      logger.error('WeSignCore shutdown failed', {
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Check if core is ready
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  private setupEventHandlers(): void {
    // Handle test execution events
    this.eventBus.subscribe(EventType.TEST_EXECUTION_STARTED, async (event) => {
      logger.info('Test execution started', { event: event.data });
    });

    this.eventBus.subscribe(EventType.TEST_EXECUTION_COMPLETED, async (event) => {
      logger.info('Test execution completed', { event: event.data });
    });

    // Handle plugin events
    this.eventBus.subscribe(EventType.PLUGIN_INSTALLED, async (event) => {
      logger.info('Plugin installed', { event: event.data });
    });

    // Handle discovery events
    this.eventBus.subscribe(EventType.DISCOVERY_COMPLETED, async (event) => {
      logger.info('Test discovery completed', { event: event.data });
    });

    logger.debug('WeSignCore event handlers configured');
  }
}

// Global WeSignCore instance
export const globalWeSignCore = new WeSignCore();