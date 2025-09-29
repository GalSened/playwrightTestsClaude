/**
 * Agent Metrics Collector - Real-time performance metrics collection and storage
 * Replaces mock data with actual agent performance tracking
 */

import { EventEmitter } from 'events';
import { logger } from '@/utils/logger';
import { getDatabase } from '@/database/database';
import type { SchedulerDatabase } from '@/database/database';
import type { 
  AgentTask, 
  AgentResult, 
  SubAgent,
  AgentMetrics,
  AgentStatus 
} from '@/types/agents';

interface AgentPerformanceData {
  agentId: string;
  type: string;
  tasksCompleted: number;
  totalExecutionTime: number;
  successCount: number;
  errorCount: number;
  averageExecutionTime: number;
  successRate: number;
  lastActivity: Date;
  currentTasks: number;
  resourceUsage: {
    cpuPercent: number;
    memoryMB: number;
  };
  healthScore: number;
}

interface TaskExecutionMetrics {
  taskId: string;
  agentId: string;
  taskType: string;
  startTime: Date;
  endTime?: Date;
  executionTimeMs?: number;
  status: 'pending' | 'running' | 'success' | 'error' | 'timeout';
  errorMessage?: string;
  confidenceScore?: number;
  tokensUsed?: number;
  modelUsed?: string;
  aiCostEstimate?: number;
}

interface SystemMetrics {
  totalAgents: number;
  activeAgents: number;
  totalTasksCompleted: number;
  averageSuccessRate: number;
  totalErrors: number;
  systemUptime: number;
  lastUpdated: Date;
}

export class MetricsCollector extends EventEmitter {
  private db: SchedulerDatabase;
  private metricsCache = new Map<string, AgentPerformanceData>();
  private runningTasks = new Map<string, TaskExecutionMetrics>();
  private systemMetrics: SystemMetrics;
  private metricsUpdateInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    super();
    this.db = getDatabase();
    this.systemMetrics = {
      totalAgents: 0,
      activeAgents: 0,
      totalTasksCompleted: 0,
      averageSuccessRate: 0,
      totalErrors: 0,
      systemUptime: 0,
      lastUpdated: new Date()
    };
    
