#Requires -Version 5.1
#Requires -RunAsAdministrator

<#
.SYNOPSIS
    WeSign Master Deployment Script

.DESCRIPTION
    Master orchestration script for WeSign deployment to Windows DevTest servers.
    Coordinates all deployment activities including WinRM sessions, IIS management,
    deployment engine, smoke tests, and configuration transformations.

.PARAMETER ComputerName
    Target server hostname or IP address

.PARAMETER Username
    Domain username for authentication (will prompt for password)

.PARAMETER ArtifactPath
    Path to the WeSign deployment artifact (ZIP file)

.PARAMETER Environment
    Target environment (DevTest, Staging, Production)

.PARAMETER CredentialFile
    Path to encrypted credential file (optional)

.PARAMETER SkipBackup
    Skip backup creation (not recommended)

.PARAMETER SkipSmokeTests
    Skip smoke test execution

.PARAMETER QAIntelligenceUrl
    URL for QA Intelligence backend API

.PARAMETER ConfigFile
    Path to deployment configuration file (JSON)

.EXAMPLE
    .\Deploy-WeSign-Master.ps1 -ComputerName "devtest.contoso.com" -Username "CONTOSO\deployuser" -ArtifactPath "\\build\WeSign_v1.2.3.zip"

.EXAMPLE
    .\Deploy-WeSign-Master.ps1 -ComputerName "devtest" -CredentialFile ".\creds.xml" -ArtifactPath "C:\Artifacts\WeSign_latest.zip" -Environment "DevTest"

.NOTES
    Author: QA Intelligence Platform
    Version: 1.0
    Created: 2025-09-26

    Prerequisites:
    - PowerShell 5.1 or later
    - WebAdministration module
    - WinRM configured for HTTPS (port 5986)
    - Appropriate permissions on target server
    - Network connectivity to target server
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, HelpMessage = "Target server hostname or IP address")]
    [string]$ComputerName,

    [Parameter(Mandatory = $false, HelpMessage = "Domain username (will prompt for password if no credential file)")]
    [string]$Username,

    [Parameter(Mandatory = $true, HelpMessage = "Path to WeSign deployment artifact (ZIP file)")]
    [ValidateScript({Test-Path $_})]
    [string]$ArtifactPath,

    [Parameter(Mandatory = $false, HelpMessage = "Target environment")]
    [ValidateSet('DevTest', 'Staging', 'Production')]
    [string]$Environment = 'DevTest',

    [Parameter(Mandatory = $false, HelpMessage = "Path to encrypted credential file")]
    [string]$CredentialFile,

    [Parameter(Mandatory = $false, HelpMessage = "Skip backup creation")]
    [switch]$SkipBackup,

    [Parameter(Mandatory = $false, HelpMessage = "Skip smoke test execution")]
    [switch]$SkipSmokeTests,

    [Parameter(Mandatory = $false, HelpMessage = "QA Intelligence backend URL")]
    [string]$QAIntelligenceUrl = "http://localhost:8082",

    [Parameter(Mandatory = $false, HelpMessage = "Deployment configuration file")]
    [string]$ConfigFile
)

# Set strict mode and error handling
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Import all required modules
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

try {
    . (Join-Path $scriptRoot "winrm_session.ps1")
    . (Join-Path $scriptRoot "iis_pools.ps1")
    . (Join-Path $scriptRoot "deploy_wesign.ps1")
    . (Join-Path $scriptRoot "smoke_tests.ps1")
    . (Join-Path $scriptRoot "config_transform.ps1")

    Write-DeploymentLog "All deployment modules loaded successfully"
}
catch {
    Write-Error "Failed to load required modules: $($_.Exception.Message)"
    exit 1
}

# Global deployment tracking
$Global:DeploymentSession = @{
    StartTime = Get-Date
    DeploymentId = "wesign_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    ComputerName = $ComputerName
    Environment = $Environment
    ArtifactPath = $ArtifactPath
    Status = 'Started'
    Steps = @()
    Session = $null
}

function Write-DeploymentHeader {
    <#
    .SYNOPSIS
        Writes deployment header with system information
    #>

    $header = @"

================================================================================
                       WeSign Deployment - Master Script
================================================================================

Deployment ID:    $($Global:DeploymentSession.DeploymentId)
Start Time:       $($Global:DeploymentSession.StartTime.ToString('yyyy-MM-dd HH:mm:ss'))
Target Server:    $ComputerName
Environment:      $Environment
Artifact:         $ArtifactPath
PowerShell:       $($PSVersionTable.PSVersion)
User Context:     $($env:USERDOMAIN)\$($env:USERNAME)

================================================================================

"@

    Write-Host $header -ForegroundColor Cyan
    Write-DeploymentLog "WeSign Master Deployment Started - ID: $($Global:DeploymentSession.DeploymentId)"
}

