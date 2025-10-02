/**
 * Agent Registry Health Checks & Lease Management
 * Provides utilities for lease expiration monitoring and heartbeat publishing
 */

import type { PostgresAgentRegistry } from './pg.js';
import type { AgentHeartbeat, AgentStatus } from './types.js';
import type { TransportAdapter } from '../../elg/transport/index.js';
import type { PublishOptions } from '../topics/routing.js';
import { createAndPublish } from '../topics/routing.js';
import { TopicBuilders } from '../topics/naming.js';
import type { AgentId } from '../envelopes/types.js';

/**
 * Lease expiry checker configuration
 */
export interface LeaseExpiryConfig {
  /**
   * Registry instance to check
   */
  registry: PostgresAgentRegistry;

  /**
   * Check interval in milliseconds (default: 10000 = 10 seconds)
   */
  intervalMs?: number;

  /**
   * Callback when agents are marked unavailable
   */
  onAgentsMarked?: (count: number) => void;
}

/**
 * Lease expiry checker
 *
 * Runs a periodic background task to mark expired agents as UNAVAILABLE
 */
export class LeaseExpiryChecker {
  private intervalHandle?: NodeJS.Timeout;
  private running: boolean = false;

  constructor(private config: LeaseExpiryConfig) {}

  /**
   * Start the lease expiry checker
   */
  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    const intervalMs = this.config.intervalMs || 10000;

    // Run immediately
    this.checkAndMarkExpired();

    // Then run periodically
    this.intervalHandle = setInterval(() => {
      this.checkAndMarkExpired();
    }, intervalMs);
  }

  /**
   * Stop the lease expiry checker
   */
  stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;

    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = undefined;
    }
  }

  /**
   * Check and mark expired agents (can be called manually)
   */
  async checkAndMarkExpired(): Promise<number> {
    try {
      const count = await this.config.registry.markExpiredAgents();

      if (count > 0 && this.config.onAgentsMarked) {
        this.config.onAgentsMarked(count);
      }

      return count;
    } catch (error) {
      console.error('Error checking lease expiry:', error);
      return 0;
    }
  }

  /**
   * Check if the checker is running
   */
  isRunning(): boolean {
    return this.running;
  }
}

/**
 * Heartbeat publisher configuration
 */
export interface HeartbeatPublisherConfig {
  /**
   * Agent ID
   */
  agentId: AgentId;

  /**
   * Registry instance
   */
  registry: PostgresAgentRegistry;

  /**
   * Transport adapter for publishing heartbeats
   */
  transport: TransportAdapter;

  /**
   * Tenant identifier
   */
  tenant: string;

  /**
   * Project identifier
   */
  project: string;

  /**
   * Heartbeat interval in milliseconds (default: 20000 = 20 seconds)
   * Should be 1/3 of lease duration (60s lease → 20s heartbeat)
   */
  intervalMs?: number;

  /**
   * Initial agent status (default: STARTING)
   */
  initialStatus?: AgentStatus;

  /**
   * Lease duration in seconds (default: 60)
   */
  leaseDurationSeconds?: number;

  /**
   * Custom metadata to include in heartbeats
   */
  metadata?: Record<string, unknown>;

  /**
   * Callback when heartbeat fails
   */
  onHeartbeatError?: (error: Error) => void;
}

/**
 * Heartbeat publisher
 *
 * Automatically publishes heartbeats to the registry at regular intervals
 */
export class HeartbeatPublisher {
  private intervalHandle?: NodeJS.Timeout;
  private running: boolean = false;
  private currentStatus: AgentStatus;

  constructor(private config: HeartbeatPublisherConfig) {
    this.currentStatus = config.initialStatus || 'STARTING';
  }

  /**
   * Start publishing heartbeats
   */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    const intervalMs = this.config.intervalMs || 20000;

    // Send initial heartbeat
    await this.sendHeartbeat();

    // Then send periodically
    this.intervalHandle = setInterval(() => {
      this.sendHeartbeat();
    }, intervalMs);
  }

  /**
   * Stop publishing heartbeats
   */
  stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;

    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = undefined;
    }
  }

  /**
   * Update agent status
   *
   * @param status - New status (will be included in next heartbeat)
   */
  setStatus(status: AgentStatus): void {
    this.currentStatus = status;
  }

  /**
   * Get current status
   */
  getStatus(): AgentStatus {
    return this.currentStatus;
  }

  /**
   * Send a heartbeat immediately (in addition to periodic heartbeats)
   */
  async sendHeartbeat(): Promise<void> {
    try {
      const heartbeat: AgentHeartbeat = {
        agent_id: this.config.agentId.id,
        status: this.currentStatus,
        metadata: this.config.metadata,
      };

      // Update registry
      await this.config.registry.heartbeat(
        heartbeat,
        this.config.leaseDurationSeconds || 60
      );

      // Publish heartbeat event to topic (optional, for observability)
      await this.publishHeartbeatEvent(heartbeat);
    } catch (error) {
      if (this.config.onHeartbeatError) {
        this.config.onHeartbeatError(error as Error);
      } else {
        console.error('Heartbeat failed:', error);
      }
    }
  }

  /**
   * Check if the publisher is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Publish heartbeat event to registry topic
   */
  private async publishHeartbeatEvent(heartbeat: AgentHeartbeat): Promise<void> {
    // Build heartbeat topic: qa.<tenant>.<project>.registry.heartbeats
    const topic = TopicBuilders.registryHeartbeats(
      this.config.tenant,
      this.config.project
    );

    const publishOptions: PublishOptions = {
      transport: this.config.transport,
      validate: true,
    };

    // Publish heartbeat event
    await createAndPublish(
      {
        a2a_version: '1.0',
        from: this.config.agentId,
        to: [{ type: 'topic', name: topic }],
        tenant: this.config.tenant,
        project: this.config.project,
        type: 'MemoryEvent',
        trace_id: `heartbeat-${this.config.agentId.id}-${Date.now()}`,
      },
      {
        event_type: 'updated',
        memory_key: `agent:${this.config.agentId.id}:heartbeat`,
        value: {
          agent_id: heartbeat.agent_id,
          status: heartbeat.status,
          timestamp: new Date().toISOString(),
        },
      },
      publishOptions
    );
  }
}

/**
 * Helper: Create and start a lease expiry checker
 *
 * @param registry - Registry instance
 * @param options - Optional configuration
 * @returns Started LeaseExpiryChecker instance
 */
export function startLeaseExpiryChecker(
  registry: PostgresAgentRegistry,
  options?: {
    intervalMs?: number;
    onAgentsMarked?: (count: number) => void;
  }
): LeaseExpiryChecker {
  const checker = new LeaseExpiryChecker({
    registry,
    intervalMs: options?.intervalMs,
    onAgentsMarked: options?.onAgentsMarked,
  });

  checker.start();
  return checker;
}

/**
 * Helper: Create and start a heartbeat publisher
 *
 * @param config - Heartbeat publisher configuration
 * @returns Started HeartbeatPublisher instance
 */
export async function startHeartbeatPublisher(
  config: HeartbeatPublisherConfig
): Promise<HeartbeatPublisher> {
  const publisher = new HeartbeatPublisher(config);
  await publisher.start();
  return publisher;
}
