#
# Local CI/CD Test Execution Script (PowerShell)
# Simulates CI/CD pipeline execution locally for validation before pushing
#
# Usage:
#   .\scripts\run-tests-local.ps1 [-Module <module>]
#
# Examples:
#   .\scripts\run-tests-local.ps1                  # Run all tests (full pipeline)
#   .\scripts\run-tests-local.ps1 -Module contacts  # Run only contacts module
#   .\scripts\run-tests-local.ps1 -Module smoke     # Run smoke tests only
#

param(
    [string]$Module = "all",
    [string]$BaseUrl = "https://devtest.comda.co.il"
)

# Configuration
$ReportsDir = "reports"
$ArtifactsDir = "artifacts"

# Functions
function Print-Header {
    param([string]$Message)
    Write-Host "`n=====================================" -ForegroundColor Blue
    Write-Host $Message -ForegroundColor Blue
    Write-Host "=====================================`n" -ForegroundColor Blue
}

function Print-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Print-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Print-Warning {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

function Print-Info {
    param([string]$Message)
    Write-Host "ℹ️  $Message" -ForegroundColor Cyan
}

# Cleanup previous test artifacts
function Cleanup-Artifacts {
    Print-Header "Cleaning up previous test artifacts"

    if (Test-Path $ReportsDir) {
        Remove-Item -Path $ReportsDir -Recurse -Force
        Print-Info "Removed old reports directory"
    }

    if (Test-Path $ArtifactsDir) {
        Remove-Item -Path $ArtifactsDir -Recurse -Force
        Print-Info "Removed old artifacts directory"
    }

    # Create fresh directories
    New-Item -ItemType Directory -Force -Path "$ReportsDir\html" | Out-Null
    New-Item -ItemType Directory -Force -Path "$ReportsDir\junit" | Out-Null
    New-Item -ItemType Directory -Force -Path "$ReportsDir\json" | Out-Null
    New-Item -ItemType Directory -Force -Path "$ReportsDir\api" | Out-Null
    New-Item -ItemType Directory -Force -Path "$ReportsDir\coverage" | Out-Null
    New-Item -ItemType Directory -Force -Path "$ArtifactsDir\screenshots" | Out-Null
    New-Item -ItemType Directory -Force -Path "$ArtifactsDir\videos" | Out-Null
    New-Item -ItemType Directory -Force -Path "$ArtifactsDir\traces" | Out-Null

    Print-Success "Created fresh artifact directories"
}

# Check dependencies
function Check-Dependencies {
    Print-Header "Checking dependencies"

    # Check Python
    try {
        $pythonVersion = py --version 2>&1 | Out-String
        Print-Success "Python $pythonVersion found"
    } catch {
        Print-Error "Python not found. Please install Python 3.12+"
        exit 1
    }

    # Check pip packages
    try {
        py -m pip show pytest | Out-Null
        Print-Success "pytest installed"
    } catch {
        Print-Error "pytest not installed. Run: pip install -r requirements.txt"
        exit 1
    }

    try {
        py -m pip show playwright | Out-Null
        Print-Success "playwright installed"
    } catch {
        Print-Error "playwright not installed. Run: pip install -r requirements.txt"
        exit 1
    }

    # Check Playwright CLI
    try {
        py -m playwright --version | Out-Null
        Print-Success "Playwright CLI available"
    } catch {
        Print-Error "Playwright CLI not available"
        exit 1
    }

    # Check Newman (for API tests)
    try {
        $newmanVersion = newman --version 2>&1 | Out-String
        Print-Success "Newman $newmanVersion found"
    } catch {
        Print-Warning "Newman not found. API tests will be skipped. Install with: npm install -g newman newman-reporter-htmlextra"
    }
}

# Run smoke tests
function Run-SmokeTests {
    Print-Header "Running Smoke Tests"

    $result = py -m pytest tests/ -m smoke -v `
        --maxfail=1 `
        --tb=short `
        --junit-xml="$ReportsDir/junit/smoke.xml" `
        --html="$ReportsDir/html/smoke.html" `
        --self-contained-html

    if ($LASTEXITCODE -ne 0) {
        Print-Error "Smoke tests failed"
        return $false
    }

    Print-Success "Smoke tests passed"
    return $true
}

# Run contacts module tests
function Run-ContactsTests {
    Print-Header "Running Contacts Module Tests"

    $result = py -m pytest tests/contacts/ -v `
        --maxfail=999 `
        --tb=short `
        --junit-xml="$ReportsDir/junit/contacts.xml" `
        --html="$ReportsDir/html/contacts.html" `
        --self-contained-html

    if ($LASTEXITCODE -ne 0) {
        Print-Error "Contacts tests failed"
        return $false
    }

    Print-Success "Contacts tests passed"
    return $true
}

# Run documents module tests
function Run-DocumentsTests {
    Print-Header "Running Documents Module Tests"

    $result = py -m pytest tests/documents/ -v `
        --maxfail=999 `
        --tb=short `
        --junit-xml="$ReportsDir/junit/documents.xml" `
        --html="$ReportsDir/html/documents.html" `
        --self-contained-html

    if ($LASTEXITCODE -ne 0) {
        Print-Error "Documents tests failed"
        return $false
    }

    Print-Success "Documents tests passed"
    return $true
}

# Run templates module tests
function Run-TemplatesTests {
    Print-Header "Running Templates Module Tests (STRONG Assertions)"

    $result = py -m pytest tests/templates/test_templates_real_validation.py -v `
        --maxfail=999 `
        --tb=short `
        --junit-xml="$ReportsDir/junit/templates.xml" `
        --html="$ReportsDir/html/templates.html" `
        --self-contained-html

    if ($LASTEXITCODE -ne 0) {
        Print-Error "Templates tests failed"
        return $false
    }

    Print-Success "Templates tests passed"
    return $true
}

# Run self-signing module tests
function Run-SelfSigningTests {
    Print-Header "Running Self-Signing Module Tests"

    $result = py -m pytest tests/self_signing/ -v `
        --maxfail=999 `
        --tb=short `
        --junit-xml="$ReportsDir/junit/self-signing.xml" `
        --html="$ReportsDir/html/self-signing.html" `
        --self-contained-html

    if ($LASTEXITCODE -ne 0) {
        Print-Error "Self-signing tests failed"
        return $false
    }

    Print-Success "Self-signing tests passed"
    return $true
}

# Run API tests with Newman
function Run-ApiTests {
    Print-Header "Running API Tests (Newman)"

    # Check if newman exists
    try {
        newman --version | Out-Null
    } catch {
        Print-Warning "Newman not found. Skipping API tests."
        return $true
    }

    Push-Location api_tests

    # Get all Postman collections
    $collections = Get-ChildItem -Filter "*.postman_collection.json"

    foreach ($collection in $collections) {
        $collectionName = $collection.BaseName -replace '.postman_collection', ''
        Print-Info "Running API collection: $collectionName"

        newman run $collection.Name `
            -e WeSign_Unified_Environment.postman_environment.json `
            -r cli,htmlextra `
            --reporter-htmlextra-export "..\$ReportsDir\api\$collectionName.html" `
            --reporter-htmlextra-title "WeSign API Tests - $collectionName"

        if ($LASTEXITCODE -ne 0) {
            Print-Warning "API collection $collectionName failed"
        }
    }

    Pop-Location
    Print-Success "API tests completed"
    return $true
}

# Generate test summary
function Generate-Summary {
    Print-Header "Generating Test Summary"

    $totalTests = 0
    $passedTests = 0
    $failedTests = 0

    # Parse JUnit XML files if they exist
    $junitFiles = Get-ChildItem -Path "$ReportsDir\junit\*.xml" -ErrorAction SilentlyContinue

    foreach ($xmlFile in $junitFiles) {
        [xml]$xml = Get-Content $xmlFile.FullName
        $testsuite = $xml.testsuite
        if ($testsuite) {
            $totalTests += [int]$testsuite.tests
            $failedTests += [int]$testsuite.failures
        }
    }

    $passedTests = $totalTests - $failedTests

    Write-Host ""
    Write-Host "========================================="
    Write-Host "           TEST SUMMARY                  "
    Write-Host "========================================="
    Write-Host ""
    Write-Host "Total Tests:  $totalTests"
    Write-Host "Passed:       $passedTests"
    Write-Host "Failed:       $failedTests"
    Write-Host ""

    if (Test-Path "$ReportsDir\html") {
        Write-Host "HTML Reports: $ReportsDir\html\"
        Get-ChildItem -Path "$ReportsDir\html\*.html" | ForEach-Object { Write-Host "  $_" }
    }

    if (Test-Path "$ReportsDir\api") {
        Write-Host ""
        Write-Host "API Reports:  $ReportsDir\api\"
        Get-ChildItem -Path "$ReportsDir\api\*.html" | ForEach-Object { Write-Host "  $_" }
    }

    Write-Host ""
    Write-Host "========================================="

    if ($failedTests -eq 0) {
        Print-Success "All tests passed! ✅"
        return $true
    } else {
        Print-Error "$failedTests test(s) failed ❌"
        return $false
    }
}

# Main execution
Print-Header "WeSign CI/CD Local Test Execution"
Print-Info "Module: $Module"
Print-Info "Base URL: $BaseUrl"

# Step 1: Check dependencies
Check-Dependencies

# Step 2: Cleanup
Cleanup-Artifacts

# Step 3: Run tests based on module
$testResult = $true

switch ($Module.ToLower()) {
    "smoke" {
        $testResult = Run-SmokeTests
    }
    "contacts" {
        $testResult = Run-ContactsTests
    }
    "documents" {
        $testResult = Run-DocumentsTests
    }
    "templates" {
        $testResult = Run-TemplatesTests
    }
    "self-signing" {
        $testResult = Run-SelfSigningTests
    }
    "api" {
        $testResult = Run-ApiTests
    }
    "all" {
        $testResult = (Run-SmokeTests) -and
                      (Run-ApiTests) -and
                      (Run-ContactsTests) -and
                      (Run-DocumentsTests) -and
                      (Run-TemplatesTests) -and
                      (Run-SelfSigningTests)
    }
    default {
        Print-Error "Unknown module: $Module"
        Print-Info "Valid modules: smoke, contacts, documents, templates, self-signing, api, all"
        exit 1
    }
}

# Step 4: Generate summary
$summaryResult = Generate-Summary

# Return overall result
if (-not $testResult -or -not $summaryResult) {
    exit 1
}

exit 0
