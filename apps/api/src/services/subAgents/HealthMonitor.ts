/**
 * Health Monitor - Agent health monitoring and recovery system
 * Monitors agent performance and automatically handles failures
 */

import { EventEmitter } from 'events';
import { logger } from '@/utils/logger';
import { contextManager } from './ContextManager';
import type { SubAgent, AgentStatus, AgentMetrics } from '@/types/agents';

interface HealthCheckResult {
  agentId: string;
  healthy: boolean;
  responseTime: number;
  error?: string;
  timestamp: Date;
}

interface RecoveryAction {
  type: 'restart' | 'reinitialize' | 'escalate';
  agentId: string;
  reason: string;
  timestamp: Date;
  success?: boolean;
}

export class HealthMonitor extends EventEmitter {
  private agents = new Map<string, SubAgent>();
  private healthHistory = new Map<string, HealthCheckResult[]>();
  private monitoringInterval?: NodeJS.Timeout;
  private recoveryAttempts = new Map<string, number>();
  private maxRecoveryAttempts = 3;
  private healthCheckInterval = 30000; // 30 seconds
  private responseTimeThreshold = 10000; // 10 seconds

  constructor() {
    super();
    this.startHealthMonitoring();
  }

  /**
   * Register agent for health monitoring
   */
  registerAgent(agent: SubAgent): void {
    logger.info(`Registering agent for health monitoring: ${agent.id}`);
    this.agents.set(agent.id, agent);
    this.healthHistory.set(agent.id, []);
    this.recoveryAttempts.set(agent.id, 0);
  }

  /**
   * Unregister agent from health monitoring
   */
  unregisterAgent(agentId: string): void {
    logger.info(`Unregistering agent from health monitoring: ${agentId}`);
    this.agents.delete(agentId);
    this.healthHistory.delete(agentId);
    this.recoveryAttempts.delete(agentId);
  }

  /**
   * Perform health check on specific agent
   */
  async performHealthCheck(agentId: string): Promise<HealthCheckResult> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const startTime = Date.now();
    let result: HealthCheckResult;

    try {
      // Perform health check task
      const healthCheckResult = await Promise.race([
        agent.execute({
          id: `health-check-${Date.now()}`,
          type: 'health-check',
          data: { timestamp: new Date() },
          context: {},
          timeout: this.responseTimeThreshold
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), this.responseTimeThreshold)
        )
      ]);

      const responseTime = Date.now() - startTime;
      
      result = {
        agentId,
        healthy: healthCheckResult.status === 'success',
        responseTime,
        timestamp: new Date()
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      result = {
        agentId,
        healthy: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }

    // Store health check result
    const history = this.healthHistory.get(agentId) || [];
    history.push(result);
    
    // Keep only last 50 health checks
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }
    
    this.healthHistory.set(agentId, history);

    // Emit health check event
    this.emit('healthCheck', result);

    // Handle unhealthy agent
    if (!result.healthy) {
      await this.handleUnhealthyAgent(agentId, result);
    } else {
      // Reset recovery attempts on successful health check
      this.recoveryAttempts.set(agentId, 0);
    }

