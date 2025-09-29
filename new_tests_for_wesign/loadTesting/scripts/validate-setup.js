#!/usr/bin/env node

/**
 * WeSign K6 Load Testing - Setup Validation Script
 *
 * This script validates the load testing setup without requiring K6 installation
 * Checks file structure, configuration, and basic syntax validation
 */

const fs = require('fs');
const path = require('path');

// Color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

// Validation results
let validationResults = {
    passed: 0,
    failed: 0,
    warnings: 0,
    details: []
};

/**
 * Utility functions
 */
function log(message, color = 'reset') {
    console.log(colors[color] + message + colors.reset);
}

function logResult(test, passed, message = '') {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    const color = passed ? 'green' : 'red';

    if (passed) {
        validationResults.passed++;
    } else {
        validationResults.failed++;
    }

    validationResults.details.push({ test, passed, message });
    log(`${status} ${test}${message ? ': ' + message : ''}`, color);
}

function logWarning(test, message) {
    validationResults.warnings++;
    validationResults.details.push({ test, passed: null, message, warning: true });
    log(`⚠️  WARN ${test}: ${message}`, 'yellow');
}

/**
 * File structure validation
 */
function validateFileStructure() {
    log('\n📁 Validating File Structure', 'cyan');

    const requiredFiles = [
        'package.json',
        'README.md',
        'GETTING_STARTED.md',
        'run-tests.sh',
        'run-tests.bat',
        'config/environments.json',
        'config/test-profiles.json',
        'config/k6-config.js',
        'utils/api-client.js',
        'utils/auth-helper.js',
        'utils/common-checks.js',
        'utils/data-generator.js',
        'scenarios/smoke/smoke-basic.js',
        'scenarios/smoke/smoke-auth.js',
        'scenarios/load/load-user-journey.js',
        'scenarios/load/load-documents.js',
        'scenarios/stress/stress-auth.js',
        'scenarios/spike/spike-login.js',
        'scenarios/spike/spike-documents.js',
        'scenarios/soak/soak-endurance.js',
        'scenarios/volume/breakpoint-analysis.js'
    ];

    const requiredDirectories = [
        'config',
        'utils',
        'scenarios',
        'scenarios/smoke',
        'scenarios/load',
        'scenarios/stress',
        'scenarios/spike',
        'scenarios/soak',
        'scenarios/volume',
        'reports'
    ];

    // Check required files
    requiredFiles.forEach(file => {
        const exists = fs.existsSync(file);
        logResult(`File exists: ${file}`, exists);
    });

    // Check required directories
    requiredDirectories.forEach(dir => {
        const exists = fs.existsSync(dir) && fs.statSync(dir).isDirectory();
        logResult(`Directory exists: ${dir}`, exists);
    });
}

/**
 * Configuration validation
 */
function validateConfiguration() {
    log('\n⚙️ Validating Configuration', 'cyan');

    // Validate environments.json
    try {
        const envConfig = JSON.parse(fs.readFileSync('config/environments.json', 'utf8'));
        logResult('environments.json is valid JSON', true);

        const hasEnvironments = envConfig.environments && Object.keys(envConfig.environments).length > 0;
        logResult('environments.json has environment definitions', hasEnvironments);

        const hasDevEnv = envConfig.environments.dev !== undefined;
        logResult('environments.json has dev environment', hasDevEnv);

    } catch (error) {
        logResult('environments.json is valid JSON', false, error.message);
    }

    // Validate test-profiles.json
    try {
        const profileConfig = JSON.parse(fs.readFileSync('config/test-profiles.json', 'utf8'));
        logResult('test-profiles.json is valid JSON', true);

        const hasProfiles = profileConfig.testProfiles && Object.keys(profileConfig.testProfiles).length > 0;
        logResult('test-profiles.json has test profiles', hasProfiles);

        const hasSmokeProfile = profileConfig.testProfiles.smoke !== undefined;
        logResult('test-profiles.json has smoke profile', hasSmokeProfile);

    } catch (error) {
        logResult('test-profiles.json is valid JSON', false, error.message);
    }

    // Validate package.json
    try {
        const packageConfig = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        logResult('package.json is valid JSON', true);

        const hasScripts = packageConfig.scripts && Object.keys(packageConfig.scripts).length > 0;
        logResult('package.json has NPM scripts', hasScripts);

        const hasTestScripts = packageConfig.scripts && Object.keys(packageConfig.scripts).some(script => script.includes('test'));
        logResult('package.json has test scripts', hasTestScripts);

    } catch (error) {
        logResult('package.json is valid JSON', false, error.message);
    }
}

/**
 * JavaScript syntax validation
 */
