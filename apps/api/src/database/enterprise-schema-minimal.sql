-- Minimal Enterprise Schema for Trace Viewer
-- Essential tables for getting the system running

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tenants table for SaaS multi-tenancy
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE NOT NULL,
    plan VARCHAR(50) NOT NULL DEFAULT 'starter',
    settings JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Test runs for trace viewer
CREATE TABLE IF NOT EXISTS test_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    suite_id VARCHAR(255),
    suite_name VARCHAR(255) NOT NULL,
    environment VARCHAR(100) NOT NULL DEFAULT 'local',
    browser VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'queued',
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    duration INTEGER DEFAULT 0,
    total_tests INTEGER DEFAULT 0,
    passed_tests INTEGER DEFAULT 0,
    failed_tests INTEGER DEFAULT 0,
    skipped_tests INTEGER DEFAULT 0,
    pass_rate DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE WHEN total_tests > 0 THEN (passed_tests::DECIMAL / total_tests * 100) ELSE 0 END
    ) STORED,
    tags JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Test steps/individual test results
CREATE TABLE IF NOT EXISTS test_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    run_id UUID NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
    test_name VARCHAR(500) NOT NULL,
    status VARCHAR(20) NOT NULL,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    duration INTEGER DEFAULT 0,
    error_message TEXT,
    stack_trace TEXT,
    retry_count INTEGER DEFAULT 0,
    step_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Test artifacts (screenshots, videos, traces)
CREATE TABLE IF NOT EXISTS test_artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    run_id UUID NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
    step_id UUID REFERENCES test_steps(id) ON DELETE CASCADE,
    artifact_type VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_url VARCHAR(500),
    mime_type VARCHAR(100),
    file_size BIGINT,
    width INTEGER,
    height INTEGER,
    duration INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_test_runs_tenant_created ON test_runs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_steps_run_id ON test_steps(run_id);
CREATE INDEX IF NOT EXISTS idx_test_artifacts_run_id ON test_artifacts(run_id);

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login TIMESTAMPTZ,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);

-- Insert default tenant for development
INSERT INTO tenants (id, name, subdomain, plan, status)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Default Development Tenant',
    'dev',
    'enterprise',
    'active'
) ON CONFLICT (id) DO NOTHING;

-- Insert demo user (admin@demo.com / demo123)
INSERT INTO users (id, tenant_id, email, password_hash, name, role, is_active)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'admin@demo.com',
    '$2b$12$RsHVy0d1o/YUB0ARI5eVIeYZB2hLRt3Pc8BMK.0dd1bEsRKE2XIuG', -- bcrypt hash of 'demo123'
    'Demo Admin',
    'admin',
    true
) ON CONFLICT (email) DO NOTHING;