/**
 * Idempotency Guard Middleware
 * Prevents duplicate processing of A2A envelopes using Postgres-backed storage
 */

import type { PostgresCheckpointer } from '../../elg/checkpointer/postgres.js';
import type { A2AEnvelope } from '../envelopes/types.js';
import { createHash } from 'crypto';

/**
 * Idempotency guard configuration
 */
export interface IdempotencyConfig {
  /**
   * Postgres checkpointer instance (uses cmo_activities table)
   */
  checkpointer: PostgresCheckpointer;

  /**
   * Trace ID for grouping idempotency keys (optional, defaults to envelope trace_id)
   */
  traceId?: string;

  /**
   * Step index for grouping idempotency keys (optional, defaults to 0)
   */
  stepIndex?: number;

  /**
   * TTL for idempotency records in seconds (optional, no cleanup if not set)
   * Note: Actual cleanup is handled by checkpointer retention policies
   */
  ttlSeconds?: number;
}

/**
 * Idempotency check result
 */
export interface IdempotencyCheckResult {
  /**
   * Whether this envelope has been processed before
   */
  isDuplicate: boolean;

  /**
   * Cached response (if duplicate and response was stored)
   */
  cachedResponse?: A2AEnvelope;

  /**
   * Cached error (if duplicate and processing failed)
   */
  cachedError?: {
    message: string;
    code?: string;
  };

  /**
   * When the original processing occurred
   */
  originalTimestamp?: Date;
}

/**
 * Idempotency Guard
 *
 * Uses Postgres checkpointer's cmo_activities table to track processed envelopes
 * and prevent duplicate processing based on idempotency keys.
 */
export class IdempotencyGuard {
  private config: IdempotencyConfig;

  constructor(config: IdempotencyConfig) {
    this.config = config;
  }

  /**
   * Check if an envelope has been processed before
   *
   * @param envelope - Envelope to check
   * @returns Check result with cached data if duplicate
   */
  async check(envelope: A2AEnvelope): Promise<IdempotencyCheckResult> {
    const idempotencyKey = this.getIdempotencyKey(envelope);
    if (!idempotencyKey) {
      return { isDuplicate: false };
    }

    const traceId = this.config.traceId || envelope.meta.trace_id;
    const stepIndex = this.config.stepIndex ?? 0;

    // Query cmo_activities table
    const activity = await this.config.checkpointer.getActivity(
      traceId,
      stepIndex,
      'a2a',
      idempotencyKey
    );

    if (!activity) {
      return { isDuplicate: false };
    }

    // Found duplicate
    return {
      isDuplicate: true,
      cachedResponse: activity.responseData
        ? (activity.responseData as A2AEnvelope)
        : undefined,
      cachedError: activity.error,
      originalTimestamp: new Date(), // cmo_activities doesn't store timestamp separately, would need to add
    };
  }

  /**
   * Record successful processing of an envelope
   *
   * @param envelope - Original envelope
   * @param response - Response envelope (optional)
   */
  async record(envelope: A2AEnvelope, response?: A2AEnvelope): Promise<void> {
    const idempotencyKey = this.getIdempotencyKey(envelope);
    if (!idempotencyKey) {
      return;
    }

    const traceId = this.config.traceId || envelope.meta.trace_id;
    const stepIndex = this.config.stepIndex ?? 0;

    await this.config.checkpointer.saveActivity(
      traceId,
      stepIndex,
      'a2a',
      idempotencyKey,
      this.envelopeToRequestData(envelope),
      response ? this.envelopeToResponseData(response) : undefined,
      undefined, // responseBlobRef (for large payloads, not used here)
      new Date().toISOString(),
      undefined, // durationMs (not tracked here)
      undefined // error (none)
    );
  }

  /**
   * Record failed processing of an envelope
   *
   * @param envelope - Original envelope
   * @param error - Error that occurred
   */
  async recordError(envelope: A2AEnvelope, error: Error): Promise<void> {
    const idempotencyKey = this.getIdempotencyKey(envelope);
    if (!idempotencyKey) {
      return;
    }

    const traceId = this.config.traceId || envelope.meta.trace_id;
    const stepIndex = this.config.stepIndex ?? 0;

    await this.config.checkpointer.saveActivity(
      traceId,
      stepIndex,
      'a2a',
      idempotencyKey,
      this.envelopeToRequestData(envelope),
      undefined, // responseData (none)
      undefined, // responseBlobRef
      new Date().toISOString(),
      undefined, // durationMs
      {
        message: error.message,
        stack: error.stack,
      }
    );
  }

