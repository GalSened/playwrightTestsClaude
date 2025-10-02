/**
 * OPA Policy Enforcement Module
 * Loads and enforces Open Policy Agent WASM policies
 */

import { loadPolicy, type PolicyFunction } from '@open-policy-agent/opa-wasm';
import { readFileSync } from 'fs';
import pino from 'pino';

/**
 * Policy decision
 */
export interface PolicyDecision {
  allowed: boolean;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Policy evaluation context
 */
export interface PolicyContext {
  /**
   * Execution phase: pre-execution or post-execution
   */
  phase: 'pre' | 'post';

  /**
   * Graph being executed
   */
  graph: {
    id: string;
    version: string;
  };

  /**
   * Current execution state
   */
  execution: {
    traceId: string;
    stepIndex: number;
    nodeId: string;
  };

  /**
   * Input data (pre) or result (post)
   */
  data: unknown;

  /**
   * Additional context
   */
  [key: string]: unknown;
}

/**
 * Policy evaluator
 */
export class PolicyEvaluator {
  private policy: PolicyFunction | null = null;
  private logger: pino.Logger;
  private policyPath: string;
  private enabled: boolean;

  constructor(options: { policyPath: string; enabled?: boolean; logger?: pino.Logger }) {
    this.policyPath = options.policyPath;
    this.enabled = options.enabled ?? true;
    this.logger = options.logger || pino({ name: 'policy-evaluator' });
  }

  /**
   * Load OPA WASM policy
   */
  async initialize(): Promise<void> {
    if (!this.enabled) {
      this.logger.info('Policy enforcement disabled');
      return;
    }

    try {
      const policyWasm = readFileSync(this.policyPath);
      this.policy = await loadPolicy(policyWasm);
      this.logger.info({ path: this.policyPath }, 'OPA policy loaded');
    } catch (error) {
      this.logger.error({ path: this.policyPath, error }, 'Failed to load OPA policy');
      throw new Error(`Failed to load OPA policy: ${(error as Error).message}`);
    }
  }

  /**
   * Evaluate policy decision
   */
  async evaluate(context: PolicyContext): Promise<PolicyDecision> {
    if (!this.enabled || !this.policy) {
      // Policy disabled, always allow
      return { allowed: true };
    }

    try {
      // Set policy data
      this.policy.setData(context);

      // Evaluate policy (entrypoint is usually "allow" or "decision")
      const result = this.policy.evaluate({});

      // OPA returns array of results
      const decision = result[0];

      if (typeof decision === 'boolean') {
        return {
          allowed: decision,
          reason: decision ? undefined : 'Policy denied',
        };
      }

      // Structured decision
      return {
        allowed: decision?.allowed ?? false,
        reason: decision?.reason,
        metadata: decision?.metadata,
      };
    } catch (error) {
      this.logger.error({ context, error }, 'Policy evaluation failed');
      // Fail closed: deny on error
      return {
        allowed: false,
        reason: `Policy evaluation error: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Evaluate or throw on deny
   */
  async evaluateOrThrow(context: PolicyContext): Promise<void> {
    const decision = await this.evaluate(context);

    if (!decision.allowed) {
      throw new Error(`Policy denied: ${decision.reason || 'No reason provided'}`);
    }
  }

  /**
   * Pre-execution gate
   */
  async checkPreExecution(
    graphId: string,
    graphVersion: string,
    traceId: string,
    stepIndex: number,
    nodeId: string,
    input: unknown
  ): Promise<PolicyDecision> {
    return this.evaluate({
      phase: 'pre',
      graph: { id: graphId, version: graphVersion },
      execution: { traceId, stepIndex, nodeId },
      data: input,
    });
  }

  /**
   * Post-execution gate
   */
  async checkPostExecution(
    graphId: string,
    graphVersion: string,
    traceId: string,
    stepIndex: number,
    nodeId: string,
    result: unknown
  ): Promise<PolicyDecision> {
    return this.evaluate({
      phase: 'post',
      graph: { id: graphId, version: graphVersion },
      execution: { traceId, stepIndex, nodeId },
      data: result,
    });
  }

  /**
   * Check if policy is enabled
   */
  isEnabled(): boolean {
    return this.enabled && this.policy !== null;
  }
}

/**
 * Global policy evaluator instance (lazy-initialized)
 */
let globalEvaluator: PolicyEvaluator | null = null;

/**
 * Get or create global policy evaluator
 */
export async function getGlobalPolicyEvaluator(
  policyPath: string,
  enabled: boolean = true
): Promise<PolicyEvaluator> {
  if (!globalEvaluator) {
    globalEvaluator = new PolicyEvaluator({ policyPath, enabled });
    await globalEvaluator.initialize();
  }
  return globalEvaluator;
}

/**
 * Convenience function: evaluate policy
 */
export async function evaluatePolicy(
  context: PolicyContext,
  policyPath: string
): Promise<PolicyDecision> {
  const evaluator = await getGlobalPolicyEvaluator(policyPath);
  return evaluator.evaluate(context);
}
