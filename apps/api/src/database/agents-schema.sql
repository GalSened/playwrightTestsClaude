-- Sub-Agents Database Schema Extension
-- Schema for managing Claude Code sub-agents state and metrics

-- Agent states table - tracks current state of all agents
CREATE TABLE IF NOT EXISTS agent_states (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN (
        'test-intelligence', 'healing', 'code-generation', 
        'quality-assurance', 'performance-optimization', 
        'workflow-orchestration', 'specialist', 'general-purpose',
        'jira-integration'
    )),
    status TEXT NOT NULL CHECK (status IN ('idle', 'active', 'busy', 'error', 'offline')) DEFAULT 'idle',
    
    -- Agent metadata
    capabilities TEXT NOT NULL, -- JSON array of capabilities
    last_activity TEXT, -- ISO 8601 UTC timestamp
    current_task TEXT, -- Current task ID if busy
    
    -- Performance metrics (JSON)
    performance_metrics TEXT DEFAULT '{}', -- JSON object with performance data
    resource_usage TEXT DEFAULT '{}', -- JSON object with CPU/memory usage
    
    -- Configuration and context
    configuration TEXT DEFAULT '{}', -- JSON agent configuration
    context TEXT DEFAULT '{}', -- JSON context data
    
    -- Health and reliability
    health_score REAL DEFAULT 1.0 CHECK (health_score >= 0 AND health_score <= 1.0),
    error_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    total_executions INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    
    -- Recovery tracking
    recovery_attempts INTEGER DEFAULT 0,
    last_recovery_at TEXT, -- ISO 8601 UTC timestamp
    escalation_count INTEGER DEFAULT 0
);

-- Agent tasks table - tracks task execution history
CREATE TABLE IF NOT EXISTS agent_tasks (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    task_type TEXT NOT NULL CHECK (task_type IN (
        'analyze-failures', 'heal-selectors', 'generate-tests', 
        'optimize-performance', 'assess-quality', 'plan-execution', 'health-check'
    )),
    
    -- Task execution details
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'success', 'error', 'timeout', 'cancelled')) DEFAULT 'pending',
    priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
    
    -- Timing information
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    started_at TEXT,
    completed_at TEXT,
    execution_time_ms INTEGER,
    timeout_ms INTEGER DEFAULT 30000,
    
    -- Task data and results
    input_data TEXT DEFAULT '{}', -- JSON task input data
    output_data TEXT DEFAULT '{}', -- JSON task output data
    context_data TEXT DEFAULT '{}', -- JSON context at execution time
    
    -- Error handling
    error_message TEXT,
    error_stack TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- Confidence and quality metrics
    confidence_score REAL CHECK (confidence_score >= 0 AND confidence_score <= 1.0),
    quality_score REAL CHECK (quality_score >= 0 AND quality_score <= 1.0),
    
    -- AI usage tracking
    tokens_used INTEGER,
    model_used TEXT,
    ai_cost_estimate REAL DEFAULT 0.0,
    
    -- Artifacts and outputs
    artifacts TEXT DEFAULT '[]', -- JSON array of artifact paths
    recommendations TEXT DEFAULT '[]', -- JSON array of recommendations
    
    FOREIGN KEY (agent_id) REFERENCES agent_states(id) ON DELETE CASCADE
);

-- Agent workflows table - tracks multi-agent workflow executions
CREATE TABLE IF NOT EXISTS agent_workflows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    
    -- Workflow definition
    workflow_steps TEXT NOT NULL, -- JSON array of workflow steps
    workflow_context TEXT DEFAULT '{}', -- JSON workflow context
    
    -- Execution status
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'timeout', 'cancelled')) DEFAULT 'pending',
    priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
    
    -- Timing
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    started_at TEXT,
    completed_at TEXT,
    total_duration_ms INTEGER,
    estimated_duration_ms INTEGER,
    
    -- Results and metrics
    steps_completed INTEGER DEFAULT 0,
    steps_total INTEGER NOT NULL,
    success_rate REAL DEFAULT 0.0,
    
    -- Workflow results
    results TEXT DEFAULT '[]', -- JSON array of step results
    summary TEXT DEFAULT '{}', -- JSON workflow summary
    recommendations TEXT DEFAULT '[]', -- JSON recommendations from workflow
    
    -- Error handling
    error_message TEXT,
    failed_step_id TEXT,
    
    created_by TEXT DEFAULT 'system'
);

