/**
 * DecisionNotice Publisher
 * Helper for publishing CMO decisions via A2A messaging
 */

import type { DecisionNotice, AgentId } from '../envelopes/types.js';
import type { TransportAdapter } from '../../elg/transport/index.js';
import { TopicBuilders } from '../topics/naming.js';
import { createAndPublish, type PublishResult } from '../topics/routing.js';
import { generateMessageId } from '../security/signer.js';

/**
 * Decision data
 */
export interface Decision {
  /**
   * Decision outcome
   */
  decision: 'approve' | 'reject' | 'defer' | 'escalate';

  /**
   * Selected proposal (if approved)
   */
  selectedProposal?: unknown;

  /**
   * Scoring summary
   */
  scoringSummary?: {
    criteria?: Record<string, number>;
    weights?: Record<string, number>;
    total_score?: number;
  };

  /**
   * Rationale
   */
  rationale: string;

  /**
   * Next actions
   */
  nextActions?: Array<{
    action: string;
    assigned_to?: string;
    deadline?: string;
  }>;

  /**
   * Rejection reasons (if rejected)
   */
  rejectionReasons?: Array<{
    code: string;
    message: string;
    severity: 'error' | 'warning' | 'info';
  }>;
}

/**
 * DecisionNotice publisher configuration
 */
export interface DecisionNoticeConfig {
  /**
   * Transport adapter for publishing
   */
  transport: TransportAdapter;

  /**
   * CMO agent ID (sender)
   */
  cmoAgentId: AgentId;

  /**
   * Tenant identifier
   */
  tenant: string;

  /**
   * Project identifier
   */
  project: string;

  /**
   * Trace ID
   */
  traceId: string;

  /**
   * OPA signing config (optional)
   */
  signing?: {
    secretKey: string;
    algorithm?: 'sha256' | 'sha512';
  };
}

/**
 * DecisionNotice Publisher
 *
 * Publishes CMO decisions to the decisions topic
 */
export class DecisionNoticePublisher {
  private config: DecisionNoticeConfig;

  constructor(config: DecisionNoticeConfig) {
    this.config = config;
  }

  /**
   * Publish a decision notice
   *
   * @param decision - Decision data
   * @param options - Additional options
   * @returns Publish result
   */
  async publish(
    decision: Decision,
    options?: {
      /**
       * Correlation ID (links to original request)
       */
      correlationId?: string;

      /**
       * Reply-to topic (for acknowledgments)
       */
      replyTo?: string;

      /**
       * Priority
       */
      priority?: 'low' | 'normal' | 'high';

      /**
       * Deadline
       */
      deadline?: string;
    }
  ): Promise<PublishResult> {
    // Build CMO decisions topic: qa.<tenant>.<project>.cmo.decisions
    const topic = TopicBuilders.cmoDecisions(this.config.tenant, this.config.project);

    // Build DecisionNotice payload
    const payload: DecisionNotice['payload'] = {
      decision: decision.decision,
      selected_proposal: decision.selectedProposal,
      scoring_summary: decision.scoringSummary,
      rationale: decision.rationale,
      next_actions: decision.nextActions,
      rejection_reasons: decision.rejectionReasons,
    };

    // Publish to topic
    return createAndPublish(
      {
        a2a_version: '1.0',
        trace_id: this.config.traceId,
        from: this.config.cmoAgentId,
        to: [{ type: 'topic', name: topic }],
        tenant: this.config.tenant,
        project: this.config.project,
        type: 'DecisionNotice',
        correlation_id: options?.correlationId,
        reply_to: options?.replyTo,
        priority: options?.priority,
        deadline: options?.deadline,
      },
      payload,
      {
        transport: this.config.transport,
        validate: true,
        signing: this.config.signing,
      }
    );
  }

  /**
   * Publish an approval decision
   *
   * @param proposal - Approved proposal
   * @param rationale - Approval rationale
   * @param options - Additional options
   * @returns Publish result
   */
  async approve(
    proposal: unknown,
    rationale: string,
    options?: {
      scoringSummary?: Decision['scoringSummary'];
      nextActions?: Decision['nextActions'];
      correlationId?: string;
      replyTo?: string;
    }
  ): Promise<PublishResult> {
    return this.publish({
      decision: 'approve',
      selectedProposal: proposal,
      rationale,
      scoringSummary: options?.scoringSummary,
      nextActions: options?.nextActions,
    }, {
      correlationId: options?.correlationId,
      replyTo: options?.replyTo,
      priority: 'normal',
    });
  }

