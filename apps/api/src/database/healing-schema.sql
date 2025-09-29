-- Self-Healing System Database Schema
-- This table stores all test failures that require healing analysis

CREATE TABLE IF NOT EXISTS healing_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id TEXT NOT NULL,
  test_name TEXT NOT NULL,
  failure_type TEXT NOT NULL, -- SELECTOR_ISSUE, TIMING_ISSUE, APPLICATION_BUG, DOM_CHANGE, UNKNOWN
  error_message TEXT NOT NULL,
  dom_snapshot TEXT, -- Full DOM content at time of failure
  screenshot BLOB, -- Screenshot of failure state
  console_logs TEXT, -- Console errors and warnings in JSON format
  network_logs TEXT, -- Network requests and responses in JSON format
  original_selector TEXT, -- The selector that failed
  healed_selector TEXT, -- The new selector that was generated (if healed)
  confidence_score REAL DEFAULT 0.0, -- Confidence in the healing (0.0 to 1.0)
  status TEXT DEFAULT 'pending', -- pending, analyzing, healed, failed, bug_confirmed
  healing_attempts INTEGER DEFAULT 0, -- Number of healing attempts made
  last_attempt_at DATETIME, -- When the last healing attempt was made
  healed_at DATETIME, -- When the healing was successful
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient querying by status and test
CREATE INDEX IF NOT EXISTS idx_healing_queue_status ON healing_queue(status);
CREATE INDEX IF NOT EXISTS idx_healing_queue_test_id ON healing_queue(test_id);
CREATE INDEX IF NOT EXISTS idx_healing_queue_failure_type ON healing_queue(failure_type);
CREATE INDEX IF NOT EXISTS idx_healing_queue_created_at ON healing_queue(created_at);

-- Table to store healing statistics and metrics
CREATE TABLE IF NOT EXISTS healing_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL, -- YYYY-MM-DD format
  total_failures INTEGER DEFAULT 0,
  auto_healed INTEGER DEFAULT 0,
  bugs_found INTEGER DEFAULT 0,
  pending_healing INTEGER DEFAULT 0,
  avg_confidence_score REAL DEFAULT 0.0,
  success_rate REAL DEFAULT 0.0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient date-based queries
CREATE INDEX IF NOT EXISTS idx_healing_stats_date ON healing_stats(date);

-- Table to store healing patterns and learned selectors
CREATE TABLE IF NOT EXISTS healing_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_type TEXT NOT NULL, -- auth, documents, dashboard, etc.
  original_pattern TEXT NOT NULL, -- Original selector pattern that failed
  healed_pattern TEXT NOT NULL, -- New working selector pattern
  success_count INTEGER DEFAULT 1, -- How many times this pattern worked
  confidence_score REAL NOT NULL,
  page_url_pattern TEXT, -- URL pattern where this healing applies
  dom_context TEXT, -- Surrounding DOM context for better matching
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for pattern matching queries
CREATE INDEX IF NOT EXISTS idx_healing_patterns_test_type ON healing_patterns(test_type);
CREATE INDEX IF NOT EXISTS idx_healing_patterns_original ON healing_patterns(original_pattern);

-- Trigger to update healing_stats when healing_queue status changes
CREATE TRIGGER IF NOT EXISTS update_healing_stats
AFTER UPDATE ON healing_queue
WHEN OLD.status != NEW.status
BEGIN
  INSERT OR REPLACE INTO healing_stats (
    date, 
    total_failures, 
    auto_healed, 
    bugs_found, 
    pending_healing,
    success_rate
  )
  SELECT 
    date('now'),
    COUNT(*) as total_failures,
    COUNT(CASE WHEN status = 'healed' THEN 1 END) as auto_healed,
    COUNT(CASE WHEN status = 'bug_confirmed' THEN 1 END) as bugs_found,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_healing,
    ROUND(
      CAST(COUNT(CASE WHEN status = 'healed' THEN 1 END) AS REAL) / 
      CAST(COUNT(*) AS REAL) * 100, 2
    ) as success_rate
  FROM healing_queue 
  WHERE date(created_at) = date('now');
END;

-- Initialize today's stats if they don't exist
INSERT OR IGNORE INTO healing_stats (date, total_failures, auto_healed, bugs_found, pending_healing, success_rate)
VALUES (date('now'), 0, 0, 0, 0, 0.0);