    this.initializeMetricsCollection();
    logger.info('MetricsCollector initialized');
  }

  private initializeMetricsCollection(): void {
    // Update metrics every 30 seconds
    this.metricsUpdateInterval = setInterval(() => {
      this.updateSystemMetrics();
    }, 30000);

    // Update resource usage every 10 seconds
    setInterval(() => {
      this.collectResourceMetrics();
    }, 10000);
  }

  /**
   * Register an agent for metrics collection
   */
  async registerAgent(agent: SubAgent): Promise<void> {
    try {
      const agentData: AgentPerformanceData = {
        agentId: agent.id,
        type: agent.type,
        tasksCompleted: 0,
        totalExecutionTime: 0,
        successCount: 0,
        errorCount: 0,
        averageExecutionTime: 0,
        successRate: 0,
        lastActivity: new Date(),
        currentTasks: 0,
        resourceUsage: {
          cpuPercent: 0,
          memoryMB: 0
        },
        healthScore: 1.0
      };

      this.metricsCache.set(agent.id, agentData);

      // Insert or update agent state in database
      await this.upsertAgentState(agent, agentData);
      
      logger.info(`Agent registered for metrics collection: ${agent.id}`);
      this.emit('agentRegistered', { agentId: agent.id });
    } catch (error) {
      logger.error(`Failed to register agent for metrics: ${agent.id}`, error);
    }
  }

  /**
   * Record the start of a task execution
   */
  recordTaskStart(task: AgentTask, agentId: string): void {
    const metrics: TaskExecutionMetrics = {
      taskId: task.id,
      agentId,
      taskType: task.type,
      startTime: new Date(),
      status: 'running'
    };

    this.runningTasks.set(task.id, metrics);
    
    // Update agent's current task count
    const agentData = this.metricsCache.get(agentId);
    if (agentData) {
      agentData.currentTasks++;
      agentData.lastActivity = new Date();
    }

    logger.debug(`Task started: ${task.id} for agent ${agentId}`);
  }

  /**
   * Record the completion of a task execution
   */
  async recordTaskCompletion(task: AgentTask, result: AgentResult): Promise<void> {
    const runningTask = this.runningTasks.get(task.id);
    if (!runningTask) {
      logger.warn(`No running task found for completion: ${task.id}`);
      return;
    }

    const endTime = new Date();
    const executionTimeMs = endTime.getTime() - runningTask.startTime.getTime();

    // Update task metrics
    runningTask.endTime = endTime;
    runningTask.executionTimeMs = executionTimeMs;
    runningTask.status = result.status as any;
    runningTask.errorMessage = result.error;
    runningTask.confidenceScore = result.confidence;
    runningTask.tokensUsed = result.metadata?.tokensUsed;
    runningTask.modelUsed = result.metadata?.modelUsed;
    runningTask.aiCostEstimate = this.estimateAICost(result.metadata?.tokensUsed, result.metadata?.modelUsed);

    // Update agent performance data
    const agentData = this.metricsCache.get(result.agentId);
    if (agentData) {
      agentData.tasksCompleted++;
      agentData.totalExecutionTime += executionTimeMs;
      agentData.currentTasks = Math.max(0, agentData.currentTasks - 1);
      agentData.lastActivity = endTime;

      if (result.status === 'success') {
        agentData.successCount++;
      } else if (result.status === 'error') {
        agentData.errorCount++;
      }

      // Recalculate derived metrics
      agentData.averageExecutionTime = agentData.totalExecutionTime / agentData.tasksCompleted;
      agentData.successRate = agentData.tasksCompleted > 0 
        ? agentData.successCount / agentData.tasksCompleted 
        : 0;
      
      // Update health score based on recent performance
      agentData.healthScore = this.calculateHealthScore(agentData);
    }

    // Persist to database
    try {
      await this.persistTaskMetrics(runningTask);
      await this.updateAgentMetrics(result.agentId);
    } catch (error) {
      logger.error(`Failed to persist task metrics for ${task.id}:`, error);
    }

    // Clean up running task
    this.runningTasks.delete(task.id);

    logger.debug(`Task completed: ${task.id} (${executionTimeMs}ms, ${result.status})`);
    this.emit('taskCompleted', { taskId: task.id, agentId: result.agentId, metrics: runningTask });
  }

  /**
   * Get real-time performance metrics for all agents
   */
  getAgentMetrics(): AgentPerformanceData[] {
    return Array.from(this.metricsCache.values());
  }

  /**
   * Get performance metrics for a specific agent
   */
  getAgentMetricsById(agentId: string): AgentPerformanceData | null {
    return this.metricsCache.get(agentId) || null;
  }

  /**
   * Get system-wide metrics summary
   */
  getSystemMetrics(): SystemMetrics {
    this.updateSystemMetrics();
    return { ...this.systemMetrics };
  }

  /**
   * Get aggregated metrics for all agents
   */
  async getAggregatedMetrics(hours: number = 24): Promise<{
    totalAgents: number;
    activeAgents: number;
    totalTasks: number;
    successRate: number;
    averageExecutionTime: number;
    totalCost: number;
    errorRate: number;
  }> {
    try {
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      const dbInstance = (this.db as any).db;
      
      const aggregateStmt = dbInstance?.prepare(`
        SELECT 
          COUNT(DISTINCT agent_id) as total_agents,
          COUNT(*) as total_tasks,
          AVG(execution_time_ms) as avg_execution_time,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
          SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count,
          SUM(ai_cost_estimate) as total_cost
        FROM agent_tasks 
        WHERE created_at > ?
      `);
      
      const result = aggregateStmt?.get(startTime) as any;
      const currentAgents = Array.from(this.metricsCache.values());
      
      return {
        totalAgents: currentAgents.length,
        activeAgents: currentAgents.filter(a => a.currentTasks > 0).length,
        totalTasks: result?.total_tasks || 0,
        successRate: result?.total_tasks > 0 ? (result.success_count / result.total_tasks) : 0,
        averageExecutionTime: result?.avg_execution_time || 0,
        totalCost: result?.total_cost || 0,
        errorRate: result?.total_tasks > 0 ? (result.error_count / result.total_tasks) : 0
      };
    } catch (error) {
      logger.error('Failed to get aggregated metrics', { error });
      return {
        totalAgents: 0,
        activeAgents: 0,
        totalTasks: 0,
        successRate: 0,
        averageExecutionTime: 0,
        totalCost: 0,
        errorRate: 0
      };
    }
  }

  /**
   * Get performance trends over time
   */
  async getPerformanceTrends(agentId?: string, days: number = 7): Promise<{
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      successRates: number[];
      averageExecutionTimes: number[];
    }[];
  }> {
    try {
      const dbInstance = (this.db as any).db;
      
      let query = `
        SELECT 
          DATE(created_at) as date,
          agent_id,
          COUNT(*) as task_count,
          AVG(execution_time_ms) as avg_execution_time,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate
        FROM agent_tasks 
        WHERE created_at > datetime('now', '-${days} days', 'utc')
      `;
      
      if (agentId) {
        query += ` AND agent_id = '${agentId}'`;
      }
      
      query += ` GROUP BY DATE(created_at), agent_id ORDER BY date ASC`;
      
      const stmt = dbInstance?.prepare(query);
      const results = stmt?.all() || [];
      
      // Group by date and create trend data
      const trendData = new Map<string, {
        taskCount: number;
        successRate: number;
        avgExecutionTime: number;
      }>();
      
      results.forEach((row: any) => {
        const existing = trendData.get(row.date) || {
          taskCount: 0,
          successRate: 0,
          avgExecutionTime: 0
        };
        
        existing.taskCount += row.task_count;
        existing.successRate = (existing.successRate + row.success_rate) / 2;
        existing.avgExecutionTime = (existing.avgExecutionTime + row.avg_execution_time) / 2;
        
        trendData.set(row.date, existing);
      });
      
      const labels = Array.from(trendData.keys()).sort();
      const taskCounts = labels.map(date => trendData.get(date)?.taskCount || 0);
      const successRates = labels.map(date => trendData.get(date)?.successRate || 0);
      const executionTimes = labels.map(date => trendData.get(date)?.avgExecutionTime || 0);
      
      return {
        labels,
        datasets: [{
          label: agentId ? `Agent ${agentId}` : 'All Agents',
          data: taskCounts,
          successRates,
          averageExecutionTimes: executionTimes
        }]
      };
    } catch (error) {
      logger.error('Failed to get performance trends', { error });
      return {
        labels: [],
        datasets: []
      };
    }
  }

  /**
   * Get historical metrics for an agent over a time period
   */
  async getHistoricalMetrics(agentId: string, hours: number = 24): Promise<AgentMetrics> {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    
    try {
      // Query historical task data
      const dbInstance = (this.db as any).db;
      const stmt = dbInstance?.prepare(`
        SELECT 
          COUNT(*) as tasks_executed,
          AVG(execution_time_ms) as avg_execution_time,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
          SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count,
          AVG(tokens_used) as avg_tokens_used,
          SUM(ai_cost_estimate) as total_cost
        FROM agent_tasks 
        WHERE agent_id = ? AND created_at > ?
      `);

      const result = stmt?.get(agentId, startTime) as any;
      const current = this.metricsCache.get(agentId);

      return {
        agentId,
        period: {
          start: new Date(startTime),
          end: new Date()
        },
        performance: {
          tasksExecuted: result?.tasks_executed || 0,
          averageExecutionTime: result?.avg_execution_time || 0,
          successRate: result?.tasks_executed > 0 
            ? (result.success_count / result.tasks_executed) 
            : 0,
          errorRate: result?.tasks_executed > 0 
            ? (result.error_count / result.tasks_executed) 
            : 0
        },
        resources: {
          avgCpuUsage: current?.resourceUsage.cpuPercent || 0,
          avgMemoryUsage: current?.resourceUsage.memoryMB || 0,
          peakMemoryUsage: current?.resourceUsage.memoryMB || 0
        },
        aiUsage: {
          totalTokens: result?.avg_tokens_used * result?.tasks_executed || 0,
          totalCost: result?.total_cost || 0,
          averageResponseTime: result?.avg_execution_time || 0
        }
      };
    } catch (error) {
      logger.error(`Failed to get historical metrics for ${agentId}:`, error);
      throw error;
    }
  }

  private async upsertAgentState(agent: SubAgent, performanceData: AgentPerformanceData): Promise<void> {
    try {
      // Access the underlying database instance
      const dbInstance = (this.db as any).db;
      const stmt = dbInstance?.prepare(`
        INSERT OR REPLACE INTO agent_states (
          id, type, status, capabilities, last_activity, current_task,
          performance_metrics, resource_usage, health_score, 
          error_count, success_count, total_executions, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const now = new Date().toISOString();
      stmt?.run(
        agent.id,
        agent.type,
        agent.status,
        JSON.stringify(agent.capabilities),
        performanceData.lastActivity.toISOString(),
        agent.currentTask || null,
        JSON.stringify({
          tasksCompleted: performanceData.tasksCompleted,
          averageExecutionTime: performanceData.averageExecutionTime,
          successRate: performanceData.successRate,
          errorsToday: performanceData.errorCount
        }),
        JSON.stringify(performanceData.resourceUsage),
        performanceData.healthScore,
        performanceData.errorCount,
        performanceData.successCount,
        performanceData.tasksCompleted,
        now,
        now
      );
    } catch (error) {
      logger.error(`Failed to upsert agent state for ${agent.id}:`, error);
    }
  }

  private async persistTaskMetrics(taskMetrics: TaskExecutionMetrics): Promise<void> {
    try {
      const dbInstance = (this.db as any).db;
      const stmt = dbInstance?.prepare(`
        INSERT INTO agent_tasks (
          id, agent_id, task_type, status, created_at, started_at, completed_at,
          execution_time_ms, confidence_score, tokens_used, model_used, 
          ai_cost_estimate, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt?.run(
        taskMetrics.taskId,
        taskMetrics.agentId,
        taskMetrics.taskType,
        taskMetrics.status,
        taskMetrics.startTime.toISOString(),
        taskMetrics.startTime.toISOString(),
        taskMetrics.endTime?.toISOString() || null,
        taskMetrics.executionTimeMs || null,
        taskMetrics.confidenceScore || null,
        taskMetrics.tokensUsed || null,
        taskMetrics.modelUsed || null,
        taskMetrics.aiCostEstimate || null,
        taskMetrics.errorMessage || null
      );
    } catch (error) {
      logger.error(`Failed to persist task metrics for ${taskMetrics.taskId}:`, error);
    }
  }

  private async updateAgentMetrics(agentId: string): Promise<void> {
    const agentData = this.metricsCache.get(agentId);
    if (!agentData) return;

    try {
      const dbInstance = (this.db as any).db;
      const stmt = dbInstance?.prepare(`
        UPDATE agent_states 
        SET performance_metrics = ?, resource_usage = ?, health_score = ?,
            error_count = ?, success_count = ?, total_executions = ?,
            last_activity = ?, updated_at = ?
        WHERE id = ?
      `);

      stmt?.run(
        JSON.stringify({
          tasksCompleted: agentData.tasksCompleted,
          averageExecutionTime: agentData.averageExecutionTime,
          successRate: agentData.successRate,
          errorsToday: agentData.errorCount
        }),
        JSON.stringify(agentData.resourceUsage),
        agentData.healthScore,
        agentData.errorCount,
        agentData.successCount,
        agentData.tasksCompleted,
        agentData.lastActivity.toISOString(),
        new Date().toISOString(),
        agentId
      );
    } catch (error) {
      logger.error(`Failed to update agent metrics for ${agentId}:`, error);
    }
  }

  private updateSystemMetrics(): void {
    const agents = Array.from(this.metricsCache.values());
    
    this.systemMetrics = {
      totalAgents: agents.length,
      activeAgents: agents.filter(a => a.currentTasks > 0 || 
        (Date.now() - a.lastActivity.getTime()) < 5 * 60 * 1000).length,
      totalTasksCompleted: agents.reduce((sum, a) => sum + a.tasksCompleted, 0),
      averageSuccessRate: agents.length > 0 
        ? agents.reduce((sum, a) => sum + a.successRate, 0) / agents.length 
        : 0,
      totalErrors: agents.reduce((sum, a) => sum + a.errorCount, 0),
      systemUptime: process.uptime(),
      lastUpdated: new Date()
    };
  }

  private collectResourceMetrics(): void {
    const memoryUsage = process.memoryUsage();
    
    // Update resource usage for all agents (simplified - in production, would track per-agent)
    for (const [agentId, agentData] of this.metricsCache) {
      // Simulate CPU usage based on current tasks
      agentData.resourceUsage.cpuPercent = Math.min(agentData.currentTasks * 10, 90);
      agentData.resourceUsage.memoryMB = memoryUsage.heapUsed / 1024 / 1024;
    }
  }

  private calculateHealthScore(agentData: AgentPerformanceData): number {
    let score = 1.0;
    
    // Reduce score based on error rate
    if (agentData.tasksCompleted > 0) {
      const errorRate = agentData.errorCount / agentData.tasksCompleted;
      score -= errorRate * 0.3;
    }
    
    // Reduce score if no recent activity (older than 1 hour)
    const inactiveHours = (Date.now() - agentData.lastActivity.getTime()) / (1000 * 60 * 60);
    if (inactiveHours > 1) {
      score -= Math.min(inactiveHours * 0.1, 0.5);
    }
    
    // Reduce score based on resource usage
    if (agentData.resourceUsage.cpuPercent > 80) {
      score -= 0.1;
    }
    
    return Math.max(0, Math.min(1, score));
  }

  private estimateAICost(tokens?: number, model?: string): number {
    if (!tokens || !model) return 0;
    
    // Simplified cost estimation - in production, use actual pricing
    const costPerToken = model.includes('gpt-4') ? 0.00003 : 0.000002;
    return tokens * costPerToken;
  }

  /**
   * Get top performing agents by success rate
   */
  async getTopPerformingAgents(limit: number = 10, hours: number = 24): Promise<{
    agentId: string;
    agentType: string;
    taskCount: number;
    successRate: number;
    averageExecutionTime: number;
    totalCost: number;
  }[]> {
    try {
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      const dbInstance = (this.db as any).db;
      
      const stmt = dbInstance?.prepare(`
        SELECT 
          at.agent_id,
          as_.type as agent_type,
          COUNT(*) as task_count,
          SUM(CASE WHEN at.status = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate,
          AVG(at.execution_time_ms) as avg_execution_time,
          SUM(at.ai_cost_estimate) as total_cost
        FROM agent_tasks at
        JOIN agent_states as_ ON at.agent_id = as_.id
        WHERE at.created_at > ?
        GROUP BY at.agent_id, as_.type
        HAVING task_count >= 5  -- Only include agents with meaningful task counts
        ORDER BY success_rate DESC, avg_execution_time ASC
        LIMIT ?
      `);
      
      const results = stmt?.all(startTime, limit) || [];
      
      return results.map((row: any) => ({
        agentId: row.agent_id,
        agentType: row.agent_type,
        taskCount: row.task_count,
        successRate: row.success_rate,
        averageExecutionTime: row.avg_execution_time,
        totalCost: row.total_cost || 0
      }));
    } catch (error) {
      logger.error('Failed to get top performing agents', { error });
      return [];
    }
  }

  /**
   * Get error patterns and frequency
   */
  async getErrorAnalysis(hours: number = 168): Promise<{
    commonErrors: { error: string; count: number; agents: string[] }[];
    errorTrends: { date: string; errorCount: number; totalTasks: number }[];
    criticalErrors: { agentId: string; error: string; timestamp: string; taskType: string }[];
  }> {
    try {
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      const dbInstance = (this.db as any).db;
      
      // Get common error patterns
      const errorsStmt = dbInstance?.prepare(`
        SELECT 
          error_message,
          COUNT(*) as error_count,
          GROUP_CONCAT(DISTINCT agent_id) as agents
        FROM agent_tasks 
        WHERE status = 'error' AND error_message IS NOT NULL AND created_at > ?
        GROUP BY error_message
        ORDER BY error_count DESC
        LIMIT 20
      `);
      
      const commonErrors = (errorsStmt?.all(startTime) || []).map((row: any) => ({
        error: row.error_message,
        count: row.error_count,
        agents: row.agents ? row.agents.split(',') : []
      }));
      
      // Get error trends over time
      const trendsStmt = dbInstance?.prepare(`
        SELECT 
          DATE(created_at) as date,
          COUNT(CASE WHEN status = 'error' THEN 1 END) as error_count,
          COUNT(*) as total_tasks
        FROM agent_tasks 
        WHERE created_at > ?
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `);
      
      const errorTrends = trendsStmt?.all(startTime) || [];
      
      // Get recent critical errors
      const criticalStmt = dbInstance?.prepare(`
        SELECT agent_id, error_message, created_at, task_type
        FROM agent_tasks 
        WHERE status = 'error' AND error_message IS NOT NULL 
          AND created_at > datetime('now', '-24 hours', 'utc')
        ORDER BY created_at DESC
        LIMIT 50
      `);
      
      const criticalErrors = (criticalStmt?.all() || []).map((row: any) => ({
        agentId: row.agent_id,
        error: row.error_message,
        timestamp: row.created_at,
        taskType: row.task_type
      }));
      
      return {
        commonErrors,
        errorTrends,
        criticalErrors
      };
    } catch (error) {
      logger.error('Failed to get error analysis', { error });
      return {
        commonErrors: [],
        errorTrends: [],
        criticalErrors: []
      };
    }
  }

  /**
   * Get resource utilization metrics
   */
  async getResourceUtilization(): Promise<{
    overallCpuUsage: number;
    overallMemoryUsage: number;
    agentResourceUsage: {
      agentId: string;
      cpuPercent: number;
      memoryMB: number;
      taskLoad: number;
    }[];
    resourceAlerts: {
      agentId: string;
      alertType: 'high_cpu' | 'high_memory' | 'high_load';
      value: number;
      threshold: number;
    }[];
  }> {
    try {
      const agents = Array.from(this.metricsCache.values());
      
      const overallCpuUsage = agents.length > 0 
        ? agents.reduce((sum, a) => sum + a.resourceUsage.cpuPercent, 0) / agents.length 
        : 0;
      
      const overallMemoryUsage = agents.length > 0 
        ? agents.reduce((sum, a) => sum + a.resourceUsage.memoryMB, 0) / agents.length 
        : 0;
      
      const agentResourceUsage = agents.map(agent => ({
        agentId: agent.agentId,
        cpuPercent: agent.resourceUsage.cpuPercent,
        memoryMB: agent.resourceUsage.memoryMB,
        taskLoad: agent.currentTasks
      }));
      
      // Identify resource alerts
      const resourceAlerts: any[] = [];
      agents.forEach(agent => {
        if (agent.resourceUsage.cpuPercent > 80) {
          resourceAlerts.push({
            agentId: agent.agentId,
            alertType: 'high_cpu',
            value: agent.resourceUsage.cpuPercent,
            threshold: 80
          });
        }
        
        if (agent.resourceUsage.memoryMB > 1024) {
          resourceAlerts.push({
            agentId: agent.agentId,
            alertType: 'high_memory',
            value: agent.resourceUsage.memoryMB,
            threshold: 1024
          });
        }
        
        if (agent.currentTasks > 10) {
          resourceAlerts.push({
            agentId: agent.agentId,
            alertType: 'high_load',
            value: agent.currentTasks,
            threshold: 10
          });
        }
      });
      
      return {
        overallCpuUsage,
        overallMemoryUsage,
        agentResourceUsage,
        resourceAlerts
      };
    } catch (error) {
      logger.error('Failed to get resource utilization', { error });
      return {
        overallCpuUsage: 0,
        overallMemoryUsage: 0,
        agentResourceUsage: [],
        resourceAlerts: []
      };
    }
  }

  /**
   * Clean up old metrics data to prevent database bloat
   */
  async cleanupOldMetrics(olderThanDays: number = 30): Promise<{
    deletedTasks: number;
    deletedHealthChecks: number;
  }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      const cutoff = cutoffDate.toISOString();
      
      const dbInstance = (this.db as any).db;
      
      // Clean up old completed/failed tasks
      const deleteTasksStmt = dbInstance?.prepare(`
        DELETE FROM agent_tasks 
        WHERE created_at < ? AND status IN ('success', 'error', 'timeout', 'cancelled')
      `);
      
      // Clean up old health checks
      const deleteHealthStmt = dbInstance?.prepare(`
        DELETE FROM agent_health_checks 
        WHERE timestamp < ?
      `);
      
      const transaction = dbInstance?.transaction(() => {
        const tasksResult = deleteTasksStmt?.run(cutoff);
        const healthResult = deleteHealthStmt?.run(cutoff);
        
        return {
          deletedTasks: tasksResult?.changes || 0,
          deletedHealthChecks: healthResult?.changes || 0
        };
      });
      
      const result = transaction?.() || { deletedTasks: 0, deletedHealthChecks: 0 };
      
      logger.info('Metrics cleanup completed', {
        ...result,
        olderThanDays,
        cutoffDate: cutoff
      });
      
      return result;
    } catch (error) {
      logger.error('Failed to cleanup old metrics', { error });
      return {
        deletedTasks: 0,
        deletedHealthChecks: 0
      };
    }
  }

  /**
   * Export metrics data for backup or analysis
   */
  async exportMetricsData(startDate: Date, endDate: Date): Promise<{
    agents: any[];
    tasks: any[];
    healthChecks: any[];
    exportedAt: Date;
    recordCount: number;
  }> {
    try {
      const dbInstance = (this.db as any).db;
      
      const agentsStmt = dbInstance?.prepare(`
        SELECT * FROM agent_states
        WHERE updated_at BETWEEN ? AND ?
      `);
      
      const tasksStmt = dbInstance?.prepare(`
        SELECT * FROM agent_tasks
        WHERE created_at BETWEEN ? AND ?
      `);
      
      const healthStmt = dbInstance?.prepare(`
        SELECT * FROM agent_health_checks
        WHERE timestamp BETWEEN ? AND ?
      `);
      
      const agents = agentsStmt?.all(startDate.toISOString(), endDate.toISOString()) || [];
      const tasks = tasksStmt?.all(startDate.toISOString(), endDate.toISOString()) || [];
      const healthChecks = healthStmt?.all(startDate.toISOString(), endDate.toISOString()) || [];
      
      const exportData = {
        agents,
        tasks,
        healthChecks,
        exportedAt: new Date(),
        recordCount: agents.length + tasks.length + healthChecks.length
      };
      
      logger.info('Metrics data export completed', {
        agentCount: agents.length,
        taskCount: tasks.length,
        healthCheckCount: healthChecks.length,
        totalRecords: exportData.recordCount
      });
      
      return exportData;
    } catch (error) {
      logger.error('Failed to export metrics data', { error });
      return {
        agents: [],
        tasks: [],
        healthChecks: [],
        exportedAt: new Date(),
        recordCount: 0
      };
    }
  }

  /**
   * Cleanup metrics for removed agents
   */
  unregisterAgent(agentId: string): void {
    this.metricsCache.delete(agentId);
    logger.info(`Agent unregistered from metrics collection: ${agentId}`);
  }

  /**
   * Validate data consistency between cache and database
   */
  async validateDataConsistency(): Promise<{
    isConsistent: boolean;
    issues: string[];
    cacheCount: number;
    dbCount: number;
  }> {
    try {
      const issues: string[] = [];
      const cacheCount = this.metricsCache.size;
      
      const dbInstance = (this.db as any).db;
      const dbCountResult = dbInstance?.prepare('SELECT COUNT(*) as count FROM agent_states').get();
      const dbCount = dbCountResult?.count || 0;
      
      // Check for missing agents in database
      for (const [agentId, agentData] of this.metricsCache) {
        const dbAgent = dbInstance?.prepare('SELECT id FROM agent_states WHERE id = ?').get(agentId);
        if (!dbAgent) {
          issues.push(`Agent ${agentId} exists in cache but not in database`);
        }
      }
      
      // Check for orphaned database records
      const dbAgents = dbInstance?.prepare('SELECT id FROM agent_states').all() || [];
      for (const dbAgent of dbAgents) {
        if (!this.metricsCache.has(dbAgent.id)) {
          issues.push(`Agent ${dbAgent.id} exists in database but not in cache`);
        }
      }
      
      // Check task count consistency for active agents
      for (const [agentId, agentData] of this.metricsCache) {
        const dbTaskCount = dbInstance?.prepare(
          'SELECT COUNT(*) as count FROM agent_tasks WHERE agent_id = ?'
        ).get(agentId);
        
        if (dbTaskCount && Math.abs(agentData.tasksCompleted - dbTaskCount.count) > 5) {
          issues.push(`Task count mismatch for agent ${agentId}: cache=${agentData.tasksCompleted}, db=${dbTaskCount.count}`);
        }
      }
      
      const isConsistent = issues.length === 0 && Math.abs(cacheCount - dbCount) <= 1;
      
      if (!isConsistent) {
        logger.warn('Data consistency issues detected', {
          issues,
          cacheCount,
          dbCount
        });
      }
      
      return {
        isConsistent,
        issues,
        cacheCount,
        dbCount
      };
    } catch (error) {
      logger.error('Failed to validate data consistency', { error });
      return {
        isConsistent: false,
        issues: ['Data consistency validation failed'],
        cacheCount: 0,
        dbCount: 0
      };
    }
  }

  /**
   * Synchronize cache with database
   */
  async synchronizeWithDatabase(): Promise<void> {
    try {
      logger.info('Starting cache-database synchronization');
      
      const dbInstance = (this.db as any).db;
      
      // Get all agents from database
      const dbAgents = dbInstance?.prepare(`
        SELECT 
          as_.*,
          COUNT(at.id) as total_tasks,
          COUNT(CASE WHEN at.status = 'success' THEN 1 END) as success_count,
          COUNT(CASE WHEN at.status = 'error' THEN 1 END) as error_count,
          AVG(at.execution_time_ms) as avg_execution_time
        FROM agent_states as_
        LEFT JOIN agent_tasks at ON as_.id = at.agent_id
        GROUP BY as_.id
      `).all() || [];
      
      // Update cache from database data
      for (const dbAgent of dbAgents) {
        let cacheAgent = this.metricsCache.get(dbAgent.id);
        
        if (!cacheAgent) {
          // Create cache entry for database agent
          cacheAgent = {
            agentId: dbAgent.id,
            type: dbAgent.type,
            tasksCompleted: dbAgent.total_tasks || 0,
            totalExecutionTime: (dbAgent.avg_execution_time || 0) * (dbAgent.total_tasks || 0),
            successCount: dbAgent.success_count || 0,
            errorCount: dbAgent.error_count || 0,
            averageExecutionTime: dbAgent.avg_execution_time || 0,
            successRate: dbAgent.total_tasks > 0 ? (dbAgent.success_count / dbAgent.total_tasks) : 0,
            lastActivity: new Date(dbAgent.last_activity || new Date()),
            currentTasks: 0,
            resourceUsage: JSON.parse(dbAgent.resource_usage || '{}'),
            healthScore: dbAgent.health_score || 1.0
          };
          
          this.metricsCache.set(dbAgent.id, cacheAgent);
        } else {
          // Update existing cache entry with database data
          cacheAgent.tasksCompleted = Math.max(cacheAgent.tasksCompleted, dbAgent.total_tasks || 0);
          cacheAgent.successCount = Math.max(cacheAgent.successCount, dbAgent.success_count || 0);
          cacheAgent.errorCount = Math.max(cacheAgent.errorCount, dbAgent.error_count || 0);
          cacheAgent.healthScore = dbAgent.health_score || cacheAgent.healthScore;
        }
      }
      
      // Persist current cache state to database
      for (const [agentId, agentData] of this.metricsCache) {
        await this.updateAgentMetrics(agentId);
      }
      
      logger.info('Cache-database synchronization completed', {
        dbAgents: dbAgents.length,
        cacheAgents: this.metricsCache.size
      });
    } catch (error) {
      logger.error('Failed to synchronize with database', { error });
    }
  }

  /**
   * Cleanup and shutdown
   */
  shutdown(): void {
    if (this.metricsUpdateInterval) {
      clearInterval(this.metricsUpdateInterval);
      this.metricsUpdateInterval = null;
    }
    
    this.removeAllListeners();
    logger.info('MetricsCollector shutdown complete');
  }
}

// Singleton instance
export const metricsCollector = new MetricsCollector();