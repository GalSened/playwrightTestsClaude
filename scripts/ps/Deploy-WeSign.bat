@echo off
REM WeSign Deployment Batch Script
REM Author: QA Intelligence Platform
REM Version: 1.0
REM Created: 2025-09-26

setlocal EnableDelayedExpansion

echo.
echo ================================================================================
echo                       WeSign Deployment - Quick Start
echo ================================================================================
echo.

REM Check if running as Administrator
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [INFO] Running as Administrator: YES
) else (
    echo [ERROR] This script must be run as Administrator!
    echo [ERROR] Right-click and select "Run as administrator"
    echo.
    pause
    exit /b 1
)

REM Set default values
set "COMPUTER_NAME="
set "ENVIRONMENT=DevTest"
set "ARTIFACT_PATH="
set "USERNAME="
set "SKIP_BACKUP=false"
set "SKIP_SMOKE_TESTS=false"
set "QA_URL=http://localhost:8082"

REM Parse command line arguments
:parse_args
if "%~1"=="" goto :args_done
if /i "%~1"=="-ComputerName" (
    set "COMPUTER_NAME=%~2"
    shift
    shift
    goto :parse_args
)
if /i "%~1"=="-Environment" (
    set "ENVIRONMENT=%~2"
    shift
    shift
    goto :parse_args
)
if /i "%~1"=="-ArtifactPath" (
    set "ARTIFACT_PATH=%~2"
    shift
    shift
    goto :parse_args
)
if /i "%~1"=="-Username" (
    set "USERNAME=%~2"
    shift
    shift
    goto :parse_args
)
if /i "%~1"=="-SkipBackup" (
    set "SKIP_BACKUP=true"
    shift
    goto :parse_args
)
if /i "%~1"=="-SkipSmokeTests" (
    set "SKIP_SMOKE_TESTS=true"
    shift
    goto :parse_args
)
if /i "%~1"=="-QAIntelligenceUrl" (
    set "QA_URL=%~2"
    shift
    shift
    goto :parse_args
)
if /i "%~1"=="-Help" goto :show_help
if /i "%~1"=="-h" goto :show_help
if /i "%~1"=="/?" goto :show_help
shift
goto :parse_args

:args_done

REM Interactive mode if no computer name provided
if "%COMPUTER_NAME%"=="" (
    echo [INFO] No computer name provided, entering interactive mode...
    echo.
    set /p "COMPUTER_NAME=Enter target server name or IP: "
)

if "%COMPUTER_NAME%"=="" (
    echo [ERROR] Computer name is required!
    goto :show_help
)

REM Interactive environment selection if default
if "%ENVIRONMENT%"=="DevTest" (
    echo.
    echo Available Environments:
    echo 1. DevTest (default)
    echo 2. Staging
    echo 3. Production
    echo.
    set /p "ENV_CHOICE=Select environment (1-3) [1]: "

    if "!ENV_CHOICE!"=="2" set "ENVIRONMENT=Staging"
    if "!ENV_CHOICE!"=="3" set "ENVIRONMENT=Production"
)

REM Interactive artifact path if not provided
if "%ARTIFACT_PATH%"=="" (
    echo.
    set /p "ARTIFACT_PATH=Enter path to WeSign artifact (ZIP file): "
)

if "%ARTIFACT_PATH%"=="" (
    echo [ERROR] Artifact path is required!
    goto :show_help
)

REM Validate artifact file exists
if not exist "%ARTIFACT_PATH%" (
    echo [ERROR] Artifact file not found: %ARTIFACT_PATH%
    echo.
    pause
    exit /b 1
)

REM Interactive username if not provided
if "%USERNAME%"=="" (
    echo.
    set /p "USERNAME=Enter domain username (e.g., CONTOSO\deployuser): "
)

REM Display deployment parameters
echo.
echo Deployment Parameters:
echo ----------------------
echo Target Server:    %COMPUTER_NAME%
echo Environment:      %ENVIRONMENT%
echo Artifact:         %ARTIFACT_PATH%
echo Username:         %USERNAME%
echo Skip Backup:      %SKIP_BACKUP%
echo Skip Smoke Tests: %SKIP_SMOKE_TESTS%
echo QA Intelligence:  %QA_URL%
echo.

REM Confirmation prompt
set /p "CONFIRM=Proceed with deployment? (y/N): "
if /i not "%CONFIRM%"=="y" (
    echo [INFO] Deployment cancelled by user.
    echo.
    pause
    exit /b 0
)

echo.
echo [INFO] Starting WeSign deployment...
echo.

REM Change to script directory
cd /d "%~dp0"

