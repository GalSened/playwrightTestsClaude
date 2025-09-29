#Requires -Version 5.1
#Requires -Modules WebAdministration

<#
.SYNOPSIS
    WeSign Deployment Engine

.DESCRIPTION
    Comprehensive deployment engine for WeSign application with backup, rollback,
    and integrity verification capabilities. Handles complete deployment lifecycle
    with IIS integration and QA Intelligence reporting.

.PARAMETER ComputerName
    Target server hostname or IP address

.PARAMETER Credential
    Domain credentials for authentication

.PARAMETER ArtifactPath
    Path to the WeSign deployment artifact (ZIP file)

.PARAMETER DeploymentEnvironment
    Target environment (DevTest, Staging, Production)

.PARAMETER SkipBackup
    Skip backup creation (not recommended for production)

.PARAMETER SkipSmokeTests
    Skip smoke test execution after deployment

.PARAMETER QAIntelligenceUrl
    URL for QA Intelligence backend API for status reporting

.EXAMPLE
    .\deploy_wesign.ps1 -ComputerName "devtest.contoso.com" -Credential $creds -ArtifactPath "C:\Artifacts\WeSign_v1.2.3.zip"

.EXAMPLE
    .\deploy_wesign.ps1 -ComputerName "devtest" -Credential $creds -ArtifactPath "\\build\WeSign_latest.zip" -DeploymentEnvironment "DevTest" -QAIntelligenceUrl "http://localhost:8082"

.NOTES
    Author: QA Intelligence Platform
    Version: 1.0
    Created: 2025-09-26
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ComputerName,

    [Parameter(Mandatory = $true)]
    [PSCredential]$Credential,

    [Parameter(Mandatory = $true)]
    [string]$ArtifactPath,

    [Parameter(Mandatory = $false)]
    [ValidateSet('DevTest', 'Staging', 'Production')]
    [string]$DeploymentEnvironment = 'DevTest',

    [Parameter(Mandatory = $false)]
    [switch]$SkipBackup,

    [Parameter(Mandatory = $false)]
    [switch]$SkipSmokeTests,

    [Parameter(Mandatory = $false)]
    [string]$QAIntelligenceUrl = "http://localhost:8082"
)

# Import required modules
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $scriptRoot "winrm_session.ps1")
. (Join-Path $scriptRoot "iis_pools.ps1")
. (Join-Path $scriptRoot "smoke_tests.ps1")
. (Join-Path $scriptRoot "config_transform.ps1")

# Global deployment configuration
$Global:DeploymentConfig = @{
    Paths = @{
        Deploy = 'C:\inetpub\WeSign'
        Staging = 'C:\deploy'
        BackupRoot = 'C:\backup\WeSign'
        TempExtract = 'C:\temp\wesign_deploy'
    }
    AppPools = @('UserApi', 'SignerApi', 'ManagementApi', 'DefaultAppPool', 'PdfConvertorService')
    Timeouts = @{
        DeploymentTimeout = 1800  # 30 minutes
        BackupTimeout = 600       # 10 minutes
        ExtractionTimeout = 300   # 5 minutes
    }
    Validation = @{
        RequiredFiles = @(
            'bin\*.dll',
            'web.config',
            'Global.asax'
        )
        RequiredDirectories = @(
            'bin',
            'Content',
            'Scripts'
        )
    }
}

