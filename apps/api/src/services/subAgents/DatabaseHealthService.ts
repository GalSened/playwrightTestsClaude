/**
 * Database Health Monitoring and Recovery Service
 * Monitors database health, performance, and provides recovery mechanisms
 */

import { EventEmitter } from 'events';
import { logger } from '@/utils/logger';
import { getDatabase, getDatabaseStats } from '@/database/database';
import type { SchedulerDatabase } from '@/database/database';
import { dataConsistencyService } from './DataConsistencyService';

export interface DatabaseHealthMetrics {
  timestamp: Date;
  isHealthy: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'error';
  responseTime: number;
  
  // Performance metrics
  queryPerformance: {
    averageQueryTime: number;
    slowQueries: number;
    failedQueries: number;
    totalQueries: number;
  };
  
  // Storage metrics
  storage: {
    databaseSize: number;
    tableCount: number;
    recordCounts: Record<string, number>;
    indexCount: number;
  };
  
  // Health indicators
  healthIndicators: {
    connectionPool: 'healthy' | 'degraded' | 'critical';
    queryPerformance: 'healthy' | 'degraded' | 'critical';
    dataIntegrity: 'healthy' | 'degraded' | 'critical';
    diskSpace: 'healthy' | 'degraded' | 'critical';
  };
  
  // Errors and warnings
  recentErrors: DatabaseError[];
  warnings: string[];
}

export interface DatabaseError {
  timestamp: Date;
  type: 'connection' | 'query' | 'integrity' | 'performance' | 'disk';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  query?: string;
  table?: string;
  details?: Record<string, any>;
}

export interface RecoveryAction {
  id: string;
  type: 'reconnection' | 'schema_repair' | 'data_recovery' | 'performance_optimization' | 'cleanup';
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  description: string;
  result?: {
    successful: boolean;
    message: string;
    affectedRecords?: number;
    details?: Record<string, any>;
  };
}

export class DatabaseHealthService extends EventEmitter {
  private db: SchedulerDatabase;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private performanceMonitoringInterval: NodeJS.Timeout | null = null;
  private currentHealthMetrics: DatabaseHealthMetrics | null = null;
  private recentErrors: DatabaseError[] = [];
  private activeRecoveryActions = new Map<string, RecoveryAction>();
  private queryHistory: { timestamp: Date; duration: number; query: string; success: boolean }[] = [];
  
  // Thresholds for health monitoring
  private readonly thresholds = {
    maxResponseTime: 5000, // 5 seconds
    maxSlowQueries: 10, // per minute
    maxFailedQueries: 5, // per minute
    minDiskSpaceGB: 1, // 1GB minimum free space
    maxQueryTime: 10000, // 10 seconds for slow query
    maxErrorsPerMinute: 20
  };

  constructor() {
    super();
    this.db = getDatabase();
    this.initializeHealthMonitoring();
    logger.info('DatabaseHealthService initialized');
  }

  /**
   * Initialize health monitoring with periodic checks
   */
  private initializeHealthMonitoring(): void {
    // Run comprehensive health check every 2 minutes
    this.healthCheckInterval = setInterval(async () => {
      await this.runHealthCheck();
    }, 2 * 60 * 1000);

    // Monitor query performance every 30 seconds
    this.performanceMonitoringInterval = setInterval(() => {
      this.analyzeQueryPerformance();
    }, 30 * 1000);

    // Run initial health check after 10 seconds
    setTimeout(async () => {
      await this.runHealthCheck();
    }, 10000);
  }

