# WeSign CI/CD Python Utilities

Production-grade Python utilities for WeSign CI/CD pipeline configuration management, testing, and reporting.

## Overview

This collection of utilities provides enterprise-grade reliability for CI/CD operations with seamless integration into the broader WeSign deployment pipeline. Each utility is designed to handle sensitive configuration data securely, provide robust error handling, and integrate with the QA Intelligence backend.

## Utilities

### 1. Configuration Transformer (`appsettings_patch.py`)

Robust JSON configuration transformer for WeSign deployment automation.

**Features:**
- Environment-specific settings application (DevTest, Staging, Production, Local)
- Secure credential injection from environment variables
- Connection string transformation and validation
- Idempotent operations with validation
- Automatic backup and rollback capabilities
- Credential masking in all log outputs

**Usage:**
```bash
# Transform configuration for DevTest environment
py appsettings_patch.py -c appsettings.json -e DevTest

# Validate configuration only
py appsettings_patch.py -c appsettings.json -e Production --validate-only

# Dry run to see what changes would be made
py appsettings_patch.py -c config.json -e Staging --dry-run

# Rollback to previous version
py appsettings_patch.py -c appsettings.json -e DevTest --rollback
```

**Environment Variables:**
- `WESIGN_DEVTEST_CONNECTION_STRING` - DevTest database connection
- `WESIGN_STAGING_CONNECTION_STRING` - Staging database connection
- `WESIGN_PROD_CONNECTION_STRING` - Production database connection
- `WESIGN_LOCAL_CONNECTION_STRING` - Local database connection
- `WESIGN_JWT_SECRET` - JWT signing secret

### 2. Smoke Test Suite (`smoke_check.py`)

Comprehensive HTTP endpoint testing with retry logic and health check validation.

**Features:**
- HTTP/HTTPS endpoint testing with custom headers
- Database connectivity validation (SQLite, PostgreSQL, SQL Server)
- Service dependency mapping and validation
- Retry mechanisms with exponential backoff
- Performance baseline validation
- Real-time progress reporting

**Usage:**
```bash
# Run all smoke tests
py smoke_check.py --config smoke_config.json --output results.json

# Run only endpoint tests
py smoke_check.py --environment DevTest --endpoints-only

# Run with custom retry settings
py smoke_check.py --verbose --retry-count 5 --timeout 30
```

**Configuration Format:**
```json
{
  "endpoints": [
    {
      "name": "health_check",
      "url": "https://devtest.comda.co.il/health",
      "method": "GET",
      "expected_status": 200,
      "validation_rules": {
        "response_contains": ["status", "timestamp"],
        "json_structure": true
      }
    }
  ],
  "performance_thresholds": {
    "endpoint_response_time_ms": 3000
  }
}
```

### 3. Report Aggregator (`report_aggregator.py`)

Collect and merge TRX, Newman HTML, Playwright HTML reports into unified JSON summary.

**Features:**
- Support for multiple report formats (TRX, Newman, Playwright)
- Weighted "Run Score" calculation (20% build, 20% smoke, 30% API, 30% E2E)
- Artifact management and archival
- Integration with QA Intelligence backend
- Comprehensive scoring algorithm with penalties

**Usage:**
```bash
# Aggregate reports from workspace
py report_aggregator.py --workspace ./test-results --output summary.json

# Create archive of all artifacts
py report_aggregator.py --workspace ./build --archive results.zip

# Report to QA Intelligence backend
py report_aggregator.py --config aggregator.json --qa-intelligence
```

**Scoring Algorithm:**
- **Build Score (20%)**: Compilation success and basic validation
- **Smoke Score (20%)**: Connectivity and basic health checks
- **API Score (30%)**: Newman/API test results
- **E2E Score (30%)**: Playwright/UI test results
- **Penalties**: 10-point deduction per missing component

### 4. Jenkins Integration Client (`jenkins_helper.py`)

Jenkins API wrapper for build management and artifact processing.

**Features:**
- Complete Jenkins REST API integration
- Build triggering with parameter support
- Artifact download and processing
- Console log parsing and analysis
- Build status monitoring and webhook notifications
- Comprehensive error handling and retry logic

**Usage:**
```bash
# Generate build report
py jenkins_helper.py --url http://jenkins:8080 --job "WeSign-Main" --build-number 42 --report

# Download all artifacts
py jenkins_helper.py --url http://jenkins:8080 --job "WeSign-Main" --download-artifacts ./artifacts

# Trigger build and wait for completion
py jenkins_helper.py --url http://jenkins:8080 --job "WeSign-Main" --trigger --wait --webhook http://qa.example.com/webhook
```

**Environment Variables:**
- `JENKINS_USERNAME` - Jenkins username
- `JENKINS_TOKEN` - Jenkins API token

### 5. Environment Validator (`preflight_check.py`)

Comprehensive pre-deployment environment verification.

**Features:**
- Network connectivity validation (ICMP, TCP, HTTP/HTTPS)
- WinRM session testing
- Disk space verification with configurable thresholds
- Windows service availability checks
- Software dependency validation with version checking
- System information collection

**Usage:**
```bash
# Run all validations
py preflight_check.py --config validation.json --output results.json

# Run specific validation categories
py preflight_check.py --network-only --verbose

# System information only
py preflight_check.py --system-info --output system.json
```

**Configuration Example:**
```json
{
  "network_endpoints": [
    {
      "name": "wesign_devtest",
      "host": "devtest.comda.co.il",
      "port": 443,
      "protocol": "https"
    }
  ],
  "software_dependencies": [
    {
      "name": "node",
      "executable": "node",
      "minimum_version": "18.0.0"
    }
  ],
  "disk_requirements": {
    "minimum_free_gb": 10.0,
    "minimum_free_percent": 15.0
  }
}
```

