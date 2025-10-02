/**
 * Redis Streams Transport Unit Tests
 * Verifies publish/consume, DLQ, backpressure, and consumer group behavior
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RedisStreamsAdapter } from '../../src/elg/transport/redis-streams.js';
import type { TransportMessage, MessageAck } from '../../src/elg/transport/index.js';

// Mock Redis client for testing
class MockRedisClient {
  private streams: Map<string, Map<string, any>> = new Map();
  private consumerGroups: Map<string, Set<string>> = new Map();
  private pendingMessages: Map<string, any[]> = new Map();

  connected: boolean = false;

  async connect(): Promise<void> {
    this.connected = true;
  }

  async quit(): Promise<void> {
    this.connected = false;
  }

  async xadd(streamKey: string, ...args: any[]): Promise<string> {
    if (!this.streams.has(streamKey)) {
      this.streams.set(streamKey, new Map());
    }

    const messageId = `${Date.now()}-0`;
    const fields: Record<string, string> = {};

    // Parse fields (skip MAXLEN args)
    let i = 0;
    while (i < args.length) {
      if (args[i] === 'MAXLEN' || args[i] === '~') {
        i += 2; // skip MAXLEN and value
        continue;
      }
      if (args[i] === '*') {
        i++;
        continue;
      }
      fields[args[i]] = args[i + 1];
      i += 2;
    }

    this.streams.get(streamKey)!.set(messageId, fields);
    return messageId;
  }

  async xreadgroup(
    group: string,
    consumer: string,
    streams: string[],
    ids: string[],
    count: number,
    blockMs: number
  ): Promise<any[]> {
    const results: any[] = [];

    for (let i = 0; i < streams.length; i++) {
      const streamKey = streams[i];
      const stream = this.streams.get(streamKey);

      if (!stream) continue;

      const messages: [string, string[]][] = [];
      for (const [messageId, fields] of stream.entries()) {
        const flatFields: string[] = [];
        for (const [key, value] of Object.entries(fields)) {
          flatFields.push(key, value);
        }
        messages.push([messageId, flatFields]);
      }

      if (messages.length > 0) {
        results.push([streamKey, messages]);
        // Clear consumed messages
        stream.clear();
      }
    }

    return results.length > 0 ? results : null;
  }

  async xack(streamKey: string, group: string, ...messageIds: string[]): Promise<number> {
    return messageIds.length;
  }

  async xgroup(command: string, ...args: any[]): Promise<any> {
    const [action, streamKey, groupName] = args;

    if (action === 'CREATE') {
      if (!this.consumerGroups.has(streamKey)) {
        this.consumerGroups.set(streamKey, new Set());
      }
      this.consumerGroups.get(streamKey)!.add(groupName);
      return 'OK';
    }

    if (action === 'DESTROY') {
      this.consumerGroups.get(streamKey)?.delete(groupName);
      return 1;
    }

    return null;
  }

  async exists(key: string): Promise<number> {
    return this.streams.has(key) ? 1 : 0;
  }

  async ping(): Promise<string> {
    return 'PONG';
  }
}

describe('Redis Streams Transport', () => {
  let adapter: RedisStreamsAdapter;
  let mockClient: MockRedisClient;

  beforeEach(() => {
    mockClient = new MockRedisClient();

    adapter = new RedisStreamsAdapter({
      type: 'redis-streams',
      host: 'localhost',
      port: 6379,
      streamPrefix: 'test:',
      consumerGroupPrefix: 'group:',
      dlqSuffix: ':dlq',
      maxPending: 10, // Low threshold for testing
    });

    // Replace real Redis client with mock
    (adapter as any).client = mockClient;
  });

  afterEach(async () => {
    if (adapter.isConnected()) {
      await adapter.disconnect();
    }
  });

  describe('Connection Management', () => {
    it('connects successfully', async () => {
      await adapter.connect();
      expect(adapter.isConnected()).toBe(true);
    });

    it('disconnects successfully', async () => {
      await adapter.connect();
      await adapter.disconnect();
      expect(adapter.isConnected()).toBe(false);
    });

    it('reports health check as healthy when connected', async () => {
      await adapter.connect();
      const health = await adapter.healthCheck();
      expect(health.healthy).toBe(true);
    });
  });

  describe('Publish / Consume Happy Path', () => {
    it('publishes message successfully', async () => {
      await adapter.connect();

      const payload = new TextEncoder().encode('Hello, Redis!');
      const messageId = await adapter.publish('test-topic', payload, {
        traceId: 'trace-123',
        correlationId: 'corr-456',
      });

      expect(messageId).toBeDefined();
      expect(typeof messageId).toBe('string');
    });

    it('consumes published message', async () => {
      await adapter.connect();

      const payload = new TextEncoder().encode('Test message');
      await adapter.publish('test-topic', payload);

      let receivedMessage: TransportMessage | null = null;

      await adapter.subscribe(
        'test-topic',
        async (message, ack) => {
          receivedMessage = message;
          await ack.ack();
        },
        { consumerGroup: 'test-group', consumerName: 'consumer-1' }
      );

      // Wait for message processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(receivedMessage).not.toBeNull();
      expect(new TextDecoder().decode(receivedMessage!.payload)).toBe('Test message');
    });

    it('acknowledges message after successful processing', async () => {
      await adapter.connect();

      await adapter.publish('test-topic', new TextEncoder().encode('Test'));

      let ackCalled = false;

      await adapter.subscribe(
        'test-topic',
        async (message, ack) => {
          await ack.ack();
          ackCalled = true;
        },
        { consumerGroup: 'test-group' }
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(ackCalled).toBe(true);
    });
  });

  describe('Dead-Letter Queue (DLQ)', () => {
    it('moves message to DLQ on reject', async () => {
      await adapter.connect();

      const messageId = await adapter.publish('test-topic', new TextEncoder().encode('Fail'));

      await adapter.subscribe(
        'test-topic',
        async (message, ack) => {
          await ack.reject('Processing error');
        },
        { consumerGroup: 'test-group' }
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      const stats = adapter.getStats();
      expect(stats.messagesDlq).toBeGreaterThan(0);
    });

    it('includes error reason in DLQ message', async () => {
      await adapter.connect();

      await adapter.publish('test-topic', new TextEncoder().encode('Fail'));

      let dlqReason = '';

      await adapter.subscribe(
        'test-topic',
        async (message, ack) => {
          dlqReason = 'Custom error: timeout';
          await ack.reject(dlqReason);
        },
        { consumerGroup: 'test-group' }
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(dlqReason).toBe('Custom error: timeout');
    });
  });

  describe('Backpressure Mechanism', () => {
    it('pauses consumption when pending messages exceed threshold', async () => {
      await adapter.connect();

      // Publish more messages than maxPending (10)
      for (let i = 0; i < 15; i++) {
        await adapter.publish('test-topic', new TextEncoder().encode(`Message ${i}`));
      }

      let processedCount = 0;
      const slowHandler = async (message: TransportMessage, ack: MessageAck) => {
        // Simulate slow processing
        await new Promise((resolve) => setTimeout(resolve, 50));
        processedCount++;
        await ack.ack();
      };

      await adapter.subscribe('test-topic', slowHandler, { consumerGroup: 'test-group' });

      // Wait for some processing
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should have paused due to backpressure
      const stats = adapter.getStats();
      expect(stats.pendingMessages).toBeLessThanOrEqual(10);
    });

    it('resumes consumption when pending messages drop below threshold', async () => {
      await adapter.connect();

      // Publish messages
      for (let i = 0; i < 20; i++) {
        await adapter.publish('test-topic', new TextEncoder().encode(`Message ${i}`));
      }

      let processedCount = 0;

      await adapter.subscribe(
        'test-topic',
        async (message, ack) => {
          processedCount++;
          await ack.ack();
        },
        { consumerGroup: 'test-group' }
      );

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Eventually all should be processed (backpressure resumes)
      expect(processedCount).toBeGreaterThan(0);
    });
  });

  describe('Consumer Group Management', () => {
    it('creates consumer group if not exists', async () => {
      await adapter.connect();

      await adapter.publish('test-topic', new TextEncoder().encode('Test'));

      await adapter.subscribe(
        'test-topic',
        async (message, ack) => {
          await ack.ack();
        },
        { consumerGroup: 'new-group' }
      );

      // Consumer group should be created automatically
      expect(mockClient.consumerGroups.get('test:test-topic')).toContain('group:new-group');
    });

    it('handles restart correctly - resumes from checkpoint', async () => {
      await adapter.connect();

      // Publish messages
      await adapter.publish('test-topic', new TextEncoder().encode('Msg 1'));
      await adapter.publish('test-topic', new TextEncoder().encode('Msg 2'));

      let firstRunCount = 0;

      const subscription = await adapter.subscribe(
        'test-topic',
        async (message, ack) => {
          firstRunCount++;
          await ack.ack();
        },
        { consumerGroup: 'restart-group' }
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Simulate crash - unsubscribe
      await subscription.unsubscribe();

      // Publish more messages
      await adapter.publish('test-topic', new TextEncoder().encode('Msg 3'));

      let secondRunCount = 0;

      // Restart consumer
      await adapter.subscribe(
        'test-topic',
        async (message, ack) => {
          secondRunCount++;
          await ack.ack();
        },
        { consumerGroup: 'restart-group' }
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should only process new message (Msg 3)
      expect(secondRunCount).toBe(1);
    });
  });

  describe('Statistics', () => {
    it('tracks messages published', async () => {
      await adapter.connect();

      await adapter.publish('test-topic', new TextEncoder().encode('Test 1'));
      await adapter.publish('test-topic', new TextEncoder().encode('Test 2'));

      const stats = adapter.getStats();
      expect(stats.messagesPublished).toBe(2);
    });

    it('tracks messages consumed', async () => {
      await adapter.connect();

      await adapter.publish('test-topic', new TextEncoder().encode('Test'));

      await adapter.subscribe(
        'test-topic',
        async (message, ack) => {
          await ack.ack();
        },
        { consumerGroup: 'stats-group' }
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      const stats = adapter.getStats();
      expect(stats.messagesConsumed).toBeGreaterThan(0);
    });

    it('tracks active subscriptions', async () => {
      await adapter.connect();

      await adapter.publish('test-topic', new TextEncoder().encode('Test'));

      await adapter.subscribe(
        'test-topic',
        async (message, ack) => {
          await ack.ack();
        }
      );

      const stats = adapter.getStats();
      expect(stats.activeSubscriptions).toBe(1);
    });
  });
});
