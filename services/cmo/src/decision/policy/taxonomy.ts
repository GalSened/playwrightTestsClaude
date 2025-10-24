/**
 * Error Taxonomy
 *
 * Classification system for retry routing decisions.
 * Maps failure modes to retry strategies.
 */

/**
 * Error taxonomy categories
 */
export enum ErrorCategory {
  /**
   * Schema validation failure
   * Strategy: retry with schema hints
   */
  SCHEMA_VIOLATION = 'SCHEMA_VIOLATION',

  /**
   * Missing or insufficient evidence
   * Strategy: retry with expanded context
   */
  MISSING_EVIDENCE = 'MISSING_EVIDENCE',

  /**
   * Flaky test pattern detected
   * Strategy: retry with stability-focused specialist
   */
  FLAKY_PATTERN = 'FLAKY_PATTERN',

  /**
   * Selector issue (element not found)
   * Strategy: retry with selector-healing specialist
   */
  SELECTOR_ISSUE = 'SELECTOR_ISSUE',

  /**
   * Policy degradation (security/privacy violation)
   * Strategy: escalate to human
   */
  POLICY_DEGRADED = 'POLICY_DEGRADED',

  /**
   * Low confidence result
   * Strategy: retry with different specialist or parameters
   */
  LOW_CONFIDENCE = 'LOW_CONFIDENCE',

  /**
   * Timeout or performance issue
   * Strategy: retry with performance-optimized specialist
   */
  TIMEOUT = 'TIMEOUT',

  /**
   * Inconsistency with previous result
   * Strategy: retry with consistency-enforcing specialist
   */
  INCONSISTENT = 'INCONSISTENT',

  /**
   * Unknown/unclassified error
   * Strategy: escalate
   */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Error classification result
 */
export interface ErrorClassification {
  /**
   * Primary category
   */
  category: ErrorCategory;

  /**
   * Confidence in classification ∈ [0, 1]
   */
  confidence: number;

  /**
   * Human-readable reason
   */
  reason: string;

  /**
   * Evidence supporting classification
   */
  evidence: Record<string, unknown>;
}

/**
 * Error Classifier
 *
 * Maps verification failures and QScore signals to taxonomy categories.
 */
export class ErrorClassifier {
  /**
   * Classify error based on verification results and QScore
   *
   * @param params - classification inputs
   * @returns error classification
   */
  classify(params: {
    verificationResults?: Array<{
      verifier: string;
      passed: boolean;
      reason: string;
      evidence: Record<string, unknown>;
    }>;
    qscoreSignals?: Record<string, number>;
    qscoreValue?: number;
    contextResult?: {
      summary: string[];
      affordances: Array<{ action: string; why: string }>;
    };
  }): ErrorClassification {
    const { verificationResults, qscoreSignals, qscoreValue, contextResult } = params;

    // Priority 1: Verification failures
    if (verificationResults) {
      for (const result of verificationResults) {
        if (!result.passed) {
          // Schema verifier failed
          if (result.verifier === 'schema') {
            return {
              category: ErrorCategory.SCHEMA_VIOLATION,
              confidence: 1.0,
              reason: result.reason,
              evidence: result.evidence,
            };
          }

          // Replay verifier failed (inconsistency)
          if (result.verifier === 'replay') {
            return {
              category: ErrorCategory.INCONSISTENT,
              confidence: 0.9,
              reason: result.reason,
              evidence: result.evidence,
            };
          }

          // Smoke verifier failed
          if (result.verifier === 'smoke') {
            // Parse smoke failure details
            const failures = result.evidence.failures as string[] | undefined;
            if (failures) {
              if (failures.some((f) => f.includes('Too few summary items'))) {
                return {
                  category: ErrorCategory.MISSING_EVIDENCE,
                  confidence: 0.8,
                  reason: 'Insufficient evidence in result',
                  evidence: result.evidence,
                };
              }
              if (failures.some((f) => f.includes('Forbidden pattern'))) {
                return {
                  category: ErrorCategory.UNKNOWN,
                  confidence: 0.7,
                  reason: 'Suspicious content in result',
                  evidence: result.evidence,
                };
              }
            }
          }
        }
      }
    }

    // Priority 2: QScore signals
    if (qscoreSignals) {
      // Policy degraded
      if (qscoreSignals.policyOk !== undefined && qscoreSignals.policyOk < 0.5) {
        return {
          category: ErrorCategory.POLICY_DEGRADED,
          confidence: 1.0,
          reason: 'Policy compliance check failed',
          evidence: { signal: 'policyOk', value: qscoreSignals.policyOk },
        };
      }

      // Low confidence
      if (
        qscoreSignals.resultConfidence !== undefined &&
        qscoreSignals.resultConfidence < 0.3
      ) {
        return {
          category: ErrorCategory.LOW_CONFIDENCE,
          confidence: 0.9,
          reason: 'Specialist result has low confidence',
          evidence: {
            signal: 'resultConfidence',
            value: qscoreSignals.resultConfidence,
          },
        };
      }

      // Timeout/performance issue
      if (qscoreSignals.latencyNorm !== undefined && qscoreSignals.latencyNorm < 0.2) {
        return {
          category: ErrorCategory.TIMEOUT,
          confidence: 0.8,
          reason: 'Response latency exceeded acceptable threshold',
          evidence: { signal: 'latencyNorm', value: qscoreSignals.latencyNorm },
        };
      }

      // Missing evidence
      if (
        qscoreSignals.evidenceCoverage !== undefined &&
        qscoreSignals.evidenceCoverage < 0.4
      ) {
        return {
          category: ErrorCategory.MISSING_EVIDENCE,
          confidence: 0.8,
          reason: 'Insufficient evidence coverage',
          evidence: {
            signal: 'evidenceCoverage',
            value: qscoreSignals.evidenceCoverage,
          },
        };
      }
    }

    // Priority 3: Content analysis
    if (contextResult) {
      const summaryText = contextResult.summary.join(' ').toLowerCase();

      // Flaky pattern detection
      if (
        summaryText.includes('intermittent') ||
        summaryText.includes('flaky') ||
        summaryText.includes('sometimes passes')
      ) {
        return {
          category: ErrorCategory.FLAKY_PATTERN,
          confidence: 0.7,
          reason: 'Flaky test behavior detected in summary',
          evidence: { summaryKeywords: ['flaky', 'intermittent'] },
        };
      }

      // Selector issues
      if (
        summaryText.includes('selector') ||
        summaryText.includes('not found') ||
        summaryText.includes('element')
      ) {
        return {
          category: ErrorCategory.SELECTOR_ISSUE,
          confidence: 0.6,
          reason: 'Selector-related issues detected in summary',
          evidence: { summaryKeywords: ['selector', 'not found'] },
        };
      }
    }

    // Priority 4: Low overall QScore
    if (qscoreValue !== undefined && qscoreValue < 0.5) {
      return {
        category: ErrorCategory.LOW_CONFIDENCE,
        confidence: 0.7,
        reason: `Overall QScore below threshold (${(qscoreValue * 100).toFixed(1)}%)`,
        evidence: { qscore: qscoreValue },
      };
    }

    // Default: unknown
    return {
      category: ErrorCategory.UNKNOWN,
      confidence: 0.5,
      reason: 'Unable to classify error based on available signals',
      evidence: {},
    };
  }
}
