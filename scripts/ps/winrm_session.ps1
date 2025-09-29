#Requires -Version 5.1
#Requires -Modules WebAdministration

<#
.SYNOPSIS
    WinRM Session Management for WeSign Deployment

.DESCRIPTION
    Provides secure PSSession creation, management and validation for WeSign deployment
    to Windows DevTest servers with IIS over HTTPS (port 5986).

.PARAMETER ComputerName
    Target server hostname or IP address

.PARAMETER Credential
    Domain credentials for authentication

.PARAMETER MaxRetryAttempts
    Maximum number of connection retry attempts (default: 3)

.PARAMETER RetryDelaySeconds
    Delay between retry attempts in seconds (default: 10)

.EXAMPLE
    $session = New-SecureWinRMSession -ComputerName "devtest.contoso.com" -Credential $creds

.EXAMPLE
    Test-WinRMConnectivity -ComputerName "devtest.contoso.com" -Credential $creds

.NOTES
    Author: QA Intelligence Platform
    Version: 1.0
    Created: 2025-09-26
#>

[CmdletBinding()]
param()

# Global configuration
$Global:WinRMConfig = @{
    Port = 5986
    UseSSL = $true
    Authentication = 'Negotiate'
    SessionOptions = @{
        SkipCACheck = $false
        SkipCNCheck = $false
        SkipRevocationCheck = $false
        OperationTimeout = 300000  # 5 minutes
        IdleTimeout = 3600000      # 1 hour
    }
    MaxRetryAttempts = 3
    RetryDelaySeconds = 10
}

# Import required modules
try {
    Import-Module WebAdministration -ErrorAction Stop
    Write-Verbose "WebAdministration module imported successfully"
}
catch {
    Write-Error "Failed to import WebAdministration module: $($_.Exception.Message)"
    throw
}

function Write-DeploymentLog {
    <#
    .SYNOPSIS
        Writes deployment log entries to Windows Event Log and file
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message,

        [Parameter(Mandatory = $false)]
        [ValidateSet('Information', 'Warning', 'Error')]
        [string]$Level = 'Information',

        [Parameter(Mandatory = $false)]
        [string]$Source = 'WeSignDeployment'
    )

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"

    # Console output with color coding
    switch ($Level) {
        'Information' { Write-Host $logMessage -ForegroundColor Green }
        'Warning' { Write-Host $logMessage -ForegroundColor Yellow }
        'Error' { Write-Host $logMessage -ForegroundColor Red }
    }

    # Windows Event Log
    try {
        $eventId = switch ($Level) {
            'Information' { 1000 }
            'Warning' { 2000 }
            'Error' { 3000 }
        }

        # Create event source if it doesn't exist
        if (-not [System.Diagnostics.EventLog]::SourceExists($Source)) {
            [System.Diagnostics.EventLog]::CreateEventSource($Source, 'Application')
        }

        Write-EventLog -LogName Application -Source $Source -EventId $eventId -EntryType $Level -Message $logMessage
    }
    catch {
        Write-Warning "Failed to write to Windows Event Log: $($_.Exception.Message)"
    }

    # File logging
    $logPath = "C:\Logs\WeSignDeployment"
    if (-not (Test-Path $logPath)) {
        New-Item -Path $logPath -ItemType Directory -Force | Out-Null
    }

    $logFile = Join-Path $logPath "deployment_$(Get-Date -Format 'yyyyMMdd').log"
    try {
        Add-Content -Path $logFile -Value $logMessage -Encoding UTF8
    }
    catch {
        Write-Warning "Failed to write to log file: $($_.Exception.Message)"
    }
}

function Test-WinRMConnectivity {
    <#
    .SYNOPSIS
        Tests WinRM connectivity to target server
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ComputerName,

        [Parameter(Mandatory = $true)]
        [PSCredential]$Credential,

        [Parameter(Mandatory = $false)]
        [int]$TimeoutSeconds = 30
    )

    Write-DeploymentLog "Testing WinRM connectivity to $ComputerName"

    try {
        $sessionOptions = New-PSSessionOption -OperationTimeout ($TimeoutSeconds * 1000) -IdleTimeout ($TimeoutSeconds * 1000)

        $testSession = New-PSSession -ComputerName $ComputerName -Port $Global:WinRMConfig.Port -UseSSL:$Global:WinRMConfig.UseSSL -Credential $Credential -SessionOption $sessionOptions -Authentication $Global:WinRMConfig.Authentication -ErrorAction Stop

        if ($testSession) {
            # Test basic functionality
            $result = Invoke-Command -Session $testSession -ScriptBlock {
                @{
                    ComputerName = $env:COMPUTERNAME
                    OSVersion = (Get-WmiObject -Class Win32_OperatingSystem).Version
                    PowerShellVersion = $PSVersionTable.PSVersion.ToString()
                    IISInstalled = (Get-WindowsFeature -Name IIS-WebServer -ErrorAction SilentlyContinue).InstallState -eq 'Installed'
                }
            } -ErrorAction Stop

            Remove-PSSession $testSession -ErrorAction SilentlyContinue

            Write-DeploymentLog "WinRM connectivity test successful. Target: $($result.ComputerName), OS: $($result.OSVersion), PS: $($result.PowerShellVersion), IIS: $($result.IISInstalled)"

            return @{
                Success = $true
                Details = $result
            }
        }
    }
    catch {
        Write-DeploymentLog "WinRM connectivity test failed: $($_.Exception.Message)" -Level Error

        return @{
            Success = $false
            Error = $_.Exception.Message
        }
    }
}

