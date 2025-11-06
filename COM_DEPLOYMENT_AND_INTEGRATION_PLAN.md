# COM Deployment & WeSign Integration Plan

**Date:** October 25, 2025
**Status:** Ready to Execute
**Goal:** Deploy COM and integrate with WeSign test suite for immediate ROI

---

## 🎯 Executive Summary

**Objective:** Deploy COM v1.0.0 and integrate with existing WeSign test suite to achieve:
- 70% reduction in test execution time via smart regression
- Automated flaky test detection and tracking
- Self-healing test recommendations
- Data-driven QA insights

**Timeline:** 4-6 hours for initial deployment + ongoing integration
**Expected ROI:** Immediate time savings starting with first PR

---

## 📋 Phase 1: COM Service Deployment (1-2 hours)

### Step 1.1: Environment Setup

```bash
# Navigate to COM directory
cd /home/user/playwrightTestsClaude/com

# Verify Python version (need 3.9+)
python3 --version

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

**Expected Output:**
- Virtual environment created
- All dependencies installed (~15 packages)
- No errors

**Verification:**
```bash
python -c "import fastapi; import faiss; print('✓ Dependencies OK')"
```

---

### Step 1.2: Configuration

```bash
# Create environment file
cat > .env <<EOF
# Event Store
EVENT_LOG_DB_PATH=./data/events.db

# Vector Index
VECTOR_INDEX_PATH=./data/vector_index.faiss
EMBEDDING_MODEL=BAAI/bge-large-en-v1.5
EMBEDDING_DIM=1024

# Policies
POLICIES_DIR=./policies

# LM Studio (optional - can skip initially)
LM_STUDIO_URL=http://localhost:1234/v1
LLM_MODEL=qwen2.5-32b-instruct

# API
CORS_ORIGIN=http://localhost:8082,http://localhost:3001
PORT=8083
EOF

# Create data directory
mkdir -p data
```

**Expected Output:**
- `.env` file created
- `data/` directory created

---

### Step 1.3: Start COM Service

```bash
# Method 1: Direct Python (for testing)
python -m uvicorn api.main:app --reload --port 8083

# Method 2: Use provided script
./start.sh

# Method 3: Docker (for production)
docker-compose up -d
```

**Expected Output:**
```
COM (Context Orchestrator Management) Service Starting...
================================================================================

1. Initializing Event Store: ./data/events.db
   ✓ Event Store ready. Total events: 0

2. Initializing Vector Index: ./data/vector_index.faiss
   Model: BAAI/bge-large-en-v1.5
   ✓ Vector Index ready. Total vectors: 0

3. Initializing Hybrid Retriever
   ✓ Hybrid Retriever ready

4. Initializing Policy Engine: ./policies
   ✓ Policy Engine ready. Loaded 5 policies

5. Initializing Memory Journal (Git-style)
   ✓ Memory Journal ready. 1 branches, 0 commits

6. Initializing LLM Service
   ⚠ LLM Service initialized but LM Studio not available - will use fallback summaries

7. Initializing Roll-up Summary Service
   ✓ Roll-up Service ready (LLM enabled: False)

8. Initializing Flaky Test Registry
   ✓ Flaky Registry ready

9. Initializing Smart Regression Selector
   ✓ Regression Selector ready

================================================================================
COM Service Ready!
================================================================================
INFO:     Uvicorn running on http://0.0.0.0:8083
```

---

### Step 1.4: Verify COM Service

```bash
# Health check
curl http://localhost:8083/health

# Expected response:
# {
#   "status": "healthy",
#   "event_store": {"total_events": 0, ...},
#   "vector_index": {"total_vectors": 0, ...},
#   "policies": 5
# }

# Test ingest
curl -X POST http://localhost:8083/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "type": "test_execution",
    "project": "WeSign",
    "source": "test",
    "importance": 3.0,
    "tags": ["initial-test"],
    "data": {"test_id": "test_health_check"}
  }'

