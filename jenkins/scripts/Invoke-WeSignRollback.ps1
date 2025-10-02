<#
.SYNOPSIS
    WeSign Application Rollback Script for Emergency Recovery

.DESCRIPTION
    Emergency rollback script for WeSign application deployments.
    Can restore from automatic backups or perform manual rollback procedures.
    Integrates with QA Intelligence backend for status reporting and audit trails.

.PARAMETER BackupPath
    Path to backup ZIP file for restoration

.PARAMETER TargetPath
    Target deployment directory (e.g., C:\inetpub\wwwroot\WeSign)

.PARAMETER IISSite
    IIS Site name

.PARAMETER IISAppPool
    IIS Application Pool name

.PARAMETER RollbackReason
    Reason for rollback (for audit trail)

.PARAMETER QABackendUrl
    QA Intelligence backend URL for status reporting

.PARAMETER ExecutionId
    QA Intelligence execution ID for tracking

.PARAMETER Force
    Force rollback even if health checks pass

.EXAMPLE
    .\Invoke-WeSignRollback.ps1 -BackupPath "C:\Backups\WeSign\wesign-backup-20251226-143022.zip" -TargetPath "C:\inetpub\wwwroot\WeSign" -IISSite "WeSign" -IISAppPool "WeSignAppPool" -RollbackReason "Critical bug in production"

.NOTES
    Version: 2.0
    Author: DevOps Team
    Last Updated: 2025-09-26
    Requires: PowerShell 5.1+, IIS Management Module
#>

[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory = $false)]
    [string]$BackupPath,

    [Parameter(Mandatory = $true)]
    [string]$TargetPath,

    [Parameter(Mandatory = $true)]
    [string]$IISSite,

    [Parameter(Mandatory = $true)]
    [string]$IISAppPool,

    [Parameter(Mandatory = $true)]
    [string]$RollbackReason,

    [Parameter(Mandatory = $false)]
    [string]$QABackendUrl,

    [Parameter(Mandatory = $false)]
    [string]$ExecutionId,

    [Parameter(Mandatory = $false)]
    [switch]$Force,

    [Parameter(Mandatory = $false)]
    [switch]$DryRun,

    [Parameter(Mandatory = $false)]
    [int]$TimeoutSeconds = 300
)

# Import required modules
Import-Module WebAdministration -ErrorAction Stop

# Global variables
$script:StartTime = Get-Date
$script:LogFile = Join-Path $env:TEMP "WeSign-Rollback-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
$script:RollbackId = [System.Guid]::NewGuid().ToString()

#region Logging Functions

function Write-RollbackLog {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message,

        [Parameter(Mandatory = $false)]
        [ValidateSet('INFO', 'WARNING', 'ERROR', 'DEBUG', 'SUCCESS')]
        [string]$Level = 'INFO'
    )

    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $logEntry = "[$timestamp] [$Level] [ROLLBACK-$($script:RollbackId.Substring(0,8))] $Message"

    # Output to console with color coding
    switch ($Level) {
        'INFO'    { Write-Host $logEntry -ForegroundColor White }
        'SUCCESS' { Write-Host $logEntry -ForegroundColor Green }
        'WARNING' { Write-Host $logEntry -ForegroundColor Yellow }
        'ERROR'   { Write-Host $logEntry -ForegroundColor Red }
        'DEBUG'   { Write-Host $logEntry -ForegroundColor Cyan }
    }

    # Write to log file
    Add-Content -Path $script:LogFile -Value $logEntry -ErrorAction SilentlyContinue
}

#endregion

#region QA Intelligence Integration

