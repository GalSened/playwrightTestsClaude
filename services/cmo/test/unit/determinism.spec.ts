/**
 * Determinism Tests
 * Verifies that the same inputs produce the same outputs
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { GraphDef, NodeFn, NodeResult } from '../../src/elg/node.js';
import { ELGRuntime } from '../../src/elg/runtime.js';
import { PostgresCheckpointer } from '../../src/elg/checkpointer/postgres.js';

// Mock checkpointer for testing (in-memory)
class MockCheckpointer {
  private runs: Map<string, any> = new Map();
  private steps: Map<string, any[]> = new Map();

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
    if (run) {
      run.status = status;
    }
  }

  async getLastStep(traceId: string): Promise<any | null> {
    const steps = this.steps.get(traceId) || [];
    return steps.length > 0 ? steps[steps.length - 1] : null;
  }

  async getAllSteps(traceId: string): Promise<any[]> {
    return this.steps.get(traceId) || [];
  }
}

// Mock activity client for testing
class MockActivityClient {
  getMode() {
    return 'record';
  }

  getCurrentStepIndex() {
    return 0;
  }

  incrementStepIndex() {}

  async sendA2A() {}
  async callMCP() {}
  async readArtifact() {
    return { size: 0, hash: '' };
  }
  async writeArtifact() {
    return '';
  }
  async now() {
    return '2025-01-01T00:00:00.000Z';
  }
  async rand(max: number) {
    return 42; // Deterministic for testing
  }
  async httpRequest() {
    return { status: 200, headers: {}, body: {} };
  }
  async databaseQuery() {
    return [];
  }
  async flush() {}
}

describe('ELG Determinism', () => {
  let checkpointer: MockCheckpointer;
  let activityClient: MockActivityClient;

  beforeAll(() => {
    checkpointer = new MockCheckpointer();
    activityClient = new MockActivityClient();
  });

  it('produces same state hash for same inputs', async () => {
    // Create a simple graph
    interface TestState {
      counter: number;
      message: string;
    }

    const incrementNode: NodeFn<TestState> = async (state, input) => {
      return {
        state: {
          ...state,
          counter: state.counter + 1,
        },
        output: state.counter + 1,
        next: 'append',
      };
    };

    const appendNode: NodeFn<TestState> = async (state, input) => {
      return {
        state: {
          ...state,
          message: state.message + '-step',
        },
        output: state.message + '-step',
        next: null, // Terminate
      };
    };

    const graph: GraphDef<TestState> = {
      id: 'test-graph',
      version: '1.0.0',
      name: 'Determinism Test Graph',
      entryNode: 'increment',
      nodes: [
        { id: 'increment', name: 'Increment', fn: incrementNode },
        { id: 'append', name: 'Append', fn: appendNode },
      ],
      edges: [
        { key: 'append', from: 'increment', to: 'append' },
      ],
      initialState: () => ({ counter: 0, message: 'start' }),
    };

    // Execute graph twice with same inputs
    const runtime1 = new ELGRuntime({
      activityClient: activityClient as any,
      checkpointer: checkpointer as any,
    });

    const runtime2 = new ELGRuntime({
      activityClient: activityClient as any,
      checkpointer: checkpointer as any,
    });

    const result1 = await runtime1.execute(graph, 'trace-1', null);
    const result2 = await runtime2.execute(graph, 'trace-2', null);

    // Both executions should produce same final state
    expect(result1.finalState).toEqual(result2.finalState);

    // Both should have same number of steps
    expect(result1.steps.length).toBe(result2.steps.length);

    // State hashes should match at each step
    for (let i = 0; i < result1.steps.length; i++) {
      expect(result1.steps[i].stateHash).toBe(result2.steps[i].stateHash);
    }
  });

  it('handles node execution errors gracefully', async () => {
    interface TestState {
      value: number;
    }

    const errorNode: NodeFn<TestState> = async (state, input) => {
      throw new Error('Intentional test error');
    };

    const graph: GraphDef<TestState> = {
      id: 'error-graph',
      version: '1.0.0',
      name: 'Error Test Graph',
      entryNode: 'error',
      nodes: [{ id: 'error', name: 'Error Node', fn: errorNode }],
      edges: [],
      initialState: () => ({ value: 0 }),
    };

    const runtime = new ELGRuntime({
      activityClient: activityClient as any,
      checkpointer: checkpointer as any,
    });

    const result = await runtime.execute(graph, 'trace-error', null);

    expect(result.status).toBe('failed');
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain('Intentional test error');
  });

  it('executes multi-step graph correctly', async () => {
    interface TestState {
      steps: string[];
    }

    const step1: NodeFn<TestState> = async (state) => ({
      state: { ...state, steps: [...state.steps, 'step1'] },
      output: null,
      next: 'step2',
    });

    const step2: NodeFn<TestState> = async (state) => ({
      state: { ...state, steps: [...state.steps, 'step2'] },
      output: null,
      next: 'step3',
    });

    const step3: NodeFn<TestState> = async (state) => ({
      state: { ...state, steps: [...state.steps, 'step3'] },
      output: null,
      next: null,
    });

    const graph: GraphDef<TestState> = {
      id: 'multi-step-graph',
      version: '1.0.0',
      name: 'Multi-Step Graph',
      entryNode: 'step1',
      nodes: [
        { id: 'step1', name: 'Step 1', fn: step1 },
        { id: 'step2', name: 'Step 2', fn: step2 },
        { id: 'step3', name: 'Step 3', fn: step3 },
      ],
      edges: [
        { key: 'step2', from: 'step1', to: 'step2' },
        { key: 'step3', from: 'step2', to: 'step3' },
      ],
      initialState: () => ({ steps: [] }),
    };

    const runtime = new ELGRuntime({
      activityClient: activityClient as any,
      checkpointer: checkpointer as any,
    });

    const result = await runtime.execute(graph, 'trace-multi', null);

    expect(result.status).toBe('completed');
    expect(result.finalState.steps).toEqual(['step1', 'step2', 'step3']);
    expect(result.steps.length).toBe(3);
  });
});
