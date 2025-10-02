/**
 * H4R Ranker - Unit Tests
 *
 * Test multi-signal ranking with:
 * - Weighted score calculation
 * - Ordering and stable tie-breaking
 * - Threshold filtering
 * - Explainability output
 */

import { describe, it, expect } from 'vitest';
import { Ranker, DEFAULT_WEIGHTS } from '../../../src/context/h4r/ranker.js';
import type { H4RCandidate } from '../../../src/context/h4r/types.js';

describe('H4R Ranker', () => {
  describe('Weight Validation', () => {
    it('should accept default weights (sum to 1.0)', () => {
      expect(() => new Ranker()).not.toThrow();
    });

    it('should accept custom weights that sum to 1.0', () => {
      const weights = {
        recency: 0.3,
        frequency: 0.2,
        importance: 0.2,
        causality: 0.1,
        noveltyInverse: 0.1,
        trust: 0.05,
        sensitivityInverse: 0.05,
      };

      expect(() => new Ranker({ weights })).not.toThrow();
    });

    it('should reject weights that do not sum to 1.0', () => {
      const badWeights = {
        recency: 0.5,
        frequency: 0.2,
        importance: 0.1,
      };

      expect(() => new Ranker({ weights: badWeights })).toThrow(
        /must sum to 1\.0/
      );
    });

    it('should allow small floating point errors in weight sum', () => {
      const weights = {
        recency: 0.25,
        frequency: 0.15,
        importance: 0.20,
        causality: 0.15,
        noveltyInverse: 0.10,
        trust: 0.10,
        sensitivityInverse: 0.049, // 0.999 total (within 0.01 tolerance)
      };

      expect(() => new Ranker({ weights })).not.toThrow();
    });
  });

  describe('Signal Score Calculation', () => {
    it('should calculate all signal scores for a candidate', () => {
      const now = new Date('2025-10-02T12:00:00Z');
      const ranker = new Ranker({
        now,
        recencyDecayLambda: 0.1,
        maxExpectedAccess: 100,
      });

      const candidate: H4RCandidate = {
        id: 'test-001',
        content: { test: 'data' },
        metadata: {
          source: 'postgres',
          createdAt: new Date('2025-10-01T12:00:00Z'), // 1 day ago
          accessCount: 10,
          importance: 0.7,
          trust: 0.8,
          sensitivity: 0.2,
        },
      };

      const result = ranker.rank(candidate);

      expect(result.signals).toBeDefined();
      expect(result.signals.recency).toBeCloseTo(Math.exp(-0.1), 5);
      expect(result.signals.frequency).toBeGreaterThan(0);
      expect(result.signals.importance).toBe(0.7);
      expect(result.signals.causality).toBe(0.5); // null distance
      expect(result.signals.noveltyInverse).toBeGreaterThan(0);
      expect(result.signals.trust).toBe(0.8);
      expect(result.signals.sensitivityInverse).toBe(0.8); // 1 - 0.2
    });

    it('should calculate final score as weighted sum', () => {
      const ranker = new Ranker({ now: new Date('2025-10-02T12:00:00Z') });

      const candidate: H4RCandidate = {
        id: 'test-002',
        content: {},
        metadata: {
          source: 'postgres',
          createdAt: new Date('2025-10-02T12:00:00Z'), // now
          accessCount: 0,
          importance: 0.5,
          trust: 0.7,
          sensitivity: 0.0,
        },
      };

      const result = ranker.rank(candidate);
      const signals = result.signals;

      // Manual calculation
      const expectedScore =
        signals.recency * DEFAULT_WEIGHTS.recency +
        signals.frequency * DEFAULT_WEIGHTS.frequency +
        signals.importance * DEFAULT_WEIGHTS.importance +
        signals.causality * DEFAULT_WEIGHTS.causality +
        signals.noveltyInverse * DEFAULT_WEIGHTS.noveltyInverse +
        signals.trust * DEFAULT_WEIGHTS.trust +
        signals.sensitivityInverse * DEFAULT_WEIGHTS.sensitivityInverse;

      expect(result.score).toBeCloseTo(expectedScore, 10);
    });

    it('should verify epsilon accuracy of weighted sum', () => {
      const ranker = new Ranker();

      const candidate: H4RCandidate = {
        id: 'test-003',
        content: {},
        metadata: {
          source: 'postgres',
          createdAt: new Date(),
          accessCount: 50,
          importance: 0.9,
          trust: 1.0,
          sensitivity: 0.0,
        },
      };

      const result = ranker.rank(candidate);
      const { signals } = result;

      // Recalculate manually with epsilon check
      const manualScore = Object.entries(signals).reduce((sum, [key, value]) => {
        const weight = DEFAULT_WEIGHTS[key as keyof typeof DEFAULT_WEIGHTS];
        return sum + value * weight;
      }, 0);

      const epsilon = 1e-10;
      expect(Math.abs(result.score - manualScore)).toBeLessThan(epsilon);
    });
  });

  describe('Ranking Order', () => {
    it('should sort candidates by score (descending)', () => {
      const now = new Date('2025-10-02T12:00:00Z');
      const ranker = new Ranker({ now });

      const candidates: H4RCandidate[] = [
        {
          id: 'low-score',
          content: {},
          metadata: {
            source: 'postgres',
            createdAt: new Date('2020-01-01T00:00:00Z'), // Very old
            accessCount: 1,
            importance: 0.1,
            trust: 0.3,
            sensitivity: 0.9, // High sensitivity penalty
          },
        },
        {
          id: 'high-score',
          content: {},
          metadata: {
            source: 'postgres',
            createdAt: now, // Recent
            accessCount: 100,
            importance: 0.9,
            trust: 1.0,
            sensitivity: 0.0,
          },
        },
        {
          id: 'medium-score',
          content: {},
          metadata: {
            source: 'postgres',
            createdAt: new Date('2025-09-01T12:00:00Z'),
            accessCount: 50,
            importance: 0.5,
            trust: 0.7,
            sensitivity: 0.2,
          },
        },
      ];

      const results = ranker.rankAll(candidates);

      expect(results).toHaveLength(3);
      expect(results[0].id).toBe('high-score');
      expect(results[1].id).toBe('medium-score');
      expect(results[2].id).toBe('low-score');

      // Verify descending order
      expect(results[0].score).toBeGreaterThan(results[1].score);
      expect(results[1].score).toBeGreaterThan(results[2].score);
    });

    it('should maintain stable order for tied scores', () => {
      const now = new Date('2025-10-02T12:00:00Z');
      const ranker = new Ranker({ now });

      // Create candidates with identical metadata
      const baseMeta = {
        source: 'postgres' as const,
        createdAt: now,
        accessCount: 10,
        importance: 0.5,
        trust: 0.7,
        sensitivity: 0.0,
      };

      const candidates: H4RCandidate[] = [
        { id: 'tie-a', content: {}, metadata: { ...baseMeta } },
        { id: 'tie-b', content: {}, metadata: { ...baseMeta } },
        { id: 'tie-c', content: {}, metadata: { ...baseMeta } },
      ];

      const results1 = ranker.rankAll(candidates);
      const results2 = ranker.rankAll(candidates);

      // All should have same score
      expect(results1[0].score).toBeCloseTo(results1[1].score, 10);
      expect(results1[1].score).toBeCloseTo(results1[2].score, 10);

      // Order should be stable (same as input for ties)
      expect(results1.map((r) => r.id)).toEqual(results2.map((r) => r.id));
    });
  });

  describe('Threshold Filtering', () => {
    it('should mark items above threshold as kept', () => {
      const ranker = new Ranker({
        minScore: 0.5,
        now: new Date('2025-10-02T12:00:00Z'),
      });

      const candidate: H4RCandidate = {
        id: 'high-score',
        content: {},
        metadata: {
          source: 'postgres',
          createdAt: new Date('2025-10-02T12:00:00Z'),
          accessCount: 100,
          importance: 0.9,
          trust: 1.0,
          sensitivity: 0.0,
        },
      };

      const result = ranker.rank(candidate);

      expect(result.score).toBeGreaterThan(0.5);
      expect(result.reason).toBe('kept');
      expect(result.threshold).toBeUndefined();
    });

    it('should mark items below threshold as dropped', () => {
      const ranker = new Ranker({
        minScore: 0.8,
        now: new Date('2025-10-02T12:00:00Z'),
      });

      const candidate: H4RCandidate = {
        id: 'low-score',
        content: {},
        metadata: {
          source: 'postgres',
          createdAt: new Date('2020-01-01T00:00:00Z'),
          accessCount: 1,
          importance: 0.1,
          trust: 0.3,
          sensitivity: 0.9,
        },
      };

      const result = ranker.rank(candidate);

      expect(result.score).toBeLessThan(0.8);
      expect(result.reason).toBe('dropped');
      expect(result.threshold).toBe(0.8);
    });

    it('should filter out dropped items with rankAndFilter', () => {
      const ranker = new Ranker({
        minScore: 0.5,
        now: new Date('2025-10-02T12:00:00Z'),
      });

      const candidates: H4RCandidate[] = [
        {
          id: 'pass-1',
          content: {},
          metadata: {
            source: 'postgres',
            createdAt: new Date('2025-10-02T12:00:00Z'),
            accessCount: 50,
            importance: 0.8,
            trust: 0.9,
            sensitivity: 0.0,
          },
        },
        {
          id: 'fail-1',
          content: {},
          metadata: {
            source: 'postgres',
            createdAt: new Date('2020-01-01T00:00:00Z'),
            accessCount: 0,
            importance: 0.0,
            trust: 0.0,
            sensitivity: 1.0,
          },
        },
        {
          id: 'pass-2',
          content: {},
          metadata: {
            source: 'postgres',
            createdAt: new Date('2025-09-01T12:00:00Z'),
            accessCount: 25,
            importance: 0.6,
            trust: 0.7,
            sensitivity: 0.1,
          },
        },
      ];

      const filtered = ranker.rankAndFilter(candidates);

      expect(filtered).toHaveLength(2);
      expect(filtered.map((r) => r.id)).toEqual(['pass-1', 'pass-2']);
      expect(filtered.every((r) => r.reason === 'kept')).toBe(true);
    });
  });

  describe('Explainability', () => {
    it('should provide explanation for kept items', () => {
      const ranker = new Ranker({
        minScore: 0.3,
        now: new Date('2025-10-02T12:00:00Z'),
      });

      const candidate: H4RCandidate = {
        id: 'explain-kept',
        content: {},
        metadata: {
          source: 'postgres',
          createdAt: new Date('2025-10-02T11:00:00Z'),
          accessCount: 75,
          importance: 0.9,
          trust: 0.8,
          sensitivity: 0.0,
        },
      };

      const result = ranker.rank(candidate);

      expect(result.explanation).toBeDefined();
      expect(result.explanation).toContain('Score');
      expect(result.explanation).toMatch(/\d\.\d{3}/); // Score format
      expect(result.explanation).toContain('top signals:');
      expect(result.explanation).not.toContain('below threshold');
    });

    it('should provide explanation for dropped items', () => {
      const ranker = new Ranker({
        minScore: 0.7,
        now: new Date('2025-10-02T12:00:00Z'),
      });

      const candidate: H4RCandidate = {
        id: 'explain-dropped',
        content: {},
        metadata: {
          source: 'postgres',
          createdAt: new Date('2023-01-01T00:00:00Z'),
          accessCount: 5,
          importance: 0.2,
          trust: 0.4,
          sensitivity: 0.5,
        },
      };

      const result = ranker.rank(candidate);

      expect(result.explanation).toBeDefined();
      expect(result.explanation).toContain('Score');
      expect(result.explanation).toContain('below threshold');
      expect(result.explanation).toContain('0.700');
      expect(result.explanation).toContain('top signals:');
    });

    it('should include top 3 signals in explanation', () => {
      const ranker = new Ranker({ now: new Date('2025-10-02T12:00:00Z') });

      const candidate: H4RCandidate = {
        id: 'top-signals',
        content: {},
        metadata: {
          source: 'postgres',
          createdAt: new Date('2025-10-02T12:00:00Z'), // recency=1.0
          accessCount: 0,
          importance: 0.95, // high
          trust: 0.9, // high
          sensitivity: 0.0,
        },
      };

      const result = ranker.rank(candidate);

      // Should mention top signals (recency, importance, trust likely)
      expect(result.explanation).toMatch(/recency|importance|trust/);
      expect(result.explanation).toMatch(/=\d\.\d{2}/); // Signal value format
    });

    it('should include all signal scores in result', () => {
      const ranker = new Ranker();

      const candidate: H4RCandidate = {
        id: 'all-signals',
        content: {},
        metadata: {
          source: 'postgres',
          createdAt: new Date(),
          accessCount: 10,
          importance: 0.5,
          trust: 0.7,
          sensitivity: 0.2,
        },
      };

      const result = ranker.rank(candidate);

      expect(result.signals).toHaveProperty('recency');
      expect(result.signals).toHaveProperty('frequency');
      expect(result.signals).toHaveProperty('importance');
      expect(result.signals).toHaveProperty('causality');
      expect(result.signals).toHaveProperty('noveltyInverse');
      expect(result.signals).toHaveProperty('trust');
      expect(result.signals).toHaveProperty('sensitivityInverse');

      // All signals should be in [0, 1]
      Object.values(result.signals).forEach((signal) => {
        expect(signal).toBeGreaterThanOrEqual(0);
        expect(signal).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty candidate list', () => {
      const ranker = new Ranker();
      const results = ranker.rankAll([]);

      expect(results).toEqual([]);
    });

    it('should handle single candidate', () => {
      const ranker = new Ranker();

      const candidate: H4RCandidate = {
        id: 'solo',
        content: {},
        metadata: {
          source: 'postgres',
          createdAt: new Date(),
          accessCount: 5,
          importance: 0.5,
          trust: 0.7,
          sensitivity: 0.0,
        },
      };

      const results = ranker.rankAll([candidate]);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('solo');
      expect(results[0].score).toBeGreaterThan(0);
    });

    it('should handle minScore of 0 (keep all)', () => {
      const ranker = new Ranker({ minScore: 0.0 });

      const candidates: H4RCandidate[] = [
        {
          id: 'very-low',
          content: {},
          metadata: {
            source: 'postgres',
            createdAt: new Date('2000-01-01T00:00:00Z'),
            accessCount: 0,
            importance: 0.0,
            trust: 0.0,
            sensitivity: 1.0,
          },
        },
      ];

      const filtered = ranker.rankAndFilter(candidates);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].reason).toBe('kept');
    });

    it('should handle minScore of 1.0 (drop almost all)', () => {
      const ranker = new Ranker({ minScore: 1.0 });

      const candidates: H4RCandidate[] = [
        {
          id: 'near-perfect',
          content: {},
          metadata: {
            source: 'postgres',
            createdAt: new Date(),
            accessCount: 100,
            importance: 0.99,
            trust: 1.0,
            sensitivity: 0.0,
          },
        },
      ];

      const filtered = ranker.rankAndFilter(candidates);

      // Score will be < 1.0 due to causality=0.5, noveltyInverse < 1.0
      expect(filtered).toHaveLength(0);
    });
  });

  describe('Determinism', () => {
    it('should produce identical results for same inputs', () => {
      const now = new Date('2025-10-02T12:00:00Z');
      const ranker = new Ranker({ now });

      const candidate: H4RCandidate = {
        id: 'deterministic',
        content: { data: 'test' },
        metadata: {
          source: 'postgres',
          createdAt: new Date('2025-10-01T12:00:00Z'),
          accessCount: 42,
          importance: 0.75,
          trust: 0.85,
          sensitivity: 0.15,
        },
      };

      const result1 = ranker.rank(candidate);
      const result2 = ranker.rank(candidate);

      expect(result1.score).toBe(result2.score);
      expect(result1.signals).toEqual(result2.signals);
      expect(result1.reason).toBe(result2.reason);
      expect(result1.explanation).toBe(result2.explanation);
    });

    it('should produce consistent ordering across multiple runs', () => {
      const ranker = new Ranker({ now: new Date('2025-10-02T12:00:00Z') });

      const candidates: H4RCandidate[] = Array.from({ length: 10 }, (_, i) => ({
        id: `candidate-${i}`,
        content: {},
        metadata: {
          source: 'postgres' as const,
          createdAt: new Date(2025 - i, 9, 1),
          accessCount: i * 10,
          importance: i * 0.1,
          trust: 0.5 + i * 0.05,
          sensitivity: i * 0.05,
        },
      }));

      const results1 = ranker.rankAll(candidates);
      const results2 = ranker.rankAll(candidates);

      expect(results1.map((r) => r.id)).toEqual(results2.map((r) => r.id));
      results1.forEach((r, idx) => {
        expect(r.score).toBe(results2[idx].score);
      });
    });
  });
});
