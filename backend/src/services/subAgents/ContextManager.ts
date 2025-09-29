/**
 * Context Manager - Centralized context sharing for sub-agents
 * Manages shared state and real-time context updates
 */

import { EventEmitter } from 'events';
import { logger } from '@/utils/logger';
import type { AgentContext } from '@/types/agents';

export interface UnifiedContext extends AgentContext {
  testExecution?: {
    currentRun?: {
      id: string;
      suiteName: string;
      status: string;
      startedAt: Date;
      progress: number;
    };
    queuedRuns: any[];
    recentResults: any[];
  };
  codeChanges?: {
    files: string[];
    changedLines: number;
    author: string;
    timestamp: Date;
    branch: string;
  };
  failureHistory?: {
    recentFailures: FailureRecord[];
    patterns: FailurePattern[];
    healingAttempts: HealingAttempt[];
  };
  systemHealth?: {
    cpuUsage: number;
    memoryUsage: number;
    diskSpace: number;
    agentLoad: number;
    timestamp: Date;
  };
  businessRules?: {
    wesignWorkflows: WorkflowRule[];
    bilingualRequirements: BilingualRule[];
    criticalPaths: CriticalPath[];
  };
}

interface FailureRecord {
  testName: string;
  failureType: string;
  errorMessage: string;
  timestamp: Date;
  context: Record<string, any>;
}

interface FailurePattern {
  pattern: string;
  frequency: number;
  lastSeen: Date;
  confidence: number;
}

interface HealingAttempt {
  testName: string;
  strategy: string;
  success: boolean;
  timestamp: Date;
}

interface WorkflowRule {
  name: string;
  steps: string[];
  criticality: 'high' | 'medium' | 'low';
}

interface BilingualRule {
  language: 'hebrew' | 'english';
  requirements: string[];
  validationRules: string[];
}

interface CriticalPath {
  name: string;
  components: string[];
  businessImpact: number;
}

export class ContextManager extends EventEmitter {
  private static instance: ContextManager;
  private context: UnifiedContext = {};
  private subscribers = new Map<string, Set<string>>(); // contextKey -> Set<agentIds>
  private contextHistory: Array<{ timestamp: Date; context: Partial<UnifiedContext> }> = [];
  private maxHistorySize = 100;

  constructor() {
    super();
    this.initializeContext();
    this.startContextCleanup();
  }

  static getInstance(): ContextManager {
    if (!ContextManager.instance) {
      ContextManager.instance = new ContextManager();
    }
    return ContextManager.instance;
  }

  /**
   * Get the complete unified context
   */
  getContext(): UnifiedContext {
    return { ...this.context };
  }

  /**
   * Get specific context section
   */
  getContextSection<K extends keyof UnifiedContext>(section: K): UnifiedContext[K] {
    return this.context[section];
  }

  /**
   * Update context with new data
   */
  async updateContext(agentId: string, contextUpdate: Partial<UnifiedContext>): Promise<void> {
    logger.debug(`Updating context from agent: ${agentId}`, { contextUpdate });

    // Merge context updates
    const previousContext = { ...this.context };
    this.context = this.mergeContext(this.context, contextUpdate);

    // Track context history
    this.contextHistory.push({
      timestamp: new Date(),
      context: contextUpdate
    });

    // Trim history if needed
    if (this.contextHistory.length > this.maxHistorySize) {
      this.contextHistory = this.contextHistory.slice(-this.maxHistorySize);
    }

    // Notify subscribers of changes
    await this.notifySubscribers(agentId, contextUpdate, previousContext);

    this.emit('contextUpdated', {
      agentId,
      contextUpdate,
      timestamp: new Date()
    });
  }

  /**
   * Subscribe agent to specific context changes
   */
  subscribe(agentId: string, contextKeys: (keyof UnifiedContext)[]): void {
    logger.debug(`Agent ${agentId} subscribing to context keys:`, contextKeys);

    for (const key of contextKeys) {
      if (!this.subscribers.has(key)) {
        this.subscribers.set(key, new Set());
      }
      this.subscribers.get(key)!.add(agentId);
    }
  }

  /**
   * Unsubscribe agent from context changes
   */
  unsubscribe(agentId: string, contextKeys?: (keyof UnifiedContext)[]): void {
    if (!contextKeys) {
      // Unsubscribe from all
      for (const [key, subscribers] of this.subscribers) {
        subscribers.delete(agentId);
      }
    } else {
      for (const key of contextKeys) {
        this.subscribers.get(key)?.delete(agentId);
      }
    }

    logger.debug(`Agent ${agentId} unsubscribed from context`);
  }

