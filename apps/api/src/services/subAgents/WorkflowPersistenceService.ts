/**
 * Workflow Execution Persistence Service
 * Manages comprehensive workflow execution tracking and persistence
 */

import { EventEmitter } from 'events';
import { logger } from '@/utils/logger';
import { getDatabase } from '@/database/database';
import type { SchedulerDatabase } from '@/database/database';
import type { 
  AgentWorkflow, 
  AgentResult, 
  WorkflowResult,
  AgentTask 
} from '@/types/agents';

export interface WorkflowExecutionRecord {
  id: string;
  workflowId: string;
  workflowName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  
  // Workflow configuration
  context: Record<string, any>;
  configuration: Record<string, any>;
  
  // Progress tracking
  stepsTotal: number;
  stepsCompleted: number;
  stepsFailed: number;
  successRate: number;
  
  // Error tracking
  errorMessage?: string;
  errorStepId?: string;
  errorDetails?: Record<string, any>;
  
  // Metadata
  createdBy: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  tags?: string[];
}

export interface WorkflowStepRecord {
  id: string;
  workflowExecutionId: string;
  stepId: string;
  stepType: string;
  stepName?: string;
  
  // Execution details
  agentId?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'cancelled';
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  
  // Step data
  inputData: Record<string, any>;
  outputData: Record<string, any>;
  contextData: Record<string, any>;
  
  // Dependencies and requirements
  dependencies: string[];
  requirements: string[];
  
  // Results and metrics
  confidenceScore?: number;
  qualityScore?: number;
  artifacts: string[];
  recommendations: string[];
  
  // Error handling
  errorMessage?: string;
  errorDetails?: Record<string, any>;
  retryCount: number;
  maxRetries: number;
  
  // AI usage tracking
  tokensUsed?: number;
  modelUsed?: string;
  aiCostEstimate: number;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  
  // Template definition
  steps: any[];
  defaultContext: Record<string, any>;
  estimatedDuration: number;
  
