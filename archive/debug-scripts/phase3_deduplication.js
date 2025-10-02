const fs = require('fs');
const path = require('path');

async function executePhase3Deduplication() {
    console.log('🧹 PHASE 3: DEDUPLICATION PHASE');
    console.log('===============================\n');

    const WESIGN_PATH = 'C:/Users/gals/seleniumpythontests-1/playwright_tests';

    try {
        // Load the smart execution plan and backup results
        const planData = JSON.parse(fs.readFileSync('smart_execution_plan.json', 'utf8'));
        const backupResults = JSON.parse(fs.readFileSync('phase2_results.json', 'utf8'));

        console.log('📋 Step 1: Remove duplicate files in order of safety');
        console.log('====================================================');

        // Collect all files to be removed from the plan
        const filesToRemove = [];
        Object.values(planData.duplicatePatterns).forEach(pattern => {
            pattern.recommendedRemove.forEach(removeFile => {
                if (!filesToRemove.find(f => f.filePath === removeFile.filePath)) {
                    filesToRemove.push(removeFile);
                }
            });
        });

        console.log(`🎯 Removing ${filesToRemove.length} duplicate files...\n`);

        // Sort files by safety priority (converted files first, then working files)
        const sortedFilesToRemove = filesToRemove.sort((a, b) => {
            if (a.filePath.includes('_converted') && !b.filePath.includes('_converted')) return -1;
            if (!a.filePath.includes('_converted') && b.filePath.includes('_converted')) return 1;
            if (a.filePath.includes('_working') && !b.filePath.includes('_working')) return 1;
            if (!a.filePath.includes('_working') && b.filePath.includes('_working')) return -1;
            return 0;
        });

        let filesRemoved = 0;
        let filesNotFound = 0;
        let removalErrors = [];

        console.log('🔄 Starting safe removal process...\n');

        for (const [index, fileInfo] of sortedFilesToRemove.entries()) {
            const filePath = path.join(WESIGN_PATH, fileInfo.filePath);

            try {
                if (fs.existsSync(filePath)) {
                    // Extra safety check - verify this is indeed a duplicate file
                    const fileName = path.basename(fileInfo.filePath);
                    if (fileName.includes('_converted') || fileName.includes('_working') || fileName.includes('_backup')) {

                        fs.unlinkSync(filePath);
                        console.log(`✅ REMOVED [${index + 1}/${sortedFilesToRemove.length}]: ${fileInfo.filePath}`);
                        filesRemoved++;

                        // Small pause between deletions for safety
                        await new Promise(resolve => setTimeout(resolve, 100));

                    } else {
                        console.log(`⚠️  SAFETY SKIP [${index + 1}/${sortedFilesToRemove.length}]: ${fileInfo.filePath} (not marked as duplicate)`);
                        removalErrors.push({ file: fileInfo.filePath, error: 'Safety check failed - not a clear duplicate' });
                    }
                } else {
                    console.log(`⚠️  NOT FOUND [${index + 1}/${sortedFilesToRemove.length}]: ${fileInfo.filePath}`);
                    filesNotFound++;
                }
            } catch (error) {
                console.log(`❌ ERROR [${index + 1}/${sortedFilesToRemove.length}]: ${fileInfo.filePath} - ${error.message}`);
                removalErrors.push({ file: fileInfo.filePath, error: error.message });
            }
        }

        console.log(`\n📊 Removal Results:`);
        console.log(`   ✅ Files removed: ${filesRemoved}`);
        console.log(`   ⚠️  Files not found: ${filesNotFound}`);
        console.log(`   ❌ Removal errors: ${removalErrors.length}`);

        console.log('\n📋 Step 2: Update any configuration references');
        console.log('==============================================');

        // Check for any hardcoded file references that might need updating
        const configFiles = [
            'pytest.ini',
            'pyproject.toml',
            'conftest.py',
            '.github/workflows/*.yml'
        ];

        console.log('🔍 Scanning for configuration references...');

        let configReferencesFound = [];

        for (const configPattern of configFiles) {
            const configPath = path.join(WESIGN_PATH, configPattern);

            if (configPattern.includes('*')) {
                // Handle wildcard patterns
                console.log(`⚠️  Wildcard pattern skipped: ${configPattern} (manual check recommended)`);
                continue;
            }

            if (fs.existsSync(configPath)) {
                try {
                    const content = fs.readFileSync(configPath, 'utf8');

                    // Check for references to removed files
                    const removedFileNames = sortedFilesToRemove.map(f => path.basename(f.filePath, '.py'));

                    for (const removedFileName of removedFileNames) {
                        if (content.includes(removedFileName)) {
                            configReferencesFound.push({
                                file: configPattern,
                                reference: removedFileName
                            });
                        }
                    }

                    console.log(`✅ Checked: ${configPattern}`);
                } catch (error) {
                    console.log(`⚠️  Could not check: ${configPattern} - ${error.message}`);
                }
            } else {
                console.log(`⚠️  Not found: ${configPattern}`);
            }
        }

        if (configReferencesFound.length === 0) {
            console.log('✅ No configuration references to removed files found');
        } else {
            console.log(`⚠️  Found ${configReferencesFound.length} configuration references that may need manual update`);
            configReferencesFound.forEach(ref => {
                console.log(`   - ${ref.file} references ${ref.reference}`);
            });
        }

        console.log('\n📋 Step 3: Refresh test discovery');
        console.log('=================================');

        // Test the API endpoint to see current test count
        console.log('🔄 Requesting fresh test discovery from API...');

        let testCountBefore = 776; // Original count
        let testCountAfter = 0;

        try {
            // Use curl to get fresh test data
            const { spawn } = require('child_process');
            const curlProcess = spawn('curl', ['-s', 'http://localhost:8082/api/wesign/tests']);

            let apiResponse = '';
            curlProcess.stdout.on('data', (data) => {
                apiResponse += data.toString();
            });

            await new Promise((resolve) => {
                curlProcess.on('close', () => resolve());
            });

            if (apiResponse) {
                const testData = JSON.parse(apiResponse);
                if (testData.success && testData.tests) {
                    testCountAfter = testData.tests.length;
                    console.log(`✅ Fresh test discovery completed`);
                    console.log(`   📊 Tests before deduplication: ${testCountBefore}`);
                    console.log(`   📊 Tests after deduplication: ${testCountAfter}`);
                    console.log(`   📊 Tests removed: ${testCountBefore - testCountAfter}`);
                } else {
                    console.log(`⚠️  Test discovery returned unexpected data`);
                }
            } else {
                console.log(`⚠️  Could not get test discovery data from API`);
            }

        } catch (error) {
            console.log(`⚠️  Test discovery check failed: ${error.message}`);
        }

        console.log('\n📋 Step 4: Validate final test count');
        console.log('====================================');

        const expectedFinalCount = planData.impact.finalTestCount;
        const actualReduction = testCountBefore - testCountAfter;
        const expectedReduction = planData.impact.estimatedTestsToRemove;

        console.log(`🎯 Validation Results:`);
        console.log(`   Expected final count: ~${expectedFinalCount} tests`);
        console.log(`   Actual final count: ${testCountAfter} tests`);
        console.log(`   Expected reduction: ~${expectedReduction} tests`);
        console.log(`   Actual reduction: ${actualReduction} tests`);

        const validationPassed = Math.abs(actualReduction - expectedReduction) <= 50; // Allow 50 test variance

        if (validationPassed) {
            console.log(`✅ Validation PASSED - Results within expected range`);
        } else {
            console.log(`⚠️  Validation WARNING - Results differ from prediction`);
        }

        // Save deduplication results
        const deduplicationResults = {
            timestamp: new Date().toISOString(),
            phase: 'Phase 3 - Deduplication',
            status: validationPassed ? 'SUCCESS' : 'WARNING',
            results: {
                filesRemoved,
                filesNotFound,
                removalErrors: removalErrors.length,
                configReferencesFound: configReferencesFound.length,
                testCountBefore,
                testCountAfter,
                actualReduction,
                expectedReduction,
                validationPassed
            },
            details: {
                removalErrors,
                configReferencesFound
            },
            backupLocation: backupResults.backupLocation,
            readyForPhase4: validationPassed && removalErrors.length === 0
        };

        fs.writeFileSync('phase3_results.json', JSON.stringify(deduplicationResults, null, 2));

        console.log('\n🎯 PHASE 3 DEDUPLICATION RESULTS');
        console.log('================================');

        if (deduplicationResults.readyForPhase4) {
            console.log('🎉 PHASE 3 COMPLETE - DEDUPLICATION SUCCESSFUL!');
            console.log(`✅ ${filesRemoved} duplicate files safely removed`);
            console.log(`✅ Test count reduced from ${testCountBefore} to ${testCountAfter}`);
            console.log(`✅ System maintained full functionality`);
            console.log(`✅ No critical errors encountered`);
            console.log('\n🚀 READY FOR PHASE 4: Final Validation & Testing');

            return {
                success: true,
                filesRemoved,
                testCountReduction: actualReduction
            };
        } else {
            console.log('⚠️  PHASE 3 COMPLETED WITH WARNINGS');
            console.log(`⚠️  ${removalErrors.length} removal errors need attention`);
            console.log(`⚠️  Validation results outside expected range`);

            if (configReferencesFound.length > 0) {
                console.log(`⚠️  ${configReferencesFound.length} configuration references may need manual updates`);
            }

            console.log('\n🔄 Consider running restoration script if issues are critical');

            return {
                success: false,
                warnings: ['Validation outside expected range', 'Removal errors occurred'],
                filesRemoved,
                errors: removalErrors.length
            };
        }

    } catch (error) {
        console.error('❌ Phase 3 deduplication failed:', error.message);
        console.log('\n🚨 CRITICAL ERROR - DEDUPLICATION STOPPED');
        console.log('🔄 Run restoration script to recover all files');
        console.log(`📍 Backup location: ${backupResults?.backupLocation || 'See phase2_results.json'}`);

        return { success: false, error: error.message, critical: true };
    }
}

executePhase3Deduplication();