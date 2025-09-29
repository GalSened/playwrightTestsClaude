#Requires -Version 5.1

<#
.SYNOPSIS
    WeSign Smoke Testing Suite

.DESCRIPTION
    Comprehensive smoke testing for WeSign deployment with health checks,
    endpoint validation, database connectivity, and service dependency verification.
    Generates detailed reports with scoring and retry logic.

.PARAMETER BaseUrl
    Base URL for WeSign application (e.g., http://devtest)

.PARAMETER Environment
    Target environment for testing (DevTest, Staging, Production)

.PARAMETER TestTimeout
    Timeout for individual tests in seconds (default: 30)

.PARAMETER RetryAttempts
    Number of retry attempts for failed tests (default: 3)

.EXAMPLE
    Invoke-WeSignSmokeTests -BaseUrl "http://devtest" -Environment "DevTest"

.EXAMPLE
    $results = Test-WeSignEndpoints -BaseUrl "http://devtest" -RetryAttempts 5

.NOTES
    Author: QA Intelligence Platform
    Version: 1.0
    Created: 2025-09-26
#>

[CmdletBinding()]
param()

# Import WinRM Session Management for logging
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $scriptRoot "winrm_session.ps1")

# Global smoke test configuration
$Global:SmokeTestConfig = @{
    Endpoints = @{
        'HealthCheck' = @{
            Url = '/health'
            Method = 'GET'
            ExpectedStatus = 200
            ExpectedContent = 'healthy'
            Timeout = 30
            Critical = $true
            Description = 'Main application health check'
        }
        'ManagementHealth' = @{
            Url = '/WeSignManagement/health'
            Method = 'GET'
            ExpectedStatus = 200
            ExpectedContent = ''
            Timeout = 30
            Critical = $true
            Description = 'WeSign Management API health check'
        }
        'UserApiStatus' = @{
            Url = '/api/user/status'
            Method = 'GET'
            ExpectedStatus = 200
            ExpectedContent = ''
            Timeout = 30
            Critical = $false
            Description = 'User API status endpoint'
        }
        'SignerApiStatus' = @{
            Url = '/api/signer/status'
            Method = 'GET'
            ExpectedStatus = 200
            ExpectedContent = ''
            Timeout = 30
            Critical = $false
            Description = 'Signer API status endpoint'
        }
        'PdfConverterStatus' = @{
            Url = '/api/pdf/status'
            Method = 'GET'
            ExpectedStatus = 200
            ExpectedContent = ''
            Timeout = 45
            Critical = $false
            Description = 'PDF Converter service status'
        }
        'StaticContent' = @{
            Url = '/Content/css/site.css'
            Method = 'GET'
            ExpectedStatus = 200
            ExpectedContent = 'css'
            Timeout = 15
            Critical = $false
            Description = 'Static content accessibility'
        }
    }
    DatabaseTests = @{
        'ConnectionTest' = @{
            Query = 'SELECT 1 as TestValue'
            Timeout = 30
            Critical = $true
            Description = 'Database connectivity test'
        }
        'UserTableTest' = @{
            Query = 'SELECT TOP 1 UserId FROM Users'
            Timeout = 30
            Critical = $false
            Description = 'User table accessibility test'
        }
        'DocumentTableTest' = @{
            Query = 'SELECT TOP 1 DocumentId FROM Documents'
            Timeout = 30
            Critical = $false
            Description = 'Document table accessibility test'
        }
    }
    ServiceDependencies = @{
        'MSSQL' = @{
            ServiceName = 'MSSQLSERVER'
            Required = $true
            Description = 'SQL Server Database Engine'
        }
        'IIS' = @{
            ServiceName = 'W3SVC'
            Required = $true
            Description = 'IIS World Wide Web Publishing Service'
        }
        'WAS' = @{
            ServiceName = 'WAS'
            Required = $true
            Description = 'Windows Process Activation Service'
        }
    }
    Scoring = @{
        CriticalWeight = 10
        NonCriticalWeight = 3
        PassingScore = 80  # Percentage
    }
    Defaults = @{
        TestTimeout = 30
        RetryAttempts = 3
        RetryDelay = 5
    }
}

