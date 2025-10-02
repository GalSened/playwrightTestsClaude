/**
 * Postgres Checkpointer
 * Provides crash recovery and replay support using PostgreSQL
 */

import pkg from 'pg';
const { Pool } = pkg;
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Checkpointer } from '../runtime.js';
import type { StepRecord } from '../runtime.js';
import { ExecutionStatus } from '../runtime.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Postgres configuration
 */
export interface PostgresConfig {
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
 * Postgres Checkpointer Implementation
 */
export class PostgresCheckpointer implements Checkpointer {
  private pool: pkg.Pool;
  private initialized: boolean = false;

  constructor(config: PostgresConfig) {
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
   * Initialize schema (create tables if not exist)
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf8');

    const client = await this.pool.connect();
    try {
      await client.query(schema);
      this.initialized = true;
    } finally {
      client.release();
    }
  }

  /**
   * Save a new run
   */
  async saveRun(
    traceId: string,
    graphId: string,
    graphVersion: string
  ): Promise<void> {
    await this.ensureInitialized();

    await this.pool.query(
      `INSERT INTO cmo_runs (trace_id, graph_id, graph_version, status)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (trace_id) DO UPDATE
       SET updated_at = NOW()`,
      [traceId, graphId, graphVersion, ExecutionStatus.RUNNING]
    );
  }

  /**
   * Save a step
   */
  async saveStep(traceId: string, step: StepRecord): Promise<void> {
    await this.ensureInitialized();

    const error = step.error
      ? JSON.stringify({
          message: step.error.message,
          code: step.error.code,
          stack: step.error.stack,
        })
      : null;

    await this.pool.query(
      `INSERT INTO cmo_steps (
         trace_id, step_index, node_id, state_hash,
         input_hash, output_hash, next_edge,
         started_at, completed_at, duration_ms, error
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (trace_id, step_index) DO UPDATE
       SET
         completed_at = EXCLUDED.completed_at,
         duration_ms = EXCLUDED.duration_ms,
         error = EXCLUDED.error,
         output_hash = EXCLUDED.output_hash,
         next_edge = EXCLUDED.next_edge`,
      [
        traceId,
        step.stepIndex,
        step.nodeId,
        step.stateHash,
        step.inputHash,
        step.outputHash,
        step.nextEdge,
        new Date(step.startedAt),
        new Date(step.completedAt),
        step.durationMs,
        error,
      ]
    );
  }

  /**
   * Update run status
   */
  async updateRunStatus(
    traceId: string,
    status: ExecutionStatus,
    error?: string
  ): Promise<void> {
    await this.ensureInitialized();

    const completedAt = [
      ExecutionStatus.COMPLETED,
      ExecutionStatus.FAILED,
      ExecutionStatus.TIMEOUT,
      ExecutionStatus.ABORTED,
    ].includes(status)
      ? new Date()
      : null;

    await this.pool.query(
      `UPDATE cmo_runs
       SET status = $1, error = $2, completed_at = $3, updated_at = NOW()
       WHERE trace_id = $4`,
      [status, error || null, completedAt, traceId]
    );
  }