function Get-DeploymentCredentials {
    <#
    .SYNOPSIS
        Gets or prompts for deployment credentials
    #>

    if ($CredentialFile -and (Test-Path $CredentialFile)) {
        try {
            Write-DeploymentLog "Loading credentials from file: $CredentialFile"
            $credentials = Import-Clixml -Path $CredentialFile

            if ($credentials -is [PSCredential]) {
                Write-DeploymentLog "Credentials loaded successfully from file"
                return $credentials
            }
            else {
                throw "Invalid credential format in file"
            }
        }
        catch {
            Write-DeploymentLog "Failed to load credential file: $($_.Exception.Message)" -Level Warning
            Write-DeploymentLog "Falling back to manual credential entry"
        }
    }

    if ($Username) {
        Write-DeploymentLog "Prompting for password for user: $Username"
        $securePassword = Read-Host -Prompt "Enter password for $Username" -AsSecureString
        return New-Object PSCredential($Username, $securePassword)
    }
    else {
        Write-DeploymentLog "Prompting for complete credentials"
        return Get-Credential -Message "Enter credentials for target server $ComputerName"
    }
}

function Save-DeploymentCredentials {
    <#
    .SYNOPSIS
        Offers to save credentials for future use
    #>
    param(
        [Parameter(Mandatory = $true)]
        [PSCredential]$Credential
    )

    if (-not $CredentialFile) {
        $save = Read-Host -Prompt "Save credentials for future deployments? (y/n)"
        if ($save -eq 'y' -or $save -eq 'Y') {
            $saveFile = ".\creds_$($ComputerName)_$(Get-Date -Format 'yyyyMMdd').xml"
            try {
                $Credential | Export-Clixml -Path $saveFile
                Write-DeploymentLog "Credentials saved to: $saveFile"
                Write-Host "Credentials saved to: $saveFile" -ForegroundColor Green
            }
            catch {
                Write-DeploymentLog "Failed to save credentials: $($_.Exception.Message)" -Level Warning
            }
        }
    }
}

