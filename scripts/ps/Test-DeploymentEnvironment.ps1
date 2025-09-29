#Requires -Version 5.1

<#
.SYNOPSIS
    WeSign Deployment Environment Validation Script

.DESCRIPTION
    Validates the local and target deployment environment for WeSign deployment.
    Checks prerequisites, connectivity, and configuration before running the main deployment.

.PARAMETER ComputerName
    Target server hostname or IP address

.PARAMETER Credential
    Credentials for target server

.PARAMETER TestDepth
    Level of testing: Basic, Standard, Comprehensive

.EXAMPLE
    .\Test-DeploymentEnvironment.ps1 -ComputerName "devtest.contoso.com"

.EXAMPLE
    .\Test-DeploymentEnvironment.ps1 -ComputerName "devtest" -TestDepth "Comprehensive"

.NOTES
    Author: QA Intelligence Platform
    Version: 1.0
    Created: 2025-09-26
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$ComputerName,

    [Parameter(Mandatory = $false)]
    [PSCredential]$Credential,

    [Parameter(Mandatory = $false)]
    [ValidateSet('Basic', 'Standard', 'Comprehensive')]
    [string]$TestDepth = 'Standard'
)

# Import logging functions
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $scriptRoot "winrm_session.ps1")

# Test results tracking
$Global:TestResults = @{
    StartTime = Get-Date
    TotalTests = 0
    PassedTests = 0
    FailedTests = 0
    WarningTests = 0
    Tests = @()
}

function Add-TestResult {
    param(
        [string]$TestName,
        [ValidateSet('Pass', 'Fail', 'Warning', 'Skip')]
        [string]$Result,
        [string]$Details = '',
        [string]$Recommendation = ''
    )

    $test = @{
        Name = $TestName
        Result = $Result
        Details = $Details
        Recommendation = $Recommendation
        Timestamp = Get-Date
    }

    $Global:TestResults.Tests += $test
    $Global:TestResults.TotalTests++

    switch ($Result) {
        'Pass' {
            $Global:TestResults.PassedTests++
            Write-Host "✅ $TestName" -ForegroundColor Green
            if ($Details) { Write-Host "   $Details" -ForegroundColor Gray }
        }
        'Fail' {
            $Global:TestResults.FailedTests++
            Write-Host "❌ $TestName" -ForegroundColor Red
            if ($Details) { Write-Host "   $Details" -ForegroundColor Red }
            if ($Recommendation) { Write-Host "   💡 $Recommendation" -ForegroundColor Yellow }
        }
        'Warning' {
            $Global:TestResults.WarningTests++
            Write-Host "⚠️  $TestName" -ForegroundColor Yellow
            if ($Details) { Write-Host "   $Details" -ForegroundColor Yellow }
            if ($Recommendation) { Write-Host "   💡 $Recommendation" -ForegroundColor Cyan }
        }
        'Skip' {
            Write-Host "⏭️  $TestName (Skipped)" -ForegroundColor Gray
            if ($Details) { Write-Host "   $Details" -ForegroundColor Gray }
        }
    }
}

