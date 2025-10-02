/**
 * OPA Wire Gates Middleware
 * Policy-based enforcement for A2A envelope publishing and receiving
 *
 * @see https://www.openpolicyagent.org/
 */

import type { A2AEnvelope } from '../envelopes/types.js';

/**
 * OPA client configuration
 */
export interface OPAConfig {
  /**
   * OPA server URL (e.g., 'http://localhost:8181')
   */
  url: string;

  /**
   * Pre-send policy path (e.g., 'a2a/wire_gates/pre_send')
   */
  preSendPolicyPath?: string;

  /**
   * Post-receive policy path (e.g., 'a2a/wire_gates/post_receive')
   */
  postReceivePolicyPath?: string;

  /**
   * Request timeout in milliseconds (default: 5000)
   */
  timeout?: number;

  /**
   * Additional headers for OPA requests
   */
  headers?: Record<string, string>;

  /**
   * Disable OPA checks (for testing/dev)
   */
  disabled?: boolean;
}

/**
 * OPA policy result
 */
export interface OPAPolicyResult {
  /**
   * Whether policy allows the operation
   */
  allow: boolean;

  /**
   * Reason for denial (if allow=false)
   */
  reason?: string;

  /**
   * Detailed violations (if any)
   */
  violations?: Array<{
    code: string;
    message: string;
    severity: 'error' | 'warning';
  }>;

  /**
   * Additional metadata from policy
   */
  metadata?: Record<string, unknown>;
}

/**
 * OPA Wire Gates Middleware
 *
 * Enforces policies on A2A envelopes before publishing and after receiving
 */
export class OPAWireGates {
  private config: OPAConfig;

  constructor(config: OPAConfig) {
    this.config = {
      preSendPolicyPath: 'a2a/wire_gates/pre_send',
      postReceivePolicyPath: 'a2a/wire_gates/post_receive',
      timeout: 5000,
      disabled: false,
      ...config,
    };
  }

  /**
   * Check policy before publishing an envelope
   *
   * @param envelope - Envelope to check
   * @param context - Additional context for policy evaluation
   * @returns Policy result
   */
  async checkPreSend(
    envelope: A2AEnvelope,
    context?: Record<string, unknown>
  ): Promise<OPAPolicyResult> {
    if (this.config.disabled) {
      return { allow: true };
    }

    const input = {
      envelope: this.envelopeToOPAInput(envelope),
      operation: 'publish',
      context: context || {},
    };

    return this.queryOPA(this.config.preSendPolicyPath!, input);
  }

  /**
   * Check policy after receiving an envelope
   *
   * @param envelope - Envelope to check
   * @param context - Additional context for policy evaluation
   * @returns Policy result
   */
  async checkPostReceive(
    envelope: A2AEnvelope,
    context?: Record<string, unknown>
  ): Promise<OPAPolicyResult> {
    if (this.config.disabled) {
      return { allow: true };
    }

    const input = {
      envelope: this.envelopeToOPAInput(envelope),
      operation: 'receive',
      context: context || {},
    };

    return this.queryOPA(this.config.postReceivePolicyPath!, input);
  }

  /**
   * Check policy or throw error
   *
   * @param envelope - Envelope to check
   * @param operation - Operation type ('publish' or 'receive')
   * @param context - Additional context
   * @throws Error if policy denies operation
   */
  async checkOrThrow(
    envelope: A2AEnvelope,
    operation: 'publish' | 'receive',
    context?: Record<string, unknown>
  ): Promise<void> {
    const result =
      operation === 'publish'
        ? await this.checkPreSend(envelope, context)
        : await this.checkPostReceive(envelope, context);

    if (!result.allow) {
      throw new OPAPolicyViolationError(result);
    }
  }

