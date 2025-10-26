/**
 * COM Client - Backend integration with Context Orchestrator Management
 * Provides interface for agents to retrieve context and ingest events
 */

import axios, { AxiosInstance } from 'axios';
import { EventEmitter } from 'events';

// =============================================================================
// Types
// =============================================================================

export enum EventType {
  TEST_EXECUTION = 'test_execution',
  TEST_FAILURE = 'test_failure',
  CODE_CHANGE = 'code_change',
  DEPLOYMENT = 'deployment',
  AGENT_ACTION = 'agent_action',
  USER_ACTION = 'user_action',
  SYSTEM_EVENT = 'system_event'
}

export interface Event {
  id: string;
  type: EventType;
  timestamp?: string;
  project: string;
  branch?: string;
  data: Record<string, any>;
  importance?: number;
  tags?: string[];
  source: string;
  parent_id?: string;
  related_ids?: string[];
}

export interface RetrievalRequest {
  task: string;
  project: string;
  branch?: string;
  inputs?: Record<string, any>;
  query?: string;
  policy_id?: string;
  token_budget?: number;
  event_types?: EventType[];
  tags_include?: string[];
}

export interface ContextItem {
  event_id: string;
  content: string;
  score: number;
  metadata: Record<string, any>;
}

export interface ContextPack {
  pack_id: string;
  policy_id: string;
  task: string;
  items: ContextItem[];
  total_items: number;
  total_tokens: number;
  budget_tokens: number;
  utilization: number;
  created_at: string;
  project: string;
  branch: string;
  summary?: string;
}

export interface RetrievalResponse {
  success: boolean;
  context_pack?: ContextPack;
  error?: string;
}

export interface COMHealth {
  status: string;
  timestamp: string;
  total_events: number;
  total_branches: number;
  total_commits: number;
  vector_index_size: number;
}

// =============================================================================
// COM Client
// =============================================================================

export class COMClient extends EventEmitter {
  private client: AxiosInstance;
  private baseURL: string;
  private healthCheckInterval?: NodeJS.Timeout;
  private isHealthy: boolean = false;

  constructor(baseURL: string = 'http://localhost:8083') {
    super();
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Start health monitoring
    this.startHealthMonitoring();
  }

  // ===========================================================================
  // Health & Status
  // ===========================================================================

