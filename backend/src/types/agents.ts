/**
 * Type definitions for Claude Code Sub-Agent system
 */

export type AgentType = 
  | 'test-intelligence'
  | 'healing'
  | 'code-generation'
  | 'quality-assurance'
  | 'performance-optimization'
  | 'jira-integration'
  | 'failure-analysis'
  | 'workflow-orchestration'
  | 'specialist'
  | 'general-purpose';

export type AgentCapability = 
  | 'test-analysis'
  | 'failure-prediction'
  | 'root-cause-analysis'
  | 'test-failure-investigation'
  | 'smart-selection'
  | 'healing'
  | 'selector-optimization'
  | 'code-generation'
  | 'test-generation'
  | 'quality-analysis'
  | 'coverage-analysis'
  | 'performance-monitoring'
  | 'optimization'
  | 'workflow-management'
  | 'issue-management'
  | 'test-failure-tracking'
  | 'quality-reporting'
  | 'bilingual-support'
  | 'wesign-domain-knowledge';

export type TaskType =
  | 'analyze-failures'
  | 'root-cause-analysis'
  | 'failure-pattern-recognition'
  | 'heal-selectors'
  | 'generate-tests'
  | 'optimize-performance'
  | 'assess-quality'
  | 'plan-execution'
  | 'create-issue'
  | 'update-issue'
  | 'link-issues'
  | 'sync-status'
  | 'bulk-create'
  | 'generate-report'
  | 'health-check'
  // New execution capabilities for TestIntelligenceAgent
  | 'execute-test'
  | 'execute-suite'
  | 'schedule-test'
  | 'smart-execution';

// Mapping between workflow step types and required agent capabilities
export const STEP_CAPABILITY_MAPPING: Record<TaskType, AgentCapability[]> = {
  'analyze-failures': ['test-analysis', 'failure-prediction'],
  'root-cause-analysis': ['root-cause-analysis', 'test-failure-investigation'],
  'failure-pattern-recognition': ['failure-prediction', 'test-failure-investigation'],
  'plan-execution': ['smart-selection', 'test-analysis'],
  'assess-quality': ['quality-analysis', 'coverage-analysis'],
  'heal-selectors': ['healing', 'selector-optimization'],
  'generate-tests': ['test-generation', 'code-generation'],
  'optimize-performance': ['performance-monitoring', 'optimization'],
  'create-issue': ['issue-management'],
  'update-issue': ['issue-management'],
  'link-issues': ['issue-management'],
  'sync-status': ['workflow-management'],
  'bulk-create': ['issue-management'],
  'generate-report': ['quality-reporting', 'test-analysis'],
  'health-check': [],
  // New execution capabilities
  'execute-test': ['test-analysis', 'smart-selection', 'wesign-domain-knowledge'],
  'execute-suite': ['test-analysis', 'smart-selection', 'quality-analysis'],
  'schedule-test': ['test-analysis', 'workflow-management'],
  'smart-execution': ['test-analysis', 'smart-selection', 'failure-prediction', 'wesign-domain-knowledge']
};

export interface AgentContext {
  testRun?: {
    id: string;
    suiteName: string;
    status: string;
    startedAt: Date;
  };
  codeChanges?: {
    files: string[];
    changedLines: number;
    author: string;
  };
  failureHistory?: {
    recentFailures: FailureRecord[];
    patterns: FailurePattern[];
  };
  systemHealth?: {
    cpuUsage: number;
    memoryUsage: number;
    diskSpace: number;
  };
  previousResults?: AgentResult[];
  [key: string]: any;
}

export interface AgentTask {
  id: string;
  type: TaskType;
  data: Record<string, any>;
  context: AgentContext;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  timeout?: number;
  requirements?: AgentCapability[];
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
  };
}

export interface AgentResult {
  taskId: string;
  agentId: string;
  status: 'success' | 'error' | 'partial' | 'timeout';
  data: Record<string, any>;
  confidence?: number;
  executionTime: number;
  recommendations?: string[];
  artifacts?: Artifact[];
  error?: string;
  metadata?: {
    tokensUsed?: number;
    modelUsed?: string;
    reasoning?: string;
  };
}

export interface SubAgent {
  id: string;
  type: AgentType;
  capabilities: AgentCapability[];
  status: 'idle' | 'active' | 'busy' | 'error' | 'offline';
  currentTask?: string;
  lastActivity?: Date;
  
  execute(task: AgentTask): Promise<AgentResult>;
  getStatus(): AgentStatus;
  getCapabilities(): AgentCapability[];
  updateContext?(context: Partial<AgentContext>): void;
  shutdown?(): Promise<void>;
}

export interface AgentStatus {
  id: string;
  type: AgentType;
  status: 'idle' | 'active' | 'busy' | 'error' | 'offline';
  capabilities: AgentCapability[];
  currentTask?: string;
  lastActivity?: Date;
  performance?: {
    tasksCompleted: number;
    averageExecutionTime: number;
    successRate: number;
    errorsToday: number;
  };
  resourceUsage?: {
    cpuPercent: number;
    memoryMB: number;
  };
}

export interface WorkflowStep {
  id: string;
  type: TaskType;
  data: Record<string, any>;
  requirements: AgentCapability[];
  dependsOn?: string[];
  criticalFailure?: boolean;
  timeout?: number;
}