function Test-LocalEnvironment {
    Write-Host "`n🔍 Testing Local Environment..." -ForegroundColor Cyan

    # PowerShell Version
    try {
        $psVersion = $PSVersionTable.PSVersion
        if ($psVersion.Major -ge 5) {
            Add-TestResult -TestName "PowerShell Version" -Result "Pass" -Details "Version $($psVersion.ToString())"
        } else {
            Add-TestResult -TestName "PowerShell Version" -Result "Fail" -Details "Version $($psVersion.ToString())" -Recommendation "Upgrade to PowerShell 5.1 or later"
        }
    } catch {
        Add-TestResult -TestName "PowerShell Version" -Result "Fail" -Details $_.Exception.Message
    }

    # Administrator privileges
    try {
        $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
        if ($isAdmin) {
            Add-TestResult -TestName "Administrator Privileges" -Result "Pass" -Details "Running as administrator"
        } else {
            Add-TestResult -TestName "Administrator Privileges" -Result "Fail" -Details "Not running as administrator" -Recommendation "Run PowerShell as Administrator"
        }
    } catch {
        Add-TestResult -TestName "Administrator Privileges" -Result "Fail" -Details $_.Exception.Message
    }

    # WebAdministration Module
    try {
        $webAdminModule = Get-Module -ListAvailable WebAdministration
        if ($webAdminModule) {
            Add-TestResult -TestName "WebAdministration Module" -Result "Pass" -Details "Version $($webAdminModule.Version)"
        } else {
            Add-TestResult -TestName "WebAdministration Module" -Result "Fail" -Details "Module not found" -Recommendation "Install IIS Management Tools"
        }
    } catch {
        Add-TestResult -TestName "WebAdministration Module" -Result "Fail" -Details $_.Exception.Message
    }

    # WinRM Service
    try {
        $winrmService = Get-Service -Name WinRM
        if ($winrmService.Status -eq 'Running') {
            Add-TestResult -TestName "WinRM Service" -Result "Pass" -Details "Service is running"
        } elseif ($winrmService.Status -eq 'Stopped') {
            Add-TestResult -TestName "WinRM Service" -Result "Warning" -Details "Service is stopped" -Recommendation "Start WinRM service: Start-Service WinRM"
        } else {
            Add-TestResult -TestName "WinRM Service" -Result "Warning" -Details "Service status: $($winrmService.Status)"
        }
    } catch {
        Add-TestResult -TestName "WinRM Service" -Result "Fail" -Details $_.Exception.Message -Recommendation "Install and configure WinRM"
    }

    # WinRM Client Configuration
    try {
        $maxEnvelopeSize = (Get-Item WSMan:\localhost\Client\MaxEnvelopeSizekb -ErrorAction Stop).Value
        if ([int]$maxEnvelopeSize -ge 8192) {
            Add-TestResult -TestName "WinRM Max Envelope Size" -Result "Pass" -Details "${maxEnvelopeSize}KB"
        } else {
            Add-TestResult -TestName "WinRM Max Envelope Size" -Result "Warning" -Details "${maxEnvelopeSize}KB (recommended: 8192KB+)" -Recommendation "Set-Item WSMan:\localhost\Client\MaxEnvelopeSizekb -Value 8192"
        }
    } catch {
        Add-TestResult -TestName "WinRM Max Envelope Size" -Result "Warning" -Details "Could not check configuration" -Recommendation "Verify WinRM is properly configured"
    }

    # Execution Policy
    try {
        $execPolicy = Get-ExecutionPolicy
        if ($execPolicy -eq 'Unrestricted' -or $execPolicy -eq 'RemoteSigned' -or $execPolicy -eq 'Bypass') {
            Add-TestResult -TestName "PowerShell Execution Policy" -Result "Pass" -Details $execPolicy
        } else {
            Add-TestResult -TestName "PowerShell Execution Policy" -Result "Warning" -Details $execPolicy -Recommendation "Set-ExecutionPolicy RemoteSigned -Scope CurrentUser"
        }
    } catch {
        Add-TestResult -TestName "PowerShell Execution Policy" -Result "Fail" -Details $_.Exception.Message
    }

    # Available Memory
    try {
        $totalMemory = Get-WmiObject -Class Win32_ComputerSystem | Select-Object -ExpandProperty TotalPhysicalMemory
        $availableMemory = Get-WmiObject -Class Win32_OperatingSystem | Select-Object -ExpandProperty FreePhysicalMemory
        $totalMemoryGB = [math]::Round($totalMemory / 1GB, 2)
        $availableMemoryGB = [math]::Round(($availableMemory * 1KB) / 1GB, 2)

        if ($availableMemoryGB -ge 2) {
            Add-TestResult -TestName "Available Memory" -Result "Pass" -Details "${availableMemoryGB}GB available of ${totalMemoryGB}GB total"
        } elseif ($availableMemoryGB -ge 1) {
            Add-TestResult -TestName "Available Memory" -Result "Warning" -Details "${availableMemoryGB}GB available of ${totalMemoryGB}GB total" -Recommendation "Consider freeing up more memory"
        } else {
            Add-TestResult -TestName "Available Memory" -Result "Fail" -Details "${availableMemoryGB}GB available of ${totalMemoryGB}GB total" -Recommendation "Free up memory before deployment"
        }
    } catch {
        Add-TestResult -TestName "Available Memory" -Result "Warning" -Details "Could not check memory usage"
    }

    # Network Connectivity (if target specified)
    if ($ComputerName) {
        try {
            $pingResult = Test-Connection -ComputerName $ComputerName -Count 2 -Quiet
            if ($pingResult) {
                Add-TestResult -TestName "Network Connectivity" -Result "Pass" -Details "Can reach $ComputerName"
            } else {
                Add-TestResult -TestName "Network Connectivity" -Result "Fail" -Details "Cannot reach $ComputerName" -Recommendation "Check network connectivity and firewall rules"
            }
        } catch {
            Add-TestResult -TestName "Network Connectivity" -Result "Fail" -Details $_.Exception.Message
        }
    }
}

