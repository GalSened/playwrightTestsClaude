/**
 * WeSign Phase 2 Integration Testing Script
 * Tests all unified API endpoints with comprehensive validation
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:8082';
const UNIFIED_API_BASE = `${BASE_URL}/api/wesign/unified`;

// Test results storage
const testResults = {
  priority1: [],
  priority2: [],
  priority3: [],
  performance: {},
  summary: {
    total: 0,
    passed: 0,
    failed: 0
  }
};

// Helper functions
function logTest(priority, endpoint, status, response, duration, error = null) {
  const result = {
    endpoint,
    status,
    duration,
    responseSize: JSON.stringify(response).length,
    timestamp: new Date(),
    error
  };

  testResults[priority].push(result);
  testResults.summary.total++;

  if (status === 'PASS') {
    testResults.summary.passed++;
    console.log(`✅ ${priority.toUpperCase()} - ${endpoint}: ${duration}ms`);
  } else {
    testResults.summary.failed++;
    console.log(`❌ ${priority.toUpperCase()} - ${endpoint}: ${error || 'Failed'}`);
  }
}

function createTestData() {
  return {
    basicExecutionConfig: {
      framework: 'wesign',
      mode: 'parallel',
      workers: 2,
      timeout: 300000,
      browser: 'chromium',
      headless: true,
      testIds: ['test_001', 'test_002'],
      aiEnabled: true,
      realTimeMonitoring: true
    },
    scheduleConfig: {
      name: 'Phase 2 Test Schedule',
      description: 'Integration test schedule for Phase 2',
      cronExpression: '0 0 * * *', // Daily at midnight
      testConfig: {
        framework: 'wesign',
        testIds: ['test_001']
      },
      priority: 'normal',
      enabled: true
    }
  };
}

async function makeRequest(method, endpoint, data = null) {
  const start = Date.now();
  try {
    const config = {
      method,
      url: `${UNIFIED_API_BASE}${endpoint}`,
      timeout: 30000
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      config.data = data;
      config.headers = { 'Content-Type': 'application/json' };
    }

    const response = await axios(config);
    const duration = Date.now() - start;

    return {
      status: 'PASS',
      response: response.data,
      duration,
      httpStatus: response.status
    };
  } catch (error) {
    const duration = Date.now() - start;
    return {
      status: 'FAIL',
      response: error.response?.data || null,
      duration,
      httpStatus: error.response?.status || 0,
      error: error.message
    };
  }
}

// Priority 1 Tests - Core Phase 2 Features
async function testPriority1() {
  console.log('\n🔵 PRIORITY 1 - Core Phase 2 Features');
  console.log('=====================================');

  const testData = createTestData();
  let executionId = null;

  // 1. POST /api/wesign/unified/execute
  console.log('\n1. Testing unified execute endpoint...');
  const executeTest = await makeRequest('POST', '/execute', testData.basicExecutionConfig);
  logTest('priority1', 'POST /execute', executeTest.status, executeTest.response, executeTest.duration, executeTest.error);

  if (executeTest.status === 'PASS' && executeTest.response.executionId) {
    executionId = executeTest.response.executionId;
    console.log(`   Execution ID: ${executionId}`);
  }

  // Wait a moment for execution to start
  if (executionId) {
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // 2. GET /api/wesign/unified/execute/{id}/status
  console.log('\n2. Testing execution status endpoint...');
  const endpoint = executionId ? `/execute/${executionId}/status` : '/execute/test-id/status';
  const statusTest = await makeRequest('GET', endpoint);
  logTest('priority1', 'GET /execute/:id/status', statusTest.status, statusTest.response, statusTest.duration, statusTest.error);

  // 3. POST /api/wesign/unified/execute/{id}/cancel
  console.log('\n3. Testing execution cancel endpoint...');
  const cancelEndpoint = executionId ? `/execute/${executionId}/cancel` : '/execute/test-id/cancel';
  const cancelTest = await makeRequest('POST', cancelEndpoint);
  logTest('priority1', 'POST /execute/:id/cancel', cancelTest.status, cancelTest.response, cancelTest.duration, cancelTest.error);

  // 4. GET /api/wesign/unified/queue/status
  console.log('\n4. Testing queue status endpoint...');
  const queueTest = await makeRequest('GET', '/queue/status');
  logTest('priority1', 'GET /queue/status', queueTest.status, queueTest.response, queueTest.duration, queueTest.error);

  // 5. GET /api/wesign/unified/execute/{id}/artifacts
  console.log('\n5. Testing execution artifacts endpoint...');
  const artifactsEndpoint = executionId ? `/execute/${executionId}/artifacts` : '/execute/test-id/artifacts';
  const artifactsTest = await makeRequest('GET', artifactsEndpoint);
  logTest('priority1', 'GET /execute/:id/artifacts', artifactsTest.status, artifactsTest.response, artifactsTest.duration, artifactsTest.error);
}

// Priority 2 Tests - Scheduling Features
async function testPriority2() {
  console.log('\n🟡 PRIORITY 2 - Scheduling Features');
  console.log('===================================');

  const testData = createTestData();
  let scheduleId = null;

  // 6. POST /api/wesign/unified/schedule
  console.log('\n6. Testing create schedule endpoint...');
  const createScheduleTest = await makeRequest('POST', '/schedule', testData.scheduleConfig);
  logTest('priority2', 'POST /schedule', createScheduleTest.status, createScheduleTest.response, createScheduleTest.duration, createScheduleTest.error);

  if (createScheduleTest.status === 'PASS' && createScheduleTest.response.scheduleId) {
    scheduleId = createScheduleTest.response.scheduleId;
    console.log(`   Schedule ID: ${scheduleId}`);
  }

  // 7. GET /api/wesign/unified/schedules
  console.log('\n7. Testing list schedules endpoint...');
  const listSchedulesTest = await makeRequest('GET', '/schedules');
  logTest('priority2', 'GET /schedules', listSchedulesTest.status, listSchedulesTest.response, listSchedulesTest.duration, listSchedulesTest.error);

  // 8. PUT /api/wesign/unified/schedule/{id}
  console.log('\n8. Testing update schedule endpoint...');
  const updateData = { ...testData.scheduleConfig, description: 'Updated description for integration test' };
  const updateEndpoint = scheduleId ? `/schedule/${scheduleId}` : '/schedule/test-schedule-id';
  const updateScheduleTest = await makeRequest('PUT', updateEndpoint, updateData);
  logTest('priority2', 'PUT /schedule/:id', updateScheduleTest.status, updateScheduleTest.response, updateScheduleTest.duration, updateScheduleTest.error);

  // 9. DELETE /api/wesign/unified/schedule/{id}
  console.log('\n9. Testing delete schedule endpoint...');
  const deleteEndpoint = scheduleId ? `/schedule/${scheduleId}` : '/schedule/test-schedule-id';
  const deleteScheduleTest = await makeRequest('DELETE', deleteEndpoint);
  logTest('priority2', 'DELETE /schedule/:id', deleteScheduleTest.status, deleteScheduleTest.response, deleteScheduleTest.duration, deleteScheduleTest.error);
}

// Priority 3 Tests - Enhanced Health
async function testPriority3() {
  console.log('\n🟢 PRIORITY 3 - Enhanced Health');
  console.log('===============================');

  // 10. GET /api/wesign/unified/health
  console.log('\n10. Testing enhanced health endpoint...');
  const healthTest = await makeRequest('GET', '/health');
  logTest('priority3', 'GET /health', healthTest.status, healthTest.response, healthTest.duration, healthTest.error);

  // Additional health-related endpoints
  console.log('\n10b. Testing stats endpoint...');
  const statsTest = await makeRequest('GET', '/stats');
  logTest('priority3', 'GET /stats', statsTest.status, statsTest.response, statsTest.duration, statsTest.error);
}

// Performance Analysis
async function performanceAnalysis() {
  console.log('\n⚡ PERFORMANCE ANALYSIS');
  console.log('======================');

  const allTests = [...testResults.priority1, ...testResults.priority2, ...testResults.priority3];

  const performanceMetrics = {
    averageResponseTime: allTests.reduce((sum, test) => sum + test.duration, 0) / allTests.length,
    fastestEndpoint: allTests.reduce((fastest, test) => test.duration < fastest.duration ? test : fastest),
    slowestEndpoint: allTests.reduce((slowest, test) => test.duration > slowest.duration ? test : slowest),
    under200ms: allTests.filter(test => test.duration < 200).length,
    under500ms: allTests.filter(test => test.duration < 500).length,
    over1000ms: allTests.filter(test => test.duration > 1000).length,
    totalDataTransfer: allTests.reduce((sum, test) => sum + test.responseSize, 0)
  };

  testResults.performance = performanceMetrics;

  console.log(`📊 Average Response Time: ${performanceMetrics.averageResponseTime.toFixed(2)}ms`);
  console.log(`⚡ Fastest: ${performanceMetrics.fastestEndpoint.endpoint} (${performanceMetrics.fastestEndpoint.duration}ms)`);
  console.log(`🐌 Slowest: ${performanceMetrics.slowestEndpoint.endpoint} (${performanceMetrics.slowestEndpoint.duration}ms)`);
  console.log(`✅ Under 200ms: ${performanceMetrics.under200ms}/${allTests.length}`);
  console.log(`✅ Under 500ms: ${performanceMetrics.under500ms}/${allTests.length}`);
  console.log(`❌ Over 1000ms: ${performanceMetrics.over1000ms}/${allTests.length}`);
  console.log(`📦 Total Data Transfer: ${(performanceMetrics.totalDataTransfer / 1024).toFixed(2)}KB`);
}

// Generate comprehensive report
function generateReport() {
  console.log('\n📋 COMPREHENSIVE TEST REPORT');
  console.log('=============================');

  const successRate = (testResults.summary.passed / testResults.summary.total * 100).toFixed(2);

  console.log(`\n📈 SUMMARY`);
  console.log(`Total Tests: ${testResults.summary.total}`);
  console.log(`Passed: ${testResults.summary.passed}`);
  console.log(`Failed: ${testResults.summary.failed}`);
  console.log(`Success Rate: ${successRate}%`);

  console.log(`\n🔵 PRIORITY 1 (Core Features): ${testResults.priority1.filter(t => t.status === 'PASS').length}/${testResults.priority1.length} passed`);
  console.log(`🟡 PRIORITY 2 (Scheduling): ${testResults.priority2.filter(t => t.status === 'PASS').length}/${testResults.priority2.length} passed`);
  console.log(`🟢 PRIORITY 3 (Enhanced Health): ${testResults.priority3.filter(t => t.status === 'PASS').length}/${testResults.priority3.length} passed`);

  // Failed tests details
  const failedTests = [...testResults.priority1, ...testResults.priority2, ...testResults.priority3]
    .filter(test => test.status === 'FAIL');

  if (failedTests.length > 0) {
    console.log(`\n❌ FAILED TESTS:`);
    failedTests.forEach(test => {
      console.log(`   • ${test.endpoint}: ${test.error}`);
    });
  }

  // Integration issues
  console.log(`\n🔗 INTEGRATION ASSESSMENT:`);
  const coreHealthy = testResults.priority1.filter(t => t.status === 'PASS').length >= 3;
  const schedulingHealthy = testResults.priority2.filter(t => t.status === 'PASS').length >= 2;
  const healthEndpointWorking = testResults.priority3.filter(t => t.status === 'PASS').length >= 1;

  console.log(`   Core Features: ${coreHealthy ? '✅ HEALTHY' : '❌ ISSUES'}`);
  console.log(`   Scheduling: ${schedulingHealthy ? '✅ HEALTHY' : '❌ ISSUES'}`);
  console.log(`   Health Monitoring: ${healthEndpointWorking ? '✅ HEALTHY' : '❌ ISSUES'}`);

  const overallHealth = coreHealthy && schedulingHealthy && healthEndpointWorking;
  console.log(`\n🎯 OVERALL PHASE 2 STATUS: ${overallHealth ? '✅ PRODUCTION READY' : '❌ NEEDS ATTENTION'}`);

  // Save detailed results to file
  const detailedReport = {
    timestamp: new Date(),
    summary: testResults.summary,
    performance: testResults.performance,
    tests: {
      priority1: testResults.priority1,
      priority2: testResults.priority2,
      priority3: testResults.priority3
    },
    assessment: {
      coreHealthy,
      schedulingHealthy,
      healthEndpointWorking,
      overallHealth,
      successRate: parseFloat(successRate)
    }
  };

  require('fs').writeFileSync('./phase2-test-results.json', JSON.stringify(detailedReport, null, 2));
  console.log(`\n💾 Detailed results saved to: phase2-test-results.json`);
}

// Main execution
async function runAllTests() {
  console.log('🚀 WeSign Phase 2 Integration Testing');
  console.log('=====================================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Unified API: ${UNIFIED_API_BASE}`);
  console.log(`Started at: ${new Date()}\n`);

  try {
    await testPriority1();
    await testPriority2();
    await testPriority3();
    await performanceAnalysis();
    generateReport();
  } catch (error) {
    console.error('\n💥 Test execution failed:', error);
    process.exit(1);
  }
}

// Run the tests
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  runAllTests,
  testResults
};