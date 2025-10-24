/**
 * Idempotency Infrastructure
 *
 * Hash-based deduplication for retry directives and decision notices.
 * Prevents duplicate publishes and enforces retry attempt limits.
 */

import crypto from 'crypto';

/**
 * Idempotency key components
 */
export interface IdempotencyKeyParams {
  /**
   * Trace ID for correlation
   */
  trace_id: string;

  /**
   * Task that triggered grading
   */
  task: {
    type: string;
    inputs: Record<string, unknown>;
  };

  /**
   * Retry attempt number (0 = first attempt)
   */
  attempt_no: number;

  /**
   * Sorted reason codes from classification
   */
  reason_codes: string[];
}

/**
 * Idempotency key result
 */
export interface IdempotencyKey {
  /**
   * SHA-256 hash of stable representation
   */
  key: string;

  /**
   * Original trace ID
   */
  trace_id: string;

  /**
   * Attempt number
   */
  attempt_no: number;

  /**
   * Timestamp of key generation
   */
  generated_at: Date;
}

/**
 * Generate idempotency key
 *
 * Deterministic hash based on trace, task, attempt, and reasons.
 * Same inputs always produce same key.
 *
 * @param params - key parameters
 * @returns idempotency key
 */
export function generateIdempotencyKey(
  params: IdempotencyKeyParams
): IdempotencyKey {
  // Create stable JSON representation
  const stable = JSON.stringify({
    trace: params.trace_id,
    task: {
      type: params.task.type,
      inputs: params.task.inputs,
    },
    attempt: params.attempt_no,
    reasons: [...params.reason_codes].sort(), // sort for determinism
  });

  // SHA-256 hash
  const hash = crypto.createHash('sha256').update(stable, 'utf8').digest('hex');

  return {
    key: hash,
    trace_id: params.trace_id,
    attempt_no: params.attempt_no,
    generated_at: new Date(),
  };
}

/**
 * Retry limit configuration
 */
export interface RetryLimitConfig {
  /**
   * Global maximum retry attempts (env: RETRY_MAX_ATTEMPTS)
   */
  maxAttempts: number;

  /**
   * Per-category overrides
   */
  categoryOverrides?: Record<string, number>;
}

/**
 * Default retry limit config
 */
export const DEFAULT_RETRY_LIMIT_CONFIG: RetryLimitConfig = {
  maxAttempts: 3,
  categoryOverrides: {
    POLICY_DEGRADED: 0, // no retries, escalate immediately
    SCHEMA_VIOLATION: 2,
    MISSING_EVIDENCE: 3,
    FLAKY_PATTERN: 2,
    SELECTOR_ISSUE: 2,
    LOW_CONFIDENCE: 2,
    TIMEOUT: 1,
    INCONSISTENT: 2,
    UNKNOWN: 1,
  },
};

/**
 * Retry Limit Guard
 *
 * Enforces retry attempt limits based on category and global config.
 */
export class RetryLimitGuard {
  private config: RetryLimitConfig;

  constructor(config: RetryLimitConfig = DEFAULT_RETRY_LIMIT_CONFIG) {
    this.config = config;
  }

  /**
   * Check if retry is allowed
   *
   * @param params - check parameters
   * @returns true if retry allowed, false if limit exceeded
   */
  isRetryAllowed(params: {
    currentAttempt: number;
    category: string;
  }): boolean {
    const { currentAttempt, category } = params;

    // Check category-specific limit
    const categoryLimit = this.config.categoryOverrides?.[category];
    if (categoryLimit !== undefined && currentAttempt >= categoryLimit) {
      return false;
    }

    // Check global limit
    if (currentAttempt >= this.config.maxAttempts) {
      return false;
    }

    return true;
  }

  /**
   * Get remaining retry attempts
   *
   * @param params - check parameters
   * @returns number of retries remaining
   */
  getRemainingAttempts(params: {
    currentAttempt: number;
    category: string;
  }): number {
    const { currentAttempt, category } = params;

    // Get effective limit
    const categoryLimit = this.config.categoryOverrides?.[category];
    const effectiveLimit =
      categoryLimit !== undefined
        ? Math.min(categoryLimit, this.config.maxAttempts)
        : this.config.maxAttempts;

    return Math.max(0, effectiveLimit - currentAttempt);
  }

  /**
   * Get effective max attempts for category
   *
   * @param category - error category
   * @returns max attempts allowed
   */
  getMaxAttempts(category: string): number {
    const categoryLimit = this.config.categoryOverrides?.[category];
    return categoryLimit !== undefined
      ? Math.min(categoryLimit, this.config.maxAttempts)
      : this.config.maxAttempts;
  }
}

/**
 * Idempotency violation error
 */
export class IdempotencyViolationError extends Error {
  constructor(
    public readonly idempotencyKey: string,
    public readonly existingMessageId: string
  ) {
    super(
      `Idempotency violation: key ${idempotencyKey} already processed as ${existingMessageId}`
    );
    this.name = 'IdempotencyViolationError';
  }
}

/**
 * Retry limit exceeded error
 */
export class RetryLimitExceededError extends Error {
  constructor(
    public readonly currentAttempt: number,
    public readonly maxAttempts: number,
    public readonly category: string
  ) {
    super(
      `Retry limit exceeded: attempt ${currentAttempt} >= max ${maxAttempts} for category ${category}`
    );
    this.name = 'RetryLimitExceededError';
  }
}
