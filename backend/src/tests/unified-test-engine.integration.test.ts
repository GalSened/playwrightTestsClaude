/**
 * Integration Tests for Phase 2 Unified Test Engine
 * Tests the complete flow from API to execution
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { unifiedTestEngine } from '../core/wesign/UnifiedTestEngine';
import { executionManager } from '../core/wesign/ExecutionManager';
import { testScheduler } from '../core/wesign/TestScheduler';
import { globalEventBus } from '../core/wesign/EventBus';
import { UnifiedTestConfig } from '../core/wesign/types';

// Mock Express app for testing
import express from 'express';
import { wesignRouter } from '../api/unified/WeSignRoutes';

const app = express();
app.use(express.json());
app.use('/api/wesign', wesignRouter);

describe('Phase 2 Unified Test Engine Integration', () => {
  beforeAll(async () => {
    // Initialize system components
    console.log('Initializing Phase 2 test environment...');

    // Give components time to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    // Clean shutdown
    await unifiedTestEngine.shutdown();
    await executionManager.shutdown();
    await testScheduler.shutdown();
    await globalEventBus.shutdown();
  });

  beforeEach(async () => {
    // Clear any existing executions
    const activeExecutions = unifiedTestEngine.getActiveExecutions();
    for (const execution of activeExecutions) {
      await unifiedTestEngine.cancelExecution(execution.executionId);
    }
  });

  describe('UnifiedTestEngine', () => {
    test('should initialize with framework adapters', async () => {
      const health = await unifiedTestEngine.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.adapters).toHaveProperty('wesign');
      expect(health.adapters).toHaveProperty('playwright');
      expect(health.adapters['wesign']).toBe(true);
    });

    test('should execute WeSign tests via unified config', async () => {
      const config: UnifiedTestConfig = {
        framework: 'wesign',
        execution: {
          mode: 'single',
          workers: 1,
          timeout: 30000,
          headless: true
        },
        tests: {
          pattern: 'tests/auth/test_simple.py' // Use a simple test
        },
        ai: {
          enabled: false // Disable AI for faster testing
        },
        realTime: {
          monitoring: false,
          notifications: false,
          streaming: false
        }
      };

      const executionHandle = await unifiedTestEngine.executeTests(config);

      expect(executionHandle.executionId).toBeDefined();
      expect(executionHandle.framework).toBe('wesign');
      expect(executionHandle.status).toMatch(/queued|running/);

      // Wait a moment for execution to start
      await new Promise(resolve => setTimeout(resolve, 2000));

      const status = await unifiedTestEngine.getExecutionStatus(executionHandle.executionId);
      expect(status).toBeDefined();
      expect(status!.executionId).toBe(executionHandle.executionId);
    });

    test('should handle invalid framework gracefully', async () => {
      const config: UnifiedTestConfig = {
        framework: 'invalid-framework' as any,
        execution: { mode: 'single' },
        tests: { pattern: 'test.py' },
        ai: { enabled: false },
        realTime: { monitoring: false, notifications: false, streaming: false }
      };

      await expect(unifiedTestEngine.executeTests(config)).rejects.toThrow();
    });
  });

  describe('ExecutionManager', () => {
    test('should queue and manage executions', async () => {
      const config: UnifiedTestConfig = {
        framework: 'wesign',
        execution: { mode: 'single', timeout: 10000 },
        tests: { pattern: 'test_simple.py' },
        ai: { enabled: false },
        realTime: { monitoring: false, notifications: false, streaming: false }
      };

      const executionId = await executionManager.queueExecution(
        config,
        { priority: 'normal' },
        'integration-test'
      );

      expect(executionId).toBeDefined();

      const queueStatus = executionManager.getQueueStatus();
      expect(queueStatus.totalQueued + queueStatus.totalRunning).toBeGreaterThan(0);

      const resourceUsage = await executionManager.getResourceUsage();
      expect(resourceUsage).toHaveProperty('memoryMB');
      expect(resourceUsage).toHaveProperty('cpuPercentage');
    });

    test('should cancel queued executions', async () => {
      const config: UnifiedTestConfig = {
        framework: 'wesign',
        execution: { mode: 'single', timeout: 60000 },
        tests: { pattern: 'test_long_running.py' },
        ai: { enabled: false },
        realTime: { monitoring: false, notifications: false, streaming: false }
      };

      const executionId = await executionManager.queueExecution(config);

      const cancelled = await executionManager.cancelExecution(executionId);
      expect(cancelled).toBe(true);
    });
  });

  describe('TestScheduler', () => {
    test('should create and manage schedules', async () => {
      const scheduleConfig = {
        name: 'Test Schedule',
        description: 'Integration test schedule',
        cronExpression: '0 0 * * *', // Daily at midnight
        testConfig: {
          framework: 'wesign' as const,
          execution: { mode: 'single' as const },
          tests: { pattern: 'test.py' },
          ai: { enabled: false },
          realTime: { monitoring: false, notifications: false, streaming: false }
        },
        priority: 'normal' as const,
        enabled: false // Don't actually run it
      };

      const scheduleId = await testScheduler.createSchedule(scheduleConfig);
      expect(scheduleId).toBeDefined();

      const schedules = testScheduler.getSchedules();
      const createdSchedule = schedules.find(s => s.id === scheduleId);
      expect(createdSchedule).toBeDefined();
      expect(createdSchedule!.config.name).toBe('Test Schedule');

      // Update schedule
      const updated = await testScheduler.updateSchedule(scheduleId, { enabled: true });
      expect(updated).toBe(true);

      // Delete schedule
      const deleted = await testScheduler.deleteSchedule(scheduleId);
      expect(deleted).toBe(true);
    });
  });

  describe('API Integration', () => {
    test('should execute tests via API endpoint', async () => {
      const response = await request(app)
        .post('/api/wesign/execute')
        .send({
          framework: 'wesign',
          mode: 'single',
          timeout: 30000,
          testIds: ['test_simple.py'],
          aiEnabled: false
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.executionId).toBeDefined();
      expect(response.body.status).toBe('queued');
    });

    test('should get execution status via API', async () => {
      // First, start an execution
      const executeResponse = await request(app)
        .post('/api/wesign/execute')
        .send({
          framework: 'wesign',
          mode: 'single',
          testIds: ['test_simple.py'],
          aiEnabled: false
        })
        .expect(200);

      const executionId = executeResponse.body.executionId;

      // Then get status
      const statusResponse = await request(app)
        .get(`/api/wesign/execute/${executionId}/status`)
        .expect(200);

      expect(statusResponse.body.success).toBe(true);
      expect(statusResponse.body.execution).toBeDefined();
      expect(statusResponse.body.execution.executionId).toBe(executionId);
    });

    test('should get queue status via API', async () => {
      const response = await request(app)
        .get('/api/wesign/queue/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.queue).toBeDefined();
      expect(response.body.resources).toBeDefined();
      expect(response.body.queue).toHaveProperty('totalQueued');
      expect(response.body.queue).toHaveProperty('totalRunning');
    });

    test('should get health status via API', async () => {
      const response = await request(app)
        .get('/api/wesign/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.health).toBeDefined();
      expect(response.body.health.version).toBe('2.0');
      expect(response.body.health.components).toHaveProperty('unifiedEngine');
      expect(response.body.health.components).toHaveProperty('executionManager');
      expect(response.body.health.components).toHaveProperty('testScheduler');
    });

    test('should create schedule via API', async () => {
      const scheduleData = {
        name: 'API Test Schedule',
        cronExpression: '0 0 * * *',
        testConfig: {
          framework: 'wesign',
          execution: { mode: 'single' },
          tests: { pattern: 'test.py' },
          ai: { enabled: false },
          realTime: { monitoring: false, notifications: false, streaming: false }
        },
        priority: 'normal',
        enabled: false
      };

      const response = await request(app)
        .post('/api/wesign/schedule')
        .send(scheduleData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.scheduleId).toBeDefined();

      // Clean up
      const scheduleId = response.body.scheduleId;
      await request(app)
        .delete(`/api/wesign/schedule/${scheduleId}`)
        .expect(200);
    });
  });

  describe('Event System Integration', () => {
    test('should emit events during test execution', (done) => {
      const eventListener = jest.fn();
      let subscriptionCleanup: (() => void) | null = null;

      const testExecution = async () => {
        // Subscribe to test execution events
        subscriptionCleanup = globalEventBus.subscribe(
          'test.execution.started' as any,
          eventListener
        );

        const config: UnifiedTestConfig = {
          framework: 'wesign',
          execution: { mode: 'single', timeout: 10000 },
          tests: { pattern: 'test_simple.py' },
          ai: { enabled: false },
          realTime: { monitoring: true, notifications: false, streaming: false }
        };

        await unifiedTestEngine.executeTests(config);

        // Wait for events
        setTimeout(() => {
          expect(eventListener).toHaveBeenCalled();
          if (subscriptionCleanup) {
            subscriptionCleanup();
          }
          done();
        }, 3000);
      };

      testExecution().catch(done);
    });
  });

  describe('Performance and Reliability', () => {
    test('should handle multiple concurrent executions', async () => {
      const promises = [];
      const executionCount = 3;

      for (let i = 0; i < executionCount; i++) {
        const config: UnifiedTestConfig = {
          framework: 'wesign',
          execution: { mode: 'single', timeout: 15000 },
          tests: { pattern: `test_concurrent_${i}.py` },
          ai: { enabled: false },
          realTime: { monitoring: false, notifications: false, streaming: false }
        };

        promises.push(
          executionManager.queueExecution(config, { priority: 'normal' }, `test-${i}`)
        );
      }

      const executionIds = await Promise.all(promises);
      expect(executionIds).toHaveLength(executionCount);
      expect(new Set(executionIds).size).toBe(executionCount); // All unique
    });

    test('should maintain system health under load', async () => {
      const initialHealth = await unifiedTestEngine.healthCheck();
      expect(initialHealth.healthy).toBe(true);

      // Simulate some load
      const config: UnifiedTestConfig = {
        framework: 'wesign',
        execution: { mode: 'single', timeout: 5000 },
        tests: { pattern: 'test_load.py' },
        ai: { enabled: false },
        realTime: { monitoring: false, notifications: false, streaming: false }
      };

      for (let i = 0; i < 5; i++) {
        await executionManager.queueExecution(config);
      }

      // Check health after load
      const healthAfterLoad = await unifiedTestEngine.healthCheck();
      expect(healthAfterLoad.healthy).toBe(true);
    });
  });
});

// Helper function to wait for execution completion
async function waitForExecutionCompletion(
  executionId: string,
  maxWaitTime: number = 30000
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    const status = await unifiedTestEngine.getExecutionStatus(executionId);

    if (status && (status.status === 'completed' || status.status === 'failed')) {
      return status.status === 'completed';
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return false;
}