# Verify event was stored
curl http://localhost:8083/events/recent?project=WeSign&limit=1
```

**Success Criteria:**
- ✅ Health endpoint returns 200
- ✅ Event ingested successfully
- ✅ Event retrieved correctly
- ✅ No errors in logs

---

## 📋 Phase 2: WeSign Test Integration (2-3 hours)

### Step 2.1: Locate WeSign Tests

According to CLAUDE.md:
```
WeSign Tests: 634+ test scenarios
Location: C:/Users/gals/seleniumpythontests-1/playwright_tests/
Python Path: C:/Users/gals/AppData/Local/Programs/Python/Python312/python.exe
```

**Action:**
```bash
# Verify test location exists
ls -la /mnt/c/Users/gals/seleniumpythontests-1/playwright_tests/ || \
ls -la C:/Users/gals/seleniumpythontests-1/playwright_tests/

# Count tests
find /path/to/playwright_tests -name "test_*.py" | wc -l
```

---

### Step 2.2: Create COM Integration Hook

Create file: `playwright_tests/conftest.py` (or append if exists)

```python
"""
COM Integration for WeSign Tests
Auto-ingests test results to COM for intelligence gathering
"""

import pytest
import requests
import os
from datetime import datetime

# COM Service URL
COM_URL = os.getenv("COM_URL", "http://localhost:8083")
PROJECT = "WeSign"

def ingest_to_com(event_type, test_id, data):
    """Ingest event to COM service"""
    try:
        response = requests.post(
            f"{COM_URL}/ingest",
            json={
                "type": event_type,
                "project": PROJECT,
                "source": "pytest-playwright",
                "importance": 4.0 if "critical" in data.get("tags", []) else 2.5,
                "tags": data.get("tags", []),
                "data": {
                    "test_id": test_id,
                    "timestamp": datetime.utcnow().isoformat(),
                    **data
                }
            },
            timeout=5
        )
        return response.status_code == 200
    except Exception as e:
        # Silent failure - don't break tests if COM is down
        print(f"[COM] Failed to ingest: {e}")
        return False


@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    """
    Hook into pytest execution to capture test results
    Ingests to COM after each test execution
    """
    outcome = yield
    report = outcome.get_result()

    # Only process call phase (actual test execution)
    if report.when != "call":
        return

    # Extract test info
    test_id = item.nodeid
    test_name = item.name
    duration_ms = int(report.duration * 1000)

    # Extract tags/markers
    tags = [marker.name for marker in item.iter_markers()]

    # Add category tags based on test path
    if "signing" in test_id.lower():
        tags.append("signing-workflow")
    if "payment" in test_id.lower():
        tags.append("payment-flow")
    if "upload" in test_id.lower():
        tags.append("document-upload")

    # Build base data
    base_data = {
        "test_name": test_name,
        "duration_ms": duration_ms,
        "tags": tags
    }

    if report.passed:
        # Success
        ingest_to_com(
            event_type="test_execution",
            test_id=test_id,
            data={
                **base_data,
                "status": "passed"
            }
        )

    elif report.failed:
        # Failure - capture error details
        error_info = str(report.longrepr) if report.longrepr else "Unknown error"

        # Extract error type
        error_type = "Unknown"
        if "TimeoutError" in error_info:
            error_type = "TimeoutError"
            tags.append("timeout")
        elif "AssertionError" in error_info:
            error_type = "AssertionError"
            tags.append("assertion-failure")
        elif "Selector" in error_info or "locator" in error_info.lower():
            error_type = "SelectorError"
            tags.append("selector-failure")
        elif "Network" in error_info or "ERR_" in error_info:
            error_type = "NetworkError"
            tags.append("network-error")

        ingest_to_com(
            event_type="test_failure",
            test_id=test_id,
            data={
                **base_data,
                "status": "failed",
                "error_message": error_info[:1000],  # Limit size
                "error_type": error_type,
                "tags": tags
            }
        )

    elif report.skipped:
        # Skipped test
        ingest_to_com(
            event_type="test_execution",
            test_id=test_id,
            data={
                **base_data,
                "status": "skipped",
                "skip_reason": str(report.longrepr) if report.longrepr else "Unknown"
            }
        )


