/**
 * Test Scheduler - Phase 2 Implementation
 * Intelligent test scheduling, batching optimization, and framework-specific resource management
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { CronJob } from 'cron';
import { logger } from '../../utils/logger';
import { globalEventBus } from './EventBus';
import { executionManager, ExecutionPriority } from './ExecutionManager';
import {
  UnifiedTestConfig,
  EventType,
  TestInfo
} from './types';

export interface ScheduleConfig {
  id?: string;
  name: string;
  description?: string;
  cronExpression: string;
  testConfig: UnifiedTestConfig;
  priority: ExecutionPriority['priority'];
  enabled: boolean;
  retryConfig?: {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier: number;
  };
  notifications?: {
    onSuccess: boolean;
    onFailure: boolean;
    webhookUrl?: string;
    emailRecipients?: string[];
  };
  conditions?: {
    skipOnWeekends?: boolean;
    skipOnHolidays?: boolean;
    requireHealthySystem?: boolean;
    maxConcurrentRuns?: number;
  };
}

export interface ScheduledJob {
  id: string;
  config: ScheduleConfig;
  cronJob: CronJob;
  lastRun?: Date;
  nextRun?: Date;
  lastResult?: 'success' | 'failure' | 'skipped';
  runCount: number;
  failureCount: number;
  averageDuration?: number;
}

export interface BatchConfig {
  batchSize: number;
  parallelBatches: number;
  batchDelay: number;
  failureTolerance: number; // Percentage of failures to tolerate
  smartGrouping: boolean; // Group similar tests together
}

export interface TestBatch {
  id: string;
  name: string;
  tests: TestInfo[];
  framework: string;
  estimatedDuration: number;
  priority: ExecutionPriority['priority'];
  dependsOn?: string[];
  tags: string[];
}

export interface SmartSchedulingOptions {
  considerHistoricalData: boolean;
  optimizeForSpeed: boolean;
  optimizeForReliability: boolean;
  balanceLoad: boolean;
  avoidFlakiness: boolean;
}

export class TestScheduler extends EventEmitter {
  private static instance: TestScheduler;
  private scheduledJobs = new Map<string, ScheduledJob>();
  private testHistory = new Map<string, Array<{ duration: number; success: boolean; timestamp: Date }>>();
  private batchConfigs = new Map<string, BatchConfig>();
  private activeScheduledRuns = new Map<string, string>(); // scheduleId -> executionId

  private constructor() {
    super();
    this.initializeDefaultBatchConfigs();
    logger.info('TestScheduler initialized - intelligent scheduling ready');
  }

  public static getInstance(): TestScheduler {
    if (!TestScheduler.instance) {
      TestScheduler.instance = new TestScheduler();
    }
    return TestScheduler.instance;
  }

  /**
   * Create or update a scheduled test run
   */
  async createSchedule(config: ScheduleConfig): Promise<string> {
    const scheduleId = config.id || uuidv4();

    logger.info('Creating test schedule', {
      scheduleId,
      name: config.name,
      cronExpression: config.cronExpression,
      framework: config.testConfig.framework
    });

    // Validate cron expression
    if (!this.isValidCronExpression(config.cronExpression)) {
      throw new Error(`Invalid cron expression: ${config.cronExpression}`);
    }

    // Create cron job
    const cronJob = new CronJob(
      config.cronExpression,
      () => this.executeScheduledJob(scheduleId),
      null,
      config.enabled,
      'UTC'
    );

    const scheduledJob: ScheduledJob = {
      id: scheduleId,
      config: { ...config, id: scheduleId },
      cronJob,
      nextRun: this.getNextRunDate(cronJob),
      runCount: 0,
      failureCount: 0
    };

    // Stop existing job if updating
    if (this.scheduledJobs.has(scheduleId)) {
      const existingJob = this.scheduledJobs.get(scheduleId)!;
      existingJob.cronJob.stop();
    }

    this.scheduledJobs.set(scheduleId, scheduledJob);

    await globalEventBus.createAndPublish(
      EventType.PLUGIN_INSTALLED,
      'TestScheduler',
      {
        type: 'schedule_created',
        scheduleId,
        name: config.name,
        nextRun: scheduledJob.nextRun
      }
    );

    return scheduleId;
  }

  /**
   * Update existing schedule
   */
  async updateSchedule(scheduleId: string, updates: Partial<ScheduleConfig>): Promise<boolean> {
    const existingJob = this.scheduledJobs.get(scheduleId);
    if (!existingJob) {
      return false;
    }

    logger.info('Updating test schedule', { scheduleId, updates });

    // Update config
    const updatedConfig = { ...existingJob.config, ...updates };

    // Recreate if cron expression changed
    if (updates.cronExpression && updates.cronExpression !== existingJob.config.cronExpression) {
      await this.deleteSchedule(scheduleId);
      await this.createSchedule(updatedConfig);
    } else {
      existingJob.config = updatedConfig;

      // Update enabled state
      if (updates.enabled !== undefined) {
        if (updates.enabled) {
          existingJob.cronJob.start();
        } else {
          existingJob.cronJob.stop();
        }
      }
    }

    return true;
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(scheduleId: string): Promise<boolean> {
    const job = this.scheduledJobs.get(scheduleId);
    if (!job) {
      return false;
    }

    logger.info('Deleting test schedule', { scheduleId, name: job.config.name });

    // Stop cron job
    job.cronJob.stop();

    // Cancel any active run
    const activeExecution = this.activeScheduledRuns.get(scheduleId);
    if (activeExecution) {
      await executionManager.cancelExecution(activeExecution);
      this.activeScheduledRuns.delete(scheduleId);
    }

    this.scheduledJobs.delete(scheduleId);

    await globalEventBus.createAndPublish(
      EventType.PLUGIN_INSTALLED,
      'TestScheduler',
      {
        type: 'schedule_deleted',
        scheduleId
      }
    );

    return true;
  }

  /**
   * Get all schedules
   */
  getSchedules(): ScheduledJob[] {
    return Array.from(this.scheduledJobs.values()).map(job => ({
      ...job,
      nextRun: this.getNextRunDate(job.cronJob)
    }));
  }

  /**
   * Get schedule by ID
   */
  getSchedule(scheduleId: string): ScheduledJob | null {
    const job = this.scheduledJobs.get(scheduleId);
    return job ? {
      ...job,
      nextRun: this.getNextRunDate(job.cronJob)
    } : null;
  }

  /**
   * Create optimized test batches
   */
  async createSmartBatches(
    tests: TestInfo[],
    framework: string,
    options: SmartSchedulingOptions = {
      considerHistoricalData: true,
      optimizeForSpeed: true,
      optimizeForReliability: false,
      balanceLoad: true,
      avoidFlakiness: false
    }
  ): Promise<TestBatch[]> {
    logger.info('Creating smart test batches', {
      testCount: tests.length,
      framework,
      options
    });

    const batchConfig = this.getBatchConfig(framework);
    const batches: TestBatch[] = [];

    if (options.smartGrouping) {
      // Group tests by category and complexity
      const grouped = this.groupTestsIntelligently(tests, options);

      for (const [groupName, groupTests] of Object.entries(grouped)) {
        const chunks = this.chunkTests(groupTests, batchConfig.batchSize);

        chunks.forEach((chunk, index) => {
          const batch = this.createTestBatch(
            `${groupName}_batch_${index + 1}`,
            chunk,
            framework,
            options
          );
          batches.push(batch);
        });
      }
    } else {
      // Simple chunking
      const chunks = this.chunkTests(tests, batchConfig.batchSize);
      chunks.forEach((chunk, index) => {
        const batch = this.createTestBatch(
          `batch_${index + 1}`,
          chunk,
          framework,
          options
        );
        batches.push(batch);
      });
    }

    // Optimize batch order
    const optimizedBatches = this.optimizeBatchOrder(batches, options);

    logger.info('Created optimized batches', {
      totalBatches: optimizedBatches.length,
      totalTests: tests.length,
      estimatedDuration: optimizedBatches.reduce((sum, batch) => sum + batch.estimatedDuration, 0)
    });

    return optimizedBatches;
  }

  /**
   * Execute batches in parallel with intelligent scheduling
   */
  async executeBatches(
    batches: TestBatch[],
    options: {
      maxParallel?: number;
      failureTolerance?: number;
      continueOnFailure?: boolean;
    } = {}
  ): Promise<string[]> {
    const {
      maxParallel = 3,
      failureTolerance = 20,
      continueOnFailure = true
    } = options;

    logger.info('Executing test batches', {
      batchCount: batches.length,
      maxParallel,
      failureTolerance
    });

    const executionIds: string[] = [];
    const executing = new Set<Promise<string>>();
    let batchIndex = 0;
    let failureRate = 0;

    while (batchIndex < batches.length && failureRate <= failureTolerance) {
      // Start batches up to maxParallel
      while (executing.size < maxParallel && batchIndex < batches.length) {
        const batch = batches[batchIndex];
        const executionPromise = this.executeBatch(batch);
        executing.add(executionPromise);
        batchIndex++;

        // Handle completion
        executionPromise.then(executionId => {
          executionIds.push(executionId);
          executing.delete(executionPromise);
        }).catch(error => {
          logger.error('Batch execution failed', { batchId: batch.id, error });
          executing.delete(executionPromise);
          failureRate = (failureRate * executionIds.length + 100) / (executionIds.length + 1);

          if (!continueOnFailure) {
            throw error;
          }
        });
      }

      // Wait for at least one batch to complete
      if (executing.size > 0) {
        await Promise.race(executing);
      }
    }

    // Wait for all remaining executions
    await Promise.allSettled(executing);

    return executionIds;
  }

  /**
   * Get scheduling recommendations based on historical data
   */
  async getSchedulingRecommendations(framework: string): Promise<{
    optimalTimes: string[];
    estimatedDurations: Record<string, number>;
    riskySuites: string[];
    suggestions: string[];
  }> {
    logger.info('Generating scheduling recommendations', { framework });

    // Analyze historical data
    const historicalAnalysis = this.analyzeHistoricalData(framework);

    return {
      optimalTimes: this.findOptimalSchedulingTimes(historicalAnalysis),
      estimatedDurations: this.estimateTestDurations(framework),
      riskySuites: this.identifyRiskySuites(framework),
      suggestions: this.generateSchedulingSuggestions(historicalAnalysis)
    };
  }

  /**
   * Update test execution history for future optimization
   */
  updateTestHistory(
    testId: string,
    duration: number,
    success: boolean,
    timestamp: Date = new Date()
  ): void {
    if (!this.testHistory.has(testId)) {
      this.testHistory.set(testId, []);
    }

    const history = this.testHistory.get(testId)!;
    history.push({ duration, success, timestamp });

    // Keep only last 50 runs for each test
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }
  }

  private async executeScheduledJob(scheduleId: string): Promise<void> {
    const job = this.scheduledJobs.get(scheduleId);
    if (!job) {
      logger.error('Scheduled job not found', { scheduleId });
      return;
    }

    logger.info('Executing scheduled job', {
      scheduleId,
      name: job.config.name,
      framework: job.config.testConfig.framework
    });

    // Check conditions
    if (!this.shouldExecuteJob(job)) {
      logger.info('Skipping scheduled job due to conditions', { scheduleId });
      job.lastResult = 'skipped';
      return;
    }

    // Check if already running
    if (this.activeScheduledRuns.has(scheduleId)) {
      logger.warn('Scheduled job already running, skipping', { scheduleId });
      return;
    }

    try {
      job.lastRun = new Date();
      job.runCount++;

      // Queue execution with appropriate priority
      const executionId = await executionManager.queueExecution(
        job.config.testConfig,
        {
          priority: job.config.priority,
          timeout: job.config.retryConfig?.maxRetries ?
            job.config.retryConfig.maxRetries * 60000 : undefined
        },
        `schedule:${scheduleId}`
      );

      this.activeScheduledRuns.set(scheduleId, executionId);

      // Monitor execution
      this.monitorScheduledExecution(scheduleId, executionId, job);

    } catch (error) {
      logger.error('Failed to execute scheduled job', {
        scheduleId,
        error: error instanceof Error ? error.message : error
      });

      job.failureCount++;
      job.lastResult = 'failure';

      // Send failure notifications
      await this.sendFailureNotification(job, error);
    }
  }

  private async monitorScheduledExecution(
    scheduleId: string,
    executionId: string,
    job: ScheduledJob
  ): Promise<void> {
    const startTime = Date.now();

    // Wait for completion
    const checkStatus = async (): Promise<void> => {
      const status = await executionManager.getExecutionStatus(executionId);

      if (!status) {
        logger.error('Lost track of scheduled execution', { scheduleId, executionId });
        return;
      }

      if (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
        const duration = Date.now() - startTime;

        // Update job statistics
        if (job.averageDuration) {
          job.averageDuration = (job.averageDuration + duration) / 2;
        } else {
          job.averageDuration = duration;
        }

        if (status.status === 'completed') {
          job.lastResult = 'success';
          await this.sendSuccessNotification(job, status);
        } else {
          job.failureCount++;
          job.lastResult = 'failure';
          await this.sendFailureNotification(job, new Error(`Execution ${status.status}`));
        }

        this.activeScheduledRuns.delete(scheduleId);
      } else {
        // Still running, check again
        setTimeout(checkStatus, 30000); // Check every 30 seconds
      }
    };

    setTimeout(checkStatus, 10000); // Initial check after 10 seconds
  }

  private shouldExecuteJob(job: ScheduledJob): boolean {
    const conditions = job.config.conditions;
    if (!conditions) {
      return true;
    }

    const now = new Date();

    // Check weekend condition
    if (conditions.skipOnWeekends && (now.getDay() === 0 || now.getDay() === 6)) {
      return false;
    }

    // Check max concurrent runs
    if (conditions.maxConcurrentRuns) {
      const activeRuns = Array.from(this.activeScheduledRuns.keys()).length;
      if (activeRuns >= conditions.maxConcurrentRuns) {
        return false;
      }
    }

    return true;
  }

  private groupTestsIntelligently(
    tests: TestInfo[],
    options: SmartSchedulingOptions
  ): Record<string, TestInfo[]> {
    const groups: Record<string, TestInfo[]> = {};

    for (const test of tests) {
      let groupKey = test.category || 'default';

      // Consider complexity for grouping
      if (test.complexity) {
        groupKey += `_${test.complexity}`;
      }

      // Consider flakiness if avoiding it
      if (options.avoidFlakiness) {
        const history = this.testHistory.get(test.id);
        if (history) {
          const failureRate = history.filter(h => !h.success).length / history.length;
          if (failureRate > 0.2) { // More than 20% failure rate
            groupKey += '_flaky';
          }
        }
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(test);
    }

    return groups;
  }

  private chunkTests(tests: TestInfo[], chunkSize: number): TestInfo[][] {
    const chunks: TestInfo[][] = [];
    for (let i = 0; i < tests.length; i += chunkSize) {
      chunks.push(tests.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private createTestBatch(
    name: string,
    tests: TestInfo[],
    framework: string,
    options: SmartSchedulingOptions
  ): TestBatch {
    const estimatedDuration = tests.reduce((sum, test) => {
      const history = this.testHistory.get(test.id);
      if (history && history.length > 0) {
        const avgDuration = history.reduce((s, h) => s + h.duration, 0) / history.length;
        return sum + avgDuration;
      }
      return sum + (test.estimatedDuration || 60000); // 1 minute default
    }, 0);

    const tags = Array.from(new Set(tests.flatMap(test => test.tags)));

    const priority = this.determineBatchPriority(tests, options);

    return {
      id: uuidv4(),
      name,
      tests,
      framework,
      estimatedDuration,
      priority,
      tags
    };
  }

  private optimizeBatchOrder(
    batches: TestBatch[],
    options: SmartSchedulingOptions
  ): TestBatch[] {
    if (options.optimizeForSpeed) {
      // Sort by estimated duration (shortest first for faster feedback)
      return batches.sort((a, b) => a.estimatedDuration - b.estimatedDuration);
    } else if (options.optimizeForReliability) {
      // Sort by priority and historical success rate
      return batches.sort((a, b) => {
        const priorityOrder = { urgent: 4, high: 3, normal: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
    }

    return batches;
  }

  private async executeBatch(batch: TestBatch): Promise<string> {
    logger.info('Executing test batch', {
      batchId: batch.id,
      name: batch.name,
      testCount: batch.tests.length,
      framework: batch.framework
    });

    const config: UnifiedTestConfig = {
      framework: batch.framework as any,
      execution: {
        mode: 'parallel',
        workers: Math.min(4, batch.tests.length),
        timeout: batch.estimatedDuration + 60000 // Add 1 minute buffer
      },
      tests: {
        testIds: batch.tests.map(test => test.id),
        tags: batch.tags
      },
      ai: {
        enabled: true,
        autoHeal: true,
        generateInsights: false
      },
      realTime: {
        monitoring: true,
        notifications: false,
        streaming: false
      }
    };

    return await executionManager.queueExecution(config, { priority: batch.priority });
  }

  private determineBatchPriority(
    tests: TestInfo[],
    options: SmartSchedulingOptions
  ): ExecutionPriority['priority'] {
    // Analyze test criticality
    const criticalTests = tests.filter(test =>
      test.tags.includes('critical') ||
      test.tags.includes('smoke') ||
      test.category === 'auth'
    );

    if (criticalTests.length > tests.length * 0.5) {
      return 'high';
    }

    if (options.optimizeForSpeed) {
      return 'normal';
    }

    return 'low';
  }

  private initializeDefaultBatchConfigs(): void {
    // WeSign batch configuration
    this.batchConfigs.set('wesign', {
      batchSize: 5,
      parallelBatches: 3,
      batchDelay: 5000,
      failureTolerance: 25,
      smartGrouping: true
    });

    // Playwright batch configuration
    this.batchConfigs.set('playwright', {
      batchSize: 8,
      parallelBatches: 4,
      batchDelay: 2000,
      failureTolerance: 20,
      smartGrouping: true
    });

    // pytest batch configuration
    this.batchConfigs.set('pytest', {
      batchSize: 10,
      parallelBatches: 2,
      batchDelay: 1000,
      failureTolerance: 15,
      smartGrouping: false
    });
  }

  private getBatchConfig(framework: string): BatchConfig {
    return this.batchConfigs.get(framework) || {
      batchSize: 5,
      parallelBatches: 2,
      batchDelay: 3000,
      failureTolerance: 20,
      smartGrouping: false
    };
  }

  private analyzeHistoricalData(framework: string): any {
    // Placeholder for historical data analysis
    return {
      averageDuration: 120000,
      peakFailureTimes: ['14:00-16:00', '02:00-04:00'],
      mostReliableTests: [],
      flakyTests: []
    };
  }

  private findOptimalSchedulingTimes(analysis: any): string[] {
    return ['08:00', '12:00', '20:00']; // Default optimal times
  }

  private estimateTestDurations(framework: string): Record<string, number> {
    return {}; // Placeholder
  }

  private identifyRiskySuites(framework: string): string[] {
    return []; // Placeholder
  }

  private generateSchedulingSuggestions(analysis: any): string[] {
    return [
      'Consider running critical tests during low-traffic hours',
      'Group similar tests together for better resource utilization',
      'Enable retry mechanisms for historically flaky tests'
    ];
  }

  private isValidCronExpression(expression: string): boolean {
    try {
      new CronJob(expression, () => {}, null, false);
      return true;
    } catch {
      return false;
    }
  }

  private getNextRunDate(cronJob: CronJob): Date | undefined {
    try {
      const next = cronJob.nextDate();
      if (!next) {
        return undefined;
      }

      // Handle different cron library versions
      if (typeof next.toDate === 'function') {
        return next.toDate();
      }

      // If it's already a Date object or has toDate method
      if (next instanceof Date) {
        return next;
      }

      // If it's a moment-like object with toDate
      if (next && typeof next === 'object' && 'toDate' in next) {
        return (next as any).toDate();
      }

      // Fallback: try to convert to Date
      return new Date(next);
    } catch (error) {
      logger.warn('Failed to get next run date', { error });
      return undefined;
    }
  }

  private async sendSuccessNotification(job: ScheduledJob, status: any): Promise<void> {
    if (!job.config.notifications?.onSuccess) {
      return;
    }

    logger.info('Sending success notification', { scheduleId: job.id });
    // Implement notification logic
  }

  private async sendFailureNotification(job: ScheduledJob, error: any): Promise<void> {
    if (!job.config.notifications?.onFailure) {
      return;
    }

    logger.error('Sending failure notification', { scheduleId: job.id, error });
    // Implement notification logic
  }

  /**
   * Clean shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('TestScheduler shutting down...');

    // Stop all cron jobs
    for (const job of this.scheduledJobs.values()) {
      job.cronJob.stop();
    }

    // Cancel active scheduled runs
    for (const [scheduleId, executionId] of this.activeScheduledRuns) {
      await executionManager.cancelExecution(executionId);
    }

    this.scheduledJobs.clear();
    this.activeScheduledRuns.clear();

    logger.info('TestScheduler shutdown complete');
  }
}

// Export singleton instance
export const testScheduler = TestScheduler.getInstance();