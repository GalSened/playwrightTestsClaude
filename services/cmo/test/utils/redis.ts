/**
 * Redis Test Helpers
 * Utilities for setting up and tearing down Redis streams in tests
 */

import type { RedisClientType } from 'redis';
import { createClient } from 'redis';

/**
 * Redis test configuration
 */
export interface RedisTestConfig {
  host?: string;
  port?: number;
  db?: number;
  password?: string;
  keyPrefix?: string;
}

/**
 * Default test Redis config (override with env vars)
 */
export const DEFAULT_REDIS_TEST_CONFIG: RedisTestConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  db: parseInt(process.env.REDIS_TEST_DB || '15', 10), // Use DB 15 for tests
  keyPrefix: 'test:a2a:',
};

/**
 * Create a Redis client for testing
 */
export async function createTestRedisClient(config: RedisTestConfig = {}): Promise<RedisClientType> {
  const finalConfig = { ...DEFAULT_REDIS_TEST_CONFIG, ...config };

  const client = createClient({
    socket: {
      host: finalConfig.host,
      port: finalConfig.port,
    },
    password: finalConfig.password,
    database: finalConfig.db,
  }) as RedisClientType;

  await client.connect();
  return client;
}

/**
 * Cleanup all test keys with prefix
 */
export async function cleanupTestKeys(client: RedisClientType, keyPrefix: string = 'test:a2a:'): Promise<number> {
  const keys = await client.keys(`${keyPrefix}*`);
  if (keys.length === 0) return 0;

  await client.del(keys);
  return keys.length;
}

/**
 * Create a test stream
 */
export async function createTestStream(
  client: RedisClientType,
  streamKey: string,
  messageCount: number = 0
): Promise<void> {
  // Create stream by adding initial messages if needed
  for (let i = 0; i < messageCount; i++) {
    await client.xAdd(streamKey, '*', {
      test: 'true',
      index: i.toString(),
      payload: JSON.stringify({ message: `test-message-${i}` }),
    });
  }
}

/**
 * Create a consumer group
 */
export async function createTestConsumerGroup(
  client: RedisClientType,
  streamKey: string,
  groupName: string,
  startId: string = '0'
): Promise<void> {
  try {
    await client.xGroupCreate(streamKey, groupName, startId, { MKSTREAM: true });
  } catch (error: any) {
    // Ignore "BUSYGROUP Consumer Group name already exists" error
    if (!error.message.includes('BUSYGROUP')) {
      throw error;
    }
  }
}

/**
 * Get stream length
 */
export async function getStreamLength(client: RedisClientType, streamKey: string): Promise<number> {
  return await client.xLen(streamKey);
}

/**
 * Get pending messages count
 */
export async function getPendingCount(
  client: RedisClientType,
  streamKey: string,
  groupName: string
): Promise<number> {
  const pending = await client.xPending(streamKey, groupName);
  return pending ? (pending.pending || 0) : 0;
}

/**
 * Delete a stream
 */
export async function deleteStream(client: RedisClientType, streamKey: string): Promise<void> {
  await client.del(streamKey);
}

/**
 * Delete a consumer group
 */
export async function deleteConsumerGroup(
  client: RedisClientType,
  streamKey: string,
  groupName: string
): Promise<void> {
  try {
    await client.xGroupDestroy(streamKey, groupName);
  } catch (error: any) {
    // Ignore "NOGROUP No such consumer group" error
    if (!error.message.includes('NOGROUP')) {
      throw error;
    }
  }
}

/**
 * Publish a test message to a stream
 */
export async function publishTestMessage(
  client: RedisClientType,
  streamKey: string,
  payload: Record<string, any>
): Promise<string> {
  const fields = {
    payload: JSON.stringify(payload),
    ts: new Date().toISOString(),
  };

  return await client.xAdd(streamKey, '*', fields);
}

/**
 * Read messages from a stream (no consumer group)
 */
export async function readMessages(
  client: RedisClientType,
  streamKey: string,
  count: number = 10,
  startId: string = '0'
): Promise<any[]> {
  const messages = await client.xRange(streamKey, startId, '+', { COUNT: count });
  return messages.map((msg) => ({
    id: msg.id,
    payload: JSON.parse(msg.message.payload as string),
  }));
}

/**
 * Simulate Redis outage (disconnect and optionally reconnect)
 */
export async function simulateRedisOutage(
  client: RedisClientType,
  durationMs: number
): Promise<void> {
  await client.disconnect();
  await new Promise((resolve) => setTimeout(resolve, durationMs));
  await client.connect();
}

/**
 * Wait for stream to have N messages
 */
export async function waitForStreamLength(
  client: RedisClientType,
  streamKey: string,
  expectedLength: number,
  timeoutMs: number = 5000
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const length = await getStreamLength(client, streamKey);
    if (length >= expectedLength) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return false;
}

/**
 * Flush test database
 */
export async function flushTestDB(client: RedisClientType): Promise<void> {
  await client.flushDb();
}

/**
 * Setup and teardown helper for tests
 */
export function setupRedisTests(config: RedisTestConfig = {}): {
  getClient: () => RedisClientType | null;
  cleanup: () => Promise<void>;
} {
  let client: RedisClientType | null = null;

  const setup = async () => {
    client = await createTestRedisClient(config);
    await flushTestDB(client);
  };

  const cleanup = async () => {
    if (client) {
      await cleanupTestKeys(client, config.keyPrefix || 'test:a2a:');
      await client.disconnect();
      client = null;
    }
  };

  return {
    getClient: () => client,
    cleanup,
  };
}
