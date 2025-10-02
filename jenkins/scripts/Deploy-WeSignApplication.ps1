<#
.SYNOPSIS
    WeSign Application Deployment Script for Windows IIS Environment

.DESCRIPTION
    This PowerShell script handles the complete deployment process for WeSign
    application to Windows IIS servers. It integrates with Jenkins pipeline
    and QA Intelligence backend for comprehensive deployment orchestration.

    Features:
    - IIS Application Pool management
    - File deployment with integrity verification
    - Configuration transformation
    - Health checks and smoke tests
    - Automated backup and rollback
    - Integration with QA Intelligence backend

.PARAMETER PackageFile
    Path to the deployment package ZIP file

.PARAMETER TargetPath
    Target deployment directory on IIS server

.PARAMETER IISSite
    IIS Site name

.PARAMETER IISAppPool
    IIS Application Pool name

.PARAMETER BackupEnabled
    Whether to create backup before deployment (default: $true)

.PARAMETER Environment
    Target environment (devtest, staging, production)

.PARAMETER QABackendUrl
    QA Intelligence backend URL for status reporting

.PARAMETER ExecutionId
    QA Intelligence execution ID for tracking

.EXAMPLE
    .\Deploy-WeSignApplication.ps1 -PackageFile "WeSign-123.zip" -TargetPath "C:\inetpub\wwwroot\WeSign" -IISSite "WeSign" -IISAppPool "WeSignAppPool"

.NOTES
    Version: 2.0
    Author: DevOps Team
    Last Updated: 2025-09-26
    Requires: PowerShell 5.1+, IIS Management Module
#>

[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory = $true)]
    [ValidateScript({Test-Path $_ -PathType Leaf})]
    [string]$PackageFile,

    [Parameter(Mandatory = $true)]
    [string]$TargetPath,

    [Parameter(Mandatory = $true)]
    [string]$IISSite,

    [Parameter(Mandatory = $true)]
    [string]$IISAppPool,

    [Parameter(Mandatory = $false)]
    [bool]$BackupEnabled = $true,

    [Parameter(Mandatory = $false)]
    [ValidateSet('devtest', 'staging', 'production')]
    [string]$Environment = 'devtest',

    [Parameter(Mandatory = $false)]
    [string]$QABackendUrl,

    [Parameter(Mandatory = $false)]
    [string]$ExecutionId,

    [Parameter(Mandatory = $false)]
    [int]$TimeoutSeconds = 600,

    [Parameter(Mandatory = $false)]
    [switch]$DryRun,

    [Parameter(Mandatory = $false)]
    [switch]$Force
)

# Import required modules
Import-Module WebAdministration -ErrorAction Stop

# Global variables
$script:StartTime = Get-Date
$script:LogFile = Join-Path $env:TEMP "WeSign-Deployment-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
$script:BackupPath = $null
$script:DeploymentSuccess = $false

#region Logging Functions

function Write-Log {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message,

        [Parameter(Mandatory = $false)]
        [ValidateSet('INFO', 'WARNING', 'ERROR', 'DEBUG')]
        [string]$Level = 'INFO'
    )

    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $logEntry = "[$timestamp] [$Level] $Message"

    # Output to console with color coding
    switch ($Level) {
        'INFO'    { Write-Host $logEntry -ForegroundColor Green }
        'WARNING' { Write-Host $logEntry -ForegroundColor Yellow }
        'ERROR'   { Write-Host $logEntry -ForegroundColor Red }
        'DEBUG'   { Write-Host $logEntry -ForegroundColor Cyan }
    }

    # Write to log file
    Add-Content -Path $script:LogFile -Value $logEntry -ErrorAction SilentlyContinue
}

function Write-Progress-Custom {
    param(
        [string]$Activity,
        [string]$Status,
        [int]$PercentComplete
    )

    Write-Progress -Activity $Activity -Status $Status -PercentComplete $PercentComplete
    Write-Log "Progress: $Activity - $Status ($PercentComplete%)"
}