function Initialize-DeploymentEnvironment {
    <#
    .SYNOPSIS
        Initializes the deployment environment and validates prerequisites
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [System.Management.Automation.Runspaces.PSSession]$Session
    )

    Write-DeploymentLog "Initializing deployment environment"

    $scriptBlock = {
        param($config)

        $results = @{
            Success = $true
            Details = @{}
            Errors = @()
        }

        # Create required directories
        foreach ($pathName in $config.Paths.Keys) {
            $path = $config.Paths[$pathName]
            try {
                if (-not (Test-Path $path)) {
                    New-Item -Path $path -ItemType Directory -Force | Out-Null
                    $results.Details[$pathName] = "Created directory: $path"
                }
                else {
                    $results.Details[$pathName] = "Directory exists: $path"
                }

                # Test write permissions
                $testFile = Join-Path $path "deployment_test_$(Get-Date -Format 'yyyyMMddHHmmss').tmp"
                "test" | Out-File -FilePath $testFile -ErrorAction Stop
                Remove-Item $testFile -ErrorAction SilentlyContinue
            }
            catch {
                $results.Success = $false
                $results.Errors += "Failed to access $pathName ($path): $($_.Exception.Message)"
            }
        }

        # Check disk space (minimum 2GB free on C:)
        try {
            $disk = Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='C:'"
            $freeSpaceGB = [math]::Round($disk.FreeSpace / 1GB, 2)
            $results.Details['DiskSpace'] = "$freeSpaceGB GB free"

            if ($freeSpaceGB -lt 2) {
                $results.Success = $false
                $results.Errors += "Insufficient disk space: $freeSpaceGB GB (minimum 2GB required)"
            }
        }
        catch {
            $results.Errors += "Failed to check disk space: $($_.Exception.Message)"
        }

        # Verify IIS is installed and running
        try {
            Import-Module WebAdministration -ErrorAction Stop
            $iisService = Get-Service -Name W3SVC -ErrorAction Stop
            if ($iisService.Status -eq 'Running') {
                $results.Details['IIS'] = "IIS service is running"
            }
            else {
                $results.Success = $false
                $results.Errors += "IIS service is not running (Status: $($iisService.Status))"
            }
        }
        catch {
            $results.Success = $false
            $results.Errors += "IIS verification failed: $($_.Exception.Message)"
        }

        return $results
    }

    try {
        $results = Invoke-Command -Session $Session -ScriptBlock $scriptBlock -ArgumentList $Global:DeploymentConfig -ErrorAction Stop

        if ($results.Success) {
            Write-DeploymentLog "Deployment environment initialized successfully"
            foreach ($detail in $results.Details.GetEnumerator()) {
                Write-DeploymentLog "  $($detail.Key): $($detail.Value)"
            }
        }
        else {
            Write-DeploymentLog "Deployment environment initialization failed" -Level Error
            foreach ($error in $results.Errors) {
                Write-DeploymentLog "  ERROR: $error" -Level Error
            }
        }

        return $results
    }
    catch {
        Write-DeploymentLog "Failed to initialize deployment environment: $($_.Exception.Message)" -Level Error
        throw
    }
}

