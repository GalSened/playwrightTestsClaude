/**
 * A2A Inbound Message Handler
 * Generic handler for incoming A2A envelopes with routing, middleware, and error handling
 */

import type { A2AEnvelope } from '../envelopes/types.js';
import type { OPAWireGates } from '../middleware/opa-wire-gates.js';
import type { IdempotencyGuard } from '../middleware/idempotency.js';
import type { TransportAdapter } from '../../elg/transport/index.js';
import { validateEnvelope } from '../envelopes/index.js';
import { createAndPublish } from '../topics/routing.js';
import { generateMessageId } from '../security/signer.js';

/**
 * Envelope handler function
 *
 * Processes an envelope and optionally returns a response envelope
 */
export type EnvelopeHandler = (
  envelope: A2AEnvelope
) => Promise<A2AEnvelope | void>;

/**
 * Inbound handler configuration
 */
export interface InboundHandlerConfig {
  /**
   * Transport adapter for publishing responses
   */
  transport: TransportAdapter;

  /**
   * Agent ID (for response envelopes)
   */
  agentId: {
    type: string;
    id: string;
    version: string;
  };

  /**
   * Tenant identifier
   */
  tenant: string;

  /**
   * Project identifier
   */
  project: string;

  /**
   * OPA wire gates (optional)
   */
  opaGates?: OPAWireGates;

  /**
   * Idempotency guard (optional)
   */
  idempotencyGuard?: IdempotencyGuard;

  /**
   * Error handler (optional)
   */
  onError?: (envelope: A2AEnvelope, error: Error) => Promise<void>;

  /**
   * Validate envelopes before processing (default: true)
   */
  validateEnvelopes?: boolean;

  /**
   * Publish error responses (default: true)
   */
  publishErrorResponses?: boolean;
}

/**
 * A2A Inbound Handler
 *
 * Routes incoming A2A envelopes to type-specific handlers with middleware support
 */
export class InboundHandler {
  private config: InboundHandlerConfig;
  private handlers: Map<string, EnvelopeHandler> = new Map();
  private defaultHandler?: EnvelopeHandler;

  constructor(config: InboundHandlerConfig) {
    this.config = {
      validateEnvelopes: true,
      publishErrorResponses: true,
      ...config,
    };
  }

  /**
   * Register a handler for a specific envelope type
   *
   * @param type - Envelope type (e.g., 'TaskRequest', 'SpecialistInvocationRequest')
   * @param handler - Handler function
   */
  on(type: string, handler: EnvelopeHandler): void {
    this.handlers.set(type, handler);
  }

  /**
   * Register a default handler for unmatched envelope types
   *
   * @param handler - Default handler function
   */
  onDefault(handler: EnvelopeHandler): void {
    this.defaultHandler = handler;
  }

  /**
   * Handle an incoming envelope
   *
   * Applies middleware, routes to appropriate handler, and publishes response
   *
   * @param envelope - Incoming envelope
   * @returns Response envelope (if any)
   */
  async handle(envelope: A2AEnvelope): Promise<A2AEnvelope | void> {
    try {
      // Step 1: Validate envelope
      if (this.config.validateEnvelopes !== false) {
        const result = validateEnvelope(envelope);
        if (!result.valid) {
          throw new Error(
            `Invalid envelope: ${result.errors?.map((e) => e.message).join(', ')}`
          );
        }
      }

      // Step 2: OPA post-receive check
      if (this.config.opaGates) {
        await this.config.opaGates.checkOrThrow(envelope, 'receive');
      }

      // Step 3: Idempotency check
      if (this.config.idempotencyGuard) {
        const checkResult = await this.config.idempotencyGuard.check(envelope);

        if (checkResult.isDuplicate) {
          // Return cached response if available
          if (checkResult.cachedResponse) {
            return checkResult.cachedResponse;
          }

          // Otherwise, skip processing
          return;
        }
      }

      // Step 4: Route to handler
      const handler = this.handlers.get(envelope.meta.type) || this.defaultHandler;

      if (!handler) {
        throw new Error(`No handler registered for envelope type: ${envelope.meta.type}`);
      }

      const response = await handler(envelope);

      // Step 5: Record idempotency (if guard is enabled and response exists)
      if (this.config.idempotencyGuard && response) {
        await this.config.idempotencyGuard.record(envelope, response);
      }

      // Step 6: Publish response (if exists and has reply_to)
      if (response && envelope.meta.reply_to) {
        await this.publishResponse(envelope, response);
      }

      return response;
    } catch (error) {
      // Handle errors
      await this.handleError(envelope, error as Error);
    }
  }

