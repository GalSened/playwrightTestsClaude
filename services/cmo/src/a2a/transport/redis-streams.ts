/**
 * Redis Streams A2A Transport Wrapper
 * Wraps existing RedisStreamsTransport with A2A-specific envelope validation and idempotency
 */

import type { RedisStreamsConfig } from '../../elg/transport/redis-streams.js';
import { RedisStreamsAdapter } from '../../elg/transport/redis-streams.js';
import type { TransportAdapter, MessageHandler, Subscription } from '../../elg/transport/index.js';
import type { A2AEnvelope } from '../envelopes/types.js';
import { validateEnvelope, isValidEnvelope } from '../envelopes/index.js';
import type { PublishOptions } from '../topics/routing.js';

/**
 * Redis A2A Transport Configuration
 */
export interface RedisA2ATransportConfig extends RedisStreamsConfig {
  /**
   * Validate envelopes on publish (default: true)
   */
  validateOnPublish?: boolean;

  /**
   * Validate envelopes on subscribe (default: true)
   */
  validateOnSubscribe?: boolean;

  /**
   * Reject invalid envelopes to DLQ (default: true)
   */
  rejectInvalidToDLQ?: boolean;
}

/**
 * Redis A2A Transport Adapter
 *
 * Provides A2A-specific features on top of the base Redis Streams transport:
 * - Automatic envelope validation on publish/subscribe
 * - Idempotency (delegates to checkpointer's cmo_activities table)
 * - DLQ for invalid envelopes
 * - Backpressure (inherited from base transport)
 */
export class RedisA2ATransport {
  private transport: TransportAdapter;
  private config: RedisA2ATransportConfig;

  constructor(config: RedisA2ATransportConfig) {
    this.config = {
      validateOnPublish: true,
      validateOnSubscribe: true,
      rejectInvalidToDLQ: true,
      ...config,
    };

    // Create base Redis transport
    this.transport = new RedisStreamsAdapter(config);
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    await this.transport.connect();
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    await this.transport.disconnect();
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.transport.isConnected();
  }

  /**
   * Publish an A2A envelope to a topic
   *
   * @param topic - Topic to publish to
   * @param envelope - A2A envelope to publish
   * @param options - Publish options
   * @returns Message ID
   */
  async publish(
    topic: string,
    envelope: A2AEnvelope,
    options?: PublishOptions
  ): Promise<string> {
    // Validate envelope (if enabled)
    if (this.config.validateOnPublish !== false) {
      const result = validateEnvelope(envelope);
      if (!result.valid) {
        throw new Error(
          `Invalid A2A envelope: ${result.errors?.map((e) => e.message).join(', ')}`
        );
      }
    }

    // Serialize envelope to bytes
    const payload = Buffer.from(JSON.stringify(envelope), 'utf-8');

    // Extract metadata from envelope
    const publishOptions = {
      ...options,
      traceId: envelope.meta.trace_id,
      source: envelope.meta.from.id,
      correlationId: envelope.meta.correlation_id,
      headers: {
        a2a_version: envelope.meta.a2a_version,
        message_id: envelope.meta.message_id,
        type: envelope.meta.type,
        tenant: envelope.meta.tenant,
        project: envelope.meta.project,
        ...(envelope.meta.idempotency_key && {
          idempotency_key: envelope.meta.idempotency_key,
        }),
      },
    };

    // Publish through base transport
    return this.transport.publish(topic, payload, publishOptions);
  }

