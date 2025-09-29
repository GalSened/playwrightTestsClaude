/**
 * Newman API Testing Service Types
 */

export interface NewmanTestConfig {
  collection: string | object; // Can be file path or collection object
  environment?: string | object; // Environment file path or object
  globals?: string | object; // Globals file path or object
  iterations?: number;
  delay?: number;
  timeout?: number;
  reporters: ('cli' | 'json' | 'html')[];
  reporterOptions?: {
    json?: { export: string };
    html?: { export: string };
    cli?: { verbose?: boolean };
  };
  bail?: boolean;
  suppressExitCode?: boolean;
  folder?: string; // Run specific folder
  ignoreRedirects?: boolean;
  insecure?: boolean;
  color?: 'auto' | 'on' | 'off';
}

export interface ApiTestResult {
  runId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  collectionName: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  totalRequests: number;
  passedRequests: number;
  failedRequests: number;
  assertions: {
    total: number;
    passed: number;
    failed: number;
  };
  iterations: {
    total: number;
    completed: number;
    failed: number;
  };
  transfers: {
    responseTotal: number;
    responseAverage: number;
  };
  responseTime: {
    total: number;
    average: number;
    min: number;
    max: number;
  };
  reports: {
    json?: string;
    html?: string;
  };
  output: string[];
  errors: string[];
  failures?: ApiTestFailure[];
}

export interface ApiTestFailure {
  source: string;
  name: string;
  message: string;
  test: string;
  checkpoint: string;
  item: {
    name: string;
    id: string;
  };
  assertion: string;
  index: number;
}

export interface CollectionInfo {
  id: string;
  name: string;
  description?: string;
  variables?: Array<{
    key: string;
    value: string;
    type?: string;
  }>;
  requests: Array<{
    name: string;
    method: string;
    url: string;
    description?: string;
  }>;
  folders?: Array<{
    name: string;
    description?: string;
    requests: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnvironmentInfo {
  id: string;
  name: string;
  values: Array<{
    key: string;
    value: string;
    enabled: boolean;
    type?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewmanExecutionOptions {
  runId?: string;
  timeout?: number;
  workingDirectory?: string;
  additionalArgs?: string[];
}

export interface NewmanRunSummary {
  run: {
    stats: {
      iterations: { total: number; pending: number; failed: number };
      items: { total: number; pending: number; failed: number };
      scripts: { total: number; pending: number; failed: number };
      prerequests: { total: number; pending: number; failed: number };
      requests: { total: number; pending: number; failed: number };
      tests: { total: number; pending: number; failed: number };
      assertions: { total: number; pending: number; failed: number };
      testScripts: { total: number; pending: number; failed: number };
      prerequestScripts: { total: number; pending: number; failed: number };
    };
    failures: Array<{
      error: {
        name: string;
        index: number;
        test: string;
        message: string;
        stack: string;
      };
      at: string;
      source: {
        name: string;
      };
    }>;
    executions: Array<{
      item: { name: string; id: string };
      request: {
        method: string;
        url: { raw: string };
        header: Array<{ key: string; value: string }>;
      };
      response: {
        code: number;
        status: string;
        header: Array<{ key: string; value: string }>;
        responseTime: number;
        responseSize: number;
      };
      assertions: Array<{
        assertion: string;
        skipped: boolean;
        error?: {
          name: string;
          index: number;
          test: string;
          message: string;
        };
      }>;
    }>;
  };
  collection: {
    info: {
      name: string;
      description?: string;
      schema: string;
    };
  };
}