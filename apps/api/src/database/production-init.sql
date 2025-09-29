-- Production Database Initialization Script
-- Playwright Test Management Platform - Enterprise Schema

BEGIN;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create application user and set permissions
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'app_user') THEN
        CREATE ROLE app_user LOGIN PASSWORD 'changeme_app_password';
    END IF;
END
$$;

-- Grant necessary permissions
GRANT CONNECT ON DATABASE playwright_enterprise_prod TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;

-- Create tenants table first (referenced by other tables)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE NOT NULL,
    plan VARCHAR(50) NOT NULL DEFAULT 'free',
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_subdomain CHECK (subdomain ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'),
    CONSTRAINT valid_plan CHECK (plan IN ('free', 'starter', 'professional', 'enterprise')),
    CONSTRAINT valid_status CHECK (status IN ('active', 'suspended', 'cancelled'))
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT valid_role CHECK (role IN ('admin', 'manager', 'user', 'viewer'))
);

-- Create API keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(64) UNIQUE NOT NULL,
    permissions JSONB DEFAULT '[]',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_used TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure key_hash is SHA-256
    CONSTRAINT valid_key_hash CHECK (length(key_hash) = 64)
);

-- Create test runs table (partitioned by created_at for performance)
CREATE TABLE IF NOT EXISTS test_runs (
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('running', 'passed', 'failed', 'cancelled', 'timeout')),
    CONSTRAINT valid_commit_hash CHECK (commit_hash IS NULL OR length(commit_hash) = 40),
    CONSTRAINT valid_test_counts CHECK (
        total_tests >= 0 AND 
        passed_tests >= 0 AND 
        failed_tests >= 0 AND 
        skipped_tests >= 0 AND
        passed_tests + failed_tests + skipped_tests <= total_tests
    )
) PARTITION BY RANGE (created_at);

-- Create partitions for test_runs (monthly partitions for the current year)
DO $$
DECLARE
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
BEGIN
    FOR i IN 0..11 LOOP
        start_date := DATE_TRUNC('month', CURRENT_DATE) + (i || ' months')::INTERVAL;
        end_date := start_date + INTERVAL '1 month';
        partition_name := 'test_runs_' || TO_CHAR(start_date, 'YYYY_MM');
        
        EXECUTE FORMAT('CREATE TABLE IF NOT EXISTS %I PARTITION OF test_runs 
                       FOR VALUES FROM (%L) TO (%L)', 
                       partition_name, start_date, end_date);
    END LOOP;
END $$;

-- Create test cases table
CREATE TABLE IF NOT EXISTS test_cases (
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_test_status CHECK (status IN ('passed', 'failed', 'skipped', 'timedout'))
);

-- Create browser sessions table for tracking browser usage
CREATE TABLE IF NOT EXISTS browser_sessions (
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

-- Create traces table for storing trace files metadata
CREATE TABLE IF NOT EXISTS traces (
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

-- Create indexes for optimal query performance
-- Tenants
CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- Users  
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tenant_email ON users(tenant_id, email);

-- API Keys
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant_id ON api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;

-- Test Runs
CREATE INDEX IF NOT EXISTS idx_test_runs_tenant_id ON test_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_user_id ON test_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_status ON test_runs(status);
CREATE INDEX IF NOT EXISTS idx_test_runs_project ON test_runs(tenant_id, project_name);
CREATE INDEX IF NOT EXISTS idx_test_runs_created_at ON test_runs(created_at);
CREATE INDEX IF NOT EXISTS idx_test_runs_completed_at ON test_runs(completed_at) WHERE completed_at IS NOT NULL;

-- Test Cases
CREATE INDEX IF NOT EXISTS idx_test_cases_tenant_id ON test_cases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_run_id ON test_cases(test_run_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_status ON test_cases(status);
CREATE INDEX IF NOT EXISTS idx_test_cases_name ON test_cases USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_test_cases_file_path ON test_cases(file_path);

-- Browser Sessions
CREATE INDEX IF NOT EXISTS idx_browser_sessions_tenant_id ON browser_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_browser_sessions_run_id ON browser_sessions(test_run_id);
CREATE INDEX IF NOT EXISTS idx_browser_sessions_browser ON browser_sessions(browser);

-- Traces
CREATE INDEX IF NOT EXISTS idx_traces_tenant_id ON traces(tenant_id);
CREATE INDEX IF NOT EXISTS idx_traces_test_case_id ON traces(test_case_id);
CREATE INDEX IF NOT EXISTS idx_traces_expires_at ON traces(expires_at) WHERE expires_at IS NOT NULL;

-- Create updated_at triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at columns
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) for multi-tenancy
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE browser_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE traces ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (examples - adjust based on your authentication system)
-- Users can only see their own tenant's data
CREATE POLICY tenant_isolation_users ON users
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_test_runs ON test_runs
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_test_cases ON test_cases
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Grant permissions to application user
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Create default tenant for system use
INSERT INTO tenants (id, name, subdomain, plan, status) 
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'System Tenant',
    'system',
    'enterprise',
    'active'
) ON CONFLICT (id) DO NOTHING;

-- Create default admin user (password: admin123 - CHANGE THIS!)
INSERT INTO users (id, tenant_id, email, password_hash, name, role, is_active)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'admin@system.local',
    '$2a$12$rQvK7sL8YQHfDcVgmRfpQeLF7lJ5zN5GxP3fKsH6l.Lx8KZN6xGDG', -- bcrypt hash of 'admin123'
    'System Administrator',
    'admin',
    true
) ON CONFLICT (email) DO NOTHING;

COMMIT;

-- Analyze tables for optimal query planning
ANALYZE;