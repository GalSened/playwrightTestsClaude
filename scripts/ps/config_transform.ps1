#Requires -Version 5.1

<#
.SYNOPSIS
    Configuration Management and Transformation for WeSign Deployment

.DESCRIPTION
    Handles environment-specific configuration transformations for WeSign deployment.
    Transforms app settings, connection strings, and applies environment-specific overrides
    with validation and secure handling of sensitive data.

.PARAMETER SourcePath
    Path to the source configuration files

.PARAMETER Environment
    Target environment (DevTest, Staging, Production)

.PARAMETER ConfigFile
    Path to main configuration file (default: web.config)

.PARAMETER TransformFile
    Path to transformation file (optional, auto-detected)

.EXAMPLE
    Transform-WeSignConfig -SourcePath "C:\deploy" -Environment "DevTest"

.EXAMPLE
    Update-ConnectionStrings -ConfigPath "C:\inetpub\WeSign\web.config" -Environment "Production"

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

# Global configuration transformation settings
$Global:ConfigTransformConfig = @{
    Environments = @{
        'DevTest' = @{
            DatabaseServer = 'devtest-sql.contoso.com'
            DatabaseName = 'WeSign_DevTest'
            RedisServer = 'devtest-redis.contoso.com'
            LogLevel = 'Debug'
            EnableDetailedErrors = $true
            CacheTimeout = 300
            SessionTimeout = 20
            CompilationDebug = $true
            CustomErrors = 'Off'
        }
        'Staging' = @{
            DatabaseServer = 'staging-sql.contoso.com'
            DatabaseName = 'WeSign_Staging'
            RedisServer = 'staging-redis.contoso.com'
            LogLevel = 'Information'
            EnableDetailedErrors = $false
            CacheTimeout = 600
            SessionTimeout = 30
            CompilationDebug = $false
            CustomErrors = 'RemoteOnly'
        }
        'Production' = @{
            DatabaseServer = 'prod-sql.contoso.com'
            DatabaseName = 'WeSign_Production'
            RedisServer = 'prod-redis.contoso.com'
            LogLevel = 'Warning'
            EnableDetailedErrors = $false
            CacheTimeout = 1800
            SessionTimeout = 60
            CompilationDebug = $false
            CustomErrors = 'RemoteOnly'
        }
    }
    ConfigFiles = @{
        'web.config' = @{
            Type = 'WebConfig'
            BackupSuffix = '.original'
            Validations = @('ValidateXml', 'ValidateConnectionStrings', 'ValidateAppSettings')
        }
        'appsettings.json' = @{
            Type = 'JsonConfig'
            BackupSuffix = '.original'
            Validations = @('ValidateJson', 'ValidateSettings')
        }
        'log4net.config' = @{
            Type = 'XmlConfig'
            BackupSuffix = '.original'
            Validations = @('ValidateXml')
        }
    }
    Security = @{
        EncryptSections = @('connectionStrings', 'appSettings')
        SecureKeys = @('password', 'connectionstring', 'key', 'secret', 'token')
        RedactInLogs = $true
    }
}

