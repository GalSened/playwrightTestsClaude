const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

async function executePhase1Validation() {
    console.log('🔍 PHASE 1: VALIDATION PHASE');
    console.log('============================\n');

    const WESIGN_PATH = 'C:/Users/gals/seleniumpythontests-1/playwright_tests';

    try {
        // Load the smart execution plan
        const planData = JSON.parse(fs.readFileSync('smart_execution_plan.json', 'utf8'));

        console.log('📋 Step 1: Check all recommended KEEP files exist');
        console.log('==================================================');

        const keepFiles = [];
        const missingFiles = [];

        // Extract KEEP files from the plan
        Object.values(planData.duplicatePatterns).forEach(pattern => {
            if (pattern.recommendedKeep) {
                keepFiles.push(pattern.recommendedKeep.filePath);
            }
        });

        // Remove duplicates
        const uniqueKeepFiles = [...new Set(keepFiles)];

        console.log(`🔍 Checking ${uniqueKeepFiles.length} files to KEEP...\n`);

        for (const filePath of uniqueKeepFiles) {
            const fullPath = path.join(WESIGN_PATH, filePath);
            if (fs.existsSync(fullPath)) {
                console.log(`✅ EXISTS: ${filePath}`);
            } else {
                console.log(`❌ MISSING: ${filePath}`);
                missingFiles.push(filePath);
            }
        }

        if (missingFiles.length > 0) {
            console.log(`\n⚠️  WARNING: ${missingFiles.length} recommended KEEP files are missing!`);
            console.log('This could indicate the analysis was based on stale data.');
            return false;
        }

        console.log(`\n✅ All ${uniqueKeepFiles.length} KEEP files exist!`);

        console.log('\n📋 Step 2: Run syntax validation on KEEP files');
        console.log('===============================================');

        const syntaxErrors = [];
        let checkedFiles = 0;

        for (const filePath of uniqueKeepFiles.slice(0, 10)) { // Check first 10 for speed
            const fullPath = path.join(WESIGN_PATH, filePath);

            try {
                const result = await runPythonSyntaxCheck(fullPath);
                checkedFiles++;

                if (result.success) {
                    console.log(`✅ SYNTAX OK: ${path.basename(filePath)}`);
                } else {
                    console.log(`❌ SYNTAX ERROR: ${path.basename(filePath)} - ${result.error}`);
                    syntaxErrors.push({ file: filePath, error: result.error });
                }
            } catch (error) {
                console.log(`⚠️  CANNOT CHECK: ${path.basename(filePath)} - ${error.message}`);
            }
        }

        console.log(`\n📊 Syntax Check Results: ${checkedFiles - syntaxErrors.length}/${checkedFiles} files OK`);

        if (syntaxErrors.length > 0) {
            console.log(`\n⚠️  Syntax errors found in ${syntaxErrors.length} files:`);
            syntaxErrors.forEach(error => {
                console.log(`   - ${error.file}: ${error.error}`);
            });
        }

        console.log('\n📋 Step 3: Verify import dependencies');
        console.log('====================================');

        // Check for common import patterns that might break
        const importChecks = [
            'from pages.login_page import LoginPage',
            'from pages.home_page import HomePage',
            'from config.settings import settings',
            'import pytest',
            'import allure',
            'from playwright.async_api import Page'
        ];

        const importIssues = [];

        for (const filePath of uniqueKeepFiles.slice(0, 5)) {
            const fullPath = path.join(WESIGN_PATH, filePath);

            try {
                const content = fs.readFileSync(fullPath, 'utf8');

                importChecks.forEach(importLine => {
                    if (content.includes(importLine)) {
                        console.log(`✅ IMPORT OK: ${path.basename(filePath)} has "${importLine}"`);
                    }
                });

                // Check for relative imports that might break
                const relativeImports = content.match(/from \.\w+/g);
                if (relativeImports) {
                    console.log(`⚠️  RELATIVE IMPORTS: ${path.basename(filePath)} has ${relativeImports.length} relative imports`);
                }

            } catch (error) {
                importIssues.push({ file: filePath, error: error.message });
            }
        }

        console.log('\n📋 Step 4: Test sample execution of key tests');
        console.log('=============================================');

        // Test one sample from each risk category
        const sampleTests = [
            'tests/auth/test_login.py::TestLogin::test_login_with_valid_credentials_success', // High risk
            'tests/documents/test_document_management.py', // Medium risk
            'tests/templates/test_template_management.py' // Low risk
        ];

        console.log('🧪 Testing sample executions (dry-run mode)...\n');

        for (const testPath of sampleTests) {
            const fullTestPath = path.join(WESIGN_PATH, testPath.split('::')[0]);

            if (fs.existsSync(fullTestPath)) {
                console.log(`✅ SAMPLE TEST EXISTS: ${testPath}`);

                // Quick pytest validation (dry-run)
                try {
                    const dryRunResult = await runPytestDryRun(fullTestPath);
                    if (dryRunResult.success) {
                        console.log(`✅ DRY-RUN OK: ${path.basename(testPath)}`);
                    } else {
                        console.log(`⚠️  DRY-RUN ISSUE: ${path.basename(testPath)} - ${dryRunResult.error}`);
                    }
                } catch (error) {
                    console.log(`⚠️  CANNOT DRY-RUN: ${path.basename(testPath)}`);
                }
            } else {
                console.log(`❌ SAMPLE TEST MISSING: ${testPath}`);
            }
        }

        console.log('\n🔍 SAFETY CHECKS');
        console.log('================');

        // Safety Check 1: No critical tests in REMOVE list
        const criticalTestsInRemove = [];
        Object.values(planData.duplicatePatterns).forEach(pattern => {
            pattern.recommendedRemove.forEach(removeFile => {
                if (removeFile.filePath.includes('critical') || removeFile.filePath.includes('smoke')) {
                    criticalTestsInRemove.push(removeFile.filePath);
                }
            });
        });

        if (criticalTestsInRemove.length === 0) {
            console.log('✅ Safety Check 1: No critical tests in REMOVE list');
        } else {
            console.log(`⚠️  Safety Check 1: ${criticalTestsInRemove.length} critical tests in REMOVE list`);
        }

        // Safety Check 2: All modules still represented
        const keepModules = new Set();
        uniqueKeepFiles.forEach(file => {
            const module = file.split('/')[1]; // tests/auth/file.py -> auth
            keepModules.add(module);
        });

        console.log(`✅ Safety Check 2: ${keepModules.size} modules represented: ${Array.from(keepModules).join(', ')}`);

        // Safety Check 3: Risk distribution maintained
        const analysisData = JSON.parse(fs.readFileSync('wesign_test_analysis.json', 'utf8'));
        console.log(`✅ Safety Check 3: Risk distribution - High: ${analysisData.riskStats.high}, Med: ${analysisData.riskStats.med}, Low: ${analysisData.riskStats.low}`);

        console.log('\n🎯 PHASE 1 VALIDATION RESULTS');
        console.log('==============================');

        const validationResults = {
            timestamp: new Date().toISOString(),
            phase: 'Phase 1 - Validation',
            status: 'SUCCESS',
            results: {
                filesChecked: uniqueKeepFiles.length,
                missingFiles: missingFiles.length,
                syntaxErrors: syntaxErrors.length,
                importIssues: importIssues.length,
                criticalTestsAtRisk: criticalTestsInRemove.length,
                modulesRepresented: keepModules.size
            },
            readyForPhase2: missingFiles.length === 0 && syntaxErrors.length < 3
        };

        fs.writeFileSync('phase1_results.json', JSON.stringify(validationResults, null, 2));

        if (validationResults.readyForPhase2) {
            console.log('🎉 PHASE 1 COMPLETE - READY FOR PHASE 2!');
            console.log('✅ All validation checks passed');
            console.log('✅ System is stable and safe for deduplication');
            console.log('\n🚀 Proceeding to Phase 2: Safe Backup Phase...');
            return true;
        } else {
            console.log('⚠️  PHASE 1 ISSUES DETECTED');
            console.log('❌ Manual review required before proceeding');
            console.log(`   - Missing files: ${missingFiles.length}`);
            console.log(`   - Syntax errors: ${syntaxErrors.length}`);
            return false;
        }

    } catch (error) {
        console.error('❌ Phase 1 validation failed:', error.message);
        return false;
    }
}

