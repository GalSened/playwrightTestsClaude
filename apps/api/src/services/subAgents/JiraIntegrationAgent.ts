/**
 * Jira Integration Agent - Complete Jira workflow integration for QA Intelligence
 * Handles issue creation, tracking, and bi-directional synchronization
 */

import { EventEmitter } from 'events';
import { logger } from '@/utils/logger';
import { JiraAPIClient } from './jira/JiraAPIClient';
import { IssueMapper } from './jira/IssueMapper';
import { WebhookHandler } from './jira/WebhookHandler';
import { QueueProcessor } from './jira/QueueProcessor';
import { TemplateEngine } from './jira/TemplateEngine';
import type {
  SubAgent,
  AgentTask,
  AgentResult,
  AgentStatus,
  AgentCapability,
  AgentContext,
  JiraConfig,
  TestFailureIssueData,
  JiraIssue,
  JiraOperation
} from '@/types/agents';

export class JiraIntegrationAgent extends EventEmitter implements SubAgent {
  public readonly id = 'jira-integration-agent';
  public readonly type = 'jira-integration' as const;
  public readonly capabilities: AgentCapability[] = [
    'issue-management',
    'test-failure-tracking', 
    'quality-reporting',
    'bilingual-support',
    'wesign-domain-knowledge'
  ];

  public status: AgentStatus['status'] = 'idle';
  public currentTask?: string;
  public lastActivity?: Date;

  private apiClient?: JiraAPIClient;
  private issueMapper: IssueMapper;
  private webhookHandler: WebhookHandler;
  private queueProcessor: QueueProcessor;
  private templateEngine: TemplateEngine;
  private config?: JiraConfig;

  constructor() {
    super();
    
    // Initialize components
    this.issueMapper = new IssueMapper();
    this.webhookHandler = new WebhookHandler();
    this.queueProcessor = new QueueProcessor();
    this.templateEngine = new TemplateEngine();

    // Set up event handlers
    this.setupEventHandlers();
    
    logger.info(`${this.id} initialized with capabilities:`, this.capabilities);
  }

  private setupEventHandlers(): void {
    // API client events
    this.on('configUpdated', (config: JiraConfig) => {
      this.initializeApiClient(config);
    });

    // Queue processor events
    this.queueProcessor.on('operationCompleted', (result) => {
      this.emit('operationCompleted', result);
    });

    this.queueProcessor.on('operationFailed', (error) => {
      this.emit('operationFailed', error);
    });

    // Webhook events
    this.webhookHandler.on('issueUpdated', (update) => {
      this.handleJiraIssueUpdate(update);
    });
  }

  private async initializeApiClient(config: JiraConfig): Promise<void> {
    try {
      this.config = config;
      this.apiClient = new JiraAPIClient(config);
      
      // Test connection
      const connectionOk = await this.apiClient.testConnection();
      if (!connectionOk) {
        throw new Error('Failed to connect to Jira API');
      }
      
      // Update queue processor with API client
      this.queueProcessor.setApiClient(this.apiClient);
      
      logger.info(`${this.id} successfully connected to Jira:`, config.baseUrl);
    } catch (error) {
      logger.error(`${this.id} failed to initialize API client:`, error);
      throw error;
    }
  }

