/**
 * Jira API Routes - RESTful endpoints for Jira integration
 */

import express from 'express';
import { logger } from '@/utils/logger';
import { agentOrchestrator } from '@/services/subAgents/AgentOrchestrator';
import type { JiraIntegrationAgent } from '@/services/subAgents/JiraIntegrationAgent';
import type {
  JiraConfig,
  TestFailureIssueData,
  AgentTask,
  JiraIssueMapping
} from '@/types/agents';
import { IssueMapper } from '@/services/subAgents/jira/IssueMapper';

const router = express.Router();

// Get Jira agent instance
const getJiraAgent = (): JiraIntegrationAgent | null => {
  const agents = agentOrchestrator.getAgentStatus();
  const jiraAgent = Object.values(agents).find(
    agent => agent.type === 'jira-integration'
  );
  return jiraAgent ? agentOrchestrator['agents'].get('jira-integration-agent') as JiraIntegrationAgent : null;
};

/**
 * GET /api/jira/config
 * Get current Jira configuration
 */
router.get('/config', async (req, res) => {
  try {
    const jiraAgent = getJiraAgent();
    if (!jiraAgent) {
      return res.status(503).json({ error: 'Jira agent not available' });
    }

    // Return sanitized config (without secrets)
    const sanitizedConfig = {
      baseUrl: '***',
      authType: '***',
      defaultProject: '***',
      status: 'not_configured'
    };

    res.json({ config: sanitizedConfig });
  } catch (error) {
    logger.error('Failed to get Jira config:', error);
    res.status(500).json({ error: 'Failed to get configuration' });
  }
});

/**
 * POST /api/jira/config
 * Update Jira configuration
 */
router.post('/config', async (req, res) => {
  try {
    const jiraAgent = getJiraAgent();
    if (!jiraAgent) {
      return res.status(503).json({ error: 'Jira agent not available' });
    }

    const config: JiraConfig = req.body;
    
    // Validate required fields
    if (!config.baseUrl || !config.authType || !config.defaultProject) {
      return res.status(400).json({ error: 'Missing required configuration fields' });
    }

    // Validate auth-specific fields
    if (config.authType === 'api_token' && (!config.email || !config.apiToken)) {
      return res.status(400).json({ error: 'API token authentication requires email and apiToken' });
    }

    if (config.authType === 'oauth2' && (!config.clientId || !config.clientSecret)) {
      return res.status(400).json({ error: 'OAuth2 authentication requires clientId and clientSecret' });
    }

    // Configure the agent
    await jiraAgent.configure(config);
    
    // Test the configuration
    const isValid = await jiraAgent.validateConfiguration();
    
    res.json({ 
      success: true, 
      configured: isValid,
      message: isValid ? 'Configuration successful' : 'Configuration saved but connection failed'
    });
  } catch (error) {
    logger.error('Failed to configure Jira:', error);
    res.status(500).json({ error: 'Configuration failed' });
  }
});

/**
 * GET /api/jira/projects
 * Get available Jira projects
 */
router.get('/projects', async (req, res) => {
  try {
    const jiraAgent = getJiraAgent();
    if (!jiraAgent) {
      return res.status(503).json({ error: 'Jira agent not available' });
    }

    const projects = await jiraAgent.getProjects();
    res.json({ projects });
  } catch (error) {
    logger.error('Failed to get Jira projects:', error);
    res.status(500).json({ error: 'Failed to get projects' });
  }
});

/**
 * POST /api/jira/test-connection
 * Test Jira API connection
 */
router.post('/test-connection', async (req, res) => {
  try {
    const jiraAgent = getJiraAgent();
    if (!jiraAgent) {
      return res.status(503).json({ error: 'Jira agent not available' });
    }

    const isConnected = await jiraAgent.validateConfiguration();
    res.json({ connected: isConnected });
  } catch (error) {
    logger.error('Jira connection test failed:', error);
    res.status(500).json({ 
      connected: false, 
      error: error instanceof Error ? error.message : 'Connection test failed' 
    });
  }
});

/**
 * POST /api/jira/issues
 * Create a Jira issue from test failure data
 */