  /**
   * Query OPA server
   */
  private async queryOPA(policyPath: string, input: any): Promise<OPAPolicyResult> {
    const url = `${this.config.url}/v1/data/${policyPath}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers,
        },
        body: JSON.stringify({ input }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`OPA query failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // OPA returns result in data.result
      if (data.result === undefined) {
        throw new Error('OPA returned no result');
      }

      // If result is boolean, convert to policy result
      if (typeof data.result === 'boolean') {
        return {
          allow: data.result,
          reason: data.result ? undefined : 'Policy denied operation',
        };
      }

      // If result is object, extract fields
      return {
        allow: data.result.allow ?? false,
        reason: data.result.reason,
        violations: data.result.violations,
        metadata: data.result.metadata,
      };
    } catch (error) {
      // On OPA errors, fail open or closed based on configuration
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`OPA policy check timeout after ${this.config.timeout}ms`);
      }

      throw new Error(
        `OPA policy check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Convert envelope to OPA input format
   */
  private envelopeToOPAInput(envelope: A2AEnvelope): any {
    return {
      meta: {
        a2a_version: envelope.meta.a2a_version,
        message_id: envelope.meta.message_id,
        trace_id: envelope.meta.trace_id,
        ts: envelope.meta.ts,
        from: {
          type: envelope.meta.from.type,
          id: envelope.meta.from.id,
          version: envelope.meta.from.version,
        },
        to: envelope.meta.to.map((recipient) => {
          if ('name' in recipient) {
            return { type: 'topic', name: recipient.name };
          }
          return {
            type: recipient.type,
            id: recipient.id,
            version: recipient.version,
          };
        }),
        type: envelope.meta.type,
        tenant: envelope.meta.tenant,
        project: envelope.meta.project,
        priority: envelope.meta.priority,
        deadline: envelope.meta.deadline,
      },
      // Payload is intentionally excluded for security (policies should not need payload content)
      // If needed, policies can request specific fields via context
    };
  }
}

/**
 * OPA Policy Violation Error
 */
export class OPAPolicyViolationError extends Error {
  public readonly result: OPAPolicyResult;

  constructor(result: OPAPolicyResult) {
    super(result.reason || 'OPA policy violation');
    this.name = 'OPAPolicyViolationError';
    this.result = result;
  }
}

/**
 * Create OPA wire gates middleware
 *
 * @param config - OPA configuration
 * @returns OPA wire gates instance
 */
export function createOPAWireGates(config: OPAConfig): OPAWireGates {
  return new OPAWireGates(config);
}

/**
 * Example OPA policy (Rego):
 *
 * ```rego
 * package a2a.wire_gates
 *
 * # Pre-send policy
 * default pre_send = false
 *
 * pre_send = {
 *   "allow": true
 * } {
 *   # Allow if sender is in the same tenant/project as recipient
 *   input.envelope.meta.from.id != ""
 *   input.envelope.meta.tenant != ""
 *   input.envelope.meta.project != ""
 *
 *   # Deny cross-tenant messages unless authorized
 *   sender_tenant := input.envelope.meta.tenant
 *   recipient_tenant := input.envelope.meta.to[_].tenant
 *   sender_tenant == recipient_tenant
 * }
 *
 * pre_send = {
 *   "allow": false,
 *   "reason": "Cross-tenant messages not allowed",
 *   "violations": [{
 *     "code": "CROSS_TENANT_DENIED",
 *     "message": "Sender and recipient must be in same tenant",
 *     "severity": "error"
 *   }]
 * } {
 *   not pre_send.allow
 * }
 *
 * # Post-receive policy
 * default post_receive = false
 *
 * post_receive = {
 *   "allow": true
 * } {
 *   # Allow if envelope is valid and recent
 *   input.envelope.meta.message_id != ""
 *   input.envelope.meta.trace_id != ""
 *
 *   # Check timestamp is within 5 minutes
 *   now := time.now_ns()
 *   envelope_ts := time.parse_rfc3339_ns(input.envelope.meta.ts)
 *   age_seconds := (now - envelope_ts) / 1000000000
 *   age_seconds <= 300
 * }
 *
 * post_receive = {
 *   "allow": false,
 *   "reason": "Envelope timestamp is stale",
 *   "violations": [{
 *     "code": "STALE_ENVELOPE",
 *     "message": "Envelope is older than 5 minutes",
 *     "severity": "error"
 *   }]
 * } {
 *   not post_receive.allow
 * }
 * ```
 */