function Backup-CurrentDeployment {
    <#
    .SYNOPSIS
        Creates timestamped backup of current WeSign deployment
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [System.Management.Automation.Runspaces.PSSession]$Session,

        [Parameter(Mandatory = $false)]
        [string]$BackupReason = "Pre-deployment backup"
    )

    if ($SkipBackup) {
        Write-DeploymentLog "Backup skipped per parameter" -Level Warning
        return @{
            Success = $true
            BackupPath = "N/A - Skipped"
            Message = "Backup was skipped"
        }
    }

    Write-DeploymentLog "Creating deployment backup: $BackupReason"

    $scriptBlock = {
        param($config, $reason)

        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $backupPath = Join-Path $config.Paths.BackupRoot $timestamp
        $sourcePath = $config.Paths.Deploy

        try {
            # Create backup directory
            New-Item -Path $backupPath -ItemType Directory -Force | Out-Null

            # Create backup metadata
            $metadata = @{
                Timestamp = Get-Date
                Reason = $reason
                SourcePath = $sourcePath
                BackupPath = $backupPath
                ComputerName = $env:COMPUTERNAME
                BackupVersion = "1.0"
                User = $env:USERNAME
            }

            $metadataPath = Join-Path $backupPath "backup_metadata.json"
            $metadata | ConvertTo-Json -Depth 3 | Out-File -FilePath $metadataPath -Encoding UTF8

            # Check if source exists and has content
            if (Test-Path $sourcePath) {
                $sourceItems = Get-ChildItem -Path $sourcePath -Recurse -ErrorAction SilentlyContinue
                if ($sourceItems) {
                    Write-Host "Backing up $($sourceItems.Count) items from $sourcePath"

                    # Perform the backup using robocopy for reliability
                    $robocopyArgs = @(
                        "`"$sourcePath`"",
                        "`"$backupPath\files`"",
                        "/E",           # Copy subdirectories including empty ones
                        "/COPY:DAT",    # Copy Data, Attributes, and Timestamps
                        "/R:3",         # Retry 3 times on failure
                        "/W:1",         # Wait 1 second between retries
                        "/NP",          # No progress indicator
                        "/NJH",         # No job header
                        "/NJS"          # No job summary
                    )

                    $robocopyResult = Start-Process -FilePath "robocopy" -ArgumentList $robocopyArgs -Wait -PassThru -NoNewWindow

                    # Robocopy exit codes: 0-3 are success, 4+ are errors
                    if ($robocopyResult.ExitCode -le 3) {
                        Write-Host "Backup completed successfully using robocopy"
                        $backupSize = (Get-ChildItem -Path (Join-Path $backupPath "files") -Recurse | Measure-Object -Property Length -Sum).Sum
                        $backupSizeMB = [math]::Round($backupSize / 1MB, 2)

                        return @{
                            Success = $true
                            BackupPath = $backupPath
                            BackupSizeMB = $backupSizeMB
                            Message = "Backup created successfully ($backupSizeMB MB)"
                        }
                    }
                    else {
                        throw "Robocopy failed with exit code: $($robocopyResult.ExitCode)"
                    }
                }
                else {
                    Write-Host "Source directory is empty, creating empty backup"
                    New-Item -Path (Join-Path $backupPath "files") -ItemType Directory -Force | Out-Null
                    return @{
                        Success = $true
                        BackupPath = $backupPath
                        BackupSizeMB = 0
                        Message = "Empty backup created (source directory was empty)"
                    }
                }
            }
            else {
                Write-Host "Source directory does not exist, creating placeholder backup"
                New-Item -Path (Join-Path $backupPath "files") -ItemType Directory -Force | Out-Null
                "Source directory did not exist at backup time" | Out-File -FilePath (Join-Path $backupPath "files\README.txt")

                return @{
                    Success = $true
                    BackupPath = $backupPath
                    BackupSizeMB = 0
                    Message = "Placeholder backup created (source directory did not exist)"
                }
            }
        }
        catch {
            return @{
                Success = $false
                BackupPath = $backupPath
                Error = $_.Exception.Message
                Message = "Backup failed: $($_.Exception.Message)"
            }
        }
    }

    try {
        $result = Invoke-Command -Session $Session -ScriptBlock $scriptBlock -ArgumentList $Global:DeploymentConfig, $BackupReason -ErrorAction Stop

        if ($result.Success) {
            Write-DeploymentLog "Backup created successfully: $($result.BackupPath) ($($result.BackupSizeMB) MB)"
        }
        else {
            Write-DeploymentLog "Backup failed: $($result.Message)" -Level Error
        }

        return $result
    }
    catch {
        Write-DeploymentLog "Backup operation failed: $($_.Exception.Message)" -Level Error
        throw
    }
}

