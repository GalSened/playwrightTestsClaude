-- CI/CD Tables Migration for QA Intelligence Platform
-- Version: 1.0
-- Description: Comprehensive CI/CD pipeline tracking and orchestration

-- Main CI runs table - tracks deployment pipeline executions
CREATE TABLE IF NOT EXISTS ci_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT CHECK(status IN ('pending', 'running', 'success', 'failed', 'cancelled', 'skipped')) NOT NULL DEFAULT 'pending',
    environment TEXT CHECK(environment IN ('development', 'testing', 'staging', 'production')) NOT NULL,
    branch TEXT NOT NULL,
    commit_hash TEXT,
    commit_message TEXT,

    -- Configuration
    config TEXT, -- JSON configuration for the run
    variables TEXT, -- JSON key-value pairs for environment variables

    -- Execution tracking
    started_at TEXT,
    completed_at TEXT,
    duration INTEGER, -- Duration in seconds

    -- Jenkins integration
    jenkins_job_name TEXT,
    jenkins_build_number INTEGER,
    jenkins_job_url TEXT,
    jenkins_console_url TEXT,

    -- Test integration
    test_suite_path TEXT DEFAULT 'C:/Users/gals/seleniumpythontests-1/playwright_tests/',
    test_filter TEXT, -- Optional test filter pattern
    parallel_workers INTEGER DEFAULT 4,

    -- Results summary
    total_tests INTEGER DEFAULT 0,
    passed_tests INTEGER DEFAULT 0,
    failed_tests INTEGER DEFAULT 0,
    skipped_tests INTEGER DEFAULT 0,
    test_success_rate REAL DEFAULT 0.0,

    -- Quality gates
    quality_gate_passed BOOLEAN DEFAULT FALSE,
    quality_score REAL DEFAULT 0.0,

    -- Deployment tracking
    deploy_server TEXT DEFAULT 'DevTest',
    deploy_path TEXT DEFAULT 'C:\\inetpub\\WeSign',
    deployment_status TEXT CHECK(deployment_status IN ('not_started', 'deploying', 'deployed', 'failed', 'rolled_back')),

    -- Error handling
    error_message TEXT,
    error_details TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,

    -- Audit fields
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    created_by TEXT,
    tenant_id TEXT
);

-- CI stages table - tracks individual pipeline stages
CREATE TABLE IF NOT EXISTS ci_stages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stage_id TEXT UNIQUE NOT NULL,
    ci_run_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    stage_type TEXT CHECK(stage_type IN ('build', 'test', 'quality_gate', 'deploy', 'rollback', 'notification')) NOT NULL,
    status TEXT CHECK(status IN ('pending', 'running', 'success', 'failed', 'cancelled', 'skipped')) NOT NULL DEFAULT 'pending',

    -- Execution order
    sequence_number INTEGER NOT NULL,
    depends_on TEXT, -- Comma-separated list of stage_ids this stage depends on

    -- Configuration
    config TEXT, -- JSON configuration specific to this stage
    command TEXT, -- Command to execute (if applicable)

    -- Execution tracking
    started_at TEXT,
    completed_at TEXT,
    duration INTEGER, -- Duration in seconds

    -- Jenkins stage integration
    jenkins_stage_name TEXT,
    jenkins_stage_url TEXT,

    -- Output and logging
    output_log TEXT,
    error_log TEXT,
    console_output TEXT,

    -- Results
    exit_code INTEGER,
    success_criteria TEXT, -- JSON criteria for success
    artifacts_generated INTEGER DEFAULT 0,

    -- Test stage specific fields
    tests_executed INTEGER DEFAULT 0,
    tests_passed INTEGER DEFAULT 0,
    tests_failed INTEGER DEFAULT 0,

    -- Quality gate specific fields
    quality_checks TEXT, -- JSON array of quality checks
    quality_results TEXT, -- JSON results of quality checks

    -- Deployment specific fields
    deployment_target TEXT,
    deployment_artifacts TEXT, -- JSON list of deployed artifacts

    -- Audit fields
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),

    FOREIGN KEY (ci_run_id) REFERENCES ci_runs(run_id) ON DELETE CASCADE
);

