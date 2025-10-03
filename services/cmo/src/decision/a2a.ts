/**
 * A2A Integration
 *
 * Converts decision loop results to A2A message payloads.
 * DecisionNotice: notifies outcomes
 * RetryDirective: instructs retries with context delta
 */

import type { DecisionResult, DecisionInput } from './loop.js';

/**
 * Decision Notice payload (sent to orchestrator/ELG)
 */
export interface DecisionNoticePayload {
  decision: 'ACCEPT' | 'RETRY' | 'ESCALATE';
  qscore: {
    score: number;
    calibrated: number;
    signals: {
      resultConfidence: number;
      policyOk: number;
      schemaOk: number;
      evidenceCoverage: number;
      affordanceAlignment: number;
      latencyNorm: number;
      retryDepthPenalty: number;
      consistencyPrev: number;
    };
    explanation: string;
  };
  verification_summary: {
    passed: boolean;
    verifiers_run: string[];
    average_confidence: number;
    failures?: Array<{ verifier: string; reason: string }>;
  };
  classification?: {
    category: string;
    confidence: number;
    reason: string;
  };
  retry_decision?: {
    action: string;
    target_specialist: string;
    context_delta?: {
      expand_budget?: number;
      add_hints?: string[];
      include_schema?: boolean;
    };
    max_retries: number;
    reason: string;
  };
  summary: string;
  timestamp: string;
}

/**
 * Retry Directive payload (sent to target specialist)
 */
export interface RetryDirectivePayload {
  retry_depth: number;
  target_specialist: string;
  original_task: {
    type: string;
    inputs: Record<string, unknown>;
  };
  previous_result?: {
    summary: string[];
    affordances: Array<{ action: string; why: string }>;
    qscore: number;
  };
  failure_reason: {
    category: string;
    explanation: string;
    evidence: Record<string, unknown>;
  };
  context_adjustments: {
    budget_delta?: {
      expand_bytes?: number;
      expand_tokens?: number;
      expand_items?: number;
    };
    additional_hints?: string[];
    include_schema?: boolean;
    expected_schema?: Record<string, unknown>;
    focus_areas?: string[];
  };
  max_retries_remaining: number;
  deadline: string;
  metadata: {
    original_message_id: string;
    retry_sequence_id: string;
    correlation_id: string;
  };
}

/**
 * Convert DecisionResult to DecisionNotice payload
 *
 * @param result - decision result
 * @returns DecisionNotice payload
 */
export function toDecisionNotice(result: DecisionResult): DecisionNoticePayload {
  const payload: DecisionNoticePayload = {
    decision: result.outcome,
    qscore: {
      score: result.qscore.score,
      calibrated: result.qscore.calibrated,
      signals: result.qscore.signals,
      explanation: result.qscore.explanation,
    },
    verification_summary: {
      passed: result.verification.passed,
      verifiers_run: result.verification.results.map((r) => r.verifier),
      average_confidence: result.verification.averageConfidence,
      failures: result.verification.results
        .filter((r) => !r.passed)
        .map((r) => ({ verifier: r.verifier, reason: r.reason })),
    },
    summary: result.summary,
    timestamp: result.timestamp.toISOString(),
  };

  if (result.classification) {
    payload.classification = {
      category: result.classification.category,
      confidence: result.classification.confidence,
      reason: result.classification.reason,
    };
  }

  if (result.retryDecision) {
    payload.retry_decision = {
      action: result.retryDecision.action,
      target_specialist: result.retryDecision.targetSpecialist ?? '',
      context_delta: result.retryDecision.contextDelta,
      max_retries: result.retryDecision.maxRetries,
      reason: result.retryDecision.reason,
    };
  }

  return payload;
}

/**
 * Convert DecisionResult + DecisionInput to RetryDirective payload
 *
 * @param result - decision result (must be RETRY outcome)
 * @param input - original decision input
 * @param messageIds - message IDs for tracing
 * @returns RetryDirective payload
 */
export function toRetryDirective(
  result: DecisionResult,
  input: DecisionInput,
  messageIds: {
    originalMessageId: string;
    retrySequenceId: string;
    correlationId: string;
  }
): RetryDirectivePayload {
  if (!result.retryDecision) {
    throw new Error('Cannot create RetryDirective without retry decision');
  }

  const { retryDecision, classification } = result;

  // Map context delta to budget expansion
  const budgetDelta = retryDecision.contextDelta?.expandBudget
    ? {
        expand_bytes: retryDecision.contextDelta.expandBudget,
        expand_tokens: Math.ceil(retryDecision.contextDelta.expandBudget / 4),
        expand_items: 5,
      }
    : undefined;

  // Generate focus areas from classification
  const focusAreas: string[] = [];
  if (classification) {
    switch (classification.category) {
      case 'SCHEMA_VIOLATION':
        focusAreas.push('schema compliance', 'field validation');
        break;
      case 'MISSING_EVIDENCE':
        focusAreas.push('evidence depth', 'citation quality');
        break;
      case 'FLAKY_PATTERN':
        focusAreas.push('stability', 'deterministic patterns');
        break;
      case 'SELECTOR_ISSUE':
        focusAreas.push('selector robustness', 'data-testid usage');
        break;
      case 'LOW_CONFIDENCE':
        focusAreas.push('result confidence', 'evidence quality');
        break;
      case 'INCONSISTENT':
        focusAreas.push('consistency with previous', 'result stability');
        break;
    }
  }

  // Calculate deadline (e.g., 60 seconds from now)
  const deadline = new Date(Date.now() + 60000).toISOString();

  return {
    retry_depth: input.metadata.retry_depth + 1,
    target_specialist: retryDecision.targetSpecialist ?? input.metadata.specialist_id,
    original_task: {
      type: input.task.type,
      inputs: input.task.inputs,
    },
    previous_result: input.previousResult
      ? {
          summary: input.previousResult.summary,
          affordances: input.previousResult.affordances,
          qscore: input.previousResult.score,
        }
      : {
          summary: input.contextResult.summary,
          affordances: input.contextResult.affordances,
          qscore: result.qscore.calibrated,
        },
    failure_reason: {
      category: classification?.category ?? 'UNKNOWN',
      explanation: classification?.reason ?? 'Unknown failure',
      evidence: classification?.evidence ?? {},
    },
    context_adjustments: {
      budget_delta: budgetDelta,
      additional_hints: retryDecision.contextDelta?.addHints,
      include_schema: retryDecision.contextDelta?.includeSchema,
      expected_schema: input.expectedSchema,
      focus_areas: focusAreas.length > 0 ? focusAreas : undefined,
    },
    max_retries_remaining: retryDecision.maxRetries - (input.metadata.retry_depth + 1),
    deadline,
    metadata: messageIds,
  };
}