router.post('/issues', async (req, res) => {
  try {
    const jiraAgent = getJiraAgent();
    if (!jiraAgent) {
      return res.status(503).json({ error: 'Jira agent not available' });
    }

    const issueData: TestFailureIssueData = req.body;
    
    // Validate required fields
    if (!issueData.testName || !issueData.errorMessage || !issueData.url) {
      return res.status(400).json({ error: 'Missing required issue data' });
    }

    // Generate failure hash if not provided
    if (!issueData.failureHash) {
      issueData.failureHash = IssueMapper.generateFailureHash(
        issueData.testName,
        issueData.errorMessage,
        issueData.selector
      );
    }

    // Create agent task
    const task: AgentTask = {
      id: `create-issue-${Date.now()}`,
      type: 'create-issue',
      data: issueData,
      context: {
        testRun: issueData.testRunId ? {
          id: issueData.testRunId,
          suiteName: 'WeSign Test Suite',
          status: 'failed',
          startedAt: new Date()
        } : undefined
      },
      priority: 'medium'
    };

    // Execute task
    const result = await jiraAgent.execute(task);
    
    if (result.status === 'success') {
      res.json({
        success: true,
        issueKey: result.data.issueKey,
        issueId: result.data.issueId,
        url: result.data.url,
        duplicate: result.data.duplicate || false
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to create issue'
      });
    }
  } catch (error) {
    logger.error('Failed to create Jira issue:', error);
    res.status(500).json({ error: 'Failed to create issue' });
  }
});

/**
 * PUT /api/jira/issues/:issueKey
 * Update a Jira issue
 */
router.put('/issues/:issueKey', async (req, res) => {
  try {
    const jiraAgent = getJiraAgent();
    if (!jiraAgent) {
      return res.status(503).json({ error: 'Jira agent not available' });
    }

    const { issueKey } = req.params;
    const updates = req.body;

    const task: AgentTask = {
      id: `update-issue-${Date.now()}`,
      type: 'update-issue',
      data: { issueKey, updates },
      context: {},
      priority: 'medium'
    };

    const result = await jiraAgent.execute(task);
    
    if (result.status === 'success') {
      res.json({ success: true, issueKey });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to update issue'
      });
    }
  } catch (error) {
    logger.error('Failed to update Jira issue:', error);
    res.status(500).json({ error: 'Failed to update issue' });
  }
});

/**
 * POST /api/jira/issues/:issueKey/link
 * Link two Jira issues
 */
router.post('/issues/:issueKey/link', async (req, res) => {
  try {
    const jiraAgent = getJiraAgent();
    if (!jiraAgent) {
      return res.status(503).json({ error: 'Jira agent not available' });
    }

    const { issueKey } = req.params;
    const { targetIssue, linkType = 'Relates' } = req.body;

    if (!targetIssue) {
      return res.status(400).json({ error: 'Target issue key is required' });
    }

    const task: AgentTask = {
      id: `link-issues-${Date.now()}`,
      type: 'link-issues',
      data: {
        inwardIssue: issueKey,
        outwardIssue: targetIssue,
        linkType
      },
      context: {},
      priority: 'low'
    };

    const result = await jiraAgent.execute(task);
    
    if (result.status === 'success') {
      res.json({ success: true, linked: true });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to link issues'
      });
    }
  } catch (error) {
    logger.error('Failed to link Jira issues:', error);
    res.status(500).json({ error: 'Failed to link issues' });
  }
});

/**
 * POST /api/jira/issues/bulk
 * Create multiple Jira issues in bulk
 */
router.post('/issues/bulk', async (req, res) => {
  try {
    const jiraAgent = getJiraAgent();
    if (!jiraAgent) {
      return res.status(503).json({ error: 'Jira agent not available' });
    }

    const { issuesData } = req.body;

    if (!Array.isArray(issuesData) || issuesData.length === 0) {
      return res.status(400).json({ error: 'Issues data array is required' });
    }

    // Generate failure hashes for issues that don't have them
    issuesData.forEach((issueData: TestFailureIssueData) => {
      if (!issueData.failureHash) {
        issueData.failureHash = IssueMapper.generateFailureHash(
          issueData.testName,
          issueData.errorMessage,
          issueData.selector
        );
      }
    });

    const task: AgentTask = {
      id: `bulk-create-${Date.now()}`,
      type: 'bulk-create',
      data: { issuesData },
      context: {},
      priority: 'low'
    };

    const result = await jiraAgent.execute(task);
    
    if (result.status === 'success' || result.status === 'partial') {
      res.json({
        success: true,
        summary: result.data.summary,
        results: result.data.results
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Bulk creation failed'
      });
    }
  } catch (error) {
    logger.error('Failed to create bulk Jira issues:', error);
    res.status(500).json({ error: 'Failed to create bulk issues' });
  }
});

