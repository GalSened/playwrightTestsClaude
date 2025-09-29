/**
 * CI/CD Models and Interfaces
 * Comprehensive TypeScript definitions for CI/CD pipeline management
 * Integrates with existing QA Intelligence architecture patterns
 */

import { z } from 'zod';

// ===============================
// ENUMS AND CONSTANTS
// ===============================

export const CIRunStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  SKIPPED: 'skipped'
} as const;

export const CIEnvironment = {
  DEVELOPMENT: 'development',
  TESTING: 'testing',
  STAGING: 'staging',
  PRODUCTION: 'production'
} as const;

export const CIStageType = {
  BUILD: 'build',
  TEST: 'test',
  QUALITY_GATE: 'quality_gate',
  DEPLOY: 'deploy',
  ROLLBACK: 'rollback',
  NOTIFICATION: 'notification'
} as const;

export const CIArtifactType = {
  REPORT: 'report',
  SCREENSHOT: 'screenshot',
  VIDEO: 'video',
  LOG: 'log',
  PACKAGE: 'package',
  DEPLOYMENT: 'deployment',
  TEST_RESULT: 'test_result'
} as const;

export const DeploymentStatus = {
  NOT_STARTED: 'not_started',
  DEPLOYING: 'deploying',
  DEPLOYED: 'deployed',
  FAILED: 'failed',
  ROLLED_BACK: 'rolled_back'
} as const;

export const RollbackType = {
  AUTOMATIC: 'automatic',
  MANUAL: 'manual',
  SCHEDULED: 'scheduled'
} as const;

export const NotificationType = {
  EMAIL: 'email',
  SLACK: 'slack',
  TEAMS: 'teams',
  WEBHOOK: 'webhook',
  SMS: 'sms'
} as const;

export const NotificationEventType = {
  RUN_STARTED: 'run_started',
  RUN_COMPLETED: 'run_completed',
  RUN_FAILED: 'run_failed',
  STAGE_FAILED: 'stage_failed',
  DEPLOYMENT_SUCCESS: 'deployment_success',
  DEPLOYMENT_FAILED: 'deployment_failed',
  QUALITY_GATE_FAILED: 'quality_gate_failed'
} as const;

// ===============================
// CORE INTERFACES
// ===============================

export interface CIRun {
  id: number;
  runId: string;
  name: string;
  description?: string;
  status: keyof typeof CIRunStatus;
  environment: keyof typeof CIEnvironment;
  branch: string;
  commitHash?: string;
  commitMessage?: string;

  // Configuration
  config?: Record<string, any>;
  variables?: Record<string, string>;

  // Execution tracking
  startedAt?: string;
  completedAt?: string;
  duration?: number;

  // Jenkins integration
  jenkinsJobName?: string;
  jenkinsBuildNumber?: number;
  jenkinsJobUrl?: string;
  jenkinsConsoleUrl?: string;

  // Test integration
  testSuitePath?: string;
  testFilter?: string;
  parallelWorkers?: number;

  // Results summary
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  testSuccessRate: number;

  // Quality gates
  qualityGatePassed: boolean;
  qualityScore: number;

  // Deployment tracking
  deployServer?: string;
  deployPath?: string;
  deploymentStatus?: keyof typeof DeploymentStatus;

  // Error handling
  errorMessage?: string;
  errorDetails?: string;
  retryCount: number;
  maxRetries: number;

  // Audit fields
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  tenantId?: string;
}

export interface CIStage {
  id: number;
  stageId: string;
  ciRunId: string;
  name: string;
  description?: string;
  stageType: keyof typeof CIStageType;
  status: keyof typeof CIRunStatus;

  // Execution order
  sequenceNumber: number;
  dependsOn?: string[];

  // Configuration
  config?: Record<string, any>;
  command?: string;

  // Execution tracking
  startedAt?: string;
  completedAt?: string;
  duration?: number;

  // Jenkins stage integration
  jenkinsstageName?: string;
  jenkinsStageUrl?: string;

  // Output and logging
  outputLog?: string;
  errorLog?: string;
  consoleOutput?: string;

  // Results
  exitCode?: number;
  successCriteria?: Record<string, any>;
  artifactsGenerated: number;

  // Test stage specific fields
  testsExecuted: number;
  testsPassed: number;
  testsFailed: number;

  // Quality gate specific fields
  qualityChecks?: any[];
  qualityResults?: Record<string, any>;

