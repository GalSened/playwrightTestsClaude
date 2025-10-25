/**
 * TestIntelligenceAgent COM Integration
 * Enhances the existing TestIntelligenceAgent with COM context retrieval
 *
 * This file provides COM-enhanced methods that can be mixed into the
 * existing TestIntelligenceAgent without breaking changes.
 */

import { getCOMClient, EventType, Event } from '../com/COMClient';
import type { AgentTask, AgentResult, AgentContext } from '@/types/agents';
import { logger } from '@/utils/logger';

// Extended context with COM data
export interface COMEnhancedContext extends AgentContext {
  comContextPack?: {
    pack_id: string;
    items: Array<{
      event_id: string;
      content: string;
      score: number;
      metadata: Record<string, any>;
    }>;
    total_tokens: number;
    summary?: string;
  };
}

/**
 * COM Integration Mixin for TestIntelligenceAgent
 *
 * Usage:
 * 1. Import this class alongside TestIntelligenceAgent
 * 2. Use the provided methods to enhance tasks with historical context
 * 3. Automatically ingests task results for future retrieval
 */
export class TestIntelligenceAgentCOMIntegration {
  private comClient = getCOMClient();
  private project = 'WeSign';

  constructor() {
    // Monitor COM health
    this.comClient.on('health:degraded', () => {
      logger.warn('[TestIntelligenceAgent] COM service is unhealthy - operating without context');
    });

    this.comClient.on('health:recovered', () => {
      logger.info('[TestIntelligenceAgent] COM service recovered');
    });
  }

  /**
   * Enhance analyze-failures task with historical context
   */
  async enhanceFailureAnalysis(
    task: AgentTask,
    failures: any[]
  ): Promise<{ context: string; metadata: any }> {
    try {
      // Extract failure details for query
      const failureTypes = failures.map(f => f.errorMessage || f.error).join(' | ');
      const testIds = failures.map(f => f.testId || f.context?.testId).filter(Boolean);

      // Retrieve historical context from COM
      const contextPack = await this.comClient.retrieveContext({
        task: 'root_cause',
        project: this.project,
        branch: task.context.branch || 'main',
        inputs: {
          failures: failureTypes,
          test_ids: testIds,
          failure_count: failures.length
        },
        token_budget: 4096,
        event_types: [EventType.TEST_FAILURE, EventType.AGENT_ACTION, EventType.CODE_CHANGE],
        tags_include: ['flaky', 'regression', 'root-cause']
      });

      // Format context for LLM prompt
      const formattedContext = this.comClient.formatContextForLLM(contextPack);

      logger.info('[TestIntelligenceAgent] Retrieved COM context for failure analysis', {
        task_id: task.id,
        pack_id: contextPack.pack_id,
        items: contextPack.total_items,
        tokens: contextPack.total_tokens,
        utilization: `${(contextPack.utilization * 100).toFixed(1)}%`
      });

      return {
        context: formattedContext,
        metadata: {
          pack_id: contextPack.pack_id,
          total_items: contextPack.total_items,
          total_tokens: contextPack.total_tokens,
          summary: contextPack.summary
        }
      };
    } catch (error: any) {
      logger.warn('[TestIntelligenceAgent] Failed to retrieve COM context:', error.message);
      // Graceful degradation - return empty context
      return {
        context: '',
        metadata: { error: error.message, fallback: true }
      };
    }
  }

