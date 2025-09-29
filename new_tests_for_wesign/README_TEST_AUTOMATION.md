# WeSign Test Automation Suite

A comprehensive test automation framework for the WeSign platform supporting E2E, API, and load testing across multiple environments.

## 🚀 Quick Start

### Prerequisites
```bash
# Install Python dependencies
pip install -r requirements.txt

# Install Playwright browsers
playwright install

# Install Newman (optional, for API tests)
npm install -g newman

# Install K6 (optional, for load tests)
# Download from: https://k6.io/docs/getting-started/installation/
```

### Validate Setup
```bash
python scripts/run_comprehensive_tests.py --validate --env local
```

### Run Smoke Tests
```bash
python scripts/run_comprehensive_tests.py --smoke --env local
```

## 📁 Project Structure

```
new_tests_for_wesign/
├── scripts/                          # Test execution scripts
│   ├── run_comprehensive_tests.py    # Main orchestrator
│   ├── run_all_e2e_tests.py         # E2E test runner
│   ├── run_api_tests_python.py      # Python API tests
│   ├── run_newman_tests.py          # Newman API tests
│   ├── run_load_tests.py            # K6 load tests
│   └── validate_environments.py     # Environment validation
├── config/                          # Environment configuration
│   ├── environment.py              # Config management
│   └── __init__.py
├── tests/                          # Test implementations
│   ├── auth/                       # Authentication tests
│   ├── documents/                  # Document management tests
│   ├── templates/                  # Template tests
│   ├── contacts/                   # Contact tests
│   └── self_signing/              # Self-signing tests
├── api_tests/                      # API test collections
│   ├── WeSign_ULTIMATE_COMPLETE_API_TESTING_SUITE.json
│   └── WeSign API Environment.postman_environment.json
├── loadTesting/                    # K6 load test scenarios
│   ├── scenarios/                  # Test scenarios
│   └── config/                     # Load test config
├── test_files/                     # Test data files
├── reports/                        # Generated test reports
├── appsettings.*.json             # Environment configurations
└── requirements.txt               # Python dependencies
```

## 🔧 Test Execution

### Comprehensive Test Suite
```bash
# Run all tests in development environment
python scripts/run_comprehensive_tests.py --env dev

# Run specific test suites
python scripts/run_comprehensive_tests.py --suites e2e api --env staging

# Run tests in parallel (experimental)
python scripts/run_comprehensive_tests.py --parallel --env dev
```

### Individual Test Types

#### E2E Tests (Playwright)
```bash
# Run all E2E tests
python scripts/run_all_e2e_tests.py --env local

# Run smoke tests only
python scripts/run_all_e2e_tests.py --smoke --env local

# Run specific category
python scripts/run_all_e2e_tests.py --category auth --env local

# Run with verbose output
python scripts/run_all_e2e_tests.py --verbose --env local
```

#### API Tests
```bash
# Newman-based API tests (if Newman is installed)
python scripts/run_newman_tests.py --env dev --verbose

# Python-based API tests (fallback)
python scripts/run_api_tests_python.py --env dev

# Validate Postman collection
python scripts/run_newman_tests.py --validate
```

#### Load Tests (K6)
```bash
# Validate K6 setup
python scripts/run_load_tests.py --validate

# List available scenarios
python scripts/run_load_tests.py --list

# Run smoke tests
python scripts/run_load_tests.py --smoke --env dev

# Run specific scenario
python scripts/run_load_tests.py --category smoke --scenario basic --env dev
```

## 🌍 Environment Configuration

### Available Environments
- **dev**: Development environment (default)
- **staging**: Staging environment
- **production**: Production environment
- **local**: Local development environment

### Environment Files
- `appsettings.json` - Development (default)
- `appsettings.staging.json` - Staging
- `appsettings.production.json` - Production
- `appsettings.local.json` - Local

### Environment Validation
```bash
# Validate all environments
python scripts/validate_environments.py

# Validate specific environment
python scripts/validate_environments.py --details local

# List available environments
python scripts/validate_environments.py --list
```

## 📊 Test Results and Reporting

### Report Locations
- **E2E Reports**: `reports/` (HTML format)
- **API Reports**: `reports/api/` (HTML/JSON format)
- **Load Test Reports**: `reports/load/` (JSON format)
- **Comprehensive Reports**: `reports/` (JSON format)

