# Trace Viewer Runbook

## Quick Start

### Development Setup

```bash
# 1. Install backend dependencies
cd backend
npm install

# 2. Install additional dependencies for trace viewer
npm install yauzl sharp fluent-ffmpeg

# 3. Initialize trace database  
npm run build
node -e "
const { TraceDatabase } = require('./dist/database/trace-database');
const db = new TraceDatabase();
console.log('Trace database initialized');
db.close();
"

# 4. Start backend with trace routes
npm run dev

# 5. Install frontend dependencies (if not done)
cd ../playwright-smart
npm install

# 6. Start frontend
npm run dev
```

### Production Deployment

```bash
# 1. Backend build and deploy
cd backend
npm run build
npm run typecheck
npm run lint

# 2. Initialize production database
NODE_ENV=production npm run migrate

# 3. Start with PM2
pm2 start ecosystem.config.js --only trace-api

# 4. Frontend build
cd ../playwright-smart  
npm run build

# 5. Deploy frontend build to web server
cp -r dist/* /var/www/html/
```

## Environment Configuration

### Backend Environment Variables

```bash
# Database
DATABASE_PATH=./data/trace.db
TRACE_DATABASE_PATH=./data/trace.db  # If different from scheduler DB

# Artifact Storage
ARTIFACTS_BASE_PATH=./artifacts
MAX_MEDIA_SIZE_MB=100
THUMBNAILS_ENABLED=true

# Media Processing
FFMPEG_PATH=/usr/bin/ffmpeg  # Auto-detected if not specified
SHARP_CACHE_SIZE=50         # MB for Sharp image processing

# Security
SIGNING_SECRET=your-secret-key-here
SIGNED_URL_EXPIRY_MINUTES=60

# Logging
TRACE_LOG_LEVEL=info
LOG_REQUESTS=true
```

### Frontend Environment Variables

```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:3001
VITE_TRACE_VIEWER_ENABLED=true

# Feature Flags
VITE_VIDEO_PLAYER_ENABLED=true
VITE_BULK_OPERATIONS_ENABLED=true
```

## API Integration

### Backend Integration

1. **Add trace routes to your Express server:**

```typescript
// server.ts
import { createTraceRouter } from './routes/trace';

app.use('/api/reports', createTraceRouter());
```

2. **Configure database connection:**

```typescript
// database/database.ts
import { TraceDatabase } from './trace-database';

export const traceDb = new TraceDatabase(
  process.env.TRACE_DATABASE_PATH || './data/trace.db'
);
```

### Frontend Integration

1. **Add to existing Reports page:**

```typescript
// pages/Reports/ReportsPage.tsx
import { TraceViewer } from '@/components/TraceViewer';

export function ReportsPage() {
  const [selectedRunId, setSelectedRunId] = useState<string>();
  
  return (
    <div>
      {/* Existing reports table */}
      <RunsTable onRunSelect={setSelectedRunId} />
      
      {/* New trace viewer */}
      {selectedRunId && (
        <TraceViewer 
          runId={selectedRunId}
          onClose={() => setSelectedRunId(undefined)}
        />
      )}
    </div>
  );
}
```

2. **Extend existing types:**

```typescript
// types/index.ts
export * from './trace';  // Import trace types
```

## Test Data Setup

### Sample Test Run Creation

```bash
# Create sample run via API
curl -X POST http://localhost:3001/api/reports/runs \
  -H "Content-Type: application/json" \
  -d '{
    "suiteId": "sample-suite",
    "suiteName": "Sample Test Suite",
    "environment": "local",
    "browser": "chromium"
  }'
```

### Mock Artifact Upload

```bash
# Upload sample screenshot
curl -X POST http://localhost:3001/api/reports/runs/{RUN_ID}/artifacts \
  -F "file=@screenshot.png" \
  -F "artifactType=screenshot" \
  -F "stepId={STEP_ID}" \
  -F "name=test-screenshot.png"
```

### Playwright Integration

