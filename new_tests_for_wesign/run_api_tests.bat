@echo off
REM WeSign API Testing with Newman - Comprehensive Test Runner
REM Author: WeSign QA Team
REM Usage: run_api_tests.bat [module|full|regression]

echo ========================================
echo WeSign API Testing Suite via Newman
echo ========================================
echo.

REM Create required directories
if not exist "reports" mkdir reports
if not exist "data" mkdir data
if not exist "logs" mkdir logs

REM Set timestamp for unique file names
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "YY=%dt:~2,2%" & set "YYYY=%dt:~0,4%" & set "MM=%dt:~4,2%" & set "DD=%dt:~6,2%"
set "HH=%dt:~8,2%" & set "Min=%dt:~10,2%" & set "Sec=%dt:~12,2%"
set "timestamp=%YYYY%%MM%%DD%-%HH%%Min%%Sec%"

REM Check if Newman is installed
newman --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Newman is not installed or not in PATH
    echo Please install Newman: npm install -g newman
    echo Also install HTML reporter: npm install -g newman-reporter-htmlextra
    pause
    exit /b 1
)

REM Default to full regression if no parameter provided
set test_type=%1
if "%test_type%"=="" set test_type=full

echo Running WeSign API tests - Type: %test_type%
echo Timestamp: %timestamp%
echo.

if "%test_type%"=="full" goto :full_regression
if "%test_type%"=="regression" goto :full_regression
if "%test_type%"=="users" goto :users_module
if "%test_type%"=="contacts" goto :contacts_module
if "%test_type%"=="templates" goto :templates_module
if "%test_type%"=="documents" goto :documents_module
if "%test_type%"=="distribution" goto :distribution_module
if "%test_type%"=="links" goto :links_module
if "%test_type%"=="config" goto :config_module
if "%test_type%"=="files" goto :files_module
if "%test_type%"=="statistics" goto :statistics_module
if "%test_type%"=="tablets" goto :tablets_module

echo Invalid test type: %test_type%
echo Valid options: full, regression, users, contacts, templates, documents, distribution, links, config, files, statistics, tablets
pause
exit /b 1

:full_regression
echo ==========================================
echo Running FULL REGRESSION TEST SUITE
echo ==========================================
newman run "./api_tests/WeSign_ULTIMATE_COMPLETE_API_TESTING_SUITE.json" ^
  -e "./api_tests/WeSign API Environment.postman_environment.json" ^
  -r cli,json,htmlextra ^
  --reporter-json-export "./reports/regression-full-%timestamp%.json" ^
  --reporter-htmlextra-export "./reports/regression-full-%timestamp%.html" ^
  --reporter-htmlextra-title "WeSign API Full Regression - %timestamp%" ^
  --reporter-htmlextra-showEnvironmentData ^
  --export-environment "./data/env-state-%timestamp%.json" ^
  --export-globals "./data/global-state-%timestamp%.json" ^
  --export-collection "./data/collection-final-%timestamp%.json" ^
  --delay-request 100 ^
  --timeout-request 30000 ^
  --verbose
goto :end

:users_module
echo ==========================================
echo Running USERS MODULE TESTS
echo ==========================================
newman run "./api_tests/WeSign_ULTIMATE_COMPLETE_API_TESTING_SUITE.json" ^
  -e "./api_tests/WeSign API Environment.postman_environment.json" ^
  --folder "Users Management" ^
  -r cli,json,htmlextra ^
  --reporter-json-export "./reports/users-module-%timestamp%.json" ^
  --reporter-htmlextra-export "./reports/users-module-%timestamp%.html" ^
  --reporter-htmlextra-title "WeSign API Users Module - %timestamp%" ^
  --export-environment "./data/users-env-%timestamp%.json" ^
  --delay-request 100 ^
  --verbose
goto :end

:contacts_module
echo ==========================================
echo Running CONTACTS MODULE TESTS
echo ==========================================
newman run "./api_tests/WeSign_ULTIMATE_COMPLETE_API_TESTING_SUITE.json" ^
  -e "./api_tests/WeSign API Environment.postman_environment.json" ^
  --folder "Contacts Management" ^
  -r cli,json,htmlextra ^
  --reporter-json-export "./reports/contacts-module-%timestamp%.json" ^
  --reporter-htmlextra-export "./reports/contacts-module-%timestamp%.html" ^
  --reporter-htmlextra-title "WeSign API Contacts Module - %timestamp%" ^
  --export-environment "./data/contacts-env-%timestamp%.json" ^
  --delay-request 100 ^
  --verbose
goto :end

:templates_module
echo ==========================================
echo Running TEMPLATES MODULE TESTS
echo ==========================================
newman run "./api_tests/WeSign_ULTIMATE_COMPLETE_API_TESTING_SUITE.json" ^
  -e "./api_tests/WeSign API Environment.postman_environment.json" ^
  --folder "Templates Management" ^
  -r cli,json,htmlextra ^
  --reporter-json-export "./reports/templates-module-%timestamp%.json" ^
  --reporter-htmlextra-export "./reports/templates-module-%timestamp%.html" ^
  --reporter-htmlextra-title "WeSign API Templates Module - %timestamp%" ^
  --export-environment "./data/templates-env-%timestamp%.json" ^
  --delay-request 100 ^
  --verbose
goto :end