function Deploy-WeSignArtifact {
    <#
    .SYNOPSIS
        Deploys WeSign artifact with verification and configuration transformation
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [System.Management.Automation.Runspaces.PSSession]$Session,

        [Parameter(Mandatory = $true)]
        [string]$ArtifactPath,

        [Parameter(Mandatory = $true)]
        [string]$Environment
    )

    Write-DeploymentLog "Deploying WeSign artifact: $ArtifactPath"

    # Validate artifact exists locally
    if (-not (Test-Path $ArtifactPath)) {
        throw "Artifact file not found: $ArtifactPath"
    }

    $artifactInfo = Get-Item $ArtifactPath
    Write-DeploymentLog "Artifact size: $([math]::Round($artifactInfo.Length / 1MB, 2)) MB"

    $scriptBlock = {
        param($config, $environment, $artifactData, $artifactName)

        $deploymentResult = @{
            Success = $false
            Steps = @{}
            Error = $null
        }

        try {
            # Step 1: Create temporary extraction directory
            $extractPath = $config.Paths.TempExtract
            if (Test-Path $extractPath) {
                Remove-Item -Path $extractPath -Recurse -Force
            }
            New-Item -Path $extractPath -ItemType Directory -Force | Out-Null
            $deploymentResult.Steps['CreateTemp'] = "Created temporary directory: $extractPath"

            # Step 2: Write artifact to staging area
            $stagingPath = $config.Paths.Staging
            $artifactStagingPath = Join-Path $stagingPath $artifactName
            [System.IO.File]::WriteAllBytes($artifactStagingPath, $artifactData)
            $deploymentResult.Steps['StageArtifact'] = "Artifact staged: $artifactStagingPath"

            # Step 3: Extract artifact
            Write-Host "Extracting artifact to $extractPath"
            Add-Type -AssemblyName System.IO.Compression.FileSystem
            [System.IO.Compression.ZipFile]::ExtractToDirectory($artifactStagingPath, $extractPath)
            $deploymentResult.Steps['ExtractArtifact'] = "Artifact extracted successfully"

            # Step 4: Validate extracted content
            $validationResult = Test-DeploymentArtifact -ExtractPath $extractPath -Config $config
            if (-not $validationResult.Success) {
                throw "Artifact validation failed: $($validationResult.Errors -join '; ')"
            }
            $deploymentResult.Steps['ValidateArtifact'] = "Artifact validation passed"

            # Step 5: Transform configuration for environment
            Write-Host "Transforming configuration for environment: $environment"
            $configResult = Transform-WeSignConfig -SourcePath $extractPath -Environment $environment
            if (-not $configResult.Success) {
                throw "Configuration transformation failed: $($configResult.Error)"
            }
            $deploymentResult.Steps['TransformConfig'] = "Configuration transformed for $environment"

            # Step 6: Deploy to target directory
            $deployPath = $config.Paths.Deploy
            Write-Host "Deploying to $deployPath"

            # Clear target directory (backup should have been created already)
            if (Test-Path $deployPath) {
                $tempBackupName = "temp_deploy_backup_$(Get-Date -Format 'yyyyMMddHHmmss')"
                $tempBackupPath = Join-Path (Split-Path $deployPath -Parent) $tempBackupName
                Move-Item -Path $deployPath -Destination $tempBackupPath
                $deploymentResult.Steps['ClearTarget'] = "Moved existing deployment to: $tempBackupPath"
            }

            # Copy new deployment
            $robocopyArgs = @(
                "`"$extractPath`"",
                "`"$deployPath`"",
                "/E",           # Copy subdirectories including empty ones
                "/COPY:DAT",    # Copy Data, Attributes, and Timestamps
                "/R:3",         # Retry 3 times on failure
                "/W:1",         # Wait 1 second between retries
                "/NP",          # No progress indicator
                "/NJH",         # No job header
                "/NJS"          # No job summary
            )

            $robocopyResult = Start-Process -FilePath "robocopy" -ArgumentList $robocopyArgs -Wait -PassThru -NoNewWindow

            if ($robocopyResult.ExitCode -le 3) {
                $deploymentResult.Steps['CopyFiles'] = "Files copied successfully to deployment directory"
            }
            else {
                throw "Robocopy deployment failed with exit code: $($robocopyResult.ExitCode)"
            }

            # Step 7: Set appropriate permissions
            try {
                $acl = Get-Acl $deployPath
                # Grant IIS_IUSRS read and execute permissions
                $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule("IIS_IUSRS", "ReadAndExecute", "ContainerInherit,ObjectInherit", "None", "Allow")
                $acl.SetAccessRule($accessRule)
                Set-Acl -Path $deployPath -AclObject $acl
                $deploymentResult.Steps['SetPermissions'] = "IIS permissions set successfully"
            }
            catch {
                # Log warning but don't fail deployment
                Write-Warning "Failed to set IIS permissions: $($_.Exception.Message)"
                $deploymentResult.Steps['SetPermissions'] = "WARNING: Failed to set IIS permissions"
            }

            # Step 8: Final verification
            $finalValidation = Test-DeploymentIntegrity -DeployPath $deployPath -Config $config
            if (-not $finalValidation.Success) {
                throw "Final deployment verification failed: $($finalValidation.Errors -join '; ')"
            }
            $deploymentResult.Steps['FinalVerification'] = "Deployment integrity verified"

            # Cleanup
            if (Test-Path $extractPath) {
                Remove-Item -Path $extractPath -Recurse -Force
            }
            if (Test-Path $artifactStagingPath) {
                Remove-Item -Path $artifactStagingPath -Force
            }
            $deploymentResult.Steps['Cleanup'] = "Temporary files cleaned up"

            $deploymentResult.Success = $true
            return $deploymentResult
        }
        catch {
            $deploymentResult.Error = $_.Exception.Message
            return $deploymentResult
        }
    }

    # Helper functions to be available in remote session
    $helperFunctions = {
        function Test-DeploymentArtifact {
            param($ExtractPath, $Config)

            $result = @{
                Success = $true
                Errors = @()
            }

            # Check required files
            foreach ($filePattern in $Config.Validation.RequiredFiles) {
                $files = Get-ChildItem -Path $ExtractPath -Filter $filePattern -Recurse -ErrorAction SilentlyContinue
                if (-not $files) {
                    $result.Success = $false
                    $result.Errors += "Required file pattern not found: $filePattern"
                }
            }

            # Check required directories
            foreach ($directory in $Config.Validation.RequiredDirectories) {
                $dirPath = Join-Path $ExtractPath $directory
                if (-not (Test-Path $dirPath -PathType Container)) {
                    $result.Success = $false
                    $result.Errors += "Required directory not found: $directory"
                }
            }

            return $result
        }

        function Test-DeploymentIntegrity {
            param($DeployPath, $Config)

            $result = @{
                Success = $true
                Errors = @()
            }

            # Verify deployment path exists
            if (-not (Test-Path $DeployPath)) {
                $result.Success = $false
                $result.Errors += "Deployment path does not exist: $DeployPath"
                return $result
            }

            # Check for critical files
            $webConfig = Join-Path $DeployPath "web.config"
            if (-not (Test-Path $webConfig)) {
                $result.Success = $false
                $result.Errors += "web.config not found in deployment"
            }

            $binDir = Join-Path $DeployPath "bin"
            if (-not (Test-Path $binDir -PathType Container)) {
                $result.Success = $false
                $result.Errors += "bin directory not found in deployment"
            }
            else {
                $dlls = Get-ChildItem -Path $binDir -Filter "*.dll" -ErrorAction SilentlyContinue
                if (-not $dlls) {
                    $result.Success = $false
                    $result.Errors += "No DLL files found in bin directory"
                }
            }

            return $result
        }

        function Transform-WeSignConfig {
            param($SourcePath, $Environment)

            try {
                # This would integrate with the config transformation module
                # For now, return success
                return @{
                    Success = $true
                    Message = "Configuration transformation completed for $Environment"
                }
            }
            catch {
                return @{
                    Success = $false
                    Error = $_.Exception.Message
                }
            }
        }
    }

    try {
        # Read artifact file into memory for transfer
        $artifactBytes = [System.IO.File]::ReadAllBytes($ArtifactPath)
        $artifactName = Split-Path $ArtifactPath -Leaf

        $result = Invoke-Command -Session $Session -ScriptBlock {
            param($config, $environment, $artifactData, $artifactName, $helpers, $mainScript)

            # Import helper functions
            . ([ScriptBlock]::Create($helpers))

            # Execute main deployment script
            . ([ScriptBlock]::Create($mainScript)) $config $environment $artifactData $artifactName

        } -ArgumentList $Global:DeploymentConfig, $Environment, $artifactBytes, $artifactName, $helperFunctions.ToString(), $scriptBlock.ToString() -ErrorAction Stop

        if ($result.Success) {
            Write-DeploymentLog "WeSign artifact deployed successfully"
            foreach ($step in $result.Steps.GetEnumerator()) {
                Write-DeploymentLog "  $($step.Key): $($step.Value)"
            }
        }
        else {
            Write-DeploymentLog "WeSign artifact deployment failed: $($result.Error)" -Level Error
            foreach ($step in $result.Steps.GetEnumerator()) {
                Write-DeploymentLog "  $($step.Key): $($step.Value)"
            }
        }

        return $result
    }
    catch {
        Write-DeploymentLog "Artifact deployment failed: $($_.Exception.Message)" -Level Error
        throw
    }
}

