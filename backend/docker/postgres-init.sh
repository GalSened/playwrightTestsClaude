#!/bin/bash
# PostgreSQL initialization script for enterprise features

set -e

echo "🚀 Initializing Playwright Enterprise Database..."

# Wait for PostgreSQL to be ready
until pg_isready -U admin -d playwright_enterprise; do
  echo "⏳ Waiting for PostgreSQL to be ready..."
  sleep 2
done

echo "✅ PostgreSQL is ready"

# Connect as admin user and run setup
psql -U admin -d playwright_enterprise <<-EOSQL
    -- Enable required extensions
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
    CREATE EXTENSION IF NOT EXISTS "pg_trgm";
    
    -- Create application user for connections
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'playwright_app') THEN
            CREATE ROLE playwright_app LOGIN PASSWORD 'app_password_123';
        END IF;
    END
    \$\$;
    
    -- Grant permissions to application user
    GRANT CONNECT ON DATABASE playwright_enterprise TO playwright_app;
    GRANT USAGE ON SCHEMA public TO playwright_app;
    GRANT CREATE ON SCHEMA public TO playwright_app;
    
    -- Grant permissions on all existing tables and sequences
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO playwright_app;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO playwright_app;
    
    -- Grant permissions on future tables and sequences
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO playwright_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO playwright_app;
    
    -- Create default tenant
    INSERT INTO tenants (id, name, subdomain, plan, status)
    VALUES (
        '00000000-0000-0000-0000-000000000001'::uuid,
        'Default Organization',
        'default',
        'enterprise',
        'active'
    ) ON CONFLICT (id) DO NOTHING;
    
    -- Create default admin user
    INSERT INTO tenant_users (tenant_id, email, role, permissions)
    VALUES (
        '00000000-0000-0000-0000-000000000001'::uuid,
        'admin@localhost',
        'owner',
        '["admin:*", "user:*", "run:*", "artifact:*"]'::jsonb
    ) ON CONFLICT (tenant_id, email) DO NOTHING;
    
    -- Create some sample test data for development
    INSERT INTO test_runs (
        tenant_id, suite_id, suite_name, status, started_at, finished_at,
        duration, environment, browser, total_tests, passed_tests, failed_tests, skipped_tests
    ) VALUES (
        '00000000-0000-0000-0000-000000000001'::uuid,
        'sample-suite-001',
        'Sample Login Tests',
        'passed',
        NOW() - INTERVAL '1 hour',
        NOW() - INTERVAL '55 minutes',
        300000,
        'local',
        'chromium',
        10,
        8,
        1,
        1
    ) ON CONFLICT DO NOTHING;
    
    -- Insert sample steps
    WITH sample_run AS (
        SELECT id FROM test_runs 
        WHERE suite_id = 'sample-suite-001' 
        AND tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
        LIMIT 1
    )
    INSERT INTO test_steps (
        tenant_id, run_id, test_id, test_name, step_index,
        action_type, action_name, selector, url, started_at, finished_at,
        duration, status
    ) 
    SELECT 
        '00000000-0000-0000-0000-000000000001'::uuid,
        sample_run.id,
        'test-login-001',
        'User Login Flow',
        generate_series(1, 5),
        'click',
        'Click login button',
        'button[data-testid="login-btn"]',
        'https://example.com/login',
        NOW() - INTERVAL '1 hour' + (generate_series(1, 5) * INTERVAL '30 seconds'),
        NOW() - INTERVAL '1 hour' + (generate_series(1, 5) * INTERVAL '30 seconds') + INTERVAL '2 seconds',
        2000,
        'passed'
    FROM sample_run
    ON CONFLICT DO NOTHING;
    
EOSQL

echo "✅ Enterprise database initialization completed!"
echo "📊 Database: playwright_enterprise"
echo "👤 Admin user: admin@localhost"
echo "🏢 Default tenant: Default Organization"
echo "🔗 Connection: postgresql://admin:secure123@localhost:5432/playwright_enterprise"