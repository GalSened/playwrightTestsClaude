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
    'a2a', 'mcp', 'artifact-read', 'artifact-write',
    'time', 'random', 'http', 'database'
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

-- ============================================================================
-- AGENT REGISTRY TABLES (A2A System)
-- ============================================================================

-- Agents table: tracks registered agents and their capabilities
CREATE TABLE IF NOT EXISTS agents (
  agent_id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  tenant TEXT NOT NULL,
  project TEXT NOT NULL,
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('STARTING', 'HEALTHY', 'DEGRADED', 'UNAVAILABLE')),
  last_heartbeat TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  lease_until TIMESTAMP WITH TIME ZONE NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for agent queries
CREATE INDEX IF NOT EXISTS idx_agents_tenant_project ON agents(tenant, project);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_lease ON agents(lease_until);
CREATE INDEX IF NOT EXISTS idx_agents_capabilities ON agents USING gin(capabilities);
CREATE INDEX IF NOT EXISTS idx_agents_last_heartbeat ON agents(last_heartbeat DESC);

-- Trigger to update updated_at timestamp for agents
CREATE TRIGGER update_agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Agent topics table: tracks topic subscriptions
CREATE TABLE IF NOT EXISTS agent_topics (
  id BIGSERIAL PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('publisher', 'subscriber', 'both')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (agent_id, topic, role)
);

-- Indexes for topic queries
CREATE INDEX IF NOT EXISTS idx_agent_topics_agent ON agent_topics(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_topics_topic ON agent_topics(topic);
CREATE INDEX IF NOT EXISTS idx_agent_topics_role ON agent_topics(role);

-- View for active agents with topic counts
CREATE OR REPLACE VIEW agents_active AS
SELECT
  a.agent_id,
  a.version,
  a.tenant,
  a.project,
  a.capabilities,
  a.status,
  a.last_heartbeat,
  a.lease_until,
  COUNT(t.id) as topic_count,
  EXTRACT(EPOCH FROM (a.lease_until - NOW())) as lease_remaining_seconds
FROM agents a
LEFT JOIN agent_topics t ON a.agent_id = t.agent_id
WHERE a.status IN ('HEALTHY', 'DEGRADED')
  AND a.lease_until > NOW()
GROUP BY a.agent_id, a.version, a.tenant, a.project, a.capabilities, a.status, a.last_heartbeat, a.lease_until;

-- Function to mark expired agents as unavailable
CREATE OR REPLACE FUNCTION mark_expired_agents()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE agents
  SET status = 'UNAVAILABLE',
      updated_at = NOW()
  WHERE lease_until < NOW()
    AND status != 'UNAVAILABLE';

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Function to discover agents by capability
CREATE OR REPLACE FUNCTION discover_agents(
  p_tenant TEXT,
  p_project TEXT,
  p_capability TEXT DEFAULT NULL
)
RETURNS TABLE(
  agent_id TEXT,
  version TEXT,
  capabilities JSONB,
  status TEXT,
  last_heartbeat TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.agent_id,
    a.version,
    a.capabilities,
    a.status,
    a.last_heartbeat
  FROM agents a
  WHERE a.tenant = p_tenant
    AND a.project = p_project
    AND a.status IN ('HEALTHY', 'DEGRADED')
    AND a.lease_until > NOW()
    AND (p_capability IS NULL OR a.capabilities ? p_capability)
  ORDER BY a.last_heartbeat DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old inactive agents
CREATE OR REPLACE FUNCTION cleanup_inactive_agents(retention_days INTEGER DEFAULT 7)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM agents
  WHERE status = 'UNAVAILABLE'
    AND updated_at < NOW() - (retention_days || ' days')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comments for agent registry documentation
COMMENT ON TABLE agents IS 'Registry of all active agents in the A2A system';
COMMENT ON TABLE agent_topics IS 'Agent topic subscriptions and publications';
COMMENT ON COLUMN agents.agent_id IS 'Unique agent identifier (e.g., cmo-main, playwright_healer)';
COMMENT ON COLUMN agents.capabilities IS 'JSONB array of agent capabilities for discovery';
COMMENT ON COLUMN agents.lease_until IS 'Lease expiration time; agents must heartbeat before this time';
COMMENT ON COLUMN agents.status IS 'Agent status: STARTING → HEALTHY → DEGRADED → UNAVAILABLE';
COMMENT ON FUNCTION mark_expired_agents() IS 'Background job to mark expired agents as UNAVAILABLE';
COMMENT ON FUNCTION discover_agents(TEXT, TEXT, TEXT) IS 'Discover active agents by tenant, project, and optional capability';