  /**
   * Publish a response envelope
   */
  private async publishResponse(
    originalEnvelope: A2AEnvelope,
    responseEnvelope: A2AEnvelope
  ): Promise<void> {
    // Ensure response has correlation_id
    if (!responseEnvelope.meta.correlation_id) {
      responseEnvelope.meta.correlation_id =
        originalEnvelope.meta.correlation_id || originalEnvelope.meta.message_id;
    }

    // Ensure response has reply_to topic
    const replyTopic = originalEnvelope.meta.reply_to;
    if (!replyTopic) {
      return; // No reply_to, skip publishing
    }

    // Publish response
    await createAndPublish(
      {
        ...responseEnvelope.meta,
        message_id: generateMessageId(),
        ts: new Date().toISOString(),
        from: this.config.agentId,
        to: [{ type: 'topic', name: replyTopic }],
      },
      responseEnvelope.payload,
      {
        transport: this.config.transport,
        validate: true,
      }
    );
  }

  /**
   * Handle errors during envelope processing
   */
  private async handleError(envelope: A2AEnvelope, error: Error): Promise<void> {
    // Call error handler if provided
    if (this.config.onError) {
      await this.config.onError(envelope, error);
    }

    // Log error
    console.error('Inbound handler error:', {
      message_id: envelope.meta.message_id,
      trace_id: envelope.meta.trace_id,
      type: envelope.meta.type,
      error: error.message,
      stack: error.stack,
    });

    // Publish error response if enabled
    if (this.config.publishErrorResponses !== false && envelope.meta.reply_to) {
      await this.publishErrorResponse(envelope, error);
    }
  }

  /**
   * Publish an error response envelope
   */
  private async publishErrorResponse(
    originalEnvelope: A2AEnvelope,
    error: Error
  ): Promise<void> {
    const errorEnvelope: A2AEnvelope = {
      meta: {
        a2a_version: '1.0',
        message_id: generateMessageId(),
        trace_id: originalEnvelope.meta.trace_id,
        ts: new Date().toISOString(),
        from: this.config.agentId,
        to: [{ type: 'topic', name: originalEnvelope.meta.reply_to! }],
        tenant: this.config.tenant,
        project: this.config.project,
        type: 'TaskResult',
        correlation_id:
          originalEnvelope.meta.correlation_id || originalEnvelope.meta.message_id,
      },
      payload: {
        task: (originalEnvelope.payload as any).task || 'unknown',
        status: 'failure',
        error: {
          message: error.message,
          code: (error as any).code || 'PROCESSING_ERROR',
          details: {
            original_type: originalEnvelope.meta.type,
            stack: error.stack,
          },
        },
      },
    };

    try {
      await createAndPublish(
        errorEnvelope.meta,
        errorEnvelope.payload,
        {
          transport: this.config.transport,
          validate: true,
        }
      );
    } catch (publishError) {
      console.error('Failed to publish error response:', publishError);
    }
  }

  /**
   * Get all registered handler types
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Check if a handler is registered for a type
   */
  hasHandler(type: string): boolean {
    return this.handlers.has(type) || this.defaultHandler !== undefined;
  }
}

/**
 * Create an inbound handler
 *
 * @param config - Handler configuration
 * @returns Inbound handler instance
 */
export function createInboundHandler(config: InboundHandlerConfig): InboundHandler {
  return new InboundHandler(config);
}

/**
 * Example usage:
 *
 * ```typescript
 * const handler = createInboundHandler({
 *   transport: redisTransport,
 *   agentId: { type: 'cmo', id: 'cmo-main', version: '1.0.0' },
 *   tenant: 'wesign',
 *   project: 'frontend',
 *   opaGates: opaWireGates,
 *   idempotencyGuard: idempotencyGuard,
 * });
 *
 * // Register handlers for specific envelope types
 * handler.on('TaskRequest', async (envelope) => {
 *   const request = envelope.payload as TaskRequest['payload'];
 *   // Process task...
 *   return {
 *     meta: { ...envelope.meta, type: 'TaskResult' },
 *     payload: { task: request.task, status: 'success', result: {...} }
 *   };
 * });
 *
 * handler.on('ContextRequest', async (envelope) => {
 *   // Handle context retrieval...
 *   return contextResultEnvelope;
 * });
 *
 * // Subscribe to A2A topics
 * await transport.subscribe('qa.wesign.frontend.cmo.*', async (message, ack) => {
 *   const envelope = JSON.parse(message.payload.toString());
 *   await handler.handle(envelope);
 *   await ack.ack();
 * });
 * ```
 */
