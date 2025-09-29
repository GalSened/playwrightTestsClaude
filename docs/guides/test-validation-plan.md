# Test Running Module Validation Plan

## Overview
Comprehensive validation strategy for the QA Intelligence test execution system.

## Architecture Components Validated
- **Test Execution Router** (`/api/execute`): Core pytest execution and management
- **Test Runs Router** (`/api/test-runs`): Test run lifecycle management
- **Process Management**: Async execution, timeouts, cancellation
- **Artifact Generation**: Reports, screenshots, videos, logs
- **Self-Healing Integration**: Failure capture and analysis

## Validation Scenarios

### Phase 1: Core Execution Flow
1. **Basic Test Execution**
   - Endpoint: `POST /api/execute/pytest`
   - Payload: `{testPath: "test_example.py", environment: "development"}`
   - Expected: Execution ID returned, process started in WeSign directory

2. **Status Monitoring**
   - Endpoint: `GET /api/execute/status/{executionId}`
   - Expected: Real-time status updates (running → completed/failed)

3. **Execution History**
   - Endpoint: `GET /api/execute/history`
   - Expected: List of recent executions with metadata

### Phase 2: Artifact Validation
4. **Report Generation**
   - Verify JUnit XML creation
   - Validate HTML report structure
   - Test Allure report generation (when allure-results exist)

5. **Media Artifacts**
   - Screenshot capture validation
   - Video recording verification
   - Log file creation

### Phase 3: Error Handling
6. **Timeout Management**
   - Test 10-minute execution timeout
   - Verify process termination (SIGKILL)

7. **Process Cancellation**
   - Endpoint: `DELETE /api/execute/{executionId}`
   - Expected: Immediate process termination

8. **Invalid Inputs**
   - Non-existent test files
   - Malformed requests
   - Environment conflicts

### Phase 4: Advanced Scenarios
9. **Concurrent Execution**
   - Multiple simultaneous test runs
   - Resource isolation verification

10. **Self-Healing Integration**
    - Failure capture for tests with code ≠ 0
    - DOM content extraction
    - Healing data persistence

### Phase 5: Resource Management
11. **Memory Management**
    - Large output truncation (5KB display limit)
    - Completed execution cleanup (100-item limit)

12. **File System**
    - Artifacts directory creation
    - Permission handling
    - Disk space management

## Success Criteria
- All API endpoints respond correctly
- Process management works reliably
- Artifacts generate properly
- Error scenarios handled gracefully
- Concurrent executions don't interfere
- Self-healing data captures correctly
- Resource limits enforced

## Test Data Requirements
- Valid WeSign test files in `C:\Users\gals\seleniumpythontests-1\playwright_tests`
- Test cases that pass, fail, and timeout
- Large test suites for performance testing

## Implementation Priority
1. Core execution flow (scenarios 1-3)
2. Artifact generation (scenarios 4-5)
3. Error handling (scenarios 6-8)
4. Advanced features (scenarios 9-12)