/**
 * POST /api/jira/sync
 * Sync issue status from Jira
 */
router.post('/sync', async (req, res) => {
  try {
    const jiraAgent = getJiraAgent();
    if (!jiraAgent) {
      return res.status(503).json({ error: 'Jira agent not available' });
    }

    const { issueKeys } = req.body;

    if (!Array.isArray(issueKeys) || issueKeys.length === 0) {
      return res.status(400).json({ error: 'Issue keys array is required' });
    }

    const task: AgentTask = {
      id: `sync-status-${Date.now()}`,
      type: 'sync-status',
      data: { issueKeys },
      context: {},
      priority: 'low'
    };

    const result = await jiraAgent.execute(task);
    
    if (result.status === 'success' || result.status === 'partial') {
      res.json({
        success: true,
        summary: result.data.summary,
        syncResults: result.data.syncResults
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Sync failed'
      });
    }
  } catch (error) {
    logger.error('Failed to sync Jira issues:', error);
    res.status(500).json({ error: 'Failed to sync issues' });
  }
});

/**
 * GET /api/jira/mappings
 * Get issue mappings with optional filtering
 */
router.get('/mappings', async (req, res) => {
  try {
    const {
      projectKey,
      resolutionStatus,
      syncStatus,
      limit = 50,
      offset = 0
    } = req.query;

    const issueMapper = new IssueMapper();
    const mappings = await issueMapper.getMappings({
      projectKey: projectKey as string,
      resolutionStatus: resolutionStatus as string,
      syncStatus: syncStatus as string,
      limit: parseInt(limit as string)
    });

    res.json({ 
      mappings,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        total: mappings.length
      }
    });
  } catch (error) {
    logger.error('Failed to get issue mappings:', error);
    res.status(500).json({ error: 'Failed to get mappings' });
  }
});

/**
 * GET /api/jira/reports/:type
 * Generate Jira reports
 */
router.get('/reports/:type', async (req, res) => {
  try {
    const jiraAgent = getJiraAgent();
    if (!jiraAgent) {
      return res.status(503).json({ error: 'Jira agent not available' });
    }

    const { type } = req.params;
    const { startDate, endDate } = req.query;

    const dateRange = startDate && endDate ? {
      start: new Date(startDate as string),
      end: new Date(endDate as string)
    } : undefined;

    const task: AgentTask = {
      id: `generate-report-${Date.now()}`,
      type: 'generate-report',
      data: { reportType: type, dateRange },
      context: {},
      priority: 'low'
    };

    const result = await jiraAgent.execute(task);
    
    if (result.status === 'success') {
      res.json({
        success: true,
        report: result.data.report,
        type,
        dateRange
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Report generation failed'
      });
    }
  } catch (error) {
    logger.error('Failed to generate Jira report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

/**
 * GET /api/jira/health
 * Get Jira integration health status
 */
router.get('/health', async (req, res) => {
  try {
    const jiraAgent = getJiraAgent();
    if (!jiraAgent) {
      return res.status(503).json({ 
        healthy: false, 
        error: 'Jira agent not available' 
      });
    }

    const task: AgentTask = {
      id: `health-check-${Date.now()}`,
      type: 'health-check',
      data: {},
      context: {},
      priority: 'high'
    };

    const result = await jiraAgent.execute(task);
    
    res.json({
      healthy: result.status === 'success',
      status: result.data.overall || 'unknown',
      health: result.data.health || {},
      timestamp: result.data.timestamp || new Date().toISOString(),
      error: result.error
    });
  } catch (error) {
    logger.error('Jira health check failed:', error);
    res.status(500).json({ 
      healthy: false,
      error: 'Health check failed' 
    });
  }
});

/**
 * POST /api/jira/webhook
 * Handle incoming Jira webhooks
 */
router.post('/webhook', async (req, res) => {
  try {
    const jiraAgent = getJiraAgent();
    if (!jiraAgent) {
      return res.status(503).json({ error: 'Jira agent not available' });
    }

    const payload = req.body;
    const headers = req.headers as Record<string, string>;

    // Get webhook handler from agent (this would need to be exposed)
    // For now, just acknowledge receipt
    logger.info('Received Jira webhook:', {
      event: payload.webhookEvent,
      issueKey: payload.issue?.key
    });

    res.json({ success: true, processed: true });
  } catch (error) {
    logger.error('Failed to process Jira webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Error handling middleware
 */
router.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Jira route error:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method
  });

  if (!res.headersSent) {
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});

export { router as jiraRouter };