  /**
   * Publish a rejection decision
   *
   * @param rationale - Rejection rationale
   * @param reasons - Rejection reasons
   * @param options - Additional options
   * @returns Publish result
   */
  async reject(
    rationale: string,
    reasons: Decision['rejectionReasons'],
    options?: {
      nextActions?: Decision['nextActions'];
      correlationId?: string;
      replyTo?: string;
    }
  ): Promise<PublishResult> {
    return this.publish({
      decision: 'reject',
      rationale,
      rejectionReasons: reasons,
      nextActions: options?.nextActions,
    }, {
      correlationId: options?.correlationId,
      replyTo: options?.replyTo,
      priority: 'normal',
    });
  }

  /**
   * Publish a defer decision
   *
   * @param rationale - Deferral rationale
   * @param options - Additional options
   * @returns Publish result
   */
  async defer(
    rationale: string,
    options?: {
      nextActions?: Decision['nextActions'];
      correlationId?: string;
      replyTo?: string;
      deadline?: string;
    }
  ): Promise<PublishResult> {
    return this.publish({
      decision: 'defer',
      rationale,
      nextActions: options?.nextActions,
    }, {
      correlationId: options?.correlationId,
      replyTo: options?.replyTo,
      deadline: options?.deadline,
      priority: 'low',
    });
  }

  /**
   * Publish an escalation decision
   *
   * @param rationale - Escalation rationale
   * @param options - Additional options
   * @returns Publish result
   */
  async escalate(
    rationale: string,
    options?: {
      nextActions?: Decision['nextActions'];
      correlationId?: string;
      replyTo?: string;
    }
  ): Promise<PublishResult> {
    return this.publish({
      decision: 'escalate',
      rationale,
      nextActions: options?.nextActions,
    }, {
      correlationId: options?.correlationId,
      replyTo: options?.replyTo,
      priority: 'high',
    });
  }
}

/**
 * Create a DecisionNotice publisher
 *
 * @param config - Publisher configuration
 * @returns DecisionNotice publisher instance
 */
export function createDecisionNoticePublisher(
  config: DecisionNoticeConfig
): DecisionNoticePublisher {
  return new DecisionNoticePublisher(config);
}

/**
 * Example usage:
 *
 * ```typescript
 * const publisher = createDecisionNoticePublisher({
 *   transport: redisTransport,
 *   cmoAgentId: { type: 'cmo', id: 'cmo-main', version: '1.0.0' },
 *   tenant: 'wesign',
 *   project: 'frontend',
 *   traceId: 'trace-123',
 * });
 *
 * // Publish approval
 * await publisher.approve(
 *   { fix: 'Update selector to use data-testid' },
 *   'Proposal has high confidence and passes all criteria',
 *   {
 *     scoringSummary: { criteria: { confidence: 0.95, feasibility: 0.9 }, total_score: 0.925 },
 *     nextActions: [
 *       { action: 'apply_fix', assigned_to: 'ci-gate', deadline: '2024-01-15T10:00:00Z' }
 *     ],
 *     correlationId: 'req-456',
 *   }
 * );
 *
 * // Publish rejection
 * await publisher.reject(
 *   'Proposal does not meet minimum confidence threshold',
 *   [
 *     { code: 'LOW_CONFIDENCE', message: 'Confidence score 0.45 < 0.7', severity: 'error' },
 *     { code: 'MISSING_EVIDENCE', message: 'No test coverage data', severity: 'warning' }
 *   ],
 *   {
 *     nextActions: [
 *       { action: 'request_retry', assigned_to: 'playwright_healer' }
 *     ],
 *     correlationId: 'req-456',
 *   }
 * );
 *
 * // Publish defer
 * await publisher.defer(
 *   'Awaiting additional context from repository analysis',
 *   {
 *     nextActions: [
 *       { action: 'fetch_context', assigned_to: 'context_agent', deadline: '2024-01-15T09:00:00Z' }
 *     ],
 *     deadline: '2024-01-15T10:00:00Z',
 *   }
 * );
 *
 * // Publish escalation
 * await publisher.escalate(
 *   'Decision requires human review due to high impact',
 *   {
 *     nextActions: [
 *       { action: 'human_review', assigned_to: 'oncall_engineer' }
 *     ],
 *   }
 * );
 * ```
 */
