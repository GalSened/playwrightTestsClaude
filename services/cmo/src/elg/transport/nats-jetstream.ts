/**
 * NATS JetStream Transport Adapter (STUB)
 * Compile-ready placeholder for future NATS deployment
 * Enable when NATS server is available
 */

import type {
  TransportAdapter,
  TransportMessage,
  MessageAck,
  Subscription,
  MessageHandler,
  PublishOptions,
  SubscribeOptions,
  TransportStats,
  TransportConfig,
} from './index.js';

export interface NATSJetStreamConfig extends TransportConfig {
  /**
   * NATS server URLs
   */
  servers?: string[];

  /**
   * Stream name
   */
  stream?: string;

  /**
   * Subject prefix
   */
  subjectPrefix?: string;

  /**
   * Durable consumer name
   */
  durableName?: string;
}

/**
 * NATS JetStream Adapter (STUB)
 * TODO: Implement when NATS is deployed
 */
export class NATSJetStreamAdapter implements TransportAdapter {
  public readonly name = 'nats-jetstream';

  private config: NATSJetStreamConfig;
  private connected: boolean = false;

  constructor(config: NATSJetStreamConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    throw new Error('NATS JetStream not yet implemented - use Redis Streams');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async publish(
    topic: string,
    payload: Uint8Array,
    options?: PublishOptions
  ): Promise<string> {
    throw new Error('NATS JetStream not yet implemented - use Redis Streams');
  }

  async subscribe(
    topic: string,
    handler: MessageHandler,
    options?: SubscribeOptions
  ): Promise<Subscription> {
    throw new Error('NATS JetStream not yet implemented - use Redis Streams');
  }

  async request(
    topic: string,
    payload: Uint8Array,
    options?: PublishOptions,
    timeout?: number
  ): Promise<TransportMessage> {
    throw new Error('NATS JetStream not yet implemented - use Redis Streams');
  }

  async getStats(): Promise<TransportStats> {
    return {
      messagesPublished: 0,
      messagesConsumed: 0,
      messagesAcked: 0,
      messagesNacked: 0,
      messagesDlq: 0,
      activeSubscriptions: 0,
      pendingMessages: 0,
    };
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    latency?: number;
    error?: string;
  }> {
    return {
      healthy: false,
      error: 'NATS JetStream not yet implemented',
    };
  }

  async createTopic(topic: string): Promise<void> {
    throw new Error('NATS JetStream not yet implemented - use Redis Streams');
  }

  async deleteTopic(topic: string): Promise<void> {
    throw new Error('NATS JetStream not yet implemented - use Redis Streams');
  }

  async purgeTopic(topic: string): Promise<void> {
    throw new Error('NATS JetStream not yet implemented - use Redis Streams');
  }
}

/*
 * FUTURE IMPLEMENTATION NOTES:
 *
 * When NATS is deployed, implement using nats.js:
 *
 * import { connect, JetStreamClient, JetStreamManager } from 'nats';
 *
 * - Use JetStream for persistent messaging
 * - Consumer groups via durable consumers
 * - ACK/NACK support built-in
 * - Subject-based routing
 * - Automatic retries and DLQ via max_deliver
 *
 * Migration path:
 * 1. Install nats.js: npm install nats
 * 2. Implement connect() with NATS client
 * 3. Implement publish() using jetstream.publish()
 * 4. Implement subscribe() using jetstream.subscribe()
 * 5. Add subject wildcards support (e.g., "agent.*.task")
 * 6. Add stream/consumer configuration
 * 7. Test with existing Redis Streams tests
 * 8. Update config to switch transport type
 */
