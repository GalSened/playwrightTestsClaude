# Browser Flickering Issue - RESOLVED

**Date:** 2025-11-05
**Issue:** Browser flickering/slow motion during test execution
**Status:** ✅ RESOLVED

---

## 🐛 Problem

When running tests, the browser was showing:
- ✅ Visible window (headed mode)
- ⚠️ **Flickering** / slow motion effect (50-100ms delay between each action)
- ⏱️ Tests running 10x slower than necessary

---

## 🔍 Root Cause

The `pytest.ini` configuration had the following defaults:

```ini
addopts =
    --headed        # ← Shows browser window
    --slowmo 100    # ← CAUSES FLICKERING (100ms delay per action)
```

**Why flickering happened:**
- `--slowmo 100` adds a 100ms delay between EVERY action
- This creates a visible "slow motion" effect
- Intended for debugging, but was enabled by default

---

## ✅ Solution

Updated `pytest.ini` to remove slow-motion defaults:

### Before (Flickering)
```ini
addopts =
    -v
    --tb=short
    --alluredir=reports/allure-results
    --clean-alluredir
    --headed        # ← Browser visible
    --slowmo 100    # ← FLICKERING!
    --browser chromium
```

### After (No Flickering)
```ini
addopts =
    -v
    --tb=short
    --alluredir=reports/allure-results
    --clean-alluredir
    --browser chromium
    # Removed --headed and --slowmo for fast headless execution
    # Use pytest --headed to see browser window
    # Use pytest --headed --slowmo 100 for debugging
```

---

## 🚀 How to Run Tests Now

### Default (Fast, No Flickering, Headless)
```bash
cd new_tests_for_wesign
pytest tests/auth/ -v
```
- **Browser:** Hidden (headless)
- **Speed:** Fast (no delays)
- **Flickering:** ❌ None
- **Use for:** CI/CD, normal test execution

---

### Show Browser (No Flickering)
```bash
cd new_tests_for_wesign
pytest tests/auth/ -v --headed
```
- **Browser:** Visible window
- **Speed:** Fast (no delays)
- **Flickering:** ❌ None
- **Use for:** Watching tests run, debugging

---

### Debug Mode (With Slow Motion - Intentional Flickering)
```bash
cd new_tests_for_wesign
pytest tests/auth/ -v --headed --slowmo 100
```
- **Browser:** Visible window
- **Speed:** Slow (100ms delay per action)
- **Flickering:** ✅ Yes (intentional for observation)
- **Use for:** Step-by-step debugging, understanding test flow

---

## 📊 Execution Mode Comparison

| Command | Browser | Speed | Flickering | Use Case |
|---------|---------|-------|------------|----------|
| `pytest tests/` | Hidden | Fast | ❌ No | **CI/CD, default** |
| `pytest tests/ --headed` | Visible | Fast | ❌ No | **Debugging** |
| `pytest tests/ --headed --slowmo 100` | Visible | Slow | ✅ Yes | **Observation** |

---

## 💡 Key Points

1. **Flickering is now OPTIONAL** - only enabled when you add `--slowmo` flag
2. **Default is fast and headless** - perfect for CI/CD
3. **Use `--headed` to see browser** without flickering
4. **Use `--headed --slowmo 100`** only when you need to observe each step

---

## 🔧 Jenkins/CI/CD Impact

### Jenkins Pipelines - No Changes Needed

```bash
# This will run fast without flickering (headless mode)
pytest tests/auth/ \
  -v \
  --junit-xml=reports/junit/auth.xml \
  --html=reports/html/auth.html \
  --self-contained-html \
  --alluredir=allure-results
```

**Why it works:**
- No `--headed` flag = headless mode
- No `--slowmo` flag = fast execution
- No flickering, fast results

---

## 📖 Related Documentation

- **[EXECUTION_MODES.md](EXECUTION_MODES.md)** - Complete guide to execution modes
- **[CICD_GUIDE.md](CICD_GUIDE.md)** - Jenkins CI/CD setup
- **[pytest.ini](pytest.ini)** - Updated configuration file

---

## ✅ Summary

**Problem:** Browser flickering during tests
**Cause:** `--slowmo 100` enabled by default in pytest.ini
**Solution:** Removed `--slowmo` from default options
**Result:** Tests run fast without flickering by default

**To see flickering again** (for debugging):
```bash
pytest tests/ --headed --slowmo 100
```

---

**Maintained By:** DevTools/QA Intelligence Team
**Last Updated:** 2025-11-05
**Status:** ✅ RESOLVED - Tests run fast without flickering