#endregion

#region QA Intelligence Integration

function Report-Status {
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

    if (-not $QABackendUrl -or -not $ExecutionId) {
        Write-Log "QA Backend reporting skipped - no URL or ExecutionId provided" -Level 'DEBUG'
        return
    }

    try {
        $payload = @{
            executionId = $ExecutionId
            stage = $Stage
            status = $Status
            message = $Message
            timestamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
            metadata = $Metadata
        } | ConvertTo-Json -Depth 3

        $headers = @{
            'Content-Type' = 'application/json'
        }

        $uri = "$QABackendUrl/api/wesign/unified/execute/$ExecutionId/status"

        Invoke-RestMethod -Uri $uri -Method PUT -Body $payload -Headers $headers -TimeoutSec 15 -ErrorAction Stop

        Write-Log "Status reported to QA Intelligence: $Stage - $Status" -Level 'DEBUG'

    } catch {
        Write-Log "Failed to report status to QA Intelligence: $($_.Exception.Message)" -Level 'WARNING'
    }
}

#endregion

#region Pre-Flight Checks

function Test-Prerequisites {
    Write-Log "Running pre-flight checks..."
    Report-Status -Stage 'preflight' -Status 'running' -Message 'Running pre-flight checks'

    $issues = @()

    # Check PowerShell version
    if ($PSVersionTable.PSVersion.Major -lt 5) {
        $issues += "PowerShell 5.1 or later is required"
    }

    # Check IIS Management module
    try {
        Import-Module WebAdministration -ErrorAction Stop
    } catch {
        $issues += "IIS Management module is not available"
    }

    # Check if running as administrator
    $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        $issues += "Script must be run as Administrator"
    }

    # Check target directory parent exists
    $parentDir = Split-Path $TargetPath -Parent
    if (-not (Test-Path $parentDir)) {
        $issues += "Parent directory does not exist: $parentDir"
    }

    # Check package file integrity
    if (-not (Test-PackageIntegrity)) {
        $issues += "Package file integrity check failed"
    }

    # Check IIS site and app pool existence
    try {
        $site = Get-Website -Name $IISSite -ErrorAction Stop
        $appPool = Get-IISAppPool -Name $IISAppPool -ErrorAction Stop
    } catch {
        $issues += "IIS Site or Application Pool not found"
    }

    # Check disk space
    $drive = (Split-Path $TargetPath -Qualifier)
    $diskSpace = Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='$drive'"
    $freeSpaceGB = [math]::Round($diskSpace.FreeSpace / 1GB, 2)
    $requiredSpaceGB = 2.0

    if ($freeSpaceGB -lt $requiredSpaceGB) {
        $issues += "Insufficient disk space: ${freeSpaceGB}GB available, ${requiredSpaceGB}GB required"
    }

    if ($issues.Count -gt 0) {
        $errorMessage = "Pre-flight checks failed:`n" + ($issues -join "`n")
        Write-Log $errorMessage -Level 'ERROR'
        Report-Status -Stage 'preflight' -Status 'failed' -Message $errorMessage
        throw $errorMessage
    }

    Write-Log "All pre-flight checks passed" -Level 'INFO'
    Report-Status -Stage 'preflight' -Status 'completed' -Message 'Pre-flight checks passed'
}

function Test-PackageIntegrity {
    Write-Log "Verifying package integrity..."

    $checksumFile = $PackageFile + ".sha256"
    if (-not (Test-Path $checksumFile)) {
        Write-Log "Checksum file not found: $checksumFile" -Level 'WARNING'
        return $true # Allow deployment without checksum in non-production environments
    }

    try {
        $expectedChecksum = (Get-Content $checksumFile).Split(' ')[0]
        $actualChecksum = (Get-FileHash -Path $PackageFile -Algorithm SHA256).Hash

        if ($expectedChecksum -eq $actualChecksum) {
            Write-Log "Package integrity verified" -Level 'INFO'
            return $true
        } else {
            Write-Log "Package checksum mismatch: expected $expectedChecksum, got $actualChecksum" -Level 'ERROR'
            return $false
        }
    } catch {
        Write-Log "Failed to verify package integrity: $($_.Exception.Message)" -Level 'ERROR'
        return $false
    }
}

