# WeSign K6 Load Testing Suite

A comprehensive load testing framework for WeSign API using K6, designed to validate performance, scalability, and reliability under various load conditions.

## 🎯 Overview

This testing suite provides systematic performance validation across six key testing categories:

- **🚬 Smoke Tests**: Basic functionality validation with minimal load
- **📊 Load Tests**: Normal expected load conditions
- **🔥 Stress Tests**: Beyond normal capacity to find breaking points
- **⚡ Spike Tests**: Sudden traffic increases and recovery
- **🕰️ Soak Tests**: Extended duration for memory leak detection
- **📈 Volume Tests**: Incremental load increase to find performance breakpoints

## 📁 Project Structure

```
loadTesting/
├── scenarios/                 # Test scenarios by type
│   ├── smoke/                # Smoke test scenarios
│   │   ├── smoke-basic.js    # Basic functionality validation
│   │   └── smoke-auth.js     # Authentication system validation
│   ├── load/                 # Load test scenarios
│   │   ├── load-user-journey.js    # Complete user workflow
│   │   └── load-documents.js       # Document operations load
│   ├── stress/               # Stress test scenarios
│   │   └── stress-auth.js    # Authentication under stress
│   ├── spike/                # Spike test scenarios
│   │   ├── spike-login.js    # Login endpoint traffic spike
│   │   └── spike-documents.js      # Document operations spike
│   ├── soak/                 # Soak test scenarios
│   │   └── soak-endurance.js # Long-term endurance testing
│   └── volume/               # Volume test scenarios
│       └── breakpoint-analysis.js # Performance breakpoint analysis
├── utils/                    # Shared utilities and helpers
│   ├── api-client.js         # WeSign API client
│   ├── auth-helper.js        # Authentication session management
│   ├── common-checks.js      # Reusable validation functions
│   └── data-generator.js     # Test data generation utilities
├── config/                   # Configuration files
│   ├── environments.json     # Environment-specific settings
│   ├── test-profiles.json    # Test profile configurations
│   └── k6-config.js          # Configuration management module
├── reports/                  # Generated test reports (auto-created)
├── data/                     # Test data files (auto-created)
├── logs/                     # Execution logs (auto-created)
├── run-tests.sh              # Unix/Linux execution script
├── run-tests.bat             # Windows execution script
├── package.json              # NPM configuration and scripts
└── README.md                 # This documentation
```

## 🚀 Quick Start

### Prerequisites

1. **K6 Installation**
   ```bash
   # macOS
   brew install k6

   # Windows
   winget install k6

   # Linux
   sudo apt update && sudo apt install k6
   ```

2. **Verify Installation**
   ```bash
   k6 version
   ```

### Basic Usage

1. **Run smoke tests** (recommended first step):
   ```bash
   # Unix/Linux/macOS
   ./run-tests.sh smoke dev

   # Windows
   run-tests.bat smoke dev
   ```

2. **Run load tests**:
   ```bash
   # Unix/Linux/macOS
   ./run-tests.sh load dev

   # Windows
   run-tests.bat load dev
   ```

3. **Run complete test suite**:
   ```bash
   # Unix/Linux/macOS
   ./run-tests.sh all dev

   # Windows
   run-tests.bat all dev
   ```

## 🔧 Configuration

### Environment Configuration

Edit `config/environments.json` to configure different environments:

```json
{
  "environments": {
    "dev": {
      "baseUrl": "https://devtest.comda.co.il/userapi/ui/v3",
      "thresholds": {
        "http_req_duration": ["p(95)<5000"],
        "http_req_failed": ["rate<0.05"]
      }
    }
  }
}
```

### Test Profile Configuration

Customize test profiles in `config/test-profiles.json`:

```json
{
  "testProfiles": {
    "load": {
      "targetLoad": {
        "minVUs": 10,
        "maxVUs": 100,
        "duration": "10-30m"
      },
      "thresholds": {
        "http_req_duration": ["p(95)<4000"]
      }
    }
  }
}
```

## 📊 Test Types and Scenarios

