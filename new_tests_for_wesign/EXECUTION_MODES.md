# Test Execution Modes Guide

**Date:** 2025-11-05
**Purpose:** Guide for running tests in different modes (headless, headed, slow-mo)

---

## 🎯 Quick Reference

### Default (CI/CD Mode - Fast & Headless)
```bash
cd new_tests_for_wesign
pytest tests/auth/ -v --alluredir=allure-results
```
- **Browser:** Headless (no window)
- **Speed:** Fast (no delays)
- **Use for:** CI/CD, regression testing, fast feedback

---

### Headed Mode (See Browser Window)
```bash
cd new_tests_for_wesign
pytest tests/auth/ -v --headed --alluredir=allure-results
```
- **Browser:** Visible window
- **Speed:** Fast (no delays)
- **Use for:** Debugging, watching test execution, screenshot verification

---

### Debug Mode (Headed + Slow Motion)
```bash
cd new_tests_for_wesign
pytest tests/auth/ -v --headed --slowmo --alluredir=allure-results
```
- **Browser:** Visible window
- **Speed:** Slow (50ms delay between actions)
- **Use for:** Step-by-step debugging, understanding test flow
- **Note:** This creates the "flickering" effect you saw - it's intentional for observation

---

## 📊 Comparison Table

| Mode | Command | Browser | Speed | Flickering | Use Case |
|------|---------|---------|-------|------------|----------|
| **Default** | `pytest tests/` | Hidden | Fast | ❌ No | CI/CD, fast testing |
| **Headed** | `pytest tests/ --headed` | Visible | Fast | ❌ No | Local debugging |
| **Debug** | `pytest tests/ --headed --slowmo` | Visible | Slow | ✅ Yes | Step-by-step analysis |

---

## 🔧 Execution Examples

### Run Single Test (Fast, Headless)
```bash
cd new_tests_for_wesign
pytest tests/auth/test_authentication_core.py::TestAuthentication::test_login_with_valid_company_credentials_success -v
```

### Run Single Test (Watch Execution)
```bash
cd new_tests_for_wesign
pytest tests/auth/test_authentication_core.py::TestAuthentication::test_login_with_valid_company_credentials_success -v --headed
```

### Run Single Test (Debug Mode)
```bash
cd new_tests_for_wesign
pytest tests/auth/test_authentication_core.py::TestAuthentication::test_login_with_valid_company_credentials_success -v --headed --slowmo
```

### Run All Auth Tests with Allure (CI/CD Mode)
```bash
cd new_tests_for_wesign
pytest tests/auth/ -v --junit-xml=reports/junit/auth.xml --html=reports/html/auth.html --self-contained-html --alluredir=allure-results
```

### Generate and View Allure Report
```bash
cd new_tests_for_wesign

# Generate report
allure generate allure-results --clean -o reports/allure-report

# Open report in browser
allure open reports/allure-report
```

---

## 🐛 Troubleshooting

### Issue: Browser Flickering / Slow Execution

**Cause:** `--slowmo` flag is enabled

**Solution:**
```bash
# Remove --slowmo flag
pytest tests/ -v --headed
```

---

### Issue: Can't See What's Happening

**Cause:** Running in headless mode (default)

**Solution:**
```bash
# Add --headed flag
pytest tests/ -v --headed
```

---

### Issue: Tests Too Fast to Observe

**Cause:** No slow motion enabled

**Solution:**
```bash
# Add --slowmo flag for observation
pytest tests/ -v --headed --slowmo
```

---

## 📝 Configuration Details

The execution modes are configured in `conftest.py`:

```python
# Default: Headless, fast
headless = not request.config.getoption("--headed", default=False)
slow_mo = 50 if request.config.getoption("--slowmo", default=False) else 0

# CI environment detection
if os.getenv("CI"):
    headless = True  # Always headless in CI
    slow_mo = 0      # Always fast in CI
```

---

## 🚀 CI/CD Integration

### Jenkins/GitLab CI (Default Mode)
```bash
# No flags needed - defaults to headless + fast
pytest tests/ -v --alluredir=allure-results
```

### Local Development
```bash
# Watch tests run
pytest tests/ -v --headed

# Debug specific test
pytest tests/auth/test_authentication_core.py::TestAuthentication::test_login_with_valid_company_credentials_success -v --headed --slowmo
```

---

## 💡 Best Practices

### ✅ DO

- **CI/CD:** Use default mode (headless, fast)
- **Local debugging:** Use `--headed` to see browser
- **Understanding failures:** Use `--headed --slowmo` to observe
- **Fast feedback:** Use headless mode for quick iterations

### ❌ DON'T

- **CI/CD:** Don't use `--headed` or `--slowmo` (will fail in headless environments)
- **Production:** Don't commit `--slowmo` in CI config (makes tests 10x slower)
- **Large test suites:** Don't use `--slowmo` for >10 tests (takes too long)

---

## 🎬 Example Workflows

### Workflow 1: Develop New Test
```bash
# 1. Write test
vim tests/auth/test_new_feature.py

# 2. Run with observation
pytest tests/auth/test_new_feature.py -v --headed

# 3. Debug if needed
pytest tests/auth/test_new_feature.py -v --headed --slowmo

# 4. Verify in headless (CI mode)
pytest tests/auth/test_new_feature.py -v
```

### Workflow 2: Fix Failing Test
```bash
# 1. Run in headed mode to see failure
pytest tests/auth/test_failing.py -v --headed

# 2. Add slowmo if failure is too fast to catch
pytest tests/auth/test_failing.py -v --headed --slowmo

# 3. Fix and re-run
pytest tests/auth/test_failing.py -v --headed

# 4. Confirm in headless
pytest tests/auth/test_failing.py -v
```

### Workflow 3: Full Test Suite with Reports
```bash
# Run all tests and generate all reports
pytest tests/ -v \
  --junit-xml=reports/junit/all.xml \
  --html=reports/html/all.html \
  --self-contained-html \
  --alluredir=allure-results

# Generate Allure report
allure generate allure-results --clean -o reports/allure-report

# Open Allure dashboard
allure open reports/allure-report
```

---

**Maintained By:** DevTools/QA Intelligence Team
**Last Updated:** 2025-11-05
**Status:** ✅ PRODUCTION READY
