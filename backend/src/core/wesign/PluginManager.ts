/**
 * Plugin Manager - Manages test framework plugins for unified execution
 */

import { Router } from 'express';
import { EventBus, globalEventBus } from './EventBus';
import { TestPlugin, PluginMetadata, PluginRegistry } from './plugins/PluginBase';
import { EventType } from './types';
import { logger } from '../../utils/logger';

export class PluginManager implements PluginRegistry {
  private plugins = new Map<string, TestPlugin>();
  private eventBus: EventBus;

  constructor(eventBus: EventBus = globalEventBus) {
    this.eventBus = eventBus;
    logger.info('PluginManager initialized');
  }

  /**
   * Register a new plugin
   */
  async register(plugin: TestPlugin): Promise<void> {
    const { id, name, version } = plugin.metadata;

    // Check if plugin already exists
    if (this.plugins.has(id)) {
      throw new Error(`Plugin '${id}' is already registered`);
    }

    try {
      // Initialize the plugin
      await plugin.initialize(this.eventBus);

      // Store the plugin
      this.plugins.set(id, plugin);

      // Emit registration event
      await this.eventBus.createAndPublish(
        EventType.PLUGIN_INSTALLED,
        'PluginManager',
        {
          pluginId: id,
          name,
          version,
          registeredAt: new Date()
        }
      );

      logger.info('Plugin registered successfully', {
        pluginId: id,
        name,
        version
      });

    } catch (error) {
      logger.error('Failed to register plugin', {
        pluginId: id,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Unregister a plugin
   */
  async unregister(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin '${pluginId}' not found`);
    }

    try {
      // Cleanup plugin resources
      await plugin.cleanup();

      // Remove from registry
      this.plugins.delete(pluginId);

      logger.info('Plugin unregistered successfully', { pluginId });

    } catch (error) {
      logger.error('Failed to unregister plugin', {
        pluginId,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Get a specific plugin
   */
  get(pluginId: string): TestPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * List all registered plugins
   */
  list(): PluginMetadata[] {
    return Array.from(this.plugins.values()).map(plugin => plugin.metadata);
  }

  /**
   * Check if plugin is registered
   */
  isRegistered(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  /**
   * Get plugin by framework type
   */
  getByFramework(framework: string): TestPlugin | undefined {
    for (const plugin of this.plugins.values()) {
      if (plugin.metadata.id === framework ||
          plugin.metadata.name.toLowerCase() === framework.toLowerCase()) {
        return plugin;
      }
    }
    return undefined;
  }

  /**
   * Register plugin routes with Express router
   */
  registerPluginRoutes(router: Router): void {
    this.plugins.forEach((plugin, pluginId) => {
      if (plugin.registerRoutes) {
        const pluginRouter = Router();
        plugin.registerRoutes(pluginRouter);

        // Mount plugin routes under /plugins/{pluginId}
        router.use(`/plugins/${pluginId}`, pluginRouter);

        logger.debug('Plugin routes registered', { pluginId });
      }
    });
  }

  /**
   * Health check all plugins
   */
  async healthCheckAll(): Promise<Map<string, any>> {
    const healthResults = new Map<string, any>();

    const healthPromises = Array.from(this.plugins.entries()).map(async ([pluginId, plugin]) => {
      try {
        const health = await plugin.healthCheck();
        healthResults.set(pluginId, health);
      } catch (error) {
        healthResults.set(pluginId, {
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Unknown error',
          lastCheck: new Date()
        });
      }
    });

    await Promise.allSettled(healthPromises);
    return healthResults;
  }

  /**
   * Get plugin statistics
   */
  getStats() {
    const stats = {
      totalPlugins: this.plugins.size,
      plugins: Array.from(this.plugins.values()).map(plugin => ({
        id: plugin.metadata.id,
        name: plugin.metadata.name,
        version: plugin.metadata.version,
        isReady: plugin.isReady(),
        features: plugin.metadata.supportedFeatures
      }))
    };

    return stats;
  }

  /**
   * Validate plugin configuration
   */
  validatePluginConfig(pluginId: string, config: any): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return false;
    }

    return plugin.validateConfig(config);
  }

  /**
   * Get configuration schema for all plugins
   */
  getConfigSchemas(): Record<string, any> {
    const schemas: Record<string, any> = {};

    this.plugins.forEach((plugin, pluginId) => {
      schemas[pluginId] = plugin.getConfigSchema();
    });

    return schemas;
  }

  /**
   * Shutdown all plugins
   */
  async shutdown(): Promise<void> {
    logger.info('PluginManager shutting down...');

    const shutdownPromises = Array.from(this.plugins.values()).map(async plugin => {
      try {
        await plugin.cleanup();
      } catch (error) {
        logger.error('Plugin cleanup failed', {
          pluginId: plugin.metadata.id,
          error: error instanceof Error ? error.message : error
        });
      }
    });

    await Promise.allSettled(shutdownPromises);
    this.plugins.clear();

    logger.info('PluginManager shutdown complete');
  }
}

// Global PluginManager instance
export const globalPluginManager = new PluginManager();