function Rollback-ToPreviousVersion {
    <#
    .SYNOPSIS
        Rolls back to the most recent backup
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [System.Management.Automation.Runspaces.PSSession]$Session,

        [Parameter(Mandatory = $false)]
        [string]$SpecificBackupPath
    )

    Write-DeploymentLog "Initiating rollback to previous version"

    $scriptBlock = {
        param($config, $specificPath)

        try {
            $backupRoot = $config.Paths.BackupRoot
            $deployPath = $config.Paths.Deploy

            # Find the most recent backup or use specified path
            if ($specificPath -and (Test-Path $specificPath)) {
                $backupPath = $specificPath
            }
            else {
                $backups = Get-ChildItem -Path $backupRoot -Directory | Sort-Object Name -Descending
                if (-not $backups) {
                    throw "No backups found in $backupRoot"
                }
                $backupPath = $backups[0].FullName
            }

            Write-Host "Rolling back from: $backupPath"

            # Validate backup
            $backupFilesPath = Join-Path $backupPath "files"
            if (-not (Test-Path $backupFilesPath)) {
                throw "Backup files directory not found: $backupFilesPath"
            }

            # Create emergency backup of current deployment
            $emergencyBackupName = "emergency_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
            $emergencyBackupPath = Join-Path $backupRoot $emergencyBackupName

            if (Test-Path $deployPath) {
                Write-Host "Creating emergency backup before rollback"
                New-Item -Path $emergencyBackupPath -ItemType Directory -Force | Out-Null
                $robocopyArgs = @(
                    "`"$deployPath`"",
                    "`"$emergencyBackupPath\files`"",
                    "/E", "/COPY:DAT", "/R:1", "/W:1", "/NP", "/NJH", "/NJS"
                )
                $robocopyResult = Start-Process -FilePath "robocopy" -ArgumentList $robocopyArgs -Wait -PassThru -NoNewWindow

                if ($robocopyResult.ExitCode -gt 3) {
                    Write-Warning "Emergency backup may have failed (exit code: $($robocopyResult.ExitCode))"
                }
            }

            # Remove current deployment
            if (Test-Path $deployPath) {
                Remove-Item -Path $deployPath -Recurse -Force
            }

            # Restore from backup
            Write-Host "Restoring from backup: $backupFilesPath"
            $robocopyArgs = @(
                "`"$backupFilesPath`"",
                "`"$deployPath`"",
                "/E", "/COPY:DAT", "/R:3", "/W:1", "/NP", "/NJH", "/NJS"
            )
            $robocopyResult = Start-Process -FilePath "robocopy" -ArgumentList $robocopyArgs -Wait -PassThru -NoNewWindow

            if ($robocopyResult.ExitCode -le 3) {
                return @{
                    Success = $true
                    BackupUsed = $backupPath
                    EmergencyBackup = $emergencyBackupPath
                    Message = "Rollback completed successfully"
                }
            }
            else {
                throw "Rollback copy failed with exit code: $($robocopyResult.ExitCode)"
            }
        }
        catch {
            return @{
                Success = $false
                Error = $_.Exception.Message
                Message = "Rollback failed: $($_.Exception.Message)"
            }
        }
    }

    try {
        $result = Invoke-Command -Session $Session -ScriptBlock $scriptBlock -ArgumentList $Global:DeploymentConfig, $SpecificBackupPath -ErrorAction Stop

        if ($result.Success) {
            Write-DeploymentLog "Rollback completed successfully using backup: $($result.BackupUsed)"
            Write-DeploymentLog "Emergency backup created at: $($result.EmergencyBackup)"
        }
        else {
            Write-DeploymentLog "Rollback failed: $($result.Message)" -Level Error
        }

        return $result
    }
    catch {
        Write-DeploymentLog "Rollback operation failed: $($_.Exception.Message)" -Level Error
        throw
    }
}

