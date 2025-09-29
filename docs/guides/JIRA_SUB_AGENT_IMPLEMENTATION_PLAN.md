# Jira Sub-Agent Implementation Plan

## Overview
The Jira Sub-Agent provides comprehensive issue management and QA workflow integration, automatically creating and managing Jira issues from test failures, quality problems, and performance issues in the WeSign platform testing environment.

## Architecture

### Core Class Structure
```typescript
export class JiraIntegrationAgent extends EventEmitter implements SubAgent {
  public readonly id = 'jira-integration-agent';
  public readonly type = 'quality-assurance' as const;
  public readonly capabilities: AgentCapability[] = [
    'issue-management',
    'test-failure-tracking',
    'quality-reporting',
    'bilingual-support',
    'wesign-domain-knowledge',
    'workflow-integration'
  ];
}
```

### Key Components
1. **JiraIntegrationAgent**: Core agent with Jira API integration
2. **JiraAPIClient**: Robust API client with authentication and rate limiting
3. **IssueMapper**: Maps test failures to Jira issues with deduplication
4. **WebhookHandler**: Bi-directional sync with Jira webhooks
5. **QueueProcessor**: Reliable operation processing with retries
6. **TemplateEngine**: WeSign-specific issue templates

### Integration Points
1. **TestIntelligenceAgent**: Receives failure analysis for issue creation
2. **QualityAssuranceAgent**: Quality issues automatically tracked in Jira
3. **PerformanceOptimizationAgent**: Performance bottlenecks create issues
4. **AgentOrchestrator**: Workflow integration and task delegation

## Type System Extensions

### New Agent Types and Capabilities
```typescript
export type AgentType = 
  | 'test-intelligence'
  | 'healing'
  | 'code-generation'
  | 'quality-assurance'
  | 'performance-optimization'
  | 'jira-integration';  // New agent type

export type AgentCapability = 
  | 'issue-management'           // Core Jira capability
  | 'test-failure-tracking'      // Track test failures in Jira
  | 'quality-reporting'          // Quality issue reporting
  | 'bilingual-support'          // Hebrew/English issue descriptions
  | 'wesign-domain-knowledge'    // WeSign-specific templates
  | 'workflow-integration';      // QA workflow integration

export type TaskType =
  | 'create-issue'               // Create new Jira issue
  | 'update-issue'               // Update existing issue
  | 'link-issues'                // Link related issues
  | 'sync-status'                // Sync issue status
  | 'bulk-create'                // Bulk create issues
  | 'generate-report';           // Generate QA reports
```

### Core Jira Interfaces
```typescript
export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description: string;
    issueType: {
      name: string;
      id: string;
    };
    priority: {
      name: string;
      id: string;
    };
    status: {
      name: string;
      id: string;
    };
    assignee?: {
      accountId: string;
      displayName: string;
    };
    project: {
      key: string;
      name: string;
    };
    // WeSign custom fields
    [key: string]: any;
  };
  changelog?: any;
}

export interface TestFailureIssueData {
  testRunId: string;
  testName: string;
  failureHash: string;
  
  // Issue content
  summary: string;
  description: string;
  priority: 'Lowest' | 'Low' | 'Medium' | 'High' | 'Highest';
  
  // WeSign context
  wesignModule: 'signing' | 'payment' | 'auth' | 'notification';
  language: 'hebrew' | 'english' | 'bilingual';
  environment: string;
  browserType: string;
  
  // Technical details
  errorMessage: string;
  stackTrace?: string;
  selector?: string;
  url: string;
  
  // Attachments
  screenshots: string[];
  traceFile?: string;
  videoFile?: string;
}

export interface JiraConfig {
  baseUrl: string;
  authType: 'oauth2' | 'api_token';
  
  // OAuth2 config
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  
  // API Token config
  email?: string;
  apiToken?: string;
  
  // Settings
  defaultProject: string;
  rateLimitPerHour: number;
  maxRetryAttempts: number;
  timeoutMs: number;
}
```

## Implementation Plan

### Phase 1: Core Agent Implementation (Week 1)
**Duration**: 35 hours

1. **Agent Foundation** (10 hours)
   - Extend type definitions in agents.ts
   - Implement JiraIntegrationAgent class
   - Register with AgentOrchestrator
   - Basic health check functionality

2. **Jira API Client** (15 hours)
   - OAuth 2.0 authentication implementation
   - API token fallback authentication
   - Rate limiting and retry logic
   - Error handling and circuit breaker

3. **Database Schema** (10 hours)
   - Create Jira integration tables
   - Issue mapping and sync operations
   - Database migration scripts
   - Performance indexes

### Phase 2: Issue Management (Week 2)
**Duration**: 40 hours

1. **Issue Creation Engine** (20 hours)
   - Test failure to issue mapping
   - Deduplication logic based on failure hash
   - WeSign-specific issue templates
   - Bilingual issue description generation

2. **Issue Updates and Linking** (15 hours)
   - Issue status synchronization
   - Comment management
   - Issue linking and relationships
   - Attachment handling

3. **Webhook Integration** (5 hours)
   - Bi-directional sync with Jira
   - Webhook endpoint setup
   - Event processing and validation

### Phase 3: Advanced Features (Week 3)
**Duration**: 35 hours

1. **Bulk Operations** (15 hours)
   - Batch issue creation
   - Bulk status updates
   - Performance optimization
   - Queue processing system

2. **Integration with Other Agents** (20 hours)
   - TestIntelligenceAgent integration
   - QualityAssuranceAgent coordination
   - PerformanceOptimizationAgent connection
   - Workflow templates

## File Structure

```
backend/src/services/subAgents/
├── JiraIntegrationAgent.ts          # Core agent implementation
├── jira/
│   ├── JiraAPIClient.ts             # Jira API client
│   ├── IssueMapper.ts               # Test failure to issue mapping
│   ├── TemplateEngine.ts            # WeSign-specific templates
│   ├── WebhookHandler.ts            # Webhook processing
│   └── QueueProcessor.ts            # Operation queue processing
└── integration/
    └── JiraWorkflows.ts             # Workflow definitions

backend/src/database/
└── jira-schema.sql                  # Jira database schema

backend/src/routes/
└── jira.ts                          # Jira API endpoints

playwright-smart/src/components/
└── Jira/
    ├── JiraIntegration.tsx          # Jira configuration UI
    ├── IssueTracker.tsx             # Issue tracking display
    └── JiraMetrics.tsx              # Jira integration metrics
```

Now let me implement the Jira Sub-Agent: