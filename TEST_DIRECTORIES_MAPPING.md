# Test Directories Mapping - WeSign vs QA Intelligence

**Date:** 2025-11-05
**Purpose:** Clear separation between QA Intelligence platform tests and WeSign application tests
**Status:** ✅ DOCUMENTED - Reference for CI/CD configuration

---

## 🎯 Executive Summary

This repository contains **TWO DISTINCT TEST SUITES** that must be kept separate:

1. **QA Intelligence Platform Tests** (`tests/` and `apps/*/tests/`) - TypeScript tests for the QA Intelligence platform itself
2. **WeSign Application Tests** (`new_tests_for_wesign/`) - Python tests for the WeSign application being tested by QA Intelligence

---

## 📁 Directory Structure

```
playwrightTestsClaude/
├── tests/                          ← QA Intelligence E2E Tests (TypeScript)
│   ├── e2e/
│   │   ├── src/                   # Platform feature tests
│   │   │   ├── auth/
│   │   │   ├── integration/
│   │   │   ├── mobile/
│   │   │   ├── security/
│   │   │   └── real-time/
│   │   └── tests/                 # Platform validation tests
│   │       ├── core/
│   │       ├── enterprise/
│   │       ├── execution/
│   │       ├── monitoring/
│   │       ├── performance/
│   │       ├── scheduler/
│   │       └── security/
│   ├── examples/                  # Demo tests
│   └── integration/               # Integration tests
│
├── apps/                          ← QA Intelligence Component Tests
│   ├── frontend/dashboard/tests/  # Frontend platform tests (TypeScript)
│   ├── api/tests/                 # API platform tests (TypeScript)
│   └── backend/tests/             # Backend platform tests (TypeScript)
│
├── new_tests_for_wesign/          ← WeSign Application Tests (Python)
│   ├── tests/                     # STRONG assertions methodology
│   │   ├── contacts/              # WeSign Contacts module
│   │   ├── documents/             # WeSign Documents module
│   │   ├── templates/             # WeSign Templates module
│   │   └── self_signing/          # WeSign Self-Signing module
│   ├── api_tests/                 # Postman collections for WeSign API
│   └── test_files/                # Test data files
│
└── playwright-smart/              ← Legacy tests (being phased out)
    └── tests/
```

---

## 🔍 Detailed Breakdown

### 1. QA Intelligence Platform Tests (`tests/`, `apps/*/tests/`)

**Purpose:** Test the QA Intelligence platform itself (the testing framework, UI, backend, scheduler, etc.)

**Technology Stack:**
- **Language:** TypeScript
- **Framework:** Playwright (TypeScript)
- **Test Runner:** Playwright Test Runner
- **Target:** QA Intelligence platform at `http://localhost:3001`

**Key Test Categories:**
- `tests/e2e/src/auth/` - Platform authentication tests
- `tests/e2e/tests/core/` - Core platform functionality
- `tests/e2e/tests/scheduler/` - Test scheduler functionality
- `tests/e2e/tests/enterprise/` - Enterprise features (RBAC, multi-tenant)
- `tests/e2e/tests/monitoring/` - Real-time monitoring
- `apps/frontend/dashboard/tests/` - Dashboard UI tests
- `apps/api/tests/` - Platform API tests

**Run Commands:**
```bash
# Frontend platform tests
cd apps/frontend/dashboard
npm test

# API platform tests
cd apps/api
npm test

# E2E platform tests
cd tests/e2e
npx playwright test
```

---

### 2. WeSign Application Tests (`new_tests_for_wesign/`)

**Purpose:** Test the WeSign application (the target application being tested by QA Intelligence)

**Technology Stack:**
- **Language:** Python 3.12+
- **Framework:** Pytest + Playwright (Python)
- **Test Runner:** pytest
- **Target:** WeSign application at `https://devtest.comda.co.il`
- **Methodology:** STRONG assertions (systematic MCP discovery)

**Key Test Categories:**
- `tests/contacts/` - WeSign Contacts module (46 tests)
- `tests/documents/` - WeSign Documents module (84 planned tests)
- `tests/templates/` - WeSign Templates module (7 tests with STRONG assertions)
- `tests/self_signing/` - WeSign Self-Signing module (10 tests)
- `api_tests/` - Postman collections for WeSign API

**Run Commands:**
```bash
cd new_tests_for_wesign

# Run specific module
pytest tests/contacts/ -v
pytest tests/documents/ -v
pytest tests/templates/test_templates_real_validation.py -v
pytest tests/self_signing/ -v

# Run all WeSign tests
pytest tests/ -v

# Run with HTML report
pytest tests/ -v --html=reports/html/all-tests.html --self-contained-html
```

---

## ⚙️ CI/CD Configuration

### Current GitLab CI Structure

The `.gitlab-ci.yml` file is correctly configured with **SEPARATE stages** for each test suite:

#### WeSign Tests (Python/Pytest)
- **Stage:** `test-e2e`
- **Jobs:**
  - `test:e2e:contacts` - WeSign Contacts module
  - `test:e2e:documents` - WeSign Documents module
  - `test:e2e:templates` - WeSign Templates module
  - `test:e2e:self-signing` - WeSign Self-Signing module

#### QA Intelligence Platform Tests (TypeScript/Playwright)
- **NOT in current .gitlab-ci.yml** (needs to be added if platform tests should run in CI)

