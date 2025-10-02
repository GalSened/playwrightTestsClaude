/**
 * A2A (Agent-to-Agent) Messaging Core
 *
 * This module provides the complete A2A messaging infrastructure including:
 * - Envelope schemas & validation
 * - Security (JWT, capability tokens, signing)
 * - Topic-based routing
 * - Agent registry
 * - Transport adapters
 * - Middleware (OPA gates, idempotency)
 *
 * @module a2a
 */

// Envelopes & Validation
export * from './envelopes/index.js';
export * from './envelopes/types.js';

// Security
export * from './security/jwt.js';
export * from './security/captoken.js';
export * from './security/signer.js';

// Topics & Routing
export * from './topics/naming.js';
export * from './topics/routing.js';

// Agent Registry
export * from './registry/index.js';
export * from './registry/types.js';
export * from './registry/health.js';

// Transport
export * from './transport/redis-streams.js';
export * from './transport/nats-jetstream.js';

// Middleware
export * from './middleware/opa-wire-gates.js';
export * from './middleware/idempotency.js';

// Handlers & Publishers
export * from './handlers/inbound.js';
export * from './publishers/decision-notice.js';