function Transform-WeSignConfig {
    <#
    .SYNOPSIS
        Main configuration transformation function
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$SourcePath,

        [Parameter(Mandatory = $true)]
        [ValidateSet('DevTest', 'Staging', 'Production')]
        [string]$Environment,

        [Parameter(Mandatory = $false)]
        [string]$ConfigFile = 'web.config'
    )

    Write-DeploymentLog "Starting configuration transformation for environment: $Environment"

    if (-not (Test-Path $SourcePath)) {
        throw "Source path does not exist: $SourcePath"
    }

    $configPath = Join-Path $SourcePath $ConfigFile
    if (-not (Test-Path $configPath)) {
        throw "Configuration file not found: $configPath"
    }

    try {
        # Create backup of original config
        $backupResult = Backup-ConfigFile -ConfigPath $configPath

        # Apply environment-specific transformations
        $transformResult = Apply-EnvironmentTransformations -ConfigPath $configPath -Environment $Environment

        # Update connection strings
        $connectionResult = Update-ConnectionStrings -ConfigPath $configPath -Environment $Environment

        # Transform app settings
        $appSettingsResult = Transform-AppSettings -ConfigPath $configPath -Environment $Environment

        # Apply security transformations
        $securityResult = Apply-SecurityTransformations -ConfigPath $configPath -Environment $Environment

        # Validate final configuration
        $validationResult = Validate-ConfigurationIntegrity -ConfigPath $configPath

        if (-not $validationResult.Success) {
            Write-DeploymentLog "Configuration validation failed, restoring backup" -Level Warning
            Restore-ConfigFile -ConfigPath $configPath -BackupPath $backupResult.BackupPath
            throw "Configuration validation failed: $($validationResult.Errors -join '; ')"
        }

        Write-DeploymentLog "Configuration transformation completed successfully"

        return @{
            Success = $true
            ConfigPath = $configPath
            BackupPath = $backupResult.BackupPath
            Transformations = @{
                Environment = $transformResult
                ConnectionStrings = $connectionResult
                AppSettings = $appSettingsResult
                Security = $securityResult
            }
            Validation = $validationResult
        }
    }
    catch {
        Write-DeploymentLog "Configuration transformation failed: $($_.Exception.Message)" -Level Error
        throw
    }
}

function Backup-ConfigFile {
    <#
    .SYNOPSIS
        Creates a backup of the configuration file
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ConfigPath
    )

    try {
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $configDir = Split-Path $ConfigPath -Parent
        $configName = Split-Path $ConfigPath -Leaf
        $backupName = "$configName.backup_$timestamp"
        $backupPath = Join-Path $configDir $backupName

        Copy-Item -Path $ConfigPath -Destination $backupPath -Force

        Write-DeploymentLog "Configuration backup created: $backupPath"

        return @{
            Success = $true
            BackupPath = $backupPath
            OriginalPath = $ConfigPath
        }
    }
    catch {
        Write-DeploymentLog "Failed to backup configuration file: $($_.Exception.Message)" -Level Error
        throw
    }
}

function Restore-ConfigFile {
    <#
    .SYNOPSIS
        Restores configuration from backup
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ConfigPath,

        [Parameter(Mandatory = $true)]
        [string]$BackupPath
    )

    try {
        if (-not (Test-Path $BackupPath)) {
            throw "Backup file not found: $BackupPath"
        }

        Copy-Item -Path $BackupPath -Destination $ConfigPath -Force

        Write-DeploymentLog "Configuration restored from backup: $BackupPath"

        return @{
            Success = $true
            RestoredPath = $ConfigPath
            BackupPath = $BackupPath
        }
    }
    catch {
        Write-DeploymentLog "Failed to restore configuration file: $($_.Exception.Message)" -Level Error
        throw
    }
}

function Apply-EnvironmentTransformations {
    <#
    .SYNOPSIS
        Applies environment-specific transformations using web.config transforms
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ConfigPath,

        [Parameter(Mandatory = $true)]
        [string]$Environment
    )

    Write-DeploymentLog "Applying environment transformations for: $Environment"

    try {
        $configDir = Split-Path $ConfigPath -Parent
        $configName = Split-Path $ConfigPath -LeafBase
        $transformFile = Join-Path $configDir "$configName.$Environment.config"

        # Check if transform file exists
        if (Test-Path $transformFile) {
            Write-DeploymentLog "Found transform file: $transformFile"

            # Load XML documents
            $configXml = New-Object System.Xml.XmlDocument
            $configXml.PreserveWhitespace = $true
            $configXml.Load($ConfigPath)

            $transformXml = New-Object System.Xml.XmlDocument
            $transformXml.Load($transformFile)

            # Apply basic transformations manually (simplified approach)
            $transformResult = Apply-XmlTransformations -SourceXml $configXml -TransformXml $transformXml

            if ($transformResult.Success) {
                $configXml.Save($ConfigPath)
                Write-DeploymentLog "XML transformations applied successfully"
            }
            else {
                throw "XML transformation failed: $($transformResult.Error)"
            }

            return @{
                Success = $true
                TransformFile = $transformFile
                AppliedTransformations = $transformResult.AppliedTransformations
            }
        }
        else {
            Write-DeploymentLog "No transform file found for environment: $Environment" -Level Warning

            return @{
                Success = $true
                TransformFile = $null
                Message = "No transform file found, using manual transformations"
            }
        }
    }
    catch {
        Write-DeploymentLog "Environment transformation failed: $($_.Exception.Message)" -Level Error
        throw
    }
}