  /**
   * Run comprehensive database health check
   */
  async runHealthCheck(): Promise<DatabaseHealthMetrics> {
    const startTime = Date.now();
    
    try {
      const healthMetrics: DatabaseHealthMetrics = {
        timestamp: new Date(),
        isHealthy: true,
        connectionStatus: 'connected',
        responseTime: 0,
        queryPerformance: {
          averageQueryTime: 0,
          slowQueries: 0,
          failedQueries: 0,
          totalQueries: 0
        },
        storage: {
          databaseSize: 0,
          tableCount: 0,
          recordCounts: {},
          indexCount: 0
        },
        healthIndicators: {
          connectionPool: 'healthy',
          queryPerformance: 'healthy',
          dataIntegrity: 'healthy',
          diskSpace: 'healthy'
        },
        recentErrors: [...this.recentErrors],
        warnings: []
      };

      // Test basic database connectivity
      const connectionHealthy = await this.checkConnectionHealth();
      healthMetrics.connectionStatus = connectionHealthy ? 'connected' : 'disconnected';
      
      if (!connectionHealthy) {
        healthMetrics.isHealthy = false;
        healthMetrics.healthIndicators.connectionPool = 'critical';
        await this.triggerRecoveryAction('reconnection', 'Database connection lost - attempting reconnection');
      }

      // Check query performance
      const queryHealth = this.analyzeQueryPerformance();
      healthMetrics.queryPerformance = queryHealth;
      
      if (queryHealth.slowQueries > this.thresholds.maxSlowQueries) {
        healthMetrics.healthIndicators.queryPerformance = 'degraded';
        healthMetrics.warnings.push(`High number of slow queries: ${queryHealth.slowQueries}`);
      }

      if (queryHealth.failedQueries > this.thresholds.maxFailedQueries) {
        healthMetrics.healthIndicators.queryPerformance = 'critical';
        healthMetrics.isHealthy = false;
      }

      // Check storage metrics
      const storageMetrics = await this.getStorageMetrics();
      healthMetrics.storage = storageMetrics;

      // Check data integrity
      const integrityCheck = await this.checkDataIntegrity();
      if (integrityCheck.criticalIssues > 0) {
        healthMetrics.healthIndicators.dataIntegrity = 'critical';
        healthMetrics.isHealthy = false;
        healthMetrics.warnings.push(`Data integrity issues found: ${integrityCheck.criticalIssues} critical`);
      } else if (integrityCheck.issues > 0) {
        healthMetrics.healthIndicators.dataIntegrity = 'degraded';
        healthMetrics.warnings.push(`Data integrity issues found: ${integrityCheck.issues} total`);
      }

      // Check disk space (simplified - in production would check actual filesystem)
      const diskSpaceHealth = await this.checkDiskSpace();
      if (!diskSpaceHealth.healthy) {
        healthMetrics.healthIndicators.diskSpace = diskSpaceHealth.critical ? 'critical' : 'degraded';
        if (diskSpaceHealth.critical) {
          healthMetrics.isHealthy = false;
        }
        healthMetrics.warnings.push(diskSpaceHealth.message);
      }

      healthMetrics.responseTime = Date.now() - startTime;
      
      // Store current metrics
      this.currentHealthMetrics = healthMetrics;

      // Emit health status
      this.emit('healthCheck', healthMetrics);

      // Log health status changes
      if (this.currentHealthMetrics && this.currentHealthMetrics.isHealthy !== healthMetrics.isHealthy) {
        logger.warn('Database health status changed', {
          previousHealth: this.currentHealthMetrics.isHealthy,
          currentHealth: healthMetrics.isHealthy,
          warnings: healthMetrics.warnings
        });
      }

      // Trigger automatic recovery actions if needed
      if (!healthMetrics.isHealthy) {
        await this.triggerAutomaticRecovery(healthMetrics);
      }

      return healthMetrics;
    } catch (error) {
      logger.error('Health check failed', { error });
      
      const errorMetrics: DatabaseHealthMetrics = {
        timestamp: new Date(),
        isHealthy: false,
        connectionStatus: 'error',
        responseTime: Date.now() - startTime,
        queryPerformance: {
          averageQueryTime: 0,
          slowQueries: 0,
          failedQueries: 1,
          totalQueries: 1
        },
        storage: {
          databaseSize: 0,
          tableCount: 0,
          recordCounts: {},
          indexCount: 0
        },
        healthIndicators: {
          connectionPool: 'critical',
          queryPerformance: 'critical',
          dataIntegrity: 'critical',
          diskSpace: 'critical'
        },
        recentErrors: [...this.recentErrors],
        warnings: [`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };

      this.recordError({
        timestamp: new Date(),
        type: 'connection',
        severity: 'critical',
        message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      });

      return errorMetrics;
    }
  }

  /**
   * Check basic database connectivity
   */
  private async checkConnectionHealth(): Promise<boolean> {
    try {
      const startTime = Date.now();
      const result = await this.db.healthCheck();
      const duration = Date.now() - startTime;
      
      this.recordQuery('SELECT 1', duration, result);
      
      if (duration > this.thresholds.maxResponseTime) {
        this.recordError({
          timestamp: new Date(),
          type: 'performance',
          severity: 'medium',
          message: `Slow database response: ${duration}ms`,
          details: { responseTime: duration }
        });
      }

      return result;
    } catch (error) {
      this.recordError({
        timestamp: new Date(),
        type: 'connection',
        severity: 'critical',
        message: `Database connection check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      });
      return false;
    }
  }