  private startHealthMonitoring(): void {
    // Check health every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      this.checkHealth().catch(err => {
        console.error('[COMClient] Health check failed:', err.message);
      });
    }, 30000);

    // Initial health check
    this.checkHealth();
  }

  async checkHealth(): Promise<COMHealth> {
    try {
      const response = await this.client.get<COMHealth>('/health');
      const wasHealthy = this.isHealthy;
      this.isHealthy = response.data.status === 'healthy';

      if (!wasHealthy && this.isHealthy) {
        this.emit('health:recovered', response.data);
        console.log('[COMClient] COM service is healthy');
      }

      return response.data;
    } catch (error) {
      const wasHealthy = this.isHealthy;
      this.isHealthy = false;

      if (wasHealthy) {
        this.emit('health:degraded', error);
        console.error('[COMClient] COM service is unhealthy');
      }

      throw error;
    }
  }

  getHealthStatus(): boolean {
    return this.isHealthy;
  }

  // ===========================================================================
  // Event Ingestion
  // ===========================================================================

  async ingestEvent(event: Event): Promise<{ success: boolean; event_id: string; message: string }> {
    try {
      // Ensure required fields
      const fullEvent = {
        ...event,
        timestamp: event.timestamp || new Date().toISOString(),
        branch: event.branch || 'main',
        importance: event.importance || 1.0,
        tags: event.tags || [],
        related_ids: event.related_ids || []
      };

      const response = await this.client.post('/ingest', fullEvent);

      if (response.data.success) {
        this.emit('event:ingested', fullEvent);
      }

      return response.data;
    } catch (error: any) {
      console.error('[COMClient] Failed to ingest event:', error.message);
      this.emit('event:ingest_failed', { event, error });
      throw error;
    }
  }

  async ingestEvents(events: Event[]): Promise<number> {
    let successCount = 0;

    for (const event of events) {
      try {
        const result = await this.ingestEvent(event);
        if (result.success) {
          successCount++;
        }
      } catch (error) {
        // Continue with next event
        continue;
      }
    }

    return successCount;
  }

  // ===========================================================================
  // Context Retrieval
  // ===========================================================================

  async retrieveContext(request: RetrievalRequest): Promise<ContextPack> {
    try {
      const fullRequest = {
        ...request,
        branch: request.branch || 'main',
        inputs: request.inputs || {}
      };

      const response = await this.client.post<RetrievalResponse>('/retrieve', fullRequest);

      if (!response.data.success || !response.data.context_pack) {
        throw new Error(response.data.error || 'Failed to retrieve context');
      }

      this.emit('context:retrieved', {
        task: request.task,
        context_pack: response.data.context_pack
      });

      return response.data.context_pack;
    } catch (error: any) {
      console.error('[COMClient] Failed to retrieve context:', error.message);
      this.emit('context:retrieval_failed', { request, error });
      throw error;
    }
  }

  /**
   * Helper: Get formatted context string for LLM prompt
   */
  formatContextForLLM(contextPack: ContextPack): string {
    const sections: string[] = [];

    if (contextPack.summary) {
      sections.push(`# Context Summary\n${contextPack.summary}\n`);
    }

    sections.push(
      `# Relevant Events (${contextPack.total_items} items, ${contextPack.total_tokens} tokens)\n`
    );

    contextPack.items.forEach((item, index) => {
      sections.push(`## Event ${index + 1} (score: ${item.score.toFixed(2)})\n${item.content}\n`);
    });

    return sections.join('\n');
  }

  // ===========================================================================
  // Policies
  // ===========================================================================

  async listPolicies(): Promise<Array<{ policy_id: string; task: string; budget_tokens: number }>> {
    try {
      const response = await this.client.get('/policies');
      return response.data.policies;
    } catch (error: any) {
      console.error('[COMClient] Failed to list policies:', error.message);
      throw error;
    }
  }

  async getPolicy(policyId: string): Promise<any> {
    try {
      const response = await this.client.get(`/policies/${policyId}`);
      return response.data;
    } catch (error: any) {
      console.error(`[COMClient] Failed to get policy ${policyId}:`, error.message);
      throw error;
    }
  }

  // ===========================================================================
  // Branches
  // ===========================================================================

  async listBranches(): Promise<any[]> {
    try {
      const response = await this.client.get('/branches');
      return response.data.branches;
    } catch (error: any) {
      console.error('[COMClient] Failed to list branches:', error.message);
      throw error;
    }
  }

  async createBranch(branchName: string, description?: string): Promise<void> {
    try {
      await this.client.post('/branches', null, {
        params: { branch_name: branchName, description }
      });
      this.emit('branch:created', { branchName, description });
    } catch (error: any) {
      console.error(`[COMClient] Failed to create branch ${branchName}:`, error.message);
      throw error;
    }
  }

  // ===========================================================================
  // Statistics
  // ===========================================================================

  async getStats(): Promise<any> {
    try {
      const response = await this.client.get('/stats');
      return response.data;
    } catch (error: any) {
      console.error('[COMClient] Failed to get stats:', error.message);
      throw error;
    }
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.removeAllListeners();
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let comClientInstance: COMClient | null = null;

export function getCOMClient(baseURL?: string): COMClient {
  if (!comClientInstance) {
    comClientInstance = new COMClient(baseURL || process.env.COM_SERVICE_URL || 'http://localhost:8083');
  }
  return comClientInstance;
}

export function resetCOMClient(): void {
  if (comClientInstance) {
    comClientInstance.destroy();
    comClientInstance = null;
  }
}
