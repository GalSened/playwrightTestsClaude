/**
 * Affordance Generator
 *
 * Generate action hints for specialists based on evidence patterns
 */

import type { H4RResult } from '../h4r/types.js';
import type { Affordance } from './types.js';

/**
 * Pattern matcher result
 */
interface PatternMatch {
  type: Affordance['type'];
  description: string;
  confidence: number;
  parameters?: Record<string, unknown>;
}

/**
 * Affordance generator
 */
export class AffordanceGenerator {
  /**
   * Check for test failure patterns
   */
  private static checkTestFailurePatterns(
    results: H4RResult[]
  ): PatternMatch | null {
    const failureKeywords = [
      'fail',
      'error',
      'timeout',
      'exception',
      'assertion',
    ];

    const failureCount = results.filter((r) => {
      const text = JSON.stringify(r.content).toLowerCase();
      return failureKeywords.some((kw) => text.includes(kw));
    }).length;

    if (failureCount >= 2) {
      // Multiple failures suggest potential for healing
      return {
        type: 'retry_with_healing',
        description:
          'Multiple test failures detected. Consider retrying with self-healing enabled.',
        confidence: Math.min(0.9, 0.5 + failureCount * 0.1),
        parameters: {
          failureCount,
          suggestedRetries: 3,
        },
      };
    }

    return null;
  }

  /**
   * Check for selector/locator issues
   */
  private static checkSelectorIssues(
    results: H4RResult[]
  ): PatternMatch | null {
    const selectorKeywords = [
      'selector',
      'locator',
      'element not found',
      'xpath',
      'css selector',
    ];

    const selectorIssues = results.filter((r) => {
      const text = JSON.stringify(r.content).toLowerCase();
      return selectorKeywords.some((kw) => text.includes(kw));
    });

    if (selectorIssues.length >= 1) {
      return {
        type: 'suggest_fix',
        description:
          'Selector-related issues detected. Suggest updating locators or using more robust selector strategies.',
        confidence: 0.85,
        parameters: {
          affectedTests: selectorIssues.length,
          suggestedStrategy: 'data-testid',
        },
      };
    }

    return null;
  }

  /**
   * Check for flaky test patterns
   */
  private static checkFlakyPatterns(
    results: H4RResult[]
  ): PatternMatch | null {
    const flakyKeywords = [
      'intermittent',
      'flaky',
      'sometimes pass',
      'race condition',
      'timing',
    ];

    const flakyEvidence = results.filter((r) => {
      const text = JSON.stringify(r.content).toLowerCase();
      return flakyKeywords.some((kw) => text.includes(kw));
    });

    if (flakyEvidence.length >= 1) {
      return {
        type: 'rerun_tests',
        description:
          'Flaky test behavior detected. Recommend rerunning tests multiple times to establish stability baseline.',
        confidence: 0.75,
        parameters: {
          suggestedRuns: 5,
          flakyEvidence: flakyEvidence.length,
        },
      };
    }

    return null;
  }

  /**
   * Check for missing context
   */
  private static checkContextGaps(
    results: H4RResult[]
  ): PatternMatch | null {
    // If we have very few results with low scores, suggest more context
    if (results.length < 3) {
      const avgScore =
        results.reduce((sum, r) => sum + r.score, 0) / results.length;

      if (avgScore < 0.5) {
        return {
          type: 'request_more_context',
          description:
            'Limited relevant context found. Consider broadening search or providing additional details.',
          confidence: 0.6,
          parameters: {
            currentResults: results.length,
            avgRelevance: avgScore,
          },
        };
      }
    }

    return null;
  }

  /**
   * Check for escalation indicators
   */
  private static checkEscalationNeeded(
    results: H4RResult[]
  ): PatternMatch | null {
    const escalationKeywords = [
      'production',
      'critical',
      'urgent',
      'security',
      'data loss',
      'outage',
    ];

    const criticalEvidence = results.filter((r) => {
      const text = JSON.stringify(r.content).toLowerCase();
      return escalationKeywords.some((kw) => text.includes(kw));
    });

    if (criticalEvidence.length >= 1) {
      return {
        type: 'escalate_to_human',
        description:
          'Critical issue indicators detected. Human review recommended.',
        confidence: 0.95,
        parameters: {
          criticalEvidence: criticalEvidence.length,
          severity: 'high',
        },
      };
    }

    return null;
  }

  /**
   * Generate affordances from evidence
   *
   * @param results - H4R results to analyze
   * @returns List of suggested actions
   */
  static generate(results: H4RResult[]): Affordance[] {
    if (results.length === 0) {
      return [];
    }

    const affordances: Affordance[] = [];

    // Run pattern matchers
    const matchers = [
      this.checkEscalationNeeded,
      this.checkTestFailurePatterns,
      this.checkSelectorIssues,
      this.checkFlakyPatterns,
      this.checkContextGaps,
    ];

    for (const matcher of matchers) {
      const match = matcher(results);
      if (match) {
        affordances.push(match as Affordance);
      }
    }

    // Sort by confidence (descending)
    affordances.sort((a, b) => b.confidence - a.confidence);

    // Limit to top 5
    return affordances.slice(0, 5);
  }

  /**
   * Generate custom affordance
   */
  static custom(
    description: string,
    confidence: number,
    parameters?: Record<string, unknown>
  ): Affordance {
    return {
      type: 'custom',
      description,
      confidence: Math.max(0, Math.min(1, confidence)),
      parameters,
    };
  }
}
