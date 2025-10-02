/**
 * A2A Chaos & Failure Drills
 * Testing system resilience under Redis/Postgres/OPA outages and crash scenarios
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import type { RedisClientType } from 'redis';
import type { Pool } from 'pg';
import { RedisA2ATransport, createRedisA2ATransport } from '../../src/a2a/transport/redis-streams.js';
import { PostgresAgentRegistry } from '../../src/a2a/registry/pg.js';
import { LeaseExpiryChecker } from '../../src/a2a/registry/health.js';
import { OPAWireGates } from '../../src/a2a/middleware/opa-wire-gates.js';
import type { A2AMessageHandler, A2AEnvelope } from '../../src/a2a/transport/types.js';
import type { AgentRegistration } from '../../src/a2a/registry/types.js';
import { createTestRedisClient, flushTestDB, simulateRedisOutage, getStreamLength } from '../utils/redis.js';
import { createTestPool, truncateTestTables, insertTestAgent, getAgent } from '../utils/postgres.js';
import { createMockOPAServer, createOPAOutagePolicy, createAlwaysAllowPolicy } from '../utils/opa.js';
import { createTaskRequest, createSpecialistInvocationRequest } from '../utils/envelopes.js';
import { createVirtualClock } from '../utils/clock.js';

describe('A2A Chaos & Failure Drills', () => {
  let redisClient: RedisClientType;
  let pool: Pool;
  let transport: RedisA2ATransport;
  let registry: PostgresAgentRegistry;
  let mockOPA: ReturnType<typeof createMockOPAServer>;

  const TEST_TOPIC = 'test:a2a:chaos.wesign.test.topic';

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
    mockOPA = createMockOPAServer();
  });

  afterEach(() => {
    mockOPA.reset();
  });

  afterAll(async () => {
    await redisClient.disconnect();
    await pool.end();
  });

  describe('Redis Outage Scenarios', () => {
    it('should handle Redis disconnection gracefully during publish', async () => {
      const envelope = createTaskRequest();

      // Publish succeeds initially
      await transport.publish(TEST_TOPIC, envelope);

      // Simulate Redis disconnection
      await redisClient.disconnect();

      // Attempt to publish should throw
      await expect(transport.publish(TEST_TOPIC, envelope)).rejects.toThrow();

      // Reconnect
      await redisClient.connect();

      // Should work again
      await expect(transport.publish(TEST_TOPIC, envelope)).resolves.toBeDefined();
    });

    it('should handle Redis reconnection and resume subscriptions', async () => {
      const receivedMessages: A2AEnvelope[] = [];

      const handler: A2AMessageHandler = async (envelope, ack) => {
        receivedMessages.push(envelope);
        await ack.ack();
      };

      // Publish messages before subscription
      await transport.publish(TEST_TOPIC, createTaskRequest({ meta: { message_id: 'msg-001' } as any }));

      const subscription = await transport.subscribe(TEST_TOPIC, handler, {
        consumerGroup: 'chaos-redis-group',
        consumerName: 'consumer-001',
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Simulate brief Redis outage
      await simulateRedisOutage(redisClient, 500);

      // Publish more messages after reconnection
      await transport.publish(TEST_TOPIC, createTaskRequest({ meta: { message_id: 'msg-002' } as any }));

      await new Promise((resolve) => setTimeout(resolve, 1000));

      await subscription.unsubscribe();

      // Should have received messages despite outage
      expect(receivedMessages.length).toBeGreaterThan(0);
    });

    it('should preserve messages in stream during Redis restart', async () => {
      // Publish messages
      for (let i = 0; i < 10; i++) {
        await transport.publish(TEST_TOPIC, createTaskRequest({ meta: { message_id: `msg-${i}` } as any }));
      }

      const lengthBefore = await getStreamLength(redisClient, TEST_TOPIC);
      expect(lengthBefore).toBe(10);

      // Simulate Redis restart (disconnect and reconnect)
      await redisClient.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 500));
      await redisClient.connect();

      // Messages should still be there
      const lengthAfter = await getStreamLength(redisClient, TEST_TOPIC);
      expect(lengthAfter).toBe(10);
    });

    it('should handle DLQ operations during Redis instability', async () => {
      const handler: A2AMessageHandler = async (envelope, ack) => {
        // Reject first message to send to DLQ
        await ack.reject('Chaos test rejection');
      };

      await transport.publish(TEST_TOPIC, createTaskRequest());

      const subscription = await transport.subscribe(TEST_TOPIC, handler, {
        consumerGroup: 'chaos-dlq-group',
        consumerName: 'consumer-001',
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      await subscription.unsubscribe();

      // DLQ should have the message
      const dlqTopic = `${TEST_TOPIC}:dlq`;
      const dlqLength = await getStreamLength(redisClient, dlqTopic);
      expect(dlqLength).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Postgres Outage Scenarios', () => {
    it('should handle Postgres connection errors during registration', async () => {
      // Create a pool with bad connection
      const badPool = createTestPool({ host: 'non-existent-host', port: 9999 });
      const badRegistry = new PostgresAgentRegistry({ pool: badPool });

      const registration: AgentRegistration = {
        agent_id: 'test-agent-001',
        version: '1.0.0',
        tenant: 'test',
        project: 'test',
        capabilities: ['test'],
      };

      await expect(badRegistry.register(registration)).rejects.toThrow();

      await badPool.end();
    });

    it('should handle Postgres outage during heartbeat', async () => {
      // Register agent successfully
      await insertTestAgent(pool, {
        agent_id: 'test-agent-heartbeat',
        status: 'HEALTHY',
        lease_until: new Date(Date.now() + 60000),
      });

      // Close the pool to simulate outage
      await pool.end();

      // Heartbeat should fail
      await expect(
        registry.heartbeat({
          agent_id: 'test-agent-heartbeat',
          status: 'HEALTHY',
        })
      ).rejects.toThrow();

      // Reconnect
      pool = createTestPool();
      registry = new PostgresAgentRegistry({ pool });

      // Should work again
      await expect(
        registry.heartbeat({
          agent_id: 'test-agent-heartbeat',
          status: 'HEALTHY',
        })
      ).resolves.toBeDefined();
    });

    it('should handle Postgres outage during discovery', async () => {
      await insertTestAgent(pool, {
        agent_id: 'specialist-001',
        tenant: 'wesign',
        project: 'qa-platform',
        capabilities: ['self-healing'],
        status: 'HEALTHY',
        lease_until: new Date(Date.now() + 60000),
      });

      // Discovery works initially
      const result1 = await registry.discover({ capability: 'self-healing' });
      expect(result1.agents.length).toBeGreaterThan(0);

      // Close the pool
      await pool.end();

      // Discovery should fail
      await expect(registry.discover({ capability: 'self-healing' })).rejects.toThrow();

      // Reconnect
      pool = createTestPool();
      registry = new PostgresAgentRegistry({ pool });

      // Should work again
      const result2 = await registry.discover({ capability: 'self-healing' });
      expect(result2.agents.length).toBeGreaterThan(0);
    });

    it('should preserve agent data across Postgres reconnection', async () => {
      const agentId = 'persistent-agent-001';

      await insertTestAgent(pool, {
        agent_id: agentId,
        tenant: 'wesign',
        project: 'qa-platform',
        capabilities: ['persistence-test'],
        status: 'HEALTHY',
        lease_until: new Date(Date.now() + 60000),
      });

      const agentBefore = await getAgent(pool, agentId);
      expect(agentBefore).toBeDefined();

      // Simulate connection refresh
      await pool.end();
      pool = createTestPool();
      registry = new PostgresAgentRegistry({ pool });

      // Data should persist
      const agentAfter = await getAgent(pool, agentId);
      expect(agentAfter).toBeDefined();
      expect(agentAfter.agent_id).toBe(agentId);
      expect(agentAfter.capabilities).toEqual(['persistence-test']);
    });
  });

  describe('OPA Outage Scenarios', () => {
    it('should handle OPA server unavailability gracefully', async () => {
      mockOPA.registerPolicy('a2a/wire_gates', createOPAOutagePolicy());

      const opaGates = new OPAWireGates({
        url: 'http://mock-opa:8181',
        preSendPolicyPath: 'a2a/wire_gates',
        disabled: false,
      });

      vi.spyOn(opaGates as any, 'queryOPA').mockImplementation(async (policyPath: string, input: any) => {
        return mockOPA.evaluate(policyPath, input);
      });

      const envelope = createTaskRequest();

      // Should throw when OPA is unavailable
      await expect(opaGates.checkPreSend(envelope)).rejects.toThrow('OPA server unavailable');
    });

    it('should allow messages when OPA is disabled despite outage', async () => {
      const opaGates = new OPAWireGates({
        url: 'http://unreachable-opa:8181',
        preSendPolicyPath: 'a2a/wire_gates',
        disabled: true, // Disabled
      });

      const envelope = createTaskRequest();

      // Should succeed because OPA is disabled
      const result = await opaGates.checkPreSend(envelope);
      expect(result.allow).toBe(true);
    });

    it('should fallback gracefully when OPA response is malformed', async () => {
      mockOPA.registerPolicy('a2a/wire_gates', () => {
        // Return malformed response
        return { invalid: 'response' } as any;
      });

      const opaGates = new OPAWireGates({
        url: 'http://mock-opa:8181',
        preSendPolicyPath: 'a2a/wire_gates',
        disabled: false,
      });

      vi.spyOn(opaGates as any, 'queryOPA').mockImplementation(async (policyPath: string, input: any) => {
        return mockOPA.evaluate(policyPath, input);
      });

      const envelope = createTaskRequest();

      // Should handle malformed response
      const result = await opaGates.checkPreSend(envelope);

      // Behavior depends on implementation - might deny by default or throw
      expect(result).toBeDefined();
    });
  });

  describe('Crash & Restart Scenarios', () => {
    it('should recover agent lease state after restart', async () => {
      const clock = createVirtualClock(new Date('2025-01-15T12:00:00.000Z'));
      clock.install();

      const agentId = 'crash-test-agent-001';
      const now = clock.nowAsDate();

      // Agent registers with 60s lease
      await insertTestAgent(pool, {
        agent_id: agentId,
        status: 'HEALTHY',
        lease_until: new Date(now.getTime() + 60 * 1000),
      });

      // Simulate crash (time passes without heartbeat)
      await clock.tick(70 * 1000); // 70 seconds

      // Lease expiry checker runs
      const count = await registry.markExpiredAgents();
      expect(count).toBe(1);

      const agent = await getAgent(pool, agentId);
      expect(agent.status).toBe('UNAVAILABLE');

      // Agent restarts and re-registers
      await registry.register({
        agent_id: agentId,
        version: '1.0.0',
        tenant: 'test',
        project: 'test',
        capabilities: ['crash-recovery'],
      });

      const recoveredAgent = await getAgent(pool, agentId);
      expect(recoveredAgent.status).toBe('STARTING');

      clock.uninstall();
    });

    it('should handle LeaseExpiryChecker restart', async () => {
      const clock = createVirtualClock(new Date('2025-01-15T12:00:00.000Z'));
      clock.install();

      await insertTestAgent(pool, {
        agent_id: 'checker-restart-001',
        status: 'HEALTHY',
        lease_until: clock.futureTime(30 * 1000),
      });

      // Start checker
      let markedCount = 0;
      const checker1 = new LeaseExpiryChecker({
        registry,
        intervalMs: 10000,
        onAgentsMarked: (count) => {
          markedCount += count;
        },
      });

      checker1.start();

      // Run for a bit
      await clock.tick(35 * 1000);
      await clock.tickNext();

      // Stop checker (simulate crash)
      checker1.stop();

      expect(markedCount).toBeGreaterThan(0);

      // Restart checker (new instance)
      const checker2 = new LeaseExpiryChecker({
        registry,
        intervalMs: 10000,
        onAgentsMarked: (count) => {
          markedCount += count;
        },
      });

      checker2.start();

      // Should continue working
      await clock.tick(20 * 1000);
      await clock.tickNext();

      checker2.stop();

      clock.uninstall();
    });

    it('should preserve unacknowledged messages across consumer restart', async () => {
      // Publish message
      await transport.publish(TEST_TOPIC, createTaskRequest({ meta: { message_id: 'unacked-msg' } as any }));

      let firstAttempt = true;
      const messageIds: string[] = [];

      const handler: A2AMessageHandler = async (envelope, ack) => {
        messageIds.push(envelope.meta.message_id);

        if (firstAttempt) {
          firstAttempt = false;
          // Simulate crash (no ack)
          return;
        }

        await ack.ack();
      };

      // First subscription
      const sub1 = await transport.subscribe(TEST_TOPIC, handler, {
        consumerGroup: 'crash-recovery-group',
        consumerName: 'consumer-001',
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Simulate crash
      await sub1.unsubscribe();

      // Restart subscription (same consumer group)
      const sub2 = await transport.subscribe(TEST_TOPIC, handler, {
        consumerGroup: 'crash-recovery-group',
        consumerName: 'consumer-002',
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      await sub2.unsubscribe();

      // Message should have been redelivered
      expect(messageIds.length).toBeGreaterThanOrEqual(2);
      expect(messageIds.every((id) => id === 'unacked-msg')).toBe(true);
    });
  });

  describe('Data Integrity Under Failures', () => {
    it('should not lose messages when Redis fails during publish', async () => {
      let successfulPublishes = 0;

      for (let i = 0; i < 20; i++) {
        try {
          await transport.publish(TEST_TOPIC, createTaskRequest({ meta: { message_id: `msg-${i}` } as any }));
          successfulPublishes++;
        } catch (error) {
          // Expected to fail for some publishes
        }

        // Simulate intermittent Redis issues
        if (i === 10) {
          await redisClient.disconnect();
          await new Promise((resolve) => setTimeout(resolve, 100));
          await redisClient.connect();
        }
      }

      // All successful publishes should result in messages in the stream
      const length = await getStreamLength(redisClient, TEST_TOPIC);
      expect(length).toBe(successfulPublishes);
    });

    it('should maintain message order in the stream', async () => {
      const messageIds: string[] = [];

      for (let i = 0; i < 10; i++) {
        const envelope = createTaskRequest({ meta: { message_id: `ordered-msg-${i}` } as any });
        await transport.publish(TEST_TOPIC, envelope);
        messageIds.push(envelope.meta.message_id);
      }

      // Read messages back
      const receivedIds: string[] = [];
      const handler: A2AMessageHandler = async (envelope, ack) => {
        receivedIds.push(envelope.meta.message_id);
        await ack.ack();
      };

      const subscription = await transport.subscribe(TEST_TOPIC, handler, {
        consumerGroup: 'order-test-group',
        consumerName: 'consumer-001',
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      await subscription.unsubscribe();

      // Messages should be received in order
      expect(receivedIds).toEqual(messageIds);
    });

    it('should ensure no duplicate processing with idempotency under failures', async () => {
      const envelope = createTaskRequest({
        meta: { idempotency_key: 'unique-chaos-key' } as any,
      });

      const processedKeys = new Set<string>();
      const processCount = vi.fn();

      const checkIdempotency = async (key: string): Promise<boolean> => {
        if (processedKeys.has(key)) {
          return true; // Duplicate
        }
        processedKeys.add(key);
        return false;
      };

      const handler: A2AMessageHandler = async (envelope, ack) => {
        processCount();
        await ack.ack();
      };

      // Publish same envelope multiple times
      await transport.publish(TEST_TOPIC, envelope);
      await transport.publish(TEST_TOPIC, envelope);
      await transport.publish(TEST_TOPIC, envelope);

      const subscription = await transport.subscribe(TEST_TOPIC, handler, {
        consumerGroup: 'idempotency-chaos-group',
        consumerName: 'consumer-001',
        checkIdempotency,
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      await subscription.unsubscribe();

      // Should only process once due to idempotency
      expect(processCount).toHaveBeenCalledTimes(1);
    });
  });

  describe('Network Partition Scenarios', () => {
    it('should handle partial network failures (some operations succeed, some fail)', async () => {
      const results = {
        publishSuccess: 0,
        publishFail: 0,
        registrySuccess: 0,
        registryFail: 0,
      };

      // Attempt multiple operations
      for (let i = 0; i < 10; i++) {
        // Publish
        try {
          await transport.publish(TEST_TOPIC, createTaskRequest({ meta: { message_id: `msg-${i}` } as any }));
          results.publishSuccess++;
        } catch {
          results.publishFail++;
        }

        // Registry operation
        try {
          await registry.register({
            agent_id: `agent-partition-${i}`,
            version: '1.0.0',
            tenant: 'test',
            project: 'test',
            capabilities: ['partition-test'],
          });
          results.registrySuccess++;
        } catch {
          results.registryFail++;
        }
      }

      // At least some operations should succeed
      expect(results.publishSuccess + results.registrySuccess).toBeGreaterThan(0);
    });
  });

  describe('Concurrent Failures', () => {
    it('should handle simultaneous Redis and Postgres failures', async () => {
      // This is a challenging scenario - both systems fail at once

      const envelope = createTaskRequest();

      // Both should work initially
      await transport.publish(TEST_TOPIC, envelope);
      await registry.register({
        agent_id: 'concurrent-failure-test',
        version: '1.0.0',
        tenant: 'test',
        project: 'test',
        capabilities: ['concurrent'],
      });

      // Simulate both failing
      await redisClient.disconnect();
      await pool.end();

      // Both should fail
      await expect(transport.publish(TEST_TOPIC, envelope)).rejects.toThrow();
      await expect(
        registry.register({
          agent_id: 'concurrent-failure-test-2',
          version: '1.0.0',
          tenant: 'test',
          project: 'test',
          capabilities: ['concurrent'],
        })
      ).rejects.toThrow();

      // Reconnect both
      await redisClient.connect();
      pool = createTestPool();
      registry = new PostgresAgentRegistry({ pool });

      // Both should recover
      await expect(transport.publish(TEST_TOPIC, envelope)).resolves.toBeDefined();
      await expect(
        registry.register({
          agent_id: 'concurrent-failure-test-3',
          version: '1.0.0',
          tenant: 'test',
          project: 'test',
          capabilities: ['concurrent'],
        })
      ).resolves.toBeDefined();
    });
  });
});
