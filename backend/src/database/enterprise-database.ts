/**
 * Enterprise Database Layer
 * Handles all database operations with multi-tenancy, partitioning, and enterprise features
 */

import { pgPool, supabaseClient, Database } from './supabase-client';
import { enterpriseConfig } from '../config/enterprise';
import { logger } from '../utils/logger';
import {
  TraceViewerRun,
  TraceStep,
  TraceArtifact,
  ConsoleLog,
  NetworkLog,
  GetRunsRequest,
  GetRunsResponse,
  GetRunDetailResponse,
  RunStatistics
} from '../types/trace';

export class EnterpriseDatabase {
  private static instance: EnterpriseDatabase;

  private constructor() {
    logger.info('Enterprise database initialized', {
      multiTenant: enterpriseConfig.ENABLE_MULTI_TENANT,
      readReplicas: enterpriseConfig.ENABLE_READ_REPLICAS,
    });
  }

  public static getInstance(): EnterpriseDatabase {
    if (!EnterpriseDatabase.instance) {
      EnterpriseDatabase.instance = new EnterpriseDatabase();
    }
    return EnterpriseDatabase.instance;
  }

  /**
   * Execute a database query
   */
  async query(
    sql: string, 
    params: any[] = [], 
    tenantId?: string, 
    useReadReplica: boolean = false
  ): Promise<{ rows: any[], rowCount: number }> {
    const client = useReadReplica && enterpriseConfig.ENABLE_READ_REPLICAS
      ? await pgPool.getReadConnection()
      : await pgPool.getWriteConnection();

    try {
      const result = await client.query(sql, params);
      return {
        rows: result.rows,
        rowCount: result.rowCount || 0
      };
    } finally {
      client.release();
    }
  }

