/**
 * QScore Signal Functions
 *
 * Pure, deterministic signal computation.
 * All functions return values ∈ [0, 1]
 */

import type { QScoreInput } from './types.js';

/**
 * Signal 1: Result Confidence
 *
 * Measures specialist confidence based on:
 * - Summary length (longer = more evidence)
 * - Affordance count (more actions = higher confidence)
 * - Evidence diversity (varied sources)
 *
 * @param input - QScore input
 * @returns confidence ∈ [0, 1]
 */
export function computeResultConfidence(input: QScoreInput): number {
  const { contextResult } = input;

  // Summary contribution (0-0.5)
  const summaryCount = contextResult.summary.length;
  const summaryScore = Math.min(summaryCount / 10, 0.5); // cap at 10 items

  // Affordance contribution (0-0.3)
  const affordanceCount = contextResult.affordances.length;
  const affordanceScore = Math.min(affordanceCount / 5, 0.3); // cap at 5 affordances

  // Evidence diversity (0-0.2)
  // Estimate by unique first words in summary items
  const uniqueStarts = new Set(
    contextResult.summary.map((s) => s.split(' ')[0]?.toLowerCase() ?? '')
  ).size;
  const diversityScore = Math.min(uniqueStarts / 5, 0.2); // cap at 5 unique

  return Math.min(summaryScore + affordanceScore + diversityScore, 1.0);
}

/**
 * Signal 2: Policy Compliance
 *
 * Binary signal: did SCS pass policy checks?
 *
 * @param input - QScore input
 * @returns 1.0 if policy OK, 0.0 if degraded
 */
export function computePolicyOk(input: QScoreInput): number {
  const policyDegraded = input.contextResult.explain?.slicing?.policy_degraded ?? false;
  return policyDegraded ? 0.0 : 1.0;
}

/**
 * Signal 3: Schema Validation
 *
 * Binary signal: does result match expected schema?
 *
 * @param input - QScore input
 * @returns 1.0 if valid, 0.0 if invalid
 */
export function computeSchemaOk(input: QScoreInput): number {
  return input.metadata.schema_valid ? 1.0 : 0.0;
}

/**
 * Signal 4: Evidence Coverage
 *
 * Measures how well evidence supports conclusion.
 * Ratio of summary items to affordances (expect 2-3 evidence per action).
 *
 * @param input - QScore input
 * @returns coverage ∈ [0, 1]
 */
export function computeEvidenceCoverage(input: QScoreInput): number {
  const { contextResult } = input;

  const summaryCount = contextResult.summary.length;
  const affordanceCount = Math.max(contextResult.affordances.length, 1); // avoid div by 0

  // Ideal ratio: 2-3 evidence per affordance
  const ratio = summaryCount / affordanceCount;

  if (ratio < 1.0) {
    // Too little evidence
    return ratio; // linear penalty below 1.0
  } else if (ratio >= 2.0 && ratio <= 3.0) {
    // Ideal range
    return 1.0;
  } else if (ratio > 3.0) {
    // Too much evidence (diminishing returns)
    return Math.max(1.0 - (ratio - 3.0) * 0.1, 0.5); // decay slowly
  } else {
    // 1.0 < ratio < 2.0
    return 0.5 + (ratio - 1.0) * 0.5; // linear growth to 1.0 at ratio=2.0
  }
}

/**
 * Signal 5: Affordance Alignment
 *
 * Measures overlap between task inputs and affordance keywords.
 * Extract keywords from task inputs and check presence in affordance text.
 *
 * @param input - QScore input
 * @returns alignment ∈ [0, 1]
 */
