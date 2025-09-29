/**
 * Enterprise Configuration Management
 * Handles environment variables, database connections, and service configuration
 * for production-grade SaaS deployment
 */

import { z } from 'zod';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

// Configuration validation schema
const EnterpriseConfigSchema = z.object({
  // Environment
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  
  // Supabase Configuration
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_KEY: z.string().min(1),
  DATABASE_URL: z.string().url(),
  
  // Storage Configuration
  SUPABASE_STORAGE_BUCKET: z.string().default('test-artifacts'),
  ARTIFACTS_CDN_URL: z.string().url(),
  MAX_ARTIFACT_SIZE_MB: z.coerce.number().default(100),
  
  // Security
  JWT_SECRET: z.string().min(32),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  ENABLE_HTTPS_ONLY: z.coerce.boolean().default(false),
  
  // Multi-tenancy
  DEFAULT_TENANT_ID: z.string().default('default'),
  ENABLE_MULTI_TENANT: z.coerce.boolean().default(true),
  MAX_TENANTS_PER_INSTANCE: z.coerce.number().default(1000),
  
  // Performance & Scaling
  MAX_POOL_SIZE: z.coerce.number().default(20),
  CONNECTION_TIMEOUT: z.coerce.number().default(30000),
  QUERY_TIMEOUT: z.coerce.number().default(60000),
  ENABLE_READ_REPLICAS: z.coerce.boolean().default(false),
  
  // Background Jobs
  REDIS_URL: z.string().default('redis://localhost:6379'),
  ENABLE_BACKGROUND_JOBS: z.coerce.boolean().default(true),
  MAX_CONCURRENT_JOBS: z.coerce.number().default(10),
  JOB_QUEUE_PREFIX: z.string().default('playwright-enterprise'),
  
  // Monitoring & Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  SENTRY_DSN: z.string().optional(),
  ENABLE_METRICS: z.coerce.boolean().default(true),
  METRICS_PORT: z.coerce.number().default(9090),
  
  // Data Lifecycle
  DATA_RETENTION_DAYS: z.coerce.number().default(365),
  AUTO_ARCHIVE_ENABLED: z.coerce.boolean().default(true),
  ARCHIVE_AFTER_DAYS: z.coerce.number().default(90),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(1000),
  
  // Feature Flags
  ENABLE_REAL_TIME_UPDATES: z.coerce.boolean().default(true),
  ENABLE_ADVANCED_ANALYTICS: z.coerce.boolean().default(true),
  ENABLE_WEBHOOK_NOTIFICATIONS: z.coerce.boolean().default(true),
});

// Validated configuration type
export type EnterpriseConfig = z.infer<typeof EnterpriseConfigSchema>;

// Configuration instance
let configInstance: EnterpriseConfig | null = null;

/**
 * Load and validate enterprise configuration
 */
export function loadEnterpriseConfig(): EnterpriseConfig {
  if (configInstance) {
    return configInstance;
  }

  try {
    // Parse and validate environment variables
    configInstance = EnterpriseConfigSchema.parse(process.env);
    
    // Additional validation for production
    if (configInstance.NODE_ENV === 'production') {
      validateProductionConfig(configInstance);
    }
    
    return configInstance;
  } catch (error) {
    console.error('❌ Configuration validation failed:', error);
    process.exit(1);
  }
}

/**
 * Validate production-specific requirements
 */
function validateProductionConfig(config: EnterpriseConfig): void {
  const issues: string[] = [];
  
  // Security validations
  if (!config.SUPABASE_SERVICE_KEY.startsWith('eyJ')) {
    issues.push('SUPABASE_SERVICE_KEY must be a valid JWT token');
  }
  
  if (config.JWT_SECRET.length < 32) {
    issues.push('JWT_SECRET must be at least 32 characters');
  }
  
  if (config.CORS_ORIGIN === 'http://localhost:5173') {
    issues.push('CORS_ORIGIN must be set to production domain');
  }
  
  // Performance validations
  if (config.MAX_POOL_SIZE < 10) {
    issues.push('MAX_POOL_SIZE should be at least 10 for production');
  }
  
  // Monitoring validations
  if (!config.SENTRY_DSN && config.NODE_ENV === 'production') {
    console.warn('⚠️  SENTRY_DSN not configured - error tracking disabled');
  }
  
  if (issues.length > 0) {
    console.error('❌ Production configuration issues:');
    issues.forEach(issue => console.error(`   - ${issue}`));
    process.exit(1);
  }
}

/**
 * Get database connection configuration
 */
export function getDatabaseConfig(config: EnterpriseConfig) {
  return {
    connectionString: config.DATABASE_URL,
    ssl: config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: config.MAX_POOL_SIZE,
    connectionTimeoutMillis: config.CONNECTION_TIMEOUT,
    query_timeout: config.QUERY_TIMEOUT,
    statement_timeout: config.QUERY_TIMEOUT,
  };
}

/**
 * Get storage configuration
 */
export function getStorageConfig(config: EnterpriseConfig) {
  return {
    supabaseUrl: config.SUPABASE_URL,
    supabaseKey: config.SUPABASE_SERVICE_KEY,
    bucketName: config.SUPABASE_STORAGE_BUCKET,
    cdnUrl: config.ARTIFACTS_CDN_URL,
    maxFileSizeMB: config.MAX_ARTIFACT_SIZE_MB,
  };
}

/**
 * Get Redis configuration for background jobs
 */
export function getRedisConfig(config: EnterpriseConfig) {
  return {
    url: config.REDIS_URL,
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    enableReadyCheck: true,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  };
}

/**
 * Get monitoring configuration
 */
export function getMonitoringConfig(config: EnterpriseConfig) {
  return {
    logLevel: config.LOG_LEVEL,
    enableMetrics: config.ENABLE_METRICS,
    metricsPort: config.METRICS_PORT,
    sentryDsn: config.SENTRY_DSN,
  };
}

/**
 * Feature flags configuration
 */
export function getFeatureFlags(config: EnterpriseConfig) {
  return {
    realTimeUpdates: config.ENABLE_REAL_TIME_UPDATES,
    advancedAnalytics: config.ENABLE_ADVANCED_ANALYTICS,
    webhookNotifications: config.ENABLE_WEBHOOK_NOTIFICATIONS,
    multiTenant: config.ENABLE_MULTI_TENANT,
    backgroundJobs: config.ENABLE_BACKGROUND_JOBS,
    readReplicas: config.ENABLE_READ_REPLICAS,
    autoArchive: config.AUTO_ARCHIVE_ENABLED,
  };
}

/**
 * Tenant configuration
 */
export function getTenantConfig(config: EnterpriseConfig) {
  return {
    defaultTenantId: config.DEFAULT_TENANT_ID,
    multiTenantEnabled: config.ENABLE_MULTI_TENANT,
    maxTenantsPerInstance: config.MAX_TENANTS_PER_INSTANCE,
  };
}

// Export singleton instance
export const enterpriseConfig = loadEnterpriseConfig();