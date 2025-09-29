# WeSign Test Orchestrator - Comprehensive Testing System

**Version:** 2.0 • **Last Updated:** 2025-09-28 • **Owner:** QA Intelligence Platform

> **SYSTEM STATUS**: ✅ **PRODUCTION READY** - Full WeSign test integration with advanced orchestration capabilities

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Features](#features)
4. [Installation & Setup](#installation--setup)
5. [API Documentation](#api-documentation)
6. [Frontend Integration](#frontend-integration)
7. [Test Execution Workflows](#test-execution-workflows)
8. [Reporting System](#reporting-system)
9. [Self-Healing Module](#self-healing-module)
10. [Configuration](#configuration)
11. [Troubleshooting](#troubleshooting)
12. [Best Practices](#best-practices)

## Overview

The WeSign Test Orchestrator is a comprehensive testing platform that integrates **607+ test scenarios** across **8 test categories** into the QA Intelligence platform. It provides unified execution capabilities for both UI and API tests with advanced reporting, self-healing, and real-time monitoring.

### Key Statistics
- **607+ Test Cases** across UI and API scenarios
- **8 Test Categories**: Authentication, Document Management, Signing Workflows, Templates, Users, Integration, Performance, Security
- **6 API Test Suites**: Complete Postman collections for all major endpoints
- **Advanced Self-Healing**: WeSign-specific failure patterns and recovery strategies
- **Dual Reporting**: Newman (API) + Allure (UI) with unified HTML reports
- **Real-time Monitoring**: WebSocket-based progress tracking

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    QA Intelligence Platform                      │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (React)           │  Backend (Express.js)             │
│  ├─ WeSignTestingHub        │  ├─ WeSignTestOrchestrator         │
│  ├─ OrchestratorDashboard   │  ├─ API Routes (/wesign-tests)    │
│  └─ useWeSignOrchestrator   │  ├─ Test Discovery Engine         │
│                             │  ├─ Execution Manager             │
│                             │  ├─ Self-Healing Module           │
│                             │  └─ Reporting System              │
├─────────────────────────────────────────────────────────────────┤
│                        Test Execution Layer                     │
│  ├─ Playwright Tests (UI)   │  ├─ Newman (API Tests)           │
│  ├─ Postman Collections     │  ├─ Allure Reporter              │
│  └─ Custom Test Runners     │  └─ Comprehensive Reporter       │
├─────────────────────────────────────────────────────────────────┤
│                       WeSign Test Files                         │
│  └─ C:/Users/gals/seleniumpythontests-1/playwright_tests/       │
│     ├─ test_auth_*.py       │  ├─ postman_collections/         │
│     ├─ test_signing_*.py    │  ├─ test_document_*.py           │
│     └─ test_integration_*.py│  └─ test_performance_*.py        │
└─────────────────────────────────────────────────────────────────┘
```

## Features

### 🎯 **Test Execution Modes**
- **Individual Test**: Execute single test with detailed reporting
- **Suite Execution**: Run related tests grouped by functionality
- **Regression Testing**: Complete test suite execution with parallel processing

### 📊 **Advanced Reporting**
- **Newman Integration**: API test execution with detailed HTTP logs
- **Allure Framework**: Rich UI test reports with screenshots and traces
- **Comprehensive Reports**: Unified HTML reports combining API + UI metrics
- **Real-time Progress**: Live execution status with WebSocket updates

### 🔄 **Self-Healing Capabilities**
- **Failure Analysis**: Intelligent detection of common failure patterns
- **Progressive Healing**: Multi-strategy approach for recovery
- **WeSign-Specific Patterns**: Tailored healing for authentication, signing, and document workflows
- **Learning System**: Improves healing strategies based on historical failures

### 🔧 **Configuration Management**
- **Parallel Execution**: Configurable worker pools (1-10 concurrent tests)
- **Environment Support**: Development, staging, production configurations
- **Tag-based Filtering**: Execute tests by category, priority, or custom tags
- **Timeout Management**: Configurable timeouts for different test types

## Installation & Setup

### Prerequisites
- Node.js 18+
- Python 3.12+ (for Playwright tests)
- Newman CLI (`npm install -g newman`)
- Allure CLI (`npm install -g allure-commandline`)

### Backend Setup

1. **Install Dependencies**
```bash
cd backend
npm install
```

2. **Environment Configuration**
```bash
# Create .env file with required variables
WESIGN_TEST_PATH=C:/Users/gals/seleniumpythontests-1/playwright_tests
PYTHON_PATH=C:/Users/gals/AppData/Local/Programs/Python/Python312/python.exe
PORT=8082
```

3. **Start Backend Server**
```bash
npm run dev
```

The orchestrator will initialize and discover all available tests automatically.

### Frontend Setup

1. **Install Dependencies**
```bash
cd apps/frontend/dashboard
npm install
```

2. **Start Frontend Server**
```bash
npm run dev
```

3. **Access WeSign Testing Hub**
Navigate to: `http://localhost:3001/wesign`

## API Documentation

### Base URL
```
http://localhost:8082/api/wesign-tests
```

### Core Endpoints

#### **GET /suites**
Retrieve all available test suites with metadata.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "auth-suite",
      "name": "Authentication Tests",
      "category": "Authentication",
      "totalTests": 45,
      "passedTests": 42,
      "failedTests": 3,
      "tags": ["auth", "login", "security"],
      "lastExecuted": "2025-09-28T10:30:00Z"
    }
  ]
}
```

#### **POST /execute**
Execute tests with comprehensive configuration.

**Request Body:**
```json
{
  "executionType": "suite|individual|regression",
  "suiteIds": ["auth-suite", "signing-suite"],
  "testIds": ["test_login_success", "test_document_upload"],
  "parallel": true,
  "maxWorkers": 3,
  "selfHealingEnabled": true,
  "reportingEnabled": true,
  "reportFormats": ["comprehensive", "allure", "newman"],
  "environment": "staging",
  "tags": ["smoke", "critical"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "executionId": "exec_20250928_103045_abc123",
    "status": "pending",
    "estimatedDuration": 1200,
    "totalTests": 67
  }
}
```

#### **GET /executions/{executionId}**
Get detailed execution status and progress.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "exec_20250928_103045_abc123",
    "status": "running",
    "progress": 45,
    "currentTest": "test_document_signing_flow",
    "totalTests": 67,
    "passedTests": 28,
    "failedTests": 2,
    "startTime": "2025-09-28T10:30:45Z",
    "estimatedEndTime": "2025-09-28T10:50:45Z",
    "healing": {
      "enabled": true,
      "attemptsMade": 3,
      "successfulHeals": 2
    }
  }
}
```

#### **GET /executions/{executionId}/reports/{format}**
Download execution reports in specified format.

**Formats:** `comprehensive`, `allure`, `newman`

**Response:**
```json
{
  "success": true,
  "data": {
    "reportPath": "/reports/exec_20250928_103045_abc123/comprehensive.html",
    "downloadUrl": "http://localhost:8082/reports/exec_20250928_103045_abc123/comprehensive.html"
  }
}
```

## Frontend Integration

### WeSign Testing Hub Integration

The orchestrator is integrated into the existing WeSign Testing Hub with a dedicated "Orchestrator" tab:

```typescript
// Access via useWeSignOrchestrator hook
const {
  suites,
  tests,
  executions,
  stats,
  executeTests,
  executeTestSuite,
  executeRegression,
  isConnected,
  error
} = useWeSignOrchestrator();
```

### Key Components

#### **WeSignOrchestratorDashboard**
- **Overview Tab**: System statistics and quick actions
- **Test Suites Tab**: Browse and execute test suites
- **Executions Tab**: Monitor active and historical executions
- **Reports Tab**: Access and download comprehensive reports
- **Settings Tab**: Configure execution parameters

#### **Real-time Updates**
WebSocket connection provides live updates for:
- Execution progress and status changes
- Test result updates
- Self-healing attempts and outcomes
- System health and connectivity status

## Test Execution Workflows

### 1. Individual Test Execution

```typescript
// Execute a single test with custom configuration
const executionId = await executeTests({
  executionType: 'individual',
  testIds: ['test_login_with_valid_credentials'],
  parallel: false,
  maxWorkers: 1,
  selfHealingEnabled: true,
  reportingEnabled: true,
  reportFormats: ['comprehensive']
});
```

### 2. Suite Execution

```typescript
// Execute a complete test suite
const executionId = await executeTestSuite('auth-suite', {
  parallel: true,
  maxWorkers: 3,
  selfHealingEnabled: true,
  environment: 'staging'
});
```

### 3. Regression Testing

```typescript
// Full regression with all tests
const executionId = await executeRegression({
  parallel: true,
  maxWorkers: 5,
  selfHealingEnabled: true,
  reportFormats: ['comprehensive', 'allure', 'newman'],
  tags: ['regression', 'critical']
});
```

## Reporting System

### Comprehensive Reports

The unified reporting system combines results from multiple sources:

#### **API Test Reports (Newman)**
- HTTP request/response details
- Response time analysis
- Status code validation
- JSON schema validation results

#### **UI Test Reports (Allure)**
- Step-by-step execution traces
- Screenshots on failures
- Browser console logs
- Performance timing data

#### **Combined HTML Report**
- Executive summary with key metrics
- Test execution timeline
- Failure analysis with categorization
- Self-healing attempt details
- Environment and configuration details

### Report Structure

```
reports/
├─ exec_20250928_103045_abc123/
│  ├─ comprehensive.html          # Unified report
│  ├─ comprehensive.json          # Machine-readable summary
│  ├─ allure-results/            # Allure raw data
│  ├─ allure-report/             # Allure HTML report
│  ├─ newman/                    # Newman JSON reports
│  │  ├─ auth-api-tests.json
│  │  ├─ signing-api-tests.json
│  │  └─ document-api-tests.json
│  └─ artifacts/                 # Screenshots, logs, traces
│     ├─ screenshots/
│     ├─ traces/
│     └─ logs/
```

## Self-Healing Module

### Healing Strategies

#### **1. Authentication Failures**
- **Token Refresh**: Automatically refresh expired authentication tokens
- **Session Recovery**: Re-establish user sessions when detected as expired
- **Credential Rotation**: Try alternative valid credentials for test accounts

#### **2. Element Interaction Issues**
- **Wait Strategy Adjustment**: Increase wait times for slow-loading elements
- **Selector Refinement**: Try alternative selectors for the same element
- **Viewport Adjustment**: Modify browser window size for responsive elements

#### **3. Network-Related Failures**
- **Retry Logic**: Implement exponential backoff for network requests
- **Endpoint Switching**: Try alternative API endpoints when available
- **Timeout Adjustment**: Dynamically adjust timeouts based on response patterns

#### **4. Data-Dependent Failures**
- **Test Data Regeneration**: Create fresh test data when existing data is corrupted
- **State Reset**: Reset application state to known good condition
- **Database Cleanup**: Clean up test artifacts that might interfere

### Healing Configuration

```typescript
interface HealingConfig {
  enabled: boolean;
  maxAttempts: number;
  strategies: {
    authentication: boolean;
    elementInteraction: boolean;
    network: boolean;
    dataDependent: boolean;
  };
  progressiveDelays: number[];  // [1000, 2000, 5000] ms
  learningEnabled: boolean;
}
```

### Healing Metrics

The system tracks healing effectiveness:
- **Success Rate**: Percentage of successful healing attempts
- **Strategy Effectiveness**: Which strategies work best for different failure types
- **Time to Recovery**: Average time required for successful healing
- **Learning Improvements**: How healing strategies improve over time

## Configuration

### Environment Variables

```bash
# Core Configuration
WESIGN_TEST_PATH=C:/Users/gals/seleniumpythontests-1/playwright_tests
PYTHON_PATH=C:/Users/gals/AppData/Local/Programs/Python/Python312/python.exe
PORT=8082

# Test Execution
MAX_PARALLEL_WORKERS=5
DEFAULT_TIMEOUT=30000
RETRY_ATTEMPTS=3

# Reporting
REPORTS_PATH=./reports
ALLURE_RESULTS_PATH=./allure-results
NEWMAN_OUTPUT_PATH=./newman-reports

# Self-Healing
HEALING_ENABLED=true
HEALING_MAX_ATTEMPTS=3
HEALING_PROGRESSIVE_DELAYS=1000,2000,5000

# API Configuration
WESIGN_API_BASE_URL=https://app.wesign.com
WESIGN_API_TOKEN=your_api_token_here

# WebSocket
WS_PORT=8083
WS_HEARTBEAT_INTERVAL=30000
```

### Test Configuration

```json
{
  "testCategories": {
    "authentication": {
      "priority": "critical",
      "timeout": 30000,
      "retries": 2,
      "healingEnabled": true
    },
    "signing": {
      "priority": "high",
      "timeout": 60000,
      "retries": 3,
      "healingEnabled": true
    },
    "documents": {
      "priority": "medium",
      "timeout": 45000,
      "retries": 2,
      "healingEnabled": true
    }
  },
  "execution": {
    "defaultParallel": true,
    "maxWorkers": 3,
    "reportFormats": ["comprehensive", "allure"],
    "artifactRetention": "30d"
  }
}
```

## Troubleshooting

### Common Issues

#### **Test Discovery Issues**
```bash
# Check test path accessibility
ls "C:/Users/gals/seleniumpythontests-1/playwright_tests"

# Verify Python path
"C:/Users/gals/AppData/Local/Programs/Python/Python312/python.exe" --version

# Check test file permissions
icacls "C:/Users/gals/seleniumpythontests-1/playwright_tests" /T
```

#### **Execution Failures**
```bash
# Check Newman installation
newman --version

# Verify Allure installation
allure --version

# Test Python test execution manually
cd "C:/Users/gals/seleniumpythontests-1/playwright_tests"
python -m pytest test_auth_pure_sync.py -v
```

#### **WebSocket Connection Issues**
```javascript
// Frontend WebSocket debugging
console.log('WebSocket state:', wsRef.current?.readyState);
// 0: CONNECTING, 1: OPEN, 2: CLOSING, 3: CLOSED
```

#### **Reporting Issues**
```bash
# Check report directory permissions
mkdir -p ./reports
chmod 755 ./reports

# Verify Allure serve capability
allure serve ./allure-results
```

### Logging and Debugging

#### **Backend Logging**
```javascript
// Enable debug logging
DEBUG=wesign:* npm run dev

// Check orchestrator logs
tail -f logs/wesign-orchestrator.log
```

#### **Frontend Debugging**
```javascript
// Enable WebSocket debugging
localStorage.setItem('debug', 'wesign:ws');

// Check hook state
console.log('Orchestrator state:', {
  suites: suites.length,
  executions: executions.length,
  isConnected,
  error
});
```

## Best Practices

### Test Organization

1. **Categorize Tests Properly**
   - Use consistent naming conventions
   - Tag tests appropriately for filtering
   - Group related tests into logical suites

2. **Execution Strategy**
   - Start with smoke tests before full regression
   - Use parallel execution for independent tests
   - Reserve sequential execution for dependent workflows

3. **Self-Healing Configuration**
   - Enable healing for flaky tests
   - Monitor healing success rates
   - Adjust strategies based on failure patterns

### Performance Optimization

1. **Resource Management**
   - Limit parallel workers based on system capacity
   - Monitor memory usage during execution
   - Clean up artifacts regularly

2. **Test Data Management**
   - Use fresh test data for each execution
   - Implement data cleanup after test completion
   - Avoid hard-coded test data dependencies

### Monitoring and Maintenance

1. **Regular Health Checks**
   - Monitor system connectivity
   - Verify test discovery accuracy
   - Check report generation success

2. **Continuous Improvement**
   - Analyze failure patterns regularly
   - Update healing strategies based on learnings
   - Optimize test execution times

3. **Documentation Updates**
   - Keep test documentation current
   - Document new failure patterns and solutions
   - Maintain configuration examples

---

## Support and Contact

For technical support or questions about the WeSign Test Orchestrator:

- **Documentation**: [Full API docs](./API_DOCUMENTATION.md)
- **User Guide**: [Step-by-step workflows](./USER_GUIDE.md)
- **System Status**: Monitor at `http://localhost:8082/health`
- **Logs**: Check backend logs for detailed execution information

---

*WeSign Test Orchestrator - Comprehensive Testing Made Simple*