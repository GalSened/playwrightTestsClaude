/**
 * CMO/ELG Service Main Entrypoint
 * Initializes and starts the orchestration service
 */

import { loadConfig, validateConfig, redactConfig } from './config.js';
import { PostgresCheckpointer } from '../elg/checkpointer/postgres.js';
import { RedisStreamsAdapter } from '../elg/transport/redis-streams.js';
import { initializeOTEL, shutdownOTEL } from '../elg/otel.js';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import pino from 'pino';

// Global state
let checkpointer: PostgresCheckpointer | null = null;
let transport: RedisStreamsAdapter | null = null;
let s3Client: S3Client | null = null;
let logger: pino.Logger | null = null;

/**
 * Initialize service
 */
async function initialize() {
  // Load and validate configuration
  const config = loadConfig();
  validateConfig(config);

  // Initialize logger with secret redaction
  logger = pino({
    level: config.logging.level,
    redact: {
      paths: [
        'config.database.password',
        'config.redis.password',
        'config.s3.accessKeySecret',
        'password',
        'secret',
        'token',
        'apiKey',
        'credentials',
        '*.password',
        '*.secret',
        '*.token',
      ],
      remove: false,
    },
    transport: config.logging.pretty
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  });

  logger.info('Starting CMO/ELG Service...');
  logger.info({ config: redactConfig(config) }, 'Configuration loaded');

  // Initialize OpenTelemetry
  if (config.otel.enabled) {
    initializeOTEL({
      serviceName: config.otel.serviceName,
      serviceVersion: '1.0.0',
      enabled: config.otel.enabled,
      otlpEndpoint: config.otel.otlpEndpoint,
      sampleRate: config.otel.sampleRate,
    });
    logger.info('OpenTelemetry initialized');
  }

  // Initialize Postgres checkpointer
  checkpointer = new PostgresCheckpointer({
    host: config.database.host,
    port: config.database.port,
    database: config.database.database,
    user: config.database.user,
    password: config.database.password,
    ssl: config.database.ssl,
    maxConnections: config.database.maxConnections,
  });

  await checkpointer.initialize();
  logger.info('Postgres checkpointer initialized');

  // Initialize Redis transport
  transport = new RedisStreamsAdapter({
    type: 'redis-streams',
    host: config.redis.host,
    port: config.redis.port,
    auth: config.redis.password
      ? { password: config.redis.password }
      : undefined,
    database: config.redis.database,
    streamPrefix: config.redis.streamName + ':',
    consumerGroupPrefix: config.redis.consumerGroup + ':',
    dlqSuffix: ':dlq',
  });

  await transport.connect();
  logger.info('Redis transport connected');

  // Initialize S3 client
  s3Client = new S3Client({
    endpoint: config.s3.endpoint,
    region: config.s3.region,
    credentials: {
      accessKeyId: config.s3.accessKeyId,
      secretAccessKey: config.s3.accessKeySecret,
    },
    forcePathStyle: config.s3.forcePathStyle,
  });

  logger.info({ endpoint: config.s3.endpoint, bucket: config.s3.bucketName }, 'S3 client initialized');

  // Health checks
  const dbHealth = await checkpointer.healthCheck();
  const transportHealth = await transport.healthCheck();

  if (!dbHealth.healthy) {
    throw new Error(`Database unhealthy: ${dbHealth.error}`);
  }

  if (!transportHealth.healthy) {
    throw new Error(`Transport unhealthy: ${transportHealth.error}`);
  }

  // S3 health check
  try {
    const startS3 = Date.now();
    const headBucketCommand = new HeadBucketCommand({
      Bucket: config.s3.bucketName,
    });
    await s3Client.send(headBucketCommand);
    const s3Latency = Date.now() - startS3;

    logger.info({ latency: s3Latency, bucket: config.s3.bucketName }, 'S3 health check passed');
  } catch (error) {
    throw new Error(`S3 unhealthy: ${(error as Error).message}`);
  }

  logger.info('Health checks passed', {
    database: { latency: dbHealth.latency },
    transport: { latency: transportHealth.latency },
  });

  logger.info('CMO/ELG Service initialized successfully');
}

/**
 * Shutdown service
 */
async function shutdown() {
  logger?.info('Shutting down CMO/ELG Service...');

  if (transport) {
    await transport.disconnect();
    logger?.info('Redis transport disconnected');
  }

  if (checkpointer) {
    await checkpointer.close();
    logger?.info('Postgres checkpointer closed');
  }

  if (logger) {
    await shutdownOTEL();
    logger.info('OpenTelemetry shutdown');
  }

  logger?.info('CMO/ELG Service shutdown complete');
}

/**
 * Main function
 */
async function main() {
  try {
    // Initialize service
    await initialize();

    // Register shutdown handlers
    process.on('SIGINT', async () => {
      logger?.info('Received SIGINT, shutting down...');
      await shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger?.info('Received SIGTERM, shutting down...');
      await shutdown();
      process.exit(0);
    });

    process.on('uncaughtException', (error) => {
      logger?.error({ error }, 'Uncaught exception');
      shutdown().then(() => process.exit(1));
    });

    process.on('unhandledRejection', (reason) => {
      logger?.error({ reason }, 'Unhandled rejection');
      shutdown().then(() => process.exit(1));
    });

    logger?.info('CMO/ELG Service is running');
    logger?.info('Press Ctrl+C to stop');

    // Keep process alive
    await new Promise(() => {});
  } catch (error) {
    console.error('Fatal error during startup:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { initialize, shutdown };