  /**
   * Add failure record to context
   */
  async addFailureRecord(failure: FailureRecord): Promise<void> {
    if (!this.context.failureHistory) {
      this.context.failureHistory = { recentFailures: [], patterns: [], healingAttempts: [] };
    }

    this.context.failureHistory.recentFailures.unshift(failure);
    
    // Keep only recent 50 failures
    if (this.context.failureHistory.recentFailures.length > 50) {
      this.context.failureHistory.recentFailures = 
        this.context.failureHistory.recentFailures.slice(0, 50);
    }

    // Update patterns
    await this.updateFailurePatterns(failure);

    this.emit('failureAdded', failure);
  }

  /**
   * Add healing attempt to context
   */
  async addHealingAttempt(attempt: HealingAttempt): Promise<void> {
    if (!this.context.failureHistory) {
      this.context.failureHistory = { recentFailures: [], patterns: [], healingAttempts: [] };
    }

    this.context.failureHistory.healingAttempts.unshift(attempt);
    
    // Keep only recent 100 healing attempts
    if (this.context.failureHistory.healingAttempts.length > 100) {
      this.context.failureHistory.healingAttempts = 
        this.context.failureHistory.healingAttempts.slice(0, 100);
    }

    this.emit('healingAttemptAdded', attempt);
  }

  /**
   * Update system health context
   */
  async updateSystemHealth(health: UnifiedContext['systemHealth']): Promise<void> {
    await this.updateContext('system-monitor', { systemHealth: health });
  }

  /**
   * Get context insights for agents
   */
  getContextInsights(): any {
    const insights = {
      failurePatterns: this.context.failureHistory?.patterns || [],
      systemLoad: this.context.systemHealth?.agentLoad || 0,
      recentTrends: this.analyzeRecentTrends(),
      criticalAreas: this.identifyCriticalAreas(),
      recommendations: this.generateRecommendations()
    };

    return insights;
  }

  /**
   * Initialize default context
   */
  private initializeContext(): void {
    this.context = {
      systemHealth: {
        cpuUsage: 0,
        memoryUsage: 0,
        diskSpace: 0,
        agentLoad: 0,
        timestamp: new Date()
      },
      failureHistory: {
        recentFailures: [],
        patterns: [],
        healingAttempts: []
      },
      businessRules: {
        wesignWorkflows: [
          {
            name: 'Document Signing',
            steps: ['upload', 'review', 'sign', 'download'],
            criticality: 'high'
          },
          {
            name: 'User Authentication',
            steps: ['login', 'verification', 'session'],
            criticality: 'high'
          }
        ],
        bilingualRequirements: [
          {
            language: 'hebrew',
            requirements: ['RTL layout', 'Hebrew text validation', 'Date formatting'],
            validationRules: ['text direction', 'font rendering', 'input validation']
          },
          {
            language: 'english',
            requirements: ['LTR layout', 'English text validation', 'Date formatting'],
            validationRules: ['text direction', 'font rendering', 'input validation']
          }
        ],
        criticalPaths: [
          {
            name: 'Core Signing Flow',
            components: ['auth', 'upload', 'sign', 'download'],
            businessImpact: 0.9
          }
        ]
      }
    };
  }

  /**
   * Merge context updates intelligently
   */
  private mergeContext(current: UnifiedContext, update: Partial<UnifiedContext>): UnifiedContext {
    const merged = { ...current };

    for (const [key, value] of Object.entries(update)) {
      if (value === null || value === undefined) {
        continue;
      }

      if (typeof value === 'object' && !Array.isArray(value) && value.constructor === Object) {
        // Deep merge objects
        merged[key as keyof UnifiedContext] = {
          ...merged[key as keyof UnifiedContext] as any,
          ...value
        };
      } else {
        // Direct assignment for arrays and primitives
        merged[key as keyof UnifiedContext] = value as any;
      }
    }

    return merged;
  }

