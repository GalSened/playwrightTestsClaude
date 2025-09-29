# Test Scheduler Runbook

## Quick Start

### Installation & Setup

1. **Clone and Install Backend**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Edit .env with your configuration
   ```

2. **Initialize Database**
   ```bash
   npm run migrate
   ```

3. **Install Frontend Dependencies**
   ```bash
   cd ../playwright-smart
   npm install
   ```

4. **Start Development**
   ```bash
   # Terminal 1: Start backend API
   cd backend
   npm run dev

   # Terminal 2: Start worker
   cd backend
   npm run worker

   # Terminal 3: Start frontend
   cd playwright-smart
   npm run dev
   ```

5. **Verify Installation**
   - API Health: http://localhost:3001/health
   - Frontend: http://localhost:5173
   - Worker Status: http://localhost:3001/api/worker/status

## Production Deployment

### Step 1: Environment Setup

```bash
# Create production environment file
cp backend/.env.example backend/.env.production

# Configure production values
NODE_ENV=production
PORT=3001
DATABASE_PATH=/var/lib/scheduler/scheduler.db
LOG_DIR=/var/log/scheduler
CORS_ORIGIN=https://your-domain.com
```

### Step 2: Database Setup

```bash
# Create database directory
sudo mkdir -p /var/lib/scheduler
sudo chown $USER:$USER /var/lib/scheduler

# Initialize production database
cd backend
NODE_ENV=production npm run migrate
```

### Step 3: Build and Deploy

```bash
# Build backend
cd backend
npm run build

# Build frontend
cd ../playwright-smart
npm run build

# Deploy frontend build to your web server
# Copy dist/ to your web server root
```

### Step 4: Process Management (PM2)

```bash
# Install PM2 globally
npm install -g pm2

# Create ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: 'scheduler-api',
      script: './dist/server.js',
      cwd: './backend',
      env: {
        NODE_ENV: 'production'
      },
      instances: 2,
      exec_mode: 'cluster'
    },
    {
      name: 'scheduler-worker',
      script: './dist/workers/scheduler.js',
      cwd: './backend',
      env: {
        NODE_ENV: 'production'
      },
      instances: 1,
      exec_mode: 'fork'
    }
  ]
};
EOF

# Start processes
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Testing

### Backend Tests

```bash
cd backend

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- timezone.test.ts

# Watch mode for development
npm run test:watch
```

### Frontend Tests

```bash
cd playwright-smart

# Unit tests (if implemented)
npm test

# E2E tests with Playwright
npm run test:e2e
```

### Integration Testing

**Test the complete flow:**

```bash
# 1. Start all services
npm run dev  # In backend
npm run worker  # In backend (separate terminal)
npm run dev  # In playwright-smart (separate terminal)

# 2. Create a test schedule via API
curl -X POST http://localhost:3001/api/schedules \
  -H "Content-Type: application/json" \
  -d '{
    "suite_id": "test-suite-1",
    "suite_name": "API Test Suite",
    "run_at": "2024-12-01T15:30:00.000",
    "timezone": "Asia/Jerusalem",
    "notes": "Integration test",
    "execution_options": {
      "mode": "headless",
      "browser": "chromium"
    }
  }'

# 3. Check schedule was created
curl http://localhost:3001/api/schedules

# 4. Test immediate execution
curl -X POST http://localhost:3001/api/schedules/{SCHEDULE_ID}/run-now
```

## Operations

### Monitoring Commands

**Health Checks:**
```bash
# API health
curl http://localhost:3001/health

# Worker status
curl http://localhost:3001/api/worker/status

# Schedule statistics
curl http://localhost:3001/api/schedules/stats/summary
```

**Database Status:**
```bash
# Connect to database
sqlite3 /path/to/scheduler.db

# Check schedule counts
SELECT status, COUNT(*) FROM schedules GROUP BY status;

# Check recent runs
SELECT * FROM schedule_runs ORDER BY started_at DESC LIMIT 10;

# Check worker claims
SELECT id, suite_name, claimed_by, claimed_at FROM schedules WHERE claimed_at IS NOT NULL;
```

**Log Analysis:**
```bash
# Follow API logs
tail -f /var/log/scheduler/application.log

# Follow worker logs
tail -f /var/log/scheduler/scheduler.log

# Error logs only
tail -f /var/log/scheduler/error.log

# Filter by schedule ID
grep "schedule_123" /var/log/scheduler/application.log
```