### Report Types
- HTML reports with screenshots and videos
- JSON reports with detailed metrics
- Comprehensive summary reports
- Performance metrics and timings

## 🧪 Test Categories

### E2E Tests
- **Authentication**: Login, logout, security
- **Documents**: Upload, download, management
- **Templates**: Template creation and management
- **Contacts**: Contact management
- **Self-Signing**: Document signing workflows

### API Tests
- **Health Checks**: Service availability
- **Authentication**: Login/token endpoints
- **CRUD Operations**: Create, read, update, delete
- **File Operations**: Upload, download
- **Error Handling**: Invalid requests, edge cases

### Load Tests
- **Smoke Tests**: Basic connectivity (1 user, 30s)
- **Load Tests**: Normal usage patterns
- **Stress Tests**: High load scenarios
- **Spike Tests**: Sudden load increases
- **Soak Tests**: Extended duration testing
- **Volume Tests**: Breakpoint analysis

## ⚙️ Configuration

### Browser Settings
```json
{
  "browser_settings": {
    "headless": true,
    "viewport": {"width": 1920, "height": 1080},
    "slowMo": 100
  }
}
```

### Timeouts
```json
{
  "timeouts": {
    "default": 30000,
    "login": 15000,
    "upload": 60000,
    "signing": 90000
  }
}
```

### API Settings
```json
{
  "api_settings": {
    "base_url": "https://api.wesign.co.il",
    "timeout": 30000,
    "retry_attempts": 3
  }
}
```

## 🚨 Troubleshooting

### Common Issues

#### Playwright Browser Not Found
```bash
# Install browsers
playwright install --with-deps
```

#### Newman Not Found
```bash
# Install Newman globally
npm install -g newman
npm install -g newman-reporter-htmlextra
```

#### K6 Not Available
```bash
# Download and install K6 from:
# https://k6.io/docs/getting-started/installation/
```

#### Permission Errors
```bash
# Run with appropriate permissions
# Windows: Run as Administrator
# Linux/Mac: Use sudo if needed
```

### Test Failures

#### Check Environment Configuration
```bash
python scripts/validate_environments.py --details <environment>
```

#### Check Test Files
```bash
python scripts/run_documents_tests.py --check-files
```

#### Run Individual Tests
```bash
# Test specific functionality
python scripts/run_auth_tests.py --test test_login --env local --verbose
```

## 📈 Performance and Optimization

### Test Execution Times
- **Smoke Tests**: 2-3 minutes
- **E2E Suite**: 15-30 minutes
- **API Tests**: 5-10 minutes
- **Load Tests**: 10-20 minutes
- **Full Suite**: 30-60 minutes

### Optimization Tips
- Use `--smoke` for quick validation
- Run tests in parallel where possible
- Use headless browser mode for CI/CD
- Implement proper test data cleanup
- Use test isolation for reliability

## 🔄 CI/CD Integration

### GitHub Actions Example
```yaml
name: WeSign Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-python@v2
        with:
          python-version: '3.12'
      - run: pip install -r requirements.txt
      - run: playwright install --with-deps
      - run: python scripts/run_comprehensive_tests.py --smoke --env staging
```

### Jenkins Pipeline Example
```groovy
pipeline {
    agent any
    stages {
        stage('Setup') {
            steps {
                sh 'pip install -r requirements.txt'
                sh 'playwright install --with-deps'
            }
        }
        stage('Test') {
            steps {
                sh 'python scripts/run_comprehensive_tests.py --env staging'
            }
            post {
                always {
                    publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'reports',
                        reportFiles: '*.html',
                        reportName: 'WeSign Test Report'
                    ])
                }
            }
        }
    }
}
```

## 📝 Contributing

### Adding New Tests
1. Create test files in appropriate category directory
2. Follow existing naming conventions
3. Update test configuration if needed
4. Add to relevant test runner script

### Environment Configuration
1. Copy existing environment file
2. Update URLs and credentials
3. Validate with validation script
4. Test with smoke tests

### Best Practices
- Use descriptive test names
- Implement proper error handling
- Add comprehensive logging
- Follow page object pattern for E2E tests
- Use environment-specific configurations

## 📄 License

MIT License - See LICENSE file for details

## 📞 Support

For issues or questions:
1. Check troubleshooting section
2. Run validation scripts
3. Check generated reports
4. Contact WeSign QA team