/**
 * Postgres Agent Registry Implementation
 * Manages agent registration, heartbeats, discovery, and lease management
 */

import pkg from 'pg';
const { Pool } = pkg;
import type {
  Agent,
  AgentRegistration,
  RegistryLease,
  AgentHeartbeat,
  AgentDiscoveryQuery,
  AgentDiscoveryResult,
  TopicRole,
  AgentTopic,
  RegistryHealthReport,
  AgentStatus,
} from './types.js';

/**
 * Postgres configuration for agent registry
 */
export interface PostgresRegistryConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean | object;
  maxConnections?: number;
  idleTimeoutMs?: number;
  connectionTimeoutMs?: number;
}

/**
 * Postgres Agent Registry
 */
export class PostgresAgentRegistry {
  private pool: pkg.Pool;
  private initialized: boolean = false;

  constructor(config: PostgresRegistryConfig) {
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl || false,
      max: config.maxConnections || 20,
      idleTimeoutMillis: config.idleTimeoutMs || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMs || 10000,
    });
  }

  /**
   * Ensure the registry tables exist
   * Note: schema is created by the main CMO schema.sql, so this is a no-op check
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Verify agents table exists
    const result = await this.pool.query(
      `SELECT to_regclass('public.agents') IS NOT NULL AS exists`
    );

    if (!result.rows[0]?.exists) {
      throw new Error(
        'Agent registry tables do not exist. Run schema.sql to create them.'
      );
    }

    this.initialized = true;
  }

  /**
   * Register or update an agent
   *
   * @param registration - Agent registration request
   * @returns Registry lease with expiration time
   */
  async register(registration: AgentRegistration): Promise<RegistryLease> {
    await this.ensureInitialized();

    const leaseDurationSeconds = registration.lease_duration_seconds || 60;
    const leaseUntil = new Date(Date.now() + leaseDurationSeconds * 1000);
    const status = registration.initial_status || 'STARTING';

    await this.pool.query(
      `INSERT INTO agents (
         agent_id, version, tenant, project, capabilities,
         status, last_heartbeat, lease_until, metadata
       )
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8)
       ON CONFLICT (agent_id) DO UPDATE
       SET
         version = EXCLUDED.version,
         capabilities = EXCLUDED.capabilities,
         status = EXCLUDED.status,
         last_heartbeat = NOW(),
         lease_until = EXCLUDED.lease_until,
         metadata = EXCLUDED.metadata,
         updated_at = NOW()`,
      [
        registration.agent_id,
        registration.version,
        registration.tenant,
        registration.project,
        JSON.stringify(registration.capabilities),
        status,
        leaseUntil,
        registration.metadata ? JSON.stringify(registration.metadata) : null,
      ]
    );

    return {
      agent_id: registration.agent_id,
      lease_until: leaseUntil,
      lease_duration_seconds: leaseDurationSeconds,
    };
  }

  /**
   * Process agent heartbeat and extend lease
   *
   * @param heartbeat - Heartbeat request with agent_id and status
   * @param leaseDurationSeconds - Lease duration in seconds (default: 60)
   * @returns Updated lease
   */
  async heartbeat(
    heartbeat: AgentHeartbeat,
    leaseDurationSeconds: number = 60
  ): Promise<RegistryLease> {
    await this.ensureInitialized();

    const leaseUntil = new Date(Date.now() + leaseDurationSeconds * 1000);

    const result = await this.pool.query(
      `UPDATE agents
       SET
         status = $2,
         last_heartbeat = NOW(),
         lease_until = $3,
         metadata = CASE
           WHEN $4::jsonb IS NOT NULL THEN $4
           ELSE metadata
         END,
         updated_at = NOW()
       WHERE agent_id = $1
       RETURNING agent_id`,
      [
        heartbeat.agent_id,
        heartbeat.status,
        leaseUntil,
        heartbeat.metadata ? JSON.stringify(heartbeat.metadata) : null,
      ]
    );

    if (result.rowCount === 0) {
      throw new Error(`Agent ${heartbeat.agent_id} not found. Register first.`);
    }

    return {
      agent_id: heartbeat.agent_id,
      lease_until: leaseUntil,
      lease_duration_seconds: leaseDurationSeconds,
    };
  }

  /**
   * Discover agents matching query criteria
   *
   * @param query - Discovery query with tenant, project, capability filters
   * @returns List of matching agents
   */
  async discover(query: AgentDiscoveryQuery): Promise<AgentDiscoveryResult[]> {
    await this.ensureInitialized();

    // Build dynamic WHERE clause
    const conditions = ['a.tenant = $1', 'a.project = $2', 'a.lease_until > NOW()'];
    const params: any[] = [query.tenant, query.project];
    let paramIndex = 3;

    // Filter by capability (if provided)
    if (query.capability) {
      conditions.push(`a.capabilities ? $${paramIndex}`);
      params.push(query.capability);
      paramIndex++;
    }

    // Filter by status (if provided)
    if (query.status && query.status.length > 0) {
      conditions.push(`a.status = ANY($${paramIndex}::text[])`);
      params.push(query.status);
      paramIndex++;
    } else {
      // Default: only HEALTHY and DEGRADED
      conditions.push(`a.status IN ('HEALTHY', 'DEGRADED')`);
    }

    // Build query
    const sql = `
      SELECT
        a.agent_id,
        a.version,
        a.capabilities,
        a.status,
        a.last_heartbeat,
        a.lease_until,
        a.metadata
      FROM agents a
      WHERE ${conditions.join(' AND ')}
      ORDER BY a.last_heartbeat DESC
      ${query.limit ? `LIMIT $${paramIndex}` : ''}
    `;

    if (query.limit) {
      params.push(query.limit);
    }

    const result = await this.pool.query(sql, params);

    return result.rows.map((row) => ({
      agent_id: row.agent_id,
      version: row.version,
      capabilities: row.capabilities,
      status: row.status as AgentStatus,
      last_heartbeat: row.last_heartbeat,
      lease_until: row.lease_until,
      metadata: row.metadata,
    }));
  }

  /**
   * Mark an agent as unavailable
   *
   * @param agentId - Agent identifier
   */
  async markUnavailable(agentId: string): Promise<void> {
    await this.ensureInitialized();

    await this.pool.query(
      `UPDATE agents
       SET status = 'UNAVAILABLE', updated_at = NOW()
       WHERE agent_id = $1`,
      [agentId]
    );
  }

  /**
   * Get agent details
   *
   * @param agentId - Agent identifier
   * @returns Agent record or null if not found
   */
  async getAgent(agentId: string): Promise<Agent | null> {
    await this.ensureInitialized();

    const result = await this.pool.query(
      `SELECT
         agent_id, version, tenant, project, capabilities,
         status, last_heartbeat, lease_until, metadata,
         created_at, updated_at
       FROM agents
       WHERE agent_id = $1`,
      [agentId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      agent_id: row.agent_id,
      version: row.version,
      tenant: row.tenant,
      project: row.project,
      capabilities: row.capabilities,
      status: row.status as AgentStatus,
      last_heartbeat: row.last_heartbeat,
      lease_until: row.lease_until,
      metadata: row.metadata,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Subscribe agent to a topic
   *
   * @param agentId - Agent identifier
   * @param topic - Topic name
   * @param role - Role (publisher, subscriber, or both)
   * @returns Created or existing topic subscription
   */
  async subscribeTopic(
    agentId: string,
    topic: string,
    role: TopicRole
  ): Promise<AgentTopic> {
    await this.ensureInitialized();

    const result = await this.pool.query(
      `INSERT INTO agent_topics (agent_id, topic, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (agent_id, topic, role) DO UPDATE
       SET created_at = agent_topics.created_at
       RETURNING id, agent_id, topic, role, created_at`,
      [agentId, topic, role]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      agent_id: row.agent_id,
      topic: row.topic,
      role: row.role as TopicRole,
      created_at: row.created_at,
    };
  }

  /**
   * Unsubscribe agent from a topic
   *
   * @param agentId - Agent identifier
   * @param topic - Topic name
   * @param role - Role to remove (optional, removes all roles if not specified)
   */
  async unsubscribeTopic(
    agentId: string,
    topic: string,
    role?: TopicRole
  ): Promise<void> {
    await this.ensureInitialized();

    if (role) {
      await this.pool.query(
        `DELETE FROM agent_topics
         WHERE agent_id = $1 AND topic = $2 AND role = $3`,
        [agentId, topic, role]
      );
    } else {
      await this.pool.query(
        `DELETE FROM agent_topics
         WHERE agent_id = $1 AND topic = $2`,
        [agentId, topic]
      );
    }
  }

  /**
   * Get all topic subscriptions for an agent
   *
   * @param agentId - Agent identifier
   * @returns List of topic subscriptions
   */
  async getAgentTopics(agentId: string): Promise<AgentTopic[]> {
    await this.ensureInitialized();

    const result = await this.pool.query(
      `SELECT id, agent_id, topic, role, created_at
       FROM agent_topics
       WHERE agent_id = $1
       ORDER BY topic, role`,
      [agentId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      agent_id: row.agent_id,
      topic: row.topic,
      role: row.role as TopicRole,
      created_at: row.created_at,
    }));
  }

  /**
   * Get all agents subscribed to a topic
   *
   * @param topic - Topic name
   * @param role - Optional role filter
   * @returns List of agent IDs
   */
  async getTopicSubscribers(topic: string, role?: TopicRole): Promise<string[]> {
    await this.ensureInitialized();

    const sql = role
      ? `SELECT DISTINCT agent_id FROM agent_topics WHERE topic = $1 AND role = $2`
      : `SELECT DISTINCT agent_id FROM agent_topics WHERE topic = $1`;

    const params = role ? [topic, role] : [topic];
    const result = await this.pool.query(sql, params);

    return result.rows.map((row) => row.agent_id);
  }

  /**
   * Mark all agents with expired leases as unavailable
   *
   * @returns Number of agents marked unavailable
   */
  async markExpiredAgents(): Promise<number> {
    await this.ensureInitialized();

    const result = await this.pool.query(
      `UPDATE agents
       SET status = 'UNAVAILABLE', updated_at = NOW()
       WHERE lease_until < NOW()
         AND status != 'UNAVAILABLE'`
    );

    return result.rowCount || 0;
  }

  /**
   * Clean up old inactive agents
   *
   * @param retentionDays - Number of days to retain inactive agents (default: 7)
   * @returns Number of agents deleted
   */
  async cleanupInactiveAgents(retentionDays: number = 7): Promise<number> {
    await this.ensureInitialized();

    const result = await this.pool.query(
      `DELETE FROM agents
       WHERE status = 'UNAVAILABLE'
         AND updated_at < NOW() - ($1 || ' days')::INTERVAL`,
      [retentionDays]
    );

    return result.rowCount || 0;
  }

  /**
   * Get registry health report
   *
   * @returns Health report with agent status counts
   */
  async getHealthReport(): Promise<RegistryHealthReport> {
    await this.ensureInitialized();

    const result = await this.pool.query(`
      SELECT
        COUNT(*) as total_agents,
        COUNT(*) FILTER (WHERE status = 'HEALTHY') as healthy_agents,
        COUNT(*) FILTER (WHERE status = 'DEGRADED') as degraded_agents,
        COUNT(*) FILTER (WHERE status = 'UNAVAILABLE') as unavailable_agents,
        COUNT(*) FILTER (WHERE lease_until < NOW() AND status != 'UNAVAILABLE') as expired_leases
      FROM agents
    `);

    const row = result.rows[0];
    return {
      total_agents: parseInt(row.total_agents, 10),
      healthy_agents: parseInt(row.healthy_agents, 10),
      degraded_agents: parseInt(row.degraded_agents, 10),
      unavailable_agents: parseInt(row.unavailable_agents, 10),
      expired_leases: parseInt(row.expired_leases, 10),
      timestamp: new Date(),
    };
  }

  /**
   * Close connection pool
   */
  async close(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Health check for registry database
   */
  async healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    try {
      const start = Date.now();
      await this.pool.query('SELECT 1');
      const latency = Date.now() - start;
      return { healthy: true, latency };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Private helpers

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}
