# Test Scheduler Documentation

## Overview

The Test Scheduler is a production-ready scheduling system that allows users to schedule test suite runs with timezone awareness, manage upcoming executions, and review their status and results.

## Features

### Core Functionality
- **Schedule Management**: Create, view, edit, cancel, and delete scheduled test runs
- **Timezone Support**: Full DST-aware timezone handling with Asia/Jerusalem as default
- **Worker System**: Automatic execution using a reliable worker process with concurrency control
- **Real-time Updates**: Live status tracking and execution results
- **Run History**: Complete audit trail of all executions with artifacts

### Advanced Features
- **Priority Scheduling**: 1-10 priority levels for execution ordering
- **Retry Logic**: Configurable retry attempts with exponential backoff
- **Concurrency Control**: Prevents duplicate runs and manages system resources
- **Execution Options**: Headless/headed mode, browser selection, parallel/sequential execution
- **Run Now**: Immediate execution while maintaining scheduled runs

## Architecture

### Frontend (React + TypeScript)
```
src/
├── components/TestRunScheduler.tsx    # Main scheduler component
├── types/scheduler.ts                 # TypeScript definitions
├── services/schedulerApi.ts          # API client
└── pages/TestBank/TestBankPage.tsx    # Integration point
```

### Backend (Node.js + TypeScript)
```
backend/src/
├── server.ts                  # Express server
├── routes/schedules.ts        # API endpoints
├── database/
│   ├── database.ts           # Database abstraction
│   └── schema.sql            # SQLite schema
├── workers/scheduler.ts       # Background worker
├── services/execution.ts      # Test execution logic
├── utils/
│   ├── timezone.ts           # Timezone utilities
│   └── logger.ts             # Structured logging
└── types/scheduler.ts         # Type definitions
```

### Database Schema
- `schedules`: Scheduled test runs with timezone info
- `schedule_runs`: Execution history and results
- Views and indexes for optimal performance

## API Endpoints

### Schedules Management

#### POST /api/schedules
Create a new scheduled run.

**Request Body:**
```json
{
  "suite_id": "suite-123",
  "suite_name": "Regression Suite",
  "run_at": "2024-12-01T14:30:00.000",
  "timezone": "Asia/Jerusalem",
  "notes": "Weekly regression run",
  "priority": 5,
  "execution_options": {
    "mode": "headless",
    "execution": "parallel",
    "retries": 2,
    "browser": "chromium",
    "environment": "staging"
  },
  "run_now": false
}
```

**Response:**
```json
{
  "schedule": {
    "id": "schedule_1234567890_abcdef123",
    "suite_id": "suite-123",
    "suite_name": "Regression Suite",
    "timezone": "Asia/Jerusalem",
    "run_at_utc": "2024-12-01T12:30:00.000Z",
    "run_at_local": "2024-12-01T14:30:00.000+02:00",
    "status": "scheduled",
    "priority": 5,
    "minutes_until_run": 1440,
    "created_at": "2024-11-30T10:00:00.000Z"
  },
  "timezone_info": {
    "name": "Asia/Jerusalem",
    "abbreviation": "IST",
    "offset": "GMT+02:00",
    "isDST": false
  }
}
```

#### GET /api/schedules
List scheduled runs with filtering options.

**Query Parameters:**
- `status`: Filter by status (scheduled, running, completed, failed, canceled)
- `suite_id`: Filter by suite ID
- `from_date`: Start date filter (ISO 8601)
- `to_date`: End date filter (ISO 8601)
- `limit`: Maximum results (default: 50, max: 100)
- `offset`: Pagination offset (default: 0)

#### GET /api/schedules/:id
Get single schedule with execution history.

#### PATCH /api/schedules/:id
Update schedule details.

#### POST /api/schedules/:id/run-now
Trigger immediate execution.

#### POST /api/schedules/:id/cancel
Cancel a scheduled run.

#### DELETE /api/schedules/:id
Delete a schedule.

#### GET /api/schedules/stats/summary
Get scheduling statistics.

## Usage Guide

### From Test Bank UI

1. **Navigate to Test Bank**: Go to the Test Bank page in the application
2. **Switch to Scheduler Tab**: Click on "Scheduled Runs" tab
3. **Select Tests**: Return to "Tests & Suites" tab and select tests to create a suite
4. **Schedule Run**: 
   - Switch back to "Scheduled Runs" tab
   - Click "Schedule Run" button
   - Fill in the scheduling form:
     - **Date & Time**: Select when to run (minimum 1 minute from now)
     - **Timezone**: Default is Asia/Jerusalem, supports DST transitions
     - **Browser**: Choose execution browser (Chromium, Firefox, WebKit, or All)
     - **Mode**: Headless (default) or Headed execution
     - **Priority**: 1-10 scale for execution order
     - **Notes**: Optional description
     - **Run Now**: Also execute immediately
5. **Submit**: Click "Schedule Run" or "Schedule & Run"

### Managing Schedules

- **View Status**: Real-time status updates in the scheduled runs list
- **Time Until Run**: Shows countdown or "Overdue" for past runs
- **Actions**:
  - **Run Now**: Execute immediately while keeping the schedule
  - **Cancel**: Cancel future execution
  - **Delete**: Remove the schedule permanently