  /**
   * Notify subscribers of context changes
   */
  private async notifySubscribers(
    sourceAgentId: string, 
    contextUpdate: Partial<UnifiedContext>,
    previousContext: UnifiedContext
  ): Promise<void> {
    const changedKeys = Object.keys(contextUpdate) as (keyof UnifiedContext)[];

    for (const key of changedKeys) {
      const subscribers = this.subscribers.get(key);
      if (!subscribers) continue;

      for (const subscriberAgentId of subscribers) {
        if (subscriberAgentId === sourceAgentId) continue; // Don't notify self

        this.emit('contextChange', {
          subscriberAgentId,
          key,
          newValue: contextUpdate[key],
          previousValue: previousContext[key],
          sourceAgentId,
          timestamp: new Date()
        });
      }
    }
  }

  /**
   * Update failure patterns based on new failure
   */
  private async updateFailurePatterns(failure: FailureRecord): Promise<void> {
    if (!this.context.failureHistory) return;

    const patternKey = this.extractPatternKey(failure);
    
    let pattern = this.context.failureHistory.patterns.find(p => p.pattern === patternKey);
    
    if (pattern) {
      pattern.frequency++;
      pattern.lastSeen = failure.timestamp;
    } else {
      pattern = {
        pattern: patternKey,
        frequency: 1,
        lastSeen: failure.timestamp,
        confidence: 0.7
      };
      this.context.failureHistory.patterns.push(pattern);
    }

    // Sort patterns by frequency
    this.context.failureHistory.patterns.sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Extract pattern key from failure
   */
  private extractPatternKey(failure: FailureRecord): string {
    // Simple pattern extraction - can be enhanced with ML
    const errorType = failure.failureType || 'unknown';
    const testModule = failure.testName.split('_')[0] || 'unknown';
    
    return `${errorType}:${testModule}`;
  }

  /**
   * Analyze recent trends in context data
   */
  private analyzeRecentTrends(): any {
    const recentHistory = this.contextHistory.slice(-20);
    
    return {
      failureRate: this.calculateFailureRate(recentHistory),
      healingSuccessRate: this.calculateHealingSuccessRate(recentHistory),
      systemLoadTrend: this.calculateSystemLoadTrend(recentHistory)
    };
  }

  /**
   * Identify critical areas needing attention
   */
  private identifyCriticalAreas(): string[] {
    const areas: string[] = [];
    
    const patterns = this.context.failureHistory?.patterns || [];
    const highFrequencyPatterns = patterns.filter(p => p.frequency > 3);
    
    if (highFrequencyPatterns.length > 0) {
      areas.push('High frequency failure patterns detected');
    }
    
    const systemHealth = this.context.systemHealth;
    if (systemHealth?.cpuUsage > 80) {
      areas.push('High CPU usage');
    }
    
    if (systemHealth?.memoryUsage > 80) {
      areas.push('High memory usage');
    }
    
    return areas;
  }

  /**
   * Generate context-based recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    const criticalAreas = this.identifyCriticalAreas();
    
    if (criticalAreas.includes('High frequency failure patterns detected')) {
      recommendations.push('Consider implementing proactive healing for frequent failures');
    }
    
    if (criticalAreas.includes('High CPU usage')) {
      recommendations.push('Consider optimizing agent task distribution');
    }
    
    return recommendations;
  }

  /**
   * Helper methods for trend analysis
   */
  private calculateFailureRate(history: any[]): number {
    // Implement failure rate calculation
    return 0;
  }

  private calculateHealingSuccessRate(history: any[]): number {
    // Implement healing success rate calculation
    return 0;
  }

  private calculateSystemLoadTrend(history: any[]): string {
    // Implement system load trend calculation
    return 'stable';
  }

  /**
   * Start periodic context cleanup
   */
  private startContextCleanup(): void {
    setInterval(() => {
      this.cleanupOldData();
    }, 60000); // Clean every minute
  }

  /**
   * Clean up old context data
   */
  private cleanupOldData(): void {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Clean old failure records
    if (this.context.failureHistory?.recentFailures) {
      this.context.failureHistory.recentFailures = 
        this.context.failureHistory.recentFailures.filter(
          failure => failure.timestamp > oneHourAgo
        );
    }

    // Clean old healing attempts  
    if (this.context.failureHistory?.healingAttempts) {
      this.context.failureHistory.healingAttempts =
        this.context.failureHistory.healingAttempts.filter(
          attempt => attempt.timestamp > oneHourAgo
        );
    }
  }
}

// Export singleton instance
export const contextManager = ContextManager.getInstance();