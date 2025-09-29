/**
 * Claude Code Sub-Agent Orchestration Engine
 * Enterprise-grade sub-agent management for QA Intelligence
 */

import { EventEmitter } from 'events';
import { logger } from '@/utils/logger';
import { healthMonitor } from './HealthMonitor';
import { metricsCollector } from './MetricsCollector';
import { getDatabase } from '@/database/database';
import type { SchedulerDatabase } from '@/database/database';
import type { 
  SubAgent, 
  AgentTask, 
  AgentWorkflow, 
  AgentResult, 
  WorkflowResult,
  AgentType,
  AgentStatus,
  AgentCapability,
  TaskType,
  STEP_CAPABILITY_MAPPING 
} from '@/types/agents';

export class AgentOrchestrator extends EventEmitter {
  private agents = new Map<string, SubAgent>();
  private activeWorkflows = new Map<string, AgentWorkflow>();
  private taskQueue: AgentTask[] = [];
  private isProcessing = false;
  private db: SchedulerDatabase;

  constructor() {
    super();
    this.db = getDatabase();
    this.startTaskProcessor();
    this.loadPersistedAgentStates();
  }

  /**
   * Register a new sub-agent with the orchestrator
   */
  async registerAgent(agent: SubAgent): Promise<void> {
    logger.info(`Registering sub-agent: ${agent.id} (${agent.type})`);
    
    try {
      // Validate agent capabilities
      await this.validateAgentCapabilities(agent);
      
      this.agents.set(agent.id, agent);
      
      // Persist agent state to database
      await this.persistAgentRegistration(agent);
      
      // Register with health monitor
      healthMonitor.registerAgent(agent);
      
      // Register with metrics collector
      await metricsCollector.registerAgent(agent);
      
      this.emit('agentRegistered', { agentId: agent.id, type: agent.type });

      // Setup inter-agent event connections for real-time analysis
      this.setupAgentConnections(agent);

      logger.info(`Sub-agent registered successfully: ${agent.id}`);
    } catch (error) {
      logger.error(`Failed to register agent ${agent.id}`, { error });
      throw error;
    }
  }

  /**
   * Setup inter-agent event connections for real-time collaboration
   */
  private setupAgentConnections(agent: SubAgent): void {
    try {
      // Connect TestIntelligenceAgent to FailureAnalysisAgent for real-time failure analysis
      if (agent.type === 'test-intelligence') {
        const failureAnalysisAgent = this.agents.get('failure-analysis-agent');
        if (failureAnalysisAgent && 'emit' in failureAnalysisAgent) {
          (failureAnalysisAgent as any).emit('testIntelligenceAgentReady', agent);
          logger.info('Connected TestIntelligenceAgent to FailureAnalysisAgent for real-time analysis');
        }
      }

      // Connect FailureAnalysisAgent to TestIntelligenceAgent when FailureAnalysisAgent is registered
      if (agent.type === 'failure-analysis') {
        const testIntelligenceAgent = this.agents.get('test-intelligence-agent');
        if (testIntelligenceAgent && 'emit' in agent) {
          (agent as any).emit('testIntelligenceAgentReady', testIntelligenceAgent);
          logger.info('Connected FailureAnalysisAgent to TestIntelligenceAgent for real-time analysis');
        }
      }

      // Setup JiraIntegrationAgent connections for issue creation from failures
      if (agent.type === 'failure-analysis') {
        const jiraAgent = this.agents.get('jira-integration-agent');
        if (jiraAgent && 'on' in agent) {
          // Listen for failure analysis completion to potentially create Jira issues
          (agent as any).on('failureAnalysisComplete', async (eventData: any) => {
            if (eventData.analysis.confidence > 0.8 && eventData.analysis.patterns.includes('recurring-failure')) {
              // Trigger Jira issue creation for high-confidence recurring failures
              this.emit('createJiraIssue', {
                testId: eventData.testId,
                analysis: eventData.analysis,
                timestamp: eventData.timestamp
              });
            }
          });

          logger.info('Setup FailureAnalysisAgent to JiraIntegrationAgent issue creation pipeline');
        }
      }

    } catch (error) {
      logger.error('Failed to setup agent connections', { agentId: agent.id, error });
    }
  }

