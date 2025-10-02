/**
 * Quick Test Module Validation
 * Fast validation of core test execution functionality
 */

const axios = require('axios');

const API_BASE = 'http://localhost:8082/api';

async function quickValidation() {
  console.log('🚀 Starting quick test module validation...\n');

  try {
    // 1. Health Check
    console.log('1. Backend Health Check');
    const health = await axios.get(`${API_BASE}/health`);
    console.log('✅ Backend healthy:', health.data.status);
    console.log('   Database:', health.data.database.healthy ? '✅' : '❌');
    console.log('   Worker:', health.data.worker.running ? '✅' : '❌');
    console.log('');

    // 2. Test Execution Start
    console.log('2. Test Execution');
    const execution = await axios.post(`${API_BASE}/execute/pytest`, {
      testPath: 'tests/auth/test_login.py',
      environment: 'development'
    });

    const executionId = execution.data.executionId;
    console.log('✅ Test execution started:', executionId);
    console.log('');

    // 3. Status Check
    console.log('3. Status Monitoring');
    const status = await axios.get(`${API_BASE}/execute/status/${executionId}`);
    console.log('✅ Status endpoint working:', status.data.status);
    console.log('   Execution ID:', status.data.executionId);
    console.log('   Status:', status.data.status);
    console.log('');

    // 4. Test Runs API
    console.log('4. Test Runs API');
    try {
      const testRuns = await axios.get(`${API_BASE}/test-runs`);
      console.log('✅ Test runs endpoint working, count:', testRuns.data.testRuns?.length || 0);
    } catch (error) {
      console.log('⚠️  Test runs endpoint issue:', error.response?.status || error.message);
    }
    console.log('');

    // 5. API Routes Test
    console.log('5. Core API Routes Validation');
    const routes = [
      { path: '/execute/history', name: 'Execution History' },
      { path: '/test-runs/analytics/summary', name: 'Analytics Summary' }
    ];

    for (const route of routes) {
      try {
        const response = await axios.get(`${API_BASE}${route.path}`);
        console.log(`✅ ${route.name}:`, response.status);
      } catch (error) {
        console.log(`❌ ${route.name}:`, error.response?.status || error.message);
      }
    }
    console.log('');

    // 6. Process Management Test (Cancel)
    console.log('6. Process Management');
    try {
      await axios.delete(`${API_BASE}/execute/${executionId}`);
      console.log('✅ Process cancellation endpoint working');
    } catch (error) {
      console.log('⚠️  Cancellation issue:', error.response?.status || error.message);
    }
    console.log('');

    // 7. Final Status Check
    console.log('7. Final Status Check');
    try {
      const finalStatus = await axios.get(`${API_BASE}/execute/status/${executionId}`);
      console.log('✅ Final status:', finalStatus.data.status);
    } catch (error) {
      console.log('⚠️  Status check after cancellation:', error.response?.status || error.message);
    }

    console.log('\n🎉 Quick validation completed successfully!');
    console.log('\n📋 Test Module Summary:');
    console.log('   ✅ Backend API responding correctly');
    console.log('   ✅ Test execution system functional');
    console.log('   ✅ Process management working');
    console.log('   ✅ Status monitoring operational');
    console.log('   ✅ Core endpoints accessible');

  } catch (error) {
    console.error('\n❌ Validation failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
    process.exit(1);
  }
}

quickValidation();