:documents_module
echo ==========================================
echo Running DOCUMENTS MODULE TESTS
echo ==========================================
newman run "./api_tests/WeSign_ULTIMATE_COMPLETE_API_TESTING_SUITE.json" ^
  -e "./api_tests/WeSign API Environment.postman_environment.json" ^
  --folder "Document Collections" ^
  -r cli,json,htmlextra ^
  --reporter-json-export "./reports/documents-module-%timestamp%.json" ^
  --reporter-htmlextra-export "./reports/documents-module-%timestamp%.html" ^
  --reporter-htmlextra-title "WeSign API Documents Module - %timestamp%" ^
  --export-environment "./data/documents-env-%timestamp%.json" ^
  --delay-request 100 ^
  --verbose
goto :end

:distribution_module
echo ==========================================
echo Running DISTRIBUTION MODULE TESTS
echo ==========================================
newman run "./api_tests/WeSign_ULTIMATE_COMPLETE_API_TESTING_SUITE.json" ^
  -e "./api_tests/WeSign API Environment.postman_environment.json" ^
  --folder "Distribution" ^
  -r cli,json,htmlextra ^
  --reporter-json-export "./reports/distribution-module-%timestamp%.json" ^
  --reporter-htmlextra-export "./reports/distribution-module-%timestamp%.html" ^
  --reporter-htmlextra-title "WeSign API Distribution Module - %timestamp%" ^
  --export-environment "./data/distribution-env-%timestamp%.json" ^
  --delay-request 100 ^
  --verbose
goto :end

:links_module
echo ==========================================
echo Running LINKS MODULE TESTS
echo ==========================================
newman run "./api_tests/WeSign_ULTIMATE_COMPLETE_API_TESTING_SUITE.json" ^
  -e "./api_tests/WeSign API Environment.postman_environment.json" ^
  --folder "Links Management" ^
  -r cli,json,htmlextra ^
  --reporter-json-export "./reports/links-module-%timestamp%.json" ^
  --reporter-htmlextra-export "./reports/links-module-%timestamp%.html" ^
  --reporter-htmlextra-title "WeSign API Links Module - %timestamp%" ^
  --export-environment "./data/links-env-%timestamp%.json" ^
  --delay-request 100 ^
  --verbose
goto :end

:config_module
echo ==========================================
echo Running CONFIGURATION MODULE TESTS
echo ==========================================
newman run "./api_tests/WeSign_ULTIMATE_COMPLETE_API_TESTING_SUITE.json" ^
  -e "./api_tests/WeSign API Environment.postman_environment.json" ^
  --folder "Configuration" ^
  -r cli,json,htmlextra ^
  --reporter-json-export "./reports/config-module-%timestamp%.json" ^
  --reporter-htmlextra-export "./reports/config-module-%timestamp%.html" ^
  --reporter-htmlextra-title "WeSign API Configuration Module - %timestamp%" ^
  --export-environment "./data/config-env-%timestamp%.json" ^
  --delay-request 100 ^
  --verbose
goto :end

:files_module
echo ==========================================
echo Running FILES MODULE TESTS
echo ==========================================
newman run "./api_tests/WeSign_ULTIMATE_COMPLETE_API_TESTING_SUITE.json" ^
  -e "./api_tests/WeSign API Environment.postman_environment.json" ^
  --folder "Files Management" ^
  -r cli,json,htmlextra ^
  --reporter-json-export "./reports/files-module-%timestamp%.json" ^
  --reporter-htmlextra-export "./reports/files-module-%timestamp%.html" ^
  --reporter-htmlextra-title "WeSign API Files Module - %timestamp%" ^
  --export-environment "./data/files-env-%timestamp%.json" ^
  --delay-request 100 ^
  --verbose
goto :end

:statistics_module
echo ==========================================
echo Running STATISTICS MODULE TESTS
echo ==========================================
newman run "./api_tests/WeSign_ULTIMATE_COMPLETE_API_TESTING_SUITE.json" ^
  -e "./api_tests/WeSign API Environment.postman_environment.json" ^
  --folder "Statistics" ^
  -r cli,json,htmlextra ^
  --reporter-json-export "./reports/statistics-module-%timestamp%.json" ^
  --reporter-htmlextra-export "./reports/statistics-module-%timestamp%.html" ^
  --reporter-htmlextra-title "WeSign API Statistics Module - %timestamp%" ^
  --export-environment "./data/statistics-env-%timestamp%.json" ^
  --delay-request 100 ^
  --verbose
goto :end

:tablets_module
echo ==========================================
echo Running TABLETS MODULE TESTS
echo ==========================================
newman run "./api_tests/WeSign_ULTIMATE_COMPLETE_API_TESTING_SUITE.json" ^
  -e "./api_tests/WeSign API Environment.postman_environment.json" ^
  --folder "Tablets Management" ^
  -r cli,json,htmlextra ^
  --reporter-json-export "./reports/tablets-module-%timestamp%.json" ^
  --reporter-htmlextra-export "./reports/tablets-module-%timestamp%.html" ^
  --reporter-htmlextra-title "WeSign API Tablets Module - %timestamp%" ^
  --export-environment "./data/tablets-env-%timestamp%.json" ^
  --delay-request 100 ^
  --verbose
goto :end

:end
echo.
echo ==========================================
echo TEST EXECUTION COMPLETED
echo ==========================================
echo Reports available in: ./reports/
echo Raw data available in: ./data/
echo Timestamp: %timestamp%
echo.
pause