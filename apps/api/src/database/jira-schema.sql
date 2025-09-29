-- Jira Integration Database Schema
-- Comprehensive schema for Jira sub-agent integration with QA Intelligence

-- Jira configuration and connection state
CREATE TABLE IF NOT EXISTS jira_config (
    id TEXT PRIMARY KEY DEFAULT 'default',
    base_url TEXT NOT NULL,
    auth_type TEXT CHECK (auth_type IN ('oauth2', 'api_token')) NOT NULL,
    
    -- OAuth2 configuration
    client_id TEXT,
    client_secret TEXT, -- Encrypted
    access_token TEXT, -- Encrypted  
    refresh_token TEXT, -- Encrypted
    token_expires_at TEXT,
    
    -- API Token configuration  
    api_token TEXT, -- Encrypted
    user_email TEXT,
    
    -- Connection settings
    default_project TEXT NOT NULL,
    rate_limit_per_hour INTEGER DEFAULT 1000,
    max_retry_attempts INTEGER DEFAULT 3,
    timeout_ms INTEGER DEFAULT 30000,
    
    -- Status tracking
    status TEXT CHECK (status IN ('active', 'error', 'disabled')) DEFAULT 'active',
    last_sync_at TEXT,
    last_error TEXT,
    
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

-- Jira project and metadata cache
CREATE TABLE IF NOT EXISTS jira_projects (
    id TEXT PRIMARY KEY, -- Jira project ID
    key TEXT UNIQUE NOT NULL, -- Jira project key
    name TEXT NOT NULL,
    description TEXT,
    project_type TEXT,
    lead_account_id TEXT,
    
    -- Issue type mapping
    issue_types TEXT DEFAULT '[]', -- JSON array of available issue types
    custom_fields TEXT DEFAULT '{}', -- JSON object of custom field mappings
    
    -- Configuration
    auto_create_issues BOOLEAN DEFAULT 1,
    default_issue_type TEXT DEFAULT 'Bug',
    default_priority TEXT DEFAULT 'Medium',
    
    -- WeSign specific configuration
    wesign_modules TEXT DEFAULT '[]', -- JSON array of enabled WeSign modules
    bilingual_support BOOLEAN DEFAULT 1,
    
    -- Sync tracking
    last_synced_at TEXT,
    sync_status TEXT CHECK (sync_status IN ('synced', 'error', 'pending')) DEFAULT 'pending',
    sync_error TEXT,
    
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

-- Issue mapping between test failures and Jira issues
CREATE TABLE IF NOT EXISTS jira_issue_mappings (
    id TEXT PRIMARY KEY,
    
    -- Test failure reference
    test_run_id TEXT, -- References trace_viewer_runs.id if exists
    test_name TEXT NOT NULL,
    failure_hash TEXT NOT NULL, -- Unique hash for deduplication
    
    -- Jira issue reference
    jira_issue_id TEXT NOT NULL,
    jira_issue_key TEXT NOT NULL,
    jira_project_key TEXT NOT NULL,
    
    -- Issue details cache
    issue_summary TEXT,
    issue_status TEXT,
    issue_priority TEXT,
    issue_type TEXT,
    assignee_account_id TEXT,
    
    -- Failure context (for quick reference)
    failure_category TEXT,
    wesign_module TEXT,
    error_message TEXT,
    browser_type TEXT,
    test_environment TEXT,
    language TEXT,
    
    -- Technical details
    selector TEXT,
    url TEXT,
    stack_trace TEXT,
    
    -- Attachments
    screenshots TEXT DEFAULT '[]', -- JSON array of screenshot URLs
    trace_file TEXT,
    video_file TEXT,
    
    -- Linking
    parent_issue_key TEXT, -- Parent epic or story
    linked_issues TEXT DEFAULT '[]', -- JSON array of linked issue keys
    
    -- Sync tracking
    created_in_jira_at TEXT,
    last_synced_at TEXT,
    sync_status TEXT CHECK (sync_status IN ('synced', 'pending', 'error')) DEFAULT 'pending',
    sync_error TEXT,
    
    -- Status tracking
    resolution_status TEXT CHECK (resolution_status IN ('open', 'in_progress', 'resolved', 'closed')) DEFAULT 'open',
    resolved_at TEXT,
    
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    
    FOREIGN KEY (jira_project_key) REFERENCES jira_projects(key),
    
    -- Ensure unique mapping per test failure
    UNIQUE(test_run_id, test_name, failure_hash)
);

-- Jira sync operations queue and history
CREATE TABLE IF NOT EXISTS jira_sync_operations (
    id TEXT PRIMARY KEY,
    operation_type TEXT CHECK (operation_type IN (
        'create_issue', 'update_issue', 'add_comment', 'link_issues', 'bulk_create'
    )) NOT NULL,
    
    -- Operation data
    payload TEXT NOT NULL, -- JSON payload for the operation
    jira_issue_key TEXT, -- Target issue key (if applicable)
    mapping_id TEXT, -- Reference to jira_issue_mappings
    
    -- Execution tracking
    status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')) DEFAULT 'pending',
    priority INTEGER DEFAULT 5, -- 1=highest, 10=lowest
    
    -- Timing
    scheduled_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    started_at TEXT,
    completed_at TEXT,
    
    -- Error handling
    attempt_count INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_error TEXT,
    error_details TEXT,
    
    -- Rate limiting
    rate_limit_reset_at TEXT,
    
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    
    FOREIGN KEY (mapping_id) REFERENCES jira_issue_mappings(id)
);

-- Jira webhook events log
CREATE TABLE IF NOT EXISTS jira_webhook_events (
    id TEXT PRIMARY KEY,
    webhook_event TEXT NOT NULL,
    
    -- Event data
    jira_issue_id TEXT,
    jira_issue_key TEXT,
    event_timestamp INTEGER NOT NULL,
    user_account_id TEXT,
    
    -- Event payload
    raw_payload TEXT NOT NULL, -- Complete JSON payload
    changelog TEXT, -- JSON changelog if present
    
    -- Processing
    processed BOOLEAN DEFAULT 0,
    processed_at TEXT,
    processing_error TEXT,
    
    received_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

-- Jira issue templates for different failure types
CREATE TABLE IF NOT EXISTS jira_issue_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    
    -- Template context
    failure_category TEXT, -- selector, timeout, api, auth, data, performance
    wesign_module TEXT, -- signing, payment, auth, notification, admin
    language TEXT, -- hebrew, english, bilingual
    
    -- Template configuration
    issue_type TEXT DEFAULT 'Bug',
    priority TEXT DEFAULT 'Medium',
    
    -- Template content
    summary_template TEXT NOT NULL, -- Template with placeholders
    description_template TEXT NOT NULL, -- Template with placeholders
    labels TEXT DEFAULT '[]', -- JSON array of default labels
    
    -- Custom field mappings
    custom_fields TEXT DEFAULT '{}', -- JSON object of custom field templates
    
    -- Usage tracking
    usage_count INTEGER DEFAULT 0,
    last_used_at TEXT,
    
    active BOOLEAN DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

-- Performance indices for optimal query performance
CREATE INDEX IF NOT EXISTS idx_jira_mappings_test_run ON jira_issue_mappings(test_run_id);
CREATE INDEX IF NOT EXISTS idx_jira_mappings_issue_key ON jira_issue_mappings(jira_issue_key);
CREATE INDEX IF NOT EXISTS idx_jira_mappings_failure_hash ON jira_issue_mappings(failure_hash);
CREATE INDEX IF NOT EXISTS idx_jira_mappings_sync_status ON jira_issue_mappings(sync_status);
CREATE INDEX IF NOT EXISTS idx_jira_mappings_project ON jira_issue_mappings(jira_project_key);
CREATE INDEX IF NOT EXISTS idx_jira_mappings_resolution ON jira_issue_mappings(resolution_status);
CREATE INDEX IF NOT EXISTS idx_jira_mappings_created ON jira_issue_mappings(created_at);

CREATE INDEX IF NOT EXISTS idx_jira_operations_status ON jira_sync_operations(status, priority);
CREATE INDEX IF NOT EXISTS idx_jira_operations_scheduled ON jira_sync_operations(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_jira_operations_issue_key ON jira_sync_operations(jira_issue_key);
CREATE INDEX IF NOT EXISTS idx_jira_operations_type ON jira_sync_operations(operation_type);

CREATE INDEX IF NOT EXISTS idx_jira_webhooks_issue_key ON jira_webhook_events(jira_issue_key);
CREATE INDEX IF NOT EXISTS idx_jira_webhooks_processed ON jira_webhook_events(processed, received_at);
CREATE INDEX IF NOT EXISTS idx_jira_webhooks_timestamp ON jira_webhook_events(event_timestamp);

CREATE INDEX IF NOT EXISTS idx_jira_templates_category ON jira_issue_templates(failure_category, wesign_module);
CREATE INDEX IF NOT EXISTS idx_jira_templates_active ON jira_issue_templates(active, usage_count);

-- Triggers for updated_at timestamps
CREATE TRIGGER IF NOT EXISTS jira_config_updated_at 
    AFTER UPDATE ON jira_config
    FOR EACH ROW
BEGIN
    UPDATE jira_config SET updated_at = datetime('now', 'utc') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS jira_projects_updated_at 
    AFTER UPDATE ON jira_projects
    FOR EACH ROW
BEGIN
    UPDATE jira_projects SET updated_at = datetime('now', 'utc') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS jira_issue_mappings_updated_at 
    AFTER UPDATE ON jira_issue_mappings
    FOR EACH ROW
BEGIN
    UPDATE jira_issue_mappings SET updated_at = datetime('now', 'utc') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS jira_sync_operations_updated_at 
    AFTER UPDATE ON jira_sync_operations
    FOR EACH ROW
BEGIN
    UPDATE jira_sync_operations SET updated_at = datetime('now', 'utc') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS jira_issue_templates_updated_at 
    AFTER UPDATE ON jira_issue_templates
    FOR EACH ROW
BEGIN
    UPDATE jira_issue_templates SET updated_at = datetime('now', 'utc') WHERE id = NEW.id;
END;

-- Views for monitoring and reporting
CREATE VIEW IF NOT EXISTS jira_sync_health AS
SELECT 
    COUNT(*) as total_operations,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_operations,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_operations,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_operations,
    AVG(CASE WHEN completed_at IS NOT NULL AND started_at IS NOT NULL THEN
        (julianday(completed_at) - julianday(started_at)) * 86400 * 1000 
    END) as avg_processing_time_ms,
    MAX(updated_at) as last_activity
FROM jira_sync_operations
WHERE created_at > datetime('now', '-24 hours', 'utc');

CREATE VIEW IF NOT EXISTS jira_issue_summary AS
SELECT 
    jm.jira_project_key,
    jp.name as project_name,
    COUNT(*) as total_mapped_issues,
    COUNT(CASE WHEN jm.resolution_status = 'open' THEN 1 END) as open_issues,
    COUNT(CASE WHEN jm.resolution_status = 'resolved' THEN 1 END) as resolved_issues,
    COUNT(CASE WHEN jm.sync_status = 'error' THEN 1 END) as sync_errors,
    AVG(CASE WHEN jm.resolved_at IS NOT NULL AND jm.created_at IS NOT NULL THEN
        (julianday(jm.resolved_at) - julianday(jm.created_at)) 
    END) as avg_resolution_time_days,
    COUNT(CASE WHEN jm.created_at > datetime('now', '-7 days', 'utc') THEN 1 END) as issues_this_week
FROM jira_issue_mappings jm
JOIN jira_projects jp ON jm.jira_project_key = jp.key
GROUP BY jm.jira_project_key, jp.name;

CREATE VIEW IF NOT EXISTS jira_failure_analysis AS
SELECT 
    failure_category,
    wesign_module,
    language,
    COUNT(*) as failure_count,
    COUNT(CASE WHEN resolution_status = 'resolved' THEN 1 END) as resolved_count,
    ROUND(
        CAST(COUNT(CASE WHEN resolution_status = 'resolved' THEN 1 END) AS REAL) / 
        COUNT(*) * 100, 2
    ) as resolution_rate_percent,
    AVG(CASE WHEN resolved_at IS NOT NULL AND created_at IS NOT NULL THEN
        (julianday(resolved_at) - julianday(created_at))
    END) as avg_resolution_time_days
FROM jira_issue_mappings
WHERE created_at > datetime('now', '-30 days', 'utc')
GROUP BY failure_category, wesign_module, language
ORDER BY failure_count DESC;

-- Insert default configuration
INSERT OR IGNORE INTO jira_config (id, base_url, auth_type, default_project) 
VALUES ('default', 'https://your-domain.atlassian.net', 'api_token', 'QA');

-- Insert default WeSign-specific issue templates
INSERT OR IGNORE INTO jira_issue_templates (
    id, name, failure_category, wesign_module, language,
    summary_template, description_template, labels, custom_fields
) VALUES 
(
    'wesign-ui-failure-he',
    'WeSign UI Test Failure (Hebrew)',
    'selector',
    'signing',
    'hebrew',
    'UI Test Failure: {{testName}} - {{wesignModule}}',
    'h2. Test Failure Summary\n*Test:* {{testName}}\n*Module:* {{wesignModule}}\n*Environment:* {{environment}}\n*Browser:* {{browserType}}\n*Language:* עברית\n\nh2. Error Details\n*Error Message:* {{errorMessage}}\n*Selector:* {{selector}}\n*URL:* {{url}}\n\nh2. Screenshots\n{{#screenshots}}\n!{{.}}!\n{{/screenshots}}\n\nh2. Technical Details\n*Stack Trace:*\n{code}\n{{stackTrace}}\n{code}\n\n*Test Run ID:* {{testRunId}}\n*Failure Hash:* {{failureHash}}',
    '["wesign", "ui-test", "hebrew", "automated"]',
    '{"customfield_10001": "{{environment}}", "customfield_10002": "{{wesignModule}}"}'
),
(
    'wesign-api-failure-en',
    'WeSign API Test Failure (English)', 
    'api',
    'payment',
    'english',
    'API Test Failure: {{testName}} - {{wesignModule}}',
    'h2. Test Failure Summary\n*Test:* {{testName}}\n*Module:* {{wesignModule}}\n*Environment:* {{environment}}\n*Browser:* {{browserType}}\n*Language:* English\n\nh2. API Error Details\n*Error Message:* {{errorMessage}}\n*URL:* {{url}}\n*HTTP Status:* {{httpStatus}}\n\nh2. Request/Response\n*Request:*\n{code:json}\n{{request}}\n{code}\n\n*Response:*\n{code:json}\n{{response}}\n{code}\n\nh2. Technical Details\n*Test Run ID:* {{testRunId}}\n*Failure Hash:* {{failureHash}}',
    '["wesign", "api-test", "english", "automated"]',
    '{"customfield_10001": "{{environment}}", "customfield_10002": "{{wesignModule}}"}'
),
(
    'wesign-performance-issue',
    'WeSign Performance Issue',
    'performance',
    'signing',
    'bilingual',
    'Performance Issue: {{testName}} - Response Time {{responseTime}}ms',
    'h2. Performance Issue Summary\n*Test:* {{testName}}\n*Module:* {{wesignModule}}\n*Environment:* {{environment}}\n*Threshold Exceeded:* {{threshold}}ms\n*Actual Response Time:* {{responseTime}}ms\n\nh2. Performance Metrics\n*CPU Usage:* {{cpuUsage}}%\n*Memory Usage:* {{memoryUsage}}MB\n*Network Latency:* {{networkLatency}}ms\n\nh2. Impact Analysis\n*User Experience Impact:* {{impactLevel}}\n*Business Process:* {{businessProcess}}\n\nh2. Technical Details\n*Test Run ID:* {{testRunId}}\n*Performance Baseline:* {{baseline}}ms',
    '["wesign", "performance", "bilingual", "automated"]',
    '{"customfield_10003": "{{responseTime}}", "customfield_10004": "{{threshold}}"}'
);

-- Insert default project configuration
INSERT OR IGNORE INTO jira_projects (
    id, key, name, description, 
    issue_types, auto_create_issues, default_issue_type, 
    wesign_modules, bilingual_support
) VALUES (
    'QA001',
    'QA', 
    'QA Automation',
    'Quality Assurance and Test Automation for WeSign Platform',
    '["Bug", "Task", "Story", "Epic"]',
    1,
    'Bug',
    '["signing", "payment", "auth", "notification", "admin"]',
    1
);