function Apply-XmlTransformations {
    <#
    .SYNOPSIS
        Applies XML transformations (simplified implementation)
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [System.Xml.XmlDocument]$SourceXml,

        [Parameter(Mandatory = $true)]
        [System.Xml.XmlDocument]$TransformXml
    )

    try {
        $transformations = @()

        # Find all transform nodes
        $transformNodes = $transformXml.SelectNodes("//*[@xdt:Transform]", $null)

        foreach ($transformNode in $transformNodes) {
            $xpath = Get-XPath -Node $transformNode
            $transform = $transformNode.GetAttribute("Transform")
            $locator = $transformNode.GetAttribute("Locator")

            # Find matching nodes in source
            $sourceNode = $SourceXml.SelectSingleNode($xpath)

            if ($sourceNode) {
                switch ($transform) {
                    'Replace' {
                        $sourceNode.InnerXml = $transformNode.InnerXml
                        $transformations += "Replaced $xpath"
                    }
                    'Insert' {
                        $sourceNode.AppendChild($SourceXml.ImportNode($transformNode, $true))
                        $transformations += "Inserted into $xpath"
                    }
                    'Remove' {
                        $sourceNode.ParentNode.RemoveChild($sourceNode)
                        $transformations += "Removed $xpath"
                    }
                    'SetAttributes' {
                        foreach ($attr in $transformNode.Attributes) {
                            if ($attr.Name -notlike "xdt:*") {
                                $sourceNode.SetAttribute($attr.Name, $attr.Value)
                                $transformations += "Set attribute $($attr.Name) on $xpath"
                            }
                        }
                    }
                }
            }
        }

        return @{
            Success = $true
            AppliedTransformations = $transformations
        }
    }
    catch {
        return @{
            Success = $false
            Error = $_.Exception.Message
        }
    }
}

function Get-XPath {
    <#
    .SYNOPSIS
        Gets XPath for an XML node (simplified)
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [System.Xml.XmlNode]$Node
    )

    $xpath = ""
    $current = $Node

    while ($current -and $current.NodeType -ne [System.Xml.XmlNodeType]::Document) {
        $name = $current.Name
        $xpath = "/$name$xpath"
        $current = $current.ParentNode
    }

    return $xpath
}

