/**
 * Types for k6 Load Testing Integration
 */

export interface K6TestConfig {
  script: string; // k6 JavaScript test script content
  scriptPath?: string; // Alternative: path to existing script file
  name?: string; // Test name for identification

  // k6 execution options
  options?: {
    vus?: number; // Virtual users
    duration?: string; // Test duration (e.g., '30s', '1m', '5m')
    iterations?: number; // Total iterations
    stages?: Array<{
      duration: string;
      target: number;
    }>;
    thresholds?: Record<string, string[]>; // Performance thresholds
    noConnectionReuse?: boolean;
    userAgent?: string;
    batch?: number;
    batchPerHost?: number;
    httpDebug?: string;
  };

  // Environment variables for the test
  env?: Record<string, string>;

  // Tags for categorization
  tags?: Record<string, string>;

  // Output options
  outputs?: string[]; // e.g., ['json=results.json', 'influxdb=http://localhost:8086/mydb']

  // Configuration metadata
  description?: string;
  timeout?: number; // Test timeout in milliseconds
}

export interface K6TestResult {
  runId: string;
  config: K6TestConfig;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  duration?: number; // Duration in milliseconds

  // k6 execution results
  metrics?: {
    // HTTP metrics
    http_reqs?: number;
    http_req_duration?: {
      avg: number;
      min: number;
      med: number;
      max: number;
      p90: number;
      p95: number;
      p99: number;
    };
    http_req_failed?: number;
    http_req_rate?: number;

    // Virtual user metrics
    vus?: number;
    vus_max?: number;

    // Iteration metrics
    iterations?: number;
    iteration_duration?: {
      avg: number;
      min: number;
      med: number;
      max: number;
    };

    // Data metrics
    data_received?: number;
    data_sent?: number;

    // Custom metrics
    [key: string]: any;
  };

  // Threshold results
  thresholds?: Record<string, {
    ok: boolean;
    okRate: number;
    thresholds: string[];
  }>;

  // Error information
  error?: string;
  errorDetails?: any;

  // File paths
  scriptPath?: string;
  resultsPath?: string;
  outputPath?: string;

  // Process information
  pid?: number;
  exitCode?: number;
}

export interface K6TestFailure {
  runId: string;
  timestamp: Date;
  source: string; // 'script' | 'runtime' | 'threshold' | 'system'
  type: string; // Error type
  message: string;
  details?: any;
  stackTrace?: string;
}

export interface K6TestScript {
  id: string;
  name: string;
  description?: string;
  content: string; // JavaScript test script
  defaultConfig?: Partial<K6TestConfig>;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface LoadTestRun {
  id: string;
  scriptId?: string;
  config: K6TestConfig;
  result: K6TestResult;
  createdAt: Date;
  updatedAt: Date;
}

// k6 Script Templates
export interface K6ScriptTemplate {
  name: string;
  description: string;
  category: 'http' | 'websocket' | 'api' | 'browser' | 'custom';
  script: string;
  defaultOptions?: K6TestConfig['options'];
  requiredVariables?: string[];
  examples?: {
    name: string;
    config: Partial<K6TestConfig>;
  }[];
}

// Load Testing Scenarios
export interface LoadTestScenario {
  name: string;
  type: 'load' | 'stress' | 'spike' | 'volume' | 'endurance';
  description: string;
  stages: Array<{
    duration: string;
    target: number;
    name?: string;
  }>;
  thresholds: Record<string, string[]>;
  tags?: Record<string, string>;
}

// Real-time monitoring data
export interface K6RuntimeMetrics {
  runId: string;
  timestamp: Date;

  // Current state
  vus: number;
  iterations: number;

  // HTTP metrics (current window)
  http_reqs: number;
  http_req_duration_avg: number;
  http_req_failed_rate: number;

  // Data transfer
  data_received: number;
  data_sent: number;

  // Custom metrics
  [key: string]: any;
}

export interface K6ExecutionEvent {
  type: 'start' | 'progress' | 'metric' | 'threshold' | 'error' | 'complete';
  runId: string;
  timestamp: Date;
  data: any;
}