-- Agent health checks table - tracks agent health monitoring
CREATE TABLE IF NOT EXISTS agent_health_checks (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    
    -- Health check results
    healthy BOOLEAN NOT NULL,
    response_time_ms INTEGER NOT NULL,
    timestamp TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    
    -- Error information
    error_message TEXT,
    error_category TEXT CHECK (error_category IN ('timeout', 'exception', 'performance', 'resource')),
    
    -- Health metrics
    cpu_usage REAL,
    memory_usage_mb REAL,
    active_tasks INTEGER DEFAULT 0,
    
    -- Recovery actions
    recovery_action TEXT CHECK (recovery_action IN ('none', 'restart', 'reinitialize', 'escalate')),
    recovery_successful BOOLEAN,
    
    FOREIGN KEY (agent_id) REFERENCES agent_states(id) ON DELETE CASCADE
);

-- Agent patterns table - stores learned patterns for failure analysis and healing
CREATE TABLE IF NOT EXISTS agent_patterns (
    id TEXT PRIMARY KEY,
    pattern_type TEXT NOT NULL CHECK (pattern_type IN ('failure', 'healing', 'optimization', 'quality')),
    pattern_name TEXT NOT NULL,
    
    -- Pattern definition
    pattern_data TEXT NOT NULL, -- JSON pattern definition
    confidence_score REAL NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1.0),
    
    -- Usage statistics
    frequency INTEGER DEFAULT 1,
    success_rate REAL DEFAULT 0.0,
    last_used_at TEXT,
    
    -- Pattern metadata
    tags TEXT DEFAULT '[]', -- JSON array of tags
    category TEXT, -- e.g., 'selector', 'timing', 'api', 'data'
    affected_tests TEXT DEFAULT '[]', -- JSON array of test names
    
    -- Learning data
    created_by_agent TEXT,
    learning_context TEXT DEFAULT '{}', -- JSON learning context
    validation_count INTEGER DEFAULT 0,
    
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

-- Performance indices for agent tables
CREATE INDEX IF NOT EXISTS idx_agent_states_type ON agent_states(type);
CREATE INDEX IF NOT EXISTS idx_agent_states_status ON agent_states(status);
CREATE INDEX IF NOT EXISTS idx_agent_states_health ON agent_states(health_score);
CREATE INDEX IF NOT EXISTS idx_agent_states_activity ON agent_states(last_activity);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_agent_id ON agent_tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_type ON agent_tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_created ON agent_tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_priority ON agent_tasks(priority, status);

