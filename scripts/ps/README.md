# WeSign PowerShell Deployment Suite

A comprehensive, enterprise-grade PowerShell automation suite for deploying WeSign applications to Windows DevTest servers with IIS. This suite provides secure, reliable, and monitored deployment capabilities with built-in backup, rollback, and health validation features.

## 🚀 Features

- **Secure WinRM Communication**: SSL/TLS encrypted remote sessions
- **IIS Application Pool Management**: Graceful lifecycle management with dependency ordering
- **Automated Backup & Rollback**: Timestamped backups with automatic rollback on failure
- **Configuration Transformation**: Environment-specific config transformations with validation
- **Comprehensive Smoke Testing**: Multi-layer health validation with scoring
- **QA Intelligence Integration**: Real-time deployment status reporting
- **Enterprise Security**: Credential encryption, audit logging, permission validation
- **Windows Optimizations**: Native Windows service integration and error handling

## 📋 Prerequisites

### Local Machine Requirements
- Windows 10/11 or Windows Server 2016+
- PowerShell 5.1 or later
- WebAdministration PowerShell module
- Administrative privileges
- Network connectivity to target servers

### Target Server Requirements
- Windows Server 2016+ with IIS 10+
- WinRM configured for HTTPS (port 5986)
- .NET Framework 4.7.2+
- SQL Server connectivity (if using database features)
- Appropriate firewall configurations

### Network Requirements
- HTTPS (5986) access from deployment machine to target server
- HTTP/HTTPS access for health checks
- Database server connectivity (if applicable)
- QA Intelligence backend access (optional)

## 🏗️ Architecture

### Core Modules

1. **winrm_session.ps1** - Secure WinRM session management
2. **iis_pools.ps1** - IIS Application Pool lifecycle management
3. **deploy_wesign.ps1** - Main deployment engine with backup/rollback
4. **smoke_tests.ps1** - Comprehensive health validation suite
5. **config_transform.ps1** - Environment-specific configuration management
6. **Deploy-WeSign-Master.ps1** - Master orchestration script

### Application Pools Managed
- UserApi
- SignerApi
- ManagementApi
- DefaultAppPool
- PdfConvertorService

### Deployment Paths
- **Deploy Directory**: `C:\inetpub\WeSign`
- **Staging Directory**: `C:\deploy`
- **Backup Root**: `C:\backup\WeSign\YYYYMMDD_HHMMSS`
- **Temp Extract**: `C:\temp\wesign_deploy`

## 🚀 Quick Start

### Basic Deployment
```powershell
.\Deploy-WeSign-Master.ps1 -ComputerName "devtest.contoso.com" -Username "CONTOSO\deployuser" -ArtifactPath "\\build\WeSign_v1.2.3.zip"
```

### Advanced Deployment
```powershell
.\Deploy-WeSign-Master.ps1 `
    -ComputerName "devtest" `
    -CredentialFile ".\creds.xml" `
    -ArtifactPath "C:\Artifacts\WeSign_latest.zip" `
    -Environment "DevTest" `
    -QAIntelligenceUrl "http://localhost:8082"
```

### Production Deployment
```powershell
.\Deploy-WeSign-Master.ps1 `
    -ComputerName "prod-web01.contoso.com" `
    -Username "CONTOSO\proddeployuser" `
    -ArtifactPath "\\release\WeSign_v2.0.0_Release.zip" `
    -Environment "Production" `
    -QAIntelligenceUrl "https://qa-intelligence.contoso.com"
```

## 🔧 Configuration

### Environment Settings

The deployment suite supports three predefined environments with automatic configuration transformation:

#### DevTest Environment
- Database: `devtest-sql.contoso.com/WeSign_DevTest`
- Redis: `devtest-redis.contoso.com:6379`
- Debug Mode: Enabled
- Detailed Errors: Enabled
- Log Level: Debug

#### Staging Environment
- Database: `staging-sql.contoso.com/WeSign_Staging`
- Redis: `staging-redis.contoso.com:6379`
- Debug Mode: Disabled
- Detailed Errors: Disabled
- Log Level: Information

#### Production Environment
- Database: `prod-sql.contoso.com/WeSign_Production`
- Redis: `prod-redis.contoso.com:6379`
- Debug Mode: Disabled
- Detailed Errors: Disabled
- Log Level: Warning
- Enhanced Security Headers

### Health Check Endpoints

The smoke testing module validates these endpoints:

- `http://[server]/health` - Main application health
- `http://[server]/WeSignManagement/health` - Management API health
- `http://[server]/api/user/status` - User API status
- `http://[server]/api/signer/status` - Signer API status
- `http://[server]/api/pdf/status` - PDF Converter status
- `http://[server]/Content/css/site.css` - Static content accessibility

## 📊 Monitoring & Reporting

### QA Intelligence Integration

