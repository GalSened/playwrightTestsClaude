#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Comprehensive Enterprise Test Suite');
console.log('=' .repeat(60));

const testCategories = [
  {
    name: 'Core Features',
    path: 'tests/core/',
    description: '311 Tests Management & Discovery'
  },
  {
    name: 'Scheduler',
    path: 'tests/scheduler/',
    description: 'Cron-based scheduling system'
  },
  {
    name: 'Real-time Monitoring',
    path: 'tests/monitoring/',
    description: 'WebSocket & live updates'
  },
  {
    name: 'Multi-tenant',
    path: 'tests/enterprise/multi-tenant.spec.ts',
    description: 'Enterprise tenant isolation'
  },
  {
    name: 'RBAC',
    path: 'tests/enterprise/rbac.spec.ts',
    description: 'Role-based access control'
  },
  {
    name: 'Execution Modes',
    path: 'tests/execution/',
    description: 'Parallel/Sequential execution'
  },
  {
    name: 'End-to-End Workflow',
    path: 'tests/e2e/',
    description: 'Complete enterprise workflow'
  },
  {
    name: 'Performance',
    path: 'tests/performance/',
    description: 'Load testing & optimization'
  },
  {
    name: 'Security',
    path: 'tests/security/',
    description: 'Security validations'
  }
];

const results = {};
let totalPassed = 0;
let totalFailed = 0;

async function runTestCategory(category) {
  console.log(`\n📋 Running ${category.name} Tests`);
  console.log(`   ${category.description}`);
  console.log('-'.repeat(50));
  
  try {
    const command = `npx playwright test ${category.path} --reporter=json`;
    const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    
    // Parse JSON output to get test results
    const jsonReport = JSON.parse(output);
    const passed = jsonReport.suites.reduce((acc, suite) => 
      acc + suite.specs.filter(spec => spec.tests.every(test => test.results.every(result => result.status === 'passed'))).length, 0
    );
    const failed = jsonReport.suites.reduce((acc, suite) => 
      acc + suite.specs.filter(spec => spec.tests.some(test => test.results.some(result => result.status === 'failed'))).length, 0
    );
    
    results[category.name] = { passed, failed, total: passed + failed };
    totalPassed += passed;
    totalFailed += failed;
    
    console.log(`✅ ${category.name}: ${passed}/${passed + failed} tests passed`);
    
  } catch (error) {
    console.log(`❌ ${category.name}: Tests failed to execute`);
    console.log(`   Error: ${error.message.split('\n')[0]}`);
    results[category.name] = { passed: 0, failed: 1, total: 1, error: true };
    totalFailed += 1;
  }
}

async function generateReport() {
  console.log('\n🎯 COMPREHENSIVE TEST RESULTS');
  console.log('=' .repeat(60));
  
  Object.entries(results).forEach(([category, result]) => {
    const status = result.error ? '❌ ERROR' : 
                   result.failed === 0 ? '✅ PASS' : 
                   result.passed > 0 ? '⚠️  PARTIAL' : '❌ FAIL';
    
    console.log(`${status} ${category.padEnd(25)} ${result.passed.toString().padStart(3)}/${result.total.toString().padEnd(3)} tests passed`);
  });
  
  console.log('-'.repeat(60));
  console.log(`📊 OVERALL SUMMARY:`);
  console.log(`   Total Tests: ${totalPassed + totalFailed}`);
  console.log(`   Passed: ${totalPassed}`);
  console.log(`   Failed: ${totalFailed}`);
  console.log(`   Success Rate: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`);
  
  // Generate detailed HTML report
  console.log('\n📄 Generating detailed HTML report...');
  execSync('npx playwright show-report', { stdio: 'inherit' });
}

async function checkPrerequisites() {
  console.log('🔍 Checking prerequisites...');
  
  // Check if the test management system is running
  try {
    execSync('curl -f http://localhost:3003', { stdio: 'pipe' });
    console.log('✅ Test management system is running on port 3003');
  } catch (error) {
    console.log('⚠️  Test management system not detected on port 3003');
    console.log('   Please start the system with: cd ../playwright-smart && npm run dev');
    process.exit(1);
  }
  
  // Check Playwright installation
  try {
    execSync('npx playwright --version', { stdio: 'pipe' });
    console.log('✅ Playwright is installed');
  } catch (error) {
    console.log('❌ Playwright not found. Installing...');
    execSync('npx playwright install', { stdio: 'inherit' });
  }
}

async function main() {
  await checkPrerequisites();
  
  console.log('\n🎬 Starting test execution...');
  
  for (const category of testCategories) {
    await runTestCategory(category);
  }
  
  await generateReport();
  
  if (totalFailed === 0) {
    console.log('\n🎉 All tests passed successfully!');
    process.exit(0);
  } else {
    console.log(`\n⚠️  ${totalFailed} test(s) failed. Check the detailed report above.`);
    process.exit(1);
  }
}

// Handle errors gracefully
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error.message);
  process.exit(1);
});

if (require.main === module) {
  main();
}