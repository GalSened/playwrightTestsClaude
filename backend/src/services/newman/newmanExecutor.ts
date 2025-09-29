/**
 * Newman API Testing Executor Service
 * Integrates with the existing testing architecture
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/utils/logger';
import {
  NewmanTestConfig,
  ApiTestResult,
  ApiTestFailure,
  CollectionInfo,
  EnvironmentInfo,
  NewmanExecutionOptions,
  NewmanRunSummary
} from './types';

export class NewmanExecutor extends EventEmitter {
  private static readonly COLLECTIONS_PATH = path.resolve(__dirname, '../../../data/newman/collections');
  private static readonly ENVIRONMENTS_PATH = path.resolve(__dirname, '../../../data/newman/environments');
  private static readonly REPORTS_PATH = path.resolve(__dirname, '../../../data/newman/reports');

  private runningTests: Map<string, ChildProcess> = new Map();
  private testResults: Map<string, ApiTestResult> = new Map();

  constructor() {
    super();
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    [
      NewmanExecutor.COLLECTIONS_PATH,
      NewmanExecutor.ENVIRONMENTS_PATH,
      NewmanExecutor.REPORTS_PATH
    ].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info(`Created Newman directory: ${dir}`);
      }
    });
  }

  async executeCollection(config: NewmanTestConfig, options: NewmanExecutionOptions = {}): Promise<string> {
    const runId = options.runId || uuidv4();

    logger.info(`🚀 Starting Newman API test execution: ${runId}`, config);

    // Initialize test result
    const result: ApiTestResult = {
      runId,
      status: 'running',
      collectionName: this.extractCollectionName(config.collection),
      startTime: new Date(),
      totalRequests: 0,
      passedRequests: 0,
      failedRequests: 0,
      assertions: {
        total: 0,
        passed: 0,
        failed: 0
      },
      iterations: {
        total: config.iterations || 1,
        completed: 0,
        failed: 0
      },
      transfers: {
        responseTotal: 0,
        responseAverage: 0
      },
      responseTime: {
        total: 0,
        average: 0,
        min: 0,
        max: 0
      },
      reports: {},
      output: [],
      errors: []
    };

    this.testResults.set(runId, result);

    try {
      await this.validateConfig(config);
      await this.executeNewmanProcess(runId, config, options);
      return runId;
    } catch (error: any) {
      result.status = 'failed';
      result.errors.push(`Execution failed: ${error.message}`);
      this.emit('testError', { runId, error: error.message });
      throw error;
    }
  }

  private async validateConfig(config: NewmanTestConfig): Promise<void> {
    // Validate collection
    if (typeof config.collection === 'string' && !fs.existsSync(config.collection)) {
      throw new Error(`Collection file not found: ${config.collection}`);
    }

    // Validate environment if provided
    if (config.environment && typeof config.environment === 'string' && !fs.existsSync(config.environment)) {
      throw new Error(`Environment file not found: ${config.environment}`);
    }

    // Validate globals if provided
    if (config.globals && typeof config.globals === 'string' && !fs.existsSync(config.globals)) {
      throw new Error(`Globals file not found: ${config.globals}`);
    }
  }

  private async executeNewmanProcess(runId: string, config: NewmanTestConfig, options: NewmanExecutionOptions): Promise<void> {
    const result = this.testResults.get(runId)!;

    // Build Newman command arguments
    const args = this.buildNewmanCommand(runId, config);

    logger.info(`📋 Running Newman command: newman run ${args.join(' ')}`);

    // Start Newman process
    const newmanProcess = spawn('newman', ['run', ...args], {
      cwd: options.workingDirectory || process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.runningTests.set(runId, newmanProcess);

    // Handle stdout (test output)
    newmanProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      result.output.push(output);
      this.parseNewmanOutput(runId, output);
      this.emit('testProgress', { runId, output });
    });

    // Handle stderr (errors)
    newmanProcess.stderr?.on('data', (data: Buffer) => {
      const error = data.toString();
      result.errors.push(error);
      this.emit('testError', { runId, error });
    });

    // Handle process completion
    newmanProcess.on('close', async (code) => {
      this.runningTests.delete(runId);
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - result.startTime.getTime();

      if (code === 0) {
        result.status = 'completed';
        logger.info(`✅ Newman API tests completed successfully: ${runId}`);
      } else {
        result.status = 'failed';
        logger.error(`❌ Newman API tests failed: ${runId} (exit code: ${code})`);
      }

      // Parse reports if available
      await this.parseReports(runId, config);

      this.emit('testComplete', { runId, result });
    });

    // Handle process errors
    newmanProcess.on('error', (error) => {
      this.runningTests.delete(runId);
      result.status = 'failed';
      result.endTime = new Date();
      result.errors.push(`Process error: ${error.message}`);

      logger.error(`💥 Newman process error: ${runId}`, error);
      this.emit('testError', { runId, error: error.message });
    });
  }

  private buildNewmanCommand(runId: string, config: NewmanTestConfig): string[] {
    const args: string[] = [];

    // Collection (required)
    if (typeof config.collection === 'string') {
      args.push(config.collection);
    } else {
      // Save collection object to temporary file
      const tempCollectionFile = path.join(NewmanExecutor.COLLECTIONS_PATH, `temp_${runId}.json`);
      fs.writeFileSync(tempCollectionFile, JSON.stringify(config.collection, null, 2));
      args.push(tempCollectionFile);
    }

    // Environment
    if (config.environment) {
      args.push('--environment');
      if (typeof config.environment === 'string') {
        args.push(config.environment);
      } else {
        const tempEnvFile = path.join(NewmanExecutor.ENVIRONMENTS_PATH, `temp_env_${runId}.json`);
        fs.writeFileSync(tempEnvFile, JSON.stringify(config.environment, null, 2));
        args.push(tempEnvFile);
      }
    }

    // Globals
    if (config.globals) {
      args.push('--globals');
      if (typeof config.globals === 'string') {
        args.push(config.globals);
      } else {
        const tempGlobalsFile = path.join(NewmanExecutor.ENVIRONMENTS_PATH, `temp_globals_${runId}.json`);
        fs.writeFileSync(tempGlobalsFile, JSON.stringify(config.globals, null, 2));
        args.push(tempGlobalsFile);
      }
    }

    // Iterations
    if (config.iterations && config.iterations > 1) {
      args.push('--iteration-count', config.iterations.toString());
    }

    // Delay
    if (config.delay) {
      args.push('--delay-request', config.delay.toString());
    }

    // Timeout
    if (config.timeout) {
      args.push('--timeout', config.timeout.toString());
    }

    // Folder
    if (config.folder) {
      args.push('--folder', config.folder);
    }

    // Bail
    if (config.bail) {
      args.push('--bail');
    }

    // Suppress exit code
    if (config.suppressExitCode) {
      args.push('--suppress-exit-code');
    }

    // Ignore redirects
    if (config.ignoreRedirects) {
      args.push('--ignore-redirects');
    }

    // Insecure
    if (config.insecure) {
      args.push('--insecure');
    }

    // Color
    if (config.color) {
      args.push('--color', config.color);
    }

    // Reporters
    if (config.reporters && config.reporters.length > 0) {
      args.push('--reporters', config.reporters.join(','));

      // Reporter options
      if (config.reporterOptions) {
        // JSON reporter
        if (config.reporters.includes('json') && config.reporterOptions.json?.export) {
          const jsonReportPath = path.join(NewmanExecutor.REPORTS_PATH, `${runId}_report.json`);
          args.push('--reporter-json-export', jsonReportPath);
        }

        // HTML reporter
        if (config.reporters.includes('html') && config.reporterOptions.html?.export) {
          const htmlReportPath = path.join(NewmanExecutor.REPORTS_PATH, `${runId}_report.html`);
          args.push('--reporter-html-export', htmlReportPath);
        }
      }
    }

    return args;
  }

  private parseNewmanOutput(runId: string, output: string): void {
    const result = this.testResults.get(runId)!;

    // Parse Newman CLI output for progress information
    const lines = output.split('\n');

    for (const line of lines) {
      // Parse iteration progress
      const iterationMatch = line.match(/iteration: (\d+)\/(\d+)/);
      if (iterationMatch) {
        result.iterations.completed = parseInt(iterationMatch[1]);
      }

      // Parse request results
      const requestMatch = line.match(/✓|×/);
      if (requestMatch) {
        result.totalRequests++;
        if (line.includes('✓')) {
          result.passedRequests++;
        } else if (line.includes('×')) {
          result.failedRequests++;
        }
      }

      // Parse assertions
      const assertionMatch = line.match(/(\d+)\/(\d+) tests passed/);
      if (assertionMatch) {
        result.assertions.passed = parseInt(assertionMatch[1]);
        result.assertions.total = parseInt(assertionMatch[2]);
        result.assertions.failed = result.assertions.total - result.assertions.passed;
      }
    }
  }

  private async parseReports(runId: string, config: NewmanTestConfig): Promise<void> {
    const result = this.testResults.get(runId)!;

    // Parse JSON report if available
    const jsonReportPath = path.join(NewmanExecutor.REPORTS_PATH, `${runId}_report.json`);
    if (fs.existsSync(jsonReportPath)) {
      try {
        const jsonReport = JSON.parse(fs.readFileSync(jsonReportPath, 'utf-8')) as NewmanRunSummary;
        this.extractMetricsFromReport(result, jsonReport);
        result.reports.json = jsonReportPath;
      } catch (error) {
        logger.warn(`Failed to parse JSON report for ${runId}:`, error);
      }
    }

    // Check for HTML report
    const htmlReportPath = path.join(NewmanExecutor.REPORTS_PATH, `${runId}_report.html`);
    if (fs.existsSync(htmlReportPath)) {
      result.reports.html = htmlReportPath;
    }
  }

  private extractMetricsFromReport(result: ApiTestResult, report: NewmanRunSummary): void {
    const { stats, executions } = report.run;

    // Update request stats
    result.totalRequests = stats.requests.total;
    result.passedRequests = stats.requests.total - stats.requests.failed;
    result.failedRequests = stats.requests.failed;

    // Update assertion stats
    result.assertions = {
      total: stats.assertions.total,
      passed: stats.assertions.total - stats.assertions.failed,
      failed: stats.assertions.failed
    };

    // Update iteration stats
    result.iterations = {
      total: stats.iterations.total,
      completed: stats.iterations.total - stats.iterations.pending - stats.iterations.failed,
      failed: stats.iterations.failed
    };

    // Calculate response time metrics
    if (executions && executions.length > 0) {
      const responseTimes = executions
        .filter(exec => exec.response?.responseTime)
        .map(exec => exec.response.responseTime);

      if (responseTimes.length > 0) {
        result.responseTime = {
          total: responseTimes.reduce((sum, time) => sum + time, 0),
          average: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
          min: Math.min(...responseTimes),
          max: Math.max(...responseTimes)
        };
      }

      // Calculate transfer metrics
      const responseSizes = executions
        .filter(exec => exec.response?.responseSize)
        .map(exec => exec.response.responseSize);

      if (responseSizes.length > 0) {
        result.transfers = {
          responseTotal: responseSizes.reduce((sum, size) => sum + size, 0),
          responseAverage: responseSizes.reduce((sum, size) => sum + size, 0) / responseSizes.length
        };
      }
    }

    // Extract failures
    if (report.run.failures && report.run.failures.length > 0) {
      result.failures = report.run.failures.map(failure => ({
        source: failure.source?.name || 'Unknown',
        name: failure.error.name,
        message: failure.error.message,
        test: failure.error.test,
        checkpoint: failure.at,
        item: {
          name: failure.source?.name || 'Unknown',
          id: failure.error.index.toString()
        },
        assertion: failure.error.test,
        index: failure.error.index
      }));
    }
  }

  private extractCollectionName(collection: string | object): string {
    if (typeof collection === 'string') {
      return path.basename(collection, '.json');
    } else if (collection && typeof collection === 'object' && 'info' in collection) {
      return (collection as any).info?.name || 'Unknown Collection';
    }
    return 'Unknown Collection';
  }

  async getTestResult(runId: string): Promise<ApiTestResult | null> {
    return this.testResults.get(runId) || null;
  }

  async getAllRunningTests(): Promise<ApiTestResult[]> {
    return Array.from(this.testResults.values()).filter(r => r.status === 'running');
  }

  async cancelTest(runId: string): Promise<boolean> {
    const process = this.runningTests.get(runId);

    if (process && !process.killed) {
      process.kill('SIGTERM');

      const result = this.testResults.get(runId);
      if (result) {
        result.status = 'cancelled';
        result.endTime = new Date();
      }

      this.runningTests.delete(runId);
      logger.info(`🛑 Newman API test execution cancelled: ${runId}`);
      return true;
    }

    return false;
  }

  async getReport(runId: string, format: 'json' | 'html'): Promise<string | null> {
    const result = this.testResults.get(runId);

    if (!result || result.status === 'running') {
      return null;
    }

    const reportPath = result.reports[format];
    if (reportPath && fs.existsSync(reportPath)) {
      return fs.readFileSync(reportPath, 'utf-8');
    }

    return null;
  }

  async saveCollection(name: string, collection: object): Promise<CollectionInfo> {
    const id = uuidv4();
    const filePath = path.join(NewmanExecutor.COLLECTIONS_PATH, `${id}.json`);

    fs.writeFileSync(filePath, JSON.stringify(collection, null, 2));

    const info: CollectionInfo = {
      id,
      name,
      description: (collection as any).info?.description,
      variables: (collection as any).variable || [],
      requests: this.extractRequestsFromCollection(collection),
      folders: this.extractFoldersFromCollection(collection),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    logger.info(`📁 Collection saved: ${name} (${id})`);
    return info;
  }

  async getCollections(): Promise<CollectionInfo[]> {
    const collections: CollectionInfo[] = [];

    if (!fs.existsSync(NewmanExecutor.COLLECTIONS_PATH)) {
      return collections;
    }

    const files = fs.readdirSync(NewmanExecutor.COLLECTIONS_PATH)
      .filter(file => file.endsWith('.json'));

    for (const file of files) {
      try {
        const filePath = path.join(NewmanExecutor.COLLECTIONS_PATH, file);
        const collection = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const stats = fs.statSync(filePath);

        collections.push({
          id: path.basename(file, '.json'),
          name: collection.info?.name || file,
          description: collection.info?.description,
          variables: collection.variable || [],
          requests: this.extractRequestsFromCollection(collection),
          folders: this.extractFoldersFromCollection(collection),
          createdAt: stats.birthtime,
          updatedAt: stats.mtime
        });
      } catch (error) {
        logger.warn(`Failed to parse collection file ${file}:`, error);
      }
    }

    return collections;
  }

  private extractRequestsFromCollection(collection: any): Array<{ name: string; method: string; url: string; description?: string }> {
    const requests: Array<{ name: string; method: string; url: string; description?: string }> = [];

    const extractFromItems = (items: any[]) => {
      for (const item of items) {
        if (item.request) {
          requests.push({
            name: item.name,
            method: item.request.method,
            url: typeof item.request.url === 'string' ? item.request.url : item.request.url?.raw || '',
            description: item.request.description
          });
        }
        if (item.item) {
          extractFromItems(item.item);
        }
      }
    };

    if (collection.item) {
      extractFromItems(collection.item);
    }

    return requests;
  }

  private extractFoldersFromCollection(collection: any): Array<{ name: string; description?: string; requests: number }> {
    const folders: Array<{ name: string; description?: string; requests: number }> = [];

    const extractFolders = (items: any[]) => {
      for (const item of items) {
        if (item.item && !item.request) {
          folders.push({
            name: item.name,
            description: item.description,
            requests: this.countRequestsInItem(item)
          });
          extractFolders(item.item);
        }
      }
    };

    if (collection.item) {
      extractFolders(collection.item);
    }

    return folders;
  }

  private countRequestsInItem(item: any): number {
    let count = 0;
    if (item.request) {
      count = 1;
    }
    if (item.item) {
      for (const subItem of item.item) {
        count += this.countRequestsInItem(subItem);
      }
    }
    return count;
  }

  // Cleanup temporary files
  async cleanup(): Promise<void> {
    const tempFiles = fs.readdirSync(NewmanExecutor.COLLECTIONS_PATH)
      .filter(file => file.startsWith('temp_'))
      .concat(
        fs.readdirSync(NewmanExecutor.ENVIRONMENTS_PATH)
          .filter(file => file.startsWith('temp_'))
      );

    for (const file of tempFiles) {
      try {
        const fullPath = file.includes('env') || file.includes('globals')
          ? path.join(NewmanExecutor.ENVIRONMENTS_PATH, file)
          : path.join(NewmanExecutor.COLLECTIONS_PATH, file);
        fs.unlinkSync(fullPath);
      } catch (error) {
        logger.warn(`Failed to cleanup temp file ${file}:`, error);
      }
    }
  }
}

// Create singleton instance
export const newmanExecutor = new NewmanExecutor();