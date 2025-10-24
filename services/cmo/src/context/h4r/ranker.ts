/**
 * Multi-Signal Ranker
 *
 * Combines 8 signals into final relevance score
 */

import type { H4RCandidate, H4RResult, SignalScores, SignalWeights } from './types.js';
import { calculateRecency } from './signals/recency.js';
import { calculateFrequency } from './signals/frequency.js';
import { calculateImportance } from './signals/importance.js';
import { calculateCausality } from './signals/causality.js';
import { calculateNoveltyInverse } from './signals/novelty.js';
import { calculateTrust } from './signals/trust.js';
import { calculateSensitivityInverse } from './signals/sensitivity.js';

/**
 * Default signal weights (must sum to 1.0)
 */
export const DEFAULT_WEIGHTS: SignalWeights = {
  recency: 0.25,
  frequency: 0.15,
  importance: 0.20,
  causality: 0.15,
  noveltyInverse: 0.10,
  trust: 0.10,
  sensitivityInverse: 0.05,
};

/**
 * Ranker configuration
 */
export interface RankerConfig {
  /**
   * Signal weights (partial, will be merged with defaults)
   */
  weights?: Partial<SignalWeights>;

  /**
   * Minimum score threshold
   */
  minScore?: number;

  /**
   * Recency decay lambda
   */
  recencyDecayLambda?: number;

  /**
   * Max expected access count (for frequency normalization)
   */
  maxExpectedAccess?: number;

  /**
   * Current time (for testing)
   */
  now?: Date;
}

/**
 * Multi-signal ranker
 */
export class Ranker {
  private weights: SignalWeights;
  private config: Required<RankerConfig>;

  constructor(config: RankerConfig = {}) {
    // Merge with defaults
    this.weights = { ...DEFAULT_WEIGHTS, ...config.weights };

    // Validate weights sum to ~1.0 (allow small floating point error)
    const sum = Object.values(this.weights).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1.0) > 0.01) {
      throw new Error(
        `Signal weights must sum to 1.0, got ${sum.toFixed(3)}`
      );
    }

    this.config = {
      weights: this.weights,
      minScore: config.minScore ?? 0.0,
      recencyDecayLambda: config.recencyDecayLambda ?? 0.1,
      maxExpectedAccess: config.maxExpectedAccess ?? 100,
      now: config.now ?? new Date(),
    };
  }

  /**
   * Calculate signal scores for a candidate
   */
  private calculateSignals(candidate: H4RCandidate): SignalScores {
    const { metadata } = candidate;
    const { now, recencyDecayLambda, maxExpectedAccess } = this.config;

    return {
      recency: calculateRecency(
        metadata.createdAt,
        recencyDecayLambda,
        now
      ),
      frequency: calculateFrequency(
        metadata.accessCount,
        maxExpectedAccess
      ),
      importance: calculateImportance(metadata.importance),
      causality: calculateCausality(
        // TODO: Extract causal distance from metadata or graph
        null
      ),
      noveltyInverse: calculateNoveltyInverse(
        metadata.createdAt,
        metadata.accessCount,
        now
      ),
      trust: calculateTrust(metadata.trust),
      sensitivityInverse: calculateSensitivityInverse(metadata.sensitivity),
    };
  }

  /**
   * Calculate weighted final score
   */
  private calculateFinalScore(signals: SignalScores): number {
    return (
      signals.recency * this.weights.recency +
      signals.frequency * this.weights.frequency +
      signals.importance * this.weights.importance +
      signals.causality * this.weights.causality +
      signals.noveltyInverse * this.weights.noveltyInverse +
      signals.trust * this.weights.trust +
      signals.sensitivityInverse * this.weights.sensitivityInverse
    );
  }

  /**
   * Generate explanation for ranking decision
   */
  private generateExplanation(
    signals: SignalScores,
    finalScore: number,
    reason: 'kept' | 'dropped',
    threshold?: number
  ): string {
    const topSignals = Object.entries(signals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 3)
      .map((s) => `${s.name}=${s.value.toFixed(2)}`)
      .join(', ');

    if (reason === 'kept') {
      return `Score ${finalScore.toFixed(3)} (top signals: ${topSignals})`;
    } else {
      return `Score ${finalScore.toFixed(3)} below threshold ${threshold?.toFixed(3)} (top signals: ${topSignals})`;
    }
  }

  /**
   * Rank a single candidate
   */
  rank(candidate: H4RCandidate): H4RResult {
    const signals = this.calculateSignals(candidate);
    const score = this.calculateFinalScore(signals);
    const reason: 'kept' | 'dropped' =
      score >= this.config.minScore ? 'kept' : 'dropped';

    return {
      ...candidate,
      score,
      signals,
      reason,
      threshold: reason === 'dropped' ? this.config.minScore : undefined,
      explanation: this.generateExplanation(
        signals,
        score,
        reason,
        this.config.minScore
      ),
    };
  }

  /**
   * Rank multiple candidates and sort by score (descending)
   */
  rankAll(candidates: H4RCandidate[]): H4RResult[] {
    return candidates
      .map((c) => this.rank(c))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Rank and filter by threshold
   */
  rankAndFilter(candidates: H4RCandidate[]): H4RResult[] {
    return this.rankAll(candidates).filter((r) => r.reason === 'kept');
  }
}