export function computeAffordanceAlignment(input: QScoreInput): number {
  const { task, contextResult } = input;

  // Extract keywords from task inputs
  const taskText = JSON.stringify(task.inputs).toLowerCase();
  const taskKeywords = extractKeywords(taskText);

  if (taskKeywords.size === 0) {
    return 0.5; // neutral if no task keywords
  }

  // Extract keywords from affordances
  const affordanceText = contextResult.affordances
    .map((a) => `${a.action} ${a.why}`)
    .join(' ')
    .toLowerCase();
  const affordanceKeywords = extractKeywords(affordanceText);

  // Calculate overlap
  const intersection = new Set(
    [...taskKeywords].filter((k) => affordanceKeywords.has(k))
  );

  const overlapRatio = intersection.size / taskKeywords.size;
  return overlapRatio;
}

/**
 * Signal 6: Latency Normalization
 *
 * Penalizes slow responses. Fast is good, slow is bad.
 * - < 500ms → 1.0
 * - 500-5000ms → linear decay
 * - > 5000ms → 0.0
 *
 * @param input - QScore input
 * @returns latency score ∈ [0, 1] (inverted, higher is better)
 */
export function computeLatencyNorm(input: QScoreInput): number {
  const latencyMs = input.metadata.total_latency_ms;

  if (latencyMs < 500) {
    return 1.0;
  } else if (latencyMs > 5000) {
    return 0.0;
  } else {
    // Linear decay from 1.0 at 500ms to 0.0 at 5000ms
    return 1.0 - (latencyMs - 500) / 4500;
  }
}

/**
 * Signal 7: Retry Depth Penalty
 *
 * Penalizes repeated retries. Fresh results are better.
 * - depth 0 → 1.0
 * - depth 1 → 0.7
 * - depth 2 → 0.4
 * - depth 3+ → 0.1
 *
 * @param input - QScore input
 * @returns penalty ∈ [0, 1] (inverted, higher is better)
 */
export function computeRetryDepthPenalty(input: QScoreInput): number {
  const depth = input.metadata.retry_depth;

  if (depth === 0) return 1.0;
  if (depth === 1) return 0.7;
  if (depth === 2) return 0.4;
  return 0.1; // depth >= 3
}

/**
 * Signal 8: Consistency with Previous
 *
 * Measures similarity with previous result (if available).
 * - High overlap → 1.0 (consistent)
 * - Low overlap → 0.0 (contradictory)
 * - No previous → 0.5 (neutral)
 *
 * @param input - QScore input
 * @returns consistency ∈ [0, 1]
 */
export function computeConsistencyPrev(input: QScoreInput): number {
  const { previousResult } = input;

  if (!previousResult) {
    return 0.5; // neutral if no previous result
  }

  // Compare summaries (keyword overlap)
  const currentSummary = input.contextResult.summary.join(' ').toLowerCase();
  const previousSummary = previousResult.summary.join(' ').toLowerCase();

  const currentKeywords = extractKeywords(currentSummary);
  const previousKeywords = extractKeywords(previousSummary);

  if (previousKeywords.size === 0) {
    return 0.5; // neutral if previous had no keywords
  }

  const intersection = new Set(
    [...currentKeywords].filter((k) => previousKeywords.has(k))
  );

  const overlapRatio = intersection.size / previousKeywords.size;

  // Also consider affordance overlap
  const currentActions = new Set(
    input.contextResult.affordances.map((a) => a.action.toLowerCase())
  );
  const previousActions = new Set(
    previousResult.affordances.map((a) => a.action.toLowerCase())
  );

  const actionIntersection = new Set(
    [...currentActions].filter((a) => previousActions.has(a))
  );

  const actionOverlap =
    previousActions.size > 0 ? actionIntersection.size / previousActions.size : 0.5;

  // Average summary and action overlap
  return (overlapRatio + actionOverlap) / 2;
}

/**
 * Helper: Extract keywords from text
 *
 * Simple keyword extraction: split on whitespace, remove short words, dedupe.
 *
 * @param text - input text
 * @returns set of keywords
 */
function extractKeywords(text: string): Set<string> {
  const words = text
    .split(/\s+/)
    .map((w) => w.replace(/[^\w]/g, '')) // remove punctuation
    .filter((w) => w.length >= 3); // keep words >= 3 chars

  return new Set(words);
}
