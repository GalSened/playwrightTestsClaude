# Quick Start Guide - WeSign API Tests

Get up and running with WeSign API tests in 5 minutes.

## Step 1: Install Newman

**Option A: Using npm (recommended)**
```bash
npm install -g newman newman-reporter-htmlextra
```

**Option B: Using yarn**
```bash
yarn global add newman newman-reporter-htmlextra
```

**Verify installation:**
```bash
newman --version
```

## Step 2: Run Your First Test

### Windows (PowerShell)
```powershell
# Smoke test (quick validation)
.\run-tests.ps1 -TestType smoke

# Full test suite
.\run-tests.ps1 -TestType regression
```

### Linux/Mac (Bash)
```bash
# Make script executable
chmod +x run-tests.sh

# Smoke test
./run-tests.sh smoke

# Full test suite
./run-tests.sh regression
```

### Manual Execution
```bash
newman run WeSign_ULTIMATE_COMPLETE_API_TESTING_SUITE.json \
  -e "WeSign API Environment.postman_environment.json" \
  -r htmlextra \
  --reporter-htmlextra-export reports/api-report.html
```

## Step 3: View Results

Open the generated HTML report:

**Windows:**
```powershell
start reports/api-report.html
```

**Linux/Mac:**
```bash
open reports/api-report.html
# or
xdg-open reports/api-report.html
```

## Test Suites Available

| Suite | Command | Duration | Tests |
|-------|---------|----------|-------|
| **Smoke** | `./run-tests.sh smoke` | ~2 min | 2 tests |
| **Regression** | `./run-tests.sh regression` | ~15 min | 97 tests |
| **Security** | `./run-tests.sh security` | ~3 min | 7 tests |
| **Users** | `./run-tests.sh users` | ~4 min | 9 tests |

## Common Use Cases

### 1. Pre-Deployment Validation
```bash
# Run full regression before deploying
./run-tests.sh regression
```

### 2. Quick Health Check
```bash
# Verify API is responding
./run-tests.sh smoke
```

### 3. Security Audit
```bash
# Run all security tests
./run-tests.sh security
```

### 4. Module-Specific Testing
```bash
# Test specific module after changes
./run-tests.sh users
```

## Troubleshooting

### Issue: "newman: command not found"
**Solution:**
```bash
# Check if newman is installed
npm list -g newman

# If not installed:
npm install -g newman newman-reporter-htmlextra
```

### Issue: "Authentication Failed"
**Solution:**
1. Check `WeSign API Environment.postman_environment.json`
2. Verify `loginEmail` and `loginPassword` are correct
3. Ensure API endpoint is accessible

### Issue: "Tests Failing in Sequence"
**Solution:**
- Tests use variable chaining (results from one test feed into next)
- Always run authentication tests first
- Don't run tests in isolation without auth

## Next Steps

1. ✅ Run smoke test
2. ✅ View HTML report
3. 📖 Read `ANALYSIS_REPORT.md` for detailed insights
4. 🔧 Integrate with CI/CD (see `README.md`)
5. 🎯 Customize environment for your needs

## Getting Help

- **Full Documentation:** See `README.md`
- **Detailed Analysis:** See `ANALYSIS_REPORT.md`
- **Collection Structure:** Open in Postman for visual exploration

## Pro Tips

1. **Save Time:** Use smoke tests for quick validation
2. **Generate Reports:** Always use `htmlextra` reporter for detailed insights
3. **Environment Management:** Create separate environment files for dev/test/prod
4. **CI/CD:** Integrate tests into your deployment pipeline
5. **Security:** Never commit credentials - use environment variables

---

**You're Ready!** Run your first test now:
```bash
./run-tests.sh smoke
```

Happy Testing! 🚀