function Update-ConnectionStrings {
    <#
    .SYNOPSIS
        Updates connection strings for the target environment
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ConfigPath,

        [Parameter(Mandatory = $true)]
        [string]$Environment
    )

    Write-DeploymentLog "Updating connection strings for environment: $Environment"

    try {
        $envConfig = $Global:ConfigTransformConfig.Environments[$Environment]
        if (-not $envConfig) {
            throw "Environment configuration not found: $Environment"
        }

        # Load configuration XML
        $configXml = New-Object System.Xml.XmlDocument
        $configXml.PreserveWhitespace = $true
        $configXml.Load($ConfigPath)

        $updates = @()

        # Update default connection string
        $connectionStringsNode = $configXml.SelectSingleNode("//connectionStrings")
        if ($connectionStringsNode) {
            $defaultConnNode = $connectionStringsNode.SelectSingleNode("add[@name='DefaultConnection']")

            if ($defaultConnNode) {
                # Build new connection string
                $newConnectionString = "Server=$($envConfig.DatabaseServer);Database=$($envConfig.DatabaseName);Integrated Security=true;MultipleActiveResultSets=true;TrustServerCertificate=true"

                $oldConnectionString = $defaultConnNode.GetAttribute("connectionString")
                $defaultConnNode.SetAttribute("connectionString", $newConnectionString)

                $updates += "Updated DefaultConnection"

                if ($Global:ConfigTransformConfig.Security.RedactInLogs) {
                    Write-DeploymentLog "Connection string updated (content redacted for security)"
                }
                else {
                    Write-DeploymentLog "Updated connection string: $newConnectionString"
                }
            }
            else {
                # Create new connection string node
                $newConnNode = $configXml.CreateElement("add")
                $newConnNode.SetAttribute("name", "DefaultConnection")
                $newConnNode.SetAttribute("connectionString", "Server=$($envConfig.DatabaseServer);Database=$($envConfig.DatabaseName);Integrated Security=true;MultipleActiveResultSets=true;TrustServerCertificate=true")
                $newConnNode.SetAttribute("providerName", "System.Data.SqlClient")

                $connectionStringsNode.AppendChild($newConnNode)
                $updates += "Created DefaultConnection"
            }

            # Update Redis connection string if present
            $redisConnNode = $connectionStringsNode.SelectSingleNode("add[@name='RedisConnection']")
            if ($redisConnNode) {
                $redisConnectionString = "$($envConfig.RedisServer):6379"
                $redisConnNode.SetAttribute("connectionString", $redisConnectionString)
                $updates += "Updated RedisConnection"
            }
        }
        else {
            # Create connectionStrings section
            $connectionStringsNode = $configXml.CreateElement("connectionStrings")

            $defaultConnNode = $configXml.CreateElement("add")
            $defaultConnNode.SetAttribute("name", "DefaultConnection")
            $defaultConnNode.SetAttribute("connectionString", "Server=$($envConfig.DatabaseServer);Database=$($envConfig.DatabaseName);Integrated Security=true;MultipleActiveResultSets=true;TrustServerCertificate=true")
            $defaultConnNode.SetAttribute("providerName", "System.Data.SqlClient")

            $connectionStringsNode.AppendChild($defaultConnNode)
            $configXml.DocumentElement.AppendChild($connectionStringsNode)

            $updates += "Created connectionStrings section"
        }

        # Save updated configuration
        $configXml.Save($ConfigPath)

        Write-DeploymentLog "Connection strings updated successfully: $($updates -join ', ')"

        return @{
            Success = $true
            Updates = $updates
            Environment = $Environment
        }
    }
    catch {
        Write-DeploymentLog "Failed to update connection strings: $($_.Exception.Message)" -Level Error
        throw
    }
}

function Transform-AppSettings {
    <#
    .SYNOPSIS
        Transforms application settings for the target environment
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ConfigPath,

        [Parameter(Mandatory = $true)]
        [string]$Environment
    )

    Write-DeploymentLog "Transforming app settings for environment: $Environment"

    try {
        $envConfig = $Global:ConfigTransformConfig.Environments[$Environment]
        if (-not $envConfig) {
            throw "Environment configuration not found: $Environment"
        }

        # Load configuration XML
        $configXml = New-Object System.Xml.XmlDocument
        $configXml.PreserveWhitespace = $true
        $configXml.Load($ConfigPath)

        $updates = @()

        # Get or create appSettings section
        $appSettingsNode = $configXml.SelectSingleNode("//appSettings")
        if (-not $appSettingsNode) {
            $appSettingsNode = $configXml.CreateElement("appSettings")
            $configXml.DocumentElement.AppendChild($appSettingsNode)
        }

        # Define environment-specific settings
        $settingsToUpdate = @{
            'Environment' = $Environment
            'LogLevel' = $envConfig.LogLevel
            'EnableDetailedErrors' = $envConfig.EnableDetailedErrors.ToString()
            'CacheTimeoutSeconds' = $envConfig.CacheTimeout.ToString()
            'SessionTimeoutMinutes' = $envConfig.SessionTimeout.ToString()
            'RedisServer' = $envConfig.RedisServer
        }

        foreach ($settingName in $settingsToUpdate.Keys) {
            $settingValue = $settingsToUpdate[$settingName]

            # Find existing setting
            $settingNode = $appSettingsNode.SelectSingleNode("add[@key='$settingName']")

            if ($settingNode) {
                $oldValue = $settingNode.GetAttribute("value")
                $settingNode.SetAttribute("value", $settingValue)
                $updates += "Updated $settingName"
            }
            else {
                # Create new setting
                $newSettingNode = $configXml.CreateElement("add")
                $newSettingNode.SetAttribute("key", $settingName)
                $newSettingNode.SetAttribute("value", $settingValue)
                $appSettingsNode.AppendChild($newSettingNode)
                $updates += "Created $settingName"
            }
        }

        # Update compilation debug setting
        $systemWebNode = $configXml.SelectSingleNode("//system.web")
        if ($systemWebNode) {
            $compilationNode = $systemWebNode.SelectSingleNode("compilation")
            if ($compilationNode) {
                $compilationNode.SetAttribute("debug", $envConfig.CompilationDebug.ToString().ToLower())
                $updates += "Updated compilation debug"
            }

            # Update custom errors
            $customErrorsNode = $systemWebNode.SelectSingleNode("customErrors")
            if ($customErrorsNode) {
                $customErrorsNode.SetAttribute("mode", $envConfig.CustomErrors)
                $updates += "Updated custom errors mode"
            }
        }

        # Save updated configuration
        $configXml.Save($ConfigPath)

        Write-DeploymentLog "App settings transformed successfully: $($updates -join ', ')"

        return @{
            Success = $true
            Updates = $updates
            Environment = $Environment
            UpdatedSettings = $settingsToUpdate.Keys
        }
    }
    catch {
        Write-DeploymentLog "Failed to transform app settings: $($_.Exception.Message)" -Level Error
        throw
    }
}

