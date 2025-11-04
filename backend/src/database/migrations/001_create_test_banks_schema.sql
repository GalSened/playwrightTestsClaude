-- Migration: Create Separate Test Banks Schema
-- Version: 001
-- Date: 2025-10-19
-- Description: Creates separate test banks for E2E, API, and Load testing
-- Author: QA Intelligence Team

-- ============================================================================
-- Table: test_banks
-- Purpose: Master table for managing different test bank types
-- ============================================================================

CREATE TABLE IF NOT EXISTS test_banks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  base_path TEXT NOT NULL,
  discovery_command TEXT NOT NULL,
  execution_command TEXT NOT NULL,
  framework TEXT NOT NULL,
  test_count INTEGER DEFAULT 0,
  passed_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  last_discovery DATETIME,
  last_execution DATETIME,
  discovery_rate REAL DEFAULT 0.0,
  pass_rate REAL DEFAULT 0.0,
  avg_execution_time INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'disabled', 'maintenance')),
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for test_banks
CREATE INDEX IF NOT EXISTS idx_test_banks_status ON test_banks(status);
CREATE INDEX IF NOT EXISTS idx_test_banks_name ON test_banks(name);

-- ============================================================================
-- Table: e2e_tests
-- Purpose: E2E/UI tests using Playwright + Pytest
-- ============================================================================

CREATE TABLE IF NOT EXISTS e2e_tests (
  id TEXT PRIMARY KEY,
  test_bank_id TEXT DEFAULT 'e2e',
  test_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  function_name TEXT NOT NULL,
  class_name TEXT,
  module_path TEXT,
  category TEXT NOT NULL,
  sub_category TEXT,
  priority TEXT DEFAULT 'medium' CHECK(priority IN ('critical', 'high', 'medium', 'low')),
  tags TEXT,
  markers TEXT,
  description TEXT,
  docstring TEXT,
  line_number INTEGER,
  estimated_duration INTEGER DEFAULT 30,
  actual_duration INTEGER,
  retry_attempts INTEGER DEFAULT 3,
  max_retries INTEGER DEFAULT 3,
  timeout INTEGER DEFAULT 30000,
  self_healing_enabled BOOLEAN DEFAULT 1,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'disabled', 'deprecated', 'skip')),
  last_run DATETIME,
  last_result TEXT CHECK(last_result IN ('passed', 'failed', 'skipped', 'healed', 'error')),
  last_error TEXT,
  run_count INTEGER DEFAULT 0,
  pass_count INTEGER DEFAULT 0,
  fail_count INTEGER DEFAULT 0,
  skip_count INTEGER DEFAULT 0,
  heal_count INTEGER DEFAULT 0,
  pass_rate REAL DEFAULT 0.0,
  flakiness_score REAL DEFAULT 0.0,
  browser TEXT DEFAULT 'chromium',
  headless BOOLEAN DEFAULT 1,
  screenshot_on_failure BOOLEAN DEFAULT 1,
  video_on_failure BOOLEAN DEFAULT 0,
  trace_on_failure BOOLEAN DEFAULT 1,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (test_bank_id) REFERENCES test_banks(id) ON DELETE CASCADE
);

-- Indexes for e2e_tests
CREATE INDEX IF NOT EXISTS idx_e2e_category ON e2e_tests(category);
CREATE INDEX IF NOT EXISTS idx_e2e_sub_category ON e2e_tests(sub_category);
CREATE INDEX IF NOT EXISTS idx_e2e_priority ON e2e_tests(priority);
CREATE INDEX IF NOT EXISTS idx_e2e_status ON e2e_tests(status);
CREATE INDEX IF NOT EXISTS idx_e2e_last_result ON e2e_tests(last_result);
CREATE INDEX IF NOT EXISTS idx_e2e_file_path ON e2e_tests(file_path);
CREATE INDEX IF NOT EXISTS idx_e2e_class_name ON e2e_tests(class_name);
CREATE INDEX IF NOT EXISTS idx_e2e_bank_category ON e2e_tests(test_bank_id, category);