function Report-RollbackStatus {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Stage,

        [Parameter(Mandatory = $true)]
        [ValidateSet('running', 'completed', 'failed')]
        [string]$Status,

        [Parameter(Mandatory = $false)]
        [string]$Message = '',

        [Parameter(Mandatory = $false)]
        [hashtable]$Metadata = @{}
    )

    if (-not $QABackendUrl) {
        Write-RollbackLog "QA Backend reporting skipped - no URL provided" -Level 'DEBUG'
        return
    }

    try {
        $payload = @{
            rollbackId = $script:RollbackId
            executionId = $ExecutionId
            stage = $Stage
            status = $Status
            message = $Message
            reason = $RollbackReason
            timestamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
            metadata = $Metadata
        } | ConvertTo-Json -Depth 3

        $headers = @{
            'Content-Type' = 'application/json'
        }

        # Create custom rollback reporting endpoint
        $uri = "$QABackendUrl/api/wesign/unified/rollback"

        Invoke-RestMethod -Uri $uri -Method POST -Body $payload -Headers $headers -TimeoutSec 15 -ErrorAction Stop

        Write-RollbackLog "Rollback status reported to QA Intelligence: $Stage - $Status" -Level 'DEBUG'

    } catch {
        Write-RollbackLog "Failed to report rollback status: $($_.Exception.Message)" -Level 'WARNING'
    }
}

#endregion

#region Backup Discovery

function Find-LatestBackup {
    Write-RollbackLog "Searching for latest backup..."

    $backupDir = "C:\Backups\WeSign"
    if (-not (Test-Path $backupDir)) {
        throw "Backup directory not found: $backupDir"
    }

    $backupFiles = Get-ChildItem -Path $backupDir -Filter "wesign-backup-*.zip" | Sort-Object CreationTime -Descending

    if ($backupFiles.Count -eq 0) {
        throw "No backup files found in $backupDir"
    }

    $latestBackup = $backupFiles[0]
    Write-RollbackLog "Latest backup found: $($latestBackup.FullName) (Created: $($latestBackup.CreationTime))"

    return $latestBackup.FullName
}

function Get-BackupInfo {
    param([string]$BackupFile)

    if (-not (Test-Path $BackupFile)) {
        throw "Backup file not found: $BackupFile"
    }

    $fileInfo = Get-Item $BackupFile
    $backupInfo = @{
        Path = $BackupFile
        Size = $fileInfo.Length
        Created = $fileInfo.CreationTime
        Modified = $fileInfo.LastWriteTime
        SizeMB = [math]::Round($fileInfo.Length / 1MB, 2)
    }

    # Try to extract metadata from filename
    if ($BackupFile -match 'wesign-backup-(\d{8}-\d{6})') {
        $backupInfo.BackupDate = [DateTime]::ParseExact($Matches[1], 'yyyyMMdd-HHmmss', $null)
    }

    Write-RollbackLog "Backup Info: Size: $($backupInfo.SizeMB) MB, Created: $($backupInfo.Created)"

    return $backupInfo
}

#endregion

#region Pre-Rollback Validation

function Test-RollbackPreconditions {
    Write-RollbackLog "Validating rollback preconditions..."
    Report-RollbackStatus -Stage 'validation' -Status 'running' -Message 'Validating rollback preconditions'

    $issues = @()

    # Check if running as administrator
    $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        $issues += "Script must be run as Administrator"
    }

    # Check IIS site and app pool existence
    try {
        $site = Get-Website -Name $IISSite -ErrorAction Stop
        $appPool = Get-IISAppPool -Name $IISAppPool -ErrorAction Stop
        Write-RollbackLog "IIS Site '$IISSite' and App Pool '$IISAppPool' found"
    } catch {
        $issues += "IIS Site '$IISSite' or Application Pool '$IISAppPool' not found"
    }

    # Check target path
    if (-not (Test-Path $TargetPath)) {
        $issues += "Target path does not exist: $TargetPath"
    }

    # Validate backup file if provided
    if ($BackupPath) {
        if (-not (Test-Path $BackupPath)) {
            $issues += "Backup file not found: $BackupPath"
        } else {
            try {
                # Test ZIP file integrity
                Add-Type -AssemblyName System.IO.Compression.FileSystem
                $zip = [System.IO.Compression.ZipFile]::OpenRead($BackupPath)
                $zip.Dispose()
                Write-RollbackLog "Backup file integrity validated"
            } catch {
                $issues += "Backup file is corrupted or invalid: $BackupPath"
            }
        }
    }

    # Check disk space
    $drive = (Split-Path $TargetPath -Qualifier)
    $diskSpace = Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='$drive'"
    $freeSpaceGB = [math]::Round($diskSpace.FreeSpace / 1GB, 2)
    $requiredSpaceGB = 1.0

    if ($freeSpaceGB -lt $requiredSpaceGB) {
        $issues += "Insufficient disk space: ${freeSpaceGB}GB available, ${requiredSpaceGB}GB required"
    }

    if ($issues.Count -gt 0) {
        $errorMessage = "Rollback precondition validation failed:`n" + ($issues -join "`n")
        Write-RollbackLog $errorMessage -Level 'ERROR'
        Report-RollbackStatus -Stage 'validation' -Status 'failed' -Message $errorMessage
        throw $errorMessage
    }

    Write-RollbackLog "All rollback preconditions validated successfully" -Level 'SUCCESS'
    Report-RollbackStatus -Stage 'validation' -Status 'completed' -Message 'Rollback preconditions validated'
}

