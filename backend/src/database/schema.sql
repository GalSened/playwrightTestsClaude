-- Database schema for Playwright Smart Scheduler
-- Designed for production-ready scheduling with timezone support

-- Schedules table - stores scheduled test suite runs
CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY,
    suite_id TEXT NOT NULL,
    suite_name TEXT NOT NULL,
    user_id TEXT, -- Future auth support
    
    -- Timezone and scheduling info
    timezone TEXT NOT NULL DEFAULT 'UTC', -- System timezone (configurable)
    run_at_utc TEXT NOT NULL, -- ISO 8601 UTC timestamp
    run_at_local TEXT NOT NULL, -- ISO 8601 local timestamp for display
    
    -- Recurrence (for future extension)
    recurrence_type TEXT CHECK (recurrence_type IN ('none', 'daily', 'weekly', 'monthly')) DEFAULT 'none',
    recurrence_interval INTEGER DEFAULT 1, -- every N days/weeks/months
    recurrence_days TEXT, -- JSON array for weekly schedules (e.g., ["Monday", "Friday"])
    recurrence_end_date TEXT, -- ISO 8601 UTC
    
    -- Schedule metadata
    notes TEXT,
    tags TEXT, -- JSON array of tags
    priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
    
    -- Status tracking
    status TEXT CHECK (status IN ('scheduled', 'running', 'completed', 'failed', 'canceled')) DEFAULT 'scheduled',
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    
    -- Execution metadata
    execution_options TEXT, -- JSON object with execution options
    last_run_id TEXT, -- Reference to last schedule_runs entry
    next_run_at TEXT, -- For recurring schedules
    
    -- Concurrency control
    claimed_at TEXT, -- Worker claim timestamp
    claimed_by TEXT, -- Worker instance ID
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    FOREIGN KEY (last_run_id) REFERENCES schedule_runs(id)
);

-- Schedule runs table - tracks actual executions
CREATE TABLE IF NOT EXISTS schedule_runs (
    id TEXT PRIMARY KEY,
    schedule_id TEXT NOT NULL,
    
    -- Execution timing
    started_at TEXT NOT NULL, -- ISO 8601 UTC
    finished_at TEXT, -- ISO 8601 UTC
    duration_ms INTEGER, -- Duration in milliseconds
    
    -- Run status and results
    status TEXT CHECK (status IN ('running', 'completed', 'failed', 'canceled', 'timeout')) NOT NULL,
    exit_code INTEGER,
    error_message TEXT,
    
    -- Test results summary
    tests_total INTEGER DEFAULT 0,
    tests_passed INTEGER DEFAULT 0,
    tests_failed INTEGER DEFAULT 0,
    tests_skipped INTEGER DEFAULT 0,
    
    -- Artifacts and logs
    artifacts_path TEXT, -- Path to test artifacts (screenshots, videos, reports)
    log_output TEXT, -- Captured execution logs
    result_summary TEXT, -- JSON summary of results
    
    -- Retry tracking
    attempt_number INTEGER DEFAULT 1,
    retry_reason TEXT,
    
    -- Environment info
    environment TEXT DEFAULT 'local',
    browser TEXT,
    test_runner_version TEXT,
    
    FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_schedules_status ON schedules(status);
CREATE INDEX IF NOT EXISTS idx_schedules_run_at_utc ON schedules(run_at_utc);
CREATE INDEX IF NOT EXISTS idx_schedules_suite_id ON schedules(suite_id);
CREATE INDEX IF NOT EXISTS idx_schedules_claimed ON schedules(status, claimed_at, run_at_utc);
CREATE INDEX IF NOT EXISTS idx_schedules_next_run ON schedules(next_run_at) WHERE next_run_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_schedule_runs_schedule_id ON schedule_runs(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_runs_started_at ON schedule_runs(started_at);
CREATE INDEX IF NOT EXISTS idx_schedule_runs_status ON schedule_runs(status);

-- Trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS schedules_updated_at 
    AFTER UPDATE ON schedules
    FOR EACH ROW
BEGIN
    UPDATE schedules 
    SET updated_at = datetime('now', 'utc') 
    WHERE id = NEW.id;
END;

-- View for scheduled runs with joined information
CREATE VIEW IF NOT EXISTS scheduled_runs_view AS
SELECT 
    s.id,
    s.suite_id,
    s.suite_name,
    s.timezone,
    s.run_at_utc,
    s.run_at_local,
    s.status,
    s.notes,
    s.tags,
    s.created_at,
    s.updated_at,
    sr.started_at as last_started_at,
    sr.finished_at as last_finished_at,
    sr.status as last_run_status,
    sr.tests_total,
    sr.tests_passed,
    sr.tests_failed,
    sr.tests_skipped,
    sr.artifacts_path as last_artifacts_path
FROM schedules s
LEFT JOIN schedule_runs sr ON s.last_run_id = sr.id;