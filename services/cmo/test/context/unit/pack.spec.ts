/**
 * Context Pack - Unit Tests
 *
 * Test TL;DR summarization, affordance generation, and pack assembly
 */

import { describe, it, expect } from 'vitest';
import { Summarizer } from '../../../src/context/pack/summarizer.js';
import { AffordanceGenerator } from '../../../src/context/pack/affordances.js';
import type { H4RResult } from '../../../src/context/h4r/types.js';

// Helper to create test H4R results
function createResult(
  id: string,
  contentText: string,
  score: number = 0.75,
  metadataOverrides?: Record<string, unknown>
): H4RResult {
  return {
    id,
    content: { text: contentText },
    score,
    signals: {
      recency: 0.8,
      frequency: 0.6,
      importance: 0.7,
      causality: 0.5,
      noveltyInverse: 0.5,
      trust: 0.7,
      sensitivityInverse: 0.8,
    },
    reason: 'kept',
    explanation: 'Test result',
    metadata: {
      source: 'postgres',
      createdAt: new Date('2025-10-01T12:00:00Z'),
      accessCount: 10,
      importance: 0.7,
      trust: 0.7,
      sensitivity: 0.2,
      ...metadataOverrides,
    },
  };
}

describe('Context Pack - Summarizer', () => {
  describe('Extractive Summarization', () => {
    it('should extract top sentences by score', () => {
      const results = [
        createResult('r1', 'First sentence. Second sentence. Third sentence.', 0.9),
        createResult('r2', 'Fourth sentence. Fifth sentence.', 0.8),
        createResult('r3', 'Sixth sentence. Seventh sentence.', 0.7),
      ];

      const summary = Summarizer.summarize(results, 3);

      expect(summary.summary).toBeDefined();
      expect(summary.summary.length).toBeGreaterThan(0);
      expect(summary.citations).toBeDefined();
      expect(Array.isArray(summary.citations)).toBe(true);
    });

    it('should limit to requested number of sentences', () => {
      const results = [
        createResult('r1', 'Sentence one. Sentence two. Sentence three.', 0.9),
        createResult('r2', 'Sentence four. Sentence five.', 0.8),
      ];

      const summary = Summarizer.summarize(results, 2);

      // Should extract exactly 2 sentences
      const sentenceCount = (summary.summary.match(/\./g) || []).length;
      expect(sentenceCount).toBe(2);
    });

    it('should include citations for source items', () => {
      const results = [
        createResult('source-1', 'Important fact about testing.', 0.95),
        createResult('source-2', 'Critical bug found in production.', 0.9),
      ];

      const summary = Summarizer.summarize(results, 2);

      expect(summary.citations.length).toBeGreaterThan(0);
      expect(summary.citations).toContain('source-1');
    });

    it('should handle empty results', () => {
      const summary = Summarizer.summarize([], 5);

      expect(summary.summary).toBe('No evidence available.');
      expect(summary.citations).toEqual([]);
    });

    it('should handle results with no text content', () => {
      const results = [
        createResult('r1', '', 0.8),
        createResult('r2', '', 0.7),
      ];

      const summary = Summarizer.summarize(results, 3);

      // When results have no extractable sentences, returns JSON stringified content
      expect(summary.summary.length).toBeGreaterThan(0);
      expect(summary.citations.length).toBeGreaterThanOrEqual(0);
    });

    it('should prioritize higher-scoring results', () => {
      const results = [
        createResult('low-score', 'Low priority sentence.', 0.3),
        createResult('high-score', 'High priority sentence.', 0.95),
        createResult('mid-score', 'Medium priority sentence.', 0.6),
      ];

      const summary = Summarizer.summarize(results, 1);

      expect(summary.summary).toContain('High priority');
      expect(summary.citations).toContain('high-score');
    });

    it('should handle single sentence results', () => {
      const results = [
        createResult('single', 'Only one sentence here.', 0.9),
      ];

      const summary = Summarizer.summarize(results, 5);

      expect(summary.summary).toBe('Only one sentence here.');
      expect(summary.citations).toEqual(['single']);
    });

    it('should preserve sentence structure', () => {
      const text = 'First sentence has context. Second sentence provides details.';
      const results = [createResult('test', text, 0.9)];

      const summary = Summarizer.summarize(results, 2);

      // Should preserve the original sentence endings
      expect(summary.summary).toMatch(/\./);
    });
  });
});

