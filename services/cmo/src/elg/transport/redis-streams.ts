/**
 * Redis Streams Transport Adapter
 * Uses XADD for publish and XREADGROUP for consume
 * Supports consumer groups, ACK, and dead-letter queue
 */

import Redis from 'ioredis';
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

export interface RedisStreamsConfig extends TransportConfig {
  /**
   * Redis database number
   */
  database?: number;

  /**
   * Stream key prefix
   */
  streamPrefix?: string;

  /**
   * Consumer group prefix
   */
  consumerGroupPrefix?: string;

  /**
   * Dead-letter queue stream suffix
   */
  dlqSuffix?: string;

  /**
   * Maximum stream length (MAXLEN)
   */
  maxLength?: number;

  /**
   * Block duration for XREADGROUP (milliseconds)
   */
  blockMs?: number;

  /**
   * Batch size for XREADGROUP
   */
  batchSize?: number;

  /**
   * Maximum pending messages before backpressure
   */
  maxPending?: number;
}

export class RedisStreamsAdapter implements TransportAdapter {
  public readonly name = 'redis-streams';

  private client: Redis;
  private config: RedisStreamsConfig;
  private connected: boolean = false;
  private subscriptions: Map<string, RedisSubscription> = new Map();
  private stats: TransportStats = {
    messagesPublished: 0,
    messagesConsumed: 0,
    messagesAcked: 0,
    messagesNacked: 0,
    messagesDlq: 0,
    activeSubscriptions: 0,
    pendingMessages: 0,
  };

  constructor(config: RedisStreamsConfig) {
    this.config = {
      streamPrefix: 'stream:',
      consumerGroupPrefix: 'group:',
      dlqSuffix: ':dlq',
      maxLength: 10000,
      blockMs: 5000,
      batchSize: 10,
      maxPending: 1000,
      ...config,
    };

    this.client = new Redis({
      host: config.host,
      port: config.port,
      password: config.auth?.password,
      db: config.database || 0,
      connectTimeout: config.connectTimeout || 10000,
      lazyConnect: true,
    });
  }

  async connect(): Promise<void> {
    await this.client.connect();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    // Unsubscribe all
    for (const [, sub] of this.subscriptions) {
      await sub.unsubscribe();
    }
    this.subscriptions.clear();

    await this.client.quit();
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
    const streamKey = this.getStreamKey(topic);

    // Ensure stream exists
    await this.ensureStream(streamKey);

    // Build message fields
    const fields: Record<string, string> = {
      payload: Buffer.from(payload).toString('base64'),
      timestamp: Date.now().toString(),
    };

    if (options?.traceId) fields.traceId = options.traceId;
    if (options?.source) fields.source = options.source;
    if (options?.destination) fields.destination = options.destination;
    if (options?.replyTo) fields.replyTo = options.replyTo;
    if (options?.correlationId) fields.correlationId = options.correlationId;
    if (options?.headers) {
      fields.headers = JSON.stringify(options.headers);
    }

    // Publish with XADD
    const messageId = await this.client.xadd(
      streamKey,
      'MAXLEN',
      '~',
      this.config.maxLength!.toString(),
      '*',
      ...Object.entries(fields).flat()
    );

    this.stats.messagesPublished++;
    return messageId;
  }

  async subscribe(
    topic: string,
    handler: MessageHandler,
    options?: SubscribeOptions
  ): Promise<Subscription> {
    const streamKey = this.getStreamKey(topic);
    const consumerGroup =
      options?.consumerGroup ||
      `${this.config.consumerGroupPrefix}${topic}`;
    const consumerName =
      options?.consumerName || `consumer-${Date.now()}`;

    // Ensure stream and consumer group exist
    await this.ensureStream(streamKey);
    await this.ensureConsumerGroup(streamKey, consumerGroup);

    const subscription = new RedisSubscription(
      this,
      streamKey,
      consumerGroup,
      consumerName,
      handler,
      options
    );

    await subscription.start();

    this.subscriptions.set(subscription.id, subscription);
    this.stats.activeSubscriptions = this.subscriptions.size;

    return subscription;
  }

