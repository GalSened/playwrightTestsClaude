# WeSign Test Orchestrator - API Reference

**Version:** 2.0 • **Last Updated:** 2025-09-28 • **Base URL:** `http://localhost:8082/api/wesign-tests`

## Authentication

Currently, the API operates without authentication in development mode. For production deployment, implement appropriate authentication mechanisms.

## Content Types

All API endpoints accept and return JSON data:
- **Request Content-Type:** `application/json`
- **Response Content-Type:** `application/json`

## Response Format

All API responses follow a consistent format:

```json
{
  "success": boolean,
  "data": object | array | null,
  "error": string | null,
  "timestamp": "ISO-8601 datetime",
  "requestId": "unique-request-identifier"
}
```

## Error Handling

### HTTP Status Codes

- **200 OK** - Request successful
- **400 Bad Request** - Invalid request parameters
- **404 Not Found** - Resource not found
- **409 Conflict** - Resource already exists or conflict
- **500 Internal Server Error** - Server error

### Error Response Format

```json
{
  "success": false,
  "data": null,
  "error": "Detailed error message",
  "errorCode": "ERROR_CODE",
  "timestamp": "2025-09-28T10:30:00.000Z",
  "requestId": "req_abc123"
}
```

## Endpoints

### Health Check

#### `GET /health`

