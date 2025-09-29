// Type definitions for Trace Viewer functionality

export interface TraceViewerRun {
  id: string;
  suiteId: string;
  suiteName: string;
  startedAt: string;
  finishedAt?: string;
  status: 'queued' | 'running' | 'passed' | 'failed' | 'cancelled';
  environment: string;
  browser?: string;
  testMode?: 'headed' | 'headless';
  totals: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  duration?: number; // milliseconds
  branch?: string;
  commitSha?: string;
  triggeredBy?: string;
  artifactsPath?: string;
  traceFile?: string;
  videoFile?: string;
  htmlReport?: string;
  metadata?: Record<string, any>;
  passRate: number; // calculated percentage
  createdAt: string;
  updatedAt: string;
}

export interface TraceStep {
  id: string;
  runId: string;
  testId?: string;
  testName: string;
  stepIndex: number;
  actionType?: string; // click, fill, navigate, expect
  actionName: string;
  selector?: string;
  url?: string;
  expectedValue?: string;
  actualValue?: string;
  startedAt: string;
  finishedAt?: string;
  duration?: number; // milliseconds
  status: 'running' | 'passed' | 'failed' | 'skipped' | 'timeout';
  errorMessage?: string;
  stackTrace?: string;
  retryCount: number;
  screenshotBefore?: string;
  screenshotAfter?: string;
  videoTimestamp?: number; // timestamp in video file
  createdAt: string;
}

