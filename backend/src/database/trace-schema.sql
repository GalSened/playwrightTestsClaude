-- Trace Viewer Database Schema
-- Extends the existing scheduler database with trace artifacts and detailed run information

-- Test runs table (extends existing RunRecord)
CREATE TABLE IF NOT EXISTS test_runs (
    id TEXT PRIMARY KEY,
    suite_id TEXT NOT NULL,
    suite_name TEXT NOT NULL,
    started_at TEXT NOT NULL, -- ISO 8601 UTC
    finished_at TEXT, -- ISO 8601 UTC
    status TEXT CHECK (status IN ('queued', 'running', 'passed', 'failed', 'cancelled')) NOT NULL DEFAULT 'queued',
    environment TEXT NOT NULL DEFAULT 'local',
    browser TEXT, -- chromium, firefox, webkit
    test_mode TEXT CHECK (test_mode IN ('headed', 'headless')) DEFAULT 'headless',
    total_tests INTEGER NOT NULL DEFAULT 0,
    passed_tests INTEGER NOT NULL DEFAULT 0,
    failed_tests INTEGER NOT NULL DEFAULT 0,
    skipped_tests INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER, -- Total run duration in milliseconds
    branch TEXT,
    commit_sha TEXT,
    triggered_by TEXT, -- user, scheduler, api
    artifacts_path TEXT, -- Base path to artifacts directory
    trace_file TEXT, -- Path to trace.zip file
    video_file TEXT, -- Path to video file
    html_report TEXT, -- Path to HTML report
    metadata_json TEXT, -- JSON metadata about the run
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

-- Test steps table (detailed step-by-step execution)
CREATE TABLE IF NOT EXISTS test_steps (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
    test_id TEXT, -- Individual test identifier within suite
    test_name TEXT NOT NULL,
    step_index INTEGER NOT NULL, -- Order within the test
    action_type TEXT, -- click, fill, navigate, expect, etc.
    action_name TEXT NOT NULL, -- Human readable action
    selector TEXT, -- Element selector used
    url TEXT, -- URL at the time of action
    expected_value TEXT, -- Expected result for assertions
    actual_value TEXT, -- Actual result
    started_at TEXT NOT NULL, -- ISO 8601 UTC
    finished_at TEXT, -- ISO 8601 UTC
    duration_ms INTEGER, -- Step duration in milliseconds
    status TEXT CHECK (status IN ('running', 'passed', 'failed', 'skipped', 'timeout')) NOT NULL DEFAULT 'running',
    error_message TEXT,
    stack_trace TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    screenshot_before TEXT, -- Path to screenshot before action
    screenshot_after TEXT, -- Path to screenshot after action
    video_timestamp REAL, -- Timestamp in video file for this step
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

-- Test artifacts table (screenshots, videos, traces, logs)
CREATE TABLE IF NOT EXISTS test_artifacts (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
    step_id TEXT REFERENCES test_steps(id) ON DELETE CASCADE, -- NULL for run-level artifacts
    artifact_type TEXT CHECK (artifact_type IN ('screenshot', 'video', 'trace', 'log', 'report', 'network', 'console')) NOT NULL,
    name TEXT NOT NULL, -- Human readable name
    file_path TEXT NOT NULL, -- Relative path from artifacts base
    file_url TEXT, -- Served URL for the artifact
    mime_type TEXT NOT NULL, -- image/png, video/webm, application/zip, etc.
    file_size INTEGER, -- Size in bytes
    thumbnail_path TEXT, -- Path to thumbnail (for images/videos)
    thumbnail_url TEXT, -- Served URL for thumbnail
    width INTEGER, -- For images/videos
    height INTEGER, -- For images/videos
    duration_ms INTEGER, -- For videos
    metadata_json TEXT, -- Additional metadata as JSON
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

-- Console logs table (browser console output)
CREATE TABLE IF NOT EXISTS console_logs (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
    step_id TEXT REFERENCES test_steps(id) ON DELETE CASCADE,
    timestamp TEXT NOT NULL, -- ISO 8601 UTC
    log_level TEXT CHECK (log_level IN ('log', 'info', 'warn', 'error', 'debug')) NOT NULL,
    source TEXT, -- console, network, page, etc.
    message TEXT NOT NULL,
    stack_trace TEXT,
    url TEXT, -- Source URL
    line_number INTEGER,
    column_number INTEGER,
    args_json TEXT, -- JSON array of console arguments
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

-- Network logs table (HTTP requests/responses)
CREATE TABLE IF NOT EXISTS network_logs (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
    step_id TEXT REFERENCES test_steps(id) ON DELETE CASCADE,
    timestamp TEXT NOT NULL, -- ISO 8601 UTC
    method TEXT NOT NULL, -- GET, POST, etc.
    url TEXT NOT NULL,
    status_code INTEGER,
    status_text TEXT,
    request_headers_json TEXT,
    response_headers_json TEXT,
    request_body TEXT,
    response_body TEXT,
    request_size INTEGER, -- Bytes
    response_size INTEGER, -- Bytes
    duration_ms INTEGER, -- Request duration
    failed BOOLEAN DEFAULT FALSE,
    failure_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

-- Test environments table
CREATE TABLE IF NOT EXISTS test_environments (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL, -- local, staging, production
    base_url TEXT NOT NULL,
    description TEXT,
    browser_configs_json TEXT, -- JSON array of supported browsers
    viewport_configs_json TEXT, -- JSON array of viewport sizes
    timezone TEXT DEFAULT 'UTC',
    active BOOLEAN DEFAULT TRUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

-- Performance metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
    step_id TEXT REFERENCES test_steps(id) ON DELETE CASCADE,
    timestamp TEXT NOT NULL, -- ISO 8601 UTC
    metric_name TEXT NOT NULL, -- LCP, FCP, CLS, FID, etc.
    metric_value REAL NOT NULL,
    metric_unit TEXT NOT NULL, -- ms, score, ratio, etc.
    url TEXT, -- Page URL when metric was captured
    viewport_width INTEGER,
    viewport_height INTEGER,
    device_type TEXT, -- desktop, mobile, tablet
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

-- Indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_test_runs_status ON test_runs(status);
CREATE INDEX IF NOT EXISTS idx_test_runs_started_at ON test_runs(started_at);
CREATE INDEX IF NOT EXISTS idx_test_runs_suite_id ON test_runs(suite_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_environment ON test_runs(environment);
CREATE INDEX IF NOT EXISTS idx_test_runs_branch ON test_runs(branch);

CREATE INDEX IF NOT EXISTS idx_test_steps_run_id ON test_steps(run_id);
CREATE INDEX IF NOT EXISTS idx_test_steps_status ON test_steps(status);
CREATE INDEX IF NOT EXISTS idx_test_steps_started_at ON test_steps(started_at);
CREATE INDEX IF NOT EXISTS idx_test_steps_step_index ON test_steps(run_id, step_index);

CREATE INDEX IF NOT EXISTS idx_test_artifacts_run_id ON test_artifacts(run_id);
CREATE INDEX IF NOT EXISTS idx_test_artifacts_step_id ON test_artifacts(step_id);
CREATE INDEX IF NOT EXISTS idx_test_artifacts_type ON test_artifacts(artifact_type);

CREATE INDEX IF NOT EXISTS idx_console_logs_run_id ON console_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_console_logs_step_id ON console_logs(step_id);
CREATE INDEX IF NOT EXISTS idx_console_logs_level ON console_logs(log_level);
CREATE INDEX IF NOT EXISTS idx_console_logs_timestamp ON console_logs(timestamp);

CREATE INDEX IF NOT EXISTS idx_network_logs_run_id ON network_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_network_logs_step_id ON network_logs(step_id);
CREATE INDEX IF NOT EXISTS idx_network_logs_status ON network_logs(status_code);
CREATE INDEX IF NOT EXISTS idx_network_logs_timestamp ON network_logs(timestamp);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_run_id ON performance_metrics(run_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_step_id ON performance_metrics(step_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_name ON performance_metrics(metric_name);

-- Views for common queries
CREATE VIEW IF NOT EXISTS run_summary AS
SELECT 
    tr.id,
    tr.suite_name,
    tr.status,
    tr.started_at,
    tr.finished_at,
    tr.duration_ms,
    tr.environment,
    tr.browser,
    tr.total_tests,
    tr.passed_tests,
    tr.failed_tests,
    tr.skipped_tests,
    ROUND(CAST(tr.passed_tests AS REAL) / NULLIF(tr.total_tests, 0) * 100, 2) as pass_rate,
    COUNT(DISTINCT ts.id) as total_steps,
    COUNT(DISTINCT CASE WHEN ts.status = 'failed' THEN ts.id END) as failed_steps,
    COUNT(DISTINCT ta.id) as total_artifacts
FROM test_runs tr
LEFT JOIN test_steps ts ON tr.id = ts.run_id
LEFT JOIN test_artifacts ta ON tr.id = ta.run_id
GROUP BY tr.id;

CREATE VIEW IF NOT EXISTS failing_tests AS
SELECT 
    tr.id as run_id,
    tr.suite_name,
    ts.test_name,
    ts.error_message,
    ts.started_at,
    ts.duration_ms,
    ta.file_url as screenshot_url
FROM test_runs tr
INNER JOIN test_steps ts ON tr.id = ts.run_id
LEFT JOIN test_artifacts ta ON ts.id = ta.step_id AND ta.artifact_type = 'screenshot'
WHERE ts.status = 'failed'
ORDER BY ts.started_at DESC;

-- Triggers for updated_at timestamps
CREATE TRIGGER IF NOT EXISTS update_test_runs_timestamp 
AFTER UPDATE ON test_runs
FOR EACH ROW
BEGIN
    UPDATE test_runs SET updated_at = datetime('now', 'utc') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_test_environments_timestamp 
AFTER UPDATE ON test_environments
FOR EACH ROW
BEGIN
    UPDATE test_environments SET updated_at = datetime('now', 'utc') WHERE id = NEW.id;
END;

-- Insert default environments
INSERT OR IGNORE INTO test_environments (id, name, base_url, description) VALUES
('env-local', 'local', 'http://localhost:3000', 'Local development environment'),
('env-staging', 'staging', 'https://staging.example.com', 'Staging environment'),
('env-prod', 'production', 'https://app.example.com', 'Production environment');