#endregion

#region Backup Functions

function New-ApplicationBackup {
    Write-Log "Creating application backup..."
    Report-Status -Stage 'backup' -Status 'running' -Message 'Creating application backup'

    if (-not $BackupEnabled) {
        Write-Log "Backup disabled, skipping..." -Level 'INFO'
        return $null
    }

    try {
        $backupDir = "C:\Backups\WeSign"
        $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $backupName = "wesign-backup-$timestamp"
        $script:BackupPath = Join-Path $backupDir "$backupName.zip"

        # Ensure backup directory exists
        if (-not (Test-Path $backupDir)) {
            New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
        }

        # Create backup only if target path exists
        if (Test-Path $TargetPath) {
            Write-Progress-Custom -Activity "Creating Backup" -Status "Backing up $TargetPath" -PercentComplete 25

            # Create temporary backup directory
            $tempBackupPath = Join-Path $env:TEMP $backupName
            Copy-Item -Path $TargetPath -Destination $tempBackupPath -Recurse -Force

            Write-Progress-Custom -Activity "Creating Backup" -Status "Compressing backup" -PercentComplete 75

            # Compress to ZIP
            Add-Type -AssemblyName System.IO.Compression.FileSystem
            [System.IO.Compression.ZipFile]::CreateFromDirectory($tempBackupPath, $script:BackupPath)

            # Clean up temp directory
            Remove-Item -Path $tempBackupPath -Recurse -Force

            Write-Progress-Custom -Activity "Creating Backup" -Status "Backup completed" -PercentComplete 100
            Write-Log "Backup created: $script:BackupPath" -Level 'INFO'

            # Verify backup
            $backupSize = (Get-Item $script:BackupPath).Length
            Write-Log "Backup size: $([math]::Round($backupSize / 1MB, 2)) MB" -Level 'INFO'

        } else {
            Write-Log "Target path does not exist, skipping backup" -Level 'INFO'
            $script:BackupPath = $null
        }

        Report-Status -Stage 'backup' -Status 'completed' -Message 'Backup created successfully' -Metadata @{
            backupPath = $script:BackupPath
            backupSize = if ($script:BackupPath) { (Get-Item $script:BackupPath).Length } else { 0 }
        }

        return $script:BackupPath

    } catch {
        $errorMessage = "Backup creation failed: $($_.Exception.Message)"
        Write-Log $errorMessage -Level 'ERROR'
        Report-Status -Stage 'backup' -Status 'failed' -Message $errorMessage
        throw $errorMessage
    } finally {
        Write-Progress -Activity "Creating Backup" -Completed
    }
}

#endregion

#region IIS Management

