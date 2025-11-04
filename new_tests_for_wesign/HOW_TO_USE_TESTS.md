# How to Use WeSign Tests

**Quick Reference Guide for Running Playwright Tests**

---

## 📂 Test File Locations

### By Module

```
new_tests_for_wesign/
├── tests/
│   ├── contacts/              # Contact management tests (46 tests)
│   │   ├── test_contacts_core.py
│   │   ├── test_contacts_round1_critical.py
│   │   └── test_contacts_comprehensive.py
│   │
│   ├── documents/             # Document management tests (25 tests)
│   │   └── test_e2e_documents_real_validation.py
│   │
│   ├── templates/             # Template tests (7 STRONG assertion tests)
│   │   ├── test_templates_real_validation.py    # ✅ Use this one (STRONG assertions)
│   │   ├── test_templates_core_fixed.py         # Old tests (weak assertions)
│   │   └── test_e2e_template_operations.py
│   │
│   └── self_signing/          # Self-signing workflow tests (10 tests)
│       ├── test_self_signing_core_fixed.py
│       ├── test_all_field_types_fixed.py
│       └── test_initials_field_fixed.py
│
└── api_tests/                 # API tests (8 Postman collections)
    ├── Contacts_Module_Tests.postman_collection.json
    ├── Documents_Module_Tests.postman_collection.json
    ├── Templates_Module_Tests.postman_collection.json
    ├── Admins_Module_Tests.postman_collection.json
    ├── SelfSign_Module_Tests.postman_collection.json
    ├── SignerAPI_Module_Tests.postman_collection.json
    ├── ManagementAPI_Module_Tests.postman_collection.json
    ├── Final_Gap_Tests.postman_collection.json
    └── WeSign_Unified_Environment.postman_environment.json
```

---

## 🚀 How to Run Tests

### Prerequisites

```bash
# 1. Install Python dependencies
cd new_tests_for_wesign
pip install -r requirements.txt

# 2. Install Playwright browsers
playwright install chromium --with-deps

# 3. (Optional) Install Newman for API tests
npm install -g newman newman-reporter-htmlextra
```

### Running E2E Tests (Playwright + Python)

#### Run All Tests in a Module

```bash
# Contacts module (46 tests)
py -m pytest tests/contacts/ -v

# Documents module (25 tests)
py -m pytest tests/documents/ -v

# Templates module (7 STRONG assertion tests)
py -m pytest tests/templates/test_templates_real_validation.py -v

# Self-signing module (10 tests)
py -m pytest tests/self_signing/ -v

# Run ALL E2E tests
py -m pytest tests/ -v
```

#### Run a Specific Test

```bash
# Run single test
py -m pytest tests/contacts/test_contacts_core.py::TestContactsCore::test_01_create_contact_email_only -v

# Run with visual debugging (headed mode, slow motion)
py -m pytest tests/contacts/test_contacts_core.py::TestContactsCore::test_01_create_contact_email_only -v -s --headed --slowmo 100
```

#### Common Options

```bash
# Headless mode (default in CI/CD)
py -m pytest tests/contacts/ -v --headless

# Stop on first failure
py -m pytest tests/contacts/ -v --maxfail=1

# Continue through all failures
py -m pytest tests/contacts/ -v --maxfail=999

# Generate HTML report
py -m pytest tests/contacts/ -v --html=reports/contacts-report.html --self-contained-html

# Show detailed output
py -m pytest tests/contacts/ -v -s

# Short traceback (good for CI/CD)
py -m pytest tests/contacts/ -v --tb=short
```

### Running API Tests (Newman + Postman)

#### Run Single Collection

```bash
cd api_tests

# Run Contacts API tests
newman run Contacts_Module_Tests.postman_collection.json \
  -e WeSign_Unified_Environment.postman_environment.json \
  -r htmlextra \
  --reporter-htmlextra-export reports/contacts-api.html

# Run Templates API tests
newman run Templates_Module_Tests.postman_collection.json \
  -e WeSign_Unified_Environment.postman_environment.json \
  -r htmlextra \
  --reporter-htmlextra-export reports/templates-api.html
```

