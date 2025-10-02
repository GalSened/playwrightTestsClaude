/**
 * A2A Transport Module
 * Transport adapters for A2A messaging
 */

// Re-export Redis A2A transport
export type {
  RedisA2ATransportConfig,
  A2AMessageHandler,
  A2ASubscribeOptions,
} from './redis-streams.js';
export { RedisA2ATransport, createRedisA2ATransport } from './redis-streams.js';

// Re-export NATS A2A transport (stub)
export type { NatsJetStreamConfig } from './nats-jetstream.js';
export { NatsA2ATransport, createNatsA2ATransport } from './nats-jetstream.js';