```typescript
// tests/example.spec.ts
import { test, expect } from '@playwright/test';

test('example test with trace', async ({ page }) => {
  // Enable tracing
  await page.context().tracing.start({ 
    screenshots: true, 
    snapshots: true 
  });
  
  await page.goto('https://example.com');
  await page.click('button');
  await expect(page.locator('h1')).toBeVisible();
  
  // Save trace
  await page.context().tracing.stop({ 
    path: 'trace.zip' 
  });
  
  // Upload to trace viewer (custom helper)
  await uploadTrace('trace.zip', {
    suiteName: 'Example Tests',
    testName: 'Basic Navigation'
  });
});
```

## Operations

### Database Management

```bash
# Check trace database status
sqlite3 data/trace.db "
SELECT 
  COUNT(*) as total_runs,
  SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
FROM test_runs;
"

# View recent runs
sqlite3 data/trace.db "
SELECT id, suite_name, status, started_at, duration_ms 
FROM test_runs 
ORDER BY started_at DESC 
LIMIT 10;
"

# Check artifacts storage
sqlite3 data/trace.db "
SELECT 
  artifact_type,
  COUNT(*) as count,
  SUM(file_size) as total_size
FROM test_artifacts 
GROUP BY artifact_type;
"

# Clean up old data (older than 30 days)
curl -X POST http://localhost:3001/api/reports/cleanup \
  -H "Content-Type: application/json" \
  -d '{"daysOld": 30}'
```

### Artifact Storage Management

```bash
# Check storage usage
du -sh artifacts/
df -h artifacts/

# Find large files
find artifacts/ -type f -size +10M -exec ls -lh {} \;

# Clean up orphaned artifacts (files not in database)
node scripts/cleanup-orphaned-artifacts.js

# Generate missing thumbnails
node scripts/generate-thumbnails.js
```

### Health Monitoring

```bash
# API health check
curl http://localhost:3001/health

# Trace-specific endpoints
curl http://localhost:3001/api/reports/runs?limit=1
curl http://localhost:3001/api/reports/stats

# Check media serving
curl -I "http://localhost:3001/api/reports/runs/{RUN_ID}/media/{ARTIFACT_ID}"
```

## Troubleshooting

### Backend Issues

**Database locked errors:**
```bash
# Check for long-running transactions
sqlite3 data/trace.db "PRAGMA wal_checkpoint;"

# Enable WAL mode if not already
sqlite3 data/trace.db "PRAGMA journal_mode=WAL;"
```

**Artifact upload failures:**
```bash
# Check disk space
df -h

# Check permissions
ls -la artifacts/
chmod -R 755 artifacts/
chown -R $USER:$USER artifacts/
```

**Trace parsing errors:**
```bash
# Validate trace file
node -e "
const parser = require('./dist/services/playwright-trace-parser').PlaywrightTraceParser;
const p = new parser();
p.validateTraceFile('path/to/trace.zip').then(console.log);
"
```

### Frontend Issues

**Timeline not loading:**
- Check browser console for JavaScript errors
- Verify API connectivity: DevTools > Network tab
- Check if runs data is being fetched correctly

**Media not displaying:**
- Verify file URLs are accessible: try direct URL in browser
- Check CORS configuration in backend
- Inspect network requests for 404/403 errors

**Performance issues:**
- Monitor bundle size: `npm run analyze`
- Check for memory leaks in React DevTools
- Review network waterfall for optimization opportunities

### Common Error Codes

**400 Bad Request**
- Invalid query parameters or request body
- Check API documentation for correct parameter format

**404 Not Found** 
- Run ID or artifact ID doesn't exist
- Verify IDs in database: `SELECT id FROM test_runs WHERE id = '...'`

**413 Payload Too Large**
- Uploaded file exceeds size limit
- Increase `MAX_MEDIA_SIZE_MB` or optimize file

**500 Internal Server Error**
- Check backend logs for stack traces
- Verify database connectivity and schema

## Performance Optimization

### Database Tuning

```sql
-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_test_runs_suite_status 
ON test_runs(suite_id, status);

CREATE INDEX IF NOT EXISTS idx_test_steps_run_action 
ON test_steps(run_id, action_type);

-- Analyze query performance
EXPLAIN QUERY PLAN SELECT * FROM test_runs WHERE status = 'failed';

-- Optimize database
PRAGMA optimize;
ANALYZE;
```

### Artifact Optimization

