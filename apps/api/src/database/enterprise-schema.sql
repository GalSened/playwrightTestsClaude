-- Enterprise Multi-Tenant Database Schema
-- Designed for high-scale SaaS deployment with row-level security
-- Supports partitioning, indexing, and multi-tenancy

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =============================================================================
-- MULTI-TENANCY INFRASTRUCTURE
-- =============================================================================

-- Tenants table for SaaS multi-tenancy
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE NOT NULL,
    plan VARCHAR(50) NOT NULL DEFAULT 'starter',
    settings JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    max_users INTEGER DEFAULT 10,
    max_test_runs_per_month INTEGER DEFAULT 1000,
    storage_limit_gb INTEGER DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT tenants_subdomain_format CHECK (subdomain ~* '^[a-z0-9-]+$'),
    CONSTRAINT tenants_plan_valid CHECK (plan IN ('starter', 'professional', 'enterprise'))
);

-- Tenant users and authentication
CREATE TABLE IF NOT EXISTS tenant_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    permissions JSONB NOT NULL DEFAULT '[]',
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, email),
    CONSTRAINT tenant_users_role_valid CHECK (role IN ('owner', 'admin', 'member', 'viewer'))
);

-- API Keys for programmatic access
CREATE TABLE IF NOT EXISTS tenant_api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    key_prefix VARCHAR(20) NOT NULL,
    permissions JSONB NOT NULL DEFAULT '[]',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_by UUID REFERENCES tenant_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT tenant_api_keys_status_valid CHECK (status IN ('active', 'disabled', 'expired')),
    CONSTRAINT tenant_api_keys_name_length CHECK (LENGTH(name) >= 3)
);

-- Indexes for API keys
CREATE INDEX IF NOT EXISTS idx_tenant_api_keys_tenant_id ON tenant_api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_api_keys_key_hash ON tenant_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_tenant_api_keys_status ON tenant_api_keys(status);
CREATE INDEX IF NOT EXISTS idx_tenant_api_keys_prefix ON tenant_api_keys(key_prefix);

-- =============================================================================
-- TEST EXECUTION INFRASTRUCTURE
-- =============================================================================

-- Test Runs (partitioned by tenant and date)
CREATE TABLE IF NOT EXISTS test_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    suite_id VARCHAR(100) NOT NULL,
    suite_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'queued',
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    duration INTEGER, -- milliseconds
    environment VARCHAR(50) NOT NULL DEFAULT 'local',
    browser VARCHAR(50),
    test_mode VARCHAR(20) DEFAULT 'headless',
    total_tests INTEGER NOT NULL DEFAULT 0,
    passed_tests INTEGER NOT NULL DEFAULT 0,
    failed_tests INTEGER NOT NULL DEFAULT 0,
    skipped_tests INTEGER NOT NULL DEFAULT 0,
    pass_rate DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE WHEN total_tests > 0 
        THEN (passed_tests::DECIMAL / total_tests::DECIMAL) * 100 
        ELSE 0 END
    ) STORED,
    tags TEXT[],
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT test_runs_status_valid CHECK (status IN ('queued', 'running', 'passed', 'failed', 'cancelled')),
    CONSTRAINT test_runs_environment_valid CHECK (environment IN ('local', 'dev', 'staging', 'production')),
    CONSTRAINT test_runs_duration_positive CHECK (duration IS NULL OR duration >= 0),
    CONSTRAINT test_runs_counts_valid CHECK (
        total_tests >= 0 AND 
        passed_tests >= 0 AND 
        failed_tests >= 0 AND 
        skipped_tests >= 0 AND
        total_tests = passed_tests + failed_tests + skipped_tests
    )
) PARTITION BY HASH (tenant_id);

-- Test Steps (partitioned by tenant)
CREATE TABLE IF NOT EXISTS test_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    run_id UUID NOT NULL,
    test_id VARCHAR(255) NOT NULL,
    test_name VARCHAR(500) NOT NULL,
    step_index INTEGER NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    action_name TEXT NOT NULL,
    selector TEXT,
    url TEXT,
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ,
    duration INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'passed',
    error_message TEXT,
    stack_trace TEXT,
    expected_value TEXT,
    actual_value TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT test_steps_status_valid CHECK (status IN ('passed', 'failed', 'skipped')),
    CONSTRAINT test_steps_step_index_positive CHECK (step_index >= 0),
    CONSTRAINT test_steps_retry_count_positive CHECK (retry_count >= 0),
    CONSTRAINT test_steps_duration_positive CHECK (duration IS NULL OR duration >= 0)
) PARTITION BY HASH (tenant_id);

