/**
 * QScore Calculator
 *
 * Main entry point for QScore computation.
 * Pure, deterministic, no side effects.
 */

import type {
  QScoreInput,
  QScoreResult,
  QScoreConfig,
  QScoreSignals,
  QScoreWeights,
  CalibrationTable,
} from './types.js';
import {
  DEFAULT_WEIGHTS,
  DEFAULT_CALIBRATION_TABLE,
} from './types.js';
import {
  computeResultConfidence,
  computePolicyOk,
  computeSchemaOk,
  computeEvidenceCoverage,
  computeAffordanceAlignment,
  computeLatencyNorm,
  computeRetryDepthPenalty,
  computeConsistencyPrev,
} from './signals.js';

/**
 * QScore Calculator
 *
 * Computes quality score from context result and metadata.
 */
export class QScoreCalculator {
  private weights: QScoreWeights;
  private calibrationTable: CalibrationTable;
  private includeExplanation: boolean;

  constructor(config: QScoreConfig = {}) {
    this.weights = config.weights ?? DEFAULT_WEIGHTS;
    this.calibrationTable = config.calibrationTable ?? DEFAULT_CALIBRATION_TABLE;
    this.includeExplanation = config.includeExplanation ?? true;

    // Validate weights sum to 1.0
    const weightSum = Object.values(this.weights).reduce((a, b) => a + b, 0);
    if (Math.abs(weightSum - 1.0) > 0.001) {
      throw new Error(
        `QScore weights must sum to 1.0 (got ${weightSum.toFixed(3)})`
      );
    }

    // Validate calibration table is sorted (touching boundaries are OK)
    for (let i = 1; i < this.calibrationTable.length; i++) {
      if (
        this.calibrationTable[i]!.rawScoreMin <
        this.calibrationTable[i - 1]!.rawScoreMax
      ) {
        throw new Error(
          'Calibration table must be sorted and non-overlapping'
        );
      }
    }
  }

  /**
   * Compute QScore from input
   *
   * @param input - QScore input
   * @returns QScore result
   */
  compute(input: QScoreInput): QScoreResult {
    // Compute all signals
    const signals: QScoreSignals = {
      resultConfidence: computeResultConfidence(input),
      policyOk: computePolicyOk(input),
      schemaOk: computeSchemaOk(input),
      evidenceCoverage: computeEvidenceCoverage(input),
      affordanceAlignment: computeAffordanceAlignment(input),
      latencyNorm: computeLatencyNorm(input),
      retryDepthPenalty: computeRetryDepthPenalty(input),
      consistencyPrev: computeConsistencyPrev(input),
    };

    // Weighted fusion
    const rawScore = this.fuseSignals(signals);

    // Calibration
    const calibratedScore = this.calibrate(rawScore);

    // Explanation
    const explanation = this.includeExplanation
      ? this.generateExplanation(signals, rawScore, calibratedScore)
      : '';

    return {
      score: rawScore,
      signals,
      calibrated: calibratedScore,
      explanation,
      weights: this.weights,
      timestamp: new Date(),
    };
  }

  /**
   * Fuse signals using weighted sum
   *
   * @param signals - individual signals
   * @returns raw score ∈ [0, 1]
   */
  private fuseSignals(signals: QScoreSignals): number {
    const score =
      signals.resultConfidence * this.weights.resultConfidence +
      signals.policyOk * this.weights.policyOk +
      signals.schemaOk * this.weights.schemaOk +
      signals.evidenceCoverage * this.weights.evidenceCoverage +
      signals.affordanceAlignment * this.weights.affordanceAlignment +
      signals.latencyNorm * this.weights.latencyNorm +
      signals.retryDepthPenalty * this.weights.retryDepthPenalty +
      signals.consistencyPrev * this.weights.consistencyPrev;

    // Clamp to [0, 1]
    return Math.max(0.0, Math.min(1.0, score));
  }

  /**
   * Calibrate raw score using lookup table
   *
   * @param rawScore - raw score from fusion
   * @returns calibrated score ∈ [0, 1]
   */
  private calibrate(rawScore: number): number {
    // Find matching bin
    for (const entry of this.calibrationTable) {
      if (rawScore >= entry.rawScoreMin && rawScore <= entry.rawScoreMax) {
        return entry.calibratedScore;
      }
    }

    // Fallback: return raw score if no match
    return rawScore;
  }

  /**
   * Generate human-readable explanation
   *
   * @param signals - individual signals
   * @param rawScore - raw score
   * @param calibratedScore - calibrated score
   * @returns explanation string
   */
  private generateExplanation(
    signals: QScoreSignals,
    rawScore: number,
    calibratedScore: number
  ): string {
    const parts: string[] = [];

    parts.push(
      `QScore: ${(calibratedScore * 100).toFixed(1)}% (raw: ${(rawScore * 100).toFixed(1)}%)`
    );

    // Identify top contributing signals
    const contributions = [
      { name: 'result_confidence', value: signals.resultConfidence, weight: this.weights.resultConfidence },
      { name: 'policy_ok', value: signals.policyOk, weight: this.weights.policyOk },
      { name: 'schema_ok', value: signals.schemaOk, weight: this.weights.schemaOk },
      { name: 'evidence_coverage', value: signals.evidenceCoverage, weight: this.weights.evidenceCoverage },
      { name: 'affordance_alignment', value: signals.affordanceAlignment, weight: this.weights.affordanceAlignment },
      { name: 'latency_norm', value: signals.latencyNorm, weight: this.weights.latencyNorm },
      { name: 'retry_depth_penalty', value: signals.retryDepthPenalty, weight: this.weights.retryDepthPenalty },
      { name: 'consistency_prev', value: signals.consistencyPrev, weight: this.weights.consistencyPrev },
    ];

    // Sort by weighted contribution
    contributions.sort((a, b) => (b.value * b.weight) - (a.value * a.weight));

    // Top 3 signals
    parts.push('Top signals:');
    for (let i = 0; i < Math.min(3, contributions.length); i++) {
      const c = contributions[i]!;
      parts.push(
        `  - ${c.name}: ${(c.value * 100).toFixed(1)}% (weight: ${(c.weight * 100).toFixed(0)}%)`
      );
    }

    // Weaknesses (signals < 0.5)
    const weaknesses = contributions.filter((c) => c.value < 0.5);
    if (weaknesses.length > 0) {
      parts.push('Weaknesses:');
      for (const w of weaknesses) {
        parts.push(
          `  - ${w.name}: ${(w.value * 100).toFixed(1)}%`
        );
      }
    }

    return parts.join('\n');
  }

  /**
   * Batch compute QScores
   *
   * @param inputs - array of inputs
   * @returns array of results
   */
  computeBatch(inputs: QScoreInput[]): QScoreResult[] {
    return inputs.map((input) => this.compute(input));
  }
}

/**
 * Convenience function: compute QScore with default config
 *
 * @param input - QScore input
 * @returns QScore result
 */
export function computeQScore(input: QScoreInput): QScoreResult {
  const calculator = new QScoreCalculator();
  return calculator.compute(input);
}
