#!/usr/bin/env node

/**
 * AI Infrastructure Testing Script
 * 
 * This script validates all AI services and endpoints to ensure
 * the infrastructure is working correctly.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = process.env.AI_API_URL || 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api/ai`;

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

// Test results tracking
let testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  details: []
};

/**
 * Utility functions
 */
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName, status, details = '') {
  const statusColor = status === 'PASS' ? 'green' : 'red';
  const statusIcon = status === 'PASS' ? '✅' : '❌';
  
  log(`${statusIcon} ${testName}`, statusColor);
  if (details) {
    log(`   ${details}`, 'cyan');
  }
  
  testResults.total++;
  if (status === 'PASS') {
    testResults.passed++;
  } else {
    testResults.failed++;
  }
  
  testResults.details.push({
    name: testName,
    status,
    details,
    timestamp: new Date().toISOString()
  });
}

function logSection(title) {
  log(`\n${colors.bold}=== ${title} ===${colors.reset}`, 'cyan');
}

/**
 * Create mock test data
 */
function createMockFailure() {
  return {
    testId: "test-001",
    testName: "WeSign Login Test",
    failure: {
      dom: "<html><body><div id='login-form'><input type='email' id='email'/><input type='password' id='password'/><button id='submit-btn'>התחבר</button></div></body></html>",
      screenshot: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", // 1x1 transparent PNG
      consoleErrors: ["Error: Element not found: #login-button"],
      networkLogs: [],
      error: "Element selector failed",
      url: "https://devtest.comda.co.il/login",
      selector: "#login-button"
    },
    executionHistory: [
      {
        executionId: "exec-001",
        timestamp: new Date().toISOString(),
        duration: 15000,
        status: "failed",
        environment: "staging"
      }
    ],
    environmentData: {
      browser: "chrome",
      viewport: { width: 1920, height: 1080 }
    },
    userPreferences: {
      strategy: "balanced",
      learningMode: true,
      debugMode: false
    }
  };
}

function createMockPerformanceData() {
  return {
    metrics: {
      testExecutionTime: 15000,
      memoryCpuUsage: {
        memory: 256,
        cpu: 45
      },
      networkLatency: 800,
      renderingTime: 2500,
      domReadyTime: 1200,
      fullLoadTime: 3500,
      testId: "test-001",
      url: "https://devtest.comda.co.il",
      timestamp: new Date().toISOString()
    },
    environment: {
      browserType: "chrome",
      browserVersion: "120.0",
      viewport: {
        width: 1920,
        height: 1080
      },
      deviceType: "desktop",
      networkCondition: "fast",
      location: "local",
      os: "windows"
    },
    historicalData: []
  };
}

function createMockTestCase() {
  return {
    testCase: {
      testId: "test-001",
      testName: "WeSign Login Test",
      testPath: "/tests/login.spec.ts",
      testCode: `
describe('WeSign Login', () => {
  it('should login successfully', async () => {
    await page.goto('https://devtest.comda.co.il/login');
    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'password123');
    await page.click('#submit-btn');
    await expect(page).toHaveURL(/dashboard/);
  });
});
      `.trim(),
      testType: "e2e",
      lastModified: new Date().toISOString(),
      author: "qa-engineer",
      dependencies: ["@playwright/test", "axios"],
      assertions: [
        {
          type: "element_exists",
          selector: "#submit-btn",
          expected: true,
          description: "Submit button should exist",
          line: 6,
          confidence: 0.95
        },
        {
          type: "url_matches",
          expected: "/dashboard/",
          description: "Should redirect to dashboard",
          line: 7,
          confidence: 0.9
        }
      ],
      setupCode: "await page.goto('/login');",
      teardownCode: "await page.close();",
      tags: ["login", "authentication", "critical", "hebrew"],
      executionHistory: [
        {
          executionId: "exec-001",
          timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          duration: 15000,
          status: "passed",
          environment: "staging",
          performance: {
            memory: 256,
            cpu: 45,
            network: 800
          }
        },
        {
          executionId: "exec-002",
          timestamp: new Date(Date.now() - 43200000).toISOString(), // 12 hours ago
          duration: 18000,
          status: "failed",
          environment: "staging",
          errors: ["Element not found: #login-button"],
          performance: {
            memory: 280,
            cpu: 52,
            network: 950
          }
        },
        {
          executionId: "exec-003",
          timestamp: new Date().toISOString(),
          duration: 14000,
          status: "passed",
          environment: "staging",
          performance: {
            memory: 245,
            cpu: 41,
            network: 750
          }
        }
      ]
    }
  };
}

