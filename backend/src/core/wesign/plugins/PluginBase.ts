/**
 * Plugin Base Classes - Foundation for extensible test framework support
 */

import { Router } from 'express';
import { EventBus } from '../EventBus';
import { UnifiedTestConfig, ExecutionHandle, TestInfo, PluginHealth, PluginExecutionConfig } from '../types';

export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  supportedFeatures: string[];
  dependencies: string[];
}

export abstract class TestPlugin {
  abstract readonly metadata: PluginMetadata;

  protected eventBus?: EventBus;
  protected isInitialized = false;

  /**
   * Initialize the plugin
   */
  async initialize(eventBus: EventBus): Promise<void> {
    this.eventBus = eventBus;
    await this.onInitialize();
    this.isInitialized = true;
  }

  /**
   * Execute tests using this plugin
   */
  abstract execute(config: PluginExecutionConfig): Promise<ExecutionHandle>;

  /**
   * Discover tests in given paths
   */
  abstract discover(paths: string[]): Promise<TestInfo[]>;

  /**
   * Check plugin health
   */
  abstract healthCheck(): Promise<PluginHealth>;

  /**
   * Get plugin configuration schema
   */
  abstract getConfigSchema(): any;

  /**
   * Validate plugin configuration
   */
  abstract validateConfig(config: any): boolean;

  /**
   * Plugin-specific initialization logic
   */
  protected async onInitialize(): Promise<void> {
    // Override in subclasses if needed
  }

  /**
   * Register custom routes for this plugin
   */
  registerRoutes?(router: Router): void;

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Override in subclasses if needed
  }

  /**
   * Check if plugin is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Emit event through the event bus
   */
  protected emitEvent(type: string, data: any): void {
    if (this.eventBus) {
      this.eventBus.createAndPublish(type as any, this.metadata.id, data);
    }
  }
}

export interface PluginRegistry {
  register(plugin: TestPlugin): Promise<void>;
  unregister(pluginId: string): Promise<void>;
  get(pluginId: string): TestPlugin | undefined;
  list(): PluginMetadata[];
  isRegistered(pluginId: string): boolean;
}