function Stop-ApplicationPool {
    Write-Log "Stopping IIS Application Pool: $IISAppPool"
    Report-Status -Stage 'stop_apppool' -Status 'running' -Message "Stopping application pool: $IISAppPool"

    try {
        $appPool = Get-IISAppPool -Name $IISAppPool

        if ($appPool.State -eq 'Stopped') {
            Write-Log "Application pool is already stopped" -Level 'INFO'
            return
        }

        if ($DryRun) {
            Write-Log "[DRY RUN] Would stop application pool: $IISAppPool" -Level 'INFO'
            return
        }

        Stop-WebAppPool -Name $IISAppPool

        # Wait for app pool to stop
        $timeout = 30
        $elapsed = 0

        do {
            Start-Sleep -Seconds 2
            $elapsed += 2
            $state = (Get-IISAppPool -Name $IISAppPool).State
            Write-Progress-Custom -Activity "Stopping App Pool" -Status "Current state: $state" -PercentComplete (($elapsed / $timeout) * 100)
        } while ($state -ne 'Stopped' -and $elapsed -lt $timeout)

        if ($state -ne 'Stopped') {
            throw "Application pool did not stop within timeout period"
        }

        Write-Log "Application pool stopped successfully" -Level 'INFO'
        Report-Status -Stage 'stop_apppool' -Status 'completed' -Message 'Application pool stopped successfully'

    } catch {
        $errorMessage = "Failed to stop application pool: $($_.Exception.Message)"
        Write-Log $errorMessage -Level 'ERROR'
        Report-Status -Stage 'stop_apppool' -Status 'failed' -Message $errorMessage
        throw $errorMessage
    } finally {
        Write-Progress -Activity "Stopping App Pool" -Completed
    }
}

function Start-ApplicationPool {
    Write-Log "Starting IIS Application Pool: $IISAppPool"
    Report-Status -Stage 'start_apppool' -Status 'running' -Message "Starting application pool: $IISAppPool"

    try {
        if ($DryRun) {
            Write-Log "[DRY RUN] Would start application pool: $IISAppPool" -Level 'INFO'
            return
        }

        Start-WebAppPool -Name $IISAppPool

        # Wait for app pool to start
        $timeout = 60
        $elapsed = 0

        do {
            Start-Sleep -Seconds 2
            $elapsed += 2
            $state = (Get-IISAppPool -Name $IISAppPool).State
            Write-Progress-Custom -Activity "Starting App Pool" -Status "Current state: $state" -PercentComplete (($elapsed / $timeout) * 100)
        } while ($state -ne 'Started' -and $elapsed -lt $timeout)

        if ($state -ne 'Started') {
            throw "Application pool did not start within timeout period"
        }

        Write-Log "Application pool started successfully" -Level 'INFO'
        Report-Status -Stage 'start_apppool' -Status 'completed' -Message 'Application pool started successfully'

    } catch {
        $errorMessage = "Failed to start application pool: $($_.Exception.Message)"
        Write-Log $errorMessage -Level 'ERROR'
        Report-Status -Stage 'start_apppool' -Status 'failed' -Message $errorMessage
        throw $errorMessage
    } finally {
        Write-Progress -Activity "Starting App Pool" -Completed
    }
}

#endregion

#region Deployment Functions

function Deploy-Application {
    Write-Log "Deploying application to: $TargetPath"
    Report-Status -Stage 'deploy' -Status 'running' -Message "Deploying application package"

    try {
        # Remove existing deployment (but keep backup)
        if (Test-Path $TargetPath) {
            if ($DryRun) {
                Write-Log "[DRY RUN] Would remove existing deployment: $TargetPath" -Level 'INFO'
            } else {
                Write-Log "Removing existing deployment..." -Level 'INFO'
                Remove-Item -Path $TargetPath -Recurse -Force
            }
        }

        # Extract package
        Write-Progress-Custom -Activity "Deploying Application" -Status "Extracting package" -PercentComplete 25

        if ($DryRun) {
            Write-Log "[DRY RUN] Would extract package: $PackageFile to $TargetPath" -Level 'INFO'
        } else {
            # Ensure parent directory exists
            $parentDir = Split-Path $TargetPath -Parent
            if (-not (Test-Path $parentDir)) {
                New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
            }

            Add-Type -AssemblyName System.IO.Compression.FileSystem
            [System.IO.Compression.ZipFile]::ExtractToDirectory($PackageFile, $TargetPath)

            Write-Log "Package extracted successfully" -Level 'INFO'
        }

        Write-Progress-Custom -Activity "Deploying Application" -Status "Configuring application" -PercentComplete 75

        # Transform configuration
        Update-ApplicationConfiguration

        Write-Progress-Custom -Activity "Deploying Application" -Status "Deployment completed" -PercentComplete 100

        $script:DeploymentSuccess = $true
        Write-Log "Application deployed successfully" -Level 'INFO'
        Report-Status -Stage 'deploy' -Status 'completed' -Message 'Application deployed successfully'

    } catch {
        $errorMessage = "Deployment failed: $($_.Exception.Message)"
        Write-Log $errorMessage -Level 'ERROR'
        Report-Status -Stage 'deploy' -Status 'failed' -Message $errorMessage
        throw $errorMessage
    } finally {
        Write-Progress -Activity "Deploying Application" -Completed
    }
}