function createMockRAGQuery() {
  return {
    question: "איך אני יכול לשפר את הבדיקות שלי? כיצד לטפל בבעיות ביצועים?",
    userId: "user-123",
    sessionId: "session-456",
    testContext: {
      testId: "test-001",
      testName: "WeSign Login Test",
      failure: {
        error: "Element not found",
        selector: "#login-button"
      },
      url: "https://devtest.comda.co.il"
    },
    preferences: {
      language: "hebrew",
      detailLevel: "detailed",
      focusAreas: ["performance", "reliability", "maintainability"]
    }
  };
}

/**
 * Test functions
 */
async function testHealthCheck() {
  try {
    const response = await axios.get(`${API_BASE}/health`, {
      timeout: 10000
    });
    
    if (response.status === 200) {
      const health = response.data;
      const allServicesUp = health.overall;
      
      if (allServicesUp) {
        logTest(
          'Health Check - All Services',
          'PASS',
          `All ${Object.keys(health).filter(k => k !== 'overall' && k !== 'timestamp' && k !== 'details').length} AI services are operational`
        );
        
        // Log individual service status
        const services = ['healingOrchestrator', 'enhancedRAG', 'mlPatternLearning', 'visualHealingAI', 'predictiveAnalytics', 'performanceIntelligence', 'qualityAssessment'];
        services.forEach(service => {
          if (health[service]) {
            log(`   ✓ ${service}`, 'green');
          } else {
            log(`   ✗ ${service}`, 'red');
          }
        });
        
        return true;
      } else {
        logTest('Health Check - All Services', 'FAIL', 'Some services are not operational');
        return false;
      }
    } else {
      logTest('Health Check - All Services', 'FAIL', `HTTP ${response.status}`);
      return false;
    }
  } catch (error) {
    logTest('Health Check - All Services', 'FAIL', error.message);
    return false;
  }
}

