#Requires -Version 5.1
#Requires -Modules WebAdministration

<#
.SYNOPSIS
    IIS Application Pool Management for WeSign Deployment

.DESCRIPTION
    Comprehensive IIS Application Pool lifecycle management for WeSign deployment.
    Handles graceful shutdown, startup, health validation, and dependency management.

.PARAMETER PoolNames
    Array of application pool names to manage

.PARAMETER MaxWaitTime
    Maximum time to wait for pool operations in seconds (default: 120)

.PARAMETER HealthCheckUrl
    Base URL for health check endpoints

.EXAMPLE
    Stop-WeSignAppPools -PoolNames @('UserApi', 'SignerApi', 'ManagementApi')

.EXAMPLE
    Start-WeSignAppPools -PoolNames @('UserApi', 'SignerApi', 'ManagementApi') -HealthCheckUrl "http://devtest"

.NOTES
    Author: QA Intelligence Platform
    Version: 1.0
    Created: 2025-09-26
#>

[CmdletBinding()]
param()

# Import WinRM Session Management
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $scriptRoot "winrm_session.ps1")

# Global configuration for WeSign App Pools
$Global:WeSignConfig = @{
    AppPools = @{
        'UserApi' = @{
            Name = 'UserApi'
            HealthEndpoint = '/health'
            Dependencies = @()
            StartupTimeout = 60
            StopTimeout = 30
        }
        'SignerApi' = @{
            Name = 'SignerApi'
            HealthEndpoint = '/health'
            Dependencies = @('UserApi')
            StartupTimeout = 60
            StopTimeout = 30
        }
        'ManagementApi' = @{
            Name = 'ManagementApi'
            HealthEndpoint = '/WeSignManagement/health'
            Dependencies = @('UserApi')
            StartupTimeout = 60
            StopTimeout = 30
        }
        'DefaultAppPool' = @{
            Name = 'DefaultAppPool'
            HealthEndpoint = '/health'
            Dependencies = @()
            StartupTimeout = 30
            StopTimeout = 15
        }
        'PdfConvertorService' = @{
            Name = 'PdfConvertorService'
            HealthEndpoint = '/health'
            Dependencies = @('UserApi')
            StartupTimeout = 90
            StopTimeout = 45
        }
    }
    DefaultSettings = @{
        MaxWaitTime = 120
        HealthCheckTimeout = 30
        HealthCheckRetries = 3
        HealthCheckInterval = 5
    }
}

function Get-AppPoolStatus {
    <#
    .SYNOPSIS
        Gets detailed status of application pools
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $false)]
        [System.Management.Automation.Runspaces.PSSession]$Session,

        [Parameter(Mandatory = $false)]
        [string[]]$PoolNames = $Global:WeSignConfig.AppPools.Keys
    )

    Write-DeploymentLog "Getting application pool status for: $($PoolNames -join ', ')"

    $scriptBlock = {
        param($pools)

        Import-Module WebAdministration -ErrorAction Stop

        $results = @{}
        foreach ($poolName in $pools) {
            try {
                $pool = Get-IISAppPool -Name $poolName -ErrorAction SilentlyContinue
                if ($pool) {
                    $results[$poolName] = @{
                        Name = $pool.Name
                        State = $pool.State
                        ProcessId = $pool.WorkerProcesses.ProcessId
                        StartMode = $pool.ProcessModel.LoadUserProfile
                        Enable32BitAppOnWin64 = $pool.Enable32BitAppOnWin64
                        ManagedRuntimeVersion = $pool.ManagedRuntimeVersion
                        RecycleConditions = @{
                            Memory = $pool.Recycling.PeriodicRestart.Memory
                            Time = $pool.Recycling.PeriodicRestart.Time
                            Requests = $pool.Recycling.PeriodicRestart.Requests
                        }
                        LastError = $null
                    }
                }
                else {
                    $results[$poolName] = @{
                        Name = $poolName
                        State = 'NotFound'
                        ProcessId = $null
                        LastError = "Application pool not found"
                    }
                }
            }
            catch {
                $results[$poolName] = @{
                    Name = $poolName
                    State = 'Error'
                    ProcessId = $null
                    LastError = $_.Exception.Message
                }
            }
        }

        return $results
    }

    try {
        if ($Session) {
            $results = Invoke-Command -Session $Session -ScriptBlock $scriptBlock -ArgumentList @(,$PoolNames) -ErrorAction Stop
        }
        else {
            $results = & $scriptBlock $PoolNames
        }

        Write-DeploymentLog "Application pool status retrieved successfully"
        return $results
    }
    catch {
        Write-DeploymentLog "Failed to get application pool status: $($_.Exception.Message)" -Level Error
        throw
    }
}

