/**
 * A2A Registry Tests
 * Postgres-backed agent registry with lease management, heartbeats, and discovery
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import type { Pool } from 'pg';
import { PostgresAgentRegistry } from '../../src/a2a/registry/pg.js';
import { LeaseExpiryChecker, HeartbeatPublisher } from '../../src/a2a/registry/health.js';
import type {
  AgentRegistration,
  AgentHeartbeat,
  AgentDiscoveryFilters,
  RegistryLease,
} from '../../src/a2a/registry/types.js';
import {
  createTestPool,
  truncateTestTables,
  insertTestAgent,
  insertTestAgentTopic,
  getAgent,
  getAgentsForTenantProject,
  getAgentTopics,
  countAgentsByStatus,
  updateAgentLease,
  cleanupTestAgents,
} from '../utils/postgres.js';
import { createVirtualClock, simulateLeaseExpiry, VirtualClock } from '../utils/clock.js';

describe('A2A Registry Tests', () => {
  let pool: Pool;
  let registry: PostgresAgentRegistry;

  beforeAll(async () => {
    pool = createTestPool();
    registry = new PostgresAgentRegistry({ pool });
  });

  beforeEach(async () => {
    await truncateTestTables(pool);
  });

  afterAll(async () => {
    await cleanupTestAgents(pool);
    await pool.end();
  });

  describe('Agent Registration', () => {
    it('should register a new agent with default lease duration', async () => {
      const registration: AgentRegistration = {
        agent_id: 'test-agent-001',
        version: '1.0.0',
        tenant: 'wesign',
        project: 'qa-platform',
        capabilities: ['code-review', 'test-healing'],
        topics: [
          { topic: 'qa.wesign.qa-platform.specialists.healing.invoke', role: 'subscriber' },
        ],
      };

      const lease = await registry.register(registration);

      expect(lease.agent_id).toBe('test-agent-001');
      expect(lease.lease_until).toBeInstanceOf(Date);
      expect(lease.lease_duration_seconds).toBe(60); // Default

      const agent = await getAgent(pool, 'test-agent-001');
      expect(agent).toBeDefined();
      expect(agent.status).toBe('STARTING'); // Default initial status
      expect(agent.capabilities).toEqual(['code-review', 'test-healing']);
    });

    it('should register agent with custom lease duration', async () => {
      const registration: AgentRegistration = {
        agent_id: 'test-agent-002',
        version: '1.0.0',
        tenant: 'wesign',
        project: 'qa-platform',
        capabilities: ['self-healing'],
        lease_duration_seconds: 120,
      };

      const lease = await registry.register(registration);

      expect(lease.lease_duration_seconds).toBe(120);

      const leaseEnd = new Date(lease.lease_until);
      const expectedEnd = new Date(Date.now() + 120 * 1000);
      const diff = Math.abs(leaseEnd.getTime() - expectedEnd.getTime());
      expect(diff).toBeLessThan(2000); // Within 2 seconds
    });

    it('should register agent with HEALTHY initial status', async () => {
      const registration: AgentRegistration = {
        agent_id: 'test-agent-003',
        version: '1.0.0',
        tenant: 'wesign',
        project: 'qa-platform',
        capabilities: ['memory-indexing'],
        initial_status: 'HEALTHY',
      };

      await registry.register(registration);

      const agent = await getAgent(pool, 'test-agent-003');
      expect(agent.status).toBe('HEALTHY');
    });

    it('should register agent with metadata', async () => {
      const registration: AgentRegistration = {
        agent_id: 'test-agent-004',
        version: '1.0.0',
        tenant: 'wesign',
        project: 'qa-platform',
        capabilities: ['context-enrichment'],
        metadata: {
          deployment: 'docker',
          region: 'us-west-2',
        },
      };

      await registry.register(registration);

      const agent = await getAgent(pool, 'test-agent-004');
      expect(agent.metadata).toEqual({
        deployment: 'docker',
        region: 'us-west-2',
      });
    });

    it('should update existing agent on re-registration', async () => {
      const initialReg: AgentRegistration = {
        agent_id: 'test-agent-005',
        version: '1.0.0',
        tenant: 'wesign',
        project: 'qa-platform',
        capabilities: ['old-capability'],
      };

      await registry.register(initialReg);

      const updatedReg: AgentRegistration = {
        agent_id: 'test-agent-005',
        version: '1.1.0',
        tenant: 'wesign',
        project: 'qa-platform',
        capabilities: ['new-capability'],
      };

      await registry.register(updatedReg);

      const agent = await getAgent(pool, 'test-agent-005');
      expect(agent.version).toBe('1.1.0');
      expect(agent.capabilities).toEqual(['new-capability']);
    });

    it('should register agent topics', async () => {
      const registration: AgentRegistration = {
        agent_id: 'test-agent-006',
        version: '1.0.0',
        tenant: 'wesign',
        project: 'qa-platform',
        capabilities: ['multi-topic'],
        topics: [
          { topic: 'qa.wesign.qa-platform.specialists.healing.invoke', role: 'subscriber' },
          { topic: 'qa.wesign.qa-platform.events.healing.result', role: 'publisher' },
          { topic: 'qa.wesign.qa-platform.system.events.broadcast', role: 'both' },
        ],
      };

      await registry.register(registration);

      const topics = await getAgentTopics(pool, 'test-agent-006');
      expect(topics).toHaveLength(3);
      expect(topics.find((t) => t.role === 'subscriber')).toBeDefined();
      expect(topics.find((t) => t.role === 'publisher')).toBeDefined();
      expect(topics.find((t) => t.role === 'both')).toBeDefined();
    });
  });

  describe('Heartbeat & Lease Renewal', () => {
    beforeEach(async () => {
      await insertTestAgent(pool, {
        agent_id: 'test-agent-heartbeat-001',
        status: 'HEALTHY',
        lease_until: new Date(Date.now() + 60000),
      });
    });

    it('should send heartbeat and renew lease', async () => {
      const heartbeat: AgentHeartbeat = {
        agent_id: 'test-agent-heartbeat-001',
        status: 'HEALTHY',
      };

      const lease = await registry.heartbeat(heartbeat);

      expect(lease.agent_id).toBe('test-agent-heartbeat-001');
      expect(lease.lease_until).toBeInstanceOf(Date);

      const agent = await getAgent(pool, 'test-agent-heartbeat-001');
      expect(agent.status).toBe('HEALTHY');
      expect(new Date(agent.last_heartbeat).getTime()).toBeGreaterThan(Date.now() - 5000);
    });

    it('should update agent status on heartbeat', async () => {
      const heartbeat: AgentHeartbeat = {
        agent_id: 'test-agent-heartbeat-001',
        status: 'DEGRADED',
      };

      await registry.heartbeat(heartbeat);

      const agent = await getAgent(pool, 'test-agent-heartbeat-001');
      expect(agent.status).toBe('DEGRADED');
    });

    it('should support custom lease duration on heartbeat', async () => {
      const heartbeat: AgentHeartbeat = {
        agent_id: 'test-agent-heartbeat-001',
        status: 'HEALTHY',
      };

      const lease = await registry.heartbeat(heartbeat, 180); // 3 minutes

      expect(lease.lease_duration_seconds).toBe(180);

      const leaseEnd = new Date(lease.lease_until);
      const expectedEnd = new Date(Date.now() + 180 * 1000);
      const diff = Math.abs(leaseEnd.getTime() - expectedEnd.getTime());
      expect(diff).toBeLessThan(2000);
    });

    it('should throw error for heartbeat from non-existent agent', async () => {
      const heartbeat: AgentHeartbeat = {
        agent_id: 'non-existent-agent',
        status: 'HEALTHY',
      };

      await expect(registry.heartbeat(heartbeat)).rejects.toThrow('Agent not found');
    });
  });

  describe('Lease Expiry Management', () => {
    let clock: VirtualClock;

    beforeEach(() => {
      clock = createVirtualClock(new Date('2025-01-15T12:00:00.000Z'));
      clock.install();
    });

    afterEach(() => {
      clock.uninstall();
    });

    it('should mark agents with expired leases as UNAVAILABLE', async () => {
      // Register agent with 60s lease
      const now = clock.nowAsDate();
      await insertTestAgent(pool, {
        agent_id: 'test-agent-expiry-001',
        status: 'HEALTHY',
        lease_until: new Date(now.getTime() + 60 * 1000),
      });

      // Advance time to expire lease
      await simulateLeaseExpiry(clock, 60 * 1000);

      // Manually mark expired agents
      const count = await registry.markExpiredAgents();

      expect(count).toBe(1);

      const agent = await getAgent(pool, 'test-agent-expiry-001');
      expect(agent.status).toBe('UNAVAILABLE');
    });

    it('should not mark agents with valid leases', async () => {
      const now = clock.nowAsDate();
      await insertTestAgent(pool, {
        agent_id: 'test-agent-valid-001',
        status: 'HEALTHY',
        lease_until: new Date(now.getTime() + 120 * 1000), // 2 minutes
      });

      // Advance time only 30 seconds
      await clock.tick(30 * 1000);

      const count = await registry.markExpiredAgents();

      expect(count).toBe(0);

      const agent = await getAgent(pool, 'test-agent-valid-001');
      expect(agent.status).toBe('HEALTHY');
    });

    it('should handle multiple agents with different lease states', async () => {
      const now = clock.nowAsDate();

      await insertTestAgent(pool, {
        agent_id: 'test-agent-multi-001',
        status: 'HEALTHY',
        lease_until: new Date(now.getTime() + 30 * 1000), // Expires in 30s
      });

      await insertTestAgent(pool, {
        agent_id: 'test-agent-multi-002',
        status: 'HEALTHY',
        lease_until: new Date(now.getTime() + 120 * 1000), // Expires in 120s
      });

      // Advance 60 seconds
      await clock.tick(60 * 1000);

      const count = await registry.markExpiredAgents();

      expect(count).toBe(1); // Only one agent expired

      const agent1 = await getAgent(pool, 'test-agent-multi-001');
      const agent2 = await getAgent(pool, 'test-agent-multi-002');

      expect(agent1.status).toBe('UNAVAILABLE');
      expect(agent2.status).toBe('HEALTHY');
    });
  });

  describe('Lease Expiry Checker (Background Job)', () => {
    let clock: VirtualClock;

    beforeEach(() => {
      clock = createVirtualClock(new Date('2025-01-15T12:00:00.000Z'));
      clock.install();
    });

    afterEach(() => {
      clock.uninstall();
    });

    it('should periodically check and mark expired agents', async () => {
      const now = clock.nowAsDate();
      await insertTestAgent(pool, {
        agent_id: 'test-agent-checker-001',
        status: 'HEALTHY',
        lease_until: new Date(now.getTime() + 30 * 1000),
      });

      const markedAgents: number[] = [];
      const checker = new LeaseExpiryChecker({
        registry,
        intervalMs: 10000, // Check every 10s
        onAgentsMarked: (count) => markedAgents.push(count),
      });

      checker.start();

      // Advance 35 seconds to expire the agent
      await clock.tick(35 * 1000);

      // Wait for the checker to run
      await clock.tickNext();

      checker.stop();

      expect(markedAgents.length).toBeGreaterThan(0);
      expect(markedAgents.reduce((sum, count) => sum + count, 0)).toBeGreaterThanOrEqual(1);

      const agent = await getAgent(pool, 'test-agent-checker-001');
      expect(agent.status).toBe('UNAVAILABLE');
    });

    it('should stop checking when stopped', async () => {
      const checker = new LeaseExpiryChecker({
        registry,
        intervalMs: 10000,
      });

      checker.start();
      expect(checker.isRunning()).toBe(true);

      checker.stop();
      expect(checker.isRunning()).toBe(false);
    });
  });

  describe('Heartbeat Publisher (Background Job)', () => {
    let clock: VirtualClock;

    beforeEach(async () => {
      clock = createVirtualClock(new Date('2025-01-15T12:00:00.000Z'));
      clock.install();

      await insertTestAgent(pool, {
        agent_id: 'test-agent-publisher-001',
        status: 'HEALTHY',
        lease_until: clock.futureTime(60 * 1000),
      });
    });

    afterEach(() => {
      clock.uninstall();
    });

    it('should periodically publish heartbeats', async () => {
      let heartbeatCount = 0;

      const publisher = new HeartbeatPublisher({
        agentId: 'test-agent-publisher-001',
        registry,
        intervalMs: 20000, // Every 20 seconds
        statusProvider: () => Promise.resolve('HEALTHY'),
        onHeartbeatSent: () => {
          heartbeatCount++;
        },
      });

      await publisher.start();

      // Advance time to trigger multiple heartbeats
      await clock.tick(60 * 1000); // 60 seconds = 3 heartbeats

      await clock.tickNext();

      publisher.stop();

      expect(heartbeatCount).toBeGreaterThanOrEqual(3);
    });

    it('should support dynamic status updates', async () => {
      const statuses = ['HEALTHY', 'DEGRADED', 'HEALTHY'];
      let statusIndex = 0;

      const publisher = new HeartbeatPublisher({
        agentId: 'test-agent-publisher-001',
        registry,
        intervalMs: 20000,
        statusProvider: async () => statuses[statusIndex++ % statuses.length] as any,
      });

      await publisher.start();

      // Send 3 heartbeats
      await clock.tick(60 * 1000);
      await clock.tickNext();

      publisher.stop();

      const agent = await getAgent(pool, 'test-agent-publisher-001');
      expect(['HEALTHY', 'DEGRADED']).toContain(agent.status);
    });
  });

  describe('Agent Discovery', () => {
    beforeEach(async () => {
      await insertTestAgent(pool, {
        agent_id: 'specialist-healing-001',
        version: '1.0.0',
        tenant: 'wesign',
        project: 'qa-platform',
        capabilities: ['self-healing', 'locator-generation'],
        status: 'HEALTHY',
        lease_until: new Date(Date.now() + 60000),
      });

      await insertTestAgent(pool, {
        agent_id: 'specialist-healing-002',
        version: '1.0.0',
        tenant: 'wesign',
        project: 'qa-platform',
        capabilities: ['self-healing', 'test-repair'],
        status: 'HEALTHY',
        lease_until: new Date(Date.now() + 60000),
      });

      await insertTestAgent(pool, {
        agent_id: 'specialist-context-001',
        version: '1.0.0',
        tenant: 'wesign',
        project: 'qa-platform',
        capabilities: ['context-enrichment'],
        status: 'HEALTHY',
        lease_until: new Date(Date.now() + 60000),
      });

      await insertTestAgent(pool, {
        agent_id: 'specialist-other-tenant',
        version: '1.0.0',
        tenant: 'other-tenant',
        project: 'other-project',
        capabilities: ['self-healing'],
        status: 'HEALTHY',
        lease_until: new Date(Date.now() + 60000),
      });
    });

    it('should discover agents by capability', async () => {
      const filters: AgentDiscoveryFilters = {
        capability: 'self-healing',
      };

      const result = await registry.discover(filters);

      expect(result.agents.length).toBeGreaterThanOrEqual(2);
      expect(result.agents.every((a) => a.capabilities.includes('self-healing'))).toBe(true);
    });

    it('should discover agents by tenant', async () => {
      const filters: AgentDiscoveryFilters = {
        tenant: 'wesign',
      };

      const result = await registry.discover(filters);

      expect(result.agents.length).toBe(3);
      expect(result.agents.every((a) => a.tenant === 'wesign')).toBe(true);
    });

    it('should discover agents by project', async () => {
      const filters: AgentDiscoveryFilters = {
        project: 'qa-platform',
      };

      const result = await registry.discover(filters);

      expect(result.agents.length).toBe(3);
      expect(result.agents.every((a) => a.project === 'qa-platform')).toBe(true);
    });

    it('should discover agents by tenant AND project', async () => {
      const filters: AgentDiscoveryFilters = {
        tenant: 'wesign',
        project: 'qa-platform',
      };

      const result = await registry.discover(filters);

      expect(result.agents.length).toBe(3);
      expect(result.agents.every((a) => a.tenant === 'wesign' && a.project === 'qa-platform')).toBe(true);
    });

    it('should discover agents by capability AND tenant', async () => {
      const filters: AgentDiscoveryFilters = {
        capability: 'self-healing',
        tenant: 'wesign',
      };

      const result = await registry.discover(filters);

      expect(result.agents.length).toBe(2);
      expect(result.agents.every((a) => a.capabilities.includes('self-healing') && a.tenant === 'wesign')).toBe(
        true
      );
    });

    it('should filter by status', async () => {
      // Mark one agent as UNAVAILABLE
      await pool.query(`UPDATE agents SET status = 'UNAVAILABLE' WHERE agent_id = 'specialist-healing-002'`);

      const filters: AgentDiscoveryFilters = {
        status: 'HEALTHY',
      };

      const result = await registry.discover(filters);

      expect(result.agents.every((a) => a.status === 'HEALTHY')).toBe(true);
      expect(result.agents.find((a) => a.agent_id === 'specialist-healing-002')).toBeUndefined();
    });

    it('should return empty result for non-existent capability', async () => {
      const filters: AgentDiscoveryFilters = {
        capability: 'non-existent-capability',
      };

      const result = await registry.discover(filters);

      expect(result.agents).toHaveLength(0);
      expect(result.total_count).toBe(0);
    });

    it('should support pagination', async () => {
      const filters: AgentDiscoveryFilters = {
        tenant: 'wesign',
        limit: 2,
        offset: 0,
      };

      const page1 = await registry.discover(filters);
      expect(page1.agents).toHaveLength(2);

      const page2 = await registry.discover({ ...filters, offset: 2 });
      expect(page2.agents).toHaveLength(1);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent registrations', async () => {
      const registrations = Array.from({ length: 10 }, (_, i) => ({
        agent_id: `concurrent-agent-${i}`,
        version: '1.0.0',
        tenant: 'test',
        project: 'concurrent',
        capabilities: [`cap-${i}`],
      }));

      await Promise.all(registrations.map((r) => registry.register(r)));

      const count = await countAgentsByStatus('STARTING');
      expect(count).toBeGreaterThanOrEqual(10);
    });

    it('should handle concurrent heartbeats', async () => {
      // Pre-create agents
      for (let i = 0; i < 5; i++) {
        await insertTestAgent(pool, {
          agent_id: `heartbeat-agent-${i}`,
          status: 'HEALTHY',
          lease_until: new Date(Date.now() + 60000),
        });
      }

      const heartbeats = Array.from({ length: 5 }, (_, i) => ({
        agent_id: `heartbeat-agent-${i}`,
        status: 'HEALTHY' as const,
      }));

      await Promise.all(heartbeats.map((h) => registry.heartbeat(h)));

      const count = await countAgentsByStatus('HEALTHY');
      expect(count).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for invalid agent registration', async () => {
      const invalidReg: any = {
        // Missing required fields
        agent_id: 'invalid-agent',
      };

      await expect(registry.register(invalidReg)).rejects.toThrow();
    });

    it('should handle database connection errors gracefully', async () => {
      const badPool = createTestPool({ host: 'non-existent-host' });
      const badRegistry = new PostgresAgentRegistry({ pool: badPool });

      await expect(
        badRegistry.register({
          agent_id: 'test',
          version: '1.0.0',
          tenant: 'test',
          project: 'test',
          capabilities: [],
        })
      ).rejects.toThrow();

      await badPool.end();
    });
  });
});
