/**
 * Decision Loop
 *
 * Main orchestrator: QScore → Verify → Decide (Accept/Retry/Escalate)
 * Pure decision logic, all I/O bounded in activities.
 */

import { QScoreCalculator } from './qscore/calculator.js';
import type { QScoreInput, QScoreResult, QScoreConfig } from './qscore/types.js';
import { VerificationSuite } from './verifiers/suite.js';
import type {
  Verifier,
  VerificationInput,
  VerificationSuiteResult,
  VerifierConfig,
} from './verifiers/types.js';
import { ErrorClassifier } from './policy/taxonomy.js';
import type { ErrorClassification } from './policy/taxonomy.js';
import { RetryPolicy } from './policy/retry.js';
import type { RetryDecision, RetryPolicyConfig } from './policy/retry.js';

/**
 * Decision result
 */
export enum DecisionOutcome {
  /**
   * Accept result (quality sufficient)
   */
  ACCEPT = 'ACCEPT',

  /**
   * Retry with adjustments
   */
  RETRY = 'RETRY',

  /**
   * Escalate to human
   */
  ESCALATE = 'ESCALATE',
}

/**
 * Decision loop input
 */
export interface DecisionInput {
  /**
   * Context result from specialist
   */
  contextResult: {
    summary: string[];
    affordances: Array<{ action: string; why: string }>;
    explain?: Record<string, unknown>;
  };

  /**
   * Original task
   */
  task: {
    type: string;
    inputs: Record<string, unknown>;
  };

  /**
   * Metadata
   */
  metadata: {
    specialist_id: string;
    message_id: string;
    retry_depth: number;
    total_latency_ms: number;
    schema_valid: boolean;
  };

  /**
   * Optional: previous result for consistency check
   */
  previousResult?: {
    summary: string[];
    affordances: Array<{ action: string; why: string }>;
    score: number;
  };

  /**
   * Optional: expected schema
   */
  expectedSchema?: Record<string, unknown>;
}

/**
 * Decision loop result
 */
export interface DecisionResult {
  /**
   * Final decision
   */
  outcome: DecisionOutcome;

  /**
   * QScore result
   */
  qscore: QScoreResult;

  /**
   * Verification suite result
   */
  verification: VerificationSuiteResult;

  /**
   * Error classification (if failed)
   */
  classification?: ErrorClassification;

  /**
   * Retry decision (if RETRY outcome)
   */
  retryDecision?: RetryDecision;

  /**
   * Human-readable summary
   */
  summary: string;

  /**
   * Timestamp
   */
  timestamp: Date;
}

/**
 * Decision loop configuration
 */
export interface DecisionLoopConfig {
  /**
   * QScore threshold for accept (0-1)
   */
  acceptThreshold?: number;

  /**
   * QScore configuration
   */
  qscoreConfig?: QScoreConfig;

  /**
   * Verifier configuration
   */
  verifierConfig?: VerifierConfig;

  /**
   * Retry policy configuration
   */
  retryPolicyConfig?: RetryPolicyConfig;
}

/**
 * Decision Loop
 *
 * Orchestrates QScore → Verify → Classify → Decide
 */
export class DecisionLoop {
  private acceptThreshold: number;
  private qscoreCalculator: QScoreCalculator;
  private verificationSuite: VerificationSuite;
  private errorClassifier: ErrorClassifier;
  private retryPolicy: RetryPolicy;

  constructor(
    verifiers: Verifier[],
    config: DecisionLoopConfig = {}
  ) {
    this.acceptThreshold = config.acceptThreshold ?? 0.7;
    this.qscoreCalculator = new QScoreCalculator(config.qscoreConfig);
    this.verificationSuite = new VerificationSuite(verifiers, config.verifierConfig);
    this.errorClassifier = new ErrorClassifier();
    this.retryPolicy = new RetryPolicy(config.retryPolicyConfig);
  }

  /**
   * Run decision loop
   *
   * @param input - decision input
   * @returns decision result
   */
  async decide(input: DecisionInput): Promise<DecisionResult> {
    const timestamp = new Date();

    // Step 1: Compute QScore
    const qscoreInput: QScoreInput = {
      contextResult: input.contextResult,
      task: input.task,
      metadata: input.metadata,
      previousResult: input.previousResult,
    };

    const qscore = this.qscoreCalculator.compute(qscoreInput);

    // Step 2: Run verifiers
    const verificationInput: VerificationInput = {
      contextResult: input.contextResult,
      task: input.task,
      metadata: input.metadata,
      expectedSchema: input.expectedSchema,
      previousResult: input.previousResult,
    };

    const verification = await this.verificationSuite.verify(verificationInput);

    // Step 3: Decide based on QScore and verifications
    const allPassed = verification.passed && qscore.calibrated >= this.acceptThreshold;

    if (allPassed) {
      // Accept
      return {
        outcome: DecisionOutcome.ACCEPT,
        qscore,
        verification,
        summary: `Result accepted: QScore ${(qscore.calibrated * 100).toFixed(1)}% (threshold: ${(this.acceptThreshold * 100).toFixed(1)}%), all verifiers passed`,
        timestamp,
      };
    }

    // Step 4: Classify error
    const classification = this.errorClassifier.classify({
      verificationResults: verification.results,
      qscoreSignals: qscore.signals,
      qscoreValue: qscore.calibrated,
      contextResult: input.contextResult,
    });

    // Step 5: Decide retry or escalate
    const retryDecision = this.retryPolicy.decide({
      category: classification.category,
      currentRetryDepth: input.metadata.retry_depth,
      currentSpecialist: input.metadata.specialist_id,
      categoryConfidence: classification.confidence,
    });

    // Map retry action to outcome
    const outcome =
      retryDecision.action === 'ESCALATE'
        ? DecisionOutcome.ESCALATE
        : DecisionOutcome.RETRY;

    const summary =
      outcome === DecisionOutcome.RETRY
        ? `Retry recommended: ${classification.category} (${retryDecision.reason})`
        : `Escalate: ${classification.category} (${retryDecision.reason})`;

    return {
      outcome,
      qscore,
      verification,
      classification,
      retryDecision,
      summary,
      timestamp,
    };
  }

  /**
   * Batch decide
   *
   * @param inputs - array of decision inputs
   * @returns array of decision results
   */
  async decideBatch(inputs: DecisionInput[]): Promise<DecisionResult[]> {
    return Promise.all(inputs.map((input) => this.decide(input)));
  }

  /**
   * Get current configuration
   */
  getConfig(): {
    acceptThreshold: number;
    verifierNames: string[];
  } {
    return {
      acceptThreshold: this.acceptThreshold,
      verifierNames: this.verificationSuite.getVerifierNames(),
    };
  }
}
