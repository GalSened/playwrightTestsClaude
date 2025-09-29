/**
 * Enterprise Metrics and Monitoring
 * Comprehensive application metrics, performance monitoring, and alerting
 */

import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';
import { Request, Response, NextFunction } from 'express';
import { enterpriseConfig } from '../config/enterprise';
import { logger } from '../utils/logger';

// Initialize default metrics collection
collectDefaultMetrics({ register });

// =============================================================================
// APPLICATION METRICS
// =============================================================================

// HTTP Request Metrics
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'tenant_id'],
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code', 'tenant_id'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
  registers: [register],
});

// Database Metrics
export const databaseQueries = new Counter({
  name: 'database_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'table', 'tenant_id', 'status'],
  registers: [register],
});

export const databaseQueryDuration = new Histogram({
  name: 'database_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['operation', 'table', 'tenant_id'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const databaseConnections = new Gauge({
  name: 'database_connections_active',
  help: 'Number of active database connections',
  labelNames: ['pool_type'],
  registers: [register],
});

// Test Execution Metrics
export const testRunsTotal = new Counter({
  name: 'test_runs_total',
  help: 'Total number of test runs',
  labelNames: ['tenant_id', 'status', 'environment', 'browser'],
  registers: [register],
});

export const testRunDuration = new Histogram({
  name: 'test_run_duration_seconds',
  help: 'Test run duration in seconds',
  labelNames: ['tenant_id', 'environment', 'browser'],
  buckets: [10, 30, 60, 120, 300, 600, 1200, 1800, 3600],
  registers: [register],
});

export const testStepsTotal = new Counter({
  name: 'test_steps_total',
  help: 'Total number of test steps',
  labelNames: ['tenant_id', 'action_type', 'status'],
  registers: [register],
});

// Storage and Artifacts Metrics
export const artifactsUploaded = new Counter({
  name: 'artifacts_uploaded_total',
  help: 'Total number of artifacts uploaded',
  labelNames: ['tenant_id', 'artifact_type', 'status'],
  registers: [register],
});

export const artifactStorageBytes = new Gauge({
  name: 'artifact_storage_bytes',
  help: 'Total storage used by artifacts in bytes',
  labelNames: ['tenant_id', 'artifact_type'],
  registers: [register],
});