### Maintenance Commands

**Database Cleanup:**
```bash
# Manual cleanup (removes records older than 30 days)
cd backend
node -e "
const { getDatabase } = require('./dist/database/database');
const db = getDatabase();
db.cleanup(30).then(result => {
  console.log('Cleanup result:', result);
  process.exit(0);
});
"
```

**Worker Management:**
```bash
# Restart worker
pm2 restart scheduler-worker

# Check worker logs
pm2 logs scheduler-worker

# Monitor worker resources
pm2 monit
```

**Schedule Management:**
```bash
# Cancel all scheduled runs
curl -X POST http://localhost:3001/api/schedules/bulk/cancel

# Get overdue schedules
curl "http://localhost:3001/api/schedules?status=scheduled&to_date=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
```

## Troubleshooting Guide

### Issue: Schedules Not Executing

**Symptoms:**
- Schedules remain in "scheduled" status past execution time
- Worker shows as running but no activity

**Diagnosis:**
```bash
# Check worker status
curl http://localhost:3001/api/worker/status

# Check claimable schedules
cd backend
node -e "
const { getDatabase } = require('./dist/database/database');
const db = getDatabase();
db.getClaimableSchedules(10).then(schedules => {
  console.log('Claimable schedules:', schedules.length);
  schedules.forEach(s => console.log(s.id, s.run_at_utc, s.status));
  process.exit(0);
});
"

# Check worker logs
tail -f /var/log/scheduler/scheduler.log
```

**Solutions:**
1. **Worker not running**: `pm2 restart scheduler-worker`
2. **Claims stuck**: Release stale claims manually
3. **Time zone issues**: Verify UTC conversion
4. **Resource conflicts**: Check concurrent execution limits

### Issue: Database Locked

**Symptoms:**
- "Database is locked" errors
- Slow API responses
- Worker cannot claim schedules

**Diagnosis:**
```bash
# Check database connections
lsof /path/to/scheduler.db

# Check for long-running transactions
sqlite3 /path/to/scheduler.db "PRAGMA wal_checkpoint;"
```

**Solutions:**
1. **WAL mode**: Already enabled, but verify with `PRAGMA journal_mode;`
2. **Restart processes**: `pm2 restart all`
3. **Check disk space**: `df -h`
4. **Database repair**: Backup and restore if needed

### Issue: Memory/CPU High Usage

**Symptoms:**
- High memory usage by worker process
- Slow execution times
- System becomes unresponsive

**Diagnosis:**
```bash
# Check process resources
pm2 monit

# Check concurrent executions
curl http://localhost:3001/api/worker/status

# Check running test processes
ps aux | grep pytest
ps aux | grep playwright
```

**Solutions:**
1. **Reduce concurrency**: Lower `MAX_CONCURRENT_EXECUTIONS`
2. **Memory leaks**: Restart worker process
3. **Optimize tests**: Review test execution parameters
4. **Resource limits**: Use ulimit or systemd limits

### Issue: Frontend Not Connecting

**Symptoms:**
- "Network Error" in browser console
- Scheduler tab shows loading indefinitely
- API calls fail with CORS errors

**Diagnosis:**
```bash
# Check API server
curl http://localhost:3001/health

# Check CORS configuration
curl -H "Origin: http://localhost:5173" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: X-Requested-With" \
     -X OPTIONS http://localhost:3001/api/schedules

# Check frontend environment
cat playwright-smart/.env
```

**Solutions:**
1. **API not running**: Start backend server
2. **CORS misconfigured**: Check `CORS_ORIGIN` environment variable
3. **Port conflicts**: Verify ports 3001 and 5173 are available
4. **Environment variables**: Check `VITE_API_BASE_URL`

### Issue: Timezone Problems

**Symptoms:**
- Schedules run at wrong times
- DST transitions cause missed executions
- Time display inconsistencies