  // Deployment specific fields
  deploymentTarget?: string;
  deploymentArtifacts?: string[];

  // Audit fields
  createdAt: string;
  updatedAt: string;
}

export interface CIArtifact {
  id: number;
  artifactId: string;
  ciRunId: string;
  ciStageId?: string;
  name: string;
  description?: string;
  artifactType: keyof typeof CIArtifactType;

  // File details
  filePath: string;
  fileName: string;
  fileSize?: number;
  fileHash?: string;
  mimeType?: string;

  // Content classification
  category?: string;
  tags?: string[];

  // Test-specific fields
  testName?: string;
  testFile?: string;
  testStatus?: 'passed' | 'failed' | 'skipped';

  // Report-specific fields
  reportFormat?: string;
  reportSummary?: Record<string, any>;

  // Access and retention
  isPublic: boolean;
  retentionDays: number;
  expiresAt?: string;
  downloadCount: number;

  // URL for external access
  downloadUrl?: string;
  externalUrl?: string;

  // Audit fields
  createdAt: string;
  updatedAt: string;
}

export interface CIConfiguration {
  id: number;
  configId: string;
  name: string;
  description?: string;

  // Configuration content
  pipelineConfig: Record<string, any>;
  defaultVariables?: Record<string, string>;

  // Pipeline definition
  stages: CIStageDefinition[];
  qualityGates?: QualityGateDefinition[];
  notificationConfig?: NotificationConfig;

  // Environment settings
  targetEnvironments: string[];
  deploymentConfig?: DeploymentConfig;

  // Test settings
  testSuiteConfig?: TestSuiteConfig;
  parallelConfig?: ParallelConfig;

  // Jenkins integration
  jenkinsJobTemplate?: JenkinsJobTemplate;
  jenkinsParameters?: Record<string, any>;

  // Versioning
  version: string;
  isActive: boolean;

  // Access control
  tenantId?: string;
  createdBy?: string;

  // Audit fields
  createdAt: string;
  updatedAt: string;
}

export interface CIEnvironmentConfig {
  id: number;
  environmentId: string;
  name: string;
  environmentType: keyof typeof CIEnvironment;

  // Server configuration
  serverUrl?: string;
  serverName?: string;
  deploymentPath?: string;

  // Credentials (encrypted)
  credentials?: Record<string, any>;
  apiKeys?: Record<string, string>;

  // Configuration
  environmentVariables?: Record<string, string>;
  deploymentConfig?: DeploymentConfig;
  testConfig?: TestConfig;

  // Health monitoring
  healthCheckUrl?: string;
  monitoringEnabled: boolean;
  alertThreshold: number;

  // Access control
  isActive: boolean;
  requiresApproval: boolean;
  approvedUsers?: string[];

  // Audit fields
  tenantId?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CINotification {
  id: number;
  notificationId: string;
  ciRunId: string;
  ciStageId?: string;

  // Notification details
  type: keyof typeof NotificationType;
  eventType: keyof typeof NotificationEventType;

  // Recipients
  recipients: string[];
  subject?: string;
  message?: string;

  // Delivery tracking
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  sentAt?: string;
  deliveredAt?: string;

  // Error handling
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;

  // Audit fields
  createdAt: string;
  updatedAt: string;
}

export interface CIRollback {
  id: number;
  rollbackId: string;
  originalRunId: string;
  rollbackRunId?: string;

  // Rollback details
  rollbackType: keyof typeof RollbackType;
  triggerReason?: string;

  // Target configuration
  targetEnvironment: string;
  rollbackToVersion?: string;
  rollbackToCommit?: string;

  // Status tracking
  status: keyof typeof CIRunStatus;
  startedAt?: string;
  completedAt?: string;
  duration?: number;

  // Results
  rollbackSuccessful: boolean;
  verificationStatus?: 'not_started' | 'verifying' | 'passed' | 'failed';
  verificationResults?: Record<string, any>;

  // Error handling
  errorMessage?: string;
  errorDetails?: string;

