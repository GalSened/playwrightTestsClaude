/**
 * COM Integration Example
 * Demonstrates how to enhance agents with COM context retrieval
 *
 * This file shows the pattern for integrating COM into existing agents
 */

import { COMClient, EventType, Event } from './COMClient';
import type { AgentTask, AgentResult, AgentContext } from '@/types/agents';

// =============================================================================
// Enhanced Agent Context with COM
// =============================================================================

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

// =============================================================================
// COM-Enhanced Agent Base Class
// =============================================================================

export abstract class COMEnhancedAgent {
  protected comClient: COMClient;
  protected project: string = 'WeSign';

  constructor(comClient?: COMClient) {
    this.comClient = comClient || new COMClient();

    // Listen to COM events
    this.comClient.on('context:retrieved', (data) => {
      console.log(`[${this.constructor.name}] Retrieved context for task: ${data.task}`);
    });

    this.comClient.on('event:ingested', (event) => {
      console.log(`[${this.constructor.name}] Ingested event: ${event.id}`);
    });
  }

  /**
   * Retrieve context from COM before executing task
   */
  protected async retrieveContextForTask(
    task: AgentTask,
    policyId?: string
  ): Promise<COMEnhancedContext> {
    try {
      // Map task type to COM retrieval request
      const contextPack = await this.comClient.retrieveContext({
        task: this._mapTaskToCOMTask(task.type),
        project: this.project,
        branch: task.context.branch || 'main',
        inputs: this._extractTaskInputs(task),
        policy_id: policyId
      });

      return {
        ...task.context,
        comContextPack: {
          pack_id: contextPack.pack_id,
          items: contextPack.items,
          total_tokens: contextPack.total_tokens,
          summary: contextPack.summary
        }
      };
    } catch (error: any) {
      console.error(`[${this.constructor.name}] Failed to retrieve COM context:`, error.message);
      // Return original context if COM retrieval fails (graceful degradation)
      return task.context;
    }
  }

  /**
   * Ingest task result as event for future context
   */
  protected async ingestTaskResult(task: AgentTask, result: AgentResult): Promise<void> {
    try {
      const event: Event = {
        id: `evt-${task.id}`,
        type: EventType.AGENT_ACTION,
        project: this.project,
        branch: task.context.branch || 'main',
        source: this.constructor.name,
        importance: this._calculateImportance(result),
        tags: this._extractTags(task, result),
        data: {
          task_id: task.id,
          task_type: task.type,
          success: result.success,
          execution_time_ms: result.metadata?.executionTime,
          ...result.data
        }
      };

      await this.comClient.ingestEvent(event);
    } catch (error: any) {
      console.error(`[${this.constructor.name}] Failed to ingest task result:`, error.message);
      // Don't throw - ingestion failure shouldn't break the task
    }
  }

  /**
   * Format COM context for LLM prompt
   */
  protected formatContextForPrompt(context: COMEnhancedContext): string {
    if (!context.comContextPack) {
      return '';
    }

    const sections: string[] = [];

    if (context.comContextPack.summary) {
      sections.push(`## Historical Context\n${context.comContextPack.summary}\n`);
    }

    sections.push(`## Relevant Past Events (${context.comContextPack.items.length} events):\n`);

    context.comContextPack.items.forEach((item, index) => {
      sections.push(`### Event ${index + 1} (relevance: ${item.score.toFixed(2)})`);
      sections.push(item.content);
      sections.push('');
    });

    return sections.join('\n');
  }

  // Helper methods
  private _mapTaskToCOMTask(taskType: string): string {
    const taskMap: Record<string, string> = {
      'analyze-failures': 'root_cause',
      'root-cause-analysis': 'root_cause',
      'plan-execution': 'regression_select',
      'assess-quality': 'code_review',
      'heal-selectors': 'healing',
      'smart-execution': 'flaky_triage'
    };
    return taskMap[taskType] || 'code_review';
  }

  private _extractTaskInputs(task: AgentTask): Record<string, any> {
    return {
      ...task.data,
      task_id: task.id,
      priority: task.priority
    };
  }

  private _calculateImportance(result: AgentResult): number {
    // Base importance
    let importance = 1.0;

    // High importance for failures
    if (!result.success) {
      importance += 2.0;
    }

    // High importance for high confidence results
    if (result.confidence && result.confidence > 0.8) {
      importance += 1.0;
    }

    // High importance for errors
    if (result.errors && result.errors.length > 0) {
      importance += 1.5;
    }

    return Math.min(importance, 5.0);
  }

  private _extractTags(task: AgentTask, result: AgentResult): string[] {
    const tags: string[] = [];

    // Task type tag
    tags.push(task.type);

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
      tags.push('analysis');
    } else if (task.type === 'heal-selectors') {
      tags.push('healing');
    }

    return tags;
  }
}

// =============================================================================
// Example: COM-Enhanced Test Intelligence Agent Pattern
// =============================================================================

