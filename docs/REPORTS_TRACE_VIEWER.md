# Reports: Full Run Trace Viewer Documentation

## Overview

The Trace Viewer is a production-ready feature that provides comprehensive visibility into test execution with rich timeline visualization, detailed step analysis, and integrated media handling. It transforms raw test artifacts into an intuitive, navigable interface that enables developers and QA teams to quickly understand test execution flow, identify failures, and debug issues.

## Features

### Core Functionality

- **Interactive Timeline**: Navigate through test execution chronologically with step markers, logs, and network events
- **Rich Media Support**: View screenshots, stream videos, and browse artifacts with zoom, pan, and download capabilities
- **Step-by-Step Analysis**: Detailed breakdown of each test action with context, timing, and error information
- **Log Integration**: Console and network logs linked to specific steps with filtering and search
- **Real-time Updates**: Live status tracking during test execution
- **Search & Filter**: Find specific steps, errors, or events across large test runs

### Advanced Capabilities

- **Video Synchronization**: Timeline markers that sync with video playback for precise debugging
- **Error Drill-down**: Stack traces, expected vs. actual values, and retry information
- **Artifact Management**: Secure storage, thumbnail generation, and batch operations
- **Performance Metrics**: Step duration analysis and bottleneck identification
- **Cross-browser Support**: Unified interface for traces from different browsers
- **Export Functions**: Download traces, screenshots, and generated reports

## Architecture

### Backend Services

```
backend/src/
├── database/
│   ├── trace-database.ts      # Database abstraction layer
│   └── trace-schema.sql       # SQLite schema with indexes
├── routes/
│   └── trace.ts              # RESTful API endpoints
├── services/
│   ├── artifact-manager.ts   # File storage and media processing
│   └── playwright-trace-parser.ts  # Trace parsing engine
└── types/
    └── trace.ts              # TypeScript definitions
```

### Frontend Components

```
src/components/TraceViewer/
├── TimelineView.tsx          # Interactive timeline with playback
├── StepDetail.tsx           # Detailed step analysis
├── VideoPlayer.tsx          # Media player with step markers
├── ImageModal.tsx          # Full-screen image viewer
├── MediaGallery.tsx        # Artifact browser and manager
└── __tests__/              # Comprehensive test suite
```

### Database Schema

The trace viewer uses a normalized SQLite database with the following key tables:

- **test_runs**: Main run metadata with totals and timing
- **test_steps**: Individual actions with selectors and results  
- **test_artifacts**: Screenshots, videos, logs with storage paths
- **console_logs**: Browser console output linked to steps
- **network_logs**: HTTP requests/responses with timing data

## API Reference

### Core Endpoints

#### GET /api/reports/runs
List test runs with filtering and pagination.

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (max: 100, default: 50)
- `status`: Filter by run status (queued, running, passed, failed, cancelled)
- `environment`: Filter by test environment
- `suite`: Filter by suite name (partial match)
- `branch`: Filter by git branch
- `startDate`, `endDate`: Date range filters (ISO 8601)
- `search`: Full-text search across suite names and commit SHAs

**Response:**
```json
{
  "runs": [
    {
      "id": "run_1234567890_abcdef123",
      "suiteName": "Regression Suite",
      "status": "passed",
      "startedAt": "2024-12-01T14:30:00.000Z",
      "finishedAt": "2024-12-01T14:45:00.000Z",
      "totals": {
        "total": 25,
        "passed": 23,
        "failed": 2,
        "skipped": 0
      },
      "passRate": 92.0,
      "duration": 900000
    }
  ],
  "total": 150,
  "hasMore": true
}
```

#### GET /api/reports/runs/:runId
Get detailed run information with steps and artifacts.

**Query Parameters:**
- `includeSteps`: Include step details (default: true)
- `includeArtifacts`: Include artifacts (default: true)
- `includeLogs`: Include console/network logs (default: false)

**Response:**
```json
{
  "run": { /* run details */ },
  "steps": [
    {
      "id": "step_1234567890_abcdef123",
      "testName": "Login Flow",
      "actionName": "Click login button",
      "actionType": "click",
      "selector": "button[data-testid='login-btn']",
      "status": "passed",
      "duration": 1250,
      "screenshotAfter": "screenshot-001.png"
    }
  ],
  "artifacts": [ /* artifact list */ ],
  "timeline": [ /* generated timeline */ ]
}
```

#### POST /api/reports/runs
Create a new test run.

**Request Body:**
```json
{
  "suiteId": "suite-123",
  "suiteName": "API Test Suite", 
  "environment": "staging",
  "browser": "chromium",
  "testMode": "headless"
}
```