## Installation

1. **Install Python dependencies:**
```bash
cd scripts
pip install -r requirements.txt
```

2. **Set up environment variables:**
```bash
# Copy and customize environment template
cp .env.example .env
# Edit .env with your configuration
```

3. **Verify installation:**
```bash
py preflight_check.py --system-info
```

## Security Considerations

- **Credential Management**: All secrets are loaded from environment variables
- **Credential Masking**: Sensitive information is automatically masked in logs
- **Input Validation**: Comprehensive validation and sanitization of all inputs
- **Certificate Validation**: HTTPS endpoints use proper certificate validation
- **Secure Temporary Files**: Temporary files are handled securely

## Integration with QA Intelligence

All utilities can report results to the QA Intelligence backend:

**Environment Variables:**
- `QA_INTELLIGENCE_API_KEY` - API key for authentication
- `QA_INTELLIGENCE_BASE_URL` - Backend URL (default: http://localhost:8082)

**Webhook Format:**
```json
{
  "event_type": "test_results",
  "run_id": "run_20240101_120000",
  "environment": "DevTest",
  "scores": {
    "build": 95.0,
    "smoke": 100.0,
    "api": 87.5,
    "e2e": 92.3,
    "overall": 92.1
  }
}
```

## Performance Thresholds

Modern 3-second performance standards:
- **Endpoint Response Time**: 3000ms (configurable)
- **Database Query Time**: 1000ms (configurable)
- **Service Connection Time**: 1000ms (configurable)

## Error Handling

All utilities implement comprehensive error handling:

- **Structured Logging**: Timestamps, log levels, and context
- **Exception Handling**: Detailed error messages with context
- **Exit Codes**: Standard exit codes for shell integration
- **Retry Mechanisms**: Configurable retry with exponential backoff
- **Graceful Degradation**: Continue operation when non-critical components fail

## Testing

Run the comprehensive test suite:

```bash
# Run all tests
cd scripts
python -m pytest tests/ -v

# Run specific test file
python -m pytest tests/test_appsettings_patch.py -v

# Run with coverage
python -m pytest tests/ --cov=. --cov-report=html
```

## Windows Compatibility

All utilities are designed for Windows environments:

- **Path Handling**: Uses `pathlib` for cross-platform compatibility
- **Windows Services**: Direct WMI integration for service management
- **PowerShell Integration**: Seamless PowerShell script execution
- **Windows Registry**: Registry access for configuration discovery
- **Event Logging**: Windows Event Log integration

## Command Line Examples

### Complete CI/CD Pipeline Usage

```bash
# 1. Pre-flight environment validation
py preflight_check.py --config validation.json --output preflight.json

# 2. Transform configuration for target environment
py appsettings_patch.py -c appsettings.json -e Production --output-summary transform.json

# 3. Run smoke tests
py smoke_check.py --environment Production --output smoke.json

# 4. Trigger Jenkins build
py jenkins_helper.py --url http://jenkins:8080 --job "WeSign-Deploy" --trigger --parameters '{"ENVIRONMENT":"Production"}' --wait

# 5. Aggregate all test results
py report_aggregator.py --workspace ./artifacts --output final-report.json --qa-intelligence
```

### Development and Debugging

```bash
# Verbose logging for troubleshooting
py smoke_check.py --verbose --fail-fast

# Dry run configuration changes
py appsettings_patch.py -c appsettings.json -e DevTest --dry-run --verbose

# Validate only without making changes
py appsettings_patch.py -c appsettings.json -e Production --validate-only
```

## Configuration Templates

### Smoke Test Configuration (`smoke_config.json`)
```json
{
  "endpoints": [
    {
      "name": "health_check",
      "url": "https://devtest.comda.co.il/health",
      "method": "GET",
      "expected_status": 200,
      "timeout_seconds": 5,
      "validation_rules": {
        "response_contains": ["status", "timestamp"],
        "json_structure": true
      }
    }
  ],
  "databases": [
    {
      "name": "wesign_main",
      "connection_string": "Data Source=wesign.db",
      "db_type": "sqlite",
      "test_query": "SELECT COUNT(*) FROM sqlite_master WHERE type='table'"
    }
  ],
  "performance_thresholds": {
    "endpoint_response_time_ms": 3000,
    "database_query_time_ms": 1000
  }
}
```

### Report Aggregator Configuration (`aggregator.json`)
```json
{
  "qa_intelligence": {
    "enabled": true,
    "base_url": "http://localhost:8082",
    "api_key": "${QA_INTELLIGENCE_API_KEY}"
  },
  "artifact_patterns": [
    "*.trx",
    "*newman*.html",
    "*playwright*.html",
    "screenshots/*.png",
    "videos/*.mp4"
  ],
  "scoring_weights": {
    "build": 0.20,
    "smoke": 0.20,
    "api": 0.30,
    "e2e": 0.30
  }
}
```

## Troubleshooting

### Common Issues

1. **Import Errors**: Ensure all dependencies are installed with `pip install -r requirements.txt`

2. **Permission Errors**: Run as administrator for Windows service and registry access

3. **Network Timeouts**: Increase timeout values in configuration files

4. **Certificate Errors**: For development environments, some utilities disable SSL verification

5. **Database Connection Issues**: Verify connection strings and database accessibility

### Debug Mode

Enable verbose logging for all utilities:
```bash
py <utility_name>.py --verbose
```

## Contributing

1. Follow the established code style and patterns
2. Add comprehensive unit tests for new functionality
3. Update documentation for any changes
4. Ensure Windows compatibility
5. Test with various WeSign environments

## License

This software is part of the WeSign QA Intelligence system. All rights reserved.

---

*Generated by QA Intelligence System v2.0*