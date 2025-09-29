/**
 * Core WeSign Types - Unified type definitions for the new architecture
 */

export interface UnifiedTestConfig {
  // Framework selection
  framework: 'wesign' | 'playwright' | 'pytest' | 'selenium';

  // Execution configuration
  execution: {
    mode: 'single' | 'parallel' | 'distributed';
    workers?: number;
    timeout?: number;
    browser?: 'chromium' | 'firefox' | 'webkit';
    headless?: boolean;
  };

  // Test selection
  tests: {
    testIds?: string[];
    suites?: string[];
    tags?: string[];
    categories?: string[];
    pattern?: string;
  };

  // AI enhancements
  ai: {
    enabled: boolean;
    autoHeal?: boolean;
    generateInsights?: boolean;
    predictFlakiness?: boolean;
  };

  // Real-time features
  realTime: {
    monitoring: boolean;
    notifications: boolean;
    streaming: boolean;
  };
}

export interface ExecutionHandle {
  executionId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  framework: string;
  startTime: Date;
  progress?: {
    total: number;
    completed: number;
    percentage: number;
  };
}

export interface ExecutionStatus extends ExecutionHandle {
  endTime?: Date;
  duration?: number;
  results?: TestResult[];
  error?: string;
}

export interface TestResult {
  testId: string;
  testName: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  artifacts?: {
    screenshots: string[];
    videos: string[];
    traces: string[];
    logs: string[];
  };
  aiAnalysis?: {
    failureReason?: string;
    suggestions?: string[];
    healingApplied?: string[];
  };
}

export interface WeSignEvent {
  id: string;
  timestamp: Date;
  source: string;
  type: EventType;
  data: any;
}

export enum EventType {
  // Test execution events
  TEST_EXECUTION_STARTED = 'test.execution.started',
  TEST_EXECUTION_COMPLETED = 'test.execution.completed',
  TEST_CASE_STARTED = 'test.case.started',
  TEST_CASE_COMPLETED = 'test.case.completed',

  // AI events
  AI_ANALYSIS_COMPLETED = 'ai.analysis.completed',
  AI_HEALING_APPLIED = 'ai.healing.applied',
  AI_INSIGHT_GENERATED = 'ai.insight.generated',

  // System events
  PLUGIN_INSTALLED = 'plugin.installed',
  DISCOVERY_COMPLETED = 'discovery.completed',
  HEALTH_CHANGED = 'system.health.changed',

  // CI/CD events
  CI_RUN_CREATED = 'ci.run.created',
  CI_RUN_STARTED = 'ci.run.started',
  CI_RUN_COMPLETED = 'ci.run.completed',
  CI_RUN_FAILED = 'ci.run.failed',
  CI_RUN_CANCELLED = 'ci.run.cancelled',
  CI_STAGE_STARTED = 'ci.stage.started',
  CI_STAGE_COMPLETED = 'ci.stage.completed',
  CI_STAGE_FAILED = 'ci.stage.failed',
  CI_STAGE_LOG = 'ci.stage.log',
  CI_ARTIFACT_CREATED = 'ci.artifact.created',
  CI_NOTIFICATION_SENT = 'ci.notification.sent',
  CI_ROLLBACK_INITIATED = 'ci.rollback.initiated',
  CI_ROLLBACK_COMPLETED = 'ci.rollback.completed',
  CI_DEPLOYMENT_STARTED = 'ci.deployment.started',
  CI_DEPLOYMENT_COMPLETED = 'ci.deployment.completed',
  CI_DEPLOYMENT_FAILED = 'ci.deployment.failed'
}

export type EventHandler = (event: WeSignEvent) => void | Promise<void>;

export interface PluginExecutionConfig extends UnifiedTestConfig {
  executionId: string;
  eventBus: EventBus;
  aiOrchestrator?: any; // Will be defined later
}

export interface PluginHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  lastCheck: Date;
}

export interface TestInfo {
  id: string;
  filePath: string;
  testName: string;
  className?: string;
  functionName: string;
  description?: string;
  category: string;
  lineNumber?: number;
  tags: string[];
  lastRun?: Date;
  lastStatus?: 'passed' | 'failed' | 'skipped';
  lastDuration?: number;
  testType?: 'python' | 'playwright' | 'unit';
  steps?: string[];
  complexity?: 'low' | 'medium' | 'high';
  estimatedDuration?: number;
}

// Forward declaration for EventBus
export interface EventBus {
  subscribe(eventType: EventType, handler: EventHandler): void;
  publish(event: WeSignEvent): void;
  addWebSocketClient(ws: any): void;
}