-- ============================================================================
-- Table: api_tests
-- Purpose: API tests using Postman collections + Newman
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_tests (
  id TEXT PRIMARY KEY,
  test_bank_id TEXT DEFAULT 'api',
  test_name TEXT NOT NULL,
  collection_name TEXT NOT NULL,
  collection_id TEXT,
  folder_path TEXT,
  folder_id TEXT,
  request_name TEXT NOT NULL,
  request_id TEXT,
  http_method TEXT NOT NULL CHECK(http_method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS')),
  endpoint TEXT NOT NULL,
  full_url TEXT,
  module TEXT NOT NULL,
  api_version TEXT DEFAULT 'v3',
  priority TEXT DEFAULT 'medium' CHECK(priority IN ('critical', 'high', 'medium', 'low')),
  tags TEXT,
  description TEXT,
  expected_status INTEGER DEFAULT 200,
  expected_response_schema TEXT,
  timeout INTEGER DEFAULT 30000,
  retry_attempts INTEGER DEFAULT 2,
  max_retries INTEGER DEFAULT 3,
  requires_auth BOOLEAN DEFAULT 1,
  idempotent BOOLEAN DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'disabled', 'deprecated', 'skip')),
  last_run DATETIME,
  last_result TEXT CHECK(last_result IN ('passed', 'failed', 'skipped', 'error')),
  last_status_code INTEGER,
  last_error TEXT,
  run_count INTEGER DEFAULT 0,
  pass_count INTEGER DEFAULT 0,
  fail_count INTEGER DEFAULT 0,
  skip_count INTEGER DEFAULT 0,
  pass_rate REAL DEFAULT 0.0,
  avg_response_time INTEGER,
  min_response_time INTEGER,
  max_response_time INTEGER,
  p50_response_time INTEGER,
  p95_response_time INTEGER,
  p99_response_time INTEGER,
  flakiness_score REAL DEFAULT 0.0,
  request_headers TEXT,
  request_body TEXT,
  response_assertions TEXT,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (test_bank_id) REFERENCES test_banks(id) ON DELETE CASCADE
);

-- Indexes for api_tests
CREATE INDEX IF NOT EXISTS idx_api_module ON api_tests(module);
CREATE INDEX IF NOT EXISTS idx_api_method ON api_tests(http_method);
CREATE INDEX IF NOT EXISTS idx_api_priority ON api_tests(priority);
CREATE INDEX IF NOT EXISTS idx_api_status ON api_tests(status);
CREATE INDEX IF NOT EXISTS idx_api_last_result ON api_tests(last_result);
CREATE INDEX IF NOT EXISTS idx_api_endpoint ON api_tests(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_collection ON api_tests(collection_name);
CREATE INDEX IF NOT EXISTS idx_api_bank_module ON api_tests(test_bank_id, module);

-- ============================================================================
-- Table: load_tests
-- Purpose: Load/Performance tests using K6
-- ============================================================================

CREATE TABLE IF NOT EXISTS load_tests (
  id TEXT PRIMARY KEY,
  test_bank_id TEXT DEFAULT 'load',
  test_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  scenario_type TEXT NOT NULL CHECK(scenario_type IN ('smoke', 'load', 'stress', 'spike', 'soak', 'volume', 'breakpoint')),
  scenario_name TEXT,
  target_endpoint TEXT,
  target_endpoints TEXT,
  target_module TEXT,
  vus INTEGER DEFAULT 10,
  vus_max INTEGER,
  duration TEXT DEFAULT '5m',
  ramp_up_time TEXT,
  ramp_down_time TEXT,
  stages TEXT,
  thresholds TEXT,
  priority TEXT DEFAULT 'medium' CHECK(priority IN ('critical', 'high', 'medium', 'low')),
  tags TEXT,
  description TEXT,
  estimated_duration INTEGER,
  actual_duration INTEGER,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'disabled', 'deprecated', 'skip')),
  last_run DATETIME,
  last_result TEXT CHECK(last_result IN ('passed', 'failed', 'error')),
  last_error TEXT,
  run_count INTEGER DEFAULT 0,
  pass_count INTEGER DEFAULT 0,
  fail_count INTEGER DEFAULT 0,
  pass_rate REAL DEFAULT 0.0,
  avg_response_time INTEGER,
  min_response_time INTEGER,
  max_response_time INTEGER,
  p50_response_time INTEGER,
  p90_response_time INTEGER,
  p95_response_time INTEGER,
  p99_response_time INTEGER,
  throughput INTEGER,
  requests_per_second REAL,
  total_requests INTEGER,
  failed_requests INTEGER,
  error_rate REAL,
  data_received INTEGER,
  data_sent INTEGER,
  iteration_duration_avg INTEGER,
  iteration_duration_max INTEGER,
  vus_avg INTEGER,
  vus_max_actual INTEGER,
  http_req_blocked_avg INTEGER,
  http_req_connecting_avg INTEGER,
  http_req_tls_handshaking_avg INTEGER,
  http_req_sending_avg INTEGER,
  http_req_waiting_avg INTEGER,
  http_req_receiving_avg INTEGER,
  checks_passed INTEGER,
  checks_failed INTEGER,
  metrics_summary TEXT,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (test_bank_id) REFERENCES test_banks(id) ON DELETE CASCADE
);