  /**
   * Check and throw if duplicate
   *
   * @param envelope - Envelope to check
   * @throws IdempotencyViolationError if duplicate
   */
  async checkOrThrow(envelope: A2AEnvelope): Promise<void> {
    const result = await this.check(envelope);

    if (result.isDuplicate) {
      throw new IdempotencyViolationError(envelope, result);
    }
  }

  /**
   * Get idempotency key from envelope
   *
   * Prefers envelope.meta.idempotency_key, falls back to message_id
   */
  private getIdempotencyKey(envelope: A2AEnvelope): string | null {
    if (envelope.meta.idempotency_key) {
      return envelope.meta.idempotency_key;
    }

    // Fallback: generate key from message_id
    if (envelope.meta.message_id) {
      return this.hashMessageId(envelope.meta.message_id);
    }

    return null;
  }

  /**
   * Hash message_id for use as idempotency key
   */
  private hashMessageId(messageId: string): string {
    return createHash('sha256').update(messageId).digest('hex');
  }

  /**
   * Convert envelope to request data for storage
   */
  private envelopeToRequestData(envelope: A2AEnvelope): any {
    return {
      message_id: envelope.meta.message_id,
      trace_id: envelope.meta.trace_id,
      type: envelope.meta.type,
      from: envelope.meta.from,
      to: envelope.meta.to,
      ts: envelope.meta.ts,
    };
  }

  /**
   * Convert envelope to response data for storage
   */
  private envelopeToResponseData(envelope: A2AEnvelope): any {
    return {
      message_id: envelope.meta.message_id,
      type: envelope.meta.type,
      status: (envelope.payload as any).status,
      // Store minimal response data to avoid bloat
    };
  }
}

/**
 * Idempotency Violation Error
 */
export class IdempotencyViolationError extends Error {
  public readonly envelope: A2AEnvelope;
  public readonly checkResult: IdempotencyCheckResult;

  constructor(envelope: A2AEnvelope, checkResult: IdempotencyCheckResult) {
    super(`Duplicate envelope detected: ${envelope.meta.message_id}`);
    this.name = 'IdempotencyViolationError';
    this.envelope = envelope;
    this.checkResult = checkResult;
  }
}

/**
 * Create idempotency guard
 *
 * @param config - Idempotency configuration
 * @returns Idempotency guard instance
 */
export function createIdempotencyGuard(
  config: IdempotencyConfig
): IdempotencyGuard {
  return new IdempotencyGuard(config);
}

/**
 * Idempotency middleware for transport layers
 *
 * Provides helper functions for integrating idempotency checks into transport subscribe handlers
 */
export class IdempotencyMiddleware {
  constructor(private guard: IdempotencyGuard) {}

  /**
   * Wrap a message handler with idempotency check
   *
   * Returns cached response if duplicate, otherwise calls handler and records result
   *
   * @param handler - Original handler
   * @returns Wrapped handler with idempotency
   */
  wrap(
    handler: (envelope: A2AEnvelope) => Promise<A2AEnvelope | void>
  ): (envelope: A2AEnvelope) => Promise<A2AEnvelope | void> {
    return async (envelope: A2AEnvelope) => {
      // Check for duplicate
      const checkResult = await this.guard.check(envelope);

      if (checkResult.isDuplicate) {
        // Return cached response if available
        if (checkResult.cachedResponse) {
          return checkResult.cachedResponse;
        }

        // Throw cached error if available
        if (checkResult.cachedError) {
          const error = new Error(checkResult.cachedError.message);
          (error as any).code = checkResult.cachedError.code;
          throw error;
        }

        // Duplicate but no cached data (should not happen)
        throw new IdempotencyViolationError(envelope, checkResult);
      }

      // Process envelope
      try {
        const response = await handler(envelope);

        // Record success
        await this.guard.record(
          envelope,
          response as A2AEnvelope | undefined
        );

        return response;
      } catch (error) {
        // Record error
        await this.guard.recordError(envelope, error as Error);
        throw error;
      }
    };
  }

  /**
   * Get the underlying guard
   */
  getGuard(): IdempotencyGuard {
    return this.guard;
  }
}

/**
 * Create idempotency middleware
 *
 * @param config - Idempotency configuration
 * @returns Idempotency middleware instance
 */
export function createIdempotencyMiddleware(
  config: IdempotencyConfig
): IdempotencyMiddleware {
  const guard = new IdempotencyGuard(config);
  return new IdempotencyMiddleware(guard);
}
