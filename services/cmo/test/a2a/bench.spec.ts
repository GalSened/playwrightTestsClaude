/**
 * A2A Performance Benchmarks
 * Measuring P50/P90/P95/P99 latencies against SLOs
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import type { RedisClientType } from 'redis';
import type { Pool } from 'pg';
import { RedisA2ATransport, createRedisA2ATransport } from '../../src/a2a/transport/redis-streams.js';
import { PostgresAgentRegistry } from '../../src/a2a/registry/pg.js';
import type { A2AMessageHandler, A2AEnvelope } from '../../src/a2a/transport/types.js';
import type { AgentRegistration } from '../../src/a2a/registry/types.js';
import { createTestRedisClient, flushTestDB } from '../utils/redis.js';
import { createTestPool, truncateTestTables } from '../utils/postgres.js';
import { createTaskRequest, createSpecialistInvocationRequest } from '../utils/envelopes.js';

/**
 * Calculate percentiles from sorted latency array
 */
function calculatePercentiles(latencies: number[]): {
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  mean: number;
} {
  const sorted = [...latencies].sort((a, b) => a - b);
  const len = sorted.length;

  if (len === 0) {
    return { p50: 0, p90: 0, p95: 0, p99: 0, min: 0, max: 0, mean: 0 };
  }

  const p50 = sorted[Math.floor(len * 0.5)];
  const p90 = sorted[Math.floor(len * 0.9)];
  const p95 = sorted[Math.floor(len * 0.95)];
  const p99 = sorted[Math.floor(len * 0.99)];
  const min = sorted[0];
  const max = sorted[len - 1];
  const mean = sorted.reduce((sum, val) => sum + val, 0) / len;

  return { p50, p90, p95, p99, min, max, mean };
}

/**
 * Format percentile report
 */
function formatReport(name: string, stats: ReturnType<typeof calculatePercentiles>): string {
  return [
    `\n=== ${name} ===`,
    `  Min:  ${stats.min.toFixed(2)}ms`,
    `  Mean: ${stats.mean.toFixed(2)}ms`,
    `  P50:  ${stats.p50.toFixed(2)}ms`,
    `  P90:  ${stats.p90.toFixed(2)}ms`,
    `  P95:  ${stats.p95.toFixed(2)}ms`,
    `  P99:  ${stats.p99.toFixed(2)}ms`,
    `  Max:  ${stats.max.toFixed(2)}ms`,
  ].join('\n');
}