function Test-WeSignEndpoints {
    <#
    .SYNOPSIS
        Tests all WeSign HTTP endpoints with retry logic
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $false)]
        [System.Management.Automation.Runspaces.PSSession]$Session,

        [Parameter(Mandatory = $true)]
        [string]$BaseUrl,

        [Parameter(Mandatory = $false)]
        [int]$TestTimeout = $Global:SmokeTestConfig.Defaults.TestTimeout,

        [Parameter(Mandatory = $false)]
        [int]$RetryAttempts = $Global:SmokeTestConfig.Defaults.RetryAttempts
    )

    Write-DeploymentLog "Starting endpoint tests for: $BaseUrl"

    $scriptBlock = {
        param($baseUrl, $endpoints, $testTimeout, $retryAttempts, $retryDelay)

        $results = @{}
        $startTime = Get-Date

        foreach ($endpointName in $endpoints.Keys) {
            $endpoint = $endpoints[$endpointName]
            $fullUrl = $baseUrl.TrimEnd('/') + $endpoint.Url

            Write-Host "Testing endpoint: $endpointName ($fullUrl)"

            $testResult = @{
                EndpointName = $endpointName
                Url = $fullUrl
                Description = $endpoint.Description
                Critical = $endpoint.Critical
                Success = $false
                StatusCode = $null
                ResponseTime = $null
                Error = $null
                Attempts = 0
                LastAttemptTime = $null
            }

            $attempt = 0
            $success = $false

            do {
                $attempt++
                $testResult.Attempts = $attempt
                $testResult.LastAttemptTime = Get-Date

                try {
                    Write-Host "  Attempt $attempt/$retryAttempts..."

                    $requestStart = Get-Date

                    # Create HTTP request
                    $request = [System.Net.HttpWebRequest]::Create($fullUrl)
                    $request.Method = $endpoint.Method
                    $request.Timeout = $testTimeout * 1000
                    $request.UserAgent = "WeSign-SmokeTest/1.0"

                    # Add headers if needed
                    $request.Headers.Add("X-Test-Request", "SmokeTest")

                    # Execute request
                    $response = $request.GetResponse()
                    $responseTime = (Get-Date) - $requestStart

                    $testResult.StatusCode = [int]$response.StatusCode
                    $testResult.ResponseTime = $responseTime.TotalMilliseconds

                    # Read response content if needed for validation
                    $responseContent = ""
                    if ($endpoint.ExpectedContent) {
                        $stream = $response.GetResponseStream()
                        $reader = New-Object System.IO.StreamReader($stream)
                        $responseContent = $reader.ReadToEnd()
                        $reader.Close()
                    }

                    $response.Close()

                    # Validate response
                    $statusValid = $testResult.StatusCode -eq $endpoint.ExpectedStatus
                    $contentValid = [string]::IsNullOrEmpty($endpoint.ExpectedContent) -or $responseContent.Contains($endpoint.ExpectedContent)

                    if ($statusValid -and $contentValid) {
                        $testResult.Success = $true
                        $success = $true
                        Write-Host "  SUCCESS: $endpointName (Status: $($testResult.StatusCode), Time: $([math]::Round($testResult.ResponseTime, 2))ms)"
                    }
                    else {
                        $validationError = ""
                        if (-not $statusValid) { $validationError += "Expected status $($endpoint.ExpectedStatus), got $($testResult.StatusCode). " }
                        if (-not $contentValid) { $validationError += "Expected content '$($endpoint.ExpectedContent)' not found. " }

                        throw "Validation failed: $validationError"
                    }
                }
                catch [System.Net.WebException] {
                    $webException = $_.Exception
                    if ($webException.Response) {
                        $testResult.StatusCode = [int]$webException.Response.StatusCode
                        $testResult.Error = "HTTP $($testResult.StatusCode): $($webException.Message)"
                    }
                    else {
                        $testResult.Error = "Network error: $($webException.Message)"
                    }

                    Write-Host "  FAILED: $endpointName - $($testResult.Error)"
                }
                catch {
                    $testResult.Error = "Test error: $($_.Exception.Message)"
                    Write-Host "  FAILED: $endpointName - $($testResult.Error)"
                }

                if (-not $success -and $attempt -lt $retryAttempts) {
                    Write-Host "  Waiting $retryDelay seconds before retry..."
                    Start-Sleep -Seconds $retryDelay
                }

            } while (-not $success -and $attempt -lt $retryAttempts)

            $results[$endpointName] = $testResult
        }

        $endTime = Get-Date
        $totalDuration = $endTime - $startTime

        return @{
            Results = $results
            Summary = @{
                TotalTests = $results.Count
                PassedTests = ($results.Values | Where-Object { $_.Success }).Count
                FailedTests = ($results.Values | Where-Object { -not $_.Success }).Count
                CriticalFailures = ($results.Values | Where-Object { -not $_.Success -and $_.Critical }).Count
                Duration = $totalDuration
            }
        }
    }

    try {
        if ($Session) {
            $result = Invoke-Command -Session $Session -ScriptBlock $scriptBlock -ArgumentList $BaseUrl, $Global:SmokeTestConfig.Endpoints, $TestTimeout, $RetryAttempts, $Global:SmokeTestConfig.Defaults.RetryDelay -ErrorAction Stop
        }
        else {
            $result = & $scriptBlock $BaseUrl $Global:SmokeTestConfig.Endpoints $TestTimeout $RetryAttempts $Global:SmokeTestConfig.Defaults.RetryDelay
        }

        Write-DeploymentLog "Endpoint tests completed: $($result.Summary.PassedTests)/$($result.Summary.TotalTests) passed"

        if ($result.Summary.CriticalFailures -gt 0) {
            Write-DeploymentLog "CRITICAL: $($result.Summary.CriticalFailures) critical endpoint(s) failed" -Level Error
        }

        return $result
    }
    catch {
        Write-DeploymentLog "Endpoint testing failed: $($_.Exception.Message)" -Level Error
        throw
    }
}