export class ExampleCOMEnhancedTestAgent extends COMEnhancedAgent {
  async executeWithCOM(task: AgentTask): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      // 1. Retrieve context from COM
      const enhancedContext = await this.retrieveContextForTask(task, 'qa_code_review_py');

      // 2. Use context in task execution
      const result = await this._executeWithContext(task, enhancedContext);

      // 3. Ingest result for future context
      await this.ingestTaskResult(task, result);

      // 4. Return result
      return result;
    } catch (error: any) {
      return {
        success: false,
        taskId: task.id,
        agentId: 'example-com-agent',
        errors: [error.message],
        metadata: {
          executionTime: Date.now() - startTime
        }
      };
    }
  }

  private async _executeWithContext(
    task: AgentTask,
    context: COMEnhancedContext
  ): Promise<AgentResult> {
    // Example: Use context in LLM prompt
    const contextPrompt = this.formatContextForPrompt(context);

    const prompt = `
${contextPrompt}

## Current Task
Type: ${task.type}
Data: ${JSON.stringify(task.data, null, 2)}

Please analyze the current task considering the historical context above.
`;

    // Execute task with context-aware prompt
    // (Implementation depends on specific agent logic)

    return {
      success: true,
      taskId: task.id,
      agentId: 'example-com-agent',
      data: {
        result: 'Task completed with COM context',
        context_items_used: context.comContextPack?.items.length || 0
      }
    };
  }
}

// =============================================================================
// Agent-to-Agent Communication with COM
// =============================================================================

export class AgentCommunicationExample {
  private comClient: COMClient;

  constructor(comClient?: COMClient) {
    this.comClient = comClient || new COMClient();
  }

  /**
   * Example: Agent A sends message to Agent B with shared context
   */
  async sendMessageWithContext(
    fromAgent: string,
    toAgent: string,
    message: any,
    contextPackId?: string
  ): Promise<void> {
    // 1. Ingest communication event
    const event: Event = {
      id: `evt-comm-${Date.now()}`,
      type: EventType.AGENT_ACTION,
      project: 'WeSign',
      source: fromAgent,
      importance: 2.0,
      tags: ['agent-communication', toAgent],
      data: {
        from: fromAgent,
        to: toAgent,
        message,
        context_pack_id: contextPackId
      }
    };

    await this.comClient.ingestEvent(event);

    // 2. Agent B can retrieve this event when processing the message
    // The context pack ID allows Agent B to access the same context Agent A used
  }

  /**
   * Example: Agent retrieves messages sent to it
   */
  async receiveMessages(agentName: string): Promise<any[]> {
    // Query recent events tagged with agent name
    // (This would need a query endpoint in COM API)
    // For now, this is a conceptual example

    return [];
  }
}

// =============================================================================
// Workflow Example: Flaky Test Triage with COM
// =============================================================================

export async function exampleFlakyTriageWorkflow(comClient: COMClient): Promise<void> {
  console.log('=== Flaky Test Triage Workflow with COM ===\n');

  // 1. Ingest test failure event
  const failureEvent: Event = {
    id: 'evt-test-failure-001',
    type: EventType.TEST_FAILURE,
    project: 'WeSign',
    source: 'TestRunner',
    importance: 4.0,
    tags: ['flaky', 'self-signing'],
    data: {
      test_id: 'test_self_signing_pdf',
      error: 'Element not found: #signature-field',
      screenshot: 'artifacts/failure-001.png',
      retry_count: 3
    }
  };

  await comClient.ingestEvent(failureEvent);
  console.log('✓ Ingested test failure event\n');

  // 2. Retrieve context for flaky triage
  const contextPack = await comClient.retrieveContext({
    task: 'flaky_triage',
    project: 'WeSign',
    inputs: {
      test_id: 'test_self_signing_pdf',
      error: 'Element not found'
    },
    policy_id: 'qa_flaky_triage'
  });

  console.log(`✓ Retrieved context pack: ${contextPack.pack_id}`);
  console.log(`  - Items: ${contextPack.total_items}`);
  console.log(`  - Tokens: ${contextPack.total_tokens}`);
  console.log(`  - Summary: ${contextPack.summary}\n`);

  // 3. Analyze with context
  const analysis = {
    is_flaky: true,
    confidence: 0.87,
    pattern: 'Timing-dependent element rendering',
    suggested_fix: 'Add explicit wait for #signature-field',
    evidence: contextPack.items.map((i) => i.event_id)
  };

  // 4. Ingest analysis result
  const analysisEvent: Event = {
    id: 'evt-analysis-001',
    type: EventType.AGENT_ACTION,
    project: 'WeSign',
    source: 'FailureAnalysisAgent',
    importance: 4.5,
    tags: ['flaky-analysis', 'root-cause'],
    data: analysis
  };

  await comClient.ingestEvent(analysisEvent);
  console.log('✓ Ingested analysis result\n');

  console.log('=== Workflow Complete ===');
}
