@echo off
REM WeSign K6 Load Testing - Windows Test Runner
REM Author: WeSign QA Team
REM Usage: run-tests.bat [test-type] [environment] [options]

echo ========================================
echo WeSign K6 Load Testing Suite
echo ========================================
echo.

REM Set default values
set TEST_TYPE=%1
set ENVIRONMENT=%2
set REPORT_FORMAT=%3
if "%TEST_TYPE%"=="" set TEST_TYPE=smoke
if "%ENVIRONMENT%"=="" set ENVIRONMENT=dev
if "%REPORT_FORMAT%"=="" set REPORT_FORMAT=html

REM Generate timestamp
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do if not "%%I"=="" set datetime=%%I
set TIMESTAMP=%datetime:~0,8%-%datetime:~8,6%

REM Environment URLs
if "%ENVIRONMENT%"=="dev" set BASE_URL=https://devtest.comda.co.il/userapi/ui/v3
if "%ENVIRONMENT%"=="development" set BASE_URL=https://devtest.comda.co.il/userapi/ui/v3
if "%ENVIRONMENT%"=="staging" set BASE_URL=https://staging.comda.co.il/userapi/ui/v3
if "%ENVIRONMENT%"=="prod" set BASE_URL=https://app.comda.co.il/userapi/ui/v3
if "%ENVIRONMENT%"=="production" set BASE_URL=https://app.comda.co.il/userapi/ui/v3

if "%BASE_URL%"=="" (
    echo ❌ Unknown environment: %ENVIRONMENT%
    echo Valid environments: dev, staging, prod
    exit /b 1
)

REM Create required directories
if not exist "reports" mkdir reports
if not exist "data" mkdir data
if not exist "logs" mkdir logs

REM Check if K6 is installed
k6 version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ K6 is not installed or not in PATH
    echo Please install K6: https://k6.io/docs/getting-started/installation/
    exit /b 1
)

echo 🎯 Test Configuration:
echo   Type: %TEST_TYPE%
echo   Environment: %ENVIRONMENT%
echo   Base URL: %BASE_URL%
echo   Timestamp: %TIMESTAMP%
echo.

REM Main execution logic
if "%TEST_TYPE%"=="smoke" goto run_smoke_tests
if "%TEST_TYPE%"=="load" goto run_load_tests
if "%TEST_TYPE%"=="stress" goto run_stress_tests
if "%TEST_TYPE%"=="spike" goto run_spike_tests
if "%TEST_TYPE%"=="soak" goto run_soak_tests
if "%TEST_TYPE%"=="volume" goto run_volume_tests
if "%TEST_TYPE%"=="all" goto run_all_tests

echo ❌ Invalid test type: %TEST_TYPE%
echo Valid options: smoke, load, stress, spike, soak, volume, all
echo.
echo Usage examples:
echo   run-tests.bat smoke dev
echo   run-tests.bat load staging
echo   run-tests.bat all prod
exit /b 1

:run_smoke_tests
echo 🚬 Running Smoke Tests
echo ======================

echo 🔹 Running Basic Functionality Smoke Test...
k6 run --env BASE_URL="%BASE_URL%" --out json=./reports/smoke-basic-%TIMESTAMP%.json --summary-export=./reports/smoke-basic-summary-%TIMESTAMP%.json scenarios/smoke/smoke-basic.js

echo.
echo 🔹 Running Authentication Smoke Test...
k6 run --env BASE_URL="%BASE_URL%" --out json=./reports/smoke-auth-%TIMESTAMP%.json --summary-export=./reports/smoke-auth-summary-%TIMESTAMP%.json scenarios/smoke/smoke-auth.js

echo ✅ Smoke tests completed
goto generate_report

:run_load_tests
echo 📊 Running Load Tests
echo ====================

echo 🔹 Running User Journey Load Test...
k6 run --env BASE_URL="%BASE_URL%" --out json=./reports/load-journey-%TIMESTAMP%.json --summary-export=./reports/load-journey-summary-%TIMESTAMP%.json scenarios/load/load-user-journey.js

echo.
echo 🔹 Running Document Operations Load Test...
k6 run --env BASE_URL="%BASE_URL%" --out json=./reports/load-documents-%TIMESTAMP%.json --summary-export=./reports/load-documents-summary-%TIMESTAMP%.json scenarios/load/load-documents.js

echo ✅ Load tests completed
goto generate_report