function Test-TargetEnvironment {
    if (-not $ComputerName) {
        Write-Host "⏭️  Target environment tests skipped (no computer name provided)" -ForegroundColor Gray
        return
    }

    Write-Host "`n🌐 Testing Target Environment: $ComputerName..." -ForegroundColor Cyan

    # Get credentials if not provided
    if (-not $Credential) {
        try {
            $Credential = Get-Credential -Message "Enter credentials for $ComputerName"
        } catch {
            Add-TestResult -TestName "Credential Input" -Result "Fail" -Details "User cancelled credential prompt"
            return
        }
    }

    # Test WinRM HTTPS connectivity
    try {
        $winrmTest = Test-WSMan -ComputerName $ComputerName -UseSSL -Port 5986 -Authentication Negotiate -Credential $Credential -ErrorAction Stop
        Add-TestResult -TestName "WinRM HTTPS Connectivity" -Result "Pass" -Details "Port 5986 accessible with SSL"
    } catch {
        Add-TestResult -TestName "WinRM HTTPS Connectivity" -Result "Fail" -Details $_.Exception.Message -Recommendation "Configure WinRM for HTTPS on target server"
    }

    # Test PowerShell Remoting
    try {
        $session = New-PSSession -ComputerName $ComputerName -UseSSL -Port 5986 -Credential $Credential -ErrorAction Stop

        # Test basic functionality
        $remoteInfo = Invoke-Command -Session $session -ScriptBlock {
            @{
                ComputerName = $env:COMPUTERNAME
                OSVersion = (Get-WmiObject -Class Win32_OperatingSystem).Caption
                PowerShellVersion = $PSVersionTable.PSVersion.ToString()
                Architecture = $env:PROCESSOR_ARCHITECTURE
                LocalTime = Get-Date
            }
        } -ErrorAction Stop

        Remove-PSSession $session

        Add-TestResult -TestName "PowerShell Remoting" -Result "Pass" -Details "Successfully connected to $($remoteInfo.ComputerName), OS: $($remoteInfo.OSVersion), PS: $($remoteInfo.PowerShellVersion)"
    } catch {
        Add-TestResult -TestName "PowerShell Remoting" -Result "Fail" -Details $_.Exception.Message -Recommendation "Verify WinRM configuration and credentials"
    }

    if ($TestDepth -eq 'Comprehensive') {
        Test-TargetEnvironmentDetailed
    }
}

