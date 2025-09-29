# Getting Started with WeSign K6 Load Testing

This guide will help you set up and run your first load tests against the WeSign API using our K6 testing suite.

## 📋 Prerequisites Checklist

Before you begin, ensure you have:

- [ ] **K6 installed** on your system
- [ ] **Node.js 16+** for configuration management
- [ ] **Git** for version control
- [ ] **Access to WeSign API** environments
- [ ] **Basic understanding** of HTTP and API testing concepts

## 🛠️ Step 1: Install K6

### macOS
```bash
brew install k6
```

### Windows
```bash
# Using winget
winget install k6

# Or using chocolatey
choco install k6

# Or using scoop
scoop install k6
```

### Linux (Ubuntu/Debian)
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

### Verify Installation
```bash
k6 version
# Should output something like: k6 v0.47.0
```

## 📂 Step 2: Project Setup

1. **Navigate to the load testing directory**:
   ```bash
   cd /path/to/your/project/new_tests_for_wesign/loadTesting
   ```

2. **Install Node.js dependencies** (optional but recommended):
   ```bash
   npm install
   ```

3. **Make scripts executable** (Unix/Linux/macOS only):
   ```bash
   chmod +x run-tests.sh
   ```

## ⚙️ Step 3: Configuration

### 3.1 Environment Setup

The test suite comes with pre-configured environments. Review and adjust if needed:

**File**: `config/environments.json`

```json
{
  "environments": {
    "dev": {
      "baseUrl": "https://devtest.comda.co.il/userapi/ui/v3",
      "credentials": {
        "default": {
          "email": "test.user@loadtest.com",
          "password": "LoadTest123!"
        }
      }
    }
  }
}
```

### 3.2 Test Credentials

**⚠️ Important**: Update the test credentials with valid accounts for your environment:

1. Open `config/environments.json`
2. Replace the default credentials with valid test accounts
3. Ensure test accounts have appropriate permissions

## 🚀 Step 4: Your First Test

Let's start with a simple smoke test to verify everything is working:

### 4.1 Run Basic Smoke Test

```bash
# Unix/Linux/macOS
./run-tests.sh smoke dev

# Windows
run-tests.bat smoke dev
```

### 4.2 Understanding the Output

You should see output similar to:
```
========================================
WeSign K6 Load Testing Suite
========================================

🎯 Test Configuration:
  Type: smoke
  Environment: dev
  Base URL: https://devtest.comda.co.il/userapi/ui/v3
  Timestamp: 20240101-120000

🚬 Running Smoke Tests
======================

🔹 Running Basic Functionality Smoke Test...
     ✓ checks.........................: 100.00% ✓ 15       ✗ 0
     data_received..................: 8.2 kB  1.4 kB/s
     data_sent......................: 2.1 kB  356 B/s
     http_req_duration..............: avg=234ms min=156ms med=201ms max=445ms p(90)=389ms p(95)=445ms
     http_req_failed................: 0.00%   ✓ 0        ✗ 15
     http_reqs......................: 15      2.5/s

✅ Smoke tests completed
```

### 4.3 Check Generated Reports

After the test completes, check the `reports/` directory:
```bash
ls -la reports/
# You should see files like:
# smoke-basic-20240101-120000.json
# wesign-load-test-report-20240101-120000.html
```

Open the HTML report in your browser to see a detailed analysis.

## 📊 Step 5: Understanding Test Results

### 5.1 Key Metrics to Watch

| Metric | Description | Good Value |
|--------|-------------|------------|
| `http_req_duration` | Response time | p(95) < 3000ms |
| `http_req_failed` | Error rate | < 1% |
| `checks` | Validation pass rate | > 95% |
| `http_reqs` | Total requests | As expected |

### 5.2 Success Criteria

A test is considered successful when:
- ✅ All checks pass (>95%)
- ✅ Error rate is below threshold
- ✅ Response times meet requirements
- ✅ No system errors or timeouts

### 5.3 Common Issues and Solutions

| Issue | Possible Cause | Solution |
|-------|----------------|----------|
| Authentication failures | Wrong credentials | Update credentials in config |
| High response times | Network/API issues | Check API availability |
| Check failures | API changes | Review and update test expectations |

## 🎯 Step 6: Run Different Test Types

Now that your basic setup is working, try different test types:

### 6.1 Load Test (Moderate Load)
```bash
# Unix/Linux/macOS
./run-tests.sh load dev

# Windows
run-tests.bat load dev
```