Check the health status of the WeSign Test Orchestrator.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "2.0.0",
    "uptime": 3600,
    "testDiscovery": {
      "totalTests": 607,
      "totalSuites": 8,
      "lastScan": "2025-09-28T10:25:00.000Z"
    },
    "services": {
      "orchestrator": "active",
      "selfHealing": "active",
      "reporting": "active",
      "webSocket": "connected"
    }
  }
}
```

### Test Management

#### `GET /suites`

Retrieve all available test suites with metadata.

**Query Parameters:**
- `category` (optional): Filter by test category
- `tags` (optional): Comma-separated list of tags to filter by
- `status` (optional): Filter by last execution status

**Example Request:**
```bash
GET /api/wesign-tests/suites?category=authentication&tags=critical,smoke
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "auth-suite",
      "name": "Authentication Tests",
      "description": "Complete authentication workflow testing",
      "category": "Authentication",
      "tests": [
        {
          "id": "test_login_success",
          "name": "Login with Valid Credentials",
          "type": "ui",
          "status": "passed",
          "lastResult": {
            "status": "passed",
            "duration": 15000,
            "timestamp": "2025-09-28T09:30:00.000Z"
          }
        }
      ],
      "totalTests": 45,
      "passedTests": 42,
      "failedTests": 3,
      "lastExecuted": "2025-09-28T09:30:00.000Z",
      "executionTime": 675000,
      "tags": ["auth", "login", "security", "critical"],
      "metadata": {
        "priority": "high",
        "owner": "qa-team",
        "environment": "staging"
      }
    }
  ],
  "meta": {
    "total": 8,
    "filtered": 1,
    "categories": ["Authentication", "Signing", "Documents", "Templates", "Users", "Integration", "Performance", "Security"]
  }
}
```

#### `GET /tests`

Retrieve all individual tests with detailed information.

**Query Parameters:**
- `suiteId` (optional): Filter tests by suite ID
- `category` (optional): Filter by test category
- `type` (optional): Filter by test type (ui, api, e2e, integration)
- `status` (optional): Filter by last execution status
- `tags` (optional): Comma-separated list of tags

**Example Request:**
```bash
GET /api/wesign-tests/tests?type=api&status=failed&limit=10
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "test_api_auth_token_refresh",
      "name": "API Token Refresh",
      "description": "Verify automatic token refresh functionality",
      "category": "Authentication",
      "type": "api",
      "filePath": "/postman_collections/auth_api_tests.json",
      "suiteId": "auth-api-suite",
      "status": "failed",
      "lastResult": {
        "status": "failed",
        "duration": 5000,
        "timestamp": "2025-09-28T09:15:00.000Z",
        "error": "Token refresh endpoint returned 500",
        "artifacts": [
          "http://localhost:8082/artifacts/exec_123/newman_report.json"
        ]
      },
      "executionTime": 5000,
      "tags": ["api", "auth", "token", "critical"],
      "metadata": {
        "retries": 3,
        "timeout": 30000,
        "healingEnabled": true
      }
    }
  ],
  "meta": {
    "total": 607,
    "filtered": 15,
    "pagination": {
      "page": 1,
      "limit": 10,
      "hasNext": true
    }
  }
}
```

### Test Execution

#### `POST /execute`

Execute tests with comprehensive configuration options.

**Request Body:**
```json
{
  "executionType": "individual|suite|regression",
  "suiteIds": ["auth-suite", "signing-suite"],
  "testIds": ["test_login_success", "test_document_upload"],
  "parallel": true,
  "maxWorkers": 3,
  "selfHealingEnabled": true,
  "reportingEnabled": true,
  "reportFormats": ["comprehensive", "allure", "newman"],
  "environment": "staging",
  "tags": ["smoke", "critical"],
  "configuration": {
    "timeout": 30000,
    "retries": 2,
    "screenshotOnFailure": true,
    "videoRecording": false
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "executionId": "exec_20250928_103045_abc123",
    "status": "pending",
    "queuePosition": 1,
    "estimatedStartTime": "2025-09-28T10:31:00.000Z",
    "estimatedDuration": 1200,
    "totalTests": 67,
    "configuration": {
      "parallel": true,
      "maxWorkers": 3,
      "selfHealingEnabled": true,
      "reportFormats": ["comprehensive", "allure"]
    }
  }
}
```

#### `POST /execute/suite/{suiteId}`

Execute a specific test suite with optional configuration overrides.

**Path Parameters:**
- `suiteId`: The ID of the test suite to execute

**Request Body (Optional):**
```json
{
  "parallel": true,
  "maxWorkers": 5,
  "environment": "production",
  "tags": ["regression"],
  "selfHealingEnabled": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "executionId": "exec_20250928_104512_def456",
    "suiteId": "auth-suite",
    "status": "pending",
    "totalTests": 45,
    "estimatedDuration": 675
  }
}
```

#### `POST /execute/regression`

Execute a full regression test run with all available tests.

**Request Body (Optional):**
```json
{
  "parallel": true,
  "maxWorkers": 10,
  "excludeCategories": ["Performance"],
  "includeTags": ["critical", "smoke"],
  "environment": "staging",
  "selfHealingEnabled": true,
  "reportFormats": ["comprehensive", "allure", "newman"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "executionId": "exec_20250928_105030_ghi789",
    "type": "regression",
    "status": "pending",
    "totalTests": 520,
    "estimatedDuration": 3600,
    "parallelWorkers": 10
  }
}
```

### Execution Management

#### `GET /executions`

Retrieve all test executions with filtering and pagination.

**Query Parameters:**
- `status` (optional): Filter by execution status
- `type` (optional): Filter by execution type
- `limit` (optional): Number of results per page (default: 20)
- `offset` (optional): Pagination offset (default: 0)
- `sortBy` (optional): Sort field (startTime, duration, status)
- `sortOrder` (optional): Sort order (asc, desc)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "exec_20250928_103045_abc123",
      "runId": "run_20250928_103045",
      "type": "suite",
      "status": "running",
      "startTime": "2025-09-28T10:30:45.000Z",
      "endTime": null,
      "duration": null,
      "progress": 45,
      "currentTest": "test_document_signing_flow",
      "totalTests": 67,
      "passedTests": 28,
      "failedTests": 2,
      "skippedTests": 1,
      "config": {
        "executionType": "suite",
        "suiteIds": ["auth-suite", "signing-suite"],
        "parallel": true,
        "maxWorkers": 3,
        "selfHealingEnabled": true
      },
      "healing": {
        "enabled": true,
        "attemptsMade": 3,
        "successfulHeals": 2,
        "strategies": ["authentication", "elementInteraction"],
        "lastAttempt": "2025-09-28T10:35:12.000Z"
      },
      "reports": [
        {
          "id": "report_comprehensive_123",
          "type": "comprehensive",
          "status": "generating",
          "progress": 60
        }
      ]
    }
  ],
  "meta": {
    "total": 156,
    "page": 1,
    "limit": 20,
    "hasNext": true
  }
}
```

#### `GET /executions/{executionId}`

Get detailed information about a specific execution.

