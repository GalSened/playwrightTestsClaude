# WeSign API Test Suite

Comprehensive Postman collection for WeSign API testing with 97 tests across 8 modules.

## Quick Start

### Prerequisites

```bash
# Install Node.js and Newman
npm install -g newman newman-reporter-htmlextra

# Or using Python/pip
pip install newman
```

### Run Tests

```bash
# Run all tests with HTML report
newman run WeSign_ULTIMATE_COMPLETE_API_TESTING_SUITE.json \
  -e "WeSign API Environment.postman_environment.json" \
  -r htmlextra,cli \
  --reporter-htmlextra-export reports/api-test-report.html

# Run specific module (e.g., Users tests only)
newman run WeSign_ULTIMATE_COMPLETE_API_TESTING_SUITE.json \
  -e "WeSign API Environment.postman_environment.json" \
  --folder "Users - Phase 1: Authentication Flow Tests"

# Run with iterations (stress test)
newman run WeSign_ULTIMATE_COMPLETE_API_TESTING_SUITE.json \
  -e "WeSign API Environment.postman_environment.json" \
  -n 10
```

## Test Structure

### Modules (8)

1. **Users** - Authentication, profiles, token management
2. **Distribution** - Distribution workflows and management
3. **Links** - Link management operations
4. **Configuration** - System configuration
5. **Files** - File operations
6. **Statistics** - Analytics and reporting
7. **Tablets** - Device management
8. **Test Summary** - Execution summary

### Phase Pattern (per module)

Each module follows an 8-phase testing pattern:

1. **Authentication Setup** - Get tokens
2. **Data Discovery** - Explore existing data
3. **CRUD Operations** - Create, Read, Update, Delete
4. **Workflow Testing** - Business logic flows
5. **Management Operations** - Advanced operations
6. **Edge Cases** - Boundary conditions
7. **Security Testing** - SQL injection, XSS, auth
8. **Validation & Cleanup** - Final checks

## Coverage Metrics

- **Total Tests:** 97
- **HTTP Methods:** GET (67%), POST (23%), PUT (7%), DELETE (3%)
- **Security Tests:** 7 dedicated security tests
- **Modules:** 8 core modules

## Environment Variables

Key variables in `WeSign API Environment.postman_environment.json`:

- `baseUrl` - API base URL
- `loginEmail` - Test account email
- `loginPassword` - Test account password
- `jwtToken` - JWT auth token (set by tests)
- `authToken` - Auth token (set by tests)
- `refreshToken` - Refresh token (set by tests)

## Usage Examples

### 1. Smoke Test (Quick Validation)

```bash
# Run authentication + one test per module (~5 min)
newman run WeSign_ULTIMATE_COMPLETE_API_TESTING_SUITE.json \
  -e "WeSign API Environment.postman_environment.json" \
  --folder "Users - Phase 1: Authentication Flow Tests" \
  -r cli
```

### 2. Full Regression Test

```bash
# Run all 97 tests (~15 min)
newman run WeSign_ULTIMATE_COMPLETE_API_TESTING_SUITE.json \
  -e "WeSign API Environment.postman_environment.json" \
  -r htmlextra,cli \
  --reporter-htmlextra-export reports/regression-report.html
```

### 3. Security Tests Only

```bash
# Run all Phase 7 security tests
newman run WeSign_ULTIMATE_COMPLETE_API_TESTING_SUITE.json \
  -e "WeSign API Environment.postman_environment.json" \
  --folder "Users - Phase 4: Security & Edge Case Tests" \
  -r cli
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: API Tests

on: [push, pull_request]

jobs:
  api-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install Newman
        run: npm install -g newman newman-reporter-htmlextra

      - name: Run API Tests
        run: |
          newman run WeSign_ULTIMATE_COMPLETE_API_TESTING_SUITE.json \
            -e "WeSign API Environment.postman_environment.json" \
            -r htmlextra,cli \
            --reporter-htmlextra-export reports/api-report.html

      - name: Upload Report
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: api-test-report
          path: reports/
```

### Jenkins Pipeline Example

```groovy
pipeline {
    agent any

    stages {
        stage('API Tests') {
            steps {
                script {
                    sh '''
                        npm install -g newman newman-reporter-htmlextra

                        newman run WeSign_ULTIMATE_COMPLETE_API_TESTING_SUITE.json \
                          -e "WeSign API Environment.postman_environment.json" \
                          -r htmlextra,cli \
                          --reporter-htmlextra-export reports/api-report.html
                    '''
                }
            }
        }
    }

    post {
        always {
            publishHTML([
                reportDir: 'reports',
                reportFiles: 'api-report.html',
                reportName: 'API Test Report'
            ])
        }
    }
}
```

## Test Data Management

### Current Approach
- Uses environment variables for configuration
- Dynamic variables for chaining (e.g., `lastContactId`)
- Hard-coded test data in requests

### Recommendations
1. Move test data to external CSV/JSON files
2. Use Postman Vault for credentials
3. Implement test data generation in pre-request scripts

## Security Considerations

⚠️ **IMPORTANT:** Current environment file contains plain-text credentials.

**For Production:**
1. Use Postman Vault or CI/CD secrets
2. Never commit credentials to version control
3. Use separate environments for dev/test/prod

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   ```
   Solution: Ensure loginEmail and loginPassword are correct in environment
   ```

2. **Tests Failing Due to Missing Resources**
   ```
   Solution: Run tests in order, as they chain using variables
   ```

3. **Token Expired**
   ```
   Solution: Re-run authentication tests to get fresh tokens
   ```

## Reports

After running tests, find reports in:
- `reports/api-test-report.html` - Detailed HTML report
- Console output - Summary with pass/fail stats

## Contributing

When adding new tests:
1. Follow the 8-phase pattern
2. Add appropriate assertions
3. Include security tests
4. Update documentation

## Analysis

See `ANALYSIS_REPORT.md` for detailed analysis including:
- Coverage analysis
- Security assessment
- Best practices review
- Improvement recommendations

## Support

For issues or questions:
- Check `ANALYSIS_REPORT.md` for detailed insights
- Review test execution logs
- Verify environment configuration

---

**Last Updated:** 2025-10-31
**Collection Version:** 1.0
**API Version:** v3
