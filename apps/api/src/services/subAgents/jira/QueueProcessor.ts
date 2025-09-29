/**
 * Queue Processor - Reliable processing of Jira operations with retries and rate limiting
 */

import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/utils/logger';
import type { JiraAPIClient } from './JiraAPIClient';
import type { JiraOperation } from '@/types/agents';

export interface QueueConfig {
  maxConcurrent: number;
  processingInterval: number; // milliseconds
  maxRetries: number;
  retryBackoffMs: number;
  rateLimitBuffer: number; // seconds to wait after rate limit
}

export class QueueProcessor extends EventEmitter {
  private db: Database.Database;
  private config: QueueConfig;
  private apiClient?: JiraAPIClient;
  private isRunning = false;
  private processingTimer?: NodeJS.Timeout;
  private activeOperations = new Set<string>();

  constructor(config?: Partial<QueueConfig>) {
    super();
    
    this.config = {
      maxConcurrent: 5,
      processingInterval: 2000, // 2 seconds
      maxRetries: 3,
      retryBackoffMs: 5000, // 5 seconds
      rateLimitBuffer: 60000, // 1 minute
      ...config
    };

    const dbPath = process.env.NODE_ENV === 'test' ? ':memory:' : './data/qa-intelligence.db';
    this.db = new Database(dbPath);
    
    this.initializeQueueSchema();
    logger.info('Jira queue processor initialized');
  }