function Test-DatabaseConnectivity {
    <#
    .SYNOPSIS
        Tests database connectivity and basic query execution
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $false)]
        [System.Management.Automation.Runspaces.PSSession]$Session,

        [Parameter(Mandatory = $false)]
        [string]$ConnectionString = "",

        [Parameter(Mandatory = $false)]
        [int]$TestTimeout = $Global:SmokeTestConfig.Defaults.TestTimeout
    )

    Write-DeploymentLog "Starting database connectivity tests"

    $scriptBlock = {
        param($connectionString, $dbTests, $testTimeout)

        $results = @{}
        $startTime = Get-Date

        foreach ($testName in $dbTests.Keys) {
            $test = $dbTests[$testName]

            Write-Host "Testing database: $testName"

            $testResult = @{
                TestName = $testName
                Description = $test.Description
                Critical = $test.Critical
                Success = $false
                ExecutionTime = $null
                Error = $null
                RowCount = $null
            }

            try {
                $queryStart = Get-Date

                # Try to determine connection string from config file if not provided
                $connStr = $connectionString
                if ([string]::IsNullOrEmpty($connStr)) {
                    # Try to read from web.config
                    $webConfigPath = "C:\inetpub\WeSign\web.config"
                    if (Test-Path $webConfigPath) {
                        [xml]$webConfig = Get-Content $webConfigPath
                        $connStrNode = $webConfig.configuration.connectionStrings.add | Where-Object { $_.name -eq "DefaultConnection" }
                        if ($connStrNode) {
                            $connStr = $connStrNode.connectionString
                        }
                    }
                }

                if ([string]::IsNullOrEmpty($connStr)) {
                    throw "No connection string available for testing"
                }

                # Execute test query
                $connection = New-Object System.Data.SqlClient.SqlConnection($connStr)
                $connection.ConnectionTimeout = $testTimeout
                $connection.Open()

                $command = New-Object System.Data.SqlClient.SqlCommand($test.Query, $connection)
                $command.CommandTimeout = $testTimeout

                $result = $command.ExecuteScalar()
                $connection.Close()

                $executionTime = (Get-Date) - $queryStart
                $testResult.ExecutionTime = $executionTime.TotalMilliseconds
                $testResult.Success = $true
                $testResult.RowCount = if ($result) { 1 } else { 0 }

                Write-Host "  SUCCESS: $testName (Time: $([math]::Round($testResult.ExecutionTime, 2))ms)"
            }
            catch {
                $testResult.Error = $_.Exception.Message
                Write-Host "  FAILED: $testName - $($testResult.Error)"
            }

            $results[$testName] = $testResult
        }

        $endTime = Get-Date
        $totalDuration = $endTime - $startTime

        return @{
            Results = $results
            Summary = @{
                TotalTests = $results.Count
                PassedTests = ($results.Values | Where-Object { $_.Success }).Count
                FailedTests = ($results.Values | Where-Object { -not $_.Success }).Count
                CriticalFailures = ($results.Values | Where-Object { -not $_.Success -and $_.Critical }).Count
                Duration = $totalDuration
            }
        }
    }

    try {
        if ($Session) {
            $result = Invoke-Command -Session $Session -ScriptBlock $scriptBlock -ArgumentList $ConnectionString, $Global:SmokeTestConfig.DatabaseTests, $TestTimeout -ErrorAction Stop
        }
        else {
            $result = & $scriptBlock $ConnectionString $Global:SmokeTestConfig.DatabaseTests $TestTimeout
        }

        Write-DeploymentLog "Database tests completed: $($result.Summary.PassedTests)/$($result.Summary.TotalTests) passed"

        if ($result.Summary.CriticalFailures -gt 0) {
            Write-DeploymentLog "CRITICAL: $($result.Summary.CriticalFailures) critical database test(s) failed" -Level Error
        }

        return $result
    }
    catch {
        Write-DeploymentLog "Database testing failed: $($_.Exception.Message)" -Level Error
        throw
    }
}

