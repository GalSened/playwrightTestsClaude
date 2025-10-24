/**
 * H4R Signal Functions - Unit Tests
 *
 * Test all 8 signal functions for:
 * - Edge cases
 * - Bounds [0, 1]
 * - Determinism
 * - Monotonicity
 */

import { describe, it, expect } from 'vitest';
import { calculateRecency } from '../../../src/context/h4r/signals/recency.js';
import { calculateFrequency } from '../../../src/context/h4r/signals/frequency.js';
import { calculateImportance } from '../../../src/context/h4r/signals/importance.js';
import { calculateCausality } from '../../../src/context/h4r/signals/causality.js';
import { calculateNoveltyInverse } from '../../../src/context/h4r/signals/novelty.js';
import { calculateTrust } from '../../../src/context/h4r/signals/trust.js';
import { calculateSensitivityInverse } from '../../../src/context/h4r/signals/sensitivity.js';

describe('H4R Signal Functions', () => {
  describe('Recency', () => {
    it('should return 1.0 for items created now', () => {
      const now = new Date();
      const score = calculateRecency(now, 0.1, now);
      expect(score).toBe(1.0);
    });

    it('should decay exponentially with age', () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

      const score1day = calculateRecency(oneDayAgo, 0.1, now);
      const score3days = calculateRecency(threeDaysAgo, 0.1, now);

      expect(score1day).toBeGreaterThan(score3days);
      expect(score1day).toBeCloseTo(Math.exp(-0.1), 5);
      expect(score3days).toBeCloseTo(Math.exp(-0.3), 5);
    });

    it('should respect lambda (decay factor)', () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const scoreFastDecay = calculateRecency(oneDayAgo, 0.5, now);
      const scoreSlowDecay = calculateRecency(oneDayAgo, 0.1, now);

      expect(scoreFastDecay).toBeLessThan(scoreSlowDecay);
    });

    it('should clamp to [0, 1]', () => {
      const now = new Date();
      const veryOld = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

      const score = calculateRecency(veryOld, 0.1, now);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should be deterministic', () => {
      const now = new Date('2025-10-02T10:00:00Z');
      const created = new Date('2025-10-01T10:00:00Z');

      const score1 = calculateRecency(created, 0.1, now);
      const score2 = calculateRecency(created, 0.1, now);

      expect(score1).toBe(score2);
    });
  });

  describe('Frequency', () => {
    it('should return 0 for zero access count', () => {
      const score = calculateFrequency(0);
      expect(score).toBe(0);
    });

    it('should increase with access count', () => {
      const score1 = calculateFrequency(1);
      const score10 = calculateFrequency(10);
      const score100 = calculateFrequency(100);

      expect(score10).toBeGreaterThan(score1);
      expect(score100).toBeGreaterThan(score10);
    });

    it('should use logarithmic scaling', () => {
      // log(11) / log(101) ≈ 0.52
      const score10 = calculateFrequency(10, 100);
      expect(score10).toBeCloseTo(0.52, 2);
    });

    it('should clamp to [0, 1]', () => {
      const score = calculateFrequency(1000, 100);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should respect maxExpected normalization', () => {
      const score50of100 = calculateFrequency(50, 100);
      const score50of200 = calculateFrequency(50, 200);

      expect(score50of100).toBeGreaterThan(score50of200);
    });
  });

  describe('Importance', () => {
    it('should return the clamped value', () => {
      expect(calculateImportance(0.5)).toBe(0.5);
      expect(calculateImportance(0.8)).toBe(0.8);
      expect(calculateImportance(0.0)).toBe(0.0);
      expect(calculateImportance(1.0)).toBe(1.0);
    });

    it('should clamp out-of-bounds values', () => {
      expect(calculateImportance(-0.5)).toBe(0.0);
      expect(calculateImportance(1.5)).toBe(1.0);
    });

    it('should use default 0.5 for undefined', () => {
      expect(calculateImportance()).toBe(0.5);
    });
  });

  describe('Causality', () => {
    it('should return 0.5 for null distance (no connection)', () => {
      expect(calculateCausality(null)).toBe(0.5);
      expect(calculateCausality(-1)).toBe(0.5);
    });

    it('should return 1.0 for distance 0 (same node)', () => {
      expect(calculateCausality(0)).toBe(1.0);
    });

    it('should decrease with distance', () => {
      const score0 = calculateCausality(0);
      const score1 = calculateCausality(1);
      const score3 = calculateCausality(3);

      expect(score1).toBeLessThan(score0);
      expect(score3).toBeLessThan(score1);
    });

    it('should use inverse distance formula', () => {
      expect(calculateCausality(1)).toBeCloseTo(0.5, 5); // 1/(1+1)
      expect(calculateCausality(3)).toBeCloseTo(0.25, 5); // 1/(1+3)
    });

    it('should cap at maxDistance', () => {
      const score5 = calculateCausality(5, 5);
      const score10 = calculateCausality(10, 5);

      expect(score5).toBe(score10); // Both capped at maxDistance=5
    });
  });

  describe('Novelty Inverse', () => {
    it('should favor older items', () => {
      const now = new Date();
      const recent = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
      const old = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      const scoreRecent = calculateNoveltyInverse(recent, 0, now);
      const scoreOld = calculateNoveltyInverse(old, 0, now);

      expect(scoreOld).toBeGreaterThan(scoreRecent);
    });

    it('should favor frequently accessed items', () => {
      const now = new Date();
      const created = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      const scoreLowAccess = calculateNoveltyInverse(created, 1, now);
      const scoreHighAccess = calculateNoveltyInverse(created, 50, now);

      expect(scoreHighAccess).toBeGreaterThan(scoreLowAccess);
    });

    it('should combine age and access (take max)', () => {
      const now = new Date();
      const veryOld = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000);
      const veryNew = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

      // Very old + no access → high stability from age
      const scoreOldNoAccess = calculateNoveltyInverse(veryOld, 0, now);

      // Very new + high access → high stability from access
      const scoreNewHighAccess = calculateNoveltyInverse(veryNew, 100, now);

      expect(scoreOldNoAccess).toBeGreaterThan(0.9);
      expect(scoreNewHighAccess).toBeGreaterThan(0.9);
    });

    it('should clamp to [0, 1]', () => {
      const now = new Date();
      const created = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000);

      const score = calculateNoveltyInverse(created, 1000, now);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe('Trust', () => {
    it('should return the clamped value', () => {
      expect(calculateTrust(0.9)).toBe(0.9);
      expect(calculateTrust(0.5)).toBe(0.5);
    });

    it('should use default 0.7 for undefined', () => {
      expect(calculateTrust()).toBe(0.7);
    });

    it('should clamp out-of-bounds values', () => {
      expect(calculateTrust(-0.2)).toBe(0.0);
      expect(calculateTrust(1.5)).toBe(1.0);
    });
  });

  describe('Sensitivity Inverse', () => {
    it('should return 1 - sensitivity', () => {
      expect(calculateSensitivityInverse(0.0)).toBe(1.0);
      expect(calculateSensitivityInverse(0.3)).toBeCloseTo(0.7, 5);
      expect(calculateSensitivityInverse(0.7)).toBeCloseTo(0.3, 5);
      expect(calculateSensitivityInverse(1.0)).toBe(0.0);
    });

    it('should penalize highly sensitive items', () => {
      const scorePublic = calculateSensitivityInverse(0.0);
      const scoreConfidential = calculateSensitivityInverse(0.9);

      expect(scorePublic).toBeGreaterThan(scoreConfidential);
    });

    it('should clamp out-of-bounds values', () => {
      expect(calculateSensitivityInverse(-0.5)).toBe(1.0);
      expect(calculateSensitivityInverse(1.5)).toBe(0.0);
    });

    it('should use default 0 (public) for undefined', () => {
      expect(calculateSensitivityInverse()).toBe(1.0);
    });
  });

  describe('Weighted Fusion (Monotonicity)', () => {
    it('should increase final score when recency increases', () => {
      const now = new Date();
      const recent = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
      const old = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      const scoreRecent = calculateRecency(recent, 0.1, now) * 0.25;
      const scoreOld = calculateRecency(old, 0.1, now) * 0.25;

      expect(scoreRecent).toBeGreaterThan(scoreOld);
    });

    it('should penalize when sensitivity increases', () => {
      const scoreLowSensitivity = calculateSensitivityInverse(0.1) * 0.05;
      const scoreHighSensitivity = calculateSensitivityInverse(0.9) * 0.05;

      expect(scoreLowSensitivity).toBeGreaterThan(scoreHighSensitivity);
    });
  });
});
