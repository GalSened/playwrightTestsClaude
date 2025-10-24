/**
 * QScore Signal Function Tests
 *
 * Tests all 8 signal functions for correctness, bounds, edge cases.
 */

import { describe, it, expect } from 'vitest';
import {
  computeResultConfidence,
  computePolicyOk,
  computeSchemaOk,
  computeEvidenceCoverage,
  computeAffordanceAlignment,
  computeLatencyNorm,
  computeRetryDepthPenalty,
  computeConsistencyPrev,
} from '../../../../src/decision/qscore/signals.js';
import type { QScoreInput } from '../../../../src/decision/qscore/types.js';

describe('QScore Signal Functions', () => {
  describe('computeResultConfidence', () => {
    it('should return 0-1 range', () => {
      const input: QScoreInput = {
        contextResult: {
          summary: ['Test failure detected'],
          affordances: [{ action: 'Retry', why: 'Flaky test' }],
        },
        task: { type: 'analyze_failure', inputs: {} },
        metadata: {
          specialist_id: 'test-specialist',
          retry_depth: 0,
          total_latency_ms: 500,
          schema_valid: true,
        },
      };

      const score = computeResultConfidence(input);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should reward longer summaries', () => {
      const short: QScoreInput = {
        contextResult: {
          summary: ['One item'],
          affordances: [{ action: 'Fix', why: 'Issue found' }],
        },
        task: { type: 'test', inputs: {} },
        metadata: {
          specialist_id: 'test',
          retry_depth: 0,
          total_latency_ms: 500,
          schema_valid: true,
        },
      };

      const long: QScoreInput = {
        ...short,
        contextResult: {
          ...short.contextResult,
          summary: Array(10).fill('Evidence item'),
        },
      };

      expect(computeResultConfidence(long)).toBeGreaterThan(
        computeResultConfidence(short)
      );
    });

    it('should reward more affordances', () => {
      const few: QScoreInput = {
        contextResult: {
          summary: ['Item'],
          affordances: [{ action: 'Act', why: 'Why' }],
        },
        task: { type: 'test', inputs: {} },
        metadata: {
          specialist_id: 'test',
          retry_depth: 0,
          total_latency_ms: 500,
          schema_valid: true,
        },
      };

      const many: QScoreInput = {
        ...few,
        contextResult: {
          ...few.contextResult,
          affordances: Array(5)
            .fill(null)
            .map((_, i) => ({ action: `Act${i}`, why: `Why${i}` })),
        },
      };

      expect(computeResultConfidence(many)).toBeGreaterThan(
        computeResultConfidence(few)
      );
    });

    it('should cap at 1.0', () => {
      const input: QScoreInput = {
        contextResult: {
          summary: Array(100).fill('Evidence'),
          affordances: Array(50)
            .fill(null)
            .map(() => ({ action: 'Act', why: 'Why' })),
        },
        task: { type: 'test', inputs: {} },
        metadata: {
          specialist_id: 'test',
          retry_depth: 0,
          total_latency_ms: 500,
          schema_valid: true,
        },
      };

      expect(computeResultConfidence(input)).toBeLessThanOrEqual(1.0);
    });
  });

  describe('computePolicyOk', () => {
    it('should return 1.0 if policy not degraded', () => {
      const input: QScoreInput = {
        contextResult: {
          summary: ['Test'],
          affordances: [{ action: 'Act', why: 'Why' }],
          explain: { slicing: { policy_degraded: false } },
        },
        task: { type: 'test', inputs: {} },
        metadata: {
          specialist_id: 'test',
          retry_depth: 0,
          total_latency_ms: 500,
          schema_valid: true,
        },
      };

      expect(computePolicyOk(input)).toBe(1.0);
    });

    it('should return 0.0 if policy degraded', () => {
      const input: QScoreInput = {
        contextResult: {
          summary: ['Test'],
          affordances: [{ action: 'Act', why: 'Why' }],
          explain: { slicing: { policy_degraded: true } },
        },
        task: { type: 'test', inputs: {} },
        metadata: {
          specialist_id: 'test',
          retry_depth: 0,
          total_latency_ms: 500,
          schema_valid: true,
        },
      };

      expect(computePolicyOk(input)).toBe(0.0);
    });

    it('should default to 1.0 if explain missing', () => {
      const input: QScoreInput = {
        contextResult: {
          summary: ['Test'],
          affordances: [{ action: 'Act', why: 'Why' }],
        },
        task: { type: 'test', inputs: {} },
        metadata: {
          specialist_id: 'test',
          retry_depth: 0,
          total_latency_ms: 500,
          schema_valid: true,
        },
      };

      expect(computePolicyOk(input)).toBe(1.0);
    });
  });

  describe('computeSchemaOk', () => {
    it('should return 1.0 if schema valid', () => {
      const input: QScoreInput = {
        contextResult: {
          summary: ['Test'],
          affordances: [{ action: 'Act', why: 'Why' }],
        },
        task: { type: 'test', inputs: {} },
        metadata: {
          specialist_id: 'test',
          retry_depth: 0,
          total_latency_ms: 500,
          schema_valid: true,
        },
      };

      expect(computeSchemaOk(input)).toBe(1.0);
    });

    it('should return 0.0 if schema invalid', () => {
      const input: QScoreInput = {
        contextResult: {
          summary: ['Test'],
          affordances: [{ action: 'Act', why: 'Why' }],
        },
        task: { type: 'test', inputs: {} },
        metadata: {
          specialist_id: 'test',
          retry_depth: 0,
          total_latency_ms: 500,
          schema_valid: false,
        },
      };

      expect(computeSchemaOk(input)).toBe(0.0);
    });
  });

  describe('computeEvidenceCoverage', () => {
    it('should return 1.0 for ideal ratio (2-3 evidence per affordance)', () => {
      const input: QScoreInput = {
        contextResult: {
          summary: ['E1', 'E2', 'E3', 'E4', 'E5', 'E6'],
          affordances: [
            { action: 'A1', why: 'W1' },
            { action: 'A2', why: 'W2' },
            { action: 'A3', why: 'W3' },
          ],
        },
        task: { type: 'test', inputs: {} },
        metadata: {
          specialist_id: 'test',
          retry_depth: 0,
          total_latency_ms: 500,
          schema_valid: true,
        },
      };

      const score = computeEvidenceCoverage(input);
      expect(score).toBe(1.0);
    });

    it('should penalize too little evidence', () => {
      const input: QScoreInput = {
        contextResult: {
          summary: ['E1'],
          affordances: [
            { action: 'A1', why: 'W1' },
            { action: 'A2', why: 'W2' },
          ],
        },
        task: { type: 'test', inputs: {} },
        metadata: {
          specialist_id: 'test',
          retry_depth: 0,
          total_latency_ms: 500,
          schema_valid: true,
        },
      };

      const score = computeEvidenceCoverage(input);
      expect(score).toBeLessThan(1.0);
    });

    it('should penalize too much evidence (diminishing returns)', () => {
      const input: QScoreInput = {
        contextResult: {
          summary: Array(20).fill('Evidence'),
          affordances: [{ action: 'A1', why: 'W1' }],
        },
        task: { type: 'test', inputs: {} },
        metadata: {
          specialist_id: 'test',
          retry_depth: 0,
          total_latency_ms: 500,
          schema_valid: true,
        },
      };

      const score = computeEvidenceCoverage(input);
      expect(score).toBeLessThan(1.0);
    });
  });

  describe('computeAffordanceAlignment', () => {
    it('should return high score for good alignment', () => {
      const input: QScoreInput = {
        contextResult: {
          summary: ['Test'],
          affordances: [
            {
              action: 'Fix the login selector button',
              why: 'Login button selector not found',
            },
          ],
        },
        task: {
          type: 'test',
          inputs: {
            description: 'login button selector not found',
            component: 'button',
          },
        },
        metadata: {
          specialist_id: 'test',
          retry_depth: 0,
          total_latency_ms: 500,
          schema_valid: true,
        },
      };

      const score = computeAffordanceAlignment(input);
      expect(score).toBeGreaterThan(0.5); // reasonable overlap
    });

    it('should return 0.0 for no alignment', () => {
      const input: QScoreInput = {
        contextResult: {
          summary: ['Test'],
          affordances: [
            { action: 'Completely unrelated action', why: 'Different reason' },
          ],
        },
        task: {
          type: 'test',
          inputs: {
            target: 'login',
            issue: 'selector',
          },
        },
        metadata: {
          specialist_id: 'test',
          retry_depth: 0,
          total_latency_ms: 500,
          schema_valid: true,
        },
      };

      const score = computeAffordanceAlignment(input);
      expect(score).toBeLessThan(0.5); // low overlap
    });

    it('should return 0.5 for empty task inputs', () => {
      const input: QScoreInput = {
        contextResult: {
          summary: ['Test'],
          affordances: [{ action: 'Act', why: 'Why' }],
        },
        task: { type: 'test', inputs: {} },
        metadata: {
          specialist_id: 'test',
          retry_depth: 0,
          total_latency_ms: 500,
          schema_valid: true,
        },
      };

      expect(computeAffordanceAlignment(input)).toBe(0.5);
    });
  });

  describe('computeLatencyNorm', () => {
    it('should return 1.0 for fast responses (< 500ms)', () => {
      const input: QScoreInput = {
        contextResult: {
          summary: ['Test'],
          affordances: [{ action: 'Act', why: 'Why' }],
        },
        task: { type: 'test', inputs: {} },
        metadata: {
          specialist_id: 'test',
          retry_depth: 0,
          total_latency_ms: 300,
          schema_valid: true,
        },
      };

      expect(computeLatencyNorm(input)).toBe(1.0);
    });

    it('should return 0.0 for very slow responses (> 5000ms)', () => {
      const input: QScoreInput = {
        contextResult: {
          summary: ['Test'],
          affordances: [{ action: 'Act', why: 'Why' }],
        },
        task: { type: 'test', inputs: {} },
        metadata: {
          specialist_id: 'test',
          retry_depth: 0,
          total_latency_ms: 6000,
          schema_valid: true,
        },
      };

      expect(computeLatencyNorm(input)).toBe(0.0);
    });

    it('should decay linearly between 500ms and 5000ms', () => {
      const fast: QScoreInput = {
        contextResult: {
          summary: ['Test'],
          affordances: [{ action: 'Act', why: 'Why' }],
        },
        task: { type: 'test', inputs: {} },
        metadata: {
          specialist_id: 'test',
          retry_depth: 0,
          total_latency_ms: 1000,
          schema_valid: true,
        },
      };

      const slow: QScoreInput = {
        ...fast,
        metadata: { ...fast.metadata, total_latency_ms: 4000 },
      };

      expect(computeLatencyNorm(fast)).toBeGreaterThan(computeLatencyNorm(slow));
    });
  });

  describe('computeRetryDepthPenalty', () => {
    it('should return 1.0 for depth 0', () => {
      const input: QScoreInput = {
        contextResult: {
          summary: ['Test'],
          affordances: [{ action: 'Act', why: 'Why' }],
        },
        task: { type: 'test', inputs: {} },
        metadata: {
          specialist_id: 'test',
          retry_depth: 0,
          total_latency_ms: 500,
          schema_valid: true,
        },
      };

      expect(computeRetryDepthPenalty(input)).toBe(1.0);
    });

    it('should return 0.7 for depth 1', () => {
      const input: QScoreInput = {
        contextResult: {
          summary: ['Test'],
          affordances: [{ action: 'Act', why: 'Why' }],
        },
        task: { type: 'test', inputs: {} },
        metadata: {
          specialist_id: 'test',
          retry_depth: 1,
          total_latency_ms: 500,
          schema_valid: true,
        },
      };

      expect(computeRetryDepthPenalty(input)).toBe(0.7);
    });

    it('should return 0.4 for depth 2', () => {
      const input: QScoreInput = {
        contextResult: {
          summary: ['Test'],
          affordances: [{ action: 'Act', why: 'Why' }],
        },
        task: { type: 'test', inputs: {} },
        metadata: {
          specialist_id: 'test',
          retry_depth: 2,
          total_latency_ms: 500,
          schema_valid: true,
        },
      };

      expect(computeRetryDepthPenalty(input)).toBe(0.4);
    });

    it('should return 0.1 for depth 3+', () => {
      const input: QScoreInput = {
        contextResult: {
          summary: ['Test'],
          affordances: [{ action: 'Act', why: 'Why' }],
        },
        task: { type: 'test', inputs: {} },
        metadata: {
          specialist_id: 'test',
          retry_depth: 5,
          total_latency_ms: 500,
          schema_valid: true,
        },
      };

      expect(computeRetryDepthPenalty(input)).toBe(0.1);
    });
  });

  describe('computeConsistencyPrev', () => {
    it('should return 0.5 if no previous result', () => {
      const input: QScoreInput = {
        contextResult: {
          summary: ['Test'],
          affordances: [{ action: 'Act', why: 'Why' }],
        },
        task: { type: 'test', inputs: {} },
        metadata: {
          specialist_id: 'test',
          retry_depth: 0,
          total_latency_ms: 500,
          schema_valid: true,
        },
      };

      expect(computeConsistencyPrev(input)).toBe(0.5);
    });

    it('should return high score for identical results', () => {
      const input: QScoreInput = {
        contextResult: {
          summary: ['Selector issue detected in login button'],
          affordances: [{ action: 'Fix selector', why: 'Element not found' }],
        },
        task: { type: 'test', inputs: {} },
        metadata: {
          specialist_id: 'test',
          retry_depth: 1,
          total_latency_ms: 500,
          schema_valid: true,
        },
        previousResult: {
          summary: ['Selector issue detected in login button'],
          affordances: [{ action: 'Fix selector', why: 'Element not found' }],
          score: 0.8,
        },
      };

      expect(computeConsistencyPrev(input)).toBeGreaterThan(0.8);
    });

    it('should return low score for contradictory results', () => {
      const input: QScoreInput = {
        contextResult: {
          summary: ['Payment flow working correctly'],
          affordances: [{ action: 'No changes needed', why: 'All tests pass' }],
        },
        task: { type: 'test', inputs: {} },
        metadata: {
          specialist_id: 'test',
          retry_depth: 1,
          total_latency_ms: 500,
          schema_valid: true,
        },
        previousResult: {
          summary: ['Payment timeout detected'],
          affordances: [{ action: 'Increase timeout', why: 'Tests failing' }],
          score: 0.6,
        },
      };

      expect(computeConsistencyPrev(input)).toBeLessThan(0.5);
    });
  });
});
