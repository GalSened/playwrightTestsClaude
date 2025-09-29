#!/usr/bin/env node
// Database setup utility for tests
const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

class TestDatabaseSetup {
  constructor() {
    this.config = {
      host: process.env.TEST_DB_HOST || 'localhost',
      port: parseInt(process.env.TEST_DB_PORT || '5432'),
      user: process.env.TEST_DB_USER || 'postgres',
      password: process.env.TEST_DB_PASSWORD || 'postgres',
    };
  }

  async createTestDatabase(dbName = 'playwright_test_template') {
    const adminPool = new Pool({
      ...this.config,
      database: 'postgres',
    });

    try {
      const adminClient = await adminPool.connect();
      
      // Drop existing test database
      try {
        await adminClient.query(`DROP DATABASE IF EXISTS "${dbName}"`);
        console.log(`Dropped existing database: ${dbName}`);
      } catch (error) {
        // Ignore error if database doesn't exist
      }

      // Create new test database
      await adminClient.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Created database: ${dbName}`);
      
      adminClient.release();
    } finally {
      await adminPool.end();
    }

    // Initialize schema
    const testPool = new Pool({
      ...this.config,
      database: dbName,
    });

    try {
      const client = await testPool.connect();
      
      // Load and execute schema
      const schemaPath = path.join(__dirname, '../src/database/production-init.sql');
      let schema;
      
      try {
        schema = await fs.readFile(schemaPath, 'utf-8');
      } catch (error) {
        console.warn('Schema file not found, using inline schema');
        schema = this.getInlineSchema();
      }

      // Clean schema for test environment
      const cleanedSchema = schema
        .replace(/CREATE ROLE.*?;/gs, '')
        .replace(/GRANT.*TO app_user;/gs, '')
        .replace(/INSERT INTO tenants.*ON CONFLICT.*DO NOTHING;/gs, '')
        .replace(/INSERT INTO users.*ON CONFLICT.*DO NOTHING;/gs, '');

      await client.query(cleanedSchema);
      console.log('Schema initialized successfully');
      
      client.release();
    } finally {
      await testPool.end();
    }
  }

  getInlineSchema() {
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
    `;
  }

  async cleanupTestDatabases() {
    console.log('Cleaning up test databases...');
    
    const adminPool = new Pool({
      ...this.config,
      database: 'postgres',
    });

    try {
      const adminClient = await adminPool.connect();
      
      // Find all test databases
      const result = await adminClient.query(`
        SELECT datname FROM pg_database 
        WHERE datname LIKE 'playwright_test_%'
      `);

      for (const row of result.rows) {
        const dbName = row.datname;
        
        try {
          // Terminate connections
          await adminClient.query(`
            SELECT pg_terminate_backend(pg_stat_activity.pid)
            FROM pg_stat_activity
            WHERE pg_stat_activity.datname = $1 AND pid <> pg_backend_pid()
          `, [dbName]);
          
          // Drop database
          await adminClient.query(`DROP DATABASE IF EXISTS "${dbName}"`);
          console.log(`Dropped database: ${dbName}`);
        } catch (error) {
          console.error(`Failed to drop database ${dbName}:`, error.message);
        }
      }
      
      adminClient.release();
    } finally {
      await adminPool.end();
    }
  }

  async checkConnection() {
    console.log('Checking PostgreSQL connection...');
    
    const pool = new Pool({
      ...this.config,
      database: 'postgres',
      connectionTimeoutMillis: 5000,
    });

    try {
      const client = await pool.connect();
      const result = await client.query('SELECT version()');
      console.log('✓ PostgreSQL connection successful');
      console.log(`Version: ${result.rows[0].version.split(' ').slice(0, 2).join(' ')}`);
      client.release();
    } catch (error) {
      console.error('✗ PostgreSQL connection failed:', error.message);
      console.error('\nPlease ensure PostgreSQL is running and accessible.');
      console.error('Docker command: docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres');
      throw error;
    } finally {
      await pool.end();
    }
  }

  showHelp() {
    console.log(`
Test Database Setup Utility

Usage: node scripts/test-db-setup.js [command]

Commands:
  setup     - Create test database template (default)
  cleanup   - Remove all test databases
  check     - Check database connection
  help      - Show this help message

Environment Variables:
  TEST_DB_HOST     - Database host (default: localhost)
  TEST_DB_PORT     - Database port (default: 5432)
  TEST_DB_USER     - Database user (default: postgres)
  TEST_DB_PASSWORD - Database password (default: postgres)

Examples:
  node scripts/test-db-setup.js setup
  node scripts/test-db-setup.js cleanup
  TEST_DB_HOST=myhost node scripts/test-db-setup.js check
    `);
  }

  async run() {
    const command = process.argv[2] || 'setup';

    try {
      switch (command) {
        case 'setup':
          await this.checkConnection();
          await this.createTestDatabase();
          console.log('✓ Test database setup complete');
          break;
          
        case 'cleanup':
          await this.checkConnection();
          await this.cleanupTestDatabases();
          console.log('✓ Test databases cleaned up');
          break;
          
        case 'check':
          await this.checkConnection();
          break;
          
        case 'help':
        case '--help':
        case '-h':
          this.showHelp();
          break;
          
        default:
          console.error(`Unknown command: ${command}`);
          this.showHelp();
          process.exit(1);
      }
    } catch (error) {
      console.error('Setup failed:', error.message);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const setup = new TestDatabaseSetup();
  setup.run();
}

module.exports = TestDatabaseSetup;