:run_stress_tests
echo 🔥 Running Stress Tests
echo ======================

echo 🔹 Running Authentication Stress Test...
k6 run --env BASE_URL="%BASE_URL%" --out json=./reports/stress-auth-%TIMESTAMP%.json --summary-export=./reports/stress-auth-summary-%TIMESTAMP%.json scenarios/stress/stress-auth.js

echo ✅ Stress tests completed
goto generate_report

:run_spike_tests
echo ⚡ Running Spike Tests
echo ====================

echo 🔹 Running Login Spike Test...
k6 run --env BASE_URL="%BASE_URL%" --out json=./reports/spike-login-%TIMESTAMP%.json --summary-export=./reports/spike-login-summary-%TIMESTAMP%.json scenarios/spike/spike-login.js

echo.
echo 🔹 Running Document Spike Test...
k6 run --env BASE_URL="%BASE_URL%" --out json=./reports/spike-documents-%TIMESTAMP%.json --summary-export=./reports/spike-documents-summary-%TIMESTAMP%.json scenarios/spike/spike-documents.js

echo ✅ Spike tests completed
goto generate_report

:run_soak_tests
echo 🕰️ Running Soak Tests
echo ====================
echo ⚠️ Warning: Soak tests run for 4+ hours

set /p "REPLY=Are you sure you want to run soak tests? (y/N): "
if /i not "%REPLY%"=="y" (
    echo Soak tests cancelled
    goto end
)

echo 🔹 Running Endurance Soak Test...
k6 run --env BASE_URL="%BASE_URL%" --out json=./reports/soak-endurance-%TIMESTAMP%.json --summary-export=./reports/soak-endurance-summary-%TIMESTAMP%.json scenarios/soak/soak-endurance.js

echo ✅ Soak tests completed
goto generate_report

:run_volume_tests
echo 📈 Running Volume Tests
echo ======================

echo 🔹 Running Breakpoint Analysis...
k6 run --env BASE_URL="%BASE_URL%" --out json=./reports/volume-breakpoint-%TIMESTAMP%.json --summary-export=./reports/volume-breakpoint-summary-%TIMESTAMP%.json scenarios/volume/breakpoint-analysis.js

echo ✅ Volume tests completed
goto generate_report

:run_all_tests
echo 🚀 Running Complete Test Suite
echo ==============================

call :run_smoke_tests_internal
echo.
call :run_load_tests_internal
echo.
call :run_stress_tests_internal
echo.
call :run_spike_tests_internal
echo.

echo ⚠️ Skipping soak tests in 'all' mode (too long)
echo Run 'run-tests.bat soak' separately for endurance testing
echo.

call :run_volume_tests_internal
goto generate_report

:run_smoke_tests_internal
echo 🚬 Running Smoke Tests
k6 run --env BASE_URL="%BASE_URL%" --out json=./reports/smoke-basic-%TIMESTAMP%.json scenarios/smoke/smoke-basic.js
k6 run --env BASE_URL="%BASE_URL%" --out json=./reports/smoke-auth-%TIMESTAMP%.json scenarios/smoke/smoke-auth.js
exit /b

:run_load_tests_internal
echo 📊 Running Load Tests
k6 run --env BASE_URL="%BASE_URL%" --out json=./reports/load-journey-%TIMESTAMP%.json scenarios/load/load-user-journey.js
k6 run --env BASE_URL="%BASE_URL%" --out json=./reports/load-documents-%TIMESTAMP%.json scenarios/load/load-documents.js
exit /b

:run_stress_tests_internal
echo 🔥 Running Stress Tests
k6 run --env BASE_URL="%BASE_URL%" --out json=./reports/stress-auth-%TIMESTAMP%.json scenarios/stress/stress-auth.js
exit /b

:run_spike_tests_internal
echo ⚡ Running Spike Tests
k6 run --env BASE_URL="%BASE_URL%" --out json=./reports/spike-login-%TIMESTAMP%.json scenarios/spike/spike-login.js
k6 run --env BASE_URL="%BASE_URL%" --out json=./reports/spike-documents-%TIMESTAMP%.json scenarios/spike/spike-documents.js
exit /b

:run_volume_tests_internal
echo 📈 Running Volume Tests
k6 run --env BASE_URL="%BASE_URL%" --out json=./reports/volume-breakpoint-%TIMESTAMP%.json scenarios/volume/breakpoint-analysis.js
exit /b