**Path Parameters:**
- `executionId`: The unique identifier of the execution

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "exec_20250928_103045_abc123",
    "runId": "run_20250928_103045",
    "type": "suite",
    "status": "completed",
    "startTime": "2025-09-28T10:30:45.000Z",
    "endTime": "2025-09-28T10:51:23.000Z",
    "duration": 1238000,
    "progress": 100,
    "totalTests": 67,
    "passedTests": 62,
    "failedTests": 3,
    "skippedTests": 2,
    "config": {
      "executionType": "suite",
      "suiteIds": ["auth-suite", "signing-suite"],
      "parallel": true,
      "maxWorkers": 3,
      "selfHealingEnabled": true,
      "reportingEnabled": true,
      "reportFormats": ["comprehensive", "allure"]
    },
    "results": [
      {
        "testId": "test_login_success",
        "status": "passed",
        "duration": 15000,
        "timestamp": "2025-09-28T10:31:00.000Z",
        "artifacts": [
          "http://localhost:8082/artifacts/exec_abc123/test_login_success_screenshot.png"
        ]
      }
    ],
    "healing": {
      "enabled": true,
      "attemptsMade": 5,
      "successfulHeals": 4,
      "strategies": ["authentication", "elementInteraction", "network"],
      "details": [
        {
          "testId": "test_document_upload",
          "attempt": 1,
          "strategy": "elementInteraction",
          "success": true,
          "duration": 2000,
          "timestamp": "2025-09-28T10:35:12.000Z"
        }
      ]
    },
    "reports": [
      {
        "id": "report_comprehensive_123",
        "type": "comprehensive",
        "status": "completed",
        "filePath": "/reports/exec_abc123/comprehensive.html",
        "htmlPath": "/reports/exec_abc123/comprehensive.html",
        "summary": {
          "totalTests": 67,
          "passed": 62,
          "failed": 3,
          "skipped": 2,
          "duration": 1238000,
          "coverage": 85.5
        }
      }
    ]
  }
}
```

#### `POST /executions/{executionId}/cancel`

Cancel a running execution.

**Path Parameters:**
- `executionId`: The unique identifier of the execution to cancel

**Response:**
```json
{
  "success": true,
  "data": {
    "executionId": "exec_20250928_103045_abc123",
    "status": "cancelled",
    "cancelledAt": "2025-09-28T10:35:30.000Z",
    "reason": "User requested cancellation",
    "partialResults": {
      "testsCompleted": 25,
      "testsRemaining": 42,
      "duration": 300000
    }
  }
}
```

### Reporting

#### `GET /executions/{executionId}/reports`

Get all available reports for an execution.

**Path Parameters:**
- `executionId`: The unique identifier of the execution

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "report_comprehensive_123",
      "type": "comprehensive",
      "status": "completed",
      "filePath": "/reports/exec_abc123/comprehensive.html",
      "downloadUrl": "http://localhost:8082/reports/exec_abc123/comprehensive.html",
      "size": 2048576,
      "generatedAt": "2025-09-28T10:52:00.000Z",
      "summary": {
        "totalTests": 67,
        "passed": 62,
        "failed": 3,
        "skipped": 2,
        "duration": 1238000
      }
    },
    {
      "id": "report_allure_456",
      "type": "allure",
      "status": "completed",
      "filePath": "/reports/exec_abc123/allure-report/index.html",
      "downloadUrl": "http://localhost:8082/reports/exec_abc123/allure-report/index.html",
      "size": 5242880,
      "generatedAt": "2025-09-28T10:52:15.000Z"
    }
  ]
}
```

#### `GET /executions/{executionId}/reports/{format}`

Get a specific report for an execution.

**Path Parameters:**
- `executionId`: The unique identifier of the execution
- `format`: The report format (comprehensive, allure, newman)

**Response:**
```json
{
  "success": true,
  "data": {
    "reportId": "report_comprehensive_123",
    "type": "comprehensive",
    "status": "completed",
    "reportPath": "/reports/exec_abc123/comprehensive.html",
    "downloadUrl": "http://localhost:8082/reports/exec_abc123/comprehensive.html",
    "summary": {
      "executionSummary": {
        "totalTests": 67,
        "passed": 62,
        "failed": 3,
        "skipped": 2,
        "duration": 1238000,
        "startTime": "2025-09-28T10:30:45.000Z",
        "endTime": "2025-09-28T10:51:23.000Z"
      },
      "categoryBreakdown": {
        "Authentication": {"passed": 15, "failed": 0, "skipped": 0},
        "Signing": {"passed": 20, "failed": 2, "skipped": 1},
        "Documents": {"passed": 18, "failed": 1, "skipped": 1},
        "Templates": {"passed": 9, "failed": 0, "skipped": 0}
      },
      "healingStats": {
        "totalAttempts": 5,
        "successfulHeals": 4,
        "failuresSaved": 4,
        "strategiesUsed": ["authentication", "elementInteraction", "network"]
      }
    }
  }
}
```

