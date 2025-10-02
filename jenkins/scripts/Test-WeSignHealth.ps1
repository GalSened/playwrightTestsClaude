<#
.SYNOPSIS
    WeSign Application Health Check and Smoke Test Script

.DESCRIPTION
    Comprehensive health checking script for WeSign application after deployment.
    Tests various endpoints, services, and dependencies to ensure the application
    is functioning correctly in the target environment.

.PARAMETER BaseUrl
    Base URL of the WeSign application (e.g., https://devtest-server)

.PARAMETER IncludeExtended
    Include extended health checks (database, external services, etc.)

.PARAMETER Timeout
    Timeout in seconds for each health check (default: 30)

.PARAMETER Retries
    Number of retries for failed checks (default: 3)

.PARAMETER OutputFormat
    Output format: Console, Json, Xml (default: Console)

.EXAMPLE
    .\Test-WeSignHealth.ps1 -BaseUrl "https://devtest-iis01" -IncludeExtended

.NOTES
    Version: 2.0
    Author: DevOps Team
    Last Updated: 2025-09-26
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$BaseUrl,

    [Parameter(Mandatory = $false)]
    [switch]$IncludeExtended,

    [Parameter(Mandatory = $false)]
    [int]$Timeout = 30,

    [Parameter(Mandatory = $false)]
    [int]$Retries = 3,

    [Parameter(Mandatory = $false)]
    [ValidateSet('Console', 'Json', 'Xml')]
    [string]$OutputFormat = 'Console',

    [Parameter(Mandatory = $false)]
    [string]$OutputFile,

    [Parameter(Mandatory = $false)]
    [switch]$Detailed
)

# Health check results
$script:HealthResults = @{
    StartTime = Get-Date
    BaseUrl = $BaseUrl
    OverallStatus = 'Unknown'
    Tests = @()
    Summary = @{
        Total = 0
        Passed = 0
        Failed = 0
        Warnings = 0
    }
}

function Write-HealthLog {
    param(
        [string]$Message,
        [string]$Level = 'INFO'
    )

    $timestamp = Get-Date -Format 'HH:mm:ss'
    $prefix = "[$timestamp]"

    switch ($Level) {
        'SUCCESS' { Write-Host "$prefix ✅ $Message" -ForegroundColor Green }
        'ERROR'   { Write-Host "$prefix ❌ $Message" -ForegroundColor Red }
        'WARNING' { Write-Host "$prefix ⚠️  $Message" -ForegroundColor Yellow }
        'INFO'    { Write-Host "$prefix ℹ️  $Message" -ForegroundColor Cyan }
        default   { Write-Host "$prefix $Message" }
    }
}

function Test-HealthEndpoint {
    param(
        [string]$Name,
        [string]$Path,
        [int]$ExpectedStatus = 200,
        [string[]]$ExpectedContent = @(),
        [bool]$Critical = $true,
        [hashtable]$Headers = @{}
    )

    $testResult = @{
        Name = $Name
        Url = "$BaseUrl$Path"
        Critical = $Critical
        Success = $false
        StatusCode = 0
        ResponseTime = 0
        Error = $null
        Content = $null
        Details = @{}
    }

    $attempts = 0
    $maxAttempts = if ($Critical) { $Retries } else { 1 }

    do {
        $attempts++
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

        try {
            Write-HealthLog "Testing $Name (attempt $attempts)..." -Level 'INFO'

            $requestParams = @{
                Uri = $testResult.Url
                TimeoutSec = $Timeout
                UseBasicParsing = $true
                ErrorAction = 'Stop'
            }

            if ($Headers.Count -gt 0) {
                $requestParams.Headers = $Headers
            }

            $response = Invoke-WebRequest @requestParams
            $stopwatch.Stop()

            $testResult.StatusCode = $response.StatusCode
            $testResult.ResponseTime = $stopwatch.ElapsedMilliseconds
            $testResult.Content = $response.Content

            # Check status code
            if ($response.StatusCode -eq $ExpectedStatus) {
                $testResult.Success = $true

                # Check expected content if specified
                foreach ($expectedText in $ExpectedContent) {
                    if ($response.Content -notlike "*$expectedText*") {
                        $testResult.Success = $false
                        $testResult.Error = "Expected content not found: $expectedText"
                        break
                    }
                }

                if ($testResult.Success) {
                    Write-HealthLog "✅ $Name: OK (${$testResult.ResponseTime}ms)" -Level 'SUCCESS'

                    # Parse JSON response for additional details
                    try {
                        $jsonContent = $response.Content | ConvertFrom-Json
                        $testResult.Details = @{
                            JsonParsed = $true
                            ResponseData = $jsonContent
                        }
                    } catch {
                        $testResult.Details.JsonParsed = $false
                    }
                }

            } else {
                $testResult.Error = "Unexpected status code: $($response.StatusCode), expected: $ExpectedStatus"
            }

        } catch {
            $stopwatch.Stop()
            $testResult.ResponseTime = $stopwatch.ElapsedMilliseconds
            $testResult.Error = $_.Exception.Message

            if ($_.Exception.Response) {
                $testResult.StatusCode = [int]$_.Exception.Response.StatusCode
            }
        }

        if (-not $testResult.Success -and $attempts -lt $maxAttempts) {
            Write-HealthLog "⚠️  $Name failed, retrying in 5 seconds..." -Level 'WARNING'
            Start-Sleep -Seconds 5
        }

    } while (-not $testResult.Success -and $attempts -lt $maxAttempts)

    if (-not $testResult.Success) {
        $level = if ($Critical) { 'ERROR' } else { 'WARNING' }
        Write-HealthLog "$Name: FAILED - $($testResult.Error)" -Level $level
    }

    return $testResult
}

