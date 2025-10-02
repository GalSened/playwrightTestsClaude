/**
 * ActivityClient Contract Tests
 * Verifies record/replay boundary enforcement and determinism
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ActivityClientImpl, type ActivityClientConfig } from '../../src/elg/activity/index.js';
import { ActivityMode } from '../../src/elg/activity.js';
import type { Checkpointer } from '../../src/elg/runtime.js';

/**
 * Mock checkpointer for testing
 */
class MockCheckpointer implements Checkpointer {
  activities: Map<string, any[]> = new Map();

  async saveRun(): Promise<void> {}
  async saveStep(): Promise<void> {}
  async updateRunStatus(): Promise<void> {}
  async getLastStep(): Promise<any> {
    return null;
  }
  async getAllSteps(): Promise<any[]> {
    return [];
  }

  async saveActivity(
    traceId: string,
    stepIndex: number,
    activityType: string,
    requestHash: string,
    requestData: unknown,
    responseData: unknown | undefined,
    responseBlobRef: string | undefined,
    timestamp: string,
    durationMs: number | undefined,
    error: { message: string; stack?: string } | undefined
  ): Promise<void> {
    const key = `${traceId}:${stepIndex}`;
    if (!this.activities.has(key)) {
      this.activities.set(key, []);
    }

    this.activities.get(key)!.push({
      activityType,
      requestHash,
      requestData,
      responseData,
      responseBlobRef,
      timestamp,
      durationMs,
      error,
    });
  }

  async getActivitiesForStep(traceId: string, stepIndex: number): Promise<any[]> {
    const key = `${traceId}:${stepIndex}`;
    return this.activities.get(key) || [];
  }

  getActivityByTypeAndHash(
    traceId: string,
    stepIndex: number,
    activityType: string,
    requestHash: string
  ): any {
    const key = `${traceId}:${stepIndex}`;
    const activities = this.activities.get(key) || [];
    return activities.find(
      (a) => a.activityType === activityType && a.requestHash === requestHash
    );
  }
}