#### `GET /executions/{executionId}/artifacts`

Get all artifacts (screenshots, logs, traces) for an execution.

**Path Parameters:**
- `executionId`: The unique identifier of the execution

**Query Parameters:**
- `type` (optional): Filter by artifact type (screenshot, log, trace, video)
- `testId` (optional): Filter by specific test ID

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "artifact_screenshot_001",
      "type": "screenshot",
      "testId": "test_login_success",
      "fileName": "test_login_success_final.png",
      "filePath": "/artifacts/exec_abc123/screenshots/test_login_success_final.png",
      "downloadUrl": "http://localhost:8082/artifacts/exec_abc123/screenshots/test_login_success_final.png",
      "size": 524288,
      "timestamp": "2025-09-28T10:31:15.000Z",
      "metadata": {
        "resolution": "1920x1080",
        "browser": "chromium"
      }
    },
    {
      "id": "artifact_log_002",
      "type": "log",
      "testId": "test_document_upload",
      "fileName": "test_document_upload.log",
      "filePath": "/artifacts/exec_abc123/logs/test_document_upload.log",
      "downloadUrl": "http://localhost:8082/artifacts/exec_abc123/logs/test_document_upload.log",
      "size": 16384,
      "timestamp": "2025-09-28T10:33:22.000Z"
    }
  ],
  "meta": {
    "total": 45,
    "types": ["screenshot", "log", "trace"],
    "totalSize": 15728640
  }
}
```

### Statistics and Analytics

#### `GET /stats`

Get comprehensive statistics about the test orchestrator.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalSuites": 8,
    "totalTests": 607,
    "activeExecutions": 2,
    "queuedExecutions": 1,
    "completedExecutions": 156,
    "passRate": 94.2,
    "avgExecutionTime": 892000,
    "testsExecutedToday": 234,
    "healingSuccess": 87.5,
    "categoryStats": {
      "Authentication": {
        "totalTests": 75,
        "passRate": 98.7,
        "avgDuration": 15000
      },
      "Signing": {
        "totalTests": 120,
        "passRate": 91.2,
        "avgDuration": 35000
      },
      "Documents": {
        "totalTests": 95,
        "passRate": 94.8,
        "avgDuration": 28000
      }
    },
    "recentTrends": {
      "last7Days": {
        "executionsCount": 45,
        "passRate": 93.8,
        "avgDuration": 920000
      },
      "last30Days": {
        "executionsCount": 189,
        "passRate": 94.1,
        "avgDuration": 898000
      }
    },
    "healingAnalytics": {
      "totalAttempts": 234,
      "successfulHeals": 205,
      "topStrategies": [
        {"strategy": "authentication", "successRate": 95.2},
        {"strategy": "elementInteraction", "successRate": 89.7},
        {"strategy": "network", "successRate": 82.3}
      ],
      "failurePatterns": [
        {"pattern": "timeout", "frequency": 25},
        {"pattern": "element_not_found", "frequency": 18},
        {"pattern": "network_error", "frequency": 12}
      ]
    }
  }
}
```

### WebSocket Events

The API provides real-time updates via WebSocket connection at `ws://localhost:8082/ws/wesign`.

#### Connection

```javascript
const ws = new WebSocket('ws://localhost:8082/ws/wesign');

ws.onopen = () => {
  console.log('Connected to WeSign Orchestrator WebSocket');
};
```

#### Event Types

##### Execution Progress
```json
{
  "type": "execution-progress",
  "executionId": "exec_20250928_103045_abc123",
  "progress": {
    "status": "running",
    "progress": 45,
    "currentTest": "test_document_signing_flow",
    "passedTests": 28,
    "failedTests": 2,
    "estimatedTimeRemaining": 720000
  }
}
```

##### Test Result
```json
{
  "type": "test-result",
  "executionId": "exec_20250928_103045_abc123",
  "testId": "test_login_success",
  "result": {
    "status": "passed",
    "duration": 15000,
    "timestamp": "2025-09-28T10:31:15.000Z",
    "artifacts": ["screenshot.png"]
  }
}
```