:generate_report
if not "%REPORT_FORMAT%"=="html" goto end

echo 📊 Generating Test Report
echo ========================

set REPORT_FILE=./reports/wesign-load-test-report-%TIMESTAMP%.html

echo ^<!DOCTYPE html^> > "%REPORT_FILE%"
echo ^<html^> >> "%REPORT_FILE%"
echo ^<head^> >> "%REPORT_FILE%"
echo     ^<title^>WeSign Load Test Report - %TIMESTAMP%^</title^> >> "%REPORT_FILE%"
echo     ^<style^> >> "%REPORT_FILE%"
echo         body { font-family: Arial, sans-serif; margin: 20px; } >> "%REPORT_FILE%"
echo         .header { background: #f4f4f4; padding: 20px; border-radius: 5px; } >> "%REPORT_FILE%"
echo         .test-section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; } >> "%REPORT_FILE%"
echo         .success { background: #d4edda; border-color: #c3e6cb; } >> "%REPORT_FILE%"
echo         .warning { background: #fff3cd; border-color: #ffeaa7; } >> "%REPORT_FILE%"
echo         .error { background: #f8d7da; border-color: #f5c6cb; } >> "%REPORT_FILE%"
echo         .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; } >> "%REPORT_FILE%"
echo         .metric-card { background: #f8f9fa; padding: 15px; border-radius: 5px; } >> "%REPORT_FILE%"
echo     ^</style^> >> "%REPORT_FILE%"
echo ^</head^> >> "%REPORT_FILE%"
echo ^<body^> >> "%REPORT_FILE%"
echo     ^<div class="header"^> >> "%REPORT_FILE%"
echo         ^<h1^>🎯 WeSign K6 Load Test Report^</h1^> >> "%REPORT_FILE%"
echo         ^<p^>^<strong^>Test Run:^</strong^> %TIMESTAMP%^</p^> >> "%REPORT_FILE%"
echo         ^<p^>^<strong^>Environment:^</strong^> %ENVIRONMENT%^</p^> >> "%REPORT_FILE%"
echo         ^<p^>^<strong^>Base URL:^</strong^> %BASE_URL%^</p^> >> "%REPORT_FILE%"
echo         ^<p^>^<strong^>Test Type:^</strong^> %TEST_TYPE%^</p^> >> "%REPORT_FILE%"
echo     ^</div^> >> "%REPORT_FILE%"
echo     ^<div class="test-section"^> >> "%REPORT_FILE%"
echo         ^<h2^>📋 Test Summary^</h2^> >> "%REPORT_FILE%"
echo         ^<p^>Load testing completed for WeSign API endpoints.^</p^> >> "%REPORT_FILE%"
echo         ^<p^>Detailed JSON reports available in the reports/ directory.^</p^> >> "%REPORT_FILE%"
echo     ^</div^> >> "%REPORT_FILE%"
echo     ^<div class="test-section"^> >> "%REPORT_FILE%"
echo         ^<h2^>📁 Generated Files^</h2^> >> "%REPORT_FILE%"
echo         ^<ul^> >> "%REPORT_FILE%"

REM List generated files
for %%f in (./reports/*%TIMESTAMP%*) do (
    echo             ^<li^>%%~nxf^</li^> >> "%REPORT_FILE%"
)

echo         ^</ul^> >> "%REPORT_FILE%"
echo     ^</div^> >> "%REPORT_FILE%"
echo     ^<footer style="margin-top: 50px; text-align: center; color: #666;"^> >> "%REPORT_FILE%"
echo         ^<p^>Generated by WeSign K6 Load Testing Suite - %date% %time%^</p^> >> "%REPORT_FILE%"
echo     ^</footer^> >> "%REPORT_FILE%"
echo ^</body^> >> "%REPORT_FILE%"
echo ^</html^> >> "%REPORT_FILE%"

echo ✅ Report generated: %REPORT_FILE%

:end
echo.
echo =========================================
echo 🏁 WeSign K6 Load Testing Completed
echo =========================================
echo 📁 Reports saved to: ./reports/
echo 📊 Raw data saved to: ./data/
echo 📝 Logs saved to: ./logs/
echo ⏱️ Timestamp: %TIMESTAMP%
echo.

echo Generated files:
dir /b ./reports/*%TIMESTAMP%* 2>nul || echo No report files found