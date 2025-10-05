/**
 * Policy/Taxonomy Tests
 *
 * Validates error classification and retry routing logic.
 * Covers 9 error categories, context delta generation, and specialist selection.
 */

import { describe, it, expect } from 'vitest';
import {
  ErrorClassifier,
  ErrorCategory,
  type ErrorClassification,
} from '../../../src/decision/policy/taxonomy.js';
import {
  RetryPolicy,
  RetryAction,
  type RetryDecision,
} from '../../../src/decision/policy/retry.js';

describe('Policy & Taxonomy', () => {
  describe('ErrorClassifier', () => {
    const classifier = new ErrorClassifier();

    describe('Verification Failures (Priority 1)', () => {
      it('should classify schema verifier failure as SCHEMA_VIOLATION', () => {
        const result = classifier.classify({
          verificationResults: [
            {
              verifier: 'schema',
              passed: false,
              reason: 'Missing required field: summary',
              evidence: { missing: ['summary'] },
            },
          ],
        });

        expect(result.category).toBe(ErrorCategory.SCHEMA_VIOLATION);
        expect(result.confidence).toBe(1.0);
        expect(result.reason).toContain('Missing required field');
      });

      it('should classify replay verifier failure as INCONSISTENT', () => {
        const result = classifier.classify({
          verificationResults: [
            {
              verifier: 'replay',
              passed: false,
              reason: 'Low consistency with previous result',
              evidence: { consistency: 0.3 },
            },
          ],
        });

        expect(result.category).toBe(ErrorCategory.INCONSISTENT);
        expect(result.confidence).toBe(0.9);
        expect(result.reason).toContain('Low consistency');
      });

      it('should classify smoke failure (too few items) as MISSING_EVIDENCE', () => {
        const result = classifier.classify({
          verificationResults: [
            {
              verifier: 'smoke',
              passed: false,
              reason: 'Smoke test failed',
              evidence: { failures: ['Too few summary items'] },
            },
          ],
        });

        expect(result.category).toBe(ErrorCategory.MISSING_EVIDENCE);
        expect(result.confidence).toBe(0.8);
        expect(result.reason).toContain('Insufficient evidence');
      });

      it('should classify smoke failure (forbidden pattern) as UNKNOWN', () => {
        const result = classifier.classify({
          verificationResults: [
            {
              verifier: 'smoke',
              passed: false,
              reason: 'Smoke test failed',
              evidence: { failures: ['Forbidden pattern detected'] },
            },
          ],
        });

        expect(result.category).toBe(ErrorCategory.UNKNOWN);
        expect(result.confidence).toBe(0.7);
        expect(result.reason).toContain('Suspicious content');
      });
    });

    describe('QScore Signals (Priority 2)', () => {
      it('should classify low policyOk as POLICY_DEGRADED', () => {
        const result = classifier.classify({
          qscoreSignals: { policyOk: 0.3 },
        });

        expect(result.category).toBe(ErrorCategory.POLICY_DEGRADED);
        expect(result.confidence).toBe(1.0);
        expect(result.reason).toContain('Policy compliance check failed');
      });

      it('should classify low resultConfidence as LOW_CONFIDENCE', () => {
        const result = classifier.classify({
          qscoreSignals: { resultConfidence: 0.2 },
        });

        expect(result.category).toBe(ErrorCategory.LOW_CONFIDENCE);
        expect(result.confidence).toBe(0.9);
        expect(result.reason).toContain('low confidence');
      });

      it('should classify low latencyNorm as TIMEOUT', () => {
        const result = classifier.classify({
          qscoreSignals: { latencyNorm: 0.1 },
        });

        expect(result.category).toBe(ErrorCategory.TIMEOUT);
        expect(result.confidence).toBe(0.8);
        expect(result.reason).toContain('latency exceeded');
      });

      it('should classify low evidenceCoverage as MISSING_EVIDENCE', () => {
        const result = classifier.classify({
          qscoreSignals: { evidenceCoverage: 0.3 },
        });

        expect(result.category).toBe(ErrorCategory.MISSING_EVIDENCE);
        expect(result.confidence).toBe(0.8);
        expect(result.reason).toContain('Insufficient evidence coverage');
      });
    });

    describe('Content Analysis (Priority 3)', () => {
      it('should detect flaky patterns in summary', () => {
        const result = classifier.classify({
          contextResult: {
            summary: ['Test is flaky and sometimes passes'],
            affordances: [],
          },
        });

        expect(result.category).toBe(ErrorCategory.FLAKY_PATTERN);
        expect(result.confidence).toBe(0.7);
        expect(result.reason).toContain('Flaky test behavior');
      });

      it('should detect selector issues in summary', () => {
        const result = classifier.classify({
          contextResult: {
            summary: ['Element with selector #login not found'],
            affordances: [],
          },
        });

        expect(result.category).toBe(ErrorCategory.SELECTOR_ISSUE);
        expect(result.confidence).toBe(0.6);
        expect(result.reason).toContain('Selector-related issues');
      });
    });

    describe('QScore Value Fallback (Priority 4)', () => {
      it('should classify low QScore as LOW_CONFIDENCE', () => {
        const result = classifier.classify({
          qscoreValue: 0.4,
        });

        expect(result.category).toBe(ErrorCategory.LOW_CONFIDENCE);
        expect(result.confidence).toBe(0.7);
        expect(result.reason).toContain('QScore below threshold');
        expect(result.reason).toContain('40.0%');
      });
    });

    describe('Priority Order', () => {
      it('should prioritize verifier failures over QScore signals', () => {
        const result = classifier.classify({
          verificationResults: [
            {
              verifier: 'schema',
              passed: false,
              reason: 'Schema failed',
              evidence: {},
            },
          ],
          qscoreSignals: { policyOk: 0.2 }, // should be ignored
        });

        expect(result.category).toBe(ErrorCategory.SCHEMA_VIOLATION);
        expect(result.category).not.toBe(ErrorCategory.POLICY_DEGRADED);
      });

      it('should prioritize QScore signals over content analysis', () => {
        const result = classifier.classify({
          qscoreSignals: { resultConfidence: 0.1 },
          contextResult: {
            summary: ['Test is flaky'], // should be ignored
            affordances: [],
          },
        });

        expect(result.category).toBe(ErrorCategory.LOW_CONFIDENCE);
        expect(result.category).not.toBe(ErrorCategory.FLAKY_PATTERN);
      });
    });

    describe('Edge Cases', () => {
      it('should return UNKNOWN when no signals available', () => {
        const result = classifier.classify({});

        expect(result.category).toBe(ErrorCategory.UNKNOWN);
        expect(result.confidence).toBe(0.5);
        expect(result.reason).toContain('Unable to classify');
      });

      it('should handle all verifiers passing', () => {
        const result = classifier.classify({
          verificationResults: [
            { verifier: 'schema', passed: true, reason: 'OK', evidence: {} },
            { verifier: 'replay', passed: true, reason: 'OK', evidence: {} },
          ],
        });

        expect(result.category).toBe(ErrorCategory.UNKNOWN);
      });
    });
  });

  describe('RetryPolicy', () => {
    describe('SCHEMA_VIOLATION Routing', () => {
      it('should retry with schema hints when under limit', () => {
        const policy = new RetryPolicy();
        const decision = policy.decide({
          category: ErrorCategory.SCHEMA_VIOLATION,
          currentRetryDepth: 0,
          currentSpecialist: 'specialist-default',
          categoryConfidence: 0.9,
        });

        expect(decision.action).toBe(RetryAction.RETRY_WITH_SCHEMA);
        expect(decision.targetSpecialist).toBe('specialist-default');
        expect(decision.contextDelta?.includeSchema).toBe(true);
        expect(decision.contextDelta?.addHints).toContain('Ensure result matches expected schema');
        expect(decision.maxRetries).toBe(2);
      });

      it('should escalate when SCHEMA_VIOLATION limit reached', () => {
        const policy = new RetryPolicy();
        const decision = policy.decide({
          category: ErrorCategory.SCHEMA_VIOLATION,
          currentRetryDepth: 2, // at category limit
          currentSpecialist: 'specialist-default',
          categoryConfidence: 0.9,
        });

        expect(decision.action).toBe(RetryAction.ESCALATE);
        expect(decision.reason).toContain('Category max retries reached');
      });
    });

    describe('MISSING_EVIDENCE Routing', () => {
      it('should retry with expanded context', () => {
        const policy = new RetryPolicy();
        const decision = policy.decide({
          category: ErrorCategory.MISSING_EVIDENCE,
          currentRetryDepth: 0,
          currentSpecialist: 'specialist-default',
          categoryConfidence: 0.8,
        });

        expect(decision.action).toBe(RetryAction.RETRY_EXPAND_CONTEXT);
        expect(decision.contextDelta?.expandBudget).toBe(10000);
        expect(decision.contextDelta?.addHints).toContain('Provide more detailed evidence');
        expect(decision.maxRetries).toBe(3);
      });
    });

    describe('FLAKY_PATTERN Routing', () => {
      it('should retry with stability specialist', () => {
        const policy = new RetryPolicy();
        const decision = policy.decide({
          category: ErrorCategory.FLAKY_PATTERN,
          currentRetryDepth: 0,
          currentSpecialist: 'specialist-default',
          categoryConfidence: 0.7,
        });

        expect(decision.action).toBe(RetryAction.RETRY_STABILITY);
        expect(decision.targetSpecialist).toBe('specialist-stability');
        expect(decision.contextDelta?.addHints).toContain('Focus on stable, deterministic patterns');
      });
    });

    describe('SELECTOR_ISSUE Routing', () => {
      it('should retry with selector-heal specialist', () => {
        const policy = new RetryPolicy();
        const decision = policy.decide({
          category: ErrorCategory.SELECTOR_ISSUE,
          currentRetryDepth: 0,
          currentSpecialist: 'specialist-default',
          categoryConfidence: 0.6,
        });

        expect(decision.action).toBe(RetryAction.RETRY_SELECTOR_HEAL);
        expect(decision.targetSpecialist).toBe('specialist-selector-heal');
        expect(decision.contextDelta?.addHints).toContain('Use data-testid or robust selectors');
      });
    });

    describe('POLICY_DEGRADED Routing', () => {
      it('should escalate immediately with zero retries', () => {
        const policy = new RetryPolicy();
        const decision = policy.decide({
          category: ErrorCategory.POLICY_DEGRADED,
          currentRetryDepth: 0,
          currentSpecialist: 'specialist-default',
          categoryConfidence: 1.0,
        });

        expect(decision.action).toBe(RetryAction.ESCALATE);
        expect(decision.maxRetries).toBe(0);
        expect(decision.reason).toContain('Category max retries reached (0/0)');
      });
    });

    describe('LOW_CONFIDENCE Routing', () => {
      it('should retry with alternative specialist', () => {
        const policy = new RetryPolicy();
        const decision = policy.decide({
          category: ErrorCategory.LOW_CONFIDENCE,
          currentRetryDepth: 0,
          currentSpecialist: 'specialist-default',
          categoryConfidence: 0.7,
        });

        expect(decision.action).toBe(RetryAction.RETRY_DIFFERENT_SPECIALIST);
        expect(decision.targetSpecialist).toBe('specialist-advanced');
        expect(decision.contextDelta?.addHints).toContain('Provide higher confidence analysis');
      });
    });

    describe('TIMEOUT Routing', () => {
      it('should retry with performance specialist', () => {
        const policy = new RetryPolicy();
        const decision = policy.decide({
          category: ErrorCategory.TIMEOUT,
          currentRetryDepth: 0,
          currentSpecialist: 'specialist-default',
          categoryConfidence: 0.75,
        });

        expect(decision.action).toBe(RetryAction.RETRY_DIFFERENT_SPECIALIST);
        expect(decision.targetSpecialist).toBe('specialist-performance');
      });
    });

    describe('INCONSISTENT Routing', () => {
      it('should retry with consistency enforcement', () => {
        const policy = new RetryPolicy();
        const decision = policy.decide({
          category: ErrorCategory.INCONSISTENT,
          currentRetryDepth: 0,
          currentSpecialist: 'specialist-default',
          categoryConfidence: 0.7,
        });

        expect(decision.action).toBe(RetryAction.RETRY_EXPAND_CONTEXT);
        expect(decision.contextDelta?.addHints).toContain('Ensure consistency with previous results');
      });
    });

    describe('UNKNOWN Routing', () => {
      it('should retry once with alternative specialist', () => {
        const policy = new RetryPolicy();
        const decision = policy.decide({
          category: ErrorCategory.UNKNOWN,
          currentRetryDepth: 0,
          currentSpecialist: 'specialist-default',
          categoryConfidence: 0.5,
        });

        expect(decision.action).toBe(RetryAction.RETRY_DIFFERENT_SPECIALIST);
        expect(decision.targetSpecialist).toBe('specialist-advanced');
        expect(decision.reason).toContain('Unknown error, retry once');
      });

      it('should escalate after one retry', () => {
        const policy = new RetryPolicy();
        const decision = policy.decide({
          category: ErrorCategory.UNKNOWN,
          currentRetryDepth: 1,
          currentSpecialist: 'specialist-advanced',
          categoryConfidence: 0.5,
        });

        expect(decision.action).toBe(RetryAction.ESCALATE);
        expect(decision.reason).toContain('Category max retries reached (1/1)');
      });
    });

    describe('Global Retry Limit', () => {
      it('should escalate when global max reached (depth=3)', () => {
        const policy = new RetryPolicy();
        const decision = policy.decide({
          category: ErrorCategory.MISSING_EVIDENCE, // category max = 3
          currentRetryDepth: 3,
          currentSpecialist: 'specialist-default',
          categoryConfidence: 0.8,
        });

        expect(decision.action).toBe(RetryAction.ESCALATE);
        expect(decision.reason).toContain('Global max retries reached');
      });

      it('should respect global limit even if category allows more', () => {
        const policy = new RetryPolicy({ globalMaxRetries: 2 });
        const decision = policy.decide({
          category: ErrorCategory.MISSING_EVIDENCE, // category max = 3
          currentRetryDepth: 2,
          currentSpecialist: 'specialist-default',
          categoryConfidence: 0.8,
        });

        expect(decision.action).toBe(RetryAction.ESCALATE);
      });
    });

    describe('Category-Specific Limits', () => {
      it('should enforce category override (SCHEMA: 2 retries)', () => {
        const policy = new RetryPolicy();
        const decision = policy.decide({
          category: ErrorCategory.SCHEMA_VIOLATION,
          currentRetryDepth: 2,
          currentSpecialist: 'specialist-default',
          categoryConfidence: 0.9,
        });

        expect(decision.action).toBe(RetryAction.ESCALATE);
        expect(decision.maxRetries).toBe(2);
      });

      it('should enforce category override (TIMEOUT: 1 retry)', () => {
        const policy = new RetryPolicy();
        const decision = policy.decide({
          category: ErrorCategory.TIMEOUT,
          currentRetryDepth: 1,
          currentSpecialist: 'specialist-default',
          categoryConfidence: 0.75,
        });

        expect(decision.action).toBe(RetryAction.ESCALATE);
        expect(decision.maxRetries).toBe(1);
      });
    });

    describe('Custom Configuration', () => {
      it('should respect custom category max retries', () => {
        const policy = new RetryPolicy({
          categoryMaxRetries: {
            SCHEMA_VIOLATION: 5, // override default of 2
          },
        });

        const decision = policy.decide({
          category: ErrorCategory.SCHEMA_VIOLATION,
          currentRetryDepth: 2,
          currentSpecialist: 'specialist-default',
          categoryConfidence: 0.9,
        });

        expect(decision.action).toBe(RetryAction.RETRY_WITH_SCHEMA);
        expect(decision.maxRetries).toBe(5); // category config value
      });

      it('should respect custom specialist routing', () => {
        const policy = new RetryPolicy({
          specialistRouting: {
            FLAKY_PATTERN: 'specialist-custom-stability',
          },
        });

        const decision = policy.decide({
          category: ErrorCategory.FLAKY_PATTERN,
          currentRetryDepth: 0,
          currentSpecialist: 'specialist-default',
          categoryConfidence: 0.7,
        });

        expect(decision.targetSpecialist).toBe('specialist-custom-stability');
      });

      it('should disable escalation when configured', () => {
        const policy = new RetryPolicy({ enableEscalation: false });

        const decision = policy.decide({
          category: ErrorCategory.SCHEMA_VIOLATION,
          currentRetryDepth: 2,
          currentSpecialist: 'specialist-default',
          categoryConfidence: 0.9,
        });

        expect(decision.action).toBe(RetryAction.ACCEPT); // fallback
      });
    });

    describe('Specialist Selection', () => {
      it('should select alternative specialist (default → advanced)', () => {
        const policy = new RetryPolicy();
        const decision = policy.decide({
          category: ErrorCategory.LOW_CONFIDENCE,
          currentRetryDepth: 0,
          currentSpecialist: 'specialist-default',
          categoryConfidence: 0.7,
        });

        expect(decision.targetSpecialist).toBe('specialist-advanced');
      });

      it('should select alternative specialist (advanced → default)', () => {
        const policy = new RetryPolicy();
        const decision = policy.decide({
          category: ErrorCategory.LOW_CONFIDENCE,
          currentRetryDepth: 0,
          currentSpecialist: 'specialist-advanced',
          categoryConfidence: 0.7,
        });

        expect(decision.targetSpecialist).toBe('specialist-default');
      });

      it('should fallback to advanced for unknown specialists', () => {
        const policy = new RetryPolicy();
        const decision = policy.decide({
          category: ErrorCategory.LOW_CONFIDENCE,
          currentRetryDepth: 0,
          currentSpecialist: 'specialist-unknown',
          categoryConfidence: 0.7,
        });

        expect(decision.targetSpecialist).toBe('specialist-advanced');
      });
    });

    describe('Context Delta Generation', () => {
      it('should include schema for SCHEMA_VIOLATION', () => {
        const policy = new RetryPolicy();
        const decision = policy.decide({
          category: ErrorCategory.SCHEMA_VIOLATION,
          currentRetryDepth: 0,
          currentSpecialist: 'specialist-default',
          categoryConfidence: 0.9,
        });

        expect(decision.contextDelta?.includeSchema).toBe(true);
        expect(decision.contextDelta?.addHints).toBeDefined();
        expect(decision.contextDelta?.expandBudget).toBeUndefined();
      });

      it('should include budget expansion for MISSING_EVIDENCE', () => {
        const policy = new RetryPolicy();
        const decision = policy.decide({
          category: ErrorCategory.MISSING_EVIDENCE,
          currentRetryDepth: 0,
          currentSpecialist: 'specialist-default',
          categoryConfidence: 0.8,
        });

        expect(decision.contextDelta?.expandBudget).toBe(10000);
        expect(decision.contextDelta?.addHints).toBeDefined();
        expect(decision.contextDelta?.includeSchema).toBeUndefined();
      });

      it('should include hints for all retry actions', () => {
        const policy = new RetryPolicy();

        const categories = [
          ErrorCategory.SCHEMA_VIOLATION,
          ErrorCategory.MISSING_EVIDENCE,
          ErrorCategory.FLAKY_PATTERN,
          ErrorCategory.SELECTOR_ISSUE,
          ErrorCategory.LOW_CONFIDENCE,
          ErrorCategory.INCONSISTENT,
        ];

        for (const category of categories) {
          const decision = policy.decide({
            category,
            currentRetryDepth: 0,
            currentSpecialist: 'specialist-default',
            categoryConfidence: 0.7,
          });

          if (decision.action !== RetryAction.ESCALATE) {
            expect(decision.contextDelta?.addHints).toBeDefined();
            expect(decision.contextDelta!.addHints!.length).toBeGreaterThan(0);
          }
        }
      });

      it('should not include context delta for escalation', () => {
        const policy = new RetryPolicy();
        const decision = policy.decide({
          category: ErrorCategory.POLICY_DEGRADED,
          currentRetryDepth: 0,
          currentSpecialist: 'specialist-default',
          categoryConfidence: 1.0,
        });

        expect(decision.action).toBe(RetryAction.ESCALATE);
        expect(decision.contextDelta).toBeUndefined();
      });
    });
  });
});
