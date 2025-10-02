-- Migration: Add File System Tracking Support
-- Version: 101
-- Description: Adds columns to track file system state for tests
-- Date: 2025-10-02

-- Create file sync log table
CREATE TABLE IF NOT EXISTS file_sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scan_date DATETIME DEFAULT (datetime('now', 'utc')),
  source_directory TEXT NOT NULL,
  files_found INTEGER NOT NULL DEFAULT 0,
  tests_found INTEGER NOT NULL DEFAULT 0,
  database_records INTEGER NOT NULL DEFAULT 0,
  tests_added INTEGER NOT NULL DEFAULT 0,
  tests_updated INTEGER NOT NULL DEFAULT 0,
  tests_removed INTEGER NOT NULL DEFAULT 0,
  sync_status TEXT NOT NULL CHECK(sync_status IN ('success', 'partial', 'failed')) DEFAULT 'success',
  sync_duration_ms INTEGER,
  error_message TEXT,
  metadata TEXT
);

-- Create indexes for file sync log
CREATE INDEX IF NOT EXISTS idx_file_sync_log_date ON file_sync_log(scan_date);
CREATE INDEX IF NOT EXISTS idx_file_sync_log_source ON file_sync_log(source_directory);

-- Add test source configuration table
CREATE TABLE IF NOT EXISTS test_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  path TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('local', 'git', 'network')) DEFAULT 'local',
  enabled BOOLEAN NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 0,
  scan_interval_minutes INTEGER NOT NULL DEFAULT 5,
  last_scan DATETIME,
  total_tests INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT (datetime('now', 'utc')),
  updated_at DATETIME DEFAULT (datetime('now', 'utc'))
);

-- Insert default test sources
INSERT OR IGNORE INTO test_sources (name, path, type, enabled, priority) VALUES
  ('wesign-official', 'C:/Users/gals/seleniumpythontests-1/playwright_tests/', 'local', 1, 1),
  ('wesign-local', 'C:/Users/gals/Desktop/playwrightTestsClaude/new_tests_for_wesign', 'local', 1, 0);

-- Create table for file watch events
CREATE TABLE IF NOT EXISTS file_watch_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL CHECK(event_type IN ('add', 'change', 'unlink', 'addDir', 'unlinkDir')),
  file_path TEXT NOT NULL,
  timestamp DATETIME DEFAULT (datetime('now', 'utc')),
  processed BOOLEAN DEFAULT 0,
  processed_at DATETIME,
  source_directory TEXT
);

CREATE INDEX IF NOT EXISTS idx_file_watch_processed ON file_watch_events(processed, timestamp);
CREATE INDEX IF NOT EXISTS idx_file_watch_source ON file_watch_events(source_directory);
