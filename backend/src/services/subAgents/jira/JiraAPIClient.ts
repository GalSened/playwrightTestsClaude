/**
 * Jira API Client - Robust integration with Jira REST API
 * Supports OAuth 2.0 and API Token authentication with comprehensive error handling
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import { logger } from '@/utils/logger';
import type { JiraConfig, JiraIssue, JiraWebhookEvent } from '@/types/agents';

export interface JiraAPIError extends Error {
  status?: number;
  code?: string;
  response?: any;
}

export interface JiraRateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: Date;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
  lead: {
    accountId: string;
    displayName: string;
  };
  issueTypes: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
}

export interface JiraCreateIssueData {
  fields: {
    project: { key: string };
    summary: string;
    description: string;
    issuetype: { name: string };
    priority?: { name: string };
    assignee?: { accountId: string };
    labels?: string[];
    [key: string]: any; // Custom fields
  };
}

export interface JiraSearchResult {
  issues: JiraIssue[];
  total: number;
  maxResults: number;
  startAt: number;
}

export class JiraAPIClient extends EventEmitter {
  private client: AxiosInstance;
  private config: JiraConfig;
  private rateLimitInfo?: JiraRateLimitInfo;
  private circuitBreakerState = {
    failures: 0,
    lastFailureTime: 0,
    state: 'closed' as 'closed' | 'open' | 'half-open'
  };
  
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute

  constructor(config: JiraConfig) {
    super();
    this.config = config;
    this.client = this.createAxiosInstance();
    
    logger.info(`Jira API Client initialized for: ${config.baseUrl}`);
  }

  /**
   * Create and configure Axios instance with authentication
   */
  private createAxiosInstance(): AxiosInstance {
    const instance = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'WeSign-QA-Intelligence/1.0'
      }
    });

    // Set up authentication
    if (this.config.authType === 'oauth2' && this.config.accessToken) {
      instance.defaults.headers.common['Authorization'] = `Bearer ${this.config.accessToken}`;
    } else if (this.config.authType === 'api_token' && this.config.email && this.config.apiToken) {
      const auth = Buffer.from(`${this.config.email}:${this.config.apiToken}`).toString('base64');
      instance.defaults.headers.common['Authorization'] = `Basic ${auth}`;
    }

    // Request interceptor for rate limiting and circuit breaker
    instance.interceptors.request.use(
      (config) => this.handleRequest(config),
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling and rate limit tracking
    instance.interceptors.response.use(
      (response) => this.handleResponse(response),
      (error) => this.handleError(error)
    );

    return instance;
  }

  /**
   * Handle outgoing requests - circuit breaker and rate limiting
   */
  private async handleRequest(config: AxiosRequestConfig): Promise<AxiosRequestConfig> {
    // Check circuit breaker
    if (this.circuitBreakerState.state === 'open') {
      const timeSinceFailure = Date.now() - this.circuitBreakerState.lastFailureTime;
      if (timeSinceFailure < this.CIRCUIT_BREAKER_TIMEOUT) {
        throw new Error('Circuit breaker is open - Jira API temporarily unavailable');
      } else {
        this.circuitBreakerState.state = 'half-open';
        logger.info('Circuit breaker transitioning to half-open state');
      }
    }

    // Check rate limits
    if (this.rateLimitInfo && this.rateLimitInfo.remaining === 0) {
      const timeUntilReset = this.rateLimitInfo.resetTime.getTime() - Date.now();
      if (timeUntilReset > 0) {
        logger.warn(`Rate limit exceeded, waiting ${timeUntilReset}ms`);
        await this.delay(timeUntilReset);
      }
    }

    return config;
  }

  /**
   * Handle successful responses - extract rate limit info
   */
  private handleResponse(response: AxiosResponse): AxiosResponse {
    // Reset circuit breaker on success
    if (this.circuitBreakerState.state === 'half-open') {
      this.circuitBreakerState.state = 'closed';
      this.circuitBreakerState.failures = 0;
      logger.info('Circuit breaker reset to closed state');
    }

    // Extract rate limit information from headers
    const rateLimitHeaders = response.headers;
    if (rateLimitHeaders['x-ratelimit-limit']) {
      this.rateLimitInfo = {
        limit: parseInt(rateLimitHeaders['x-ratelimit-limit']),
        remaining: parseInt(rateLimitHeaders['x-ratelimit-remaining'] || '0'),
        resetTime: new Date(parseInt(rateLimitHeaders['x-ratelimit-reset']) * 1000)
      };
    }

    return response;
  }

  /**
   * Handle API errors with comprehensive error classification
   */
  private async handleError(error: any): Promise<never> {
    const apiError: JiraAPIError = new Error('Jira API Error');
    
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      apiError.status = status;
      apiError.response = data;
      
      // Classify error types
      switch (status) {
        case 401:
          apiError.message = 'Authentication failed - invalid credentials';
          apiError.code = 'AUTH_FAILED';
          this.emit('authError', apiError);
          break;
          
        case 403:
          apiError.message = 'Permission denied - insufficient privileges';
          apiError.code = 'PERMISSION_DENIED';
          break;
          
        case 429:
          apiError.message = 'Rate limit exceeded';
          apiError.code = 'RATE_LIMITED';
          // Update rate limit info from response
          if (error.response.headers['retry-after']) {
            const retryAfter = parseInt(error.response.headers['retry-after']) * 1000;
            await this.delay(retryAfter);
          }
          break;
          
        case 500:
        case 502:
        case 503:
        case 504:
          apiError.message = `Server error: ${status}`;
          apiError.code = 'SERVER_ERROR';
          this.incrementCircuitBreakerFailures();
          break;
          
        default:
          apiError.message = `HTTP ${status}: ${data.errorMessages?.[0] || error.message}`;
          apiError.code = 'API_ERROR';
      }
    } else if (error.request) {
      apiError.message = 'Network error - unable to reach Jira server';
      apiError.code = 'NETWORK_ERROR';
      this.incrementCircuitBreakerFailures();
    } else {
      apiError.message = `Request error: ${error.message}`;
      apiError.code = 'REQUEST_ERROR';
    }

    logger.error('Jira API Error:', {
      message: apiError.message,
      code: apiError.code,
      status: apiError.status,
      url: error.config?.url
    });

    throw apiError;
  }

  /**
   * Increment circuit breaker failure count
   */
  private incrementCircuitBreakerFailures(): void {
    this.circuitBreakerState.failures++;
    this.circuitBreakerState.lastFailureTime = Date.now();
    
    if (this.circuitBreakerState.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitBreakerState.state = 'open';
      logger.error('Circuit breaker opened due to repeated failures');
      this.emit('circuitBreakerOpen', this.circuitBreakerState);
    }
  }

  /**
   * Delay execution for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Test API connection and authentication
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/rest/api/3/myself');
      logger.info(`Jira connection successful: ${response.data.displayName}`);
      return true;
    } catch (error) {
      logger.error('Jira connection test failed:', error);
      return false;
    }
  }

  /**
   * Get list of accessible projects
   */
  async getProjects(): Promise<JiraProject[]> {
    try {
      const response = await this.client.get('/rest/api/3/project');
      
      // Fetch issue types for each project
      const projects: JiraProject[] = await Promise.all(
        response.data.map(async (project: any) => {
          try {
            const issueTypesResponse = await this.client.get(`/rest/api/3/project/${project.key}/statuses`);
            const issueTypes = Object.keys(issueTypesResponse.data).map(name => ({
              id: name,
              name: name,
              description: `Issue type: ${name}`
            }));
            
            return {
              id: project.id,
              key: project.key,
              name: project.name,
              projectTypeKey: project.projectTypeKey,
              lead: project.lead,
              issueTypes
            };
          } catch (error) {
            logger.warn(`Failed to fetch issue types for project ${project.key}:`, error);
            return {
              id: project.id,
              key: project.key,
              name: project.name,
              projectTypeKey: project.projectTypeKey,
              lead: project.lead,
              issueTypes: []
            };
          }
        })
      );

      return projects;
    } catch (error) {
      logger.error('Failed to fetch Jira projects:', error);
      throw error;
    }
  }

  /**
   * Create a new Jira issue
   */
  async createIssue(issueData: JiraCreateIssueData): Promise<JiraIssue> {
    try {
      logger.info(`Creating Jira issue: ${issueData.fields.summary}`);
      
      const response = await this.client.post('/rest/api/3/issue', issueData);
      const issueKey = response.data.key;
      
      // Fetch the complete issue data
      const issue = await this.getIssue(issueKey);
      
      logger.info(`Jira issue created successfully: ${issueKey}`);
      this.emit('issueCreated', issue);
      
      return issue;
    } catch (error) {
      logger.error('Failed to create Jira issue:', error);
      throw error;
    }
  }

  /**
   * Get issue by key or ID
   */
  async getIssue(issueKeyOrId: string, expand?: string[]): Promise<JiraIssue> {
    try {
      const expandParam = expand ? `?expand=${expand.join(',')}` : '';
      const response = await this.client.get(`/rest/api/3/issue/${issueKeyOrId}${expandParam}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch Jira issue ${issueKeyOrId}:`, error);
      throw error;
    }
  }

  /**
   * Update existing issue
   */
  async updateIssue(issueKeyOrId: string, updateData: any): Promise<void> {
    try {
      logger.info(`Updating Jira issue: ${issueKeyOrId}`);
      
      await this.client.put(`/rest/api/3/issue/${issueKeyOrId}`, {
        fields: updateData
      });
      
      logger.info(`Jira issue updated successfully: ${issueKeyOrId}`);
      this.emit('issueUpdated', { key: issueKeyOrId, updates: updateData });
    } catch (error) {
      logger.error(`Failed to update Jira issue ${issueKeyOrId}:`, error);
      throw error;
    }
  }

  /**
   * Add comment to issue
   */
  async addComment(issueKeyOrId: string, comment: string): Promise<void> {
    try {
      const response = await this.client.post(`/rest/api/3/issue/${issueKeyOrId}/comment`, {
        body: {
          type: 'doc',
          version: 1,
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: comment
            }]
          }]
        }
      });
      
      logger.info(`Comment added to issue ${issueKeyOrId}`);
      this.emit('commentAdded', { issueKey: issueKeyOrId, commentId: response.data.id });
    } catch (error) {
      logger.error(`Failed to add comment to issue ${issueKeyOrId}:`, error);
      throw error;
    }
  }

  /**
   * Search for issues using JQL
   */
  async searchIssues(
    jql: string,
    fields?: string[],
    expand?: string[],
    maxResults = 50,
    startAt = 0
  ): Promise<JiraSearchResult> {
    try {
      const params = new URLSearchParams({
        jql,
        maxResults: maxResults.toString(),
        startAt: startAt.toString()
      });
      
      if (fields?.length) {
        params.append('fields', fields.join(','));
      }
      
      if (expand?.length) {
        params.append('expand', expand.join(','));
      }

      const response = await this.client.get(`/rest/api/3/search?${params.toString()}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to search Jira issues:', error);
      throw error;
    }
  }

  /**
   * Create bulk issues
   */
  async createBulkIssues(issuesData: JiraCreateIssueData[]): Promise<any> {
    try {
      logger.info(`Creating ${issuesData.length} Jira issues in bulk`);
      
      const response = await this.client.post('/rest/api/3/issue/bulk', {
        issueUpdates: issuesData.map(issue => ({ fields: issue.fields }))
      });
      
      logger.info(`Bulk issue creation completed: ${response.data.issues?.length} created`);
      this.emit('bulkIssuesCreated', response.data);
      
      return response.data;
    } catch (error) {
      logger.error('Failed to create bulk issues:', error);
      throw error;
    }
  }

  /**
   * Add attachment to issue
   */
  async addAttachment(issueKeyOrId: string, filename: string, content: Buffer): Promise<void> {
    try {
      const formData = new FormData();
      formData.append('file', new Blob([content]), filename);

      await this.client.post(`/rest/api/3/issue/${issueKeyOrId}/attachments`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-Atlassian-Token': 'no-check'
        }
      });

      logger.info(`Attachment ${filename} added to issue ${issueKeyOrId}`);
      this.emit('attachmentAdded', { issueKey: issueKeyOrId, filename });
    } catch (error) {
      logger.error(`Failed to add attachment to issue ${issueKeyOrId}:`, error);
      throw error;
    }
  }

  /**
   * Link two issues
   */
  async linkIssues(
    inwardIssue: string,
    outwardIssue: string,
    linkType: string = 'Relates'
  ): Promise<void> {
    try {
      await this.client.post('/rest/api/3/issueLink', {
        type: { name: linkType },
        inwardIssue: { key: inwardIssue },
        outwardIssue: { key: outwardIssue }
      });

      logger.info(`Issues linked: ${inwardIssue} -> ${outwardIssue} (${linkType})`);
      this.emit('issuesLinked', { inward: inwardIssue, outward: outwardIssue, linkType });
    } catch (error) {
      logger.error(`Failed to link issues ${inwardIssue} and ${outwardIssue}:`, error);
      throw error;
    }
  }

  /**
   * Get current rate limit status
   */
  getRateLimitInfo(): JiraRateLimitInfo | undefined {
    return this.rateLimitInfo;
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerState(): typeof this.circuitBreakerState {
    return { ...this.circuitBreakerState };
  }

  /**
   * Update configuration (requires recreating the client)
   */
  updateConfig(config: JiraConfig): void {
    this.config = config;
    this.client = this.createAxiosInstance();
    logger.info('Jira API Client configuration updated');
  }

  /**
   * Generate webhook signature for validation
   */
  static generateWebhookSignature(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Validate webhook signature
   */
  static validateWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    const expectedSignature = this.generateWebhookSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(`sha256=${expectedSignature}`)
    );
  }
}