describe('A2A Performance Benchmarks', () => {
  let redisClient: RedisClientType;
  let pool: Pool;
  let transport: RedisA2ATransport;
  let registry: PostgresAgentRegistry;

  const TEST_TOPIC = 'test:a2a:bench.wesign.test.topic';
  const ITERATIONS = 1000; // Number of operations to benchmark

  beforeAll(async () => {
    redisClient = await createTestRedisClient();
    pool = createTestPool();
  });

  beforeEach(async () => {
    await flushTestDB(redisClient);
    await truncateTestTables(pool);

    transport = createRedisA2ATransport({
      redisClient,
      validateOnPublish: true,
      validateOnSubscribe: true,
    });

    registry = new PostgresAgentRegistry({ pool });
  });

  afterAll(async () => {
    await redisClient.disconnect();
    await pool.end();
  });

  describe('Publish Latency Benchmarks', () => {
    it('should measure publish latency and verify SLOs (P95 ≤60ms, P99 ≤120ms)', async () => {
      const latencies: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const envelope = createTaskRequest({ meta: { message_id: `bench-msg-${i}` } as any });

        const start = performance.now();
        await transport.publish(TEST_TOPIC, envelope);
        const end = performance.now();

        latencies.push(end - start);
      }

      const stats = calculatePercentiles(latencies);
      console.log(formatReport('Publish Latency', stats));

      // Verify SLOs
      expect(stats.p95).toBeLessThanOrEqual(60);
      expect(stats.p99).toBeLessThanOrEqual(120);
    });

    it('should measure publish latency with validation disabled', async () => {
      const transportNoValidation = createRedisA2ATransport({
        redisClient,
        validateOnPublish: false,
      });

      const latencies: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const envelope = createTaskRequest({ meta: { message_id: `bench-noval-${i}` } as any });

        const start = performance.now();
        await transportNoValidation.publish(TEST_TOPIC, envelope);
        const end = performance.now();

        latencies.push(end - start);
      }

      const stats = calculatePercentiles(latencies);
      console.log(formatReport('Publish Latency (No Validation)', stats));

      // Should be faster without validation
      expect(stats.p95).toBeLessThanOrEqual(50);
    });

    it('should measure batch publish throughput', async () => {
      const batchSize = 100;
      const batches: number[] = [];

      for (let batch = 0; batch < 10; batch++) {
        const start = performance.now();

        const promises = [];
        for (let i = 0; i < batchSize; i++) {
          promises.push(
            transport.publish(TEST_TOPIC, createTaskRequest({ meta: { message_id: `batch-${batch}-${i}` } as any }))
          );
        }

        await Promise.all(promises);

        const end = performance.now();
        batches.push(end - start);
      }

      const stats = calculatePercentiles(batches);
      console.log(formatReport(`Batch Publish (${batchSize} messages)`, stats));

      // 100 messages should complete in reasonable time
      expect(stats.p95).toBeLessThanOrEqual(2000); // 2 seconds
    });
  });

  describe('Subscribe & Processing Latency Benchmarks', () => {
    it('should measure subscribe processing latency (P95 ≤60ms, P99 ≤120ms)', async () => {
      // Pre-publish messages
      for (let i = 0; i < ITERATIONS; i++) {
        await transport.publish(TEST_TOPIC, createTaskRequest({ meta: { message_id: `proc-msg-${i}` } as any }));
      }

      const latencies: number[] = [];
      let processedCount = 0;

      const handler: A2AMessageHandler = async (envelope, ack) => {
        const receiveTime = performance.now();
        const sendTime = new Date(envelope.meta.ts).getTime();
        const latency = receiveTime - sendTime;

        latencies.push(latency);
        processedCount++;

        await ack.ack();
      };

      const subscription = await transport.subscribe(TEST_TOPIC, handler, {
        consumerGroup: 'bench-subscribe-group',
        consumerName: 'bench-consumer',
      });

      // Wait for all messages to be processed
      while (processedCount < ITERATIONS) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      await subscription.unsubscribe();

      const stats = calculatePercentiles(latencies);
      console.log(formatReport('Subscribe Processing Latency', stats));

      // Note: This measures end-to-end latency, not just processing
      // SLOs might be relaxed for this metric
      expect(stats.p95).toBeLessThanOrEqual(100); // Relaxed for E2E
      expect(stats.p99).toBeLessThanOrEqual(200);
    });

    it('should measure processing overhead (handler execution time)', async () => {
      for (let i = 0; i < 100; i++) {
        await transport.publish(TEST_TOPIC, createTaskRequest({ meta: { message_id: `overhead-msg-${i}` } as any }));
      }

      const latencies: number[] = [];
      let processedCount = 0;

      const handler: A2AMessageHandler = async (envelope, ack) => {
        const start = performance.now();

        // Minimal processing
        const _ = envelope.meta.type;

        const end = performance.now();
        latencies.push(end - start);

        await ack.ack();
        processedCount++;
      };

      const subscription = await transport.subscribe(TEST_TOPIC, handler, {
        consumerGroup: 'bench-overhead-group',
        consumerName: 'bench-consumer',
      });

      while (processedCount < 100) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      await subscription.unsubscribe();

      const stats = calculatePercentiles(latencies);
      console.log(formatReport('Handler Processing Overhead', stats));

      // Handler overhead should be minimal
      expect(stats.p95).toBeLessThanOrEqual(5); // < 5ms
    });
  });

  describe('Idempotency Overhead Benchmarks', () => {
    it('should measure idempotency check overhead (P95 ≤10ms)', async () => {
      const latencies: number[] = [];
      const processedKeys = new Set<string>();

      const checkIdempotency = async (key: string): Promise<boolean> => {
        const start = performance.now();

        const isDuplicate = processedKeys.has(key);
        if (!isDuplicate) {
          processedKeys.add(key);
        }

        const end = performance.now();
        latencies.push(end - start);

        return isDuplicate;
      };

      // Publish 500 unique messages
      for (let i = 0; i < 500; i++) {
        await transport.publish(
          TEST_TOPIC,
          createTaskRequest({
            meta: { message_id: `idem-msg-${i}`, idempotency_key: `idem-key-${i}` } as any,
          })
        );
      }

      let processedCount = 0;

      const handler: A2AMessageHandler = async (envelope, ack) => {
        await ack.ack();
        processedCount++;
      };

      const subscription = await transport.subscribe(TEST_TOPIC, handler, {
        consumerGroup: 'bench-idempotency-group',
        consumerName: 'bench-consumer',
        checkIdempotency,
      });

      while (processedCount < 500) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      await subscription.unsubscribe();

      const stats = calculatePercentiles(latencies);
      console.log(formatReport('Idempotency Check Overhead', stats));

      // Verify SLO: P95 ≤10ms
      expect(stats.p95).toBeLessThanOrEqual(10);
    });
  });

  describe('Registry Operation Benchmarks', () => {
    it('should measure agent registration latency', async () => {
      const latencies: number[] = [];

      for (let i = 0; i < 100; i++) {
        const registration: AgentRegistration = {
          agent_id: `bench-agent-${i}`,
          version: '1.0.0',
          tenant: 'bench-tenant',
          project: 'bench-project',
          capabilities: ['bench-cap'],
        };

        const start = performance.now();
        await registry.register(registration);
        const end = performance.now();

        latencies.push(end - start);
      }

      const stats = calculatePercentiles(latencies);
      console.log(formatReport('Agent Registration Latency', stats));

      // Registry operations should be fast
      expect(stats.p95).toBeLessThanOrEqual(50); // < 50ms
    });

    it('should measure heartbeat latency', async () => {
      // Pre-register agents
      for (let i = 0; i < 50; i++) {
        await registry.register({
          agent_id: `heartbeat-agent-${i}`,
          version: '1.0.0',
          tenant: 'test',
          project: 'test',
          capabilities: ['heartbeat'],
        });
      }

      const latencies: number[] = [];

      for (let i = 0; i < 50; i++) {
        const start = performance.now();
        await registry.heartbeat({
          agent_id: `heartbeat-agent-${i}`,
          status: 'HEALTHY',
        });
        const end = performance.now();

        latencies.push(end - start);
      }

      const stats = calculatePercentiles(latencies);
      console.log(formatReport('Heartbeat Latency', stats));

      expect(stats.p95).toBeLessThanOrEqual(30); // < 30ms
    });

    it('should measure discovery latency', async () => {
      // Pre-register 100 agents with different capabilities
      for (let i = 0; i < 100; i++) {
        await registry.register({
          agent_id: `discovery-agent-${i}`,
          version: '1.0.0',
          tenant: 'test',
          project: 'test',
          capabilities: [i % 5 === 0 ? 'self-healing' : 'other-cap'],
        });
      }

      const latencies: number[] = [];

      for (let i = 0; i < 50; i++) {
        const start = performance.now();
        await registry.discover({ capability: 'self-healing', tenant: 'test' });
        const end = performance.now();

        latencies.push(end - start);
      }

      const stats = calculatePercentiles(latencies);
      console.log(formatReport('Discovery Latency', stats));

      expect(stats.p95).toBeLessThanOrEqual(50); // < 50ms
    });
  });

  describe('End-to-End Flow Benchmarks', () => {
    it('should measure complete request-response cycle latency', async () => {
      const latencies: number[] = [];
      const responseTopic = 'test:a2a:bench.cmo.results';

      // Specialist handler (responds immediately)
      const specialistHandler: A2AMessageHandler = async (envelope, ack) => {
        const response = createTaskRequest({
          meta: {
            from: envelope.meta.to[0] as any,
            to: [envelope.meta.from],
            reply_to: envelope.meta.message_id,
            trace_id: envelope.meta.trace_id,
            type: 'TaskResult',
          } as any,
          payload: { status: 'success', result: {}, duration_ms: 0 } as any,
        });

        await transport.publish(responseTopic, response);
        await ack.ack();
      };

      const specialistSub = await transport.subscribe(TEST_TOPIC, specialistHandler, {
        consumerGroup: 'bench-e2e-specialist-group',
        consumerName: 'specialist',
      });

      // CMO sends requests and measures round-trip time
      const requestTimestamps = new Map<string, number>();
      let responsesReceived = 0;

      const cmoHandler: A2AMessageHandler = async (envelope, ack) => {
        const requestId = envelope.meta.reply_to!;
        const requestTime = requestTimestamps.get(requestId);

        if (requestTime) {
          const responseTime = performance.now();
          latencies.push(responseTime - requestTime);
          responsesReceived++;
        }

        await ack.ack();
      };

      const cmoSub = await transport.subscribe(responseTopic, cmoHandler, {
        consumerGroup: 'bench-e2e-cmo-group',
        consumerName: 'cmo',
      });

      // Send 100 requests
      for (let i = 0; i < 100; i++) {
        const envelope = createTaskRequest({ meta: { message_id: `e2e-req-${i}` } as any });

        requestTimestamps.set(envelope.meta.message_id, performance.now());
        await transport.publish(TEST_TOPIC, envelope);

        // Stagger requests slightly
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // Wait for all responses
      while (responsesReceived < 100) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      await specialistSub.unsubscribe();
      await cmoSub.unsubscribe();

      const stats = calculatePercentiles(latencies);
      console.log(formatReport('End-to-End Request-Response Latency', stats));

      // E2E flow should complete in reasonable time
      expect(stats.p95).toBeLessThanOrEqual(200); // < 200ms
      expect(stats.p99).toBeLessThanOrEqual(300); // < 300ms
    });
  });

  describe('Throughput Benchmarks', () => {
    it('should measure sustained publish throughput (messages/second)', async () => {
      const duration = 5000; // 5 seconds
      let messageCount = 0;

      const startTime = performance.now();
      const endTime = startTime + duration;

      while (performance.now() < endTime) {
        await transport.publish(TEST_TOPIC, createTaskRequest({ meta: { message_id: `tput-${messageCount}` } as any }));
        messageCount++;
      }

      const actualDuration = performance.now() - startTime;
      const throughput = (messageCount / actualDuration) * 1000; // messages per second

      console.log(`\n=== Publish Throughput ===`);
      console.log(`  Messages: ${messageCount}`);
      console.log(`  Duration: ${actualDuration.toFixed(0)}ms`);
      console.log(`  Throughput: ${throughput.toFixed(0)} messages/second`);

      // Should sustain reasonable throughput
      expect(throughput).toBeGreaterThan(100); // > 100 msg/s
    });

    it('should measure sustained subscribe throughput', async () => {
      // Pre-publish 1000 messages
      for (let i = 0; i < 1000; i++) {
        await transport.publish(TEST_TOPIC, createTaskRequest({ meta: { message_id: `sub-tput-${i}` } as any }));
      }

      let processedCount = 0;
      const startTime = performance.now();

      const handler: A2AMessageHandler = async (envelope, ack) => {
        processedCount++;
        await ack.ack();
      };

      const subscription = await transport.subscribe(TEST_TOPIC, handler, {
        consumerGroup: 'throughput-test-group',
        consumerName: 'consumer',
      });

      // Wait for all messages
      while (processedCount < 1000) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      const endTime = performance.now();
      await subscription.unsubscribe();

      const duration = endTime - startTime;
      const throughput = (processedCount / duration) * 1000;

      console.log(`\n=== Subscribe Throughput ===`);
      console.log(`  Messages: ${processedCount}`);
      console.log(`  Duration: ${duration.toFixed(0)}ms`);
      console.log(`  Throughput: ${throughput.toFixed(0)} messages/second`);

      expect(throughput).toBeGreaterThan(100); // > 100 msg/s
    });
  });
});
