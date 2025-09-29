// Test database setup and management
import { Pool, PoolClient } from 'pg';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { 
  tenantFixtures, 
  userFixtures, 
  testRunFixtures, 
  testCaseFixtures, 
  apiKeyFixtures,
  TenantFixture,
  UserFixture,
  TestRunFixture,
  TestCaseFixture,
  ApiKeyFixture
} from '../fixtures/database-fixtures';

export interface TestDatabaseConfig {
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
}

export class TestDatabase {
  private pool: Pool;
  private client: PoolClient | null = null;
  private dbName: string;
  private adminPool: Pool;

  constructor(private config: TestDatabaseConfig = {}) {
    this.dbName = `playwright_test_${randomUUID().replace(/-/g, '').substring(0, 8)}`;
    
    const defaultConfig = {
      host: process.env.TEST_DB_HOST || 'localhost',
      port: parseInt(process.env.TEST_DB_PORT || '5432'),
      username: process.env.TEST_DB_USER || 'postgres',
      password: process.env.TEST_DB_PASSWORD || 'postgres',
      ssl: false
    };

    const finalConfig = { ...defaultConfig, ...config };

    // Admin pool for database creation/deletion
    this.adminPool = new Pool({
      host: finalConfig.host,
      port: finalConfig.port,
      user: finalConfig.username,
      password: finalConfig.password,
      database: 'postgres',
      ssl: finalConfig.ssl
    });

    // Application pool for test database
    this.pool = new Pool({
      host: finalConfig.host,
      port: finalConfig.port,
      user: finalConfig.username,
      password: finalConfig.password,
      database: this.dbName,
      ssl: finalConfig.ssl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async setup(): Promise<void> {
    try {
      // Create test database
      await this.createDatabase();
      
      // Initialize schema
      await this.initializeSchema();
      
      // Load fixtures
      await this.loadFixtures();
      
      console.log(`Test database '${this.dbName}' setup complete`);
    } catch (error) {
      console.error('Failed to setup test database:', error);
      throw error;
    }
  }

  async teardown(): Promise<void> {
    try {
      if (this.client) {
        this.client.release();
        this.client = null;
      }
      
      await this.pool.end();
      await this.dropDatabase();
      await this.adminPool.end();
      
      console.log(`Test database '${this.dbName}' cleaned up`);
    } catch (error) {
      console.error('Failed to teardown test database:', error);
      throw error;
    }
  }

  async getClient(): Promise<PoolClient> {
    if (!this.client) {
      this.client = await this.pool.connect();
    }
    return this.client;
  }

  async query(text: string, params?: any[]): Promise<any> {
    const client = await this.getClient();
    return client.query(text, params);
  }

  private async createDatabase(): Promise<void> {
    const adminClient = await this.adminPool.connect();
    try {
      await adminClient.query(`CREATE DATABASE "${this.dbName}"`);
    } catch (error: any) {
      if (!error.message?.includes('already exists')) {
        throw error;
      }
    } finally {
      adminClient.release();
    }
  }

  private async dropDatabase(): Promise<void> {
    const adminClient = await this.adminPool.connect();
    try {
      // Terminate all connections to the test database
      await adminClient.query(`
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = $1 AND pid <> pg_backend_pid()
      `, [this.dbName]);
      
      await adminClient.query(`DROP DATABASE IF EXISTS "${this.dbName}"`);
    } finally {
      adminClient.release();
    }
  }

  private async initializeSchema(): Promise<void> {
    const schemaPath = join(__dirname, '../../database/production-init.sql');
    let schema: string;
    
    try {
      schema = await fs.readFile(schemaPath, 'utf-8');
    } catch (error) {
      // Fallback to inline schema if file not found
      schema = this.getInlineSchema();
    }

    // Remove any existing database/user creation commands for test environment
    const cleanedSchema = schema
      .replace(/CREATE ROLE.*?;/gs, '')
      .replace(/GRANT.*TO app_user;/gs, '')
      .replace(/INSERT INTO tenants.*ON CONFLICT.*DO NOTHING;/gs, '')
      .replace(/INSERT INTO users.*ON CONFLICT.*DO NOTHING;/gs, '');

    const client = await this.getClient();
    await client.query(cleanedSchema);
  }

  private getInlineSchema(): string {
    return `
      -- Enable required extensions
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE EXTENSION IF NOT EXISTS "pg_trgm";

      -- Create tenants table
      CREATE TABLE tenants (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        subdomain VARCHAR(100) UNIQUE NOT NULL,
        plan VARCHAR(50) NOT NULL DEFAULT 'free',
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Create users table
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        is_active BOOLEAN NOT NULL DEFAULT true,
        last_login TIMESTAMP WITH TIME ZONE,
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Create API keys table
      CREATE TABLE api_keys (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        key_hash VARCHAR(64) UNIQUE NOT NULL,
        permissions JSONB DEFAULT '[]',
        is_active BOOLEAN NOT NULL DEFAULT true,
        last_used TIMESTAMP WITH TIME ZONE,
        expires_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Create test runs table
      CREATE TABLE test_runs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        project_name VARCHAR(255) NOT NULL,
        branch VARCHAR(255) DEFAULT 'main',
        commit_hash VARCHAR(40),
        status VARCHAR(50) NOT NULL DEFAULT 'running',
        total_tests INTEGER DEFAULT 0,
        passed_tests INTEGER DEFAULT 0,
        failed_tests INTEGER DEFAULT 0,
        skipped_tests INTEGER DEFAULT 0,
        duration_ms INTEGER DEFAULT 0,
        metadata JSONB DEFAULT '{}',
        artifacts JSONB DEFAULT '[]',
        started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Create test cases table
      CREATE TABLE test_cases (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        test_run_id UUID REFERENCES test_runs(id) ON DELETE CASCADE,
        name VARCHAR(500) NOT NULL,
        suite VARCHAR(255),
        file_path VARCHAR(500),
        status VARCHAR(50) NOT NULL,
        duration_ms INTEGER DEFAULT 0,
        error_message TEXT,
        stack_trace TEXT,
        annotations JSONB DEFAULT '[]',
        steps JSONB DEFAULT '[]',
        attachments JSONB DEFAULT '[]',
        retry_count INTEGER DEFAULT 0,
        browser VARCHAR(100),
        viewport VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Create browser sessions table
      CREATE TABLE browser_sessions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        test_run_id UUID REFERENCES test_runs(id) ON DELETE CASCADE,
        browser VARCHAR(100) NOT NULL,
        version VARCHAR(100),
        platform VARCHAR(100),
        viewport VARCHAR(50),
        user_agent TEXT,
        started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP WITH TIME ZONE,
        total_duration_ms INTEGER DEFAULT 0,
        page_count INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0
      );

      -- Create traces table
      CREATE TABLE traces (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        test_case_id UUID REFERENCES test_cases(id) ON DELETE CASCADE,
        file_path VARCHAR(500) NOT NULL,
        file_size INTEGER,
        file_hash VARCHAR(64),
        storage_location VARCHAR(500),
        compression_type VARCHAR(50) DEFAULT 'zip',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP WITH TIME ZONE
      );

      -- Create indexes
      CREATE INDEX idx_tenants_subdomain ON tenants(subdomain);
      CREATE INDEX idx_users_tenant_id ON users(tenant_id);
      CREATE INDEX idx_users_email ON users(email);
      CREATE INDEX idx_api_keys_tenant_id ON api_keys(tenant_id);
      CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
      CREATE INDEX idx_test_runs_tenant_id ON test_runs(tenant_id);
      CREATE INDEX idx_test_runs_status ON test_runs(status);
      CREATE INDEX idx_test_cases_tenant_id ON test_cases(tenant_id);
      CREATE INDEX idx_test_cases_run_id ON test_cases(test_run_id);
      CREATE INDEX idx_test_cases_status ON test_cases(status);
    `;
  }

  private async loadFixtures(): Promise<void> {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');

      // Load tenants
      for (const tenant of tenantFixtures) {
        await client.query(`
          INSERT INTO tenants (id, name, subdomain, plan, status, settings, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          tenant.id, tenant.name, tenant.subdomain, tenant.plan,
          tenant.status, JSON.stringify(tenant.settings),
          new Date(), new Date()
        ]);
      }

      // Load users
      for (const user of userFixtures) {
        await client.query(`
          INSERT INTO users (id, tenant_id, email, password_hash, name, role, is_active, settings, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          user.id, user.tenant_id, user.email, user.password_hash,
          user.name, user.role, user.is_active, JSON.stringify(user.settings),
          new Date(), new Date()
        ]);
      }

      // Load API keys
      for (const apiKey of apiKeyFixtures) {
        await client.query(`
          INSERT INTO api_keys (id, tenant_id, user_id, name, key_hash, permissions, is_active, expires_at, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          apiKey.id, apiKey.tenant_id, apiKey.user_id, apiKey.name,
          apiKey.key_hash, JSON.stringify(apiKey.permissions), apiKey.is_active,
          apiKey.expires_at, new Date()
        ]);
      }

      // Load test runs
      for (const testRun of testRunFixtures) {
        await client.query(`
          INSERT INTO test_runs (
            id, tenant_id, user_id, project_name, branch, commit_hash, status,
            total_tests, passed_tests, failed_tests, skipped_tests, duration_ms,
            metadata, artifacts, started_at, completed_at, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        `, [
          testRun.id, testRun.tenant_id, testRun.user_id, testRun.project_name,
          testRun.branch, testRun.commit_hash, testRun.status, testRun.total_tests,
          testRun.passed_tests, testRun.failed_tests, testRun.skipped_tests,
          testRun.duration_ms, JSON.stringify(testRun.metadata),
          JSON.stringify(testRun.artifacts), testRun.started_at, testRun.completed_at,
          new Date()
        ]);
      }

      // Load test cases
      for (const testCase of testCaseFixtures) {
        await client.query(`
          INSERT INTO test_cases (
            id, tenant_id, test_run_id, name, suite, file_path, status, duration_ms,
            error_message, stack_trace, annotations, steps, attachments, retry_count,
            browser, viewport, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        `, [
          testCase.id, testCase.tenant_id, testCase.test_run_id, testCase.name,
          testCase.suite, testCase.file_path, testCase.status, testCase.duration_ms,
          testCase.error_message, testCase.stack_trace, JSON.stringify(testCase.annotations),
          JSON.stringify(testCase.steps), JSON.stringify(testCase.attachments),
          testCase.retry_count, testCase.browser, testCase.viewport, new Date()
        ]);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }

  // Helper methods for tests
  async clearTable(tableName: string): Promise<void> {
    await this.query(`TRUNCATE TABLE ${tableName} CASCADE`);
  }

  async insertTenant(tenant: Partial<TenantFixture>): Promise<string> {
    const id = tenant.id || randomUUID();
    await this.query(`
      INSERT INTO tenants (id, name, subdomain, plan, status, settings)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      id, tenant.name, tenant.subdomain, tenant.plan || 'free',
      tenant.status || 'active', JSON.stringify(tenant.settings || {})
    ]);
    return id;
  }

  async insertUser(user: Partial<UserFixture>): Promise<string> {
    const id = user.id || randomUUID();
    await this.query(`
      INSERT INTO users (id, tenant_id, email, password_hash, name, role, is_active, settings)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      id, user.tenant_id, user.email, user.password_hash,
      user.name, user.role || 'user', user.is_active !== false,
      JSON.stringify(user.settings || {})
    ]);
    return id;
  }

  async insertTestRun(testRun: Partial<TestRunFixture>): Promise<string> {
    const id = testRun.id || randomUUID();
    const now = new Date();
    await this.query(`
      INSERT INTO test_runs (
        id, tenant_id, user_id, project_name, branch, commit_hash, status,
        total_tests, passed_tests, failed_tests, skipped_tests, duration_ms,
        metadata, artifacts, started_at, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    `, [
      id, testRun.tenant_id, testRun.user_id, testRun.project_name || 'test-project',
      testRun.branch || 'main', testRun.commit_hash, testRun.status || 'passed',
      testRun.total_tests || 0, testRun.passed_tests || 0, testRun.failed_tests || 0,
      testRun.skipped_tests || 0, testRun.duration_ms || 0,
      JSON.stringify(testRun.metadata || {}), JSON.stringify(testRun.artifacts || []),
      testRun.started_at || now, testRun.completed_at
    ]);
    return id;
  }

  async getRowCount(tableName: string): Promise<number> {
    const result = await this.query(`SELECT COUNT(*) as count FROM ${tableName}`);
    return parseInt(result.rows[0].count);
  }

  getDatabaseName(): string {
    return this.dbName;
  }
}