CREATE INDEX IF NOT EXISTS idx_agent_workflows_status ON agent_workflows(status);
CREATE INDEX IF NOT EXISTS idx_agent_workflows_created ON agent_workflows(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_workflows_priority ON agent_workflows(priority, status);

CREATE INDEX IF NOT EXISTS idx_agent_health_agent_id ON agent_health_checks(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_health_timestamp ON agent_health_checks(timestamp);
CREATE INDEX IF NOT EXISTS idx_agent_health_healthy ON agent_health_checks(healthy);

CREATE INDEX IF NOT EXISTS idx_agent_patterns_type ON agent_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_agent_patterns_name ON agent_patterns(pattern_name);
CREATE INDEX IF NOT EXISTS idx_agent_patterns_confidence ON agent_patterns(confidence_score);
CREATE INDEX IF NOT EXISTS idx_agent_patterns_frequency ON agent_patterns(frequency);

-- Triggers to update updated_at timestamps
CREATE TRIGGER IF NOT EXISTS agent_states_updated_at 
    AFTER UPDATE ON agent_states
    FOR EACH ROW
BEGIN
    UPDATE agent_states 
    SET updated_at = datetime('now', 'utc') 
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS agent_patterns_updated_at 
    AFTER UPDATE ON agent_patterns
    FOR EACH ROW
BEGIN
    UPDATE agent_patterns 
    SET updated_at = datetime('now', 'utc') 
    WHERE id = NEW.id;
END;

-- Views for agent monitoring and analytics

-- Agent performance summary view
CREATE VIEW IF NOT EXISTS agent_performance_summary AS
SELECT 
    a.id,
    a.type,
    a.status,
    a.health_score,
    a.total_executions,
    a.success_count,
    a.error_count,
    CASE 
        WHEN a.total_executions > 0 THEN ROUND((a.success_count * 100.0) / a.total_executions, 2)
        ELSE 0.0 
    END as success_rate_percent,
    a.last_activity,
    COUNT(t.id) as active_tasks,
    AVG(t.execution_time_ms) as avg_execution_time_ms,
    h.last_health_check,
    h.avg_response_time_ms
FROM agent_states a
LEFT JOIN agent_tasks t ON a.id = t.agent_id AND t.status IN ('pending', 'running')
LEFT JOIN (
    SELECT 
        agent_id,
        MAX(timestamp) as last_health_check,
        AVG(response_time_ms) as avg_response_time_ms
    FROM agent_health_checks 
    WHERE timestamp > datetime('now', '-1 hour', 'utc')
    GROUP BY agent_id
) h ON a.id = h.agent_id
GROUP BY a.id, a.type, a.status, a.health_score, a.total_executions, 
         a.success_count, a.error_count, a.last_activity, h.last_health_check, h.avg_response_time_ms;

-- Recent failures view for pattern analysis
CREATE VIEW IF NOT EXISTS agent_recent_failures AS
SELECT 
    t.id,
    t.agent_id,
    a.type as agent_type,
    t.task_type,
    t.error_message,
    t.completed_at,
    t.execution_time_ms,
    t.input_data,
    t.context_data
FROM agent_tasks t
JOIN agent_states a ON t.agent_id = a.id
WHERE t.status = 'error' 
  AND t.completed_at > datetime('now', '-24 hours', 'utc')
ORDER BY t.completed_at DESC;

-- Workflow efficiency view
CREATE VIEW IF NOT EXISTS workflow_efficiency AS
SELECT 
    w.id,
    w.name,
    w.status,
    w.steps_completed,
    w.steps_total,
    CASE 
        WHEN w.steps_total > 0 THEN ROUND((w.steps_completed * 100.0) / w.steps_total, 2)
        ELSE 0.0 
    END as completion_percentage,
    w.total_duration_ms,
    w.estimated_duration_ms,
    CASE 
        WHEN w.estimated_duration_ms > 0 THEN 
            ROUND((w.total_duration_ms * 100.0) / w.estimated_duration_ms, 2)
        ELSE NULL 
    END as duration_vs_estimate_percent,
    w.created_at,
    w.completed_at
FROM agent_workflows w
ORDER BY w.created_at DESC;

-- Agent utilization view
CREATE VIEW IF NOT EXISTS agent_utilization AS
SELECT 
    a.id,
    a.type,
    a.status,
    COUNT(CASE WHEN t.status IN ('running', 'pending') THEN 1 END) as current_load,
    COUNT(CASE WHEN t.created_at > datetime('now', '-1 hour', 'utc') THEN 1 END) as tasks_last_hour,
    COUNT(CASE WHEN t.created_at > datetime('now', '-24 hours', 'utc') THEN 1 END) as tasks_last_day,
    AVG(CASE WHEN t.status = 'success' THEN t.execution_time_ms END) as avg_success_time_ms,
    COUNT(CASE WHEN t.status = 'error' AND t.completed_at > datetime('now', '-24 hours', 'utc') THEN 1 END) as errors_last_day
FROM agent_states a
LEFT JOIN agent_tasks t ON a.id = t.agent_id
GROUP BY a.id, a.type, a.status
ORDER BY current_load DESC, tasks_last_hour DESC;