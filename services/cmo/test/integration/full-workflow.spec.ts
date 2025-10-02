/**
 * Full Workflow Integration Test
 * Tests the complete CMO/ELG workflow: Record → Checkpoint → Replay
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { GraphDef, NodeFn } from '../../src/elg/node.js';
import { ELGRuntime, type ExecutionResult } from '../../src/elg/runtime.js';
import { ActivityClientImpl } from '../../src/elg/activity/index.js';
import { ActivityMode } from '../../src/elg/activity.js';
import type { Checkpointer } from '../../src/elg/runtime.js';

/**
 * Test state
 */
interface TestWorkflowState {
  counter: number;
  messages: string[];
  total: number;
}

/**
 * Mock checkpointer (in-memory)
 */
class InMemoryCheckpointer implements Checkpointer {
  runs: Map<string, any> = new Map();
  steps: Map<string, any[]> = new Map();
  activities: Map<string, any[]> = new Map();

  async saveRun(traceId: string, graphId: string, graphVersion: string): Promise<void> {
    this.runs.set(traceId, { graphId, graphVersion, status: 'running' });
  }

  async saveStep(traceId: string, step: any): Promise<void> {
    if (!this.steps.has(traceId)) {
      this.steps.set(traceId, []);
    }
    this.steps.get(traceId)!.push(step);
  }

  async updateRunStatus(traceId: string, status: string): Promise<void> {
    const run = this.runs.get(traceId);
    if (run) run.status = status;
  }

  async getLastStep(traceId: string): Promise<any | null> {
    const steps = this.steps.get(traceId) || [];
    return steps.length > 0 ? steps[steps.length - 1] : null;
  }