#endregion

#region Current State Assessment

function Get-CurrentDeploymentInfo {
    Write-RollbackLog "Assessing current deployment state..."

    $deploymentInfo = @{
        TargetPath = $TargetPath
        Exists = Test-Path $TargetPath
        Files = @()
        ConfigFiles = @()
        Size = 0
        LastModified = $null
    }

    if ($deploymentInfo.Exists) {
        try {
            # Get deployment files info
            $files = Get-ChildItem -Path $TargetPath -Recurse -File
            $deploymentInfo.Files = $files.Count
            $deploymentInfo.Size = ($files | Measure-Object -Property Length -Sum).Sum
            $deploymentInfo.LastModified = ($files | Sort-Object LastWriteTime -Descending | Select-Object -First 1).LastWriteTime

            # Find configuration files
            $configFiles = $files | Where-Object { $_.Extension -in @('.config', '.json', '.xml') }
            $deploymentInfo.ConfigFiles = $configFiles.Count

            Write-RollbackLog "Current deployment: $($deploymentInfo.Files) files, $([math]::Round($deploymentInfo.Size / 1MB, 2)) MB"
            Write-RollbackLog "Last modified: $($deploymentInfo.LastModified)"

        } catch {
            Write-RollbackLog "Failed to assess current deployment: $($_.Exception.Message)" -Level 'WARNING'
        }
    } else {
        Write-RollbackLog "No current deployment found at $TargetPath" -Level 'INFO'
    }

    return $deploymentInfo
}

function Test-CurrentApplicationHealth {
    Write-RollbackLog "Testing current application health..."

    try {
        # Simple health check
        $healthUrl = "https://localhost/health"
        $response = Invoke-WebRequest -Uri $healthUrl -TimeoutSec 30 -UseBasicParsing -ErrorAction Stop

        if ($response.StatusCode -eq 200) {
            Write-RollbackLog "Current application is healthy (HTTP 200)" -Level 'INFO'
            return $true
        } else {
            Write-RollbackLog "Current application health check failed (HTTP $($response.StatusCode))" -Level 'WARNING'
            return $false
        }

    } catch {
        Write-RollbackLog "Current application is not responding: $($_.Exception.Message)" -Level 'WARNING'
        return $false
    }
}

#endregion

#region Rollback Execution

function Stop-IISServices {
    Write-RollbackLog "Stopping IIS services..."
    Report-RollbackStatus -Stage 'stop_services' -Status 'running' -Message 'Stopping IIS services'

    try {
        if ($DryRun) {
            Write-RollbackLog "[DRY RUN] Would stop Application Pool '$IISAppPool'"
            return
        }

        # Stop application pool
        Stop-WebAppPool -Name $IISAppPool

        # Wait for app pool to stop
        $timeout = 30
        $elapsed = 0

        do {
            Start-Sleep -Seconds 2
            $elapsed += 2
            $state = (Get-IISAppPool -Name $IISAppPool).State
            Write-Progress -Activity "Stopping IIS Services" -Status "App Pool State: $state" -PercentComplete (($elapsed / $timeout) * 100)
        } while ($state -ne 'Stopped' -and $elapsed -lt $timeout)

        if ($state -ne 'Stopped') {
            throw "Application pool did not stop within timeout"
        }

        Write-RollbackLog "IIS services stopped successfully" -Level 'SUCCESS'
        Report-RollbackStatus -Stage 'stop_services' -Status 'completed' -Message 'IIS services stopped'

    } catch {
        $errorMessage = "Failed to stop IIS services: $($_.Exception.Message)"
        Write-RollbackLog $errorMessage -Level 'ERROR'
        Report-RollbackStatus -Stage 'stop_services' -Status 'failed' -Message $errorMessage
        throw $errorMessage
    } finally {
        Write-Progress -Activity "Stopping IIS Services" -Completed
    }
}