-- CI artifacts table - tracks generated files and reports
CREATE TABLE IF NOT EXISTS ci_artifacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artifact_id TEXT UNIQUE NOT NULL,
    ci_run_id TEXT NOT NULL,
    ci_stage_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    artifact_type TEXT CHECK(artifact_type IN ('report', 'screenshot', 'video', 'log', 'package', 'deployment', 'test_result')) NOT NULL,

    -- File details
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER,
    file_hash TEXT, -- SHA256 hash for integrity
    mime_type TEXT,

    -- Content classification
    category TEXT, -- e.g., 'allure_report', 'playwright_trace', 'jenkins_log'
    tags TEXT, -- JSON array of tags for searching

    -- Test-specific fields
    test_name TEXT,
    test_file TEXT,
    test_status TEXT CHECK(test_status IN ('passed', 'failed', 'skipped')),

    -- Report-specific fields
    report_format TEXT, -- html, json, xml, pdf
    report_summary TEXT, -- JSON summary of report contents

    -- Access and retention
    is_public BOOLEAN DEFAULT FALSE,
    retention_days INTEGER DEFAULT 90,
    expires_at TEXT,
    download_count INTEGER DEFAULT 0,

    -- URL for external access
    download_url TEXT,
    external_url TEXT, -- For artifacts stored externally (S3, etc.)

    -- Audit fields
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),

    FOREIGN KEY (ci_run_id) REFERENCES ci_runs(run_id) ON DELETE CASCADE,
    FOREIGN KEY (ci_stage_id) REFERENCES ci_stages(stage_id) ON DELETE SET NULL
);

-- CI configurations table - reusable pipeline configurations
CREATE TABLE IF NOT EXISTS ci_configurations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,

    -- Configuration content
    pipeline_config TEXT NOT NULL, -- JSON pipeline definition
    default_variables TEXT, -- JSON default variables

    -- Pipeline definition
    stages TEXT NOT NULL, -- JSON array of stage definitions
    quality_gates TEXT, -- JSON quality gate definitions
    notification_config TEXT, -- JSON notification settings

    -- Environment settings
    target_environments TEXT, -- JSON array of supported environments
    deployment_config TEXT, -- JSON deployment configuration

    -- Test settings
    test_suite_config TEXT, -- JSON test execution configuration
    parallel_config TEXT, -- JSON parallel execution settings

    -- Jenkins integration
    jenkins_job_template TEXT, -- Jenkins job configuration template
    jenkins_parameters TEXT, -- JSON Jenkins job parameters

    -- Versioning
    version TEXT NOT NULL DEFAULT '1.0.0',
    is_active BOOLEAN DEFAULT TRUE,

    -- Access control
    tenant_id TEXT,
    created_by TEXT,

    -- Audit fields
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

-- CI environment configurations table - environment-specific settings
CREATE TABLE IF NOT EXISTS ci_environments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    environment_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    environment_type TEXT CHECK(environment_type IN ('development', 'testing', 'staging', 'production')) NOT NULL,

    -- Server configuration
    server_url TEXT,
    server_name TEXT,
    deployment_path TEXT,

    -- Credentials (encrypted)
    credentials TEXT, -- JSON encrypted credentials
    api_keys TEXT, -- JSON encrypted API keys

    -- Configuration
    environment_variables TEXT, -- JSON environment-specific variables
    deployment_config TEXT, -- JSON deployment configuration
    test_config TEXT, -- JSON test configuration for this environment

    -- Health monitoring
    health_check_url TEXT,
    monitoring_enabled BOOLEAN DEFAULT TRUE,
    alert_threshold INTEGER DEFAULT 5, -- Alert after N consecutive failures

    -- Access control
    is_active BOOLEAN DEFAULT TRUE,
    requires_approval BOOLEAN DEFAULT FALSE, -- For production deployments
    approved_users TEXT, -- JSON list of users who can approve deployments

    -- Audit fields
    tenant_id TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

-- CI notifications table - tracks notification events
CREATE TABLE IF NOT EXISTS ci_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    notification_id TEXT UNIQUE NOT NULL,
    ci_run_id TEXT NOT NULL,
    ci_stage_id TEXT,

    -- Notification details
    type TEXT CHECK(type IN ('email', 'slack', 'teams', 'webhook', 'sms')) NOT NULL,
    event_type TEXT CHECK(event_type IN ('run_started', 'run_completed', 'run_failed', 'stage_failed', 'deployment_success', 'deployment_failed', 'quality_gate_failed')) NOT NULL,

    -- Recipients
    recipients TEXT, -- JSON array of recipients
    subject TEXT,
    message TEXT,

    -- Delivery tracking
    status TEXT CHECK(status IN ('pending', 'sent', 'delivered', 'failed', 'bounced')) DEFAULT 'pending',
    sent_at TEXT,
    delivered_at TEXT,

    -- Error handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,

    -- Audit fields
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),

    FOREIGN KEY (ci_run_id) REFERENCES ci_runs(run_id) ON DELETE CASCADE,
    FOREIGN KEY (ci_stage_id) REFERENCES ci_stages(stage_id) ON DELETE CASCADE
);