function Test-CoreEndpoints {
    Write-HealthLog "Testing core application endpoints..." -Level 'INFO'

    $coreTests = @(
        @{
            Name = 'Main Page'
            Path = '/'
            Critical = $true
            ExpectedContent = @('WeSign', 'html')
        },
        @{
            Name = 'Health Endpoint'
            Path = '/health'
            Critical = $true
            ExpectedContent = @('"status"', '"healthy"')
        },
        @{
            Name = 'API Health'
            Path = '/api/health'
            Critical = $true
            ExpectedContent = @('"status"')
        },
        @{
            Name = 'WeSign API Health'
            Path = '/api/wesign/unified/health'
            Critical = $true
            ExpectedContent = @('"status"')
        }
    )

    foreach ($test in $coreTests) {
        $result = Test-HealthEndpoint -Name $test.Name -Path $test.Path -Critical $test.Critical -ExpectedContent $test.ExpectedContent
        $script:HealthResults.Tests += $result
    }
}

function Test-ApiEndpoints {
    Write-HealthLog "Testing API endpoints..." -Level 'INFO'

    $apiTests = @(
        @{
            Name = 'API Discovery'
            Path = '/api/wesign/unified/discovery/scan'
            Method = 'POST'
            Critical = $false
        },
        @{
            Name = 'Queue Status'
            Path = '/api/wesign/unified/queue/status'
            Critical = $false
        },
        @{
            Name = 'Statistics'
            Path = '/api/wesign/unified/stats'
            Critical = $false
        }
    )

    foreach ($test in $apiTests) {
        try {
            $requestParams = @{
                Uri = "$BaseUrl$($test.Path)"
                Method = if ($test.Method) { $test.Method } else { 'GET' }
                TimeoutSec = $Timeout
                UseBasicParsing = $true
                ErrorAction = 'Stop'
            }

            if ($test.Method -eq 'POST') {
                $requestParams.ContentType = 'application/json'
                $requestParams.Body = '{"directories":["."],"frameworks":["wesign"]}'
            }

            $response = Invoke-WebRequest @requestParams

            $testResult = @{
                Name = $test.Name
                Url = "$BaseUrl$($test.Path)"
                Critical = $test.Critical
                Success = $response.StatusCode -eq 200
                StatusCode = $response.StatusCode
                Error = if ($response.StatusCode -ne 200) { "HTTP $($response.StatusCode)" } else { $null }
            }

            if ($testResult.Success) {
                Write-HealthLog "✅ $($test.Name): OK" -Level 'SUCCESS'
            } else {
                Write-HealthLog "❌ $($test.Name): FAILED - $($testResult.Error)" -Level 'WARNING'
            }

            $script:HealthResults.Tests += $testResult

        } catch {
            $testResult = @{
                Name = $test.Name
                Url = "$BaseUrl$($test.Path)"
                Critical = $test.Critical
                Success = $false
                StatusCode = 0
                Error = $_.Exception.Message
            }

            Write-HealthLog "❌ $($test.Name): FAILED - $($testResult.Error)" -Level 'WARNING'
            $script:HealthResults.Tests += $testResult
        }
    }
}

