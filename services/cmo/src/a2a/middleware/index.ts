/**
 * A2A Middleware Module
 * Policy enforcement and idempotency guards for A2A messaging
 */

// Re-export OPA wire gates
export type { OPAConfig, OPAPolicyResult } from './opa-wire-gates.js';
export {
  OPAWireGates,
  OPAPolicyViolationError,
  createOPAWireGates,
} from './opa-wire-gates.js';

// Re-export idempotency
export type {
  IdempotencyConfig,
  IdempotencyCheckResult,
} from './idempotency.js';
export {
  IdempotencyGuard,
  IdempotencyViolationError,
  IdempotencyMiddleware,
  createIdempotencyGuard,
  createIdempotencyMiddleware,
} from './idempotency.js';