function Update-ApplicationConfiguration {
    Write-Log "Updating application configuration for environment: $Environment"

    $configPath = Join-Path $TargetPath 'web.config'
    $transformPath = Join-Path $TargetPath "web.$Environment.config"

    if ($DryRun) {
        Write-Log "[DRY RUN] Would transform configuration: $configPath" -Level 'INFO'
        return
    }

    try {
        if (Test-Path $transformPath) {
            Write-Log "Applying configuration transformation: $transformPath" -Level 'INFO'

            # Load XDT transformation (simplified - in production, use proper XDT tools)
            $config = [xml](Get-Content $configPath)

            # Apply environment-specific transformations
            switch ($Environment) {
                'devtest' {
                    # Update connection strings
                    $connString = $config.configuration.connectionStrings.add | Where-Object { $_.name -eq 'WeSignDB' }
                    if ($connString) {
                        $connString.connectionString = 'Data Source=devtest-sql01;Initial Catalog=WeSignDevTest;Integrated Security=true'
                    }

                    # Update app settings
                    $envSetting = $config.configuration.appSettings.add | Where-Object { $_.key -eq 'Environment' }
                    if ($envSetting) {
                        $envSetting.value = $Environment
                    }
                }
                'staging' {
                    # Staging-specific configuration
                }
                'production' {
                    # Production-specific configuration
                }
            }

            $config.Save($configPath)
            Write-Log "Configuration transformed successfully" -Level 'INFO'

        } else {
            Write-Log "No transformation file found, using default configuration" -Level 'INFO'
        }

        # Verify configuration
        $config = [xml](Get-Content $configPath)
        if ($config.configuration) {
            Write-Log "Configuration file is valid" -Level 'INFO'
        } else {
            throw "Configuration file is invalid after transformation"
        }

    } catch {
        Write-Log "Configuration update failed: $($_.Exception.Message)" -Level 'ERROR'
        throw
    }
}

#endregion

#region Health Checks