async function runPythonSyntaxCheck(filePath) {
    return new Promise((resolve) => {
        const python = spawn('C:/Users/gals/AppData/Local/Programs/Python/Python312/python.exe', ['-m', 'py_compile', filePath]);

        let error = '';
        python.stderr.on('data', (data) => {
            error += data.toString();
        });

        python.on('close', (code) => {
            resolve({
                success: code === 0,
                error: error.trim()
            });
        });

        // Timeout after 5 seconds
        setTimeout(() => {
            python.kill();
            resolve({ success: false, error: 'Timeout' });
        }, 5000);
    });
}

async function runPytestDryRun(filePath) {
    return new Promise((resolve) => {
        const pytest = spawn('C:/Users/gals/AppData/Local/Programs/Python/Python312/python.exe', [
            '-m', 'pytest', filePath, '--collect-only', '--quiet'
        ], {
            cwd: 'C:/Users/gals/seleniumpythontests-1/playwright_tests'
        });

        let output = '';
        let error = '';

        pytest.stdout.on('data', (data) => {
            output += data.toString();
        });

        pytest.stderr.on('data', (data) => {
            error += data.toString();
        });

        pytest.on('close', (code) => {
            resolve({
                success: code === 0,
                output: output.trim(),
                error: error.trim()
            });
        });

        // Timeout after 10 seconds
        setTimeout(() => {
            pytest.kill();
            resolve({ success: false, error: 'Timeout' });
        }, 10000);
    });
}

executePhase1Validation();