function New-SecureWinRMSession {
    <#
    .SYNOPSIS
        Creates a secure PSSession with retry logic and comprehensive validation
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ComputerName,

        [Parameter(Mandatory = $true)]
        [PSCredential]$Credential,

        [Parameter(Mandatory = $false)]
        [int]$MaxRetryAttempts = $Global:WinRMConfig.MaxRetryAttempts,

        [Parameter(Mandatory = $false)]
        [int]$RetryDelaySeconds = $Global:WinRMConfig.RetryDelaySeconds
    )

    Write-DeploymentLog "Creating secure WinRM session to $ComputerName"

    # Validate credentials
    if (-not $Credential -or [string]::IsNullOrEmpty($Credential.UserName)) {
        throw "Valid credentials are required"
    }

    # Create session options with security settings
    $sessionOptions = New-PSSessionOption @{
        OperationTimeout = $Global:WinRMConfig.SessionOptions.OperationTimeout
        IdleTimeout = $Global:WinRMConfig.SessionOptions.IdleTimeout
        SkipCACheck = $Global:WinRMConfig.SessionOptions.SkipCACheck
        SkipCNCheck = $Global:WinRMConfig.SessionOptions.SkipCNCheck
        SkipRevocationCheck = $Global:WinRMConfig.SessionOptions.SkipRevocationCheck
    }

    $attempt = 0
    do {
        $attempt++
        Write-DeploymentLog "Connection attempt $attempt of $MaxRetryAttempts"

        try {
            $session = New-PSSession -ComputerName $ComputerName -Port $Global:WinRMConfig.Port -UseSSL:$Global:WinRMConfig.UseSSL -Credential $Credential -SessionOption $sessionOptions -Authentication $Global:WinRMConfig.Authentication -ErrorAction Stop

            if ($session -and $session.State -eq 'Opened') {
                Write-DeploymentLog "WinRM session established successfully (Session ID: $($session.Id))"

                # Validate session functionality
                $validation = Test-SessionFunctionality -Session $session
                if ($validation.Success) {
                    return $session
                }
                else {
                    Remove-PSSession $session -ErrorAction SilentlyContinue
                    throw "Session functionality validation failed: $($validation.Error)"
                }
            }
            else {
                throw "Session creation returned invalid state: $($session.State)"
            }
        }
        catch {
            $errorMessage = $_.Exception.Message
            Write-DeploymentLog "Session creation attempt $attempt failed: $errorMessage" -Level Warning

            if ($attempt -eq $MaxRetryAttempts) {
                Write-DeploymentLog "All connection attempts failed. Last error: $errorMessage" -Level Error
                throw "Failed to establish WinRM session after $MaxRetryAttempts attempts: $errorMessage"
            }

            Write-DeploymentLog "Waiting $RetryDelaySeconds seconds before retry..."
            Start-Sleep -Seconds $RetryDelaySeconds
        }
    }
    while ($attempt -lt $MaxRetryAttempts)
}