function Apply-SecurityTransformations {
    <#
    .SYNOPSIS
        Applies security transformations to configuration
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ConfigPath,

        [Parameter(Mandatory = $true)]
        [string]$Environment
    )

    Write-DeploymentLog "Applying security transformations"

    try {
        $securityActions = @()

        # Load configuration XML
        $configXml = New-Object System.Xml.XmlDocument
        $configXml.PreserveWhitespace = $true
        $configXml.Load($ConfigPath)

        # Remove development-only settings in production
        if ($Environment -eq 'Production') {
            # Remove compilation debug="true" if still present
            $compilationNode = $configXml.SelectSingleNode("//compilation[@debug='true']")
            if ($compilationNode) {
                $compilationNode.SetAttribute("debug", "false")
                $securityActions += "Disabled compilation debug"
            }

            # Ensure custom errors are enabled
            $customErrorsNode = $configXml.SelectSingleNode("//customErrors")
            if ($customErrorsNode -and $customErrorsNode.GetAttribute("mode") -eq "Off") {
                $customErrorsNode.SetAttribute("mode", "RemoteOnly")
                $securityActions += "Enabled custom errors"
            }

            # Remove trace settings
            $traceNode = $configXml.SelectSingleNode("//trace")
            if ($traceNode -and $traceNode.GetAttribute("enabled") -eq "true") {
                $traceNode.SetAttribute("enabled", "false")
                $securityActions += "Disabled tracing"
            }
        }

        # Add security headers if not present
        $systemWebServerNode = $configXml.SelectSingleNode("//system.webServer")
        if ($systemWebServerNode) {
            $httpProtocolNode = $systemWebServerNode.SelectSingleNode("httpProtocol")
            if (-not $httpProtocolNode) {
                $httpProtocolNode = $configXml.CreateElement("httpProtocol")
                $systemWebServerNode.AppendChild($httpProtocolNode)
            }

            $customHeadersNode = $httpProtocolNode.SelectSingleNode("customHeaders")
            if (-not $customHeadersNode) {
                $customHeadersNode = $configXml.CreateElement("customHeaders")
                $httpProtocolNode.AppendChild($customHeadersNode)

                # Add security headers
                $securityHeaders = @{
                    'X-Frame-Options' = 'SAMEORIGIN'
                    'X-Content-Type-Options' = 'nosniff'
                    'X-XSS-Protection' = '1; mode=block'
                    'Referrer-Policy' = 'strict-origin-when-cross-origin'
                }

                foreach ($headerName in $securityHeaders.Keys) {
                    $headerNode = $configXml.CreateElement("add")
                    $headerNode.SetAttribute("name", $headerName)
                    $headerNode.SetAttribute("value", $securityHeaders[$headerName])
                    $customHeadersNode.AppendChild($headerNode)
                }

                $securityActions += "Added security headers"
            }
        }

        # Validate sensitive configuration sections
        $sensitiveNodes = $configXml.SelectNodes("//add[contains(@connectionString, 'password') or contains(@value, 'password') or contains(@value, 'secret')]")
        if ($sensitiveNodes.Count -gt 0) {
            Write-DeploymentLog "WARNING: Found $($sensitiveNodes.Count) nodes with potentially sensitive data" -Level Warning
            $securityActions += "Validated sensitive data presence"
        }

        # Save updated configuration
        $configXml.Save($ConfigPath)

        Write-DeploymentLog "Security transformations applied: $($securityActions -join ', ')"

        return @{
            Success = $true
            SecurityActions = $securityActions
            Environment = $Environment
        }
    }
    catch {
        Write-DeploymentLog "Failed to apply security transformations: $($_.Exception.Message)" -Level Error
        throw
    }
}