function Test-TargetEnvironmentDetailed {
    if (-not $Credential) {
        return
    }

    Write-Host "`n🔬 Comprehensive Target Environment Testing..." -ForegroundColor Cyan

    try {
        $session = New-PSSession -ComputerName $ComputerName -UseSSL -Port 5986 -Credential $Credential -ErrorAction Stop

        # Test IIS Installation
        $iisTest = Invoke-Command -Session $session -ScriptBlock {
            try {
                Import-Module WebAdministration -ErrorAction Stop
                $websites = Get-Website -ErrorAction Stop
                @{
                    Success = $true
                    WebsiteCount = $websites.Count
                    Websites = ($websites | Select-Object Name, State, PhysicalPath)
                }
            } catch {
                @{
                    Success = $false
                    Error = $_.Exception.Message
                }
            }
        }

        if ($iisTest.Success) {
            Add-TestResult -TestName "IIS Installation" -Result "Pass" -Details "$($iisTest.WebsiteCount) websites found"
        } else {
            Add-TestResult -TestName "IIS Installation" -Result "Fail" -Details $iisTest.Error -Recommendation "Install and configure IIS"
        }

        # Test File System Permissions
        $pathTest = Invoke-Command -Session $session -ScriptBlock {
            $testPaths = @('C:\inetpub', 'C:\deploy', 'C:\backup')
            $results = @{}

            foreach ($path in $testPaths) {
                try {
                    if (Test-Path $path) {
                        $testFile = Join-Path $path "test_$(Get-Date -Format 'yyyyMMddHHmmss').tmp"
                        "test" | Out-File -FilePath $testFile -ErrorAction Stop
                        Remove-Item $testFile -ErrorAction SilentlyContinue
                        $results[$path] = 'ReadWrite'
                    } else {
                        try {
                            New-Item -Path $path -ItemType Directory -Force -ErrorAction Stop
                            $results[$path] = 'Created'
                        } catch {
                            $results[$path] = 'NoAccess'
                        }
                    }
                } catch {
                    $results[$path] = 'ReadOnly'
                }
            }

            return $results
        }

        foreach ($path in $pathTest.Keys) {
            $status = $pathTest[$path]
            switch ($status) {
                'ReadWrite' {
                    Add-TestResult -TestName "Path Access: $path" -Result "Pass" -Details "Read/Write access available"
                }
                'Created' {
                    Add-TestResult -TestName "Path Access: $path" -Result "Pass" -Details "Directory created successfully"
                }
                'ReadOnly' {
                    Add-TestResult -TestName "Path Access: $path" -Result "Warning" -Details "Read-only access" -Recommendation "Ensure deployment account has write permissions"
                }
                'NoAccess' {
                    Add-TestResult -TestName "Path Access: $path" -Result "Fail" -Details "No access to path" -Recommendation "Create directory and set permissions"
                }
            }
        }

        # Test Windows Services
        $serviceTest = Invoke-Command -Session $session -ScriptBlock {
            $services = @('W3SVC', 'WAS', 'MSSQLSERVER')
            $results = @{}

            foreach ($serviceName in $services) {
                try {
                    $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
                    if ($service) {
                        $results[$serviceName] = @{
                            Status = $service.Status
                            StartType = $service.StartType
                        }
                    } else {
                        $results[$serviceName] = @{
                            Status = 'NotFound'
                            StartType = 'N/A'
                        }
                    }
                } catch {
                    $results[$serviceName] = @{
                        Status = 'Error'
                        StartType = 'N/A'
                        Error = $_.Exception.Message
                    }
                }
            }

            return $results
        }

        foreach ($serviceName in $serviceTest.Keys) {
            $service = $serviceTest[$serviceName]
            $details = "Status: $($service.Status)"
            if ($service.StartType) { $details += ", StartType: $($service.StartType)" }

            switch ($service.Status) {
                'Running' {
                    Add-TestResult -TestName "Service: $serviceName" -Result "Pass" -Details $details
                }
                'Stopped' {
                    Add-TestResult -TestName "Service: $serviceName" -Result "Warning" -Details $details -Recommendation "Start service if required for WeSign"
                }
                'NotFound' {
                    Add-TestResult -TestName "Service: $serviceName" -Result "Warning" -Details "Service not installed" -Recommendation "Install if required for WeSign"
                }
                default {
                    Add-TestResult -TestName "Service: $serviceName" -Result "Warning" -Details $details
                }
            }
        }

        # Test .NET Framework Version
        $dotNetTest = Invoke-Command -Session $session -ScriptBlock {
            try {
                $releaseKey = (Get-ItemProperty "HKLM:SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full\" -Name Release -ErrorAction Stop).Release

                # .NET Framework version mapping
                $version = switch ($releaseKey) {
                    { $_ -ge 533320 } { "4.8.1" }
                    { $_ -ge 528040 } { "4.8" }
                    { $_ -ge 461808 } { "4.7.2" }
                    { $_ -ge 461308 } { "4.7.1" }
                    { $_ -ge 460798 } { "4.7" }
                    { $_ -ge 394802 } { "4.6.2" }
                    { $_ -ge 394254 } { "4.6.1" }
                    { $_ -ge 393295 } { "4.6" }
                    default { "Unknown ($releaseKey)" }
                }

                @{
                    Success = $true
                    Version = $version
                    ReleaseKey = $releaseKey
                }
            } catch {
                @{
                    Success = $false
                    Error = $_.Exception.Message
                }
            }
        }

        if ($dotNetTest.Success) {
            $releaseKey = $dotNetTest.ReleaseKey
            if ($releaseKey -ge 461808) {  # .NET 4.7.2 or later
                Add-TestResult -TestName ".NET Framework Version" -Result "Pass" -Details "Version $($dotNetTest.Version)"
            } elseif ($releaseKey -ge 394254) {  # .NET 4.6.1 or later
                Add-TestResult -TestName ".NET Framework Version" -Result "Warning" -Details "Version $($dotNetTest.Version)" -Recommendation "Consider upgrading to .NET 4.7.2 or later"
            } else {
                Add-TestResult -TestName ".NET Framework Version" -Result "Fail" -Details "Version $($dotNetTest.Version)" -Recommendation "Upgrade to .NET 4.7.2 or later"
            }
        } else {
            Add-TestResult -TestName ".NET Framework Version" -Result "Warning" -Details "Could not determine version"
        }

        Remove-PSSession $session -ErrorAction SilentlyContinue

    } catch {
        Add-TestResult -TestName "Detailed Target Testing" -Result "Fail" -Details "Could not establish session for detailed testing: $($_.Exception.Message)"
    }
}

function Write-TestSummary {
    $endTime = Get-Date
    $duration = $endTime - $Global:TestResults.StartTime

    Write-Host "`n" + "="*80 -ForegroundColor Cyan
    Write-Host "                    DEPLOYMENT ENVIRONMENT TEST RESULTS" -ForegroundColor Cyan
    Write-Host "="*80 -ForegroundColor Cyan

    Write-Host "`nTest Summary:" -ForegroundColor White
    Write-Host "  Total Tests:    $($Global:TestResults.TotalTests)" -ForegroundColor White
    Write-Host "  Passed:         $($Global:TestResults.PassedTests)" -ForegroundColor Green
    Write-Host "  Failed:         $($Global:TestResults.FailedTests)" -ForegroundColor Red
    Write-Host "  Warnings:       $($Global:TestResults.WarningTests)" -ForegroundColor Yellow
    Write-Host "  Duration:       $($duration.ToString('hh\:mm\:ss'))" -ForegroundColor White

    $successRate = if ($Global:TestResults.TotalTests -gt 0) {
        [math]::Round(($Global:TestResults.PassedTests / $Global:TestResults.TotalTests) * 100, 1)
    } else {
        0
    }
    Write-Host "  Success Rate:   $successRate%" -ForegroundColor $(if ($successRate -ge 80) { 'Green' } elseif ($successRate -ge 60) { 'Yellow' } else { 'Red' })

    # Overall Assessment
    Write-Host "`nOverall Assessment:" -ForegroundColor White
    if ($Global:TestResults.FailedTests -eq 0 -and $Global:TestResults.WarningTests -le 2) {
        Write-Host "  ✅ READY FOR DEPLOYMENT" -ForegroundColor Green
        Write-Host "     Environment appears to be properly configured for WeSign deployment." -ForegroundColor Green
    } elseif ($Global:TestResults.FailedTests -le 2) {
        Write-Host "  ⚠️  PROCEED WITH CAUTION" -ForegroundColor Yellow
        Write-Host "     Some issues detected. Review recommendations before deployment." -ForegroundColor Yellow
    } else {
        Write-Host "  ❌ NOT READY FOR DEPLOYMENT" -ForegroundColor Red
        Write-Host "     Critical issues detected. Address failed tests before deployment." -ForegroundColor Red
    }

    # Show failed tests
    if ($Global:TestResults.FailedTests -gt 0) {
        Write-Host "`nCritical Issues (Must Fix):" -ForegroundColor Red
        $Global:TestResults.Tests | Where-Object { $_.Result -eq 'Fail' } | ForEach-Object {
            Write-Host "  • $($_.Name): $($_.Details)" -ForegroundColor Red
            if ($_.Recommendation) {
                Write-Host "    💡 $($_.Recommendation)" -ForegroundColor Yellow
            }
        }
    }

    # Show warning tests
    if ($Global:TestResults.WarningTests -gt 0) {
        Write-Host "`nRecommendations (Should Fix):" -ForegroundColor Yellow
        $Global:TestResults.Tests | Where-Object { $_.Result -eq 'Warning' } | ForEach-Object {
            Write-Host "  • $($_.Name): $($_.Details)" -ForegroundColor Yellow
            if ($_.Recommendation) {
                Write-Host "    💡 $($_.Recommendation)" -ForegroundColor Cyan
            }
        }
    }

    Write-Host "`n" + "="*80 -ForegroundColor Cyan
}

# Main execution
try {
    Write-Host "🧪 WeSign Deployment Environment Validation" -ForegroundColor Cyan
    Write-Host "Test Depth: $TestDepth" -ForegroundColor Gray

    if ($ComputerName) {
        Write-Host "Target Server: $ComputerName" -ForegroundColor Gray
    }

    Test-LocalEnvironment

    if ($TestDepth -ne 'Basic') {
        Test-TargetEnvironment
    }

    Write-TestSummary

    # Exit with appropriate code
    if ($Global:TestResults.FailedTests -gt 0) {
        exit 1
    } elseif ($Global:TestResults.WarningTests -gt 3) {
        exit 2
    } else {
        exit 0
    }
}
catch {
    Write-Host "`n❌ Test execution failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 3
}