  /**
   * Subscribe to A2A envelopes on a topic
   *
   * @param topic - Topic pattern to subscribe to
   * @param handler - A2A message handler
   * @param options - Subscribe options
   * @returns Subscription handle
   */
  async subscribe(
    topic: string,
    handler: A2AMessageHandler,
    options?: A2ASubscribeOptions
  ): Promise<Subscription> {
    // Wrap handler to deserialize and validate envelopes
    const wrappedHandler: MessageHandler = async (message, ack) => {
      try {
        // Deserialize envelope
        const json = message.payload.toString();
        const envelope = JSON.parse(json) as A2AEnvelope;

        // Validate envelope (if enabled)
        if (this.config.validateOnSubscribe !== false) {
          const result = validateEnvelope(envelope);

          if (!result.valid) {
            const error = new Error(
              `Invalid A2A envelope: ${result.errors?.map((e) => e.message).join(', ')}`
            );

            // Reject to DLQ if enabled
            if (this.config.rejectInvalidToDLQ !== false) {
              await ack.reject(`Validation failed: ${error.message}`);
            } else {
              await ack.nack(`Validation failed: ${error.message}`);
            }

            return;
          }
        }

        // Check idempotency (if handler provides idempotency check)
        if (options?.checkIdempotency && envelope.meta.idempotency_key) {
          const isDuplicate = await options.checkIdempotency(envelope.meta.idempotency_key);
          if (isDuplicate) {
            // Acknowledge without processing (idempotent)
            await ack.ack();
            return;
          }
        }

        // Call A2A handler
        await handler(envelope, ack);

        // Record idempotency (if handler provides record function)
        if (options?.recordIdempotency && envelope.meta.idempotency_key) {
          await options.recordIdempotency(envelope.meta.idempotency_key);
        }
      } catch (error) {
        console.error('A2A handler error:', error);

        // Reject to DLQ on handler errors
        await ack.reject(error instanceof Error ? error.message : 'Unknown error');
      }
    };

    // Subscribe through base transport
    return this.transport.subscribe(topic, wrappedHandler, {
      consumerGroup: options?.consumerGroup,
      consumerName: options?.consumerName,
      autoAck: false, // Always manual ACK for A2A
    });
  }

  /**
   * Request/response pattern for A2A
   *
   * @param topic - Topic to send request to
   * @param envelope - Request envelope
   * @param options - Publish options
   * @param timeout - Timeout in milliseconds (default: 30000)
   * @returns Response envelope
   */
  async request(
    topic: string,
    envelope: A2AEnvelope,
    options?: PublishOptions,
    timeout: number = 30000
  ): Promise<A2AEnvelope> {
    // Serialize envelope
    const payload = Buffer.from(JSON.stringify(envelope), 'utf-8');

    // Send request through base transport
    const responseMessage = await this.transport.request(
      topic,
      payload,
      {
        ...options,
        traceId: envelope.meta.trace_id,
        correlationId: envelope.meta.correlation_id || envelope.meta.message_id,
      },
      timeout
    );

    // Deserialize response
    const json = responseMessage.payload.toString();
    const responseEnvelope = JSON.parse(json) as A2AEnvelope;

    // Validate response (if enabled)
    if (this.config.validateOnSubscribe !== false) {
      const result = validateEnvelope(responseEnvelope);
      if (!result.valid) {
        throw new Error(
          `Invalid response envelope: ${result.errors?.map((e) => e.message).join(', ')}`
        );
      }
    }

    return responseEnvelope;
  }

  /**
   * Get the underlying transport adapter
   * (for direct access to advanced features)
   */
  getTransport(): TransportAdapter {
    return this.transport;
  }

  /**
   * Get transport stats
   */
  async getStats() {
    return this.transport.getStats();
  }

  /**
   * Health check
   */
  async healthCheck() {
    return this.transport.healthCheck();
  }

  /**
   * Create a topic
   */
  async createTopic(topic: string): Promise<void> {
    await this.transport.createTopic(topic);
  }

  /**
   * Delete a topic
   */
  async deleteTopic(topic: string): Promise<void> {
    await this.transport.deleteTopic(topic);
  }

  /**
   * Purge a topic (remove all messages)
   */
  async purgeTopic(topic: string): Promise<void> {
    await this.transport.purgeTopic(topic);
  }
}

/**
 * A2A message handler (receives validated envelopes)
 */
export type A2AMessageHandler = (
  envelope: A2AEnvelope,
  ack: {
    messageId: string;
    ack: () => Promise<void>;
    nack: (reason?: string) => Promise<void>;
    reject: (reason?: string) => Promise<void>;
  }
) => Promise<void>;

/**
 * A2A subscribe options
 */
export interface A2ASubscribeOptions {
  /**
   * Consumer group name (for load balancing)
   */
  consumerGroup?: string;

  /**
   * Consumer name (for identification)
   */
  consumerName?: string;

  /**
   * Idempotency check function (returns true if already processed)
   */
  checkIdempotency?: (idempotencyKey: string) => Promise<boolean>;

  /**
   * Idempotency record function (records processed idempotency key)
   */
  recordIdempotency?: (idempotencyKey: string) => Promise<void>;
}

/**
 * Create and connect a Redis A2A transport
 *
 * @param config - Transport configuration
 * @returns Connected transport instance
 */
export async function createRedisA2ATransport(
  config: RedisA2ATransportConfig
): Promise<RedisA2ATransport> {
  const transport = new RedisA2ATransport(config);
  await transport.connect();
  return transport;
}
