-- Test Discovery Database Schema
-- Stores discovered test files, test functions, and their metadata for smart test management

-- Tests table - stores discovered test files and functions
CREATE TABLE IF NOT EXISTS tests (
    id TEXT PRIMARY KEY, -- UUID
    file_path TEXT NOT NULL, -- Relative path from project root
    test_name TEXT NOT NULL, -- Full test name (class::method or function name)
    class_name TEXT, -- Test class name (if any)
    function_name TEXT NOT NULL, -- Test function name
    description TEXT, -- Docstring or description
    category TEXT NOT NULL, -- Auto-discovered category (auth, documents, etc.)
    file_size INTEGER, -- File size in bytes
    line_number INTEGER, -- Line number where test is defined
    last_run DATETIME, -- Last time this test was executed
    last_status TEXT, -- Last execution status (passed/failed/skipped)
    last_duration INTEGER, -- Last execution duration in ms
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE, -- False if file was deleted
    
    UNIQUE(file_path, test_name)
);

-- Test tags/markers table - stores pytest markers and custom tags
CREATE TABLE IF NOT EXISTS test_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id TEXT NOT NULL,
    tag_name TEXT NOT NULL, -- marker name (smoke, regression, etc.)
    tag_type TEXT NOT NULL DEFAULT 'marker', -- marker, category, custom
    tag_value TEXT, -- Optional tag value
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
    UNIQUE(test_id, tag_name)
);

-- Test suites table - stores saved test suites (collections of tests)
CREATE TABLE IF NOT EXISTS test_suites (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_by TEXT, -- User ID who created the suite
    filters TEXT, -- JSON object with filters used to create suite
    test_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Test suite items table - maps tests to suites
CREATE TABLE IF NOT EXISTS test_suite_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    suite_id TEXT NOT NULL,
    test_id TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (suite_id) REFERENCES test_suites(id) ON DELETE CASCADE,
    FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
    UNIQUE(suite_id, test_id)
);

-- Test execution history table - tracks individual test executions
CREATE TABLE IF NOT EXISTS test_executions (
    id TEXT PRIMARY KEY,
    test_id TEXT NOT NULL,
    suite_id TEXT, -- If part of a suite execution
    execution_id TEXT, -- Backend execution ID
    status TEXT NOT NULL, -- passed, failed, skipped, timeout
    duration_ms INTEGER,
    error_message TEXT,
    browser TEXT,
    environment TEXT,
    started_at DATETIME NOT NULL,
    finished_at DATETIME,
    artifacts_path TEXT, -- Path to artifacts for this test
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
    FOREIGN KEY (suite_id) REFERENCES test_suites(id) ON DELETE SET NULL
);

-- File watch tracking table - tracks when files were last scanned
CREATE TABLE IF NOT EXISTS file_scan_tracking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL UNIQUE,
    last_modified DATETIME NOT NULL,
    last_scanned DATETIME DEFAULT CURRENT_TIMESTAMP,
    file_hash TEXT, -- MD5 hash of file content
    test_count INTEGER DEFAULT 0, -- Number of tests found in file
    scan_status TEXT DEFAULT 'success', -- success, error, skipped
    error_message TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tests_category ON tests(category);
CREATE INDEX IF NOT EXISTS idx_tests_last_status ON tests(last_status);
CREATE INDEX IF NOT EXISTS idx_tests_file_path ON tests(file_path);
CREATE INDEX IF NOT EXISTS idx_tests_active ON tests(is_active);
CREATE INDEX IF NOT EXISTS idx_tests_updated_at ON tests(updated_at);

CREATE INDEX IF NOT EXISTS idx_test_tags_test_id ON test_tags(test_id);
CREATE INDEX IF NOT EXISTS idx_test_tags_name ON test_tags(tag_name);
CREATE INDEX IF NOT EXISTS idx_test_tags_type ON test_tags(tag_type);

CREATE INDEX IF NOT EXISTS idx_test_suites_created_by ON test_suites(created_by);
CREATE INDEX IF NOT EXISTS idx_test_suites_updated_at ON test_suites(updated_at);

CREATE INDEX IF NOT EXISTS idx_test_suite_items_suite_id ON test_suite_items(suite_id);
CREATE INDEX IF NOT EXISTS idx_test_suite_items_test_id ON test_suite_items(test_id);
CREATE INDEX IF NOT EXISTS idx_test_suite_items_order ON test_suite_items(suite_id, order_index);

CREATE INDEX IF NOT EXISTS idx_test_executions_test_id ON test_executions(test_id);
CREATE INDEX IF NOT EXISTS idx_test_executions_suite_id ON test_executions(suite_id);
CREATE INDEX IF NOT EXISTS idx_test_executions_status ON test_executions(status);
CREATE INDEX IF NOT EXISTS idx_test_executions_started_at ON test_executions(started_at);

CREATE INDEX IF NOT EXISTS idx_file_scan_tracking_path ON file_scan_tracking(file_path);
CREATE INDEX IF NOT EXISTS idx_file_scan_tracking_modified ON file_scan_tracking(last_modified);

-- Trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS tests_updated_at 
    AFTER UPDATE ON tests
    FOR EACH ROW
BEGIN
    UPDATE tests 
    SET updated_at = datetime('now') 
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS test_suites_updated_at 
    AFTER UPDATE ON test_suites
    FOR EACH ROW
BEGIN
    UPDATE test_suites 
    SET updated_at = datetime('now') 
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS file_scan_tracking_updated_at 
    AFTER UPDATE ON file_scan_tracking
    FOR EACH ROW
BEGIN
    UPDATE file_scan_tracking 
    SET updated_at = datetime('now') 
    WHERE id = NEW.id;
END;

-- Create views for common queries
CREATE VIEW IF NOT EXISTS tests_with_tags AS
SELECT 
    t.*,
    GROUP_CONCAT(tt.tag_name) as tags,
    COUNT(tt.tag_name) as tag_count
FROM tests t
LEFT JOIN test_tags tt ON t.id = tt.test_id
WHERE t.is_active = TRUE
GROUP BY t.id;

CREATE VIEW IF NOT EXISTS test_categories_summary AS
SELECT 
    category,
    COUNT(*) as test_count,
    COUNT(CASE WHEN last_status = 'passed' THEN 1 END) as passed_count,
    COUNT(CASE WHEN last_status = 'failed' THEN 1 END) as failed_count,
    COUNT(CASE WHEN last_status IS NULL THEN 1 END) as never_run_count,
    AVG(last_duration) as avg_duration_ms
FROM tests
WHERE is_active = TRUE
GROUP BY category
ORDER BY test_count DESC;

CREATE VIEW IF NOT EXISTS tag_summary AS
SELECT 
    tt.tag_name,
    tt.tag_type,
    COUNT(DISTINCT tt.test_id) as test_count,
    COUNT(DISTINCT t.category) as category_count
FROM test_tags tt
JOIN tests t ON tt.test_id = t.id
WHERE t.is_active = TRUE
GROUP BY tt.tag_name, tt.tag_type
ORDER BY test_count DESC;