The deployment suite integrates with the QA Intelligence platform to provide:

- Real-time deployment status updates
- Step-by-step progress tracking
- Performance metrics collection
- Error reporting and alerting
- Historical deployment analytics

### Logging Capabilities

- **Windows Event Log**: Application log entries with structured data
- **File Logging**: Rotating daily log files in `C:\Logs\WeSignDeployment`
- **Console Output**: Color-coded real-time status updates
- **Deployment Reports**: JSON and HTML reports for smoke tests

### Smoke Test Scoring

The smoke testing engine uses a weighted scoring system:

- **Critical Tests**: 10 points each (app pools, database, required endpoints)
- **Non-Critical Tests**: 3 points each (optional endpoints, service checks)
- **Passing Score**: 80% (configurable)
- **Automatic Rollback**: Triggered on critical test failures

## 🔒 Security Features

### Credential Management
- Secure credential storage using PowerShell's Export-Clixml
- Windows Credential Manager integration
- No plaintext passwords in logs or memory dumps
- Domain authentication with Kerberos support

### Network Security
- WinRM over HTTPS (port 5986) with certificate validation
- TLS 1.2+ enforcement for all communications
- Certificate chain validation (configurable)
- Network timeout and retry mechanisms

### Configuration Security
- Sensitive data redaction in logs
- Security header injection for web.config
- Debug mode disabling in production
- Custom error page enforcement

### Audit Trail
- Complete deployment step logging
- File system permission validation
- Service account verification
- Configuration change tracking

## 🔄 Backup & Recovery

### Backup Strategy
- **Automatic Backups**: Created before every deployment
- **Timestamped Storage**: `C:\backup\WeSign\YYYYMMDD_HHMMSS`
- **Metadata Tracking**: JSON metadata files with deployment context
- **Integrity Validation**: Robocopy with verification and retry logic

### Rollback Capabilities
- **Automatic Rollback**: Triggered on deployment failures
- **Manual Rollback**: Support for specific backup versions
- **Emergency Backup**: Created during rollback operations
- **Service Coordination**: Proper app pool restart sequencing

### Recovery Scenarios
- **Deployment Failure**: Automatic rollback to previous version
- **Smoke Test Failure**: Optional rollback based on scoring
- **Network Interruption**: Resume capability with state tracking
- **Service Failure**: Emergency app pool restart procedures

## 📱 Usage Examples

### Individual Module Usage

#### WinRM Session Management
```powershell
# Import the module
. .\winrm_session.ps1

# Test connectivity
$testResult = Test-WinRMConnectivity -ComputerName "devtest" -Credential $creds

# Create secure session
$session = New-SecureWinRMSession -ComputerName "devtest" -Credential $creds

# Clean up
Remove-SecureWinRMSession -Session $session
```

#### IIS App Pool Management
```powershell
# Import the module
. .\iis_pools.ps1

# Stop all WeSign app pools
$stopResult = Stop-WeSignAppPools -Session $session

# Start with health checks
$startResult = Start-WeSignAppPools -Session $session -HealthCheckUrl "http://devtest"

# Get health report
$healthReport = Get-WeSignPoolsHealthReport -Session $session
```

#### Smoke Testing
```powershell
# Import the module
. .\smoke_tests.ps1

# Run comprehensive smoke tests
$smokeResult = Invoke-WeSignSmokeTests -BaseUrl "http://devtest" -Environment "DevTest" -ExportReport

# Check results
if ($smokeResult.OverallSuccess) {
    Write-Host "All smoke tests passed!" -ForegroundColor Green
} else {
    Write-Host "Smoke tests failed. Score: $($smokeResult.Report.Scoring.ScorePercentage)%" -ForegroundColor Red
}
```

#### Configuration Transformation
```powershell
# Import the module
. .\config_transform.ps1

# Transform configuration for environment
$transformResult = Transform-WeSignConfig -SourcePath "C:\deploy" -Environment "DevTest"

# Validate configuration
$validationResult = Validate-ConfigurationIntegrity -ConfigPath "C:\deploy\web.config"
```

### Error Handling Examples

#### Deployment with Retry Logic
```powershell
$maxAttempts = 3
$attempt = 0

do {
    $attempt++
    try {
        Write-Host "Deployment attempt $attempt of $maxAttempts"

        .\Deploy-WeSign-Master.ps1 `
            -ComputerName "devtest" `
            -CredentialFile ".\creds.xml" `
            -ArtifactPath "\\build\WeSign_latest.zip" `
            -Environment "DevTest"

        Write-Host "Deployment successful!" -ForegroundColor Green
        break
    }
    catch {
        Write-Host "Deployment attempt $attempt failed: $($_.Exception.Message)" -ForegroundColor Yellow

        if ($attempt -eq $maxAttempts) {
            Write-Host "All deployment attempts failed!" -ForegroundColor Red
            throw
        }

        Write-Host "Waiting 60 seconds before retry..."
        Start-Sleep -Seconds 60
    }
} while ($attempt -lt $maxAttempts)
```