async function testSelfHealing() {
  try {
    const mockData = createMockFailure();
    const response = await axios.post(`${API_BASE}/heal`, mockData, {
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.status === 200 && response.data.success) {
      const result = response.data.result;
      logTest(
        'Self-Healing AI',
        'PASS',
        `Strategy: ${result.strategy}, Confidence: ${result.confidence}%`
      );
      
      if (result.healedSelector) {
        log(`   🔧 Suggested fix: ${result.healedSelector}`, 'yellow');
      }
      if (result.reasoning) {
        log(`   💭 Reasoning: ${result.reasoning.substring(0, 100)}...`, 'cyan');
      }
      
      return true;
    } else {
      logTest('Self-Healing AI', 'FAIL', 'Invalid response structure');
      return false;
    }
  } catch (error) {
    logTest('Self-Healing AI', 'FAIL', error.message);
    return false;
  }
}

async function testRAGChat() {
  try {
    const mockQuery = createMockRAGQuery();
    const response = await axios.post(`${API_BASE}/chat`, mockQuery, {
      timeout: 20000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.status === 200 && response.data.success) {
      const result = response.data.response;
      logTest(
        'RAG Chat (Hebrew)',
        'PASS',
        `Response length: ${result.response?.length || 0} chars`
      );
      
      if (result.language) {
        log(`   🗣️ Language: ${result.language}`, 'yellow');
      }
      if (result.confidence) {
        log(`   📊 Confidence: ${result.confidence}%`, 'cyan');
      }
      
      return true;
    } else {
      logTest('RAG Chat (Hebrew)', 'FAIL', 'Invalid response structure');
      return false;
    }
  } catch (error) {
    logTest('RAG Chat (Hebrew)', 'FAIL', error.message);
    return false;
  }
}

async function testPerformanceAnalysis() {
  try {
    const mockData = createMockPerformanceData();
    const response = await axios.post(`${API_BASE}/analyze-performance`, mockData, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.status === 200 && response.data.success) {
      const analysis = response.data.analysis;
      logTest(
        'Performance Analysis',
        'PASS',
        `Score: ${analysis.performanceScore}, Bottlenecks: ${analysis.bottlenecks.length}, Recommendations: ${analysis.recommendations.length}`
      );
      
      if (analysis.bottlenecks.length > 0) {
        log(`   ⚠️ Critical bottlenecks found: ${analysis.bottlenecks.filter(b => b.severity === 'critical').length}`, 'yellow');
      }
      
      return true;
    } else {
      logTest('Performance Analysis', 'FAIL', 'Invalid response structure');
      return false;
    }
  } catch (error) {
    logTest('Performance Analysis', 'FAIL', error.message);
    return false;
  }
}

async function testPredictiveAnalytics() {
  try {
    const mockData = {
      testIds: ["test-001", "test-002", "test-003"],
      timeframe: {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
        end: new Date().toISOString()
      },
      analysisType: "failure_prediction"
    };
    
    const response = await axios.post(`${API_BASE}/predict`, mockData, {
      timeout: 20000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.status === 200 && response.data.success) {
      const result = response.data.result;
      logTest(
        'Predictive Analytics',
        'PASS',
        `Analysis type: ${response.data.analysisType}, Predictions: ${Array.isArray(result) ? result.length : 1}`
      );
      
      if (Array.isArray(result) && result.length > 0) {
        const highRisk = result.filter(r => r.riskLevel === 'high').length;
        if (highRisk > 0) {
          log(`   ⚠️ High-risk tests detected: ${highRisk}`, 'yellow');
        }
      }
      
      return true;
    } else {
      logTest('Predictive Analytics', 'FAIL', 'Invalid response structure');
      return false;
    }
  } catch (error) {
    logTest('Predictive Analytics', 'FAIL', error.message);
    return false;
  }
}

async function testQualityAssessment() {
  try {
    const mockData = createMockTestCase();
    const response = await axios.post(`${API_BASE}/assess-quality`, mockData, {
      timeout: 25000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.status === 200 && response.data.success) {
      const report = response.data.report;
      logTest(
        'Quality Assessment',
        'PASS',
        `Overall Score: ${report.overallScore}, Issues: ${report.issues.length}, Recommendations: ${report.recommendations.length}`
      );
      
      // Log quality metrics
      report.metrics.forEach(metric => {
        const emoji = metric.score >= 80 ? '🟢' : metric.score >= 60 ? '🟡' : '🔴';
        log(`   ${emoji} ${metric.name}: ${metric.score}%`, 'cyan');
      });
      
      const criticalIssues = report.issues.filter(i => i.severity === 'critical').length;
      if (criticalIssues > 0) {
        log(`   ❗ Critical issues: ${criticalIssues}`, 'red');
      }
      
      return true;
    } else {
      logTest('Quality Assessment', 'FAIL', 'Invalid response structure');
      return false;
    }
  } catch (error) {
    logTest('Quality Assessment', 'FAIL', error.message);
    return false;
  }
}

async function testTeamDashboard() {
  try {
    const mockData = {
      teamId: "qa-team-1",
      testCases: [
        createMockTestCase().testCase,
        {
          ...createMockTestCase().testCase,
          testId: "test-002",
          testName: "WeSign Document Upload",
          testType: "e2e"
        },
        {
          ...createMockTestCase().testCase,
          testId: "test-003",
          testName: "WeSign API Integration",
          testType: "integration"
        }
      ]
    };
    
    const response = await axios.post(`${API_BASE}/team-quality-dashboard`, mockData, {
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.status === 200 && response.data.success) {
      const dashboard = response.data.dashboard;
      logTest(
        'Team Quality Dashboard',
        'PASS',
        `Team: ${dashboard.teamId}, Tests: ${dashboard.overview.totalTests}, Avg Score: ${dashboard.overview.averageQualityScore}`
      );
      
      // Log quality distribution
      const dist = dashboard.qualityDistribution;
      log(`   📊 Quality Distribution: Excellent: ${dist.excellent}, Good: ${dist.good}, Average: ${dist.average}, Poor: ${dist.poor}`, 'cyan');
      
      if (dashboard.overview.criticalIssues > 0) {
        log(`   ⚠️ Critical issues across team: ${dashboard.overview.criticalIssues}`, 'yellow');
      }
      
      return true;
    } else {
      logTest('Team Quality Dashboard', 'FAIL', 'Invalid response structure');
      return false;
    }
  } catch (error) {
    logTest('Team Quality Dashboard', 'FAIL', error.message);
    return false;
  }
}

async function testInsightsEndpoints() {
  try {
    // Test general insights
    const insightsResponse = await axios.get(`${API_BASE}/insights`, {
      timeout: 10000
    });
    
    // Test quality insights
    const qualityInsightsResponse = await axios.get(`${API_BASE}/quality-insights`, {
      timeout: 10000
    });
    
    if (insightsResponse.status === 200 && insightsResponse.data.success &&
        qualityInsightsResponse.status === 200 && qualityInsightsResponse.data.success) {
      
      logTest(
        'Insights Endpoints',
        'PASS',
        'Both general and quality insights endpoints working'
      );
      
      const insights = insightsResponse.data.insights;
      if (insights.summary) {
        log(`   📈 Services Active: ${insights.summary.totalServicesActive}`, 'cyan');
        log(`   🎯 Health Score: ${insights.summary.overallHealthScore}%`, 'cyan');
      }
      
      return true;
    } else {
      logTest('Insights Endpoints', 'FAIL', 'One or both endpoints failed');
      return false;
    }
  } catch (error) {
    logTest('Insights Endpoints', 'FAIL', error.message);
    return false;
  }
}

async function testTrendAnalysis() {
  try {
    const mockData = {
      timeframe: {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
        end: new Date().toISOString()
      },
      analysisType: "trend_analysis"
    };
    
    const response = await axios.post(`${API_BASE}/predict`, mockData, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.status === 200 && response.data.success) {
      logTest(
        'Trend Analysis',
        'PASS',
        'Trend analysis completed successfully'
      );
      return true;
    } else {
      logTest('Trend Analysis', 'FAIL', 'Analysis failed');
      return false;
    }
  } catch (error) {
    logTest('Trend Analysis', 'FAIL', error.message);
    return false;
  }
}

async function testAnomalyDetection() {
  try {
    const mockData = {
      testIds: ["test-001"],
      analysisType: "anomaly_detection"
    };
    
    const response = await axios.post(`${API_BASE}/predict`, mockData, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.status === 200 && response.data.success) {
      logTest(
        'Anomaly Detection',
        'PASS',
        'Anomaly detection completed successfully'
      );
      return true;
    } else {
      logTest('Anomaly Detection', 'FAIL', 'Detection failed');
      return false;
    }
  } catch (error) {
    logTest('Anomaly Detection', 'FAIL', error.message);
    return false;
  }
}

async function testPerformanceReport() {
  try {
    const mockData = {
      timeframe: {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString()
      }
    };
    
    const response = await axios.post(`${API_BASE}/performance-report`, mockData, {
      timeout: 20000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.status === 200 && response.data.success) {
      const report = response.data.report;
      logTest(
        'Performance Report',
        'PASS',
        `Report generated with ${report.summary.totalTests} tests analyzed`
      );
      return true;
    } else {
      logTest('Performance Report', 'FAIL', 'Report generation failed');
      return false;
    }
  } catch (error) {
    logTest('Performance Report', 'FAIL', error.message);
    return false;
  }
}

/**
 * Main test execution
 */
async function runAllTests() {
  log('\n🤖 AI Infrastructure Testing Suite', 'bold');
  log('=========================================', 'cyan');
  log(`Testing against: ${API_BASE}`, 'blue');
  log(`Started at: ${new Date().toLocaleString()}`, 'blue');
  
  // Core service tests
  logSection('Core Service Health');
  const healthOk = await testHealthCheck();
  
  if (!healthOk) {
    log('\n❌ Health check failed. Skipping other tests.', 'red');
    return;
  }
  
  // Self-healing tests
  logSection('Self-Healing AI Tests');
  await testSelfHealing();
  
  // RAG and chat tests
  logSection('Conversational AI Tests');
  await testRAGChat();
  
  // Performance tests
  logSection('Performance Intelligence Tests');
  await testPerformanceAnalysis();
  await testPerformanceReport();
  
  // Predictive analytics tests
  logSection('Predictive Analytics Tests');
  await testPredictiveAnalytics();
  await testTrendAnalysis();
  await testAnomalyDetection();
  
  // Quality assessment tests
  logSection('Quality Assessment Tests');
  await testQualityAssessment();
  await testTeamDashboard();
  
  // Insights and monitoring tests
  logSection('Insights and Monitoring Tests');
  await testInsightsEndpoints();
  
  // Final results
  logSection('Test Results Summary');
  const passRate = ((testResults.passed / testResults.total) * 100).toFixed(1);
  
  log(`\nTests Passed: ${testResults.passed}/${testResults.total} (${passRate}%)`, 'green');
  
  if (testResults.failed > 0) {
    log(`Tests Failed: ${testResults.failed}`, 'red');
    log('\nFailed Tests:', 'red');
    testResults.details
      .filter(t => t.status === 'FAIL')
      .forEach(test => {
        log(`  ❌ ${test.name}: ${test.details}`, 'red');
      });
  }
  
  // Save detailed results to file
  const resultsFile = path.join(__dirname, 'ai-test-results.json');
  fs.writeFileSync(resultsFile, JSON.stringify({
    ...testResults,
    summary: {
      passRate: `${passRate}%`,
      timestamp: new Date().toISOString(),
      apiBase: API_BASE
    }
  }, null, 2));
  
  log(`\n📄 Detailed results saved to: ${resultsFile}`, 'blue');
  
  if (passRate >= 80) {
    log('\n🎉 AI Infrastructure is healthy and ready for production!', 'green');
  } else if (passRate >= 60) {
    log('\n⚠️ AI Infrastructure has some issues but is partially functional.', 'yellow');
  } else {
    log('\n🚨 AI Infrastructure has significant issues that need attention.', 'red');
  }
  
  return testResults;
}

// Execute tests if run directly
if (require.main === module) {
  runAllTests()
    .then(results => {
      process.exit(results.failed === 0 ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = {
  runAllTests,
  testResults
};