-- API Testing Database Schema for Newman Integration
-- This schema extends the existing database to support API testing

-- Collections table for storing Postman collections
CREATE TABLE IF NOT EXISTS api_collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    collection_data TEXT NOT NULL, -- JSON representation of the collection
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT DEFAULT 'system'
);

-- Environments table for storing Postman environments
CREATE TABLE IF NOT EXISTS api_environments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    environment_data TEXT NOT NULL, -- JSON representation of the environment
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT DEFAULT 'system'
);

-- API test runs table for storing Newman execution results
CREATE TABLE IF NOT EXISTS api_test_runs (
    id TEXT PRIMARY KEY,
    collection_id TEXT,
    environment_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    duration INTEGER, -- Duration in milliseconds

    -- Test statistics
    total_requests INTEGER DEFAULT 0,
    passed_requests INTEGER DEFAULT 0,
    failed_requests INTEGER DEFAULT 0,

    -- Assertion statistics
    total_assertions INTEGER DEFAULT 0,
    passed_assertions INTEGER DEFAULT 0,
    failed_assertions INTEGER DEFAULT 0,

    -- Iteration statistics
    total_iterations INTEGER DEFAULT 0,
    completed_iterations INTEGER DEFAULT 0,
    failed_iterations INTEGER DEFAULT 0,

    -- Performance metrics
    response_time_total INTEGER DEFAULT 0,
    response_time_average INTEGER DEFAULT 0,
    response_time_min INTEGER DEFAULT 0,
    response_time_max INTEGER DEFAULT 0,

    -- Transfer metrics
    response_size_total INTEGER DEFAULT 0,
    response_size_average INTEGER DEFAULT 0,

    -- Configuration
    config_data TEXT, -- JSON representation of the test configuration

    -- Results and reports
    results_data TEXT, -- JSON representation of detailed results
    report_json_path TEXT, -- Path to JSON report file
    report_html_path TEXT, -- Path to HTML report file

    -- Execution context
    triggered_by TEXT DEFAULT 'manual',
    branch TEXT,
    commit_id TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (collection_id) REFERENCES api_collections(id) ON DELETE SET NULL,
    FOREIGN KEY (environment_id) REFERENCES api_environments(id) ON DELETE SET NULL
);

-- API test failures table for storing detailed failure information
CREATE TABLE IF NOT EXISTS api_test_failures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    source TEXT NOT NULL,
    failure_name TEXT NOT NULL,
    failure_message TEXT NOT NULL,
    test_name TEXT NOT NULL,
    checkpoint TEXT NOT NULL,
    item_name TEXT NOT NULL,
    item_id TEXT NOT NULL,
    assertion TEXT NOT NULL,
    failure_index INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (run_id) REFERENCES api_test_runs(id) ON DELETE CASCADE
);

-- API test requests table for storing individual request results
CREATE TABLE IF NOT EXISTS api_test_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    item_id TEXT NOT NULL,
    method TEXT NOT NULL,
    url TEXT NOT NULL,
    status_code INTEGER,
    status_text TEXT,
    response_time INTEGER, -- Response time in milliseconds
    response_size INTEGER, -- Response size in bytes
    request_headers TEXT, -- JSON representation of request headers
    response_headers TEXT, -- JSON representation of response headers
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (run_id) REFERENCES api_test_runs(id) ON DELETE CASCADE
);

-- API test schedules table for scheduled API testing
CREATE TABLE IF NOT EXISTS api_test_schedules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    collection_id TEXT NOT NULL,
    environment_id TEXT,
    cron_expression TEXT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    last_run_id TEXT,
    last_run_time DATETIME,
    next_run_time DATETIME,
    config_data TEXT, -- JSON representation of test configuration
    notification_settings TEXT, -- JSON representation of notification settings
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT DEFAULT 'system',

    FOREIGN KEY (collection_id) REFERENCES api_collections(id) ON DELETE CASCADE,
    FOREIGN KEY (environment_id) REFERENCES api_environments(id) ON DELETE SET NULL,
    FOREIGN KEY (last_run_id) REFERENCES api_test_runs(id) ON DELETE SET NULL
);

-- API testing analytics table for storing aggregated metrics
CREATE TABLE IF NOT EXISTS api_testing_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL, -- Date in YYYY-MM-DD format
    collection_id TEXT,
    environment_id TEXT,

    -- Daily aggregated metrics
    total_runs INTEGER DEFAULT 0,
    successful_runs INTEGER DEFAULT 0,
    failed_runs INTEGER DEFAULT 0,
    cancelled_runs INTEGER DEFAULT 0,

    total_requests INTEGER DEFAULT 0,
    successful_requests INTEGER DEFAULT 0,
    failed_requests INTEGER DEFAULT 0,

    total_assertions INTEGER DEFAULT 0,
    successful_assertions INTEGER DEFAULT 0,
    failed_assertions INTEGER DEFAULT 0,

    -- Performance metrics
    avg_response_time REAL DEFAULT 0,
    min_response_time INTEGER DEFAULT 0,
    max_response_time INTEGER DEFAULT 0,
    p95_response_time INTEGER DEFAULT 0,
    p99_response_time INTEGER DEFAULT 0,

    -- Transfer metrics
    total_data_transferred INTEGER DEFAULT 0,
    avg_response_size REAL DEFAULT 0,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (collection_id) REFERENCES api_collections(id) ON DELETE SET NULL,
    FOREIGN KEY (environment_id) REFERENCES api_environments(id) ON DELETE SET NULL,

    UNIQUE(date, collection_id, environment_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_api_test_runs_status ON api_test_runs(status);
CREATE INDEX IF NOT EXISTS idx_api_test_runs_start_time ON api_test_runs(start_time);
CREATE INDEX IF NOT EXISTS idx_api_test_runs_collection_id ON api_test_runs(collection_id);
CREATE INDEX IF NOT EXISTS idx_api_test_runs_environment_id ON api_test_runs(environment_id);

CREATE INDEX IF NOT EXISTS idx_api_test_failures_run_id ON api_test_failures(run_id);
CREATE INDEX IF NOT EXISTS idx_api_test_requests_run_id ON api_test_requests(run_id);

CREATE INDEX IF NOT EXISTS idx_api_test_schedules_enabled ON api_test_schedules(enabled);
CREATE INDEX IF NOT EXISTS idx_api_test_schedules_next_run_time ON api_test_schedules(next_run_time);

CREATE INDEX IF NOT EXISTS idx_api_testing_analytics_date ON api_testing_analytics(date);
CREATE INDEX IF NOT EXISTS idx_api_testing_analytics_collection ON api_testing_analytics(collection_id);

-- Create triggers to update the updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_api_collections_updated_at
AFTER UPDATE ON api_collections
BEGIN
    UPDATE api_collections SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_api_environments_updated_at
AFTER UPDATE ON api_environments
BEGIN
    UPDATE api_environments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_api_test_schedules_updated_at
AFTER UPDATE ON api_test_schedules
BEGIN
    UPDATE api_test_schedules SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_api_testing_analytics_updated_at
AFTER UPDATE ON api_testing_analytics
BEGIN
    UPDATE api_testing_analytics SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;