/**
 * FailureAnalysisAgent COM Integration
 * Enhances the existing FailureAnalysisAgent with COM context retrieval
 *
 * This file provides COM-enhanced methods that can be mixed into the
 * existing FailureAnalysisAgent without breaking changes.
 */

import { getCOMClient, EventType, Event } from '../com/COMClient';
import type { AgentTask, AgentResult } from './agent-orchestrator';
import { logger } from '@/utils/logger';

/**
 * COM Integration Mixin for FailureAnalysisAgent
 *
 * Usage:
 * 1. Import this class alongside FailureAnalysisAgent
 * 2. Use the provided methods to enhance failure analysis with historical patterns
 * 3. Automatically ingests analysis results for future pattern detection
 */
export class FailureAnalysisAgentCOMIntegration {
  private comClient = getCOMClient();
  private project = 'WeSign';

  constructor() {
    // Monitor COM health
    this.comClient.on('health:degraded', () => {
      logger.warn('[FailureAnalysisAgent] COM service is unhealthy - operating without historical context');
    });

    this.comClient.on('health:recovered', () => {
      logger.info('[FailureAnalysisAgent] COM service recovered');
    });
  }

  /**
   * Enhance failure analysis with historical failure patterns from COM
   */
  async enhanceRootCauseAnalysis(
    testId: string,
    failures: any[],
    testContext: any
  ): Promise<{ context: string; metadata: any }> {
    try {
      // Extract failure characteristics for semantic search
      const errorMessages = failures.map(f => f.errorMessage || f.error || '').join(' | ');
      const selectors = failures.map(f => f.selector || f.context?.selector).filter(Boolean);
      const pageContext = failures.map(f => f.page || f.context?.page).filter(Boolean);

      // Retrieve historical failure patterns from COM
      const contextPack = await this.comClient.retrieveContext({
        task: 'root_cause',
        project: this.project,
        inputs: {
          test_id: testId,
          errors: errorMessages,
          selectors: selectors.join(', '),
          pages: pageContext.join(', '),
          failure_count: failures.length
        },
        query: `Root cause analysis for test failures: ${errorMessages}`,
        token_budget: 4096,
        event_types: [EventType.TEST_FAILURE, EventType.AGENT_ACTION, EventType.CODE_CHANGE],
        tags_include: ['flaky', 'regression', 'root-cause', 'recurring-failure']
      });

      // Format context for LLM prompt
      const formattedContext = this.comClient.formatContextForLLM(contextPack);

      logger.info('[FailureAnalysisAgent] Retrieved COM context for root cause analysis', {
        test_id: testId,
        pack_id: contextPack.pack_id,
        items: contextPack.total_items,
        tokens: contextPack.total_tokens,
        recurring_patterns: this.identifyRecurringPatterns(contextPack.items)
      });

      return {
        context: formattedContext,
        metadata: {
          pack_id: contextPack.pack_id,
          total_items: contextPack.total_items,
          total_tokens: contextPack.total_tokens,
          summary: contextPack.summary,
          recurring_patterns: this.identifyRecurringPatterns(contextPack.items)
        }
      };
    } catch (error: any) {
      logger.warn('[FailureAnalysisAgent] Failed to retrieve COM context:', error.message);
      // Graceful degradation
      return {
        context: '',
        metadata: { error: error.message, fallback: true }
      };
    }
  }

  /**
   * Enhance flaky test detection with historical flakiness patterns
   */
  async enhanceFlakyDetection(
    testId: string,
    executionHistory: any[]
  ): Promise<{ context: string; metadata: any }> {
    try {
      const contextPack = await this.comClient.retrieveContext({
        task: 'flaky_triage',
        project: this.project,
        inputs: {
          test_id: testId,
          execution_count: executionHistory.length,
          recent_failures: executionHistory.filter(e => e.status === 'failed').length
        },
        query: `Flaky test detection for ${testId}`,
        token_budget: 3000,
        event_types: [EventType.TEST_FAILURE, EventType.TEST_EXECUTION],
        tags_include: ['flaky', 'intermittent', 'timing']
      });

      const formattedContext = this.comClient.formatContextForLLM(contextPack);

      logger.info('[FailureAnalysisAgent] Retrieved COM context for flaky detection', {
        test_id: testId,
        pack_id: contextPack.pack_id,
        items: contextPack.total_items
      });

      return {
        context: formattedContext,
        metadata: {
          pack_id: contextPack.pack_id,
          total_items: contextPack.total_items,
          flaky_indicators: this.extractFlakyIndicators(contextPack.items)
        }
      };
    } catch (error: any) {
      logger.warn('[FailureAnalysisAgent] Failed to retrieve COM context:', error.message);
      return {
        context: '',
        metadata: { error: error.message, fallback: true }
      };
    }
  }