-- Test Artifacts (partitioned by tenant)
CREATE TABLE IF NOT EXISTS test_artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    run_id UUID NOT NULL,
    step_id UUID,
    artifact_type VARCHAR(50) NOT NULL,
    name VARCHAR(500) NOT NULL,
    file_path TEXT NOT NULL,
    file_url TEXT,
    mime_type VARCHAR(100),
    file_size BIGINT,
    width INTEGER,
    height INTEGER,
    duration INTEGER, -- for videos
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT test_artifacts_type_valid CHECK (artifact_type IN ('screenshot', 'video', 'trace', 'log', 'report')),
    CONSTRAINT test_artifacts_file_size_positive CHECK (file_size IS NULL OR file_size > 0),
    CONSTRAINT test_artifacts_dimensions_positive CHECK (
        (width IS NULL OR width > 0) AND (height IS NULL OR height > 0)
    )
) PARTITION BY HASH (tenant_id);

-- Console Logs (partitioned by tenant)
CREATE TABLE IF NOT EXISTS console_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    run_id UUID NOT NULL,
    step_id UUID,
    timestamp TIMESTAMPTZ NOT NULL,
    level VARCHAR(20) NOT NULL,
    source VARCHAR(50) NOT NULL DEFAULT 'console',
    message TEXT NOT NULL,
    url TEXT,
    line_number INTEGER,
    column_number INTEGER,
    stack_trace TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT console_logs_level_valid CHECK (level IN ('error', 'warn', 'info', 'debug', 'log')),
    CONSTRAINT console_logs_line_positive CHECK (line_number IS NULL OR line_number > 0),
    CONSTRAINT console_logs_column_positive CHECK (column_number IS NULL OR column_number > 0)
) PARTITION BY HASH (tenant_id);

-- Network Logs (partitioned by tenant)
CREATE TABLE IF NOT EXISTS network_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    run_id UUID NOT NULL,
    step_id UUID,
    timestamp TIMESTAMPTZ NOT NULL,
    method VARCHAR(10) NOT NULL,
    url TEXT NOT NULL,
    status_code INTEGER,
    status_text VARCHAR(100),
    duration INTEGER,
    failed BOOLEAN NOT NULL DEFAULT FALSE,
    failure_reason TEXT,
    request_headers JSONB,
    response_headers JSONB,
    request_size INTEGER,
    response_size INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT network_logs_method_valid CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD')),
    CONSTRAINT network_logs_status_code_valid CHECK (status_code IS NULL OR (status_code >= 100 AND status_code < 600)),
    CONSTRAINT network_logs_duration_positive CHECK (duration IS NULL OR duration >= 0),
    CONSTRAINT network_logs_size_positive CHECK (
        (request_size IS NULL OR request_size >= 0) AND 
        (response_size IS NULL OR response_size >= 0)
    )
) PARTITION BY HASH (tenant_id);

-- =============================================================================
-- ANALYTICS AND REPORTING
-- =============================================================================

-- Performance Metrics (aggregated data)
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    run_id UUID NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(12,4) NOT NULL,
    metric_unit VARCHAR(20) NOT NULL,
    tags JSONB NOT NULL DEFAULT '{}',
    recorded_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT performance_metrics_metric_name_valid CHECK (
        metric_name IN ('cpu_usage', 'memory_usage', 'network_latency', 'page_load_time', 'test_duration')
    )
) PARTITION BY HASH (tenant_id);

-- Usage Analytics (for billing and insights)
CREATE TABLE IF NOT EXISTS usage_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    test_runs_count INTEGER NOT NULL DEFAULT 0,
    total_duration INTEGER NOT NULL DEFAULT 0, -- milliseconds
    storage_used_bytes BIGINT NOT NULL DEFAULT 0,
    api_requests_count INTEGER NOT NULL DEFAULT 0,
    unique_users_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, date)
);

-- =============================================================================
-- PARTITIONING SETUP
-- =============================================================================

-- Create partitions for each table (0-15 for hash partitioning)
DO $$
BEGIN
    FOR i IN 0..15 LOOP
        -- Test runs partitions
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS test_runs_%s PARTITION OF test_runs
            FOR VALUES WITH (MODULUS 16, REMAINDER %s);
        ', i, i);
        
        -- Test steps partitions
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS test_steps_%s PARTITION OF test_steps
            FOR VALUES WITH (MODULUS 16, REMAINDER %s);
        ', i, i);
        
        -- Test artifacts partitions
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS test_artifacts_%s PARTITION OF test_artifacts
            FOR VALUES WITH (MODULUS 16, REMAINDER %s);
        ', i, i);
        
        -- Console logs partitions
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS console_logs_%s PARTITION OF console_logs
            FOR VALUES WITH (MODULUS 16, REMAINDER %s);
        ', i, i);
        
        -- Network logs partitions
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS network_logs_%s PARTITION OF network_logs
            FOR VALUES WITH (MODULUS 16, REMAINDER %s);
        ', i, i);
        
        -- Performance metrics partitions
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS performance_metrics_%s PARTITION OF performance_metrics
            FOR VALUES WITH (MODULUS 16, REMAINDER %s);
        ', i, i);
    END LOOP;