  async getAllSteps(traceId: string): Promise<any[]> {
    return this.steps.get(traceId) || [];
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

  getAllActivities(traceId: string): any[] {
    const allActivities = [];
    const steps = this.steps.get(traceId) || [];

    for (let i = 0; i < steps.length; i++) {
      const key = `${traceId}:${i}`;
      const stepActivities = this.activities.get(key) || [];
      allActivities.push(...stepActivities.map((a) => ({ stepIndex: i, ...a })));
    }

    return allActivities;
  }
}

describe('CMO/ELG Full Workflow Integration', () => {
  let checkpointer: InMemoryCheckpointer;

  beforeAll(() => {
    checkpointer = new InMemoryCheckpointer();
  });

  it('executes a multi-step graph with activities and checkpointing', async () => {
    // Define a complex graph with activities
    const incrementNode: NodeFn<TestWorkflowState> = async (state, input, context) => {
      // Use virtual time
      const timestamp = await context.activity.now();

      return {
        state: {
          ...state,
          counter: state.counter + 1,
          messages: [...state.messages, `incremented at ${timestamp}`],
        },
        output: { counter: state.counter + 1, timestamp },
        next: 'randomize',
      };
    };

    const randomizeNode: NodeFn<TestWorkflowState> = async (state, input, context) => {
      // Use deterministic random
      const randomValue = await context.activity.rand(100);

      return {
        state: {
          ...state,
          total: state.total + randomValue,
          messages: [...state.messages, `added random ${randomValue}`],
        },
        output: { randomValue },
        next: 'finalize',
      };
    };

    const finalizeNode: NodeFn<TestWorkflowState> = async (state) => {
      return {
        state: {
          ...state,
          messages: [...state.messages, 'workflow complete'],
        },
        output: { final: state.total, counter: state.counter },
        next: null, // End
      };
    };

    const graph: GraphDef<TestWorkflowState> = {
      id: 'test-workflow',
      version: '1.0.0',
      name: 'Test Workflow',
      entryNode: 'increment',
      nodes: [
        { id: 'increment', name: 'Increment', fn: incrementNode },
        { id: 'randomize', name: 'Randomize', fn: randomizeNode },
        { id: 'finalize', name: 'Finalize', fn: finalizeNode },
      ],
      edges: [
        { key: 'randomize', from: 'increment', to: 'randomize' },
        { key: 'finalize', from: 'randomize', to: 'finalize' },
      ],
      initialState: () => ({ counter: 0, messages: [], total: 0 }),
    };

    // === RECORD PHASE ===
    const recordActivityClient = new ActivityClientImpl({
      mode: ActivityMode.RECORD,
      traceId: 'workflow-trace-1',
      checkpointer,
      baseTimestamp: '2025-01-01T00:00:00.000Z',
      randomSeed: 42,
    });

    const recordRuntime = new ELGRuntime({
      activityClient: recordActivityClient,
      checkpointer,
    });

    const recordResult = await recordRuntime.execute(graph, 'workflow-trace-1', null);

    // Verify execution completed
    expect(recordResult.status).toBe('completed');
    expect(recordResult.steps.length).toBe(3);

    // Verify final state
    expect(recordResult.finalState.counter).toBe(1);
    expect(recordResult.finalState.messages.length).toBe(3);
    expect(recordResult.finalState.total).toBeGreaterThan(0);

    // Verify steps were checkpointed
    const checkpointedSteps = await checkpointer.getAllSteps('workflow-trace-1');
    expect(checkpointedSteps.length).toBe(3);

    // Verify activities were recorded
    const allActivities = checkpointer.getAllActivities('workflow-trace-1');
    expect(allActivities.length).toBeGreaterThan(0); // Should have time + random calls

    // === REPLAY PHASE ===
    const replayActivityClient = new ActivityClientImpl({
      mode: ActivityMode.REPLAY,
      traceId: 'workflow-trace-1-replay',
      checkpointer,
      replayActivities: allActivities,
    });

    const replayRuntime = new ELGRuntime({
      activityClient: replayActivityClient,
      checkpointer,
    });

    const replayResult = await replayRuntime.execute(graph, 'workflow-trace-1-replay', null);

    // === VERIFICATION ===
    // Final states should match exactly
    expect(replayResult.finalState).toEqual(recordResult.finalState);

    // State hashes should match at each step
    expect(replayResult.steps.length).toBe(recordResult.steps.length);

    for (let i = 0; i < recordResult.steps.length; i++) {
      expect(replayResult.steps[i]!.stateHash).toBe(recordResult.steps[i]!.stateHash);
      expect(replayResult.steps[i]!.nodeId).toBe(recordResult.steps[i]!.nodeId);
    }

    console.log('\n=== Workflow Execution Summary ===');
    console.log(`Trace ID: ${recordResult.traceId}`);
    console.log(`Status: ${recordResult.status}`);
    console.log(`Steps: ${recordResult.steps.length}`);
    console.log(`Duration: ${recordResult.durationMs}ms`);
    console.log(`Final Counter: ${recordResult.finalState.counter}`);
    console.log(`Final Total: ${recordResult.finalState.total}`);
    console.log(`Messages: ${recordResult.finalState.messages.join(' → ')}`);
    console.log(`Activities Recorded: ${allActivities.length}`);
    console.log(`\n✅ Replay verification: All state hashes match!\n`);
  });

  it('handles conditional branching based on state', async () => {
    interface BranchState {
      value: number;
      path: string;
    }

    const checkValueNode: NodeFn<BranchState> = async (state) => {
      const nextNode = state.value > 50 ? 'high-path' : 'low-path';

      return {
        state: { ...state, path: nextNode },
        output: { decision: nextNode },
        next: nextNode,
      };
    };

    const highPathNode: NodeFn<BranchState> = async (state) => ({
      state: { ...state, value: state.value * 2 },
      output: null,
      next: null,
    });

    const lowPathNode: NodeFn<BranchState> = async (state) => ({
      state: { ...state, value: state.value + 10 },
      output: null,
      next: null,
    });

    const branchGraph: GraphDef<BranchState> = {
      id: 'branch-test',
      version: '1.0.0',
      name: 'Branch Test',
      entryNode: 'check',
      nodes: [
        { id: 'check', name: 'Check', fn: checkValueNode },
        { id: 'high-path', name: 'High Path', fn: highPathNode },
        { id: 'low-path', name: 'Low Path', fn: lowPathNode },
      ],
      edges: [
        { key: 'high-path', from: 'check', to: 'high-path' },
        { key: 'low-path', from: 'check', to: 'low-path' },
      ],
      initialState: () => ({ value: 25, path: '' }),
    };

    const activityClient = new ActivityClientImpl({
      mode: ActivityMode.RECORD,
      traceId: 'branch-trace-1',
      checkpointer,
    });

    const runtime = new ELGRuntime({
      activityClient,
      checkpointer,
    });

    const result = await runtime.execute(branchGraph, 'branch-trace-1', null);

    expect(result.status).toBe('completed');
    expect(result.finalState.path).toBe('low-path'); // 25 <= 50
    expect(result.finalState.value).toBe(35); // 25 + 10
  });

  it('verifies deterministic execution across multiple runs', async () => {
    interface DetState {
      count: number;
    }

    const simpleNode: NodeFn<DetState> = async (state, input, context) => {
      const time1 = await context.activity.now();
      const time2 = await context.activity.now();
      const rand = await context.activity.rand(1000);

      return {
        state: { count: state.count + rand },
        output: { time1, time2, rand },
        next: null,
      };
    };

    const detGraph: GraphDef<DetState> = {
      id: 'determinism-test',
      version: '1.0.0',
      name: 'Determinism Test',
      entryNode: 'simple',
      nodes: [{ id: 'simple', name: 'Simple', fn: simpleNode }],
      edges: [],
      initialState: () => ({ count: 0 }),
    };

    // Run 1
    const client1 = new ActivityClientImpl({
      mode: ActivityMode.RECORD,
      traceId: 'det-trace-1',
      checkpointer,
      baseTimestamp: '2025-01-01T00:00:00.000Z',
      randomSeed: 99999,
    });

    const runtime1 = new ELGRuntime({ activityClient: client1, checkpointer });
    const result1 = await runtime1.execute(detGraph, 'det-trace-1', null);

    // Run 2 (same seed and timestamp)
    const client2 = new ActivityClientImpl({
      mode: ActivityMode.RECORD,
      traceId: 'det-trace-2',
      checkpointer,
      baseTimestamp: '2025-01-01T00:00:00.000Z',
      randomSeed: 99999,
    });

    const runtime2 = new ELGRuntime({ activityClient: client2, checkpointer });
    const result2 = await runtime2.execute(detGraph, 'det-trace-2', null);

    // State hashes must match
    expect(result1.stateHash).toBe(result2.stateHash);
    expect(result1.finalState).toEqual(result2.finalState);

    console.log('\n=== Determinism Verification ===');
    console.log(`Run 1 State Hash: ${result1.stateHash}`);
    console.log(`Run 2 State Hash: ${result2.stateHash}`);
    console.log(`✅ Hashes match: Determinism verified!\n`);
  });
});