  // Audit fields
  initiatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

// ===============================
// CONFIGURATION INTERFACES
// ===============================

export interface CIStageDefinition {
  name: string;
  type: keyof typeof CIStageType;
  sequence: number;
  dependsOn?: string[];
  config?: Record<string, any>;
  successCriteria?: Record<string, any>;
  timeout?: number;
  retryPolicy?: RetryPolicy;
}

export interface QualityGateDefinition {
  name: string;
  checks: QualityCheck[];
  failureAction?: 'stop' | 'warn' | 'continue';
}

export interface QualityCheck {
  type: 'test_coverage' | 'test_success_rate' | 'code_quality' | 'security_scan' | 'performance';
  threshold?: number;
  operator?: 'gte' | 'lte' | 'eq' | 'neq';
  value?: any;
  enabled: boolean;
}

export interface NotificationConfig {
  onStart?: NotificationRule[];
  onSuccess?: NotificationRule[];
  onFailure?: NotificationRule[];
  onQualityGateFailure?: NotificationRule[];
}

export interface NotificationRule {
  type: keyof typeof NotificationType;
  recipients: string[];
  template?: string;
  conditions?: Record<string, any>;
}

export interface DeploymentConfig {
  strategy?: 'rolling' | 'blue_green' | 'canary';
  healthCheckUrl?: string;
  healthCheckTimeout?: number;
  rollbackOnFailure?: boolean;
  preDeploymentSteps?: string[];
  postDeploymentSteps?: string[];
}

export interface TestSuiteConfig {
  testSuitePath: string;
  pythonPath?: string;
  parallelWorkers?: number;
  testTimeout?: number;
  retryFailedTests?: boolean;
  maxRetries?: number;
  testFilter?: string;
  reportFormats?: string[];
}

export interface ParallelConfig {
  maxWorkers?: number;
  strategy?: 'file' | 'test' | 'suite';
  distribution?: 'round_robin' | 'load_balanced';
}

export interface TestConfig {
  baseUrl?: string;
  browserConfig?: BrowserConfig;
  timeouts?: TimeoutConfig;
  retryPolicy?: RetryPolicy;
}

export interface BrowserConfig {
  browsers?: string[];
  headless?: boolean;
  viewport?: { width: number; height: number };
  deviceEmulation?: string;
}

export interface TimeoutConfig {
  defaultTimeout?: number;
  navigationTimeout?: number;
  actionTimeout?: number;
}

export interface RetryPolicy {
  maxRetries?: number;
  retryDelay?: number;
  backoffStrategy?: 'linear' | 'exponential';
}

export interface JenkinsJobTemplate {
  jobName: string;
  parameters: Record<string, any>;
  script?: string;
  triggers?: JenkinsTrigger[];
}

export interface JenkinsTrigger {
  type: 'cron' | 'webhook' | 'scm' | 'manual';
  schedule?: string;
  conditions?: Record<string, any>;
}

// ===============================
// REQUEST/RESPONSE INTERFACES
// ===============================

export interface CreateCIRunRequest {
  name: string;
  description?: string;
  environment: keyof typeof CIEnvironment;
  branch: string;
  configurationId?: string;
  variables?: Record<string, string>;
  testFilter?: string;
  parallelWorkers?: number;
}

export interface UpdateCIRunRequest {
  status?: keyof typeof CIRunStatus;
  errorMessage?: string;
  errorDetails?: string;
  deploymentStatus?: keyof typeof DeploymentStatus;
}

export interface CreateCIStageRequest {
  name: string;
  description?: string;
  stageType: keyof typeof CIStageType;
  sequenceNumber: number;
  dependsOn?: string[];
  config?: Record<string, any>;
  command?: string;
}

export interface CIRunSummary {
  runId: string;
  name: string;
  status: keyof typeof CIRunStatus;
  environment: keyof typeof CIEnvironment;
  branch: string;
  duration?: number;
  testSuccessRate: number;
  qualityScore: number;
  createdAt: string;
  stages: CIStageSummary[];
}

export interface CIStageSummary {
  stageId: string;
  name: string;
  stageType: keyof typeof CIStageType;
  status: keyof typeof CIRunStatus;
  duration?: number;
  artifactsGenerated: number;
}

export interface CIRunDetails extends CIRun {
  stages: CIStage[];
  artifacts: CIArtifact[];
  notifications: CINotification[];
}

export interface CIDashboardStats {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageSuccessRate: number;
  averageDuration: number;
  recentRuns: CIRunSummary[];
  environmentStats: EnvironmentStats[];
}

export interface EnvironmentStats {
  environment: keyof typeof CIEnvironment;
  totalRuns: number;
  successRate: number;
  averageDuration: number;
  lastDeployment?: string;
}

export interface CIMetrics {
  deploymentFrequency: number;
  leadTimeForChanges: number;
  meanTimeToRecovery: number;
  changeFailureRate: number;
  testAutomationRate: number;
  qualityGatePassRate: number;
}

// ===============================
// VALIDATION SCHEMAS (ZOD)
// ===============================

export const CIRunStatusSchema = z.enum([
  'pending', 'running', 'success', 'failed', 'cancelled', 'skipped'
]);

export const CIEnvironmentSchema = z.enum([
  'development', 'testing', 'staging', 'production'
]);

export const CIStageTypeSchema = z.enum([
  'build', 'test', 'quality_gate', 'deploy', 'rollback', 'notification'
]);

export const CreateCIRunSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  environment: CIEnvironmentSchema,
  branch: z.string().min(1),
  configurationId: z.string().optional(),
  variables: z.record(z.string()).optional(),
  testFilter: z.string().optional(),
  parallelWorkers: z.number().min(1).max(16).optional()
});

