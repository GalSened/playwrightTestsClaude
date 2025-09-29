/**
 * Unified Test Engine - Phase 2 Implementation
 * Consolidates all test execution systems into a single, intelligent engine
 *
 * Replaces:
 * - testRunner.ts
 * - testRunnerService.ts
 * - execution.ts
 * - wesign/testExecutor.ts
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../../utils/logger';
import { globalEventBus } from './EventBus';
import {
  UnifiedTestConfig,
  ExecutionHandle,
  ExecutionStatus,
  TestResult,
  EventType,
  TestInfo
} from './types';

export interface TestFrameworkAdapter {
  name: string;
  supports(config: UnifiedTestConfig): boolean;
  buildCommand(config: UnifiedTestConfig, executionId: string): Promise<TestCommand>;
  parseResults(output: string, stderr: string): TestResult[];
  getArtifacts(executionId: string): Promise<ExecutionArtifacts>;
  healthCheck(): Promise<boolean>;
}

export interface TestCommand {
  executable: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
  timeout?: number;
}

export interface ExecutionArtifacts {
  screenshots: string[];
  videos: string[];
  traces: string[];
  reports: string[];
  logs: string[];
}

export interface ExecutionContext {
  executionId: string;
  config: UnifiedTestConfig;
  startTime: Date;
  process?: ChildProcess;
  artifacts: ExecutionArtifacts;
  results: TestResult[];
  status: ExecutionStatus['status'];
  progress: {
    total: number;
    completed: number;
    percentage: number;
  };
}

export class UnifiedTestEngine extends EventEmitter {
  private static instance: UnifiedTestEngine;
  private activeExecutions = new Map<string, ExecutionContext>();
  private frameworkAdapters = new Map<string, TestFrameworkAdapter>();
  private executionQueue: string[] = [];
  private maxConcurrentExecutions: number = 3;
  private aiEnabled: boolean = true;

  private constructor() {
    super();
    this.initializeAdapters();
    this.setupEventListeners();
    logger.info('UnifiedTestEngine initialized - Phase 2 implementation ready');
  }

  public static getInstance(): UnifiedTestEngine {
    if (!UnifiedTestEngine.instance) {
      UnifiedTestEngine.instance = new UnifiedTestEngine();
    }
    return UnifiedTestEngine.instance;
  }

  /**
   * Main execution entry point - replaces all existing test runners
   */
  async executeTests(config: UnifiedTestConfig): Promise<ExecutionHandle> {
    const executionId = uuidv4();

    logger.info('Starting unified test execution', {
      executionId,
      framework: config.framework,
      mode: config.execution.mode,
      tests: config.tests
    });

    // Validate configuration
    await this.validateConfig(config);

    // Get appropriate framework adapter
    const adapter = this.getAdapter(config.framework);
    if (!adapter) {
      throw new Error(`No adapter found for framework: ${config.framework}`);
    }

    // Create execution context
    const context: ExecutionContext = {
      executionId,
      config,
      startTime: new Date(),
      artifacts: {
        screenshots: [],
        videos: [],
        traces: [],
        reports: [],
        logs: []
      },
      results: [],
      status: 'queued',
      progress: {
        total: 0,
        completed: 0,
        percentage: 0
      }
    };

    this.activeExecutions.set(executionId, context);

    // Emit execution started event
    await globalEventBus.createAndPublish(
      EventType.TEST_EXECUTION_STARTED,
      'UnifiedTestEngine',
      {
        executionId,
        config,
        timestamp: context.startTime
      }
    );

    // Start execution (may be queued)
    this.startExecution(executionId);

    return {
      executionId,
      status: 'queued',
      framework: config.framework,
      startTime: context.startTime
    };
  }

  /**
   * Get execution status with real-time progress
   */
  async getExecutionStatus(executionId: string): Promise<ExecutionStatus | null> {
    const context = this.activeExecutions.get(executionId);
    if (!context) {
      return null;
    }

    return {
      executionId,
      status: context.status,
      framework: context.config.framework,
      startTime: context.startTime,
      endTime: context.status === 'completed' || context.status === 'failed' ? new Date() : undefined,
      duration: context.status === 'completed' || context.status === 'failed' ?
        Date.now() - context.startTime.getTime() : undefined,
      progress: context.progress,
      results: context.results,
      error: context.status === 'failed' ? 'Execution failed' : undefined
    };
  }

  /**
   * Cancel running execution
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    const context = this.activeExecutions.get(executionId);
    if (!context) {
      return false;
    }

    logger.info('Cancelling test execution', { executionId });

    // Kill process if running
    if (context.process && !context.process.killed) {
      context.process.kill('SIGTERM');

      // Force kill after 5 seconds
      setTimeout(() => {
        if (context.process && !context.process.killed) {
          context.process.kill('SIGKILL');
        }
      }, 5000);
    }

    context.status = 'cancelled';
    this.activeExecutions.delete(executionId);

    return true;
  }

  /**
   * Get all active executions
   */
  getActiveExecutions(): ExecutionHandle[] {
    return Array.from(this.activeExecutions.values()).map(context => ({
      executionId: context.executionId,
      status: context.status,
      framework: context.config.framework,
      startTime: context.startTime,
      progress: context.progress
    }));
  }

  /**
   * Get execution artifacts
   */
  async getExecutionArtifacts(executionId: string): Promise<ExecutionArtifacts | null> {
    const context = this.activeExecutions.get(executionId);
    if (!context) {
      return null;
    }

    // Get additional artifacts from framework adapter
    const adapter = this.getAdapter(context.config.framework);
    if (adapter) {
      try {
        const adapterArtifacts = await adapter.getArtifacts(executionId);
        return {
          screenshots: [...context.artifacts.screenshots, ...adapterArtifacts.screenshots],
          videos: [...context.artifacts.videos, ...adapterArtifacts.videos],
          traces: [...context.artifacts.traces, ...adapterArtifacts.traces],
          reports: [...context.artifacts.reports, ...adapterArtifacts.reports],
          logs: [...context.artifacts.logs, ...adapterArtifacts.logs]
        };
      } catch (error) {
        logger.warn('Failed to get adapter artifacts', { executionId, error });
      }
    }

    return context.artifacts;
  }

  private async startExecution(executionId: string): Promise<void> {
    const context = this.activeExecutions.get(executionId);
    if (!context) {
      return;
    }

    // Check if we're at capacity
    const runningExecutions = Array.from(this.activeExecutions.values())
      .filter(ctx => ctx.status === 'running').length;

    if (runningExecutions >= this.maxConcurrentExecutions) {
      logger.info('Execution queued - at capacity', {
        executionId,
        runningExecutions,
        maxConcurrent: this.maxConcurrentExecutions
      });
      this.executionQueue.push(executionId);
      return;
    }

    try {
      context.status = 'running';

      logger.info('Starting test execution', {
        executionId,
        framework: context.config.framework,
        mode: context.config.execution.mode
      });

      // Get framework adapter
      const adapter = this.getAdapter(context.config.framework);
      if (!adapter) {
        throw new Error(`No adapter for framework: ${context.config.framework}`);
      }

      // Build command
      const command = await adapter.buildCommand(context.config, executionId);

      // Execute tests
      await this.executeCommand(context, command, adapter);

    } catch (error) {
      logger.error('Execution failed', { executionId, error });
      context.status = 'failed';

      await globalEventBus.createAndPublish(
        EventType.TEST_EXECUTION_COMPLETED,
        'UnifiedTestEngine',
        {
          executionId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - context.startTime.getTime()
        }
      );
    }

    // Start next queued execution
    this.processQueue();
  }

  private async executeCommand(
    context: ExecutionContext,
    command: TestCommand,
    adapter: TestFrameworkAdapter
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      logger.info('Executing test command', {
        executionId: context.executionId,
        executable: command.executable,
        args: command.args.join(' '),
        cwd: command.cwd
      });

      // Spawn process
      const child = spawn(command.executable, command.args, {
        cwd: command.cwd,
        env: { ...process.env, ...command.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      context.process = child;

      let stdout = '';
      let stderr = '';

      // Handle output
      child.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        this.parseProgress(context, output);
        this.emit('executionProgress', {
          executionId: context.executionId,
          output,
          progress: context.progress
        });
      });

      child.stderr.on('data', (data) => {
        const error = data.toString();
        stderr += error;
        this.emit('executionError', {
          executionId: context.executionId,
          error
        });
      });

      // Handle completion
      child.on('close', async (code) => {
        logger.info('Test execution completed', {
          executionId: context.executionId,
          exitCode: code,
          duration: Date.now() - context.startTime.getTime()
        });

        try {
          // Parse results using adapter
          context.results = adapter.parseResults(stdout, stderr);
          context.status = code === 0 ? 'completed' : 'failed';

          // Collect artifacts
          context.artifacts = await adapter.getArtifacts(context.executionId);

          // Apply AI enhancements if enabled
          if (context.config.ai.enabled) {
            await this.applyAIEnhancements(context);
          }

          // Emit completion event
          await globalEventBus.createAndPublish(
            EventType.TEST_EXECUTION_COMPLETED,
            'UnifiedTestEngine',
            {
              executionId: context.executionId,
              status: context.status,
              results: context.results,
              artifacts: context.artifacts,
              duration: Date.now() - context.startTime.getTime()
            }
          );

          resolve();

        } catch (error) {
          logger.error('Failed to process execution results', {
            executionId: context.executionId,
            error
          });
          context.status = 'failed';
          reject(error);
        }
      });

      // Handle process errors
      child.on('error', (error) => {
        logger.error('Process execution error', {
          executionId: context.executionId,
          error: error.message
        });
        context.status = 'failed';
        reject(error);
      });

      // Setup timeout
      if (command.timeout) {
        setTimeout(() => {
          if (!child.killed) {
            logger.warn('Execution timeout, killing process', {
              executionId: context.executionId,
              timeout: command.timeout
            });
            child.kill('SIGTERM');
          }
        }, command.timeout);
      }
    });
  }

  private parseProgress(context: ExecutionContext, output: string): void {
    // Universal progress parsing for different frameworks
    const lines = output.split('\n');

    for (const line of lines) {
      // pytest format: test_something PASSED/FAILED
      const pytestMatch = line.match(/^.*::[^:]*\s+(PASSED|FAILED|SKIPPED)/);
      if (pytestMatch) {
        context.progress.completed++;
        context.progress.percentage = context.progress.total > 0
          ? Math.round((context.progress.completed / context.progress.total) * 100)
          : 0;
        continue;
      }

      // Playwright format
      const playwrightMatch = line.match(/^\s*✓|✗|⚠\s+/);
      if (playwrightMatch) {
        context.progress.completed++;
        context.progress.percentage = context.progress.total > 0
          ? Math.round((context.progress.completed / context.progress.total) * 100)
          : 0;
        continue;
      }

      // Extract total test count
      const totalMatch = line.match(/(\d+) tests? (found|collected|discovered)/i);
      if (totalMatch && context.progress.total === 0) {
        context.progress.total = parseInt(totalMatch[1], 10);
        continue;
      }
    }
  }

  private async applyAIEnhancements(context: ExecutionContext): Promise<void> {
    if (!this.aiEnabled || !context.config.ai.enabled) {
      return;
    }

    logger.info('Applying AI enhancements', {
      executionId: context.executionId,
      failedTests: context.results.filter(r => r.status === 'failed').length
    });

    // AI enhancement logic will be implemented separately
    // This is a placeholder for the AI orchestrator integration

    try {
      // Get failed tests for healing
      const failedTests = context.results.filter(result => result.status === 'failed');

      for (const failedTest of failedTests) {
        if (context.config.ai.autoHeal) {
          // Apply auto-healing logic
          await this.attemptAutoHealing(context, failedTest);
        }

        if (context.config.ai.generateInsights) {
          // Generate AI insights
          await this.generateAIInsights(context, failedTest);
        }
      }

    } catch (error) {
      logger.warn('AI enhancement failed', {
        executionId: context.executionId,
        error
      });
    }
  }

  private async attemptAutoHealing(context: ExecutionContext, failedTest: TestResult): Promise<void> {
    // Placeholder for auto-healing logic
    // Will integrate with existing self-healing service
    logger.debug('Attempting auto-healing', {
      executionId: context.executionId,
      testId: failedTest.testId,
      error: failedTest.error
    });
  }

  private async generateAIInsights(context: ExecutionContext, failedTest: TestResult): Promise<void> {
    // Placeholder for AI insights generation
    logger.debug('Generating AI insights', {
      executionId: context.executionId,
      testId: failedTest.testId
    });
  }

  private processQueue(): void {
    if (this.executionQueue.length === 0) {
      return;
    }

    const runningExecutions = Array.from(this.activeExecutions.values())
      .filter(ctx => ctx.status === 'running').length;

    if (runningExecutions < this.maxConcurrentExecutions) {
      const nextExecutionId = this.executionQueue.shift();
      if (nextExecutionId) {
        this.startExecution(nextExecutionId);
      }
    }
  }

  private async validateConfig(config: UnifiedTestConfig): Promise<void> {
    // Validate framework
    if (!this.frameworkAdapters.has(config.framework)) {
      throw new Error(`Unsupported framework: ${config.framework}`);
    }

    // Validate test selection
    if (!config.tests.testIds && !config.tests.suites && !config.tests.pattern) {
      throw new Error('No tests specified for execution');
    }

    // Validate execution mode
    if (config.execution.mode === 'parallel' && !config.execution.workers) {
      config.execution.workers = 4; // Default parallel workers
    }
  }

  private getAdapter(framework: string): TestFrameworkAdapter | undefined {
    return this.frameworkAdapters.get(framework);
  }

  private initializeAdapters(): void {
    logger.info('Initializing framework adapters');

    try {
      // Import and register adapters
      const { WeSignAdapter } = require('./adapters/WeSignAdapter');
      const { PlaywrightAdapter } = require('./adapters/PlaywrightAdapter');

      // Register WeSign adapter
      const wesignAdapter = new WeSignAdapter();
      this.frameworkAdapters.set('wesign', wesignAdapter);
      logger.info('Registered WeSign adapter');

      // Register Playwright adapter
      const playwrightAdapter = new PlaywrightAdapter();
      this.frameworkAdapters.set('playwright', playwrightAdapter);
      logger.info('Registered Playwright adapter');

      // Register pytest adapter (alias for WeSign)
      this.frameworkAdapters.set('pytest', wesignAdapter);
      logger.info('Registered pytest adapter (WeSign)');

      logger.info('Framework adapters initialized successfully', {
        adapters: Array.from(this.frameworkAdapters.keys())
      });

    } catch (error) {
      logger.error('Failed to initialize framework adapters', {
        error: error instanceof Error ? error.message : error
      });
    }
  }

  private setupEventListeners(): void {
    // Setup internal event listeners
    this.on('executionProgress', (data) => {
      // Real-time progress updates
      logger.debug('Execution progress', data);
    });

    this.on('executionError', (data) => {
      // Error handling
      logger.warn('Execution error', data);
    });
  }

  /**
   * Health check for the engine
   */
  async healthCheck(): Promise<{ healthy: boolean; adapters: Record<string, boolean> }> {
    const adapterHealth: Record<string, boolean> = {};

    for (const name of Array.from(this.frameworkAdapters.keys())) {
      try {
        const adapter = this.frameworkAdapters.get(name);
        if (adapter) {
          adapterHealth[name] = await adapter.healthCheck();
        } else {
          adapterHealth[name] = false;
        }
      } catch (error) {
        adapterHealth[name] = false;
        logger.warn(`Adapter health check failed: ${name}`, { error });
      }
    }

    const healthy = Object.values(adapterHealth).every(health => health);

    return {
      healthy,
      adapters: adapterHealth
    };
  }

  /**
   * Clean shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('UnifiedTestEngine shutting down...');

    // Cancel all active executions
    const executionIds = Array.from(this.activeExecutions.keys());
    for (const executionId of executionIds) {
      await this.cancelExecution(executionId);
    }

    // Clear queue
    this.executionQueue = [];

    logger.info('UnifiedTestEngine shutdown complete');
  }
}

// Export singleton instance
export const unifiedTestEngine = UnifiedTestEngine.getInstance();