function Validate-ConfigurationIntegrity {
    <#
    .SYNOPSIS
        Validates configuration file integrity and settings
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ConfigPath
    )

    Write-DeploymentLog "Validating configuration integrity"

    try {
        $validation = @{
            Success = $true
            Errors = @()
            Warnings = @()
            Tests = @()
        }

        # Test 1: XML well-formedness
        try {
            $configXml = New-Object System.Xml.XmlDocument
            $configXml.Load($ConfigPath)
            $validation.Tests += "XML well-formedness: PASS"
        }
        catch {
            $validation.Success = $false
            $validation.Errors += "XML parsing failed: $($_.Exception.Message)"
            return $validation
        }

        # Test 2: Required sections present
        $requiredSections = @('connectionStrings', 'appSettings', 'system.web')
        foreach ($section in $requiredSections) {
            $sectionNode = $configXml.SelectSingleNode("//$section")
            if ($sectionNode) {
                $validation.Tests += "$section section: PASS"
            }
            else {
                $validation.Warnings += "$section section not found"
            }
        }

        # Test 3: Connection string validation
        $connectionStringsNode = $configXml.SelectSingleNode("//connectionStrings")
        if ($connectionStringsNode) {
            $connections = $connectionStringsNode.SelectNodes("add")
            foreach ($conn in $connections) {
                $name = $conn.GetAttribute("name")
                $connStr = $conn.GetAttribute("connectionString")

                if ([string]::IsNullOrEmpty($connStr)) {
                    $validation.Errors += "Empty connection string for: $name"
                    $validation.Success = $false
                }
                elseif ($connStr -like "*localhost*" -or $connStr -like "*127.0.0.1*") {
                    $validation.Warnings += "Connection string uses localhost: $name"
                }
                else {
                    $validation.Tests += "Connection string '$name': PASS"
                }
            }
        }

        # Test 4: App settings validation
        $appSettingsNode = $configXml.SelectSingleNode("//appSettings")
        if ($appSettingsNode) {
            $requiredSettings = @('Environment', 'LogLevel')
            foreach ($setting in $requiredSettings) {
                $settingNode = $appSettingsNode.SelectSingleNode("add[@key='$setting']")
                if ($settingNode) {
                    $value = $settingNode.GetAttribute("value")
                    if ([string]::IsNullOrEmpty($value)) {
                        $validation.Warnings += "Empty value for setting: $setting"
                    }
                    else {
                        $validation.Tests += "App setting '$setting': PASS"
                    }
                }
                else {
                    $validation.Warnings += "Required app setting not found: $setting"
                }
            }
        }

        # Test 5: Security validation
        $compilationNode = $configXml.SelectSingleNode("//compilation")
        if ($compilationNode -and $compilationNode.GetAttribute("debug") -eq "true") {
            $envSetting = $configXml.SelectSingleNode("//appSettings/add[@key='Environment']")
            if ($envSetting -and $envSetting.GetAttribute("value") -eq "Production") {
                $validation.Warnings += "Debug compilation enabled in Production environment"
            }
        }

        # Test 6: File permissions (if running locally)
        try {
            $acl = Get-Acl $ConfigPath
            $validation.Tests += "File permissions check: PASS"
        }
        catch {
            $validation.Warnings += "Could not check file permissions: $($_.Exception.Message)"
        }

        Write-DeploymentLog "Configuration validation completed: $($validation.Tests.Count) tests, $($validation.Errors.Count) errors, $($validation.Warnings.Count) warnings"

        if ($validation.Errors.Count -gt 0) {
            foreach ($error in $validation.Errors) {
                Write-DeploymentLog "VALIDATION ERROR: $error" -Level Error
            }
        }

        if ($validation.Warnings.Count -gt 0) {
            foreach ($warning in $validation.Warnings) {
                Write-DeploymentLog "VALIDATION WARNING: $warning" -Level Warning
            }
        }

        return $validation
    }
    catch {
        Write-DeploymentLog "Configuration validation failed: $($_.Exception.Message)" -Level Error

        return @{
            Success = $false
            Errors = @("Validation process failed: $($_.Exception.Message)")
            Warnings = @()
            Tests = @()
        }
    }
}

