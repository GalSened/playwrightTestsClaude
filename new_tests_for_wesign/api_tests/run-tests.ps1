# WeSign API Test Runner (PowerShell)
# Usage: .\run-tests.ps1 [-TestType smoke|regression|security|users]

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('smoke', 'regression', 'security', 'users', 'distribution')]
    [string]$TestType = 'regression'
)

$ErrorActionPreference = "Stop"

$Collection = "WeSign_ULTIMATE_COMPLETE_API_TESTING_SUITE.json"
$Environment = "WeSign API Environment.postman_environment.json"
$ReportDir = "reports"

# Create reports directory
if (-not (Test-Path $ReportDir)) {
    New-Item -ItemType Directory -Path $ReportDir | Out-Null
}

Write-Host "===================================" -ForegroundColor Green
Write-Host "  WeSign API Test Execution" -ForegroundColor Green
Write-Host "===================================" -ForegroundColor Green
Write-Host ""

# Check if Newman is installed
try {
    $null = Get-Command newman -ErrorAction Stop
} catch {
    Write-Host "Newman is not installed!" -ForegroundColor Red
    Write-Host "Install with: npm install -g newman newman-reporter-htmlextra"
    exit 1
}

switch ($TestType) {
    'smoke' {
        Write-Host "Running Smoke Tests..." -ForegroundColor Yellow
        newman run $Collection `
            -e $Environment `
            --folder "Users - Phase 1: Authentication Flow Tests" `
            -r cli,htmlextra `
            --reporter-htmlextra-export "$ReportDir/smoke-report.html"
    }

    'regression' {
        Write-Host "Running Full Regression Tests..." -ForegroundColor Yellow
        newman run $Collection `
            -e $Environment `
            -r cli,htmlextra `
            --reporter-htmlextra-export "$ReportDir/regression-report.html"
    }

    'security' {
        Write-Host "Running Security Tests..." -ForegroundColor Yellow
        newman run $Collection `
            -e $Environment `
            --folder "Users - Phase 4: Security & Edge Case Tests" `
            -r cli,htmlextra `
            --reporter-htmlextra-export "$ReportDir/security-report.html"
    }

    'users' {
        Write-Host "Running Users Module Tests..." -ForegroundColor Yellow
        newman run $Collection `
            -e $Environment `
            --folder "Users - Phase 1: Authentication Flow Tests" `
            --folder "Users - Phase 2: Authenticated User Profile Tests" `
            --folder "Users - Phase 3: Token Management Tests" `
            --folder "Users - Phase 4: Security & Edge Case Tests" `
            -r cli,htmlextra `
            --reporter-htmlextra-export "$ReportDir/users-report.html"
    }

    'distribution' {
        Write-Host "Running Distribution Module Tests..." -ForegroundColor Yellow
        for ($i = 1; $i -le 8; $i++) {
            newman run $Collection `
                -e $Environment `
                --folder "Distribution - Phase $i" `
                -r cli
        }
    }
}

Write-Host ""
Write-Host "===================================" -ForegroundColor Green
Write-Host "  Test Execution Complete!" -ForegroundColor Green
Write-Host "===================================" -ForegroundColor Green
Write-Host ""
Write-Host "Report location: $ReportDir/"
Write-Host ""