  async execute(task: AgentTask): Promise<AgentResult> {
    const startTime = Date.now();
    this.status = 'busy';
    this.currentTask = task.id;
    this.lastActivity = new Date();

    logger.info(`${this.id} executing task:`, {
      taskId: task.id,
      type: task.type,
      priority: task.priority
    });

    try {
      let result: AgentResult;

      switch (task.type) {
        case 'create-issue':
          result = await this.createIssue(task);
          break;
        
        case 'update-issue':
          result = await this.updateIssue(task);
          break;
        
        case 'link-issues':
          result = await this.linkIssues(task);
          break;
        
        case 'sync-status':
          result = await this.syncStatus(task);
          break;
        
        case 'bulk-create':
          result = await this.bulkCreateIssues(task);
          break;
        
        case 'generate-report':
          result = await this.generateReport(task);
          break;
        
        case 'health-check':
          result = await this.performHealthCheck(task);
          break;
        
        default:
          throw new Error(`Unsupported task type: ${task.type}`);
      }

      result.executionTime = Date.now() - startTime;
      this.status = 'idle';
      this.currentTask = undefined;
      this.lastActivity = new Date();

      logger.info(`${this.id} completed task ${task.id}:`, {
        status: result.status,
        executionTime: result.executionTime
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error(`${this.id} failed to execute task ${task.id}:`, error);
      
      this.status = 'error';
      this.currentTask = undefined;
      this.lastActivity = new Date();

      return {
        taskId: task.id,
        agentId: this.id,
        status: 'error',
        data: {},
        executionTime: Date.now() - startTime,
        error: errorMessage
      };
    }
  }

  private async createIssue(task: AgentTask): Promise<AgentResult> {
    if (!this.apiClient) {
      throw new Error('Jira API client not initialized');
    }

    const issueData = task.data as TestFailureIssueData;
    
    // Check for existing issue to avoid duplicates
    const existingMapping = await this.issueMapper.findExistingIssue(
      issueData.testRunId,
      issueData.testName,
      issueData.failureHash
    );

    if (existingMapping) {
      logger.info(`Issue already exists for test failure:`, existingMapping.jiraIssueKey);
      return {
        taskId: task.id,
        agentId: this.id,
        status: 'success',
        data: { 
          issueKey: existingMapping.jiraIssueKey,
          duplicate: true 
        },
        executionTime: 0
      };
    }

    // Generate issue template based on failure type
    const template = await this.templateEngine.generateIssueTemplate(issueData);
    
    // Create issue in Jira
    const jiraIssue = await this.apiClient.createIssue({
      fields: {
        project: { key: this.config!.defaultProject },
        summary: template.summary,
        description: template.description,
        issuetype: { name: template.issueType },
        priority: { name: issueData.priority },
        labels: template.labels
      }
    });

    // Create mapping record
    const mapping = await this.issueMapper.createMapping({
      testRunId: issueData.testRunId,
      testName: issueData.testName,
      failureHash: issueData.failureHash,
      jiraIssueId: jiraIssue.id,
      jiraIssueKey: jiraIssue.key,
      jiraProjectKey: this.config!.defaultProject,
      issueSummary: jiraIssue.fields.summary,
      issueStatus: jiraIssue.fields.status.name,
      issuePriority: jiraIssue.fields.priority.name,
      issueType: jiraIssue.fields.issueType.name,
      failureCategory: this.categorizeFailure(issueData.errorMessage),
      wesignModule: issueData.wesignModule,
      errorMessage: issueData.errorMessage,
      browserType: issueData.browserType,
      testEnvironment: issueData.environment,
      language: issueData.language,
      linkedIssues: [],
      createdInJiraAt: new Date(),
      lastSyncedAt: new Date(),
      syncStatus: 'synced',
      resolutionStatus: 'open'
    });

    // Add attachments if provided
    if (issueData.screenshots.length > 0) {
      await this.attachScreenshots(jiraIssue.key, issueData.screenshots);
    }

    return {
      taskId: task.id,
      agentId: this.id,
      status: 'success',
      data: {
        issueKey: jiraIssue.key,
        issueId: jiraIssue.id,
        mappingId: mapping.id,
        url: `${this.config!.baseUrl}/browse/${jiraIssue.key}`
      },
      executionTime: 0,
      recommendations: [
        `Issue ${jiraIssue.key} created for test failure`,
        `Monitor issue progress in Jira dashboard`,
        `Consider linking related test failures`
      ]
    };
  }

  private async updateIssue(task: AgentTask): Promise<AgentResult> {
    if (!this.apiClient) {
      throw new Error('Jira API client not initialized');
    }

    const { issueKey, updates } = task.data;
    
    await this.apiClient.updateIssue(issueKey, updates);
    
    // Update local mapping
    await this.issueMapper.updateMappingSync(issueKey, {
      lastSyncedAt: new Date(),
      syncStatus: 'synced'
    });

    return {
      taskId: task.id,
      agentId: this.id,
      status: 'success',
      data: { issueKey, updated: true },
      executionTime: 0
    };
  }

  private async linkIssues(task: AgentTask): Promise<AgentResult> {
    if (!this.apiClient) {
      throw new Error('Jira API client not initialized');
    }

    const { inwardIssue, outwardIssue, linkType = 'Relates' } = task.data;
    
    await this.apiClient.linkIssues(inwardIssue, outwardIssue, linkType);

    return {
      taskId: task.id,
      agentId: this.id,
      status: 'success',
      data: { 
        linked: true,
        inwardIssue,
        outwardIssue,
        linkType 
      },
      executionTime: 0
    };
  }

  private async syncStatus(task: AgentTask): Promise<AgentResult> {
    if (!this.apiClient) {
      throw new Error('Jira API client not initialized');
    }

    const { issueKeys } = task.data;
    const syncResults = [];

    for (const issueKey of issueKeys) {
      try {
        const jiraIssue = await this.apiClient.getIssue(issueKey);
        await this.issueMapper.updateMappingFromJiraIssue(issueKey, jiraIssue);
        syncResults.push({ issueKey, synced: true });
      } catch (error) {
        logger.error(`Failed to sync issue ${issueKey}:`, error);
        syncResults.push({ 
          issueKey, 
          synced: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    const successCount = syncResults.filter(r => r.synced).length;
    const failCount = syncResults.length - successCount;

    return {
      taskId: task.id,
      agentId: this.id,
      status: failCount === 0 ? 'success' : 'partial',
      data: { 
        syncResults,
        summary: {
          total: syncResults.length,
          synced: successCount,
          failed: failCount
        }
      },
      executionTime: 0
    };
  }

  private async bulkCreateIssues(task: AgentTask): Promise<AgentResult> {
    if (!this.apiClient) {
      throw new Error('Jira API client not initialized');
    }

    const { issuesData } = task.data as { issuesData: TestFailureIssueData[] };
    const results = [];

    // Process in batches to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < issuesData.length; i += batchSize) {
      const batch = issuesData.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (issueData) => {
        try {
          const createTask: AgentTask = {
            id: `bulk-${task.id}-${i}`,
            type: 'create-issue',
            data: issueData,
            context: task.context
          };
          
          const result = await this.createIssue(createTask);
          return { issueData, result, success: true };
        } catch (error) {
          return { 
            issueData, 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Rate limiting delay between batches
      if (i + batchSize < issuesData.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;

    return {
      taskId: task.id,
      agentId: this.id,
      status: failCount === 0 ? 'success' : 'partial',
      data: {
        results,
        summary: {
          total: results.length,
          created: successCount,
          failed: failCount
        }
      },
      executionTime: 0,
      recommendations: [
        `Bulk operation completed: ${successCount}/${results.length} issues created`,
        failCount > 0 ? 'Review failed issues for retry' : 'All issues created successfully'
      ]
    };
  }

  private async generateReport(task: AgentTask): Promise<AgentResult> {
    const { reportType = 'summary', dateRange } = task.data;
    
    const report = await this.issueMapper.generateReport(reportType, dateRange);
    
    return {
      taskId: task.id,
      agentId: this.id,
      status: 'success',
      data: { report },
      executionTime: 0,
      artifacts: [{
        type: 'report',
        name: `jira-${reportType}-report.json`,
        path: `/tmp/jira-report-${Date.now()}.json`,
        size: JSON.stringify(report).length,
        mimeType: 'application/json'
      }]
    };
  }

  private async performHealthCheck(task: AgentTask): Promise<AgentResult> {
    const health = {
      apiConnection: null as boolean | null,
      queueProcessor: false,
      database: false,
      webhookHandler: false,
      configured: false
    };

    let overallStatus: 'healthy' | 'not_configured' | 'unhealthy' = 'unhealthy';

    try {
      // Check if Jira is configured
      if (!this.config || !this.apiClient) {
        health.configured = false;
        health.apiConnection = null;
        overallStatus = 'not_configured';
        
        // For unconfigured state, only check internal components
        health.queueProcessor = this.queueProcessor.isHealthy();
        health.database = await this.issueMapper.testConnection();
        health.webhookHandler = this.webhookHandler.isHealthy();

        logger.debug(`${this.id} health check: not configured, internal components only`);
      } else {
        health.configured = true;
        
        // Test API connection only when configured
        health.apiConnection = await this.apiClient.testConnection();
        health.queueProcessor = this.queueProcessor.isHealthy();
        health.database = await this.issueMapper.testConnection();
        health.webhookHandler = this.webhookHandler.isHealthy();

        // Determine if configured agent is healthy
        const componentsHealthy = health.apiConnection && 
                                health.queueProcessor && 
                                health.database && 
                                health.webhookHandler;
        
        overallStatus = componentsHealthy ? 'healthy' : 'unhealthy';
        
        logger.debug(`${this.id} health check: configured, overall status: ${overallStatus}`);
      }

    } catch (error) {
      logger.debug(`${this.id} health check error (non-critical):`, error.message);
      overallStatus = health.configured ? 'unhealthy' : 'not_configured';
    }

    // Return success for both healthy and not_configured states to stop error flooding
    const shouldReturnSuccess = overallStatus === 'healthy' || overallStatus === 'not_configured';

    return {
      taskId: task.id,
      agentId: this.id,
      status: shouldReturnSuccess ? 'success' : 'error',
      data: { 
        health,
        overall: overallStatus,
        timestamp: new Date().toISOString(),
        message: overallStatus === 'not_configured' 
          ? 'Jira integration not configured - configure via UI to enable full functionality'
          : overallStatus === 'healthy' 
            ? 'All Jira components operational'
            : 'Some Jira components have issues'
      },
      executionTime: 0
    };
  }

  private async attachScreenshots(issueKey: string, screenshots: string[]): Promise<void> {
    if (!this.apiClient) return;

    for (const screenshot of screenshots) {
      try {
        // Convert screenshot path to buffer (implementation depends on storage)
        const fs = await import('fs');
        const content = fs.readFileSync(screenshot);
        const filename = screenshot.split('/').pop() || 'screenshot.png';
        
        await this.apiClient.addAttachment(issueKey, filename, content);
      } catch (error) {
        logger.warn(`Failed to attach screenshot ${screenshot} to ${issueKey}:`, error);
      }
    }
  }

  private categorizeFailure(errorMessage: string): string {
    const message = errorMessage.toLowerCase();
    
    if (message.includes('selector') || message.includes('element')) return 'selector';
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('api') || message.includes('http')) return 'api';
    if (message.includes('auth') || message.includes('login')) return 'auth';
    if (message.includes('data') || message.includes('validation')) return 'data';
    if (message.includes('performance') || message.includes('slow')) return 'performance';
    
    return 'unknown';
  }

  private async handleJiraIssueUpdate(update: any): Promise<void> {
    try {
      await this.issueMapper.updateMappingFromWebhook(update);
      this.emit('issueUpdatedFromJira', update);
    } catch (error) {
      logger.error(`${this.id} failed to handle Jira issue update:`, error);
    }
  }

  getStatus(): AgentStatus {
    return {
      id: this.id,
      type: this.type,
      status: this.status,
      capabilities: this.capabilities,
      currentTask: this.currentTask,
      lastActivity: this.lastActivity
    };
  }

  getCapabilities(): AgentCapability[] {
    return [...this.capabilities];
  }

  updateContext(context: Partial<AgentContext>): void {
    // Update agent context if needed
    logger.debug(`${this.id} context updated:`, context);
  }

  async shutdown(): Promise<void> {
    logger.info(`${this.id} shutting down...`);
    
    this.status = 'offline';
    this.queueProcessor.stop();
    this.webhookHandler.stop();
    
    this.removeAllListeners();
  }

  // Public configuration methods
  async configure(config: JiraConfig): Promise<void> {
    await this.initializeApiClient(config);
    this.emit('configUpdated', config);
  }

  async getProjects(): Promise<any[]> {
    if (!this.apiClient) {
      throw new Error('Jira API client not initialized');
    }
    return this.apiClient.getProjects();
  }

  async validateConfiguration(): Promise<boolean> {
    if (!this.apiClient) return false;
    return this.apiClient.testConnection();
  }
}