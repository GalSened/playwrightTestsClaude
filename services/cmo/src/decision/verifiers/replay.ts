/**
 * Replay Verifier
 *
 * Compares current result with previous result to detect drift.
 * High consistency → pass, low consistency → fail (potential regression).
 */

import type { Verifier, VerificationInput, VerificationResult } from './types.js';

/**
 * Replay Verifier
 *
 * Validates consistency with previous execution.
 */
export class ReplayVerifier implements Verifier {
  readonly name = 'replay';

  private minConsistencyThreshold: number;

  constructor(options: { minConsistencyThreshold?: number } = {}) {
    this.minConsistencyThreshold = options.minConsistencyThreshold ?? 0.7;
  }

  async verify(
    input: VerificationInput,
    timeoutMs: number = 2000
  ): Promise<VerificationResult> {
    const start = performance.now();

    try {
      // If no previous result, pass (nothing to compare)
      if (!input.previousResult) {
        return {
          verifier: this.name,
          passed: true,
          confidence: 0.5, // neutral (no baseline)
          reason: 'No previous result available for comparison',
          evidence: {
            hasPrevious: false,
          },
          durationMs: performance.now() - start,
          timestamp: new Date(),
        };
      }

      // Compare current vs. previous
      const consistency = this.computeConsistency(
        input.contextResult,
        input.previousResult
      );

      const passed = consistency >= this.minConsistencyThreshold;

      return {
        verifier: this.name,
        passed,
        confidence: 1.0,
        reason: passed
          ? `Consistent with previous result (${(consistency * 100).toFixed(1)}% similarity)`
          : `Inconsistent with previous result (${(consistency * 100).toFixed(1)}% similarity, threshold: ${(this.minConsistencyThreshold * 100).toFixed(1)}%)`,
        evidence: {
          consistency,
          threshold: this.minConsistencyThreshold,
          currentSummaryLength: input.contextResult.summary.length,
          previousSummaryLength: input.previousResult.summary.length,
          currentAffordanceCount: input.contextResult.affordances.length,
          previousAffordanceCount: input.previousResult.affordances.length,
        },
        durationMs: performance.now() - start,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        verifier: this.name,
        passed: false,
        confidence: 0.5,
        reason: `Replay verification error: ${(error as Error).message}`,
        evidence: {
          error: (error as Error).message,
        },
        durationMs: performance.now() - start,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Compute consistency between current and previous results
   *
   * @param current - current result
   * @param previous - previous result
   * @returns consistency score ∈ [0, 1]
   */
  private computeConsistency(
    current: {
      summary: string[];
      affordances: Array<{ action: string; why: string }>;
    },
    previous: {
      summary: string[];
      affordances: Array<{ action: string; why: string }>;
    }
  ): number {
    // Summary keyword overlap
    const currentSummaryText = current.summary.join(' ').toLowerCase();
    const previousSummaryText = previous.summary.join(' ').toLowerCase();

    const currentKeywords = this.extractKeywords(currentSummaryText);
    const previousKeywords = this.extractKeywords(previousSummaryText);

    const summaryOverlap =
      previousKeywords.size > 0
        ? this.jaccardSimilarity(currentKeywords, previousKeywords)
        : 0.5;

    // Affordance action overlap
    const currentActions = new Set(
      current.affordances.map((a) => a.action.toLowerCase())
    );
    const previousActions = new Set(
      previous.affordances.map((a) => a.action.toLowerCase())
    );

    const affordanceOverlap =
      previousActions.size > 0
        ? this.jaccardSimilarity(currentActions, previousActions)
        : 0.5;

    // Weighted average (summary 60%, affordances 40%)
    return summaryOverlap * 0.6 + affordanceOverlap * 0.4;
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): Set<string> {
    const words = text
      .split(/\s+/)
      .map((w) => w.replace(/[^\w]/g, ''))
      .filter((w) => w.length >= 3);
    return new Set(words);
  }

  /**
   * Jaccard similarity between two sets
   */
  private jaccardSimilarity(a: Set<string>, b: Set<string>): number {
    const intersection = new Set([...a].filter((x) => b.has(x)));
    const union = new Set([...a, ...b]);
    return union.size > 0 ? intersection.size / union.size : 0.0;
  }
}