describe('Context Pack - Affordance Generator', () => {
  describe('Test Failure Patterns', () => {
    it('should detect multiple test failures', () => {
      const results = [
        createResult('f1', 'Test failed with assertion error', 0.8),
        createResult('f2', 'Timeout exception occurred', 0.75),
        createResult('f3', 'Error in test execution', 0.7),
      ];

      const affordances = AffordanceGenerator.generate(results);

      const healingAffordance = affordances.find(
        (a) => a.type === 'retry_with_healing'
      );

      expect(healingAffordance).toBeDefined();
      expect(healingAffordance?.confidence).toBeGreaterThanOrEqual(0.5);
      expect(healingAffordance?.description).toContain('test failures');
      expect(healingAffordance?.parameters?.failureCount).toBe(3);
    });

    it('should scale confidence with failure count', () => {
      const twoFailures = [
        createResult('f1', 'Test failed', 0.8),
        createResult('f2', 'Error occurred', 0.75),
      ];

      const fiveFailures = [
        ...twoFailures,
        createResult('f3', 'Assertion failed', 0.7),
        createResult('f4', 'Exception thrown', 0.65),
        createResult('f5', 'Timeout error', 0.6),
      ];

      const twoAff = AffordanceGenerator.generate(twoFailures);
      const fiveAff = AffordanceGenerator.generate(fiveFailures);

      const twoConfidence = twoAff.find((a) => a.type === 'retry_with_healing')?.confidence || 0;
      const fiveConfidence = fiveAff.find((a) => a.type === 'retry_with_healing')?.confidence || 0;

      expect(fiveConfidence).toBeGreaterThan(twoConfidence);
    });

    it('should not suggest healing for single failure', () => {
      const results = [
        createResult('f1', 'Test failed once', 0.8),
      ];

      const affordances = AffordanceGenerator.generate(results);

      const healingAffordance = affordances.find(
        (a) => a.type === 'retry_with_healing'
      );

      expect(healingAffordance).toBeUndefined();
    });
  });

  describe('Selector Issues', () => {
    it('should detect selector problems', () => {
      const results = [
        createResult('s1', 'Element not found with selector #login-button', 0.9),
      ];

      const affordances = AffordanceGenerator.generate(results);

      const fixAffordance = affordances.find((a) => a.type === 'suggest_fix');

      expect(fixAffordance).toBeDefined();
      expect(fixAffordance?.confidence).toBe(0.85);
      expect(fixAffordance?.description).toContain('Selector-related');
      expect(fixAffordance?.parameters?.suggestedStrategy).toBe('data-testid');
    });

    it('should detect various selector keywords', () => {
      const keywords = [
        'selector not found',
        'locator failed',
        'xpath issue',
        'css selector problem',
      ];

      keywords.forEach((keyword) => {
        const results = [createResult('test', keyword, 0.8)];
        const affordances = AffordanceGenerator.generate(results);
        const fixAffordance = affordances.find((a) => a.type === 'suggest_fix');

        expect(fixAffordance).toBeDefined();
      });
    });

    it('should count affected tests', () => {
      const results = [
        createResult('t1', 'Selector issue in login', 0.9),
        createResult('t2', 'Element not found in checkout', 0.85),
      ];

      const affordances = AffordanceGenerator.generate(results);
      const fixAffordance = affordances.find((a) => a.type === 'suggest_fix');

      expect(fixAffordance?.parameters?.affectedTests).toBe(2);
    });
  });

  describe('Flaky Test Patterns', () => {
    it('should detect flaky behavior', () => {
      const results = [
        createResult('flaky', 'Test is intermittent and flaky', 0.8),
      ];

      const affordances = AffordanceGenerator.generate(results);

      const rerunAffordance = affordances.find((a) => a.type === 'rerun_tests');

      expect(rerunAffordance).toBeDefined();
      expect(rerunAffordance?.confidence).toBe(0.75);
      expect(rerunAffordance?.description).toContain('Flaky');
      expect(rerunAffordance?.parameters?.suggestedRuns).toBe(5);
    });

    it('should detect race conditions', () => {
      const results = [
        createResult('race', 'Race condition detected in async test', 0.85),
      ];

      const affordances = AffordanceGenerator.generate(results);

      const rerunAffordance = affordances.find((a) => a.type === 'rerun_tests');

      expect(rerunAffordance).toBeDefined();
    });

    it('should detect timing issues', () => {
      const results = [
        createResult('timing', 'Timing issue causes test to sometimes pass', 0.8),
      ];

      const affordances = AffordanceGenerator.generate(results);

      const rerunAffordance = affordances.find((a) => a.type === 'rerun_tests');

      expect(rerunAffordance).toBeDefined();
    });
  });

  describe('Context Gaps', () => {
    it('should detect insufficient context', () => {
      const results = [
        createResult('low1', 'Barely relevant', 0.3),
        createResult('low2', 'Also not very relevant', 0.4),
      ];

      const affordances = AffordanceGenerator.generate(results);

      const moreContextAff = affordances.find(
        (a) => a.type === 'request_more_context'
      );

      expect(moreContextAff).toBeDefined();
      expect(moreContextAff?.confidence).toBe(0.6);
      expect(moreContextAff?.description).toContain('Limited relevant context');
      expect(moreContextAff?.parameters?.currentResults).toBe(2);
    });

    it('should not suggest more context when enough high-quality results', () => {
      const results = [
        createResult('good1', 'Very relevant content', 0.9),
        createResult('good2', 'Also very relevant', 0.85),
        createResult('good3', 'Highly relevant', 0.88),
      ];

      const affordances = AffordanceGenerator.generate(results);

      const moreContextAff = affordances.find(
        (a) => a.type === 'request_more_context'
      );

      expect(moreContextAff).toBeUndefined();
    });

    it('should calculate average relevance', () => {
      const results = [
        createResult('r1', 'Low score', 0.2),
        createResult('r2', 'Also low', 0.4),
      ];

      const affordances = AffordanceGenerator.generate(results);
      const moreContextAff = affordances.find(
        (a) => a.type === 'request_more_context'
      );

      expect(moreContextAff?.parameters?.avgRelevance).toBeCloseTo(0.3, 5);
    });
  });

  describe('Escalation Indicators', () => {
    it('should detect critical issues', () => {
      const results = [
        createResult('critical', 'Critical production outage detected', 0.95),
      ];

      const affordances = AffordanceGenerator.generate(results);

      const escalateAff = affordances.find(
        (a) => a.type === 'escalate_to_human'
      );

      expect(escalateAff).toBeDefined();
      expect(escalateAff?.confidence).toBe(0.95);
      expect(escalateAff?.description).toContain('Critical');
      expect(escalateAff?.parameters?.severity).toBe('high');
    });

    it('should detect security issues', () => {
      const results = [
        createResult('security', 'Security vulnerability found', 0.9),
      ];

      const affordances = AffordanceGenerator.generate(results);

      const escalateAff = affordances.find(
        (a) => a.type === 'escalate_to_human'
      );

      expect(escalateAff).toBeDefined();
    });

    it('should detect data loss indicators', () => {
      const results = [
        createResult('data', 'Potential data loss in production', 0.92),
      ];

      const affordances = AffordanceGenerator.generate(results);

      const escalateAff = affordances.find(
        (a) => a.type === 'escalate_to_human'
      );

      expect(escalateAff).toBeDefined();
    });

    it('should prioritize escalation affordances', () => {
      const results = [
        createResult('urgent', 'Urgent production issue', 0.9),
        createResult('flaky', 'Flaky test detected', 0.8),
      ];

      const affordances = AffordanceGenerator.generate(results);

      // Escalation should be first due to higher confidence
      expect(affordances[0].type).toBe('escalate_to_human');
      expect(affordances[0].confidence).toBe(0.95);
    });
  });

  describe('Affordance Prioritization', () => {
    it('should sort affordances by confidence', () => {
      const results = [
        createResult('fail', 'Test failed', 0.8),
        createResult('critical', 'Critical production issue', 0.9),
        createResult('selector', 'Selector not found', 0.85),
      ];

      const affordances = AffordanceGenerator.generate(results);

      // Should be sorted descending by confidence
      for (let i = 0; i < affordances.length - 1; i++) {
        expect(affordances[i].confidence).toBeGreaterThanOrEqual(
          affordances[i + 1].confidence
        );
      }
    });

    it('should limit to top 5 affordances', () => {
      const results = [
        createResult('critical', 'Critical issue urgent production security data loss outage', 0.9),
        createResult('fail', 'Test failed error timeout assertion exception', 0.85),
        createResult('selector', 'Selector locator xpath css element not found', 0.8),
        createResult('flaky', 'Flaky intermittent race timing', 0.75),
      ];

      const affordances = AffordanceGenerator.generate(results);

      expect(affordances.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Custom Affordances', () => {
    it('should create custom affordance', () => {
      const custom = AffordanceGenerator.custom(
        'Custom action needed',
        0.85,
        { param1: 'value1' }
      );

      expect(custom.type).toBe('custom');
      expect(custom.description).toBe('Custom action needed');
      expect(custom.confidence).toBe(0.85);
      expect(custom.parameters?.param1).toBe('value1');
    });

    it('should clamp confidence to [0, 1]', () => {
      const tooHigh = AffordanceGenerator.custom('Test', 1.5);
      const tooLow = AffordanceGenerator.custom('Test', -0.5);

      expect(tooHigh.confidence).toBe(1.0);
      expect(tooLow.confidence).toBe(0.0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty results array', () => {
      const affordances = AffordanceGenerator.generate([]);

      expect(affordances).toEqual([]);
    });

    it('should handle results with no matching patterns', () => {
      const results = [
        createResult('clean', 'Everything is working perfectly', 0.9),
      ];

      const affordances = AffordanceGenerator.generate(results);

      // Might have context gap affordance if only 1 result, but should not have failures/selectors/etc
      const hasFailure = affordances.some((a) => a.type === 'retry_with_healing');
      const hasSelector = affordances.some((a) => a.type === 'suggest_fix');

      expect(hasFailure).toBe(false);
      expect(hasSelector).toBe(false);
    });

    it('should handle results with mixed content types', () => {
      const results = [
        { ...createResult('r1', 'Text content', 0.9), content: { type: 'text', data: 'info' } },
        { ...createResult('r2', 'More text', 0.8), content: { nested: { field: 'value' } } },
      ];

      const affordances = AffordanceGenerator.generate(results as H4RResult[]);

      expect(Array.isArray(affordances)).toBe(true);
    });

    it('should handle very large result sets', () => {
      const results = Array.from({ length: 1000 }, (_, i) =>
        createResult(`r${i}`, `Test result ${i}`, 0.5 + Math.random() * 0.5)
      );

      const affordances = AffordanceGenerator.generate(results);

      expect(affordances.length).toBeLessThanOrEqual(5);
      expect(affordances.every((a) => a.confidence >= 0 && a.confidence <= 1)).toBe(true);
    });
  });

  describe('Pattern Combination', () => {
    it('should detect multiple patterns in same evidence', () => {
      const results = [
        createResult(
          'multi',
          'Critical test failed with selector issue and flaky behavior',
          0.9
        ),
      ];

      const affordances = AffordanceGenerator.generate(results);

      // Should detect escalation, test failure, selector, and flaky patterns
      expect(affordances.length).toBeGreaterThanOrEqual(3);

      const types = affordances.map((a) => a.type);
      expect(types).toContain('escalate_to_human');
      expect(types).toContain('suggest_fix');
    });

    it('should not duplicate affordance types', () => {
      const results = [
        createResult('f1', 'Failed test error', 0.9),
        createResult('f2', 'Another failed test error', 0.85),
      ];

      const affordances = AffordanceGenerator.generate(results);

      const typeSet = new Set(affordances.map((a) => a.type));
      expect(typeSet.size).toBe(affordances.length); // No duplicates
    });
  });

  describe('Confidence Calibration', () => {
    it('should use appropriate confidence for each pattern type', () => {
      const escalation = [createResult('esc', 'Critical production issue', 0.9)];
      const selector = [createResult('sel', 'Selector not found', 0.8)];
      const flaky = [createResult('flak', 'Flaky test behavior', 0.75)];

      const escAff = AffordanceGenerator.generate(escalation);
      const selAff = AffordanceGenerator.generate(selector);
      const flakAff = AffordanceGenerator.generate(flaky);

      expect(escAff[0].confidence).toBe(0.95); // Highest
      expect(selAff[0].confidence).toBe(0.85);
      expect(flakAff[0].confidence).toBe(0.75);
    });
  });
});