function Stop-WeSignAppPools {
    <#
    .SYNOPSIS
        Gracefully stops WeSign application pools in dependency order
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $false)]
        [System.Management.Automation.Runspaces.PSSession]$Session,

        [Parameter(Mandatory = $false)]
        [string[]]$PoolNames = $Global:WeSignConfig.AppPools.Keys,

        [Parameter(Mandatory = $false)]
        [int]$MaxWaitTime = $Global:WeSignConfig.DefaultSettings.MaxWaitTime
    )

    Write-DeploymentLog "Starting graceful shutdown of application pools: $($PoolNames -join ', ')"

    # Calculate shutdown order based on dependencies (reverse topological sort)
    $shutdownOrder = Get-AppPoolShutdownOrder -PoolNames $PoolNames

    Write-DeploymentLog "Shutdown order determined: $($shutdownOrder -join ' -> ')"

    $scriptBlock = {
        param($pools, $maxWait, $appPoolConfig)

        Import-Module WebAdministration -ErrorAction Stop

        $results = @{}
        $startTime = Get-Date

        foreach ($poolName in $pools) {
            Write-Host "Stopping application pool: $poolName"

            try {
                $pool = Get-IISAppPool -Name $poolName -ErrorAction SilentlyContinue
                if (-not $pool) {
                    $results[$poolName] = @{
                        Success = $true
                        State = 'NotFound'
                        Message = "Application pool not found (may already be removed)"
                    }
                    continue
                }

                if ($pool.State -eq 'Stopped') {
                    $results[$poolName] = @{
                        Success = $true
                        State = 'Stopped'
                        Message = "Application pool was already stopped"
                    }
                    continue
                }

                # Get pool-specific timeout
                $poolTimeout = if ($appPoolConfig[$poolName]) {
                    $appPoolConfig[$poolName].StopTimeout
                } else {
                    30
                }

                # Stop the pool
                Stop-IISAppPool -Name $poolName -ErrorAction Stop

                # Wait for pool to stop
                $timeout = (Get-Date).AddSeconds($poolTimeout)
                do {
                    Start-Sleep -Seconds 1
                    $pool = Get-IISAppPool -Name $poolName -ErrorAction SilentlyContinue
                    $elapsed = (Get-Date) - $startTime

                    if ($elapsed.TotalSeconds -gt $maxWait) {
                        throw "Global timeout exceeded ($maxWait seconds)"
                    }
                }
                while ($pool.State -ne 'Stopped' -and (Get-Date) -lt $timeout)

                if ($pool.State -eq 'Stopped') {
                    $results[$poolName] = @{
                        Success = $true
                        State = 'Stopped'
                        Message = "Application pool stopped successfully"
                    }
                    Write-Host "Application pool $poolName stopped successfully"
                }
                else {
                    # Force stop if graceful stop failed
                    Write-Host "Forcing stop of application pool: $poolName"

                    # Kill worker processes if they exist
                    $workerProcesses = Get-WmiObject -Class Win32_Process -Filter "Name='w3wp.exe'" | Where-Object {
                        $_.CommandLine -like "*$poolName*"
                    }

                    foreach ($process in $workerProcesses) {
                        try {
                            $process.Terminate()
                            Write-Host "Terminated worker process ID: $($process.ProcessId)"
                        }
                        catch {
                            Write-Warning "Failed to terminate process ID $($process.ProcessId): $($_.Exception.Message)"
                        }
                    }

                    # Force stop the pool
                    try {
                        Stop-IISAppPool -Name $poolName -Force -ErrorAction Stop
                        $results[$poolName] = @{
                            Success = $true
                            State = 'ForceStopped'
                            Message = "Application pool force stopped"
                        }
                    }
                    catch {
                        $results[$poolName] = @{
                            Success = $false
                            State = 'Error'
                            Message = "Failed to stop application pool: $($_.Exception.Message)"
                        }
                    }
                }
            }
            catch {
                $results[$poolName] = @{
                    Success = $false
                    State = 'Error'
                    Message = "Error stopping application pool: $($_.Exception.Message)"
                }
                Write-Warning "Failed to stop $poolName : $($_.Exception.Message)"
            }
        }

        return $results
    }

    try {
        if ($Session) {
            $results = Invoke-Command -Session $Session -ScriptBlock $scriptBlock -ArgumentList @(,$shutdownOrder), $MaxWaitTime, $Global:WeSignConfig.AppPools -ErrorAction Stop
        }
        else {
            $results = & $scriptBlock $shutdownOrder $MaxWaitTime $Global:WeSignConfig.AppPools
        }

        # Log results
        $successCount = ($results.Values | Where-Object { $_.Success }).Count
        $totalCount = $results.Count

        Write-DeploymentLog "Application pool shutdown completed: $successCount/$totalCount successful"

        # Check for failures
        $failures = $results.GetEnumerator() | Where-Object { -not $_.Value.Success }
        if ($failures) {
            $failureMessages = $failures | ForEach-Object { "$($_.Key): $($_.Value.Message)" }
            Write-DeploymentLog "Application pool shutdown failures: $($failureMessages -join '; ')" -Level Warning
        }

        return $results
    }
    catch {
        Write-DeploymentLog "Application pool shutdown failed: $($_.Exception.Message)" -Level Error
        throw
    }
}

