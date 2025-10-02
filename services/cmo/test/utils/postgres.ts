/**
 * Postgres Test Helpers
 * Utilities for setting up and tearing down Postgres data in tests
 */

import type { Pool, PoolClient, QueryResult } from 'pg';
import pkg from 'pg';
const { Pool: PgPool } = pkg;

/**
 * Postgres test configuration
 */
export interface PostgresTestConfig {
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
}

/**
 * Default test Postgres config (override with env vars)
 */
export const DEFAULT_POSTGRES_TEST_CONFIG: PostgresTestConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  database: process.env.POSTGRES_TEST_DB || 'qa_intel_test',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
};

/**
 * Create a Postgres pool for testing
 */
export function createTestPool(config: PostgresTestConfig = {}): Pool {
  const finalConfig = { ...DEFAULT_POSTGRES_TEST_CONFIG, ...config };

  return new PgPool({
    host: finalConfig.host,
    port: finalConfig.port,
    database: finalConfig.database,
    user: finalConfig.user,
    password: finalConfig.password,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
}

/**
 * Cleanup test agents
 */
export async function cleanupTestAgents(pool: Pool, testPrefix: string = 'test-agent'): Promise<number> {
  const result = await pool.query(`DELETE FROM agents WHERE agent_id LIKE $1`, [`${testPrefix}%`]);
  return result.rowCount || 0;
}

/**
 * Cleanup all agents
 */
export async function cleanupAllAgents(pool: Pool): Promise<number> {
  const result = await pool.query(`DELETE FROM agents`);
  return result.rowCount || 0;
}

/**
 * Cleanup all agent topics
 */
export async function cleanupAllAgentTopics(pool: Pool): Promise<number> {
  const result = await pool.query(`DELETE FROM agent_topics`);
  return result.rowCount || 0;
}

/**
 * Insert a test agent
 */
export async function insertTestAgent(
  pool: Pool,
  agent: {
    agent_id: string;
    version?: string;
    tenant?: string;
    project?: string;
    capabilities?: string[];
    status?: 'STARTING' | 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';
    lease_until?: Date;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  await pool.query(
    `INSERT INTO agents (agent_id, version, tenant, project, capabilities, status, last_heartbeat, lease_until, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8)`,
    [
      agent.agent_id,
      agent.version || '1.0.0',
      agent.tenant || 'test-tenant',
      agent.project || 'test-project',
      JSON.stringify(agent.capabilities || []),
      agent.status || 'HEALTHY',
      agent.lease_until || new Date(Date.now() + 60000),
      JSON.stringify(agent.metadata || {}),
    ]
  );
}

/**
 * Insert a test agent topic
 */
export async function insertTestAgentTopic(
  pool: Pool,
  topic: {
    agent_id: string;
    topic: string;
    role: 'publisher' | 'subscriber' | 'both';
  }
): Promise<void> {
  await pool.query(
    `INSERT INTO agent_topics (agent_id, topic, role) VALUES ($1, $2, $3)
     ON CONFLICT (agent_id, topic, role) DO NOTHING`,
    [topic.agent_id, topic.topic, topic.role]
  );
}

/**
 * Get agent by ID
 */
export async function getAgent(pool: Pool, agentId: string): Promise<any | null> {
  const result = await pool.query(`SELECT * FROM agents WHERE agent_id = $1`, [agentId]);
  return result.rows[0] || null;
}

/**
 * Get all agents for a tenant/project
 */
export async function getAgentsForTenantProject(
  pool: Pool,
  tenant: string,
  project: string
): Promise<any[]> {
  const result = await pool.query(
    `SELECT * FROM agents WHERE tenant = $1 AND project = $2 ORDER BY created_at DESC`,
    [tenant, project]
  );
  return result.rows;
}

/**
 * Get agent topics
 */
export async function getAgentTopics(pool: Pool, agentId: string): Promise<any[]> {
  const result = await pool.query(
    `SELECT * FROM agent_topics WHERE agent_id = $1 ORDER BY created_at DESC`,
    [agentId]
  );
  return result.rows;
}

/**
 * Count agents by status
 */
export async function countAgentsByStatus(
  pool: Pool,
  status: 'STARTING' | 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE'
): Promise<number> {
  const result = await pool.query(`SELECT COUNT(*) as count FROM agents WHERE status = $1`, [status]);
  return parseInt(result.rows[0].count, 10);
}

/**
 * Mark agents as expired (simulate lease expiry)
 */
export async function markAgentsExpired(pool: Pool): Promise<number> {
  const result = await pool.query(`SELECT mark_expired_agents()`);
  return result.rows[0].mark_expired_agents || 0;
}

/**
 * Update agent lease_until (simulate time passing)
 */
export async function updateAgentLease(
  pool: Pool,
  agentId: string,
  leaseUntil: Date
): Promise<void> {
  await pool.query(`UPDATE agents SET lease_until = $2 WHERE agent_id = $1`, [agentId, leaseUntil]);
}

/**
 * Simulate Postgres outage (disconnect and reconnect)
 */
export async function simulatePostgresOutage(
  pool: Pool,
  durationMs: number
): Promise<void> {
  await pool.end();
  await new Promise((resolve) => setTimeout(resolve, durationMs));
  // Note: Pool needs to be recreated after end()
}

/**
 * Wait for agent count to reach N
 */
export async function waitForAgentCount(
  pool: Pool,
  expectedCount: number,
  timeoutMs: number = 5000
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const result = await pool.query(`SELECT COUNT(*) as count FROM agents`);
    const count = parseInt(result.rows[0].count, 10);
    if (count >= expectedCount) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return false;
}

/**
 * Truncate all test tables
 */
export async function truncateTestTables(pool: Pool): Promise<void> {
  await pool.query(`TRUNCATE TABLE agent_topics CASCADE`);
  await pool.query(`TRUNCATE TABLE agents CASCADE`);
}

/**
 * Get cmo_activities count (for idempotency testing)
 */
export async function getActivityCount(pool: Pool, traceId: string): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM cmo_activities WHERE trace_id = $1`,
    [traceId]
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * Get activity by idempotency key
 */
export async function getActivityByKey(
  pool: Pool,
  traceId: string,
  stepIndex: number,
  activityType: string,
  idempotencyKey: string
): Promise<any | null> {
  const result = await pool.query(
    `SELECT * FROM cmo_activities
     WHERE trace_id = $1 AND step_index = $2 AND activity_type = $3 AND idempotency_key = $4`,
    [traceId, stepIndex, activityType, idempotencyKey]
  );
  return result.rows[0] || null;
}

/**
 * Cleanup test activities
 */
export async function cleanupTestActivities(pool: Pool, testPrefix: string = 'test-trace'): Promise<number> {
  const result = await pool.query(`DELETE FROM cmo_activities WHERE trace_id LIKE $1`, [`${testPrefix}%`]);
  return result.rowCount || 0;
}

/**
 * Setup and teardown helper for tests
 */
export function setupPostgresTests(config: PostgresTestConfig = {}): {
  getPool: () => Pool | null;
  cleanup: () => Promise<void>;
} {
  let pool: Pool | null = null;

  const setup = async () => {
    pool = createTestPool(config);
    await truncateTestTables(pool);
  };

  const cleanup = async () => {
    if (pool) {
      await cleanupTestAgents(pool);
      await cleanupTestActivities(pool);
      await pool.end();
      pool = null;
    }
  };

  return {
    getPool: () => pool,
    cleanup,
  };
}