REM Check if PowerShell scripts exist
if not exist "Deploy-WeSign-Master.ps1" (
    echo [ERROR] PowerShell deployment scripts not found!
    echo [ERROR] Please ensure all .ps1 files are in the same directory as this batch file.
    echo.
    pause
    exit /b 1
)

REM Build PowerShell command
set "PS_CMD=powershell.exe -ExecutionPolicy Bypass -NoProfile -Command "
set "PS_ARGS=& '.\Deploy-WeSign-Master.ps1'"
set "PS_ARGS=!PS_ARGS! -ComputerName '%COMPUTER_NAME%'"
set "PS_ARGS=!PS_ARGS! -Environment '%ENVIRONMENT%'"
set "PS_ARGS=!PS_ARGS! -ArtifactPath '%ARTIFACT_PATH%'"
set "PS_ARGS=!PS_ARGS! -QAIntelligenceUrl '%QA_URL%'"

if not "%USERNAME%"=="" (
    set "PS_ARGS=!PS_ARGS! -Username '%USERNAME%'"
)

if "%SKIP_BACKUP%"=="true" (
    set "PS_ARGS=!PS_ARGS! -SkipBackup"
)

if "%SKIP_SMOKE_TESTS%"=="true" (
    set "PS_ARGS=!PS_ARGS! -SkipSmokeTests"
)

REM Execute PowerShell deployment
echo [INFO] Executing PowerShell deployment script...
echo [CMD] %PS_CMD%"%PS_ARGS%"
echo.

%PS_CMD%"%PS_ARGS%"

REM Capture exit code
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if %EXIT_CODE% equ 0 (
    echo ================================================================================
    echo [SUCCESS] WeSign deployment completed successfully!
    echo ================================================================================
    echo Target Server: %COMPUTER_NAME%
    echo Environment:   %ENVIRONMENT%
    echo Exit Code:     %EXIT_CODE%
    echo.
    echo Check the deployment logs for detailed information.
) else (
    echo ================================================================================
    echo [FAILED] WeSign deployment failed!
    echo ================================================================================
    echo Target Server: %COMPUTER_NAME%
    echo Environment:   %ENVIRONMENT%
    echo Exit Code:     %EXIT_CODE%
    echo.
    echo Check the deployment logs for error details.
    echo Consider running with -SkipSmokeTests if health checks are causing issues.
)

echo.
echo Deployment completed at %DATE% %TIME%
echo.
pause
exit /b %EXIT_CODE%

:show_help
echo.
echo WeSign Deployment Script - Help
echo ===============================
echo.
echo This script automates the deployment of WeSign applications to Windows servers.
echo.
echo Usage:
echo   Deploy-WeSign.bat [OPTIONS]
echo.
echo Required Parameters:
echo   -ComputerName ^<server^>     Target server name or IP address
echo   -ArtifactPath ^<path^>       Path to WeSign deployment artifact (ZIP file)
echo.
echo Optional Parameters:
echo   -Environment ^<env^>         Target environment (DevTest, Staging, Production)
echo                               Default: DevTest
echo   -Username ^<domain\user^>    Domain username for authentication
echo                               Will prompt for password if not using credential file
echo   -SkipBackup                 Skip backup creation (not recommended)
echo   -SkipSmokeTests             Skip smoke test execution after deployment
echo   -QAIntelligenceUrl ^<url^>   URL for QA Intelligence backend API
echo                               Default: http://localhost:8082
echo   -Help                       Show this help message
echo.
echo Examples:
echo.
echo   Interactive mode (will prompt for required parameters):
echo   Deploy-WeSign.bat
echo.
echo   Basic deployment:
echo   Deploy-WeSign.bat -ComputerName "devtest.contoso.com" -ArtifactPath "\\build\WeSign_v1.2.3.zip"
echo.
echo   Advanced deployment:
echo   Deploy-WeSign.bat -ComputerName "devtest" -Environment "DevTest" ^
echo                     -ArtifactPath "C:\Artifacts\WeSign_latest.zip" ^
echo                     -Username "CONTOSO\deployuser" ^
echo                     -QAIntelligenceUrl "http://localhost:8082"
echo.
echo   Production deployment (with caution):
echo   Deploy-WeSign.bat -ComputerName "prod-web01.contoso.com" ^
echo                     -Environment "Production" ^
echo                     -ArtifactPath "\\release\WeSign_v2.0.0_Release.zip" ^
echo                     -Username "CONTOSO\proddeployuser"
echo.
echo Prerequisites:
echo   - Windows 10/11 or Windows Server 2016+
echo   - PowerShell 5.1 or later
echo   - WebAdministration PowerShell module
echo   - Administrative privileges (run as administrator)
echo   - Network connectivity to target server
echo   - WinRM configured for HTTPS on target server
echo.
echo For more information, see README.md in the scripts directory.
echo.
pause
exit /b 0