  /**
   * Enhance plan-execution task with historical test execution context
   */
  async enhanceExecutionPlanning(
    task: AgentTask,
    codeChanges: any
  ): Promise<{ context: string; metadata: any }> {
    try {
      const contextPack = await this.comClient.retrieveContext({
        task: 'regression_select',
        project: this.project,
        branch: task.context.branch || 'main',
        inputs: {
          code_changes: codeChanges,
          task: 'plan_execution'
        },
        token_budget: 3000,
        event_types: [EventType.TEST_EXECUTION, EventType.CODE_CHANGE, EventType.AGENT_ACTION],
        tags_include: ['execution-plan', 'smart-selection']
      });

      const formattedContext = this.comClient.formatContextForLLM(contextPack);

      logger.info('[TestIntelligenceAgent] Retrieved COM context for execution planning', {
        task_id: task.id,
        pack_id: contextPack.pack_id,
        items: contextPack.total_items
      });

      return {
        context: formattedContext,
        metadata: {
          pack_id: contextPack.pack_id,
          total_items: contextPack.total_items
        }
      };
    } catch (error: any) {
      logger.warn('[TestIntelligenceAgent] Failed to retrieve COM context:', error.message);
      return {
        context: '',
        metadata: { error: error.message, fallback: true }
      };
    }
  }

  /**
   * Enhance heal-selectors task with historical selector healing context
   */
  async enhanceSelectorHealing(
    task: AgentTask,
    brokenSelectors: any[]
  ): Promise<{ context: string; metadata: any }> {
    try {
      const selectorPatterns = brokenSelectors.map(s => s.selector).join(' | ');

      const contextPack = await this.comClient.retrieveContext({
        task: 'healing',
        project: this.project,
        branch: task.context.branch || 'main',
        inputs: {
          selectors: selectorPatterns,
          broken_count: brokenSelectors.length
        },
        token_budget: 3500,
        event_types: [EventType.AGENT_ACTION, EventType.TEST_FAILURE],
        tags_include: ['healing', 'selector-fix', 'healed']
      });

      const formattedContext = this.comClient.formatContextForLLM(contextPack);

      logger.info('[TestIntelligenceAgent] Retrieved COM context for selector healing', {
        task_id: task.id,
        pack_id: contextPack.pack_id,
        items: contextPack.total_items
      });

      return {
        context: formattedContext,
        metadata: {
          pack_id: contextPack.pack_id,
          total_items: contextPack.total_items
        }
      };
    } catch (error: any) {
      logger.warn('[TestIntelligenceAgent] Failed to retrieve COM context:', error.message);
      return {
        context: '',
        metadata: { error: error.message, fallback: true }
      };
    }
  }

  /**
   * Ingest task result as event for future context retrieval
   */
  async ingestTaskResult(task: AgentTask, result: AgentResult): Promise<void> {
    try {
      const importance = this.calculateImportance(result);
      const tags = this.extractTags(task, result);

      const event: Event = {
        id: `evt-test-intel-${task.id}`,
        type: this.mapTaskToEventType(task.type),
        project: this.project,
        branch: task.context.branch || 'main',
        source: 'TestIntelligenceAgent',
        importance,
        tags,
        data: {
          task_id: task.id,
          task_type: task.type,
          status: result.status,
          success: result.status === 'success',
          confidence: result.confidence,
          execution_time_ms: result.executionTime,
          recommendations: result.recommendations || [],
          ...result.data
        }
      };

      await this.comClient.ingestEvent(event);

      logger.info('[TestIntelligenceAgent] Ingested task result to COM', {
        task_id: task.id,
        event_id: event.id,
        importance,
        tags: tags.length
      });
    } catch (error: any) {
      logger.warn('[TestIntelligenceAgent] Failed to ingest task result:', error.message);
      // Don't throw - ingestion failure shouldn't break the task
    }
  }

  /**
   * Ingest test execution event (for real-time failure tracking)
   */
  async ingestTestExecution(testId: string, result: any): Promise<void> {
    try {
      const event: Event = {
        id: `evt-test-exec-${testId}-${Date.now()}`,
        type: result.status === 'failed' ? EventType.TEST_FAILURE : EventType.TEST_EXECUTION,
        project: this.project,
        source: 'TestIntelligenceAgent',
        importance: result.status === 'failed' ? 4.0 : 2.0,
        tags: this.getTestExecutionTags(result),
        data: {
          test_id: testId,
          test_name: result.testName,
          status: result.status,
          duration: result.duration,
          error: result.error,
          screenshot: result.screenshot,
          logs: result.logs
        }
      };

      await this.comClient.ingestEvent(event);

      logger.debug('[TestIntelligenceAgent] Ingested test execution to COM', {
        test_id: testId,
        event_id: event.id,
        status: result.status
      });
    } catch (error: any) {
      logger.warn('[TestIntelligenceAgent] Failed to ingest test execution:', error.message);
    }
  }