  /**
   * Get related failures across different tests (pattern detection)
   */
  async getRelatedFailurePatterns(
    failureSignature: string
  ): Promise<{ context: string; metadata: any }> {
    try {
      const contextPack = await this.comClient.retrieveContext({
        task: 'root_cause',
        project: this.project,
        inputs: {
          failure_signature: failureSignature
        },
        query: `Related failures with similar patterns: ${failureSignature}`,
        token_budget: 3500,
        event_types: [EventType.TEST_FAILURE, EventType.AGENT_ACTION],
        tags_include: ['pattern', 'recurring-failure']
      });

      const formattedContext = this.comClient.formatContextForLLM(contextPack);

      const patterns = this.groupByFailurePattern(contextPack.items);

      logger.info('[FailureAnalysisAgent] Retrieved related failure patterns', {
        query: failureSignature,
        pack_id: contextPack.pack_id,
        items: contextPack.total_items,
        unique_patterns: Object.keys(patterns).length
      });

      return {
        context: formattedContext,
        metadata: {
          pack_id: contextPack.pack_id,
          total_items: contextPack.total_items,
          patterns
        }
      };
    } catch (error: any) {
      logger.warn('[FailureAnalysisAgent] Failed to retrieve related patterns:', error.message);
      return {
        context: '',
        metadata: { error: error.message, fallback: true }
      };
    }
  }

  /**
   * Ingest failure analysis result as event for future retrieval
   */
  async ingestAnalysisResult(
    testId: string,
    analysis: any,
    confidence: number
  ): Promise<void> {
    try {
      const importance = this.calculateAnalysisImportance(analysis, confidence);
      const tags = this.getAnalysisTags(analysis);

      const event: Event = {
        id: `evt-failure-analysis-${testId}-${Date.now()}`,
        type: EventType.AGENT_ACTION,
        project: this.project,
        source: 'FailureAnalysisAgent',
        importance,
        tags,
        data: {
          test_id: testId,
          failure_type: analysis.failureType,
          root_cause: analysis.rootCause,
          recommendations: analysis.recommendations,
          confidence,
          patterns: analysis.patterns,
          wesign_context: analysis.wesignContext,
          timestamp: new Date().toISOString()
        }
      };

      await this.comClient.ingestEvent(event);

      logger.info('[FailureAnalysisAgent] Ingested analysis result to COM', {
        test_id: testId,
        event_id: event.id,
        importance,
        confidence,
        tags: tags.length
      });
    } catch (error: any) {
      logger.warn('[FailureAnalysisAgent] Failed to ingest analysis result:', error.message);
      // Don't throw - ingestion failure shouldn't break the analysis
    }
  }

  /**
   * Ingest pattern detection event (for recurring failure tracking)
   */
  async ingestPatternDetection(
    pattern: string,
    affectedTests: string[],
    metadata: any
  ): Promise<void> {
    try {
      const event: Event = {
        id: `evt-pattern-${Date.now()}`,
        type: EventType.AGENT_ACTION,
        project: this.project,
        source: 'FailureAnalysisAgent',
        importance: 4.5,
        tags: ['pattern', 'recurring-failure', 'cross-test'],
        data: {
          pattern_type: pattern,
          affected_tests: affectedTests,
          test_count: affectedTests.length,
          ...metadata
        }
      };

      await this.comClient.ingestEvent(event);

      logger.info('[FailureAnalysisAgent] Ingested pattern detection to COM', {
        pattern,
        affected_tests: affectedTests.length,
        event_id: event.id
      });
    } catch (error: any) {
      logger.warn('[FailureAnalysisAgent] Failed to ingest pattern detection:', error.message);
    }
  }