  /**
   * Initialize database schema
   */
  async initializeDatabase(tenantId?: string): Promise<void> {
    try {
      const client = await pgPool.getWriteConnection();
      
      try {
        // Read and execute enterprise schema
        const fs = require('fs');
        const path = require('path');
        const schemaPath = path.join(__dirname, 'enterprise-schema-minimal.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        // Set tenant context if provided (temporarily disabled for debugging)
        // if (tenantId) {
        //   await client.query('SET app.current_tenant_id = $1', [tenantId]);
        // }
        
        // Split schema into individual statements and execute them
        // Remove comments and empty lines first
        const cleanedSchema = schema
          .split('\n')
          .filter(line => !line.trim().startsWith('--') && line.trim().length > 0)
          .join('\n');
          
        const statements = cleanedSchema
          .split(';')
          .map(stmt => stmt.trim())
          .filter(stmt => stmt.length > 0);

        logger.info('Executing schema statements', { totalStatements: statements.length });

        for (let i = 0; i < statements.length; i++) {
          const statement = statements[i];
          if (statement.trim()) {
            logger.debug(`Executing statement ${i + 1}/${statements.length}`, {
              preview: statement.substring(0, 50) + '...'
            });
            
            try {
              await client.query(statement);
            } catch (error) {
              logger.error('SQL statement failed', {
                statementIndex: i + 1,
                totalStatements: statements.length,
                statementPreview: statement.substring(0, 200),
                fullStatement: statement,
                error: error.message,
                errorCode: error.code,
                errorPosition: error.position
              });
              throw error;
            }
          }
        }
        
        logger.info('Enterprise database schema initialized successfully', { 
          tenantId,
          statementsExecuted: statements.length 
        });
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Failed to initialize enterprise database', { error, tenantId });
      throw error;
    }
  }

  /**
   * Create a new tenant
   */
  async createTenant(tenantData: {
    name: string;
    subdomain: string;
    plan?: string;
    settings?: Record<string, any>;
  }): Promise<Database['public']['Tables']['tenants']['Row']> {
    try {
      const { data, error } = await supabaseClient.getClient()
        .from('tenants')
        .insert({
          name: tenantData.name,
          subdomain: tenantData.subdomain,
          plan: tenantData.plan || 'starter',
          settings: tenantData.settings || {},
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.info('Tenant created successfully', { 
        tenantId: data.id, 
        subdomain: data.subdomain 
      });

      return data;
    } catch (error) {
      logger.error('Failed to create tenant', { error, tenantData });
      throw error;
    }
  }

  /**
   * Get tenant by subdomain
   */
  async getTenantBySubdomain(subdomain: string): Promise<Database['public']['Tables']['tenants']['Row'] | null> {
    try {
      const { data, error } = await supabaseClient.getClient()
        .from('tenants')
        .select('*')
        .eq('subdomain', subdomain)
        .eq('status', 'active')
        .single();

      if (error && error.code !== 'PGRST116') { // Not found error is OK
        throw error;
      }

      return data || null;
    } catch (error) {
      logger.error('Failed to get tenant by subdomain', { error, subdomain });
      throw error;
    }
  }

  /**
   * Create test run
   */
  async createRun(
    tenantId: string,
    run: Omit<TraceViewerRun, 'id' | 'createdAt' | 'updatedAt' | 'passRate'>
  ): Promise<TraceViewerRun> {
    try {
      const result = await pgPool.transaction(async (client) => {
        const { rows } = await client.query(`
          INSERT INTO test_runs (
            tenant_id, suite_id, suite_name, status, started_at, finished_at,
            duration, environment, browser, total_tests, passed_tests,
            failed_tests, skipped_tests, tags, metadata
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
          ) RETURNING *
        `, [
          tenantId,
          run.suiteId,
          run.suiteName,
          run.status,
          run.startedAt,
          run.finishedAt,
          run.duration,
          run.environment,
          run.browser,
          run.totals?.total || 0,
          run.totals?.passed || 0,
          run.totals?.failed || 0,
          run.totals?.skipped || 0,
          JSON.stringify(run.tags || []),
          JSON.stringify(run.metadata || {})
        ]);

        return this.mapTestRunRow(rows[0]);
      }, tenantId);

      logger.info('Test run created successfully', { 
        tenantId, 
        runId: result.id,
        suiteId: run.suiteId 
      });

      return result;
    } catch (error) {
      logger.error('Failed to create test run', { error, tenantId, run });
      throw error;
    }
  }

  /**
   * Get test runs with filters and pagination
   */
  async getRuns(tenantId: string, request: GetRunsRequest): Promise<GetRunsResponse> {
    try {
      const {
        page = 1,
        limit = 50,
        status,
        environment,
        suite,
        startDate,
        endDate,
        search,
      } = request;

      const offset = (page - 1) * Math.min(limit, 100);
      
      let whereClause = 'WHERE tenant_id = $1';
      const params: any[] = [tenantId];
      let paramIndex = 2;

      // Build dynamic WHERE clause
      if (status && status.length > 0) {
        whereClause += ` AND status = ANY($${paramIndex})`;
        params.push(status);
        paramIndex++;
      }

      if (environment) {
        whereClause += ` AND environment = $${paramIndex}`;
        params.push(environment);
        paramIndex++;
      }

      if (suite) {
        whereClause += ` AND suite_name ILIKE $${paramIndex}`;
        params.push(`%${suite}%`);
        paramIndex++;
      }

      if (startDate) {
        whereClause += ` AND started_at >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        whereClause += ` AND started_at <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      if (search) {
        whereClause += ` AND (suite_name ILIKE $${paramIndex} OR tags::text ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      // Get total count
      const countResult = await this.query(
        `SELECT COUNT(*) as total FROM test_runs ${whereClause}`,
        params,
        tenantId,
        true // use read replica
      );
      const total = parseInt(countResult.rows[0].total);

      // Get runs with pagination
      const runsResult = await this.query(`
        SELECT * FROM test_runs 
        ${whereClause}
        ORDER BY started_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...params, Math.min(limit, 100), offset], tenantId, true);

      const runs = runsResult.rows.map(row => this.mapTestRunRow(row));

      return {
        runs,
        total,
        hasMore: offset + runs.length < total,
        page,
        limit,
      };
    } catch (error) {
      logger.error('Failed to get test runs', { error, tenantId, request });
      throw error;
    }
  }

  /**
   * Get detailed test run with steps and artifacts
   */
  async getRunDetail(
    tenantId: string,
    runId: string,
    includeSteps: boolean = true,
    includeArtifacts: boolean = true,
    includeLogs: boolean = false
  ): Promise<GetRunDetailResponse | null> {
    try {
      const result = await pgPool.transaction(async (client) => {
        // Get run
        const runResult = await client.query(
          'SELECT * FROM test_runs WHERE tenant_id = $1 AND id = $2',
          [tenantId, runId]
        );

        if (runResult.rows.length === 0) {
          return null;
        }

        const run = this.mapTestRunRow(runResult.rows[0]);
        let steps: TraceStep[] = [];
        let artifacts: TraceArtifact[] = [];
        let logs: (ConsoleLog | NetworkLog)[] = [];

        // Get steps if requested
        if (includeSteps) {
          const stepsResult = await client.query(
            `SELECT * FROM test_steps 
             WHERE tenant_id = $1 AND run_id = $2 
             ORDER BY step_index ASC`,
            [tenantId, runId]
          );
          steps = stepsResult.rows.map(row => this.mapTestStepRow(row));
        }

        // Get artifacts if requested
        if (includeArtifacts) {
          const artifactsResult = await client.query(
            `SELECT * FROM test_artifacts 
             WHERE tenant_id = $1 AND run_id = $2 
             ORDER BY created_at ASC`,
            [tenantId, runId]
          );
          artifacts = artifactsResult.rows.map(row => this.mapTestArtifactRow(row));
        }

        // Get logs if requested
        if (includeLogs) {
          const [consoleResult, networkResult] = await Promise.all([
            client.query(
              `SELECT * FROM console_logs 
               WHERE tenant_id = $1 AND run_id = $2 
               ORDER BY timestamp ASC`,
              [tenantId, runId]
            ),
            client.query(
              `SELECT * FROM network_logs 
               WHERE tenant_id = $1 AND run_id = $2 
               ORDER BY timestamp ASC`,
              [tenantId, runId]
            )
          ]);

          const consoleLogs = consoleResult.rows.map(row => this.mapConsoleLogRow(row));
          const networkLogs = networkResult.rows.map(row => this.mapNetworkLogRow(row));
          logs = [...consoleLogs, ...networkLogs].sort((a, b) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
        }

        return {
          run,
          steps,
          artifacts,
          logs,
          timeline: this.generateTimeline(steps, logs, artifacts),
        };
      }, tenantId);

      return result;
    } catch (error) {
      logger.error('Failed to get run detail', { error, tenantId, runId });
      throw error;
    }
  }

  /**
   * Create test step
   */
  async createStep(tenantId: string, step: Omit<TraceStep, 'id' | 'createdAt'>): Promise<TraceStep> {
    try {
      const result = await pgPool.query(`
        INSERT INTO test_steps (
          tenant_id, run_id, test_id, test_name, step_index, action_type,
          action_name, selector, url, started_at, finished_at, duration,
          status, error_message, stack_trace, expected_value, actual_value,
          retry_count, metadata
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
        ) RETURNING *
      `, [
        tenantId,
        step.runId,
        step.testId,
        step.testName,
        step.stepIndex,
        step.actionType,
        step.actionName,
        step.selector,
        step.url,
        step.startedAt,
        step.finishedAt,
        step.duration,
        step.status,
        step.errorMessage,
        step.stackTrace,
        step.expectedValue,
        step.actualValue,
        step.retryCount,
        step.metadata || {}
      ], tenantId);

      const createdStep = this.mapTestStepRow(result.rows[0]);
      
      logger.info('Test step created successfully', { 
        tenantId, 
        stepId: createdStep.id,
        runId: step.runId 
      });

      return createdStep;
    } catch (error) {
      logger.error('Failed to create test step', { error, tenantId, step });
      throw error;
    }
  }

  /**
   * Create test artifact
   */
  async createArtifact(
    tenantId: string, 
    artifact: Omit<TraceArtifact, 'id' | 'createdAt'>
  ): Promise<TraceArtifact> {
    try {
      const result = await pgPool.query(`
        INSERT INTO test_artifacts (
          tenant_id, run_id, step_id, artifact_type, name, file_path,
          file_url, mime_type, file_size, width, height, duration, metadata
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        ) RETURNING *
      `, [
        tenantId,
        artifact.runId,
        artifact.stepId,
        artifact.artifactType,
        artifact.name,
        artifact.filePath,
        artifact.fileUrl,
        artifact.mimeType,
        artifact.fileSize,
        artifact.width,
        artifact.height,
        artifact.duration,
        artifact.metadata || {}
      ], tenantId);

      const createdArtifact = this.mapTestArtifactRow(result.rows[0]);
      
      logger.info('Test artifact created successfully', { 
        tenantId, 
        artifactId: createdArtifact.id,
        runId: artifact.runId,
        type: artifact.artifactType
      });

      return createdArtifact;
    } catch (error) {
      logger.error('Failed to create test artifact', { error, tenantId, artifact });
      throw error;
    }
  }

  /**
   * Get run statistics for analytics
   */
  async getRunStatistics(
    tenantId: string,
    filters?: {
      startDate?: string;
      endDate?: string;
      environment?: string;
    }
  ): Promise<RunStatistics> {
    try {
      let whereClause = 'WHERE tenant_id = $1';
      const params: any[] = [tenantId];
      let paramIndex = 2;

      if (filters?.startDate) {
        whereClause += ` AND started_at >= $${paramIndex}`;
        params.push(filters.startDate);
        paramIndex++;
      }

      if (filters?.endDate) {
        whereClause += ` AND started_at <= $${paramIndex}`;
        params.push(filters.endDate);
        paramIndex++;
      }

      if (filters?.environment) {
        whereClause += ` AND environment = $${paramIndex}`;
        params.push(filters.environment);
        paramIndex++;
      }

      const result = await pgPool.query(`
        SELECT 
          COUNT(*) as total_runs,
          AVG(pass_rate) as average_pass_rate,
          AVG(duration) as average_duration,
          SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed_runs,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_runs,
          SUM(total_tests) as total_tests,
          SUM(passed_tests) as total_passed_tests,
          SUM(failed_tests) as total_failed_tests
        FROM test_runs 
        ${whereClause}
      `, params, tenantId, true);

      const row = result.rows[0];
      
      return {
        totalRuns: parseInt(row.total_runs) || 0,
        passRate: parseFloat(row.average_pass_rate) || 0,
        averageDuration: parseInt(row.average_duration) || 0,
        passedRuns: parseInt(row.passed_runs) || 0,
        failedRuns: parseInt(row.failed_runs) || 0,
        totalTests: parseInt(row.total_tests) || 0,
        passedTests: parseInt(row.total_passed_tests) || 0,
        failedTests: parseInt(row.total_failed_tests) || 0,
      };
    } catch (error) {
      logger.error('Failed to get run statistics', { error, tenantId, filters });
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      return await pgPool.healthCheck();
    } catch (error) {
      logger.error('Database health check failed', { error });
      return false;
    }
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    await pgPool.close();
  }

  // Mapping functions
  private mapTestRunRow(row: any): TraceViewerRun {
    return {
      id: row.id,
      suiteId: row.suite_id,
      suiteName: row.suite_name,
      status: row.status,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      duration: row.duration,
      environment: row.environment,
      browser: row.browser,
      testMode: row.test_mode,
      totals: {
        total: row.total_tests,
        passed: row.passed_tests,
        failed: row.failed_tests,
        skipped: row.skipped_tests,
      },
      passRate: parseFloat(row.pass_rate) || 0,
      tags: row.tags || [],
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapTestStepRow(row: any): TraceStep {
    return {
      id: row.id,
      runId: row.run_id,
      testId: row.test_id,
      testName: row.test_name,
      stepIndex: row.step_index,
      actionType: row.action_type,
      actionName: row.action_name,
      selector: row.selector,
      url: row.url,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      duration: row.duration,
      status: row.status,
      errorMessage: row.error_message,
      stackTrace: row.stack_trace,
      expectedValue: row.expected_value,
      actualValue: row.actual_value,
      retryCount: row.retry_count,
      metadata: row.metadata || {},
      createdAt: row.created_at,
    };
  }

  private mapTestArtifactRow(row: any): TraceArtifact {
    return {
      id: row.id,
      runId: row.run_id,
      stepId: row.step_id,
      artifactType: row.artifact_type,
      name: row.name,
      filePath: row.file_path,
      fileUrl: row.file_url,
      mimeType: row.mime_type,
      fileSize: row.file_size,
      width: row.width,
      height: row.height,
      duration: row.duration,
      metadata: row.metadata || {},
      createdAt: row.created_at,
    };
  }

  private mapConsoleLogRow(row: any): ConsoleLog {
    return {
      id: row.id,
      runId: row.run_id,
      stepId: row.step_id,
      timestamp: row.timestamp,
      level: row.level,
      source: row.source,
      message: row.message,
      url: row.url,
      lineNumber: row.line_number,
      columnNumber: row.column_number,
      createdAt: row.created_at,
    };
  }

  private mapNetworkLogRow(row: any): NetworkLog {
    return {
      id: row.id,
      runId: row.run_id,
      stepId: row.step_id,
      timestamp: row.timestamp,
      method: row.method,
      url: row.url,
      statusCode: row.status_code,
      statusText: row.status_text,
      duration: row.duration,
      failed: row.failed,
      failureReason: row.failure_reason,
      requestSize: row.request_size,
      responseSize: row.response_size,
      createdAt: row.created_at,
    };
  }

  private generateTimeline(
    steps: TraceStep[],
    logs: (ConsoleLog | NetworkLog)[],
    artifacts: TraceArtifact[]
  ): any[] {
    // Implementation for timeline generation
    const timeline: any[] = [];
    
    // Add steps to timeline
    steps.forEach(step => {
      timeline.push({
        id: step.id,
        type: 'step',
        timestamp: step.startedAt,
        duration: step.duration,
        status: step.status,
        title: step.actionName,
        description: `${step.actionType}: ${step.selector || step.url || ''}`,
        stepId: step.id,
        metadata: {
          actionType: step.actionType,
          selector: step.selector,
          testName: step.testName,
        },
      });
    });

    // Add logs to timeline
    logs.forEach(log => {
      timeline.push({
        id: log.id,
        type: 'log',
        timestamp: log.timestamp,
        status: 'level' in log ? log.level : (log.failed ? 'error' : 'info'),
        title: 'level' in log ? `Console ${log.level}` : `${log.method} ${log.url}`,
        description: 'level' in log ? log.message : `${log.statusCode} ${log.statusText}`,
        metadata: log,
      });
    });

    // Sort by timestamp
    return timeline.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  /**
   * API Key Management
   */
  async getApiKeyByHash(keyHash: string): Promise<any | null> {
    try {
      if (pgPool) {
        const result = await pgPool.query(`
          SELECT ak.*, t.name as tenant_name, t.status as tenant_status
          FROM tenant_api_keys ak
          JOIN tenants t ON ak.tenant_id = t.id
          WHERE ak.key_hash = $1 
          AND ak.status = 'active'
          AND t.status = 'active'
          AND (ak.expires_at IS NULL OR ak.expires_at > NOW())
        `, [keyHash]);
        
        return result.rows[0] || null;
      } else if (supabaseClient) {
        const { data, error } = await supabaseClient
          .from('tenant_api_keys')
          .select(`
            *,
            tenants!inner(name, status)
          `)
          .eq('key_hash', keyHash)
          .eq('status', 'active')
          .eq('tenants.status', 'active')
          .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
          .single();

        if (error) {
          logger.warn('API key lookup failed', { error });
          return null;
        }
        
        return data;
      }
      
      return null;
    } catch (error) {
      logger.error('Error looking up API key', { error });
      return null;
    }
  }

  async updateApiKeyLastUsed(keyId: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      
      if (pgPool) {
        await pgPool.query(
          'UPDATE tenant_api_keys SET last_used_at = $1 WHERE id = $2',
          [now, keyId]
        );
      } else if (supabaseClient) {
        await supabaseClient
          .from('tenant_api_keys')
          .update({ last_used_at: now })
          .eq('id', keyId);
      }
    } catch (error) {
      logger.warn('Failed to update API key last used time', { error });
    }
  }
}

// Export singleton instance
export const enterpriseDb = EnterpriseDatabase.getInstance();