```bash
# Compress old artifacts
find artifacts/ -name "*.png" -mtime +7 -exec pngcrush -ow {} \;

# Convert large videos to web-optimized format
find artifacts/ -name "*.mp4" -size +50M -exec ffmpeg -i {} -c:v libx264 -crf 23 {}_optimized.mp4 \;

# Generate WebP thumbnails for better performance
find artifacts/ -name "*.png" -exec cwebp -q 80 {} -o {}.webp \;
```

### Frontend Optimization

```typescript
// Lazy load trace viewer
const TraceViewer = lazy(() => import('@/components/TraceViewer'));

// Use React.memo for expensive components
export const TimelineView = React.memo(({ timeline }) => {
  // Component implementation
});

// Virtualize long lists
import { FixedSizeList as List } from 'react-window';
```

## Backup and Recovery

### Database Backup

```bash
# Create backup
sqlite3 data/trace.db ".backup backup/trace-$(date +%Y%m%d).db"

# Scheduled backup (add to crontab)
0 2 * * * /path/to/backup-script.sh

# Restore from backup
cp backup/trace-20240101.db data/trace.db
```

### Artifact Backup

```bash
# Sync to S3 (example)
aws s3 sync artifacts/ s3://my-bucket/trace-artifacts/ --exclude "*.tmp"

# Restore artifacts
aws s3 sync s3://my-bucket/trace-artifacts/ artifacts/

# Local backup with rsync
rsync -av --delete artifacts/ backup/artifacts/
```

## Security Checklist

- [ ] Database file has restricted permissions (600)
- [ ] Artifact directory not web-accessible  
- [ ] Signed URLs configured with proper expiration
- [ ] CORS configured for specific origins only
- [ ] Input validation enabled on all endpoints
- [ ] File upload size limits enforced
- [ ] SQL injection prevention verified
- [ ] Error messages don't expose sensitive data

## Monitoring & Alerts

### Key Metrics to Monitor

```bash
# Database performance
sqlite3 data/trace.db "SELECT COUNT(*) FROM test_runs WHERE created_at > datetime('now', '-1 day');"

# Artifact storage growth
du -s artifacts/ | awk '{print $1 * 1024}' # bytes

# API response times
curl -w "@curl-format.txt" -s -o /dev/null http://localhost:3001/api/reports/runs

# Memory usage
ps aux | grep node | grep -v grep
```

### Alert Conditions

- Database size > 5GB
- Artifact storage > 80% disk capacity  
- API response time > 5 seconds
- Failed upload rate > 10%
- Error rate > 5%

### Log Analysis

```bash
# Error analysis
grep -i error logs/trace-viewer.log | tail -50

# Performance monitoring
grep "slow query" logs/database.log

# Usage statistics  
grep "GET /api/reports/runs" logs/access.log | wc -l
```

## Integration Examples

### CI/CD Integration

```yaml
# GitHub Actions example
- name: Upload Playwright traces
  if: failure()
  run: |
    for trace in test-results/*/trace.zip; do
      curl -X POST "$TRACE_VIEWER_URL/api/reports/runs" \
        -H "Content-Type: application/json" \
        -d "{\"suiteName\": \"CI Build $GITHUB_RUN_NUMBER\"}" \
        | jq -r .id > run_id.txt
      
      curl -X POST "$TRACE_VIEWER_URL/api/reports/runs/$(cat run_id.txt)/parse-trace" \
        -H "Content-Type: application/json" \
        -d "{\"traceFilePath\": \"$trace\"}"
    done
```

### Slack Integration

```javascript
// Webhook notification
const webhook = async (runResult) => {
  const message = {
    text: `Test Run ${runResult.status}`,
    attachments: [{
      color: runResult.status === 'passed' ? 'good' : 'danger',
      fields: [{
        title: 'Suite',
        value: runResult.suiteName,
        short: true
      }, {
        title: 'Duration', 
        value: formatDuration(runResult.duration),
        short: true
      }],
      actions: [{
        type: 'button',
        text: 'View Trace',
        url: `${TRACE_VIEWER_URL}/reports/${runResult.id}`
      }]
    }]
  };
  
  await fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    body: JSON.stringify(message)
  });
};
```

This runbook provides comprehensive operational guidance for the Trace Viewer system, covering setup, maintenance, troubleshooting, and integration scenarios.