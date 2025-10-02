/**
 * Configuration Module
 * Loads and validates environment variables
 */

import { config as dotenvConfig } from 'dotenv';
import { existsSync } from 'fs';

// Load .env file if it exists
if (existsSync('.env')) {
  dotenvConfig();
}

/**
 * Application configuration
 */
export interface Config {
  /**
   * Node environment
   */
  nodeEnv: string;

  /**
   * Service port
   */
  port: number;

  /**
   * Database configuration
   */
  database: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl: boolean;
    maxConnections: number;
  };

  /**
   * Redis configuration (for transport)
   */
  redis: {
    host: string;
    port: number;
    password?: string;
    database: number;
    streamName: string;
    consumerGroup: string;
    consumerName: string;
    dlqStream: string;
  };

  /**
   * S3 configuration (for artifacts)
   */
  s3: {
    endpoint: string;
    region: string;
    accessKeyId: string;
    accessKeySecret: string;
    bucketName: string;
    forcePathStyle: boolean;
  };

  /**
   * OpenTelemetry configuration
   */
  otel: {
    enabled: boolean;
    serviceName: string;
    otlpEndpoint: string;
    sampleRate: number;
  };

  /**
   * OPA configuration
   */
  opa: {
    enabled: boolean;
    policyPath: string;
  };

  /**
   * Logging configuration
   */
  logging: {
    level: string;
    pretty: boolean;
  };

  /**
   * Runtime configuration
   */
  runtime: {
    maxStepDurationMs: number;
    checkpointInterval: number;
    activityTimeoutMs: number;
    maxRetries: number;
  };
}

/**
 * Load configuration from environment variables
 */
export function loadConfig(): Config {
  return {
    nodeEnv: getEnv('NODE_ENV', 'development'),
    port: getEnvNumber('PORT', 8083),

    database: {
      host: getEnv('POSTGRES_HOST', 'localhost'),
      port: getEnvNumber('POSTGRES_PORT', 5432),
      database: getEnv('POSTGRES_DB', 'playwright_enterprise'),
      user: getEnv('POSTGRES_USER', 'admin'),
      password: getEnv('POSTGRES_PASSWORD', 'secure123'),
      ssl: getEnvBoolean('POSTGRES_SSL', false),
      maxConnections: getEnvNumber('POSTGRES_MAX_CONNECTIONS', 20),
    },

    redis: {
      host: getEnv('REDIS_HOST', 'localhost'),
      port: getEnvNumber('REDIS_PORT', 6379),
      password: getEnvOptional('REDIS_PASSWORD'),
      database: getEnvNumber('REDIS_DB', 0),
      streamName: getEnv('REDIS_STREAM_NAME', 'cmo:a2a'),
      consumerGroup: getEnv('REDIS_CONSUMER_GROUP', 'cmo-workers'),
      consumerName: getEnv('REDIS_CONSUMER_NAME', `cmo-worker-${process.pid}`),
      dlqStream: getEnv('REDIS_DLQ_STREAM', 'cmo:a2a:dlq'),
    },

    s3: {
      endpoint: getEnv('S3_ENDPOINT', 'http://localhost:9000'),
      region: getEnv('S3_REGION', 'us-east-1'),
      accessKeyId: getEnv('S3_ACCESS_KEY_ID', 'minioadmin'),
      accessKeySecret: getEnv('S3_ACCESS_KEY_SECRET', 'minioadmin123'),
      bucketName: getEnv('S3_BUCKET_NAME', 'cmo-artifacts'),
      forcePathStyle: getEnvBoolean('S3_FORCE_PATH_STYLE', true),
    },

    otel: {
      enabled: getEnvBoolean('OTEL_ENABLED', true),
      serviceName: getEnv('OTEL_SERVICE_NAME', 'cmo-elg'),
      otlpEndpoint: getEnv('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://localhost:4318'),
      sampleRate: getEnvNumber('OTEL_TRACE_SAMPLE_RATE', 1.0),
    },

    opa: {
      enabled: getEnvBoolean('OPA_ENABLED', false),
      policyPath: getEnv('OPA_POLICY_PATH', './policies/default.wasm'),
    },

    logging: {
      level: getEnv('LOG_LEVEL', 'info'),
      pretty: getEnvBoolean('LOG_PRETTY', true),
    },

    runtime: {
      maxStepDurationMs: getEnvNumber('ELG_MAX_STEP_DURATION_MS', 30000),
      checkpointInterval: getEnvNumber('ELG_CHECKPOINT_INTERVAL', 1),
      activityTimeoutMs: getEnvNumber('ELG_ACTIVITY_TIMEOUT_MS', 60000),
      maxRetries: getEnvNumber('ELG_MAX_RETRIES', 3),
    },
  };
}

/**
 * Validate configuration
 */
export function validateConfig(config: Config): void {
  const errors: string[] = [];

  // Validate database
  if (!config.database.host) {
    errors.push('POSTGRES_HOST is required');
  }
  if (!config.database.user) {
    errors.push('POSTGRES_USER is required');
  }
  if (!config.database.password) {
    errors.push('POSTGRES_PASSWORD is required');
  }

  // Validate Redis
  if (!config.redis.host) {
    errors.push('REDIS_HOST is required');
  }

  // Validate S3
  if (!config.s3.accessKeyId) {
    errors.push('S3_ACCESS_KEY_ID is required');
  }
  if (!config.s3.accessKeySecret) {
    errors.push('S3_ACCESS_KEY_SECRET is required');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

/**
 * Redact sensitive values from config (for logging)
 */
export function redactConfig(config: Config): Record<string, unknown> {
  return {
    ...config,
    database: {
      ...config.database,
      password: '***REDACTED***',
    },
    redis: {
      ...config.redis,
      password: config.redis.password ? '***REDACTED***' : undefined,
    },
    s3: {
      ...config.s3,
      accessKeyId: '***REDACTED***',
      accessKeySecret: '***REDACTED***',
    },
  };
}

// Helper functions

function getEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

function getEnvOptional(key: string): string | undefined {
  return process.env[key];
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) {
    return defaultValue;
  }
  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    throw new Error(`Invalid number for ${key}: ${value}`);
  }
  return parsed;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) {
    return defaultValue;
  }
  return value.toLowerCase() === 'true' || value === '1';
}