### 🚬 Smoke Tests
**Purpose**: Validate core functionality with minimal load
- **Duration**: 1-3 minutes
- **Load**: 1-5 VUs
- **Frequency**: Every commit
- **Scenarios**:
  - `smoke-basic`: Basic API endpoint validation
  - `smoke-auth`: Authentication system validation

### 📊 Load Tests
**Purpose**: Normal expected load conditions
- **Duration**: 10-30 minutes
- **Load**: 10-100 VUs
- **Frequency**: Nightly
- **Scenarios**:
  - `load-user-journey`: Complete user workflow simulation
  - `load-documents`: Document operations load testing

### 🔥 Stress Tests
**Purpose**: Find breaking points beyond normal capacity
- **Duration**: 15-45 minutes
- **Load**: 50-500 VUs
- **Frequency**: Weekly
- **Scenarios**:
  - `stress-auth`: Authentication system under stress

### ⚡ Spike Tests
**Purpose**: Test response to sudden traffic increases
- **Duration**: 5-10 minutes
- **Load**: 1→300→1 VUs (rapid changes)
- **Frequency**: Weekly
- **Scenarios**:
  - `spike-login`: Login endpoint traffic spike
  - `spike-documents`: Document operations traffic spike

### 🕰️ Soak Tests
**Purpose**: Detect memory leaks and long-term degradation
- **Duration**: 2-8 hours
- **Load**: 20-50 VUs (sustained)
- **Frequency**: Monthly
- **Scenarios**:
  - `soak-endurance`: Long-term endurance testing

### 📈 Volume Tests
**Purpose**: Find performance breakpoints and optimal capacity
- **Duration**: 30-60 minutes
- **Load**: 10→500 VUs (incremental)
- **Frequency**: Monthly
- **Scenarios**:
  - `breakpoint-analysis`: Incremental load increase analysis

## 📈 Metrics and Thresholds

### Key Metrics Tracked

- **Response Time**: p(95), p(99) percentiles
- **Error Rate**: HTTP failures and application errors
- **Throughput**: Requests per second
- **Authentication Success Rate**: Login success percentage
- **Custom Metrics**: Business-specific performance indicators

### Environment-Specific Thresholds

| Environment | Response Time (p95) | Error Rate | Auth Success |
|-------------|-------------------|------------|--------------|
| Development | < 5000ms | < 5% | > 95% |
| Staging | < 3000ms | < 2% | > 98% |
| Production | < 2000ms | < 1% | > 99% |

## 🎛️ Execution Options

### Command Line Usage

```bash
# Basic syntax
./run-tests.sh [test-type] [environment] [report-format]

# Examples
./run-tests.sh smoke dev html
./run-tests.sh load staging json
./run-tests.sh stress prod html
./run-tests.sh all dev html
```

### Available Test Types
- `smoke`: Basic functionality tests
- `load`: Normal load testing
- `stress`: Stress testing
- `spike`: Traffic spike testing
- `soak`: Long-term endurance testing
- `volume`: Breakpoint analysis
- `all`: Complete test suite (excludes soak due to duration)

### Available Environments
- `dev`: Development environment
- `staging`: Staging environment
- `prod`: Production environment

### NPM Scripts

```bash
# Individual test execution
npm run test:smoke
npm run test:load
npm run test:stress

# Environment-specific full suites
npm run test:all:dev
npm run test:all:staging

# Utility commands
npm run clean:reports
npm run validate:config
```

## 📋 Reports and Analysis

### Generated Reports

After test execution, reports are generated in the `reports/` directory:

- **JSON Reports**: Detailed metrics data (`*-TIMESTAMP.json`)
- **Summary Reports**: Executive summaries (`*-summary-TIMESTAMP.json`)
- **HTML Reports**: Visual dashboards (`wesign-load-test-report-TIMESTAMP.html`)

### Key Report Sections

1. **Test Configuration**: Environment, duration, VU count
2. **Performance Metrics**: Response times, throughput, errors
3. **Threshold Analysis**: Pass/fail status for defined limits
4. **Timeline Analysis**: Performance trends over test duration
5. **Recommendations**: Actionable insights and next steps

### Analysis Guidelines