function Backup-CurrentDeployment {
    Write-RollbackLog "Creating backup of current deployment before rollback..."

    try {
        $preRollbackBackupDir = "C:\Backups\WeSign\PreRollback"
        if (-not (Test-Path $preRollbackBackupDir)) {
            New-Item -ItemType Directory -Path $preRollbackBackupDir -Force | Out-Null
        }

        $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $backupPath = Join-Path $preRollbackBackupDir "pre-rollback-backup-$timestamp.zip"

        if ($DryRun) {
            Write-RollbackLog "[DRY RUN] Would create pre-rollback backup: $backupPath"
            return $null
        }

        if (Test-Path $TargetPath) {
            Add-Type -AssemblyName System.IO.Compression.FileSystem
            [System.IO.Compression.ZipFile]::CreateFromDirectory($TargetPath, $backupPath)

            $backupSize = (Get-Item $backupPath).Length
            Write-RollbackLog "Pre-rollback backup created: $backupPath ($([math]::Round($backupSize / 1MB, 2)) MB)" -Level 'SUCCESS'

            return $backupPath
        } else {
            Write-RollbackLog "No current deployment to backup"
            return $null
        }

    } catch {
        Write-RollbackLog "Failed to create pre-rollback backup: $($_.Exception.Message)" -Level 'WARNING'
        # Don't fail the rollback for backup issues
        return $null
    }
}

function Restore-FromBackup {
    param([string]$BackupFile)

    Write-RollbackLog "Restoring from backup: $BackupFile"
    Report-RollbackStatus -Stage 'restore' -Status 'running' -Message "Restoring from backup: $(Split-Path $BackupFile -Leaf)"

    try {
        if ($DryRun) {
            Write-RollbackLog "[DRY RUN] Would restore from backup: $BackupFile"
            return
        }

        # Remove current deployment
        if (Test-Path $TargetPath) {
            Write-RollbackLog "Removing current deployment..."
            Remove-Item -Path $TargetPath -Recurse -Force
        }

        # Extract backup
        Write-Progress -Activity "Restoring from Backup" -Status "Extracting files..." -PercentComplete 50

        Add-Type -AssemblyName System.IO.Compression.FileSystem
        [System.IO.Compression.ZipFile]::ExtractToDirectory($BackupFile, $TargetPath)

        Write-Progress -Activity "Restoring from Backup" -Status "Restore completed" -PercentComplete 100

        # Verify restoration
        if (Test-Path $TargetPath) {
            $restoredFiles = (Get-ChildItem -Path $TargetPath -Recurse -File).Count
            Write-RollbackLog "Restoration completed: $restoredFiles files restored" -Level 'SUCCESS'
        } else {
            throw "Target path does not exist after restoration"
        }

        Report-RollbackStatus -Stage 'restore' -Status 'completed' -Message 'Backup restoration completed'

    } catch {
        $errorMessage = "Backup restoration failed: $($_.Exception.Message)"
        Write-RollbackLog $errorMessage -Level 'ERROR'
        Report-RollbackStatus -Stage 'restore' -Status 'failed' -Message $errorMessage
        throw $errorMessage
    } finally {
        Write-Progress -Activity "Restoring from Backup" -Completed
    }
}

function Start-IISServices {
    Write-RollbackLog "Starting IIS services..."
    Report-RollbackStatus -Stage 'start_services' -Status 'running' -Message 'Starting IIS services'

    try {
        if ($DryRun) {
            Write-RollbackLog "[DRY RUN] Would start Application Pool '$IISAppPool'"
            return
        }

        # Start application pool
        Start-WebAppPool -Name $IISAppPool

        # Wait for app pool to start
        $timeout = 60
        $elapsed = 0

        do {
            Start-Sleep -Seconds 2
            $elapsed += 2
            $state = (Get-IISAppPool -Name $IISAppPool).State
            Write-Progress -Activity "Starting IIS Services" -Status "App Pool State: $state" -PercentComplete (($elapsed / $timeout) * 100)
        } while ($state -ne 'Started' -and $elapsed -lt $timeout)

        if ($state -ne 'Started') {
            throw "Application pool did not start within timeout"
        }

        Write-RollbackLog "IIS services started successfully" -Level 'SUCCESS'
        Report-RollbackStatus -Stage 'start_services' -Status 'completed' -Message 'IIS services started'

    } catch {
        $errorMessage = "Failed to start IIS services: $($_.Exception.Message)"
        Write-RollbackLog $errorMessage -Level 'ERROR'
        Report-RollbackStatus -Stage 'start_services' -Status 'failed' -Message $errorMessage
        throw $errorMessage
    } finally {
        Write-Progress -Activity "Starting IIS Services" -Completed
    }
}