-- Indexes for load_tests
CREATE INDEX IF NOT EXISTS idx_load_scenario ON load_tests(scenario_type);
CREATE INDEX IF NOT EXISTS idx_load_priority ON load_tests(priority);
CREATE INDEX IF NOT EXISTS idx_load_status ON load_tests(status);
CREATE INDEX IF NOT EXISTS idx_load_last_result ON load_tests(last_result);
CREATE INDEX IF NOT EXISTS idx_load_file_path ON load_tests(file_path);
CREATE INDEX IF NOT EXISTS idx_load_module ON load_tests(target_module);
CREATE INDEX IF NOT EXISTS idx_load_bank_scenario ON load_tests(test_bank_id, scenario_type);

-- ============================================================================
-- Table: test_executions
-- Purpose: Track all test executions across all banks
-- ============================================================================

CREATE TABLE IF NOT EXISTS test_executions (
  id TEXT PRIMARY KEY,
  test_bank_id TEXT NOT NULL,
  test_id TEXT NOT NULL,
  test_type TEXT NOT NULL CHECK(test_type IN ('e2e', 'api', 'load')),
  execution_type TEXT DEFAULT 'individual' CHECK(execution_type IN ('individual', 'suite', 'category', 'module', 'scenario', 'full')),
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'timeout')),
  result TEXT CHECK(result IN ('passed', 'failed', 'skipped', 'healed', 'error')),
  start_time DATETIME NOT NULL,
  end_time DATETIME,
  duration INTEGER,
  error TEXT,
  error_type TEXT,
  stack_trace TEXT,
  retry_count INTEGER DEFAULT 0,
  healing_applied BOOLEAN DEFAULT 0,
  healing_strategy TEXT,
  screenshot_path TEXT,
  video_path TEXT,
  trace_path TEXT,
  report_path TEXT,
  console_logs TEXT,
  network_logs TEXT,
  performance_metrics TEXT,
  environment TEXT,
  browser TEXT,
  user_agent TEXT,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (test_bank_id) REFERENCES test_banks(id) ON DELETE CASCADE
);

-- Indexes for test_executions
CREATE INDEX IF NOT EXISTS idx_executions_bank ON test_executions(test_bank_id);
CREATE INDEX IF NOT EXISTS idx_executions_test ON test_executions(test_id);
CREATE INDEX IF NOT EXISTS idx_executions_type ON test_executions(test_type);
CREATE INDEX IF NOT EXISTS idx_executions_status ON test_executions(status);
CREATE INDEX IF NOT EXISTS idx_executions_result ON test_executions(result);
CREATE INDEX IF NOT EXISTS idx_executions_start ON test_executions(start_time);
CREATE INDEX IF NOT EXISTS idx_executions_bank_test ON test_executions(test_bank_id, test_id);

-- ============================================================================
-- Seed Data: Initialize 3 test banks
-- ============================================================================

INSERT OR REPLACE INTO test_banks (
  id, name, display_name, description, icon, color,
  base_path, discovery_command, execution_command, framework
) VALUES
  (
    'e2e',
    'e2e',
    'End-to-End Tests',
    'UI/E2E tests using Playwright and Pytest for comprehensive user journey validation',
    'laptop',
    '#3B82F6',
    'new_tests_for_wesign/tests/',
    'py -m pytest new_tests_for_wesign/tests/ --collect-only --json-report --json-report-file=temp_e2e_discovery.json',
    'py -m pytest new_tests_for_wesign/tests/ -v --alluredir=reports/allure-results',
    'playwright-pytest'
  ),
  (
    'api',
    'api',
    'API Tests',
    'API integration tests using Postman collections and Newman for endpoint validation',
    'api',
    '#10B981',
    'new_tests_for_wesign/api_tests/',
    'newman run new_tests_for_wesign/api_tests/WeSign_ULTIMATE_COMPLETE_API_TESTING_SUITE.json --reporters cli,json',
    'newman run new_tests_for_wesign/api_tests/WeSign_ULTIMATE_COMPLETE_API_TESTING_SUITE.json -e new_tests_for_wesign/api_tests/WeSign\ API\ Environment.postman_environment.json --reporters htmlextra,allure',
    'postman-newman'
  ),
  (
    'load',
    'load',
    'Load Tests',
    'Performance and load tests using K6 for scalability and stress testing',
    'gauge',
    '#F59E0B',
    'new_tests_for_wesign/loadTesting/',
    'find new_tests_for_wesign/loadTesting/scenarios -name "*.js" -type f',
    'k6 run --out json=reports/k6/results.json --summary-export=reports/k6/summary.json',
    'k6'
  );

-- ============================================================================
-- Views for convenience
-- ============================================================================

-- View: All active tests summary
CREATE VIEW IF NOT EXISTS v_active_tests_summary AS
SELECT
  'e2e' as test_bank_id,
  'E2E' as test_type,
  COUNT(*) as total_tests,
  SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_tests,
  SUM(CASE WHEN last_result = 'passed' THEN 1 ELSE 0 END) as passed_tests,
  SUM(CASE WHEN last_result = 'failed' THEN 1 ELSE 0 END) as failed_tests,
  ROUND(AVG(CASE WHEN last_result = 'passed' THEN 100.0 ELSE 0.0 END), 2) as pass_rate
