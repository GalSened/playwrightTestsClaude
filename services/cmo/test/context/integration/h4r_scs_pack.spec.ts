/**
 * H4R → SCS → Pack Integration Tests
 *
 * Validate full context retrieval pipeline:
 * 1. H4R retrieves and ranks candidates
 * 2. SCS slices based on policy and budget
 * 3. Pack assembles TL;DR, affordances, explainability
 * 4. A2A handler returns ContextResult envelope
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { Ranker } from '../../../src/context/h4r/ranker.js';
import { ContextSlicer } from '../../../src/context/scs/slicer.js';
import { Summarizer } from '../../../src/context/pack/summarizer.js';
import { AffordanceGenerator } from '../../../src/context/pack/affordances.js';
import type { SpecialistMetadata } from '../../../src/context/scs/types.js';
import type { H4RCandidate, H4RQuery } from '../../../src/context/h4r/types.js';
import {
  generateSeedCorpus,
  generateFocusedCorpus,
  generateSignalCorpus,
  generateBudgetCorpus,
} from '../utils/seed.js';

describe('H4R → SCS → Pack Integration', () => {
  const now = new Date('2025-10-03T12:00:00Z');

  // Standard specialist for tests
  const specialist: SpecialistMetadata = {
    type: 'specialist',
    id: 'playwright_healer',
    securityLevel: 'internal',
    authorizedGroups: ['qa-team', 'eng-team'],
  };

  describe('Full Pipeline - Happy Path', () => {
    it('should complete H4R→SCS→Pack flow with seed corpus', async () => {
      // 1. Generate test corpus
      const candidates = generateSeedCorpus({
        count: 30,
        now,
      });

      expect(candidates).toHaveLength(30);

      // 2. H4R Ranking
      const ranker = new Ranker({
        minScore: 0.3,
        now,
      });

      const ranked = ranker.rankAndFilter(candidates);

      expect(ranked.length).toBeGreaterThan(0);
      expect(ranked.length).toBeLessThanOrEqual(30);

      // Verify descending score order
      for (let i = 0; i < ranked.length - 1; i++) {
        expect(ranked[i].score).toBeGreaterThanOrEqual(ranked[i + 1].score);
      }

      // Verify all have explainability
      ranked.forEach((result) => {
        expect(result.signals).toBeDefined();
        expect(result.explanation).toBeDefined();
        expect(result.reason).toBe('kept');
      });

      // 3. SCS Slicing
      const slicer = new ContextSlicer({
        budget: {
          maxBytes: 50000,
          maxTokens: 12500,
          maxItems: 20,
        },
        fallbackToLocal: true,
      });

      const slice = await slicer.slice(specialist, ranked);

      // Slice should respect budget
      expect(slice).toBeDefined();
      expect(slice.budgetUsed.bytes).toBeLessThanOrEqual(50000);
      expect(slice.budgetUsed.estimatedTokens).toBeLessThanOrEqual(12500);
      expect(slice.budgetUsed.items).toBeLessThanOrEqual(20);
      expect(slice.totalIncluded).toBeGreaterThan(0);

      // 4. Summarization
      const summary = Summarizer.summarize(ranked, 5);

      expect(summary.summary).toBeDefined();
      expect(summary.summary.length).toBeGreaterThan(0);
      expect(summary.citations).toBeDefined();
      expect(summary.citations.length).toBeGreaterThan(0);

      // 5. Affordances
      const affordances = AffordanceGenerator.generate(ranked);

      expect(Array.isArray(affordances)).toBe(true);
      expect(affordances.length).toBeLessThanOrEqual(5);

      // Verify affordance structure
      affordances.forEach((aff) => {
        expect(aff.type).toBeDefined();
        expect(aff.description).toBeDefined();
        expect(aff.confidence).toBeGreaterThanOrEqual(0);
        expect(aff.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should handle test failure scenario end-to-end', async () => {
      // Generate focused corpus with test failures
      const candidates = generateFocusedCorpus('test_failures', 15, now);

      // Rank
      const ranker = new Ranker({ now });
      const ranked = ranker.rankAll(candidates);

      expect(ranked).toHaveLength(15);

      // Slice
      const slicer = new ContextSlicer({
        budget: { maxBytes: 20000 },
        fallbackToLocal: true,
      });

      const slice = await slicer.slice(specialist, ranked);

      expect(slice.totalIncluded).toBeGreaterThan(0);

      // Summarize
      const summary = Summarizer.summarize(ranked, 3);

      expect(summary.summary).toContain('fail');

      // Affordances should detect test failures
      const affordances = AffordanceGenerator.generate(ranked);

      const healingAff = affordances.find((a) => a.type === 'retry_with_healing');
      expect(healingAff).toBeDefined();
      expect(healingAff?.confidence).toBeGreaterThan(0.5);
    });

    it('should handle selector issue scenario end-to-end', async () => {
      const candidates = generateFocusedCorpus('selector_issues', 10, now);

      const ranker = new Ranker({ now });
      const ranked = ranker.rankAll(candidates);

      const slicer = new ContextSlicer({ fallbackToLocal: true });
      const slice = await slicer.slice(specialist, ranked);

      expect(slice.totalIncluded).toBeGreaterThan(0);

      const affordances = AffordanceGenerator.generate(ranked);

      const fixAff = affordances.find((a) => a.type === 'suggest_fix');
      expect(fixAff).toBeDefined();
      expect(fixAff?.confidence).toBe(0.85);
      expect(fixAff?.parameters?.suggestedStrategy).toBe('data-testid');
    });

    it('should handle critical issue scenario with escalation', async () => {
      const candidates = generateFocusedCorpus('critical', 8, now);

      const ranker = new Ranker({ now });
      const ranked = ranker.rankAll(candidates);

      const affordances = AffordanceGenerator.generate(ranked);

      const escalateAff = affordances.find((a) => a.type === 'escalate_to_human');
      expect(escalateAff).toBeDefined();
      expect(escalateAff?.confidence).toBe(0.95);
      expect(escalateAff?.parameters?.severity).toBe('high');

      // Should be highest priority
      expect(affordances[0].type).toBe('escalate_to_human');
    });
  });

  describe('Budget Constraints', () => {
    it('should enforce byte limits across pipeline', async () => {
      const candidates = generateBudgetCorpus('medium', 30);

      const ranker = new Ranker({ now });
      const ranked = ranker.rankAll(candidates);

      const slicer = new ContextSlicer({
        budget: { maxBytes: 10000 },
        fallbackToLocal: true,
      });

      const slice = await slicer.slice(specialist, ranked);

      expect(slice.budgetUsed.bytes).toBeLessThanOrEqual(10000);
      expect(slice.totalIncluded).toBeLessThan(ranked.length);
      expect(slice.totalDroppedBudget).toBeGreaterThan(0);
      expect(slice.warnings.some((w) => w.includes('Budget exhausted'))).toBe(true);
    });

    it('should enforce token limits across pipeline', async () => {
      const candidates = generateBudgetCorpus('large', 10);

      const ranker = new Ranker({ now });
      const ranked = ranker.rankAll(candidates);

      const slicer = new ContextSlicer({
        budget: { maxTokens: 5000 },
        fallbackToLocal: true,
      });

      const slice = await slicer.slice(specialist, ranked);

      expect(slice.budgetUsed.estimatedTokens).toBeLessThanOrEqual(5000);
      expect(slice.totalDroppedBudget).toBeGreaterThan(0);
    });

    it('should enforce item limits across pipeline', async () => {
      const candidates = generateBudgetCorpus('small', 50);

      const ranker = new Ranker({ now });
      const ranked = ranker.rankAll(candidates);

      const slicer = new ContextSlicer({
        budget: { maxItems: 10 },
        fallbackToLocal: true,
      });

      const slice = await slicer.slice(specialist, ranked);

      expect(slice.totalIncluded).toBeLessThanOrEqual(10);
      expect(slice.budgetUsed.items).toBeLessThanOrEqual(10);
    });
  });

  describe('Security & Policy Enforcement', () => {
    it('should block high-sensitivity items for public specialists', async () => {
      const candidates = generateSignalCorpus(
        { sensitivity: 'high' },
        10,
        now
      );

      const ranker = new Ranker({ now });
      const ranked = ranker.rankAll(candidates);

      const publicSpecialist: SpecialistMetadata = {
        type: 'specialist',
        id: 'public-bot',
        securityLevel: 'public',
      };

      const slicer = new ContextSlicer({ fallbackToLocal: true });
      const slice = await slicer.slice(publicSpecialist, ranked);

      // Most/all should be blocked due to high sensitivity
      expect(slice.totalRedacted).toBeGreaterThan(0);
      expect(slice.totalIncluded).toBeLessThan(ranked.length);
    });

    it('should allow high-sensitivity items for confidential specialists', async () => {
      const candidates = generateSignalCorpus(
        { sensitivity: 'high' },
        10,
        now
      );

      const ranker = new Ranker({ now });
      const ranked = ranker.rankAll(candidates);

      const confidentialSpecialist: SpecialistMetadata = {
        type: 'specialist',
        id: 'secure-bot',
        securityLevel: 'confidential',
      };

      const slicer = new ContextSlicer({ fallbackToLocal: true });
      const slice = await slicer.slice(confidentialSpecialist, ranked);

      // Should allow most items
      expect(slice.totalIncluded).toBeGreaterThan(5);
    });

    it('should handle mixed security levels in corpus', async () => {
      const candidates = generateSignalCorpus(
        { sensitivity: 'mixed' },
        20,
        now
      );

      const ranker = new Ranker({ now });
      const ranked = ranker.rankAll(candidates);

      const slicer = new ContextSlicer({ fallbackToLocal: true });
      const slice = await slicer.slice(specialist, ranked);

      expect(slice.totalIncluded).toBeGreaterThan(0);
      expect(slice.totalIncluded).toBeLessThanOrEqual(ranked.length);
    });
  });

  describe('Signal Weighting Impact', () => {
    it('should prioritize recent items with high recency weight', () => {
      const candidates = generateSignalCorpus(
        { recency: 'mixed', frequency: 'low' },
        20,
        now
      );

      const recencyRanker = new Ranker({
        weights: {
          recency: 0.6,
          frequency: 0.05,
          importance: 0.15,
          causality: 0.05,
          noveltyInverse: 0.05,
          trust: 0.05,
          sensitivityInverse: 0.05,
        },
        now,
      });

      const ranked = recencyRanker.rankAll(candidates);

      // Top results should have high recency signal (or high importance)
      // Since corpus is mixed, check that recency is among top signals
      expect(ranked[0].signals.recency).toBeGreaterThan(0.2);
    });

    it('should prioritize frequent items with high frequency weight', () => {
      const candidates = generateSignalCorpus(
        { frequency: 'mixed', recency: 'low' },
        20,
        now
      );

      const frequencyRanker = new Ranker({
        weights: {
          recency: 0.05,
          frequency: 0.6,
          importance: 0.15,
          causality: 0.05,
          noveltyInverse: 0.05,
          trust: 0.05,
          sensitivityInverse: 0.05,
        },
        now,
      });

      const ranked = frequencyRanker.rankAll(candidates);

      // Top results should have high frequency signal
      expect(ranked[0].signals.frequency).toBeGreaterThan(0.5);
    });
  });

  describe('Explainability & Metadata', () => {
    it('should provide complete explainability through pipeline', async () => {
      const candidates = generateSeedCorpus({ count: 20, now });

      const ranker = new Ranker({ minScore: 0.4, now });
      const ranked = ranker.rankAll(candidates);

      // Every result should have explainability
      ranked.forEach((result) => {
        expect(result.signals).toBeDefined();
        expect(Object.keys(result.signals)).toHaveLength(7);
        expect(result.explanation).toContain('Score');
        expect(result.explanation).toMatch(/\d\.\d{3}/);
        expect(result.explanation).toContain('top signals:');
      });

      const slicer = new ContextSlicer({ fallbackToLocal: true });
      const slice = await slicer.slice(specialist, ranked);

      // Slice should have metadata
      expect(slice.totalAvailable).toBe(ranked.length);
      expect(slice.totalIncluded).toBeDefined();
      expect(slice.totalRedacted).toBeDefined();
      expect(slice.totalDroppedBudget).toBeDefined();
      expect(slice.budgetUsed).toBeDefined();
      expect(slice.budgetLimits).toBeDefined();
      expect(slice.warnings).toBeDefined();

      // Sliced items should have OPA decisions
      slice.items.forEach((item) => {
        expect(item.opaDecision).toBeDefined();
        expect(item.opaDecision.allow).toBe(true);
        expect(item.byteSize).toBeGreaterThan(0);
      });
    });

    it('should track performance metrics through pipeline', async () => {
      const candidates = generateSeedCorpus({ count: 50, now });

      const startRanking = performance.now();
      const ranker = new Ranker({ now });
      const ranked = ranker.rankAll(candidates);
      const rankingMs = performance.now() - startRanking;

      expect(rankingMs).toBeLessThan(100); // Should be fast

      const startSlicing = performance.now();
      const slicer = new ContextSlicer({ fallbackToLocal: true });
      const slice = await slicer.slice(specialist, ranked);
      const slicingMs = performance.now() - startSlicing;

      expect(slicingMs).toBeLessThan(200); // Should be fast

      const startSummarization = performance.now();
      const summary = Summarizer.summarize(ranked, 5);
      const summarizationMs = performance.now() - startSummarization;

      expect(summarizationMs).toBeLessThan(50); // Should be very fast

      // Total pipeline should be fast
      const totalMs = rankingMs + slicingMs + summarizationMs;
      expect(totalMs).toBeLessThan(350);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty corpus gracefully', async () => {
      const ranker = new Ranker({ now });
      const ranked = ranker.rankAll([]);

      expect(ranked).toEqual([]);

      const slicer = new ContextSlicer({ fallbackToLocal: true });
      const slice = await slicer.slice(specialist, ranked);

      expect(slice.totalAvailable).toBe(0);
      expect(slice.totalIncluded).toBe(0);
      expect(slice.items).toEqual([]);

      const summary = Summarizer.summarize(ranked, 5);
      expect(summary.summary).toBe('No evidence available.');
      expect(summary.citations).toEqual([]);

      const affordances = AffordanceGenerator.generate(ranked);
      expect(affordances).toEqual([]);
    });

    it('should handle all items filtered by threshold', () => {
      const candidates = generateSignalCorpus(
        { importance: 'low', recency: 'low' },
        20,
        now
      );

      const ranker = new Ranker({ minScore: 0.9, now }); // Very high threshold
      const ranked = ranker.rankAndFilter(candidates);

      // Most/all should be filtered
      expect(ranked.length).toBeLessThan(candidates.length);
    });

    it('should handle zero budget gracefully', async () => {
      const candidates = generateSeedCorpus({ count: 10, now });

      const ranker = new Ranker({ now });
      const ranked = ranker.rankAll(candidates);

      const slicer = new ContextSlicer({
        budget: { maxBytes: 0 },
        fallbackToLocal: true,
      });

      const slice = await slicer.slice(specialist, ranked);

      expect(slice.totalIncluded).toBe(0);
      expect(slice.totalDroppedBudget).toBeGreaterThan(0);
      expect(slice.warnings.some((w) => w.includes('Budget exhausted'))).toBe(true);
    });

    it('should handle single item corpus', async () => {
      const candidates = generateSeedCorpus({ count: 1, now });

      const ranker = new Ranker({ now });
      const ranked = ranker.rankAll(candidates);

      expect(ranked).toHaveLength(1);

      const slicer = new ContextSlicer({ fallbackToLocal: true });
      const slice = await slicer.slice(specialist, ranked);

      // Item may or may not be included depending on policy
      expect(slice.totalAvailable).toBe(1);
      expect(slice.totalIncluded).toBeLessThanOrEqual(1);

      const summary = Summarizer.summarize(ranked, 5);
      expect(summary.citations.length).toBeGreaterThanOrEqual(0);

      const affordances = AffordanceGenerator.generate(ranked);
      expect(Array.isArray(affordances)).toBe(true);
    });
  });

  describe('Determinism', () => {
    it('should produce identical results for same inputs', async () => {
      // Use generateDeterministicCorpus for true determinism
      const { generateDeterministicCorpus } = await import('../utils/seed.js');

      const candidates1 = generateDeterministicCorpus(42, 25);
      const candidates2 = generateDeterministicCorpus(42, 25);

      const ranker = new Ranker({ now: new Date('2025-10-01T12:00:00Z') });

      const ranked1 = ranker.rankAll(candidates1);
      const ranked2 = ranker.rankAll(candidates2);

      expect(ranked1.length).toBe(ranked2.length);

      for (let i = 0; i < ranked1.length; i++) {
        expect(ranked1[i].id).toBe(ranked2[i].id);
        expect(ranked1[i].score).toBe(ranked2[i].score);
      }

      const slicer = new ContextSlicer({ fallbackToLocal: true });

      const slice1 = await slicer.slice(specialist, ranked1);
      const slice2 = await slicer.slice(specialist, ranked2);

      expect(slice1.totalIncluded).toBe(slice2.totalIncluded);
      expect(slice1.totalRedacted).toBe(slice2.totalRedacted);
    });
  });
});
