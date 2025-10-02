-- CMO/ELG Checkpointer Schema
-- PostgreSQL 16+ required
-- Provides crash recovery and replay support

-- Extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Runs table: tracks overall execution
CREATE TABLE IF NOT EXISTS cmo_runs (
  trace_id TEXT PRIMARY KEY,
  graph_id TEXT NOT NULL,
  graph_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'timeout', 'aborted')),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  error TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for querying by status
CREATE INDEX IF NOT EXISTS idx_cmo_runs_status ON cmo_runs(status);
CREATE INDEX IF NOT EXISTS idx_cmo_runs_graph ON cmo_runs(graph_id, graph_version);
CREATE INDEX IF NOT EXISTS idx_cmo_runs_started_at ON cmo_runs(started_at DESC);

-- Steps table: tracks individual node executions
CREATE TABLE IF NOT EXISTS cmo_steps (
  id BIGSERIAL PRIMARY KEY,
  trace_id TEXT NOT NULL REFERENCES cmo_runs(trace_id) ON DELETE CASCADE,
  step_index INTEGER NOT NULL,
  node_id TEXT NOT NULL,
  state_hash TEXT NOT NULL,
  input_hash TEXT,
  output_hash TEXT,
  next_edge TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  error JSONB,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Unique constraint for idempotency
  UNIQUE (trace_id, step_index)
);

-- Indexes for step queries
CREATE INDEX IF NOT EXISTS idx_cmo_steps_trace ON cmo_steps(trace_id, step_index);
CREATE INDEX IF NOT EXISTS idx_cmo_steps_node ON cmo_steps(node_id);
CREATE INDEX IF NOT EXISTS idx_cmo_steps_state_hash ON cmo_steps(state_hash);

-- Activities table: tracks all I/O operations for replay
CREATE TABLE IF NOT EXISTS cmo_activities (
  id BIGSERIAL PRIMARY KEY,
  trace_id TEXT NOT NULL,
  step_index INTEGER NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'send_a2a', 'call_mcp', 'read_artifact', 'write_artifact',
    'now', 'rand', 'http_request', 'database_query'
  )),
  request_hash TEXT NOT NULL,
  request_data JSONB,
  response_data JSONB,
  response_blob_ref TEXT, -- S3 key for large responses
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  duration_ms INTEGER,
  error JSONB,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Unique constraint for idempotency (same request in same step)
  UNIQUE (trace_id, step_index, activity_type, request_hash),

  -- Foreign key to steps
  FOREIGN KEY (trace_id, step_index) REFERENCES cmo_steps(trace_id, step_index) ON DELETE CASCADE
);

-- Indexes for activity queries
CREATE INDEX IF NOT EXISTS idx_cmo_activities_trace ON cmo_activities(trace_id, step_index);
CREATE INDEX IF NOT EXISTS idx_cmo_activities_type ON cmo_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_cmo_activities_request_hash ON cmo_activities(request_hash);

-- Graph metadata table: tracks graph definitions
CREATE TABLE IF NOT EXISTS cmo_graphs (
  id TEXT NOT NULL,
  version TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  definition JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  PRIMARY KEY (id, version)
);

-- Index for graph queries
CREATE INDEX IF NOT EXISTS idx_cmo_graphs_name ON cmo_graphs(name);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cmo_runs_updated_at
  BEFORE UPDATE ON cmo_runs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cmo_graphs_updated_at
  BEFORE UPDATE ON cmo_graphs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- View for execution summary
CREATE OR REPLACE VIEW cmo_execution_summary AS
SELECT
  r.trace_id,
  r.graph_id,
  r.graph_version,
  r.status,
  r.started_at,
  r.completed_at,
  r.error,
  COUNT(s.id) as total_steps,
  COUNT(CASE WHEN s.error IS NOT NULL THEN 1 END) as failed_steps,
  SUM(s.duration_ms) as total_duration_ms,
  COUNT(a.id) as total_activities
FROM cmo_runs r
LEFT JOIN cmo_steps s ON r.trace_id = s.trace_id
LEFT JOIN cmo_activities a ON r.trace_id = a.trace_id
GROUP BY r.trace_id, r.graph_id, r.graph_version, r.status, r.started_at, r.completed_at, r.error;

-- Function to clean up old executions (retention policy)
CREATE OR REPLACE FUNCTION cleanup_old_executions(retention_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM cmo_runs
  WHERE completed_at < NOW() - (retention_days || ' days')::INTERVAL
    AND status IN ('completed', 'failed', 'aborted');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get execution progress
CREATE OR REPLACE FUNCTION get_execution_progress(p_trace_id TEXT)
RETURNS TABLE(
  current_step INTEGER,
  current_node TEXT,
  total_steps INTEGER,
  duration_ms INTEGER,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.step_index,
    s.node_id,
    COUNT(*) OVER ()::INTEGER,
    SUM(s.duration_ms) OVER ()::INTEGER,
    r.status
  FROM cmo_runs r
  LEFT JOIN cmo_steps s ON r.trace_id = s.trace_id
  WHERE r.trace_id = p_trace_id
  ORDER BY s.step_index DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE cmo_runs IS 'Tracks overall graph execution runs';
COMMENT ON TABLE cmo_steps IS 'Tracks individual node execution steps with state hashes';
COMMENT ON TABLE cmo_activities IS 'Tracks all I/O activities for deterministic replay';
COMMENT ON TABLE cmo_graphs IS 'Stores graph definitions and versions';
COMMENT ON COLUMN cmo_steps.state_hash IS 'SHA-256 hash of state for determinism verification';
COMMENT ON COLUMN cmo_activities.request_hash IS 'SHA-256 hash of request for idempotency';
COMMENT ON COLUMN cmo_activities.response_blob_ref IS 'S3 object key for large responses (>1MB)';