**Diagnosis:**
```bash
# Check system timezone
timedatectl status

# Check schedule timezone handling
cd backend
node -e "
const { convertToUTC, convertFromUTC } = require('./dist/utils/timezone');
const testTime = '2024-07-15T14:30:00.000';
console.log('Input:', testTime);
console.log('UTC conversion:', convertToUTC(testTime, 'Asia/Jerusalem'));
console.log('Back to local:', convertFromUTC('2024-07-15T11:30:00.000Z', 'Asia/Jerusalem'));
"

# Check database times
sqlite3 /path/to/scheduler.db "
SELECT id, suite_name, timezone, run_at_utc, run_at_local 
FROM schedules 
WHERE status = 'scheduled'
ORDER BY run_at_utc;
"
```

**Solutions:**
1. **System timezone**: Set server to UTC
2. **Database corruption**: Recreate affected schedules
3. **DST handling**: Avoid scheduling during transition hours
4. **Client timezone**: Verify browser timezone settings

## Performance Tuning

### Database Optimization

```sql
-- Check database size
SELECT 
  COUNT(*) as total_schedules,
  SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as active_schedules,
  SUM(CASE WHEN status IN ('completed', 'failed') THEN 1 ELSE 0 END) as finished_schedules
FROM schedules;

-- Optimize database
PRAGMA optimize;
ANALYZE;
VACUUM;

-- Check index usage
EXPLAIN QUERY PLAN 
SELECT * FROM schedules 
WHERE status = 'scheduled' AND run_at_utc <= datetime('now', 'utc')
ORDER BY priority DESC, run_at_utc ASC;
```

### Worker Tuning

**Adjust concurrency:**
```bash
# For CPU-intensive tests
MAX_CONCURRENT_EXECUTIONS=1

# For I/O-bound tests
MAX_CONCURRENT_EXECUTIONS=5

# Monitor and adjust based on system resources
```

**Optimize polling:**
```bash
# More frequent polling (higher CPU, faster response)
POLL_INTERVAL_MS=15000

# Less frequent polling (lower CPU, slower response)
POLL_INTERVAL_MS=60000
```

### Application Tuning

**API Server:**
```bash
# Enable cluster mode for multiple CPU cores
# In ecosystem.config.js:
instances: 'max'
exec_mode: 'cluster'
```

**Frontend:**
```bash
# Adjust update frequency
# In TestRunScheduler.tsx, modify polling interval
const interval = setInterval(() => {
  loadSchedules();
  loadStats();
}, 60000); // Every minute instead of 30 seconds
```

## Backup and Recovery

### Database Backup

```bash
# Create backup
sqlite3 /var/lib/scheduler/scheduler.db ".backup /var/backups/scheduler-$(date +%Y%m%d-%H%M%S).db"

# Automated daily backup
cat > /usr/local/bin/backup-scheduler.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/scheduler"
mkdir -p "$BACKUP_DIR"
DATE=$(date +%Y%m%d-%H%M%S)
sqlite3 /var/lib/scheduler/scheduler.db ".backup $BACKUP_DIR/scheduler-$DATE.db"
# Keep only last 30 days
find "$BACKUP_DIR" -name "scheduler-*.db" -mtime +30 -delete
EOF

chmod +x /usr/local/bin/backup-scheduler.sh

# Add to crontab
echo "0 2 * * * /usr/local/bin/backup-scheduler.sh" | crontab -
```

### Disaster Recovery

```bash
# Stop services
pm2 stop all

# Restore database
cp /var/backups/scheduler/scheduler-YYYYMMDD-HHMMSS.db /var/lib/scheduler/scheduler.db

# Start services
pm2 start all

# Verify restoration
curl http://localhost:3001/health
curl http://localhost:3001/api/schedules/stats/summary
```

## Security Checklist

- [ ] API server runs on non-privileged port
- [ ] Database file has restricted permissions (600)
- [ ] Log files are properly rotated and secured
- [ ] CORS is configured for specific origins only
- [ ] Input validation is enabled for all API endpoints
- [ ] Error messages don't expose sensitive information
- [ ] Artifacts directory has proper access controls
- [ ] Worker process runs with minimal privileges
- [ ] Regular security updates for dependencies
- [ ] Monitoring for suspicious activities

## Contact and Escalation

**For production issues:**
1. Check this runbook first
2. Review application logs
3. Check monitoring dashboards
4. Escalate to development team if needed

**Emergency procedures:**
- If critical failure: Stop all services, restore from backup
- If security incident: Isolate system, preserve logs, contact security team
- If data corruption: Stop writes, assess damage, restore from backup