# QA Intelligence CI/CD Troubleshooting Guide

**Version:** 1.0
**Last Updated:** 2025-09-26
**Owner:** DevOps/SRE Team
**Classification:** Internal Technical Reference

> **DIAGNOSTIC STATUS**: Comprehensive troubleshooting procedures for all system components

## Table of Contents

1. [Quick Diagnosis Framework](#quick-diagnosis-framework)
2. [Service-Specific Troubleshooting](#service-specific-troubleshooting)
3. [Database Issues](#database-issues)
4. [Network and Connectivity Issues](#network-and-connectivity-issues)
5. [Performance Issues](#performance-issues)
6. [Authentication and Authorization Issues](#authentication-and-authorization-issues)
7. [WeSign Integration Issues](#wesign-integration-issues)
8. [CI/CD Pipeline Issues](#cicd-pipeline-issues)
9. [Log Analysis and Debugging](#log-analysis-and-debugging)
10. [Emergency Recovery Procedures](#emergency-recovery-procedures)

---

## Quick Diagnosis Framework

### Systematic Troubleshooting Approach

**The 5-Step Diagnostic Process:**

```yaml
diagnostic_process:
  step_1_triage:
    duration: "1-2 minutes"
    actions:
      - Check system health endpoints
      - Verify core services are running
      - Check recent error logs
      - Identify scope of impact

  step_2_isolation:
    duration: "2-5 minutes"
    actions:
      - Isolate affected components
      - Test component dependencies
      - Check configuration changes
      - Verify environment variables

  step_3_analysis:
    duration: "5-15 minutes"
    actions:
      - Analyze error patterns
      - Check resource utilization
      - Review recent deployments
      - Examine external dependencies

  step_4_resolution:
    duration: "Variable"
    actions:
      - Apply known fixes
      - Restart services if needed
      - Rollback recent changes
      - Scale resources if required

  step_5_verification:
    duration: "2-5 minutes"
    actions:
      - Verify fix effectiveness
      - Test affected functionality
      - Monitor for recurring issues
      - Document resolution
```

### Emergency Diagnostic Script

```powershell
# Emergency-Diagnostics.ps1
# Quick system health assessment

param(
    [switch]$Detailed,
    [string]$OutputPath = "C:\QA-Intelligence\logs\diagnostics"
)

$DiagnosticTimestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$DiagnosticFile = Join-Path $OutputPath "emergency-diagnostic-$DiagnosticTimestamp.json"

function Test-SystemHealth {
    $Health = @{
        timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss UTC"
        system_status = "unknown"
        services = @{}
        endpoints = @{}
        resources = @{}
        recent_errors = @()
        recommendations = @()
    }

    Write-Host "🔍 QA Intelligence Emergency Diagnostics" -ForegroundColor Cyan
    Write-Host "=========================================" -ForegroundColor Cyan

    # 1. Check Core Services
    Write-Host "1. Checking core services..." -ForegroundColor Yellow

    $Services = @(
        @{Name="Backend API"; Process="node"; Port=8082; Url="http://localhost:8082/api/health"},
        @{Name="Frontend"; Process="node"; Port=3001; Url="http://localhost:3001/api/health"},
        @{Name="Jenkins"; Process="java"; Port=8080; Url="http://localhost:8080/login"}
    )

    foreach ($Service in $Services) {
        try {
            $Response = Invoke-RestMethod -Uri $Service.Url -TimeoutSec 10 -ErrorAction Stop
            $Health.services[$Service.Name] = @{
                status = "healthy"
                response_time = "< 10s"
                details = $Response
            }
            Write-Host "   ✅ $($Service.Name): Healthy" -ForegroundColor Green
        }
        catch {
            $Health.services[$Service.Name] = @{
                status = "unhealthy"
                error = $_.Exception.Message
            }
            Write-Host "   ❌ $($Service.Name): Failed - $($_.Exception.Message)" -ForegroundColor Red
            $Health.recommendations += "Check $($Service.Name) service logs and restart if necessary"
        }
    }

    # 2. Check System Resources
    Write-Host "2. Checking system resources..." -ForegroundColor Yellow

    $CPU = Get-Counter "\Processor(_Total)\% Processor Time" | Select-Object -ExpandProperty CounterSamples | Select-Object -ExpandProperty CookedValue
    $Memory = Get-Counter "\Memory\Available MBytes" | Select-Object -ExpandProperty CounterSamples | Select-Object -ExpandProperty CookedValue
    $TotalMemory = (Get-WmiObject -Class Win32_ComputerSystem).TotalPhysicalMemory / 1MB
    $MemoryUsage = [math]::Round((($TotalMemory - $Memory) / $TotalMemory) * 100, 2)

    $Health.resources = @{
        cpu_usage = [math]::Round($CPU, 2)
        memory_usage_percent = $MemoryUsage
        memory_available_mb = [math]::Round($Memory, 0)
        disk_free_gb = [math]::Round((Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='C:'").FreeSpace / 1GB, 2)
    }

    Write-Host "   CPU Usage: $([math]::Round($CPU, 2))%" -ForegroundColor $(if($CPU -gt 80) {"Red"} elseif($CPU -gt 60) {"Yellow"} else {"Green"})
    Write-Host "   Memory Usage: $MemoryUsage%" -ForegroundColor $(if($MemoryUsage -gt 90) {"Red"} elseif($MemoryUsage -gt 75) {"Yellow"} else {"Green"})
    Write-Host "   Disk Free: $([math]::Round((Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='C:'").FreeSpace / 1GB, 2)) GB" -ForegroundColor Green

    # Add resource recommendations
    if ($CPU -gt 80) { $Health.recommendations += "High CPU usage detected - check for resource-intensive processes" }
    if ($MemoryUsage -gt 90) { $Health.recommendations += "High memory usage detected - consider restarting services or adding more RAM" }

    # 3. Check Recent Errors
    Write-Host "3. Checking recent errors..." -ForegroundColor Yellow

    $LogPaths = @(
        "C:\QA-Intelligence\backend\logs\backend.log",
        "C:\QA-Intelligence\logs\maintenance.log",
        "C:\jenkins\logs\jenkins.log"
    )

    foreach ($LogPath in $LogPaths) {
        if (Test-Path $LogPath) {
            $RecentErrors = Get-Content $LogPath -Tail 100 | Select-String "ERROR|CRITICAL|FATAL"
            if ($RecentErrors) {
                $Health.recent_errors += $RecentErrors[-5..-1] | ForEach-Object { $_.Line }
                Write-Host "   ⚠️ Found $($RecentErrors.Count) recent errors in $(Split-Path $LogPath -Leaf)" -ForegroundColor Red
            }
        }
    }

    # 4. Determine Overall Status
    $UnhealthyServices = $Health.services.Values | Where-Object { $_.status -eq "unhealthy" }
    $HighResourceUsage = ($CPU -gt 90) -or ($MemoryUsage -gt 95)
    $CriticalErrors = $Health.recent_errors.Count -gt 10

    if ($UnhealthyServices.Count -eq 0 -and -not $HighResourceUsage -and -not $CriticalErrors) {
        $Health.system_status = "healthy"
        Write-Host "✅ System Status: HEALTHY" -ForegroundColor Green
    }
    elseif ($UnhealthyServices.Count -le 1 -and -not $CriticalErrors) {
        $Health.system_status = "degraded"
        Write-Host "⚠️ System Status: DEGRADED" -ForegroundColor Yellow
    }
    else {
        $Health.system_status = "critical"
        Write-Host "❌ System Status: CRITICAL" -ForegroundColor Red
    }

    # 5. Save Diagnostic Report
    New-Item -ItemType Directory -Path $OutputPath -Force -ErrorAction SilentlyContinue | Out-Null
    $Health | ConvertTo-Json -Depth 5 | Out-File $DiagnosticFile -Encoding UTF8

    Write-Host "`n📋 Diagnostic report saved: $DiagnosticFile" -ForegroundColor Cyan

    if ($Health.recommendations.Count -gt 0) {
        Write-Host "`n🔧 Recommendations:" -ForegroundColor Cyan
        foreach ($Recommendation in $Health.recommendations) {
            Write-Host "   • $Recommendation" -ForegroundColor White
        }
    }

    return $Health
}

# Run diagnostics
$DiagnosticResults = Test-SystemHealth

# Auto-remediation for common issues
if ($DiagnosticResults.system_status -in @("degraded", "critical")) {
    Write-Host "`n🔄 Attempting automatic remediation..." -ForegroundColor Cyan

    # Restart unhealthy services
    foreach ($ServiceName in $DiagnosticResults.services.Keys) {
        if ($DiagnosticResults.services[$ServiceName].status -eq "unhealthy") {
            Write-Host "   🔄 Attempting to restart $ServiceName..." -ForegroundColor Yellow

            switch ($ServiceName) {
                "Backend API" {
                    try {
                        cd "C:\QA-Intelligence\backend"
                        Start-Process "pm2" -ArgumentList "restart", "qa-intelligence-backend" -Wait -WindowStyle Hidden
                        Start-Sleep 10

                        # Test if service is now healthy
                        $TestResponse = Invoke-RestMethod -Uri "http://localhost:8082/api/health" -TimeoutSec 10 -ErrorAction Stop
                        Write-Host "   ✅ Backend API restarted successfully" -ForegroundColor Green
                    }
                    catch {
                        Write-Host "   ❌ Failed to restart Backend API: $($_.Exception.Message)" -ForegroundColor Red
                    }
                }
                "Frontend" {
                    try {
                        cd "C:\QA-Intelligence\apps\frontend\dashboard"
                        Start-Process "pm2" -ArgumentList "restart", "qa-intelligence-frontend" -Wait -WindowStyle Hidden
                        Start-Sleep 10
                        Write-Host "   ✅ Frontend restarted successfully" -ForegroundColor Green
                    }
                    catch {
                        Write-Host "   ❌ Failed to restart Frontend: $($_.Exception.Message)" -ForegroundColor Red
                    }
                }
            }
        }
    }
}

# Final status
Write-Host "`n📊 Emergency Diagnostic Summary:" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host "System Status: $($DiagnosticResults.system_status.ToUpper())" -ForegroundColor $(if($DiagnosticResults.system_status -eq "healthy") {"Green"} elseif($DiagnosticResults.system_status -eq "degraded") {"Yellow"} else {"Red"})
Write-Host "Services Healthy: $($DiagnosticResults.services.Values | Where-Object {$_.status -eq 'healthy'} | Measure-Object).Count / $($DiagnosticResults.services.Count)"
Write-Host "CPU Usage: $($DiagnosticResults.resources.cpu_usage)%"
Write-Host "Memory Usage: $($DiagnosticResults.resources.memory_usage_percent)%"
Write-Host "Recent Errors: $($DiagnosticResults.recent_errors.Count)"
```

---

## Service-Specific Troubleshooting

### Backend API Issues

**Common Backend Problems and Solutions:**

#### Issue: Backend Service Won't Start

**Symptoms:**
- `http://localhost:8082/api/health` returns connection refused
- PM2 shows service as "errored" or "stopped"
- No response from backend endpoints

**Diagnostic Steps:**
```powershell
# Check PM2 status
pm2 status

# View backend logs
pm2 logs qa-intelligence-backend --lines 50

# Check port usage
netstat -ano | findstr :8082

# Verify environment variables
node -e "console.log('NODE_ENV:', process.env.NODE_ENV); console.log('PORT:', process.env.PORT)"
```

**Solutions:**
```powershell
# Solution 1: Restart with fresh configuration
pm2 stop qa-intelligence-backend
pm2 delete qa-intelligence-backend
cd C:\QA-Intelligence\backend
npm run build
pm2 start ecosystem.config.js --only qa-intelligence-backend

# Solution 2: Check and fix database connection
node scripts/test-db-connection.js

# Solution 3: Clear npm cache and reinstall dependencies
npm cache clean --force
rm -rf node_modules
npm install

# Solution 4: Check file permissions (Linux/Mac)
chmod +x dist/server.js
```

#### Issue: High Memory Usage

**Symptoms:**
- Backend consumes >1GB RAM
- Frequent out-of-memory errors
- Slow API responses

**Diagnostic Steps:**
```javascript
// backend/scripts/memory-analysis.js
const v8 = require('v8');
const fs = require('fs');

function analyzeMemoryUsage() {
  const usage = process.memoryUsage();
  const heapStats = v8.getHeapStatistics();

  console.log('Memory Usage Analysis:');
  console.log('=====================');
  console.log(`RSS: ${Math.round(usage.rss / 1024 / 1024)} MB`);
  console.log(`Heap Used: ${Math.round(usage.heapUsed / 1024 / 1024)} MB`);
  console.log(`Heap Total: ${Math.round(usage.heapTotal / 1024 / 1024)} MB`);
  console.log(`External: ${Math.round(usage.external / 1024 / 1024)} MB`);
  console.log(`Heap Limit: ${Math.round(heapStats.heap_size_limit / 1024 / 1024)} MB`);

  // Check for memory leaks
  const heapUsagePercent = (usage.heapUsed / heapStats.heap_size_limit) * 100;
  if (heapUsagePercent > 80) {
    console.log('⚠️ High heap usage detected - possible memory leak');
  }

  // Generate heap snapshot for analysis
  const snapshot = v8.writeHeapSnapshot();
  console.log(`Heap snapshot saved: ${snapshot}`);
}

analyzeMemoryUsage();
```

**Solutions:**
```javascript
// Implement memory optimization
app.use((req, res, next) => {
  // Monitor memory usage per request
  const startMemory = process.memoryUsage().heapUsed;

  res.on('finish', () => {
    const endMemory = process.memoryUsage().heapUsed;
    const memoryDelta = endMemory - startMemory;

    if (memoryDelta > 50 * 1024 * 1024) { // 50MB
      console.log(`High memory request: ${req.path} (+${Math.round(memoryDelta / 1024 / 1024)}MB)`);
    }

    // Force GC for high-memory requests
    if (global.gc && memoryDelta > 100 * 1024 * 1024) {
      global.gc();
    }
  });

  next();
});

// Increase Node.js heap size
// Start with: node --max-old-space-size=2048 dist/server.js
```

### Frontend Issues

#### Issue: Frontend Build Failures

**Symptoms:**
- `npm run build` fails
- TypeScript compilation errors
- Missing dependencies

**Diagnostic Steps:**
```bash
# Check Node.js and npm versions
node --version
npm --version

# Clear cache and reinstall
npm cache clean --force
rm -rf node_modules package-lock.json
npm install

# Check for TypeScript errors
npm run type-check

# Analyze bundle size
npm run build -- --analyze
```

**Solutions:**
```bash
# Solution 1: Fix TypeScript errors
npm run type-check -- --listFiles | grep -E '\.(ts|tsx)$'

# Solution 2: Update dependencies
npm audit fix
npm update

# Solution 3: Reset and rebuild
rm -rf .next node_modules package-lock.json
npm install
npm run build

# Solution 4: Check environment variables
printenv | grep NEXT_PUBLIC
```

---

## Database Issues

### SQLite Issues

#### Issue: Database Locked

**Symptoms:**
- "database is locked" error
- Write operations hanging
- API endpoints timing out

**Diagnostic Steps:**
```bash
# Check for lock files
ls -la memory.sqlite*

# Check process using database
lsof memory.sqlite  # Linux/Mac
handle memory.sqlite  # Windows

# Test database connection
sqlite3 memory.sqlite "PRAGMA integrity_check;"
```

**Solutions:**
```javascript
// backend/scripts/fix-database-lock.js
const sqlite3 = require('sqlite3');
const fs = require('fs');

async function fixDatabaseLock() {
  const dbPath = './memory.sqlite';

  try {
    // Check if database file exists
    if (!fs.existsSync(dbPath)) {
      throw new Error('Database file not found');
    }

    // Try to connect with a timeout
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        console.error('Failed to connect to database:', err.message);

        // Check for WAL files (Write-Ahead Logging)
        const walPath = dbPath + '-wal';
        const shmPath = dbPath + '-shm';

        if (fs.existsSync(walPath) || fs.existsSync(shmPath)) {
          console.log('Found WAL/SHM files, attempting recovery...');

          // Close WAL mode and integrate changes
          db.run('PRAGMA journal_mode=DELETE;', (err) => {
            if (!err) {
              console.log('Successfully switched from WAL mode');
              // Remove WAL and SHM files
              if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
              if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
            }
          });
        }
        return;
      }
      console.log('Database connection successful');
    });

    // Set busy timeout
    db.run('PRAGMA busy_timeout = 30000;');

    // Test with a simple query
    db.get('SELECT 1 as test;', (err, row) => {
      if (err) {
        console.error('Database test query failed:', err.message);
      } else {
        console.log('Database test query successful:', row);
      }
      db.close();
    });

  } catch (error) {
    console.error('Database recovery failed:', error.message);

    // Last resort: backup and recreate
    console.log('Attempting database backup and recreation...');
    const backupPath = dbPath + '.backup.' + Date.now();
    fs.copyFileSync(dbPath, backupPath);
    console.log(`Database backed up to: ${backupPath}`);
  }
}

fixDatabaseLock();
```

#### Issue: Database Corruption

**Symptoms:**
- "database disk image is malformed" error
- Data inconsistencies
- Query failures

**Solutions:**
```bash
# Backup current database
cp memory.sqlite memory.sqlite.backup

# Check integrity
sqlite3 memory.sqlite "PRAGMA integrity_check;"

# Attempt repair
sqlite3 memory.sqlite ".recover" | sqlite3 memory_recovered.sqlite

# If recovery fails, restore from latest backup
cp backups/latest/memory.sqlite ./memory.sqlite

# Restart services
pm2 restart qa-intelligence-backend
```

### PostgreSQL Issues

#### Issue: Connection Pool Exhaustion

**Symptoms:**
- "remaining connection slots are reserved" error
- New connections refused
- Application hanging

**Diagnostic Steps:**
```sql
-- Check current connections
SELECT count(*) as total_connections FROM pg_stat_activity;

-- Check connection by state
SELECT state, count(*) FROM pg_stat_activity GROUP BY state;

-- Check long-running queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';
```

**Solutions:**
```javascript
// backend/src/config/database.js
const { Pool } = require('pg');

// Optimize connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                    // Reduce max connections
  min: 2,                     // Minimum connections
  idle: 10000,               // 10 seconds idle timeout
  connectionTimeoutMillis: 5000,  // 5 second connection timeout
  idleTimeoutMillis: 30000,  // 30 second idle timeout
  maxUses: 7500,             // Close connection after 7500 uses
  allowExitOnIdle: true
});

// Monitor pool events
pool.on('connect', (client) => {
  console.log('Database client connected');
});

pool.on('remove', (client) => {
  console.log('Database client removed');
});

pool.on('error', (err, client) => {
  console.error('Database pool error:', err.message);
});

// Graceful shutdown
process.on('SIGINT', () => {
  pool.end(() => {
    console.log('Database pool has ended');
    process.exit(0);
  });
});
```

---

## Network and Connectivity Issues

### Port Conflicts

#### Issue: "Port Already in Use"

**Diagnostic Steps:**
```powershell
# Windows: Check what's using the port
netstat -ano | findstr :8082
tasklist /fi "PID eq [PID_FROM_ABOVE]"

# Kill process using the port
taskkill /PID [PID] /F

# Linux/Mac: Check port usage
lsof -i :8082
netstat -tulpn | grep :8082

# Kill process using the port
kill -9 [PID]
```

### Firewall Issues

#### Issue: Services Unreachable

**Windows Firewall Diagnostics:**
```powershell
# Check firewall status
Get-NetFirewallProfile | Select-Object Name,Enabled

# Check existing rules for QA Intelligence
Get-NetFirewallRule -DisplayName "*QA Intelligence*" | Select-Object DisplayName,Enabled,Direction,Action

# Test port connectivity
Test-NetConnection -ComputerName localhost -Port 8082

# Add firewall rules if missing
New-NetFirewallRule -DisplayName "QA Intelligence Backend" -Direction Inbound -LocalPort 8082 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "QA Intelligence Frontend" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow
```

### DNS and Host Resolution

#### Issue: Cannot Connect to WeSign

**Diagnostic Steps:**
```powershell
# Test DNS resolution
nslookup devtest.comda.co.il

# Test connectivity
Test-NetConnection -ComputerName devtest.comda.co.il -Port 443

# Check hosts file for any overrides
Get-Content C:\Windows\System32\drivers\etc\hosts | Select-String "comda.co.il"

# Test with curl
curl -I https://devtest.comda.co.il/
```

**Solutions:**
```powershell
# Flush DNS cache
ipconfig /flushdns

# Reset network stack (requires restart)
netsh winsock reset
netsh int ip reset

# Temporary DNS override (if needed)
Add-Content C:\Windows\System32\drivers\etc\hosts "IP_ADDRESS devtest.comda.co.il"
```

---

## Performance Issues

### High Response Times

#### Issue: API Endpoints Slow (>2s)

**Diagnostic Steps:**
```javascript
// backend/scripts/performance-profiler.js
const express = require('express');
const app = express();

// Performance monitoring middleware
app.use((req, res, next) => {
  const startTime = process.hrtime.bigint();

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const responseTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds

    if (responseTime > 2000) {
      console.log(`🐌 Slow response detected:`, {
        method: req.method,
        path: req.path,
        responseTime: `${responseTime.toFixed(2)}ms`,
        statusCode: res.statusCode,
        userAgent: req.get('User-Agent'),
        contentLength: res.get('Content-Length')
      });

      // Log slow query if database related
      if (req.path.includes('/api/') && responseTime > 5000) {
        console.log(`🔍 Investigating slow endpoint: ${req.method} ${req.path}`);
        // Add database query logging here
      }
    }
  });

  next();
});
```

**Solutions:**
```javascript
// Implement caching for slow endpoints
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300 }); // 5 minute cache

app.get('/api/analytics/dashboard', (req, res) => {
  const cacheKey = `dashboard_${req.user.id}`;
  const cachedData = cache.get(cacheKey);

  if (cachedData) {
    return res.json(cachedData);
  }

  // Expensive operation
  getDashboardData(req.user.id)
    .then(data => {
      cache.set(cacheKey, data);
      res.json(data);
    })
    .catch(err => res.status(500).json({ error: err.message }));
});

// Optimize database queries
const optimizedQuery = `
  SELECT t.id, t.name, t.status, t.duration,
         COUNT(tr.id) as test_count
  FROM test_executions t
  LEFT JOIN test_results tr ON t.id = tr.execution_id
  WHERE t.created_at >= $1
  GROUP BY t.id, t.name, t.status, t.duration
  ORDER BY t.created_at DESC
  LIMIT $2
`;
```

### Memory Leaks

#### Issue: Memory Usage Continuously Growing

**Diagnostic Script:**
```javascript
// backend/scripts/memory-leak-detector.js
const memwatch = require('@airbnb/node-memwatch');

class MemoryLeakDetector {
  constructor() {
    this.measurements = [];
    this.leakThreshold = 50 * 1024 * 1024; // 50MB
    this.measurementInterval = 60000; // 1 minute

    this.startMonitoring();
  }

  startMonitoring() {
    // Take memory measurements
    setInterval(() => {
      const usage = process.memoryUsage();
      this.measurements.push({
        timestamp: Date.now(),
        heapUsed: usage.heapUsed,
        rss: usage.rss
      });

      // Keep only last 30 measurements
      if (this.measurements.length > 30) {
        this.measurements.shift();
      }

      this.detectLeak();
    }, this.measurementInterval);

    // Listen for memory warnings
    memwatch.on('leak', (info) => {
      console.log('🚨 Memory leak detected:', info);
      this.handleMemoryLeak(info);
    });

    memwatch.on('stats', (stats) => {
      console.log('📊 GC Stats:', {
        num_full_gc: stats.num_full_gc,
        num_inc_gc: stats.num_inc_gc,
        heap_compactions: stats.heap_compactions,
        estimated_base: Math.round(stats.estimated_base / 1024 / 1024) + ' MB'
      });
    });
  }

  detectLeak() {
    if (this.measurements.length < 5) return;

    const recent = this.measurements.slice(-5);
    const oldest = recent[0];
    const newest = recent[recent.length - 1];

    const heapGrowth = newest.heapUsed - oldest.heapUsed;
    const timespan = newest.timestamp - oldest.timestamp;

    // Check if heap is growing consistently
    if (heapGrowth > this.leakThreshold && timespan > 300000) { // 5 minutes
      console.log('⚠️ Potential memory leak detected:', {
        heapGrowth: Math.round(heapGrowth / 1024 / 1024) + ' MB',
        timespan: Math.round(timespan / 1000 / 60) + ' minutes',
        currentHeap: Math.round(newest.heapUsed / 1024 / 1024) + ' MB'
      });

      this.generateHeapSnapshot();
    }
  }

  generateHeapSnapshot() {
    const v8 = require('v8');
    const fs = require('fs');

    const snapshot = v8.writeHeapSnapshot();
    console.log(`📸 Heap snapshot saved: ${snapshot}`);

    // Notify administrators
    this.notifyAdministrators({
      type: 'memory_leak',
      snapshot,
      currentUsage: process.memoryUsage()
    });
  }

  handleMemoryLeak(info) {
    // Force garbage collection
    if (global.gc) {
      global.gc();
      console.log('🗑️ Forced garbage collection');
    }

    // Log top memory consumers
    this.logTopMemoryConsumers();

    // Consider restarting if memory usage is critical
    const usage = process.memoryUsage();
    if (usage.heapUsed > 1.5 * 1024 * 1024 * 1024) { // 1.5GB
      console.log('🚨 Critical memory usage - recommend restart');
    }
  }
}

// Start monitoring
const detector = new MemoryLeakDetector();
```

---

## Authentication and Authorization Issues

### JWT Token Issues

#### Issue: "Invalid or Expired Token"

**Diagnostic Steps:**
```javascript
// backend/scripts/jwt-debugger.js
const jwt = require('jsonwebtoken');

function debugJWT(token, secret) {
  try {
    // Decode without verification first
    const decoded = jwt.decode(token, { complete: true });
    console.log('JWT Header:', decoded.header);
    console.log('JWT Payload:', decoded.payload);

    // Check expiration
    if (decoded.payload.exp) {
      const expiry = new Date(decoded.payload.exp * 1000);
      const now = new Date();
      console.log('Token expires:', expiry);
      console.log('Current time:', now);
      console.log('Token expired:', now > expiry);
    }

    // Verify signature
    const verified = jwt.verify(token, secret);
    console.log('✅ Token is valid');
    return verified;

  } catch (error) {
    console.log('❌ Token validation failed:', error.message);

    if (error.name === 'TokenExpiredError') {
      console.log('Token expired at:', error.expiredAt);
    } else if (error.name === 'JsonWebTokenError') {
      console.log('Invalid token structure or signature');
    } else if (error.name === 'NotBeforeError') {
      console.log('Token not active until:', error.date);
    }

    return null;
  }
}

// Usage example
const token = 'your-jwt-token-here';
const secret = process.env.JWT_SECRET;
debugJWT(token, secret);
```

**Solutions:**
```javascript
// Enhanced JWT middleware with better error handling
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'NO_TOKEN',
      message: 'Access token is required'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user still exists
    const user = getUserById(decoded.userId);
    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        error: 'USER_INACTIVE',
        message: 'User account is inactive'
      });
    }

    req.user = decoded;
    next();

  } catch (error) {
    let errorResponse = {
      success: false,
      error: 'INVALID_TOKEN',
      message: 'Invalid access token'
    };

    if (error.name === 'TokenExpiredError') {
      errorResponse.error = 'TOKEN_EXPIRED';
      errorResponse.message = 'Access token has expired';
      errorResponse.expiredAt = error.expiredAt;
    } else if (error.name === 'JsonWebTokenError') {
      errorResponse.error = 'MALFORMED_TOKEN';
      errorResponse.message = 'Token is malformed';
    }

    return res.status(401).json(errorResponse);
  }
}
```

### Session Management Issues

#### Issue: Users Getting Logged Out Frequently

**Diagnostic Steps:**
```javascript
// Monitor session lifecycle
app.use((req, res, next) => {
  if (req.user) {
    console.log('Session Info:', {
      userId: req.user.userId,
      sessionAge: Date.now() - (req.user.iat * 1000),
      expiresIn: (req.user.exp * 1000) - Date.now(),
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
  }
  next();
});
```

**Solutions:**
```javascript
// Implement refresh token mechanism
app.post('/api/auth/refresh', async (req, res) => {
  const refreshToken = req.body.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token required' });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    // Generate new access token
    const newAccessToken = jwt.sign(
      {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Generate new refresh token
    const newRefreshToken = jwt.sign(
      { userId: decoded.userId },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });

  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});
```

---

## WeSign Integration Issues

### WeSign Connection Issues

#### Issue: WeSign API Calls Failing

**Diagnostic Steps:**
```javascript
// backend/scripts/wesign-diagnostics.js
const axios = require('axios');

async function diagnoseWeSignIntegration() {
  const baseURL = process.env.WESIGN_BASE_URL || 'https://devtest.comda.co.il';
  const apiKey = process.env.WESIGN_API_KEY;

  console.log('🔍 WeSign Integration Diagnostics');
  console.log('=================================');

  // 1. Test basic connectivity
  try {
    console.log('1. Testing basic connectivity...');
    const response = await axios.get(baseURL, { timeout: 10000 });
    console.log(`✅ WeSign reachable (Status: ${response.status})`);
  } catch (error) {
    console.log(`❌ WeSign unreachable: ${error.message}`);

    if (error.code === 'ENOTFOUND') {
      console.log('   DNS resolution failed - check network connectivity');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('   Connection refused - WeSign may be down');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('   Connection timeout - check firewall/proxy settings');
    }
    return;
  }

  // 2. Test API authentication
  try {
    console.log('2. Testing API authentication...');
    const authResponse = await axios.post(`${baseURL}/api/auth/login`, {
      email: process.env.WESIGN_TEST_EMAIL,
      password: process.env.WESIGN_TEST_PASSWORD
    }, { timeout: 10000 });

    console.log(`✅ WeSign authentication successful`);
    const token = authResponse.data.token;

    // 3. Test authenticated API call
    try {
      console.log('3. Testing authenticated API call...');
      const apiResponse = await axios.get(`${baseURL}/api/user/profile`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000
      });

      console.log(`✅ WeSign API call successful`);

    } catch (apiError) {
      console.log(`❌ WeSign API call failed: ${apiError.message}`);
    }

  } catch (authError) {
    console.log(`❌ WeSign authentication failed: ${authError.message}`);

    if (authError.response?.status === 401) {
      console.log('   Invalid credentials - check WESIGN_TEST_EMAIL and WESIGN_TEST_PASSWORD');
    } else if (authError.response?.status === 429) {
      console.log('   Rate limited - wait before retrying');
    }
  }

  // 4. Test network latency
  console.log('4. Testing network latency...');
  const latencyTests = [];

  for (let i = 0; i < 5; i++) {
    const start = Date.now();
    try {
      await axios.get(`${baseURL}/favicon.ico`, { timeout: 5000 });
      latencyTests.push(Date.now() - start);
    } catch (error) {
      console.log(`   Latency test ${i + 1} failed: ${error.message}`);
    }
  }

  if (latencyTests.length > 0) {
    const avgLatency = latencyTests.reduce((a, b) => a + b) / latencyTests.length;
    console.log(`✅ Average latency: ${avgLatency.toFixed(2)}ms`);

    if (avgLatency > 2000) {
      console.log('   ⚠️ High latency detected - may impact test execution');
    }
  }
}

diagnoseWeSignIntegration().catch(console.error);
```

### WeSign Test Execution Issues

#### Issue: Tests Timing Out

**Solutions:**
```javascript
// Implement robust retry mechanism
class WeSignTestExecutor {
  constructor() {
    this.maxRetries = 3;
    this.baseTimeout = 30000;
    this.retryDelay = 5000;
  }

  async executeTest(testConfig) {
    let lastError;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🔄 Test attempt ${attempt}/${this.maxRetries}: ${testConfig.name}`);

        const result = await this.runTestWithTimeout(testConfig, this.baseTimeout * attempt);

        console.log(`✅ Test passed on attempt ${attempt}: ${testConfig.name}`);
        return result;

      } catch (error) {
        lastError = error;
        console.log(`❌ Test failed on attempt ${attempt}: ${error.message}`);

        if (attempt < this.maxRetries) {
          console.log(`⏳ Waiting ${this.retryDelay}ms before retry...`);
          await this.delay(this.retryDelay);

          // Exponential backoff
          this.retryDelay *= 1.5;
        }
      }
    }

    throw new Error(`Test failed after ${this.maxRetries} attempts: ${lastError.message}`);
  }

  async runTestWithTimeout(testConfig, timeout) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Test timeout after ${timeout}ms`));
      }, timeout);

      this.runTest(testConfig)
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

## CI/CD Pipeline Issues

### Jenkins Build Failures

#### Issue: Build Fails with "Process Exited with Code 1"

**Diagnostic Steps:**
```groovy
// Enhanced Jenkins pipeline with better error handling
pipeline {
    agent any

    stages {
        stage('Diagnostics') {
            steps {
                script {
                    // Capture environment info
                    powershell '''
                        Write-Host "=== BUILD DIAGNOSTICS ==="
                        Write-Host "Node Version: $(node --version)"
                        Write-Host "NPM Version: $(npm --version)"
                        Write-Host "Python Version: $(& "${env:PYTHON_PATH}" --version)"
                        Write-Host "Current Directory: $(Get-Location)"
                        Write-Host "Environment Variables:"
                        Get-ChildItem Env: | Where-Object { $_.Name -like "*QA*" -or $_.Name -like "*NODE*" -or $_.Name -like "*NPM*" }
                        Write-Host "=========================="
                    '''
                }
            }
        }

        stage('Backend Build') {
            steps {
                dir('backend') {
                    powershell '''
                        try {
                            Write-Host "Installing backend dependencies..."
                            npm ci --production=false

                            Write-Host "Running TypeScript compilation..."
                            npm run build

                            Write-Host "Running backend tests..."
                            npm run test:unit

                            Write-Host "Backend build completed successfully"
                        }
                        catch {
                            Write-Error "Backend build failed: $($_.Exception.Message)"

                            # Capture additional diagnostics
                            Write-Host "NPM Error Log:"
                            if (Test-Path "$env:USERPROFILE\\.npm\\_logs\\") {
                                Get-ChildItem "$env:USERPROFILE\\.npm\\_logs\\" -Filter "*.log" |
                                Sort-Object LastWriteTime -Descending |
                                Select-Object -First 1 |
                                ForEach-Object { Get-Content $_.FullName -Tail 50 }
                            }

                            exit 1
                        }
                    '''
                }
            }
        }

        stage('Frontend Build') {
            steps {
                dir('apps/frontend/dashboard') {
                    powershell '''
                        try {
                            Write-Host "Installing frontend dependencies..."
                            npm ci --production=false

                            Write-Host "Running frontend build..."
                            npm run build

                            Write-Host "Frontend build completed successfully"
                        }
                        catch {
                            Write-Error "Frontend build failed: $($_.Exception.Message)"

                            # Check for common frontend build issues
                            Write-Host "Checking for common issues:"

                            # Check for TypeScript errors
                            if (Test-Path ".next\\build-errors.log") {
                                Write-Host "Build errors found:"
                                Get-Content ".next\\build-errors.log"
                            }

                            # Check memory usage
                            $Memory = Get-Counter "\\Memory\\Available MBytes" | Select -ExpandProperty CounterSamples | Select -ExpandProperty CookedValue
                            Write-Host "Available Memory: $Memory MB"

                            if ($Memory -lt 1000) {
                                Write-Warning "Low memory detected - this may cause build failures"
                            }

                            exit 1
                        }
                    '''
                }
            }
        }
    }

    post {
        failure {
            script {
                // Collect diagnostic information on failure
                powershell '''
                    Write-Host "=== FAILURE DIAGNOSTICS ==="

                    # Collect system information
                    Get-WmiObject -Class Win32_OperatingSystem | Select-Object Caption, TotalVisibleMemorySize, FreePhysicalMemory

                    # Check disk space
                    Get-WmiObject -Class Win32_LogicalDisk | Select-Object DeviceID, Size, FreeSpace

                    # Check running processes
                    Get-Process | Where-Object { $_.ProcessName -like "*node*" -or $_.ProcessName -like "*npm*" } |
                    Select-Object ProcessName, Id, CPU, WorkingSet

                    # Check for any hanging processes
                    Get-Process | Where-Object { $_.CPU -gt 300 } | Select-Object ProcessName, Id, CPU
                '''
            }

            // Send failure notification
            emailext (
                to: 'devops@company.com',
                subject: "QA Intelligence Build Failed - ${env.BUILD_NUMBER}",
                body: """
                Build ${env.BUILD_NUMBER} failed.

                Jenkins URL: ${env.BUILD_URL}

                Please check the build logs for detailed error information.
                """,
                attachLog: true
            )
        }
    }
}
```

### PowerShell Execution Issues

#### Issue: PowerShell Scripts Failing with Security Errors

**Solutions:**
```powershell
# Set execution policy for CI/CD
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force

# Or bypass execution policy for specific scripts
powershell.exe -ExecutionPolicy Bypass -File "script.ps1"

# For Jenkins, configure in Global Tool Configuration
# PowerShell Path: C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe
# Default Arguments: -ExecutionPolicy Bypass -NonInteractive
```

---

## Log Analysis and Debugging

### Centralized Log Analysis

**Log Analysis Script:**
```javascript
// backend/scripts/log-analyzer.js
const fs = require('fs');
const path = require('path');

class LogAnalyzer {
  constructor() {
    this.logPaths = [
      'logs/backend.log',
      'logs/frontend.log',
      'logs/test-execution.log',
      'logs/security.log'
    ];
  }

  async analyzeRecentIssues(hours = 24) {
    const analysis = {
      timestamp: new Date().toISOString(),
      timeframe: `Last ${hours} hours`,
      errors: [],
      warnings: [],
      patterns: {},
      recommendations: []
    };

    const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));

    for (const logPath of this.logPaths) {
      if (fs.existsSync(logPath)) {
        const logContent = fs.readFileSync(logPath, 'utf8');
        const lines = logContent.split('\n');

        for (const line of lines) {
          const match = line.match(/^\[([\d\-T:\.Z]+)\] \[(ERROR|WARNING)\] (.+)$/);
          if (match) {
            const [, timestamp, level, message] = match;
            const logTime = new Date(timestamp);

            if (logTime > cutoffTime) {
              const entry = {
                timestamp,
                level,
                message,
                source: path.basename(logPath)
              };

              if (level === 'ERROR') {
                analysis.errors.push(entry);
              } else if (level === 'WARNING') {
                analysis.warnings.push(entry);
              }

              // Track patterns
              const pattern = this.extractPattern(message);
              if (pattern) {
                analysis.patterns[pattern] = (analysis.patterns[pattern] || 0) + 1;
              }
            }
          }
        }
      }
    }

    // Generate recommendations based on patterns
    analysis.recommendations = this.generateRecommendations(analysis);

    return analysis;
  }

  extractPattern(message) {
    // Common error patterns
    const patterns = [
      { regex: /database.*connection.*failed/i, name: 'database_connection_error' },
      { regex: /timeout.*exceeded/i, name: 'timeout_error' },
      { regex: /memory.*out.*of/i, name: 'memory_error' },
      { regex: /port.*already.*in.*use/i, name: 'port_conflict' },
      { regex: /authentication.*failed/i, name: 'auth_error' },
      { regex: /file.*not.*found/i, name: 'file_not_found' },
      { regex: /permission.*denied/i, name: 'permission_error' }
    ];

    for (const pattern of patterns) {
      if (pattern.regex.test(message)) {
        return pattern.name;
      }
    }

    return null;
  }

  generateRecommendations(analysis) {
    const recommendations = [];
    const { patterns, errors } = analysis;

    // Database connection issues
    if (patterns.database_connection_error > 5) {
      recommendations.push({
        priority: 'high',
        issue: 'Multiple database connection failures',
        action: 'Check database service status and connection pool configuration',
        count: patterns.database_connection_error
      });
    }

    // Timeout issues
    if (patterns.timeout_error > 10) {
      recommendations.push({
        priority: 'medium',
        issue: 'Multiple timeout errors',
        action: 'Review timeout configurations and external service dependencies',
        count: patterns.timeout_error
      });
    }

    // Memory issues
    if (patterns.memory_error > 0) {
      recommendations.push({
        priority: 'critical',
        issue: 'Memory exhaustion detected',
        action: 'Investigate memory leaks and consider increasing memory allocation',
        count: patterns.memory_error
      });
    }

    // Port conflicts
    if (patterns.port_conflict > 0) {
      recommendations.push({
        priority: 'high',
        issue: 'Port conflicts detected',
        action: 'Check for processes using required ports and restart services',
        count: patterns.port_conflict
      });
    }

    // High error count
    if (errors.length > 50) {
      recommendations.push({
        priority: 'high',
        issue: 'High error count',
        action: 'Review system stability and consider immediate investigation',
        count: errors.length
      });
    }

    return recommendations;
  }

  async generateReport(outputPath) {
    const analysis = await this.analyzeRecentIssues();

    const report = `
# QA Intelligence Log Analysis Report

**Generated:** ${analysis.timestamp}
**Timeframe:** ${analysis.timeframe}

## Summary
- **Errors:** ${analysis.errors.length}
- **Warnings:** ${analysis.warnings.length}
- **Unique Patterns:** ${Object.keys(analysis.patterns).length}

## Error Patterns
${Object.entries(analysis.patterns)
  .sort(([,a], [,b]) => b - a)
  .map(([pattern, count]) => `- **${pattern}:** ${count} occurrences`)
  .join('\n')}

## Recommendations
${analysis.recommendations.map(rec =>
  `### ${rec.priority.toUpperCase()}: ${rec.issue}
  **Count:** ${rec.count}
  **Action:** ${rec.action}`
).join('\n\n')}

## Recent Errors
${analysis.errors.slice(-10).map(error =>
  `**${error.timestamp}** [${error.source}] ${error.message}`
).join('\n')}
    `;

    fs.writeFileSync(outputPath, report);
    console.log(`Log analysis report generated: ${outputPath}`);

    return analysis;
  }
}

// CLI usage
if (require.main === module) {
  const analyzer = new LogAnalyzer();
  const outputPath = `logs/analysis-${new Date().toISOString().split('T')[0]}.md`;

  analyzer.generateReport(outputPath)
    .then(analysis => {
      console.log('Log Analysis Summary:');
      console.log(`- Errors: ${analysis.errors.length}`);
      console.log(`- Warnings: ${analysis.warnings.length}`);
      console.log(`- Recommendations: ${analysis.recommendations.length}`);

      if (analysis.recommendations.some(r => r.priority === 'critical')) {
        console.log('\n🚨 CRITICAL ISSUES DETECTED - Immediate attention required!');
        process.exit(1);
      }
    })
    .catch(console.error);
}

module.exports = LogAnalyzer;
```

---

## Emergency Recovery Procedures

### Complete System Recovery

**Disaster Recovery Script:**
```powershell
# Emergency-Recovery.ps1
# Complete system recovery procedure

param(
    [ValidateSet("database", "services", "full")]
    [string]$RecoveryType = "full",

    [string]$BackupPath = "C:\QA-Intelligence\backups",

    [switch]$Force
)

$ErrorActionPreference = "Stop"

function Write-RecoveryLog {
    param([string]$Message, [string]$Level = "INFO")
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogMessage = "[$Timestamp] [$Level] RECOVERY: $Message"
    Add-Content -Path "C:\QA-Intelligence\logs\emergency-recovery.log" -Value $LogMessage
    Write-Host $LogMessage -ForegroundColor $(if($Level -eq "ERROR") {"Red"} elseif($Level -eq "WARNING") {"Yellow"} else {"Green"})
}

function Stop-AllServices {
    Write-RecoveryLog "Stopping all QA Intelligence services..."

    try {
        # Stop PM2 processes
        pm2 stop all
        pm2 delete all

        # Stop Windows services
        $Services = @("Jenkins", "PostgreSQL", "nginx")
        foreach ($Service in $Services) {
            try {
                Stop-Service -Name $Service -Force -ErrorAction SilentlyContinue
                Write-RecoveryLog "Stopped service: $Service"
            }
            catch {
                Write-RecoveryLog "Could not stop service $Service`: $($_.Exception.Message)" "WARNING"
            }
        }

        Write-RecoveryLog "All services stopped successfully"
    }
    catch {
        Write-RecoveryLog "Failed to stop services: $($_.Exception.Message)" "ERROR"
        throw
    }
}

function Start-AllServices {
    Write-RecoveryLog "Starting all QA Intelligence services..."

    try {
        # Start Windows services first
        $Services = @("PostgreSQL", "Jenkins", "nginx")
        foreach ($Service in $Services) {
            try {
                Start-Service -Name $Service -ErrorAction SilentlyContinue
                Write-RecoveryLog "Started service: $Service"
            }
            catch {
                Write-RecoveryLog "Could not start service $Service`: $($_.Exception.Message)" "WARNING"
            }
        }

        # Wait for services to initialize
        Start-Sleep -Seconds 30

        # Start PM2 processes
        cd "C:\QA-Intelligence"
        pm2 start ecosystem.config.js
        Write-RecoveryLog "Started PM2 processes"

        Write-RecoveryLog "All services started successfully"
    }
    catch {
        Write-RecoveryLog "Failed to start services: $($_.Exception.Message)" "ERROR"
        throw
    }
}

function Restore-Database {
    Write-RecoveryLog "Starting database recovery..."

    try {
        # Find latest backup
        $LatestBackup = Get-ChildItem $BackupPath -Filter "*database*" |
                       Sort-Object LastWriteTime -Descending |
                       Select-Object -First 1

        if (-not $LatestBackup) {
            throw "No database backup found in $BackupPath"
        }

        Write-RecoveryLog "Found database backup: $($LatestBackup.Name)"

        # Stop database service
        Stop-Service -Name "PostgreSQL" -Force -ErrorAction SilentlyContinue

        # Backup current database (if exists)
        $CurrentDbPath = "C:\QA-Intelligence\memory.sqlite"
        if (Test-Path $CurrentDbPath) {
            $BackupName = "memory.sqlite.emergency-backup.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
            Copy-Item $CurrentDbPath "C:\QA-Intelligence\backups\$BackupName"
            Write-RecoveryLog "Current database backed up to: $BackupName"
        }

        # Restore from backup
        if ($LatestBackup.Extension -eq ".zip") {
            # Extract backup
            $TempPath = "C:\QA-Intelligence\temp\recovery"
            New-Item -ItemType Directory -Path $TempPath -Force | Out-Null
            Expand-Archive -Path $LatestBackup.FullName -DestinationPath $TempPath -Force

            # Find database file in extracted content
            $DbFile = Get-ChildItem $TempPath -Filter "*.sqlite" -Recurse | Select-Object -First 1
            if ($DbFile) {
                Copy-Item $DbFile.FullName $CurrentDbPath -Force
                Write-RecoveryLog "Database restored from backup"
            }

            # Cleanup temp files
            Remove-Item $TempPath -Recurse -Force
        }
        else {
            # Direct copy if not compressed
            Copy-Item $LatestBackup.FullName $CurrentDbPath -Force
            Write-RecoveryLog "Database restored from backup"
        }

        # Start database service
        Start-Service -Name "PostgreSQL" -ErrorAction SilentlyContinue

        Write-RecoveryLog "Database recovery completed successfully"
    }
    catch {
        Write-RecoveryLog "Database recovery failed: $($_.Exception.Message)" "ERROR"
        throw
    }
}

function Test-SystemHealth {
    Write-RecoveryLog "Testing system health after recovery..."

    $HealthEndpoints = @(
        @{Name="Backend"; Url="http://localhost:8082/api/health"},
        @{Name="Frontend"; Url="http://localhost:3001/api/health"},
        @{Name="Jenkins"; Url="http://localhost:8080/login"}
    )

    $HealthyServices = 0
    foreach ($Endpoint in $HealthEndpoints) {
        try {
            $Response = Invoke-RestMethod -Uri $Endpoint.Url -TimeoutSec 30
            Write-RecoveryLog "$($Endpoint.Name) is healthy"
            $HealthyServices++
        }
        catch {
            Write-RecoveryLog "$($Endpoint.Name) health check failed: $($_.Exception.Message)" "ERROR"
        }
    }

    $HealthPercentage = [math]::Round(($HealthyServices / $HealthEndpoints.Count) * 100, 2)
    Write-RecoveryLog "System health: $HealthPercentage% ($HealthyServices/$($HealthEndpoints.Count) services healthy)"

    if ($HealthPercentage -lt 100) {
        Write-RecoveryLog "System recovery incomplete - manual intervention required" "WARNING"
        return $false
    } else {
        Write-RecoveryLog "System recovery completed successfully"
        return $true
    }
}

# Main recovery execution
try {
    Write-RecoveryLog "Starting emergency recovery procedure (Type: $RecoveryType)"

    if (-not $Force) {
        $Confirmation = Read-Host "This will stop all services and restore from backup. Continue? (y/N)"
        if ($Confirmation -ne "y" -and $Confirmation -ne "Y") {
            Write-RecoveryLog "Recovery cancelled by user"
            exit 0
        }
    }

    switch ($RecoveryType) {
        "database" {
            Stop-AllServices
            Restore-Database
            Start-AllServices
        }
        "services" {
            Stop-AllServices
            Start-AllServices
        }
        "full" {
            Stop-AllServices
            Restore-Database
            Start-AllServices
        }
    }

    # Wait for services to stabilize
    Write-RecoveryLog "Waiting for services to stabilize..."
    Start-Sleep -Seconds 60

    # Test system health
    $HealthCheck = Test-SystemHealth

    if ($HealthCheck) {
        Write-RecoveryLog "🎉 Emergency recovery completed successfully!"

        # Send success notification
        try {
            & "C:\QA-Intelligence\scripts\send-notification.ps1" -Type "recovery_success" -Details @{
                recoveryType = $RecoveryType
                completedAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            }
        }
        catch {
            Write-RecoveryLog "Failed to send success notification: $($_.Exception.Message)" "WARNING"
        }
    }
    else {
        Write-RecoveryLog "⚠️ Emergency recovery completed with issues - manual intervention required" "WARNING"
        exit 1
    }

    Write-RecoveryLog "Recovery procedure completed"
}
catch {
    Write-RecoveryLog "Emergency recovery failed: $($_.Exception.Message)" "ERROR"

    # Send failure notification
    try {
        & "C:\QA-Intelligence\scripts\send-notification.ps1" -Type "recovery_failed" -Details @{
            recoveryType = $RecoveryType
            error = $_.Exception.Message
            failedAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        }
    }
    catch {
        Write-RecoveryLog "Failed to send failure notification" "WARNING"
    }

    exit 1
}
```

---

**Document Status:**
- Version: 1.0
- Status: Production Ready
- Last Updated: 2025-09-26
- Next Review: 2026-03-26
- Owner: DevOps/SRE Team