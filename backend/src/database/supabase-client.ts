/**
 * Enterprise Supabase Client
 * Manages PostgreSQL connections, real-time subscriptions, and cloud storage
 * with production-grade features like connection pooling and multi-tenancy
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Pool, PoolClient } from 'pg';
import { enterpriseConfig, getDatabaseConfig, getStorageConfig } from '../config/enterprise';
import { logger } from '../utils/logger';

// Database types for enterprise schema
export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          subdomain: string;
          plan: string;
          settings: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['tenants']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['tenants']['Insert']>;
      };
      test_runs: {
        Row: {
          id: string;
          tenant_id: string;
          suite_id: string;
          suite_name: string;
          status: 'queued' | 'running' | 'passed' | 'failed' | 'cancelled';
          started_at: string;
          finished_at: string | null;
          duration: number | null;
          environment: string;
          browser: string | null;
          test_mode: string | null;
          total_tests: number;
          passed_tests: number;
          failed_tests: number;
          skipped_tests: number;
          pass_rate: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['test_runs']['Row'], 'id' | 'created_at' | 'updated_at' | 'pass_rate'>;
        Update: Partial<Database['public']['Tables']['test_runs']['Insert']>;
      };
      test_steps: {
        Row: {
          id: string;
          tenant_id: string;
          run_id: string;
          test_id: string;
          test_name: string;
          step_index: number;
          action_type: string;
          action_name: string;
          selector: string | null;
          url: string | null;
          started_at: string;
          finished_at: string | null;
          duration: number | null;
          status: 'passed' | 'failed' | 'skipped';
          error_message: string | null;
          stack_trace: string | null;
          expected_value: string | null;
          actual_value: string | null;
          retry_count: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['test_steps']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['test_steps']['Insert']>;
      };
      test_artifacts: {
        Row: {
          id: string;
          tenant_id: string;
          run_id: string;
          step_id: string | null;
          artifact_type: 'screenshot' | 'video' | 'trace' | 'log' | 'report';
          name: string;
          file_path: string;
          file_url: string;
          mime_type: string;
          file_size: number;
          width: number | null;
          height: number | null;
          duration: number | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['test_artifacts']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['test_artifacts']['Insert']>;
      };
      console_logs: {
        Row: {
          id: string;
          tenant_id: string;
          run_id: string;
          step_id: string | null;
          timestamp: string;
          level: 'error' | 'warn' | 'info' | 'debug';
          source: string;
          message: string;
          url: string | null;
          line_number: number | null;
          column_number: number | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['console_logs']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['console_logs']['Insert']>;
      };
      network_logs: {
        Row: {
          id: string;
          tenant_id: string;
          run_id: string;
          step_id: string | null;
          timestamp: string;
          method: string;
          url: string;
          status_code: number | null;
          status_text: string | null;
          duration: number | null;
          failed: boolean;
          failure_reason: string | null;
          request_size: number | null;
          response_size: number | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['network_logs']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['network_logs']['Insert']>;
      };
    };
  };
}

/**
 * Enterprise Supabase Client Manager
 * Handles client-side operations, real-time subscriptions
 */
export class SupabaseClientManager {
  private static instance: SupabaseClientManager;
  private supabase: SupabaseClient<Database>;
  private storageClient: SupabaseClient;

  private constructor() {
    const config = getStorageConfig(enterpriseConfig);
    
    // Client for database operations
    this.supabase = createClient<Database>(
      config.supabaseUrl,
      config.supabaseKey,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
        realtime: {
          enabled: enterpriseConfig.ENABLE_REAL_TIME_UPDATES,
        },
      }
    );

    // Dedicated client for storage operations
    this.storageClient = createClient(
      config.supabaseUrl,
      config.supabaseKey
    );