function Test-RollbackSuccess {
    Write-RollbackLog "Verifying rollback success..."
    Report-RollbackStatus -Stage 'verification' -Status 'running' -Message 'Verifying rollback success'

    try {
        # Wait a moment for services to fully initialize
        Start-Sleep -Seconds 10

        # Test application health
        $healthPassed = $false
        $maxAttempts = 5
        $attempts = 0

        do {
            $attempts++
            Write-RollbackLog "Health check attempt $attempts of $maxAttempts..."

            try {
                $healthUrl = "https://localhost/health"
                $response = Invoke-WebRequest -Uri $healthUrl -TimeoutSec 30 -UseBasicParsing -ErrorAction Stop

                if ($response.StatusCode -eq 200) {
                    $healthPassed = $true
                    Write-RollbackLog "✅ Application health check passed" -Level 'SUCCESS'
                    break
                }
            } catch {
                Write-RollbackLog "Health check attempt $attempts failed: $($_.Exception.Message)" -Level 'WARNING'
                if ($attempts -lt $maxAttempts) {
                    Start-Sleep -Seconds 15
                }
            }

        } while ($attempts -lt $maxAttempts)

        if ($healthPassed) {
            Write-RollbackLog "Rollback verification successful" -Level 'SUCCESS'
            Report-RollbackStatus -Stage 'verification' -Status 'completed' -Message 'Rollback verification successful'
            return $true
        } else {
            $errorMessage = "Rollback verification failed: Application health checks did not pass"
            Write-RollbackLog $errorMessage -Level 'ERROR'
            Report-RollbackStatus -Stage 'verification' -Status 'failed' -Message $errorMessage
            return $false
        }

    } catch {
        $errorMessage = "Rollback verification failed: $($_.Exception.Message)"
        Write-RollbackLog $errorMessage -Level 'ERROR'
        Report-RollbackStatus -Stage 'verification' -Status 'failed' -Message $errorMessage
        return $false
    }
}

#endregion

#region Main Rollback Logic