#### GET /api/reports/runs/:runId/media/:artifactId
Stream media artifacts (screenshots, videos) with support for thumbnails and range requests.

**Query Parameters:**
- `thumbnail`: Return thumbnail version (default: false)
- `download`: Force download vs. inline display (default: false)

### Artifact Management

#### POST /api/reports/runs/:runId/artifacts
Upload test artifacts with metadata.

**Form Data:**
- `file`: The artifact file
- `stepId`: Associated step ID (optional)
- `artifactType`: screenshot, video, log, trace, report
- `metadata`: Additional metadata as JSON

#### POST /api/reports/runs/:runId/parse-trace
Parse a Playwright trace file and extract steps, logs, and artifacts.

**Request Body:**
```json
{
  "traceFilePath": "/path/to/trace.zip",
  "videoFilePath": "/path/to/recording.webm",
  "screenshotsPath": "/path/to/screenshots/"
}
```

### Statistics & Analytics

#### GET /api/reports/stats
Get aggregated statistics with filtering support.

**Response:**
```json
{
  "totalRuns": 1250,
  "passRate": 87.5,
  "averageDuration": 45000,
  "mostFailedTests": [
    { "testName": "Payment Flow", "failureCount": 12 }
  ],
  "environmentStats": [
    { "environment": "staging", "runs": 650, "passRate": 92.1 }
  ],
  "trendData": [ /* historical data */ ]
}
```

## Usage Guide

### Setting Up Trace Collection

1. **Configure Playwright Tests**
```typescript
// playwright.config.ts
export default defineConfig({
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        trace: 'on',
        video: 'on' 
      }
    }
  ]
});
```

2. **Environment Variables**
```bash
# Backend configuration
DATABASE_PATH=./data/trace.db
ARTIFACTS_BASE_PATH=./artifacts
MAX_MEDIA_SIZE_MB=100
LOG_LEVEL=info

# Frontend configuration  
VITE_API_BASE_URL=http://localhost:3001
```

### Viewing Test Results

1. **Navigate to Reports**: Access the Reports page in the application
2. **Browse Runs**: Filter and search through test runs using the comprehensive filter system
3. **Analyze Execution**: Click on any run to open the detailed trace viewer
4. **Timeline Navigation**: Use the interactive timeline to jump between steps, errors, and events
5. **Media Review**: View screenshots and videos with full-screen modal and zoom capabilities

### Timeline Features

- **Step Markers**: Click any step to jump to that point in execution
- **Status Colors**: Green (passed), red (failed), yellow (warning), blue (info)
- **Playback Controls**: Auto-play through execution with configurable speed
- **Grouping**: Organize steps by test name for better navigation
- **Filtering**: Show only errors, specific action types, or search by text

### Media Handling

- **Screenshots**: Full-screen viewer with zoom, pan, rotate, and metadata display
- **Videos**: HTML5 player with step markers for precise navigation
- **Thumbnails**: Auto-generated previews for quick browsing
- **Downloads**: Bulk download artifacts or individual files

## Deployment

### Prerequisites

- Node.js 18+ (for backend services)
- SQLite 3+ (for database storage)
- FFmpeg (for video processing)
- Sharp (for image processing)

### Backend Deployment

1. **Install Dependencies**
```bash
cd backend
npm install
npm run build
```

2. **Initialize Database**
```bash
npm run migrate
```

3. **Configure Environment**
```bash
cp .env.example .env
# Edit .env with production values
```

4. **Start Services**
```bash
# Production with PM2
pm2 start ecosystem.config.js

# Or direct execution
npm start
```

### Frontend Integration

1. **Install Package**
```bash
cd playwright-smart
npm install
```

2. **Import Components**
```typescript
import { TraceViewer } from '@/components/TraceViewer';
import { TimelineView } from '@/components/TraceViewer/TimelineView';
```

3. **Configure API Client**
```typescript
// src/services/traceApi.ts
const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3001';
```

### Production Configuration

**Database Optimization:**
```sql
-- Enable WAL mode for better concurrency
PRAGMA journal_mode = WAL;

-- Optimize for read-heavy workload
PRAGMA cache_size = 10000;
PRAGMA temp_store = memory;
```

**Artifact Storage:**
```bash
# Create artifact directories with proper permissions
mkdir -p /var/lib/trace-viewer/artifacts
chown -R app:app /var/lib/trace-viewer
chmod -R 755 /var/lib/trace-viewer
```

**Nginx Configuration:**
```nginx
location /api/reports/runs/*/media/* {
    proxy_pass http://backend;
    proxy_buffering off;
    proxy_cache artifacts;
    proxy_cache_valid 200 1d;
    add_header X-Cache-Status $upstream_cache_status;
}
```

## Performance Considerations