  /**
   * Get last step for a run
   */
  async getLastStep(traceId: string): Promise<StepRecord | null> {
    await this.ensureInitialized();

    const result = await this.pool.query(
      `SELECT
         step_index, node_id, state_hash, input_hash, output_hash, next_edge,
         EXTRACT(EPOCH FROM started_at) * 1000 as started_at,
         EXTRACT(EPOCH FROM completed_at) * 1000 as completed_at,
         duration_ms, error
       FROM cmo_steps
       WHERE trace_id = $1
       ORDER BY step_index DESC
       LIMIT 1`,
      [traceId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return this.rowToStepRecord(row);
  }

  /**
   * Get all steps for a run
   */
  async getAllSteps(traceId: string): Promise<StepRecord[]> {
    await this.ensureInitialized();

    const result = await this.pool.query(
      `SELECT
         step_index, node_id, state_hash, input_hash, output_hash, next_edge,
         EXTRACT(EPOCH FROM started_at) * 1000 as started_at,
         EXTRACT(EPOCH FROM completed_at) * 1000 as completed_at,
         duration_ms, error
       FROM cmo_steps
       WHERE trace_id = $1
       ORDER BY step_index ASC`,
      [traceId]
    );

    return result.rows.map((row) => this.rowToStepRecord(row));
  }

  /**
   * Save activity (for record/replay)
   */
  async saveActivity(
    traceId: string,
    stepIndex: number,
    activityType: string,
    requestHash: string,
    requestData: unknown,
    responseData: unknown | undefined,
    responseBlobRef: string | undefined,
    timestamp: string,
    durationMs: number | undefined,
    error: { message: string; stack?: string } | undefined
  ): Promise<void> {
    await this.ensureInitialized();

    const errorJson = error
      ? JSON.stringify({
          message: error.message,
          stack: error.stack,
        })
      : null;

    await this.pool.query(
      `INSERT INTO cmo_activities (
         trace_id, step_index, activity_type, request_hash,
         request_data, response_data, response_blob_ref,
         timestamp, duration_ms, error
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (trace_id, step_index, activity_type, request_hash) DO UPDATE
       SET
         response_data = EXCLUDED.response_data,
         response_blob_ref = EXCLUDED.response_blob_ref,
         timestamp = EXCLUDED.timestamp,
         duration_ms = EXCLUDED.duration_ms,
         error = EXCLUDED.error`,
      [
        traceId,
        stepIndex,
        activityType,
        requestHash,
        requestData ? JSON.stringify(requestData) : null,
        responseData ? JSON.stringify(responseData) : null,
        responseBlobRef || null,
        timestamp,
        durationMs || null,
        errorJson,
      ]
    );
  }

  /**
   * Get activity by request hash (for idempotency)
   */
  async getActivity(
    traceId: string,
    stepIndex: number,
    activityType: string,
    requestHash: string
  ): Promise<{
    responseData: unknown;
    responseBlobRef: string | null;
    error?: { message: string; code?: string };
  } | null> {
    await this.ensureInitialized();

    const result = await this.pool.query(
      `SELECT response_data, response_blob_ref, error
       FROM cmo_activities
       WHERE trace_id = $1
         AND step_index = $2
         AND activity_type = $3
         AND request_hash = $4
       LIMIT 1`,
      [traceId, stepIndex, activityType, requestHash]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      responseData: row.response_data,
      responseBlobRef: row.response_blob_ref,
      error: row.error ? JSON.parse(row.error) : undefined,
    };
  }

  /**
   * Get all activities for a step
   */
  async getActivitiesForStep(
    traceId: string,
    stepIndex: number
  ): Promise<Array<{
    activityType: string;
    requestHash: string;
    requestData: unknown;
    responseData: unknown;
    responseBlobRef: string | null;
    durationMs: number;
  }>> {
    await this.ensureInitialized();

    const result = await this.pool.query(
      `SELECT
         activity_type, request_hash, request_data, response_data,
         response_blob_ref, duration_ms
       FROM cmo_activities
       WHERE trace_id = $1 AND step_index = $2
       ORDER BY id ASC`,
      [traceId, stepIndex]
    );

    return result.rows.map((row) => ({
      activityType: row.activity_type,
      requestHash: row.request_hash,
      requestData: row.request_data,
      responseData: row.response_data,
      responseBlobRef: row.response_blob_ref,
      durationMs: row.duration_ms,
    }));
  }

  /**
   * Close connection pool
   */
  async close(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Health check
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

  private rowToStepRecord(row: any): StepRecord {
    return {
      stepIndex: row.step_index,
      nodeId: row.node_id,
      stateHash: row.state_hash,
      inputHash: row.input_hash,
      outputHash: row.output_hash,
      nextEdge: row.next_edge,
      startedAt: parseFloat(row.started_at),
      completedAt: parseFloat(row.completed_at),
      durationMs: row.duration_ms,
      error: row.error ? JSON.parse(row.error) : undefined,
    };
  }
}
