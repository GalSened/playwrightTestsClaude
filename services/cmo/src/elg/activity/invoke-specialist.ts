/**
 * InvokeSpecialist Activity
 * ELG activity for invoking specialist agents via A2A messaging
 */

import type { ActivityClient } from '../activity.js';
import type {
  SpecialistInvocationRequest,
  SpecialistResult,
  AgentId,
} from '../../a2a/envelopes/types.js';
import { generateMessageId } from '../../a2a/security/signer.js';
import { TopicBuilders } from '../../a2a/topics/naming.js';
import type { TransportAdapter } from '../transport/index.js';
import type { A2AEnvelope } from '../../a2a/envelopes/types.js';
import { RequestResponseHandler } from '../../a2a/topics/routing.js';

/**
 * InvokeSpecialist request
 */
export interface InvokeSpecialistRequest {
  /**
   * Specialist agent to invoke
   */
  specialist: AgentId;

  /**
   * Task to perform
   */
  task: string;

  /**
   * Task inputs
   */
  inputs: Record<string, unknown>;

  /**
   * Context slice (test results, coverage, prior fixes, etc.)
   */
  contextSlice?: {
    test_results?: unknown;
    coverage_data?: unknown;
    prior_fixes?: unknown;
    repository_context?: unknown;
  };

  /**
   * Budget constraints
   */
  budget?: {
    max_minutes?: number;
    max_tool_calls?: number;
    max_tokens?: number;
    max_cost_usd?: number;
  };

  /**
   * Preferences
   */
  preferences?: Record<string, unknown>;

  /**
   * Timeout in milliseconds (default: 300000 = 5 minutes)
   */
  timeout?: number;
}

/**
 * InvokeSpecialist result
 */
export interface InvokeSpecialistResult {
  /**
   * Task identifier
   */
  task: string;

  /**
   * Execution status
   */
  status: 'success' | 'failure' | 'timeout' | 'cancelled';

  /**
   * Confidence score (0-1)
   */
  confidence?: number;

  /**
   * Specialist's proposal
   */
  proposal?: unknown;

  /**
   * Rationale
   */
  rationale?: string;

  /**
   * Evidence
   */
  evidence?: {
    references?: string[];
    reasoning_steps?: string[];
    alternatives_considered?: unknown[];
  };

  /**
   * Error (if failed)
   */
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };

  /**
   * Performance metrics
   */
  metrics?: {
    latency_ms: number;
    tokens_used: number;
    api_calls: number;
    cost_usd: number;
  };
}

/**
 * InvokeSpecialist activity configuration
 */
export interface InvokeSpecialistConfig {
  /**
   * Transport adapter for A2A messaging
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
}

/**
 * InvokeSpecialist Activity
 *
 * Invokes a specialist agent via A2A messaging and waits for result
 */
export class InvokeSpecialistActivity {
  private config: InvokeSpecialistConfig;
  private requestResponseHandler: RequestResponseHandler;

  constructor(config: InvokeSpecialistConfig) {
    this.config = config;

    this.requestResponseHandler = new RequestResponseHandler(
      config.transport,
      config.cmoAgentId.id,
      config.tenant,
      config.project
    );
  }

  /**
   * Invoke specialist via ActivityClient
   *
   * @param activityClient - Activity client (for record/replay)
   * @param request - Invocation request
   * @returns Invocation result
   */
  async invoke(
    activityClient: ActivityClient,
    request: InvokeSpecialistRequest
  ): Promise<InvokeSpecialistResult> {
    // Build SpecialistInvocationRequest envelope
    const envelope: A2AEnvelope = {
      meta: {
        a2a_version: '1.0',
        message_id: generateMessageId(),
        trace_id: this.config.traceId,
        ts: await activityClient.now(),
        from: this.config.cmoAgentId,
        to: [request.specialist],
        tenant: this.config.tenant,
        project: this.config.project,
        type: 'SpecialistInvocationRequest',
        correlation_id: generateMessageId(),
      },
      payload: {
        task: request.task,
        inputs: request.inputs,
        context_slice: request.contextSlice,
        budget: request.budget,
        preferences: request.preferences,
      } as SpecialistInvocationRequest['payload'],
    };

    // Send via A2A (recorded by ActivityClient)
    const responseEnvelope = (await activityClient.sendA2A(
      envelope
    )) as A2AEnvelope;

    // Parse result
    return this.parseSpecialistResult(responseEnvelope);
  }

  /**
   * Invoke specialist directly (without ActivityClient)
   *
   * For use outside ELG runtime (e.g., manual testing)
   *
   * @param request - Invocation request
   * @returns Invocation result
   */
  async invokeDirect(
    request: InvokeSpecialistRequest
  ): Promise<InvokeSpecialistResult> {
    // Build topic: qa.<tenant>.<project>.specialists.<specialist_id>.invoke
    const topic = TopicBuilders.specialistInvoke(
      this.config.tenant,
      this.config.project,
      request.specialist.id
    );

    // Build envelope
    const envelope: A2AEnvelope = {
      meta: {
        a2a_version: '1.0',
        message_id: generateMessageId(),
        trace_id: this.config.traceId,
        ts: new Date().toISOString(),
        from: this.config.cmoAgentId,
        to: [request.specialist],
        tenant: this.config.tenant,
        project: this.config.project,
        type: 'SpecialistInvocationRequest',
        correlation_id: generateMessageId(),
      },
      payload: {
        task: request.task,
        inputs: request.inputs,
        context_slice: request.contextSlice,
        budget: request.budget,
        preferences: request.preferences,
      } as SpecialistInvocationRequest['payload'],
    };

    // Send request and wait for response
    try {
      const responseEnvelope = await this.requestResponseHandler.sendRequest(
        envelope,
        { transport: this.config.transport, validate: true },
        request.timeout || 300000
      );

      return this.parseSpecialistResult(responseEnvelope);
    } catch (error) {
      return {
        task: request.task,
        status: 'failure',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'INVOCATION_FAILED',
        },
      };
    }
  }

  /**
   * Parse specialist result envelope
   */
  private parseSpecialistResult(envelope: A2AEnvelope): InvokeSpecialistResult {
    // Validate envelope type
    if (envelope.meta.type !== 'SpecialistResult') {
      return {
        task: 'unknown',
        status: 'failure',
        error: {
          message: `Expected SpecialistResult, got ${envelope.meta.type}`,
          code: 'INVALID_RESPONSE_TYPE',
        },
      };
    }

    const payload = envelope.payload as SpecialistResult['payload'];

    return {
      task: payload.task,
      status: payload.status,
      confidence: payload.confidence,
      proposal: payload.proposal,
      rationale: payload.rationale,
      evidence: payload.evidence,
      error: payload.error,
      metrics: payload.metrics,
    };
  }

  /**
   * Cancel all pending requests
   */
  cancelAll(): void {
    this.requestResponseHandler.cancelAll();
  }
}

/**
 * Create InvokeSpecialist activity
 *
 * @param config - Activity configuration
 * @returns InvokeSpecialist activity instance
 */
export function createInvokeSpecialistActivity(
  config: InvokeSpecialistConfig
): InvokeSpecialistActivity {
  return new InvokeSpecialistActivity(config);
}