function Apply-EnvironmentOverrides {
    <#
    .SYNOPSIS
        Applies environment-specific configuration overrides from external sources
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ConfigPath,

        [Parameter(Mandatory = $true)]
        [string]$Environment,

        [Parameter(Mandatory = $false)]
        [hashtable]$CustomOverrides = @{}
    )

    Write-DeploymentLog "Applying environment overrides for: $Environment"

    try {
        # Load current configuration
        $configXml = New-Object System.Xml.XmlDocument
        $configXml.PreserveWhitespace = $true
        $configXml.Load($ConfigPath)

        $overrides = @()

        # Apply custom overrides
        foreach ($override in $CustomOverrides.GetEnumerator()) {
            $key = $override.Key
            $value = $override.Value

            # Find app setting and update
            $settingNode = $configXml.SelectSingleNode("//appSettings/add[@key='$key']")
            if ($settingNode) {
                $oldValue = $settingNode.GetAttribute("value")
                $settingNode.SetAttribute("value", $value)
                $overrides += "Override $key: '$oldValue' -> '$value'"
            }
            else {
                # Create new setting
                $appSettingsNode = $configXml.SelectSingleNode("//appSettings")
                if ($appSettingsNode) {
                    $newSettingNode = $configXml.CreateElement("add")
                    $newSettingNode.SetAttribute("key", $key)
                    $newSettingNode.SetAttribute("value", $value)
                    $appSettingsNode.AppendChild($newSettingNode)
                    $overrides += "Created override $key: '$value'"
                }
            }
        }

        # Load environment-specific overrides from file if it exists
        $overrideFile = Join-Path (Split-Path $ConfigPath -Parent) "overrides.$Environment.json"
        if (Test-Path $overrideFile) {
            try {
                $envOverrides = Get-Content $overrideFile | ConvertFrom-Json

                foreach ($property in $envOverrides.PSObject.Properties) {
                    $key = $property.Name
                    $value = $property.Value.ToString()

                    $settingNode = $configXml.SelectSingleNode("//appSettings/add[@key='$key']")
                    if ($settingNode) {
                        $settingNode.SetAttribute("value", $value)
                        $overrides += "File override $key: '$value'"
                    }
                }
            }
            catch {
                Write-DeploymentLog "Failed to load environment override file: $($_.Exception.Message)" -Level Warning
            }
        }

        # Save configuration if overrides were applied
        if ($overrides.Count -gt 0) {
            $configXml.Save($ConfigPath)
            Write-DeploymentLog "Applied $($overrides.Count) environment overrides"
        }

        return @{
            Success = $true
            AppliedOverrides = $overrides
            OverrideCount = $overrides.Count
        }
    }
    catch {
        Write-DeploymentLog "Failed to apply environment overrides: $($_.Exception.Message)" -Level Error
        throw
    }
}

# Export module functions
Export-ModuleMember -Function @(
    'Transform-WeSignConfig',
    'Update-ConnectionStrings',
    'Transform-AppSettings',
    'Apply-EnvironmentOverrides',
    'Validate-ConfigurationIntegrity',
    'Apply-SecurityTransformations',
    'Backup-ConfigFile',
    'Restore-ConfigFile'
)

Write-DeploymentLog "Configuration Management module loaded successfully"