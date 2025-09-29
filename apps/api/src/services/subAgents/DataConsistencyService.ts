/**
 * Data Consistency and Synchronization Service
 * Ensures data integrity across the sub-agents system
 */

import { EventEmitter } from 'events';
import { logger } from '@/utils/logger';
import { getDatabase } from '@/database/database';
import type { SchedulerDatabase } from '@/database/database';
import { metricsCollector } from './MetricsCollector';
import { agentOrchestrator } from './AgentOrchestrator';

export interface ConsistencyCheck {
  id: string;
  checkType: 'agent_state' | 'metrics' | 'workflow' | 'test_data' | 'referential_integrity';
  timestamp: Date;
  status: 'passed' | 'failed' | 'warning';
  issues: ConsistencyIssue[];
  fixesApplied: ConsistencyFix[];
  duration: number;
  metadata: Record<string, any>;
}

export interface ConsistencyIssue {
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  description: string;
  affectedTable?: string;
  affectedRecords?: string[];
  recommendedAction: string;
  autoFixable: boolean;
}

export interface ConsistencyFix {
  issueType: string;
  action: string;
  affectedRecords: number;
  timestamp: Date;
  successful: boolean;
  error?: string;
}

export interface SynchronizationReport {
  timestamp: Date;
  cacheToDbSync: {
    agentsUpdated: number;
    metricsUpdated: number;
    conflictsResolved: number;
  };
  dbToCacheSync: {
    agentsLoaded: number;
    metricsLoaded: number;
    orphansRemoved: number;
  };
  duration: number;
  issues: string[];
}

export class DataConsistencyService extends EventEmitter {
  private db: SchedulerDatabase;
  private consistencyCheckInterval: NodeJS.Timeout | null = null;
  private lastFullCheck: Date | null = null;
  private criticalIssues: ConsistencyIssue[] = [];

  constructor() {
    super();
    this.db = getDatabase();
    this.initializeConsistencyChecks();
    logger.info('DataConsistencyService initialized');
  }

  /**
   * Initialize periodic consistency checks
   */
  private initializeConsistencyChecks(): void {
    // Run consistency checks every 30 minutes
    this.consistencyCheckInterval = setInterval(async () => {
      await this.runAutomaticConsistencyCheck();
    }, 30 * 60 * 1000);

    // Run initial check after 5 seconds
    setTimeout(async () => {
      await this.runAutomaticConsistencyCheck();
    }, 5000);
  }

