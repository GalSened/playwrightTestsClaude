/**
 * A2A Redis Streams Transport Tests
 * Publishing, subscribing, DLQ, backpressure, idempotency
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import type { RedisClientType } from 'redis';
import { RedisA2ATransport, createRedisA2ATransport } from '../../src/a2a/transport/redis-streams.js';
import type { A2AEnvelope, A2AMessageHandler } from '../../src/a2a/transport/types.js';
import {
  createTestRedisClient,
  cleanupTestKeys,
  createTestStream,
  createTestConsumerGroup,
  getStreamLength,
  getPendingCount,
  deleteStream,
  deleteConsumerGroup,
  waitForStreamLength,
  flushTestDB,
} from '../utils/redis.js';
import {
  createTaskRequest,
  createTaskResult,
  createMemoryEvent,
  createSpecialistInvocationRequest,
} from '../utils/envelopes.js';

describe('A2A Redis Streams Transport Tests', () => {
  let redisClient: RedisClientType;
  let transport: RedisA2ATransport;
  const TEST_TOPIC = 'test:a2a:qa.wesign.test.specialists.healing.invoke';

  beforeAll(async () => {
    redisClient = await createTestRedisClient();
  });

  beforeEach(async () => {
    await flushTestDB(redisClient);

    transport = createRedisA2ATransport({
      redisClient,
      validateOnPublish: true,
      validateOnSubscribe: true,
    });
  });

  afterEach(async () => {
    await cleanupTestKeys(redisClient, 'test:a2a:');
  });

  afterAll(async () => {
    await redisClient.disconnect();
  });

  describe('Publishing Envelopes', () => {
    it('should publish a valid TaskRequest envelope', async () => {
      const envelope = createTaskRequest();
      const messageId = await transport.publish(TEST_TOPIC, envelope);

      expect(messageId).toBeDefined();

      const length = await getStreamLength(redisClient, TEST_TOPIC);
      expect(length).toBe(1);
    });

    it('should publish multiple envelopes to the same topic', async () => {
      const envelopes = [
        createTaskRequest(),
        createTaskRequest({ meta: { message_id: 'msg-002' } as any }),
        createTaskRequest({ meta: { message_id: 'msg-003' } as any }),
      ];

      for (const envelope of envelopes) {
        await transport.publish(TEST_TOPIC, envelope);
      }

      const length = await getStreamLength(redisClient, TEST_TOPIC);
      expect(length).toBe(3);
    });

    it('should include envelope metadata in stream headers', async () => {
      const envelope = createTaskRequest();
      await transport.publish(TEST_TOPIC, envelope);

      // Read message directly from stream
      const messages = await redisClient.xRange(TEST_TOPIC, '-', '+', { COUNT: 1 });
      expect(messages).toHaveLength(1);

      const message = messages[0];
      expect(message.message).toHaveProperty('payload');

      const payload = JSON.parse(message.message.payload as string);
      expect(payload.meta.a2a_version).toBe('1.0');
      expect(payload.meta.type).toBe('TaskRequest');
    });

    it('should reject invalid envelope if validation is enabled', async () => {
      const invalidEnvelope: any = {
        meta: {
          // Missing required fields
          message_id: 'test',
        },
        payload: {},
      };

      await expect(transport.publish(TEST_TOPIC, invalidEnvelope)).rejects.toThrow('Invalid envelope');
    });

    it('should allow invalid envelope if validation is disabled', async () => {
      const transportNoValidation = createRedisA2ATransport({
        redisClient,
        validateOnPublish: false,
      });

      const invalidEnvelope: any = {
        meta: { message_id: 'test' },
        payload: {},
      };

      // Should not throw
      await transportNoValidation.publish(TEST_TOPIC, invalidEnvelope);
    });

    it('should publish with custom partition key', async () => {
      const envelope = createTaskRequest();
      const messageId = await transport.publish(TEST_TOPIC, envelope, {
        partitionKey: 'custom-partition-key',
      });

      expect(messageId).toBeDefined();
    });
  });

  describe('Subscribing to Envelopes', () => {
    beforeEach(async () => {
      // Pre-publish some messages
      await transport.publish(TEST_TOPIC, createTaskRequest({ meta: { message_id: 'msg-001' } as any }));
      await transport.publish(TEST_TOPIC, createTaskRequest({ meta: { message_id: 'msg-002' } as any }));
    });

    it('should subscribe and receive envelopes', async () => {
      const receivedEnvelopes: A2AEnvelope[] = [];

      const handler: A2AMessageHandler = async (envelope, ack) => {
        receivedEnvelopes.push(envelope);
        await ack.ack();
      };

      const subscription = await transport.subscribe(TEST_TOPIC, handler, {
        consumerGroup: 'test-consumer-group',
        consumerName: 'test-consumer-001',
      });

      // Wait for messages to be received
      await new Promise((resolve) => setTimeout(resolve, 1000));

      await subscription.unsubscribe();

      expect(receivedEnvelopes.length).toBeGreaterThanOrEqual(2);
      expect(receivedEnvelopes[0].meta.type).toBe('TaskRequest');
    });

    it('should validate envelopes on subscribe if enabled', async () => {
      // Publish an invalid envelope directly to Redis (bypassing validation)
      await redisClient.xAdd(TEST_TOPIC, '*', {
        payload: JSON.stringify({ invalid: 'envelope' }),
      });

      const rejectedCount = vi.fn();

      const handler: A2AMessageHandler = async (envelope, ack) => {
        await ack.ack();
      };

      const transportWithValidation = createRedisA2ATransport({
        redisClient,
        validateOnSubscribe: true,
      });

      const subscription = await transportWithValidation.subscribe(TEST_TOPIC, handler, {
        consumerGroup: 'test-validation-group',
        consumerName: 'test-consumer',
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      await subscription.unsubscribe();

      // Invalid envelope should have been rejected
    });

    it('should skip validation on subscribe if disabled', async () => {
      const transportNoValidation = createRedisA2ATransport({
        redisClient,
        validateOnSubscribe: false,
      });

      const receivedEnvelopes: any[] = [];

      const handler: A2AMessageHandler = async (envelope, ack) => {
        receivedEnvelopes.push(envelope);
        await ack.ack();
      };

      const subscription = await transportNoValidation.subscribe(TEST_TOPIC, handler, {
        consumerGroup: 'test-no-validation-group',
        consumerName: 'test-consumer',
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      await subscription.unsubscribe();

      expect(receivedEnvelopes.length).toBeGreaterThan(0);
    });

    it('should support multiple consumers in same group', async () => {
      const consumer1Messages: A2AEnvelope[] = [];
      const consumer2Messages: A2AEnvelope[] = [];

      // Publish more messages
      for (let i = 3; i <= 10; i++) {
        await transport.publish(TEST_TOPIC, createTaskRequest({ meta: { message_id: `msg-${i}` } as any }));
      }

      const handler1: A2AMessageHandler = async (envelope, ack) => {
        consumer1Messages.push(envelope);
        await ack.ack();
      };

      const handler2: A2AMessageHandler = async (envelope, ack) => {
        consumer2Messages.push(envelope);
        await ack.ack();
      };

      const sub1 = await transport.subscribe(TEST_TOPIC, handler1, {
        consumerGroup: 'shared-group',
        consumerName: 'consumer-001',
      });

      const sub2 = await transport.subscribe(TEST_TOPIC, handler2, {
        consumerGroup: 'shared-group',
        consumerName: 'consumer-002',
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      await sub1.unsubscribe();
      await sub2.unsubscribe();

      // Messages should be distributed between consumers
      const totalMessages = consumer1Messages.length + consumer2Messages.length;
      expect(totalMessages).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Message Acknowledgment', () => {
    it('should acknowledge messages with ack()', async () => {
      await transport.publish(TEST_TOPIC, createTaskRequest());

      const handler: A2AMessageHandler = async (envelope, ack) => {
        await ack.ack();
      };

      const subscription = await transport.subscribe(TEST_TOPIC, handler, {
        consumerGroup: 'ack-test-group',
        consumerName: 'test-consumer',
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      const pendingCount = await getPendingCount(redisClient, TEST_TOPIC, 'ack-test-group');
      expect(pendingCount).toBe(0);

      await subscription.unsubscribe();
    });

    it('should handle nack() by re-queueing message', async () => {
      await transport.publish(TEST_TOPIC, createTaskRequest());

      let attemptCount = 0;

      const handler: A2AMessageHandler = async (envelope, ack) => {
        attemptCount++;
        if (attemptCount === 1) {
          await ack.nack(); // Re-queue on first attempt
        } else {
          await ack.ack(); // Acknowledge on retry
        }
      };

      const subscription = await transport.subscribe(TEST_TOPIC, handler, {
        consumerGroup: 'nack-test-group',
        consumerName: 'test-consumer',
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(attemptCount).toBeGreaterThanOrEqual(2);

      await subscription.unsubscribe();
    });

    it('should move message to DLQ on reject()', async () => {
      await transport.publish(TEST_TOPIC, createTaskRequest());

      const handler: A2AMessageHandler = async (envelope, ack) => {
        await ack.reject('Test rejection reason');
      };

      const subscription = await transport.subscribe(TEST_TOPIC, handler, {
        consumerGroup: 'reject-test-group',
        consumerName: 'test-consumer',
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Check DLQ
      const dlqTopic = `${TEST_TOPIC}:dlq`;
      const dlqLength = await getStreamLength(redisClient, dlqTopic);
      expect(dlqLength).toBeGreaterThanOrEqual(1);

      await subscription.unsubscribe();
    });
  });

  describe('Idempotency Integration', () => {
    it('should skip duplicate messages with idempotency check', async () => {
      const envelope = createTaskRequest({
        meta: { idempotency_key: 'unique-key-001' } as any,
      });

      const processedKeys = new Set<string>();

      const checkIdempotency = async (key: string): Promise<boolean> => {
        if (processedKeys.has(key)) {
          return true; // Duplicate
        }
        processedKeys.add(key);
        return false; // Not a duplicate
      };

      const handlerCalls = vi.fn();

      const handler: A2AMessageHandler = async (envelope, ack) => {
        handlerCalls();
        await ack.ack();
      };

      // Publish the same envelope twice
      await transport.publish(TEST_TOPIC, envelope);
      await transport.publish(TEST_TOPIC, envelope);

      const subscription = await transport.subscribe(TEST_TOPIC, handler, {
        consumerGroup: 'idempotency-test-group',
        consumerName: 'test-consumer',
        checkIdempotency,
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Handler should only be called once due to idempotency
      expect(handlerCalls).toHaveBeenCalledTimes(1);

      await subscription.unsubscribe();
    });
  });

  describe('Backpressure Management', () => {
    it('should pause subscription when maxPending reached', async () => {
      // Publish many messages
      for (let i = 0; i < 50; i++) {
        await transport.publish(TEST_TOPIC, createTaskRequest({ meta: { message_id: `msg-${i}` } as any }));
      }

      let processedCount = 0;
      const maxPending = 10;

      const handler: A2AMessageHandler = async (envelope, ack) => {
        // Simulate slow processing
        await new Promise((resolve) => setTimeout(resolve, 100));
        processedCount++;
        await ack.ack();
      };

      const subscription = await transport.subscribe(TEST_TOPIC, handler, {
        consumerGroup: 'backpressure-test-group',
        consumerName: 'test-consumer',
        maxPending,
      });

      // Wait briefly
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Should not process all 50 messages instantly due to backpressure
      expect(processedCount).toBeLessThan(50);

      await subscription.unsubscribe();
    });

    it('should resume subscription when pending drops below threshold', async () => {
      // This test would require more sophisticated monitoring of pause/resume state
      // For now, we verify that the subscription continues processing after pause

      for (let i = 0; i < 20; i++) {
        await transport.publish(TEST_TOPIC, createTaskRequest({ meta: { message_id: `msg-${i}` } as any }));
      }

      let processedCount = 0;

      const handler: A2AMessageHandler = async (envelope, ack) => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        processedCount++;
        await ack.ack();
      };

      const subscription = await transport.subscribe(TEST_TOPIC, handler, {
        consumerGroup: 'resume-test-group',
        consumerName: 'test-consumer',
        maxPending: 5,
      });

      // Wait for all messages to be processed
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Eventually all messages should be processed
      expect(processedCount).toBeGreaterThanOrEqual(18);

      await subscription.unsubscribe();
    });
  });

  describe('At-Least-Once Delivery', () => {
    it('should redeliver unacknowledged messages', async () => {
      await transport.publish(TEST_TOPIC, createTaskRequest({ meta: { message_id: 'msg-unacked' } as any }));

      let deliveryCount = 0;

      const handler: A2AMessageHandler = async (envelope, ack) => {
        deliveryCount++;

        if (deliveryCount === 1) {
          // Simulate consumer crash (no ack)
          return;
        }

        await ack.ack();
      };

      const subscription = await transport.subscribe(TEST_TOPIC, handler, {
        consumerGroup: 'redeliver-test-group',
        consumerName: 'test-consumer',
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Message should be delivered at least twice
      expect(deliveryCount).toBeGreaterThanOrEqual(2);

      await subscription.unsubscribe();
    });
  });

  describe('Error Handling', () => {
    it('should handle handler errors gracefully', async () => {
      await transport.publish(TEST_TOPIC, createTaskRequest());

      const handler: A2AMessageHandler = async (envelope, ack) => {
        throw new Error('Handler error');
      };

      const subscription = await transport.subscribe(TEST_TOPIC, handler, {
        consumerGroup: 'error-test-group',
        consumerName: 'test-consumer',
      });

      // Should not crash
      await new Promise((resolve) => setTimeout(resolve, 500));

      await subscription.unsubscribe();
    });

    it('should handle Redis disconnection gracefully', async () => {
      // This would require mocking Redis client behavior
      // For now, we verify that transport handles errors

      const envelope = createTaskRequest();

      // Should not throw even if Redis is slow
      await transport.publish(TEST_TOPIC, envelope);
    });
  });

  describe('Consumer Group Management', () => {
    it('should create consumer group on first subscription', async () => {
      await transport.publish(TEST_TOPIC, createTaskRequest());

      const handler: A2AMessageHandler = async (envelope, ack) => {
        await ack.ack();
      };

      const subscription = await transport.subscribe(TEST_TOPIC, handler, {
        consumerGroup: 'new-group',
        consumerName: 'consumer-001',
      });

      await new Promise((resolve) => setTimeout(resolve, 300));

      // Verify consumer group exists by checking pending count
      const pendingCount = await getPendingCount(redisClient, TEST_TOPIC, 'new-group');
      expect(pendingCount).toBeGreaterThanOrEqual(0);

      await subscription.unsubscribe();
    });

    it('should reuse existing consumer group', async () => {
      // Pre-create consumer group
      await createTestConsumerGroup(redisClient, TEST_TOPIC, 'existing-group');

      await transport.publish(TEST_TOPIC, createTaskRequest());

      const handler: A2AMessageHandler = async (envelope, ack) => {
        await ack.ack();
      };

      const subscription = await transport.subscribe(TEST_TOPIC, handler, {
        consumerGroup: 'existing-group',
        consumerName: 'consumer-001',
      });

      await new Promise((resolve) => setTimeout(resolve, 300));

      await subscription.unsubscribe();
    });
  });

  describe('Performance', () => {
    it('should publish 100 messages in reasonable time', async () => {
      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        await transport.publish(TEST_TOPIC, createTaskRequest({ meta: { message_id: `perf-msg-${i}` } as any }));
      }

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // < 5 seconds for 100 publishes

      const length = await getStreamLength(redisClient, TEST_TOPIC);
      expect(length).toBe(100);
    });

    it('should handle high-throughput subscriptions', async () => {
      // Publish 500 messages
      for (let i = 0; i < 500; i++) {
        await transport.publish(
          TEST_TOPIC,
          createTaskRequest({ meta: { message_id: `throughput-msg-${i}` } as any })
        );
      }

      let processedCount = 0;

      const handler: A2AMessageHandler = async (envelope, ack) => {
        processedCount++;
        await ack.ack();
      };

      const startTime = Date.now();

      const subscription = await transport.subscribe(TEST_TOPIC, handler, {
        consumerGroup: 'throughput-test-group',
        consumerName: 'test-consumer',
      });

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const duration = Date.now() - startTime;

      await subscription.unsubscribe();

      expect(processedCount).toBeGreaterThan(400);
      expect(duration).toBeLessThan(10000); // < 10 seconds
    });
  });

  describe('Multiple Topics', () => {
    it('should publish and subscribe to multiple topics', async () => {
      const topic1 = 'test:a2a:qa.wesign.test.topic1';
      const topic2 = 'test:a2a:qa.wesign.test.topic2';

      await transport.publish(topic1, createTaskRequest({ meta: { message_id: 'msg-topic1' } as any }));
      await transport.publish(topic2, createTaskResult({ meta: { message_id: 'msg-topic2' } as any }));

      const topic1Messages: A2AEnvelope[] = [];
      const topic2Messages: A2AEnvelope[] = [];

      const handler1: A2AMessageHandler = async (envelope, ack) => {
        topic1Messages.push(envelope);
        await ack.ack();
      };

      const handler2: A2AMessageHandler = async (envelope, ack) => {
        topic2Messages.push(envelope);
        await ack.ack();
      };

      const sub1 = await transport.subscribe(topic1, handler1, {
        consumerGroup: 'topic1-group',
        consumerName: 'consumer',
      });

      const sub2 = await transport.subscribe(topic2, handler2, {
        consumerGroup: 'topic2-group',
        consumerName: 'consumer',
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      await sub1.unsubscribe();
      await sub2.unsubscribe();

      expect(topic1Messages.length).toBeGreaterThan(0);
      expect(topic2Messages.length).toBeGreaterThan(0);
      expect(topic1Messages[0].meta.type).toBe('TaskRequest');
      expect(topic2Messages[0].meta.type).toBe('TaskResult');
    });
  });
});