@pytest.hookimpl(trylast=True)
def pytest_sessionfinish(session, exitstatus):
    """
    After all tests complete, generate initial reports
    """
    print("\n" + "="*80)
    print("COM Integration Summary")
    print("="*80)
    print(f"Events sent to: {COM_URL}")
    print(f"Project: {PROJECT}")
    print("Check COM for test intelligence insights!")
    print(f"COM Dashboard: {COM_URL}/docs")
    print("="*80)
```

**Key Features:**
- ✅ Auto-ingests all test executions and failures
- ✅ Captures error types (Timeout, Selector, Assertion, Network)
- ✅ Adds intelligent tags based on test path
- ✅ Silent failure if COM is down (non-breaking)
- ✅ Detailed error information for analysis

---

### Step 2.3: Run Initial Test Suite with COM

```bash
# Set COM URL
export COM_URL=http://localhost:8083

# Run a small subset first (smoke test)
cd /path/to/playwright_tests
pytest test_signing_workflow.py -v

# Check COM received events
curl "http://localhost:8083/events/recent?project=WeSign&limit=10"

# Run full suite (or subset)
pytest tests/ -v --maxfail=10

# Monitor COM
curl "http://localhost:8083/stats"
```

**Expected Results:**
- Tests run normally (COM integration is transparent)
- Events appear in COM
- Both successes and failures captured
- Tags automatically applied

---

## 📋 Phase 3: Enable Intelligence Features (1-2 hours)

### Step 3.1: Detect Flaky Tests

After running tests multiple times (ideally 10+ executions per test):

```bash
# Detect flaky tests
curl -X POST http://localhost:8083/flaky/detect \
  -H "Content-Type: application/json" \
  -d '{
    "project": "WeSign",
    "days": 7,
    "min_executions": 5,
    "flakiness_threshold": 0.1
  }' | jq .

# Expected output:
# {
#   "detected_count": 3,
#   "flaky_tests": [
#     {
#       "test_id": "tests/test_signing.py::test_complete_signing",
#       "flakiness_level": "moderate",
#       "failure_rate": 0.35,
#       "failure_count": 7,
#       "success_count": 13
#     }
#   ]
# }
```

**Analyze Manifestations:**
```bash
# For each flaky test, analyze how it fails
curl "http://localhost:8083/flaky/analyze/tests%2Ftest_signing.py%3A%3Atest_complete_signing?project=WeSign&days=7" | jq .

# Expected output:
# {
#   "manifestations": {
#     "TimeoutError: Selector '#sign-button' not found": {
#       "count": 4,
#       "percentage": 57.1
#     },
#     "AssertionError: Expected 'Complete' but got 'Pending'": {
#       "count": 2,
#       "percentage": 28.6
#     }
#   }
# }
```

---

### Step 3.2: Generate Flaky Report

```bash
# Get comprehensive flakiness report
curl "http://localhost:8083/flaky/report/WeSign?days=7" | jq . > flaky_report.json

# View summary
jq '.summary' flaky_report.json

# View top flaky tests
jq '.top_flaky_tests[:5]' flaky_report.json
```

**Create Snapshot:**
```bash
# Commit flaky registry to memory journal
curl -X POST http://localhost:8083/flaky/commit-snapshot \
  -H "Content-Type: application/json" \
  -d '{
    "project": "WeSign",
    "message": "Week 1 flaky test baseline - 3 flaky tests detected"
  }'