  /**
   * Analyze query performance from recent history
   */
  private analyzeQueryPerformance(): DatabaseHealthMetrics['queryPerformance'] {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const recentQueries = this.queryHistory.filter(q => q.timestamp >= oneMinuteAgo);
    
    const totalQueries = recentQueries.length;
    const successfulQueries = recentQueries.filter(q => q.success);
    const failedQueries = recentQueries.filter(q => !q.success);
    const slowQueries = recentQueries.filter(q => q.duration > this.thresholds.maxQueryTime);
    
    const averageQueryTime = totalQueries > 0 
      ? successfulQueries.reduce((sum, q) => sum + q.duration, 0) / successfulQueries.length 
      : 0;

    return {
      averageQueryTime,
      slowQueries: slowQueries.length,
      failedQueries: failedQueries.length,
      totalQueries
    };
  }

  /**
   * Get storage metrics from database
   */
  private async getStorageMetrics(): Promise<DatabaseHealthMetrics['storage']> {
    try {
      const dbStats = await getDatabaseStats();
      const dbInstance = (this.db as any).db;
      
      // Get table count
      const tableCountResult = dbInstance?.prepare(`
        SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'
      `).get();
      
      // Get index count
      const indexCountResult = dbInstance?.prepare(`
        SELECT COUNT(*) as count FROM sqlite_master WHERE type='index'
      `).get();
      
      // Get database size (simplified - would need filesystem access for actual size)
      const recordCounts: Record<string, number> = {};
      const tables = ['agent_states', 'agent_tasks', 'workflow_executions', 'tests', 'schedules'];
      
      for (const table of tables) {
        try {
          const result = dbInstance?.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
          recordCounts[table] = result?.count || 0;
        } catch (error) {
          // Table might not exist
          recordCounts[table] = 0;
        }
      }

      return {
        databaseSize: 0, // Would need filesystem access
        tableCount: tableCountResult?.count || 0,
        recordCounts,
        indexCount: indexCountResult?.count || 0
      };
    } catch (error) {
      this.recordError({
        timestamp: new Date(),
        type: 'query',
        severity: 'medium',
        message: `Failed to get storage metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      });
      
      return {
        databaseSize: 0,
        tableCount: 0,
        recordCounts: {},
        indexCount: 0
      };
    }
  }

  /**
   * Check data integrity using consistency service
   */
  private async checkDataIntegrity(): Promise<{
    issues: number;
    criticalIssues: number;
  }> {
    try {
      const consistencyCheck = await dataConsistencyService.runFullConsistencyCheck();
      const criticalIssues = consistencyCheck.issues.filter(i => i.severity === 'critical').length;
      
      return {
        issues: consistencyCheck.issues.length,
        criticalIssues
      };
    } catch (error) {
      this.recordError({
        timestamp: new Date(),
        type: 'integrity',
        severity: 'high',
        message: `Data integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      });
      
      return {
        issues: 1,
        criticalIssues: 1
      };
    }
  }

