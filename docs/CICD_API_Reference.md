# QA Intelligence CI/CD API Reference

**Version:** 2.0
**Last Updated:** 2025-09-26
**Base URL:** `http://localhost:8082/api`
**WebSocket URL:** `ws://localhost:8082/ws/wesign`

> **API Status**: Production-Ready with comprehensive WeSign integration

## Table of Contents

1. [Authentication](#authentication)
2. [Core API Endpoints](#core-api-endpoints)
3. [WeSign Integration APIs](#wesign-integration-apis)
4. [Test Execution APIs](#test-execution-apis)
5. [Analytics and Reporting APIs](#analytics-and-reporting-apis)
6. [CI/CD Management APIs](#cicd-management-apis)
7. [WebSocket APIs](#websocket-apis)
8. [Error Handling](#error-handling)
9. [Rate Limiting](#rate-limiting)
10. [SDK Examples](#sdk-examples)

---

## Authentication

### JWT Authentication

QA Intelligence uses JWT (JSON Web Tokens) for API authentication with multi-tenant support.

#### POST /api/auth/login

Authenticate user and obtain access token.

**Request:**
```json
{
  "email": "admin@demo.com",
  "password": "demo123",
  "tenantSubdomain": "demo" // Optional
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "demo-user-001",
    "email": "admin@demo.com",
    "name": "Demo Admin",
    "role": "admin",
    "tenant_id": "00000000-0000-0000-0000-000000000001",
    "settings": {}
  },
  "tenant": {
    "id": "00000000-0000-0000-0000-000000000001",
    "name": "Demo Tenant",
    "subdomain": "demo",
    "plan": "enterprise",
    "status": "active"
  }
}
```

**Error Response (401 Unauthorized):**
```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

#### POST /api/auth/register

Register new user and tenant organization.

**Request:**
```json
{
  "email": "user@company.com",
  "password": "SecurePass123!",
  "confirmPassword": "SecurePass123!",
  "companyName": "Your Company",
  "subdomain": "yourcompany",
  "plan": "starter" // starter, professional, enterprise
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-uuid",
    "email": "user@company.com",
    "name": "Your Company Admin",
    "role": "admin",
    "tenant_id": "tenant-uuid",
    "settings": {}
  },
  "tenant": {
    "id": "tenant-uuid",
    "name": "Your Company",
    "subdomain": "yourcompany",
    "plan": "starter",
    "status": "active"
  }
}
```

#### GET /api/auth/me

Get current user information.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "id": "user-uuid",
    "email": "user@company.com",
    "name": "User Name",
    "role": "admin",
    "tenant_id": "tenant-uuid",
    "settings": {}
  },
  "tenant": {
    "id": "tenant-uuid",
    "name": "Company Name",
    "subdomain": "company",
    "plan": "enterprise",
    "status": "active"
  }
}
```

#### POST /api/auth/refresh

Refresh JWT token before expiration.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "token": "new-jwt-token-here"
}
```

#### POST /api/auth/logout

Logout user (client-side token invalidation).

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

---

## Core API Endpoints

### System Health

#### GET /api/health

System health check with comprehensive status.

**Response (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2025-09-26T08:00:00.000Z",
  "version": "2.0.0",
  "database": {
    "healthy": true,
    "path": "memory.sqlite"
  },
  "worker": {
    "running": true,
    "activeExecutions": 2,
    "maxConcurrent": 4,
    "uptime": "2h 15m 30s"
  },
  "environment": "production"
}
```

#### GET /api/worker/status (Development Only)

Get worker process status.

**Response (200 OK):**
```json
{
  "isRunning": true,
  "activeExecutions": 2,
  "maxConcurrentExecutions": 4,
  "uptime": "2h 15m 30s",
  "totalProcessed": 1847,
  "errorRate": 0.03,
  "avgExecutionTime": "2.5s"
}
```

#### POST /api/worker/restart (Development Only)

Restart worker process.

**Response (200 OK):**
```json
{
  "message": "Worker restarted successfully"
}
```

---

## WeSign Integration APIs

### Unified WeSign API - Phase 2

The unified WeSign API provides comprehensive integration with the WeSign digital signing platform.

#### POST /api/wesign/unified/execute

Execute WeSign tests with advanced configuration.

**Request:**
```json
{
  "framework": "wesign",
  "mode": "parallel", // parallel, sequential, distributed
  "workers": 2,
  "timeout": 300000,
  "browser": "chromium", // chromium, firefox, webkit
  "headless": true,
  "testIds": ["test-auth-001", "test-document-upload"],
  "suites": ["authentication", "document-management"],
  "tags": ["smoke", "critical"],
  "categories": ["login", "document-processing"],
  "pattern": "test_*.py",
  "aiEnabled": true,
  "autoHeal": true,
  "generateInsights": true,
  "predictFlakiness": false,
  "realTimeMonitoring": true,
  "notifications": true,
  "streaming": true,
  "priority": "normal", // low, normal, high, critical
  "scheduledTime": "2025-09-26T10:00:00Z", // Optional
  "requestedBy": "ci-pipeline"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "executionId": "exec-uuid-12345",
  "status": "queued",
  "message": "Test execution queued successfully",
  "estimatedStartTime": "2025-09-26T10:00:00Z",
  "queuePosition": 3
}
```

#### GET /api/wesign/unified/status/{executionId}

Get execution status and real-time updates.

**Response (200 OK):**
```json
{
  "success": true,
  "execution": {
    "id": "exec-uuid-12345",
    "status": "running", // queued, running, completed, failed, cancelled
    "progress": {
      "total": 25,
      "completed": 15,
      "failed": 2,
      "skipped": 0,
      "percentage": 60
    },
    "startTime": "2025-09-26T09:30:00Z",
    "duration": "00:04:30",
    "estimatedCompletion": "2025-09-26T09:37:00Z",
    "currentTest": {
      "id": "test-document-sign",
      "name": "Document Signing Workflow",
      "status": "running",
      "duration": "00:00:45"
    }
  },
  "stats": {
    "passRate": 86.7,
    "avgTestDuration": "12.3s",
    "healingAttempts": 3,
    "healingSuccessRate": 66.7
  }
}
```

#### GET /api/wesign/unified/results/{executionId}

Get complete test execution results.

**Response (200 OK):**
```json
{
  "success": true,
  "execution": {
    "id": "exec-uuid-12345",
    "status": "completed",
    "summary": {
      "total": 25,
      "passed": 22,
      "failed": 2,
      "skipped": 1,
      "passRate": 88.0,
      "duration": "00:06:45"
    },
    "results": [
      {
        "testId": "test-auth-001",
        "name": "WeSign Authentication",
        "status": "passed",
        "duration": "00:00:08",
        "artifacts": [
          "screenshots/test-auth-001-success.png",
          "traces/test-auth-001.zip"
        ],
        "healingApplied": false
      },
      {
        "testId": "test-document-upload",
        "name": "Document Upload Process",
        "status": "failed",
        "duration": "00:00:15",
        "error": "Element not found: #upload-button",
        "artifacts": [
          "screenshots/test-document-upload-failure.png",
          "traces/test-document-upload.zip"
        ],
        "healingApplied": true,
        "healingSuccess": false,
        "healingAttempts": 3
      }
    ],
    "artifacts": {
      "reportUrl": "/reports/exec-uuid-12345/index.html",
      "traceViewerUrl": "/trace-viewer/exec-uuid-12345",
      "videoFiles": [
        "videos/test-auth-001.webm",
        "videos/test-document-upload.webm"
      ]
    }
  }
}
```

#### DELETE /api/wesign/unified/cancel/{executionId}

Cancel running test execution.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Test execution cancelled successfully",
  "executionId": "exec-uuid-12345",
  "status": "cancelled"
}
```

### WeSign Test Discovery

#### GET /api/wesign/tests

Discover available WeSign tests.

**Query Parameters:**
- `category` - Filter by test category
- `tags` - Filter by tags (comma-separated)
- `search` - Search in test names/descriptions

**Response (200 OK):**
```json
{
  "success": true,
  "tests": [
    {
      "id": "test-auth-001",
      "name": "WeSign Authentication",
      "description": "Test user login and authentication flow",
      "category": "authentication",
      "tags": ["smoke", "critical", "auth"],
      "estimatedDuration": "8s",
      "lastRun": "2025-09-25T14:30:00Z",
      "successRate": 98.5
    },
    {
      "id": "test-document-upload",
      "name": "Document Upload Process",
      "description": "Test document upload and validation",
      "category": "document-management",
      "tags": ["core", "upload"],
      "estimatedDuration": "15s",
      "lastRun": "2025-09-25T14:30:00Z",
      "successRate": 94.2
    }
  ],
  "totalTests": 311,
  "categories": [
    "authentication",
    "document-management",
    "signing-workflow",
    "distribution",
    "contacts",
    "templates"
  ]
}
```

#### GET /api/wesign/test/{testId}

Get detailed information about a specific test.

**Response (200 OK):**
```json
{
  "success": true,
  "test": {
    "id": "test-auth-001",
    "name": "WeSign Authentication",
    "description": "Comprehensive authentication flow testing",
    "category": "authentication",
    "tags": ["smoke", "critical", "auth"],
    "file": "tests/auth/test_authentication.py",
    "function": "test_user_login_success",
    "dependencies": [],
    "fixtures": ["browser", "test_config"],
    "estimatedDuration": "8s",
    "parameters": {
      "username": "configurable",
      "password": "configurable",
      "environment": "dev"
    },
    "history": {
      "totalRuns": 1247,
      "successRate": 98.5,
      "avgDuration": "7.8s",
      "lastFailure": "2025-09-20T10:15:00Z",
      "commonFailures": [
        "Network timeout",
        "Element not found"
      ]
    }
  }
}
```

---

## Test Execution APIs

### Test Runs Management

#### GET /api/test-runs

Get test execution history.

**Query Parameters:**
- `limit` - Number of results (default: 50, max: 200)
- `offset` - Pagination offset
- `status` - Filter by status (passed, failed, running)
- `dateFrom` - Start date (ISO 8601)
- `dateTo` - End date (ISO 8601)

**Response (200 OK):**
```json
{
  "success": true,
  "runs": [
    {
      "id": "run-uuid-001",
      "executionId": "exec-uuid-12345",
      "status": "completed",
      "startTime": "2025-09-26T09:30:00Z",
      "endTime": "2025-09-26T09:36:45Z",
      "duration": "00:06:45",
      "testsTotal": 25,
      "testsPassed": 22,
      "testsFailed": 2,
      "testsSkipped": 1,
      "passRate": 88.0,
      "triggeredBy": "ci-pipeline",
      "environment": "production"
    }
  ],
  "pagination": {
    "total": 1847,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

#### GET /api/test-runs/{runId}

Get detailed test run information.

**Response (200 OK):**
```json
{
  "success": true,
  "run": {
    "id": "run-uuid-001",
    "executionId": "exec-uuid-12345",
    "status": "completed",
    "configuration": {
      "browser": "chromium",
      "headless": true,
      "workers": 2,
      "timeout": 300000
    },
    "timeline": [
      {
        "timestamp": "2025-09-26T09:30:00Z",
        "event": "execution_started",
        "details": "Test execution started with 25 tests"
      },
      {
        "timestamp": "2025-09-26T09:36:45Z",
        "event": "execution_completed",
        "details": "Test execution completed successfully"
      }
    ],
    "summary": {
      "total": 25,
      "passed": 22,
      "failed": 2,
      "skipped": 1,
      "passRate": 88.0,
      "duration": "00:06:45"
    },
    "artifacts": {
      "allureReport": "/reports/run-uuid-001/allure/index.html",
      "htmlReport": "/reports/run-uuid-001/pytest_report.html",
      "traceViewer": "/trace-viewer/run-uuid-001",
      "screenshots": "/artifacts/run-uuid-001/screenshots/",
      "videos": "/artifacts/run-uuid-001/videos/"
    }
  }
}
```

### Test Scheduling

#### GET /api/schedules

Get scheduled test executions.

**Response (200 OK):**
```json
{
  "success": true,
  "schedules": [
    {
      "id": "schedule-uuid-001",
      "name": "Daily WeSign Smoke Tests",
      "description": "Run critical WeSign tests every day at 6 AM",
      "cron": "0 6 * * *",
      "nextRun": "2025-09-27T06:00:00Z",
      "lastRun": "2025-09-26T06:00:00Z",
      "lastStatus": "completed",
      "enabled": true,
      "configuration": {
        "testSuites": ["authentication", "document-upload"],
        "tags": ["smoke", "critical"],
        "browser": "chromium",
        "workers": 2
      }
    }
  ]
}
```

#### POST /api/schedules

Create new test schedule.

**Request:**
```json
{
  "name": "Weekly Full Regression",
  "description": "Complete WeSign test suite every Sunday",
  "cron": "0 2 * * 0",
  "enabled": true,
  "configuration": {
    "testIds": ["all"],
    "browser": "chromium",
    "workers": 4,
    "timeout": 1800000,
    "aiEnabled": true,
    "notifications": true
  },
  "notifications": {
    "onSuccess": ["team@company.com"],
    "onFailure": ["team@company.com", "oncall@company.com"],
    "slack": "#qa-alerts"
  }
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "schedule": {
    "id": "schedule-uuid-002",
    "name": "Weekly Full Regression",
    "cron": "0 2 * * 0",
    "nextRun": "2025-10-06T02:00:00Z",
    "enabled": true,
    "created": "2025-09-26T10:00:00Z"
  }
}
```

#### PUT /api/schedules/{scheduleId}

Update existing schedule.

#### DELETE /api/schedules/{scheduleId}

Delete schedule.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Schedule deleted successfully"
}
```

---

## Analytics and Reporting APIs

### Analytics Dashboard

#### GET /api/analytics/dashboard

Get dashboard analytics data.

**Query Parameters:**
- `period` - Time period (7d, 30d, 90d, 1y)
- `timezone` - Timezone (default: UTC)

**Response (200 OK):**
```json
{
  "success": true,
  "period": "30d",
  "summary": {
    "totalExecutions": 847,
    "totalTests": 21175,
    "overallPassRate": 94.2,
    "avgExecutionTime": "4m 32s",
    "healingSuccessRate": 73.5,
    "trend": "improving"
  },
  "charts": {
    "dailyExecutions": [
      {
        "date": "2025-09-01",
        "executions": 28,
        "tests": 702,
        "passRate": 93.1
      }
    ],
    "testCategoryPerformance": [
      {
        "category": "authentication",
        "tests": 156,
        "passRate": 98.7,
        "avgDuration": "8.2s"
      },
      {
        "category": "document-management",
        "tests": 420,
        "passRate": 92.1,
        "avgDuration": "18.7s"
      }
    ],
    "flakiestTests": [
      {
        "testId": "test-document-upload",
        "name": "Document Upload Process",
        "flakiness": 12.3,
        "totalRuns": 89,
        "failures": 11
      }
    ]
  },
  "insights": [
    {
      "type": "performance",
      "severity": "info",
      "message": "Test execution time improved by 15% this month",
      "details": "Average execution time decreased from 5m 18s to 4m 32s"
    },
    {
      "type": "reliability",
      "severity": "warning",
      "message": "Document upload tests showing increased flakiness",
      "details": "Consider reviewing test stability improvements"
    }
  ]
}
```

#### GET /api/analytics/trends

Get performance trend analysis.

**Response (200 OK):**
```json
{
  "success": true,
  "trends": {
    "passRate": {
      "current": 94.2,
      "previous": 92.8,
      "change": 1.4,
      "direction": "up",
      "trend": "improving"
    },
    "executionTime": {
      "current": "4m 32s",
      "previous": "5m 18s",
      "change": -46,
      "direction": "down",
      "trend": "improving"
    },
    "flakiness": {
      "current": 8.3,
      "previous": 9.7,
      "change": -1.4,
      "direction": "down",
      "trend": "improving"
    }
  },
  "predictions": {
    "nextWeekPassRate": 94.8,
    "confidence": 87.5,
    "factors": [
      "Recent healing improvements",
      "Stable environment performance",
      "Reduced flaky test count"
    ]
  }
}
```

### Reports API

#### GET /api/reports

Get available test reports.

**Response (200 OK):**
```json
{
  "success": true,
  "reports": [
    {
      "id": "report-uuid-001",
      "name": "Daily WeSign Test Report",
      "type": "html",
      "date": "2025-09-26",
      "executionId": "exec-uuid-12345",
      "url": "/reports/2025-09-26/daily-report.html",
      "summary": {
        "total": 25,
        "passed": 22,
        "failed": 2,
        "skipped": 1
      }
    }
  ]
}
```

#### GET /api/reports/generate

Generate custom test report.

**Query Parameters:**
- `type` - Report type (html, pdf, json, excel)
- `dateFrom` - Start date
- `dateTo` - End date
- `format` - Output format
- `includeArtifacts` - Include test artifacts

**Response (200 OK):**
```json
{
  "success": true,
  "reportId": "custom-report-uuid",
  "status": "generating",
  "estimatedCompletion": "2025-09-26T10:05:00Z",
  "downloadUrl": "/reports/download/custom-report-uuid"
}
```

---

## CI/CD Management APIs

### Build Integration

#### POST /api/ci/webhook

Webhook endpoint for CI/CD integration.

**Request (GitHub):**
```json
{
  "repository": {
    "name": "wesign-tests",
    "full_name": "company/wesign-tests"
  },
  "head_commit": {
    "id": "abc123def456",
    "message": "Add new document upload tests"
  },
  "pusher": {
    "name": "developer"
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Webhook processed successfully",
  "triggered": {
    "executionId": "exec-webhook-001",
    "tests": ["smoke", "regression"],
    "estimatedDuration": "8m"
  }
}
```

#### GET /api/ci/status/{buildId}

Get CI/CD build status.

**Response (200 OK):**
```json
{
  "success": true,
  "build": {
    "id": "build-uuid-001",
    "status": "completed",
    "result": "success",
    "startTime": "2025-09-26T09:00:00Z",
    "endTime": "2025-09-26T09:08:30Z",
    "duration": "00:08:30",
    "stages": [
      {
        "name": "setup",
        "status": "completed",
        "duration": "00:01:15"
      },
      {
        "name": "test-execution",
        "status": "completed",
        "duration": "00:06:45"
      },
      {
        "name": "report-generation",
        "status": "completed",
        "duration": "00:00:30"
      }
    ],
    "artifacts": {
      "testReport": "/builds/build-uuid-001/test-report.html",
      "coverage": "/builds/build-uuid-001/coverage.html"
    }
  }
}
```

### Environment Management

#### GET /api/environments

Get available test environments.

**Response (200 OK):**
```json
{
  "success": true,
  "environments": [
    {
      "id": "env-dev",
      "name": "Development",
      "url": "https://dev.wesign.example.com",
      "status": "healthy",
      "version": "v2.1.3-dev",
      "lastHealthCheck": "2025-09-26T09:55:00Z"
    },
    {
      "id": "env-staging",
      "name": "Staging",
      "url": "https://staging.wesign.example.com",
      "status": "healthy",
      "version": "v2.1.2",
      "lastHealthCheck": "2025-09-26T09:55:00Z"
    },
    {
      "id": "env-prod",
      "name": "Production",
      "url": "https://wesign.example.com",
      "status": "healthy",
      "version": "v2.1.1",
      "lastHealthCheck": "2025-09-26T09:55:00Z"
    }
  ]
}
```

#### POST /api/environments/{envId}/health-check

Trigger environment health check.

**Response (200 OK):**
```json
{
  "success": true,
  "environment": "env-staging",
  "status": "healthy",
  "checks": {
    "database": "healthy",
    "redis": "healthy",
    "wesign_api": "healthy",
    "file_storage": "healthy"
  },
  "responseTime": "145ms",
  "timestamp": "2025-09-26T10:00:00Z"
}
```

---

## WebSocket APIs

### Real-Time Test Execution

Connect to WebSocket for real-time test execution updates.

**Connection:**
```javascript
const ws = new WebSocket('ws://localhost:8082/ws/wesign');
```

**Message Types:**

#### Connection Established
```json
{
  "type": "connection",
  "status": "connected",
  "timestamp": "2025-09-26T10:00:00Z",
  "message": "Connected to WeSign real-time updates"
}
```

#### Test Started
```json
{
  "type": "test_started",
  "executionId": "exec-uuid-12345",
  "testId": "test-auth-001",
  "testName": "WeSign Authentication",
  "timestamp": "2025-09-26T10:00:15Z"
}
```

#### Test Progress
```json
{
  "type": "test_progress",
  "executionId": "exec-uuid-12345",
  "progress": {
    "completed": 8,
    "total": 25,
    "percentage": 32,
    "currentTest": "test-document-upload"
  },
  "timestamp": "2025-09-26T10:02:30Z"
}
```

#### Test Completed
```json
{
  "type": "test_completed",
  "executionId": "exec-uuid-12345",
  "testId": "test-auth-001",
  "status": "passed",
  "duration": "00:00:08",
  "timestamp": "2025-09-26T10:00:23Z"
}
```

#### Test Failed
```json
{
  "type": "test_failed",
  "executionId": "exec-uuid-12345",
  "testId": "test-document-upload",
  "status": "failed",
  "error": "Element not found: #upload-button",
  "healingAttempted": true,
  "healingSuccess": false,
  "artifacts": {
    "screenshot": "/artifacts/test-document-upload-failure.png",
    "trace": "/traces/test-document-upload.zip"
  },
  "timestamp": "2025-09-26T10:02:45Z"
}
```

#### Execution Completed
```json
{
  "type": "execution_completed",
  "executionId": "exec-uuid-12345",
  "status": "completed",
  "summary": {
    "total": 25,
    "passed": 22,
    "failed": 2,
    "skipped": 1,
    "duration": "00:06:45"
  },
  "reportUrl": "/reports/exec-uuid-12345/index.html",
  "timestamp": "2025-09-26T10:06:45Z"
}
```

#### Client Message: Subscribe to Events
```json
{
  "type": "subscribe",
  "events": ["test_started", "test_completed", "test_failed"]
}
```

#### Ping/Pong for Connection Health
```json
// Client sends
{
  "type": "ping"
}

// Server responds
{
  "type": "pong",
  "timestamp": "2025-09-26T10:00:00Z"
}
```

---

## Error Handling

### HTTP Status Codes

- **200 OK** - Request successful
- **201 Created** - Resource created successfully
- **400 Bad Request** - Invalid request parameters
- **401 Unauthorized** - Authentication required or invalid
- **403 Forbidden** - Access denied
- **404 Not Found** - Resource not found
- **409 Conflict** - Resource conflict (e.g., duplicate email)
- **429 Too Many Requests** - Rate limit exceeded
- **500 Internal Server Error** - Server error

### Error Response Format

```json
{
  "success": false,
  "error": "ValidationError",
  "message": "Invalid request parameters",
  "details": {
    "field": "email",
    "code": "INVALID_EMAIL",
    "description": "Please provide a valid email address"
  },
  "timestamp": "2025-09-26T10:00:00Z",
  "requestId": "req-uuid-12345"
}
```

### Common Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `INVALID_CREDENTIALS` | Login credentials invalid | Check username/password |
| `TOKEN_EXPIRED` | JWT token has expired | Refresh token or re-login |
| `RATE_LIMIT_EXCEEDED` | Too many requests | Wait before retrying |
| `EXECUTION_NOT_FOUND` | Test execution not found | Verify execution ID |
| `TEST_NOT_FOUND` | Test ID not found | Check available tests |
| `ENVIRONMENT_UNAVAILABLE` | Target environment down | Check environment status |
| `INSUFFICIENT_PERMISSIONS` | Access denied | Check user permissions |
| `VALIDATION_ERROR` | Request validation failed | Fix request parameters |

---

## Rate Limiting

### Rate Limits

| Endpoint Category | Requests per Minute | Burst Limit |
|-------------------|-------------------|-------------|
| Authentication | 10 | 20 |
| Test Execution | 30 | 50 |
| Status Queries | 100 | 200 |
| Analytics | 60 | 100 |
| WebSocket Connections | 5 | 10 |

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
X-RateLimit-Retry-After: 60
```

### Rate Limit Response

```json
{
  "success": false,
  "error": "RateLimitExceeded",
  "message": "Rate limit exceeded. Try again in 60 seconds.",
  "retryAfter": 60,
  "limit": 100,
  "remaining": 0,
  "timestamp": "2025-09-26T10:00:00Z"
}
```

---

## SDK Examples

### JavaScript/TypeScript SDK

```typescript
// Installation
// npm install @qa-intelligence/sdk

import { QAIntelligenceClient } from '@qa-intelligence/sdk';

const client = new QAIntelligenceClient({
  baseURL: 'http://localhost:8082/api',
  token: 'your-jwt-token-here'
});

// Execute WeSign tests
const execution = await client.wesign.execute({
  suites: ['authentication', 'document-upload'],
  tags: ['smoke'],
  browser: 'chromium',
  workers: 2
});

console.log('Execution ID:', execution.executionId);

// Monitor execution progress
const status = await client.wesign.getStatus(execution.executionId);
console.log('Progress:', status.execution.progress);

// Get results
const results = await client.wesign.getResults(execution.executionId);
console.log('Pass Rate:', results.execution.summary.passRate);
```

### Python SDK

```python
# Installation
# pip install qa-intelligence-sdk

from qa_intelligence import QAIntelligenceClient

client = QAIntelligenceClient(
    base_url='http://localhost:8082/api',
    token='your-jwt-token-here'
)

# Execute tests
execution = client.wesign.execute(
    suites=['authentication', 'document-upload'],
    tags=['smoke'],
    browser='chromium',
    workers=2
)

print(f"Execution ID: {execution['executionId']}")

# Monitor execution
status = client.wesign.get_status(execution['executionId'])
print(f"Progress: {status['execution']['progress']['percentage']}%")

# Get results
results = client.wesign.get_results(execution['executionId'])
print(f"Pass Rate: {results['execution']['summary']['passRate']}%")
```

### cURL Examples

#### Authenticate
```bash
curl -X POST http://localhost:8082/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@demo.com",
    "password": "demo123"
  }'
```

#### Execute WeSign Tests
```bash
curl -X POST http://localhost:8082/api/wesign/unified/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "suites": ["authentication", "document-upload"],
    "tags": ["smoke"],
    "browser": "chromium",
    "workers": 2,
    "aiEnabled": true
  }'
```

#### Get Execution Status
```bash
curl -X GET http://localhost:8082/api/wesign/unified/status/exec-uuid-12345 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Get Analytics Dashboard
```bash
curl -X GET "http://localhost:8082/api/analytics/dashboard?period=30d" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### WebSocket Integration

```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:8082/ws/wesign');

ws.on('open', () => {
  console.log('Connected to QA Intelligence WebSocket');

  // Subscribe to specific events
  ws.send(JSON.stringify({
    type: 'subscribe',
    events: ['test_started', 'test_completed', 'test_failed']
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data);

  switch (message.type) {
    case 'test_started':
      console.log(`Test started: ${message.testName}`);
      break;
    case 'test_completed':
      console.log(`Test completed: ${message.testId} - ${message.status}`);
      break;
    case 'test_failed':
      console.log(`Test failed: ${message.testId} - ${message.error}`);
      break;
    case 'execution_completed':
      console.log(`Execution completed with ${message.summary.passRate}% pass rate`);
      break;
  }
});

// Handle connection health
setInterval(() => {
  ws.send(JSON.stringify({ type: 'ping' }));
}, 30000);
```

---

## API Versioning

### Version Headers

Include API version in requests:

```http
Accept: application/json
API-Version: 2.0
```

### Version Support

- **v1.0** - Legacy support (deprecated)
- **v2.0** - Current version (recommended)
- **v2.1** - Beta features (optional)

### Migration Guide

See `/docs/api-migration-guide.md` for upgrading from v1.0 to v2.0.

---

**Document Status:**
- Version: 2.0
- Status: Production Ready
- Last Updated: 2025-09-26
- Next Review: 2026-03-26
- Maintainer: QA Intelligence Team