# 🚀 Main Dashboard - Complete Execution Runbook
## Production-Ready Validation Guide

**Version:** 1.0.0
**Last Updated:** 2025-11-04
**Status:** Ready for Execution
**Estimated Time:** 4 hours for complete validation

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Phase 1: Functional Validation](#phase-1-functional-validation)
4. [Phase 2: Edge Cases & Error Handling](#phase-2-edge-cases--error-handling)
5. [Phase 3: Non-Functional Tests](#phase-3-non-functional-tests)
6. [Phase 4: Evidence Collection](#phase-4-evidence-collection)
7. [Reporting & Sign-off](#reporting--sign-off)
8. [Troubleshooting](#troubleshooting)

---

## ✅ Prerequisites

### **Environment Setup**

#### 1. Services Running
```bash
# Terminal 1: Backend (Port 8082)
cd /home/user/playwrightTestsClaude/backend
npm install --legacy-peer-deps
npm run dev

# Terminal 2: Frontend (Port 3001)
cd /home/user/playwrightTestsClaude/apps/frontend/dashboard
npm install --legacy-peer-deps
npm run dev

# Verify both are running
curl http://localhost:8082/api/wesign/health
curl http://localhost:3001
```

#### 2. Test Dependencies
```bash
# Python dependencies
py -m pip install pytest playwright pytest-playwright pytest-asyncio

# Install Playwright browsers
py -m playwright install --with-deps

# Newman for API tests
npm install -g newman newman-reporter-htmlextra

# Accessibility testing
npm install -g @axe-core/cli
```

#### 3. Test Database
```bash
# Ensure test database has sample data
cd /home/user/playwrightTestsClaude/backend
npm run seed  # or npm run migrate && npm run seed
```

---

## 🚀 Quick Start

### **Option A: Run Everything (Full Validation - 4 hours)**

```bash
# Run complete validation suite
cd /home/user/playwrightTestsClaude

# 1. E2E Tests (all 32 scenarios)
py -m pytest tests/e2e/dashboard/test_dashboard_comprehensive.py -v -s --tb=short

# 2. API Tests (7 endpoints)
newman run tests/api/MAIN_DASHBOARD_analytics_apis.postman_collection.json \
  -e tests/api/env.json \
  -r htmlextra \
  --reporter-htmlextra-export reports/api/MAIN_DASHBOARD/newman-report.html

# 3. Accessibility Scan
axe http://localhost:3001 --save reports/a11y/MAIN_DASHBOARD/axe-report.json

# 4. Performance Audit
lighthouse http://localhost:3001 \
  --output=html \
  --output-path=reports/perf/MAIN_DASHBOARD/lighthouse-report.html
```

### **Option B: Run by Phase (Incremental - Recommended)**

Follow Phases 1-4 below step-by-step.

### **Option C: Run Specific Tests Only**

```bash
# Run only happy path tests (Phase 1)
py -m pytest tests/e2e/dashboard/test_dashboard_comprehensive.py::TestDashboardHappyPath -v

# Run only error handling tests
py -m pytest tests/e2e/dashboard/test_dashboard_comprehensive.py::TestDashboardErrorHandling -v

# Run only accessibility tests
py -m pytest tests/e2e/dashboard/test_dashboard_comprehensive.py::TestDashboardAccessibility -v
```

---

## 📊 Phase 1: Functional Validation (Happy Path)

**Duration:** 1 hour
**Tests:** 7 scenarios
**Priority:** P0-Critical

### **1.1 Run E2E Happy Path Tests**

```bash
cd /home/user/playwrightTestsClaude

# Run Phase 1 tests
py -m pytest tests/e2e/dashboard/test_dashboard_comprehensive.py::TestDashboardHappyPath \
  -v -s --tb=short \
  --html=reports/e2e/MAIN_DASHBOARD/phase1-report.html \
  --self-contained-html
```

**Expected Output:**
```
test_01_dashboard_loads_with_all_sections PASSED
test_02_summary_kpis_display_correct_data PASSED
test_03_module_breakdown_displays_correctly PASSED
test_04_execution_trends_chart_renders PASSED
test_05_ai_insights_display_recommendations PASSED
test_06_execution_monitor_shows_live_data PASSED
test_07_auto_refresh_works_correctly PASSED

=============== 7 passed in 120.00s ===============
```

### **1.2 Run API Tests**

```bash
# Create environment file first
cat > tests/api/env.json << 'EOF'
{
  "id": "dashboard-test-env",
  "name": "Dashboard Test Environment",
  "values": [
    {
      "key": "baseUrl",
      "value": "http://localhost:8082",
      "enabled": true
    },
    {
      "key": "authToken",
      "value": "your-jwt-token-here",
      "enabled": true
    }
  ]
}
EOF

# Run Newman API tests
newman run tests/api/MAIN_DASHBOARD_analytics_apis.postman_collection.json \
  -e tests/api/env.json \
  -r htmlextra,cli \
  --reporter-htmlextra-export reports/api/MAIN_DASHBOARD/newman-report.html
```

**Expected Output:**
```
┌─────────────────────────┬────────────┬───────────┐
│                         │   executed │    failed │
├─────────────────────────┼────────────┼───────────┤
│              iterations │          1 │         0 │
├─────────────────────────┼────────────┼───────────┤
│                requests │         15 │         0 │
├─────────────────────────┼────────────┼───────────┤
│            test-scripts │         15 │         0 │
├─────────────────────────┼────────────┼───────────┤
│      prerequest-scripts │          1 │         0 │
├─────────────────────────┼────────────┼───────────┤
│              assertions │         75 │         0 │
└─────────────────────────┴────────────┴───────────┘
```

### **1.3 Document Phase 1 Results**

Update `docs/reviews/MAIN_DASHBOARD/phase1-execution-log.md`:
- Mark all tests as ✅ Passed or ❌ Failed
- Add screenshots to `artifacts/MAIN_DASHBOARD/screenshots/`
- Record any issues found

---

## ⚠️ Phase 2: Edge Cases & Error Handling

**Duration:** 45 minutes
**Tests:** 11 scenarios (5 edge cases + 6 error handling)
**Priority:** P1-High

### **2.1 Run Edge Case Tests**

```bash
py -m pytest tests/e2e/dashboard/test_dashboard_comprehensive.py::TestDashboardEdgeCases \
  -v -s --tb=short
```

**Tests:**
- test_08_dashboard_with_no_data
- test_09_dashboard_with_partial_data
- test_10_dashboard_handles_large_dataset
- test_11_dashboard_indicates_stale_data
- test_12_dashboard_handles_concurrent_updates

### **2.2 Run Error Handling Tests**

```bash
py -m pytest tests/e2e/dashboard/test_dashboard_comprehensive.py::TestDashboardErrorHandling \
  -v -s --tb=short
```

**Tests:**
- test_13_handles_api_failure
- test_14_handles_api_timeout
- test_15_handles_network_error
- test_16_handles_malformed_response
- test_17_handles_database_error
- test_18_handles_partial_api_failure

### **2.3 Manual Error Simulation**

Some tests require manual setup:

**Simulate API Failure (500 Error):**
```bash
# Option 1: Use browser DevTools Network tab
# - Block requests to /api/analytics/dashboard
# - Verify error message displays

# Option 2: Modify backend temporarily
# - Comment out analytics route
# - Restart backend
# - Verify error handling
```

**Simulate Network Disconnection:**
```bash
# Use browser DevTools:
# - Open DevTools → Network tab
# - Set throttling to "Offline"
# - Enable auto-refresh
# - Verify network error message
```

---

## 🔍 Phase 3: Non-Functional Tests

**Duration:** 1 hour
**Tests:** 11 scenarios
**Priority:** P0-Critical (accessibility, performance), P1-High (security, i18n, cross-browser)

### **3.1 Accessibility Testing**

#### **Automated Accessibility Scan**
```bash
# Install axe CLI (if not already installed)
npm install -g @axe-core/cli

# Create reports directory
mkdir -p reports/a11y/MAIN_DASHBOARD

# Run axe scan
axe http://localhost:3001 \
  --save reports/a11y/MAIN_DASHBOARD/axe-report.json \
  --reporter=v2

# Generate readable report
cat reports/a11y/MAIN_DASHBOARD/axe-report.json | jq '.violations' > reports/a11y/MAIN_DASHBOARD/violations.json
```

#### **Run Playwright Accessibility Tests**
```bash
py -m pytest tests/e2e/dashboard/test_dashboard_comprehensive.py::TestDashboardAccessibility \
  -v -s
```

**Tests:**
- test_24_keyboard_navigation
- test_25_screen_reader_compatibility
- test_26_wcag_compliance

**Success Criteria:**
- ✅ Zero critical accessibility issues
- ✅ Zero major accessibility issues
- ✅ WCAG 2.1 AA compliant

### **3.2 Performance Testing**

#### **Lighthouse Audit**
```bash
# Install Lighthouse
npm install -g lighthouse

# Create reports directory
mkdir -p reports/perf/MAIN_DASHBOARD

# Run Lighthouse audit
lighthouse http://localhost:3001 \
  --output=html \
  --output=json \
  --output-path=reports/perf/MAIN_DASHBOARD/lighthouse-report.html \
  --chrome-flags="--headless"

# View scores
cat reports/perf/MAIN_DASHBOARD/lighthouse-report.report.json | jq '.categories'
```

**Target Scores:**
- Performance: ≥90
- Accessibility: ≥90
- Best Practices: ≥90
- SEO: ≥80

#### **Run Playwright Performance Tests**
```bash
py -m pytest tests/e2e/dashboard/test_dashboard_comprehensive.py::TestDashboardPerformance \
  -v -s
```

**Tests:**
- test_27_page_load_performance (target: <2s p95)
- test_28_api_response_performance (target: <1s p95)
- test_29_auto_refresh_performance (no memory leaks)

### **3.3 Security Testing**

```bash
py -m pytest tests/e2e/dashboard/test_dashboard_comprehensive.py::TestDashboardSecurity \
  -v -s
```

**Tests:**
- test_19_unauthenticated_access_redirects
- test_20_session_expiry_redirects
- test_21_insufficient_permissions

**Manual Security Checks:**
```bash
# 1. Check HTTPS in production
curl -I https://your-production-url.com

# 2. Check security headers
curl -I http://localhost:3001 | grep -i "x-\|content-security"

# 3. Run npm audit
cd backend && npm audit
cd apps/frontend/dashboard && npm audit
```

### **3.4 Internationalization (i18n)**

```bash
py -m pytest tests/e2e/dashboard/test_dashboard_comprehensive.py::TestDashboardInternationalization \
  -v -s
```

**Tests:**
- test_22_dashboard_in_hebrew (RTL layout)
- test_23_dashboard_in_english (LTR layout)

### **3.5 Cross-Browser Testing**

```bash
# Test in Chromium
py -m pytest tests/e2e/dashboard/test_dashboard_comprehensive.py::TestDashboardCrossBrowser::test_30_chromium_compatibility \
  -v -s

# Test in Firefox
py -m pytest tests/e2e/dashboard/test_dashboard_comprehensive.py::TestDashboardCrossBrowser::test_31_firefox_compatibility \
  -v -s

# Test in WebKit (Safari)
py -m pytest tests/e2e/dashboard/test_dashboard_comprehensive.py::TestDashboardCrossBrowser::test_32_webkit_compatibility \
  -v -s
```

---

## 📸 Phase 4: Evidence Collection

### **4.1 Collect Artifacts**

```bash
# Create artifacts directory
mkdir -p artifacts/MAIN_DASHBOARD/{screenshots,videos,logs,api-responses}

# Copy all generated reports
cp -r reports/* artifacts/MAIN_DASHBOARD/

# Collect screenshots (if test framework doesn't auto-save)
# Screenshots are saved during test execution to artifacts/MAIN_DASHBOARD/screenshots/
```

### **4.2 Generate Evidence Summary**

Create `artifacts/MAIN_DASHBOARD/evidence.md`:

```markdown
# Evidence Summary - Main Dashboard Validation

**Date:** 2025-11-04
**Validator:** [Your Name]
**Duration:** 4 hours

## Test Results

### Phase 1: Functional (Happy Path)
- ✅ E2E Tests: 7/7 passed
- ✅ API Tests: 15/15 passed
- Evidence: phase1-report.html, newman-report.html

### Phase 2: Edge Cases & Error Handling
- ✅ Edge Cases: 5/5 passed
- ✅ Error Handling: 6/6 passed
- Evidence: phase2-report.html

### Phase 3: Non-Functional
- ✅ Accessibility: WCAG 2.1 AA compliant (0 critical, 0 major issues)
- ✅ Performance: p95 load time 1.8s (<2s target)
- ✅ Security: All auth tests passed
- ✅ i18n: Hebrew RTL + English LTR validated
- ✅ Cross-browser: Chromium, Firefox, WebKit all passed

## Artifacts

- E2E Reports: reports/e2e/MAIN_DASHBOARD/
- API Reports: reports/api/MAIN_DASHBOARD/newman-report.html
- Accessibility: reports/a11y/MAIN_DASHBOARD/axe-report.json
- Performance: reports/perf/MAIN_DASHBOARD/lighthouse-report.html
- Screenshots: artifacts/MAIN_DASHBOARD/screenshots/

## Issues Found

[List any issues with severity, description, and remediation]

## Sign-off

- [ ] All critical tests (P0) passing
- [ ] All high priority tests (P1) passing
- [ ] Zero critical defects
- [ ] Zero major defects
- [ ] Documentation complete

**Recommendation:** ✅ READY FOR PRODUCTION
```

---

## 📝 Reporting & Sign-off

### **Complete DoD Checklist**

Update `docs/reviews/MAIN_DASHBOARD/DoD-checklist.md` based on `docs/templates/dod-checklist-template.md`:

```bash
cp docs/templates/dod-checklist-template.md artifacts/MAIN_DASHBOARD/DoD-checklist.md

# Fill in actual values:
# - Test counts (X/Y passed)
# - Coverage percentages
# - Performance metrics
# - Accessibility scores
# - Link to all artifacts
```

### **Generate Run Report**

Create `artifacts/MAIN_DASHBOARD/RUN-2025-11-04-MAIN_DASHBOARD.md` based on `docs/templates/run-report-template.md`:

```bash
cp docs/templates/run-report-template.md artifacts/MAIN_DASHBOARD/RUN-$(date +%Y-%m-%d)-MAIN_DASHBOARD.md

# Fill in:
# - Executive summary
# - AC matrix (32/32 scenarios)
# - Test results (unit/API/E2E)
# - Non-functional results
# - Metrics summary
# - Recommendation: PROCEED/MERGE
```

---

## 🛠️ Troubleshooting

### **Services Won't Start**

```bash
# Backend issues
cd backend
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
npm run dev

# Frontend issues
cd apps/frontend/dashboard
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
npm run dev
```

### **Tests Failing**

```bash
# Increase timeout
py -m pytest tests/e2e/dashboard/test_dashboard_comprehensive.py \
  -v -s --timeout=60

# Run in headed mode for debugging
py -m pytest tests/e2e/dashboard/test_dashboard_comprehensive.py \
  -v -s --headed

# Run single test for debugging
py -m pytest tests/e2e/dashboard/test_dashboard_comprehensive.py::TestDashboardHappyPath::test_01_dashboard_loads_with_all_sections \
  -v -s --headed
```

### **API Tests Failing**

```bash
# Check backend is running
curl http://localhost:8082/api/wesign/health

# Check auth token
# Update authToken in tests/api/env.json

# Run with verbose logging
newman run tests/api/MAIN_DASHBOARD_analytics_apis.postman_collection.json \
  -e tests/api/env.json \
  --verbose
```

---

## ✅ Success Criteria Checklist

After completing all phases, verify:

- [ ] **All 32 acceptance criteria validated** with evidence
- [ ] **E2E Tests:** 32/32 passed
- [ ] **API Tests:** All 7 endpoints passing
- [ ] **Unit Test Coverage:** ≥80% (if applicable)
- [ ] **Accessibility:** WCAG 2.1 AA (0 critical/major issues)
- [ ] **Performance:** p95 load <2s, API <1s
- [ ] **Security:** All auth tests passing
- [ ] **i18n:** Hebrew RTL + English LTR working
- [ ] **Cross-browser:** Chromium, Firefox, WebKit working
- [ ] **Zero critical/major defects**
- [ ] **All artifacts collected and organized**
- [ ] **DoD checklist complete**
- [ ] **Run report generated**

**If all ✅:** Dashboard is **100% PRODUCTION READY** 🎉

---

## 📞 Support

### **Quick Commands Reference**

```bash
# Start services
cd backend && npm run dev                           # Backend
cd apps/frontend/dashboard && npm run dev           # Frontend

# Run all E2E tests
py -m pytest tests/e2e/dashboard/test_dashboard_comprehensive.py -v -s

# Run API tests
newman run tests/api/MAIN_DASHBOARD_analytics_apis.postman_collection.json -e tests/api/env.json -r htmlextra

# Run accessibility scan
axe http://localhost:3001 --save reports/a11y/MAIN_DASHBOARD/axe-report.json

# Run performance audit
lighthouse http://localhost:3001 --output=html --output-path=reports/perf/MAIN_DASHBOARD/lighthouse-report.html
```

### **File Locations**

- **Validation Plan:** `docs/reviews/MAIN_DASHBOARD/validation-plan.md`
- **E2E Tests:** `tests/e2e/dashboard/test_dashboard_comprehensive.py`
- **API Tests:** `tests/api/MAIN_DASHBOARD_analytics_apis.postman_collection.json`
- **Execution Log:** `docs/reviews/MAIN_DASHBOARD/phase1-execution-log.md`
- **This Runbook:** `docs/reviews/MAIN_DASHBOARD/EXECUTION-RUNBOOK.md`

---

**Ready to execute?** Start with Phase 1 and work through each phase systematically!

**Questions?** Refer to the detailed validation plan or phase execution logs.

---

*Version: 1.0.0*
*Last Updated: 2025-11-04*
*Status: Ready for Execution*