#### Run All API Collections (Bash/Linux/macOS)

```bash
cd api_tests

for collection in *.postman_collection.json; do
  name=$(basename "$collection" .postman_collection.json)
  newman run "$collection" \
    -e WeSign_Unified_Environment.postman_environment.json \
    -r htmlextra \
    --reporter-htmlextra-export "reports/${name}.html"
done
```

#### Run All API Collections (PowerShell/Windows)

```powershell
cd api_tests

Get-ChildItem -Filter "*.postman_collection.json" | ForEach-Object {
    $name = $_.BaseName -replace '.postman_collection', ''
    newman run $_.Name `
        -e WeSign_Unified_Environment.postman_environment.json `
        -r htmlextra `
        --reporter-htmlextra-export "reports/$name.html"
}
```

---

## 📊 Test Coverage Summary

| Module | Test File | Tests | Type | Status |
|--------|-----------|-------|------|--------|
| **Contacts** | `tests/contacts/test_contacts_core.py` | 46 | E2E | ✅ Active |
| **Documents** | `tests/documents/test_e2e_documents_real_validation.py` | 25 | E2E | ✅ Active |
| **Templates** | `tests/templates/test_templates_real_validation.py` | 7 | E2E | ✅ STRONG assertions |
| **Self-Signing** | `tests/self_signing/test_all_field_types_fixed.py` | 10 | E2E | ✅ Active |
| **API - Contacts** | `api_tests/Contacts_Module_Tests.postman_collection.json` | ~40 | API | ✅ Active |
| **API - Documents** | `api_tests/Documents_Module_Tests.postman_collection.json` | ~35 | API | ✅ Active |
| **API - Templates** | `api_tests/Templates_Module_Tests.postman_collection.json` | ~30 | API | ✅ Active |
| **API - Complete** | `api_tests/*.postman_collection.json` | 400+ | API | ✅ 100% coverage |

---

## 🎯 Recommended Test Commands for CI/CD

### Quick Smoke Test (Fast validation)

```bash
py -m pytest tests/ -m smoke -v --maxfail=1
```

### Full Regression (All modules)

```bash
# E2E Tests
py -m pytest tests/ -v --maxfail=999 --tb=short \
  --html=reports/full-report.html --self-contained-html

# API Tests
cd api_tests && newman run *.postman_collection.json -e WeSign_Unified_Environment.postman_environment.json
```

### Module-by-Module (Parallel execution in CI/CD)

```bash
# Run these in parallel in your CI/CD pipeline:

# Job 1: Contacts
py -m pytest tests/contacts/ -v --junit-xml=reports/contacts.xml

# Job 2: Documents
py -m pytest tests/documents/ -v --junit-xml=reports/documents.xml

# Job 3: Templates (STRONG assertions)
py -m pytest tests/templates/test_templates_real_validation.py -v --junit-xml=reports/templates.xml

# Job 4: Self-Signing
py -m pytest tests/self_signing/ -v --junit-xml=reports/self-signing.xml

# Job 5: API Tests
newman run api_tests/*.postman_collection.json -e api_tests/WeSign_Unified_Environment.postman_environment.json
```

---

## 📝 Environment Configuration

### Required Environment Variables

```bash
# For E2E Tests (Playwright)
BASE_URL=https://devtest.comda.co.il
LOGIN_EMAIL=nirk@comsign.co.il
LOGIN_PASSWORD=Comsign1!  # Store in CI/CD secrets!

# For API Tests (Postman/Newman)
# Configure in: api_tests/WeSign_Unified_Environment.postman_environment.json
```

### Test Data Files

Located in `test_files/`:
- `test_document.pdf` - Sample PDF for upload tests
- `test_image.jpg` - Sample image for field tests
- `test_template.docx` - Sample template file

---

## 🔍 Understanding Test Results

### Pytest Output

```bash
# ✅ PASSED - Test succeeded
tests/contacts/test_contacts_core.py::test_01_create_contact_email_only PASSED

# ❌ FAILED - Test failed (check assertion message)
tests/templates/test_templates_real_validation.py::test_02_verify_table FAILED

# ⚠️ SKIPPED - Test skipped (usually @pytest.mark.skip)
tests/contacts/test_contacts_core.py::test_99_future_feature SKIPPED
```

### Newman Output

```bash
┌─────────────────────────┬────────────────┬───────────────┐
│                         │       executed │        failed │
├─────────────────────────┼────────────────┼───────────────┤
│              iterations │              1 │             0 │
├─────────────────────────┼────────────────┼───────────────┤
│                requests │             40 │             2 │  ← 2 API tests failed
├─────────────────────────┼────────────────┼───────────────┤
│            test-scripts │             80 │             3 │
├─────────────────────────┼────────────────┼───────────────┤
│      prerequest-scripts │             20 │             0 │
├─────────────────────────┼────────────────┼───────────────┤
│              assertions │            120 │             3 │  ← Check these assertions
└─────────────────────────┴────────────────┴───────────────┘
```

---

## 🐛 Troubleshooting

### Common Issues

**Issue**: `ModuleNotFoundError: No module named 'pytest'`
```bash
# Solution
pip install -r requirements.txt
```

**Issue**: `Playwright executable not found`
```bash
# Solution
playwright install chromium --with-deps
```

**Issue**: Tests timing out
```bash
# Solution: Increase timeout or check if WeSign app is running
py -m pytest tests/ -v --timeout=120
```

**Issue**: `newman: command not found`
```bash
# Solution
npm install -g newman newman-reporter-htmlextra
```

---

## 📁 Test Reports & Artifacts

### Generated Reports

```
reports/
├── html/                  # Pytest HTML reports
│   ├── contacts.html
│   ├── documents.html
│   └── templates.html
├── junit/                 # JUnit XML (for CI/CD integration)
│   ├── contacts.xml
│   └── templates.xml
└── api/                   # Newman HTML Extra reports
    ├── Contacts_Module_Tests.html
    └── Templates_Module_Tests.html
```

### Test Artifacts (on failure)

```
screenshots/               # Screenshots on test failure
videos/                   # Video recordings (if enabled)
traces/                   # Playwright traces for debugging
```

---

## 🎓 Key Testing Concepts

### STRONG Assertions vs WEAK Assertions

**❌ WEAK** (Don't use):
```python
assert isinstance(result, bool)  # Passes for True OR False!
assert True, "Login worked"      # Always passes
```

**✅ STRONG** (Use this):
```python
# Before/after validation
fields_before = await page.locator('.field').count()
await add_field_button.click()
fields_after = await page.locator('.field').count()
assert fields_after == fields_before + 1  # Validates actual change
```

**Proof**: See `TEMPLATES_VALIDATION_COMPLETE_SUMMARY.md` - 14.3% pass rate with STRONG assertions is MORE VALUABLE than 89.4% with WEAK assertions because it reveals real issues!

---

## 📚 Additional Documentation

- **Methodology**: `TEMPLATES_MCP_DISCOVERY_SESSION.md` - How we discover page structure systematically
- **Strong Assertions**: `TEMPLATES_VALIDATION_COMPLETE_SUMMARY.md` - Proof that strong assertions are better
- **API Coverage**: `api_tests/README.md` - Complete API test documentation
- **CI/CD Setup**: `README_CICD.md` - CI/CD pipeline configuration

---

## 🔗 Quick Links

- **WeSign DevTest**: https://devtest.comda.co.il
- **GitHub Repo**: https://github.com/GalSened/playwrightTestsClaude
- **GitLab Repo**: https://gitlab.comda.co.il/wesignv3/playwrightestclaude
- **Playwright Docs**: https://playwright.dev/python/

---

**Last Updated**: 2025-11-04
**Test Suite Version**: 2.0
**Total Test Scenarios**: 634+

---

## ⚡ Super Quick Start

```bash
# 1. Setup (one time)
cd new_tests_for_wesign
pip install -r requirements.txt
playwright install chromium --with-deps

# 2. Run everything
py -m pytest tests/ -v

# 3. View reports
open reports/html/index.html  # Or browse reports/ directory
```

**That's it!** 🎉
