/**
 * A2A Envelope Type Definitions
 * TypeScript interfaces matching JSON schemas
 */

/**
 * Agent identifier
 */
export interface AgentId {
  type: 'cmo' | 'specialist' | 'mcp-server' | 'ci-gate' | 'dashboard' | 'api-client' | 'system';
  id: string;
  version: string;
  instance_id?: string;
  capabilities?: string[];
}

/**
 * Topic-based routing target
 */
export interface TopicTarget {
  type: 'topic';
  name: string;
}

/**
 * Envelope metadata (all A2A messages)
 */
export interface EnvelopeMeta {
  a2a_version: '1.0';
  message_id: string;
  trace_id: string;
  ts: string; // ISO 8601
  from: AgentId;
  to: Array<AgentId | TopicTarget>;
  tenant: string;
  project: string;
  type:
    | 'TaskRequest'
    | 'TaskResult'
    | 'MemoryEvent'
    | 'ContextRequest'
    | 'ContextResult'
    | 'SpecialistInvocationRequest'
    | 'SpecialistResult'
    | 'RetryDirective'
    | 'DecisionNotice'
    | 'HeartbeatEvent'
    | 'RegistryUpdate';
  priority?: 'low' | 'normal' | 'high';
  deadline?: string; // ISO 8601
  idempotency_key?: string;
  correlation_id?: string;
  reply_to?: string;
  jwt_token?: string;
  capability_token?: string;
  signature?: string;
}

/**
 * Base envelope structure
 */
export interface BaseEnvelope<T = unknown> {
  meta: EnvelopeMeta;
  payload: T;
}

// ============================================================================
// Task Request/Result
// ============================================================================

export interface TaskRequestPayload {
  task: string;
  inputs: Record<string, unknown>;
  context?: Record<string, unknown>;
  timeout_ms?: number;
  retry_policy?: {
    max_attempts: number;
    backoff_ms: number;
  };
}

export type TaskRequest = BaseEnvelope<TaskRequestPayload>;

export interface TaskResultPayload {
  task: string;
  status: 'success' | 'failure' | 'timeout' | 'cancelled';
  result?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  duration_ms?: number;
  metrics?: Record<string, unknown>;
}

export type TaskResult = BaseEnvelope<TaskResultPayload>;

// ============================================================================
// Memory Event
// ============================================================================

export interface MemoryEventPayload {
  event_type: 'created' | 'updated' | 'deleted' | 'snapshot';
  memory_key: string;
  value?: Record<string, unknown>;
  previous_value?: Record<string, unknown>;
  ttl_seconds?: number;
  tags?: string[];
  version?: number;
}

export type MemoryEvent = BaseEnvelope<MemoryEventPayload>;

// ============================================================================
// Context Request/Result
// ============================================================================

export interface ContextRequestPayload {
  query: {
    type: 'semantic' | 'keyword' | 'hybrid' | 'graph_traversal';
    text?: string;
    filters?: Record<string, unknown>;
    graph_params?: {
      start_node: string;
      relationship_types?: string[];
      max_depth?: number;
    };
  };
  limit?: number;
  include_embeddings?: boolean;
  include_scores?: boolean;
}

export type ContextRequest = BaseEnvelope<ContextRequestPayload>;

export interface ContextResultItem {
  id: string;
  content: Record<string, unknown>;
  score?: number;
  metadata?: Record<string, unknown>;
  embedding?: number[];
  relationships?: Array<{
    type: string;
    target_id: string;
    properties?: Record<string, unknown>;
  }>;
}

export interface ContextResultPayload {
  results: ContextResultItem[];
  total_count?: number;
  query_duration_ms?: number;
  sources?: Array<'qdrant' | 'neo4j' | 'postgres' | 'redis' | 'memory'>;
}

export type ContextResult = BaseEnvelope<ContextResultPayload>;

// ============================================================================
// Specialist Invocation Request/Result
// ============================================================================

export interface SpecialistInvocationRequestPayload {
  task: string;
  inputs: Record<string, unknown>;
  context_slice: {
    test_results?: Array<Record<string, unknown>>;
    coverage_data?: Record<string, unknown>;
    prior_fixes?: Array<Record<string, unknown>>;
    repository_context?: Record<string, unknown>;
    custom?: Record<string, unknown>;
  };
  budget: {
    max_minutes: number;
    max_tool_calls?: number;
    max_tokens?: number;
    max_cost_usd?: number;
  };
  preferences?: {
    model?: string;
    temperature?: number;
    strategy?: string;
  };
}

export type SpecialistInvocationRequest = BaseEnvelope<SpecialistInvocationRequestPayload>;

export interface SpecialistResultPayload {
  task: string;
  status: 'success' | 'failure' | 'timeout' | 'budget_exceeded' | 'cancelled';
  confidence: number;
  proposal?: Record<string, unknown>;
  rationale?: string;
  evidence?: {
    references?: Array<{
      type: 'doc' | 'code' | 'test' | 'log' | 'url';
      location: string;
      snippet?: string;
    }>;
    reasoning_steps?: string[];
    alternatives_considered?: Array<{
      option: string;
      score: number;
      reason_rejected: string;
    }>;
  };
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  metrics?: {
    duration_ms?: number;
    tool_calls?: number;
    tokens_used?: number;
    cost_usd?: number;
  };
}

export type SpecialistResult = BaseEnvelope<SpecialistResultPayload>;

// ============================================================================
// Retry Directive
// ============================================================================

export interface RetryDirectivePayload {
  original_message_id: string;
  retry_strategy: 'immediate' | 'backoff_exponential' | 'backoff_linear' | 'adjusted_params' | 'different_specialist';
  adjustments?: {
    budget?: Record<string, unknown>;
    inputs?: Record<string, unknown>;
    preferences?: Record<string, unknown>;
    target_agent?: AgentId;
  };
  reason?: string;
  max_attempts?: number;
  delay_ms?: number;
}

export type RetryDirective = BaseEnvelope<RetryDirectivePayload>;

// ============================================================================
// Decision Notice
// ============================================================================

export interface DecisionNoticePayload {
  decision: 'approve' | 'reject' | 'defer' | 'escalate';
  selected_proposal?: {
    specialist_id: AgentId;
    message_id: string;
    proposal?: Record<string, unknown>;
    confidence?: number;
  };
  scoring_summary?: {
    total_proposals?: number;
    scoring_dimensions?: Array<{
      name: string;
      weight: number;
    }>;
    proposal_scores?: Array<{
      specialist_id: string;
      message_id: string;
      score: number;
      breakdown?: Record<string, unknown>;
    }>;
  };
  rationale?: string;
  next_actions?: Array<{
    action: string;
    agent?: AgentId;
    deadline?: string;
  }>;
  rejection_reasons?: Array<{
    specialist_id: string;
    message_id: string;
    reason: string;
  }>;
}

export type DecisionNotice = BaseEnvelope<DecisionNoticePayload>;

// ============================================================================
// Union type for all envelopes
// ============================================================================

export type A2AEnvelope =
  | TaskRequest
  | TaskResult
  | MemoryEvent
  | ContextRequest
  | ContextResult
  | SpecialistInvocationRequest
  | SpecialistResult
  | RetryDirective
  | DecisionNotice;

/**
 * Type guard to check if envelope is a specific type
 */
export function isEnvelopeType<T extends A2AEnvelope>(
  envelope: A2AEnvelope,
  type: EnvelopeMeta['type']
): envelope is T {
  return envelope.meta.type === type;
}

/**
 * Extract payload type from envelope type
 */
export type PayloadOf<T extends A2AEnvelope> = T extends BaseEnvelope<infer P> ? P : never;