  // Helper methods

  private mapTaskToEventType(taskType: string): EventType {
    const typeMap: Record<string, EventType> = {
      'analyze-failures': EventType.AGENT_ACTION,
      'plan-execution': EventType.AGENT_ACTION,
      'heal-selectors': EventType.AGENT_ACTION,
      'execute-test': EventType.TEST_EXECUTION,
      'execute-suite': EventType.TEST_EXECUTION,
      'assess-quality': EventType.AGENT_ACTION
    };
    return typeMap[taskType] || EventType.AGENT_ACTION;
  }

  private calculateImportance(result: AgentResult): number {
    let importance = 1.0;

    // Failures are high importance
    if (result.status === 'error' || !result.success) {
      importance += 2.5;
    }

    // High confidence results are more important
    if (result.confidence && result.confidence > 0.8) {
      importance += 1.0;
    }

    // Results with recommendations are important
    if (result.recommendations && result.recommendations.length > 0) {
      importance += 0.5;
    }

    return Math.min(importance, 5.0);
  }

  private extractTags(task: AgentTask, result: AgentResult): string[] {
    const tags: string[] = [task.type];

    // Status tags
    if (result.success) {
      tags.push('success');
    } else {
      tags.push('failure');
    }

    // Confidence tags
    if (result.confidence) {
      if (result.confidence > 0.9) tags.push('high-confidence');
      else if (result.confidence < 0.5) tags.push('low-confidence');
    }

    // Task-specific tags
    if (task.type === 'analyze-failures') {
      tags.push('analysis', 'root-cause');
    } else if (task.type === 'heal-selectors') {
      tags.push('healing', 'selector-fix');
    } else if (task.type === 'plan-execution') {
      tags.push('execution-plan', 'smart-selection');
    }

    return tags;
  }

  private getTestExecutionTags(result: any): string[] {
    const tags: string[] = ['test-execution'];

    if (result.status === 'failed') {
      tags.push('failure', 'flaky');
    } else if (result.status === 'healed') {
      tags.push('healed', 'auto-fix');
    } else if (result.status === 'passed') {
      tags.push('success');
    }

    // WeSign-specific tags
    if (result.testName) {
      if (result.testName.includes('signing')) tags.push('signing-flow');
      if (result.testName.includes('payment')) tags.push('payment-flow');
      if (result.testName.includes('auth')) tags.push('authentication');
      if (result.testName.includes('hebrew') || result.testName.includes('bilingual')) {
        tags.push('bilingual');
      }
    }

    return tags;
  }

  /**
   * Check if COM service is healthy
   */
  async checkCOMHealth(): Promise<boolean> {
    try {
      const health = await this.comClient.checkHealth();
      return health.status === 'healthy';
    } catch {
      return false;
    }
  }

  /**
   * Get COM statistics for monitoring
   */
  async getCOMStats(): Promise<any> {
    try {
      return await this.comClient.getStats();
    } catch (error: any) {
      logger.warn('[TestIntelligenceAgent] Failed to get COM stats:', error.message);
      return null;
    }
  }
}

// Singleton instance for easy access
let comIntegrationInstance: TestIntelligenceAgentCOMIntegration | null = null;

export function getTestIntelligenceAgentCOMIntegration(): TestIntelligenceAgentCOMIntegration {
  if (!comIntegrationInstance) {
    comIntegrationInstance = new TestIntelligenceAgentCOMIntegration();
  }
  return comIntegrationInstance;
}