function Test-DatabaseConnectivity {
    Write-HealthLog "Testing database connectivity..." -Level 'INFO'

    $result = Test-HealthEndpoint -Name 'Database Health' -Path '/api/health/database' -Critical $false

    if ($result.Success -and $result.Details.JsonParsed) {
        $dbData = $result.Details.ResponseData
        if ($dbData.database -and $dbData.database.healthy) {
            Write-HealthLog "✅ Database: Connected" -Level 'SUCCESS'
        } else {
            Write-HealthLog "⚠️  Database: Connection issues detected" -Level 'WARNING'
            $result.Success = $false
            $result.Error = "Database health check indicates issues"
        }
    }

    $script:HealthResults.Tests += $result
}

function Test-ExternalDependencies {
    Write-HealthLog "Testing external dependencies..." -Level 'INFO'

    $dependencyTests = @(
        @{
            Name = 'External API Dependencies'
            Path = '/api/health/dependencies'
            Critical = $false
        }
    )

    foreach ($test in $dependencyTests) {
        $result = Test-HealthEndpoint -Name $test.Name -Path $test.Path -Critical $test.Critical
        $script:HealthResults.Tests += $result
    }
}

function Test-PerformanceBaseline {
    Write-HealthLog "Running performance baseline tests..." -Level 'INFO'

    $performanceTests = @(
        @{
            Name = 'Main Page Load Time'
            Path = '/'
            MaxResponseTime = 2000
        },
        @{
            Name = 'Health Endpoint Response Time'
            Path = '/health'
            MaxResponseTime = 1000
        },
        @{
            Name = 'API Response Time'
            Path = '/api/health'
            MaxResponseTime = 1500
        }
    )

    foreach ($test in $performanceTests) {
        $result = Test-HealthEndpoint -Name $test.Name -Path $test.Path -Critical $false

        if ($result.Success) {
            if ($result.ResponseTime -le $test.MaxResponseTime) {
                Write-HealthLog "✅ $($test.Name): Good performance ($($result.ResponseTime)ms)" -Level 'SUCCESS'
            } else {
                Write-HealthLog "⚠️  $($test.Name): Slow response ($($result.ResponseTime)ms > $($test.MaxResponseTime)ms)" -Level 'WARNING'
                $result.Error = "Response time exceeded baseline: $($result.ResponseTime)ms > $($test.MaxResponseTime)ms"
            }
        }

        $script:HealthResults.Tests += $result
    }
}

function Get-SystemInfo {
    if (-not $IncludeExtended) { return @{} }

    Write-HealthLog "Gathering system information..." -Level 'INFO'

    try {
        $systemInfo = @{}

        # Try to get system info from health endpoint
        $healthResponse = Test-HealthEndpoint -Name 'Extended Health' -Path '/api/health' -Critical $false

        if ($healthResponse.Success -and $healthResponse.Details.JsonParsed) {
            $healthData = $healthResponse.Details.ResponseData

            $systemInfo = @{
                Version = $healthData.version
                Environment = $healthData.environment
                Database = $healthData.database
                Worker = $healthData.worker
                Timestamp = $healthData.timestamp
            }
        }

        return $systemInfo

    } catch {
        Write-HealthLog "⚠️  Could not gather system information: $($_.Exception.Message)" -Level 'WARNING'
        return @{}
    }
}