  // Template metadata
  tags: string[];
  testFiles: string[];
  successRate: number;
  usageCount: number;
  
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class WorkflowPersistenceService extends EventEmitter {
  private db: SchedulerDatabase;
  private activeWorkflows = new Map<string, WorkflowExecutionRecord>();

  constructor() {
    super();
    this.db = getDatabase();
    logger.info('WorkflowPersistenceService initialized');
  }

  /**
   * Start tracking a workflow execution
   */
  async startWorkflowExecution(
    workflowId: string,
    workflow: AgentWorkflow,
    options?: {
      priority?: 'low' | 'medium' | 'high' | 'critical';
      createdBy?: string;
      tags?: string[];
    }
  ): Promise<WorkflowExecutionRecord> {
    try {
      const executionRecord: WorkflowExecutionRecord = {
        id: `exec_${workflowId}_${Date.now()}`,
        workflowId,
        workflowName: workflow.name || 'Unnamed Workflow',
        status: 'pending',
        startedAt: new Date(),
        context: workflow.context || {},
        configuration: {},
        stepsTotal: workflow.steps.length,
        stepsCompleted: 0,
        stepsFailed: 0,
        successRate: 0,
        createdBy: options?.createdBy || 'system',
        priority: options?.priority || 'medium',
        tags: options?.tags || []
      };

      // Persist to database
      await this.persistWorkflowExecution(executionRecord);
      
      // Track in memory
      this.activeWorkflows.set(workflowId, executionRecord);
      
      this.emit('workflowStarted', executionRecord);
      
      logger.info('Workflow execution started', {
        workflowId,
        executionId: executionRecord.id,
        stepsTotal: executionRecord.stepsTotal
      });

      return executionRecord;
    } catch (error) {
      logger.error(`Failed to start workflow execution: ${workflowId}`, { error });
      throw error;
    }
  }

  /**
   * Update workflow execution status
   */
  async updateWorkflowStatus(
    workflowId: string,
    status: WorkflowExecutionRecord['status'],
    metadata?: {
      errorMessage?: string;
      errorStepId?: string;
      errorDetails?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      const executionRecord = this.activeWorkflows.get(workflowId);
      if (!executionRecord) {
        logger.warn(`Workflow execution not found for status update: ${workflowId}`);
        return;
      }

      executionRecord.status = status;
      
      if (status === 'completed' || status === 'failed' || status === 'cancelled') {
        executionRecord.completedAt = new Date();
        executionRecord.duration = executionRecord.completedAt.getTime() - executionRecord.startedAt.getTime();
        
        // Calculate success rate
        if (executionRecord.stepsTotal > 0) {
          executionRecord.successRate = executionRecord.stepsCompleted / executionRecord.stepsTotal;
        }
      }

      if (metadata) {
        executionRecord.errorMessage = metadata.errorMessage;
        executionRecord.errorStepId = metadata.errorStepId;
        executionRecord.errorDetails = metadata.errorDetails;
      }

      // Update in database
      await this.updateWorkflowExecutionInDB(executionRecord);
      
      this.emit('workflowStatusUpdated', { workflowId, status, executionRecord });
      
      logger.debug('Workflow status updated', {
        workflowId,
        status,
        duration: executionRecord.duration
      });
    } catch (error) {
      logger.error(`Failed to update workflow status: ${workflowId}`, { error });
    }
  }

  /**
   * Track workflow step execution
   */
  async trackStepExecution(
    workflowId: string,
    stepId: string,
    stepData: {
      stepType: string;
      stepName?: string;
      agentId?: string;
      task: AgentTask;
      dependencies?: string[];
    }
  ): Promise<WorkflowStepRecord> {
    try {
      const executionRecord = this.activeWorkflows.get(workflowId);
      if (!executionRecord) {
        throw new Error(`Workflow execution not found: ${workflowId}`);
      }

      const stepRecord: WorkflowStepRecord = {
        id: `step_${workflowId}_${stepId}_${Date.now()}`,
        workflowExecutionId: executionRecord.id,
        stepId,
        stepType: stepData.stepType,
        stepName: stepData.stepName || stepId,
        agentId: stepData.agentId,
        status: 'running',
        startedAt: new Date(),
        inputData: stepData.task.data || {},
        outputData: {},
        contextData: stepData.task.context || {},
        dependencies: stepData.dependencies || [],
        requirements: stepData.task.requirements || [],
        confidenceScore: undefined,
        qualityScore: undefined,
        artifacts: [],
        recommendations: [],
        retryCount: 0,
        maxRetries: 3,
        aiCostEstimate: 0
      };

      // Persist step to database
      await this.persistWorkflowStep(stepRecord);
      
      this.emit('stepStarted', { workflowId, stepId, stepRecord });
      
      logger.debug('Workflow step execution started', {
        workflowId,
        stepId,
        agentId: stepData.agentId
      });

      return stepRecord;
    } catch (error) {
      logger.error(`Failed to track step execution: ${workflowId}/${stepId}`, { error });
      throw error;
    }
  }

  /**
   * Complete workflow step execution
   */
  async completeStepExecution(
    workflowId: string,
    stepId: string,
    result: AgentResult
  ): Promise<void> {
    try {
      const dbInstance = (this.db as any).db;
      if (!dbInstance) return;

      // Update step record in database
      const updateStepStmt = dbInstance.prepare(`
        UPDATE workflow_step_executions 
        SET status = ?, completed_at = ?, duration_ms = ?,
            output_data = ?, confidence_score = ?, quality_score = ?,
            artifacts = ?, recommendations = ?, error_message = ?,
            error_details = ?, tokens_used = ?, model_used = ?,
            ai_cost_estimate = ?, updated_at = ?
        WHERE step_id = ? AND workflow_execution_id IN (
          SELECT id FROM workflow_executions WHERE workflow_id = ?
        )
      `);

      const now = new Date();
      const duration = result.executionTime || 0;

      updateStepStmt.run(
        result.status,
        now.toISOString(),
        duration,
        JSON.stringify(result.data || {}),
        result.confidence,
        result.metadata?.qualityScore,
        JSON.stringify(result.metadata?.artifacts || []),
        JSON.stringify(result.metadata?.recommendations || []),
        result.error,
        JSON.stringify(result.metadata?.errorDetails || {}),
        result.metadata?.tokensUsed,
        result.metadata?.modelUsed,
        this.estimateAICost(result.metadata?.tokensUsed, result.metadata?.modelUsed),
        now.toISOString(),
        stepId,
        workflowId
      );

      // Update workflow execution progress
      const executionRecord = this.activeWorkflows.get(workflowId);
      if (executionRecord) {
        if (result.status === 'success') {
          executionRecord.stepsCompleted++;
        } else if (result.status === 'error') {
          executionRecord.stepsFailed++;
        }

        // Update workflow status if needed
        const totalProcessed = executionRecord.stepsCompleted + executionRecord.stepsFailed;
        if (totalProcessed === executionRecord.stepsTotal) {
          const status = executionRecord.stepsFailed === 0 ? 'completed' : 'failed';
          await this.updateWorkflowStatus(workflowId, status);
        } else {
          executionRecord.status = 'running';
          await this.updateWorkflowExecutionInDB(executionRecord);
        }
      }

      this.emit('stepCompleted', { workflowId, stepId, result });
      
      logger.debug('Workflow step execution completed', {
        workflowId,
        stepId,
        status: result.status,
        duration
      });
    } catch (error) {
      logger.error(`Failed to complete step execution: ${workflowId}/${stepId}`, { error });
    }
  }

  /**
   * Get workflow execution history
   */
  async getWorkflowHistory(options?: {
    limit?: number;
    offset?: number;
    status?: string[];
    fromDate?: Date;
    toDate?: Date;
  }): Promise<{ executions: WorkflowExecutionRecord[]; total: number }> {
    try {
      const dbInstance = (this.db as any).db;
      if (!dbInstance) return { executions: [], total: 0 };

      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (options?.status && options.status.length > 0) {
        const placeholders = options.status.map(() => '?').join(',');
        whereClause += ` AND status IN (${placeholders})`;
        params.push(...options.status);
      }

      if (options?.fromDate) {
        whereClause += ' AND started_at >= ?';
        params.push(options.fromDate.toISOString());
      }

      if (options?.toDate) {
        whereClause += ' AND started_at <= ?';
        params.push(options.toDate.toISOString());
      }

      // Get total count
      const countStmt = dbInstance.prepare(`
        SELECT COUNT(*) as total FROM workflow_executions ${whereClause}
      `);
      const { total } = countStmt.get(...params);

      // Get executions with pagination
      const limit = Math.min(options?.limit || 50, 100);
      const offset = options?.offset || 0;

      const executionsStmt = dbInstance.prepare(`
        SELECT * FROM workflow_executions 
        ${whereClause}
        ORDER BY started_at DESC
        LIMIT ? OFFSET ?
      `);

      const rows = executionsStmt.all(...params, limit, offset);
      
      const executions = rows.map(this.mapWorkflowExecutionRow);

      return { executions, total };
    } catch (error) {
      logger.error('Failed to get workflow history', { error });
      return { executions: [], total: 0 };
    }
  }

  /**
   * Get detailed workflow execution with steps
   */
  async getWorkflowExecutionDetails(workflowId: string): Promise<{
    execution: WorkflowExecutionRecord | null;
    steps: WorkflowStepRecord[];
  }> {
    try {
      const dbInstance = (this.db as any).db;
      if (!dbInstance) return { execution: null, steps: [] };

      // Get workflow execution
      const executionStmt = dbInstance.prepare(`
        SELECT * FROM workflow_executions WHERE workflow_id = ?
      `);
      const executionRow = executionStmt.get(workflowId);
      
      if (!executionRow) {
        return { execution: null, steps: [] };
      }

      const execution = this.mapWorkflowExecutionRow(executionRow);

      // Get workflow steps
      const stepsStmt = dbInstance.prepare(`
        SELECT * FROM workflow_step_executions 
        WHERE workflow_execution_id = ?
        ORDER BY started_at ASC
      `);
      const stepRows = stepsStmt.all(execution.id);
      
      const steps = stepRows.map(this.mapWorkflowStepRow);

      return { execution, steps };
    } catch (error) {
      logger.error(`Failed to get workflow execution details: ${workflowId}`, { error });
      return { execution: null, steps: [] };
    }
  }

  /**
   * Get workflow analytics
   */
  async getWorkflowAnalytics(days: number = 30): Promise<{
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageExecutionTime: number;
    mostUsedWorkflows: { workflowName: string; count: number }[];
    performanceTrends: { date: string; executions: number; successRate: number }[];
  }> {
    try {
      const dbInstance = (this.db as any).db;
      if (!dbInstance) return this.getEmptyAnalytics();

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get overall statistics
      const statsStmt = dbInstance.prepare(`
        SELECT 
          COUNT(*) as total_executions,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_executions,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_executions,
          AVG(duration_ms) as avg_execution_time
        FROM workflow_executions 
        WHERE started_at >= ?
      `);
      const stats = statsStmt.get(startDate.toISOString());

      // Get most used workflows
      const mostUsedStmt = dbInstance.prepare(`
        SELECT workflow_name, COUNT(*) as count
        FROM workflow_executions 
        WHERE started_at >= ?
        GROUP BY workflow_name
        ORDER BY count DESC
        LIMIT 10
      `);
      const mostUsedWorkflows = mostUsedStmt.all(startDate.toISOString());

      // Get performance trends
      const trendsStmt = dbInstance.prepare(`
        SELECT 
          DATE(started_at) as date,
          COUNT(*) as executions,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*) as success_rate
        FROM workflow_executions 
        WHERE started_at >= ?
        GROUP BY DATE(started_at)
        ORDER BY date ASC
      `);
      const performanceTrends = trendsStmt.all(startDate.toISOString());

      return {
        totalExecutions: stats.total_executions || 0,
        successfulExecutions: stats.successful_executions || 0,
        failedExecutions: stats.failed_executions || 0,
        averageExecutionTime: stats.avg_execution_time || 0,
        mostUsedWorkflows,
        performanceTrends
      };
    } catch (error) {
      logger.error('Failed to get workflow analytics', { error });
      return this.getEmptyAnalytics();
    }
  }

  /**
   * Clean up old workflow executions
   */
  async cleanupOldExecutions(olderThanDays: number = 90): Promise<{
    deletedExecutions: number;
    deletedSteps: number;
  }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      const cutoff = cutoffDate.toISOString();

      const dbInstance = (this.db as any).db;
      
      const transaction = dbInstance.transaction(() => {
        // Delete old workflow steps
        const deleteStepsStmt = dbInstance.prepare(`
          DELETE FROM workflow_step_executions 
          WHERE workflow_execution_id IN (
            SELECT id FROM workflow_executions 
            WHERE started_at < ? AND status IN ('completed', 'failed', 'cancelled')
          )
        `);
        
        // Delete old workflow executions
        const deleteExecutionsStmt = dbInstance.prepare(`
          DELETE FROM workflow_executions 
          WHERE started_at < ? AND status IN ('completed', 'failed', 'cancelled')
        `);

        const stepsResult = deleteStepsStmt.run(cutoff);
        const executionsResult = deleteExecutionsStmt.run(cutoff);

        return {
          deletedExecutions: executionsResult.changes || 0,
          deletedSteps: stepsResult.changes || 0
        };
      });

      const result = transaction();
      
      logger.info('Workflow cleanup completed', {
        ...result,
        olderThanDays,
        cutoffDate: cutoff
      });

      return result;
    } catch (error) {
      logger.error('Failed to cleanup old workflow executions', { error });
      return {
        deletedExecutions: 0,
        deletedSteps: 0
      };
    }
  }

  /**
   * Private helper methods
   */
  private async persistWorkflowExecution(execution: WorkflowExecutionRecord): Promise<void> {
    try {
      const dbInstance = (this.db as any).db;
      if (!dbInstance) return;

      const stmt = dbInstance.prepare(`
        INSERT INTO workflow_executions (
          id, workflow_id, workflow_name, status, started_at,
          context, configuration, steps_total, steps_completed,
          steps_failed, success_rate, created_by, priority
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        execution.id,
        execution.workflowId,
        execution.workflowName,
        execution.status,
        execution.startedAt.toISOString(),
        JSON.stringify(execution.context),
        JSON.stringify(execution.configuration),
        execution.stepsTotal,
        execution.stepsCompleted,
        execution.stepsFailed,
        execution.successRate,
        execution.createdBy,
        execution.priority
      );
    } catch (error) {
      logger.error('Failed to persist workflow execution', { error });
    }
  }

  private async updateWorkflowExecutionInDB(execution: WorkflowExecutionRecord): Promise<void> {
    try {
      const dbInstance = (this.db as any).db;
      if (!dbInstance) return;

      const stmt = dbInstance.prepare(`
        UPDATE workflow_executions 
        SET status = ?, completed_at = ?, duration_ms = ?,
            steps_completed = ?, steps_failed = ?, success_rate = ?,
            error_message = ?, error_step_id = ?, error_details = ?,
            updated_at = ?
        WHERE id = ?
      `);

      stmt.run(
        execution.status,
        execution.completedAt?.toISOString() || null,
        execution.duration || null,
        execution.stepsCompleted,
        execution.stepsFailed,
        execution.successRate,
        execution.errorMessage || null,
        execution.errorStepId || null,
        JSON.stringify(execution.errorDetails || {}),
        new Date().toISOString(),
        execution.id
      );
    } catch (error) {
      logger.error('Failed to update workflow execution in database', { error });
    }
  }

  private async persistWorkflowStep(step: WorkflowStepRecord): Promise<void> {
    try {
      const dbInstance = (this.db as any).db;
      if (!dbInstance) return;

      const stmt = dbInstance.prepare(`
        INSERT INTO workflow_step_executions (
          id, workflow_execution_id, step_id, step_type, step_name,
          agent_id, status, started_at, input_data, context_data,
          dependencies, requirements, retry_count, max_retries
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        step.id,
        step.workflowExecutionId,
        step.stepId,
        step.stepType,
        step.stepName,
        step.agentId,
        step.status,
        step.startedAt?.toISOString(),
        JSON.stringify(step.inputData),
        JSON.stringify(step.contextData),
        JSON.stringify(step.dependencies),
        JSON.stringify(step.requirements),
        step.retryCount,
        step.maxRetries
      );
    } catch (error) {
      logger.error('Failed to persist workflow step', { error });
    }
  }

  private mapWorkflowExecutionRow(row: any): WorkflowExecutionRecord {
    return {
      id: row.id,
      workflowId: row.workflow_id,
      workflowName: row.workflow_name,
      status: row.status,
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      duration: row.duration_ms,
      context: JSON.parse(row.context || '{}'),
      configuration: JSON.parse(row.configuration || '{}'),
      stepsTotal: row.steps_total,
      stepsCompleted: row.steps_completed,
      stepsFailed: row.steps_failed,
      successRate: row.success_rate,
      errorMessage: row.error_message,
      errorStepId: row.error_step_id,
      errorDetails: JSON.parse(row.error_details || '{}'),
      createdBy: row.created_by,
      priority: row.priority
    };
  }

  private mapWorkflowStepRow(row: any): WorkflowStepRecord {
    return {
      id: row.id,
      workflowExecutionId: row.workflow_execution_id,
      stepId: row.step_id,
      stepType: row.step_type,
      stepName: row.step_name,
      agentId: row.agent_id,
      status: row.status,
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      duration: row.duration_ms,
      inputData: JSON.parse(row.input_data || '{}'),
      outputData: JSON.parse(row.output_data || '{}'),
      contextData: JSON.parse(row.context_data || '{}'),
      dependencies: JSON.parse(row.dependencies || '[]'),
      requirements: JSON.parse(row.requirements || '[]'),
      confidenceScore: row.confidence_score,
      qualityScore: row.quality_score,
      artifacts: JSON.parse(row.artifacts || '[]'),
      recommendations: JSON.parse(row.recommendations || '[]'),
      errorMessage: row.error_message,
      errorDetails: JSON.parse(row.error_details || '{}'),
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      tokensUsed: row.tokens_used,
      modelUsed: row.model_used,
      aiCostEstimate: row.ai_cost_estimate || 0
    };
  }

  private estimateAICost(tokens?: number, model?: string): number {
    if (!tokens || !model) return 0;
    
    // Simplified cost estimation
    const costPerToken = model.includes('gpt-4') ? 0.00003 : 0.000002;
    return tokens * costPerToken;
  }

  private getEmptyAnalytics() {
    return {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      mostUsedWorkflows: [],
      performanceTrends: []
    };
  }
}

// Singleton instance
export const workflowPersistenceService = new WorkflowPersistenceService();