function Test-ServiceDependencies {
    <#
    .SYNOPSIS
        Tests Windows service dependencies for WeSign
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $false)]
        [System.Management.Automation.Runspaces.PSSession]$Session
    )

    Write-DeploymentLog "Testing service dependencies"

    $scriptBlock = {
        param($serviceDeps)

        $results = @{}
        $startTime = Get-Date

        foreach ($serviceName in $serviceDeps.Keys) {
            $service = $serviceDeps[$serviceName]

            Write-Host "Testing service: $serviceName ($($service.ServiceName))"

            $testResult = @{
                ServiceName = $serviceName
                WindowsServiceName = $service.ServiceName
                Description = $service.Description
                Required = $service.Required
                Success = $false
                Status = $null
                StartType = $null
                Error = $null
            }

            try {
                $windowsService = Get-Service -Name $service.ServiceName -ErrorAction Stop

                $testResult.Status = $windowsService.Status
                $testResult.StartType = $windowsService.StartType
                $testResult.Success = $windowsService.Status -eq 'Running'

                if ($testResult.Success) {
                    Write-Host "  SUCCESS: $serviceName is running"
                }
                else {
                    Write-Host "  FAILED: $serviceName is $($windowsService.Status)"
                    $testResult.Error = "Service is not running (Status: $($windowsService.Status))"
                }
            }
            catch {
                $testResult.Error = "Service not found or inaccessible: $($_.Exception.Message)"
                Write-Host "  FAILED: $serviceName - $($testResult.Error)"
            }

            $results[$serviceName] = $testResult
        }

        $endTime = Get-Date
        $totalDuration = $endTime - $startTime

        return @{
            Results = $results
            Summary = @{
                TotalServices = $results.Count
                RunningServices = ($results.Values | Where-Object { $_.Success }).Count
                StoppedServices = ($results.Values | Where-Object { -not $_.Success }).Count
                RequiredServiceFailures = ($results.Values | Where-Object { -not $_.Success -and $_.Required }).Count
                Duration = $totalDuration
            }
        }
    }

    try {
        if ($Session) {
            $result = Invoke-Command -Session $Session -ScriptBlock $scriptBlock -ArgumentList $Global:SmokeTestConfig.ServiceDependencies -ErrorAction Stop
        }
        else {
            $result = & $scriptBlock $Global:SmokeTestConfig.ServiceDependencies
        }

        Write-DeploymentLog "Service dependency tests completed: $($result.Summary.RunningServices)/$($result.Summary.TotalServices) services running"

        if ($result.Summary.RequiredServiceFailures -gt 0) {
            Write-DeploymentLog "CRITICAL: $($result.Summary.RequiredServiceFailures) required service(s) not running" -Level Error
        }

        return $result
    }
    catch {
        Write-DeploymentLog "Service dependency testing failed: $($_.Exception.Message)" -Level Error
        throw
    }
}