    logger.info('Supabase client initialized', {
      url: config.supabaseUrl,
      bucket: config.bucketName,
      realTime: enterpriseConfig.ENABLE_REAL_TIME_UPDATES,
    });
  }

  public static getInstance(): SupabaseClientManager {
    if (!SupabaseClientManager.instance) {
      SupabaseClientManager.instance = new SupabaseClientManager();
    }
    return SupabaseClientManager.instance;
  }

  public getClient(): SupabaseClient<Database> {
    return this.supabase;
  }

  public getStorageClient(): SupabaseClient {
    return this.storageClient;
  }

  /**
   * Upload artifact to Supabase Storage
   */
  async uploadArtifact(
    tenantId: string,
    runId: string,
    fileName: string,
    fileBuffer: Buffer,
    mimeType: string
  ): Promise<{ path: string; url: string }> {
    try {
      const filePath = `${tenantId}/${runId}/${Date.now()}-${fileName}`;
      
      const { data, error } = await this.storageClient.storage
        .from(enterpriseConfig.SUPABASE_STORAGE_BUCKET)
        .upload(filePath, fileBuffer, {
          contentType: mimeType,
          cacheControl: '3600',
        });

      if (error) {
        throw error;
      }

      const { data: urlData } = this.storageClient.storage
        .from(enterpriseConfig.SUPABASE_STORAGE_BUCKET)
        .getPublicUrl(data.path);

      logger.info('Artifact uploaded successfully', {
        tenantId,
        runId,
        fileName,
        path: data.path,
        url: urlData.publicUrl,
      });

      return {
        path: data.path,
        url: urlData.publicUrl,
      };
    } catch (error) {
      logger.error('Failed to upload artifact', { error, tenantId, runId, fileName });
      throw error;
    }
  }

  /**
   * Get signed URL for private artifacts
   */
  async getSignedUrl(path: string, expiresIn: number = 3600): Promise<string> {
    try {
      const { data, error } = await this.storageClient.storage
        .from(enterpriseConfig.SUPABASE_STORAGE_BUCKET)
        .createSignedUrl(path, expiresIn);

      if (error) {
        throw error;
      }

      return data.signedUrl;
    } catch (error) {
      logger.error('Failed to create signed URL', { error, path });
      throw error;
    }
  }

  /**
   * Subscribe to real-time updates for a tenant
   */
  subscribeToTestRuns(
    tenantId: string,
    callback: (payload: any) => void
  ) {
    if (!enterpriseConfig.ENABLE_REAL_TIME_UPDATES) {
      logger.warn('Real-time updates disabled');
      return null;
    }

    return this.supabase
      .channel(`test_runs:${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'test_runs',
          filter: `tenant_id=eq.${tenantId}`,
        },
        callback
      )
      .subscribe();
  }
}

/**
 * Enterprise PostgreSQL Connection Pool Manager
 * Handles direct database connections with connection pooling
 */
export class PostgreSQLPoolManager {
  private static instance: PostgreSQLPoolManager;
  private pool: Pool;
  private readReplicaPools: Pool[] = [];

  private constructor() {
    const config = getDatabaseConfig(enterpriseConfig);
    
    // Primary connection pool
    this.pool = new Pool({
      ...config,
      application_name: 'playwright-enterprise-primary',
    });

    // Read replica pools (if enabled)
    if (enterpriseConfig.ENABLE_READ_REPLICAS) {
      this.setupReadReplicas();
    }

    // Connection event handlers
    this.pool.on('connect', (client) => {
      logger.debug('New PostgreSQL connection established');
      // Set session configuration for multi-tenancy
      client.query('SET row_security = on');
    });

    this.pool.on('error', (err, client) => {
      logger.error('PostgreSQL pool error', { error: err });
    });

    logger.info('PostgreSQL connection pool initialized', {
      maxConnections: config.max,
      readReplicas: this.readReplicaPools.length,
    });
  }

  private setupReadReplicas(): void {
    // In production, you would have multiple read replica URLs
    const replicaUrls = process.env.READ_REPLICA_URLS?.split(',') || [];
    
    replicaUrls.forEach((url, index) => {
      const replicaPool = new Pool({
        ...getDatabaseConfig(enterpriseConfig),
        connectionString: url,
        application_name: `playwright-enterprise-replica-${index}`,
      });

      this.readReplicaPools.push(replicaPool);
      logger.info('Read replica pool initialized', { index, url: url.replace(/:[^:]*@/, ':****@') });
    });
  }

  public static getInstance(): PostgreSQLPoolManager {
    if (!PostgreSQLPoolManager.instance) {
      PostgreSQLPoolManager.instance = new PostgreSQLPoolManager();
    }
    return PostgreSQLPoolManager.instance;
  }

  /**
   * Get connection for write operations
   */
  async getWriteConnection(): Promise<PoolClient> {
    return this.pool.connect();
  }

  /**
   * Get connection for read operations (uses read replica if available)
   */
  async getReadConnection(): Promise<PoolClient> {
    if (this.readReplicaPools.length > 0) {
      // Round-robin load balancing across read replicas
      const replicaIndex = Math.floor(Math.random() * this.readReplicaPools.length);
      return this.readReplicaPools[replicaIndex].connect();
    }
    
    return this.pool.connect();
  }

  /**
   * Execute query with tenant context
   */
  async query(
    text: string,
    params: any[] = [],
    tenantId?: string,
    useReadReplica: boolean = false
  ): Promise<any> {
    const client = useReadReplica 
      ? await this.getReadConnection()
      : await this.getWriteConnection();

    try {
      // Execute query directly (tenant isolation handled by application logic)
      const result = await client.query(text, params);
      return result;
    } catch (error) {
      logger.error('Database query failed', { error, query: text, params, tenantId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Execute transaction with tenant context
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>,
    tenantId?: string
  ): Promise<T> {
    const client = await this.getWriteConnection();

    try {
      await client.query('BEGIN');

      // Tenant isolation handled by application logic
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Health check for all connections
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Check primary pool
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();

      // Check read replicas
      for (const replicaPool of this.readReplicaPools) {
        const replicaClient = await replicaPool.connect();
        await replicaClient.query('SELECT 1');
        replicaClient.release();
      }

      return true;
    } catch (error) {
      logger.error('Database health check failed', { error });
      return false;
    }
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    await this.pool.end();
    await Promise.all(this.readReplicaPools.map(pool => pool.end()));
    logger.info('All database connections closed');
  }
}

// Export singleton instances
export const supabaseClient = SupabaseClientManager.getInstance();
export const pgPool = PostgreSQLPoolManager.getInstance();