#### Conditional Deployment
```powershell
# Only deploy if smoke tests pass on current version
$currentSmokeResult = Invoke-WeSignSmokeTests -BaseUrl "http://devtest" -Environment "DevTest"

if ($currentSmokeResult.OverallSuccess) {
    Write-Host "Current version healthy, proceeding with deployment"

    .\Deploy-WeSign-Master.ps1 `
        -ComputerName "devtest" `
        -ArtifactPath "\\build\WeSign_new.zip" `
        -Environment "DevTest"
} else {
    Write-Host "Current version unhealthy, deployment aborted" -ForegroundColor Red
    exit 1
}
```

## 🛠️ Troubleshooting

### Common Issues

#### WinRM Connection Issues
```
Error: "The WinRM client cannot process the request"
Solutions:
1. Verify WinRM is configured for HTTPS on target server
2. Check firewall rules for port 5986
3. Validate SSL certificate on target server
4. Ensure proper authentication configuration
```

#### Application Pool Issues
```
Error: "Application pool failed to start within timeout"
Solutions:
1. Check IIS logs for startup errors
2. Verify .NET Framework version compatibility
3. Check file system permissions
4. Review web.config for syntax errors
```

#### Smoke Test Failures
```
Error: "Smoke tests failed with score below threshold"
Solutions:
1. Review individual test failures in the report
2. Check application logs for runtime errors
3. Verify database connectivity
4. Test endpoints manually with browser/Postman
```

#### Configuration Issues
```
Error: "Configuration transformation failed"
Solutions:
1. Validate source web.config XML syntax
2. Check transform file format
3. Verify environment-specific settings
4. Review file permissions
```

### Diagnostic Commands

#### Check WinRM Configuration
```powershell
# On target server
winrm get winrm/config
winrm enumerate winrm/config/listener

# Test from deployment machine
Test-WsMan -ComputerName "devtest" -UseSSL -Port 5986
```

#### Validate IIS Configuration
```powershell
# Check application pools
Get-IISAppPool | Format-Table Name, State, ProcessModel

# Check websites
Get-IISWebsite | Format-Table Name, State, PhysicalPath

# Check bindings
Get-IISWebsite | Get-IISSiteBinding
```

#### Network Connectivity Tests
```powershell
# Test basic connectivity
Test-Connection -ComputerName "devtest" -Count 4

# Test specific ports
Test-NetConnection -ComputerName "devtest" -Port 5986
Test-NetConnection -ComputerName "devtest" -Port 80
Test-NetConnection -ComputerName "devtest" -Port 443
```

### Log Analysis

#### PowerShell Transcript Logging
```powershell
# Enable transcript logging for detailed debugging
Start-Transcript -Path "C:\Logs\deployment-transcript.log"

# Run deployment with full logging
.\Deploy-WeSign-Master.ps1 -ComputerName "devtest" -Verbose -Debug

# Stop transcript
Stop-Transcript
```

#### Windows Event Log Queries
```powershell
# Get WeSign deployment events
Get-WinEvent -FilterHashtable @{LogName='Application'; ProviderName='WeSignDeployment'} -MaxEvents 50

# Get IIS events
Get-WinEvent -FilterHashtable @{LogName='System'; ProviderName='Microsoft-Windows-WAS'} -MaxEvents 20
```

## 🤝 Contributing

### Code Standards
- Follow PowerShell best practices and PSScriptAnalyzer rules
- Use approved verbs for function naming
- Include comprehensive help documentation
- Implement proper error handling with try/catch/finally
- Use Write-DeploymentLog for all logging operations

### Testing Guidelines
- Test on multiple Windows Server versions
- Validate with different PowerShell versions (5.1, 7.x)
- Include both positive and negative test scenarios
- Test network interruption and recovery scenarios
- Validate security features and credential handling

### Security Review
- No hardcoded credentials or connection strings
- Proper credential encryption and secure storage
- Network communication over encrypted channels
- Input validation and sanitization
- Audit trail and logging compliance

## 📄 License

Copyright (c) 2025 QA Intelligence Platform. All rights reserved.

This software is proprietary and confidential. Unauthorized copying, distribution, or modification is strictly prohibited.

## 📞 Support

For issues, questions, or feature requests:

- **Email**: qa-intelligence@company.com
- **Documentation**: Internal wiki at wiki.company.com/qa-intelligence
- **Issue Tracking**: Internal JIRA project QAI-PS
- **Emergency Contact**: On-call engineering team

---

**Last Updated**: 2025-09-26
**Version**: 1.0
**Maintainer**: QA Intelligence Platform Team