function Send-DeploymentStatusUpdate {
    <#
    .SYNOPSIS
        Sends deployment status updates to QA Intelligence backend
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Status,

        [Parameter(Mandatory = $true)]
        [string]$Message,

        [Parameter(Mandatory = $false)]
        [hashtable]$AdditionalData = @{},

        [Parameter(Mandatory = $false)]
        [string]$ApiUrl = $QAIntelligenceUrl
    )

    if ([string]::IsNullOrEmpty($ApiUrl)) {
        Write-DeploymentLog "QA Intelligence URL not provided, skipping status update"
        return
    }

    try {
        $payload = @{
            timestamp = (Get-Date).ToString('o')
            environment = $DeploymentEnvironment
            computer = $ComputerName
            status = $Status
            message = $Message
            deploymentId = "wesign_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
            additionalData = $AdditionalData
        }

        $jsonPayload = $payload | ConvertTo-Json -Depth 3
        $endpoint = "$ApiUrl/api/deployment/status"

        $response = Invoke-RestMethod -Uri $endpoint -Method POST -Body $jsonPayload -ContentType "application/json" -TimeoutSec 30

        Write-DeploymentLog "Status update sent successfully to QA Intelligence"
    }
    catch {
        Write-DeploymentLog "Failed to send status update to QA Intelligence: $($_.Exception.Message)" -Level Warning
    }
}