---

## 🚨 Common Confusion Points

### ❌ WRONG: Running TypeScript tests from `tests/` expecting WeSign results
```bash
# This tests the QA Intelligence PLATFORM, not WeSign
cd tests/e2e
npx playwright test
```

### ✅ CORRECT: Running Python tests from `new_tests_for_wesign/` for WeSign
```bash
# This tests the WeSign APPLICATION
cd new_tests_for_wesign
pytest tests/ -v
```

---

## 📊 Test Metrics by Suite

### QA Intelligence Platform Tests
- **Location:** `tests/`, `apps/*/tests/`
- **Technology:** TypeScript
- **Test Count:** ~50+ tests
- **Purpose:** Validate QA Intelligence platform features
- **Target URL:** `http://localhost:3001`
- **Run Time:** ~5-10 minutes

### WeSign Application Tests
- **Location:** `new_tests_for_wesign/`
- **Technology:** Python
- **Test Count:** 157+ tests (growing)
  - Contacts: 46 tests
  - Documents: 84 tests (planned)
  - Templates: 7 tests (STRONG assertions)
  - Self-Signing: 10 tests
- **Purpose:** Validate WeSign application functionality
- **Target URL:** `https://devtest.comda.co.il`
- **Run Time:** ~20-30 minutes (full suite)

---

## 🎯 When to Use Which Tests

### Use QA Intelligence Platform Tests When:
- Developing/modifying the QA Intelligence dashboard
- Adding new scheduler features
- Testing platform authentication
- Validating test bank functionality
- Testing enterprise features (RBAC, multi-tenant)
- Debugging platform backend/frontend issues

### Use WeSign Application Tests When:
- Testing WeSign application features
- Validating document signing workflows
- Testing contacts management
- Verifying template functionality
- Running regression tests for WeSign
- Demonstrating STRONG assertions methodology

---

## 🔧 Quick Reference Commands

### QA Intelligence Platform

```bash
# Start platform
cd backend && npm run dev
cd apps/frontend/dashboard && npm run dev

# Run platform tests
cd tests/e2e && npx playwright test
cd apps/frontend/dashboard && npm test
```

### WeSign Application

```bash
# Run WeSign tests
cd new_tests_for_wesign
pytest tests/ -v

# Run specific module
pytest tests/documents/test_documents_send_happy_path.py -v

# Run with reports
pytest tests/ --html=reports/html/report.html --self-contained-html
```

---

## 📝 CI/CD Pipeline Flow

```
GitLab Pipeline
│
├── Setup Stage
│   └── Install dependencies (Python + Playwright browsers)
│
├── Lint Stage
│   └── Python linting (WeSign tests only)
│
├── Test-Smoke Stage
│   └── Run smoke tests (if any marked with @smoke)
│
├── Test-API Stage
│   └── Run Postman collections (WeSign API)
│
├── Test-E2E Stage (WeSign Application Tests)
│   ├── test:e2e:contacts
│   ├── test:e2e:documents
│   ├── test:e2e:templates
│   └── test:e2e:self-signing
│
├── Report Stage
│   └── Generate consolidated reports
│
└── Deploy Stage
    └── Archive test artifacts
```

---

## 🚀 Future Enhancements

### Planned Additions

1. **Separate CI stages for QA Intelligence platform tests**
   ```yaml
   test:platform:frontend:
     script: cd apps/frontend/dashboard && npm test

   test:platform:backend:
     script: cd apps/api && npm test
   ```

2. **Test suite badges**
   - WeSign E2E: ![WeSign Tests](pipeline-badge-wesign.svg)
   - Platform: ![Platform Tests](pipeline-badge-platform.svg)

3. **Separate test reports**
   - Platform: `reports/platform/`
   - WeSign: `reports/wesign/`

---

## 📖 Key Documentation

- **WeSign Tests Guide:** [new_tests_for_wesign/HOW_TO_USE_TESTS.md](new_tests_for_wesign/HOW_TO_USE_TESTS.md)
- **WeSign CI/CD Guide:** [new_tests_for_wesign/README_CICD.md](new_tests_for_wesign/README_CICD.md)
- **STRONG Assertions Methodology:** [new_tests_for_wesign/TEMPLATES_STRONG_ASSERTIONS_FINAL_PROOF.md](new_tests_for_wesign/TEMPLATES_STRONG_ASSERTIONS_FINAL_PROOF.md)
- **GitLab CI Configuration:** [.gitlab-ci.yml](.gitlab-ci.yml)

---

## ✅ Summary Table

| Aspect | QA Intelligence Platform | WeSign Application |
|--------|-------------------------|-------------------|
| **Directory** | `tests/`, `apps/*/tests/` | `new_tests_for_wesign/` |
| **Language** | TypeScript | Python |
| **Framework** | Playwright (TS) | Pytest + Playwright (Python) |
| **Target** | `http://localhost:3001` | `https://devtest.comda.co.il` |
| **Purpose** | Test the platform | Test WeSign app |
| **Test Count** | ~50+ | 157+ |
| **CI Stage** | (Not yet configured) | `test-e2e` |
| **Reports** | HTML (Playwright) | HTML + JUnit XML |

---

**Maintained By:** DevTools/QA Intelligence Team
**Last Updated:** 2025-11-05
**Status:** ✅ PRODUCTION REFERENCE