function Write-HealthSummary {
    $script:HealthResults.EndTime = Get-Date
    $script:HealthResults.Duration = $script:HealthResults.EndTime - $script:HealthResults.StartTime

    # Calculate summary statistics
    $script:HealthResults.Summary.Total = $script:HealthResults.Tests.Count
    $script:HealthResults.Summary.Passed = ($script:HealthResults.Tests | Where-Object { $_.Success }).Count
    $script:HealthResults.Summary.Failed = ($script:HealthResults.Tests | Where-Object { -not $_.Success }).Count

    $criticalTests = $script:HealthResults.Tests | Where-Object { $_.Critical }
    $criticalPassed = ($criticalTests | Where-Object { $_.Success }).Count
    $criticalTotal = $criticalTests.Count

    # Determine overall status
    if ($criticalPassed -eq $criticalTotal) {
        if ($script:HealthResults.Summary.Failed -eq 0) {
            $script:HealthResults.OverallStatus = 'Healthy'
        } else {
            $script:HealthResults.OverallStatus = 'Healthy with Warnings'
            $script:HealthResults.Summary.Warnings = $script:HealthResults.Summary.Failed
        }
    } else {
        $script:HealthResults.OverallStatus = 'Unhealthy'
    }

    # Add system information
    $script:HealthResults.SystemInfo = Get-SystemInfo

    # Console output
    Write-Host "`n" -NoNewline
    Write-Host "=" * 80 -ForegroundColor Gray
    Write-Host "WESIGN HEALTH CHECK SUMMARY" -ForegroundColor White -BackgroundColor DarkBlue
    Write-Host "=" * 80 -ForegroundColor Gray

    $statusColor = switch ($script:HealthResults.OverallStatus) {
        'Healthy' { 'Green' }
        'Healthy with Warnings' { 'Yellow' }
        'Unhealthy' { 'Red' }
        default { 'Gray' }
    }

    Write-Host "Overall Status: " -NoNewline
    Write-Host $script:HealthResults.OverallStatus -ForegroundColor $statusColor

    Write-Host "Test Results: $($script:HealthResults.Summary.Passed)/$($script:HealthResults.Summary.Total) passed"
    Write-Host "Critical Tests: $criticalPassed/$criticalTotal passed"
    Write-Host "Duration: $($script:HealthResults.Duration.TotalSeconds.ToString('F2')) seconds"
    Write-Host "Base URL: $($script:HealthResults.BaseUrl)"

    if ($Detailed) {
        Write-Host "`nDetailed Results:" -ForegroundColor White
        Write-Host "-" * 50

        foreach ($test in $script:HealthResults.Tests) {
            $status = if ($test.Success) { "PASS" } else { "FAIL" }
            $statusColor = if ($test.Success) { "Green" } else { if ($test.Critical) { "Red" } else { "Yellow" } }
            $criticalMark = if ($test.Critical) { " [CRITICAL]" } else { "" }

            Write-Host "  $status : $($test.Name)$criticalMark" -ForegroundColor $statusColor

            if (-not $test.Success -and $test.Error) {
                Write-Host "    Error: $($test.Error)" -ForegroundColor Red
            }

            if ($test.ResponseTime -gt 0) {
                Write-Host "    Response Time: $($test.ResponseTime)ms" -ForegroundColor Gray
            }
        }
    }

    Write-Host "=" * 80 -ForegroundColor Gray
}

function Export-HealthResults {
    if (-not $OutputFile) { return }

    Write-HealthLog "Exporting results to: $OutputFile" -Level 'INFO'

    try {
        switch ($OutputFormat) {
            'Json' {
                $script:HealthResults | ConvertTo-Json -Depth 10 | Out-File -FilePath $OutputFile -Encoding UTF8
            }
            'Xml' {
                $script:HealthResults | ConvertTo-Xml -NoTypeInformation | Select-Object -ExpandProperty OuterXml | Out-File -FilePath $OutputFile -Encoding UTF8
            }
            'Console' {
                # Export as formatted text
                $output = @()
                $output += "WeSign Health Check Report"
                $output += "Generated: $(Get-Date)"
                $output += "Base URL: $($script:HealthResults.BaseUrl)"
                $output += "Overall Status: $($script:HealthResults.OverallStatus)"
                $output += ""
                $output += "Test Results:"

                foreach ($test in $script:HealthResults.Tests) {
                    $status = if ($test.Success) { "PASS" } else { "FAIL" }
                    $critical = if ($test.Critical) { " [CRITICAL]" } else { "" }
                    $output += "  $status - $($test.Name)$critical"

                    if (-not $test.Success -and $test.Error) {
                        $output += "    Error: $($test.Error)"
                    }
                }

                $output -join "`n" | Out-File -FilePath $OutputFile -Encoding UTF8
            }
        }

        Write-HealthLog "Results exported successfully" -Level 'SUCCESS'

    } catch {
        Write-HealthLog "Failed to export results: $($_.Exception.Message)" -Level 'ERROR'
    }
}

# Main execution
try {
    Write-HealthLog "Starting WeSign health checks..." -Level 'INFO'
    Write-HealthLog "Target: $BaseUrl" -Level 'INFO'
    Write-HealthLog "Extended checks: $IncludeExtended" -Level 'INFO'

    # Core health checks
    Test-CoreEndpoints

    # API endpoint checks
    Test-ApiEndpoints

    # Extended checks
    if ($IncludeExtended) {
        Test-DatabaseConnectivity
        Test-ExternalDependencies
        Test-PerformanceBaseline
    }

    # Generate summary
    Write-HealthSummary

    # Export results
    if ($OutputFile) {
        Export-HealthResults
    }

    # Exit with appropriate code
    $exitCode = if ($script:HealthResults.OverallStatus -eq 'Unhealthy') { 1 } else { 0 }

    Write-HealthLog "Health check completed with exit code: $exitCode" -Level 'INFO'
    exit $exitCode

} catch {
    Write-HealthLog "Health check script failed: $($_.Exception.Message)" -Level 'ERROR'
    exit 2
}