##### Execution Completed
```json
{
  "type": "execution-completed",
  "executionId": "exec_20250928_103045_abc123",
  "summary": {
    "status": "completed",
    "totalTests": 67,
    "passedTests": 62,
    "failedTests": 3,
    "skippedTests": 2,
    "duration": 1238000,
    "reports": ["comprehensive", "allure"]
  }
}
```

##### Healing Attempt
```json
{
  "type": "healing-attempt",
  "executionId": "exec_20250928_103045_abc123",
  "testId": "test_document_upload",
  "healing": {
    "attempt": 1,
    "strategy": "elementInteraction",
    "status": "in_progress",
    "description": "Attempting to locate element with alternative selector"
  }
}
```

#### Subscription Management

Subscribe to specific execution updates:

```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  executionId: 'exec_20250928_103045_abc123'
}));
```

Unsubscribe from execution updates:

```javascript
ws.send(JSON.stringify({
  type: 'unsubscribe',
  executionId: 'exec_20250928_103045_abc123'
}));
```

## Rate Limiting

- **General Endpoints**: 100 requests per minute
- **Execution Endpoints**: 10 requests per minute
- **WebSocket Connections**: 5 connections per client

## SDK Examples

### JavaScript/TypeScript

```typescript
class WeSignOrchestratorClient {
  private baseUrl: string;
  private ws: WebSocket | null = null;

  constructor(baseUrl: string = 'http://localhost:8082/api/wesign-tests') {
    this.baseUrl = baseUrl;
  }

  async executeTestSuite(suiteId: string, config?: Partial<TestExecutionConfig>): Promise<string> {
    const response = await fetch(`${this.baseUrl}/execute/suite/${suiteId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config || {})
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error);
    }

    return result.data.executionId;
  }

  async getExecutionStatus(executionId: string): Promise<TestExecution> {
    const response = await fetch(`${this.baseUrl}/executions/${executionId}`);
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.data;
  }

  connectWebSocket(onMessage: (data: any) => void): void {
    this.ws = new WebSocket('ws://localhost:8082/ws/wesign');
    this.ws.onmessage = (event) => onMessage(JSON.parse(event.data));
  }

  subscribeToExecution(executionId: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        executionId
      }));
    }
  }
}
```

### Python

```python
import requests
import websocket
import json
from typing import Dict, Optional, Any

class WeSignOrchestratorClient:
    def __init__(self, base_url: str = "http://localhost:8082/api/wesign-tests"):
        self.base_url = base_url
        self.ws = None

    def execute_test_suite(self, suite_id: str, config: Optional[Dict] = None) -> str:
        """Execute a test suite and return the execution ID."""
        response = requests.post(
            f"{self.base_url}/execute/suite/{suite_id}",
            json=config or {},
            headers={"Content-Type": "application/json"}
        )

        result = response.json()
        if not result["success"]:
            raise Exception(result["error"])

        return result["data"]["executionId"]

    def get_execution_status(self, execution_id: str) -> Dict[str, Any]:
        """Get the current status of an execution."""
        response = requests.get(f"{self.base_url}/executions/{execution_id}")
        result = response.json()

        if not result["success"]:
            raise Exception(result["error"])

        return result["data"]

    def download_report(self, execution_id: str, format: str = "comprehensive") -> str:
        """Download a report and return the file path."""
        response = requests.get(f"{self.base_url}/executions/{execution_id}/reports/{format}")
        result = response.json()

        if not result["success"]:
            raise Exception(result["error"])

        return result["data"]["downloadUrl"]
```

## Troubleshooting

### Common Error Codes

- **TEST_NOT_FOUND**: Specified test ID does not exist
- **SUITE_NOT_FOUND**: Specified test suite does not exist
- **EXECUTION_NOT_FOUND**: Specified execution ID does not exist
- **INVALID_CONFIGURATION**: Test execution configuration is invalid
- **EXECUTION_LIMIT_EXCEEDED**: Maximum concurrent executions reached
- **REPORT_GENERATION_FAILED**: Report generation encountered an error
- **SELF_HEALING_DISABLED**: Self-healing is disabled for this execution

### Debug Information

Enable debug logging by setting the `DEBUG` environment variable:

```bash
DEBUG=wesign:* npm run dev
```

### Health Check Endpoints

- **API Health**: `GET /api/wesign-tests/health`
- **WebSocket Health**: Connect to `ws://localhost:8082/ws/wesign` and send ping

---

*For additional support, consult the main documentation or check the backend logs for detailed error information.*