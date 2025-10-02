/**
 * OPA Test Helpers
 * Mock OPA server and test utilities for policy enforcement
 */

import type { A2AEnvelope } from '../../src/a2a/envelopes/types.js';

/**
 * OPA policy result
 */
export interface OPAPolicyResult {
  allow: boolean;
  reason?: string;
  violations?: string[];
}

/**
 * Mock OPA server for testing
 */
export class MockOPAServer {
  private policies: Map<string, (input: any) => OPAPolicyResult> = new Map();
  private callLog: Array<{ policyPath: string; input: any; result: OPAPolicyResult }> = [];

  /**
   * Register a policy handler
   */
  registerPolicy(policyPath: string, handler: (input: any) => OPAPolicyResult): void {
    this.policies.set(policyPath, handler);
  }

  /**
   * Evaluate a policy
   */
  evaluate(policyPath: string, input: any): OPAPolicyResult {
    const handler = this.policies.get(policyPath);

    if (!handler) {
      // Default: allow everything if no policy is registered
      const result: OPAPolicyResult = { allow: true };
      this.callLog.push({ policyPath, input, result });
      return result;
    }

    const result = handler(input);
    this.callLog.push({ policyPath, input, result });
    return result;
  }

  /**
   * Get call log
   */
  getCallLog(): Array<{ policyPath: string; input: any; result: OPAPolicyResult }> {
    return [...this.callLog];
  }

  /**
   * Clear call log
   */
  clearCallLog(): void {
    this.callLog = [];
  }

  /**
   * Get call count for a specific policy
   */
  getCallCount(policyPath: string): number {
    return this.callLog.filter((call) => call.policyPath === policyPath).length;
  }

  /**
   * Reset all policies and call log
   */
  reset(): void {
    this.policies.clear();
    this.callLog = [];
  }
}

/**
 * Create a mock OPA server instance
 */
export function createMockOPAServer(): MockOPAServer {
  return new MockOPAServer();
}

/**
 * Create an always-allow policy
 */
export function createAlwaysAllowPolicy(): (input: any) => OPAPolicyResult {
  return () => ({ allow: true });
}

/**
 * Create an always-deny policy
 */
export function createAlwaysDenyPolicy(reason: string = 'Policy denied'): (input: any) => OPAPolicyResult {
  return () => ({ allow: false, reason, violations: ['denied-by-policy'] });
}

/**
 * Create a tenant-based policy (only allow specific tenant)
 */
export function createTenantPolicy(allowedTenant: string): (input: any) => OPAPolicyResult {
  return (input: any) => {
    const tenant = input.envelope?.meta?.tenant;
    if (tenant === allowedTenant) {
      return { allow: true };
    }
    return {
      allow: false,
      reason: `Tenant '${tenant}' not allowed`,
      violations: [`tenant-mismatch:expected=${allowedTenant},got=${tenant}`],
    };
  };
}

/**
 * Create a project-based policy (only allow specific project)
 */
export function createProjectPolicy(allowedProject: string): (input: any) => OPAPolicyResult {
  return (input: any) => {
    const project = input.envelope?.meta?.project;
    if (project === allowedProject) {
      return { allow: true };
    }
    return {
      allow: false,
      reason: `Project '${project}' not allowed`,
      violations: [`project-mismatch:expected=${allowedProject},got=${project}`],
    };
  };
}

/**
 * Create a message-type policy (only allow specific message types)
 */
export function createMessageTypePolicy(allowedTypes: string[]): (input: any) => OPAPolicyResult {
  return (input: any) => {
    const messageType = input.envelope?.meta?.type;
    if (allowedTypes.includes(messageType)) {
      return { allow: true };
    }
    return {
      allow: false,
      reason: `Message type '${messageType}' not allowed`,
      violations: [`type-mismatch:allowed=${allowedTypes.join(',')},got=${messageType}`],
    };
  };
}

/**
 * Create a priority-based policy (block low-priority messages)
 */
export function createPriorityPolicy(minPriority: 'low' | 'normal' | 'high'): (input: any) => OPAPolicyResult {
  const priorityOrder: Record<string, number> = { low: 0, normal: 1, high: 2 };

  return (input: any) => {
    const priority = input.envelope?.meta?.priority || 'normal';
    const minOrder = priorityOrder[minPriority];
    const currentOrder = priorityOrder[priority];

    if (currentOrder >= minOrder) {
      return { allow: true };
    }

    return {
      allow: false,
      reason: `Priority '${priority}' below minimum '${minPriority}'`,
      violations: [`priority-too-low:min=${minPriority},got=${priority}`],
    };
  };
}

/**
 * Create a composite policy (AND logic)
 */
export function createCompositeAndPolicy(
  policies: Array<(input: any) => OPAPolicyResult>
): (input: any) => OPAPolicyResult {
  return (input: any) => {
    const violations: string[] = [];
    const reasons: string[] = [];

    for (const policy of policies) {
      const result = policy(input);
      if (!result.allow) {
        if (result.violations) violations.push(...result.violations);
        if (result.reason) reasons.push(result.reason);
      }
    }

    if (violations.length > 0) {
      return {
        allow: false,
        reason: reasons.join('; '),
        violations,
      };
    }

    return { allow: true };
  };
}

/**
 * Create a composite policy (OR logic)
 */
export function createCompositeOrPolicy(
  policies: Array<(input: any) => OPAPolicyResult>
): (input: any) => OPAPolicyResult {
  return (input: any) => {
    for (const policy of policies) {
      const result = policy(input);
      if (result.allow) {
        return { allow: true };
      }
    }

    return {
      allow: false,
      reason: 'No policy allowed this request',
      violations: ['all-policies-denied'],
    };
  };
}

/**
 * Create a conditional policy (if-then-else)
 */
export function createConditionalPolicy(
  condition: (input: any) => boolean,
  thenPolicy: (input: any) => OPAPolicyResult,
  elsePolicy: (input: any) => OPAPolicyResult
): (input: any) => OPAPolicyResult {
  return (input: any) => {
    if (condition(input)) {
      return thenPolicy(input);
    }
    return elsePolicy(input);
  };
}

/**
 * Simulate OPA outage (return error)
 */
export function createOPAOutagePolicy(): (input: any) => OPAPolicyResult {
  return () => {
    throw new Error('OPA server unavailable');
  };
}

/**
 * Create a spy policy that records inputs and delegates to another policy
 */
export function createSpyPolicy(
  delegate: (input: any) => OPAPolicyResult,
  onCall?: (input: any, result: OPAPolicyResult) => void
): (input: any) => OPAPolicyResult {
  return (input: any) => {
    const result = delegate(input);
    if (onCall) onCall(input, result);
    return result;
  };
}

/**
 * Setup mock OPA server for tests
 */
export function setupMockOPA(): { server: MockOPAServer; cleanup: () => void } {
  const server = createMockOPAServer();

  const cleanup = () => {
    server.reset();
  };

  return { server, cleanup };
}
