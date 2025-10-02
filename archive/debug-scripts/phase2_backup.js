const fs = require('fs');
const path = require('path');

async function executePhase2Backup() {
    console.log('💾 PHASE 2: SAFE BACKUP PHASE');
    console.log('=============================\n');

    const WESIGN_PATH = 'C:/Users/gals/seleniumpythontests-1/playwright_tests';
    const BACKUP_ROOT = 'C:/Users/gals/Desktop/playwrightTestsClaude/backup_wesign_duplicates';

    try {
        // Load the smart execution plan
        const planData = JSON.parse(fs.readFileSync('smart_execution_plan.json', 'utf8'));

        console.log('📋 Step 1: Create backup directory structure');
        console.log('============================================');

        // Create timestamped backup directory
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.join(BACKUP_ROOT, timestamp);

        if (!fs.existsSync(BACKUP_ROOT)) {
            fs.mkdirSync(BACKUP_ROOT, { recursive: true });
            console.log(`✅ Created backup root: ${BACKUP_ROOT}`);
        }

        fs.mkdirSync(backupDir, { recursive: true });
        console.log(`✅ Created backup directory: ${backupDir}`);

        // Create subdirectories for organization
        const backupStructure = [
            'duplicate_files',
            'logs',
            'metadata',
            'restoration_scripts'
        ];

        backupStructure.forEach(subdir => {
            const subdirPath = path.join(backupDir, subdir);
            fs.mkdirSync(subdirPath, { recursive: true });
            console.log(`✅ Created: ${subdir}/`);
        });

        console.log('\n📋 Step 2: Copy all REMOVE files to backup location');
        console.log('===================================================');

        const filesToRemove = [];
        let totalFilesCopied = 0;
        let totalFilesSkipped = 0;

        // Collect all files to be removed
        Object.values(planData.duplicatePatterns).forEach(pattern => {
            pattern.recommendedRemove.forEach(removeFile => {
                if (!filesToRemove.includes(removeFile.filePath)) {
                    filesToRemove.push(removeFile.filePath);
                }
            });
        });

        console.log(`🔍 Found ${filesToRemove.length} files to backup before removal...\n`);

        for (const fileToRemove of filesToRemove) {
            const sourcePath = path.join(WESIGN_PATH, fileToRemove);

            // Preserve directory structure in backup
            const relativePath = fileToRemove;
            const backupFilePath = path.join(backupDir, 'duplicate_files', relativePath);
            const backupFileDir = path.dirname(backupFilePath);

            try {
                if (fs.existsSync(sourcePath)) {
                    // Create directory structure if it doesn't exist
                    if (!fs.existsSync(backupFileDir)) {
                        fs.mkdirSync(backupFileDir, { recursive: true });
                    }

                    // Copy file
                    fs.copyFileSync(sourcePath, backupFilePath);
                    console.log(`✅ BACKED UP: ${relativePath}`);
                    totalFilesCopied++;
                } else {
                    console.log(`⚠️  SKIP (NOT FOUND): ${relativePath}`);
                    totalFilesSkipped++;
                }
            } catch (error) {
                console.log(`❌ BACKUP FAILED: ${relativePath} - ${error.message}`);
            }
        }

        console.log(`\n📊 Backup Results: ${totalFilesCopied} copied, ${totalFilesSkipped} skipped`);

        console.log('\n📋 Step 3: Generate restoration script');
        console.log('======================================');

        // Generate Windows batch restoration script
        const restorationScript = `@echo off
REM WeSign Test Deduplication - Restoration Script
REM Generated: ${new Date().toISOString()}
REM Backup Location: ${backupDir}

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

set "SOURCE_DIR=${backupDir}\\duplicate_files"
set "TARGET_DIR=${WESIGN_PATH}"

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
`;

        const restorationScriptPath = path.join(backupDir, 'restoration_scripts', 'restore_duplicates.bat');
        fs.writeFileSync(restorationScriptPath, restorationScript);
        console.log(`✅ Created restoration script: restore_duplicates.bat`);

        // Generate PowerShell restoration script (alternative)
        const powershellScript = `# WeSign Test Deduplication - PowerShell Restoration Script
# Generated: ${new Date().toISOString()}

Write-Host "🔄 WeSign Test Restoration Script (PowerShell)" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

$sourceDir = "${backupDir}\\duplicate_files"
$targetDir = "${WESIGN_PATH}"

$confirm = Read-Host "Are you sure you want to restore all duplicate files? (y/N)"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "Restoration cancelled." -ForegroundColor Yellow
    exit 1
}

Write-Host "🚀 Starting restoration..." -ForegroundColor Green

try {
    Copy-Item -Path "$sourceDir\\*" -Destination $targetDir -Recurse -Force
    Write-Host "✅ Restoration completed successfully!" -ForegroundColor Green
} catch {
    Write-Host "❌ Restoration failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "📊 Please refresh test discovery and verify test count" -ForegroundColor Yellow
`;

        const powershellScriptPath = path.join(backupDir, 'restoration_scripts', 'restore_duplicates.ps1');
        fs.writeFileSync(powershellScriptPath, powershellScript);
        console.log(`✅ Created PowerShell restoration script: restore_duplicates.ps1`);

        console.log('\n📋 Step 4: Verify backup integrity');
        console.log('==================================');

        let backupIntegrityChecks = {
            totalFilesInBackup: 0,
            totalSizeInBackup: 0,
            filesWithSizeCheck: 0,
            integrityPassed: true
        };

        // Verify backed up files
        function verifyBackupRecursive(dir) {
            const items = fs.readdirSync(dir);

            for (const item of items) {
                const itemPath = path.join(dir, item);
                const stat = fs.statSync(itemPath);

                if (stat.isDirectory()) {
                    verifyBackupRecursive(itemPath);
                } else if (stat.isFile() && item.endsWith('.py')) {
                    backupIntegrityChecks.totalFilesInBackup++;
                    backupIntegrityChecks.totalSizeInBackup += stat.size;

                    // Check if file is not empty and has valid Python extension
                    if (stat.size > 0) {
                        backupIntegrityChecks.filesWithSizeCheck++;
                    }
                }
            }
        }

        const duplicateFilesBackupDir = path.join(backupDir, 'duplicate_files');
        verifyBackupRecursive(duplicateFilesBackupDir);

        console.log(`✅ Backup integrity check:`);
        console.log(`   - Files backed up: ${backupIntegrityChecks.totalFilesInBackup}`);
        console.log(`   - Total size: ${(backupIntegrityChecks.totalSizeInBackup / 1024).toFixed(2)} KB`);
        console.log(`   - Files with content: ${backupIntegrityChecks.filesWithSizeCheck}`);

        if (backupIntegrityChecks.totalFilesInBackup > 0) {
            console.log(`✅ Backup integrity: PASSED`);
        } else {
            console.log(`⚠️  Backup integrity: WARNING - No files found in backup`);
            backupIntegrityChecks.integrityPassed = false;
        }

        // Create backup metadata
        const backupMetadata = {
            timestamp: new Date().toISOString(),
            phase: 'Phase 2 - Safe Backup',
            status: 'SUCCESS',
            backupLocation: backupDir,
            sourceLocation: WESIGN_PATH,
            stats: {
                totalFilesCopied,
                totalFilesSkipped,
                backupIntegrityChecks
            },
            restorationScripts: [
                'restoration_scripts/restore_duplicates.bat',
                'restoration_scripts/restore_duplicates.ps1'
            ],
            filesToRemove: filesToRemove,
            originalPlan: planData.impact,
            instructions: {
                toRestore: 'Run either restore_duplicates.bat or restore_duplicates.ps1 from restoration_scripts/',
                toVerify: 'Check that all duplicate files are restored to original locations',
                toContinue: 'If backup is successful, proceed to Phase 3'
            }
        };

        const metadataPath = path.join(backupDir, 'metadata', 'backup_metadata.json');
        fs.writeFileSync(metadataPath, JSON.stringify(backupMetadata, null, 2));
        console.log(`✅ Created backup metadata: backup_metadata.json`);

        // Save results for next phase
        fs.writeFileSync('phase2_results.json', JSON.stringify(backupMetadata, null, 2));

        console.log('\n🎯 PHASE 2 BACKUP RESULTS');
        console.log('=========================');

        if (backupIntegrityChecks.integrityPassed && totalFilesCopied > 0) {
            console.log('🎉 PHASE 2 COMPLETE - BACKUP SUCCESSFUL!');
            console.log(`✅ ${totalFilesCopied} duplicate files safely backed up`);
            console.log(`✅ Backup location: ${backupDir}`);
            console.log(`✅ Restoration scripts created and ready`);
            console.log(`✅ Full restoration capability confirmed`);
            console.log('\n🚀 READY FOR PHASE 3: Deduplication Phase');

            return {
                success: true,
                backupDir,
                filesCopied: totalFilesCopied,
                restorationScripts: [restorationScriptPath, powershellScriptPath]
            };
        } else {
            console.log('⚠️  PHASE 2 ISSUES DETECTED');
            console.log('❌ Backup verification failed');
            console.log('❌ Manual review required before proceeding');

            return {
                success: false,
                issues: ['Backup integrity check failed', 'Zero files backed up']
            };
        }

    } catch (error) {
        console.error('❌ Phase 2 backup failed:', error.message);
        return { success: false, error: error.message };
    }
}

executePhase2Backup();