function Generate-SmokeReport {
    <#
    .SYNOPSIS
        Generates comprehensive smoke test report with scoring
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$EndpointResults,

        [Parameter(Mandatory = $true)]
        [hashtable]$DatabaseResults,

        [Parameter(Mandatory = $true)]
        [hashtable]$ServiceResults,

        [Parameter(Mandatory = $true)]
        [string]$Environment,

        [Parameter(Mandatory = $true)]
        [string]$BaseUrl
    )

    Write-DeploymentLog "Generating smoke test report"

    $report = @{
        TestExecution = @{
            Timestamp = Get-Date
            Environment = $Environment
            BaseUrl = $BaseUrl
            TestSuite = "WeSign Smoke Tests v1.0"
        }
        Results = @{
            Endpoints = $EndpointResults
            Database = $DatabaseResults
            Services = $ServiceResults
        }
        Summary = @{}
        Scoring = @{}
        Recommendations = @()
    }

    # Calculate overall summary
    $totalTests = $EndpointResults.Summary.TotalTests + $DatabaseResults.Summary.TotalTests + $ServiceResults.Summary.TotalServices
    $totalPassed = $EndpointResults.Summary.PassedTests + $DatabaseResults.Summary.PassedTests + $ServiceResults.Summary.RunningServices
    $totalFailed = $totalTests - $totalPassed
    $criticalFailures = $EndpointResults.Summary.CriticalFailures + $DatabaseResults.Summary.CriticalFailures + $ServiceResults.Summary.RequiredServiceFailures

    $report.Summary = @{
        TotalTests = $totalTests
        PassedTests = $totalPassed
        FailedTests = $totalFailed
        CriticalFailures = $criticalFailures
        SuccessRate = if ($totalTests -gt 0) { [math]::Round(($totalPassed / $totalTests) * 100, 2) } else { 0 }
        OverallDuration = @{
            Endpoints = $EndpointResults.Summary.Duration
            Database = $DatabaseResults.Summary.Duration
            Services = $ServiceResults.Summary.Duration
        }
    }

    # Calculate weighted score
    $criticalScore = 0
    $nonCriticalScore = 0
    $maxCriticalScore = 0
    $maxNonCriticalScore = 0

    # Score endpoints
    foreach ($result in $EndpointResults.Results.Values) {
        if ($result.Critical) {
            $maxCriticalScore += $Global:SmokeTestConfig.Scoring.CriticalWeight
            if ($result.Success) { $criticalScore += $Global:SmokeTestConfig.Scoring.CriticalWeight }
        }
        else {
            $maxNonCriticalScore += $Global:SmokeTestConfig.Scoring.NonCriticalWeight
            if ($result.Success) { $nonCriticalScore += $Global:SmokeTestConfig.Scoring.NonCriticalWeight }
        }
    }

    # Score database tests
    foreach ($result in $DatabaseResults.Results.Values) {
        if ($result.Critical) {
            $maxCriticalScore += $Global:SmokeTestConfig.Scoring.CriticalWeight
            if ($result.Success) { $criticalScore += $Global:SmokeTestConfig.Scoring.CriticalWeight }
        }
        else {
            $maxNonCriticalScore += $Global:SmokeTestConfig.Scoring.NonCriticalWeight
            if ($result.Success) { $nonCriticalScore += $Global:SmokeTestConfig.Scoring.NonCriticalWeight }
        }
    }

    # Score service dependencies
    foreach ($result in $ServiceResults.Results.Values) {
        if ($result.Required) {
            $maxCriticalScore += $Global:SmokeTestConfig.Scoring.CriticalWeight
            if ($result.Success) { $criticalScore += $Global:SmokeTestConfig.Scoring.CriticalWeight }
        }
        else {
            $maxNonCriticalScore += $Global:SmokeTestConfig.Scoring.NonCriticalWeight
            if ($result.Success) { $nonCriticalScore += $Global:SmokeTestConfig.Scoring.NonCriticalWeight }
        }
    }

    $totalScore = $criticalScore + $nonCriticalScore
    $maxScore = $maxCriticalScore + $maxNonCriticalScore
    $scorePercentage = if ($maxScore -gt 0) { [math]::Round(($totalScore / $maxScore) * 100, 2) } else { 0 }

    $report.Scoring = @{
        CriticalScore = $criticalScore
        MaxCriticalScore = $maxCriticalScore
        NonCriticalScore = $nonCriticalScore
        MaxNonCriticalScore = $maxNonCriticalScore
        TotalScore = $totalScore
        MaxScore = $maxScore
        ScorePercentage = $scorePercentage
        PassingScore = $Global:SmokeTestConfig.Scoring.PassingScore
        Passed = $scorePercentage -ge $Global:SmokeTestConfig.Scoring.PassingScore
    }

    # Generate recommendations
    if ($criticalFailures -gt 0) {
        $report.Recommendations += "URGENT: Address $criticalFailures critical failure(s) immediately"
    }

    if ($EndpointResults.Summary.FailedTests -gt 0) {
        $report.Recommendations += "Review failed endpoint tests - may indicate application or network issues"
    }

    if ($DatabaseResults.Summary.FailedTests -gt 0) {
        $report.Recommendations += "Review database connectivity and query performance"
    }

    if ($ServiceResults.Summary.StoppedServices -gt 0) {
        $report.Recommendations += "Check Windows service dependencies and start any stopped required services"
    }

    if ($report.Summary.SuccessRate -lt 90) {
        $report.Recommendations += "Overall success rate is below 90% - consider delaying deployment"
    }

    if ($scorePercentage -lt $Global:SmokeTestConfig.Scoring.PassingScore) {
        $report.Recommendations += "Smoke test score is below passing threshold - review all failures"
    }

    if ($report.Recommendations.Count -eq 0) {
        $report.Recommendations += "All smoke tests passed - deployment appears successful"
    }

    Write-DeploymentLog "Smoke test report generated - Score: $scorePercentage% (Passing: $($report.Scoring.Passed))"

    return $report
}