    return result;
  }

  /**
   * Get health status for all agents
   */
  getHealthStatus(): Record<string, any> {
    const status: Record<string, any> = {};

    for (const [agentId, agent] of this.agents) {
      const history = this.healthHistory.get(agentId) || [];
      const recentChecks = history.slice(-10);
      const healthyChecks = recentChecks.filter(check => check.healthy);
      
      status[agentId] = {
        agentType: agent.type,
        currentStatus: agent.status,
        healthPercentage: recentChecks.length > 0 ? 
          Math.round((healthyChecks.length / recentChecks.length) * 100) : 0,
        averageResponseTime: recentChecks.length > 0 ?
          Math.round(recentChecks.reduce((sum, check) => sum + check.responseTime, 0) / recentChecks.length) : 0,
        lastHealthCheck: history[history.length - 1]?.timestamp,
        recoveryAttempts: this.recoveryAttempts.get(agentId) || 0,
        totalChecks: history.length,
        recentIssues: this.getRecentIssues(agentId)
      };
    }

    return status;
  }

  /**
   * Get performance metrics for agent
   */
  getAgentMetrics(agentId: string): AgentMetrics | null {
    const agent = this.agents.get(agentId);
    const history = this.healthHistory.get(agentId) || [];
    
    if (!agent || history.length === 0) {
      return null;
    }

    const recentChecks = history.slice(-100); // Last 100 checks
    const healthyChecks = recentChecks.filter(check => check.healthy);
    
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const recentHourChecks = recentChecks.filter(check => check.timestamp > oneHourAgo);

    return {
      agentId,
      period: {
        start: recentChecks[0]?.timestamp || now,
        end: now
      },
      performance: {
        tasksExecuted: recentChecks.length,
        averageExecutionTime: Math.round(
          recentChecks.reduce((sum, check) => sum + check.responseTime, 0) / recentChecks.length
        ),
        successRate: recentChecks.length > 0 ? healthyChecks.length / recentChecks.length : 0,
        errorRate: recentChecks.length > 0 ? (recentChecks.length - healthyChecks.length) / recentChecks.length : 0
      },
      resources: {
        avgCpuUsage: 0, // Would need OS-level monitoring
        avgMemoryUsage: 0, // Would need OS-level monitoring  
        peakMemoryUsage: 0
      }
    };
  }

  /**
   * Handle unhealthy agent
   */
  private async handleUnhealthyAgent(agentId: string, healthCheck: HealthCheckResult): Promise<void> {
    const currentAttempts = this.recoveryAttempts.get(agentId) || 0;
    
    logger.warn(`Agent ${agentId} is unhealthy`, {
      error: healthCheck.error,
      responseTime: healthCheck.responseTime,
      attempts: currentAttempts
    });

    if (currentAttempts >= this.maxRecoveryAttempts) {
      await this.escalateAgent(agentId, 'Max recovery attempts exceeded');
      return;
    }

    // Increment recovery attempts
    this.recoveryAttempts.set(agentId, currentAttempts + 1);

    // Determine recovery action
    const action = this.determineRecoveryAction(agentId, healthCheck);
    
    try {
      await this.performRecoveryAction(action);
      
      logger.info(`Recovery action completed for agent ${agentId}`, {
        action: action.type,
        attempts: currentAttempts + 1
      });

    } catch (error) {
      logger.error(`Recovery action failed for agent ${agentId}:`, error);
      
      // If all recovery attempts fail, escalate
      if (currentAttempts + 1 >= this.maxRecoveryAttempts) {
        await this.escalateAgent(agentId, 'Recovery actions failed');
      }
    }
  }

  /**
   * Determine appropriate recovery action
   */
  private determineRecoveryAction(agentId: string, healthCheck: HealthCheckResult): RecoveryAction {
    const agent = this.agents.get(agentId)!;
    const attempts = this.recoveryAttempts.get(agentId) || 0;

    // First attempt: try to restart agent
    if (attempts === 0) {
      return {
        type: 'restart',
        agentId,
        reason: `Health check failed: ${healthCheck.error}`,
        timestamp: new Date()
      };
    }

    // Second attempt: reinitialize agent
    if (attempts === 1) {
      return {
        type: 'reinitialize',
        agentId,
        reason: `Restart failed, reinitializing agent`,
        timestamp: new Date()
      };
    }

    // Final attempt: escalate
    return {
      type: 'escalate',
      agentId,
      reason: `Multiple recovery attempts failed`,
      timestamp: new Date()
    };
  }

  /**
   * Perform recovery action
   */
  private async performRecoveryAction(action: RecoveryAction): Promise<void> {
    const agent = this.agents.get(action.agentId);
    if (!agent) {
      throw new Error(`Agent ${action.agentId} not found`);
    }

    switch (action.type) {
      case 'restart':
        // Attempt to reset agent status
        if (typeof (agent as any).reset === 'function') {
          await (agent as any).reset();
        }
        break;

      case 'reinitialize':
        // Attempt to reinitialize agent
        if (typeof (agent as any).initialize === 'function') {
          await (agent as any).initialize();
        }
        break;

      case 'escalate':
        await this.escalateAgent(action.agentId, action.reason);
        break;
    }

    // Update context with recovery action
    await contextManager.updateContext('health-monitor', {
      systemHealth: {
        cpuUsage: 0,
        memoryUsage: 0,
        diskSpace: 0,
        agentLoad: this.calculateAgentLoad(),
        timestamp: new Date()
      }
    });

    this.emit('recoveryAction', action);
  }

  /**
   * Escalate agent issues
   */
  private async escalateAgent(agentId: string, reason: string): Promise<void> {
    logger.error(`Escalating agent ${agentId}`, { reason });
    
    const agent = this.agents.get(agentId);
    if (agent) {
      // Mark agent as offline
      agent.status = 'offline';
    }

    // Emit escalation event
    this.emit('agentEscalated', {
      agentId,
      reason,
      timestamp: new Date(),
      recoveryAttempts: this.recoveryAttempts.get(agentId) || 0
    });

    // Could integrate with alerting systems here
    // await this.sendAlert(`Agent ${agentId} escalated: ${reason}`);
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    logger.info('Starting health monitoring system');
    
    this.monitoringInterval = setInterval(async () => {
      await this.performAllHealthChecks();
    }, this.healthCheckInterval);
  }

  /**
   * Perform health checks on all agents
   */
  private async performAllHealthChecks(): Promise<void> {
    const healthCheckPromises = Array.from(this.agents.keys()).map(agentId =>
      this.performHealthCheck(agentId).catch(error => {
        logger.error(`Health check failed for agent ${agentId}:`, error);
      })
    );

    await Promise.all(healthCheckPromises);

    // Update system health context
    await this.updateSystemHealthContext();
  }

  /**
   * Update system health context
   */
  private async updateSystemHealthContext(): Promise<void> {
    const healthStatus = this.getHealthStatus();
    const totalAgents = Object.keys(healthStatus).length;
    const healthyAgents = Object.values(healthStatus).filter(
      (status: any) => status.healthPercentage >= 80
    ).length;

    await contextManager.updateContext('health-monitor', {
      systemHealth: {
        cpuUsage: process.cpuUsage().system / 1000000, // Convert to percentage
        memoryUsage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100),
        diskSpace: 0, // Would need disk monitoring
        agentLoad: this.calculateAgentLoad(),
        timestamp: new Date()
      }
    });
  }

  /**
   * Calculate current agent load
   */
  private calculateAgentLoad(): number {
    let totalLoad = 0;
    let agentCount = 0;

    for (const [agentId, agent] of this.agents) {
      if (agent.status === 'busy') totalLoad += 100;
      else if (agent.status === 'active') totalLoad += 50;
      else if (agent.status === 'idle') totalLoad += 10;
      
      agentCount++;
    }

    return agentCount > 0 ? Math.round(totalLoad / agentCount) : 0;
  }

  /**
   * Get recent issues for agent
   */
  private getRecentIssues(agentId: string): string[] {
    const history = this.healthHistory.get(agentId) || [];
    const recentChecks = history.slice(-5); // Last 5 checks
    
    return recentChecks
      .filter(check => !check.healthy)
      .map(check => check.error || 'Unknown error');
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    
    logger.info('Health monitoring stopped');
  }

  /**
   * Get comprehensive health report
   */
  getHealthReport(): any {
    const healthStatus = this.getHealthStatus();
    const totalAgents = Object.keys(healthStatus).length;
    
    const healthyAgents = Object.values(healthStatus).filter(
      (status: any) => status.healthPercentage >= 80
    ).length;

    const criticalAgents = Object.values(healthStatus).filter(
      (status: any) => status.healthPercentage < 50
    ).length;

    return {
      summary: {
        totalAgents,
        healthyAgents,
        criticalAgents,
        systemHealthScore: totalAgents > 0 ? Math.round((healthyAgents / totalAgents) * 100) : 0
      },
      agentDetails: healthStatus,
      systemMetrics: {
        cpuUsage: process.cpuUsage(),
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
      },
      generatedAt: new Date()
    };
  }
}

// Export singleton instance
export const healthMonitor = new HealthMonitor();