  /**
   * Execute a complex workflow using multiple sub-agents
   */
  async executeWorkflow(workflow: AgentWorkflow): Promise<WorkflowResult> {
    const workflowId = this.generateWorkflowId();
    logger.info(`Starting workflow execution: ${workflowId}`);

    this.activeWorkflows.set(workflowId, workflow);
    
    // Persist workflow execution start to database
    const workflowExecution = await this.persistWorkflowStart(workflowId, workflow);
    
    const startTime = Date.now();
    
    try {

      // Execute workflow steps with dependency handling
      const completedSteps = new Map<string, AgentResult>();
      const stepResults: AgentResult[] = [];
      
      for (const step of workflow.steps) {
        // Check dependencies before executing
        if (step.dependsOn && step.dependsOn.length > 0) {
          const dependenciesMet = step.dependsOn.every(depId => completedSteps.has(depId));
          if (!dependenciesMet) {
            const missingDeps = step.dependsOn.filter(depId => !completedSteps.has(depId));
            throw new Error(`Step ${step.id} dependencies not met: ${missingDeps.join(', ')}`);
          }
        }

        // Get enhanced requirements based on step type
        const enhancedRequirements = this.getEnhancedRequirements(step.type, step.requirements);
        const agent = this.selectOptimalAgent(enhancedRequirements);
        
        if (!agent) {
          throw new Error(`No suitable agent found for step: ${step.id} (type: ${step.type})`);
        }

        logger.info(`Executing workflow step ${step.id} with agent ${agent.id}`);
        
        // Create task with enhanced context including previous step results
        const task: AgentTask = {
          id: step.id,
          type: step.type,
          data: step.data,
          context: {
            ...workflow.context,
            previousResults: stepResults,
            dependencyResults: step.dependsOn?.reduce((deps, depId) => {
              const depResult = completedSteps.get(depId);
              if (depResult) deps[depId] = depResult;
              return deps;
            }, {} as Record<string, AgentResult>) || {}
          },
          requirements: enhancedRequirements,
          timeout: step.timeout
        };

        // Persist workflow step start to database
        await this.persistWorkflowStepStart(workflowId, step, agent.id, task);

        const result = await agent.execute(task);
        
        // Persist workflow step completion to database
        await this.persistWorkflowStepCompletion(workflowId, step.id, result);
        
        stepResults.push(result);
        completedSteps.set(step.id, result);
        
        // Check for early termination conditions
        if (result.status === 'error' && step.criticalFailure) {
          throw new Error(`Critical step failed: ${step.id} - ${result.error}`);
        }
      }

      const duration = Date.now() - startTime;
      const workflowResult: WorkflowResult = {
        workflowId,
        status: 'completed',
        results: stepResults,
        duration,
        completedAt: new Date()
      };

      // Persist workflow completion to database
      await this.persistWorkflowCompletion(workflowId, workflowResult, stepResults);

      this.emit('workflowCompleted', workflowResult);
      return workflowResult;

    } catch (error) {
      logger.error(`Workflow ${workflowId} failed:`, error);
      
      const workflowResult: WorkflowResult = {
        workflowId,
        status: 'failed',
        results: [],
        duration: Date.now() - startTime,
        completedAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      // Persist workflow failure to database
      await this.persistWorkflowFailure(workflowId, workflowResult, error);

      this.emit('workflowFailed', workflowResult);
      return workflowResult;

    } finally {
      this.activeWorkflows.delete(workflowId);
    }
  }

  /**
   * Delegate a single task to the most suitable agent
   */
  async delegateTask(task: AgentTask): Promise<AgentResult> {
    const agent = this.selectOptimalAgent(task.requirements || []);
    
    if (!agent) {
      throw new Error(`No suitable agent found for task: ${task.id}`);
    }

    logger.info(`Delegating task ${task.id} to agent ${agent.id}`);
    
    // Update agent status to busy
    await this.updateAgentStatus(agent.id, 'busy', task.id);
    
    // Record task start for metrics
    metricsCollector.recordTaskStart(task, agent.id);
    
    try {
      const result = await agent.execute(task);
      
      // Update agent status back to active
      await this.updateAgentStatus(agent.id, 'active');
      
      // Record task completion for metrics
      await metricsCollector.recordTaskCompletion(task, result);
      
      return result;
    } catch (error) {
      // Update agent status to error
      await this.updateAgentStatus(agent.id, 'error');
      
      // Record failed task for metrics
      const failedResult: AgentResult = {
        taskId: task.id,
        agentId: agent.id,
        status: 'error',
        data: {},
        executionTime: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      
      await metricsCollector.recordTaskCompletion(task, failedResult);
      throw error;
    }
  }

  /**
   * Update agent status in database
   */
  async updateAgentStatus(agentId: string, status: string, currentTask?: string): Promise<void> {
    try {
      const dbInstance = (this.db as any).db;
      if (!dbInstance) return;
      
      const stmt = dbInstance.prepare(`
        UPDATE agent_states 
        SET status = ?, current_task = ?, last_activity = ?, updated_at = ?
        WHERE id = ?
      `);
      
      const now = new Date().toISOString();
      stmt.run(status, currentTask || null, now, now, agentId);
      
      logger.debug(`Updated agent status: ${agentId} -> ${status}`);
    } catch (error) {
      logger.error(`Failed to update agent status: ${agentId}`, { error });
    }
  }

  /**
   * Get real-time status of all agents
   */
  getAgentStatus(): Record<string, AgentStatus> {
    const status: Record<string, AgentStatus> = {};
    
    for (const [id, agent] of this.agents) {
      // Get real performance metrics from MetricsCollector
      const performanceData = metricsCollector.getAgentMetricsById(id);
      
      status[id] = {
        id: agent.id,
        type: agent.type,
        status: agent.status,
        capabilities: agent.capabilities,
        lastActivity: agent.lastActivity,
        currentTask: agent.currentTask,
        performance: performanceData ? {
          tasksCompleted: performanceData.tasksCompleted,
          averageExecutionTime: performanceData.averageExecutionTime,
          successRate: performanceData.successRate,
          errorsToday: performanceData.errorCount
        } : {
          tasksCompleted: 0,
          averageExecutionTime: 0,
          successRate: 0,
          errorsToday: 0
        },
        resourceUsage: performanceData ? performanceData.resourceUsage : {
          cpuPercent: 0,
          memoryMB: 0
        }
      };
    }

    return status;
  }

  /**
   * Get persisted agent data from database
   */
  async getPersistedAgentData(): Promise<any[]> {
    try {
      const dbInstance = (this.db as any).db;
      if (!dbInstance) return [];
      
      const stmt = dbInstance.prepare(`
        SELECT 
          as_.*,
          COUNT(at.id) as total_tasks,
          COUNT(CASE WHEN at.status = 'success' THEN 1 END) as successful_tasks,
          COUNT(CASE WHEN at.status = 'error' THEN 1 END) as failed_tasks,
          AVG(at.execution_time_ms) as avg_execution_time,
          MAX(ahc.timestamp) as last_health_check
        FROM agent_states as_
        LEFT JOIN agent_tasks at ON as_.id = at.agent_id
        LEFT JOIN agent_health_checks ahc ON as_.id = ahc.agent_id
        GROUP BY as_.id
        ORDER BY as_.last_activity DESC
      `);
      
      return stmt.all();
    } catch (error) {
      logger.error('Failed to get persisted agent data', { error });
      return [];
    }
  }

  /**
   * Select the optimal agent for given requirements
   */
  private selectOptimalAgent(requirements: AgentCapability[]): SubAgent | null {
    const candidates = Array.from(this.agents.values())
      .filter(agent => agent.status === 'idle' || agent.status === 'active')
      .filter(agent => this.agentMeetsRequirements(agent, requirements));

    if (candidates.length === 0) {
      return null;
    }

    // Score agents based on capability match and current load
    return candidates
      .sort((a, b) => this.scoreAgent(b, requirements) - this.scoreAgent(a, requirements))[0];
  }

  /**
   * Check if agent meets the requirements
   */
  private agentMeetsRequirements(agent: SubAgent, requirements: AgentCapability[]): boolean {
    return requirements.every(req => 
      agent.capabilities.some(cap => cap === req || this.isCapabilityCompatible(cap, req))
    );
  }

  /**
   * Score agent suitability for requirements
   */
  private scoreAgent(agent: SubAgent, requirements: AgentCapability[]): number {
    let score = 0;
    
    // Base score for availability
    if (agent.status === 'idle') score += 100;
    if (agent.status === 'active') score += 50;

    // Score for capability match
    for (const req of requirements) {
      if (agent.capabilities.includes(req)) {
        score += 25;
      }
    }

    // Bonus for specialized agents
    if (agent.type === 'specialist') score += 10;

    return score;
  }

  /**
   * Get enhanced requirements based on step type and existing requirements
   */
  private getEnhancedRequirements(stepType: TaskType, existingRequirements: AgentCapability[]): AgentCapability[] {
    const { STEP_CAPABILITY_MAPPING } = require('@/types/agents');
    const stepRequirements = STEP_CAPABILITY_MAPPING[stepType] || [];
    
    // Ensure existingRequirements is always an array
    const requirements = Array.isArray(existingRequirements) ? existingRequirements : [];
    
    // Combine step-specific requirements with existing ones, removing duplicates
    const combinedRequirements = [...new Set([...requirements, ...stepRequirements])] as AgentCapability[];
    
    logger.debug(`Enhanced requirements for step type '${stepType}':`, {
      original: requirements,
      stepSpecific: stepRequirements,
      combined: combinedRequirements
    });
    
    return combinedRequirements;
  }

  /**
   * Check if two capabilities are compatible
   */
  private isCapabilityCompatible(agentCap: string, requiredCap: string): boolean {
    const compatibilityMap: Record<string, string[]> = {
      'test-analysis': ['test-intelligence', 'quality-analysis'],
      'code-generation': ['test-generation', 'healing'],
      'performance-monitoring': ['optimization', 'analysis']
    };

    return compatibilityMap[agentCap]?.includes(requiredCap) || false;
  }

  /**
   * Validate agent capabilities during registration
   */
  private async validateAgentCapabilities(agent: SubAgent): Promise<void> {
    const requiredMethods = ['execute', 'getStatus', 'getCapabilities'];
    
    for (const method of requiredMethods) {
      if (typeof (agent as any)[method] !== 'function') {
        throw new Error(`Agent ${agent.id} missing required method: ${method}`);
      }
    }

    // Test agent responsiveness
    try {
      await agent.execute({
        id: 'health-check',
        type: 'health-check',
        data: {},
        context: {}
      });
    } catch (error) {
      logger.warn(`Agent ${agent.id} failed health check:`, error);
    }
  }

  /**
   * Process queued tasks asynchronously
   */
  private async startTaskProcessor(): Promise<void> {
    setInterval(async () => {
      if (this.isProcessing || this.taskQueue.length === 0) {
        return;
      }

      this.isProcessing = true;

      try {
        const task = this.taskQueue.shift();
        if (task) {
          await this.delegateTask(task);
        }
      } catch (error) {
        logger.error('Task processing failed:', error);
      } finally {
        this.isProcessing = false;
      }
    }, 1000);
  }

  /**
   * Generate unique workflow ID
   */
  private generateWorkflowId(): string {
    return `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get workflow execution history from database
   */
  async getWorkflowHistory(limit: number = 50): Promise<any[]> {
    try {
      const dbInstance = (this.db as any).db;
      if (!dbInstance) return [];
      
      const stmt = dbInstance.prepare(`
        SELECT 
          we.*,
          COUNT(wse.id) as total_steps,
          COUNT(CASE WHEN wse.status = 'completed' THEN 1 END) as completed_steps,
          COUNT(CASE WHEN wse.status = 'failed' THEN 1 END) as failed_steps
        FROM workflow_executions we
        LEFT JOIN workflow_step_executions wse ON we.id = wse.workflow_execution_id
        GROUP BY we.id
        ORDER BY we.started_at DESC
        LIMIT ?
      `);
      
      return stmt.all(limit);
    } catch (error) {
      logger.error('Failed to get workflow history', { error });
      return [];
    }
  }

  /**
   * Get detailed workflow execution with steps
   */
  async getWorkflowExecution(workflowId: string): Promise<any | null> {
    try {
      const dbInstance = (this.db as any).db;
      if (!dbInstance) return null;
      
      const workflowStmt = dbInstance.prepare(`
        SELECT * FROM workflow_executions WHERE workflow_id = ?
      `);
      
      const stepsStmt = dbInstance.prepare(`
        SELECT * FROM workflow_step_executions 
        WHERE workflow_execution_id = ?
        ORDER BY started_at ASC
      `);
      
      const workflow = workflowStmt.get(workflowId);
      if (!workflow) return null;
      
      const steps = stepsStmt.all(workflow.id);
      
      return {
        ...workflow,
        steps
      };
    } catch (error) {
      logger.error(`Failed to get workflow execution: ${workflowId}`, { error });
      return null;
    }
  }

  /**
   * Graceful shutdown of all agents
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down Agent Orchestrator...');
    
    try {
      // Persist current agent states before shutdown
      await this.persistAllAgentStates();
      
      // Mark all active workflows as cancelled
      await this.cancelActiveWorkflows();
      
      // Stop health monitoring
      healthMonitor.stopMonitoring();
      
      // Stop metrics collection
      metricsCollector.shutdown();
      
      const shutdownPromises = Array.from(this.agents.values()).map(async (agent) => {
        try {
          // Unregister from health monitor
          healthMonitor.unregisterAgent(agent.id);
          
          // Unregister from metrics collector
          metricsCollector.unregisterAgent(agent.id);
          
          // Persist final agent state
          await this.persistAgentShutdown(agent.id);
          
          if (typeof (agent as any).shutdown === 'function') {
            await (agent as any).shutdown();
          }
        } catch (error) {
          logger.warn(`Failed to shutdown agent ${agent.id}:`, error);
        }
      });

      await Promise.all(shutdownPromises);
      this.agents.clear();
      this.activeWorkflows.clear();
      
      logger.info('Agent Orchestrator shutdown complete');
    } catch (error) {
      logger.error('Error during Agent Orchestrator shutdown', { error });
    }
  }

  /**
   * Load persisted agent states from database on startup
   */
  private async loadPersistedAgentStates(): Promise<void> {
    try {
      const dbInstance = (this.db as any).db;
      if (!dbInstance) return;
      
      const stmt = dbInstance.prepare(`
        SELECT * FROM agent_states 
        WHERE status != 'offline'
        ORDER BY last_activity DESC
      `);
      
      const persistedStates = stmt.all();
      
      for (const state of persistedStates) {
        try {
          // Mark agents as potentially available for reconnection
          logger.info('Found persisted agent state', {
            agentId: state.id,
            type: state.type,
            lastActivity: state.last_activity
          });
          
          // Update status to indicate they need re-registration
          const updateStmt = dbInstance.prepare(`
            UPDATE agent_states 
            SET status = 'offline', updated_at = datetime('now', 'utc')
            WHERE id = ?
          `);
          updateStmt.run(state.id);
          
        } catch (error) {
          logger.warn(`Failed to process persisted agent state ${state.id}`, { error });
        }
      }
      
      logger.info(`Processed ${persistedStates.length} persisted agent states`);
    } catch (error) {
      logger.warn('Failed to load persisted agent states', { error });
    }
  }

  /**
   * Persist agent registration to database
   */
  private async persistAgentRegistration(agent: SubAgent): Promise<void> {
    try {
      const dbInstance = (this.db as any).db;
      if (!dbInstance) return;
      
      const stmt = dbInstance.prepare(`
        INSERT OR REPLACE INTO agent_states (
          id, type, status, capabilities, last_activity, 
          performance_metrics, resource_usage, health_score,
          error_count, success_count, total_executions,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const now = new Date().toISOString();
      stmt.run(
        agent.id,
        agent.type,
        agent.status,
        JSON.stringify(agent.capabilities),
        now,
        JSON.stringify({}),
        JSON.stringify({ cpuPercent: 0, memoryMB: 0 }),
        1.0,
        0,
        0,
        0,
        now,
        now
      );
      
      logger.debug(`Persisted agent registration: ${agent.id}`);
    } catch (error) {
      logger.error(`Failed to persist agent registration: ${agent.id}`, { error });
    }
  }

  /**
   * Persist workflow execution start to database
   */
  private async persistWorkflowStart(workflowId: string, workflow: AgentWorkflow): Promise<string> {
    try {
      const dbInstance = (this.db as any).db;
      if (!dbInstance) return workflowId;
      
      const executionId = `exec_${workflowId}_${Date.now()}`;
      const stmt = dbInstance.prepare(`
        INSERT INTO workflow_executions (
          id, workflow_id, workflow_name, status, started_at,
          context, configuration, steps_total, priority
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        executionId,
        workflowId,
        workflow.name || 'Unnamed Workflow',
        'running',
        new Date().toISOString(),
        JSON.stringify(workflow.context || {}),
        JSON.stringify({}),
        workflow.steps.length,
        workflow.priority || 'medium'
      );
      
      logger.debug(`Persisted workflow start: ${executionId}`);
      return executionId;
    } catch (error) {
      logger.error(`Failed to persist workflow start: ${workflowId}`, { error });
      return workflowId;
    }
  }

  /**
   * Persist workflow step start to database
   */
  private async persistWorkflowStepStart(
    workflowId: string, 
    step: any, 
    agentId: string, 
    task: AgentTask
  ): Promise<void> {
    try {
      const dbInstance = (this.db as any).db;
      if (!dbInstance) return;
      
      const stepExecutionId = `step_${workflowId}_${step.id}_${Date.now()}`;
      const stmt = dbInstance.prepare(`
        INSERT INTO workflow_step_executions (
          id, workflow_execution_id, step_id, step_type, step_name,
          agent_id, status, started_at, input_data, context_data,
          dependencies, requirements
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        stepExecutionId,
        `exec_${workflowId}_${Date.now()}`,
        step.id,
        step.type,
        step.name || step.id,
        agentId,
        'running',
        new Date().toISOString(),
        JSON.stringify(task.data || {}),
        JSON.stringify(task.context || {}),
        JSON.stringify(step.dependsOn || []),
        JSON.stringify(task.requirements || [])
      );
      
      logger.debug(`Persisted workflow step start: ${stepExecutionId}`);
    } catch (error) {
      logger.error(`Failed to persist workflow step start: ${step.id}`, { error });
    }
  }

  /**
   * Persist workflow step completion to database
   */
  private async persistWorkflowStepCompletion(
    workflowId: string,
    stepId: string,
    result: AgentResult
  ): Promise<void> {
    try {
      const dbInstance = (this.db as any).db;
      if (!dbInstance) return;
      
      const stmt = dbInstance.prepare(`
        UPDATE workflow_step_executions 
        SET status = ?, completed_at = ?, duration_ms = ?,
            output_data = ?, confidence_score = ?, error_message = ?,
            tokens_used = ?, model_used = ?, updated_at = ?
        WHERE step_id = ? AND workflow_execution_id LIKE ?
      `);
      
      const now = new Date().toISOString();
      stmt.run(
        result.status,
        now,
        result.executionTime,
        JSON.stringify(result.data || {}),
        result.confidence,
        result.error,
        result.metadata?.tokensUsed,
        result.metadata?.modelUsed,
        now,
        stepId,
        `%${workflowId}%`
      );
      
      logger.debug(`Persisted workflow step completion: ${stepId}`);
    } catch (error) {
      logger.error(`Failed to persist workflow step completion: ${stepId}`, { error });
    }
  }

  /**
   * Persist workflow completion to database
   */
  private async persistWorkflowCompletion(
    workflowId: string,
    result: WorkflowResult,
    stepResults: AgentResult[]
  ): Promise<void> {
    try {
      const dbInstance = (this.db as any).db;
      if (!dbInstance) return;
      
      const stmt = dbInstance.prepare(`
        UPDATE workflow_executions 
        SET status = ?, completed_at = ?, duration_ms = ?,
            steps_completed = ?, success_rate = ?, updated_at = ?
        WHERE workflow_id = ?
      `);
      
      const successCount = stepResults.filter(r => r.status === 'success').length;
      const successRate = stepResults.length > 0 ? successCount / stepResults.length : 0;
      
      stmt.run(
        result.status,
        result.completedAt?.toISOString(),
        result.duration,
        stepResults.length,
        successRate,
        new Date().toISOString(),
        workflowId
      );
      
      logger.debug(`Persisted workflow completion: ${workflowId}`);
    } catch (error) {
      logger.error(`Failed to persist workflow completion: ${workflowId}`, { error });
    }
  }

  /**
   * Persist workflow failure to database
   */
  private async persistWorkflowFailure(
    workflowId: string,
    result: WorkflowResult,
    error: any
  ): Promise<void> {
    try {
      const dbInstance = (this.db as any).db;
      if (!dbInstance) return;
      
      const stmt = dbInstance.prepare(`
        UPDATE workflow_executions 
        SET status = ?, completed_at = ?, duration_ms = ?,
            error_message = ?, error_details = ?, updated_at = ?
        WHERE workflow_id = ?
      `);
      
      stmt.run(
        'failed',
        result.completedAt?.toISOString(),
        result.duration,
        result.error,
        JSON.stringify({ 
          stack: error.stack,
          name: error.name,
          message: error.message 
        }),
        new Date().toISOString(),
        workflowId
      );
      
      logger.debug(`Persisted workflow failure: ${workflowId}`);
    } catch (error) {
      logger.error(`Failed to persist workflow failure: ${workflowId}`, { error });
    }
  }

  /**
   * Persist current state of all agents
   */
  private async persistAllAgentStates(): Promise<void> {
    try {
      const dbInstance = (this.db as any).db;
      if (!dbInstance) return;
      
      const stmt = dbInstance.prepare(`
        UPDATE agent_states 
        SET status = ?, last_activity = ?, updated_at = ?
        WHERE id = ?
      `);
      
      const now = new Date().toISOString();
      
      for (const [agentId, agent] of this.agents) {
        try {
          stmt.run(
            agent.status,
            agent.lastActivity?.toISOString() || now,
            now,
            agentId
          );
        } catch (error) {
          logger.warn(`Failed to persist state for agent ${agentId}`, { error });
        }
      }
      
      logger.debug('Persisted all agent states');
    } catch (error) {
      logger.error('Failed to persist agent states', { error });
    }
  }

  /**
   * Cancel all active workflows during shutdown
   */
  private async cancelActiveWorkflows(): Promise<void> {
    try {
      const dbInstance = (this.db as any).db;
      if (!dbInstance) return;
      
      const stmt = dbInstance.prepare(`
        UPDATE workflow_executions 
        SET status = 'cancelled', completed_at = ?, updated_at = ?
        WHERE status IN ('pending', 'running')
      `);
      
      const now = new Date().toISOString();
      const result = stmt.run(now, now);
      
      if (result.changes > 0) {
        logger.info(`Cancelled ${result.changes} active workflows during shutdown`);
      }
    } catch (error) {
      logger.error('Failed to cancel active workflows', { error });
    }
  }

  /**
   * Persist agent shutdown state
   */
  private async persistAgentShutdown(agentId: string): Promise<void> {
    try {
      const dbInstance = (this.db as any).db;
      if (!dbInstance) return;
      
      const stmt = dbInstance.prepare(`
        UPDATE agent_states 
        SET status = 'offline', updated_at = ?
        WHERE id = ?
      `);
      
      stmt.run(new Date().toISOString(), agentId);
      logger.debug(`Persisted agent shutdown: ${agentId}`);
    } catch (error) {
      logger.warn(`Failed to persist agent shutdown: ${agentId}`, { error });
    }
  }
}

export const agentOrchestrator = new AgentOrchestrator();