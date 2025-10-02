/**
 * Agent Registry Types
 * Type definitions for agent registration, discovery, and health management
 */

/**
 * Agent status enum
 */
export enum AgentStatus {
  /**
   * Agent is starting up and initializing
   */
  STARTING = 'STARTING',

  /**
   * Agent is healthy and operational
   */
  HEALTHY = 'HEALTHY',

  /**
   * Agent is degraded but still operational
   */
  DEGRADED = 'DEGRADED',

  /**
   * Agent is unavailable (lease expired or failed health check)
   */
  UNAVAILABLE = 'UNAVAILABLE',
}

/**
 * Well-known agent capabilities
 */
export enum AgentCapability {
  // Context capabilities
  CONTEXT_READ = 'context.read',
  CONTEXT_WRITE = 'context.write',

  // Healing capabilities
  HEALING_SELECTOR = 'healing.selector',
  HEALING_ASSERTION = 'healing.assertion',
  HEALING_ACTION = 'healing.action',

  // Analysis capabilities
  ANALYSIS_TEST_RESULTS = 'analysis.test_results',
  ANALYSIS_COVERAGE = 'analysis.coverage',
  ANALYSIS_PERFORMANCE = 'analysis.performance',

  // Memory capabilities
  MEMORY_READ = 'memory.read',
  MEMORY_WRITE = 'memory.write',

  // Artifact capabilities
  ARTIFACT_READ = 'artifact.read',
  ARTIFACT_WRITE = 'artifact.write',

  // Decision capabilities
  DECISION_APPROVE = 'decision.approve',
  DECISION_REJECT = 'decision.reject',

  // Repository capabilities
  REPO_READ = 'repo.read',
  REPO_WRITE = 'repo.write',

  // CI capabilities
  CI_TRIGGER = 'ci.trigger',
  CI_STATUS = 'ci.status',
}

/**
 * Agent record (database representation)
 */
export interface Agent {
  /**
   * Unique agent identifier
   */
  agent_id: string;

  /**
   * Agent version (semver)
   */
  version: string;

  /**
   * Tenant identifier
   */
  tenant: string;

  /**
   * Project identifier
   */
  project: string;

  /**
   * Agent capabilities (for discovery)
   */
  capabilities: string[];

  /**
   * Current agent status
   */
  status: AgentStatus;

  /**
   * Last heartbeat timestamp
   */
  last_heartbeat: Date;

  /**
   * Lease expiration time
   */
  lease_until: Date;

  /**
   * Optional metadata (JSON)
   */
  metadata?: Record<string, unknown>;

  /**
   * Created timestamp
   */
  created_at: Date;

  /**
   * Updated timestamp
   */
  updated_at: Date;
}

/**
 * Agent registration request
 */
export interface AgentRegistration {
  /**
   * Agent identifier
   */
  agent_id: string;

  /**
   * Agent version
   */
  version: string;

  /**
   * Tenant identifier
   */
  tenant: string;

  /**
   * Project identifier
   */
  project: string;

  /**
   * Agent capabilities
   */
  capabilities: string[];

  /**
   * Initial status (default: STARTING)
   */
  initial_status?: AgentStatus;

  /**
   * Lease duration in seconds (default: 60)
   */
  lease_duration_seconds?: number;

  /**
   * Optional metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Registry lease (returned on registration/heartbeat)
 */
export interface RegistryLease {
  /**
   * Agent identifier
   */
  agent_id: string;

  /**
   * Lease expiration time
   */
  lease_until: Date;

  /**
   * Lease duration in seconds
   */
  lease_duration_seconds: number;

  /**
   * Renewal token (optional, for future use)
   */
  renewal_token?: string;
}

/**
 * Agent heartbeat request
 */
export interface AgentHeartbeat {
  /**
   * Agent identifier
   */
  agent_id: string;

  /**
   * Current agent status
   */
  status: AgentStatus;

  /**
   * Optional metadata update
   */
  metadata?: Record<string, unknown>;
}

/**
 * Agent discovery query
 */
export interface AgentDiscoveryQuery {
  /**
   * Tenant identifier
   */
  tenant: string;

  /**
   * Project identifier
   */
  project: string;

  /**
   * Required capability (optional)
   */
  capability?: string;

  /**
   * Required status (optional, default: HEALTHY or DEGRADED)
   */
  status?: AgentStatus[];

  /**
   * Maximum number of results (optional)
   */
  limit?: number;
}

/**
 * Agent discovery result
 */
export interface AgentDiscoveryResult {
  /**
   * Agent identifier
   */
  agent_id: string;

  /**
   * Agent version
   */
  version: string;

  /**
   * Agent capabilities
   */
  capabilities: string[];

  /**
   * Current agent status
   */
  status: AgentStatus;

  /**
   * Last heartbeat timestamp
   */
  last_heartbeat: Date;

  /**
   * Lease expiration time
   */
  lease_until: Date;

  /**
   * Optional metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Topic subscription role
 */
export enum TopicRole {
  PUBLISHER = 'publisher',
  SUBSCRIBER = 'subscriber',
  BOTH = 'both',
}

/**
 * Agent topic subscription
 */
export interface AgentTopic {
  /**
   * Subscription ID
   */
  id: number;

  /**
   * Agent identifier
   */
  agent_id: string;

  /**
   * Topic name
   */
  topic: string;

  /**
   * Role (publisher, subscriber, or both)
   */
  role: TopicRole;

  /**
   * Created timestamp
   */
  created_at: Date;
}

/**
 * Topic subscription request
 */
export interface TopicSubscriptionRequest {
  /**
   * Agent identifier
   */
  agent_id: string;

  /**
   * Topic name
   */
  topic: string;

  /**
   * Role (publisher, subscriber, or both)
   */
  role: TopicRole;
}

/**
 * Registry health report
 */
export interface RegistryHealthReport {
  /**
   * Total number of agents
   */
  total_agents: number;

  /**
   * Number of healthy agents
   */
  healthy_agents: number;

  /**
   * Number of degraded agents
   */
  degraded_agents: number;

  /**
   * Number of unavailable agents
   */
  unavailable_agents: number;

  /**
   * Number of agents with expired leases
   */
  expired_leases: number;

  /**
   * Timestamp of this report
   */
  timestamp: Date;
}

/**
 * Agent metadata keys (well-known)
 */
export const AGENT_METADATA_KEYS = {
  /**
   * Agent instance hostname
   */
  HOSTNAME: 'hostname',

  /**
   * Agent instance IP address
   */
  IP_ADDRESS: 'ip_address',

  /**
   * Agent instance PID
   */
  PID: 'pid',

  /**
   * Agent startup time
   */
  STARTUP_TIME: 'startup_time',

  /**
   * Agent resource usage (CPU, memory, etc.)
   */
  RESOURCE_USAGE: 'resource_usage',

  /**
   * Agent configuration hash
   */
  CONFIG_HASH: 'config_hash',
};