  private initializeQueueSchema(): void {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS jira_sync_operations (
          id TEXT PRIMARY KEY,
          operation_type TEXT NOT NULL CHECK (operation_type IN (
            'create_issue', 'update_issue', 'add_comment', 'link_issues', 'bulk_create'
          )),
          payload TEXT NOT NULL,
          jira_issue_key TEXT,
          mapping_id TEXT,
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
            'pending', 'processing', 'completed', 'failed', 'cancelled'
          )),
          priority INTEGER DEFAULT 5,
          scheduled_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
          started_at TEXT,
          completed_at TEXT,
          attempt_count INTEGER DEFAULT 0,
          max_attempts INTEGER DEFAULT 3,
          last_error TEXT,
          error_details TEXT,
          rate_limit_reset_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
        );

        CREATE INDEX IF NOT EXISTS idx_jira_operations_status 
        ON jira_sync_operations(status, priority);
        
        CREATE INDEX IF NOT EXISTS idx_jira_operations_scheduled 
        ON jira_sync_operations(scheduled_at);
        
        CREATE INDEX IF NOT EXISTS idx_jira_operations_issue_key 
        ON jira_sync_operations(jira_issue_key);
        
        CREATE INDEX IF NOT EXISTS idx_jira_operations_type 
        ON jira_sync_operations(operation_type);
      `);
    } catch (error) {
      logger.error('Failed to initialize queue schema:', error);
      throw error;
    }
  }

  /**
   * Set the API client for processing operations
   */
  setApiClient(apiClient: JiraAPIClient): void {
    this.apiClient = apiClient;
    logger.info('Queue processor API client updated');
  }

  /**
   * Start the queue processor
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Queue processor already running');
      return;
    }

    this.isRunning = true;
    this.scheduleProcessing();
    logger.info('Queue processor started');
  }

  /**
   * Stop the queue processor
   */
  stop(): void {
    this.isRunning = false;
    
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
      this.processingTimer = undefined;
    }

    logger.info('Queue processor stopped');
  }

  /**
   * Queue a new operation
   */
  async queueOperation(
    operationType: JiraOperation['operationType'],
    payload: any,
    options: {
      priority?: number;
      jiraIssueKey?: string;
      mappingId?: string;
      maxAttempts?: number;
      scheduledAt?: Date;
    } = {}
  ): Promise<string> {
    try {
      const id = uuidv4();
      const now = new Date().toISOString();

      const stmt = this.db.prepare(`
        INSERT INTO jira_sync_operations (
          id, operation_type, payload, jira_issue_key, mapping_id,
          priority, max_attempts, scheduled_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        operationType,
        JSON.stringify(payload),
        options.jiraIssueKey || null,
        options.mappingId || null,
        options.priority || 5,
        options.maxAttempts || this.config.maxRetries,
        options.scheduledAt?.toISOString() || now
      );

      logger.info(`Queued operation ${operationType}: ${id}`);
      
      // Trigger immediate processing if not running
      if (!this.processingTimer) {
        this.scheduleProcessing();
      }

      return id;
    } catch (error) {
      logger.error('Failed to queue operation:', error);
      throw error;
    }
  }

  private scheduleProcessing(): void {
    if (!this.isRunning) return;

    this.processingTimer = setTimeout(async () => {
      try {
        await this.processPendingOperations();
      } catch (error) {
        logger.error('Error processing operations:', error);
      }
      
      // Schedule next processing cycle
      this.scheduleProcessing();
    }, this.config.processingInterval);
  }

  private async processPendingOperations(): Promise<void> {
    if (!this.apiClient) {
      logger.debug('No API client available, skipping processing');
      return;
    }

    // Get available processing slots
    const availableSlots = this.config.maxConcurrent - this.activeOperations.size;
    if (availableSlots <= 0) {
      return;
    }

    // Get pending operations ordered by priority and scheduled time
    const operations = this.getPendingOperations(availableSlots);
    
    if (operations.length === 0) {
      return;
    }

    logger.debug(`Processing ${operations.length} operations`);

    // Process operations concurrently
    const processingPromises = operations.map(op => this.processOperation(op));
    await Promise.allSettled(processingPromises);
  }

  private getPendingOperations(limit: number): any[] {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM jira_sync_operations
        WHERE status = 'pending' 
        AND scheduled_at <= datetime('now', 'utc')
        AND (rate_limit_reset_at IS NULL OR rate_limit_reset_at <= datetime('now', 'utc'))
        ORDER BY priority ASC, scheduled_at ASC
        LIMIT ?
      `);

      return stmt.all(limit);
    } catch (error) {
      logger.error('Failed to get pending operations:', error);
      return [];
    }
  }

  private async processOperation(operation: any): Promise<void> {
    const operationId = operation.id;
    
    if (this.activeOperations.has(operationId)) {
      return; // Already being processed
    }

    this.activeOperations.add(operationId);
    
    try {
      // Mark as processing
      await this.updateOperationStatus(operationId, 'processing', {
        startedAt: new Date(),
        attemptCount: operation.attempt_count + 1
      });

      // Execute the operation
      const result = await this.executeOperation(operation);
      
      // Mark as completed
      await this.updateOperationStatus(operationId, 'completed', {
        completedAt: new Date()
      });

      this.emit('operationCompleted', {
        operationId,
        operationType: operation.operation_type,
        result
      });

      logger.info(`Operation completed: ${operationId}`);
    } catch (error) {
      const isRetryable = await this.handleOperationError(operation, error);
      
      if (!isRetryable) {
        this.emit('operationFailed', {
          operationId,
          operationType: operation.operation_type,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      logger.error(`Operation ${isRetryable ? 'failed (retryable)' : 'failed (final)'}: ${operationId}`, error);
    } finally {
      this.activeOperations.delete(operationId);
    }
  }

  private async executeOperation(operation: any): Promise<any> {
    if (!this.apiClient) {
      throw new Error('API client not available');
    }

    const payload = JSON.parse(operation.payload);
    
    switch (operation.operation_type) {
      case 'create_issue':
        return await this.apiClient.createIssue(payload);
        
      case 'update_issue':
        return await this.apiClient.updateIssue(payload.issueKey, payload.updates);
        
      case 'add_comment':
        return await this.apiClient.addComment(payload.issueKey, payload.comment);
        
      case 'link_issues':
        return await this.apiClient.linkIssues(
          payload.inwardIssue, 
          payload.outwardIssue, 
          payload.linkType
        );
        
      case 'bulk_create':
        return await this.apiClient.createBulkIssues(payload.issuesData);
        
      default:
        throw new Error(`Unsupported operation type: ${operation.operation_type}`);
    }
  }

  private async handleOperationError(operation: any, error: any): Promise<boolean> {
    const operationId = operation.id;
    const attemptCount = operation.attempt_count + 1;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Check if it's a rate limit error
    if (this.isRateLimitError(error)) {
      const resetTime = this.calculateRateLimitReset(error);
      await this.updateOperationStatus(operationId, 'pending', {
        rateLimitResetAt: resetTime,
        lastError: errorMessage,
        attemptCount
      });
      return true; // Retryable
    }

    // Check if we should retry
    if (attemptCount < operation.max_attempts && this.isRetryableError(error)) {
      const nextAttemptAt = new Date(Date.now() + (this.config.retryBackoffMs * attemptCount));
      
      await this.updateOperationStatus(operationId, 'pending', {
        scheduledAt: nextAttemptAt,
        lastError: errorMessage,
        attemptCount
      });
      
      return true; // Retryable
    }

    // Mark as permanently failed
    await this.updateOperationStatus(operationId, 'failed', {
      lastError: errorMessage,
      errorDetails: JSON.stringify({
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        attemptCount
      }),
      attemptCount
    });

    return false; // Not retryable
  }

  private isRateLimitError(error: any): boolean {
    return error?.status === 429 || 
           error?.code === 'RATE_LIMITED' ||
           (error instanceof Error && error.message.toLowerCase().includes('rate limit'));
  }

  private isRetryableError(error: any): boolean {
    if (this.isRateLimitError(error)) return true;
    
    const status = error?.status;
    if (status) {
      // Server errors are retryable
      return status >= 500 && status < 600;
    }

    // Network errors are retryable
    return error?.code === 'NETWORK_ERROR' || error?.code === 'ECONNRESET';
  }

  private calculateRateLimitReset(error: any): Date {
    // Try to extract reset time from error
    const retryAfter = error?.response?.headers?.['retry-after'];
    if (retryAfter) {
      return new Date(Date.now() + (parseInt(retryAfter) * 1000));
    }
    
    // Default to buffer time
    return new Date(Date.now() + this.config.rateLimitBuffer);
  }

  private async updateOperationStatus(
    operationId: string, 
    status: JiraOperation['status'], 
    updates: {
      startedAt?: Date;
      completedAt?: Date;
      scheduledAt?: Date;
      rateLimitResetAt?: Date;
      attemptCount?: number;
      lastError?: string;
      errorDetails?: string;
    } = {}
  ): Promise<void> {
    try {
      const setClauses = ['status = ?', 'updated_at = ?'];
      const values = [status, new Date().toISOString()];

      if (updates.startedAt) {
        setClauses.push('started_at = ?');
        values.push(updates.startedAt.toISOString());
      }

      if (updates.completedAt) {
        setClauses.push('completed_at = ?');
        values.push(updates.completedAt.toISOString());
      }

      if (updates.scheduledAt) {
        setClauses.push('scheduled_at = ?');
        values.push(updates.scheduledAt.toISOString());
      }

      if (updates.rateLimitResetAt) {
        setClauses.push('rate_limit_reset_at = ?');
        values.push(updates.rateLimitResetAt.toISOString());
      }

      if (updates.attemptCount !== undefined) {
        setClauses.push('attempt_count = ?');
        values.push(updates.attemptCount);
      }

      if (updates.lastError !== undefined) {
        setClauses.push('last_error = ?');
        values.push(updates.lastError);
      }

      if (updates.errorDetails !== undefined) {
        setClauses.push('error_details = ?');
        values.push(updates.errorDetails);
      }

      values.push(operationId);

      const stmt = this.db.prepare(`
        UPDATE jira_sync_operations 
        SET ${setClauses.join(', ')}
        WHERE id = ?
      `);

      stmt.run(...values);
    } catch (error) {
      logger.error(`Failed to update operation status for ${operationId}:`, error);
      throw error;
    }
  }

  /**
   * Get operation status
   */
  async getOperation(operationId: string): Promise<JiraOperation | null> {
    try {
      const stmt = this.db.prepare('SELECT * FROM jira_sync_operations WHERE id = ?');
      const row = stmt.get(operationId);
      return row ? this.mapRowToOperation(row) : null;
    } catch (error) {
      logger.error('Failed to get operation:', error);
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    rateLimited: number;
    oldestPending?: Date;
  }> {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
          COUNT(CASE WHEN rate_limit_reset_at > datetime('now', 'utc') THEN 1 END) as rateLimited,
          MIN(CASE WHEN status = 'pending' THEN scheduled_at END) as oldestPending
        FROM jira_sync_operations
        WHERE created_at > datetime('now', '-24 hours', 'utc')
      `);

      const result = stmt.get();
      return {
        ...result,
        oldestPending: result.oldestPending ? new Date(result.oldestPending) : undefined
      };
    } catch (error) {
      logger.error('Failed to get queue stats:', error);
      throw error;
    }
  }

  /**
   * Cancel operation
   */
  async cancelOperation(operationId: string): Promise<boolean> {
    try {
      const stmt = this.db.prepare(`
        UPDATE jira_sync_operations 
        SET status = 'cancelled', updated_at = datetime('now', 'utc')
        WHERE id = ? AND status IN ('pending', 'processing')
      `);

      const result = stmt.run(operationId);
      return result.changes > 0;
    } catch (error) {
      logger.error('Failed to cancel operation:', error);
      throw error;
    }
  }

  /**
   * Clean up old completed/failed operations
   */
  async cleanupOldOperations(olderThanDays = 7): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000)).toISOString();
      
      const stmt = this.db.prepare(`
        DELETE FROM jira_sync_operations 
        WHERE completed_at < ? AND status IN ('completed', 'failed', 'cancelled')
      `);
      
      const result = stmt.run(cutoffDate);
      
      logger.info(`Cleaned up ${result.changes} old operations`);
      return result.changes;
    } catch (error) {
      logger.error('Failed to cleanup old operations:', error);
      throw error;
    }
  }

  private mapRowToOperation(row: any): JiraOperation {
    return {
      id: row.id,
      operationType: row.operation_type,
      payload: JSON.parse(row.payload),
      jiraIssueKey: row.jira_issue_key,
      mappingId: row.mapping_id,
      status: row.status,
      priority: row.priority,
      scheduledAt: new Date(row.scheduled_at),
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      attemptCount: row.attempt_count,
      maxAttempts: row.max_attempts,
      lastError: row.last_error,
      errorDetails: row.error_details
    };
  }

  /**
   * Check if processor is healthy
   */
  isHealthy(): boolean {
    try {
      this.db.prepare('SELECT 1').get();
      return this.isRunning;
    } catch (error) {
      logger.error('Queue processor health check failed:', error);
      return false;
    }
  }
}