export const artifactProcessingDuration = new Histogram({
  name: 'artifact_processing_duration_seconds',
  help: 'Time taken to process artifacts',
  labelNames: ['tenant_id', 'artifact_type', 'operation'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

// Background Job Metrics
export const backgroundJobsTotal = new Counter({
  name: 'background_jobs_total',
  help: 'Total number of background jobs processed',
  labelNames: ['queue_name', 'job_type', 'status'],
  registers: [register],
});

export const backgroundJobDuration = new Histogram({
  name: 'background_job_duration_seconds',
  help: 'Background job processing time',
  labelNames: ['queue_name', 'job_type'],
  buckets: [1, 5, 10, 30, 60, 300, 600, 1800],
  registers: [register],
});

export const backgroundJobsActive = new Gauge({
  name: 'background_jobs_active',
  help: 'Number of active background jobs',
  labelNames: ['queue_name'],
  registers: [register],
});

// Multi-tenancy Metrics
export const tenantsActive = new Gauge({
  name: 'tenants_active_total',
  help: 'Total number of active tenants',
  registers: [register],
});

export const tenantUsage = new Gauge({
  name: 'tenant_usage_current',
  help: 'Current resource usage by tenant',
  labelNames: ['tenant_id', 'resource_type', 'plan'],
  registers: [register],
});

// Real-time Metrics
export const websocketConnections = new Gauge({
  name: 'websocket_connections_active',
  help: 'Number of active WebSocket connections',
  labelNames: ['tenant_id'],
  registers: [register],
});

export const realtimeEvents = new Counter({
  name: 'realtime_events_total',
  help: 'Total number of real-time events sent',
  labelNames: ['tenant_id', 'event_type'],
  registers: [register],
});

// =============================================================================
// BUSINESS METRICS
// =============================================================================

export const testPassRate = new Gauge({
  name: 'test_pass_rate_percentage',
  help: 'Test pass rate percentage by tenant',
  labelNames: ['tenant_id', 'environment', 'time_period'],
  registers: [register],
});

export const meanTimeToDetection = new Histogram({
  name: 'mean_time_to_detection_seconds',
  help: 'Mean time to detect test failures',
  labelNames: ['tenant_id', 'test_name'],
  buckets: [300, 600, 1800, 3600, 7200, 14400, 28800],
  registers: [register],
});

export const testFlakiness = new Gauge({
  name: 'test_flakiness_percentage',
  help: 'Test flakiness percentage',
  labelNames: ['tenant_id', 'test_name'],
  registers: [register],
});

// =============================================================================
// MIDDLEWARE
// =============================================================================

/**
 * Express middleware to collect HTTP metrics
 */
export function metricsMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const tenantId = req.headers['x-tenant-id'] as string || 'unknown';

    // Continue to next middleware
    next();

    // Collect metrics after response
    res.on('finish', () => {
      const duration = (Date.now() - startTime) / 1000;
      const route = req.route?.path || req.path;
      const method = req.method;
      const statusCode = res.statusCode.toString();

      httpRequestsTotal.labels(method, route, statusCode, tenantId).inc();
      httpRequestDuration.labels(method, route, statusCode, tenantId).observe(duration);
    });
  };
}

/**
 * Database query metrics wrapper
 */
export function recordDatabaseQuery(
  operation: string,
  table: string,
  tenantId: string,
  duration: number,
  success: boolean
) {
  const status = success ? 'success' : 'error';
  
  databaseQueries.labels(operation, table, tenantId, status).inc();
  databaseQueryDuration.labels(operation, table, tenantId).observe(duration / 1000);
  
  logger.debug('Database query recorded', {
    operation,
    table,
    tenantId,
    duration,
    success,
  });
}

/**
 * Test execution metrics recording
 */
export function recordTestRun(
  tenantId: string,
  status: string,
  environment: string,
  browser: string,
  duration: number
) {
  testRunsTotal.labels(tenantId, status, environment, browser).inc();
  testRunDuration.labels(tenantId, environment, browser).observe(duration / 1000);
  
  logger.info('Test run recorded', {
    tenantId,
    status,
    environment,
    browser,
    duration,
  });
}

/**
 * Artifact processing metrics
 */
export function recordArtifactUpload(
  tenantId: string,
  artifactType: string,
  success: boolean,
  fileSize: number,
  processingTime: number
) {
  const status = success ? 'success' : 'error';
  
  artifactsUploaded.labels(tenantId, artifactType, status).inc();
  
  if (success) {
    artifactStorageBytes.labels(tenantId, artifactType).inc(fileSize);
    artifactProcessingDuration.labels(tenantId, artifactType, 'upload').observe(processingTime / 1000);
  }
  
  logger.info('Artifact upload recorded', {
    tenantId,
    artifactType,
    success,
    fileSize,
    processingTime,
  });
}

// =============================================================================
// METRICS COLLECTION
// =============================================================================

/**
 * Collect tenant usage statistics
 */
export async function collectTenantMetrics(enterpriseDb: any): Promise<void> {
  try {
    if (!enterpriseConfig.ENABLE_METRICS) {
      return;
    }

    // Get active tenants count
    const tenantsResult = await enterpriseDb.query(
      'SELECT COUNT(*) as count FROM tenants WHERE status = $1',
      ['active']
    );
    tenantsActive.set(parseInt(tenantsResult.rows[0].count));

    // Get tenant usage metrics
    const usageResult = await enterpriseDb.query(`
      SELECT 
        t.id as tenant_id,
        t.plan,
        COUNT(tr.id) as test_runs_count,
        AVG(tr.pass_rate) as avg_pass_rate,
        SUM(ta.file_size) as storage_used
      FROM tenants t
      LEFT JOIN test_runs tr ON t.id = tr.tenant_id 
        AND tr.created_at >= NOW() - INTERVAL '24 hours'
      LEFT JOIN test_artifacts ta ON tr.id = ta.run_id
      WHERE t.status = 'active'
      GROUP BY t.id, t.plan
    `);

    for (const row of usageResult.rows) {
      const tenantId = row.tenant_id;
      const plan = row.plan;
      
      tenantUsage.labels(tenantId, 'test_runs', plan).set(row.test_runs_count || 0);
      tenantUsage.labels(tenantId, 'storage_bytes', plan).set(row.storage_used || 0);
      
      if (row.avg_pass_rate !== null) {
        testPassRate.labels(tenantId, 'all', '24h').set(row.avg_pass_rate);
      }
    }

    logger.debug('Tenant metrics collected', {
      tenantsCount: tenantsResult.rows[0].count,
      usageMetrics: usageResult.rows.length,
    });
  } catch (error) {
    logger.error('Failed to collect tenant metrics', { error });
  }
}

/**
 * Initialize metrics collection
 */
export function initializeMetrics(enterpriseDb: any): void {
  if (!enterpriseConfig.ENABLE_METRICS) {
    logger.info('Metrics collection disabled');
    return;
  }

  // Collect tenant metrics every 5 minutes
  setInterval(async () => {
    await collectTenantMetrics(enterpriseDb);
  }, 5 * 60 * 1000);

  // Collect database connection metrics every 30 seconds
  setInterval(() => {
    // This would be implemented based on your connection pool
    // databaseConnections.labels('primary').set(pool.totalCount);
    // databaseConnections.labels('replica').set(replicaPool.totalCount);
  }, 30 * 1000);

  logger.info('Metrics collection initialized', {
    metricsPort: enterpriseConfig.METRICS_PORT,
    collectInterval: '5m',
  });
}

// =============================================================================
// METRICS ENDPOINT
// =============================================================================

/**
 * Express handler for metrics endpoint
 */
export async function metricsHandler(req: Request, res: Response): Promise<void> {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    logger.error('Failed to generate metrics', { error });
    res.status(500).end('Error generating metrics');
  }
}

// =============================================================================
// CUSTOM METRICS HELPERS
// =============================================================================

/**
 * Record custom business metric
 */
export function recordCustomMetric(
  metricName: string,
  value: number,
  labels: Record<string, string> = {}
): void {
  try {
    // Create or get existing gauge
    let gauge = register.getSingleMetric(metricName) as Gauge<string>;
    
    if (!gauge) {
      gauge = new Gauge({
        name: metricName,
        help: `Custom metric: ${metricName}`,
        labelNames: Object.keys(labels),
        registers: [register],
      });
    }

    gauge.set(labels, value);
    
    logger.debug('Custom metric recorded', {
      metricName,
      value,
      labels,
    });
  } catch (error) {
    logger.error('Failed to record custom metric', {
      error,
      metricName,
      value,
      labels,
    });
  }
}

/**
 * Health check for metrics system
 */
export function metricsHealthCheck(): { healthy: boolean; metrics?: any } {
  try {
    const metrics = register.getMetricsAsJSON();
    return {
      healthy: true,
      metrics: {
        registered: metrics.length,
        enabled: enterpriseConfig.ENABLE_METRICS,
      },
    };
  } catch (error) {
    logger.error('Metrics health check failed', { error });
    return { healthy: false };
  }
}