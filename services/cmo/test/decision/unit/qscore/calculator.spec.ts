/**
 * QScore Calculator Tests
 *
 * Tests weighted fusion, calibration, and explanation generation.
 */

import { describe, it, expect } from 'vitest';
import { QScoreCalculator, computeQScore } from '../../../../src/decision/qscore/calculator.js';
import type { QScoreInput } from '../../../../src/decision/qscore/types.js';

describe('QScoreCalculator', () => {
  const baseInput: QScoreInput = {
    contextResult: {
      summary: ['Test failure in login flow', 'Selector not found', 'Button #login-btn missing'],
      affordances: [
        { action: 'Update selector to use data-testid', why: 'More stable locator' },
        { action: 'Add wait for element', why: 'Handle async loading' },
      ],
      explain: {
        slicing: { policy_degraded: false },
        timings: { retrieval_ms: 100, slicing_ms: 50 },
      },
    },
    task: {
      type: 'analyze_test_failure',
      inputs: { test: 'login', selector: '#login-btn', error: 'not found' },
    },
    metadata: {
      specialist_id: 'specialist-default',
      retry_depth: 0,
      total_latency_ms: 400,
      schema_valid: true,
    },
  };

  describe('Basic Computation', () => {
    it('should compute QScore with default config', () => {
      const calculator = new QScoreCalculator();
      const result = calculator.compute(baseInput);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.calibrated).toBeGreaterThanOrEqual(0);
      expect(result.calibrated).toBeLessThanOrEqual(1);
      expect(result.signals).toBeDefined();
      expect(result.explanation).toBeDefined();
    });

    it('should include all 8 signals', () => {
      const calculator = new QScoreCalculator();
      const result = calculator.compute(baseInput);

      expect(result.signals).toHaveProperty('resultConfidence');
      expect(result.signals).toHaveProperty('policyOk');
      expect(result.signals).toHaveProperty('schemaOk');
      expect(result.signals).toHaveProperty('evidenceCoverage');
      expect(result.signals).toHaveProperty('affordanceAlignment');
      expect(result.signals).toHaveProperty('latencyNorm');
      expect(result.signals).toHaveProperty('retryDepthPenalty');
      expect(result.signals).toHaveProperty('consistencyPrev');
    });

    it('should include weights in result', () => {
      const calculator = new QScoreCalculator();
      const result = calculator.compute(baseInput);

      expect(result.weights).toBeDefined();
      const weightSum = Object.values(result.weights).reduce((a, b) => a + b, 0);
      expect(weightSum).toBeCloseTo(1.0, 3);
    });

    it('should include timestamp', () => {
      const calculator = new QScoreCalculator();
      const result = calculator.compute(baseInput);

      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Weight Validation', () => {
    it('should reject weights that do not sum to 1.0', () => {
      expect(() => {
        new QScoreCalculator({
          weights: {
            resultConfidence: 0.5,
            policyOk: 0.2,
            schemaOk: 0.1,
            evidenceCoverage: 0.1,
            affordanceAlignment: 0.05,
            latencyNorm: 0.05,
            retryDepthPenalty: 0.05,
            consistencyPrev: 0.05,
            // Sum = 1.1 (invalid)
          },
        });
      }).toThrow('must sum to 1.0');
    });

    it('should accept custom weights that sum to 1.0', () => {
      const calculator = new QScoreCalculator({
        weights: {
          resultConfidence: 0.3,
          policyOk: 0.2,
          schemaOk: 0.15,
          evidenceCoverage: 0.15,
          affordanceAlignment: 0.1,
          latencyNorm: 0.05,
          retryDepthPenalty: 0.03,
          consistencyPrev: 0.02,
        },
      });

      const result = calculator.compute(baseInput);
      expect(result.score).toBeDefined();
    });
  });

  describe('Calibration', () => {
    it('should apply calibration table', () => {
      const calculator = new QScoreCalculator({
        calibrationTable: [
          { rawScoreMin: 0.0, rawScoreMax: 0.5, calibratedScore: 0.25 },
          { rawScoreMin: 0.5, rawScoreMax: 1.0, calibratedScore: 0.9 },
        ],
      });

      const result = calculator.compute(baseInput);

      // Calibrated score should be either 0.25 or 0.9 based on raw score
      expect([0.25, 0.9]).toContain(result.calibrated);
    });

    it('should use identity calibration by default', () => {
      const calculator = new QScoreCalculator();
      const result = calculator.compute(baseInput);

      // Default calibration should be close to raw score
      expect(Math.abs(result.calibrated - result.score)).toBeLessThan(0.1);
    });
  });

  describe('Explanation Generation', () => {
    it('should include QScore percentage', () => {
      const calculator = new QScoreCalculator();
      const result = calculator.compute(baseInput);

      expect(result.explanation).toMatch(/QScore: \d+\.\d+%/);
    });

    it('should include top signals', () => {
      const calculator = new QScoreCalculator();
      const result = calculator.compute(baseInput);

      expect(result.explanation).toMatch(/Top signals:/);
    });

    it('should include weaknesses if present', () => {
      const lowConfidenceInput: QScoreInput = {
        ...baseInput,
        contextResult: {
          ...baseInput.contextResult,
          summary: [], // Empty summary → low confidence
        },
      };

      const calculator = new QScoreCalculator();
      const result = calculator.compute(lowConfidenceInput);

      if (result.signals.resultConfidence < 0.5) {
        expect(result.explanation).toMatch(/Weaknesses:/);
      }
    });

    it('should be omitted if includeExplanation=false', () => {
      const calculator = new QScoreCalculator({ includeExplanation: false });
      const result = calculator.compute(baseInput);

      expect(result.explanation).toBe('');
    });
  });

  describe('Signal Impact', () => {
    it('should produce lower score for policy degradation', () => {
      const normal = baseInput;
      const degraded: QScoreInput = {
        ...baseInput,
        contextResult: {
          ...baseInput.contextResult,
          explain: { slicing: { policy_degraded: true } },
        },
      };

      const calculator = new QScoreCalculator();
      const normalResult = calculator.compute(normal);
      const degradedResult = calculator.compute(degraded);

      expect(degradedResult.score).toBeLessThan(normalResult.score);
    });

    it('should produce lower score for schema invalid', () => {
      const valid = baseInput;
      const invalid: QScoreInput = {
        ...baseInput,
        metadata: { ...baseInput.metadata, schema_valid: false },
      };

      const calculator = new QScoreCalculator();
      const validResult = calculator.compute(valid);
      const invalidResult = calculator.compute(invalid);

      expect(invalidResult.score).toBeLessThan(validResult.score);
    });

    it('should produce lower score for high latency', () => {
      const fast = baseInput;
      const slow: QScoreInput = {
        ...baseInput,
        metadata: { ...baseInput.metadata, total_latency_ms: 6000 },
      };

      const calculator = new QScoreCalculator();
      const fastResult = calculator.compute(fast);
      const slowResult = calculator.compute(slow);

      expect(slowResult.score).toBeLessThan(fastResult.score);
    });

    it('should produce lower score for higher retry depth', () => {
      const fresh = baseInput;
      const retried: QScoreInput = {
        ...baseInput,
        metadata: { ...baseInput.metadata, retry_depth: 3 },
      };

      const calculator = new QScoreCalculator();
      const freshResult = calculator.compute(fresh);
      const retriedResult = calculator.compute(retried);

      expect(retriedResult.score).toBeLessThan(freshResult.score);
    });
  });

  describe('Batch Computation', () => {
    it('should compute multiple QScores', () => {
      const calculator = new QScoreCalculator();
      const inputs = [baseInput, baseInput, baseInput];

      const results = calculator.computeBatch(inputs);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Convenience Function', () => {
    it('should compute QScore with default config', () => {
      const result = computeQScore(baseInput);

      expect(result.score).toBeDefined();
      expect(result.calibrated).toBeDefined();
      expect(result.signals).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty summary', () => {
      const input: QScoreInput = {
        ...baseInput,
        contextResult: {
          ...baseInput.contextResult,
          summary: [],
        },
      };

      const calculator = new QScoreCalculator();
      const result = calculator.compute(input);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('should handle empty affordances', () => {
      const input: QScoreInput = {
        ...baseInput,
        contextResult: {
          ...baseInput.contextResult,
          affordances: [],
        },
      };

      const calculator = new QScoreCalculator();
      const result = calculator.compute(input);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('should handle missing explain field', () => {
      const input: QScoreInput = {
        ...baseInput,
        contextResult: {
          summary: baseInput.contextResult.summary,
          affordances: baseInput.contextResult.affordances,
        },
      };

      const calculator = new QScoreCalculator();
      const result = calculator.compute(input);

      expect(result.score).toBeDefined();
    });
  });
});