FROM e2e_tests
UNION ALL
SELECT
  'api' as test_bank_id,
  'API' as test_type,
  COUNT(*) as total_tests,
  SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_tests,
  SUM(CASE WHEN last_result = 'passed' THEN 1 ELSE 0 END) as passed_tests,
  SUM(CASE WHEN last_result = 'failed' THEN 1 ELSE 0 END) as failed_tests,
  ROUND(AVG(CASE WHEN last_result = 'passed' THEN 100.0 ELSE 0.0 END), 2) as pass_rate
FROM api_tests
UNION ALL
SELECT
  'load' as test_bank_id,
  'Load' as test_type,
  COUNT(*) as total_tests,
  SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_tests,
  SUM(CASE WHEN last_result = 'passed' THEN 1 ELSE 0 END) as passed_tests,
  SUM(CASE WHEN last_result = 'failed' THEN 1 ELSE 0 END) as failed_tests,
  ROUND(AVG(CASE WHEN last_result = 'passed' THEN 100.0 ELSE 0.0 END), 2) as pass_rate
FROM load_tests;

-- View: E2E tests by category
CREATE VIEW IF NOT EXISTS v_e2e_by_category AS
SELECT
  category,
  COUNT(*) as total_tests,
  SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_tests,
  SUM(CASE WHEN last_result = 'passed' THEN 1 ELSE 0 END) as passed_tests,
  SUM(CASE WHEN last_result = 'failed' THEN 1 ELSE 0 END) as failed_tests,
  ROUND(AVG(pass_rate), 2) as avg_pass_rate,
  ROUND(AVG(actual_duration), 0) as avg_duration
FROM e2e_tests
WHERE status = 'active'
GROUP BY category
ORDER BY total_tests DESC;

-- View: API tests by module
CREATE VIEW IF NOT EXISTS v_api_by_module AS
SELECT
  module,
  COUNT(*) as total_tests,
  SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_tests,
  SUM(CASE WHEN last_result = 'passed' THEN 1 ELSE 0 END) as passed_tests,
  SUM(CASE WHEN last_result = 'failed' THEN 1 ELSE 0 END) as failed_tests,
  ROUND(AVG(pass_rate), 2) as avg_pass_rate,
  ROUND(AVG(avg_response_time), 0) as avg_response_time
FROM api_tests
WHERE status = 'active'
GROUP BY module
ORDER BY total_tests DESC;

-- View: Load tests by scenario type
CREATE VIEW IF NOT EXISTS v_load_by_scenario AS
SELECT
  scenario_type,
  COUNT(*) as total_tests,
  SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_tests,
  SUM(CASE WHEN last_result = 'passed' THEN 1 ELSE 0 END) as passed_tests,
  SUM(CASE WHEN last_result = 'failed' THEN 1 ELSE 0 END) as failed_tests,
  ROUND(AVG(pass_rate), 2) as avg_pass_rate,
  ROUND(AVG(p95_response_time), 0) as avg_p95_response_time
FROM load_tests
WHERE status = 'active'
GROUP BY scenario_type
ORDER BY
  CASE scenario_type
    WHEN 'smoke' THEN 1
    WHEN 'load' THEN 2
    WHEN 'stress' THEN 3
    WHEN 'spike' THEN 4
    WHEN 'soak' THEN 5
    WHEN 'volume' THEN 6
    ELSE 7
  END;

-- ============================================================================
-- Triggers for automatic timestamp updates
-- ============================================================================

-- Trigger: Update test_banks timestamp
CREATE TRIGGER IF NOT EXISTS trg_test_banks_updated_at
AFTER UPDATE ON test_banks
FOR EACH ROW
BEGIN
  UPDATE test_banks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger: Update e2e_tests timestamp
CREATE TRIGGER IF NOT EXISTS trg_e2e_tests_updated_at
AFTER UPDATE ON e2e_tests
FOR EACH ROW
BEGIN
  UPDATE e2e_tests SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger: Update api_tests timestamp
CREATE TRIGGER IF NOT EXISTS trg_api_tests_updated_at
AFTER UPDATE ON api_tests
FOR EACH ROW
BEGIN
  UPDATE api_tests SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger: Update load_tests timestamp
CREATE TRIGGER IF NOT EXISTS trg_load_tests_updated_at
AFTER UPDATE ON load_tests
FOR EACH ROW
BEGIN
  UPDATE load_tests SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================================================
-- Migration complete
-- ============================================================================

-- Verify tables were created
SELECT
  'Migration 001: Separate Test Banks Schema' as migration,
  'SUCCESS' as status,
  datetime('now') as completed_at;

-- Show test bank summary
SELECT * FROM test_banks;