function Start-WeSignAppPools {
    <#
    .SYNOPSIS
        Starts WeSign application pools in dependency order with health validation
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $false)]
        [System.Management.Automation.Runspaces.PSSession]$Session,

        [Parameter(Mandatory = $false)]
        [string[]]$PoolNames = $Global:WeSignConfig.AppPools.Keys,

        [Parameter(Mandatory = $false)]
        [string]$HealthCheckUrl = "http://devtest",

        [Parameter(Mandatory = $false)]
        [int]$MaxWaitTime = $Global:WeSignConfig.DefaultSettings.MaxWaitTime,

        [Parameter(Mandatory = $false)]
        [switch]$SkipHealthCheck
    )

    Write-DeploymentLog "Starting application pools: $($PoolNames -join ', ')"

    # Calculate startup order based on dependencies
    $startupOrder = Get-AppPoolStartupOrder -PoolNames $PoolNames

    Write-DeploymentLog "Startup order determined: $($startupOrder -join ' -> ')"

    $scriptBlock = {
        param($pools, $maxWait, $appPoolConfig, $healthUrl, $skipHealth)

        Import-Module WebAdministration -ErrorAction Stop

        $results = @{}
        $startTime = Get-Date

        foreach ($poolName in $pools) {
            Write-Host "Starting application pool: $poolName"

            try {
                $pool = Get-IISAppPool -Name $poolName -ErrorAction SilentlyContinue
                if (-not $pool) {
                    $results[$poolName] = @{
                        Success = $false
                        State = 'NotFound'
                        Message = "Application pool not found"
                        HealthStatus = 'NotApplicable'
                    }
                    continue
                }

                if ($pool.State -eq 'Started') {
                    Write-Host "Application pool $poolName is already running"
                    # Still perform health check if required
                    if (-not $skipHealth) {
                        $healthStatus = Test-AppPoolHealth -PoolName $poolName -HealthUrl $healthUrl -AppPoolConfig $appPoolConfig
                        $results[$poolName] = @{
                            Success = $true
                            State = 'AlreadyRunning'
                            Message = "Application pool was already started"
                            HealthStatus = $healthStatus.Status
                            HealthDetails = $healthStatus.Details
                        }
                    }
                    else {
                        $results[$poolName] = @{
                            Success = $true
                            State = 'AlreadyRunning'
                            Message = "Application pool was already started"
                            HealthStatus = 'Skipped'
                        }
                    }
                    continue
                }

                # Get pool-specific timeout
                $poolTimeout = if ($appPoolConfig[$poolName]) {
                    $appPoolConfig[$poolName].StartupTimeout
                } else {
                    60
                }

                # Start the pool
                Start-IISAppPool -Name $poolName -ErrorAction Stop
                Write-Host "Sent start command to $poolName"

                # Wait for pool to start
                $timeout = (Get-Date).AddSeconds($poolTimeout)
                do {
                    Start-Sleep -Seconds 2
                    $pool = Get-IISAppPool -Name $poolName -ErrorAction SilentlyContinue
                    $elapsed = (Get-Date) - $startTime

                    if ($elapsed.TotalSeconds -gt $maxWait) {
                        throw "Global timeout exceeded ($maxWait seconds)"
                    }
                }
                while ($pool.State -ne 'Started' -and (Get-Date) -lt $timeout)

                if ($pool.State -eq 'Started') {
                    Write-Host "Application pool $poolName started successfully"

                    # Perform health check
                    if (-not $skipHealth) {
                        Write-Host "Performing health check for $poolName"
                        $healthStatus = Test-AppPoolHealth -PoolName $poolName -HealthUrl $healthUrl -AppPoolConfig $appPoolConfig

                        $results[$poolName] = @{
                            Success = $healthStatus.Success
                            State = 'Started'
                            Message = if ($healthStatus.Success) { "Application pool started and health check passed" } else { "Application pool started but health check failed" }
                            HealthStatus = $healthStatus.Status
                            HealthDetails = $healthStatus.Details
                        }
                    }
                    else {
                        $results[$poolName] = @{
                            Success = $true
                            State = 'Started'
                            Message = "Application pool started successfully"
                            HealthStatus = 'Skipped'
                        }
                    }
                }
                else {
                    $results[$poolName] = @{
                        Success = $false
                        State = $pool.State
                        Message = "Application pool failed to start within timeout ($poolTimeout seconds)"
                        HealthStatus = 'NotApplicable'
                    }
                }
            }
            catch {
                $results[$poolName] = @{
                    Success = $false
                    State = 'Error'
                    Message = "Error starting application pool: $($_.Exception.Message)"
                    HealthStatus = 'NotApplicable'
                }
                Write-Warning "Failed to start $poolName : $($_.Exception.Message)"
            }
        }

        return $results
    }

    # Health check function to be available in remote session
    $healthCheckFunction = {
        function Test-AppPoolHealth {
            param($PoolName, $HealthUrl, $AppPoolConfig)

            try {
                $poolConfig = $AppPoolConfig[$PoolName]
                if (-not $poolConfig) {
                    return @{
                        Success = $false
                        Status = 'ConfigNotFound'
                        Details = "Pool configuration not found"
                    }
                }

                $endpoint = $poolConfig.HealthEndpoint
                $fullUrl = "$HealthUrl$endpoint"

                Write-Host "Health check URL: $fullUrl"

                # Perform HTTP health check with timeout
                $request = [System.Net.HttpWebRequest]::Create($fullUrl)
                $request.Timeout = 30000  # 30 seconds
                $request.Method = "GET"

                try {
                    $response = $request.GetResponse()
                    $statusCode = [int]$response.StatusCode
                    $response.Close()

                    if ($statusCode -eq 200) {
                        return @{
                            Success = $true
                            Status = 'Healthy'
                            Details = "HTTP $statusCode response received"
                        }
                    }
                    else {
                        return @{
                            Success = $false
                            Status = 'Unhealthy'
                            Details = "HTTP $statusCode response received"
                        }
                    }
                }
                catch [System.Net.WebException] {
                    $statusCode = [int]$_.Exception.Response.StatusCode
                    return @{
                        Success = $false
                        Status = 'Unhealthy'
                        Details = "HTTP error: $statusCode - $($_.Exception.Message)"
                    }
                }
            }
            catch {
                return @{
                    Success = $false
                    Status = 'Error'
                    Details = "Health check failed: $($_.Exception.Message)"
                }
            }
        }
    }

    try {
        if ($Session) {
            $results = Invoke-Command -Session $Session -ScriptBlock {
                param($pools, $maxWait, $appPoolConfig, $healthUrl, $skipHealth, $healthFunc)

                # Import the health check function
                . ([ScriptBlock]::Create($healthFunc))

                # Execute the main script block
                . ([ScriptBlock]::Create($using:scriptBlock.ToString())) $pools $maxWait $appPoolConfig $healthUrl $skipHealth

            } -ArgumentList @(,$startupOrder), $MaxWaitTime, $Global:WeSignConfig.AppPools, $HealthCheckUrl, $SkipHealthCheck.IsPresent, $healthCheckFunction.ToString() -ErrorAction Stop
        }
        else {
            # For local execution, define the health check function in current scope
            . $healthCheckFunction
            $results = & $scriptBlock $startupOrder $MaxWaitTime $Global:WeSignConfig.AppPools $HealthCheckUrl $SkipHealthCheck.IsPresent
        }

        # Log results
        $successCount = ($results.Values | Where-Object { $_.Success }).Count
        $totalCount = $results.Count
        $healthyCount = ($results.Values | Where-Object { $_.HealthStatus -eq 'Healthy' }).Count

        Write-DeploymentLog "Application pool startup completed: $successCount/$totalCount successful, $healthyCount/$totalCount healthy"

        # Check for failures
        $failures = $results.GetEnumerator() | Where-Object { -not $_.Value.Success }
        if ($failures) {
            $failureMessages = $failures | ForEach-Object { "$($_.Key): $($_.Value.Message)" }
            Write-DeploymentLog "Application pool startup failures: $($failureMessages -join '; ')" -Level Error
        }

        return $results
    }
    catch {
        Write-DeploymentLog "Application pool startup failed: $($_.Exception.Message)" -Level Error
        throw
    }
}