  async request(
    topic: string,
    payload: Uint8Array,
    options?: PublishOptions,
    timeout: number = 30000
  ): Promise<TransportMessage> {
    // Generate reply-to topic
    const replyTo = `${topic}:reply:${Date.now()}`;
    const correlationId = options?.correlationId || `req-${Date.now()}`;

    // Subscribe to reply topic
    let responseMessage: TransportMessage | null = null;

    const replySubscription = await this.subscribe(
      replyTo,
      async (msg, ack) => {
        if (msg.metadata.correlationId === correlationId) {
          responseMessage = msg;
          await ack.ack();
        }
      },
      { autoAck: false }
    );

    try {
      // Publish request
      await this.publish(topic, payload, {
        ...options,
        replyTo,
        correlationId,
      });

      // Wait for response with timeout
      const start = Date.now();
      while (!responseMessage && Date.now() - start < timeout) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      if (!responseMessage) {
        throw new Error(`Request timeout after ${timeout}ms`);
      }

      return responseMessage;
    } finally {
      await replySubscription.unsubscribe();
    }
  }

  async getStats(): Promise<TransportStats> {
    return { ...this.stats };
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    latency?: number;
    error?: string;
  }> {
    try {
      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;
      return { healthy: true, latency };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async createTopic(topic: string): Promise<void> {
    const streamKey = this.getStreamKey(topic);
    await this.ensureStream(streamKey);
  }

  async deleteTopic(topic: string): Promise<void> {
    const streamKey = this.getStreamKey(topic);
    await this.client.del(streamKey);
  }

  async purgeTopic(topic: string): Promise<void> {
    const streamKey = this.getStreamKey(topic);
    await this.client.xtrim(streamKey, 'MAXLEN', 0);
  }

  // Internal helpers

  private getStreamKey(topic: string): string {
    return `${this.config.streamPrefix}${topic}`;
  }

  private getDLQKey(topic: string): string {
    return `${this.getStreamKey(topic)}${this.config.dlqSuffix}`;
  }

  private async ensureStream(streamKey: string): Promise<void> {
    const exists = await this.client.exists(streamKey);
    if (!exists) {
      await this.client.xadd(streamKey, '*', 'init', '1');
      await this.client.xdel(streamKey, (await this.client.xrange(streamKey, '-', '+', 'COUNT', 1))[0]?.[0]);
    }
  }

  private async ensureConsumerGroup(
    streamKey: string,
    consumerGroup: string
  ): Promise<void> {
    try {
      await this.client.xgroup(
        'CREATE',
        streamKey,
        consumerGroup,
        '0',
        'MKSTREAM'
      );
    } catch (error) {
      // Group already exists, ignore
    }
  }

  async xreadgroup(
    group: string,
    consumer: string,
    streams: string[],
    ids: string[],
    count: number,
    block: number
  ): Promise<any> {
    return this.client.xreadgroup(
      'GROUP',
      group,
      consumer,
      'COUNT',
      count,
      'BLOCK',
      block,
      'STREAMS',
      ...streams,
      ...ids
    );
  }

  async xack(streamKey: string, group: string, id: string): Promise<void> {
    await this.client.xack(streamKey, group, id);
    this.stats.messagesAcked++;
  }

  async xdel(streamKey: string, id: string): Promise<void> {
    await this.client.xdel(streamKey, id);
  }

  async moveToDLQ(
    streamKey: string,
    messageId: string,
    fields: Record<string, string>,
    reason: string
  ): Promise<void> {
    const dlqKey = this.getDLQKey(streamKey);
    await this.client.xadd(
      dlqKey,
      '*',
      ...Object.entries({ ...fields, dlq_reason: reason }).flat()
    );
    this.stats.messagesDlq++;
  }

  incrementConsumed(): void {
    this.stats.messagesConsumed++;
  }

  incrementNacked(): void {
    this.stats.messagesNacked++;
  }
}

class RedisSubscription implements Subscription {
  public readonly id: string;
  public readonly topic: string;

  private adapter: RedisStreamsAdapter;
  private streamKey: string;
  private consumerGroup: string;
  private consumerName: string;
  private handler: MessageHandler;
  private options: SubscribeOptions;
  private active: boolean = false;
  private pollingTask: Promise<void> | null = null;
  private pendingCount: number = 0;
  private paused: boolean = false;

  constructor(
    adapter: RedisStreamsAdapter,
    streamKey: string,
    consumerGroup: string,
    consumerName: string,
    handler: MessageHandler,
    options?: SubscribeOptions
  ) {
    this.adapter = adapter;
    this.streamKey = streamKey;
    this.consumerGroup = consumerGroup;
    this.consumerName = consumerName;
    this.handler = handler;
    this.options = options || {};
    this.topic = streamKey;
    this.id = `${consumerGroup}:${consumerName}`;
  }

  async start(): Promise<void> {
    this.active = true;
    this.pollingTask = this.poll();
  }

  async unsubscribe(): Promise<void> {
    this.active = false;
    if (this.pollingTask) {
      await this.pollingTask;
    }
  }

  isActive(): boolean {
    return this.active;
  }

  private async poll(): Promise<void> {
    while (this.active) {
      try {
        // Backpressure: check if we should pause
        const maxPending = this.adapter['config'].maxPending || 1000;
        if (this.pendingCount >= maxPending && !this.paused) {
          this.paused = true;
          console.warn(`Backpressure: paused consumption at ${this.pendingCount} pending messages`);
        }

        // Backpressure: check if we can resume
        const resumeThreshold = maxPending * 0.8;
        if (this.pendingCount < resumeThreshold && this.paused) {
          this.paused = false;
          console.info(`Backpressure: resumed consumption at ${this.pendingCount} pending messages`);
        }

        // Skip polling if paused
        if (this.paused) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          continue;
        }

        const results = await this.adapter.xreadgroup(
          this.consumerGroup,
          this.consumerName,
          [this.streamKey],
          ['>'],
          10,
          5000
        );

        if (results) {
          for (const [stream, messages] of results) {
            for (const [messageId, fields] of messages) {
              this.pendingCount++;
              this.adapter['stats'].pendingMessages = this.pendingCount;
              await this.processMessage(messageId, fields);
              this.pendingCount--;
              this.adapter['stats'].pendingMessages = this.pendingCount;
            }
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  private async processMessage(
    messageId: string,
    fields: string[]
  ): Promise<void> {
    const fieldsObj: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
      fieldsObj[fields[i]] = fields[i + 1];
    }

    const payload = Buffer.from(fieldsObj.payload, 'base64');

    const message: TransportMessage = {
      id: messageId,
      topic: this.topic,
      payload: new Uint8Array(payload),
      metadata: {
        timestamp: parseInt(fieldsObj.timestamp, 10),
        traceId: fieldsObj.traceId,
        source: fieldsObj.source,
        destination: fieldsObj.destination,
        replyTo: fieldsObj.replyTo,
        correlationId: fieldsObj.correlationId,
        headers: fieldsObj.headers ? JSON.parse(fieldsObj.headers) : undefined,
      },
    };

    const ack: MessageAck = {
      messageId,
      ack: async () => {
        await this.adapter.xack(this.streamKey, this.consumerGroup, messageId);
      },
      nack: async (reason?: string) => {
        this.adapter.incrementNacked();
        // Do not ACK, will be retried
      },
      reject: async (reason?: string) => {
        await this.adapter.moveToDLQ(
          this.streamKey,
          messageId,
          fieldsObj,
          reason || 'Rejected'
        );
        await this.adapter.xack(this.streamKey, this.consumerGroup, messageId);
      },
    };

    this.adapter.incrementConsumed();

    try {
      await this.handler(message, ack);
      if (this.options.autoAck !== false) {
        await ack.ack();
      }
    } catch (error) {
      console.error('Handler error:', error);
      await ack.reject(error instanceof Error ? error.message : 'Unknown error');
    }
  }
}