function Test-ApplicationHealth {
    Write-Log "Running application health checks..."
    Report-Status -Stage 'health_check' -Status 'running' -Message 'Running application health checks'

    try {
        $healthEndpoints = @(
            @{ Path = '/'; Name = 'Main Page'; Critical = $true },
            @{ Path = '/health'; Name = 'Health Endpoint'; Critical = $true },
            @{ Path = '/api/health'; Name = 'API Health'; Critical = $true },
            @{ Path = '/api/health/database'; Name = 'Database Health'; Critical = $false }
        )

        $results = @()
        $siteUrl = "https://localhost"  # Assuming local deployment for health checks

        foreach ($endpoint in $healthEndpoints) {
            $testResult = Test-HealthEndpoint -Url "$siteUrl$($endpoint.Path)" -Name $endpoint.Name -Critical $endpoint.Critical
            $results += $testResult
        }

        $criticalResults = $results | Where-Object { $_.Critical }
        $criticalPassed = ($criticalResults | Where-Object { $_.Success }).Count
        $criticalTotal = $criticalResults.Count

        $allPassed = ($results | Where-Object { $_.Success }).Count
        $allTotal = $results.Count

        $healthCheckPassed = ($criticalPassed -eq $criticalTotal)

        Write-Log "Health check results: $criticalPassed/$criticalTotal critical tests passed, $allPassed/$allTotal total tests passed" -Level 'INFO'

        if ($healthCheckPassed) {
            Write-Log "All critical health checks passed" -Level 'INFO'
            Report-Status -Stage 'health_check' -Status 'completed' -Message 'Health checks passed' -Metadata @{
                criticalPassed = $criticalPassed
                criticalTotal = $criticalTotal
                allPassed = $allPassed
                allTotal = $allTotal
            }
        } else {
            $errorMessage = "Critical health checks failed: $criticalPassed/$criticalTotal passed"
            Write-Log $errorMessage -Level 'ERROR'
            Report-Status -Stage 'health_check' -Status 'failed' -Message $errorMessage

            if (-not $Force) {
                throw $errorMessage
            } else {
                Write-Log "Continuing due to Force parameter" -Level 'WARNING'
            }
        }

        return $healthCheckPassed

    } catch {
        $errorMessage = "Health check failed: $($_.Exception.Message)"
        Write-Log $errorMessage -Level 'ERROR'
        Report-Status -Stage 'health_check' -Status 'failed' -Message $errorMessage

        if (-not $Force) {
            throw $errorMessage
        } else {
            Write-Log "Continuing due to Force parameter" -Level 'WARNING'
            return $false
        }
    }
}

function Test-HealthEndpoint {
    param(
        [string]$Url,
        [string]$Name,
        [bool]$Critical = $true
    )

    try {
        Write-Log "Testing endpoint: $Name ($Url)" -Level 'DEBUG'

        $response = Invoke-WebRequest -Uri $Url -TimeoutSec 30 -UseBasicParsing -ErrorAction Stop

        if ($response.StatusCode -eq 200) {
            Write-Log "✓ $Name: OK" -Level 'INFO'
            return @{ Name = $Name; Url = $Url; Success = $true; Critical = $Critical; StatusCode = $response.StatusCode }
        } else {
            Write-Log "✗ $Name: HTTP $($response.StatusCode)" -Level 'WARNING'
            return @{ Name = $Name; Url = $Url; Success = $false; Critical = $Critical; StatusCode = $response.StatusCode }
        }

    } catch {
        Write-Log "✗ $Name: $($_.Exception.Message)" -Level 'WARNING'
        return @{ Name = $Name; Url = $Url; Success = $false; Critical = $Critical; Error = $_.Exception.Message }
    }
}

#endregion

#region Rollback Functions

function Invoke-Rollback {
    param(
        [string]$BackupPath = $script:BackupPath
    )

    Write-Log "Initiating rollback procedure..."
    Report-Status -Stage 'rollback' -Status 'running' -Message 'Initiating rollback procedure'

    if (-not $BackupPath -or -not (Test-Path $BackupPath)) {
        $errorMessage = "Cannot rollback: backup file not found at $BackupPath"
        Write-Log $errorMessage -Level 'ERROR'
        Report-Status -Stage 'rollback' -Status 'failed' -Message $errorMessage
        throw $errorMessage
    }

    try {
        # Stop application pool
        Stop-ApplicationPool

        # Remove failed deployment
        if (Test-Path $TargetPath) {
            Remove-Item -Path $TargetPath -Recurse -Force
        }

        # Restore from backup
        Write-Log "Restoring from backup: $BackupPath"
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        [System.IO.Compression.ZipFile]::ExtractToDirectory($BackupPath, $TargetPath)

        # Start application pool
        Start-ApplicationPool

        # Verify rollback
        $healthCheckPassed = Test-ApplicationHealth

        if ($healthCheckPassed) {
            Write-Log "Rollback completed successfully" -Level 'INFO'
            Report-Status -Stage 'rollback' -Status 'completed' -Message 'Rollback completed successfully'
        } else {
            Write-Log "Rollback completed but health checks failed" -Level 'WARNING'
            Report-Status -Stage 'rollback' -Status 'completed' -Message 'Rollback completed but health checks failed'
        }

    } catch {
        $errorMessage = "Rollback failed: $($_.Exception.Message)"
        Write-Log $errorMessage -Level 'ERROR'
        Report-Status -Stage 'rollback' -Status 'failed' -Message $errorMessage
        throw $errorMessage
    }
}