function Get-AppPoolStartupOrder {
    <#
    .SYNOPSIS
        Calculates application pool startup order based on dependencies
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$PoolNames
    )

    $orderedPools = @()
    $processed = @{}

    function Add-PoolWithDependencies($poolName) {
        if ($processed.ContainsKey($poolName)) {
            return
        }

        $poolConfig = $Global:WeSignConfig.AppPools[$poolName]
        if ($poolConfig -and $poolConfig.Dependencies) {
            foreach ($dependency in $poolConfig.Dependencies) {
                if ($PoolNames -contains $dependency) {
                    Add-PoolWithDependencies $dependency
                }
            }
        }

        if (-not $processed.ContainsKey($poolName)) {
            $orderedPools += $poolName
            $processed[$poolName] = $true
        }
    }

    foreach ($pool in $PoolNames) {
        Add-PoolWithDependencies $pool
    }

    return $orderedPools
}

function Get-AppPoolShutdownOrder {
    <#
    .SYNOPSIS
        Calculates application pool shutdown order (reverse dependency order)
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$PoolNames
    )

    $startupOrder = Get-AppPoolStartupOrder -PoolNames $PoolNames
    [array]::Reverse($startupOrder)
    return $startupOrder
}

function Reset-WeSignAppPools {
    <#
    .SYNOPSIS
        Performs a complete reset of WeSign application pools
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $false)]
        [System.Management.Automation.Runspaces.PSSession]$Session,

        [Parameter(Mandatory = $false)]
        [string[]]$PoolNames = $Global:WeSignConfig.AppPools.Keys,

        [Parameter(Mandatory = $false)]
        [string]$HealthCheckUrl = "http://devtest"
    )

    Write-DeploymentLog "Performing complete reset of application pools: $($PoolNames -join ', ')"

    try {
        # Stop all pools
        $stopResults = Stop-WeSignAppPools -Session $Session -PoolNames $PoolNames

        # Wait a moment for complete shutdown
        Start-Sleep -Seconds 5

        # Start all pools
        $startResults = Start-WeSignAppPools -Session $Session -PoolNames $PoolNames -HealthCheckUrl $HealthCheckUrl

        $resetResults = @{
            StopResults = $stopResults
            StartResults = $startResults
            OverallSuccess = (($stopResults.Values | Where-Object { $_.Success }).Count -eq $stopResults.Count) -and
                           (($startResults.Values | Where-Object { $_.Success }).Count -eq $startResults.Count)
        }

        if ($resetResults.OverallSuccess) {
            Write-DeploymentLog "Application pool reset completed successfully"
        }
        else {
            Write-DeploymentLog "Application pool reset completed with some failures" -Level Warning
        }

        return $resetResults
    }
    catch {
        Write-DeploymentLog "Application pool reset failed: $($_.Exception.Message)" -Level Error
        throw
    }
}

