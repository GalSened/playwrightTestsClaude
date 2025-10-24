/**
 * H4R Explainer
 *
 * Generates human-readable explanations for ranking decisions
 */

import type { H4RResult, SignalScores } from './types.js';

/**
 * Explainability output
 */
export interface ExplainOutput {
  /**
   * Result ID
   */
  id: string;

  /**
   * Final score
   */
  score: number;

  /**
   * Per-signal breakdown
   */
  signals: SignalScores;

  /**
   * Decision
   */
  reason: 'kept' | 'dropped';

  /**
   * Threshold (if dropped)
   */
  threshold?: number;

  /**
   * Human-readable explanation
   */
  explanation: string;

  /**
   * Top contributing signals (sorted by value)
   */
  topSignals: Array<{ name: string; value: number; contribution: number }>;

  /**
   * Weakest signals (bottom 3)
   */
  weakestSignals: Array<{ name: string; value: number }>;
}

/**
 * Generate detailed explainability for results
 */
export function explainResults(
  results: H4RResult[],
  weights: Record<string, number>
): ExplainOutput[] {
  return results.map((result) => {
    // Calculate weighted contributions
    const signalContributions = Object.entries(result.signals).map(
      ([name, value]) => ({
        name,
        value,
        contribution: value * (weights[name] || 0),
      })
    );

    // Sort by contribution (descending)
    const sortedByContribution = [...signalContributions].sort(
      (a, b) => b.contribution - a.contribution
    );

    // Sort by value (ascending for weakest)
    const sortedByValue = [...signalContributions].sort(
      (a, b) => a.value - b.value
    );

    return {
      id: result.id,
      score: result.score,
      signals: result.signals,
      reason: result.reason,
      threshold: result.threshold,
      explanation: result.explanation,
      topSignals: sortedByContribution.slice(0, 3),
      weakestSignals: sortedByValue.slice(0, 3).map((s) => ({
        name: s.name,
        value: s.value,
      })),
    };
  });
}

/**
 * Generate summary statistics for a set of results
 */
export interface ExplainSummary {
  /**
   * Total candidates evaluated
   */
  total: number;

  /**
   * Kept results
   */
  kept: number;

  /**
   * Dropped results
   */
  dropped: number;

  /**
   * Score statistics
   */
  scoreStats: {
    min: number;
    max: number;
    mean: number;
    median: number;
  };

  /**
   * Average signal values
   */
  avgSignals: Partial<SignalScores>;
}

/**
 * Summarize results for analysis
 */
export function summarizeResults(results: H4RResult[]): ExplainSummary {
  if (results.length === 0) {
    return {
      total: 0,
      kept: 0,
      dropped: 0,
      scoreStats: { min: 0, max: 0, mean: 0, median: 0 },
      avgSignals: {},
    };
  }

  const kept = results.filter((r) => r.reason === 'kept').length;
  const scores = results.map((r) => r.score).sort((a, b) => a - b);

  // Calculate average for each signal
  const signalSums: Partial<Record<keyof SignalScores, number>> = {};
  for (const result of results) {
    for (const [key, value] of Object.entries(result.signals)) {
      signalSums[key as keyof SignalScores] =
        (signalSums[key as keyof SignalScores] || 0) + value;
    }
  }

  const avgSignals: Partial<SignalScores> = {};
  for (const [key, sum] of Object.entries(signalSums)) {
    avgSignals[key as keyof SignalScores] = sum / results.length;
  }

  return {
    total: results.length,
    kept,
    dropped: results.length - kept,
    scoreStats: {
      min: scores[0],
      max: scores[scores.length - 1],
      mean: scores.reduce((a, b) => a + b, 0) / scores.length,
      median: scores[Math.floor(scores.length / 2)],
    },
    avgSignals,
  };
}
