/**
 * Issue Mapper - Maps test failures to Jira issues with deduplication and sync
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { logger } from '@/utils/logger';
import type {
  JiraIssueMapping,
  TestFailureIssueData,
  JiraIssue
} from '@/types/agents';

interface CreateMappingData {
  testRunId: string;
  testName: string;
  failureHash: string;
  jiraIssueId: string;
  jiraIssueKey: string;
  jiraProjectKey: string;
  issueSummary: string;
  issueStatus: string;
  issuePriority: string;
  issueType: string;
  assigneeAccountId?: string;
  failureCategory: string;
  wesignModule: string;
  errorMessage: string;
  browserType: string;
  testEnvironment: string;
  language: string;
  linkedIssues: string[];
  createdInJiraAt: Date;
  lastSyncedAt: Date;
  syncStatus: 'synced' | 'pending' | 'error';
  syncError?: string;
  resolutionStatus: 'open' | 'in_progress' | 'resolved' | 'closed';
  resolvedAt?: Date;
}

export class IssueMapper {
  private db: Database.Database;

  constructor() {
    const dbPath = process.env.NODE_ENV === 'test' 
      ? ':memory:' 
      : './data/qa-intelligence.db';
    
    this.db = new Database(dbPath);
    this.initializeSchema();
  }

  private initializeSchema(): void {
    try {
      // Read and execute the Jira schema
      const fs = require('fs');
      const path = require('path');
      const schemaPath = path.join(__dirname, '../../../database/jira-schema.sql');
      
      if (fs.existsSync(schemaPath)) {
        const schema = fs.readFileSync(schemaPath, 'utf8');
        this.db.exec(schema);
        logger.info('Jira database schema initialized successfully');
      } else {
        logger.warn('Jira schema file not found, creating minimal schema');
        this.createMinimalSchema();
      }
    } catch (error) {
      logger.error('Failed to initialize Jira database schema:', error);
      throw error;
    }
  }

  private createMinimalSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS jira_issue_mappings (
        id TEXT PRIMARY KEY,
        test_run_id TEXT,
        test_name TEXT NOT NULL,
        failure_hash TEXT NOT NULL,
        jira_issue_id TEXT NOT NULL,
        jira_issue_key TEXT NOT NULL,
        jira_project_key TEXT NOT NULL,
        issue_summary TEXT,
        issue_status TEXT,
        issue_priority TEXT,
        issue_type TEXT,
        assignee_account_id TEXT,
        failure_category TEXT,
        wesign_module TEXT,
        error_message TEXT,
        browser_type TEXT,
        test_environment TEXT,
        language TEXT,
        linked_issues TEXT DEFAULT '[]',
        created_in_jira_at TEXT,
        last_synced_at TEXT,
        sync_status TEXT DEFAULT 'pending',
        sync_error TEXT,
        resolution_status TEXT DEFAULT 'open',
        resolved_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
        UNIQUE(test_run_id, test_name, failure_hash)
      );
    `);
  }

  /**
   * Generate a deterministic hash for test failure deduplication
   */
  static generateFailureHash(testName: string, errorMessage: string, selector?: string): string {
    const normalizedError = errorMessage
      .replace(/\d+/g, 'N') // Replace numbers with N
      .replace(/https?:\/\/[^\s]+/g, 'URL') // Replace URLs
      .replace(/at \S+:\d+:\d+/g, 'at LOCATION') // Replace stack trace locations
      .toLowerCase()
      .trim();

    const hashInput = [testName, normalizedError, selector || ''].join('|');
    return crypto.createHash('md5').update(hashInput).digest('hex');
  }

  /**
   * Find existing issue mapping to avoid duplicates
   */
  async findExistingIssue(
    testRunId: string,
    testName: string,
    failureHash: string
  ): Promise<JiraIssueMapping | null> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM jira_issue_mappings 
        WHERE test_run_id = ? AND test_name = ? AND failure_hash = ?
        ORDER BY created_at DESC LIMIT 1
      `);

      const row = stmt.get(testRunId, testName, failureHash);
      return row ? this.mapRowToIssueMapping(row) : null;
    } catch (error) {
      logger.error('Failed to find existing issue:', error);
      throw error;
    }
  }

  /**
   * Create new issue mapping
   */
  async createMapping(data: CreateMappingData): Promise<JiraIssueMapping> {
    try {
      const id = uuidv4();
      const now = new Date().toISOString();

      const stmt = this.db.prepare(`
        INSERT INTO jira_issue_mappings (
          id, test_run_id, test_name, failure_hash,
          jira_issue_id, jira_issue_key, jira_project_key,
          issue_summary, issue_status, issue_priority, issue_type,
          assignee_account_id, failure_category, wesign_module,
          error_message, browser_type, test_environment, language,
          linked_issues, created_in_jira_at, last_synced_at,
          sync_status, sync_error, resolution_status, resolved_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        data.testRunId,
        data.testName,
        data.failureHash,
        data.jiraIssueId,
        data.jiraIssueKey,
        data.jiraProjectKey,
        data.issueSummary,
        data.issueStatus,
        data.issuePriority,
        data.issueType,
        data.assigneeAccountId,
        data.failureCategory,
        data.wesignModule,
        data.errorMessage,
        data.browserType,
        data.testEnvironment,
        data.language,
        JSON.stringify(data.linkedIssues),
        data.createdInJiraAt.toISOString(),
        data.lastSyncedAt.toISOString(),
        data.syncStatus,
        data.syncError,
        data.resolutionStatus,
        data.resolvedAt?.toISOString()
      );

      const mapping = await this.getMappingById(id);
      if (!mapping) {
        throw new Error('Failed to retrieve created mapping');
      }

      logger.info(`Created issue mapping: ${data.jiraIssueKey} -> ${data.testName}`);
      return mapping;
    } catch (error) {
      logger.error('Failed to create issue mapping:', error);
      throw error;
    }
  }

  /**
   * Get mapping by ID
   */
  async getMappingById(id: string): Promise<JiraIssueMapping | null> {
    try {
      const stmt = this.db.prepare('SELECT * FROM jira_issue_mappings WHERE id = ?');
      const row = stmt.get(id);
      return row ? this.mapRowToIssueMapping(row) : null;
    } catch (error) {
      logger.error('Failed to get mapping by ID:', error);
      throw error;
    }
  }

  /**
   * Update mapping sync status
   */
  async updateMappingSync(
    jiraIssueKey: string,
    updates: {
      lastSyncedAt?: Date;
      syncStatus?: 'synced' | 'pending' | 'error';
      syncError?: string;
    }
  ): Promise<void> {
    try {
      const setClauses = [];
      const values = [];

      if (updates.lastSyncedAt) {
        setClauses.push('last_synced_at = ?');
        values.push(updates.lastSyncedAt.toISOString());
      }

      if (updates.syncStatus) {
        setClauses.push('sync_status = ?');
        values.push(updates.syncStatus);
      }

      if (updates.syncError !== undefined) {
        setClauses.push('sync_error = ?');
        values.push(updates.syncError);
      }

      setClauses.push('updated_at = ?');
      values.push(new Date().toISOString());

      values.push(jiraIssueKey);

      const stmt = this.db.prepare(`
        UPDATE jira_issue_mappings 
        SET ${setClauses.join(', ')} 
        WHERE jira_issue_key = ?
      `);

      stmt.run(...values);
    } catch (error) {
      logger.error('Failed to update mapping sync:', error);
      throw error;
    }
  }

  /**
   * Update mapping from Jira issue data
   */
  async updateMappingFromJiraIssue(jiraIssueKey: string, jiraIssue: JiraIssue): Promise<void> {
    try {
      const resolutionStatus = this.mapJiraStatusToResolution(jiraIssue.fields.status.name);
      const resolvedAt = resolutionStatus === 'resolved' || resolutionStatus === 'closed' 
        ? new Date() 
        : null;

      const stmt = this.db.prepare(`
        UPDATE jira_issue_mappings 
        SET 
          issue_summary = ?,
          issue_status = ?,
          issue_priority = ?,
          issue_type = ?,
          assignee_account_id = ?,
          resolution_status = ?,
          resolved_at = ?,
          last_synced_at = ?,
          sync_status = 'synced',
          sync_error = NULL,
          updated_at = ?
        WHERE jira_issue_key = ?
      `);

      stmt.run(
        jiraIssue.fields.summary,
        jiraIssue.fields.status.name,
        jiraIssue.fields.priority.name,
        jiraIssue.fields.issueType.name,
        jiraIssue.fields.assignee?.accountId,
        resolutionStatus,
        resolvedAt?.toISOString(),
        new Date().toISOString(),
        new Date().toISOString(),
        jiraIssueKey
      );

      logger.info(`Updated mapping from Jira issue: ${jiraIssueKey}`);
    } catch (error) {
      logger.error('Failed to update mapping from Jira issue:', error);
      throw error;
    }
  }

  /**
   * Update mapping from webhook data
   */
  async updateMappingFromWebhook(webhookData: any): Promise<void> {
    if (!webhookData.issue || !webhookData.issue.key) {
      return;
    }

    try {
      const jiraIssue = webhookData.issue;
      await this.updateMappingFromJiraIssue(jiraIssue.key, jiraIssue);
    } catch (error) {
      logger.error('Failed to update mapping from webhook:', error);
      throw error;
    }
  }

  /**
   * Get mappings by criteria
   */
  async getMappings(criteria: {
    projectKey?: string;
    resolutionStatus?: string;
    syncStatus?: string;
    limit?: number;
  }): Promise<JiraIssueMapping[]> {
    try {
      const whereClauses = [];
      const values = [];

      if (criteria.projectKey) {
        whereClauses.push('jira_project_key = ?');
        values.push(criteria.projectKey);
      }

      if (criteria.resolutionStatus) {
        whereClauses.push('resolution_status = ?');
        values.push(criteria.resolutionStatus);
      }

      if (criteria.syncStatus) {
        whereClauses.push('sync_status = ?');
        values.push(criteria.syncStatus);
      }

      const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
      const limitClause = criteria.limit ? `LIMIT ${criteria.limit}` : '';

      const stmt = this.db.prepare(`
        SELECT * FROM jira_issue_mappings 
        ${whereClause}
        ORDER BY created_at DESC 
        ${limitClause}
      `);

      const rows = stmt.all(...values);
      return rows.map(row => this.mapRowToIssueMapping(row));
    } catch (error) {
      logger.error('Failed to get mappings:', error);
      throw error;
    }
  }

  /**
   * Generate various reports
   */
  async generateReport(reportType: string, dateRange?: { start: Date; end: Date }): Promise<any> {
    try {
      switch (reportType) {
        case 'summary':
          return this.generateSummaryReport(dateRange);
        case 'failure-analysis':
          return this.generateFailureAnalysisReport(dateRange);
        case 'resolution-metrics':
          return this.generateResolutionMetricsReport(dateRange);
        default:
          throw new Error(`Unsupported report type: ${reportType}`);
      }
    } catch (error) {
      logger.error('Failed to generate report:', error);
      throw error;
    }
  }

  private async generateSummaryReport(dateRange?: { start: Date; end: Date }): Promise<any> {
    const dateFilter = dateRange 
      ? 'WHERE created_at BETWEEN ? AND ?' 
      : '';
    
    const values = dateRange ? [dateRange.start.toISOString(), dateRange.end.toISOString()] : [];

    const stmt = this.db.prepare(`
      SELECT 
        COUNT(*) as total_issues,
        COUNT(CASE WHEN resolution_status = 'open' THEN 1 END) as open_issues,
        COUNT(CASE WHEN resolution_status = 'resolved' THEN 1 END) as resolved_issues,
        COUNT(CASE WHEN sync_status = 'error' THEN 1 END) as sync_errors,
        AVG(CASE WHEN resolved_at IS NOT NULL AND created_at IS NOT NULL THEN
          (julianday(resolved_at) - julianday(created_at))
        END) as avg_resolution_time_days
      FROM jira_issue_mappings ${dateFilter}
    `);

    return stmt.get(...values);
  }

  private async generateFailureAnalysisReport(dateRange?: { start: Date; end: Date }): Promise<any> {
    const dateFilter = dateRange 
      ? 'WHERE created_at BETWEEN ? AND ?' 
      : 'WHERE created_at > datetime("now", "-30 days")';
    
    const values = dateRange ? [dateRange.start.toISOString(), dateRange.end.toISOString()] : [];

    const stmt = this.db.prepare(`
      SELECT 
        failure_category,
        wesign_module,
        language,
        COUNT(*) as failure_count,
        COUNT(CASE WHEN resolution_status = 'resolved' THEN 1 END) as resolved_count,
        ROUND(
          CAST(COUNT(CASE WHEN resolution_status = 'resolved' THEN 1 END) AS REAL) / 
          COUNT(*) * 100, 2
        ) as resolution_rate_percent
      FROM jira_issue_mappings ${dateFilter}
      GROUP BY failure_category, wesign_module, language
      ORDER BY failure_count DESC
    `);

    return stmt.all(...values);
  }

  private async generateResolutionMetricsReport(dateRange?: { start: Date; end: Date }): Promise<any> {
    const dateFilter = dateRange 
      ? 'WHERE resolved_at BETWEEN ? AND ?' 
      : 'WHERE resolved_at IS NOT NULL';
    
    const values = dateRange ? [dateRange.start.toISOString(), dateRange.end.toISOString()] : [];

    const stmt = this.db.prepare(`
      SELECT 
        resolution_status,
        COUNT(*) as count,
        AVG(julianday(resolved_at) - julianday(created_at)) as avg_resolution_days,
        MIN(julianday(resolved_at) - julianday(created_at)) as min_resolution_days,
        MAX(julianday(resolved_at) - julianday(created_at)) as max_resolution_days
      FROM jira_issue_mappings ${dateFilter}
      GROUP BY resolution_status
      ORDER BY count DESC
    `);

    return stmt.all(...values);
  }

  /**
   * Test database connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const stmt = this.db.prepare('SELECT 1');
      stmt.get();
      return true;
    } catch (error) {
      logger.error('Database connection test failed:', error);
      return false;
    }
  }

  private mapRowToIssueMapping(row: any): JiraIssueMapping {
    return {
      id: row.id,
      testRunId: row.test_run_id,
      testName: row.test_name,
      failureHash: row.failure_hash,
      jiraIssueId: row.jira_issue_id,
      jiraIssueKey: row.jira_issue_key,
      jiraProjectKey: row.jira_project_key,
      issueSummary: row.issue_summary,
      issueStatus: row.issue_status,
      issuePriority: row.issue_priority,
      issueType: row.issue_type,
      assigneeAccountId: row.assignee_account_id,
      failureCategory: row.failure_category,
      wesignModule: row.wesign_module,
      errorMessage: row.error_message,
      browserType: row.browser_type,
      testEnvironment: row.test_environment,
      language: row.language,
      linkedIssues: JSON.parse(row.linked_issues || '[]'),
      parentIssueKey: row.parent_issue_key,
      createdInJiraAt: new Date(row.created_in_jira_at),
      lastSyncedAt: new Date(row.last_synced_at),
      syncStatus: row.sync_status,
      syncError: row.sync_error,
      resolutionStatus: row.resolution_status,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined
    };
  }

  private mapJiraStatusToResolution(jiraStatus: string): 'open' | 'in_progress' | 'resolved' | 'closed' {
    const status = jiraStatus.toLowerCase();
    
    if (status.includes('done') || status.includes('resolved') || status.includes('fixed')) {
      return 'resolved';
    }
    
    if (status.includes('closed')) {
      return 'closed';
    }
    
    if (status.includes('progress') || status.includes('review') || status.includes('testing')) {
      return 'in_progress';
    }
    
    return 'open';
  }
}