/**
 * Testcontainer Utilities
 * Auto-start Postgres and Redis for integration tests
 */

import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Start Postgres container with schema initialized
 */
export async function startPostgres(): Promise<StartedPostgreSqlContainer> {
  const container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('qa_intel_test')
    .withUsername('test')
    .withPassword('test_password')
    .start();

  // Apply schema from tools/local-stack/sql/schema.sql
  const schemaPath = join(__dirname, '../../tools/local-stack/sql/schema.sql');
  let schemaSQL: string;

  try {
    schemaSQL = readFileSync(schemaPath, 'utf-8');
  } catch {
    // Fallback: use minimal schema for tests if file not found
    schemaSQL = `
      -- CMO Registry Schema (minimal for tests)
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        version TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'HEALTHY',
        lease_expires_at TIMESTAMPTZ,
        last_heartbeat_at TIMESTAMPTZ,
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS agent_topics (
        agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE,
        topic TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (agent_id, topic)
      );

      CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
      CREATE INDEX IF NOT EXISTS idx_agents_lease_expires ON agents(lease_expires_at);
      CREATE INDEX IF NOT EXISTS idx_agent_topics_topic ON agent_topics(topic);

      -- CMO Runs & Steps (for replay/ELG)
      CREATE TABLE IF NOT EXISTS cmo_runs (
        trace_id TEXT PRIMARY KEY,
        graph_id TEXT NOT NULL,
        graph_version TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TIMESTAMPTZ NOT NULL,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS cmo_steps (
        trace_id TEXT REFERENCES cmo_runs(trace_id) ON DELETE CASCADE,
        step_index INTEGER NOT NULL,
        node_id TEXT NOT NULL,
        state_hash TEXT NOT NULL,
        input_hash TEXT NOT NULL,
        output_hash TEXT,
        next_edge TEXT,
        started_at TIMESTAMPTZ NOT NULL,
        completed_at TIMESTAMPTZ,
        duration_ms INTEGER,
        PRIMARY KEY (trace_id, step_index)
      );

      CREATE TABLE IF NOT EXISTS cmo_activities (
        id SERIAL PRIMARY KEY,
        trace_id TEXT NOT NULL,
        step_index INTEGER NOT NULL,
        activity_type TEXT NOT NULL,
        request_hash TEXT NOT NULL,
        request_data JSONB,
        response_data JSONB,
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        FOREIGN KEY (trace_id, step_index) REFERENCES cmo_steps(trace_id, step_index) ON DELETE CASCADE,
        UNIQUE (trace_id, step_index, activity_type, request_hash)
      );
    `;
  }

  // Execute schema using container's exec
  const { Client } = await import('pg');
  const client = new Client({
    host: container.getHost(),
    port: container.getMappedPort(5432),
    database: 'qa_intel_test',
    user: 'test',
    password: 'test_password',
  });

  await client.connect();
  await client.query(schemaSQL);
  await client.end();

  return container;
}

/**
 * Start Redis container
 */
export async function startRedis(): Promise<StartedRedisContainer> {
  const container = await new RedisContainer('redis:7-alpine')
    .start();

  return container;
}

/**
 * Get Postgres connection config from container
 */
export function getPostgresConfig(container: StartedPostgreSqlContainer) {
  return {
    host: container.getHost(),
    port: container.getMappedPort(5432),
    database: 'qa_intel_test',
    user: 'test',
    password: 'test_password',
  };
}

/**
 * Get Redis connection config from container
 */
export function getRedisConfig(container: StartedRedisContainer) {
  return {
    host: container.getHost(),
    port: container.getMappedPort(6379),
  };
}
