/**
 * Webhook Handler - Processes Jira webhooks for bi-directional synchronization
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import { logger } from '@/utils/logger';
import Database from 'better-sqlite3';
import type { JiraWebhookEvent } from '@/types/agents';

export interface WebhookConfig {
  secret?: string;
  enableSignatureValidation: boolean;
  supportedEvents: string[];
}

export class WebhookHandler extends EventEmitter {
  private db: Database.Database;
  private config: WebhookConfig;
  private isRunning = false;

  constructor(config?: Partial<WebhookConfig>) {
    super();
    
    this.config = {
      enableSignatureValidation: true,
      supportedEvents: [
        'jira:issue_created',
        'jira:issue_updated',
        'jira:issue_deleted',
        'issue_property_set',
        'issue_property_deleted'
      ],
      ...config
    };

    const dbPath = process.env.NODE_ENV === 'test' ? ':memory:' : './data/qa-intelligence.db';
    this.db = new Database(dbPath);
    
    this.initializeWebhookSchema();
    this.isRunning = true;
    
    logger.info('Jira webhook handler initialized');
  }

  private initializeWebhookSchema(): void {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS jira_webhook_events (
          id TEXT PRIMARY KEY,
          webhook_event TEXT NOT NULL,
          jira_issue_id TEXT,
          jira_issue_key TEXT,
          event_timestamp INTEGER NOT NULL,
          user_account_id TEXT,
          raw_payload TEXT NOT NULL,
          changelog TEXT,
          processed BOOLEAN DEFAULT 0,
          processed_at TEXT,
          processing_error TEXT,
          received_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
        );

        CREATE INDEX IF NOT EXISTS idx_jira_webhooks_issue_key 
        ON jira_webhook_events(jira_issue_key);
        
        CREATE INDEX IF NOT EXISTS idx_jira_webhooks_processed 
        ON jira_webhook_events(processed, received_at);
        
        CREATE INDEX IF NOT EXISTS idx_jira_webhooks_timestamp 
        ON jira_webhook_events(event_timestamp);
      `);
    } catch (error) {
      logger.error('Failed to initialize webhook schema:', error);
      throw error;
    }
  }

  /**
   * Process incoming webhook payload
   */
  async processWebhook(
    payload: any,
    headers: Record<string, string> = {}
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Validate signature if configured
      if (this.config.enableSignatureValidation && this.config.secret) {
        const signature = headers['x-hub-signature'] || headers['x-atlassian-webhook-signature'];
        if (!signature) {
          logger.warn('Webhook received without signature');
          return { success: false, message: 'Missing signature' };
        }

        const isValid = this.validateSignature(JSON.stringify(payload), signature, this.config.secret);
        if (!isValid) {
          logger.error('Invalid webhook signature');
          return { success: false, message: 'Invalid signature' };
        }
      }

      // Check if event is supported
      const eventType = payload.webhookEvent;
      if (!this.config.supportedEvents.includes(eventType)) {
        logger.debug(`Unsupported webhook event: ${eventType}`);
        return { success: true, message: 'Event ignored - not supported' };
      }

      // Store webhook event
      const webhookEvent = await this.storeWebhookEvent(payload);
      
      // Process the event
      await this.processEvent(webhookEvent, payload);
      
      logger.info(`Webhook processed successfully: ${eventType} for ${payload.issue?.key || 'unknown'}`);
      
      return { success: true, message: 'Webhook processed successfully' };
    } catch (error) {
      logger.error('Failed to process webhook:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Processing failed' 
      };
    }
  }

  private validateSignature(payload: string, signature: string, secret: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
      
      const receivedSignature = signature.startsWith('sha256=') 
        ? signature.slice(7) 
        : signature;
      
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(receivedSignature)
      );
    } catch (error) {
      logger.error('Signature validation error:', error);
      return false;
    }
  }

  private async storeWebhookEvent(payload: any): Promise<string> {
    try {
      const id = this.generateWebhookId(payload);
      const eventType = payload.webhookEvent;
      const issue = payload.issue;
      const user = payload.user;
      const changelog = payload.changelog;

      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO jira_webhook_events (
          id, webhook_event, jira_issue_id, jira_issue_key,
          event_timestamp, user_account_id, raw_payload, changelog
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        eventType,
        issue?.id,
        issue?.key,
        payload.timestamp || Date.now(),
        user?.accountId,
        JSON.stringify(payload),
        changelog ? JSON.stringify(changelog) : null
      );

      logger.debug(`Stored webhook event: ${id}`);
      return id;
    } catch (error) {
      logger.error('Failed to store webhook event:', error);
      throw error;
    }
  }

  private generateWebhookId(payload: any): string {
    // Create deterministic ID to prevent duplicates
    const key = `${payload.webhookEvent}-${payload.issue?.key || 'no-issue'}-${payload.timestamp || Date.now()}`;
    return crypto.createHash('md5').update(key).digest('hex');
  }

  private async processEvent(webhookId: string, payload: any): Promise<void> {
    try {
      const eventType = payload.webhookEvent;
      
      switch (eventType) {
        case 'jira:issue_created':
          await this.handleIssueCreated(payload);
          break;
        case 'jira:issue_updated':
          await this.handleIssueUpdated(payload);
          break;
        case 'jira:issue_deleted':
          await this.handleIssueDeleted(payload);
          break;
        default:
          logger.debug(`No specific handler for event: ${eventType}`);
      }

      // Mark as processed
      await this.markEventProcessed(webhookId);
      
      // Emit event for other components
      this.emit('webhookProcessed', {
        webhookId,
        eventType,
        issueKey: payload.issue?.key,
        payload
      });
    } catch (error) {
      logger.error(`Failed to process webhook event ${webhookId}:`, error);
      await this.markEventFailed(webhookId, error);
      throw error;
    }
  }

  private async handleIssueCreated(payload: any): Promise<void> {
    const issue = payload.issue;
    if (!issue) return;

    logger.info(`Issue created via webhook: ${issue.key}`);
    
    // Emit event for issue creation
    this.emit('issueCreated', {
      issueKey: issue.key,
      issue: issue,
      source: 'webhook'
    });
  }

  private async handleIssueUpdated(payload: any): Promise<void> {
    const issue = payload.issue;
    const changelog = payload.changelog;
    
    if (!issue) return;

    logger.info(`Issue updated via webhook: ${issue.key}`);
    
    // Extract what changed
    const changes = this.extractChanges(changelog);
    
    // Emit event for issue update
    this.emit('issueUpdated', {
      issueKey: issue.key,
      issue: issue,
      changes: changes,
      changelog: changelog,
      source: 'webhook'
    });

    // Check for status changes specifically
    if (changes.some(c => c.field === 'status')) {
      this.emit('issueStatusChanged', {
        issueKey: issue.key,
        oldStatus: changes.find(c => c.field === 'status')?.fromString,
        newStatus: changes.find(c => c.field === 'status')?.toString,
        issue: issue
      });
    }

    // Check for resolution changes
    if (changes.some(c => c.field === 'resolution')) {
      this.emit('issueResolutionChanged', {
        issueKey: issue.key,
        oldResolution: changes.find(c => c.field === 'resolution')?.fromString,
        newResolution: changes.find(c => c.field === 'resolution')?.toString,
        issue: issue
      });
    }

    // Check for assignee changes
    if (changes.some(c => c.field === 'assignee')) {
      this.emit('issueAssigneeChanged', {
        issueKey: issue.key,
        oldAssignee: changes.find(c => c.field === 'assignee')?.fromString,
        newAssignee: changes.find(c => c.field === 'assignee')?.toString,
        issue: issue
      });
    }
  }

  private async handleIssueDeleted(payload: any): Promise<void> {
    const issue = payload.issue;
    if (!issue) return;

    logger.info(`Issue deleted via webhook: ${issue.key}`);
    
    // Emit event for issue deletion
    this.emit('issueDeleted', {
      issueKey: issue.key,
      issue: issue,
      source: 'webhook'
    });
  }

  private extractChanges(changelog: any): Array<{
    field: string;
    fieldtype: string;
    from: string;
    fromString: string;
    to: string;
    toString: string;
  }> {
    if (!changelog || !changelog.items) {
      return [];
    }

    return changelog.items.map((item: any) => ({
      field: item.field,
      fieldtype: item.fieldtype,
      from: item.from,
      fromString: item.fromString,
      to: item.to,
      toString: item.toString
    }));
  }

  private async markEventProcessed(webhookId: string): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        UPDATE jira_webhook_events 
        SET processed = 1, processed_at = datetime('now', 'utc')
        WHERE id = ?
      `);
      
      stmt.run(webhookId);
    } catch (error) {
      logger.error(`Failed to mark webhook ${webhookId} as processed:`, error);
    }
  }

  private async markEventFailed(webhookId: string, error: any): Promise<void> {
    try {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      const stmt = this.db.prepare(`
        UPDATE jira_webhook_events 
        SET processing_error = ?, processed_at = datetime('now', 'utc')
        WHERE id = ?
      `);
      
      stmt.run(errorMessage, webhookId);
    } catch (dbError) {
      logger.error(`Failed to mark webhook ${webhookId} as failed:`, dbError);
    }
  }

  /**
   * Get webhook events with optional filtering
   */
  async getWebhookEvents(criteria: {
    issueKey?: string;
    eventType?: string;
    processed?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<any[]> {
    try {
      const conditions = [];
      const values = [];

      if (criteria.issueKey) {
        conditions.push('jira_issue_key = ?');
        values.push(criteria.issueKey);
      }

      if (criteria.eventType) {
        conditions.push('webhook_event = ?');
        values.push(criteria.eventType);
      }

      if (criteria.processed !== undefined) {
        conditions.push('processed = ?');
        values.push(criteria.processed ? 1 : 0);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limitClause = criteria.limit ? `LIMIT ${criteria.limit}` : '';
      const offsetClause = criteria.offset ? `OFFSET ${criteria.offset}` : '';

      const stmt = this.db.prepare(`
        SELECT * FROM jira_webhook_events
        ${whereClause}
        ORDER BY received_at DESC
        ${limitClause} ${offsetClause}
      `);

      return stmt.all(...values);
    } catch (error) {
      logger.error('Failed to get webhook events:', error);
      throw error;
    }
  }

  /**
   * Get webhook statistics
   */
  async getWebhookStats(hours = 24): Promise<{
    total: number;
    processed: number;
    failed: number;
    byEventType: Record<string, number>;
  }> {
    try {
      const since = new Date(Date.now() - (hours * 60 * 60 * 1000)).toISOString();

      const totalStmt = this.db.prepare(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN processed = 1 THEN 1 END) as processed,
          COUNT(CASE WHEN processing_error IS NOT NULL THEN 1 END) as failed
        FROM jira_webhook_events 
        WHERE received_at > ?
      `);
      
      const totals = totalStmt.get(since);

      const eventTypeStmt = this.db.prepare(`
        SELECT webhook_event, COUNT(*) as count
        FROM jira_webhook_events 
        WHERE received_at > ?
        GROUP BY webhook_event
      `);
      
      const eventTypeRows = eventTypeStmt.all(since);
      const byEventType = eventTypeRows.reduce((acc, row) => {
        acc[row.webhook_event] = row.count;
        return acc;
      }, {} as Record<string, number>);

      return {
        total: totals.total,
        processed: totals.processed,
        failed: totals.failed,
        byEventType
      };
    } catch (error) {
      logger.error('Failed to get webhook stats:', error);
      throw error;
    }
  }

  /**
   * Clean up old webhook events
   */
  async cleanupOldEvents(olderThanDays = 30): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000)).toISOString();
      
      const stmt = this.db.prepare(`
        DELETE FROM jira_webhook_events 
        WHERE received_at < ? AND processed = 1
      `);
      
      const result = stmt.run(cutoffDate);
      
      logger.info(`Cleaned up ${result.changes} old webhook events`);
      return result.changes;
    } catch (error) {
      logger.error('Failed to cleanup old webhook events:', error);
      throw error;
    }
  }

  /**
   * Update webhook configuration
   */
  updateConfig(config: Partial<WebhookConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Webhook configuration updated');
  }

  /**
   * Check if handler is healthy
   */
  isHealthy(): boolean {
    try {
      // Test database connection
      this.db.prepare('SELECT 1').get();
      return this.isRunning;
    } catch (error) {
      logger.error('Webhook handler health check failed:', error);
      return false;
    }
  }

  /**
   * Stop the webhook handler
   */
  stop(): void {
    this.isRunning = false;
    this.removeAllListeners();
    logger.info('Webhook handler stopped');
  }
}