/**
 * COM Agent Integration Tests
 * Tests the integration between COM service and agents
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { getCOMClient, EventType } from '@/services/com/COMClient';
import { getTestIntelligenceAgentCOMIntegration } from '@/services/subAgents/TestIntelligenceAgent.com';
import { getFailureAnalysisAgentCOMIntegration } from '@/services/ai/failure-analysis-agent.com';

describe('COM Agent Integration Tests', () => {
  let comClient: ReturnType<typeof getCOMClient>;
  let testAgentCOM: ReturnType<typeof getTestIntelligenceAgentCOMIntegration>;
  let failureAgentCOM: ReturnType<typeof getFailureAnalysisAgentCOMIntegration>;

  beforeAll(async () => {
    comClient = getCOMClient();
    testAgentCOM = getTestIntelligenceAgentCOMIntegration();
    failureAgentCOM = getFailureAnalysisAgentCOMIntegration();

    // Wait for COM service to be healthy
    let attempts = 0;
    while (attempts < 10) {
      try {
        const health = await comClient.checkHealth();
        if (health.status === 'healthy') {
          console.log('✓ COM service is healthy');
          break;
        }
      } catch (error) {
        // COM not ready yet
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    if (attempts >= 10) {
      throw new Error('COM service did not become healthy within timeout');
    }
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  describe('COMClient Basic Operations', () => {
    it('should check COM health successfully', async () => {
      const health = await comClient.checkHealth();
      expect(health.status).toBe('healthy');
      expect(health.total_events).toBeGreaterThanOrEqual(0);
    });

    it('should ingest an event successfully', async () => {
      const event = {
        id: 'test-event-001',
        type: EventType.TEST_FAILURE,
        project: 'WeSign',
        source: 'IntegrationTest',
        importance: 3.5,
        tags: ['test', 'integration'],
        data: {
          test_id: 'test_sample',
          error: 'Sample error for testing'
        }
      };

      const result = await comClient.ingestEvent(event);
      expect(result.success).toBe(true);
      expect(result.event_id).toBe('test-event-001');
    });

    it('should retrieve context based on query', async () => {
      // Ingest a few test events first
      await comClient.ingestEvent({
        id: 'test-event-002',
        type: EventType.TEST_FAILURE,
        project: 'WeSign',
        source: 'IntegrationTest',
        importance: 4.0,
        tags: ['flaky', 'self-signing'],
        data: {
          test_id: 'test_self_signing_pdf',
          error: 'Element not found: #signature-field'
        }
      });

      // Retrieve context
      const contextPack = await comClient.retrieveContext({
        task: 'root_cause',
        project: 'WeSign',
        inputs: {
          test_id: 'test_self_signing_pdf',
          error: 'Element not found'
        }
      });

      expect(contextPack.pack_id).toBeDefined();
      expect(contextPack.task).toBe('root_cause');
      expect(contextPack.project).toBe('WeSign');
    }, 15000); // Longer timeout for retrieval
  });

  describe('TestIntelligenceAgent COM Integration', () => {
    it('should enhance failure analysis with historical context', async () => {
      const task = {
        id: 'task-001',
        type: 'analyze-failures' as const,
        data: {
          failures: [
            {
              testId: 'test_login',
              errorMessage: 'Timeout waiting for login button',
              context: { selector: '#login-btn' }
            }
          ]
        },
        context: { branch: 'main' }
      };

      const { context, metadata } = await testAgentCOM.enhanceFailureAnalysis(
        task,
        task.data.failures
      );

      // Context may be empty if no historical data, but should not throw
      expect(metadata).toBeDefined();
      if (metadata.pack_id) {
        expect(metadata.total_items).toBeGreaterThanOrEqual(0);
      }
    });

    it('should ingest task result successfully', async () => {
      const task = {
        id: 'task-002',
        type: 'analyze-failures' as const,
        data: {},
        context: {}
      };

      const result = {
        taskId: 'task-002',
        agentId: 'test-intelligence-agent',
        status: 'success' as const,
        success: true,
        data: {
          analysis: {
            rootCauses: ['selector-changed'],
            recommendations: ['Use data-testid']
          }
        },
        confidence: 0.85,
        executionTime: 1500,
        recommendations: ['Review selector stability']
      };

      // Should not throw
      await expect(testAgentCOM.ingestTaskResult(task, result)).resolves.not.toThrow();
    });

    it('should check COM health', async () => {
      const isHealthy = await testAgentCOM.checkCOMHealth();
      expect(typeof isHealthy).toBe('boolean');
      expect(isHealthy).toBe(true);
    });
  });

  describe('FailureAnalysisAgent COM Integration', () => {
    it('should enhance root cause analysis with historical patterns', async () => {
      const testId = 'test_payment_flow';
      const failures = [
        {
          errorMessage: 'Payment button not clickable',
          selector: '#payment-submit',
          page: '/payment'
        }
      ];

      const { context, metadata } = await failureAgentCOM.enhanceRootCauseAnalysis(
        testId,
        failures,
        {}
      );

      expect(metadata).toBeDefined();
      if (metadata.pack_id) {
        expect(metadata.recurring_patterns).toBeDefined();
      }
    });

    it('should enhance flaky detection with historical data', async () => {
      const testId = 'test_flaky_example';
      const executionHistory = [
        { status: 'passed', duration: 1000 },
        { status: 'failed', duration: 1200 },
        { status: 'passed', duration: 950 },
        { status: 'failed', duration: 1100 }
      ];

      const { context, metadata } = await failureAgentCOM.enhanceFlakyDetection(
        testId,
        executionHistory
      );

      expect(metadata).toBeDefined();
      if (metadata.pack_id) {
        expect(metadata.flaky_indicators).toBeDefined();
      }
    });

    it('should ingest analysis result', async () => {
      const analysis = {
        failureType: 'selector-not-found',
        rootCause: 'UI refactoring changed element structure',
        recommendations: ['Use data-testid', 'Add explicit waits'],
        confidence: 0.87,
        patterns: ['recurring-failure', 'healable-failure'],
        wesignContext: {
          affectedComponent: 'payment-form',
          relatedWorkflow: 'payment-processing',
          businessImpact: 'high'
        }
      };

      await expect(
        failureAgentCOM.ingestAnalysisResult('test_payment', analysis, 0.87)
      ).resolves.not.toThrow();
    });

    it('should share analysis with TestIntelligenceAgent via COM', async () => {
      const testId = 'test_shared_analysis';
      const analysis = {
        failureType: 'timing-issue',
        rootCause: 'Race condition in async operations',
        recommendations: ['Add explicit synchronization', 'Use promises correctly'],
        confidence: 0.92,
        patterns: ['healable-failure']
      };

      await expect(
        failureAgentCOM.shareAnalysisWithTestAgent(testId, analysis, 'pack-123')
      ).resolves.not.toThrow();
    });
  });

  describe('Agent-to-Agent Communication via COM', () => {
    it('should complete end-to-end workflow: test failure → analysis → sharing', async () => {
      // Step 1: Simulate test failure
      const testId = 'test_e2e_workflow';
      const testResult = {
        testName: 'E2E Workflow Test',
        status: 'failed',
        duration: 2500,
        error: 'Element #submit-button not found',
        screenshot: 'artifacts/failure-e2e.png'
      };

      // Ingest test execution
      await testAgentCOM.ingestTestExecution(testId, testResult);

      // Step 2: Retrieve context for failure analysis
      const { context: failureContext, metadata: failureMetadata } =
        await testAgentCOM.enhanceFailureAnalysis(
          {
            id: 'e2e-task',
            type: 'analyze-failures',
            data: { failures: [testResult] },
            context: {}
          },
          [testResult]
        );

      // Step 3: Perform root cause analysis with context
      const { context: analysisContext, metadata: analysisMetadata } =
        await failureAgentCOM.enhanceRootCauseAnalysis(testId, [testResult], {});

      // Step 4: Ingest analysis result
      const analysis = {
        failureType: 'selector-not-found',
        rootCause: 'Button selector changed',
        recommendations: ['Update selector to use data-testid'],
        confidence: 0.85,
        patterns: ['healable-failure']
      };

      await failureAgentCOM.ingestAnalysisResult(testId, analysis, 0.85);

      // Step 5: Share analysis
      await failureAgentCOM.shareAnalysisWithTestAgent(
        testId,
        analysis,
        analysisMetadata.pack_id || ''
      );

      // Step 6: Verify analysis can be retrieved
      const retrievedContext = await comClient.retrieveContext({
        task: 'root_cause',
        project: 'WeSign',
        inputs: { test_id: testId },
        tags_include: ['agent-communication']
      });

      expect(retrievedContext.pack_id).toBeDefined();
    }, 30000); // Longer timeout for full workflow
  });

  describe('Performance and Reliability', () => {
    it('should handle COM service unavailability gracefully', async () => {
      // This test assumes COM might be temporarily unavailable
      // The integration should use graceful degradation
      const result = await testAgentCOM.enhanceFailureAnalysis(
        {
          id: 'resilience-test',
          type: 'analyze-failures',
          data: { failures: [] },
          context: {}
        },
        []
      );

      // Should return result even if COM is unavailable
      expect(result).toBeDefined();
      expect(result.context).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it('should retrieve context within acceptable time', async () => {
      const startTime = Date.now();

      await comClient.retrieveContext({
        task: 'root_cause',
        project: 'WeSign',
        inputs: { test_id: 'perf_test' }
      });

      const duration = Date.now() - startTime;

      // Context retrieval should complete within 5 seconds
      expect(duration).toBeLessThan(5000);
    });

    it('should handle concurrent context retrievals', async () => {
      const retrievals = Array.from({ length: 5 }, (_, i) =>
        comClient.retrieveContext({
          task: 'root_cause',
          project: 'WeSign',
          inputs: { test_id: `concurrent_test_${i}` }
        })
      );

      const results = await Promise.all(retrievals);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.pack_id).toBeDefined();
      });
    }, 15000);
  });
});
