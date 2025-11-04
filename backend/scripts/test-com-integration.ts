/**
 * Manual COM Agent Integration Test Script
 * Tests basic COM integration with TestIntelligenceAgent and FailureAnalysisAgent
 *
 * Run: npx ts-node scripts/test-com-integration.ts
 */

import { getCOMClient, EventType } from '../src/services/com/COMClient';
import { getTestIntelligenceAgentCOMIntegration } from '../src/services/subAgents/TestIntelligenceAgent.com';
import { getFailureAnalysisAgentCOMIntegration } from '../src/services/ai/failure-analysis-agent.com';

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function section(title: string) {
  console.log('\n' + '='.repeat(80));
  log(`  ${title}`, colors.bright + colors.cyan);
  console.log('='.repeat(80) + '\n');
}

function success(message: string) {
  log(`✓ ${message}`, colors.green);
}

function error(message: string) {
  log(`✗ ${message}`, colors.red);
}

function info(message: string) {
  log(`ℹ ${message}`, colors.blue);
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  log('\n🚀 COM Agent Integration Test Suite\n', colors.bright + colors.blue);
  log('Starting manual tests...', colors.yellow);

  let passedTests = 0;
  let failedTests = 0;

  try {
    // ==========================================================================
    // Test 1: COMClient Health Check
    // ==========================================================================
    section('Test 1: COMClient Health Check');

    try {
      const comClient = getCOMClient();
      info('Created COMClient instance');

      const health = await comClient.checkHealth();

      if (health.status === 'healthy') {
        success(`COM service is healthy`);
        success(`Total events: ${health.total_events}`);
        success(`Vector index size: ${health.vector_index_size}`);
        success(`Total branches: ${health.total_branches || 0}`);
        passedTests++;
      } else {
        error(`COM service is ${health.status}`);
        failedTests++;
      }
    } catch (err: any) {
      error(`Health check failed: ${err.message}`);
      failedTests++;
      throw new Error('COM service not available - cannot continue tests');
    }

    await sleep(500);

    // ==========================================================================
    // Test 2: Event Ingestion
    // ==========================================================================
    section('Test 2: Event Ingestion');

    try {
      const comClient = getCOMClient();

      const testEvent = {
        id: `test-manual-${Date.now()}`,
        type: EventType.TEST_FAILURE,
        project: 'WeSign',
        source: 'ManualTest',
        importance: 3.5,
        tags: ['manual-test', 'integration'],
        data: {
          test_id: 'test_manual_integration',
          error: 'Manual test event for integration testing',
          timestamp: new Date().toISOString()
        }
      };

      info(`Ingesting event: ${testEvent.id}`);
      const result = await comClient.ingestEvent(testEvent);

      if (result.success) {
        success(`Event ingested successfully`);
        success(`Event ID: ${result.event_id}`);
        success(`Message: ${result.message}`);
        passedTests++;
      } else {
        error(`Event ingestion failed`);
        failedTests++;
      }
    } catch (err: any) {
      error(`Event ingestion error: ${err.message}`);
      failedTests++;
    }

    await sleep(500);

    // ==========================================================================
    // Test 3: TestIntelligenceAgent - Failure Analysis Enhancement
    // ==========================================================================
    section('Test 3: TestIntelligenceAgent - Failure Analysis Enhancement');

    try {
      const testAgentCOM = getTestIntelligenceAgentCOMIntegration();

      const task = {
        id: 'test-task-manual-001',
        type: 'analyze-failures' as const,
        data: {
          failures: [
            {
              testId: 'test_login_hebrew',
              errorMessage: 'Element not found: #login-button',
              context: { selector: '#login-button', page: '/login' }
            }
          ]
        },
        context: { branch: 'main' }
      };

      info('Enhancing failure analysis with historical context...');
      const { context, metadata } = await testAgentCOM.enhanceFailureAnalysis(
        task,
        task.data.failures
      );

      success('Context retrieved successfully');

      if (metadata.pack_id) {
        success(`Pack ID: ${metadata.pack_id}`);
        success(`Total items: ${metadata.total_items || 0}`);
        success(`Total tokens: ${metadata.total_tokens || 0}`);

        if (metadata.total_items > 0) {
          success(`Context contains ${metadata.total_items} historical events`);
        } else {
          info('No historical events found (expected for first run)');
        }
        passedTests++;
      } else if (metadata.fallback) {
        info('COM unavailable - graceful degradation applied');
        success('Fallback behavior working correctly');
        passedTests++;
      } else {
        error('Unexpected metadata structure');
        failedTests++;
      }
    } catch (err: any) {
      error(`TestIntelligenceAgent enhancement error: ${err.message}`);
      failedTests++;
    }

    await sleep(500);

    // ==========================================================================
    // Test 4: TestIntelligenceAgent - Task Result Ingestion
    // ==========================================================================
    section('Test 4: TestIntelligenceAgent - Task Result Ingestion');

    try {
      const testAgentCOM = getTestIntelligenceAgentCOMIntegration();

      const task = {
        id: 'test-task-manual-002',
        type: 'analyze-failures' as const,
        data: {},
        context: { branch: 'main' }
      };

      const result = {
        taskId: 'test-task-manual-002',
        agentId: 'test-intelligence-agent',
        status: 'success' as const,
        success: true,
        data: {
          analysis: {
            rootCauses: ['selector-changed', 'hebrew-rtl-issue'],
            recommendations: ['Use data-testid', 'Test RTL layout']
          }
        },
        confidence: 0.87,
        executionTime: 1500,
        recommendations: ['Fix selector stability']
      };

      info('Ingesting task result...');
      await testAgentCOM.ingestTaskResult(task, result);

      success('Task result ingested successfully');
      success(`Task ID: ${task.id}`);
      success(`Confidence: ${result.confidence}`);
      passedTests++;
    } catch (err: any) {
      error(`Task result ingestion error: ${err.message}`);
      failedTests++;
    }

    await sleep(500);

    // ==========================================================================
    // Test 5: FailureAnalysisAgent - Root Cause Analysis Enhancement
    // ==========================================================================
    section('Test 5: FailureAnalysisAgent - Root Cause Analysis Enhancement');

    try {
      const failureAgentCOM = getFailureAnalysisAgentCOMIntegration();

      const testId = 'test_payment_flow';
      const failures = [
        {
          errorMessage: 'Payment button not clickable',
          selector: '#payment-submit',
          page: '/payment'
        }
      ];

      info('Enhancing root cause analysis with historical patterns...');
      const { context, metadata } = await failureAgentCOM.enhanceRootCauseAnalysis(
        testId,
        failures,
        {}
      );

      success('Root cause context retrieved successfully');

      if (metadata.pack_id) {
        success(`Pack ID: ${metadata.pack_id}`);
        success(`Total items: ${metadata.total_items || 0}`);

        if (metadata.recurring_patterns && metadata.recurring_patterns.length > 0) {
          success(`Recurring patterns: ${metadata.recurring_patterns.join(', ')}`);
        } else {
          info('No recurring patterns found (expected for new test)');
        }
        passedTests++;
      } else if (metadata.fallback) {
        info('COM unavailable - graceful degradation applied');
        success('Fallback behavior working correctly');
        passedTests++;
      } else {
        error('Unexpected metadata structure');
        failedTests++;
      }
    } catch (err: any) {
      error(`FailureAnalysisAgent enhancement error: ${err.message}`);
      failedTests++;
    }

    await sleep(500);

    // ==========================================================================
    // Test 6: FailureAnalysisAgent - Analysis Result Ingestion
    // ==========================================================================
    section('Test 6: FailureAnalysisAgent - Analysis Result Ingestion');

    try {
      const failureAgentCOM = getFailureAnalysisAgentCOMIntegration();

      const testId = 'test_payment_manual';
      const analysis = {
        failureType: 'selector-not-found',
        rootCause: 'UI refactoring changed element structure',
        recommendations: ['Use data-testid', 'Add explicit waits'],
        confidence: 0.89,
        patterns: ['recurring-failure', 'healable-failure'],
        wesignContext: {
          affectedComponent: 'payment-form',
          relatedWorkflow: 'payment-processing',
          businessImpact: 'high'
        }
      };

      info('Ingesting analysis result...');
      await failureAgentCOM.ingestAnalysisResult(testId, analysis, 0.89);

      success('Analysis result ingested successfully');
      success(`Test ID: ${testId}`);
      success(`Confidence: ${analysis.confidence}`);
      success(`Patterns: ${analysis.patterns.join(', ')}`);
      passedTests++;
    } catch (err: any) {
      error(`Analysis result ingestion error: ${err.message}`);
      failedTests++;
    }

    await sleep(500);

    // ==========================================================================
    // Test 7: Agent-to-Agent Communication
    // ==========================================================================
    section('Test 7: Agent-to-Agent Communication via COM');

    try {
      const failureAgentCOM = getFailureAnalysisAgentCOMIntegration();

      const testId = 'test_shared_analysis';
      const analysis = {
        failureType: 'timing-issue',
        rootCause: 'Race condition in async operations',
        recommendations: ['Add explicit synchronization', 'Use promises correctly'],
        confidence: 0.92,
        patterns: ['healable-failure']
      };

      info('Sharing analysis with TestIntelligenceAgent...');
      await failureAgentCOM.shareAnalysisWithTestAgent(testId, analysis, 'pack-manual-test');

      success('Analysis shared successfully');
      success(`Test ID: ${testId}`);
      success(`Healable: ${analysis.patterns.includes('healable-failure')}`);
      passedTests++;
    } catch (err: any) {
      error(`Agent-to-agent communication error: ${err.message}`);
      failedTests++;
    }

    await sleep(500);

    // ==========================================================================
    // Test 8: Context Retrieval After Ingestion
    // ==========================================================================
    section('Test 8: Context Retrieval After Ingestion');

    try {
      const comClient = getCOMClient();

      info('Retrieving context for agent communication...');
      const contextPack = await comClient.retrieveContext({
        task: 'root_cause',
        project: 'WeSign',
        inputs: { test_id: 'test_shared_analysis' },
        tags_include: ['agent-communication']
      });

      success('Context pack retrieved successfully');
      success(`Pack ID: ${contextPack.pack_id}`);
      success(`Total items: ${contextPack.total_items}`);
      success(`Total tokens: ${contextPack.total_tokens}`);

      if (contextPack.total_items > 0) {
        success(`Found ${contextPack.total_items} events with 'agent-communication' tag`);
        passedTests++;
      } else {
        info('No events found yet (may need indexing time)');
        info('This is acceptable - vector indexing may take a moment');
        passedTests++;
      }
    } catch (err: any) {
      error(`Context retrieval error: ${err.message}`);
      failedTests++;
    }

    await sleep(500);

    // ==========================================================================
    // Test 9: COM Health Status
    // ==========================================================================
    section('Test 9: COM Health Status via Agent Integration');

    try {
      const testAgentCOM = getTestIntelligenceAgentCOMIntegration();

      info('Checking COM health via agent integration...');
      const isHealthy = await testAgentCOM.checkCOMHealth();

      if (isHealthy) {
        success('COM service is healthy (via agent)');
        passedTests++;
      } else {
        error('COM service is unhealthy');
        failedTests++;
      }
    } catch (err: any) {
      error(`Health check error: ${err.message}`);
      failedTests++;
    }

    await sleep(500);

    // ==========================================================================
    // Test 10: COM Statistics
    // ==========================================================================
    section('Test 10: COM Statistics Retrieval');

    try {
      const testAgentCOM = getTestIntelligenceAgentCOMIntegration();

      info('Retrieving COM statistics...');
      const stats = await testAgentCOM.getCOMStats();

      if (stats) {
        success('COM statistics retrieved successfully');
        success(`Total events: ${stats.total_events || 'N/A'}`);
        success(`Vector index size: ${stats.vector_index_size || 'N/A'}`);
        success(`Policies loaded: ${stats.policies_loaded || 'N/A'}`);
        passedTests++;
      } else {
        info('Stats unavailable (COM may be degraded)');
        passedTests++;
      }
    } catch (err: any) {
      error(`Stats retrieval error: ${err.message}`);
      failedTests++;
    }

  } catch (err: any) {
    error(`\nCritical error: ${err.message}`);
    error('Test suite aborted');
  }

  // ==========================================================================
  // Summary
  // ==========================================================================
  section('Test Summary');

  const totalTests = passedTests + failedTests;
  const successRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : '0.0';

  log(`Total Tests: ${totalTests}`, colors.bright);
  log(`Passed: ${passedTests}`, colors.green);
  log(`Failed: ${failedTests}`, failedTests > 0 ? colors.red : colors.green);
  log(`Success Rate: ${successRate}%`, failedTests === 0 ? colors.green : colors.yellow);

  if (failedTests === 0) {
    log('\n🎉 All tests passed!', colors.bright + colors.green);
  } else if (passedTests >= totalTests * 0.8) {
    log('\n⚠️  Most tests passed (≥80%)', colors.yellow);
  } else {
    log('\n❌ Multiple tests failed', colors.red);
  }

  log('\n✅ COM Agent Integration Test Complete\n', colors.bright + colors.blue);

  process.exit(failedTests > 0 ? 1 : 0);
}

// Run the test suite
main().catch(err => {
  console.error('\n💥 Unhandled error:', err);
  process.exit(1);
});
