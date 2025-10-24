/**
 * Verifier Framework Types
 *
 * Pluggable verification system for context results.
 * All verifiers bounded by timeout, return pass/fail + evidence.
 */

/**
 * Verification result
 */
export interface VerificationResult {
  /**
   * Verifier name
   */
  verifier: string;

  /**
   * Pass/fail status
   */
  passed: boolean;

  /**
   * Confidence in verification ∈ [0, 1]
   */
  confidence: number;

  /**
   * Human-readable reason
   */
  reason: string;

  /**
   * Evidence supporting verification
   */
  evidence: Record<string, unknown>;

  /**
   * Duration in milliseconds
   */
  durationMs: number;

  /**
   * Timestamp
   */
  timestamp: Date;
}

/**
 * Verifier interface
 *
 * All verifiers must implement this interface.
 */
export interface Verifier {
  /**
   * Verifier name (unique identifier)
   */
  readonly name: string;

  /**
   * Verify a context result
   *
   * @param input - verification input
   * @param timeoutMs - max time allowed (default: 2000ms)
   * @returns verification result
   */
  verify(input: VerificationInput, timeoutMs?: number): Promise<VerificationResult>;
}

/**
 * Verification input (common across all verifiers)
 */
export interface VerificationInput {
  /**
   * Context result to verify
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
  };

  /**
   * Optional: expected schema for validation
   */
  expectedSchema?: Record<string, unknown>;

  /**
   * Optional: previous result for replay verification
   */
  previousResult?: {
    summary: string[];
    affordances: Array<{ action: string; why: string }>;
  };
}

/**
 * Verifier configuration
 */
export interface VerifierConfig {
  /**
   * Default timeout for all verifiers (ms)
   */
  defaultTimeoutMs?: number;

  /**
   * Enabled verifiers (if undefined, all are enabled)
   */
  enabledVerifiers?: string[];

  /**
   * Verifier-specific options
   */
  verifierOptions?: Record<string, Record<string, unknown>>;
}

/**
 * Verification suite result
 */
export interface VerificationSuiteResult {
  /**
   * Overall pass/fail (all verifiers must pass)
   */
  passed: boolean;

  /**
   * Individual verifier results
   */
  results: VerificationResult[];

  /**
   * Total duration (ms)
   */
  totalDurationMs: number;

  /**
   * Average confidence across all verifiers
   */
  averageConfidence: number;

  /**
   * Timestamp
   */
  timestamp: Date;
}