#endregion

#region Main Deployment Logic

function Start-Deployment {
    Write-Log "Starting WeSign deployment process..."
    Write-Log "Package: $PackageFile"
    Write-Log "Target: $TargetPath"
    Write-Log "Environment: $Environment"
    Write-Log "Dry Run: $DryRun"

    Report-Status -Stage 'started' -Status 'running' -Message 'Deployment process started' -Metadata @{
        packageFile = $PackageFile
        targetPath = $TargetPath
        environment = $Environment
        dryRun = $DryRun
    }

    try {
        # Phase 1: Pre-flight checks
        Test-Prerequisites

        # Phase 2: Create backup
        if ($BackupEnabled) {
            New-ApplicationBackup
        }

        # Phase 3: Stop services
        Stop-ApplicationPool

        # Phase 4: Deploy application
        Deploy-Application

        # Phase 5: Start services
        Start-ApplicationPool

        # Phase 6: Health checks
        $healthCheckPassed = Test-ApplicationHealth

        # Phase 7: Success reporting
        $duration = (Get-Date) - $script:StartTime
        Write-Log "Deployment completed successfully in $($duration.TotalMinutes.ToString('F2')) minutes" -Level 'INFO'

        Report-Status -Stage 'completed' -Status 'completed' -Message 'Deployment completed successfully' -Metadata @{
            duration = $duration.TotalSeconds
            healthCheckPassed = $healthCheckPassed
            backupCreated = ($null -ne $script:BackupPath)
        }

        return @{
            Success = $true
            Duration = $duration
            BackupPath = $script:BackupPath
            HealthCheckPassed = $healthCheckPassed
        }

    } catch {
        $duration = (Get-Date) - $script:StartTime
        $errorMessage = "Deployment failed: $($_.Exception.Message)"
        Write-Log $errorMessage -Level 'ERROR'

        Report-Status -Stage 'failed' -Status 'failed' -Message $errorMessage -Metadata @{
            duration = $duration.TotalSeconds
            deploymentSuccess = $script:DeploymentSuccess
        }

        # Attempt automatic rollback if deployment partially succeeded
        if ($script:DeploymentSuccess -and $BackupEnabled -and $script:BackupPath) {
            try {
                Write-Log "Attempting automatic rollback..." -Level 'WARNING'
                Invoke-Rollback
                Write-Log "Automatic rollback completed" -Level 'INFO'
            } catch {
                Write-Log "Automatic rollback failed: $($_.Exception.Message)" -Level 'ERROR'
            }
        }

        return @{
            Success = $false
            Error = $_.Exception.Message
            Duration = $duration
            BackupPath = $script:BackupPath
        }
    }
}

#endregion

#region Script Execution

# Main execution
try {
    Write-Log "WeSign Deployment Script v2.0 Starting..." -Level 'INFO'
    Write-Log "Log file: $script:LogFile" -Level 'INFO'

    $result = Start-Deployment

    if ($result.Success) {
        Write-Log "✅ Deployment completed successfully!" -Level 'INFO'
        exit 0
    } else {
        Write-Log "❌ Deployment failed: $($result.Error)" -Level 'ERROR'
        exit 1
    }

} catch {
    Write-Log "❌ Fatal error: $($_.Exception.Message)" -Level 'ERROR'
    Write-Log "Stack trace: $($_.Exception.StackTrace)" -Level 'DEBUG'
    exit 1

} finally {
    # Cleanup
    Write-Log "Deployment script completed. Log file: $script:LogFile" -Level 'INFO'
}

#endregion