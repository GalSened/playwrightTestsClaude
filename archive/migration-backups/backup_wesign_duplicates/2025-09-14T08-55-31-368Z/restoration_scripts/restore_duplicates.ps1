# WeSign Test Deduplication - PowerShell Restoration Script
# Generated: 2025-09-14T08:55:31.405Z

Write-Host "🔄 WeSign Test Restoration Script (PowerShell)" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

$sourceDir = "C:\Users\gals\Desktop\playwrightTestsClaude\backup_wesign_duplicates\2025-09-14T08-55-31-368Z\duplicate_files"
$targetDir = "C:/Users/gals/seleniumpythontests-1/playwright_tests"

$confirm = Read-Host "Are you sure you want to restore all duplicate files? (y/N)"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "Restoration cancelled." -ForegroundColor Yellow
    exit 1
}

Write-Host "🚀 Starting restoration..." -ForegroundColor Green

try {
    Copy-Item -Path "$sourceDir\*" -Destination $targetDir -Recurse -Force
    Write-Host "✅ Restoration completed successfully!" -ForegroundColor Green
} catch {
    Write-Host "❌ Restoration failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "📊 Please refresh test discovery and verify test count" -ForegroundColor Yellow