```

---

### Step 3.3: Test Smart Regression Selection

Simulate a code change and test regression selection:

```bash
# Simulate code change in signing workflow
curl -X POST http://localhost:8083/regression/select \
  -H "Content-Type: application/json" \
  -d '{
    "project": "WeSign",
    "code_changes": [
      {
        "file_path": "src/components/SigningWorkflow.tsx",
        "change_type": "modified",
        "lines_added": 25,
        "lines_deleted": 10,
        "functions_changed": ["handleSignClick", "validateSignature"]
      },
      {
        "file_path": "src/api/signatureService.ts",
        "change_type": "modified",
        "lines_added": 15,
        "lines_deleted": 5,
        "functions_changed": ["createSignature"]
      }
    ],
    "available_tests": [
      "test_signing_workflow",
      "test_payment_flow",
      "test_user_auth",
      "test_document_upload",
      "test_signature_validation",
      "test_pdf_generation"
    ],
    "max_tests": 3,
    "time_budget_minutes": 10
  }' | jq .
```

**Expected Output:**
```json
{
  "summary": {
    "total_available_tests": 6,
    "selected_tests": 3,
    "selection_ratio": 0.5
  },
  "selected_tests": [
    {
      "test_id": "test_signing_workflow",
      "score": 0.92,
      "reasons": [
        "High semantic similarity to changed code (0.85)",
        "Previously failed with similar changes (0.75)",
        "Critical test (importance: 0.90)"
      ],
      "risk_level": "critical"
    },
    {
      "test_id": "test_signature_validation",
      "score": 0.81,
      "reasons": [
        "High semantic similarity to changed code (0.78)"
      ],
      "risk_level": "critical"
    },
    {
      "test_id": "test_pdf_generation",
      "score": 0.62,
      "risk_level": "high"
    }
  ]
}
```

**Benefit:** Instead of running all 6 tests, run only 3 critical ones (50% time savings)

---

## 📋 Phase 4: Ongoing Operations (Continuous)

### Daily Operations

**Morning:**
```bash
# Generate daily rollup
curl -X POST http://localhost:8083/rollups/daily \
  -H "Content-Type: application/json" \
  -d '{
    "project": "WeSign",
    "date": "'$(date -I)'",
    "use_llm": false
  }' | jq '.summary'
```

**After Test Runs:**
```bash
# Check for new flaky tests
curl -X POST http://localhost:8083/flaky/detect \
  -d '{"project":"WeSign","days":1}' | jq '.detected_count'

# Get healing stats
curl "http://localhost:8083/flaky/healing-stats?days=7" | jq '.success_rate'
```

**Weekly:**
```bash
# Generate weekly rollup
curl -X POST http://localhost:8083/rollups/weekly \
  -d '{
    "project": "WeSign",
    "week_start": "'$(date -d 'last monday' -I)'",
    "use_llm": false
  }' | jq '.summary'

# Commit registry snapshot
curl -X POST http://localhost:8083/flaky/commit-snapshot \
  -d '{"project":"WeSign","message":"Week '$(date +%U)' snapshot"}'
```

---

## 📊 Success Metrics

### Week 1 Targets

- ✅ **Events Ingested:** 100+ test executions captured
- ✅ **Flaky Tests Detected:** 3-5 flaky tests identified
- ✅ **Regression Selection:** 1-2 successful smart selections
- ✅ **Time Savings:** Initial 20-30% reduction measured

### Week 2-4 Targets

- ✅ **Flaky Rate Decrease:** 20% reduction in flaky test count
- ✅ **Healing Success:** 2-3 successful auto-healing attempts
- ✅ **Regression Optimization:** 50-70% time savings on PRs
- ✅ **Coverage:** 100% of test suite instrumented

---

## 🔧 Troubleshooting

### Issue: COM Service Won't Start

**Check:**
```bash
# Python version
python3 --version  # Need 3.9+

# Dependencies
pip list | grep -E "fastapi|faiss|sentence"

