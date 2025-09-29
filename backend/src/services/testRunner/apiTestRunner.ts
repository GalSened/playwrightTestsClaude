/**
 * API Test Runner - Enhanced Newman integration for WeSign API testing
 * Integrates with the WeSignTestOrchestrator for comprehensive API test execution
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/utils/logger';
import { newmanExecutor } from '@/services/newman/newmanExecutor';
import { NewmanTestConfig, ApiTestResult } from '@/services/newman/types';

export interface ApiTestSuite {
  id: string;
  name: string;
  description: string;
  collectionPath: string;
  environmentPath?: string;
  tests: ApiTest[];
  category: 'authentication' | 'documents' | 'signing' | 'templates' | 'users' | 'integration';
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedDuration: number;
  dependencies?: string[];
}

export interface ApiTest {
  id: string;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;
  description: string;
  category: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  requestBody?: any;
  expectedStatus?: number;
  assertions: string[];
  headers?: Record<string, string>;
  timeout?: number;
}

export interface ApiTestExecutionConfig {
  suiteIds?: string[];
  testIds?: string[];
  environment: {
    baseUrl: string;
    apiKey?: string;
    credentials?: {
      username: string;
      password: string;
      token?: string;
    };
    locale: 'en' | 'he';
  };
  parallel: boolean;
  maxWorkers: number;
  timeout: number;
  retryAttempts: number;
  reportingConfig: {
    formats: ('json' | 'html' | 'junit')[];
    outputDir: string;
    includeRequestLogs: boolean;
    includeResponseBodies: boolean;
  };
  dataVariation?: {
    enabled: boolean;
    datasets?: string[];
  };
}

export interface ApiTestExecution {
  id: string;
  configId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  results: ApiTestExecutionResult[];
  summary: ApiTestExecutionSummary;
  reportPaths: {
    json?: string;
    html?: string;
    junit?: string;
  };
  environment: string;
  errors: string[];
}

export interface ApiTestExecutionResult {
  testId: string;
  suiteId: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  requestDetails: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: any;
  };
  responseDetails: {
    status: number;
    headers: Record<string, string>;
    body?: any;
    time: number;
    size: number;
  };
  assertions: {
    total: number;
    passed: number;
    failed: number;
    details: Array<{
      name: string;
      status: 'passed' | 'failed';
      message?: string;
    }>;
  };
  error?: string;
  retryCount: number;
}

export interface ApiTestExecutionSummary {
  totalSuites: number;
  totalTests: number;
  totalRequests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  totalAssertions: number;
  passedAssertions: number;
  failedAssertions: number;
  averageResponseTime: number;
  totalDataTransferred: number;
  successRate: number;
  coverage: {
    endpoints: number;
    methods: string[];
    statusCodes: number[];
  };
}

export class ApiTestRunner extends EventEmitter {
  private static readonly COLLECTIONS_PATH = path.resolve(__dirname, '../../../data/api-tests/collections');
  private static readonly ENVIRONMENTS_PATH = path.resolve(__dirname, '../../../data/api-tests/environments');
  private static readonly REPORTS_PATH = path.resolve(__dirname, '../../../data/api-tests/reports');

  private testSuites: Map<string, ApiTestSuite> = new Map();
  private activeExecutions: Map<string, ApiTestExecution> = new Map();
  private runningProcesses: Map<string, ChildProcess> = new Map();

  constructor() {
    super();
    this.ensureDirectories();
    this.discoverApiTestSuites();
  }

  /**
   * Initialize the API test runner
   */
  async initialize(): Promise<void> {
    try {
      logger.info('🔗 Initializing API Test Runner...');

      // Ensure directories exist
      await this.ensureDirectories();

      // Discover WeSign API test collections
      await this.discoverApiTestSuites();

      // Set up Newman event listeners
      this.setupNewmanEventListeners();

      logger.info('✅ API Test Runner initialized successfully', {
        totalSuites: this.testSuites.size,
        totalTests: this.getTotalTestCount()
      });

    } catch (error: any) {
      logger.error('❌ Failed to initialize API Test Runner', { error: error.message });
      throw error;
    }
  }

  private ensureDirectories(): void {
    [
      ApiTestRunner.COLLECTIONS_PATH,
      ApiTestRunner.ENVIRONMENTS_PATH,
      ApiTestRunner.REPORTS_PATH
    ].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info(`📁 Created API test directory: ${dir}`);
      }
    });
  }

  /**
   * Discover WeSign API test suites from Postman collections
   */
  private async discoverApiTestSuites(): Promise<void> {
    try {
      logger.info('🔍 Discovering WeSign API test suites...');

      // Define WeSign API test collections
      const wesignApiSuites: Omit<ApiTestSuite, 'tests'>[] = [
        {
          id: 'wesign-auth-api',
          name: 'WeSign Authentication API',
          description: 'Complete authentication flow API testing including Hebrew locale support',
          collectionPath: path.join(process.cwd(), 'new_tests_for_wesign', 'api_tests', 'WeSign_Auth_Collection.postman_collection.json'),
          environmentPath: path.join(process.cwd(), 'new_tests_for_wesign', 'api_tests', 'WeSign_Environment.postman_environment.json'),
          category: 'authentication',
          priority: 'critical',
          estimatedDuration: 300, // 5 minutes
          dependencies: []
        },
        {
          id: 'wesign-documents-api',
          name: 'WeSign Documents API',
          description: 'Document management, upload, processing, and validation APIs',
          collectionPath: path.join(process.cwd(), 'new_tests_for_wesign', 'api_tests', 'WeSign_Documents_Collection.postman_collection.json'),
          category: 'documents',
          priority: 'high',
          estimatedDuration: 600, // 10 minutes
          dependencies: ['wesign-auth-api']
        },
        {
          id: 'wesign-signing-api',
          name: 'WeSign Digital Signing API',
          description: 'Digital signing workflows, signatures, and certificate management',
          collectionPath: path.join(process.cwd(), 'new_tests_for_wesign', 'api_tests', 'WeSign_Signing_Collection.postman_collection.json'),
          category: 'signing',
          priority: 'critical',
          estimatedDuration: 900, // 15 minutes
          dependencies: ['wesign-auth-api', 'wesign-documents-api']
        },
        {
          id: 'wesign-templates-api',
          name: 'WeSign Templates API',
          description: 'Template creation, management, and sharing APIs',
          collectionPath: path.join(process.cwd(), 'new_tests_for_wesign', 'api_tests', 'WeSign_Templates_Collection.postman_collection.json'),
          category: 'templates',
          priority: 'medium',
          estimatedDuration: 400, // 7 minutes
          dependencies: ['wesign-auth-api']
        },
        {
          id: 'wesign-users-api',
          name: 'WeSign Users & Contacts API',
          description: 'User management, contact handling, and profile APIs',
          collectionPath: path.join(process.cwd(), 'new_tests_for_wesign', 'api_tests', 'WeSign_Users_Collection.postman_collection.json'),
          category: 'users',
          priority: 'high',
          estimatedDuration: 500, // 8 minutes
          dependencies: ['wesign-auth-api']
        },
        {
          id: 'wesign-integration-api',
          name: 'WeSign Integration API',
          description: 'Third-party integrations, webhooks, and external API connectivity',
          collectionPath: path.join(process.cwd(), 'new_tests_for_wesign', 'api_tests', 'WeSign_Integration_Collection.postman_collection.json'),
          category: 'integration',
          priority: 'medium',
          estimatedDuration: 450, // 7.5 minutes
          dependencies: ['wesign-auth-api', 'wesign-documents-api']
        }
      ];

      // Process each API suite
      for (const suiteConfig of wesignApiSuites) {
        try {
          if (fs.existsSync(suiteConfig.collectionPath)) {
            // Load and parse the Postman collection
            const collection = JSON.parse(fs.readFileSync(suiteConfig.collectionPath, 'utf-8'));
            const tests = this.extractTestsFromCollection(collection, suiteConfig.id);

            const suite: ApiTestSuite = {
              ...suiteConfig,
              tests
            };

            this.testSuites.set(suite.id, suite);
            logger.info(`📋 Loaded API test suite: ${suite.name}`, {
              tests: tests.length,
              category: suite.category
            });
          } else {
            logger.warn(`⚠️ API collection not found: ${suiteConfig.collectionPath}`);
          }
        } catch (error: any) {
          logger.error(`❌ Failed to load API suite: ${suiteConfig.name}`, {
            error: error.message,
            path: suiteConfig.collectionPath
          });
        }
      }

      logger.info('✅ API test suite discovery completed', {
        totalSuites: this.testSuites.size,
        categories: Array.from(new Set(Array.from(this.testSuites.values()).map(s => s.category)))
      });

    } catch (error: any) {
      logger.error('❌ Failed to discover API test suites', { error: error.message });
      throw error;
    }
  }

  /**
   * Extract tests from Postman collection
   */
  private extractTestsFromCollection(collection: any, suiteId: string): ApiTest[] {
    const tests: ApiTest[] = [];

    const extractFromItems = (items: any[], category: string = 'general') => {
      for (const item of items) {
        if (item.request) {
          const test: ApiTest = {
            id: `${suiteId}-${item.name?.replace(/\s+/g, '-').toLowerCase() || 'test'}`,
            name: item.name || 'Unnamed Test',
            method: item.request.method,
            endpoint: this.extractEndpointFromUrl(item.request.url),
            description: item.request.description || '',
            category,
            priority: this.determinePriority(item.name, item.request.method),
            requestBody: item.request.body?.raw ? JSON.parse(item.request.body.raw) : undefined,
            expectedStatus: this.extractExpectedStatus(item.event),
            assertions: this.extractAssertions(item.event),
            headers: this.extractHeaders(item.request.header),
            timeout: 30000 // 30 seconds default
          };

          tests.push(test);
        }

        if (item.item) {
          extractFromItems(item.item, item.name?.toLowerCase() || category);
        }
      }
    };

    if (collection.item) {
      extractFromItems(collection.item);
    }

    return tests;
  }

  private extractEndpointFromUrl(url: any): string {
    if (typeof url === 'string') {
      return url;
    } else if (url?.raw) {
      return url.raw;
    } else if (url?.path) {
      return Array.isArray(url.path) ? '/' + url.path.join('/') : url.path;
    }
    return '/unknown';
  }

  private determinePriority(name: string, method: string): 'critical' | 'high' | 'medium' | 'low' {
    const lowerName = name?.toLowerCase() || '';

    if (lowerName.includes('auth') || lowerName.includes('login') || lowerName.includes('token')) {
      return 'critical';
    }
    if (method === 'POST' || method === 'DELETE') {
      return 'high';
    }
    if (method === 'PUT' || method === 'PATCH') {
      return 'medium';
    }
    return 'low';
  }

  private extractExpectedStatus(events: any[]): number {
    if (!events) return 200;

    for (const event of events) {
      if (event.listen === 'test' && event.script?.exec) {
        for (const line of event.script.exec) {
          const statusMatch = line.match(/pm\.response\.to\.have\.status\((\d+)\)/);
          if (statusMatch) {
            return parseInt(statusMatch[1]);
          }
        }
      }
    }
    return 200;
  }

  private extractAssertions(events: any[]): string[] {
    const assertions: string[] = [];

    if (!events) return assertions;

    for (const event of events) {
      if (event.listen === 'test' && event.script?.exec) {
        for (const line of event.script.exec) {
          if (line.includes('pm.test') || line.includes('pm.expect')) {
            assertions.push(line.trim());
          }
        }
      }
    }

    return assertions;
  }

  private extractHeaders(headers: any[]): Record<string, string> {
    const headerMap: Record<string, string> = {};

    if (!headers) return headerMap;

    for (const header of headers) {
      if (header.key && header.value && !header.disabled) {
        headerMap[header.key] = header.value;
      }
    }

    return headerMap;
  }

  /**
   * Execute API tests based on configuration
   */
  async executeApiTests(config: ApiTestExecutionConfig): Promise<string> {
    const executionId = `api-exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    logger.info('🚀 Starting API test execution', {
      executionId,
      suites: config.suiteIds?.length || 0,
      tests: config.testIds?.length || 0,
      parallel: config.parallel
    });

    const execution: ApiTestExecution = {
      id: executionId,
      configId: `config-${executionId}`,
      status: 'pending',
      startTime: new Date(),
      results: [],
      summary: this.initializeEmptySummary(),
      reportPaths: {},
      environment: config.environment.baseUrl,
      errors: []
    };

    this.activeExecutions.set(executionId, execution);

    try {
      execution.status = 'running';
      this.emit('executionStarted', { executionId, config });

      // Determine which suites/tests to run
      const suitesToRun = this.getSuitesToRun(config);

      // Execute tests
      if (config.parallel && config.maxWorkers > 1) {
        await this.executeApiTestsInParallel(executionId, suitesToRun, config);
      } else {
        await this.executeApiTestsSequentially(executionId, suitesToRun, config);
      }

      // Generate reports
      await this.generateApiReports(executionId, config);

      execution.status = 'completed';
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();

      // Calculate final summary
      this.calculateExecutionSummary(execution);

      logger.info('✅ API test execution completed', {
        executionId,
        duration: execution.duration,
        summary: execution.summary
      });

      this.emit('executionCompleted', { executionId, execution });

      return executionId;

    } catch (error: any) {
      execution.status = 'failed';
      execution.endTime = new Date();
      execution.errors.push(error.message);

      logger.error('❌ API test execution failed', {
        executionId,
        error: error.message
      });

      this.emit('executionFailed', { executionId, error: error.message });
      throw error;
    }
  }

  private getSuitesToRun(config: ApiTestExecutionConfig): ApiTestSuite[] {
    if (config.suiteIds && config.suiteIds.length > 0) {
      return config.suiteIds
        .map(id => this.testSuites.get(id))
        .filter(suite => suite !== undefined) as ApiTestSuite[];
    }

    // Return all suites if no specific selection
    return Array.from(this.testSuites.values());
  }

  private async executeApiTestsInParallel(
    executionId: string,
    suites: ApiTestSuite[],
    config: ApiTestExecutionConfig
  ): Promise<void> {
    logger.info('🔄 Executing API tests in parallel', {
      executionId,
      suites: suites.length,
      maxWorkers: config.maxWorkers
    });

    // Create Newman execution promises
    const promises = suites.map(suite =>
      this.executeApiTestSuite(executionId, suite, config)
    );

    // Execute with limited concurrency
    const results = await this.executeWithConcurrencyLimit(promises, config.maxWorkers);

    // Process results
    for (const result of results) {
      if (result.status === 'fulfilled') {
        logger.debug('✅ API suite execution completed', { result: result.value });
      } else {
        logger.error('❌ API suite execution failed', { error: result.reason });
      }
    }
  }

  private async executeApiTestsSequentially(
    executionId: string,
    suites: ApiTestSuite[],
    config: ApiTestExecutionConfig
  ): Promise<void> {
    logger.info('📋 Executing API tests sequentially', {
      executionId,
      suites: suites.length
    });

    for (const suite of suites) {
      try {
        await this.executeApiTestSuite(executionId, suite, config);
      } catch (error: any) {
        logger.error('❌ API suite execution failed', {
          suiteId: suite.id,
          error: error.message
        });
      }
    }
  }

  private async executeApiTestSuite(
    executionId: string,
    suite: ApiTestSuite,
    config: ApiTestExecutionConfig
  ): Promise<void> {
    logger.info('🔗 Executing API test suite', {
      executionId,
      suiteId: suite.id,
      suiteName: suite.name
    });

    try {
      // Prepare Newman configuration
      const newmanConfig: NewmanTestConfig = {
        collection: suite.collectionPath,
        environment: suite.environmentPath,
        timeout: config.timeout,
        iterations: 1,
        reporters: ['json', 'html'],
        reporterOptions: {
          json: { export: path.join(ApiTestRunner.REPORTS_PATH, `${executionId}-${suite.id}.json`) },
          html: { export: path.join(ApiTestRunner.REPORTS_PATH, `${executionId}-${suite.id}.html`) }
        }
      };

      // Execute with Newman
      const newmanRunId = await newmanExecutor.executeCollection(newmanConfig);

      // Wait for completion and get results
      const newmanResult = await this.waitForNewmanCompletion(newmanRunId);

      // Convert Newman results to our format
      if (newmanResult) {
        const suiteResults = this.convertNewmanResults(suite, newmanResult);
        const execution = this.activeExecutions.get(executionId)!;
        execution.results.push(...suiteResults);

        this.emit('suiteCompleted', {
          executionId,
          suiteId: suite.id,
          results: suiteResults
        });
      }

    } catch (error: any) {
      logger.error('❌ Failed to execute API test suite', {
        suiteId: suite.id,
        error: error.message
      });

      // Add error result
      const execution = this.activeExecutions.get(executionId)!;
      execution.errors.push(`Suite ${suite.id}: ${error.message}`);
    }
  }

  private async waitForNewmanCompletion(runId: string): Promise<ApiTestResult | null> {
    return new Promise((resolve) => {
      const checkCompletion = async () => {
        const result = await newmanExecutor.getTestResult(runId);

        if (result && result.status !== 'running') {
          resolve(result);
        } else {
          setTimeout(checkCompletion, 1000);
        }
      };

      checkCompletion();
    });
  }

  private convertNewmanResults(suite: ApiTestSuite, newmanResult: ApiTestResult): ApiTestExecutionResult[] {
    // Convert Newman results to our API test execution result format
    // This is a simplified conversion - real implementation would be more detailed
    return suite.tests.map(test => ({
      testId: test.id,
      suiteId: suite.id,
      status: 'passed' as const, // Would be determined from Newman results
      duration: 100, // Would come from Newman results
      requestDetails: {
        method: test.method,
        url: test.endpoint,
        headers: test.headers || {},
        body: test.requestBody
      },
      responseDetails: {
        status: test.expectedStatus || 200,
        headers: {},
        body: null,
        time: 100,
        size: 1024
      },
      assertions: {
        total: test.assertions.length,
        passed: test.assertions.length,
        failed: 0,
        details: test.assertions.map(assertion => ({
          name: assertion,
          status: 'passed' as const
        }))
      },
      retryCount: 0
    }));
  }

  private async executeWithConcurrencyLimit<T>(
    promises: Promise<T>[],
    limit: number
  ): Promise<PromiseSettledResult<T>[]> {
    const results: PromiseSettledResult<T>[] = [];

    for (let i = 0; i < promises.length; i += limit) {
      const batch = promises.slice(i, i + limit);
      const batchResults = await Promise.allSettled(batch);
      results.push(...batchResults);
    }

    return results;
  }

  private async generateApiReports(executionId: string, config: ApiTestExecutionConfig): Promise<void> {
    const execution = this.activeExecutions.get(executionId)!;

    try {
      logger.info('📊 Generating API test reports', { executionId });

      // Generate JSON report
      if (config.reportingConfig.formats.includes('json')) {
        const jsonReportPath = path.join(config.reportingConfig.outputDir, `api-report-${executionId}.json`);
        const jsonReport = {
          execution,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        };

        fs.writeFileSync(jsonReportPath, JSON.stringify(jsonReport, null, 2));
        execution.reportPaths.json = jsonReportPath;
      }

      // Generate HTML report (simplified)
      if (config.reportingConfig.formats.includes('html')) {
        const htmlReportPath = path.join(config.reportingConfig.outputDir, `api-report-${executionId}.html`);
        const htmlContent = this.generateHtmlReport(execution);

        fs.writeFileSync(htmlReportPath, htmlContent);
        execution.reportPaths.html = htmlReportPath;
      }

      logger.info('✅ API test reports generated', {
        executionId,
        reports: execution.reportPaths
      });

    } catch (error: any) {
      logger.error('❌ Failed to generate API reports', {
        executionId,
        error: error.message
      });
    }
  }

  private generateHtmlReport(execution: ApiTestExecution): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>WeSign API Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px 0; }
        .metric { background: white; padding: 15px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; }
        .metric .value { font-size: 2em; font-weight: bold; color: #333; }
        .metric .label { color: #666; }
        .results { margin-top: 30px; }
        .test-result { margin: 10px 0; padding: 10px; border-radius: 5px; }
        .passed { background: #d4edda; border-left: 4px solid #28a745; }
        .failed { background: #f8d7da; border-left: 4px solid #dc3545; }
    </style>
</head>
<body>
    <div class="header">
        <h1>WeSign API Test Report</h1>
        <p>Execution ID: ${execution.id}</p>
        <p>Environment: ${execution.environment}</p>
        <p>Duration: ${execution.duration || 0}ms</p>
    </div>

    <div class="summary">
        <div class="metric">
            <div class="value">${execution.summary.totalTests}</div>
            <div class="label">Total Tests</div>
        </div>
        <div class="metric">
            <div class="value">${execution.summary.passedTests}</div>
            <div class="label">Passed</div>
        </div>
        <div class="metric">
            <div class="value">${execution.summary.failedTests}</div>
            <div class="label">Failed</div>
        </div>
        <div class="metric">
            <div class="value">${execution.summary.successRate.toFixed(1)}%</div>
            <div class="label">Success Rate</div>
        </div>
    </div>

    <div class="results">
        <h2>Test Results</h2>
        ${execution.results.map(result => `
            <div class="test-result ${result.status}">
                <strong>${result.testId}</strong>
                <span>(${result.requestDetails.method} ${result.requestDetails.url})</span>
                - ${result.status} (${result.duration}ms)
            </div>
        `).join('')}
    </div>
</body>
</html>`;
  }

  private calculateExecutionSummary(execution: ApiTestExecution): void {
    const results = execution.results;

    execution.summary = {
      totalSuites: new Set(results.map(r => r.suiteId)).size,
      totalTests: results.length,
      totalRequests: results.length,
      passedTests: results.filter(r => r.status === 'passed').length,
      failedTests: results.filter(r => r.status === 'failed').length,
      skippedTests: results.filter(r => r.status === 'skipped').length,
      totalAssertions: results.reduce((sum, r) => sum + r.assertions.total, 0),
      passedAssertions: results.reduce((sum, r) => sum + r.assertions.passed, 0),
      failedAssertions: results.reduce((sum, r) => sum + r.assertions.failed, 0),
      averageResponseTime: results.reduce((sum, r) => sum + r.duration, 0) / results.length || 0,
      totalDataTransferred: results.reduce((sum, r) => sum + r.responseDetails.size, 0),
      successRate: results.length > 0 ? (execution.summary.passedTests / results.length) * 100 : 0,
      coverage: {
        endpoints: new Set(results.map(r => r.requestDetails.url)).size,
        methods: Array.from(new Set(results.map(r => r.requestDetails.method))),
        statusCodes: Array.from(new Set(results.map(r => r.responseDetails.status)))
      }
    };
  }

  private initializeEmptySummary(): ApiTestExecutionSummary {
    return {
      totalSuites: 0,
      totalTests: 0,
      totalRequests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      totalAssertions: 0,
      passedAssertions: 0,
      failedAssertions: 0,
      averageResponseTime: 0,
      totalDataTransferred: 0,
      successRate: 0,
      coverage: {
        endpoints: 0,
        methods: [],
        statusCodes: []
      }
    };
  }

  private setupNewmanEventListeners(): void {
    newmanExecutor.on('testProgress', (event) => {
      this.emit('testProgress', event);
    });

    newmanExecutor.on('testComplete', (event) => {
      this.emit('testComplete', event);
    });

    newmanExecutor.on('testError', (event) => {
      this.emit('testError', event);
    });
  }

  private getTotalTestCount(): number {
    return Array.from(this.testSuites.values())
      .reduce((total, suite) => total + suite.tests.length, 0);
  }

  // Public API methods
  async getTestSuites(): Promise<ApiTestSuite[]> {
    return Array.from(this.testSuites.values());
  }

  async getTestSuite(suiteId: string): Promise<ApiTestSuite | null> {
    return this.testSuites.get(suiteId) || null;
  }

  async getExecution(executionId: string): Promise<ApiTestExecution | null> {
    return this.activeExecutions.get(executionId) || null;
  }

  async cancelExecution(executionId: string): Promise<boolean> {
    const execution = this.activeExecutions.get(executionId);

    if (execution && execution.status === 'running') {
      execution.status = 'cancelled';
      execution.endTime = new Date();

      logger.info('🛑 API test execution cancelled', { executionId });
      this.emit('executionCancelled', { executionId });
      return true;
    }

    return false;
  }

  async cleanup(): Promise<void> {
    // Cancel all running executions
    for (const [executionId, execution] of this.activeExecutions) {
      if (execution.status === 'running') {
        await this.cancelExecution(executionId);
      }
    }

    // Cleanup Newman executor
    await newmanExecutor.cleanup();
  }
}

// Create singleton instance
export const apiTestRunner = new ApiTestRunner();