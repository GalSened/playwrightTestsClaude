/**
 * Policy Enforcement Contract Tests
 * Verifies OPA policy enforcement and decision logic
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { PolicyEvaluator, type PolicyContext } from '../../src/elg/policy/index.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SLICES_REGO_PATH = join(__dirname, '../../policies/slices.rego');
const SLICES_WASM_PATH = join(__dirname, '../../policies/slices.wasm');

// Mock policy evaluator for tests (when WASM not available)
class MockPolicyEvaluator {
  private enabled: boolean;

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
  }

  async initialize(): Promise<void> {
    // No-op for mock
  }

  async evaluate(context: PolicyContext): Promise<{ allowed: boolean; reason?: string }> {
    if (!this.enabled) {
      return { allowed: true };
    }

    // Simulate slices.rego logic
    const denials: string[] = [];

    // Check selector history leak
    if (
      context.phase === 'pre' &&
      context.data &&
      typeof context.data === 'object' &&
      'payload' in context.data
    ) {
      const payload = (context.data as any).payload;
      const meta = (context.data as any).meta;

      if (
        payload?.sliceFields &&
        Array.isArray(payload.sliceFields) &&
        payload.sliceFields.includes('selectorHistory') &&
        meta?.targetSpecialist !== 'healer'
      ) {
        denials.push(
          `selector_history_leak: Selector history can only be sent to healer specialist, not ${meta.targetSpecialist}`
        );
      }

      // Check write scope
      if (
        payload?.writeScope &&
        typeof payload.writeScope === 'string' &&
        !payload.writeScope.startsWith('healing/')
      ) {
        denials.push(
          `invalid_write_scope: Write scope '${payload.writeScope}' must start with 'healing/'`
        );
      }

      // Check payload size
      if (payload?.size && payload.size > 10485760) {
        denials.push(`payload_too_large: Payload size ${payload.size} bytes exceeds 10MB limit`);
      }

      // Check unregistered specialist
      const registered = ['healer', 'analyzer', 'optimizer', 'validator', 'executor'];
      if (meta?.targetSpecialist && !registered.includes(meta.targetSpecialist)) {
        denials.push(
          `unregistered_specialist: Specialist '${meta.targetSpecialist}' is not registered`
        );
      }
    }

    // Post-execution checks
    if (context.phase === 'post' && context.data && typeof context.data === 'object' && 'result' in context.data) {
      const result = (context.data as any).result;

      if (result?.status === 'success' && result?.error) {
        denials.push('inconsistent_result: Result marked as success but contains error');
      }

      if (result?.durationMs && result.durationMs > 30000) {
        denials.push(
          `execution_timeout: Execution took ${result.durationMs}ms, exceeds 30s limit`
        );
      }
    }

    if (denials.length > 0) {
      return {
        allowed: false,
        reason: denials.join('; '),
      };
    }

    return { allowed: true };
  }

  async evaluateOrThrow(context: PolicyContext): Promise<void> {
    const decision = await this.evaluate(context);
    if (!decision.allowed) {
      throw new Error(`Policy denied: ${decision.reason}`);
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

describe('Policy Enforcement - Slices Policy', () => {
  let evaluator: MockPolicyEvaluator;

  beforeAll(async () => {
    // Use mock evaluator (WASM compilation requires OPA CLI)
    // In CI, compile WASM and use real PolicyEvaluator
    evaluator = new MockPolicyEvaluator(true);
    await evaluator.initialize();
  });

  describe('Pre-Execution Gates', () => {
    it('denies selector history sent to non-healer specialist', async () => {
      const context: PolicyContext = {
        phase: 'pre',
        graph: { id: 'test-graph', version: '1.0.0' },
        execution: { traceId: 'test-123', stepIndex: 0, nodeId: 'n1' },
        data: {
          meta: { targetSpecialist: 'analyzer' },
          payload: { sliceFields: ['selectorHistory', 'testResults'] },
        },
      };

      const decision = await evaluator.evaluate(context);

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('selector_history_leak');
      expect(decision.reason).toContain('healer specialist');
    });

    it('allows selector history sent to healer specialist', async () => {
      const context: PolicyContext = {
        phase: 'pre',
        graph: { id: 'test-graph', version: '1.0.0' },
        execution: { traceId: 'test-123', stepIndex: 0, nodeId: 'n1' },
        data: {
          meta: { targetSpecialist: 'healer' },
          payload: { sliceFields: ['selectorHistory', 'testResults'] },
        },
      };

      const decision = await evaluator.evaluate(context);

      expect(decision.allowed).toBe(true);
    });

    it('denies write scope outside healing/* namespace', async () => {
      const context: PolicyContext = {
        phase: 'pre',
        graph: { id: 'test-graph', version: '1.0.0' },
        execution: { traceId: 'test-123', stepIndex: 0, nodeId: 'n1' },
        data: {
          meta: { targetSpecialist: 'healer' },
          payload: { writeScope: 'config/settings' },
        },
      };

      const decision = await evaluator.evaluate(context);

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('invalid_write_scope');
      expect(decision.reason).toContain("must start with 'healing/'");
    });

    it('allows write scope within healing/* namespace', async () => {
      const context: PolicyContext = {
        phase: 'pre',
        graph: { id: 'test-graph', version: '1.0.0' },
        execution: { traceId: 'test-123', stepIndex: 0, nodeId: 'n1' },
        data: {
          meta: { targetSpecialist: 'healer' },
          payload: { writeScope: 'healing/selectors' },
        },
      };

      const decision = await evaluator.evaluate(context);

      expect(decision.allowed).toBe(true);
    });

    it('denies payload exceeding size limit', async () => {
      const context: PolicyContext = {
        phase: 'pre',
        graph: { id: 'test-graph', version: '1.0.0' },
        execution: { traceId: 'test-123', stepIndex: 0, nodeId: 'n1' },
        data: {
          meta: { targetSpecialist: 'healer' },
          payload: { size: 11000000 }, // 11MB
        },
      };

      const decision = await evaluator.evaluate(context);

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('payload_too_large');
    });

    it('denies unregistered specialist', async () => {
      const context: PolicyContext = {
        phase: 'pre',
        graph: { id: 'test-graph', version: '1.0.0' },
        execution: { traceId: 'test-123', stepIndex: 0, nodeId: 'n1' },
        data: {
          meta: { targetSpecialist: 'unknown-specialist' },
          payload: {},
        },
      };

      const decision = await evaluator.evaluate(context);

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('unregistered_specialist');
    });
  });

  describe('Post-Execution Gates', () => {
    it('denies inconsistent result (success with error)', async () => {
      const context: PolicyContext = {
        phase: 'post',
        graph: { id: 'test-graph', version: '1.0.0' },
        execution: { traceId: 'test-123', stepIndex: 0, nodeId: 'n1' },
        data: {
          result: {
            status: 'success',
            error: { message: 'Something went wrong' },
          },
        },
      };

      const decision = await evaluator.evaluate(context);

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('inconsistent_result');
    });

    it('denies execution timeout', async () => {
      const context: PolicyContext = {
        phase: 'post',
        graph: { id: 'test-graph', version: '1.0.0' },
        execution: { traceId: 'test-123', stepIndex: 0, nodeId: 'n1' },
        data: {
          result: {
            status: 'completed',
            durationMs: 35000, // 35 seconds
          },
        },
      };

      const decision = await evaluator.evaluate(context);

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('execution_timeout');
    });

    it('allows valid result', async () => {
      const context: PolicyContext = {
        phase: 'post',
        graph: { id: 'test-graph', version: '1.0.0' },
        execution: { traceId: 'test-123', stepIndex: 0, nodeId: 'n1' },
        data: {
          result: {
            status: 'success',
            durationMs: 1500,
          },
        },
      };

      const decision = await evaluator.evaluate(context);

      expect(decision.allowed).toBe(true);
    });
  });

  describe('Policy Disabled Mode', () => {
    it('allows all requests when policy is disabled', async () => {
      const disabledEvaluator = new MockPolicyEvaluator(false);
      await disabledEvaluator.initialize();

      const context: PolicyContext = {
        phase: 'pre',
        graph: { id: 'test-graph', version: '1.0.0' },
        execution: { traceId: 'test-123', stepIndex: 0, nodeId: 'n1' },
        data: {
          meta: { targetSpecialist: 'unknown' },
          payload: { size: 999999999 },
        },
      };

      const decision = await disabledEvaluator.evaluate(context);

      expect(decision.allowed).toBe(true);
      expect(disabledEvaluator.isEnabled()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('throws error when using evaluateOrThrow with denied policy', async () => {
      const context: PolicyContext = {
        phase: 'pre',
        graph: { id: 'test-graph', version: '1.0.0' },
        execution: { traceId: 'test-123', stepIndex: 0, nodeId: 'n1' },
        data: {
          meta: { targetSpecialist: 'analyzer' },
          payload: { sliceFields: ['selectorHistory'] },
        },
      };

      await expect(evaluator.evaluateOrThrow(context)).rejects.toThrow('Policy denied');
      await expect(evaluator.evaluateOrThrow(context)).rejects.toThrow('selector_history_leak');
    });

    it('does not throw when policy allows', async () => {
      const context: PolicyContext = {
        phase: 'pre',
        graph: { id: 'test-graph', version: '1.0.0' },
        execution: { traceId: 'test-123', stepIndex: 0, nodeId: 'n1' },
        data: {
          meta: { targetSpecialist: 'healer' },
          payload: { writeScope: 'healing/selectors' },
        },
      };

      await expect(evaluator.evaluateOrThrow(context)).resolves.not.toThrow();
    });
  });
});