function Test-SessionFunctionality {
    <#
    .SYNOPSIS
        Validates PSSession functionality and permissions
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [System.Management.Automation.Runspaces.PSSession]$Session
    )

    try {
        # Test basic PowerShell functionality
        $basicTest = Invoke-Command -Session $Session -ScriptBlock {
            $env:COMPUTERNAME
        } -ErrorAction Stop

        if ([string]::IsNullOrEmpty($basicTest)) {
            return @{ Success = $false; Error = "Basic PowerShell execution failed" }
        }

        # Test IIS module availability
        $iisTest = Invoke-Command -Session $Session -ScriptBlock {
            try {
                Import-Module WebAdministration -ErrorAction Stop
                Get-Website | Select-Object -First 1 | Out-Null
                return $true
            }
            catch {
                return $false
            }
        } -ErrorAction Stop

        if (-not $iisTest) {
            return @{ Success = $false; Error = "IIS WebAdministration module not available or insufficient permissions" }
        }

        # Test file system access to deployment paths
        $fileSystemTest = Invoke-Command -Session $Session -ScriptBlock {
            $testPaths = @('C:\inetpub', 'C:\deploy')
            $results = @{}

            foreach ($path in $testPaths) {
                try {
                    $access = Test-Path $path
                    if ($access) {
                        # Test write permissions
                        $testFile = Join-Path $path "deployment_test_$(Get-Date -Format 'yyyyMMddHHmmss').tmp"
                        "test" | Out-File -FilePath $testFile -ErrorAction Stop
                        Remove-Item $testFile -ErrorAction SilentlyContinue
                        $results[$path] = 'ReadWrite'
                    }
                    else {
                        $results[$path] = 'NotExists'
                    }
                }
                catch {
                    $results[$path] = 'ReadOnly'
                }
            }

            return $results
        } -ErrorAction Stop

        # Validate required paths
        $requiredPaths = @('C:\inetpub')
        foreach ($path in $requiredPaths) {
            if ($fileSystemTest[$path] -ne 'ReadWrite') {
                return @{ Success = $false; Error = "Insufficient permissions for required path: $path" }
            }
        }

        Write-DeploymentLog "Session functionality validation passed"
        return @{ Success = $true; FileSystemAccess = $fileSystemTest }
    }
    catch {
        return @{ Success = $false; Error = $_.Exception.Message }
    }
}

function Remove-SecureWinRMSession {
    <#
    .SYNOPSIS
        Safely removes PSSession with cleanup
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [System.Management.Automation.Runspaces.PSSession]$Session
    )

    if ($Session) {
        try {
            Write-DeploymentLog "Removing WinRM session (ID: $($Session.Id))"
            Remove-PSSession $Session -ErrorAction Stop
            Write-DeploymentLog "WinRM session removed successfully"
        }
        catch {
            Write-DeploymentLog "Error removing WinRM session: $($_.Exception.Message)" -Level Warning
        }
    }
}

function Get-SessionInfo {
    <#
    .SYNOPSIS
        Retrieves detailed information about active sessions
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $false)]
        [System.Management.Automation.Runspaces.PSSession]$Session
    )

    if ($Session) {
        return @{
            Id = $Session.Id
            Name = $Session.Name
            ComputerName = $Session.ComputerName
            State = $Session.State
            Availability = $Session.Availability
            Transport = $Session.Transport
            RunspaceId = $Session.Runspace.Id
            Created = $Session.ConfigurationName
        }
    }
    else {
        return Get-PSSession | ForEach-Object {
            @{
                Id = $_.Id
                Name = $_.Name
                ComputerName = $_.ComputerName
                State = $_.State
                Availability = $_.Availability
                Transport = $_.Transport
                RunspaceId = $_.Runspace.Id
                Created = $_.ConfigurationName
            }
        }
    }
}

function Initialize-WinRMEnvironment {
    <#
    .SYNOPSIS
        Initializes the local WinRM environment for deployment operations
    #>
    [CmdletBinding()]
    param()

    Write-DeploymentLog "Initializing WinRM environment"

    try {
        # Check if WinRM service is running
        $winrmService = Get-Service -Name WinRM -ErrorAction Stop
        if ($winrmService.Status -ne 'Running') {
            Write-DeploymentLog "WinRM service is not running, attempting to start..." -Level Warning
            Start-Service -Name WinRM -ErrorAction Stop
            Write-DeploymentLog "WinRM service started successfully"
        }

        # Configure WinRM client settings if needed
        $currentMaxEnvelopeSize = (Get-Item WSMan:\localhost\Client\MaxEnvelopeSizekb).Value
        $requiredMaxEnvelopeSize = 8192

        if ([int]$currentMaxEnvelopeSize -lt $requiredMaxEnvelopeSize) {
            Write-DeploymentLog "Updating WinRM MaxEnvelopeSizekb from $currentMaxEnvelopeSize to $requiredMaxEnvelopeSize"
            Set-Item WSMan:\localhost\Client\MaxEnvelopeSizekb -Value $requiredMaxEnvelopeSize -ErrorAction Stop
        }

        # Set trusted hosts if needed (for non-domain scenarios)
        # Note: This should be configured based on your security requirements

        Write-DeploymentLog "WinRM environment initialized successfully"
        return $true
    }
    catch {
        Write-DeploymentLog "Failed to initialize WinRM environment: $($_.Exception.Message)" -Level Error
        return $false
    }
}

# Export module functions
Export-ModuleMember -Function @(
    'New-SecureWinRMSession',
    'Remove-SecureWinRMSession',
    'Test-WinRMConnectivity',
    'Test-SessionFunctionality',
    'Get-SessionInfo',
    'Initialize-WinRMEnvironment',
    'Write-DeploymentLog'
)

Write-DeploymentLog "WinRM Session Management module loaded successfully"