function Start-RollbackProcess {
    Write-RollbackLog "Starting WeSign rollback process..."
    Write-RollbackLog "Rollback ID: $script:RollbackId"
    Write-RollbackLog "Target Path: $TargetPath"
    Write-RollbackLog "IIS Site: $IISSite"
    Write-RollbackLog "IIS App Pool: $IISAppPool"
    Write-RollbackLog "Reason: $RollbackReason"
    Write-RollbackLog "Dry Run: $DryRun"

    Report-RollbackStatus -Stage 'started' -Status 'running' -Message 'Rollback process started' -Metadata @{
        rollbackId = $script:RollbackId
        targetPath = $TargetPath
        iisSite = $IISSite
        iisAppPool = $IISAppPool
        reason = $RollbackReason
        dryRun = $DryRun
    }

    try {
        # Phase 1: Validation
        Test-RollbackPreconditions

        # Phase 2: Determine backup source
        if (-not $BackupPath) {
            $BackupPath = Find-LatestBackup
            Write-RollbackLog "Using latest backup: $BackupPath"
        }

        $backupInfo = Get-BackupInfo -BackupFile $BackupPath

        # Phase 3: Assess current state
        $currentInfo = Get-CurrentDeploymentInfo
        $currentHealthy = Test-CurrentApplicationHealth

        # Phase 4: Confirm rollback necessity
        if ($currentHealthy -and -not $Force) {
            Write-RollbackLog "Current application appears healthy. Use -Force to proceed with rollback." -Level 'WARNING'

            if (-not $DryRun) {
                $confirmation = Read-Host "Current application is healthy. Continue with rollback? (y/N)"
                if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
                    Write-RollbackLog "Rollback cancelled by user" -Level 'INFO'
                    return @{ Success = $false; Cancelled = $true; Message = "Rollback cancelled - application appears healthy" }
                }
            }
        }

        # Phase 5: Create pre-rollback backup
        $preRollbackBackup = Backup-CurrentDeployment

        # Phase 6: Execute rollback
        Stop-IISServices
        Restore-FromBackup -BackupFile $BackupPath
        Start-IISServices

        # Phase 7: Verify rollback
        $verificationPassed = Test-RollbackSuccess

        # Phase 8: Success reporting
        $duration = (Get-Date) - $script:StartTime

        if ($verificationPassed) {
            Write-RollbackLog "✅ Rollback completed successfully in $($duration.TotalMinutes.ToString('F2')) minutes" -Level 'SUCCESS'

            Report-RollbackStatus -Stage 'completed' -Status 'completed' -Message 'Rollback completed successfully' -Metadata @{
                duration = $duration.TotalSeconds
                backupUsed = $BackupPath
                preRollbackBackup = $preRollbackBackup
                verificationPassed = $verificationPassed
            }

            return @{
                Success = $true
                Duration = $duration
                BackupUsed = $BackupPath
                PreRollbackBackup = $preRollbackBackup
                VerificationPassed = $verificationPassed
            }
        } else {
            Write-RollbackLog "⚠️  Rollback completed but verification failed" -Level 'WARNING'

            Report-RollbackStatus -Stage 'completed' -Status 'completed' -Message 'Rollback completed but verification failed' -Metadata @{
                duration = $duration.TotalSeconds
                verificationPassed = $verificationPassed
            }

            return @{
                Success = $true
                Duration = $duration
                BackupUsed = $BackupPath
                VerificationPassed = $verificationPassed
                Warning = "Verification failed"
            }
        }

    } catch {
        $duration = (Get-Date) - $script:StartTime
        $errorMessage = "Rollback failed: $($_.Exception.Message)"
        Write-RollbackLog $errorMessage -Level 'ERROR'

        Report-RollbackStatus -Stage 'failed' -Status 'failed' -Message $errorMessage -Metadata @{
            duration = $duration.TotalSeconds
            error = $_.Exception.Message
        }

        return @{
            Success = $false
            Error = $_.Exception.Message
            Duration = $duration
        }
    }
}

#endregion

#region Script Execution

# Main execution
try {
    Write-RollbackLog "WeSign Rollback Script v2.0 Starting..." -Level 'INFO'
    Write-RollbackLog "Log file: $script:LogFile" -Level 'INFO'

    # Confirmation prompt for non-dry runs
    if (-not $DryRun) {
        Write-Host "`n⚠️  WARNING: This will rollback the WeSign application deployment!" -ForegroundColor Red -BackgroundColor Yellow
        Write-Host "Reason: $RollbackReason" -ForegroundColor Yellow
        Write-Host "Target: $TargetPath" -ForegroundColor Yellow

        if (-not $Force) {
            $confirmation = Read-Host "`nDo you want to proceed? (y/N)"
            if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
                Write-RollbackLog "Rollback cancelled by user" -Level 'INFO'
                exit 0
            }
        }
    }

    $result = Start-RollbackProcess

    if ($result.Success) {
        if ($result.Cancelled) {
            Write-RollbackLog "ℹ️  $($result.Message)" -Level 'INFO'
            exit 0
        } elseif ($result.Warning) {
            Write-RollbackLog "⚠️  Rollback completed with warnings: $($result.Warning)" -Level 'WARNING'
            exit 0
        } else {
            Write-RollbackLog "✅ Rollback completed successfully!" -Level 'SUCCESS'
            exit 0
        }
    } else {
        Write-RollbackLog "❌ Rollback failed: $($result.Error)" -Level 'ERROR'
        exit 1
    }

} catch {
    Write-RollbackLog "❌ Fatal rollback error: $($_.Exception.Message)" -Level 'ERROR'
    Write-RollbackLog "Stack trace: $($_.Exception.StackTrace)" -Level 'DEBUG'
    exit 1

} finally {
    Write-RollbackLog "Rollback script completed. Log file: $script:LogFile" -Level 'INFO'
}

#endregion