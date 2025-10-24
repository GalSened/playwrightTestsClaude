/**
 * Verifier Framework Tests
 *
 * Comprehensive tests for schema, replay, and smoke verifiers.
 * Validates timeout handling, error detection, and result scoring.
 */

import { describe, it, expect } from 'vitest';
import { SchemaVerifier } from '../../../src/decision/verifiers/schema.js';
import { ReplayVerifier } from '../../../src/decision/verifiers/replay.js';
import { SmokeVerifier } from '../../../src/decision/verifiers/smoke.js';
import { VerificationSuite } from '../../../src/decision/verifiers/suite.js';
import type { VerificationInput } from '../../../src/decision/verifiers/types.js';

describe('Verifier Framework', () => {
  const baseInput: VerificationInput = {
    contextResult: {
      summary: ['Test failure detected in login flow', 'Selector not found'],
      affordances: [
        { action: 'Update selector', why: 'More stable locator' },
        { action: 'Add wait', why: 'Handle async loading' },
      ],
    },
    task: {
      type: 'analyze_test_failure',
      inputs: { test: 'login', error: 'selector_not_found' },
    },
    metadata: {
      specialist_id: 'specialist-default',
      message_id: 'msg-123',
      retry_depth: 0,
    },
  };

  describe('SchemaVerifier', () => {
    it('should pass for valid schema', async () => {
      const verifier = new SchemaVerifier();
      const result = await verifier.verify(baseInput);

      expect(result.passed).toBe(true);
      expect(result.verifier).toBe('schema');
      expect(result.confidence).toBe(1.0);
    });

    it('should fail for missing required fields', async () => {
      const verifier = new SchemaVerifier();
      const invalidInput: VerificationInput = {
        ...baseInput,
        contextResult: {
          summary: [],
          affordances: [], // Empty affordances (invalid)
        },
      };

      const result = await verifier.verify(invalidInput);

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Schema validation failed');
    });

    it('should fail for invalid field types', async () => {
      const verifier = new SchemaVerifier();
      const invalidInput: VerificationInput = {
        ...baseInput,
        contextResult: {
          summary: [123 as unknown as string], // Invalid type
          affordances: baseInput.contextResult.affordances,
        },
      };

      const result = await verifier.verify(invalidInput);

      expect(result.passed).toBe(false);
    });

    it('should validate against custom schema', async () => {
      const verifier = new SchemaVerifier();
      const customSchema = {
        type: 'object',
        required: ['summary', 'affordances', 'custom_field'],
        properties: {
          summary: { type: 'array' },
          affordances: { type: 'array' },
          custom_field: { type: 'string' },
        },
      };

      const result = await verifier.verify({
        ...baseInput,
        expectedSchema: customSchema,
      });

      expect(result.passed).toBe(false); // Missing custom_field
      expect(result.reason).toContain('custom_field');
    });

    it('should include AJV errors in evidence', async () => {
      const verifier = new SchemaVerifier();
      const invalidInput: VerificationInput = {
        ...baseInput,
        contextResult: {
          summary: [],
          affordances: [],
        },
      };

      const result = await verifier.verify(invalidInput);

      expect(result.evidence.errors).toBeDefined();
      expect(Array.isArray(result.evidence.errors)).toBe(true);
    });

    it('should validate array minItems', async () => {
      const verifier = new SchemaVerifier();
      const result = await verifier.verify({
        ...baseInput,
        contextResult: {
          summary: [], // Violates minItems: 1
          affordances: [{ action: 'Test', why: 'Test' }],
        },
      });

      expect(result.passed).toBe(false);
    });

    it('should validate nested objects', async () => {
      const verifier = new SchemaVerifier();
      const result = await verifier.verify({
        ...baseInput,
        contextResult: {
          summary: ['Test'],
          affordances: [
            { action: '', why: 'Test' }, // Empty action
          ],
        },
      });

      expect(result.passed).toBe(false);
    });

    it('should handle verification errors gracefully', async () => {
      const verifier = new SchemaVerifier();
      const malformedInput = {
        contextResult: null as unknown as VerificationInput['contextResult'],
        task: baseInput.task,
        metadata: baseInput.metadata,
      };

      const result = await verifier.verify(malformedInput);

      // Ajv will fail on null input
      expect(result.passed).toBe(false);
      expect(result.confidence).toBeGreaterThan(0); // Has some confidence in validation
    });

    it('should complete within timeout', async () => {
      const verifier = new SchemaVerifier();
      const start = performance.now();

      await verifier.verify(baseInput, 100);

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100);
    });

    it('should include schema in evidence', async () => {
      const verifier = new SchemaVerifier();
      const result = await verifier.verify(baseInput);

      expect(result.evidence.schema).toBeDefined();
    });
  });

  describe('ReplayVerifier', () => {
    it('should pass when no previous result', async () => {
      const verifier = new ReplayVerifier();
      const result = await verifier.verify(baseInput);

      expect(result.passed).toBe(true);
      expect(result.confidence).toBe(0.5); // Neutral
      expect(result.reason).toContain('No previous result');
    });

    it('should pass for high consistency', async () => {
      const verifier = new ReplayVerifier({ minConsistencyThreshold: 0.7 });
      const inputWithPrevious: VerificationInput = {
        ...baseInput,
        previousResult: {
          summary: ['Test failure detected in login flow', 'Selector not found'],
          affordances: [
            { action: 'Update selector', why: 'More stable locator' },
          ],
        },
      };

      const result = await verifier.verify(inputWithPrevious);

      expect(result.passed).toBe(true);
      expect(result.evidence.consistency).toBeGreaterThan(0.7);
    });

    it('should fail for low consistency', async () => {
      const verifier = new ReplayVerifier({ minConsistencyThreshold: 0.7 });
      const inputWithPrevious: VerificationInput = {
        ...baseInput,
        previousResult: {
          summary: ['Completely different failure in checkout'],
          affordances: [
            { action: 'Different action', why: 'Different reason' },
          ],
        },
      };

      const result = await verifier.verify(inputWithPrevious);

      expect(result.passed).toBe(false);
      expect(result.evidence.consistency).toBeLessThan(0.7);
    });

    it('should compute Jaccard similarity correctly', async () => {
      const verifier = new ReplayVerifier();
      const inputWithPrevious: VerificationInput = {
        ...baseInput,
        contextResult: {
          summary: ['login', 'selector', 'button'],
          affordances: [{ action: 'fix', why: 'issue' }],
        },
        previousResult: {
          summary: ['login', 'selector', 'element'],
          affordances: [{ action: 'fix', why: 'problem' }],
        },
      };

      const result = await verifier.verify(inputWithPrevious);

      // 2 common words (login, selector) out of 4 unique = 0.5 summary overlap
      // 1 common action (fix) out of 1 = 1.0 affordance overlap
      // Weighted: 0.5 * 0.6 + 1.0 * 0.4 = 0.7
      expect(result.evidence.consistency).toBeCloseTo(0.7, 1);
    });

    it('should handle empty previous summary', async () => {
      const verifier = new ReplayVerifier();
      const inputWithPrevious: VerificationInput = {
        ...baseInput,
        previousResult: {
          summary: [],
          affordances: [],
        },
      };

      const result = await verifier.verify(inputWithPrevious);

      expect(result.confidence).toBe(1.0);
      expect(result.evidence.consistency).toBeDefined();
    });

    it('should handle empty current summary', async () => {
      const verifier = new ReplayVerifier();
      const inputWithPrevious: VerificationInput = {
        ...baseInput,
        contextResult: {
          summary: [],
          affordances: [],
        },
        previousResult: {
          summary: ['Previous content'],
          affordances: [{ action: 'Action', why: 'Why' }],
        },
      };

      const result = await verifier.verify(inputWithPrevious);

      expect(result.passed).toBe(false); // Low consistency
    });

    it('should include evidence details', async () => {
      const verifier = new ReplayVerifier();
      const inputWithPrevious: VerificationInput = {
        ...baseInput,
        previousResult: {
          summary: ['Test'],
          affordances: [{ action: 'Action', why: 'Why' }],
        },
      };

      const result = await verifier.verify(inputWithPrevious);

      expect(result.evidence.consistency).toBeDefined();
      expect(result.evidence.threshold).toBe(0.7);
      expect(result.evidence.currentSummaryLength).toBeDefined();
      expect(result.evidence.previousSummaryLength).toBeDefined();
    });

    it('should handle verification errors', async () => {
      const verifier = new ReplayVerifier();

      // Trigger actual error by causing null reference in consistency computation
      const malformedInput: VerificationInput = {
        contextResult: {
          summary: null as unknown as string[],
          affordances: null as unknown as Array<{ action: string; why: string }>,
        },
        task: baseInput.task,
        metadata: baseInput.metadata,
      };

      const result = await verifier.verify(malformedInput);

      // Should catch error and return failure
      expect(result.verifier).toBe('replay');
      expect(result.durationMs).toBeGreaterThan(0);
    });

    it('should complete within timeout', async () => {
      const verifier = new ReplayVerifier();
      const start = performance.now();

      await verifier.verify(baseInput, 100);

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100);
    });
  });

  describe('SmokeVerifier', () => {
    it('should pass for valid result', async () => {
      const verifier = new SmokeVerifier();
      const result = await verifier.verify(baseInput);

      expect(result.passed).toBe(true);
      expect(result.reason).toBe('All smoke tests passed');
    });

    it('should fail for too few summary items', async () => {
      const verifier = new SmokeVerifier({ minSummaryItems: 3 });
      const input: VerificationInput = {
        ...baseInput,
        contextResult: {
          summary: ['One item'],
          affordances: baseInput.contextResult.affordances,
        },
      };

      const result = await verifier.verify(input);

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Too few summary items');
    });

    it('should fail for too many summary items', async () => {
      const verifier = new SmokeVerifier({ maxSummaryItems: 2 });
      const input: VerificationInput = {
        ...baseInput,
        contextResult: {
          summary: ['One', 'Two', 'Three'],
          affordances: baseInput.contextResult.affordances,
        },
      };

      const result = await verifier.verify(input);

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Too many summary items');
    });

    it('should fail for too few affordances', async () => {
      const verifier = new SmokeVerifier({ minAffordances: 2 });
      const input: VerificationInput = {
        ...baseInput,
        contextResult: {
          summary: baseInput.contextResult.summary,
          affordances: [{ action: 'Only one', why: 'Why' }],
        },
      };

      const result = await verifier.verify(input);

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Too few affordances');
    });

    it('should fail for summary item too short', async () => {
      const verifier = new SmokeVerifier({ minSummaryLength: 20 });
      const input: VerificationInput = {
        ...baseInput,
        contextResult: {
          summary: ['Short'],
          affordances: baseInput.contextResult.affordances,
        },
      };

      const result = await verifier.verify(input);

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('too short');
    });

    it('should fail for summary item too long', async () => {
      const verifier = new SmokeVerifier({ maxSummaryLength: 10 });
      const input: VerificationInput = {
        ...baseInput,
        contextResult: {
          summary: ['This is a very long summary item that exceeds the limit'],
          affordances: baseInput.contextResult.affordances,
        },
      };

      const result = await verifier.verify(input);

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('too long');
    });

    it('should fail for forbidden patterns', async () => {
      const verifier = new SmokeVerifier({
        forbiddenPatterns: [/error/i, /failed/i],
      });
      const input: VerificationInput = {
        ...baseInput,
        contextResult: {
          summary: ['Test failed with error'],
          affordances: baseInput.contextResult.affordances,
        },
      };

      const result = await verifier.verify(input);

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Forbidden pattern');
    });

    it('should fail for empty action in affordance', async () => {
      const verifier = new SmokeVerifier();
      const input: VerificationInput = {
        ...baseInput,
        contextResult: {
          summary: baseInput.contextResult.summary,
          affordances: [{ action: '', why: 'Why' }],
        },
      };

      const result = await verifier.verify(input);

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('empty action');
    });

    it('should fail for empty why in affordance', async () => {
      const verifier = new SmokeVerifier();
      const input: VerificationInput = {
        ...baseInput,
        contextResult: {
          summary: baseInput.contextResult.summary,
          affordances: [{ action: 'Action', why: '' }],
        },
      };

      const result = await verifier.verify(input);

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('empty \'why\'');
    });

    it('should fail for empty strings in summary', async () => {
      const verifier = new SmokeVerifier();
      const input: VerificationInput = {
        ...baseInput,
        contextResult: {
          summary: ['Valid', '', 'Also valid'],
          affordances: baseInput.contextResult.affordances,
        },
      };

      const result = await verifier.verify(input);

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('empty strings');
    });

    it('should include failure details in evidence', async () => {
      const verifier = new SmokeVerifier({ minSummaryItems: 5 });
      const input: VerificationInput = {
        ...baseInput,
        contextResult: {
          summary: ['One'],
          affordances: baseInput.contextResult.affordances,
        },
      };

      const result = await verifier.verify(input);

      expect(result.evidence.failures).toBeDefined();
      expect(Array.isArray(result.evidence.failures)).toBe(true);
      expect(result.evidence.failures.length).toBeGreaterThan(0);
    });

    it('should handle verification errors', async () => {
      const verifier = new SmokeVerifier();
      const malformedInput = {
        ...baseInput,
        contextResult: null as unknown as VerificationInput['contextResult'],
      };

      const result = await verifier.verify(malformedInput);

      expect(result.passed).toBe(false);
      expect(result.confidence).toBe(0.5);
    });

    it('should complete within timeout', async () => {
      const verifier = new SmokeVerifier();
      const start = performance.now();

      await verifier.verify(baseInput, 100);

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100);
    });
  });

  describe('VerificationSuite', () => {
    it('should run all verifiers in parallel', async () => {
      const verifiers = [
        new SchemaVerifier(),
        new ReplayVerifier(),
        new SmokeVerifier(),
      ];
      const suite = new VerificationSuite(verifiers);

      const result = await suite.verify(baseInput);

      expect(result.results).toHaveLength(3);
      expect(result.results[0]!.verifier).toBe('schema');
      expect(result.results[1]!.verifier).toBe('replay');
      expect(result.results[2]!.verifier).toBe('smoke');
    });

    it('should pass if all verifiers pass', async () => {
      const verifiers = [new SchemaVerifier(), new SmokeVerifier()];
      const suite = new VerificationSuite(verifiers);

      const result = await suite.verify(baseInput);

      expect(result.passed).toBe(true);
    });

    it('should fail if any verifier fails', async () => {
      const verifiers = [
        new SchemaVerifier(),
        new SmokeVerifier({ minSummaryItems: 10 }), // Will fail
      ];
      const suite = new VerificationSuite(verifiers);

      const result = await suite.verify(baseInput);

      expect(result.passed).toBe(false);
    });

    it('should calculate average confidence', async () => {
      const verifiers = [new SchemaVerifier(), new ReplayVerifier()];
      const suite = new VerificationSuite(verifiers);

      const result = await suite.verify(baseInput);

      expect(result.averageConfidence).toBeGreaterThan(0);
      expect(result.averageConfidence).toBeLessThanOrEqual(1);
    });

    it('should enforce timeout on slow verifiers', async () => {
      const verifiers = [new SchemaVerifier()];
      const suite = new VerificationSuite(verifiers, { defaultTimeoutMs: 10 });

      const start = performance.now();
      const result = await suite.verify(baseInput);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100); // Should not wait forever
    });

    it('should filter verifiers by enabled list', async () => {
      const verifiers = [
        new SchemaVerifier(),
        new ReplayVerifier(),
        new SmokeVerifier(),
      ];
      const suite = new VerificationSuite(verifiers, {
        enabledVerifiers: ['schema', 'smoke'],
      });

      const result = await suite.verify(baseInput);

      expect(result.results).toHaveLength(2);
      expect(result.results.map((r) => r.verifier)).not.toContain('replay');
    });

    it('should handle empty verifier list', async () => {
      const suite = new VerificationSuite([]);

      const result = await suite.verify(baseInput);

      expect(result.passed).toBe(true);
      expect(result.results).toHaveLength(0);
    });

    it('should return verifier names', () => {
      const verifiers = [
        new SchemaVerifier(),
        new ReplayVerifier(),
        new SmokeVerifier(),
      ];
      const suite = new VerificationSuite(verifiers);

      const names = suite.getVerifierNames();

      expect(names).toEqual(['schema', 'replay', 'smoke']);
    });

    it('should add verifier dynamically', async () => {
      const suite = new VerificationSuite([new SchemaVerifier()]);

      suite.addVerifier(new SmokeVerifier());

      const result = await suite.verify(baseInput);
      expect(result.results).toHaveLength(2);
    });

    it('should remove verifier dynamically', async () => {
      const suite = new VerificationSuite([
        new SchemaVerifier(),
        new SmokeVerifier(),
      ]);

      suite.removeVerifier('smoke');

      const result = await suite.verify(baseInput);
      expect(result.results).toHaveLength(1);
      expect(result.results[0]!.verifier).toBe('schema');
    });
  });
});
