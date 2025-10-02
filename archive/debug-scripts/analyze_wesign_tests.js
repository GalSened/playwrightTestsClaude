const fs = require('fs');
const path = require('path');

async function analyzeWeSignTests() {
    console.log('🔍 Starting WeSign Test Analysis...\n');

    try {
        // Read the test data from API response
        const rawData = fs.readFileSync('wesign_tests_raw.json', 'utf8');
        const response = JSON.parse(rawData);

        if (!response.success || !response.tests) {
            console.error('❌ Failed to get valid test data');
            return;
        }

        const tests = response.tests;
        console.log(`📊 Total tests discovered: ${tests.length}\n`);

        // Analysis 1: Duplicate Test IDs
        console.log('🔍 Analysis 1: Checking for duplicate test IDs...');
        const testIds = tests.map(t => t.id);
        const duplicateIds = testIds.filter((id, index) => testIds.indexOf(id) !== index);

        if (duplicateIds.length > 0) {
            console.log(`❌ Found ${duplicateIds.length} duplicate test IDs:`);
            duplicateIds.forEach(id => console.log(`   - ${id}`));
        } else {
            console.log('✅ No duplicate test IDs found');
        }

        // Analysis 2: Duplicate Test Names
        console.log('\n🔍 Analysis 2: Checking for duplicate test names...');
        const testNames = tests.map(t => t.name);
        const duplicateNames = [];
        const nameCount = {};

        testNames.forEach(name => {
            nameCount[name] = (nameCount[name] || 0) + 1;
            if (nameCount[name] === 2) {
                duplicateNames.push(name);
            }
        });

        if (duplicateNames.length > 0) {
            console.log(`⚠️ Found ${duplicateNames.length} duplicate test names:`);
            duplicateNames.forEach(name => {
                const duplicates = tests.filter(t => t.name === name);
                console.log(`   - "${name}" appears in:`);
                duplicates.forEach(test => console.log(`     * ${test.filePath} (ID: ${test.id})`));
            });
        } else {
            console.log('✅ No duplicate test names found');
        }

        // Analysis 3: Module Distribution
        console.log('\n🔍 Analysis 3: Test distribution by module...');
        const moduleStats = {};
        tests.forEach(test => {
            moduleStats[test.module] = (moduleStats[test.module] || 0) + 1;
        });

        Object.entries(moduleStats).forEach(([module, count]) => {
            console.log(`   - ${module}: ${count} tests`);
        });

        // Analysis 4: File Path Analysis
        console.log('\n🔍 Analysis 4: Checking file paths for issues...');
        const filePaths = [...new Set(tests.map(t => t.filePath))];
        console.log(`📁 Unique test files: ${filePaths.length}`);

        const missingFiles = [];
        for (const filePath of filePaths) {
            const fullPath = `C:/Users/gals/seleniumpythontests-1/playwright_tests/${filePath}`;
            if (!fs.existsSync(fullPath)) {
                missingFiles.push(filePath);
            }
        }

        if (missingFiles.length > 0) {
            console.log(`❌ Missing files (${missingFiles.length}):`);
            missingFiles.forEach(file => console.log(`   - ${file}`));
        } else {
            console.log('✅ All test files exist');
        }

        // Analysis 5: Test Function Naming Patterns
        console.log('\n🔍 Analysis 5: Checking test function naming patterns...');
        const invalidNames = tests.filter(test => {
            const id = test.id.split('_').pop(); // Get the function name part
            return !id.startsWith('test_') || id.includes('  ') || id.includes('__');
        });

        if (invalidNames.length > 0) {
            console.log(`⚠️ Tests with unusual naming patterns (${invalidNames.length}):`);
            invalidNames.slice(0, 10).forEach(test => {
                console.log(`   - ${test.name} (${test.id})`);
            });
            if (invalidNames.length > 10) {
                console.log(`   ... and ${invalidNames.length - 10} more`);
            }
        } else {
            console.log('✅ All test names follow proper patterns');
        }

        // Analysis 6: Risk Distribution
        console.log('\n🔍 Analysis 6: Test risk distribution...');
        const riskStats = {};
        tests.forEach(test => {
            riskStats[test.risk] = (riskStats[test.risk] || 0) + 1;
        });

        Object.entries(riskStats).forEach(([risk, count]) => {
            console.log(`   - ${risk} risk: ${count} tests`);
        });

        // Analysis 7: Tag Analysis
        console.log('\n🔍 Analysis 7: Tag usage analysis...');
        const allTags = [];
        tests.forEach(test => {
            allTags.push(...test.tags);
        });

        const tagCount = {};
        allTags.forEach(tag => {
            tagCount[tag] = (tagCount[tag] || 0) + 1;
        });

        console.log('Tag distribution:');
        Object.entries(tagCount)
            .sort(([,a], [,b]) => b - a)
            .forEach(([tag, count]) => {
                console.log(`   - ${tag}: ${count} tests`);
            });

        // Summary and Recommendations
        console.log('\n📋 SUMMARY AND RECOMMENDATIONS:');
        console.log('================================');

        let issueCount = 0;

        if (duplicateIds.length > 0) {
            issueCount++;
            console.log(`❌ Issue 1: ${duplicateIds.length} duplicate test IDs need resolution`);
        }

        if (duplicateNames.length > 0) {
            issueCount++;
            console.log(`⚠️ Issue 2: ${duplicateNames.length} duplicate test names (may be intentional)`);
        }

        if (missingFiles.length > 0) {
            issueCount++;
            console.log(`❌ Issue 3: ${missingFiles.length} missing test files need attention`);
        }

        if (issueCount === 0) {
            console.log('✅ No critical issues found! Test suite is clean and ready for execution.');
        } else {
            console.log(`\n🔧 Found ${issueCount} issue(s) that need attention before production deployment.`);
        }

        console.log(`\n📈 Test Suite Health Score: ${Math.max(0, 100 - (issueCount * 20))}%`);

        // Export detailed analysis
        const analysis = {
            timestamp: new Date().toISOString(),
            totalTests: tests.length,
            duplicateIds: duplicateIds,
            duplicateNames: duplicateNames.map(name => ({
                name,
                occurrences: tests.filter(t => t.name === name).map(t => ({
                    id: t.id,
                    filePath: t.filePath
                }))
            })),
            moduleStats,
            missingFiles,
            invalidNames: invalidNames.map(t => ({ id: t.id, name: t.name, filePath: t.filePath })),
            riskStats,
            tagStats: tagCount,
            healthScore: Math.max(0, 100 - (issueCount * 20)),
            issueCount
        };

        fs.writeFileSync('wesign_test_analysis.json', JSON.stringify(analysis, null, 2));
        console.log('\n💾 Detailed analysis saved to: wesign_test_analysis.json');

    } catch (error) {
        console.error('❌ Analysis failed:', error.message);
    }
}

analyzeWeSignTests();