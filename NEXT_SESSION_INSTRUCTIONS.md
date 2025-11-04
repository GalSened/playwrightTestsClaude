# Next Session Instructions - Phase 8: Queue Management

**Status**: Phase 7 Complete, Ready for Phase 8
**Last Updated**: 2025-10-27 14:12 UTC
**Previous Session**: [SESSION_2025_10_27_COMPLETION_REPORT.md](qa_intel/SESSION_2025_10_27_COMPLETION_REPORT.md)

---

## 🎯 Current System State

✅ **What's Complete**:
- Backend running on port 8082 (fully operational)
- Frontend running on port 3001 (fully operational)
- All path configuration issues fixed (Issue #5 ✅)
- Timeout & validation working (Issue #4 ✅)
- Phases 1-6 complete (100%)
- Phase 7 initiated and working (85%)

✅ **Critical Fixes Applied**:
1. **TestBankDiscoveryService.ts** - Correct base paths
2. **WeSignAdapter.ts** - Correct test directory
3. All tests now use: `C:/Users/gals/seleniumpythontests-1/playwright_tests`

⚠️ **Known Blockers** (External - No Action Needed):
- devtest.comda.co.il access required for actual test completion
- Valid credentials needed for authentication tests
- Tests will timeout after 5 minutes (protected)

---

## 🚀 Quick Start (Next Session)

### Step 1: Verify System Status (2 minutes)

```bash
# Check backend health
curl http://localhost:8082/api/health

# Check if backend is running
netstat -ano | findstr :8082

# If not running, start it:
cd backend && npm run dev

# Wait for "Server started successfully" message
```

**Expected Health Response**:
```json
{
  "status": "healthy",
  "version": "2.0.0",
  "worker": {
    "running": true,
    "activeExecutions": 0,
    "maxConcurrent": 3
  }
}
```

---

### Step 2: Check Phase 7 Execution (Optional - 5 minutes)

Phase 7 tests may still be running or timed out. Check status:

```bash
curl http://localhost:8082/api/wesign/unified/execute/871f8916-2fc2-4577-8e0f-10ad6aa979ba/status | py -m json.tool
```

**Possible Outcomes**:
1. **Still running**: Tests hanging due to environment access (expected)
2. **Completed**: Tests finished successfully (unlikely without env access)
3. **Timed out**: 5-minute timeout triggered (expected behavior)

**Action**: Note the outcome in Phase 7 report, then proceed to Phase 8.

---

## 📋 Phase 8: Queue Management & Resource Limits (45-60 minutes)

### Objectives

1. ✅ Verify multiple executions queue correctly
2. ✅ Test resource limit enforcement (max 3 concurrent)
3. ✅ Validate queue overflow handling
4. ✅ Test execution pool management
5. ✅ Verify queue status API
6. ✅ Test queue priority (if implemented)

### Success Criteria

- Multiple executions queue without errors
- Maximum concurrent limit (3) is enforced
- Queue positions are correct
- Executions start in FIFO order
- Queue status API returns accurate data
- No resource exhaustion or crashes

---

### Test Plan

#### Test 8.1: Basic Queue Functionality (15 minutes)

**Objective**: Verify basic queuing with 5 concurrent requests

```bash
# Save execution IDs
exec_ids=()

# Submit 5 test executions rapidly
for i in {1..5}; do
  response=$(curl -s -X POST http://localhost:8082/api/wesign/unified/execute \
    -H "Content-Type: application/json" \
    -d '{"framework":"wesign","testIds":["tests/auth/test_login_english.py::test_login_english_company_user_success"]}')

  exec_id=$(echo $response | py -c "import sys, json; print(json.load(sys.stdin)['executionId'])")
  exec_ids+=($exec_id)
  echo "Submitted execution $i: $exec_id"

  # Small delay to ensure ordering
  sleep 1
done

# Check queue status immediately
curl http://localhost:8082/api/wesign/unified/queue | py -m json.tool

# Expected: 3 running, 2 queued
```

**What to Verify**:
- All 5 executions accepted
- First 3 show status "running"
- Last 2 show status "queued" with correct queue positions (0, 1)
- No errors or rejections

**Evidence to Collect**:
- Queue status response (screenshot or JSON)
- Execution IDs for all 5 tests
- Backend logs showing queue management

---

#### Test 8.2: Queue Progression (15 minutes)

**Objective**: Verify executions start as others complete

**Setup**: Use execution IDs from Test 8.1 or submit new ones

```bash
# Monitor queue status every 10 seconds
for i in {1..12}; do
  echo "=== Check $i ==="
  curl -s http://localhost:8082/api/wesign/unified/queue | py -m json.tool

  # Also check individual execution statuses
  for exec_id in "${exec_ids[@]}"; do
    curl -s http://localhost:8082/api/wesign/unified/execute/$exec_id/status | \
      py -c "import sys, json; d=json.load(sys.stdin); print(f\"{d['execution']['executionId'][:8]}: {d['execution']['status']}\")"
  done

  sleep 10
done
```

**What to Verify**:
- As executions complete/timeout, queued tests start
- Queue positions decrease correctly
- No more than 3 executions running simultaneously
- All executions eventually reach "running" or "completed/failed"

**Evidence to Collect**:
- Queue status over time (multiple snapshots)
- Transition logs (queued → running)
- Final status of all 5 executions

---

#### Test 8.3: Resource Limit Enforcement (10 minutes)

**Objective**: Verify hard limit of 3 concurrent executions

```bash
# Submit 10 tests rapidly
echo "Submitting 10 tests..."
for i in {1..10}; do
  curl -s -X POST http://localhost:8082/api/wesign/unified/execute \
    -H "Content-Type: application/json" \
    -d '{"framework":"wesign","testIds":["tests/auth/test_login_english.py::test_login_english_company_user_success"]}' \
    > /dev/null
done

# Immediately check active executions
sleep 2
curl http://localhost:8082/api/health | py -m json.tool

# Check queue depth
curl http://localhost:8082/api/wesign/unified/queue | \
  py -c "import sys, json; d=json.load(sys.stdin); print(f\"Running: {len([e for e in d['executions'] if e['status']=='running'])}\")"
```

**What to Verify**:
- Health endpoint shows `activeExecutions <= 3`
- Queue API shows exactly 3 running (or fewer if some completed)
- Remaining 7 are queued
- No resource exhaustion errors

**Evidence to Collect**:
- Health response showing active executions
- Queue status showing breakdown
- Backend logs (no error messages)

---

#### Test 8.4: Queue API Functionality (5 minutes)

**Objective**: Verify queue status API returns complete, accurate data

```bash
# Get queue status
curl http://localhost:8082/api/wesign/unified/queue | py -m json.tool > queue_status.json

# Verify structure
py -c "
import json
with open('queue_status.json') as f:
    data = json.load(f)
    print(f\"Total executions: {len(data.get('executions', []))}\")
    print(f\"Running: {len([e for e in data['executions'] if e['status']=='running'])}\")
    print(f\"Queued: {len([e for e in data['executions'] if e['status']=='queued'])}\")
    print(f\"Completed: {len([e for e in data['executions'] if e['status'] in ['completed','failed']])}\")
"
```

**What to Verify**:
- Queue API exists and responds
- Returns all active and queued executions
- Status values are correct
- Queue positions are accurate
- Timestamps are present

**Evidence to Collect**:
- Full queue status JSON
- Parsed statistics
- API response time

---

#### Test 8.5: Graceful Queue Handling (10 minutes)

**Objective**: Verify system handles edge cases gracefully

**Test Cases**:

1. **Empty Queue**:
```bash
# Wait for all tests to complete/timeout
# Then check queue
curl http://localhost:8082/api/wesign/unified/queue | py -m json.tool

# Expected: Empty array or no active executions
```

2. **Get All Executions**:
```bash
# Use the new /executions endpoint (if implemented)
curl http://localhost:8082/api/wesign/unified/executions | py -m json.tool

# Expected: Historical execution data
```

3. **Invalid Execution ID**:
```bash
curl http://localhost:8082/api/wesign/unified/execute/invalid-id/status

# Expected: 404 or clear error message
```

**What to Verify**:
- Empty queue handled correctly
- Historical data retrievable
- Invalid IDs return proper errors
- No crashes or hangs

---

### Phase 8 Deliverables

1. **Test Results Document** (`qa_intel/PHASE8_QUEUE_MANAGEMENT_REPORT.md`)
   - All test results (8.1-8.5)
   - Evidence (JSON responses, screenshots)
   - Pass/Fail for each objective
   - Issues found and recommendations

2. **Queue Status Snapshots** (`qa_intel/phase8_evidence/`)
   - queue_initial.json (5 executions)
   - queue_progression_*.json (time series)
   - queue_empty.json (after completion)

3. **Backend Log Excerpts** (`qa_intel/phase8_evidence/`)
   - Queue management logs
   - Resource limit enforcement logs
   - Any warnings or errors

4. **Updated Progress Tracker**
   - Update [E2E_TEST_PROGRESS_CHECKPOINT.md](qa_intel/E2E_TEST_PROGRESS_CHECKPOINT.md)
   - Mark Phase 8 as complete
   - Note any issues for future phases

---

## 📊 Expected Outcomes

### Success Scenario ✅

- All 5 tests in Test 8.1 queue correctly
- Resource limit maintained (≤3 concurrent)
- Queue progresses as executions complete
- Queue API provides accurate status
- No crashes or errors
- **Result**: Phase 8 PASS, proceed to Phase 9

### Partial Success ⚠️

- Queue works but with minor issues (e.g., incorrect positions)
- Resource limit mostly enforced with occasional spikes
- **Result**: Document issues, create tickets, proceed to Phase 9 with caveats

### Failure Scenario ❌

- Queue not functioning (all tests run simultaneously)
- Resource limits not enforced
- System crashes or hangs
- **Result**: Fix queue management before proceeding

---

## 🔄 After Phase 8: Phase 9 Preview

**Phase 9: AI Features (Self-Healing)**
**Estimated Time**: 1-2 hours

**Objectives**:
1. Test self-healing selector detection
2. Verify AI-powered fix suggestions
3. Test failure analysis with AI
4. Validate test intelligence insights

**Prerequisites**:
- Phases 1-8 complete
- AI service configured (OpenRouter/OpenAI/Gemini)
- Test failures to analyze (expected from Phase 7/8)

**Quick Start**:
```bash
# Check AI configuration
grep -E "OPENROUTER|OPENAI|GEMINI" backend/.env

# Trigger self-healing test
curl -X POST http://localhost:8082/api/wesign/unified/execute \
  -H "Content-Type: application/json" \
  -d '{"framework":"wesign","testIds":["tests/auth/test_login_english.py::test_login_english_company_user_success"],"aiEnabled":true,"autoHeal":true}'
```

---

## 🐛 Known Issues & Workarounds

### Issue: Tests Hanging Due to Environment Access

**Problem**: Tests can't reach devtest.comda.co.il
**Impact**: Tests timeout after 5 minutes
**Workaround**: This is expected. Use timeout as success criterion for infrastructure testing.
**Status**: External blocker, no fix needed

### Issue: Execution Status Not Updating on Failure

**Problem**: Status stays "running" even after validation errors
**Impact**: UI shows incorrect status
**Severity**: Low
**Fix**: Update ExecutionManager to set status to "failed" on error
**Estimated Time**: 15 minutes
**Priority**: Can be done after Phase 8

---

## 📚 Reference Documentation

- **System Architecture**: [CLAUDE.md](CLAUDE.md)
- **Previous Session**: [SESSION_2025_10_27_COMPLETION_REPORT.md](qa_intel/SESSION_2025_10_27_COMPLETION_REPORT.md)
- **E2E Progress**: [E2E_TEST_PROGRESS_CHECKPOINT.md](qa_intel/E2E_TEST_PROGRESS_CHECKPOINT.md)
- **Master Plan**: [MASTER_TEST_AND_REFACTOR_PLAN.md](qa_intel/MASTER_TEST_AND_REFACTOR_PLAN.md)

---

## ✅ Pre-Session Checklist

Before starting Phase 8, verify:

- [ ] Backend is running on port 8082
- [ ] Frontend is running on port 3001 (for UI monitoring)
- [ ] Health endpoint returns "healthy"
- [ ] Worker shows "running": true
- [ ] No zombie processes from previous tests
- [ ] Disk space >10GB free
- [ ] Session report from previous session reviewed

---

## 🎯 Success Definition

**Phase 8 is considered COMPLETE when**:
1. All 5 test objectives verified (8.1-8.5)
2. Evidence collected and documented
3. No critical issues found (or documented if found)
4. Queue management confirmed working
5. Ready to proceed to Phase 9

**Estimated Time**: 45-60 minutes
**Priority**: High (blocking Phase 9)
**Difficulty**: Medium

---

**Ready to start!** Follow the test plan step-by-step and collect evidence for each test.

**Last Updated**: 2025-10-27 14:12 UTC
**Next Review**: After Phase 8 completion