### Database Optimization

- **Indexes**: All frequently queried columns have optimized indexes
- **Cleanup**: Automatic cleanup of old runs (configurable retention period)
- **Pagination**: All list endpoints support efficient pagination
- **Connection Pooling**: SQLite with WAL mode for concurrent access

### Media Handling

- **Lazy Loading**: Thumbnails loaded on demand with progressive enhancement
- **Streaming**: Video files support HTTP range requests for efficient playback
- **Compression**: Images optimized with Sharp, videos with FFmpeg
- **CDN Ready**: Signed URLs support for CDN distribution

### Frontend Performance

- **Virtualization**: Long timeline lists use virtual scrolling
- **Code Splitting**: Components loaded asynchronously
- **Caching**: API responses cached with React Query
- **Debounced Search**: Search inputs debounced to reduce API calls

## Security

### Access Control

- **Role-based Access**: Configurable permissions for viewing sensitive runs
- **Signed URLs**: Time-limited, tamper-proof URLs for media access
- **Input Validation**: All API inputs validated with Zod schemas
- **SQL Injection Prevention**: Prepared statements throughout

### Data Protection

- **Artifact Isolation**: Run artifacts stored in isolated directories
- **Metadata Sanitization**: Sensitive data filtered from traces
- **Secure Headers**: CORS, CSRF protection, and security headers
- **Audit Logging**: All access and modifications logged

## Troubleshooting

### Common Issues

**"Trace file not found"**
- Verify artifact paths in database match filesystem
- Check file permissions on artifacts directory
- Ensure cleanup job hasn't removed files prematurely

**"Media not loading"**
- Check network connectivity to media endpoints
- Verify signed URL generation and expiration
- Inspect browser console for CORS or network errors

**"Timeline not displaying steps"**
- Confirm trace parsing completed successfully
- Check database for step records with correct run ID
- Verify frontend API configuration and connectivity

**Performance Issues**
- Monitor database query performance with EXPLAIN QUERY PLAN
- Check artifact storage disk space and I/O performance
- Review frontend bundle size and network waterfall

### Debug Commands

```bash
# Check database integrity
sqlite3 data/trace.db "PRAGMA integrity_check;"

# View recent runs
sqlite3 data/trace.db "SELECT id, suite_name, status, started_at FROM test_runs ORDER BY started_at DESC LIMIT 10;"

# Monitor artifact storage
du -sh artifacts/
find artifacts/ -name "*.png" | wc -l

# Backend API health check
curl http://localhost:3001/api/reports/runs?limit=1

# Test media streaming
curl -I "http://localhost:3001/api/reports/runs/run-123/media/artifact-456"
```

## Advanced Features

### Custom Adapters

The system supports pluggable adapters for different test frameworks:

```typescript
interface ArtifactAdapter {
  parseTrace(filePath: string): Promise<ParsedTraceData>;
  generateThumbnail(imagePath: string): Promise<string>;
  extractMetadata(artifact: TraceArtifact): Promise<object>;
}

// Register custom adapter
traceParser.registerAdapter('cypress', new CypressAdapter());
```

### Webhook Integration

Configure webhooks for real-time notifications:

```json
{
  "webhooks": {
    "run_completed": "https://slack.example.com/webhook",
    "run_failed": "https://alerts.example.com/webhook"
  }
}
```

### Export Formats

Export capabilities include:
- HTML reports with embedded media
- JSON data for external analysis
- PDF summaries for stakeholder reporting
- JUnit XML for CI/CD integration

## Monitoring & Metrics

### Key Metrics

- **Trace Processing Time**: Time to parse and ingest artifacts
- **Media Serving Performance**: Response times for image/video requests
- **Database Performance**: Query execution times and lock contention
- **Storage Utilization**: Artifact storage growth and cleanup efficiency

### Health Checks

```bash
# Backend health endpoint
GET /health
{
  "status": "healthy",
  "database": "connected",
  "artifacts": "accessible",
  "version": "1.0.0"
}

# Worker status
GET /api/worker/status
{
  "active": true,
  "processing": 2,
  "queue": 5,
  "lastHealthy": "2024-01-01T12:00:00Z"
}
```

## Support & Contributing

### Getting Help

1. Check the troubleshooting section above
2. Review application logs for error details
3. Inspect network requests in browser developer tools
4. Search existing issues in the project repository

### Contributing

1. Follow the existing code style and patterns
2. Add tests for new functionality
3. Update documentation for API changes
4. Ensure all tests pass before submitting PRs

The Trace Viewer represents a comprehensive solution for test execution analysis, combining powerful backend services with an intuitive frontend experience. Its modular design ensures extensibility while maintaining production-grade performance and reliability.