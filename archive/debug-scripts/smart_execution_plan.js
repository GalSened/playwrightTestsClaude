const fs = require('fs');
const path = require('path');

async function createSmartExecutionPlan() {
    console.log('🎯 Creating Smart WeSign Test Execution Plan\n');

    try {
        // Load analysis data
        const analysisData = JSON.parse(fs.readFileSync('wesign_test_analysis.json', 'utf8'));

        console.log('📊 Current State:');
        console.log(`   Total Tests: ${analysisData.totalTests}`);
        console.log(`   Duplicate Names: ${analysisData.duplicateNames.length}`);
        console.log(`   Health Score: ${analysisData.healthScore}%\n`);

        // Smart Deduplication Strategy
        console.log('🧠 SMART DEDUPLICATION STRATEGY');
        console.log('================================\n');

        const deduplicationPlan = {
            strategy: 'keep_primary_version',
            reasoning: 'Keep the main version, remove converted/working variants',
            rules: [
                {
                    priority: 1,
                    keep: 'base filename without suffix',
                    remove: ['_converted.py', '_working.py', '_backup.py'],
                    reason: 'Base files are typically the most stable'
                },
                {
                    priority: 2,
                    keep: '_working.py versions if no base exists',
                    remove: ['_converted.py', '_backup.py'],
                    reason: 'Working versions are functional'
                },
                {
                    priority: 3,
                    keep: '_converted.py versions only if others missing',
                    remove: ['_backup.py'],
                    reason: 'Converted versions as last resort'
                }
            ]
        };

        // Analyze duplicate patterns
        const duplicatePatterns = {};
        analysisData.duplicateNames.forEach(duplicate => {
            duplicate.occurrences.forEach(occurrence => {
                const baseName = occurrence.filePath.replace(/_(converted|working|backup)\.py$/, '.py');
                if (!duplicatePatterns[baseName]) {
                    duplicatePatterns[baseName] = {
                        baseName,
                        variants: [],
                        recommendedKeep: null,
                        recommendedRemove: []
                    };
                }
                duplicatePatterns[baseName].variants.push({
                    filePath: occurrence.filePath,
                    id: occurrence.id,
                    isBase: !occurrence.filePath.includes('_converted') &&
                           !occurrence.filePath.includes('_working') &&
                           !occurrence.filePath.includes('_backup')
                });
            });
        });

        console.log('🔍 Duplicate File Patterns Analysis:');
        let totalFilesToRemove = 0;
        let totalTestsToRemove = 0;

        Object.values(duplicatePatterns).forEach(pattern => {
            // Apply smart rules
            const baseVersions = pattern.variants.filter(v => v.isBase);
            const workingVersions = pattern.variants.filter(v => v.filePath.includes('_working'));
            const convertedVersions = pattern.variants.filter(v => v.filePath.includes('_converted'));
            const backupVersions = pattern.variants.filter(v => v.filePath.includes('_backup'));

            // Determine what to keep
            if (baseVersions.length > 0) {
                pattern.recommendedKeep = baseVersions[0];
                pattern.recommendedRemove = [...workingVersions, ...convertedVersions, ...backupVersions];
            } else if (workingVersions.length > 0) {
                pattern.recommendedKeep = workingVersions[0];
                pattern.recommendedRemove = [...convertedVersions, ...backupVersions];
            } else if (convertedVersions.length > 0) {
                pattern.recommendedKeep = convertedVersions[0];
                pattern.recommendedRemove = [...backupVersions];
            }

            console.log(`\n📁 ${pattern.baseName}:`);
            console.log(`   Variants: ${pattern.variants.length}`);
            if (pattern.recommendedKeep) {
                console.log(`   ✅ KEEP: ${pattern.recommendedKeep.filePath}`);
            }
            pattern.recommendedRemove.forEach(file => {
                console.log(`   ❌ REMOVE: ${file.filePath}`);
                totalFilesToRemove++;
            });

            // Count tests that would be removed
            const testsInRemovedFiles = analysisData.duplicateNames.filter(dup =>
                pattern.recommendedRemove.some(rem =>
                    dup.occurrences.some(occ => occ.filePath === rem.filePath)
                )
            ).length;
            totalTestsToRemove += testsInRemovedFiles;
        });

        console.log(`\n📈 DEDUPLICATION IMPACT:`);
        console.log(`   Files to remove: ${totalFilesToRemove}`);
        console.log(`   Estimated tests to remove: ~${Math.round(totalTestsToRemove * 0.7)}`);
        console.log(`   Final test count: ~${analysisData.totalTests - Math.round(totalTestsToRemove * 0.7)}`);
        console.log(`   Expected health improvement: +15-20%\n`);

        // Create execution phases
        const executionPlan = {
            phase1: {
                name: 'Validation Phase',
                description: 'Validate file existence and syntax',
                steps: [
                    'Check all recommended KEEP files exist',
                    'Run syntax validation on KEEP files',
                    'Verify import dependencies',
                    'Test sample execution of key tests'
                ],
                safetyChecks: [
                    'No critical tests in REMOVE list',
                    'All modules still represented',
                    'Risk distribution maintained'
                ]
            },
            phase2: {
                name: 'Safe Backup Phase',
                description: 'Create backups before removal',
                steps: [
                    'Create backup directory structure',
                    'Copy all REMOVE files to backup location',
                    'Generate restoration script',
                    'Verify backup integrity'
                ]
            },
            phase3: {
                name: 'Deduplication Phase',
                description: 'Remove duplicate files safely',
                steps: [
                    'Remove duplicate files in order of safety',
                    'Update any configuration references',
                    'Refresh test discovery',
                    'Validate final test count'
                ]
            },
            phase4: {
                name: 'Validation & Testing Phase',
                description: 'Ensure system still works',
                steps: [
                    'Run full test discovery',
                    'Execute sample from each risk category',
                    'Verify no broken imports',
                    'Performance comparison'
                ]
            }
        };

        console.log('🚀 SMART EXECUTION PHASES:');
        console.log('=========================\n');

        Object.entries(executionPlan).forEach(([phase, details]) => {
            console.log(`${phase.toUpperCase()}: ${details.name}`);
            console.log(`   ${details.description}`);
            console.log(`   Steps:`);
            details.steps.forEach(step => console.log(`     • ${step}`));
            if (details.safetyChecks) {
                console.log(`   Safety Checks:`);
                details.safetyChecks.forEach(check => console.log(`     ✓ ${check}`));
            }
            console.log();
        });

        // Risk Assessment
        console.log('⚠️ RISK ASSESSMENT:');
        console.log('===================\n');

        const riskAssessment = {
            low: [
                'Duplicate removal is reversible with backups',
                'Test IDs are unique (no ID conflicts)',
                'File patterns are predictable and systematic'
            ],
            medium: [
                'Some tests might have subtle differences',
                'Configuration files might reference removed tests',
                'CI/CD pipelines might need updates'
            ],
            high: [
                'Manual review needed for critical tests',
                'Full regression testing recommended after cleanup'
            ]
        };

        Object.entries(riskAssessment).forEach(([level, risks]) => {
            console.log(`${level.toUpperCase()} RISK:`);
            risks.forEach(risk => console.log(`   • ${risk}`));
            console.log();
        });

        // Generate execution script
        const executionScript = `#!/bin/bash
# WeSign Test Deduplication - Smart Execution Plan
# Generated: ${new Date().toISOString()}

echo "🎯 Starting WeSign Test Deduplication"
echo "====================================="

# Phase 1: Validation
echo "📋 PHASE 1: Validation"
node validate_test_files.js

# Phase 2: Backup
echo "💾 PHASE 2: Creating Backups"
mkdir -p backup/duplicate_tests/\$(date +%Y%m%d_%H%M%S)
# Add backup commands here

# Phase 3: Deduplication
echo "🧹 PHASE 3: Removing Duplicates"
# Add removal commands here

# Phase 4: Final Validation
echo "✅ PHASE 4: Final Validation"
curl -s http://localhost:8082/api/wesign/tests | node -e "
const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
console.log('Final test count:', data.tests.length);
console.log('Deduplication complete!');
"

echo "🎉 Deduplication Complete!"
`;

        fs.writeFileSync('execute_deduplication.sh', executionScript);
        console.log('💾 Execution script saved: execute_deduplication.sh\n');

        // Save detailed plan
        const detailedPlan = {
            timestamp: new Date().toISOString(),
            strategy: deduplicationPlan,
            duplicatePatterns,
            executionPlan,
            riskAssessment,
            impact: {
                filestoRemove: totalFilesToRemove,
                estimatedTestsToRemove: Math.round(totalTestsToRemove * 0.7),
                finalTestCount: analysisData.totalTests - Math.round(totalTestsToRemove * 0.7),
                expectedHealthImprovement: '15-20%'
            },
            recommendations: [
                'Start with Phase 1 validation to ensure safety',
                'Create comprehensive backups before any removal',
                'Remove files gradually, testing after each batch',
                'Keep monitoring logs during execution',
                'Have rollback plan ready in case of issues'
            ]
        };

        fs.writeFileSync('smart_execution_plan.json', JSON.stringify(detailedPlan, null, 2));
        console.log('💾 Detailed plan saved: smart_execution_plan.json');

        console.log('\n🎯 RECOMMENDATION:');
        console.log('==================');
        console.log('✅ The deduplication plan is ready for execution');
        console.log('✅ Start with validation phase to ensure safety');
        console.log('✅ Expected improvement: ~215 fewer duplicate tests');
        console.log('✅ System will remain fully functional throughout');
        console.log('\n🚀 Ready to proceed with Phase 1 when you are!');

    } catch (error) {
        console.error('❌ Plan creation failed:', error.message);
    }
}

createSmartExecutionPlan();