  /**
   * Run comprehensive data consistency check
   */
  async runFullConsistencyCheck(): Promise<ConsistencyCheck> {
    const startTime = Date.now();
    const check: ConsistencyCheck = {
      id: `consistency_${Date.now()}`,
      checkType: 'referential_integrity',
      timestamp: new Date(),
      status: 'passed',
      issues: [],
      fixesApplied: [],
      duration: 0,
      metadata: {}
    };

    try {
      logger.info('Starting full consistency check');

      // Check agent state consistency
      const agentIssues = await this.checkAgentStateConsistency();
      check.issues.push(...agentIssues);

      // Check metrics consistency
      const metricsIssues = await this.checkMetricsConsistency();
      check.issues.push(...metricsIssues);

      // Check workflow consistency
      const workflowIssues = await this.checkWorkflowConsistency();
      check.issues.push(...workflowIssues);

      // Check test data consistency
      const testDataIssues = await this.checkTestDataConsistency();
      check.issues.push(...testDataIssues);

      // Check referential integrity
      const referentialIssues = await this.checkReferentialIntegrity();
      check.issues.push(...referentialIssues);

      // Determine overall status
      const criticalIssues = check.issues.filter(i => i.severity === 'critical');
      const highIssues = check.issues.filter(i => i.severity === 'high');
      
      if (criticalIssues.length > 0) {
        check.status = 'failed';
      } else if (highIssues.length > 0 || check.issues.length > 5) {
        check.status = 'warning';
      }

      // Store critical issues for monitoring
      this.criticalIssues = criticalIssues;

      check.duration = Date.now() - startTime;
      this.lastFullCheck = new Date();

      // Persist check results
      await this.persistConsistencyCheck(check);

      this.emit('consistencyCheckCompleted', check);

      logger.info('Full consistency check completed', {
        checkId: check.id,
        status: check.status,
        issueCount: check.issues.length,
        criticalIssues: criticalIssues.length,
        duration: check.duration
      });

      return check;
    } catch (error) {
      check.status = 'failed';
      check.issues.push({
        severity: 'critical',
        type: 'consistency_check_error',
        description: `Consistency check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        recommendedAction: 'Review system logs and database connectivity',
        autoFixable: false
      });
      check.duration = Date.now() - startTime;

      logger.error('Consistency check failed', { error });
      return check;
    }
  }

  /**
   * Run automatic consistency check with auto-fix for minor issues
   */
  async runAutomaticConsistencyCheck(): Promise<void> {
    try {
      const check = await this.runFullConsistencyCheck();
      
      // Auto-fix minor issues
      const fixableIssues = check.issues.filter(i => 
        i.autoFixable && ['low', 'medium'].includes(i.severity)
      );

      for (const issue of fixableIssues) {
        try {
          const fix = await this.autoFixIssue(issue);
          if (fix) {
            check.fixesApplied.push(fix);
          }
        } catch (error) {
          logger.warn(`Failed to auto-fix issue: ${issue.type}`, { error });
        }
      }

      // Alert on critical issues
      if (check.status === 'failed') {
        this.emit('criticalConsistencyIssues', {
          checkId: check.id,
          criticalIssues: check.issues.filter(i => i.severity === 'critical')
        });
      }

    } catch (error) {
      logger.error('Automatic consistency check failed', { error });
    }
  }

  /**
   * Check agent state consistency between cache and database
   */
  private async checkAgentStateConsistency(): Promise<ConsistencyIssue[]> {
    const issues: ConsistencyIssue[] = [];

    try {
      const agentStatus = agentOrchestrator.getAgentStatus();
      const dbInstance = (this.db as any).db;
      
      if (!dbInstance) {
        issues.push({
          severity: 'critical',
          type: 'database_unavailable',
          description: 'Database connection is not available',
          affectedTable: 'agent_states',
          recommendedAction: 'Check database connectivity and restart service',
          autoFixable: false
        });
        return issues;
      }

      // Get all agent states from database
      const dbAgents = dbInstance.prepare('SELECT * FROM agent_states').all();
      const dbAgentIds = new Set(dbAgents.map((a: any) => a.id));
      const cacheAgentIds = new Set(Object.keys(agentStatus));

      // Check for agents in cache but not in database
      for (const cacheAgentId of cacheAgentIds) {
        if (!dbAgentIds.has(cacheAgentId)) {
          issues.push({
            severity: 'high',
            type: 'agent_missing_from_db',
            description: `Agent ${cacheAgentId} exists in cache but not in database`,
            affectedTable: 'agent_states',
            affectedRecords: [cacheAgentId],
            recommendedAction: 'Synchronize agent state to database',
            autoFixable: true
          });
        }
      }

      // Check for agents in database but not in cache
      for (const dbAgentId of dbAgentIds) {
        if (!cacheAgentIds.has(dbAgentId)) {
          const dbAgent = dbAgents.find((a: any) => a.id === dbAgentId);
          if (dbAgent && dbAgent.status !== 'offline') {
            issues.push({
              severity: 'medium',
              type: 'agent_missing_from_cache',
              description: `Agent ${dbAgentId} exists in database but not in cache`,
              affectedTable: 'agent_states',
              affectedRecords: [dbAgentId],
              recommendedAction: 'Mark agent as offline or load into cache if still active',
              autoFixable: true
            });
          }
        }
      }

      // Check for status mismatches
      for (const cacheAgentId of cacheAgentIds) {
        if (dbAgentIds.has(cacheAgentId)) {
          const cacheAgent = agentStatus[cacheAgentId];
          const dbAgent = dbAgents.find((a: any) => a.id === cacheAgentId);
          
          if (dbAgent && cacheAgent.status !== dbAgent.status) {
            issues.push({
              severity: 'low',
              type: 'agent_status_mismatch',
              description: `Agent ${cacheAgentId} status mismatch: cache=${cacheAgent.status}, db=${dbAgent.status}`,
              affectedTable: 'agent_states',
              affectedRecords: [cacheAgentId],
              recommendedAction: 'Update database with current cache status',
              autoFixable: true
            });
          }
        }
      }

    } catch (error) {
      issues.push({
        severity: 'high',
        type: 'agent_consistency_check_error',
        description: `Failed to check agent state consistency: ${error instanceof Error ? error.message : 'Unknown error'}`,
        affectedTable: 'agent_states',
        recommendedAction: 'Review system logs and database schema',
        autoFixable: false
      });
    }

    return issues;
  }

  /**
   * Check metrics consistency
   */
  private async checkMetricsConsistency(): Promise<ConsistencyIssue[]> {
    const issues: ConsistencyIssue[] = [];

    try {
      const metricsConsistency = await metricsCollector.validateDataConsistency();
      
      if (!metricsConsistency.isConsistent) {
        for (const issue of metricsConsistency.issues) {
          issues.push({
            severity: 'medium',
            type: 'metrics_consistency_issue',
            description: issue,
            affectedTable: 'agent_tasks',
            recommendedAction: 'Synchronize metrics cache with database',
            autoFixable: true
          });
        }
      }

      // Check for large discrepancies in task counts
      const cacheAgents = metricsCollector.getAgentMetrics();
      const dbInstance = (this.db as any).db;
      
      for (const cacheAgent of cacheAgents) {
        const dbTaskCount = dbInstance?.prepare(`
          SELECT COUNT(*) as count FROM agent_tasks WHERE agent_id = ?
        `).get(cacheAgent.agentId);
        
        if (dbTaskCount && Math.abs(cacheAgent.tasksCompleted - dbTaskCount.count) > 10) {
          issues.push({
            severity: 'medium',
            type: 'task_count_discrepancy',
            description: `Large task count discrepancy for agent ${cacheAgent.agentId}: cache=${cacheAgent.tasksCompleted}, db=${dbTaskCount.count}`,
            affectedTable: 'agent_tasks',
            affectedRecords: [cacheAgent.agentId],
            recommendedAction: 'Synchronize task counts between cache and database',
            autoFixable: true
          });
        }
      }

    } catch (error) {
      issues.push({
        severity: 'high',
        type: 'metrics_consistency_check_error',
        description: `Failed to check metrics consistency: ${error instanceof Error ? error.message : 'Unknown error'}`,
        recommendedAction: 'Review metrics collection system',
        autoFixable: false
      });
    }

    return issues;
  }

  /**
   * Check workflow execution consistency
   */
  private async checkWorkflowConsistency(): Promise<ConsistencyIssue[]> {
    const issues: ConsistencyIssue[] = [];

    try {
      const dbInstance = (this.db as any).db;
      if (!dbInstance) return issues;

      // Check for workflows with inconsistent step counts
      const inconsistentWorkflows = dbInstance.prepare(`
        SELECT 
          we.id, we.workflow_id, we.steps_total,
          COUNT(wse.id) as actual_steps
        FROM workflow_executions we
        LEFT JOIN workflow_step_executions wse ON we.id = wse.workflow_execution_id
        GROUP BY we.id, we.workflow_id, we.steps_total
        HAVING we.steps_total != COUNT(wse.id) AND we.status != 'cancelled'
      `).all();

      for (const workflow of inconsistentWorkflows) {
        issues.push({
          severity: 'medium',
          type: 'workflow_step_count_mismatch',
          description: `Workflow ${workflow.workflow_id} has step count mismatch: expected=${workflow.steps_total}, actual=${workflow.actual_steps}`,
          affectedTable: 'workflow_executions',
          affectedRecords: [workflow.id],
          recommendedAction: 'Review workflow execution logic and step tracking',
          autoFixable: false
        });
      }

      // Check for orphaned workflow steps
      const orphanedSteps = dbInstance.prepare(`
        SELECT wse.id, wse.step_id
        FROM workflow_step_executions wse
        LEFT JOIN workflow_executions we ON wse.workflow_execution_id = we.id
        WHERE we.id IS NULL
      `).all();

      if (orphanedSteps.length > 0) {
        issues.push({
          severity: 'medium',
          type: 'orphaned_workflow_steps',
          description: `Found ${orphanedSteps.length} orphaned workflow steps with no parent workflow`,
          affectedTable: 'workflow_step_executions',
          affectedRecords: orphanedSteps.map((s: any) => s.id),
          recommendedAction: 'Clean up orphaned workflow steps',
          autoFixable: true
        });
      }

      // Check for workflows stuck in running state
      const stuckWorkflows = dbInstance.prepare(`
        SELECT id, workflow_id, started_at
        FROM workflow_executions 
        WHERE status = 'running' 
          AND started_at < datetime('now', '-2 hours', 'utc')
      `).all();

      for (const workflow of stuckWorkflows) {
        issues.push({
          severity: 'high',
          type: 'stuck_workflow',
          description: `Workflow ${workflow.workflow_id} has been in running state since ${workflow.started_at}`,
          affectedTable: 'workflow_executions',
          affectedRecords: [workflow.id],
          recommendedAction: 'Review workflow status and consider marking as failed',
          autoFixable: true
        });
      }

    } catch (error) {
      issues.push({
        severity: 'high',
        type: 'workflow_consistency_check_error',
        description: `Failed to check workflow consistency: ${error instanceof Error ? error.message : 'Unknown error'}`,
        recommendedAction: 'Review workflow persistence system',
        autoFixable: false
      });
    }

    return issues;
  }

  /**
   * Check test data consistency
   */
  private async checkTestDataConsistency(): Promise<ConsistencyIssue[]> {
    const issues: ConsistencyIssue[] = [];

    try {
      const dbInstance = (this.db as any).db;
      if (!dbInstance) return issues;

      // Check for orphaned test tags
      const orphanedTags = dbInstance.prepare(`
        SELECT tt.id, tt.test_id, tt.tag_name
        FROM test_tags tt
        LEFT JOIN tests t ON tt.test_id = t.id
        WHERE t.id IS NULL
      `).all();

      if (orphanedTags.length > 0) {
        issues.push({
          severity: 'medium',
          type: 'orphaned_test_tags',
          description: `Found ${orphanedTags.length} orphaned test tags with no parent test`,
          affectedTable: 'test_tags',
          affectedRecords: orphanedTags.map((t: any) => t.id.toString()),
          recommendedAction: 'Clean up orphaned test tags',
          autoFixable: true
        });
      }

      // Check for tests with invalid file paths
      const invalidPathTests = dbInstance.prepare(`
        SELECT id, file_path, test_name
        FROM tests 
        WHERE file_path IS NULL OR file_path = '' OR test_name IS NULL OR test_name = ''
      `).all();

      if (invalidPathTests.length > 0) {
        issues.push({
          severity: 'high',
          type: 'invalid_test_data',
          description: `Found ${invalidPathTests.length} tests with invalid file paths or names`,
          affectedTable: 'tests',
          affectedRecords: invalidPathTests.map((t: any) => t.id),
          recommendedAction: 'Clean up or fix invalid test records',
          autoFixable: true
        });
      }

    } catch (error) {
      issues.push({
        severity: 'high',
        type: 'test_data_consistency_check_error',
        description: `Failed to check test data consistency: ${error instanceof Error ? error.message : 'Unknown error'}`,
        recommendedAction: 'Review test discovery system',
        autoFixable: false
      });
    }

    return issues;
  }

  /**
   * Check referential integrity across all tables
   */
  private async checkReferentialIntegrity(): Promise<ConsistencyIssue[]> {
    const issues: ConsistencyIssue[] = [];

    try {
      const dbInstance = (this.db as any).db;
      if (!dbInstance) return issues;

      // Run SQLite's foreign key check
      const foreignKeyViolations = dbInstance.prepare('PRAGMA foreign_key_check').all();
      
      for (const violation of foreignKeyViolations) {
        issues.push({
          severity: 'critical',
          type: 'foreign_key_violation',
          description: `Foreign key violation in table ${violation.table}: ${violation.fkid}`,
          affectedTable: violation.table,
          affectedRecords: [violation.rowid.toString()],
          recommendedAction: 'Fix or remove records with invalid foreign key references',
          autoFixable: false
        });
      }

      // Check for specific referential integrity issues
      
      // Agent tasks referencing non-existent agents
      const invalidAgentTasks = dbInstance.prepare(`
        SELECT at.id, at.agent_id
        FROM agent_tasks at
        LEFT JOIN agent_states as_ ON at.agent_id = as_.id
        WHERE as_.id IS NULL
      `).all();

      if (invalidAgentTasks.length > 0) {
        issues.push({
          severity: 'high',
          type: 'invalid_agent_task_references',
          description: `Found ${invalidAgentTasks.length} agent tasks referencing non-existent agents`,
          affectedTable: 'agent_tasks',
          affectedRecords: invalidAgentTasks.map((t: any) => t.id),
          recommendedAction: 'Clean up tasks with invalid agent references',
          autoFixable: true
        });
      }

      // Health checks referencing non-existent agents
      const invalidHealthChecks = dbInstance.prepare(`
        SELECT ahc.id, ahc.agent_id
        FROM agent_health_checks ahc
        LEFT JOIN agent_states as_ ON ahc.agent_id = as_.id
        WHERE as_.id IS NULL
      `).all();

      if (invalidHealthChecks.length > 0) {
        issues.push({
          severity: 'medium',
          type: 'invalid_health_check_references',
          description: `Found ${invalidHealthChecks.length} health checks referencing non-existent agents`,
          affectedTable: 'agent_health_checks',
          affectedRecords: invalidHealthChecks.map((h: any) => h.id.toString()),
          recommendedAction: 'Clean up health checks with invalid agent references',
          autoFixable: true
        });
      }

    } catch (error) {
      issues.push({
        severity: 'critical',
        type: 'referential_integrity_check_error',
        description: `Failed to check referential integrity: ${error instanceof Error ? error.message : 'Unknown error'}`,
        recommendedAction: 'Review database schema and foreign key constraints',
        autoFixable: false
      });
    }

    return issues;
  }

  /**
   * Auto-fix a consistency issue
   */
  private async autoFixIssue(issue: ConsistencyIssue): Promise<ConsistencyFix | null> {
    try {
      const fix: ConsistencyFix = {
        issueType: issue.type,
        action: '',
        affectedRecords: 0,
        timestamp: new Date(),
        successful: false
      };

      const dbInstance = (this.db as any).db;
      if (!dbInstance) return null;

      switch (issue.type) {
        case 'agent_missing_from_db':
          // Synchronize agent state to database
          await this.syncAgentStateToDatabase(issue.affectedRecords?.[0]);
          fix.action = 'Synchronized agent state to database';
          fix.affectedRecords = 1;
          fix.successful = true;
          break;

        case 'agent_missing_from_cache':
          // Mark agent as offline in database
          const result1 = dbInstance.prepare(`
            UPDATE agent_states 
            SET status = 'offline', updated_at = datetime('now', 'utc')
            WHERE id = ?
          `).run(issue.affectedRecords?.[0]);
          fix.action = 'Marked agent as offline in database';
          fix.affectedRecords = result1.changes || 0;
          fix.successful = result1.changes > 0;
          break;

        case 'agent_status_mismatch':
          // Update database with cache status
          await this.syncAgentStatusToDatabase(issue.affectedRecords?.[0]);
          fix.action = 'Updated agent status in database';
          fix.affectedRecords = 1;
          fix.successful = true;
          break;

        case 'orphaned_test_tags':
          // Clean up orphaned test tags
          if (issue.affectedRecords && issue.affectedRecords.length > 0) {
            const placeholders = issue.affectedRecords.map(() => '?').join(',');
            const result2 = dbInstance.prepare(`
              DELETE FROM test_tags WHERE id IN (${placeholders})
            `).run(...issue.affectedRecords.map(r => parseInt(r)));
            fix.action = 'Removed orphaned test tags';
            fix.affectedRecords = result2.changes || 0;
            fix.successful = result2.changes > 0;
          }
          break;

        case 'orphaned_workflow_steps':
          // Clean up orphaned workflow steps
          if (issue.affectedRecords && issue.affectedRecords.length > 0) {
            const placeholders = issue.affectedRecords.map(() => '?').join(',');
            const result3 = dbInstance.prepare(`
              DELETE FROM workflow_step_executions WHERE id IN (${placeholders})
            `).run(...issue.affectedRecords);
            fix.action = 'Removed orphaned workflow steps';
            fix.affectedRecords = result3.changes || 0;
            fix.successful = result3.changes > 0;
          }
          break;

        case 'stuck_workflow':
          // Mark stuck workflows as failed
          if (issue.affectedRecords && issue.affectedRecords.length > 0) {
            const result4 = dbInstance.prepare(`
              UPDATE workflow_executions 
              SET status = 'failed', 
                  error_message = 'Workflow marked as failed due to timeout',
                  completed_at = datetime('now', 'utc'),
                  updated_at = datetime('now', 'utc')
              WHERE id = ?
            `).run(issue.affectedRecords[0]);
            fix.action = 'Marked stuck workflow as failed';
            fix.affectedRecords = result4.changes || 0;
            fix.successful = result4.changes > 0;
          }
          break;

        default:
          // Issue type not auto-fixable
          return null;
      }

      logger.info('Auto-fixed consistency issue', {
        issueType: issue.type,
        action: fix.action,
        affectedRecords: fix.affectedRecords,
        successful: fix.successful
      });

      return fix;
    } catch (error) {
      logger.error(`Failed to auto-fix issue: ${issue.type}`, { error });
      return {
        issueType: issue.type,
        action: 'Auto-fix failed',
        affectedRecords: 0,
        timestamp: new Date(),
        successful: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Synchronize data between cache and database
   */
  async synchronizeData(): Promise<SynchronizationReport> {
    const startTime = Date.now();
    const report: SynchronizationReport = {
      timestamp: new Date(),
      cacheToDbSync: {
        agentsUpdated: 0,
        metricsUpdated: 0,
        conflictsResolved: 0
      },
      dbToCacheSync: {
        agentsLoaded: 0,
        metricsLoaded: 0,
        orphansRemoved: 0
      },
      duration: 0,
      issues: []
    };

    try {
      logger.info('Starting data synchronization');

      // Synchronize metrics collector with database
      await metricsCollector.synchronizeWithDatabase();
      report.cacheToDbSync.metricsUpdated = metricsCollector.getAgentMetrics().length;

      // Synchronize agent states
      const agentData = await agentOrchestrator.getPersistedAgentData();
      report.dbToCacheSync.agentsLoaded = agentData.length;

      report.duration = Date.now() - startTime;

      logger.info('Data synchronization completed', {
        duration: report.duration,
        agentsUpdated: report.cacheToDbSync.agentsUpdated,
        metricsUpdated: report.cacheToDbSync.metricsUpdated
      });

      this.emit('dataSynchronized', report);

    } catch (error) {
      report.issues.push(`Synchronization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      logger.error('Data synchronization failed', { error });
    }

    return report;
  }

  /**
   * Get current critical consistency issues
   */
  getCriticalIssues(): ConsistencyIssue[] {
    return this.criticalIssues;
  }

  /**
   * Get last consistency check timestamp
   */
  getLastCheckTimestamp(): Date | null {
    return this.lastFullCheck;
  }

  /**
   * Private helper methods
   */
  private async syncAgentStateToDatabase(agentId?: string): Promise<void> {
    if (!agentId) return;
    
    const agentStatus = agentOrchestrator.getAgentStatus();
    const agent = agentStatus[agentId];
    
    if (agent) {
      await agentOrchestrator.updateAgentStatus(agentId, agent.status, agent.currentTask);
    }
  }

  private async syncAgentStatusToDatabase(agentId?: string): Promise<void> {
    if (!agentId) return;
    
    const agentStatus = agentOrchestrator.getAgentStatus();
    const agent = agentStatus[agentId];
    
    if (agent) {
      await agentOrchestrator.updateAgentStatus(agentId, agent.status, agent.currentTask);
    }
  }

  private async persistConsistencyCheck(check: ConsistencyCheck): Promise<void> {
    try {
      // In a real implementation, you might want to persist consistency checks
      // to a dedicated table for monitoring and historical analysis
      logger.debug('Consistency check results', {
        checkId: check.id,
        status: check.status,
        issueCount: check.issues.length,
        fixesApplied: check.fixesApplied.length
      });
    } catch (error) {
      logger.error('Failed to persist consistency check', { error });
    }
  }

  /**
   * Shutdown the consistency service
   */
  shutdown(): void {
    if (this.consistencyCheckInterval) {
      clearInterval(this.consistencyCheckInterval);
      this.consistencyCheckInterval = null;
    }
    
    this.removeAllListeners();
    logger.info('DataConsistencyService shutdown complete');
  }
}

// Singleton instance
export const dataConsistencyService = new DataConsistencyService();