END
$$;

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Tenant indexes
CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_id ON tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_email ON tenant_users(email);

-- Test runs indexes
CREATE INDEX IF NOT EXISTS idx_test_runs_tenant_id ON test_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_suite_id ON test_runs(tenant_id, suite_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_status ON test_runs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_test_runs_started_at ON test_runs(tenant_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_runs_environment ON test_runs(tenant_id, environment);
CREATE INDEX IF NOT EXISTS idx_test_runs_pass_rate ON test_runs(tenant_id, pass_rate);

-- Test steps indexes  
CREATE INDEX IF NOT EXISTS idx_test_steps_tenant_id ON test_steps(tenant_id);
CREATE INDEX IF NOT EXISTS idx_test_steps_run_id ON test_steps(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_test_steps_test_id ON test_steps(tenant_id, test_id);
CREATE INDEX IF NOT EXISTS idx_test_steps_status ON test_steps(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_test_steps_started_at ON test_steps(tenant_id, started_at);

-- Test artifacts indexes
CREATE INDEX IF NOT EXISTS idx_test_artifacts_tenant_id ON test_artifacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_test_artifacts_run_id ON test_artifacts(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_test_artifacts_step_id ON test_artifacts(tenant_id, step_id);
CREATE INDEX IF NOT EXISTS idx_test_artifacts_type ON test_artifacts(tenant_id, artifact_type);
CREATE INDEX IF NOT EXISTS idx_test_artifacts_created_at ON test_artifacts(tenant_id, created_at DESC);

-- Console logs indexes
CREATE INDEX IF NOT EXISTS idx_console_logs_tenant_id ON console_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_console_logs_run_id ON console_logs(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_console_logs_step_id ON console_logs(tenant_id, step_id);
CREATE INDEX IF NOT EXISTS idx_console_logs_level ON console_logs(tenant_id, level);
CREATE INDEX IF NOT EXISTS idx_console_logs_timestamp ON console_logs(tenant_id, timestamp DESC);

-- Network logs indexes
CREATE INDEX IF NOT EXISTS idx_network_logs_tenant_id ON network_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_network_logs_run_id ON network_logs(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_network_logs_step_id ON network_logs(tenant_id, step_id);
CREATE INDEX IF NOT EXISTS idx_network_logs_status_code ON network_logs(tenant_id, status_code);
CREATE INDEX IF NOT EXISTS idx_network_logs_failed ON network_logs(tenant_id, failed);

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_test_runs_search ON test_runs USING gin(
    (suite_name || ' ' || COALESCE(tags::text, '')) gin_trgm_ops
);
CREATE INDEX IF NOT EXISTS idx_test_steps_search ON test_steps USING gin(
    (test_name || ' ' || action_name || ' ' || COALESCE(selector, '')) gin_trgm_ops
);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_usage_analytics_tenant_date ON usage_analytics(tenant_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_tenant_recorded ON performance_metrics(tenant_id, recorded_at DESC);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE console_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for multi-tenancy
CREATE POLICY tenant_isolation_policy ON test_runs
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_policy ON test_steps
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_policy ON test_artifacts
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_policy ON console_logs
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_policy ON network_logs
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_policy ON performance_metrics
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_policy ON usage_analytics
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- =============================================================================
-- TRIGGERS AND FUNCTIONS
-- =============================================================================

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_users_updated_at BEFORE UPDATE ON tenant_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_test_runs_updated_at BEFORE UPDATE ON test_runs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usage_analytics_updated_at BEFORE UPDATE ON usage_analytics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate test run statistics
CREATE OR REPLACE FUNCTION calculate_run_statistics(run_uuid UUID)
RETURNS void AS $$
BEGIN
    UPDATE test_runs SET
        total_tests = (
            SELECT COUNT(DISTINCT test_id)
            FROM test_steps 
            WHERE run_id = run_uuid
        ),
        passed_tests = (
            SELECT COUNT(DISTINCT test_id)
            FROM test_steps 
            WHERE run_id = run_uuid 
            GROUP BY test_id
            HAVING bool_and(status = 'passed')
        ),
        failed_tests = (
            SELECT COUNT(DISTINCT test_id)
            FROM test_steps 
            WHERE run_id = run_uuid 
            GROUP BY test_id
            HAVING bool_or(status = 'failed')
        )
    WHERE id = run_uuid;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SCHEDULED MAINTENANCE
-- =============================================================================

-- Schedule automatic cleanup of old data (runs every day at 2 AM)
SELECT cron.schedule('cleanup-old-data', '0 2 * * *', $$
    DELETE FROM test_runs 
    WHERE tenant_id IN (
        SELECT id FROM tenants WHERE plan = 'starter'
    ) AND created_at < NOW() - INTERVAL '90 days';
    
    DELETE FROM test_runs 
    WHERE tenant_id IN (
        SELECT id FROM tenants WHERE plan = 'professional'
    ) AND created_at < NOW() - INTERVAL '1 year';
    
    DELETE FROM test_runs 
    WHERE tenant_id IN (
        SELECT id FROM tenants WHERE plan = 'enterprise'
    ) AND created_at < NOW() - INTERVAL '2 years';
$$);

-- Schedule usage analytics calculation (runs every day at 1 AM)
SELECT cron.schedule('calculate-daily-usage', '0 1 * * *', $$
    INSERT INTO usage_analytics (tenant_id, date, test_runs_count, total_duration, storage_used_bytes)
    SELECT 
        t.id as tenant_id,
        CURRENT_DATE - 1 as date,
        COUNT(tr.id) as test_runs_count,
        COALESCE(SUM(tr.duration), 0) as total_duration,
        COALESCE(SUM(ta.file_size), 0) as storage_used_bytes
    FROM tenants t
    LEFT JOIN test_runs tr ON t.id = tr.tenant_id 
        AND tr.created_at::date = CURRENT_DATE - 1
    LEFT JOIN test_artifacts ta ON tr.id = ta.run_id
    GROUP BY t.id
    ON CONFLICT (tenant_id, date) DO UPDATE SET
        test_runs_count = EXCLUDED.test_runs_count,
        total_duration = EXCLUDED.total_duration,
        storage_used_bytes = EXCLUDED.storage_used_bytes,
        updated_at = NOW();
$$);

-- =============================================================================
-- INITIAL DATA
-- =============================================================================

-- Create default tenant for development
INSERT INTO tenants (id, name, subdomain, plan, status)
VALUES (
    'default'::uuid,
    'Default Organization',
    'default',
    'enterprise',
    'active'
) ON CONFLICT (id) DO NOTHING;

-- Create system admin user
INSERT INTO tenant_users (tenant_id, email, role, permissions)
VALUES (
    'default'::uuid,
    'admin@example.com',
    'owner',
    '["admin:*", "user:*", "run:*", "artifact:*"]'::jsonb
) ON CONFLICT (tenant_id, email) DO NOTHING;

-- =============================================================================
-- VIEWS FOR COMMON QUERIES
-- =============================================================================

-- Recent test runs view with aggregated data
CREATE OR REPLACE VIEW recent_test_runs AS
SELECT 
    tr.id,
    tr.tenant_id,
    tr.suite_name,
    tr.status,
    tr.started_at,
    tr.finished_at,
    tr.duration,
    tr.environment,
    tr.browser,
    tr.total_tests,
    tr.passed_tests,
    tr.failed_tests,
    tr.skipped_tests,
    tr.pass_rate,
    COUNT(DISTINCT ta.id) as artifact_count,
    COUNT(DISTINCT CASE WHEN ta.artifact_type = 'screenshot' THEN ta.id END) as screenshot_count,
    COUNT(DISTINCT CASE WHEN ta.artifact_type = 'video' THEN ta.id END) as video_count
FROM test_runs tr
LEFT JOIN test_artifacts ta ON tr.id = ta.run_id
WHERE tr.created_at >= NOW() - INTERVAL '30 days'
GROUP BY tr.id
ORDER BY tr.started_at DESC;

-- Test failure analysis view
CREATE OR REPLACE VIEW test_failure_analysis AS
SELECT 
    ts.tenant_id,
    ts.test_name,
    COUNT(*) as failure_count,
    COUNT(DISTINCT ts.run_id) as failed_runs,
    array_agg(DISTINCT ts.error_message) FILTER (WHERE ts.error_message IS NOT NULL) as error_messages,
    AVG(ts.duration) as avg_duration,
    MAX(ts.created_at) as last_failure
FROM test_steps ts
WHERE ts.status = 'failed'
    AND ts.created_at >= NOW() - INTERVAL '7 days'
GROUP BY ts.tenant_id, ts.test_name
ORDER BY failure_count DESC;

-- Grant permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;