### 6.2 Stress Test (High Load)
```bash
# Unix/Linux/macOS
./run-tests.sh stress dev

# Windows
run-tests.bat stress dev
```

### 6.3 Spike Test (Traffic Spikes)
```bash
# Unix/Linux/macOS
./run-tests.sh spike dev

# Windows
run-tests.bat spike dev
```

## 📈 Step 7: Analyzing Results

### 7.1 Understanding Load Test Patterns

Each test type follows a specific load pattern:

**Smoke**: 1 VU for 30 seconds
```
VUs: 1 ████████████████████████████████
Time: ████████████████████████████████ 30s
```

**Load**: Gradual increase to 50 VUs
```
VUs: 50 ╭─────╮
        ╱       ╲
    1  ╱         ╲
Time: ████████████████ 15m
```

**Stress**: High load with sustained peak
```
VUs: 300 ╭─────────╮
         ╱           ╲
     1  ╱             ╲
Time: ████████████████████ 20m
```

### 7.2 Reading HTML Reports

The generated HTML reports include:

1. **Test Summary**: Overview of test configuration and duration
2. **Performance Metrics**: Response times, throughput, errors
3. **Threshold Analysis**: Pass/fail status for defined limits
4. **Generated Files**: Links to detailed JSON reports

### 7.3 JSON Reports for Deep Analysis

For detailed analysis, examine the JSON reports:
```bash
# View detailed metrics
cat reports/load-journey-TIMESTAMP.json | jq '.metrics'

# Check error details
cat reports/load-journey-TIMESTAMP.json | jq '.root_group.checks'
```

## 🔧 Step 8: Customization

### 8.1 Adjusting Test Parameters

To modify test behavior, edit the scenario files:

**File**: `scenarios/smoke/smoke-basic.js`
```javascript
export const options = {
    stages: [
        { duration: '30s', target: 1 }, // Modify duration or VU count
    ],
    thresholds: {
        http_req_duration: ['p(95)<3000'], // Adjust thresholds
        http_req_failed: ['rate<0.01'],
    }
};
```

### 8.2 Adding Custom Scenarios

Create new test files following the existing patterns:

1. Copy an existing scenario file
2. Modify the test logic and load pattern
3. Update the execution scripts to include your new scenario

### 8.3 Environment-Specific Configuration

Add new environments by editing `config/environments.json`:

```json
{
  "environments": {
    "my-env": {
      "name": "My Environment",
      "baseUrl": "https://my-api.example.com",
      "credentials": {
        "default": {
          "email": "test@example.com",
          "password": "SecurePassword123!"
        }
      },
      "thresholds": {
        "http_req_duration": ["p(95)<2000"],
        "http_req_failed": ["rate<0.01"]
      }
    }
  }
}
```

## 🎉 Step 9: Next Steps

### 9.1 Regular Testing

Set up regular testing schedules:

- **Daily**: Smoke tests on every commit
- **Nightly**: Load tests against development environment
- **Weekly**: Stress and spike tests
- **Monthly**: Soak and volume tests

### 9.2 CI/CD Integration

Integrate load testing into your CI/CD pipeline:

```yaml
# Example GitHub Actions workflow
- name: Run Load Tests
  run: |
    cd loadTesting
    ./run-tests.sh smoke dev
    ./run-tests.sh load dev
```

### 9.3 Advanced Features

Explore advanced features:

- **Custom metrics**: Add business-specific performance indicators
- **Data parameterization**: Use external data files for test inputs
- **Distributed testing**: Run tests from multiple locations
- **Real-time monitoring**: Integrate with monitoring tools

## 🆘 Getting Help

### 9.1 Troubleshooting Resources

1. **Documentation**: Review `README.md` for comprehensive information
2. **Configuration**: Check all files in `config/` directory
3. **Logs**: Examine files in `logs/` directory for detailed information
4. **Reports**: Analyze generated reports for insights

### 9.2 Common Commands Reference

```bash
# Quick smoke test
./run-tests.sh smoke dev

# Complete test suite (excludes soak)
./run-tests.sh all dev

# Clean up old reports
npm run clean:reports

# Validate configuration
npm run validate:config

# Individual test scenarios
npm run test:smoke
npm run test:load
npm run test:stress
```

### 9.3 Support

For additional support:

1. Review the K6 documentation: https://k6.io/docs/
2. Check WeSign API documentation
3. Consult with the QA team for environment-specific questions

---

🎯 **You're now ready to perform comprehensive load testing of the WeSign API!**

Start with smoke tests, gradually increase load, and use the insights to optimize performance and plan capacity.

Happy testing! 🚀