-- CI rollback tracking table
CREATE TABLE IF NOT EXISTS ci_rollbacks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rollback_id TEXT UNIQUE NOT NULL,
    original_run_id TEXT NOT NULL, -- The run being rolled back
    rollback_run_id TEXT, -- The run performing the rollback

    -- Rollback details
    rollback_type TEXT CHECK(rollback_type IN ('automatic', 'manual', 'scheduled')) NOT NULL,
    trigger_reason TEXT, -- Why the rollback was triggered

    -- Target configuration
    target_environment TEXT NOT NULL,
    rollback_to_version TEXT, -- Version to roll back to
    rollback_to_commit TEXT, -- Commit hash to roll back to

    -- Status tracking
    status TEXT CHECK(status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')) NOT NULL DEFAULT 'pending',
    started_at TEXT,
    completed_at TEXT,
    duration INTEGER,

    -- Results
    rollback_successful BOOLEAN DEFAULT FALSE,
    verification_status TEXT CHECK(verification_status IN ('not_started', 'verifying', 'passed', 'failed')),
    verification_results TEXT, -- JSON verification test results

    -- Error handling
    error_message TEXT,
    error_details TEXT,

    -- Audit fields
    initiated_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),

    FOREIGN KEY (original_run_id) REFERENCES ci_runs(run_id) ON DELETE CASCADE,
    FOREIGN KEY (rollback_run_id) REFERENCES ci_runs(run_id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ci_runs_status ON ci_runs(status);
CREATE INDEX IF NOT EXISTS idx_ci_runs_environment ON ci_runs(environment);
CREATE INDEX IF NOT EXISTS idx_ci_runs_created_at ON ci_runs(created_at);
CREATE INDEX IF NOT EXISTS idx_ci_runs_tenant ON ci_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ci_runs_jenkins_job ON ci_runs(jenkins_job_name, jenkins_build_number);

CREATE INDEX IF NOT EXISTS idx_ci_stages_run_id ON ci_stages(ci_run_id);
CREATE INDEX IF NOT EXISTS idx_ci_stages_status ON ci_stages(status);
CREATE INDEX IF NOT EXISTS idx_ci_stages_type ON ci_stages(stage_type);
CREATE INDEX IF NOT EXISTS idx_ci_stages_sequence ON ci_stages(ci_run_id, sequence_number);

CREATE INDEX IF NOT EXISTS idx_ci_artifacts_run_id ON ci_artifacts(ci_run_id);
CREATE INDEX IF NOT EXISTS idx_ci_artifacts_stage_id ON ci_artifacts(ci_stage_id);
CREATE INDEX IF NOT EXISTS idx_ci_artifacts_type ON ci_artifacts(artifact_type);
CREATE INDEX IF NOT EXISTS idx_ci_artifacts_created_at ON ci_artifacts(created_at);

CREATE INDEX IF NOT EXISTS idx_ci_configurations_active ON ci_configurations(is_active);
CREATE INDEX IF NOT EXISTS idx_ci_configurations_tenant ON ci_configurations(tenant_id);

CREATE INDEX IF NOT EXISTS idx_ci_environments_type ON ci_environments(environment_type);
CREATE INDEX IF NOT EXISTS idx_ci_environments_active ON ci_environments(is_active);

CREATE INDEX IF NOT EXISTS idx_ci_notifications_run_id ON ci_notifications(ci_run_id);
CREATE INDEX IF NOT EXISTS idx_ci_notifications_status ON ci_notifications(status);
CREATE INDEX IF NOT EXISTS idx_ci_notifications_event_type ON ci_notifications(event_type);

CREATE INDEX IF NOT EXISTS idx_ci_rollbacks_original_run ON ci_rollbacks(original_run_id);
CREATE INDEX IF NOT EXISTS idx_ci_rollbacks_status ON ci_rollbacks(status);

-- Create triggers for updated_at timestamps
CREATE TRIGGER IF NOT EXISTS update_ci_runs_timestamp
    AFTER UPDATE ON ci_runs
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE ci_runs SET updated_at = datetime('now', 'utc') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_ci_stages_timestamp
    AFTER UPDATE ON ci_stages
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE ci_stages SET updated_at = datetime('now', 'utc') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_ci_artifacts_timestamp
    AFTER UPDATE ON ci_artifacts
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE ci_artifacts SET updated_at = datetime('now', 'utc') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_ci_configurations_timestamp
    AFTER UPDATE ON ci_configurations
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE ci_configurations SET updated_at = datetime('now', 'utc') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_ci_environments_timestamp
    AFTER UPDATE ON ci_environments
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE ci_environments SET updated_at = datetime('now', 'utc') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_ci_notifications_timestamp
    AFTER UPDATE ON ci_notifications
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE ci_notifications SET updated_at = datetime('now', 'utc') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_ci_rollbacks_timestamp
    AFTER UPDATE ON ci_rollbacks
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE ci_rollbacks SET updated_at = datetime('now', 'utc') WHERE id = NEW.id;
END;

-- Insert default CI configuration
INSERT OR IGNORE INTO ci_configurations (
    config_id,
    name,
    description,
    pipeline_config,
    stages,
    target_environments,
    test_suite_config,
    jenkins_job_template,
    version,
    created_by
) VALUES (
    'default-wesign-pipeline',
    'Default WeSign Deployment Pipeline',
    'Standard CI/CD pipeline for WeSign application deployment with comprehensive testing',
    '{"timeout": 3600, "retry_policy": {"max_retries": 3, "retry_delay": 300}}',
    '[
        {
            "name": "build",
            "type": "build",
            "sequence": 1,
            "config": {"command": "npm run build", "timeout": 600}
        },
        {
            "name": "unit_tests",
            "type": "test",
            "sequence": 2,
            "depends_on": ["build"],
            "config": {"command": "npm test", "timeout": 1200}
        },
        {
            "name": "integration_tests",
            "type": "test",
            "sequence": 3,
            "depends_on": ["unit_tests"],
            "config": {
                "test_path": "C:/Users/gals/seleniumpythontests-1/playwright_tests/",
                "parallel_workers": 4,
                "timeout": 1800
            }
        },
        {
            "name": "quality_gate",
            "type": "quality_gate",
            "sequence": 4,
            "depends_on": ["integration_tests"],
            "config": {
                "min_test_coverage": 80,
                "max_failed_tests": 5,
                "min_success_rate": 95
            }
        },
        {
            "name": "deploy",
            "type": "deploy",
            "sequence": 5,
            "depends_on": ["quality_gate"],
            "config": {
                "deployment_strategy": "blue_green",
                "health_check_timeout": 300
            }
        }
    ]',
    '["development", "testing", "staging", "production"]',
    '{
        "test_suite_path": "C:/Users/gals/seleniumpythontests-1/playwright_tests/",
        "python_path": "C:/Users/gals/AppData/Local/Programs/Python/Python312/python.exe",
        "parallel_workers": 4,
        "test_timeout": 30000,
        "retry_failed_tests": true,
        "max_retries": 2
    }',
    '{
        "job_name": "WeSign-Deployment-Pipeline",
        "parameters": {
            "BRANCH": "${branch}",
            "ENVIRONMENT": "${environment}",
            "TEST_SUITE_PATH": "C:/Users/gals/seleniumpythontests-1/playwright_tests/",
            "DEPLOY_SERVER": "${deploy_server}",
            "DEPLOY_PATH": "${deploy_path}"
        }
    }',
    '1.0.0',
    'system'
);

-- Insert default environments
INSERT OR IGNORE INTO ci_environments (
    environment_id,
    name,
    environment_type,
    server_name,
    deployment_path,
    environment_variables,
    health_check_url,
    created_by
) VALUES
    (
        'devtest-environment',
        'DevTest Environment',
        'testing',
        'DevTest',
        'C:\\inetpub\\WeSign',
        '{"WESIGN_ENV": "testing", "LOG_LEVEL": "debug"}',
        'https://devtest.comda.co.il/health',
        'system'
    ),
    (
        'staging-environment',
        'Staging Environment',
        'staging',
        'Staging',
        'C:\\inetpub\\WeSign',
        '{"WESIGN_ENV": "staging", "LOG_LEVEL": "info"}',
        'https://staging.wesign.com/health',
        'system'
    ),
    (
        'production-environment',
        'Production Environment',
        'production',
        'Production',
        'C:\\inetpub\\WeSign',
        '{"WESIGN_ENV": "production", "LOG_LEVEL": "error"}',
        'https://app.wesign.com/health',
        'system'
    );

-- Schema version tracking
INSERT OR IGNORE INTO schema_versions (version, migration_name, applied_at)
VALUES (100, 'add_ci_tables', datetime('now', 'utc'));