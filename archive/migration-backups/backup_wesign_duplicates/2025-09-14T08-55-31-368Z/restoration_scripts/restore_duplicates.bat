@echo off
REM WeSign Test Deduplication - Restoration Script
REM Generated: 2025-09-14T08:55:31.382Z
REM Backup Location: C:\Users\gals\Desktop\playwrightTestsClaude\backup_wesign_duplicates\2025-09-14T08-55-31-368Z

echo 🔄 WeSign Test Restoration Script
echo ===================================
echo.
echo This script will restore all backed-up duplicate files
echo.
set /p confirm="Are you sure you want to restore all duplicate files? (y/N): "
if /i not "%confirm%"=="y" (
    echo Restoration cancelled.
    pause
    exit /b 1
)

echo.
echo 🚀 Starting restoration...

set "SOURCE_DIR=C:\Users\gals\Desktop\playwrightTestsClaude\backup_wesign_duplicates\2025-09-14T08-55-31-368Z\duplicate_files"
set "TARGET_DIR=C:/Users/gals/seleniumpythontests-1/playwright_tests"

REM Copy all files back
robocopy "%SOURCE_DIR%" "%TARGET_DIR%" /E /COPYALL /R:3 /W:3

if %errorlevel% leq 1 (
    echo.
    echo ✅ Restoration completed successfully!
    echo ✅ All duplicate files have been restored
) else (
    echo.
    echo ❌ Restoration failed with error level %errorlevel%
    echo Please check the paths and permissions
)

echo.
echo 📊 Final Steps:
echo   1. Refresh test discovery in the system
echo   2. Verify test count returned to original number
echo   3. Run validation to ensure all tests work

pause