# Logs
tail -f logs/com.log  # If using background service
```

**Fix:**
```bash
# Reinstall dependencies
pip install --force-reinstall -r requirements.txt

# Check ports
lsof -i :8083  # Make sure port is free
```

---

### Issue: Events Not Being Ingested

**Check:**
```bash
# COM health
curl http://localhost:8083/health

# Recent events
curl "http://localhost:8083/events/recent?limit=5"

# pytest output
pytest -v -s  # Look for COM integration messages
```

**Fix:**
```bash
# Verify conftest.py is loaded
pytest --fixtures | grep pytest_runtest_makereport

# Check network
curl -v http://localhost:8083/ingest

# Disable COM integration temporarily
unset COM_URL
pytest  # Should still work
```

---

### Issue: Flaky Detection Not Working

**Requires:**
- Minimum 5 executions per test
- At least 1 failure and 1 success
- Time span of at least 1 day

**Solution:**
```bash
# Run tests multiple times
for i in {1..10}; do
  pytest tests/test_signing.py
  sleep 60  # Wait between runs
done

# Then detect
curl -X POST http://localhost:8083/flaky/detect \
  -d '{"project":"WeSign","min_executions":3}'
```

---

## 📝 Next Steps After Integration

### Short Term (Week 1-2)
1. Monitor event ingestion
2. Identify top 5 flaky tests
3. Attempt healing for selector failures
4. Test regression selection on 2-3 PRs
5. Measure time savings

### Medium Term (Week 3-4)
1. Integrate LM Studio for narrative summaries
2. Create custom policies for WeSign patterns
3. Set up automated daily reports
4. Train team on COM usage
5. Expand coverage to all test types

### Long Term (Month 2+)
1. Deploy to CI/CD pipelines
2. Set up monitoring dashboards
3. Implement auto-healing workflows
4. Optimize policies based on results
5. Scale to other projects

---

## 🎯 Expected ROI

### Time Savings
- **Week 1:** 20-30% reduction in test execution time
- **Week 2:** 40-50% reduction with smart regression
- **Week 4:** 60-70% reduction with optimized selection

### Quality Improvements
- **Flaky Rate:** 20-30% reduction in flaky tests
- **Mean Time to Resolution:** 50% faster with historical context
- **Auto-Healing:** 85% success rate for common failures

### Developer Experience
- **PR Feedback:** 70% faster (2.5 hours → 45 minutes)
- **Debugging Time:** 50% reduction with root cause context
- **Confidence:** Higher test reliability and trust

---

## 📋 Execution Checklist

### Pre-Deployment
- [ ] COM code merged to master
- [ ] Python 3.9+ installed
- [ ] WeSign test location confirmed
- [ ] COM service port 8083 available

### Deployment
- [ ] Virtual environment created
- [ ] Dependencies installed
- [ ] `.env` file configured
- [ ] Data directory created
- [ ] COM service started
- [ ] Health check passed
- [ ] Test event ingested

### Integration
- [ ] `conftest.py` created with COM hooks
- [ ] Initial test run with COM integration
- [ ] Events appearing in COM
- [ ] Error categorization working
- [ ] Tags being applied correctly

### Validation
- [ ] Flaky tests detected (after multiple runs)
- [ ] Regression selection tested
- [ ] Reports generated
- [ ] Memory journal snapshot created
- [ ] Metrics collected

### Operations
- [ ] Daily rollup automated
- [ ] Weekly snapshot scheduled
- [ ] Team trained on COM features
- [ ] Documentation updated
- [ ] Success metrics tracked

---

## 🚀 Ready to Execute

**Status:** ✅ Plan Complete
**Timeline:** 4-6 hours initial setup + ongoing
**Risk:** Low (non-breaking, graceful degradation)
**ROI:** High (immediate time savings)

**Next Action:** Deploy COM service (Phase 1, Step 1.1)

---

*Plan created: October 25, 2025*
*Version: 1.0*
*Status: Ready for Execution*