function Export-SmokeTestReport {
    <#
    .SYNOPSIS
        Exports smoke test report to JSON and HTML formats
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Report,

        [Parameter(Mandatory = $false)]
        [string]$OutputPath = "C:\Logs\WeSignDeployment",

        [Parameter(Mandatory = $false)]
        [string]$ReportPrefix = "smoke_test"
    )

    try {
        if (-not (Test-Path $OutputPath)) {
            New-Item -Path $OutputPath -ItemType Directory -Force | Out-Null
        }

        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $baseFileName = "${ReportPrefix}_${timestamp}"

        # Export JSON report
        $jsonPath = Join-Path $OutputPath "$baseFileName.json"
        $Report | ConvertTo-Json -Depth 10 | Out-File -FilePath $jsonPath -Encoding UTF8
        Write-DeploymentLog "JSON report exported: $jsonPath"

        # Export HTML report
        $htmlPath = Join-Path $OutputPath "$baseFileName.html"
        $htmlContent = Generate-HtmlReport -Report $Report
        $htmlContent | Out-File -FilePath $htmlPath -Encoding UTF8
        Write-DeploymentLog "HTML report exported: $htmlPath"

        return @{
            JsonPath = $jsonPath
            HtmlPath = $htmlPath
        }
    }
    catch {
        Write-DeploymentLog "Failed to export smoke test report: $($_.Exception.Message)" -Level Error
        throw
    }
}

function Generate-HtmlReport {
    <#
    .SYNOPSIS
        Generates HTML report from smoke test results
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Report
    )

    $html = @"