export interface AgentWorkflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  context: AgentContext;
  priority: 'low' | 'medium' | 'high' | 'critical';
  maxDuration?: number;
  onFailure?: 'stop' | 'continue' | 'retry';
}

export interface WorkflowResult {
  workflowId: string;
  status: 'completed' | 'failed' | 'timeout' | 'cancelled';
  results: AgentResult[];
  duration: number;
  completedAt: Date;
  error?: string;
  summary?: {
    totalTasks: number;
    successfulTasks: number;
    failedTasks: number;
    recommendations: string[];
  };
}

export interface FailureRecord {
  testName: string;
  failureType: string;
  errorMessage: string;
  timestamp: Date;
  context: {
    selector?: string;
    url?: string;
    browserType?: string;
  };
}

export interface FailurePattern {
  pattern: string;
  frequency: number;
  lastSeen: Date;
  suggestedFix: string;
  confidence: number;
}

export interface Artifact {
  type: 'screenshot' | 'har' | 'log' | 'report' | 'code' | 'analysis';
  name: string;
  path: string;
  size: number;
  mimeType: string;
  metadata?: Record<string, any>;
}

export interface AgentConfig {
  maxConcurrentTasks: number;
  defaultTimeout: number;
  retryPolicy: {
    maxRetries: number;
    backoffMs: number;
  };
  resourceLimits: {
    maxMemoryMB: number;
    maxCpuPercent: number;
  };
  aiModel?: {
    provider: 'openai' | 'anthropic' | 'local';
    model: string;
    temperature: number;
    maxTokens: number;
  };
}

// Workflow Templates
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'testing' | 'analysis' | 'maintenance' | 'optimization';
  steps: Omit<WorkflowStep, 'data'>[];
  requiredContext: string[];
  estimatedDuration: number;
}

// Agent Communication
export interface AgentMessage {
  from: string;
  to: string;
  type: 'request' | 'response' | 'notification' | 'broadcast';
  data: Record<string, any>;
  timestamp: Date;
  correlationId?: string;
}

// Agent Performance Metrics
export interface AgentMetrics {
  agentId: string;
  period: {
    start: Date;
    end: Date;
  };
  performance: {
    tasksExecuted: number;
    averageExecutionTime: number;
    successRate: number;
    errorRate: number;
  };
  resources: {
    avgCpuUsage: number;
    avgMemoryUsage: number;
    peakMemoryUsage: number;
  };
  aiUsage?: {
    totalTokens: number;
    totalCost: number;
    averageResponseTime: number;
  };
}

export type AgentCriteria = {
  type?: AgentType;
  capabilities?: AgentCapability[];
  status?: AgentStatus['status'][];
  maxLoad?: number;
};

// Jira Integration Types
export interface JiraConfig {
  baseUrl: string;
  authType: 'oauth2' | 'api_token';
  
  // OAuth2 config
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  
  // API Token config
  email?: string;
  apiToken?: string;
  
  // Settings
  defaultProject: string;
  rateLimitPerHour: number;
  maxRetryAttempts: number;
  timeoutMs: number;
  
  // Status
  status: 'active' | 'error' | 'disabled';
  lastSyncAt?: Date;
  lastError?: string;
}

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
    [key: string]: any; // Custom fields
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
  wesignModule: 'signing' | 'payment' | 'auth' | 'notification' | 'admin';
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

export interface JiraIssueMapping {
  id: string;
  testRunId: string;
  testName: string;
  failureHash: string;
  
  jiraIssueId: string;
  jiraIssueKey: string;
  jiraProjectKey: string;
  
  // Issue details cache
  issueSummary: string;
  issueStatus: string;
  issuePriority: string;
  issueType: string;
  assigneeAccountId?: string;
  
  // Failure context
  failureCategory: string;
  wesignModule: string;
  errorMessage: string;
  browserType: string;
  testEnvironment: string;
  language: string;
  
  // Linking
  parentIssueKey?: string;
  linkedIssues: string[];
  
  // Status tracking
  createdInJiraAt: Date;
  lastSyncedAt: Date;
  syncStatus: 'synced' | 'pending' | 'error';
  syncError?: string;
  resolutionStatus: 'open' | 'in_progress' | 'resolved' | 'closed';
  resolvedAt?: Date;
}

export interface JiraOperation {
  id: string;
  operationType: 'create_issue' | 'update_issue' | 'add_comment' | 'link_issues' | 'bulk_create';
  payload: Record<string, any>;
  jiraIssueKey?: string;
  mappingId?: string;
  
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  priority: number; // 1=highest, 10=lowest
  
  scheduledAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  
  attemptCount: number;
  maxAttempts: number;
  lastError?: string;
  errorDetails?: string;
}

export interface JiraWebhookEvent {
  webhookEvent: string;
  timestamp: number;
  issue?: {
    id: string;
    key: string;
    fields: Record<string, any>;
  };
  changelog?: {
    items: Array<{
      field: string;
      fieldtype: string;
      from: string;
      fromString: string;
      to: string;
      toString: string;
    }>;
  };
  user?: {
    accountId: string;
    displayName: string;
  };
}