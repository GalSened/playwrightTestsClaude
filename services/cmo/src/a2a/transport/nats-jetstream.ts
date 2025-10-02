/**
 * NATS JetStream A2A Transport Stub
 * Placeholder for Step-3.5 (NATS rollout)
 *
 * @see https://nats.io/
 * @see https://docs.nats.io/nats-concepts/jetstream
 *
 * TODO (Step-3.5):
 * - Implement NATS JetStream connection
 * - Implement publish/subscribe with JetStream
 * - Add key-value store for idempotency
 * - Add object store for large payloads
 * - Implement stream-based DLQ
 */

import type { A2AEnvelope } from '../envelopes/types.js';
import type { Subscription } from '../../elg/transport/index.js';
import type { A2AMessageHandler, A2ASubscribeOptions } from './redis-streams.js';

/**
 * NATS JetStream configuration (stub)
 */
export interface NatsJetStreamConfig {
  /**
   * NATS server URLs (e.g., ['nats://localhost:4222'])
   */
  servers: string[];

  /**
   * Authentication credentials (optional)
   */
  auth?: {
    username?: string;
    password?: string;
    token?: string;
    nkey?: string;
  };

  /**
   * TLS configuration (optional)
   */
  tls?: {
    caFile?: string;
    certFile?: string;
    keyFile?: string;
  };

  /**
   * JetStream stream name prefix
   */
  streamPrefix?: string;

  /**
   * Max age for messages (in seconds)
   */
  maxAge?: number;

  /**
   * Max messages per stream
   */
  maxMessages?: number;

  /**
   * Validate envelopes on publish (default: true)
   */
  validateOnPublish?: boolean;

  /**
   * Validate envelopes on subscribe (default: true)
   */
  validateOnSubscribe?: boolean;
}

/**
 * NATS JetStream A2A Transport (STUB)
 *
 * This is a placeholder implementation for NATS JetStream transport.
 * All methods throw "Not implemented" errors until Step-3.5.
 */
export class NatsA2ATransport {
  private config: NatsJetStreamConfig;

  constructor(config: NatsJetStreamConfig) {
    this.config = config;
  }

  /**
   * Connect to NATS JetStream
   * @throws Not implemented (Step-3.5)
   */
  async connect(): Promise<void> {
    throw new Error(
      'NATS JetStream transport not implemented yet. See Step-3.5 for NATS rollout.'
    );
  }

  /**
   * Disconnect from NATS JetStream
   * @throws Not implemented (Step-3.5)
   */
  async disconnect(): Promise<void> {
    throw new Error(
      'NATS JetStream transport not implemented yet. See Step-3.5 for NATS rollout.'
    );
  }

  /**
   * Check if connected
   * @returns Always false (stub)
   */
  isConnected(): boolean {
    return false;
  }

  /**
   * Publish an A2A envelope to a subject
   * @throws Not implemented (Step-3.5)
   */
  async publish(
    subject: string,
    envelope: A2AEnvelope,
    options?: any
  ): Promise<string> {
    throw new Error(
      'NATS JetStream transport not implemented yet. See Step-3.5 for NATS rollout.'
    );
  }

  /**
   * Subscribe to A2A envelopes on a subject
   * @throws Not implemented (Step-3.5)
   */
  async subscribe(
    subject: string,
    handler: A2AMessageHandler,
    options?: A2ASubscribeOptions
  ): Promise<Subscription> {
    throw new Error(
      'NATS JetStream transport not implemented yet. See Step-3.5 for NATS rollout.'
    );
  }

  /**
   * Request/response pattern for A2A
   * @throws Not implemented (Step-3.5)
   */
  async request(
    subject: string,
    envelope: A2AEnvelope,
    options?: any,
    timeout?: number
  ): Promise<A2AEnvelope> {
    throw new Error(
      'NATS JetStream transport not implemented yet. See Step-3.5 for NATS rollout.'
    );
  }

  /**
   * Get transport stats
   * @throws Not implemented (Step-3.5)
   */
  async getStats() {
    throw new Error(
      'NATS JetStream transport not implemented yet. See Step-3.5 for NATS rollout.'
    );
  }

  /**
   * Health check
   * @returns Always unhealthy (stub)
   */
  async healthCheck() {
    return {
      healthy: false,
      error: 'NATS JetStream transport not implemented yet. See Step-3.5 for NATS rollout.',
    };
  }

  /**
   * Create a stream
   * @throws Not implemented (Step-3.5)
   */
  async createStream(name: string): Promise<void> {
    throw new Error(
      'NATS JetStream transport not implemented yet. See Step-3.5 for NATS rollout.'
    );
  }

  /**
   * Delete a stream
   * @throws Not implemented (Step-3.5)
   */
  async deleteStream(name: string): Promise<void> {
    throw new Error(
      'NATS JetStream transport not implemented yet. See Step-3.5 for NATS rollout.'
    );
  }

  /**
   * Purge a stream
   * @throws Not implemented (Step-3.5)
   */
  async purgeStream(name: string): Promise<void> {
    throw new Error(
      'NATS JetStream transport not implemented yet. See Step-3.5 for NATS rollout.'
    );
  }
}

/**
 * Create and connect a NATS JetStream A2A transport
 * @throws Not implemented (Step-3.5)
 */
export async function createNatsA2ATransport(
  config: NatsJetStreamConfig
): Promise<NatsA2ATransport> {
  const transport = new NatsA2ATransport(config);
  await transport.connect();
  return transport;
}

/**
 * Step-3.5 Implementation Checklist:
 *
 * 1. Add NATS dependencies:
 *    - npm install nats@^2.x
 *    - @types/nats (if available)
 *
 * 2. Implement NatsA2ATransport:
 *    - connect(): connect to NATS servers, enable JetStream
 *    - disconnect(): drain and close connection
 *    - publish(): use jetstream.publish() with ack wait
 *    - subscribe(): use jetstream.subscribe() with consumer config
 *    - request(): use request/reply pattern with JetStream
 *
 * 3. Add idempotency with KeyValue store:
 *    - Use JetStream KV for idempotency keys
 *    - TTL-based key expiration
 *
 * 4. Add DLQ with streams:
 *    - Create DLQ stream per main stream
 *    - Move messages to DLQ on max retries
 *
 * 5. Add large payload support:
 *    - Use JetStream Object Store for payloads >1MB
 *    - Store object reference in envelope
 *
 * 6. Add metrics and monitoring:
 *    - Publish/consume counters
 *    - Latency histograms
 *    - Stream health checks
 *
 * 7. Add tests:
 *    - Unit tests with mock NATS
 *    - Integration tests with NATS container
 *    - Load tests for throughput
 */