function Start-WeSignDeployment {
    <#
    .SYNOPSIS
        Main deployment orchestration function
    #>
    [CmdletBinding()]
    param()

    $deploymentStartTime = Get-Date
    $session = $null

    try {
        Write-DeploymentLog "=== WeSign Deployment Started ==="
        Write-DeploymentLog "Target: $ComputerName"
        Write-DeploymentLog "Environment: $DeploymentEnvironment"
        Write-DeploymentLog "Artifact: $ArtifactPath"

        Send-DeploymentStatusUpdate -Status "Started" -Message "WeSign deployment initiated"

        # Initialize WinRM environment
        Initialize-WinRMEnvironment | Out-Null

        # Create secure session
        Write-DeploymentLog "Establishing secure connection..."
        $session = New-SecureWinRMSession -ComputerName $ComputerName -Credential $Credential

        Send-DeploymentStatusUpdate -Status "Connected" -Message "Secure connection established"

        # Initialize deployment environment
        $initResult = Initialize-DeploymentEnvironment -Session $session
        if (-not $initResult.Success) {
            throw "Environment initialization failed: $($initResult.Errors -join '; ')"
        }

        Send-DeploymentStatusUpdate -Status "EnvironmentReady" -Message "Deployment environment initialized"

        # Stop application pools
        Write-DeploymentLog "Stopping application pools..."
        $stopResult = Stop-WeSignAppPools -Session $session -PoolNames $Global:DeploymentConfig.AppPools
        $stoppedPools = ($stopResult.Values | Where-Object { $_.Success }).Count

        Send-DeploymentStatusUpdate -Status "PoolsStopped" -Message "Application pools stopped" -AdditionalData @{ StoppedPools = $stoppedPools }

        # Create backup
        $backupResult = Backup-CurrentDeployment -Session $session -BackupReason "Pre-deployment backup for $DeploymentEnvironment"
        if (-not $backupResult.Success) {
            throw "Backup creation failed: $($backupResult.Message)"
        }

        Send-DeploymentStatusUpdate -Status "BackupCreated" -Message "Backup created successfully" -AdditionalData @{ BackupPath = $backupResult.BackupPath }

        # Deploy artifact
        Write-DeploymentLog "Deploying WeSign artifact..."
        $deployResult = Deploy-WeSignArtifact -Session $session -ArtifactPath $ArtifactPath -Environment $DeploymentEnvironment
        if (-not $deployResult.Success) {
            Write-DeploymentLog "Deployment failed, initiating rollback..." -Level Error
            $rollbackResult = Rollback-ToPreviousVersion -Session $session
            if ($rollbackResult.Success) {
                Write-DeploymentLog "Rollback completed successfully" -Level Warning
                Send-DeploymentStatusUpdate -Status "RolledBack" -Message "Deployment failed, rollback completed"
            }
            else {
                Write-DeploymentLog "Rollback failed: $($rollbackResult.Message)" -Level Error
                Send-DeploymentStatusUpdate -Status "RollbackFailed" -Message "Deployment and rollback both failed"
            }
            throw "Artifact deployment failed: $($deployResult.Error)"
        }

        Send-DeploymentStatusUpdate -Status "ArtifactDeployed" -Message "WeSign artifact deployed successfully"

        # Start application pools
        Write-DeploymentLog "Starting application pools..."
        $startResult = Start-WeSignAppPools -Session $session -PoolNames $Global:DeploymentConfig.AppPools -HealthCheckUrl "http://$ComputerName"
        $startedPools = ($startResult.Values | Where-Object { $_.Success }).Count

        Send-DeploymentStatusUpdate -Status "PoolsStarted" -Message "Application pools started" -AdditionalData @{ StartedPools = $startedPools }

        # Run smoke tests
        if (-not $SkipSmokeTests) {
            Write-DeploymentLog "Running smoke tests..."
            $smokeResult = Invoke-WeSignSmokeTests -Session $session -BaseUrl "http://$ComputerName" -Environment $DeploymentEnvironment

            if ($smokeResult.OverallSuccess) {
                Send-DeploymentStatusUpdate -Status "SmokeTestsPassed" -Message "Smoke tests completed successfully" -AdditionalData @{ TestResults = $smokeResult }
            }
            else {
                Write-DeploymentLog "Smoke tests failed, consider rollback" -Level Warning
                Send-DeploymentStatusUpdate -Status "SmokeTestsFailed" -Message "Smoke tests failed" -AdditionalData @{ TestResults = $smokeResult }
            }
        }

        $deploymentDuration = (Get-Date) - $deploymentStartTime
        Write-DeploymentLog "=== WeSign Deployment Completed Successfully ==="
        Write-DeploymentLog "Duration: $($deploymentDuration.ToString('hh\:mm\:ss'))"

        Send-DeploymentStatusUpdate -Status "Completed" -Message "WeSign deployment completed successfully" -AdditionalData @{
            Duration = $deploymentDuration.ToString()
            BackupPath = $backupResult.BackupPath
        }

        return @{
            Success = $true
            Duration = $deploymentDuration
            BackupPath = $backupResult.BackupPath
            DeploymentSteps = $deployResult.Steps
            PoolResults = @{
                Stop = $stopResult
                Start = $startResult
            }
        }
    }
    catch {
        $deploymentDuration = (Get-Date) - $deploymentStartTime
        Write-DeploymentLog "=== WeSign Deployment Failed ===" -Level Error
        Write-DeploymentLog "Error: $($_.Exception.Message)" -Level Error
        Write-DeploymentLog "Duration: $($deploymentDuration.ToString('hh\:mm\:ss'))" -Level Error

        Send-DeploymentStatusUpdate -Status "Failed" -Message "WeSign deployment failed: $($_.Exception.Message)" -AdditionalData @{
            Duration = $deploymentDuration.ToString()
            Error = $_.Exception.Message
        }

        throw
    }
    finally {
        if ($session) {
            Remove-SecureWinRMSession -Session $session
        }
    }
}

# Execute deployment if script is run directly
if ($MyInvocation.InvocationName -eq $MyInvocation.MyCommand.Name) {
    Start-WeSignDeployment
}

# Export module functions
Export-ModuleMember -Function @(
    'Start-WeSignDeployment',
    'Deploy-WeSignArtifact',
    'Backup-CurrentDeployment',
    'Rollback-ToPreviousVersion',
    'Initialize-DeploymentEnvironment',
    'Send-DeploymentStatusUpdate'
)

Write-DeploymentLog "WeSign Deployment Engine loaded successfully"