### Execution Results

Each completed run shows:
- Status (completed/failed)
- Test statistics (passed/failed/total)
- Execution time
- Links to artifacts (screenshots, videos, reports)

## Environment Configuration

### Backend Environment Variables

```bash
# Server Configuration
NODE_ENV=production
PORT=3001
CORS_ORIGIN=http://localhost:5173

# Database
DATABASE_PATH=./data/scheduler.db

# Worker Configuration
MAX_CONCURRENT_EXECUTIONS=3
POLL_INTERVAL_MS=30000
CLEANUP_DAYS=30

# Logging
LOG_LEVEL=info
SCHEDULER_LOG_LEVEL=debug
LOG_DIR=./logs

# Timezone
DEFAULT_TIMEZONE=Asia/Jerusalem

# Test Execution
ARTIFACTS_BASE_PATH=./artifacts
DEFAULT_TEST_TIMEOUT_MS=300000
```

### Frontend Environment Variables

```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:3001
```

## Deployment

### Prerequisites
- Node.js 18+
- SQLite 3 (or PostgreSQL for production)
- Redis (optional, for BullMQ job queue)

### Backend Setup

```bash
cd backend
npm install
npm run build
npm run migrate  # Initialize database
npm start        # Start API server
npm run worker   # Start scheduler worker (separate process)
```

### Frontend Setup

```bash
cd playwright-smart
npm install
npm run build
npm run preview  # Or serve with your web server
```

### Production Deployment

1. **Database**: Use PostgreSQL for production
2. **Process Management**: Use PM2 or similar for both API and worker
3. **Load Balancing**: Multiple API instances behind load balancer
4. **Worker Scaling**: Single worker instance with high availability
5. **Monitoring**: Structured logs, health checks, metrics

## Timezone Handling

### DST Safety
- All times stored in UTC in database
- User input in local timezone converted to UTC
- Display times converted back to user's timezone
- DST transitions handled automatically
- Warning for schedules during DST transition periods

### Supported Timezones
- Asia/Jerusalem (Default)
- UTC
- Europe/London
- America/New_York
- America/Los_Angeles
- Europe/Berlin
- Asia/Tokyo
- Australia/Sydney

## Worker System

### Architecture
- Single worker process per deployment
- 30-second polling interval for scheduled runs
- Maximum 3 concurrent executions (configurable)
- Automatic claim expiration (5 minutes)
- Graceful shutdown handling

### Execution Flow
1. Worker polls for claimable schedules (due time reached)
2. Claims schedule with timeout lock
3. Creates execution context with artifacts directory
4. Executes test suite using existing Playwright infrastructure
5. Records results and artifacts
6. Updates schedule status
7. Handles retries on failure

### Monitoring
- Structured logging for all operations
- Health check endpoint
- Worker status API
- Database cleanup scheduled daily

## Error Handling

### Common Errors
- **Past Time**: Scheduling time is in the past
- **Invalid Timezone**: Unsupported timezone specified
- **Concurrency Conflict**: Schedule already claimed by another worker
- **Execution Failed**: Test execution encountered errors

### Retry Logic
- Automatic retries up to configured maximum (default: 3)
- Exponential backoff between retries
- Different retry behavior for different failure types
- Manual retry via "Run Now" action

## Security Considerations

### API Security
- Input validation using Zod schemas
- SQL injection prevention with prepared statements
- CORS configuration for frontend access
- Request logging for audit trail

### Data Protection
- No sensitive data stored in plain text
- Artifacts stored in secure directory with proper permissions
- Database file permissions restricted

## Performance

### Database Optimization
- Indexes on frequently queried columns
- Automatic cleanup of old records
- Connection pooling for concurrent access

### Worker Efficiency
- Concurrent execution limits prevent resource exhaustion
- Claim timeout prevents stuck executions
- Periodic cleanup of stale claims

## Troubleshooting

### Common Issues

**Schedule not executing:**
1. Check worker is running: `curl http://localhost:3001/api/worker/status`
2. Verify schedule time is in the future
3. Check logs for worker errors
4. Ensure no resource conflicts

**DST Issues:**
1. Verify timezone is supported
2. Check for warnings during DST transition periods
3. Use UTC display mode during transitions

**Performance Issues:**
1. Monitor concurrent executions
2. Check database size and cleanup
3. Review artifact storage usage
4. Optimize test execution parameters

### Log Analysis
- API requests: HTTP access logs
- Worker operations: Structured worker logs
- Test execution: Detailed execution logs with context
- Database operations: Query performance logs

## Future Enhancements

### Planned Features
- **Recurring Schedules**: Daily/weekly/monthly recurrence patterns
- **Notifications**: Email/Slack alerts for completion/failure
- **Calendar Integration**: Export schedules to calendar systems
- **Resource Management**: CPU/memory limits per execution
- **Distributed Workers**: Multiple worker instances with coordination

### Extensibility
- Plugin system for custom execution types
- Webhook integration for external systems
- API extensions for third-party tools
- Custom retry strategies