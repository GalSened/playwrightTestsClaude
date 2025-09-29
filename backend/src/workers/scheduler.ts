import { v4 as uuidv4 } from 'uuid';
import * as cron from 'node-cron';
import { getDatabase } from '@/database/database';
import { executeSchedule } from '@/services/execution';
import { workerLogger as logger } from '@/utils/logger';
import { SchedulerError } from '@/types/scheduler';
import { getSelfHealingService } from '@/services/selfHealingService';

const db = getDatabase();

export class SchedulerWorker {
  private workerId: string;
  private isRunning: boolean = false;
  private cronJob: cron.ScheduledTask | null = null;
  private concurrentExecutions: Map<string, Promise<void>> = new Map();
  private maxConcurrentExecutions: number;
  private pollIntervalMs: number;

  constructor(options: {
    maxConcurrentExecutions?: number;
    pollIntervalMs?: number;
    workerId?: string;
  } = {}) {
    this.workerId = options.workerId || `worker_${uuidv4().slice(0, 8)}`;
    this.maxConcurrentExecutions = options.maxConcurrentExecutions || 3;
    this.pollIntervalMs = options.pollIntervalMs || 30000; // 30 seconds

    logger.info('Scheduler worker initialized', {
      workerId: this.workerId,
      maxConcurrentExecutions: this.maxConcurrentExecutions,
      pollIntervalMs: this.pollIntervalMs
    });
  }

  /**
   * Start the scheduler worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Worker is already running', { workerId: this.workerId });
      return;
    }

    this.isRunning = true;
    logger.info('Starting scheduler worker', { workerId: this.workerId });

    // Set up periodic polling for claimable schedules
    this.cronJob = cron.schedule('*/30 * * * * *', async () => { // Every 30 seconds
      await this.pollForSchedules();
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    // Initial poll
    await this.pollForSchedules();