function validateJavaScriptSyntax() {
    log('\n🔍 Validating JavaScript Syntax', 'cyan');

    const jsFiles = [
        'config/k6-config.js',
        'utils/api-client.js',
        'utils/auth-helper.js',
        'utils/common-checks.js',
        'utils/data-generator.js'
    ];

    // Find all scenario files
    const scenarioFiles = [];
    try {
        const scenarioDirs = ['smoke', 'load', 'stress', 'spike', 'soak', 'volume'];
        scenarioDirs.forEach(dir => {
            const dirPath = path.join('scenarios', dir);
            if (fs.existsSync(dirPath)) {
                const files = fs.readdirSync(dirPath)
                    .filter(file => file.endsWith('.js'))
                    .map(file => path.join(dirPath, file));
                scenarioFiles.push(...files);
            }
        });
    } catch (error) {
        logWarning('Scenario file discovery', error.message);
    }

    const allJsFiles = [...jsFiles, ...scenarioFiles];

    allJsFiles.forEach(file => {
        if (fs.existsSync(file)) {
            try {
                const content = fs.readFileSync(file, 'utf8');

                // Basic syntax checks
                const hasImports = content.includes('import ') || content.includes('require(');
                const hasExports = content.includes('export ') || content.includes('module.exports');
                const hasValidFunctions = content.includes('function') || content.includes('=>');

                // Check for K6 specific patterns
                const hasK6Patterns = content.includes('k6') || content.includes('check') || content.includes('sleep');

                logResult(`${file} has valid structure`, hasImports || hasExports || hasValidFunctions);

                if (file.includes('scenarios/')) {
                    logResult(`${file} has K6 patterns`, hasK6Patterns);
                }

            } catch (error) {
                logResult(`${file} is readable`, false, error.message);
            }
        } else {
            logResult(`${file} exists`, false);
        }
    });
}

/**
 * Script execution permissions validation
 */
function validateScriptPermissions() {
    log('\n🔐 Validating Script Permissions', 'cyan');

    const scripts = ['run-tests.sh', 'run-tests.bat'];

    scripts.forEach(script => {
        if (fs.existsSync(script)) {
            try {
                const stats = fs.statSync(script);
                const isExecutable = (stats.mode & parseInt('111', 8)) !== 0;

                if (script.endsWith('.sh')) {
                    logResult(`${script} is executable`, isExecutable);
                    if (!isExecutable) {
                        logWarning('Script permissions', `Run: chmod +x ${script}`);
                    }
                } else {
                    logResult(`${script} exists`, true);
                }
            } catch (error) {
                logResult(`${script} permissions check`, false, error.message);
            }
        }
    });
}

/**
 * Documentation validation
 */
function validateDocumentation() {
    log('\n📚 Validating Documentation', 'cyan');

    const docFiles = ['README.md', 'GETTING_STARTED.md'];

    docFiles.forEach(file => {
        if (fs.existsSync(file)) {
            try {
                const content = fs.readFileSync(file, 'utf8');
                const hasContent = content.length > 100;
                const hasHeadings = content.includes('#');
                const hasCodeBlocks = content.includes('```');

                logResult(`${file} has substantial content`, hasContent);
                logResult(`${file} has headings`, hasHeadings);
                logResult(`${file} has code examples`, hasCodeBlocks);

            } catch (error) {
                logResult(`${file} is readable`, false, error.message);
            }
        }
    });
}

/**
 * Generate summary report
 */
function generateSummary() {
    log('\n📊 Validation Summary', 'magenta');
    log('═'.repeat(50), 'magenta');

    const total = validationResults.passed + validationResults.failed;
    const successRate = total > 0 ? (validationResults.passed / total * 100).toFixed(1) : 0;

    log(`✅ Passed: ${validationResults.passed}`, 'green');
    log(`❌ Failed: ${validationResults.failed}`, 'red');
    log(`⚠️  Warnings: ${validationResults.warnings}`, 'yellow');
    log(`📈 Success Rate: ${successRate}%`, successRate > 90 ? 'green' : successRate > 70 ? 'yellow' : 'red');

    log('\n🎯 Readiness Assessment', 'cyan');
    if (validationResults.failed === 0) {
        log('🟢 READY: Load testing suite is ready for use!', 'green');
        log('Next steps:', 'bright');
        log('  1. Install K6: https://k6.io/docs/getting-started/installation/', 'blue');
        log('  2. Update credentials in config/environments.json', 'blue');
        log('  3. Run your first test: ./run-tests.sh smoke dev', 'blue');
    } else if (validationResults.failed <= 3) {
        log('🟡 MOSTLY READY: Fix a few issues before proceeding', 'yellow');
        log('Address the failed validations above, then re-run this script.', 'yellow');
    } else {
        log('🔴 NOT READY: Multiple issues need to be resolved', 'red');
        log('Review and fix the failed validations above.', 'red');
    }

    if (validationResults.warnings > 0) {
        log(`\n💡 ${validationResults.warnings} warnings detected - consider addressing them for optimal performance.`, 'yellow');
    }

    log('\n🔗 Helpful Resources', 'cyan');
    log('• K6 Documentation: https://k6.io/docs/', 'blue');
    log('• Load Testing Guide: https://k6.io/docs/testing-guides/', 'blue');
    log('• WeSign API Documentation: [Check internal docs]', 'blue');

    return validationResults.failed === 0;
}

/**
 * Main execution
 */
function main() {
    log('🚀 WeSign K6 Load Testing - Setup Validation', 'bright');
    log('=' .repeat(50), 'bright');

    validateFileStructure();
    validateConfiguration();
    validateJavaScriptSyntax();
    validateScriptPermissions();
    validateDocumentation();

    const isReady = generateSummary();

    // Exit with appropriate code
    process.exit(isReady ? 0 : 1);
}

// Run validation if this script is executed directly
if (require.main === module) {
    main();
}

module.exports = {
    validateFileStructure,
    validateConfiguration,
    validateJavaScriptSyntax,
    validateScriptPermissions,
    validateDocumentation,
    generateSummary
};