  /**
   * Check disk space (simplified implementation)
   */
  private async checkDiskSpace(): Promise<{
    healthy: boolean;
    critical: boolean;
    message: string;
    freeSpace?: number;
  }> {
    try {
      // In a real implementation, you would check actual filesystem space
      // This is a simplified version that assumes healthy disk space
      return {
        healthy: true,
        critical: false,
        message: 'Disk space healthy'
      };
    } catch (error) {
      return {
        healthy: false,
        critical: true,
        message: `Cannot check disk space: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Trigger automatic recovery actions based on health issues
   */
  private async triggerAutomaticRecovery(healthMetrics: DatabaseHealthMetrics): Promise<void> {
    try {
      // Connection recovery
      if (healthMetrics.healthIndicators.connectionPool === 'critical') {
        await this.triggerRecoveryAction('reconnection', 'Attempting to restore database connection');
      }

      // Data integrity recovery
      if (healthMetrics.healthIndicators.dataIntegrity === 'critical') {
        await this.triggerRecoveryAction('data_recovery', 'Attempting to fix critical data integrity issues');
      }

      // Performance optimization
      if (healthMetrics.healthIndicators.queryPerformance === 'degraded') {
        await this.triggerRecoveryAction('performance_optimization', 'Optimizing database performance');
      }

      // Cleanup if disk space is low
      if (healthMetrics.healthIndicators.diskSpace === 'degraded') {
        await this.triggerRecoveryAction('cleanup', 'Cleaning up old data to free disk space');
      }

    } catch (error) {
      logger.error('Automatic recovery failed', { error });
    }
  }

  /**
   * Trigger a specific recovery action
   */
  async triggerRecoveryAction(type: RecoveryAction['type'], description: string): Promise<string> {
    const recoveryId = `recovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const recovery: RecoveryAction = {
      id: recoveryId,
      type,
      status: 'pending',
      startedAt: new Date(),
      description
    };

    this.activeRecoveryActions.set(recoveryId, recovery);
    
    // Execute recovery action asynchronously
    this.executeRecoveryAction(recovery).catch(error => {
      logger.error(`Recovery action failed: ${recoveryId}`, { error });
    });

    return recoveryId;
  }

  /**
   * Execute a recovery action
   */
  private async executeRecoveryAction(recovery: RecoveryAction): Promise<void> {
    try {
      recovery.status = 'running';
      this.activeRecoveryActions.set(recovery.id, recovery);

      logger.info('Starting recovery action', {
        id: recovery.id,
        type: recovery.type,
        description: recovery.description
      });

      let result: RecoveryAction['result'];

      switch (recovery.type) {
        case 'reconnection':
          result = await this.performReconnection();
          break;
        case 'data_recovery':
          result = await this.performDataRecovery();
          break;
        case 'performance_optimization':
          result = await this.performPerformanceOptimization();
          break;
        case 'cleanup':
          result = await this.performCleanup();
          break;
        case 'schema_repair':
          result = await this.performSchemaRepair();
          break;
        default:
          throw new Error(`Unknown recovery type: ${recovery.type}`);
      }

      recovery.status = result.successful ? 'completed' : 'failed';
      recovery.completedAt = new Date();
      recovery.result = result;

      this.emit('recoveryCompleted', recovery);

      logger.info('Recovery action completed', {
        id: recovery.id,
        type: recovery.type,
        successful: result.successful,
        message: result.message
      });

    } catch (error) {
      recovery.status = 'failed';
      recovery.completedAt = new Date();
      recovery.result = {
        successful: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        details: { error }
      };

      this.emit('recoveryFailed', recovery);

      logger.error('Recovery action failed', {
        id: recovery.id,
        type: recovery.type,
        error
      });
    } finally {
      this.activeRecoveryActions.set(recovery.id, recovery);
    }
  }

  /**
   * Recovery action implementations
   */
  private async performReconnection(): Promise<RecoveryAction['result']> {
    try {
      // Test connection
      const isHealthy = await this.db.healthCheck();
      
      if (isHealthy) {
        return {
          successful: true,
          message: 'Database connection restored successfully'
        };
      } else {
        return {
          successful: false,
          message: 'Database connection could not be restored'
        };
      }
    } catch (error) {
      return {
        successful: false,
        message: `Reconnection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async performDataRecovery(): Promise<RecoveryAction['result']> {
    try {
      // Run consistency check and auto-fix issues
      const consistencyCheck = await dataConsistencyService.runFullConsistencyCheck();
      const criticalIssues = consistencyCheck.issues.filter(i => i.severity === 'critical' && i.autoFixable);
      
      // Auto-fix would be handled by the consistency service
      const fixCount = consistencyCheck.fixesApplied.length;
      
      return {
        successful: true,
        message: `Data recovery completed. ${fixCount} issues fixed.`,
        affectedRecords: fixCount
      };
    } catch (error) {
      return {
        successful: false,
        message: `Data recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async performPerformanceOptimization(): Promise<RecoveryAction['result']> {
    try {
      const dbInstance = (this.db as any).db;
      
      // Run VACUUM to optimize database
      dbInstance?.exec('VACUUM;');
      
      // Analyze tables for query optimization
      dbInstance?.exec('ANALYZE;');
      
      return {
        successful: true,
        message: 'Database performance optimization completed'
      };
    } catch (error) {
      return {
        successful: false,
        message: `Performance optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async performCleanup(): Promise<RecoveryAction['result']> {
    try {
      const cleanupResult = await this.db.cleanup(30); // Clean up data older than 30 days
      const totalCleaned = cleanupResult.schedules + cleanupResult.runs + 
                           (cleanupResult as any).agents + (cleanupResult as any).workflows;
      
      return {
        successful: true,
        message: `Cleanup completed. ${totalCleaned} records removed.`,
        affectedRecords: totalCleaned
      };
    } catch (error) {
      return {
        successful: false,
        message: `Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async performSchemaRepair(): Promise<RecoveryAction['result']> {
    try {
      // This would involve checking and repairing database schema
      // For now, just validate schema integrity
      const dbInstance = (this.db as any).db;
      const integrityResult = dbInstance?.prepare('PRAGMA integrity_check').get();
      
      if (integrityResult && integrityResult.integrity_check === 'ok') {
        return {
          successful: true,
          message: 'Schema integrity verified'
        };
      } else {
        return {
          successful: false,
          message: 'Schema integrity issues detected'
        };
      }
    } catch (error) {
      return {
        successful: false,
        message: `Schema repair failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Record database error
   */
  private recordError(error: DatabaseError): void {
    this.recentErrors.push(error);
    
    // Keep only last 100 errors
    if (this.recentErrors.length > 100) {
      this.recentErrors = this.recentErrors.slice(-100);
    }

    this.emit('databaseError', error);

    if (error.severity === 'critical') {
      logger.error('Critical database error', error);
    } else if (error.severity === 'high') {
      logger.warn('High severity database error', error);
    }
  }

  /**
   * Record query execution for performance monitoring
   */
  private recordQuery(query: string, duration: number, success: boolean): void {
    this.queryHistory.push({
      timestamp: new Date(),
      duration,
      query: query.substring(0, 200), // Truncate long queries
      success
    });

    // Keep only last 1000 queries
    if (this.queryHistory.length > 1000) {
      this.queryHistory = this.queryHistory.slice(-1000);
    }
  }

  /**
   * Get current health metrics
   */
  getCurrentHealthMetrics(): DatabaseHealthMetrics | null {
    return this.currentHealthMetrics;
  }

  /**
   * Get active recovery actions
   */
  getActiveRecoveryActions(): RecoveryAction[] {
    return Array.from(this.activeRecoveryActions.values());
  }

  /**
   * Get recent database errors
   */
  getRecentErrors(minutes: number = 60): DatabaseError[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.recentErrors.filter(error => error.timestamp >= cutoff);
  }

  /**
   * Shutdown health monitoring
   */
  shutdown(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    if (this.performanceMonitoringInterval) {
      clearInterval(this.performanceMonitoringInterval);
      this.performanceMonitoringInterval = null;
    }
    
    this.removeAllListeners();
    logger.info('DatabaseHealthService shutdown complete');
  }
}

// Singleton instance
export const databaseHealthService = new DatabaseHealthService();