    // Set up cleanup job every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      await this.cleanupStaleExecutions();
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    // Set up database cleanup job daily at 2 AM UTC
    cron.schedule('0 2 * * *', async () => {
      await this.performDatabaseCleanup();
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    // Set up healing queue processing every 2 minutes
    cron.schedule('*/2 * * * *', async () => {
      await this.processHealingQueue();
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    logger.info('Scheduler worker started successfully', { 
      workerId: this.workerId,
      cronJobRunning: this.cronJob.running
    });
  }

  /**
   * Stop the scheduler worker
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping scheduler worker', { 
      workerId: this.workerId,
      activeExecutions: this.concurrentExecutions.size
    });

    this.isRunning = false;

    // Stop the cron job
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }

    // Wait for all active executions to complete
    if (this.concurrentExecutions.size > 0) {
      logger.info('Waiting for active executions to complete', {
        workerId: this.workerId,
        count: this.concurrentExecutions.size
      });

      await Promise.all(this.concurrentExecutions.values());
    }

    logger.info('Scheduler worker stopped', { workerId: this.workerId });
  }

  /**
   * Poll for claimable schedules and execute them
   */
  private async pollForSchedules(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Don't claim more schedules if we're at capacity
      if (this.concurrentExecutions.size >= this.maxConcurrentExecutions) {
        logger.debug('At maximum concurrent execution capacity', {
          workerId: this.workerId,
          active: this.concurrentExecutions.size,
          max: this.maxConcurrentExecutions
        });
        return;
      }

      const availableSlots = this.maxConcurrentExecutions - this.concurrentExecutions.size;
      const schedules = await db.getClaimableSchedules(availableSlots);

      if (schedules.length === 0) {
        logger.debug('No claimable schedules found', { workerId: this.workerId });
        return;
      }

      logger.info('Found claimable schedules', {
        workerId: this.workerId,
        count: schedules.length,
        scheduleIds: schedules.map(s => s.id)
      });

      // Attempt to claim and execute each schedule
      for (const schedule of schedules) {
        if (this.concurrentExecutions.size >= this.maxConcurrentExecutions) {
          break;
        }

        await this.claimAndExecute(schedule.id);
      }

    } catch (error) {
      logger.error('Error polling for schedules', {
        workerId: this.workerId,
        error
      });
    }
  }

  /**
   * Claim a schedule and execute it
   */
  private async claimAndExecute(scheduleId: string): Promise<void> {
    try {
      // Attempt to claim the schedule
      const claimed = await db.claimSchedule(scheduleId, this.workerId, 300000); // 5 min claim
      
      if (!claimed) {
        logger.debug('Failed to claim schedule (likely claimed by another worker)', {
          workerId: this.workerId,
          scheduleId
        });
        return;
      }

      logger.info('Successfully claimed schedule', {
        workerId: this.workerId,
        scheduleId
      });

      // Execute the schedule asynchronously
      const executionPromise = this.executeScheduleWithCleanup(scheduleId);
      this.concurrentExecutions.set(scheduleId, executionPromise);

      // Don't await here - let it run in background
      executionPromise.catch(error => {
        logger.error('Unhandled error in schedule execution', {
          workerId: this.workerId,
          scheduleId,
          error
        });
      });

    } catch (error) {
      logger.error('Error in claimAndExecute', {
        workerId: this.workerId,
        scheduleId,
        error
      });
    }
  }

  /**
   * Execute a schedule with proper cleanup
   */
  private async executeScheduleWithCleanup(scheduleId: string): Promise<void> {
    try {
      logger.info('Starting schedule execution', {
        workerId: this.workerId,
        scheduleId
      });

      await executeSchedule(scheduleId);

      logger.info('Schedule execution completed successfully', {
        workerId: this.workerId,
        scheduleId
      });

    } catch (error) {
      logger.error('Schedule execution failed', {
        workerId: this.workerId,
        scheduleId,
        error
      });

      // Release the claim on error
      await db.releaseScheduleClaim(scheduleId, this.workerId);

    } finally {
      // Always clean up the concurrent execution tracking
      this.concurrentExecutions.delete(scheduleId);
      
      logger.debug('Cleaned up execution tracking', {
        workerId: this.workerId,
        scheduleId,
        remainingExecutions: this.concurrentExecutions.size
      });
    }
  }

  /**
   * Clean up stale executions and expired claims
   */
  private async cleanupStaleExecutions(): Promise<void> {
    try {
      logger.debug('Performing stale execution cleanup', { workerId: this.workerId });

      // Release any claims that have expired (older than 10 minutes)
      const { schedules } = await db.querySchedules({
        status: ['running'],
        limit: 100
      });

      for (const schedule of schedules) {
        if (schedule.claimed_at) {
          const claimedAt = new Date(schedule.claimed_at);
          const expireTime = new Date(claimedAt.getTime() + 10 * 60 * 1000); // 10 minutes
          
          if (new Date() > expireTime && schedule.claimed_by !== this.workerId) {
            logger.warn('Releasing stale claim', {
              workerId: this.workerId,
              scheduleId: schedule.id,
              claimedBy: schedule.claimed_by,
              claimedAt: schedule.claimed_at
            });

            await db.updateSchedule(schedule.id, {
              status: 'scheduled',
              claimed_at: undefined,
              claimed_by: undefined
            });
          }
        }
      }

    } catch (error) {
      logger.error('Error in stale execution cleanup', {
        workerId: this.workerId,
        error
      });
    }
  }

  /**
   * Perform database cleanup (old records)
   */
  private async performDatabaseCleanup(): Promise<void> {
    try {
      logger.info('Performing database cleanup', { workerId: this.workerId });

      const cleanupDays = parseInt(process.env.CLEANUP_DAYS || '30');
      const result = await db.cleanup(cleanupDays);

      logger.info('Database cleanup completed', {
        workerId: this.workerId,
        schedulesRemoved: result.schedules,
        runsRemoved: result.runs,
        cleanupDays
      });

    } catch (error) {
      logger.error('Error in database cleanup', {
        workerId: this.workerId,
        error
      });
    }
  }

  /**
   * Process healing queue for automatic test fixing
   */
  private async processHealingQueue(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      const healingService = getSelfHealingService();
      
      // Check healing system health first
      const isHealthy = await healingService.healthCheck();
      if (!isHealthy) {
        logger.warn('Healing system health check failed, skipping queue processing', {
          workerId: this.workerId
        });
        return;
      }

      // Get pending healing items (limit to avoid overwhelming the system)
      const pendingItems = await healingService.getHealingQueue({
        status: 'pending',
        limit: 5 // Process max 5 items at a time
      });

      if (pendingItems.length === 0) {
        logger.debug('No pending healing items found', { workerId: this.workerId });
        return;
      }

      logger.info('Processing healing queue', {
        workerId: this.workerId,
        pendingCount: pendingItems.length
      });

      // Process each healing item
      for (const item of pendingItems) {
        await this.processHealingItem(item);
      }

      // Clean up old healing queue items (older than 7 days)
      await healingService.cleanup(7);

    } catch (error) {
      logger.error('Error processing healing queue', {
        workerId: this.workerId,
        error
      });
    }
  }

  /**
   * Process a single healing item
   */
  private async processHealingItem(item: any): Promise<void> {
    const healingService = getSelfHealingService();
    
    try {
      logger.info('Processing healing item', {
        workerId: this.workerId,
        itemId: item.id,
        testName: item.test_name,
        failureType: item.failure_type
      });

      // Update healing attempts count
      const currentAttempts = item.healing_attempts || 0;
      const maxAttempts = 3;

      if (currentAttempts >= maxAttempts) {
        logger.warn('Max healing attempts reached, marking as failed', {
          workerId: this.workerId,
          itemId: item.id,
          attempts: currentAttempts
        });

        await healingService.updateHealingItem(item.id, {
          status: 'failed',
          healingAttempts: currentAttempts + 1
        });
        return;
      }

      // Update to processing status
      await healingService.updateHealingItem(item.id, {
        status: 'processing',
        healingAttempts: currentAttempts + 1
      });

      // Try different healing strategies based on failure type
      let healingResult = null;

      switch (item.failure_type) {
        case 'SELECTOR_ISSUE':
          healingResult = await this.healSelectorIssue(item);
          break;
        case 'TIMING_ISSUE':
          healingResult = await this.healTimingIssue(item);
          break;
        case 'DOM_CHANGE':
          healingResult = await this.healDOMChangeIssue(item);
          break;
        case 'APPLICATION_BUG':
          // Application bugs should be reported to Jira, not healed
          logger.info('Application bug detected, marking for Jira integration', {
            itemId: item.id,
            testName: item.test_name
          });
          await healingService.updateHealingItem(item.id, {
            status: 'bug_confirmed'
          });
          return;
        default:
          logger.warn('Unknown failure type, attempting generic healing', {
            itemId: item.id,
            failureType: item.failure_type
          });
          healingResult = await this.healSelectorIssue(item); // Fallback to selector healing
      }

      // Update healing result
      if (healingResult && healingResult.success) {
        await healingService.updateHealingItem(item.id, {
          status: 'healed',
          healedSelector: healingResult.healedSelector,
          confidenceScore: healingResult.confidence
        });

        // Record the healing pattern for future use
        await healingService.recordHealing(
          item.test_id,
          item.test_name,
          item.failure_type,
          item.original_selector || 'unknown',
          healingResult.healedSelector,
          healingResult.confidence
        );

        logger.info('Successfully healed test', {
          workerId: this.workerId,
          itemId: item.id,
          originalSelector: item.original_selector,
          healedSelector: healingResult.healedSelector,
          confidence: healingResult.confidence
        });
      } else {
        await healingService.updateHealingItem(item.id, {
          status: 'pending' // Try again later
        });

        logger.warn('Healing attempt failed, will retry later', {
          workerId: this.workerId,
          itemId: item.id,
          attempts: currentAttempts + 1
        });
      }

    } catch (error) {
      logger.error('Error processing healing item', {
        workerId: this.workerId,
        itemId: item.id,
        error
      });

      // Mark as failed after error
      await healingService.updateHealingItem(item.id, {
        status: 'failed'
      });
    }
  }

  /**
   * Heal selector-related issues
   */
  private async healSelectorIssue(item: any): Promise<{success: boolean, healedSelector?: string, confidence?: number} | null> {
    const healingService = getSelfHealingService();

    try {
      // First, check if we have a learned pattern for this type of failure
      const existingPattern = await healingService.findHealingPattern(
        'selector',
        item.original_selector || 'unknown',
        'https://devtest.comda.co.il'
      );

      if (existingPattern && existingPattern.confidence_score > 0.7) {
        logger.info('Using learned healing pattern', {
          itemId: item.id,
          originalSelector: item.original_selector,
          healedSelector: existingPattern.healed_pattern,
          confidence: existingPattern.confidence_score
        });

        return {
          success: true,
          healedSelector: existingPattern.healed_pattern,
          confidence: existingPattern.confidence_score
        };
      }

      // If no learned pattern, try to find alternatives from DOM
      if (item.dom_snapshot) {
        const alternatives = await healingService.findAlternativeSelectors(
          item.original_selector || '',
          item.dom_snapshot
        );

        if (alternatives.length > 0) {
          const bestAlternative = alternatives[0];
          
          logger.info('Found alternative selector', {
            itemId: item.id,
            originalSelector: item.original_selector,
            alternativeSelector: bestAlternative.selector,
            confidence: bestAlternative.confidence
          });

          return {
            success: true,
            healedSelector: bestAlternative.selector,
            confidence: bestAlternative.confidence
          };
        }
      }

      logger.warn('No healing solution found for selector issue', {
        itemId: item.id,
        originalSelector: item.original_selector
      });

      return { success: false };

    } catch (error) {
      logger.error('Error healing selector issue', {
        itemId: item.id,
        error
      });
      return { success: false };
    }
  }

  /**
   * Heal timing-related issues
   */
  private async healTimingIssue(item: any): Promise<{success: boolean, healedSelector?: string, confidence?: number} | null> {
    try {
      // For timing issues, we can suggest increased wait times or better wait strategies
      const originalSelector = item.original_selector || '';
      
      // Add explicit wait conditions to the selector strategy
      const healedSelector = originalSelector ? 
        `${originalSelector} (with increased wait time: 15s)` : 
        'Apply explicit waits and visibility checks';

      logger.info('Applied timing-based healing', {
        itemId: item.id,
        healingStrategy: 'increased_wait_time',
        originalSelector,
        healedSelector
      });

      return {
        success: true,
        healedSelector,
        confidence: 0.8 // High confidence for timing fixes
      };

    } catch (error) {
      logger.error('Error healing timing issue', {
        itemId: item.id,
        error
      });
      return { success: false };
    }
  }

  /**
   * Heal DOM change-related issues
   */
  private async healDOMChangeIssue(item: any): Promise<{success: boolean, healedSelector?: string, confidence?: number} | null> {
    try {
      // For DOM changes, try to find more stable selectors
      const healingService = getSelfHealingService();
      
      if (item.dom_snapshot) {
        const alternatives = await healingService.findAlternativeSelectors(
          item.original_selector || '',
          item.dom_snapshot
        );

        // Prefer selectors that are less likely to change (data attributes, stable IDs)
        const stableAlternatives = alternatives.filter(alt => 
          alt.selector.includes('[data-') || 
          alt.selector.includes('#') && !alt.selector.includes('dynamic')
        );

        if (stableAlternatives.length > 0) {
          const bestAlternative = stableAlternatives[0];
          
          logger.info('Found stable alternative for DOM change', {
            itemId: item.id,
            originalSelector: item.original_selector,
            stableSelector: bestAlternative.selector,
            confidence: bestAlternative.confidence
          });

          return {
            success: true,
            healedSelector: bestAlternative.selector,
            confidence: bestAlternative.confidence * 0.9 // Slightly reduce confidence for DOM changes
          };
        }
      }

      return { success: false };

    } catch (error) {
      logger.error('Error healing DOM change issue', {
        itemId: item.id,
        error
      });
      return { success: false };
    }
  }

  /**
   * Get worker status
   */
  getStatus(): {
    workerId: string;
    isRunning: boolean;
    activeExecutions: number;
    maxConcurrentExecutions: number;
    uptime: number;
  } {
    return {
      workerId: this.workerId,
      isRunning: this.isRunning,
      activeExecutions: this.concurrentExecutions.size,
      maxConcurrentExecutions: this.maxConcurrentExecutions,
      uptime: process.uptime()
    };
  }
}

// Singleton worker instance
let workerInstance: SchedulerWorker | null = null;

/**
 * Get the global worker instance
 */
export function getWorker(): SchedulerWorker {
  if (!workerInstance) {
    workerInstance = new SchedulerWorker({
      maxConcurrentExecutions: parseInt(process.env.MAX_CONCURRENT_EXECUTIONS || '3'),
      pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '30000')
    });
  }
  return workerInstance;
}

/**
 * Start the global worker
 */
export async function startWorker(): Promise<void> {
  const worker = getWorker();
  await worker.start();
}

/**
 * Stop the global worker
 */
export async function stopWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.stop();
    workerInstance = null;
  }
}

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down worker gracefully');
  await stopWorker();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down worker gracefully');
  await stopWorker();
  process.exit(0);
});

// Main entry point when run directly
if (require.main === module) {
  (async () => {
    try {
      logger.info('Starting scheduler worker process');
      await startWorker();
      
      // Keep the process alive
      process.on('uncaughtException', (error) => {
        logger.error('Uncaught exception, shutting down', { error });
        stopWorker().then(() => process.exit(1));
      });

      process.on('unhandledRejection', (reason, promise) => {
        logger.error('Unhandled rejection, shutting down', { reason, promise });
        stopWorker().then(() => process.exit(1));
      });

    } catch (error) {
      logger.error('Failed to start worker', { error });
      process.exit(1);
    }
  })();
}