  /**
   * Share analysis with TestIntelligenceAgent via COM
   * (Agent-to-agent communication pattern)
   */
  async shareAnalysisWithTestAgent(
    testId: string,
    analysis: any,
    contextPackId: string
  ): Promise<void> {
    try {
      const event: Event = {
        id: `evt-agent-comm-${testId}-${Date.now()}`,
        type: EventType.AGENT_ACTION,
        project: this.project,
        source: 'FailureAnalysisAgent',
        importance: 3.5,
        tags: ['agent-communication', 'shared-analysis', 'test-intelligence-agent'],
        data: {
          from_agent: 'FailureAnalysisAgent',
          to_agent: 'TestIntelligenceAgent',
          test_id: testId,
          analysis_summary: {
            failure_type: analysis.failureType,
            root_cause: analysis.rootCause,
            confidence: analysis.confidence
          },
          context_pack_id: contextPackId,
          recommendations: analysis.recommendations,
          healable: analysis.patterns.includes('healable-failure')
        }
      };

      await this.comClient.ingestEvent(event);

      logger.info('[FailureAnalysisAgent] Shared analysis with TestIntelligenceAgent via COM', {
        test_id: testId,
        context_pack_id: contextPackId,
        healable: analysis.patterns.includes('healable-failure')
      });
    } catch (error: any) {
      logger.warn('[FailureAnalysisAgent] Failed to share analysis:', error.message);
    }
  }

  // Helper methods

  private identifyRecurringPatterns(items: any[]): string[] {
    const patterns = new Set<string>();

    items.forEach(item => {
      const metadata = item.metadata || {};
      if (metadata.tags) {
        metadata.tags.forEach((tag: string) => {
          if (tag.includes('pattern') || tag.includes('recurring')) {
            patterns.add(tag);
          }
        });
      }
    });

    return Array.from(patterns);
  }

  private extractFlakyIndicators(items: any[]): { [key: string]: number } {
    const indicators: { [key: string]: number } = {
      timing_issues: 0,
      network_issues: 0,
      dom_detached: 0,
      state_dependent: 0
    };

    items.forEach(item => {
      const content = (item.content || '').toLowerCase();
      if (content.includes('timeout') || content.includes('timing')) {
        indicators.timing_issues++;
      }
      if (content.includes('network') || content.includes('api')) {
        indicators.network_issues++;
      }
      if (content.includes('detached') || content.includes('stale')) {
        indicators.dom_detached++;
      }
      if (content.includes('state') || content.includes('order')) {
        indicators.state_dependent++;
      }
    });

    return indicators;
  }

  private groupByFailurePattern(items: any[]): { [key: string]: number } {
    const patterns: { [key: string]: number } = {};

    items.forEach(item => {
      const metadata = item.metadata || {};
      const type = metadata.type || 'unknown';

      if (!patterns[type]) {
        patterns[type] = 0;
      }
      patterns[type]++;
    });

    return patterns;
  }

  private calculateAnalysisImportance(analysis: any, confidence: number): number {
    let importance = 2.0;

    // High confidence increases importance
    if (confidence > 0.9) {
      importance += 2.0;
    } else if (confidence > 0.7) {
      importance += 1.0;
    }

    // Recurring patterns are highly important
    if (analysis.patterns && analysis.patterns.includes('recurring-failure')) {
      importance += 1.5;
    }

    // Healable failures are important for self-healing
    if (analysis.patterns && analysis.patterns.includes('healable-failure')) {
      importance += 0.5;
    }

    return Math.min(importance, 5.0);
  }

  private getAnalysisTags(analysis: any): string[] {
    const tags = ['failure-analysis', 'root-cause'];

    // Pattern tags
    if (analysis.patterns) {
      tags.push(...analysis.patterns);
    }

    // Failure type tags
    if (analysis.failureType) {
      tags.push(analysis.failureType.toLowerCase().replace(/\s+/g, '-'));
    }

    // WeSign-specific tags
    if (analysis.wesignContext) {
      if (analysis.wesignContext.affectedComponent) {
        tags.push(`component-${analysis.wesignContext.affectedComponent.toLowerCase()}`);
      }
      if (analysis.wesignContext.relatedWorkflow) {
        tags.push(`workflow-${analysis.wesignContext.relatedWorkflow.toLowerCase()}`);
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
      logger.warn('[FailureAnalysisAgent] Failed to get COM stats:', error.message);
      return null;
    }
  }
}

// Singleton instance for easy access
let comIntegrationInstance: FailureAnalysisAgentCOMIntegration | null = null;

export function getFailureAnalysisAgentCOMIntegration(): FailureAnalysisAgentCOMIntegration {
  if (!comIntegrationInstance) {
    comIntegrationInstance = new FailureAnalysisAgentCOMIntegration();
  }
  return comIntegrationInstance;
}