function Get-WeSignPoolsHealthReport {
    <#
    .SYNOPSIS
        Generates comprehensive health report for WeSign application pools
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $false)]
        [System.Management.Automation.Runspaces.PSSession]$Session,

        [Parameter(Mandatory = $false)]
        [string[]]$PoolNames = $Global:WeSignConfig.AppPools.Keys,

        [Parameter(Mandatory = $false)]
        [string]$HealthCheckUrl = "http://devtest"
    )

    Write-DeploymentLog "Generating health report for application pools"

    try {
        # Get pool status
        $poolStatus = Get-AppPoolStatus -Session $Session -PoolNames $PoolNames

        # Perform health checks
        $healthResults = @{}
        foreach ($poolName in $PoolNames) {
            if ($poolStatus[$poolName].State -eq 'Started') {
                # Perform individual health check
                # This would need to be implemented similar to the health check in Start-WeSignAppPools
                $healthResults[$poolName] = @{
                    Status = 'Unknown'
                    Details = 'Health check not implemented in this function'
                }
            }
            else {
                $healthResults[$poolName] = @{
                    Status = 'NotRunning'
                    Details = "Pool state: $($poolStatus[$poolName].State)"
                }
            }
        }

        $report = @{
            Timestamp = Get-Date
            PoolStatus = $poolStatus
            HealthResults = $healthResults
            Summary = @{
                TotalPools = $PoolNames.Count
                RunningPools = ($poolStatus.Values | Where-Object { $_.State -eq 'Started' }).Count
                HealthyPools = ($healthResults.Values | Where-Object { $_.Status -eq 'Healthy' }).Count
            }
        }

        Write-DeploymentLog "Health report generated: $($report.Summary.RunningPools)/$($report.Summary.TotalPools) running, $($report.Summary.HealthyPools)/$($report.Summary.TotalPools) healthy"

        return $report
    }
    catch {
        Write-DeploymentLog "Failed to generate health report: $($_.Exception.Message)" -Level Error
        throw
    }
}

# Export module functions
Export-ModuleMember -Function @(
    'Get-AppPoolStatus',
    'Stop-WeSignAppPools',
    'Start-WeSignAppPools',
    'Reset-WeSignAppPools',
    'Get-WeSignPoolsHealthReport',
    'Get-AppPoolStartupOrder',
    'Get-AppPoolShutdownOrder'
)

Write-DeploymentLog "IIS App Pool Management module loaded successfully"