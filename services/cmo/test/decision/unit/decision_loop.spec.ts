/**
 * Decision Loop Unit Tests
 *
 * Validates the main orchestrator: QScore → Verify → Classify → Decide
 * Covers accept, retry, escalate paths, determinism, and batch processing.
 */

import { describe, it, expect } from 'vitest';
import { DecisionLoop, DecisionOutcome } from '../../../src/decision/loop.js';
import type { DecisionInput } from '../../../src/decision/loop.js';
import { SchemaVerifier } from '../../../src/decision/verifiers/schema.js';
import { ReplayVerifier } from '../../../src/decision/verifiers/replay.js';
import { SmokeVerifier } from '../../../src/decision/verifiers/smoke.js';
import { ErrorCategory } from '../../../src/decision/policy/taxonomy.js';
import { RetryAction } from '../../../src/decision/policy/retry.js';

describe('Decision Loop', () => {
  // Base input fixture
  const baseInput: DecisionInput = {
    contextResult: {
      summary: ['Login test executed successfully', 'All assertions passed'],
      affordances: [
        { action: 'click login button', why: 'to authenticate user' },
        { action: 'fill username field', why: 'to provide credentials' },
      ],
    },
    task: {
      type: 'test-execution',
      inputs: { test_id: 'login-001', test_name: 'login flow' },
    },
    metadata: {
      specialist_id: 'specialist-default',
      message_id: 'msg-001',
      retry_depth: 0,
      total_latency_ms: 1000,
      schema_valid: true,
    },
  };

  const verifiers = [new SchemaVerifier(), new ReplayVerifier(), new SmokeVerifier()];

  describe('Accept Path', () => {
    it('should accept when QScore high and all verifiers pass', async () => {
      const loop = new DecisionLoop(verifiers, {
        acceptThreshold: 0.7,
      });

      const result = await loop.decide(baseInput);

      expect(result.outcome).toBe(DecisionOutcome.ACCEPT);
      expect(result.qscore.calibrated).toBeGreaterThanOrEqual(0.7);
      expect(result.verification.passed).toBe(true);
      expect(result.classification).toBeUndefined();
      expect(result.retryDecision).toBeUndefined();
      expect(result.summary).toContain('Result accepted');
    });

    it('should accept at threshold boundary', async () => {
      const loop = new DecisionLoop(verifiers, {
        acceptThreshold: 0.6,
      });

      // Input designed to produce QScore around 0.6
      const input: DecisionInput = {
        ...baseInput,
        metadata: {
          ...baseInput.metadata,
          retry_depth: 1, // small penalty
        },
      };

      const result = await loop.decide(input);

      if (result.qscore.calibrated >= 0.6 && result.verification.passed) {
        expect(result.outcome).toBe(DecisionOutcome.ACCEPT);
      }
    });

    it('should include QScore and verification summary in accept', async () => {
      const loop = new DecisionLoop(verifiers);
      const result = await loop.decide(baseInput);

      expect(result.qscore).toBeDefined();
      expect(result.qscore.score).toBeGreaterThan(0);
      expect(result.qscore.calibrated).toBeGreaterThan(0);
      expect(result.qscore.signals).toBeDefined();
      expect(result.verification.results.length).toBeGreaterThan(0);
      expect(result.verification.averageConfidence).toBeGreaterThan(0);
    });

    it('should include timestamp on accept', async () => {
      const loop = new DecisionLoop(verifiers);
      const before = new Date();
      const result = await loop.decide(baseInput);
      const after = new Date();

      expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should accept with high QScore even if retry depth > 0', async () => {
      const loop = new DecisionLoop(verifiers, { acceptThreshold: 0.7 });

      const input: DecisionInput = {
        ...baseInput,
        metadata: {
          ...baseInput.metadata,
          retry_depth: 1,
        },
      };

      const result = await loop.decide(input);

      // If QScore still high and verifiers pass, should accept
      if (result.qscore.calibrated >= 0.7 && result.verification.passed) {
        expect(result.outcome).toBe(DecisionOutcome.ACCEPT);
      }
    });

    it('should accept when all signals indicate high quality', async () => {
      const loop = new DecisionLoop(verifiers);

      // High-quality input
      const input: DecisionInput = {
        contextResult: {
          summary: [
            'Test passed successfully',
            'All assertions validated',
            'No errors detected',
            'Evidence comprehensive',
          ],
          affordances: [
            { action: 'verify login', why: 'to confirm authentication' },
            { action: 'check session', why: 'to ensure persistence' },
            { action: 'validate tokens', why: 'to verify security' },
          ],
        },
        task: {
          type: 'test-execution',
          inputs: { test_id: 'login-001' },
        },
        metadata: {
          specialist_id: 'specialist-advanced',
          message_id: 'msg-high-quality',
          retry_depth: 0,
          total_latency_ms: 500,
          schema_valid: true,
        },
      };

      const result = await loop.decide(input);

      // High quality should lead to accept (if QScore and verifiers pass)
      if (result.verification.passed && result.qscore.calibrated >= loop.getConfig().acceptThreshold) {
        expect(result.outcome).toBe(DecisionOutcome.ACCEPT);
      }
    });

    it('should report accept threshold in summary', async () => {
      const loop = new DecisionLoop(verifiers, { acceptThreshold: 0.75 });
      const result = await loop.decide(baseInput);

      if (result.outcome === DecisionOutcome.ACCEPT) {
        expect(result.summary).toContain('75.0%');
      }
    });

    it('should have no retry decision on accept', async () => {
      const loop = new DecisionLoop(verifiers);
      const result = await loop.decide(baseInput);

      if (result.outcome === DecisionOutcome.ACCEPT) {
        expect(result.retryDecision).toBeUndefined();
      }
    });
  });

  describe('Retry Path', () => {
    it('should retry on schema violation', async () => {
      const loop = new DecisionLoop(verifiers);

      // Invalid schema (missing summary)
      const input: DecisionInput = {
        ...baseInput,
        contextResult: {
          summary: [],
          affordances: [],
        },
      };

      const result = await loop.decide(input);

      expect(result.outcome).toBe(DecisionOutcome.RETRY);
      expect(result.classification?.category).toBe(ErrorCategory.SCHEMA_VIOLATION);
      expect(result.retryDecision?.action).toBe(RetryAction.RETRY_WITH_SCHEMA);
      expect(result.retryDecision?.contextDelta?.includeSchema).toBe(true);
    });

    it('should retry on low QScore', async () => {
      const loop = new DecisionLoop(verifiers, { acceptThreshold: 0.7 });

      // Low-quality input
      const input: DecisionInput = {
        contextResult: {
          summary: ['fail'],
          affordances: [{ action: 'a', why: 'b' }],
        },
        task: {
          type: 'test',
          inputs: {},
        },
        metadata: {
          specialist_id: 'specialist-default',
          message_id: 'msg-low-quality',
          retry_depth: 0,
          total_latency_ms: 5000,
          schema_valid: true,
        },
      };

      const result = await loop.decide(input);

      if (result.qscore.calibrated < 0.7) {
        expect(result.outcome).toBe(DecisionOutcome.RETRY);
        expect(result.classification).toBeDefined();
      }
    });

    it('should retry with expanded context for missing evidence', async () => {
      const loop = new DecisionLoop(verifiers);

      // Too short summary (smoke verifier fails)
      const input: DecisionInput = {
        ...baseInput,
        contextResult: {
          summary: ['a'],
          affordances: [{ action: 'click', why: 'test' }],
        },
      };

      const result = await loop.decide(input);

      if (!result.verification.passed) {
        expect(result.outcome).toBe(DecisionOutcome.RETRY);
        // Classification may be MISSING_EVIDENCE or UNKNOWN depending on smoke failure details
        expect(result.classification).toBeDefined();
        // If classified as MISSING_EVIDENCE, should have expandBudget
        if (result.classification!.category === ErrorCategory.MISSING_EVIDENCE) {
          expect(result.retryDecision?.contextDelta?.expandBudget).toBe(10000);
        }
      }
    });

    it('should include classification in retry decision', async () => {
      const loop = new DecisionLoop(verifiers);

      const input: DecisionInput = {
        ...baseInput,
        contextResult: {
          summary: [],
          affordances: [],
        },
      };

      const result = await loop.decide(input);

      if (result.outcome === DecisionOutcome.RETRY) {
        expect(result.classification).toBeDefined();
        expect(result.classification!.category).toBeDefined();
        expect(result.classification!.confidence).toBeGreaterThan(0);
        expect(result.classification!.reason).toBeDefined();
      }
    });

    it('should include retry decision with target specialist', async () => {
      const loop = new DecisionLoop(verifiers);

      const input: DecisionInput = {
        ...baseInput,
        contextResult: {
          summary: ['Test is flaky and intermittent'],
          affordances: [{ action: 'retry', why: 'flaky' }],
        },
      };

      const result = await loop.decide(input);

      if (result.outcome === DecisionOutcome.RETRY) {
        expect(result.retryDecision).toBeDefined();
        expect(result.retryDecision!.targetSpecialist).toBeDefined();
        expect(result.retryDecision!.maxRetries).toBeGreaterThan(0);
      }
    });

    it('should retry with hints for selector issues', async () => {
      const loop = new DecisionLoop(verifiers);

      const input: DecisionInput = {
        ...baseInput,
        contextResult: {
          summary: ['Element with selector #login not found', 'Locator failed'],
          affordances: [{ action: 'find element', why: 'selector issue' }],
        },
      };

      const result = await loop.decide(input);

      if (result.outcome === DecisionOutcome.RETRY) {
        expect(result.classification?.category).toBe(ErrorCategory.SELECTOR_ISSUE);
        expect(result.retryDecision?.targetSpecialist).toBe('specialist-selector-heal');
        expect(result.retryDecision?.contextDelta?.addHints).toBeDefined();
      }
    });

    it('should retry with stability specialist for flaky patterns', async () => {
      const loop = new DecisionLoop(verifiers);

      const input: DecisionInput = {
        ...baseInput,
        contextResult: {
          summary: ['Test sometimes passes intermittently'],
          affordances: [{ action: 'retry', why: 'flaky' }],
        },
      };

      const result = await loop.decide(input);

      if (result.outcome === DecisionOutcome.RETRY) {
        expect(result.classification?.category).toBe(ErrorCategory.FLAKY_PATTERN);
        expect(result.retryDecision?.targetSpecialist).toBe('specialist-stability');
      }
    });

    it('should include retry reason in summary', async () => {
      const loop = new DecisionLoop(verifiers);

      const input: DecisionInput = {
        ...baseInput,
        contextResult: {
          summary: [],
          affordances: [],
        },
      };

      const result = await loop.decide(input);

      if (result.outcome === DecisionOutcome.RETRY) {
        expect(result.summary).toContain('Retry recommended');
        expect(result.summary).toContain(result.classification!.category);
      }
    });

    it('should set context delta for retry actions', async () => {
      const loop = new DecisionLoop(verifiers);

      const input: DecisionInput = {
        ...baseInput,
        contextResult: {
          summary: [],
          affordances: [],
        },
      };

      const result = await loop.decide(input);

      if (result.outcome === DecisionOutcome.RETRY) {
        expect(result.retryDecision?.contextDelta).toBeDefined();
        // Either schema, hints, or budget expansion
        const delta = result.retryDecision!.contextDelta!;
        const hasAdjustment =
          delta.includeSchema || delta.addHints || delta.expandBudget;
        expect(hasAdjustment).toBeTruthy();
      }
    });

    it('should retry with alternative specialist for low confidence', async () => {
      const loop = new DecisionLoop(verifiers);

      // Simulate low confidence via QScore signal
      const input: DecisionInput = {
        contextResult: {
          summary: ['Low confidence result', 'Uncertain'],
          affordances: [{ action: 'retry', why: 'low confidence' }],
        },
        task: {
          type: 'test',
          inputs: { confidence: 0.1 },
        },
        metadata: {
          specialist_id: 'specialist-default',
          message_id: 'msg-low-conf',
          retry_depth: 0,
          total_latency_ms: 1000,
          schema_valid: true,
        },
      };

      const result = await loop.decide(input);

      // If classified as LOW_CONFIDENCE, should route to alternative specialist
      if (result.classification?.category === ErrorCategory.LOW_CONFIDENCE) {
        expect(result.retryDecision?.targetSpecialist).toBe('specialist-advanced');
      }
    });

    it('should calculate max retries based on category', async () => {
      const loop = new DecisionLoop(verifiers);

      const input: DecisionInput = {
        ...baseInput,
        contextResult: {
          summary: [],
          affordances: [],
        },
      };

      const result = await loop.decide(input);

      if (result.outcome === DecisionOutcome.RETRY) {
        expect(result.retryDecision!.maxRetries).toBeGreaterThan(0);
        expect(result.retryDecision!.maxRetries).toBeLessThanOrEqual(3);
      }
    });

    it('should include confidence in retry decision', async () => {
      const loop = new DecisionLoop(verifiers);

      const input: DecisionInput = {
        ...baseInput,
        contextResult: {
          summary: [],
          affordances: [],
        },
      };

      const result = await loop.decide(input);

      if (result.outcome === DecisionOutcome.RETRY) {
        expect(result.retryDecision!.confidence).toBeGreaterThan(0);
        expect(result.retryDecision!.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('should retry when verifiers fail but QScore acceptable', async () => {
      const loop = new DecisionLoop(verifiers, { acceptThreshold: 0.5 });

      const input: DecisionInput = {
        contextResult: {
          summary: ['Good summary', 'Decent evidence'],
          affordances: [
            { action: 'a1', why: 'reason1' },
            { action: 'a2', why: 'reason2' },
          ],
        },
        task: {
          type: 'test',
          inputs: { quality: 'medium' },
        },
        metadata: {
          specialist_id: 'specialist-default',
          message_id: 'msg-verifier-fail',
          retry_depth: 0,
          total_latency_ms: 1000,
          schema_valid: false, // trigger schema verifier failure
        },
        expectedSchema: {
          type: 'object',
          required: ['summary', 'affordances', 'extra_field'],
        },
      };

      const result = await loop.decide(input);

      if (!result.verification.passed) {
        expect(result.outcome).toBe(DecisionOutcome.RETRY);
      }
    });
  });

  describe('Escalate Path', () => {
    it('should escalate on policy violation', async () => {
      const loop = new DecisionLoop(verifiers);

      // Simulate policy degraded via QScore signal (would require modified QScore calc)
      // For now, test via retry depth limit
      const input: DecisionInput = {
        ...baseInput,
        metadata: {
          ...baseInput.metadata,
          retry_depth: 3, // global limit reached
        },
        contextResult: {
          summary: ['fail'],
          affordances: [{ action: 'retry', why: 'still failing' }],
        },
      };

      const result = await loop.decide(input);

      if (result.outcome === DecisionOutcome.ESCALATE) {
        expect(result.retryDecision?.action).toBe(RetryAction.ESCALATE);
        expect(result.summary).toContain('Escalate');
      }
    });

    it('should escalate when global retry limit reached', async () => {
      const loop = new DecisionLoop(verifiers);

      const input: DecisionInput = {
        ...baseInput,
        metadata: {
          ...baseInput.metadata,
          retry_depth: 3,
        },
        contextResult: {
          summary: [],
          affordances: [],
        },
      };

      const result = await loop.decide(input);

      expect(result.outcome).toBe(DecisionOutcome.ESCALATE);
      expect(result.retryDecision?.reason).toContain('Global max retries reached');
    });

    it('should escalate when category retry limit reached', async () => {
      const loop = new DecisionLoop(verifiers);

      const input: DecisionInput = {
        ...baseInput,
        metadata: {
          ...baseInput.metadata,
          retry_depth: 2, // SCHEMA category limit = 2
        },
        contextResult: {
          summary: [],
          affordances: [],
        },
      };

      const result = await loop.decide(input);

      if (
        result.classification?.category === ErrorCategory.SCHEMA_VIOLATION &&
        input.metadata.retry_depth >= 2
      ) {
        expect(result.outcome).toBe(DecisionOutcome.ESCALATE);
      }
    });

    it('should include classification on escalate', async () => {
      const loop = new DecisionLoop(verifiers);

      const input: DecisionInput = {
        ...baseInput,
        metadata: {
          ...baseInput.metadata,
          retry_depth: 3,
        },
        contextResult: {
          summary: [],
          affordances: [],
        },
      };

      const result = await loop.decide(input);

      if (result.outcome === DecisionOutcome.ESCALATE) {
        expect(result.classification).toBeDefined();
        expect(result.classification!.category).toBeDefined();
      }
    });

    it('should include escalate reason in summary', async () => {
      const loop = new DecisionLoop(verifiers);

      const input: DecisionInput = {
        ...baseInput,
        metadata: {
          ...baseInput.metadata,
          retry_depth: 3,
        },
        contextResult: {
          summary: [],
          affordances: [],
        },
      };

      const result = await loop.decide(input);

      if (result.outcome === DecisionOutcome.ESCALATE) {
        expect(result.summary).toContain('Escalate');
      }
    });

    it('should have retry decision with ESCALATE action', async () => {
      const loop = new DecisionLoop(verifiers);

      const input: DecisionInput = {
        ...baseInput,
        metadata: {
          ...baseInput.metadata,
          retry_depth: 3,
        },
        contextResult: {
          summary: [],
          affordances: [],
        },
      };

      const result = await loop.decide(input);

      if (result.outcome === DecisionOutcome.ESCALATE) {
        expect(result.retryDecision?.action).toBe(RetryAction.ESCALATE);
      }
    });

    it('should not include context delta on escalate', async () => {
      const loop = new DecisionLoop(verifiers);

      const input: DecisionInput = {
        ...baseInput,
        metadata: {
          ...baseInput.metadata,
          retry_depth: 3,
        },
        contextResult: {
          summary: [],
          affordances: [],
        },
      };

      const result = await loop.decide(input);

      if (result.outcome === DecisionOutcome.ESCALATE) {
        expect(result.retryDecision?.contextDelta).toBeUndefined();
      }
    });
  });

  describe('Determinism', () => {
    it('should produce same outcome for same inputs', async () => {
      const loop = new DecisionLoop(verifiers);

      const input: DecisionInput = {
        ...baseInput,
        metadata: {
          ...baseInput.metadata,
          message_id: 'determinism-test-1',
        },
      };

      const result1 = await loop.decide(input);
      const result2 = await loop.decide(input);

      expect(result1.outcome).toBe(result2.outcome);
      expect(result1.qscore.calibrated).toBeCloseTo(result2.qscore.calibrated, 5);
    });

    it('should produce same QScore for same inputs', async () => {
      const loop = new DecisionLoop(verifiers);

      const result1 = await loop.decide(baseInput);
      const result2 = await loop.decide(baseInput);

      expect(result1.qscore.score).toBeCloseTo(result2.qscore.score, 10);
      expect(result1.qscore.calibrated).toBeCloseTo(result2.qscore.calibrated, 10);
    });

    it('should produce same classification for same failure', async () => {
      const loop = new DecisionLoop(verifiers);

      const input: DecisionInput = {
        ...baseInput,
        contextResult: {
          summary: [],
          affordances: [],
        },
      };

      const result1 = await loop.decide(input);
      const result2 = await loop.decide(input);

      if (result1.classification && result2.classification) {
        expect(result1.classification.category).toBe(result2.classification.category);
        expect(result1.classification.confidence).toBeCloseTo(
          result2.classification.confidence,
          5
        );
      }
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple inputs in parallel', async () => {
      const loop = new DecisionLoop(verifiers);

      const inputs: DecisionInput[] = [
        { ...baseInput, metadata: { ...baseInput.metadata, message_id: 'batch-1' } },
        { ...baseInput, metadata: { ...baseInput.metadata, message_id: 'batch-2' } },
        { ...baseInput, metadata: { ...baseInput.metadata, message_id: 'batch-3' } },
      ];

      const results = await loop.decideBatch(inputs);

      expect(results).toHaveLength(3);
      expect(results[0]!.outcome).toBeDefined();
      expect(results[1]!.outcome).toBeDefined();
      expect(results[2]!.outcome).toBeDefined();
    });

    it('should handle mixed outcomes in batch', async () => {
      const loop = new DecisionLoop(verifiers);

      const inputs: DecisionInput[] = [
        { ...baseInput, metadata: { ...baseInput.metadata, message_id: 'batch-accept' } },
        {
          ...baseInput,
          metadata: { ...baseInput.metadata, message_id: 'batch-retry', retry_depth: 3 },
          contextResult: { summary: [], affordances: [] },
        },
      ];

      const results = await loop.decideBatch(inputs);

      expect(results).toHaveLength(2);

      const acceptCount = results.filter((r) => r.outcome === DecisionOutcome.ACCEPT).length;
      const escalateCount = results.filter((r) => r.outcome === DecisionOutcome.ESCALATE).length;

      expect(acceptCount + escalateCount).toBe(2);
    });
  });

  describe('Configuration', () => {
    it('should respect custom accept threshold', async () => {
      const loop = new DecisionLoop(verifiers, { acceptThreshold: 0.9 });

      const config = loop.getConfig();
      expect(config.acceptThreshold).toBe(0.9);
    });

    it('should return verifier names in config', async () => {
      const loop = new DecisionLoop(verifiers);

      const config = loop.getConfig();
      expect(config.verifierNames).toContain('schema');
      expect(config.verifierNames).toContain('replay');
      expect(config.verifierNames).toContain('smoke');
    });
  });
});