function Test-DeploymentPrerequisites {
    <#
    .SYNOPSIS
        Tests deployment prerequisites
    #>

    Write-DeploymentLog "Testing deployment prerequisites"

    $prerequisites = @{
        'PowerShell Version' = @{
            Test = { $PSVersionTable.PSVersion.Major -ge 5 }
            Error = "PowerShell 5.1 or later required"
        }
        'WebAdministration Module' = @{
            Test = { Get-Module -ListAvailable WebAdministration }
            Error = "WebAdministration module not available"
        }
        'Artifact File' = @{
            Test = { Test-Path $ArtifactPath }
            Error = "Artifact file not found: $ArtifactPath"
        }
        'Admin Rights' = @{
            Test = { ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
            Error = "Script must be run as Administrator"
        }
        'WinRM Service' = @{
            Test = { (Get-Service WinRM).Status -eq 'Running' }
            Error = "WinRM service is not running"
        }
    }

    $failed = @()

    foreach ($prereq in $prerequisites.GetEnumerator()) {
        $name = $prereq.Key
        $test = $prereq.Value.Test
        $error = $prereq.Value.Error

        try {
            if (& $test) {
                Write-DeploymentLog "✓ $name"
            }
            else {
                Write-DeploymentLog "✗ $name - $error" -Level Error
                $failed += $error
            }
        }
        catch {
            Write-DeploymentLog "✗ $name - Test failed: $($_.Exception.Message)" -Level Error
            $failed += "$error (Test failed)"
        }
    }

    if ($failed.Count -gt 0) {
        throw "Prerequisites failed: $($failed -join '; ')"
    }

    Write-DeploymentLog "All prerequisites passed"
}

function Add-DeploymentStep {
    <#
    .SYNOPSIS
        Adds a step to the deployment tracking
    #>
    param(
        [Parameter(Mandatory = $true)]
        [string]$StepName,

        [Parameter(Mandatory = $true)]
        [string]$Status,

        [Parameter(Mandatory = $false)]
        [string]$Details,

        [Parameter(Mandatory = $false)]
        [timespan]$Duration
    )

    $step = @{
        Name = $StepName
        Status = $Status
        Timestamp = Get-Date
        Details = $Details
        Duration = $Duration
    }

    $Global:DeploymentSession.Steps += $step
    $Global:DeploymentSession.Status = $Status

    # Send status update to QA Intelligence if URL provided
    if ($QAIntelligenceUrl) {
        try {
            $payload = @{
                deploymentId = $Global:DeploymentSession.DeploymentId
                step = $StepName
                status = $Status
                timestamp = $step.Timestamp.ToString('o')
                details = $Details
                environment = $Environment
                computer = $ComputerName
            }

            $jsonPayload = $payload | ConvertTo-Json
            Invoke-RestMethod -Uri "$QAIntelligenceUrl/api/deployment/step" -Method POST -Body $jsonPayload -ContentType "application/json" -TimeoutSec 10 -ErrorAction SilentlyContinue
        }
        catch {
            # Silently continue if QA Intelligence is not available
        }
    }
}

function Write-DeploymentSummary {
    <#
    .SYNOPSIS
        Writes deployment summary and results
    #>
    param(
        [Parameter(Mandatory = $true)]
        [bool]$Success,

        [Parameter(Mandatory = $false)]
        [string]$Error
    )

    $endTime = Get-Date
    $duration = $endTime - $Global:DeploymentSession.StartTime

    $summary = @"

================================================================================
                       WeSign Deployment - Summary
================================================================================

Deployment ID:    $($Global:DeploymentSession.DeploymentId)
Status:           $(if($Success) { 'SUCCESS' } else { 'FAILED' })
Start Time:       $($Global:DeploymentSession.StartTime.ToString('yyyy-MM-dd HH:mm:ss'))
End Time:         $($endTime.ToString('yyyy-MM-dd HH:mm:ss'))
Duration:         $($duration.ToString('hh\:mm\:ss'))
Target Server:    $ComputerName
Environment:      $Environment

Steps Completed:  $($Global:DeploymentSession.Steps.Count)
"@

    if ($Error) {
        $summary += "`nError: $Error"
    }

    $summary += "`n`nStep Details:"
    foreach ($step in $Global:DeploymentSession.Steps) {
        $summary += "`n  [$($step.Timestamp.ToString('HH:mm:ss'))] $($step.Name): $($step.Status)"
        if ($step.Details) {
            $summary += " - $($step.Details)"
        }
        if ($step.Duration) {
            $summary += " ($($step.Duration.TotalSeconds)s)"
        }
    }

    $summary += "`n`n================================================================================"

    if ($Success) {
        Write-Host $summary -ForegroundColor Green
    }
    else {
        Write-Host $summary -ForegroundColor Red
    }

    Write-DeploymentLog "Deployment Summary - Success: $Success, Duration: $($duration.ToString()), Steps: $($Global:DeploymentSession.Steps.Count)"
}

# Main deployment execution
try {
    Write-DeploymentHeader

    # Test prerequisites
    Add-DeploymentStep -StepName "Prerequisites" -Status "Running"
    $prereqStart = Get-Date
    Test-DeploymentPrerequisites
    $prereqDuration = (Get-Date) - $prereqStart
    Add-DeploymentStep -StepName "Prerequisites" -Status "Completed" -Details "All checks passed" -Duration $prereqDuration

    # Get credentials
    Add-DeploymentStep -StepName "Authentication" -Status "Running"
    $authStart = Get-Date
    $credentials = Get-DeploymentCredentials
    Save-DeploymentCredentials -Credential $credentials
    $authDuration = (Get-Date) - $authStart
    Add-DeploymentStep -StepName "Authentication" -Status "Completed" -Details "Credentials obtained" -Duration $authDuration

    # Initialize WinRM environment
    Add-DeploymentStep -StepName "WinRM Initialization" -Status "Running"
    $winrmStart = Get-Date
    $winrmInit = Initialize-WinRMEnvironment
    if (-not $winrmInit) {
        throw "WinRM environment initialization failed"
    }
    $winrmDuration = (Get-Date) - $winrmStart
    Add-DeploymentStep -StepName "WinRM Initialization" -Status "Completed" -Details "WinRM configured" -Duration $winrmDuration

    # Test connectivity
    Add-DeploymentStep -StepName "Connectivity Test" -Status "Running"
    $connStart = Get-Date
    $connTest = Test-WinRMConnectivity -ComputerName $ComputerName -Credential $credentials
    if (-not $connTest.Success) {
        throw "Connectivity test failed: $($connTest.Error)"
    }
    $connDuration = (Get-Date) - $connStart
    Add-DeploymentStep -StepName "Connectivity Test" -Status "Completed" -Details "Connection verified" -Duration $connDuration

    # Create secure session
    Add-DeploymentStep -StepName "Session Creation" -Status "Running"
    $sessionStart = Get-Date
    $Global:DeploymentSession.Session = New-SecureWinRMSession -ComputerName $ComputerName -Credential $credentials
    $sessionDuration = (Get-Date) - $sessionStart
    Add-DeploymentStep -StepName "Session Creation" -Status "Completed" -Details "Secure session established" -Duration $sessionDuration

    # Execute deployment
    Add-DeploymentStep -StepName "WeSign Deployment" -Status "Running"
    $deployStart = Get-Date

    # Create the deployment parameters
    $deployParams = @{
        ComputerName = $ComputerName
        Credential = $credentials
        ArtifactPath = $ArtifactPath
        DeploymentEnvironment = $Environment
        QAIntelligenceUrl = $QAIntelligenceUrl
    }

    if ($SkipBackup) { $deployParams.SkipBackup = $true }
    if ($SkipSmokeTests) { $deployParams.SkipSmokeTests = $true }

    # Execute the main deployment
    $deploymentResult = Start-WeSignDeployment @deployParams

    $deployDuration = (Get-Date) - $deployStart
    Add-DeploymentStep -StepName "WeSign Deployment" -Status "Completed" -Details "Deployment successful" -Duration $deployDuration

    # Final success status
    Add-DeploymentStep -StepName "Deployment Complete" -Status "Success" -Details "All operations completed successfully"

    Write-DeploymentSummary -Success $true

    Write-Host "`n🎉 WeSign deployment completed successfully! 🎉" -ForegroundColor Green
    Write-Host "Target Server: $ComputerName" -ForegroundColor Green
    Write-Host "Environment: $Environment" -ForegroundColor Green

    if ($deploymentResult.BackupPath) {
        Write-Host "Backup Location: $($deploymentResult.BackupPath)" -ForegroundColor Green
    }

    exit 0
}
catch {
    $errorMessage = $_.Exception.Message

    Add-DeploymentStep -StepName "Deployment Failed" -Status "Error" -Details $errorMessage

    Write-DeploymentSummary -Success $false -Error $errorMessage

    Write-Host "`n💥 WeSign deployment failed! 💥" -ForegroundColor Red
    Write-Host "Error: $errorMessage" -ForegroundColor Red
    Write-Host "Check the deployment logs for more details." -ForegroundColor Red

    # Attempt emergency cleanup if session exists
    if ($Global:DeploymentSession.Session) {
        try {
            Write-Host "`nAttempting to restart application pools..." -ForegroundColor Yellow
            Start-WeSignAppPools -Session $Global:DeploymentSession.Session -SkipHealthCheck
            Write-Host "Application pools restarted." -ForegroundColor Yellow
        }
        catch {
            Write-Host "Failed to restart application pools: $($_.Exception.Message)" -ForegroundColor Red
        }
    }

    exit 1
}
finally {
    # Cleanup session
    if ($Global:DeploymentSession.Session) {
        try {
            Remove-SecureWinRMSession -Session $Global:DeploymentSession.Session
            Write-DeploymentLog "WinRM session cleaned up"
        }
        catch {
            Write-DeploymentLog "Failed to cleanup WinRM session: $($_.Exception.Message)" -Level Warning
        }
    }

    # Final status update to QA Intelligence
    if ($QAIntelligenceUrl) {
        try {
            $finalPayload = @{
                deploymentId = $Global:DeploymentSession.DeploymentId
                status = $Global:DeploymentSession.Status
                endTime = (Get-Date).ToString('o')
                duration = ((Get-Date) - $Global:DeploymentSession.StartTime).ToString()
                steps = $Global:DeploymentSession.Steps
            }

            $jsonPayload = $finalPayload | ConvertTo-Json -Depth 3
            Invoke-RestMethod -Uri "$QAIntelligenceUrl/api/deployment/complete" -Method POST -Body $jsonPayload -ContentType "application/json" -TimeoutSec 10 -ErrorAction SilentlyContinue
        }
        catch {
            # Silently continue if QA Intelligence is not available
        }
    }

    Write-DeploymentLog "WeSign Master Deployment completed"
}