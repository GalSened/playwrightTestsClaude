/**
 * Agent Registry Module
 * Unified API for agent registration, discovery, and health management
 */

// Re-export types
export type {
  Agent,
  AgentRegistration,
  RegistryLease,
  AgentHeartbeat,
  AgentDiscoveryQuery,
  AgentDiscoveryResult,
  AgentTopic,
  TopicSubscriptionRequest,
  RegistryHealthReport,
} from './types.js';

export { AgentStatus, AgentCapability, TopicRole, AGENT_METADATA_KEYS } from './types.js';

// Re-export Postgres implementation
export type { PostgresRegistryConfig } from './pg.js';
export { PostgresAgentRegistry } from './pg.js';

// Re-export health utilities
export type {
  LeaseExpiryConfig,
  HeartbeatPublisherConfig,
} from './health.js';
export {
  LeaseExpiryChecker,
  HeartbeatPublisher,
  startLeaseExpiryChecker,
  startHeartbeatPublisher,
} from './health.js';

import type { PostgresRegistryConfig } from './pg.js';
import { PostgresAgentRegistry } from './pg.js';
import type { LeaseExpiryConfig } from './health.js';
import { LeaseExpiryChecker } from './health.js';

/**
 * Unified Agent Registry Configuration
 */
export interface AgentRegistryConfig {
  /**
   * Postgres configuration
   */
  postgres: PostgresRegistryConfig;

  /**
   * Enable automatic lease expiry checking (default: true)
   */
  enableLeaseExpiryChecker?: boolean;

  /**
   * Lease expiry check interval in milliseconds (default: 10000)
   */
  leaseExpiryIntervalMs?: number;

  /**
   * Callback when agents are marked unavailable
   */
  onAgentsMarkedUnavailable?: (count: number) => void;
}

/**
 * Unified Agent Registry
 *
 * Combines Postgres registry with automatic lease expiry checking
 */
export class AgentRegistry {
  private pgRegistry: PostgresAgentRegistry;
  private leaseExpiryChecker?: LeaseExpiryChecker;

  constructor(private config: AgentRegistryConfig) {
    this.pgRegistry = new PostgresAgentRegistry(config.postgres);
  }

  /**
   * Initialize registry and optionally start lease expiry checker
   */
  async initialize(): Promise<void> {
    await this.pgRegistry.initialize();

    // Start lease expiry checker if enabled
    if (this.config.enableLeaseExpiryChecker !== false) {
      this.leaseExpiryChecker = new LeaseExpiryChecker({
        registry: this.pgRegistry,
        intervalMs: this.config.leaseExpiryIntervalMs,
        onAgentsMarked: this.config.onAgentsMarkedUnavailable,
      });
      this.leaseExpiryChecker.start();
    }
  }

  /**
   * Close registry and stop background tasks
   */
  async close(): Promise<void> {
    if (this.leaseExpiryChecker) {
      this.leaseExpiryChecker.stop();
    }

    await this.pgRegistry.close();
  }

  /**
   * Get the underlying Postgres registry instance
   * (for direct access to advanced features)
   */
  getPostgresRegistry(): PostgresAgentRegistry {
    return this.pgRegistry;
  }

  /**
   * Get the lease expiry checker instance (if enabled)
   */
  getLeaseExpiryChecker(): LeaseExpiryChecker | undefined {
    return this.leaseExpiryChecker;
  }

  // Delegate all registry methods to Postgres implementation

  register = this.pgRegistry.register.bind(this.pgRegistry);
  heartbeat = this.pgRegistry.heartbeat.bind(this.pgRegistry);
  discover = this.pgRegistry.discover.bind(this.pgRegistry);
  markUnavailable = this.pgRegistry.markUnavailable.bind(this.pgRegistry);
  getAgent = this.pgRegistry.getAgent.bind(this.pgRegistry);
  subscribeTopic = this.pgRegistry.subscribeTopic.bind(this.pgRegistry);
  unsubscribeTopic = this.pgRegistry.unsubscribeTopic.bind(this.pgRegistry);
  getAgentTopics = this.pgRegistry.getAgentTopics.bind(this.pgRegistry);
  getTopicSubscribers = this.pgRegistry.getTopicSubscribers.bind(this.pgRegistry);
  markExpiredAgents = this.pgRegistry.markExpiredAgents.bind(this.pgRegistry);
  cleanupInactiveAgents = this.pgRegistry.cleanupInactiveAgents.bind(this.pgRegistry);
  getHealthReport = this.pgRegistry.getHealthReport.bind(this.pgRegistry);
  healthCheck = this.pgRegistry.healthCheck.bind(this.pgRegistry);
}

/**
 * Create and initialize an agent registry
 *
 * @param config - Registry configuration
 * @returns Initialized AgentRegistry instance
 */
export async function createAgentRegistry(
  config: AgentRegistryConfig
): Promise<AgentRegistry> {
  const registry = new AgentRegistry(config);
  await registry.initialize();
  return registry;
}
