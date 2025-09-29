/**
 * Execution Manager - Phase 2 Implementation
 * Manages concurrent test executions, resource allocation, and queue management
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { globalEventBus } from './EventBus';
import {
  UnifiedTestConfig,
  ExecutionHandle,
  ExecutionStatus,
  EventType
} from './types';

export interface ResourceLimits {
  maxConcurrentExecutions: number;
  maxMemoryMB: number;
  maxCpuPercentage: number;
  maxDiskSpaceMB: number;
}

export interface ExecutionPriority {
  priority: 'low' | 'normal' | 'high' | 'urgent';
  scheduledTime?: Date;
  dependencies?: string[];
  timeout?: number;
}

export interface QueuedExecution {
  executionId: string;
  config: UnifiedTestConfig;
  priority: ExecutionPriority;
  queuedAt: Date;
  estimatedDuration?: number;
  requestedBy?: string;
}

export interface ResourceUsage {
  memoryMB: number;
  cpuPercentage: number;
  diskSpaceMB: number;
  networkMbps: number;
}

export interface ExecutionPool {
  id: string;
  name: string;
  maxConcurrent: number;
  currentExecutions: Set<string>;
  supportedFrameworks: string[];
  resourceLimits: ResourceLimits;
}

export class ExecutionManager extends EventEmitter {
  private static instance: ExecutionManager;
  private executionQueue: QueuedExecution[] = [];
  private activeExecutions = new Map<string, ExecutionHandle>();
  private executionPools = new Map<string, ExecutionPool>();
  private resourceLimits: ResourceLimits;
  private resourceMonitor: NodeJS.Timer | null = null;
  private queueProcessor: NodeJS.Timer | null = null;

  private constructor() {
    super();

    this.resourceLimits = {
      maxConcurrentExecutions: parseInt(process.env.MAX_CONCURRENT_EXECUTIONS || '5'),
      maxMemoryMB: parseInt(process.env.MAX_MEMORY_MB || '4096'),
      maxCpuPercentage: parseInt(process.env.MAX_CPU_PERCENTAGE || '80'),
      maxDiskSpaceMB: parseInt(process.env.MAX_DISK_SPACE_MB || '10240')
    };

    this.initializeDefaultPools();
    this.startResourceMonitoring();
    this.startQueueProcessor();

    logger.info('ExecutionManager initialized', {
      resourceLimits: this.resourceLimits,
      pools: Array.from(this.executionPools.keys())
    });
  }

  public static getInstance(): ExecutionManager {
    if (!ExecutionManager.instance) {
      ExecutionManager.instance = new ExecutionManager();
    }
    return ExecutionManager.instance;
  }

  /**
   * Queue execution with priority and resource management
   */
  async queueExecution(
    config: UnifiedTestConfig,
    priority: ExecutionPriority = { priority: 'normal' },
    requestedBy?: string
  ): Promise<string> {
    const executionId = uuidv4();

    logger.info('Queueing test execution', {
      executionId,
      framework: config.framework,
      priority: priority.priority,
      requestedBy
    });

    // Estimate execution duration
    const estimatedDuration = await this.estimateExecutionDuration(config);

    const queuedExecution: QueuedExecution = {
      executionId,
      config,
      priority,
      queuedAt: new Date(),
      estimatedDuration,
      requestedBy
    };

    // Insert based on priority
    this.insertByPriority(queuedExecution);

    // Emit queue event
    await globalEventBus.createAndPublish(
      EventType.TEST_EXECUTION_STARTED,
      'ExecutionManager',
      {
        executionId,
        status: 'queued',
        priority: priority.priority,
        queuePosition: this.getQueuePosition(executionId)
      }
    );

    // Try immediate execution if resources available
    this.processQueue();

    return executionId;
  }

  /**
   * Get execution status with queue information
   */
  async getExecutionStatus(executionId: string): Promise<ExecutionStatus | null> {
    // Check if it's running
    const activeExecution = this.activeExecutions.get(executionId);
    if (activeExecution) {
      return {
        ...activeExecution,
        status: activeExecution.status
      } as ExecutionStatus;
    }

    // Check if it's queued
    const queuedExecution = this.executionQueue.find(exec => exec.executionId === executionId);
    if (queuedExecution) {
      return {
        executionId,
        status: 'queued',
        framework: queuedExecution.config.framework,
        startTime: queuedExecution.queuedAt,
        progress: {
          total: 0,
          completed: 0,
          percentage: 0
        }
      } as ExecutionStatus;
    }

    return null;
  }

  /**
   * Cancel execution (queued or running)
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    logger.info('Cancelling execution', { executionId });

    // Remove from queue if queued
    const queueIndex = this.executionQueue.findIndex(exec => exec.executionId === executionId);
    if (queueIndex !== -1) {
      this.executionQueue.splice(queueIndex, 1);

      await globalEventBus.createAndPublish(
        EventType.TEST_EXECUTION_COMPLETED,
        'ExecutionManager',
        {
          executionId,
          status: 'cancelled',
          reason: 'Cancelled from queue'
        }
      );

      return true;
    }

    // Cancel running execution
    const activeExecution = this.activeExecutions.get(executionId);
    if (activeExecution) {
      activeExecution.status = 'cancelled';
      this.activeExecutions.delete(executionId);

      // Remove from pool
      this.removeFromPool(executionId);

      await globalEventBus.createAndPublish(
        EventType.TEST_EXECUTION_COMPLETED,
        'ExecutionManager',
        {
          executionId,
          status: 'cancelled',
          reason: 'Cancelled during execution'
        }
      );

      return true;
    }

    return false;
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    totalQueued: number;
    totalRunning: number;
    queue: Array<{
      executionId: string;
      framework: string;
      priority: string;
      queuedAt: Date;
      estimatedDuration?: number;
    }>;
    running: Array<{
      executionId: string;
      framework: string;
      startTime: Date;
      pool?: string;
    }>;
  } {
    return {
      totalQueued: this.executionQueue.length,
      totalRunning: this.activeExecutions.size,
      queue: this.executionQueue.map(exec => ({
        executionId: exec.executionId,
        framework: exec.config.framework,
        priority: exec.priority.priority,
        queuedAt: exec.queuedAt,
        estimatedDuration: exec.estimatedDuration
      })),
      running: Array.from(this.activeExecutions.values()).map(exec => ({
        executionId: exec.executionId,
        framework: exec.framework,
        startTime: exec.startTime,
        pool: this.findPoolForExecution(exec.executionId)
      }))
    };
  }

  /**
   * Get resource usage statistics
   */
  async getResourceUsage(): Promise<ResourceUsage & { limits: ResourceLimits; available: boolean }> {
    const usage = await this.getCurrentResourceUsage();

    return {
      ...usage,
      limits: this.resourceLimits,
      available: this.areResourcesAvailable(usage)
    };
  }

  /**
   * Create custom execution pool
   */
  createExecutionPool(
    name: string,
    maxConcurrent: number,
    supportedFrameworks: string[],
    resourceLimits?: Partial<ResourceLimits>
  ): string {
    const poolId = uuidv4();

    const pool: ExecutionPool = {
      id: poolId,
      name,
      maxConcurrent,
      currentExecutions: new Set(),
      supportedFrameworks,
      resourceLimits: {
        ...this.resourceLimits,
        ...resourceLimits
      }
    };

    this.executionPools.set(poolId, pool);

    logger.info('Created execution pool', {
      poolId,
      name,
      maxConcurrent,
      supportedFrameworks
    });

    return poolId;
  }

  /**
   * Update resource limits
   */
  updateResourceLimits(limits: Partial<ResourceLimits>): void {
    this.resourceLimits = {
      ...this.resourceLimits,
      ...limits
    };

    logger.info('Updated resource limits', { limits: this.resourceLimits });
  }

  private initializeDefaultPools(): void {
    // WeSign pool - optimized for WeSign tests
    this.createExecutionPool(
      'WeSign Tests',
      3,
      ['wesign', 'playwright', 'pytest'],
      {
        maxConcurrentExecutions: 3,
        maxMemoryMB: 2048,
        maxCpuPercentage: 60
      }
    );

    // General pool - for other frameworks
    this.createExecutionPool(
      'General Tests',
      2,
      ['playwright', 'selenium', 'pytest'],
      {
        maxConcurrentExecutions: 2,
        maxMemoryMB: 1024,
        maxCpuPercentage: 40
      }
    );
  }

  private startResourceMonitoring(): void {
    this.resourceMonitor = setInterval(async () => {
      try {
        const usage = await this.getCurrentResourceUsage();

        // Check if resources are overused
        if (!this.areResourcesAvailable(usage)) {
          logger.warn('Resource limits exceeded', { usage, limits: this.resourceLimits });

          // Pause queue processing temporarily
          this.pauseQueueProcessing();
        } else {
          // Resume if paused
          this.resumeQueueProcessing();
        }

        this.emit('resourceUpdate', usage);

      } catch (error) {
        logger.error('Resource monitoring failed', { error });
      }
    }, 5000); // Check every 5 seconds
  }

  private startQueueProcessor(): void {
    this.queueProcessor = setInterval(() => {
      this.processQueue();
    }, 2000); // Process queue every 2 seconds
  }

  private async processQueue(): Promise<void> {
    if (this.executionQueue.length === 0) {
      return;
    }

    // Get resource usage
    const usage = await this.getCurrentResourceUsage();
    if (!this.areResourcesAvailable(usage)) {
      logger.debug('Resources not available, skipping queue processing');
      return;
    }

    // Find suitable executions to start
    const executableItems = this.executionQueue.filter(exec => {
      // Check dependencies
      if (exec.priority.dependencies) {
        const dependenciesCompleted = exec.priority.dependencies.every(depId =>
          !this.activeExecutions.has(depId) && !this.executionQueue.some(q => q.executionId === depId)
        );
        if (!dependenciesCompleted) {
          return false;
        }
      }

      // Check scheduled time
      if (exec.priority.scheduledTime && exec.priority.scheduledTime > new Date()) {
        return false;
      }

      // Find available pool
      const availablePool = this.findAvailablePool(exec.config.framework);
      return availablePool !== null;
    });

    // Start executions by priority
    executableItems.slice(0, this.getAvailableSlots()).forEach(exec => {
      this.startExecution(exec);
    });
  }

  private async startExecution(queuedExecution: QueuedExecution): Promise<void> {
    const { executionId, config } = queuedExecution;

    logger.info('Starting queued execution', {
      executionId,
      framework: config.framework,
      waitTime: Date.now() - queuedExecution.queuedAt.getTime()
    });

    // Remove from queue
    const queueIndex = this.executionQueue.findIndex(exec => exec.executionId === executionId);
    if (queueIndex !== -1) {
      this.executionQueue.splice(queueIndex, 1);
    }

    // Find and assign to pool
    const pool = this.findAvailablePool(config.framework);
    if (!pool) {
      logger.error('No available pool for execution', { executionId, framework: config.framework });
      return;
    }

    // Create execution handle
    const executionHandle: ExecutionHandle = {
      executionId,
      status: 'running',
      framework: config.framework,
      startTime: new Date(),
      progress: {
        total: 0,
        completed: 0,
        percentage: 0
      }
    };

    // Add to active executions and pool
    this.activeExecutions.set(executionId, executionHandle);
    pool.currentExecutions.add(executionId);

    // Emit start event
    await globalEventBus.createAndPublish(
      EventType.TEST_EXECUTION_STARTED,
      'ExecutionManager',
      {
        executionId,
        status: 'running',
        pool: pool.name,
        startTime: executionHandle.startTime
      }
    );

    // The actual execution will be handled by the UnifiedTestEngine
    this.emit('executionStarted', {
      executionId,
      config,
      pool: pool.id
    });
  }

  private insertByPriority(queuedExecution: QueuedExecution): void {
    const priorityOrder = { urgent: 4, high: 3, normal: 2, low: 1 };
    const priority = priorityOrder[queuedExecution.priority.priority];

    let insertIndex = 0;
    for (let i = 0; i < this.executionQueue.length; i++) {
      const existingPriority = priorityOrder[this.executionQueue[i].priority.priority];
      if (priority > existingPriority) {
        insertIndex = i;
        break;
      }
      insertIndex = i + 1;
    }

    this.executionQueue.splice(insertIndex, 0, queuedExecution);
  }

  private getQueuePosition(executionId: string): number {
    return this.executionQueue.findIndex(exec => exec.executionId === executionId) + 1;
  }

  private async estimateExecutionDuration(config: UnifiedTestConfig): Promise<number> {
    // Simple estimation based on framework and test count
    let baseTime = 60000; // 1 minute base

    switch (config.framework) {
      case 'wesign':
        baseTime = 180000; // 3 minutes for WeSign tests
        break;
      case 'playwright':
        baseTime = 120000; // 2 minutes for Playwright
        break;
      case 'pytest':
        baseTime = 90000; // 1.5 minutes for pytest
        break;
    }

    // Multiply by test count estimate
    const testCount = config.tests.testIds?.length ||
                      config.tests.suites?.length || 1;

    return baseTime * Math.max(1, testCount * 0.5);
  }

  private findAvailablePool(framework: string): ExecutionPool | null {
    const pools = Array.from(this.executionPools.values());
    for (const pool of pools) {
      if (pool.supportedFrameworks.includes(framework) &&
          pool.currentExecutions.size < pool.maxConcurrent) {
        return pool;
      }
    }
    return null;
  }

  private findPoolForExecution(executionId: string): string | undefined {
    const pools = Array.from(this.executionPools.values());
    for (const pool of pools) {
      if (pool.currentExecutions.has(executionId)) {
        return pool.name;
      }
    }
    return undefined;
  }

  private removeFromPool(executionId: string): void {
    const pools = Array.from(this.executionPools.values());
    for (const pool of pools) {
      pool.currentExecutions.delete(executionId);
    }
  }

  private getAvailableSlots(): number {
    const pools = Array.from(this.executionPools.values());
    const totalRunning = pools.reduce((sum, pool) => sum + pool.currentExecutions.size, 0);

    return Math.max(0, this.resourceLimits.maxConcurrentExecutions - totalRunning);
  }

  private async getCurrentResourceUsage(): Promise<ResourceUsage> {
    // In a real implementation, this would check actual system resources
    // For now, return estimated usage based on active executions
    const memoryPerExecution = 512; // 512MB per execution estimate
    const cpuPerExecution = 15; // 15% CPU per execution estimate

    return {
      memoryMB: this.activeExecutions.size * memoryPerExecution,
      cpuPercentage: Math.min(100, this.activeExecutions.size * cpuPerExecution),
      diskSpaceMB: this.activeExecutions.size * 100, // 100MB disk per execution
      networkMbps: this.activeExecutions.size * 2 // 2Mbps per execution
    };
  }

  private areResourcesAvailable(usage: ResourceUsage): boolean {
    return usage.memoryMB < this.resourceLimits.maxMemoryMB &&
           usage.cpuPercentage < this.resourceLimits.maxCpuPercentage &&
           usage.diskSpaceMB < this.resourceLimits.maxDiskSpaceMB;
  }

  private pauseQueueProcessing(): void {
    if (this.queueProcessor) {
      clearInterval(this.queueProcessor);
      this.queueProcessor = null;
      logger.info('Queue processing paused due to resource constraints');
    }
  }

  private resumeQueueProcessing(): void {
    if (!this.queueProcessor) {
      this.startQueueProcessor();
      logger.info('Queue processing resumed');
    }
  }

  /**
   * Clean shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('ExecutionManager shutting down...');

    // Stop monitoring and processing
    if (this.resourceMonitor) {
      clearInterval(this.resourceMonitor);
    }
    if (this.queueProcessor) {
      clearInterval(this.queueProcessor);
    }

    // Cancel all queued executions
    for (const queuedExecution of this.executionQueue) {
      await this.cancelExecution(queuedExecution.executionId);
    }

    // Cancel all active executions
    for (const executionId of this.activeExecutions.keys()) {
      await this.cancelExecution(executionId);
    }

    logger.info('ExecutionManager shutdown complete');
  }
}

// Export singleton instance
export const executionManager = ExecutionManager.getInstance();