export const UpdateCIRunSchema = z.object({
  status: CIRunStatusSchema.optional(),
  errorMessage: z.string().optional(),
  errorDetails: z.string().optional(),
  deploymentStatus: z.enum(['not_started', 'deploying', 'deployed', 'failed', 'rolled_back']).optional()
});

export const CreateCIStageSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  stageType: CIStageTypeSchema,
  sequenceNumber: z.number().min(1),
  dependsOn: z.array(z.string()).optional(),
  config: z.record(z.any()).optional(),
  command: z.string().optional()
});

// ===============================
// UTILITY TYPES
// ===============================

export type CIRunStatusType = keyof typeof CIRunStatus;
export type CIEnvironmentType = keyof typeof CIEnvironment;
export type CIStageTypeType = keyof typeof CIStageType;
export type CIArtifactTypeType = keyof typeof CIArtifactType;
export type DeploymentStatusType = keyof typeof DeploymentStatus;
export type RollbackTypeType = keyof typeof RollbackType;
export type NotificationTypeType = keyof typeof NotificationType;
export type NotificationEventTypeType = keyof typeof NotificationEventType;

// ===============================
// ERROR TYPES
// ===============================

export class CIError extends Error {
  constructor(
    public code: string,
    public message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'CIError';
  }
}

export class CIValidationError extends CIError {
  constructor(message: string, details?: any) {
    super('VALIDATION_ERROR', message, details);
    this.name = 'CIValidationError';
  }
}

export class CIExecutionError extends CIError {
  constructor(message: string, details?: any) {
    super('EXECUTION_ERROR', message, details);
    this.name = 'CIExecutionError';
  }
}

export class CIJenkinsError extends CIError {
  constructor(message: string, details?: any) {
    super('JENKINS_ERROR', message, details);
    this.name = 'CIJenkinsError';
  }
}

// ===============================
// EVENT TYPES FOR INTEGRATION
// ===============================

export interface CIEvent {
  id: string;
  timestamp: Date;
  source: string;
  type: 'ci_run' | 'ci_stage' | 'ci_artifact' | 'ci_notification';
  data: any;
  metadata?: Record<string, any>;
}

export interface CIRunEvent extends CIEvent {
  type: 'ci_run';
  data: {
    runId: string;
    action: 'created' | 'started' | 'completed' | 'failed' | 'cancelled';
    status: CIRunStatusType;
    environment: CIEnvironmentType;
    branch: string;
    duration?: number;
    testResults?: {
      total: number;
      passed: number;
      failed: number;
      skipped: number;
      successRate: number;
    };
  };
}

export interface CIStageEvent extends CIEvent {
  type: 'ci_stage';
  data: {
    runId: string;
    stageId: string;
    action: 'started' | 'completed' | 'failed' | 'skipped';
    status: CIRunStatusType;
    stageType: CIStageTypeType;
    duration?: number;
    artifactsGenerated?: number;
    errorMessage?: string;
  };
}

export interface CIArtifactEvent extends CIEvent {
  type: 'ci_artifact';
  data: {
    runId: string;
    stageId?: string;
    artifactId: string;
    action: 'created' | 'uploaded' | 'downloaded';
    artifactType: CIArtifactTypeType;
    fileName: string;
    fileSize?: number;
  };
}

export interface CINotificationEvent extends CIEvent {
  type: 'ci_notification';
  data: {
    runId: string;
    notificationId: string;
    action: 'sent' | 'delivered' | 'failed';
    notificationType: NotificationTypeType;
    eventType: NotificationEventTypeType;
    recipients: string[];
  };
}