1. **Response Time Analysis**:
   - Monitor p95 and p99 percentiles
   - Look for performance degradation trends
   - Identify slow endpoints for optimization

2. **Error Rate Analysis**:
   - Investigate any error rates above thresholds
   - Categorize errors by type (timeouts, 5xx, authentication)
   - Correlate errors with load levels

3. **Capacity Planning**:
   - Use volume test results to determine optimal capacity
   - Identify performance breakpoints
   - Plan scaling strategies based on findings

## 🛠️ Troubleshooting

### Common Issues

1. **K6 Not Found**
   ```bash
   Error: k6 command not found
   Solution: Install K6 following the installation guide above
   ```

2. **Authentication Failures**
   ```bash
   Error: High authentication failure rate
   Solution: Verify credentials in config/environments.json
   ```

3. **High Error Rates**
   ```bash
   Error: HTTP error rate above threshold
   Solution: Check API availability and reduce load if necessary
   ```

4. **Permission Denied on Scripts**
   ```bash
   Error: Permission denied: ./run-tests.sh
   Solution: chmod +x run-tests.sh
   ```

### Debug Mode

Enable verbose logging by setting environment variables:

```bash
# Unix/Linux/macOS
K6_LOG_LEVEL=debug ./run-tests.sh smoke dev

# Windows
set K6_LOG_LEVEL=debug
run-tests.bat smoke dev
```

### Performance Optimization

1. **Reduce Data Generation**: Minimize complex test data in high-load scenarios
2. **Optimize Think Time**: Adjust sleep intervals based on test objectives
3. **Monitor System Resources**: Ensure the load generator has sufficient resources
4. **Network Considerations**: Run from appropriate network locations

## 🔒 Security and Best Practices

### Security Guidelines

1. **Credential Management**:
   - Never commit real credentials to version control
   - Use environment-specific test accounts
   - Rotate test credentials regularly

2. **Environment Protection**:
   - Limit production testing to minimal loads
   - Coordinate with operations team for production tests
   - Implement safety limits in configuration

3. **Data Privacy**:
   - Use synthetic test data only
   - Avoid testing with real user data
   - Clean up test data after execution

### Best Practices

1. **Test Strategy**:
   - Start with smoke tests before comprehensive testing
   - Gradually increase load to identify limits
   - Run tests during appropriate time windows

2. **Monitoring**:
   - Monitor system resources during tests
   - Watch for impact on other services
   - Set up alerts for threshold violations

3. **Maintenance**:
   - Review and update thresholds regularly
   - Keep test scenarios aligned with application changes
   - Archive historical reports for trend analysis

## 🔗 WeSign API Coverage

### Tested Modules

1. **Users**: Profile management, authentication
2. **Contacts**: Contact list operations, CRUD operations
3. **Templates**: Template browsing, creation, management
4. **Documents**: Upload, download, processing, management
5. **Distribution**: Distribution list management
6. **Links**: Link generation and management
7. **Configuration**: System configuration access
8. **Files**: File operations and storage
9. **Statistics**: Dashboard and reporting
10. **Tablets**: Tablet-specific operations

### Authentication Flow

The test suite uses JWT-based authentication with automatic token management:

1. **Login**: Email/password authentication
2. **Token Management**: Automatic refresh and session management
3. **Logout**: Proper session cleanup

## 📞 Support and Contributing

### Getting Help

1. **Documentation**: Review this README and inline code comments
2. **Configuration**: Check `config/` files for setup options
3. **Reports**: Analyze generated reports for insights
4. **Logs**: Review execution logs in `logs/` directory

### Contributing

1. **Test Scenarios**: Add new scenarios following existing patterns
2. **Utilities**: Enhance shared utilities for reusability
3. **Configuration**: Improve environment and profile management
4. **Documentation**: Update documentation for new features

### Version History

- **v1.0.0**: Initial release with comprehensive K6 testing suite
  - Complete test scenario coverage
  - Multi-environment support
  - Automated report generation
  - Cross-platform execution scripts

---

**Generated by WeSign QA Team** | Last Updated: $(date +"%Y-%m-%d")