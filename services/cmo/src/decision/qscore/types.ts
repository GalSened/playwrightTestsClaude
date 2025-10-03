/**
 * QScore Types
 *
 * Pure, deterministic quality scoring for CMO decision loop.
 * All signals normalized to [0, 1] range.
 */

/**
 * Raw signals computed from context result and metadata
 * All values ∈ [0, 1]
 */
export interface QScoreSignals {
  /**
   * Result confidence: how confident is the specialist in this result?
   * Derived from: explanation length, affordance count, evidence diversity
   */
  resultConfidence: number;

  /**
   * Policy compliance: did SCS pass policy checks?
   * 1.0 if policy OK, 0.0 if degraded
   */
  policyOk: number;

  /**
   * Schema validation: does result match expected schema?
   * 1.0 if valid, 0.0 if invalid
   */
  schemaOk: number;

  /**
   * Evidence coverage: how well does evidence support the conclusion?
   * Derived from: TL;DR items vs. affordances ratio
   */
  evidenceCoverage: number;

  /**
   * Affordance alignment: do affordances match task inputs?
   * Derived from: keyword overlap between task and affordances
   */
  affordanceAlignment: number;

  /**
   * Latency normalization: was response fast? (inverted)
   * 1.0 if < 500ms, decays to 0.0 at 5000ms
   */
  latencyNorm: number;

  /**
   * Retry depth penalty: penalize repeated retries (inverted)
   * 1.0 if depth=0, decays exponentially
   */
  retryDepthPenalty: number;

  /**
   * Consistency with previous: does result align with prior runs? (if available)
   * 1.0 if consistent, 0.0 if contradictory, 0.5 if no prior
   */
  consistencyPrev: number;
}

/**
 * Weights for signal fusion (must sum to 1.0)
 */
export interface QScoreWeights {
  resultConfidence: number;
  policyOk: number;
  schemaOk: number;
  evidenceCoverage: number;
  affordanceAlignment: number;
  latencyNorm: number;
  retryDepthPenalty: number;
  consistencyPrev: number;
}

/**
 * Default weights (production baseline)
 */
export const DEFAULT_WEIGHTS: QScoreWeights = {
  resultConfidence: 0.25,
  policyOk: 0.20,
  schemaOk: 0.15,
  evidenceCoverage: 0.15,
  affordanceAlignment: 0.10,
  latencyNorm: 0.05,
  retryDepthPenalty: 0.05,
  consistencyPrev: 0.05,
};

/**
 * QScore computation result
 */
export interface QScoreResult {
  /**
   * Raw score from weighted fusion ∈ [0, 1]
   */
  score: number;

  /**
   * Individual signal values
   */
  signals: QScoreSignals;

  /**
   * Calibrated score (after isotonic/Platt adjustment) ∈ [0, 1]
   */
  calibrated: number;

  /**
   * Human-readable explanation of score
   */
  explanation: string;

  /**
   * Weights used for fusion
   */
  weights: QScoreWeights;

  /**
   * Timestamp of computation
   */
  timestamp: Date;
}

/**
 * Inputs for QScore computation
 */
export interface QScoreInput {
  /**
   * Context result from specialist
   */
  contextResult: {
    summary: string[];
    affordances: Array<{ action: string; why: string }>;
    explain?: {
      slicing?: {
        policy_degraded?: boolean;
      };
      timings?: {
        retrieval_ms?: number;
        slicing_ms?: number;
      };
    };
  };

  /**
   * Task metadata
   */
  task: {
    type: string;
    inputs: Record<string, unknown>;
  };

  /**
   * Response metadata
   */
  metadata: {
    specialist_id: string;
    retry_depth: number;
    total_latency_ms: number;
    schema_valid: boolean;
  };

  /**
   * Previous result for consistency check (optional)
   */
  previousResult?: {
    summary: string[];
    affordances: Array<{ action: string; why: string }>;
    score: number;
  };
}

/**
 * Calibration table entry (for isotonic/Platt calibration)
 */
export interface CalibrationTableEntry {
  /**
   * Raw score bin lower bound
   */
  rawScoreMin: number;

  /**
   * Raw score bin upper bound
   */
  rawScoreMax: number;

  /**
   * Calibrated score for this bin
   */
  calibratedScore: number;
}

/**
 * Calibration table (sorted by rawScoreMin ascending)
 */
export type CalibrationTable = CalibrationTableEntry[];

/**
 * Default calibration table (identity mapping, no adjustment)
 */
export const DEFAULT_CALIBRATION_TABLE: CalibrationTable = [
  { rawScoreMin: 0.0, rawScoreMax: 0.1, calibratedScore: 0.05 },
  { rawScoreMin: 0.1, rawScoreMax: 0.2, calibratedScore: 0.15 },
  { rawScoreMin: 0.2, rawScoreMax: 0.3, calibratedScore: 0.25 },
  { rawScoreMin: 0.3, rawScoreMax: 0.4, calibratedScore: 0.35 },
  { rawScoreMin: 0.4, rawScoreMax: 0.5, calibratedScore: 0.45 },
  { rawScoreMin: 0.5, rawScoreMax: 0.6, calibratedScore: 0.55 },
  { rawScoreMin: 0.6, rawScoreMax: 0.7, calibratedScore: 0.65 },
  { rawScoreMin: 0.7, rawScoreMax: 0.8, calibratedScore: 0.75 },
  { rawScoreMin: 0.8, rawScoreMax: 0.9, calibratedScore: 0.85 },
  { rawScoreMin: 0.9, rawScoreMax: 1.0, calibratedScore: 0.95 },
];

/**
 * QScore configuration
 */
export interface QScoreConfig {
  /**
   * Signal weights (must sum to 1.0)
   */
  weights?: QScoreWeights;

  /**
   * Calibration table
   */
  calibrationTable?: CalibrationTable;

  /**
   * Include detailed explanation in result
   */
  includeExplanation?: boolean;
}