<!DOCTYPE html>
<html>
<head>
    <title>WeSign Smoke Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background-color: #f0f0f0; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .summary { background-color: #e8f5e8; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .critical { background-color: #ffe8e8; }
        .warning { background-color: #fff8e8; }
        .success { background-color: #e8f5e8; }
        .failure { background-color: #ffe8e8; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .status-pass { color: green; font-weight: bold; }
        .status-fail { color: red; font-weight: bold; }
        .recommendations { background-color: #f0f8ff; padding: 15px; border-radius: 5px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>WeSign Smoke Test Report</h1>
        <p><strong>Timestamp:</strong> $($Report.TestExecution.Timestamp)</p>
        <p><strong>Environment:</strong> $($Report.TestExecution.Environment)</p>
        <p><strong>Base URL:</strong> $($Report.TestExecution.BaseUrl)</p>
    </div>

    <div class="summary $(if($Report.Scoring.Passed) {'success'} else {'failure'})">
        <h2>Summary</h2>
        <p><strong>Overall Score:</strong> $($Report.Scoring.ScorePercentage)% (Passing: $($Report.Scoring.PassingScore)%)</p>
        <p><strong>Total Tests:</strong> $($Report.Summary.TotalTests) | <strong>Passed:</strong> $($Report.Summary.PassedTests) | <strong>Failed:</strong> $($Report.Summary.FailedTests)</p>
        <p><strong>Critical Failures:</strong> $($Report.Summary.CriticalFailures)</p>
        <p><strong>Success Rate:</strong> $($Report.Summary.SuccessRate)%</p>
    </div>

    <h2>Endpoint Tests</h2>
    <table>
        <tr><th>Endpoint</th><th>Status</th><th>Response Time</th><th>Status Code</th><th>Description</th><th>Error</th></tr>
"@

    foreach ($result in $Report.Results.Endpoints.Results.Values) {
        $statusClass = if ($result.Success) { "status-pass" } else { "status-fail" }
        $status = if ($result.Success) { "PASS" } else { "FAIL" }
        $responseTime = if ($result.ResponseTime) { "$([math]::Round($result.ResponseTime, 2))ms" } else { "N/A" }

        $html += @"
        <tr class="$(if($result.Critical -and -not $result.Success) {'critical'})">
            <td>$($result.EndpointName)</td>
            <td class="$statusClass">$status</td>
            <td>$responseTime</td>
            <td>$($result.StatusCode)</td>
            <td>$($result.Description)</td>
            <td>$($result.Error)</td>
        </tr>
"@
    }

    $html += @"
    </table>

    <h2>Database Tests</h2>
    <table>
        <tr><th>Test</th><th>Status</th><th>Execution Time</th><th>Description</th><th>Error</th></tr>
"@

    foreach ($result in $Report.Results.Database.Results.Values) {
        $statusClass = if ($result.Success) { "status-pass" } else { "status-fail" }
        $status = if ($result.Success) { "PASS" } else { "FAIL" }
        $executionTime = if ($result.ExecutionTime) { "$([math]::Round($result.ExecutionTime, 2))ms" } else { "N/A" }

        $html += @"
        <tr class="$(if($result.Critical -and -not $result.Success) {'critical'})">
            <td>$($result.TestName)</td>
            <td class="$statusClass">$status</td>
            <td>$executionTime</td>
            <td>$($result.Description)</td>
            <td>$($result.Error)</td>
        </tr>
"@
    }

    $html += @"
    </table>

    <h2>Service Dependencies</h2>
    <table>
        <tr><th>Service</th><th>Status</th><th>Windows Service</th><th>Description</th><th>Error</th></tr>
"@

    foreach ($result in $Report.Results.Services.Results.Values) {
        $statusClass = if ($result.Success) { "status-pass" } else { "status-fail" }
        $status = if ($result.Success) { "RUNNING" } else { $result.Status }

        $html += @"
        <tr class="$(if($result.Required -and -not $result.Success) {'critical'})">
            <td>$($result.ServiceName)</td>
            <td class="$statusClass">$status</td>
            <td>$($result.WindowsServiceName)</td>
            <td>$($result.Description)</td>
            <td>$($result.Error)</td>
        </tr>
"@
    }

    $html += @"
    </table>

    <div class="recommendations">
        <h2>Recommendations</h2>
        <ul>
"@

    foreach ($recommendation in $Report.Recommendations) {
        $html += "            <li>$recommendation</li>`n"
    }

    $html += @"
        </ul>
    </div>
</body>
</html>
"@

    return $html
}

function Invoke-WeSignSmokeTests {
    <#
    .SYNOPSIS
        Main orchestration function for WeSign smoke tests
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $false)]
        [System.Management.Automation.Runspaces.PSSession]$Session,

        [Parameter(Mandatory = $true)]
        [string]$BaseUrl,

        [Parameter(Mandatory = $true)]
        [string]$Environment,

        [Parameter(Mandatory = $false)]
        [int]$TestTimeout = $Global:SmokeTestConfig.Defaults.TestTimeout,

        [Parameter(Mandatory = $false)]
        [int]$RetryAttempts = $Global:SmokeTestConfig.Defaults.RetryAttempts,

        [Parameter(Mandatory = $false)]
        [string]$ConnectionString = "",

        [Parameter(Mandatory = $false)]
        [switch]$ExportReport
    )

    Write-DeploymentLog "=== WeSign Smoke Tests Started ==="
    Write-DeploymentLog "Environment: $Environment"
    Write-DeploymentLog "Base URL: $BaseUrl"

    $smokeTestStartTime = Get-Date

    try {
        # Test endpoints
        Write-DeploymentLog "Running endpoint tests..."
        $endpointResults = Test-WeSignEndpoints -Session $Session -BaseUrl $BaseUrl -TestTimeout $TestTimeout -RetryAttempts $RetryAttempts

        # Test database connectivity
        Write-DeploymentLog "Running database connectivity tests..."
        $databaseResults = Test-DatabaseConnectivity -Session $Session -ConnectionString $ConnectionString -TestTimeout $TestTimeout

        # Test service dependencies
        Write-DeploymentLog "Running service dependency tests..."
        $serviceResults = Test-ServiceDependencies -Session $Session

        # Generate comprehensive report
        Write-DeploymentLog "Generating smoke test report..."
        $report = Generate-SmokeReport -EndpointResults $endpointResults -DatabaseResults $databaseResults -ServiceResults $serviceResults -Environment $Environment -BaseUrl $BaseUrl

        $smokeTestDuration = (Get-Date) - $smokeTestStartTime

        # Export report if requested
        $exportPaths = $null
        if ($ExportReport) {
            Write-DeploymentLog "Exporting smoke test report..."
            $exportPaths = Export-SmokeTestReport -Report $report
        }

        Write-DeploymentLog "=== WeSign Smoke Tests Completed ==="
        Write-DeploymentLog "Duration: $($smokeTestDuration.ToString('hh\:mm\:ss'))"
        Write-DeploymentLog "Overall Score: $($report.Scoring.ScorePercentage)% (Passing: $($report.Scoring.Passed))"
        Write-DeploymentLog "Critical Failures: $($report.Summary.CriticalFailures)"

        if ($report.Summary.CriticalFailures -gt 0) {
            Write-DeploymentLog "SMOKE TESTS FAILED - Critical issues detected" -Level Error
        }
        elseif (-not $report.Scoring.Passed) {
            Write-DeploymentLog "SMOKE TESTS FAILED - Score below passing threshold" -Level Warning
        }
        else {
            Write-DeploymentLog "SMOKE TESTS PASSED - All critical tests successful"
        }

        return @{
            Report = $report
            OverallSuccess = $report.Scoring.Passed -and $report.Summary.CriticalFailures -eq 0
            Duration = $smokeTestDuration
            ExportPaths = $exportPaths
        }
    }
    catch {
        $smokeTestDuration = (Get-Date) - $smokeTestStartTime
        Write-DeploymentLog "=== WeSign Smoke Tests Failed ===" -Level Error
        Write-DeploymentLog "Error: $($_.Exception.Message)" -Level Error
        Write-DeploymentLog "Duration: $($smokeTestDuration.ToString('hh\:mm\:ss'))"

        throw
    }
}

# Export module functions
Export-ModuleMember -Function @(
    'Invoke-WeSignSmokeTests',
    'Test-WeSignEndpoints',
    'Test-DatabaseConnectivity',
    'Test-ServiceDependencies',
    'Generate-SmokeReport',
    'Export-SmokeTestReport'
)

Write-DeploymentLog "WeSign Smoke Testing module loaded successfully"