export interface TraceArtifact {
  id: string;
  runId: string;
  stepId?: string; // null for run-level artifacts
  artifactType: 'screenshot' | 'video' | 'trace' | 'log' | 'report' | 'network' | 'console';
  name: string;
  filePath: string;
  fileUrl?: string;
  mimeType: string;
  fileSize?: number;
  thumbnailPath?: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  duration?: number; // for videos
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface ConsoleLog {
  id: string;
  runId: string;
  stepId?: string;
  timestamp: string;
  level: 'log' | 'info' | 'warn' | 'error' | 'debug';
  source: string;
  message: string;
  stackTrace?: string;
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
  args?: any[];
  createdAt: string;
}

export interface NetworkLog {
  id: string;
  runId: string;
  stepId?: string;
  timestamp: string;
  method: string;
  url: string;
  statusCode?: number;
  statusText?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBody?: string;
  responseBody?: string;
  requestSize?: number;
  responseSize?: number;
  duration?: number;
  failed: boolean;
  failureReason?: string;
  createdAt: string;
}

export interface PerformanceMetric {
  id: string;
  runId: string;
  stepId?: string;
  timestamp: string;
  metricName: string; // LCP, FCP, CLS, FID, etc.
  metricValue: number;
  metricUnit: string; // ms, score, ratio
  url?: string;
  viewportWidth?: number;
  viewportHeight?: number;
  deviceType?: string;
  createdAt: string;
}

export interface TestEnvironment {
  id: string;
  name: string;
  baseUrl: string;
  description?: string;
  browserConfigs?: BrowserConfig[];
  viewportConfigs?: ViewportConfig[];
  timezone: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BrowserConfig {
  name: string; // chromium, firefox, webkit
  version?: string;
  headless: boolean;
  args?: string[];
}

export interface ViewportConfig {
  width: number;
  height: number;
  deviceScaleFactor: number;
  isMobile: boolean;
  hasTouch: boolean;
  name: string; // Desktop, iPad, iPhone, etc.
}

// Request/Response types for API endpoints
export interface GetRunsRequest {
  page?: number;
  limit?: number;
  status?: string;
  environment?: string;
  suite?: string;
  branch?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface GetRunsResponse {
  runs: TraceViewerRun[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface GetRunDetailRequest {
  runId: string;
  includeSteps?: boolean;
  includeArtifacts?: boolean;
  includeLogs?: boolean;
}

export interface GetRunDetailResponse {
  run: TraceViewerRun;
  steps?: TraceStep[];
  artifacts?: TraceArtifact[];
  consoleLogs?: ConsoleLog[];
  networkLogs?: NetworkLog[];
  performanceMetrics?: PerformanceMetric[];
  timeline?: TimelineItem[];
}

export interface TimelineItem {
  id: string;
  type: 'step' | 'log' | 'network' | 'performance';
  timestamp: string;
  duration?: number;
  status?: 'passed' | 'failed' | 'warning' | 'info';
  title: string;
  description?: string;
  stepId?: string;
  artifacts?: TraceArtifact[];
  metadata?: Record<string, any>;
}

export interface ArtifactUploadRequest {
  runId: string;
  stepId?: string;
  artifactType: TraceArtifact['artifactType'];
  name: string;
  file: File | Buffer;
  metadata?: Record<string, any>;
}

export interface ArtifactUploadResponse {
  artifact: TraceArtifact;
  uploadUrl?: string; // For signed URL uploads
}

export interface TraceParseRequest {
  runId: string;
  traceFilePath: string;
  videoFilePath?: string;
  screenshotsPath?: string;
}

export interface TraceParseResponse {
  success: boolean;
  stepsCreated: number;
  artifactsCreated: number;
  logsCreated: number;
  errors?: string[];
}

export interface RerunTestRequest {
  runId: string;
  testId?: string; // If provided, rerun specific test only
  environment?: string;
  browser?: string;
  headless?: boolean;
}

export interface RerunTestResponse {
  newRunId: string;
  status: 'queued' | 'started';
  estimatedDuration?: number;
}

// Filter and search types
export interface TraceViewerFilters {
  status: string[];
  environments: string[];
  browsers: string[];
  suites: string[];
  branches: string[];
  dateRange: {
    start?: string;
    end?: string;
  };
  duration: {
    min?: number;
    max?: number;
  };
  passRate: {
    min?: number;
    max?: number;
  };
}

export interface StepFilters {
  status: string[];
  actionTypes: string[];
  hasError: boolean;
  hasScreenshot: boolean;
  duration: {
    min?: number;
    max?: number;
  };
}

// Navigation and UI state types
export interface TraceViewerState {
  selectedRunId?: string;
  selectedStepId?: string;
  activeTab: 'overview' | 'timeline' | 'steps' | 'artifacts' | 'logs' | 'performance';
  filters: TraceViewerFilters;
  stepFilters: StepFilters;
  search: string;
  timelineZoom: number;
  timelineStart: number;
  timelineEnd: number;
}

export interface MediaPlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  playbackRate: number;
  fullscreen: boolean;
}

// Playwright-specific trace parsing types
export interface PlaywrightTraceEntry {
  type: string;
  time: number;
  class: string;
  method: string;
  params?: any;
  result?: any;
  point?: { x: number; y: number };
  snapshot?: string;
  beforeSnapshot?: string;
  afterSnapshot?: string;
}

export interface PlaywrightTrace {
  entries: PlaywrightTraceEntry[];
  resources: { [key: string]: any };
  stacks: any[];
  actions: any[];
  events: any[];
  consoleMessages: any[];
  networkEvents: any[];
}

// Provider adapter interface for extensibility
export interface ArtifactAdapter {
  readonly name: string;
  readonly version: string;
  
  listRuns(filters?: GetRunsRequest): Promise<GetRunsResponse>;
  getRun(runId: string, options?: GetRunDetailRequest): Promise<GetRunDetailResponse>;
  getSteps(runId: string, filters?: StepFilters): Promise<TraceStep[]>;
  getArtifacts(runId: string, stepId?: string): Promise<TraceArtifact[]>;
  getMedia(runId: string, artifactId: string): Promise<Buffer>;
  
  parseTrace(traceFilePath: string): Promise<{
    steps: Omit<TraceStep, 'id' | 'runId' | 'createdAt'>[];
    logs: Omit<ConsoleLog, 'id' | 'runId' | 'createdAt'>[];
    networkLogs: Omit<NetworkLog, 'id' | 'runId' | 'createdAt'>[];
    artifacts: Omit<TraceArtifact, 'id' | 'runId' | 'createdAt'>[];
  }>;
  
  rerunTest?(request: RerunTestRequest): Promise<RerunTestResponse>;
}

// Security and access control
export interface SignedUrlRequest {
  artifactId: string;
  operation: 'read' | 'write';
  expirationMinutes?: number;
}

export interface SignedUrlResponse {
  url: string;
  expiresAt: string;
  method: 'GET' | 'POST' | 'PUT';
  headers?: Record<string, string>;
}

// Statistics and analytics
export interface RunStatistics {
  totalRuns: number;
  passRate: number;
  averageDuration: number;
  mostFailedTests: { testName: string; failureCount: number }[];
  environmentStats: { environment: string; runs: number; passRate: number }[];
  browserStats: { browser: string; runs: number; passRate: number }[];
  trendData: { date: string; runs: number; passRate: number }[];
}

export interface StepStatistics {
  totalSteps: number;
  averageStepDuration: number;
  mostFailedActions: { actionType: string; failureCount: number }[];
  slowestSteps: { actionName: string; averageDuration: number }[];
}