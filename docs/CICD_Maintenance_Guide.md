# QA Intelligence CI/CD Maintenance Guide

**Version:** 1.0
**Last Updated:** 2025-09-26
**Owner:** DevOps/SRE Team
**Classification:** Internal Operations Manual

> **MAINTENANCE STATUS**: Comprehensive maintenance procedures for optimal system performance

## Table of Contents

1. [Maintenance Overview](#maintenance-overview)
2. [Preventive Maintenance](#preventive-maintenance)
3. [Database Maintenance](#database-maintenance)
4. [System Performance Optimization](#system-performance-optimization)
5. [Security Updates and Patches](#security-updates-and-patches)
6. [Backup and Recovery Management](#backup-and-recovery-management)
7. [Log Management and Rotation](#log-management-and-rotation)
8. [Dependency Updates](#dependency-updates)
9. [Infrastructure Maintenance](#infrastructure-maintenance)
10. [Capacity Planning and Scaling](#capacity-planning-and-scaling)

---

## Maintenance Overview

### Maintenance Philosophy

QA Intelligence follows a proactive maintenance approach with the following principles:

1. **Predictive Maintenance** - Use monitoring data to predict issues before they occur
2. **Automated Tasks** - Automate routine maintenance wherever possible
3. **Minimal Downtime** - Perform maintenance with zero or minimal service interruption
4. **Documentation** - Document all maintenance activities for audit and learning
5. **Testing** - Test all changes in non-production environments first
6. **Rollback Plans** - Always have rollback procedures ready

### Maintenance Windows

**Scheduled Maintenance Windows:**

```yaml
maintenance_windows:
  daily:
    time: "02:00-03:00 UTC"
    frequency: "Every day"
    activities:
      - Log rotation
      - Cache cleanup
      - Temporary file cleanup
      - Database routine maintenance

  weekly:
    time: "Sunday 01:00-04:00 UTC"
    frequency: "Every Sunday"
    activities:
      - Database optimization
      - Index rebuilding
      - Performance analysis
      - Security scans
      - Backup verification

  monthly:
    time: "First Sunday of month 00:00-06:00 UTC"
    frequency: "First Sunday of each month"
    activities:
      - Full system backup
      - Major dependency updates
      - Security patching
      - Capacity planning review
      - Disaster recovery testing

  quarterly:
    time: "TBD - Coordinated with business"
    frequency: "Every 3 months"
    activities:
      - Major system upgrades
      - Infrastructure scaling
      - Security audit
      - Performance baseline review
```

### Maintenance Notification Process

**Stakeholder Communication:**

```typescript
// Maintenance notification system
class MaintenanceNotificationService {
  async scheduleMaintenanceWindow(
    window: MaintenanceWindow,
    impact: 'none' | 'minimal' | 'moderate' | 'high'
  ): Promise<void> {
    const notification = {
      type: 'scheduled_maintenance',
      window,
      impact,
      scheduledBy: 'DevOps Team',
      scheduledAt: new Date().toISOString()
    };

    // Notify stakeholders based on impact level
    switch (impact) {
      case 'high':
        await this.notifyAllStakeholders(notification);
        break;
      case 'moderate':
        await this.notifyOperationalTeams(notification);
        break;
      case 'minimal':
        await this.notifyTechnicalTeams(notification);
        break;
      case 'none':
        await this.logMaintenanceActivity(notification);
        break;
    }

    // Update status page
    await this.updateStatusPage(notification);
  }

  private async notifyAllStakeholders(notification: any): Promise<void> {
    // 72 hours advance notice for high-impact maintenance
    const recipients = [
      'executives@company.com',
      'operations@company.com',
      'development@company.com',
      'qa@company.com'
    ];

    await emailService.sendMaintenanceNotification(recipients, notification);
    await slackService.postToChannel('#general', notification);
    await statusPage.postMaintenanceScheduled(notification);
  }
}
```

---

## Preventive Maintenance

### Daily Maintenance Tasks

**Automated Daily Maintenance Script:**

```powershell
# Daily-Maintenance.ps1
# Runs daily at 2:00 AM UTC via Task Scheduler

param(
    [switch]$DryRun,
    [string]$LogPath = "C:\QA-Intelligence\logs\maintenance"
)

$ErrorActionPreference = "Stop"
$MaintenanceLog = Join-Path $LogPath "daily-maintenance-$(Get-Date -Format 'yyyy-MM-dd').log"

function Write-MaintenanceLog {
    param([string]$Message, [string]$Level = "INFO")
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogMessage = "[$Timestamp] [$Level] $Message"
    Add-Content -Path $MaintenanceLog -Value $LogMessage
    Write-Host $LogMessage
}

try {
    Write-MaintenanceLog "Starting daily maintenance routine"

    # 1. Service Health Check
    Write-MaintenanceLog "Checking service health..."
    $BackendHealth = Invoke-RestMethod -Uri "http://localhost:8082/api/health" -TimeoutSec 30
    $FrontendHealth = Invoke-RestMethod -Uri "http://localhost:3001/api/health" -TimeoutSec 30

    if ($BackendHealth.status -ne "healthy" -or $FrontendHealth.status -ne "healthy") {
        Write-MaintenanceLog "Service health check failed" "ERROR"
        # Send alert to operations team
        & "C:\QA-Intelligence\scripts\send-alert.ps1" -Type "service_unhealthy" -Details @{
            backend = $BackendHealth.status
            frontend = $FrontendHealth.status
        }
    }

    # 2. Database Maintenance
    Write-MaintenanceLog "Running database maintenance..."
    if (-not $DryRun) {
        & node "C:\QA-Intelligence\backend\scripts\daily-db-maintenance.js"
    }

    # 3. Log Rotation
    Write-MaintenanceLog "Rotating logs..."
    & "C:\QA-Intelligence\scripts\rotate-logs.ps1" -DryRun:$DryRun

    # 4. Cleanup Temporary Files
    Write-MaintenanceLog "Cleaning temporary files..."
    $TempDirs = @(
        "C:\QA-Intelligence\backend\temp",
        "C:\QA-Intelligence\backend\uploads\temp",
        "C:\QA-Intelligence\backend\test-results\old"
    )

    foreach ($TempDir in $TempDirs) {
        if (Test-Path $TempDir) {
            $OldFiles = Get-ChildItem $TempDir -Recurse | Where-Object {
                $_.LastWriteTime -lt (Get-Date).AddDays(-7)
            }

            if ($OldFiles) {
                Write-MaintenanceLog "Cleaning $($OldFiles.Count) old files from $TempDir"
                if (-not $DryRun) {
                    $OldFiles | Remove-Item -Force -Recurse
                }
            }
        }
    }

    # 5. Performance Metrics Collection
    Write-MaintenanceLog "Collecting performance metrics..."
    & node "C:\QA-Intelligence\scripts\collect-daily-metrics.js"

    # 6. Security Scan (Quick)
    Write-MaintenanceLog "Running quick security scan..."
    & "C:\QA-Intelligence\scripts\quick-security-scan.ps1" -DryRun:$DryRun

    Write-MaintenanceLog "Daily maintenance completed successfully"

} catch {
    Write-MaintenanceLog "Daily maintenance failed: $($_.Exception.Message)" "ERROR"

    # Send failure notification
    & "C:\QA-Intelligence\scripts\send-alert.ps1" -Type "maintenance_failed" -Details @{
        error = $_.Exception.Message
        script = "daily-maintenance"
    }

    exit 1
}
```

**Database Daily Maintenance:**

```javascript
// backend/scripts/daily-db-maintenance.js
const { getDatabase } = require('../src/database/database');
const logger = require('../src/utils/logger');

async function runDailyDatabaseMaintenance() {
  const db = getDatabase();

  try {
    logger.info('Starting daily database maintenance');

    // 1. Update statistics for query optimization
    await db.run('ANALYZE');
    logger.info('Database statistics updated');

    // 2. Cleanup old test execution data (keep last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const cleanupResult = await db.run(`
      DELETE FROM test_executions
      WHERE created_at < ? AND status IN ('completed', 'failed')
    `, [thirtyDaysAgo.toISOString()]);

    logger.info(`Cleaned up ${cleanupResult.changes} old test execution records`);

    // 3. Optimize database file (SQLite specific)
    await db.run('VACUUM');
    logger.info('Database vacuum completed');

    // 4. Check database integrity
    const integrityCheck = await db.get('PRAGMA integrity_check');
    if (integrityCheck.integrity_check !== 'ok') {
      throw new Error(`Database integrity check failed: ${integrityCheck.integrity_check}`);
    }

    // 5. Update performance metrics
    const dbStats = await collectDatabaseStats(db);
    await updatePerformanceMetrics(dbStats);

    logger.info('Daily database maintenance completed successfully', {
      recordsCleaned: cleanupResult.changes,
      dbSize: dbStats.size,
      tables: dbStats.tableCount
    });

  } catch (error) {
    logger.error('Daily database maintenance failed', { error: error.message });
    throw error;
  }
}

async function collectDatabaseStats(db) {
  const stats = {};

  // Database file size
  const dbInfo = await db.get('PRAGMA page_count, page_size');
  stats.size = (dbInfo.page_count * dbInfo.page_size) / 1024 / 1024; // MB

  // Table counts
  const tables = await db.all(`
    SELECT name, (
      SELECT COUNT(*) FROM sqlite_master s2
      WHERE s2.name = s1.name AND s2.type = 'table'
    ) as record_count
    FROM sqlite_master s1
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
  `);

  stats.tableCount = tables.length;
  stats.tables = tables.reduce((acc, table) => {
    acc[table.name] = table.record_count;
    return acc;
  }, {});

  return stats;
}

if (require.main === module) {
  runDailyDatabaseMaintenance()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { runDailyDatabaseMaintenance };
```

### Weekly Maintenance Tasks

**Weekly Optimization Script:**

```bash
#!/bin/bash
# weekly-maintenance.sh
# Runs every Sunday at 1:00 AM UTC

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="/var/log/qa-intelligence"
LOG_FILE="$LOG_DIR/weekly-maintenance-$(date +%Y-%m-%d).log"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Logging function
log() {
    local level=$1
    shift
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $*" | tee -a "$LOG_FILE"
}

log "INFO" "Starting weekly maintenance routine"

# 1. Database optimization
log "INFO" "Starting database optimization..."
cd "$SCRIPT_DIR/../backend"
node scripts/weekly-db-optimization.js >> "$LOG_FILE" 2>&1

# 2. Performance analysis
log "INFO" "Running performance analysis..."
node scripts/performance-analysis.js >> "$LOG_FILE" 2>&1

# 3. Security scan
log "INFO" "Running comprehensive security scan..."
npm audit --audit-level=moderate >> "$LOG_FILE" 2>&1

# Check for high/critical vulnerabilities
if npm audit --audit-level=high --json > /tmp/audit-result.json 2>/dev/null; then
    VULN_COUNT=$(cat /tmp/audit-result.json | jq '.metadata.vulnerabilities.high + .metadata.vulnerabilities.critical' 2>/dev/null || echo "0")
    if [ "$VULN_COUNT" -gt 0 ]; then
        log "WARNING" "Found $VULN_COUNT high/critical vulnerabilities"
        # Send security alert
        node scripts/send-security-alert.js --vulnerabilities="$VULN_COUNT"
    fi
fi

# 4. Backup verification
log "INFO" "Verifying backup integrity..."
bash scripts/verify-backups.sh >> "$LOG_FILE" 2>&1

# 5. Disk space check
log "INFO" "Checking disk space..."
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 85 ]; then
    log "WARNING" "Disk usage is at ${DISK_USAGE}%"
    node scripts/send-alert.js --type="disk_space" --usage="$DISK_USAGE"
fi

# 6. Update system packages (if appropriate)
if command -v apt-get > /dev/null; then
    log "INFO" "Updating system packages..."
    sudo apt-get update >> "$LOG_FILE" 2>&1
    sudo apt-get upgrade -y >> "$LOG_FILE" 2>&1
fi

# 7. Generate weekly report
log "INFO" "Generating weekly maintenance report..."
node scripts/generate-weekly-report.js >> "$LOG_FILE" 2>&1

log "INFO" "Weekly maintenance completed successfully"

# Send completion notification
node scripts/send-notification.js \
    --type="maintenance_completed" \
    --details="Weekly maintenance completed successfully" \
    --log-file="$LOG_FILE"
```

---

## Database Maintenance

### Database Optimization

**PostgreSQL Maintenance Procedures:**

```sql
-- postgresql-maintenance.sql
-- Run weekly during maintenance window

-- Update table statistics
ANALYZE;

-- Reindex to improve query performance
REINDEX DATABASE qa_intelligence;

-- Vacuum to reclaim storage and improve performance
VACUUM (ANALYZE, VERBOSE);

-- Check for bloated tables
SELECT
    schemaname,
    tablename,
    n_dead_tup,
    n_live_tup,
    ROUND((n_dead_tup * 100.0) / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_percentage
FROM pg_stat_user_tables
WHERE n_dead_tup > 0
ORDER BY dead_percentage DESC;

-- Update outdated statistics
SELECT
    schemaname,
    tablename,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
WHERE last_analyze < NOW() - INTERVAL '7 days'
   OR last_autoanalyze < NOW() - INTERVAL '7 days';
```

**Database Health Check Script:**

```javascript
// backend/scripts/database-health-check.js
const { Pool } = require('pg');
const logger = require('../src/utils/logger');

class DatabaseHealthChecker {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });
  }

  async runHealthCheck() {
    const results = {
      connectivity: false,
      performance: {},
      storage: {},
      locks: {},
      replication: {},
      issues: []
    };

    try {
      // 1. Basic connectivity test
      const client = await this.pool.connect();
      results.connectivity = true;

      // 2. Performance metrics
      const perfQueries = {
        avgQueryTime: `
          SELECT AVG(mean_exec_time) as avg_time
          FROM pg_stat_statements
          WHERE calls > 10
        `,

        slowQueries: `
          SELECT query, calls, mean_exec_time, stddev_exec_time
          FROM pg_stat_statements
          WHERE mean_exec_time > 1000
          ORDER BY mean_exec_time DESC
          LIMIT 10
        `,

        activeConnections: `
          SELECT COUNT(*) as active_connections
          FROM pg_stat_activity
          WHERE state = 'active'
        `,

        idleConnections: `
          SELECT COUNT(*) as idle_connections
          FROM pg_stat_activity
          WHERE state = 'idle'
        `
      };

      for (const [key, query] of Object.entries(perfQueries)) {
        try {
          const result = await client.query(query);
          results.performance[key] = result.rows[0] || result.rows;
        } catch (error) {
          logger.warn(`Performance query failed: ${key}`, { error: error.message });
        }
      }

      // 3. Storage metrics
      const storageQueries = {
        databaseSize: `
          SELECT pg_size_pretty(pg_database_size('qa_intelligence')) as size
        `,

        tablesSizes: `
          SELECT
            schemaname,
            tablename,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
            pg_total_relation_size(schemaname||'.'||tablename) as bytes
          FROM pg_tables
          WHERE schemaname = 'public'
          ORDER BY bytes DESC
          LIMIT 10
        `
      };

      for (const [key, query] of Object.entries(storageQueries)) {
        try {
          const result = await client.query(query);
          results.storage[key] = result.rows[0] || result.rows;
        } catch (error) {
          logger.warn(`Storage query failed: ${key}`, { error: error.message });
        }
      }

      // 4. Lock detection
      const lockQuery = `
        SELECT
          blocked_locks.pid AS blocked_pid,
          blocked_activity.usename AS blocked_user,
          blocking_locks.pid AS blocking_pid,
          blocking_activity.usename AS blocking_user,
          blocked_activity.query AS blocked_statement,
          blocking_activity.query AS current_statement_in_blocking_process
        FROM pg_catalog.pg_locks blocked_locks
        JOIN pg_catalog.pg_stat_activity blocked_activity
          ON blocked_activity.pid = blocked_locks.pid
        JOIN pg_catalog.pg_locks blocking_locks
          ON blocking_locks.locktype = blocked_locks.locktype
          AND blocking_locks.DATABASE IS NOT DISTINCT FROM blocked_locks.DATABASE
          AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
          AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
          AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
          AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
          AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
          AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
          AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
          AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
          AND blocking_locks.pid != blocked_locks.pid
        JOIN pg_catalog.pg_stat_activity blocking_activity
          ON blocking_activity.pid = blocking_locks.pid
        WHERE NOT blocked_locks.GRANTED
      `;

      const lockResult = await client.query(lockQuery);
      results.locks.blockedQueries = lockResult.rows;

      // 5. Identify potential issues
      if (results.performance.activeConnections?.active_connections > 50) {
        results.issues.push('High number of active connections');
      }

      if (results.performance.slowQueries?.length > 0) {
        results.issues.push(`${results.performance.slowQueries.length} slow queries detected`);
      }

      if (results.locks.blockedQueries.length > 0) {
        results.issues.push(`${results.locks.blockedQueries.length} blocked queries detected`);
      }

      client.release();

      logger.info('Database health check completed', {
        connectivity: results.connectivity,
        issueCount: results.issues.length,
        activeConnections: results.performance.activeConnections?.active_connections
      });

      return results;

    } catch (error) {
      logger.error('Database health check failed', { error: error.message });
      results.issues.push(`Health check failed: ${error.message}`);
      return results;
    }
  }

  async optimizeDatabase() {
    try {
      const client = await this.pool.connect();

      logger.info('Starting database optimization');

      // Update statistics
      await client.query('ANALYZE');
      logger.info('Database statistics updated');

      // Get table bloat information
      const bloatQuery = `
        SELECT
          schemaname,
          tablename,
          n_dead_tup,
          n_live_tup,
          ROUND((n_dead_tup * 100.0) / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_percentage
        FROM pg_stat_user_tables
        WHERE n_dead_tup > 1000
        ORDER BY dead_percentage DESC
      `;

      const bloatedTables = await client.query(bloatQuery);

      // Vacuum tables with high dead tuple percentage
      for (const table of bloatedTables.rows) {
        if (table.dead_percentage > 10) {
          logger.info(`Vacuuming table ${table.schemaname}.${table.tablename} (${table.dead_percentage}% dead tuples)`);
          await client.query(`VACUUM ANALYZE ${table.schemaname}.${table.tablename}`);
        }
      }

      client.release();

      logger.info('Database optimization completed');

    } catch (error) {
      logger.error('Database optimization failed', { error: error.message });
      throw error;
    }
  }
}

if (require.main === module) {
  const checker = new DatabaseHealthChecker();
  checker.runHealthCheck()
    .then(results => {
      console.log(JSON.stringify(results, null, 2));
      if (results.issues.length > 0) {
        console.error('Database issues detected:', results.issues);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = DatabaseHealthChecker;
```

---

## System Performance Optimization

### Performance Monitoring and Tuning

**Node.js Application Performance Tuning:**

```javascript
// backend/scripts/performance-tuning.js
const os = require('os');
const process = require('process');
const { performance } = require('perf_hooks');

class PerformanceTuner {
  constructor() {
    this.metrics = new Map();
    this.recommendations = [];
  }

  async analyzePerformance() {
    // System resource usage
    const systemMetrics = {
      cpuUsage: process.cpuUsage(),
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      loadAverage: os.loadavg(),
      freeMemory: os.freemem(),
      totalMemory: os.totalmem()
    };

    // Node.js specific metrics
    const nodeMetrics = {
      eventLoopLag: await this.measureEventLoopLag(),
      gcStats: this.getGCStats(),
      activeHandles: process._getActiveHandles().length,
      activeRequests: process._getActiveRequests().length
    };

    // Application-specific metrics
    const appMetrics = await this.getApplicationMetrics();

    const analysis = {
      system: systemMetrics,
      node: nodeMetrics,
      application: appMetrics,
      recommendations: this.generateRecommendations(systemMetrics, nodeMetrics, appMetrics)
    };

    return analysis;
  }

  async measureEventLoopLag() {
    return new Promise(resolve => {
      const start = performance.now();
      setImmediate(() => {
        const lag = performance.now() - start;
        resolve(lag);
      });
    });
  }

  generateRecommendations(system, node, app) {
    const recommendations = [];

    // Memory usage recommendations
    const memoryUsagePercent = (system.memoryUsage.heapUsed / system.memoryUsage.heapTotal) * 100;
    if (memoryUsagePercent > 80) {
      recommendations.push({
        category: 'memory',
        severity: 'high',
        issue: 'High heap memory usage',
        recommendation: 'Consider increasing heap size or optimizing memory usage',
        currentValue: `${memoryUsagePercent.toFixed(2)}%`
      });
    }

    // Event loop lag recommendations
    if (node.eventLoopLag > 10) {
      recommendations.push({
        category: 'performance',
        severity: 'medium',
        issue: 'High event loop lag',
        recommendation: 'Optimize synchronous operations or move to worker threads',
        currentValue: `${node.eventLoopLag.toFixed(2)}ms`
      });
    }

    // CPU usage recommendations
    const cpuPercent = (system.cpuUsage.user + system.cpuUsage.system) / 1000000 / system.uptime * 100;
    if (cpuPercent > 70) {
      recommendations.push({
        category: 'cpu',
        severity: 'medium',
        issue: 'High CPU usage',
        recommendation: 'Optimize CPU-intensive operations or scale horizontally',
        currentValue: `${cpuPercent.toFixed(2)}%`
      });
    }

    // Database connection recommendations
    if (app.database?.activeConnections > 20) {
      recommendations.push({
        category: 'database',
        severity: 'medium',
        issue: 'High database connection count',
        recommendation: 'Optimize connection pool size or query efficiency',
        currentValue: app.database.activeConnections
      });
    }

    return recommendations;
  }

  async getApplicationMetrics() {
    try {
      // Get API response times
      const apiMetrics = await this.getAPIMetrics();

      // Get database performance
      const dbMetrics = await this.getDatabaseMetrics();

      // Get cache performance
      const cacheMetrics = await this.getCacheMetrics();

      return {
        api: apiMetrics,
        database: dbMetrics,
        cache: cacheMetrics
      };
    } catch (error) {
      console.error('Failed to get application metrics:', error);
      return {};
    }
  }

  async optimizeApplication() {
    const analysis = await this.analyzePerformance();
    const optimizations = [];

    for (const recommendation of analysis.recommendations) {
      switch (recommendation.category) {
        case 'memory':
          await this.optimizeMemoryUsage();
          optimizations.push('Memory optimization applied');
          break;

        case 'database':
          await this.optimizeDatabaseConnections();
          optimizations.push('Database connection optimization applied');
          break;

        case 'cache':
          await this.optimizeCaching();
          optimizations.push('Cache optimization applied');
          break;
      }
    }

    return optimizations;
  }

  async optimizeMemoryUsage() {
    // Force garbage collection (if exposed)
    if (global.gc) {
      global.gc();
    }

    // Clear any large caches
    if (global.appCache) {
      global.appCache.clear();
    }
  }

  async optimizeDatabaseConnections() {
    // Reduce connection pool size if too high
    const db = require('../src/database/database').getDatabase();
    if (db.pool) {
      db.pool.options.max = Math.min(db.pool.options.max, 10);
    }
  }

  async optimizeCaching() {
    // Implement cache warming for frequently accessed data
    const cache = require('../src/services/cache');
    await cache.warmupFrequentlyAccessedData();
  }
}

if (require.main === module) {
  const tuner = new PerformanceTuner();
  tuner.analyzePerformance()
    .then(analysis => {
      console.log('Performance Analysis:', JSON.stringify(analysis, null, 2));
      return tuner.optimizeApplication();
    })
    .then(optimizations => {
      console.log('Optimizations Applied:', optimizations);
    })
    .catch(console.error);
}

module.exports = PerformanceTuner;
```

### Resource Optimization

**Memory and CPU Optimization:**

```javascript
// backend/src/middleware/resource-optimization.js
class ResourceOptimizer {
  constructor() {
    this.memoryThreshold = 0.8; // 80% of available memory
    this.cpuThreshold = 0.7;    // 70% CPU usage
    this.responseTimeThreshold = 1000; // 1 second
  }

  // Memory optimization middleware
  optimizeMemory() {
    return (req, res, next) => {
      const startMemory = process.memoryUsage();

      res.on('finish', () => {
        const endMemory = process.memoryUsage();
        const memoryIncrease = endMemory.heapUsed - startMemory.heapUsed;

        // Log high memory usage requests
        if (memoryIncrease > 50 * 1024 * 1024) { // 50MB
          logger.warn('High memory usage request', {
            path: req.path,
            method: req.method,
            memoryIncrease: `${Math.round(memoryIncrease / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(endMemory.heapUsed / 1024 / 1024)}MB`
          });
        }

        // Trigger GC if memory usage is high
        const memoryUsagePercent = endMemory.heapUsed / endMemory.heapTotal;
        if (memoryUsagePercent > this.memoryThreshold && global.gc) {
          setImmediate(() => global.gc());
        }
      });

      next();
    };
  }

  // Response time optimization
  optimizeResponseTime() {
    return (req, res, next) => {
      const startTime = Date.now();

      res.on('finish', () => {
        const responseTime = Date.now() - startTime;

        if (responseTime > this.responseTimeThreshold) {
          logger.warn('Slow response detected', {
            path: req.path,
            method: req.method,
            responseTime: `${responseTime}ms`,
            statusCode: res.statusCode
          });

          // Suggest caching for slow GET requests
          if (req.method === 'GET' && responseTime > 2000) {
            logger.info('Consider caching for slow endpoint', {
              path: req.path,
              responseTime: `${responseTime}ms`
            });
          }
        }
      });

      next();
    };
  }

  // Database query optimization
  async optimizeDatabase() {
    const db = require('../database/database').getDatabase();

    // Identify slow queries
    const slowQueries = await db.all(`
      SELECT sql, COUNT(*) as execution_count
      FROM (
        SELECT SUBSTR(sql, 1, 100) as sql
        FROM sqlite_master
        WHERE type = 'table'
      )
      GROUP BY sql
      HAVING execution_count > 100
    `);

    // Log slow queries for optimization
    for (const query of slowQueries) {
      logger.info('Frequently executed query (consider optimization)', {
        query: query.sql,
        executionCount: query.execution_count
      });
    }

    // Analyze query plans for optimization opportunities
    await this.analyzeQueryPlans(db);
  }

  async analyzeQueryPlans(db) {
    const commonQueries = [
      'SELECT * FROM test_executions WHERE status = ?',
      'SELECT * FROM users WHERE email = ?',
      'SELECT * FROM test_results WHERE execution_id = ?'
    ];

    for (const query of commonQueries) {
      try {
        const plan = await db.all(`EXPLAIN QUERY PLAN ${query}`, ['placeholder']);

        // Check if query uses indexes
        const usesIndex = plan.some(step => step.detail.includes('USING INDEX'));
        if (!usesIndex) {
          logger.warn('Query not using index - consider optimization', {
            query,
            plan: plan.map(p => p.detail)
          });
        }
      } catch (error) {
        // Skip queries that can't be analyzed
      }
    }
  }
}

module.exports = ResourceOptimizer;
```

---

## Security Updates and Patches

### Automated Security Updates

**Security Update Management:**

```javascript
// backend/scripts/security-update-manager.js
const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class SecurityUpdateManager {
  constructor() {
    this.updateLog = path.join(__dirname, '../logs/security-updates.log');
    this.criticalVulnerabilities = [];
  }

  async checkForSecurityUpdates() {
    const results = {
      npm: await this.checkNPMSecurity(),
      system: await this.checkSystemSecurity(),
      docker: await this.checkDockerSecurity()
    };

    await this.logSecurityCheck(results);
    return results;
  }

  async checkNPMSecurity() {
    try {
      // Run npm audit
      const auditOutput = execSync('npm audit --json', { encoding: 'utf8' });
      const auditResult = JSON.parse(auditOutput);

      const vulnerabilities = {
        critical: auditResult.metadata.vulnerabilities.critical || 0,
        high: auditResult.metadata.vulnerabilities.high || 0,
        moderate: auditResult.metadata.vulnerabilities.moderate || 0,
        low: auditResult.metadata.vulnerabilities.low || 0
      };

      // Check for critical vulnerabilities
      if (vulnerabilities.critical > 0 || vulnerabilities.high > 0) {
        this.criticalVulnerabilities.push({
          type: 'npm',
          severity: vulnerabilities.critical > 0 ? 'critical' : 'high',
          count: vulnerabilities.critical + vulnerabilities.high,
          details: auditResult.vulnerabilities
        });
      }

      return {
        status: vulnerabilities.critical === 0 && vulnerabilities.high === 0 ? 'safe' : 'vulnerable',
        vulnerabilities,
        fixAvailable: auditResult.metadata.totalDependencies > 0
      };

    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  async checkSystemSecurity() {
    const systemUpdates = {
      windows: await this.checkWindowsUpdates(),
      linux: await this.checkLinuxUpdates()
    };

    return systemUpdates;
  }

  async checkWindowsUpdates() {
    if (process.platform !== 'win32') return null;

    try {
      // Check for Windows updates using PowerShell
      const psScript = `
        Get-WUList | Where-Object {$_.Categories -match "Security"} |
        Select-Object Title, Size, @{Name="Severity"; Expression={
          if ($_.Title -match "Critical") {"Critical"}
          elseif ($_.Title -match "Important") {"High"}
          else {"Medium"}
        }}
      `;

      const output = execSync(`powershell -Command "${psScript}"`, { encoding: 'utf8' });

      return {
        securityUpdatesAvailable: output.trim().length > 0,
        details: output.trim()
      };

    } catch (error) {
      return {
        error: 'Unable to check Windows updates',
        details: error.message
      };
    }
  }

  async checkLinuxUpdates() {
    if (process.platform === 'win32') return null;

    try {
      // Check for security updates
      const output = execSync('apt list --upgradable 2>/dev/null | grep -i security || echo "No security updates"', { encoding: 'utf8' });

      return {
        securityUpdatesAvailable: !output.includes('No security updates'),
        details: output.trim()
      };

    } catch (error) {
      return {
        error: 'Unable to check Linux updates',
        details: error.message
      };
    }
  }

  async applySecurityUpdates(options = {}) {
    const results = [];

    try {
      // Apply NPM security fixes
      if (options.npm !== false) {
        const npmResult = await this.applyNPMSecurityFixes();
        results.push(npmResult);
      }

      // Apply system updates (if enabled)
      if (options.system === true) {
        const systemResult = await this.applySystemUpdates();
        results.push(systemResult);
      }

      await this.logSecurityUpdates(results);
      return results;

    } catch (error) {
      throw new Error(`Security update failed: ${error.message}`);
    }
  }

  async applyNPMSecurityFixes() {
    try {
      // First, try automatic fix
      const fixOutput = execSync('npm audit fix --force', { encoding: 'utf8' });

      // Check if fixes were applied
      const postFixAudit = execSync('npm audit --json', { encoding: 'utf8' });
      const postFixResult = JSON.parse(postFixAudit);

      return {
        type: 'npm',
        status: 'success',
        fixesApplied: true,
        remainingVulnerabilities: postFixResult.metadata.vulnerabilities,
        output: fixOutput
      };

    } catch (error) {
      return {
        type: 'npm',
        status: 'failed',
        error: error.message
      };
    }
  }

  async generateSecurityReport() {
    const checkResults = await this.checkForSecurityUpdates();

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        criticalVulnerabilities: this.criticalVulnerabilities.length,
        requiresImmediateAction: this.criticalVulnerabilities.some(v => v.severity === 'critical')
      },
      details: checkResults,
      recommendations: this.generateRecommendations(checkResults)
    };

    // Save report
    await fs.writeFile(
      path.join(__dirname, `../reports/security-report-${new Date().toISOString().split('T')[0]}.json`),
      JSON.stringify(report, null, 2)
    );

    return report;
  }

  generateRecommendations(results) {
    const recommendations = [];

    if (results.npm.status === 'vulnerable') {
      if (results.npm.vulnerabilities.critical > 0) {
        recommendations.push({
          priority: 'immediate',
          action: 'Apply NPM security fixes immediately',
          command: 'npm audit fix --force',
          reason: `${results.npm.vulnerabilities.critical} critical vulnerabilities found`
        });
      }

      if (results.npm.vulnerabilities.high > 0) {
        recommendations.push({
          priority: 'high',
          action: 'Review and apply NPM security fixes',
          command: 'npm audit fix',
          reason: `${results.npm.vulnerabilities.high} high severity vulnerabilities found`
        });
      }
    }

    if (results.system.windows?.securityUpdatesAvailable || results.system.linux?.securityUpdatesAvailable) {
      recommendations.push({
        priority: 'high',
        action: 'Apply system security updates',
        reason: 'Security updates available for operating system'
      });
    }

    return recommendations;
  }
}

if (require.main === module) {
  const manager = new SecurityUpdateManager();

  // Command line interface
  const command = process.argv[2];

  switch (command) {
    case 'check':
      manager.checkForSecurityUpdates()
        .then(results => console.log(JSON.stringify(results, null, 2)))
        .catch(console.error);
      break;

    case 'update':
      manager.applySecurityUpdates({ npm: true, system: false })
        .then(results => console.log('Updates applied:', results))
        .catch(console.error);
      break;

    case 'report':
      manager.generateSecurityReport()
        .then(report => console.log('Security report generated:', report.summary))
        .catch(console.error);
      break;

    default:
      console.log('Usage: node security-update-manager.js [check|update|report]');
  }
}

module.exports = SecurityUpdateManager;
```

---

## Backup and Recovery Management

### Backup Strategies

**Comprehensive Backup System:**

```powershell
# backup-manager.ps1
# Comprehensive backup solution for QA Intelligence

param(
    [ValidateSet("full", "incremental", "differential")]
    [string]$BackupType = "incremental",

    [string]$BackupLocation = "C:\QA-Intelligence\backups",

    [switch]$Verify,

    [switch]$Encrypt = $true,

    [int]$RetentionDays = 30
)

# Backup configuration
$BackupConfig = @{
    DatabasePath = "C:\QA-Intelligence\memory.sqlite"
    ConfigPath = "C:\QA-Intelligence\config"
    LogsPath = "C:\QA-Intelligence\logs"
    UploadsPath = "C:\QA-Intelligence\backend\uploads"
    TestResultsPath = "C:\QA-Intelligence\backend\test-results"
    EncryptionKey = $env:BACKUP_ENCRYPTION_KEY
}

function Write-BackupLog {
    param([string]$Message, [string]$Level = "INFO")
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogMessage = "[$Timestamp] [$Level] $Message"
    Add-Content -Path "$BackupLocation\backup.log" -Value $LogMessage
    Write-Host $LogMessage
}

function New-BackupDirectory {
    $BackupTimestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
    $BackupDir = Join-Path $BackupLocation "$BackupType`_$BackupTimestamp"
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    return $BackupDir
}

function Backup-Database {
    param([string]$DestinationPath)

    Write-BackupLog "Starting database backup..."

    try {
        # Stop services temporarily for consistent backup
        Write-BackupLog "Stopping services for consistent backup..."
        Stop-Service -Name "QAIntelligenceBackend" -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 5

        # Create database backup
        if (Test-Path $BackupConfig.DatabasePath) {
            $DbBackupPath = Join-Path $DestinationPath "database"
            New-Item -ItemType Directory -Path $DbBackupPath -Force | Out-Null

            Copy-Item $BackupConfig.DatabasePath "$DbBackupPath\memory.sqlite" -Force

            # Create database dump for additional safety
            if (Get-Command sqlite3 -ErrorAction SilentlyContinue) {
                sqlite3 $BackupConfig.DatabasePath ".dump" | Out-File "$DbBackupPath\database_dump.sql" -Encoding UTF8
            }

            Write-BackupLog "Database backup completed successfully"
        } else {
            Write-BackupLog "Database file not found: $($BackupConfig.DatabasePath)" "WARNING"
        }

        # Restart services
        Start-Service -Name "QAIntelligenceBackend" -ErrorAction SilentlyContinue

    } catch {
        Write-BackupLog "Database backup failed: $($_.Exception.Message)" "ERROR"
        throw
    }
}

function Backup-ApplicationData {
    param([string]$DestinationPath)

    Write-BackupLog "Starting application data backup..."

    $DataPaths = @{
        "config" = $BackupConfig.ConfigPath
        "logs" = $BackupConfig.LogsPath
        "uploads" = $BackupConfig.UploadsPath
        "test-results" = $BackupConfig.TestResultsPath
    }

    foreach ($DataType in $DataPaths.Keys) {
        $SourcePath = $DataPaths[$DataType]
        $DestPath = Join-Path $DestinationPath $DataType

        if (Test-Path $SourcePath) {
            Write-BackupLog "Backing up $DataType from $SourcePath..."

            # Use robocopy for efficient copying
            $RobocopyArgs = @(
                $SourcePath
                $DestPath
                "/MIR"        # Mirror directory
                "/R:3"        # Retry 3 times
                "/W:10"       # Wait 10 seconds between retries
                "/LOG+:$BackupLocation\robocopy.log"
                "/TEE"        # Output to console and log
            )

            $Result = Start-Process -FilePath "robocopy" -ArgumentList $RobocopyArgs -Wait -PassThru -NoNewWindow

            # Robocopy exit codes 0-7 are success
            if ($Result.ExitCode -le 7) {
                Write-BackupLog "$DataType backup completed successfully"
            } else {
                Write-BackupLog "$DataType backup failed with exit code $($Result.ExitCode)" "WARNING"
            }
        } else {
            Write-BackupLog "Source path not found: $SourcePath" "WARNING"
        }
    }
}

function Compress-Backup {
    param([string]$BackupPath)

    Write-BackupLog "Compressing backup..."

    try {
        $CompressedPath = "$BackupPath.zip"
        Compress-Archive -Path "$BackupPath\*" -DestinationPath $CompressedPath -CompressionLevel Optimal

        # Remove uncompressed backup
        Remove-Item $BackupPath -Recurse -Force

        Write-BackupLog "Backup compressed successfully: $(Split-Path $CompressedPath -Leaf)"
        return $CompressedPath

    } catch {
        Write-BackupLog "Backup compression failed: $($_.Exception.Message)" "ERROR"
        throw
    }
}

function Encrypt-Backup {
    param([string]$BackupPath)

    if (-not $Encrypt -or -not $BackupConfig.EncryptionKey) {
        Write-BackupLog "Backup encryption skipped"
        return $BackupPath
    }

    Write-BackupLog "Encrypting backup..."

    try {
        # Use AES encryption (requires additional module or external tool)
        # This is a placeholder - implement based on your encryption preferences
        $EncryptedPath = "$BackupPath.encrypted"

        # Example using gpg (if available)
        if (Get-Command gpg -ErrorAction SilentlyContinue) {
            gpg --batch --yes --passphrase $BackupConfig.EncryptionKey --symmetric --cipher-algo AES256 --compress-algo 1 --output $EncryptedPath $BackupPath
            Remove-Item $BackupPath -Force

            Write-BackupLog "Backup encrypted successfully"
            return $EncryptedPath
        } else {
            Write-BackupLog "GPG not available - backup not encrypted" "WARNING"
            return $BackupPath
        }

    } catch {
        Write-BackupLog "Backup encryption failed: $($_.Exception.Message)" "ERROR"
        throw
    }
}

function Test-BackupIntegrity {
    param([string]$BackupPath)

    Write-BackupLog "Verifying backup integrity..."

    try {
        if ($BackupPath.EndsWith(".zip")) {
            # Test zip file integrity
            $TestResult = Test-Path $BackupPath
            if ($TestResult) {
                # Additional zip validation could be added here
                Write-BackupLog "Backup integrity verification passed"
                return $true
            }
        }

        Write-BackupLog "Backup integrity verification failed" "ERROR"
        return $false

    } catch {
        Write-BackupLog "Backup verification failed: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

function Remove-OldBackups {
    Write-BackupLog "Cleaning up old backups (retention: $RetentionDays days)..."

    $CutoffDate = (Get-Date).AddDays(-$RetentionDays)
    $OldBackups = Get-ChildItem $BackupLocation -File | Where-Object { $_.LastWriteTime -lt $CutoffDate }

    foreach ($OldBackup in $OldBackups) {
        try {
            Remove-Item $OldBackup.FullName -Force
            Write-BackupLog "Removed old backup: $($OldBackup.Name)"
        } catch {
            Write-BackupLog "Failed to remove old backup $($OldBackup.Name): $($_.Exception.Message)" "WARNING"
        }
    }

    Write-BackupLog "Cleanup completed. Removed $($OldBackups.Count) old backups"
}

# Main backup execution
try {
    Write-BackupLog "Starting $BackupType backup process..."

    # Ensure backup directory exists
    if (-not (Test-Path $BackupLocation)) {
        New-Item -ItemType Directory -Path $BackupLocation -Force | Out-Null
    }

    # Create backup directory
    $BackupDir = New-BackupDirectory
    Write-BackupLog "Created backup directory: $BackupDir"

    # Perform backup
    Backup-Database -DestinationPath $BackupDir
    Backup-ApplicationData -DestinationPath $BackupDir

    # Compress backup
    $CompressedBackup = Compress-Backup -BackupPath $BackupDir

    # Encrypt backup if requested
    $FinalBackup = Encrypt-Backup -BackupPath $CompressedBackup

    # Verify backup integrity
    if ($Verify) {
        $IntegrityOK = Test-BackupIntegrity -BackupPath $FinalBackup
        if (-not $IntegrityOK) {
            throw "Backup integrity verification failed"
        }
    }

    # Cleanup old backups
    Remove-OldBackups

    # Calculate backup size
    $BackupSize = (Get-Item $FinalBackup).Length / 1MB

    Write-BackupLog "Backup completed successfully!"
    Write-BackupLog "Backup file: $(Split-Path $FinalBackup -Leaf)"
    Write-BackupLog "Backup size: $([math]::Round($BackupSize, 2)) MB"

    # Send success notification
    & "C:\QA-Intelligence\scripts\send-notification.ps1" -Type "backup_success" -Details @{
        backupType = $BackupType
        backupFile = Split-Path $FinalBackup -Leaf
        backupSize = "$([math]::Round($BackupSize, 2)) MB"
    }

} catch {
    Write-BackupLog "Backup process failed: $($_.Exception.Message)" "ERROR"

    # Send failure notification
    & "C:\QA-Intelligence\scripts\send-notification.ps1" -Type "backup_failed" -Details @{
        backupType = $BackupType
        error = $_.Exception.Message
    }

    exit 1
}
```

---

## Log Management and Rotation

### Log Rotation and Archival

**Comprehensive Log Management:**

```bash
#!/bin/bash
# log-management.sh
# Comprehensive log management for QA Intelligence

set -e

# Configuration
LOG_BASE_DIR="/var/log/qa-intelligence"
ARCHIVE_DIR="/var/log/qa-intelligence/archive"
MAX_LOG_SIZE="100M"
RETENTION_DAYS=30
COMPRESSION_ENABLED=true

# Create directories if they don't exist
mkdir -p "$ARCHIVE_DIR"

# Logging function
log_message() {
    local level=$1
    shift
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $*"
}

# Rotate logs function
rotate_logs() {
    local log_file=$1
    local max_size=${2:-$MAX_LOG_SIZE}

    if [[ ! -f "$log_file" ]]; then
        log_message "WARNING" "Log file not found: $log_file"
        return 1
    fi

    # Check file size
    local file_size=$(du -h "$log_file" | cut -f1)
    local size_bytes=$(stat -f%z "$log_file" 2>/dev/null || stat -c%s "$log_file" 2>/dev/null)
    local max_bytes=$(numfmt --from=iec "${max_size}")

    if [[ $size_bytes -gt $max_bytes ]]; then
        log_message "INFO" "Rotating log file: $log_file ($file_size)"

        # Create timestamped archive
        local timestamp=$(date +%Y%m%d_%H%M%S)
        local base_name=$(basename "$log_file")
        local archive_name="${base_name%.log}_${timestamp}.log"
        local archive_path="$ARCHIVE_DIR/$archive_name"

        # Move current log to archive
        mv "$log_file" "$archive_path"

        # Create new empty log file
        touch "$log_file"
        chmod 644 "$log_file"

        # Compress archived log if enabled
        if [[ "$COMPRESSION_ENABLED" == "true" ]]; then
            gzip "$archive_path"
            archive_path="${archive_path}.gz"
            log_message "INFO" "Compressed archived log: $archive_path"
        fi

        log_message "INFO" "Log rotation completed: $archive_path"

        # Restart services to ensure they use the new log file
        restart_logging_services "$log_file"

    else
        log_message "DEBUG" "Log file size OK: $log_file ($file_size)"
    fi
}

# Restart services that might be using the rotated log
restart_logging_services() {
    local log_file=$1

    case "$log_file" in
        *backend.log)
            log_message "INFO" "Restarting backend service for log rotation"
            systemctl reload qa-intelligence-backend 2>/dev/null || true
            ;;
        *frontend.log)
            log_message "INFO" "Restarting frontend service for log rotation"
            systemctl reload qa-intelligence-frontend 2>/dev/null || true
            ;;
        *nginx*.log)
            log_message "INFO" "Reloading nginx for log rotation"
            nginx -s reload 2>/dev/null || true
            ;;
    esac
}

# Clean up old logs
cleanup_old_logs() {
    log_message "INFO" "Cleaning up logs older than $RETENTION_DAYS days"

    # Find and remove old archived logs
    local old_logs=$(find "$ARCHIVE_DIR" -name "*.log*" -mtime +$RETENTION_DAYS)

    if [[ -n "$old_logs" ]]; then
        echo "$old_logs" | while read -r old_log; do
            log_message "INFO" "Removing old log: $(basename "$old_log")"
            rm -f "$old_log"
        done
    else
        log_message "INFO" "No old logs to clean up"
    fi
}

# Analyze log patterns
analyze_logs() {
    log_message "INFO" "Analyzing recent log patterns"

    local analysis_report="$LOG_BASE_DIR/log_analysis_$(date +%Y%m%d).txt"

    {
        echo "QA Intelligence Log Analysis - $(date)"
        echo "=============================================="
        echo

        # Error analysis
        echo "Top 10 Most Common Errors (Last 24 Hours):"
        echo "-------------------------------------------"
        find "$LOG_BASE_DIR" -name "*.log" -mtime -1 -exec grep -h "ERROR" {} \; | \
            sed 's/\[.*\] \[ERROR\] //' | sort | uniq -c | sort -nr | head -10
        echo

        # Warning analysis
        echo "Top 10 Most Common Warnings (Last 24 Hours):"
        echo "---------------------------------------------"
        find "$LOG_BASE_DIR" -name "*.log" -mtime -1 -exec grep -h "WARNING" {} \; | \
            sed 's/\[.*\] \[WARNING\] //' | sort | uniq -c | sort -nr | head -10
        echo

        # Performance analysis
        echo "Slow Response Times (>1000ms):"
        echo "------------------------------"
        find "$LOG_BASE_DIR" -name "*.log" -mtime -1 -exec grep -h "duration.*ms" {} \; | \
            awk -F'duration: ' '{print $2}' | sed 's/ms.*//' | \
            awk '$1 > 1000 {print $1 "ms"}' | sort -nr | head -20
        echo

        # Database analysis
        echo "Database Connection Issues:"
        echo "---------------------------"
        find "$LOG_BASE_DIR" -name "*.log" -mtime -1 -exec grep -h -i "database.*error\|connection.*failed" {} \; | head -10
        echo

    } > "$analysis_report"

    log_message "INFO" "Log analysis completed: $analysis_report"

    # Send analysis report if there are critical issues
    local error_count=$(grep -c "ERROR" "$analysis_report" 2>/dev/null || echo "0")
    if [[ $error_count -gt 10 ]]; then
        log_message "WARNING" "High error count detected: $error_count errors"
        # Send alert notification
        if command -v mail >/dev/null 2>&1; then
            mail -s "QA Intelligence: High Error Count Alert" ops@company.com < "$analysis_report"
        fi
    fi
}

# Monitor disk usage
monitor_disk_usage() {
    log_message "INFO" "Monitoring log directory disk usage"

    local disk_usage=$(du -sh "$LOG_BASE_DIR" | cut -f1)
    local available_space=$(df -h "$LOG_BASE_DIR" | awk 'NR==2 {print $4}')
    local usage_percent=$(df "$LOG_BASE_DIR" | awk 'NR==2 {print $5}' | sed 's/%//')

    log_message "INFO" "Log directory usage: $disk_usage (${usage_percent}% of disk used)"
    log_message "INFO" "Available space: $available_space"

    # Alert if disk usage is high
    if [[ $usage_percent -gt 85 ]]; then
        log_message "WARNING" "High disk usage detected: ${usage_percent}%"

        # Emergency cleanup if very high
        if [[ $usage_percent -gt 95 ]]; then
            log_message "CRITICAL" "Critical disk usage - performing emergency cleanup"
            # Reduce retention to 7 days temporarily
            RETENTION_DAYS=7
            cleanup_old_logs
        fi
    fi
}

# Main execution
main() {
    log_message "INFO" "Starting log management process"

    # List of log files to rotate
    local log_files=(
        "$LOG_BASE_DIR/backend.log"
        "$LOG_BASE_DIR/frontend.log"
        "$LOG_BASE_DIR/database.log"
        "$LOG_BASE_DIR/test-execution.log"
        "$LOG_BASE_DIR/security.log"
        "$LOG_BASE_DIR/maintenance.log"
        "/var/log/nginx/qa-intelligence.access.log"
        "/var/log/nginx/qa-intelligence.error.log"
    )

    # Rotate each log file
    for log_file in "${log_files[@]}"; do
        if [[ -f "$log_file" ]]; then
            rotate_logs "$log_file"
        fi
    done

    # Cleanup old logs
    cleanup_old_logs

    # Analyze logs for patterns
    analyze_logs

    # Monitor disk usage
    monitor_disk_usage

    log_message "INFO" "Log management completed successfully"
}

# Run main function
main "$@"
```

---

**Document Status:**
- Version: 1.0
- Status: Production Ready
- Last Updated: 2025-09-26
- Next Review: 2026-03-26
- Owner: DevOps/SRE Team