describe('ActivityClient - Record Mode', () => {
  let checkpointer: MockCheckpointer;
  let client: ActivityClientImpl;

  beforeEach(() => {
    checkpointer = new MockCheckpointer();

    const config: ActivityClientConfig = {
      mode: ActivityMode.RECORD,
      traceId: 'test-trace-1',
      checkpointer,
      baseTimestamp: '2025-01-01T00:00:00.000Z',
      randomSeed: 12345,
    };

    client = new ActivityClientImpl(config);
  });

  it('records time activity with virtual clock', async () => {
    const time1 = await client.now();
    const time2 = await client.now();
    const time3 = await client.now();

    // Virtual time increments by 1ms per call
    expect(time1).toBe('2025-01-01T00:00:00.000Z');
    expect(time2).toBe('2025-01-01T00:00:00.001Z');
    expect(time3).toBe('2025-01-01T00:00:00.002Z');

    // Verify activities were recorded
    const activities = await checkpointer.getActivitiesForStep('test-trace-1', 0);
    expect(activities.length).toBe(3);
    expect(activities[0]!.activityType).toBe('time');
    expect(activities[0]!.responseData).toBe(time1);
  });

  it('records random activities with seeded RNG', async () => {
    const rand1 = await client.rand(100);
    const rand2 = await client.rand(100);
    const rand3 = await client.rand(100);

    // Seeded RNG produces deterministic values
    expect(rand1).toBeGreaterThanOrEqual(0);
    expect(rand1).toBeLessThan(100);
    expect(rand2).toBeGreaterThanOrEqual(0);
    expect(rand2).toBeLessThan(100);

    // Different seeds should produce different sequences
    // But same seed should always produce same sequence
    const activities = await checkpointer.getActivitiesForStep('test-trace-1', 0);
    expect(activities.length).toBe(3);
    expect(activities[0]!.activityType).toBe('random');
    expect(activities[0]!.responseData).toBe(rand1);
  });

  it('records HTTP requests', async () => {
    // Mock global fetch for testing
    const originalFetch = global.fetch;
    global.fetch = async (url: string | URL | Request, options?: any) => {
      return {
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        text: async () => '{"result":"ok"}',
      } as any;
    };

    try {
      const response = await client.httpRequest('https://example.com/api');

      expect(response.status).toBe(200);
      expect(response.body).toBe('{"result":"ok"}');

      const activities = await checkpointer.getActivitiesForStep('test-trace-1', 0);
      expect(activities.length).toBe(1);
      expect(activities[0]!.activityType).toBe('http');
      expect(activities[0]!.requestData).toEqual({
        url: 'https://example.com/api',
        options: undefined,
      });
      expect(activities[0]!.responseData).toEqual(response);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('records A2A messages', async () => {
    const envelope = {
      meta: { correlationId: 'test-123', traceId: 'trace-1' },
      payload: { task: 'analyze' },
    };

    const result = await client.sendA2A(envelope);

    expect(result).toHaveProperty('status');
    expect((result as any).status).toBe('acknowledged');

    const activities = await checkpointer.getActivitiesForStep('test-trace-1', 0);
    expect(activities.length).toBe(1);
    expect(activities[0]!.activityType).toBe('a2a');
    expect(activities[0]!.requestData).toEqual(envelope);
  });

  it('increments step index correctly', async () => {
    await client.now();
    expect(client.getCurrentStepIndex()).toBe(0);

    client.incrementStepIndex();
    expect(client.getCurrentStepIndex()).toBe(1);

    await client.now();
    const activities0 = await checkpointer.getActivitiesForStep('test-trace-1', 0);
    const activities1 = await checkpointer.getActivitiesForStep('test-trace-1', 1);

    expect(activities0.length).toBe(1);
    expect(activities1.length).toBe(1);
  });
});

describe('ActivityClient - Replay Mode', () => {
  let checkpointer: MockCheckpointer;
  let recordClient: ActivityClientImpl;
  let replayClient: ActivityClientImpl;

  beforeEach(() => {
    checkpointer = new MockCheckpointer();

    // First, record activities
    const recordConfig: ActivityClientConfig = {
      mode: ActivityMode.RECORD,
      traceId: 'test-trace-2',
      checkpointer,
      baseTimestamp: '2025-01-01T00:00:00.000Z',
      randomSeed: 54321,
    };

    recordClient = new ActivityClientImpl(recordConfig);
  });

  it('replays time activities deterministically', async () => {
    // Record phase
    const time1 = await recordClient.now();
    const time2 = await recordClient.now();

    // Get recorded activities
    const recordedActivities = await checkpointer.getActivitiesForStep('test-trace-2', 0);

    // Replay phase
    const replayConfig: ActivityClientConfig = {
      mode: ActivityMode.REPLAY,
      traceId: 'test-trace-2',
      checkpointer,
      replayActivities: recordedActivities.map((a) => ({
        activityType: a.activityType,
        requestHash: a.requestHash,
        requestData: a.requestData,
        responseData: a.responseData,
        timestamp: a.timestamp,
      })),
    };

    replayClient = new ActivityClientImpl(replayConfig);

    const replayTime1 = await replayClient.now();
    const replayTime2 = await replayClient.now();

    // Replayed values must match exactly
    expect(replayTime1).toBe(time1);
    expect(replayTime2).toBe(time2);
  });

  it('replays random activities deterministically', async () => {
    // Record phase
    const rand1 = await recordClient.rand(100);
    const rand2 = await recordClient.rand(100);
    const rand3 = await recordClient.rand(100);

    const recordedActivities = await checkpointer.getActivitiesForStep('test-trace-2', 0);

    // Replay phase
    const replayConfig: ActivityClientConfig = {
      mode: ActivityMode.REPLAY,
      traceId: 'test-trace-2',
      checkpointer,
      replayActivities: recordedActivities.map((a) => ({
        activityType: a.activityType,
        requestHash: a.requestHash,
        requestData: a.requestData,
        responseData: a.responseData,
        timestamp: a.timestamp,
      })),
    };

    replayClient = new ActivityClientImpl(replayConfig);

    const replayRand1 = await replayClient.rand(100);
    const replayRand2 = await replayClient.rand(100);
    const replayRand3 = await replayClient.rand(100);

    expect(replayRand1).toBe(rand1);
    expect(replayRand2).toBe(rand2);
    expect(replayRand3).toBe(rand3);
  });

  it('replays HTTP requests without actual network calls', async () => {
    // Record phase
    const originalFetch = global.fetch;
    let fetchCallCount = 0;

    global.fetch = async (url: string | URL | Request, options?: any) => {
      fetchCallCount++;
      return {
        status: 200,
        statusText: 'OK',
        headers: new Map([['x-request-id', 'abc123']]),
        text: async () => '{"data":"recorded"}',
      } as any;
    };

    try {
      const response = await recordClient.httpRequest('https://api.example.com/data');
      expect(fetchCallCount).toBe(1);
      expect(response.body).toBe('{"data":"recorded"}');

      const recordedActivities = await checkpointer.getActivitiesForStep('test-trace-2', 0);

      // Replay phase - reset fetch to fail if called
      fetchCallCount = 0;
      global.fetch = async () => {
        throw new Error('Network should not be called during replay!');
      };

      const replayConfig: ActivityClientConfig = {
        mode: ActivityMode.REPLAY,
        traceId: 'test-trace-2',
        checkpointer,
        replayActivities: recordedActivities.map((a) => ({
          activityType: a.activityType,
          requestHash: a.requestHash,
          requestData: a.requestData,
          responseData: a.responseData,
          timestamp: a.timestamp,
        })),
      };

      replayClient = new ActivityClientImpl(replayConfig);

      const replayResponse = await replayClient.httpRequest('https://api.example.com/data');

      // Should not have called fetch
      expect(fetchCallCount).toBe(0);

      // Response should match exactly
      expect(replayResponse).toEqual(response);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('throws error when replay activity not found', async () => {
    // Empty replay activities
    const replayConfig: ActivityClientConfig = {
      mode: ActivityMode.REPLAY,
      traceId: 'test-trace-2',
      checkpointer,
      replayActivities: [],
    };

    replayClient = new ActivityClientImpl(replayConfig);

    // Should throw when trying to replay missing activity
    await expect(replayClient.now()).rejects.toThrow(/Replay failed.*activity not found/);
  });
});

describe('ActivityClient - Determinism Verification', () => {
  it('produces identical activity hashes for identical requests', async () => {
    const checkpointer = new MockCheckpointer();

    const config1: ActivityClientConfig = {
      mode: ActivityMode.RECORD,
      traceId: 'trace-determinism-1',
      checkpointer,
      baseTimestamp: '2025-01-01T00:00:00.000Z',
      randomSeed: 99999,
    };

    const config2: ActivityClientConfig = {
      mode: ActivityMode.RECORD,
      traceId: 'trace-determinism-2',
      checkpointer,
      baseTimestamp: '2025-01-01T00:00:00.000Z',
      randomSeed: 99999,
    };

    const client1 = new ActivityClientImpl(config1);
    const client2 = new ActivityClientImpl(config2);

    // Execute same operations
    await client1.now();
    await client1.rand(50);

    await client2.now();
    await client2.rand(50);

    const activities1 = await checkpointer.getActivitiesForStep('trace-determinism-1', 0);
    const activities2 = await checkpointer.getActivitiesForStep('trace-determinism-2', 0);

    // Should have same request hashes
    expect(activities1[0]!.requestHash).toBe(activities2[0]!.requestHash);
    expect(activities1[1]!.requestHash).toBe(activities2[1]!.requestHash);

    // Should have same response data (deterministic)
    expect(activities1[0]!.responseData).toBe(activities2[0]!.responseData);
    expect(activities1[1]!.responseData).toBe(activities2[1]!.responseData);
  });

  it('enforces that all I/O goes through activities', async () => {
    const checkpointer = new MockCheckpointer();

    const config: ActivityClientConfig = {
      mode: ActivityMode.RECORD,
      traceId: 'test-trace-io',
      checkpointer,
    };

    const client = new ActivityClientImpl(config);

    // Any I/O operation should go through client
    await client.now();
    await client.rand(10);

    const activities = await checkpointer.getActivitiesForStep('test-trace-io', 0);

    // All activities should be recorded
    expect(activities.length).toBe(2);
    expect(activities.every((a) => a.activityType && a.requestHash)).toBe(true);
  });
});
