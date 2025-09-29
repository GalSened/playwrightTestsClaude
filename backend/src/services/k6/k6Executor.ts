/**
 * K6 Load Test Executor
 * Handles execution of k6 load tests with real-time monitoring
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/utils/logger';
import {
  K6TestConfig,
  K6TestResult,
  K6TestFailure,
  K6TestScript,
  LoadTestRun,
  K6RuntimeMetrics,
  K6ExecutionEvent,
  K6ScriptTemplate,
  LoadTestScenario
} from './types';

export class K6LoadTestExecutor extends EventEmitter {
  private runningTests: Map<string, ChildProcess> = new Map();
  private testResults: Map<string, K6TestResult> = new Map();
  private k6BinaryPath: string;
  private scriptsDir: string;
  private resultsDir: string;
  private templatesDir: string;

  constructor() {
    super();
    this.k6BinaryPath = 'k6'; // Use global k6 command
    this.scriptsDir = path.resolve(__dirname, '../../../data/k6/scripts');
    this.resultsDir = path.resolve(__dirname, '../../../data/k6/results');
    this.templatesDir = path.resolve(__dirname, '../../../data/k6/templates');

    this.ensureDirectories();
    this.initializeTemplates();
  }

  private ensureDirectories(): void {
    [this.scriptsDir, this.resultsDir, this.templatesDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  private initializeTemplates(): void {
    // Create default k6 script templates if they don't exist
    const defaultTemplates: K6ScriptTemplate[] = [
      {
        name: 'Basic HTTP Load Test',
        description: 'Simple HTTP load test with configurable virtual users and duration',
        category: 'http',
        script: `import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.1'],
  },
};

export default function() {
  let response = http.get(__ENV.TARGET_URL || 'https://httpbin.org/get');
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);
}`,
        defaultOptions: {
          vus: 10,
          duration: '30s',
          thresholds: {
            'http_req_duration': ['p(95)<500'],
            'http_req_failed': ['rate<0.1']
          }
        },
        requiredVariables: ['TARGET_URL']
      },
      {
        name: 'API Load Test',
        description: 'RESTful API load test with authentication and multiple endpoints',
        category: 'api',
        script: `import http from 'k6/http';
import { check, group, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 10 },
    { duration: '5m', target: 10 },
    { duration: '2m', target: 20 },
    { duration: '5m', target: 20 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(99)<1500'],
    'logged in successfully': ['rate>0.99'],
    'retrieved posts': ['rate>0.95'],
  },
};

export default function() {
  let baseUrl = __ENV.API_BASE_URL || 'https://httpbin.org';

  group('Authentication', function() {
    let loginData = {
      username: __ENV.USERNAME || 'test',
      password: __ENV.PASSWORD || 'test'
    };

    let response = http.post(\`\${baseUrl}/post\`, JSON.stringify(loginData), {
      headers: { 'Content-Type': 'application/json' },
    });

    check(response, {
      'logged in successfully': (r) => r.status === 200,
    });
  });

  group('API Calls', function() {
    let response = http.get(\`\${baseUrl}/get\`);
    check(response, {
      'retrieved posts': (r) => r.status === 200,
    });
  });

  sleep(1);
}`,
        defaultOptions: {
          stages: [
            { duration: '2m', target: 10 },
            { duration: '5m', target: 10 },
            { duration: '2m', target: 20 },
            { duration: '5m', target: 20 },
            { duration: '2m', target: 0 }
          ]
        },
        requiredVariables: ['API_BASE_URL', 'USERNAME', 'PASSWORD']
      }
    ];

    defaultTemplates.forEach(template => {
      const templatePath = path.join(this.templatesDir, `${template.name.toLowerCase().replace(/\s+/g, '-')}.json`);
      if (!fs.existsSync(templatePath)) {
        fs.writeFileSync(templatePath, JSON.stringify(template, null, 2));
      }
    });
  }

  /**
   * Execute a k6 load test
   */
  async executeLoadTest(config: K6TestConfig): Promise<string> {
    const runId = uuidv4();

    logger.info('Starting k6 load test execution', { runId, config: config.name || 'unnamed' });

    try {
      // Create test result object
      const testResult: K6TestResult = {
        runId,
        config,
        status: 'pending',
        startTime: new Date()
      };

      this.testResults.set(runId, testResult);

      // Prepare script file
      const scriptPath = await this.prepareScript(runId, config);
      testResult.scriptPath = scriptPath;

      // Build k6 command
      const k6Command = this.buildK6Command(config, scriptPath, runId);

      logger.debug('Executing k6 command', { runId, command: k6Command.join(' ') });

      // Start k6 process
      const k6Process = spawn(k6Command[0], k6Command.slice(1), {
        cwd: path.dirname(scriptPath),
        env: {
          ...process.env,
          ...config.env
        }
      });

      this.runningTests.set(runId, k6Process);
      testResult.status = 'running';
      testResult.pid = k6Process.pid;

      // Emit start event
      this.emit('testStarted', {
        type: 'start',
        runId,
        timestamp: new Date(),
        data: { config, pid: k6Process.pid }
      } as K6ExecutionEvent);

      // Handle process output
      this.setupProcessHandlers(k6Process, runId, testResult);

      return runId;

    } catch (error) {
      logger.error('Failed to start k6 load test', { runId, error });

      const testResult = this.testResults.get(runId);
      if (testResult) {
        testResult.status = 'failed';
        testResult.error = error instanceof Error ? error.message : 'Unknown error';
        testResult.endTime = new Date();
        testResult.duration = testResult.endTime.getTime() - testResult.startTime.getTime();
      }

      throw error;
    }
  }

  private async prepareScript(runId: string, config: K6TestConfig): Promise<string> {
    const scriptPath = path.join(this.scriptsDir, `${runId}.js`);

    let scriptContent: string;

    if (config.scriptPath && fs.existsSync(config.scriptPath)) {
      // Use existing script file
      scriptContent = fs.readFileSync(config.scriptPath, 'utf-8');
    } else if (config.script) {
      // Use provided script content
      scriptContent = config.script;
    } else {
      throw new Error('No script content or valid script path provided');
    }

    // Inject options if provided
    if (config.options) {
      const optionsJson = JSON.stringify(config.options, null, 2);
      const optionsRegex = /export\s+let\s+options\s*=\s*{[^}]*};?/;

      if (optionsRegex.test(scriptContent)) {
        scriptContent = scriptContent.replace(optionsRegex, `export let options = ${optionsJson};`);
      } else {
        scriptContent = `export let options = ${optionsJson};\n\n${scriptContent}`;
      }
    }

    fs.writeFileSync(scriptPath, scriptContent);
    return scriptPath;
  }

  private buildK6Command(config: K6TestConfig, scriptPath: string, runId: string): string[] {
    const command = [this.k6BinaryPath, 'run'];

    // Add JSON output for results parsing
    const resultsPath = path.join(this.resultsDir, `${runId}.json`);
    command.push('--out', `json=${resultsPath}`);

    // Add summary output
    const summaryPath = path.join(this.resultsDir, `${runId}-summary.json`);
    command.push('--summary-export', summaryPath);

    // Add tags if provided
    if (config.tags) {
      Object.entries(config.tags).forEach(([key, value]) => {
        command.push('--tag', `${key}=${value}`);
      });
    }

    // Add timeout if specified
    if (config.timeout) {
      command.push('--max-vus', String(config.timeout));
    }

    // Add script path
    command.push(scriptPath);

    return command;
  }

  private setupProcessHandlers(k6Process: ChildProcess, runId: string, testResult: K6TestResult): void {
    let stdoutBuffer = '';
    let stderrBuffer = '';

    k6Process.stdout?.on('data', (data) => {
      const output = data.toString();
      stdoutBuffer += output;

      // Parse real-time metrics if available
      this.parseRealtimeOutput(output, runId);
    });

    k6Process.stderr?.on('data', (data) => {
      const output = data.toString();
      stderrBuffer += output;
      logger.warn('k6 stderr output', { runId, output });
    });

    k6Process.on('close', (code, signal) => {
      logger.info('k6 process closed', { runId, code, signal });

      testResult.exitCode = code || 0;
      testResult.endTime = new Date();
      testResult.duration = testResult.endTime.getTime() - testResult.startTime.getTime();

      if (code === 0) {
        testResult.status = 'completed';
        this.parseResults(runId, testResult);
      } else {
        testResult.status = 'failed';
        testResult.error = `k6 process exited with code ${code}`;
        if (stderrBuffer) {
          testResult.errorDetails = stderrBuffer;
        }
      }

      this.runningTests.delete(runId);

      // Emit completion event
      this.emit('testCompleted', {
        type: 'complete',
        runId,
        timestamp: new Date(),
        data: { result: testResult, code, signal }
      } as K6ExecutionEvent);

      logger.info('k6 load test completed', {
        runId,
        status: testResult.status,
        duration: testResult.duration
      });
    });

    k6Process.on('error', (error) => {
      logger.error('k6 process error', { runId, error });

      testResult.status = 'failed';
      testResult.error = error.message;
      testResult.endTime = new Date();
      testResult.duration = testResult.endTime.getTime() - testResult.startTime.getTime();

      this.runningTests.delete(runId);

      this.emit('testFailed', {
        type: 'error',
        runId,
        timestamp: new Date(),
        data: { error: error.message }
      } as K6ExecutionEvent);
    });
  }

  private parseRealtimeOutput(output: string, runId: string): void {
    // Parse k6 real-time output for progress updates
    // k6 outputs progress in various formats, we'll look for common patterns

    const lines = output.split('\n');
    for (const line of lines) {
      if (line.includes('vus:') && line.includes('reqs:')) {
        // Parse current metrics line
        try {
          const metrics: Partial<K6RuntimeMetrics> = {
            runId,
            timestamp: new Date()
          };

          // Extract VUs
          const vusMatch = line.match(/vus:\s*(\d+)/);
          if (vusMatch) {
            metrics.vus = parseInt(vusMatch[1], 10);
          }

          // Extract iterations/requests
          const reqsMatch = line.match(/reqs:\s*(\d+)/);
          if (reqsMatch) {
            metrics.http_reqs = parseInt(reqsMatch[1], 10);
          }

          this.emit('metrics', {
            type: 'metric',
            runId,
            timestamp: new Date(),
            data: metrics
          } as K6ExecutionEvent);

        } catch (error) {
          logger.debug('Failed to parse k6 real-time output', { runId, line, error });
        }
      }
    }
  }

  private async parseResults(runId: string, testResult: K6TestResult): Promise<void> {
    try {
      const summaryPath = path.join(this.resultsDir, `${runId}-summary.json`);
      const resultsPath = path.join(this.resultsDir, `${runId}.json`);

      // Parse summary results
      if (fs.existsSync(summaryPath)) {
        const summaryData = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
        testResult.metrics = this.extractMetrics(summaryData);
        testResult.thresholds = summaryData.thresholds;
      }

      testResult.resultsPath = resultsPath;
      testResult.outputPath = summaryPath;

      logger.debug('Parsed k6 test results', { runId, metrics: testResult.metrics });

    } catch (error) {
      logger.error('Failed to parse k6 results', { runId, error });
      testResult.error = `Failed to parse results: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private extractMetrics(summaryData: any): K6TestResult['metrics'] {
    const metrics: K6TestResult['metrics'] = {};

    if (summaryData.metrics) {
      const m = summaryData.metrics;

      // HTTP metrics
      if (m.http_reqs) {
        metrics.http_reqs = m.http_reqs.count;
        metrics.http_req_rate = m.http_reqs.rate;
      }

      if (m.http_req_duration) {
        metrics.http_req_duration = {
          avg: m.http_req_duration.avg,
          min: m.http_req_duration.min,
          med: m.http_req_duration.med,
          max: m.http_req_duration.max,
          p90: m.http_req_duration['p(90)'],
          p95: m.http_req_duration['p(95)'],
          p99: m.http_req_duration['p(99)']
        };
      }

      if (m.http_req_failed) {
        metrics.http_req_failed = m.http_req_failed.rate;
      }

      // VU metrics
      if (m.vus) {
        metrics.vus = m.vus.value;
      }
      if (m.vus_max) {
        metrics.vus_max = m.vus_max.value;
      }

      // Iteration metrics
      if (m.iterations) {
        metrics.iterations = m.iterations.count;
      }
      if (m.iteration_duration) {
        metrics.iteration_duration = {
          avg: m.iteration_duration.avg,
          min: m.iteration_duration.min,
          med: m.iteration_duration.med,
          max: m.iteration_duration.max
        };
      }

      // Data metrics
      if (m.data_received) {
        metrics.data_received = m.data_received.count;
      }
      if (m.data_sent) {
        metrics.data_sent = m.data_sent.count;
      }
    }

    return metrics;
  }

  /**
   * Get test result by run ID
   */
  getTestResult(runId: string): K6TestResult | null {
    return this.testResults.get(runId) || null;
  }

  /**
   * Get all running tests
   */
  getAllRunningTests(): K6TestResult[] {
    return Array.from(this.testResults.values()).filter(result => result.status === 'running');
  }

  /**
   * Cancel a running test
   */
  async cancelTest(runId: string): Promise<boolean> {
    const process = this.runningTests.get(runId);
    const testResult = this.testResults.get(runId);

    if (!process || !testResult) {
      return false;
    }

    try {
      process.kill('SIGTERM');

      testResult.status = 'cancelled';
      testResult.endTime = new Date();
      testResult.duration = testResult.endTime.getTime() - testResult.startTime.getTime();

      this.runningTests.delete(runId);

      logger.info('k6 test cancelled', { runId });

      this.emit('testCancelled', {
        type: 'complete',
        runId,
        timestamp: new Date(),
        data: { status: 'cancelled' }
      } as K6ExecutionEvent);

      return true;
    } catch (error) {
      logger.error('Failed to cancel k6 test', { runId, error });
      return false;
    }
  }

  /**
   * Save a test script
   */
  async saveScript(script: Omit<K6TestScript, 'id' | 'createdAt' | 'updatedAt'>): Promise<K6TestScript> {
    const scriptObj: K6TestScript = {
      ...script,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const scriptPath = path.join(this.scriptsDir, `${scriptObj.id}.json`);
    fs.writeFileSync(scriptPath, JSON.stringify(scriptObj, null, 2));

    // Also save the JavaScript content separately
    const jsPath = path.join(this.scriptsDir, `${scriptObj.id}.js`);
    fs.writeFileSync(jsPath, scriptObj.content);

    logger.info('k6 script saved', { scriptId: scriptObj.id, name: scriptObj.name });

    return scriptObj;
  }

  /**
   * Get all saved scripts
   */
  getScripts(): K6TestScript[] {
    const scripts: K6TestScript[] = [];

    if (!fs.existsSync(this.scriptsDir)) {
      return scripts;
    }

    const files = fs.readdirSync(this.scriptsDir).filter(file => file.endsWith('.json'));

    for (const file of files) {
      try {
        const scriptPath = path.join(this.scriptsDir, file);
        const scriptData = JSON.parse(fs.readFileSync(scriptPath, 'utf-8'));
        scripts.push(scriptData);
      } catch (error) {
        logger.warn(`Failed to parse script file ${file}`, { error });
      }
    }

    return scripts.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  /**
   * Get script templates
   */
  getTemplates(): K6ScriptTemplate[] {
    const templates: K6ScriptTemplate[] = [];

    if (!fs.existsSync(this.templatesDir)) {
      return templates;
    }

    const files = fs.readdirSync(this.templatesDir).filter(file => file.endsWith('.json'));

    for (const file of files) {
      try {
        const templatePath = path.join(this.templatesDir, file);
        const templateData = JSON.parse(fs.readFileSync(templatePath, 'utf-8'));
        templates.push(templateData);
      } catch (error) {
        logger.warn(`Failed to parse template file ${file}`, { error });
      }
    }

    return templates;
  }

  /**
   * Get predefined load test scenarios
   */
  getScenarios(): LoadTestScenario[] {
    return [
      {
        name: 'Load Test',
        type: 'load',
        description: 'Normal expected load to test typical performance',
        stages: [
          { duration: '5m', target: 10, name: 'Ramp-up' },
          { duration: '10m', target: 10, name: 'Stay at load' },
          { duration: '5m', target: 0, name: 'Ramp-down' }
        ],
        thresholds: {
          'http_req_duration': ['p(95)<500'],
          'http_req_failed': ['rate<0.1']
        }
      },
      {
        name: 'Stress Test',
        type: 'stress',
        description: 'Beyond normal capacity to find breaking point',
        stages: [
          { duration: '10m', target: 10, name: 'Normal load' },
          { duration: '15m', target: 20, name: 'Stress level 1' },
          { duration: '15m', target: 30, name: 'Stress level 2' },
          { duration: '15m', target: 40, name: 'Stress level 3' },
          { duration: '10m', target: 0, name: 'Recovery' }
        ],
        thresholds: {
          'http_req_duration': ['p(95)<1000'],
          'http_req_failed': ['rate<0.2']
        }
      },
      {
        name: 'Spike Test',
        type: 'spike',
        description: 'Sudden dramatic increase in load',
        stages: [
          { duration: '2m', target: 10, name: 'Normal load' },
          { duration: '1m', target: 100, name: 'Spike!' },
          { duration: '2m', target: 10, name: 'Recovery' }
        ],
        thresholds: {
          'http_req_duration': ['p(95)<2000'],
          'http_req_failed': ['rate<0.3']
        }
      }
    ];
  }

  /**
   * Health check for k6 installation
   */
  async healthCheck(): Promise<{ healthy: boolean; version?: string; error?: string }> {
    try {
      return new Promise((resolve) => {
        const k6Process = spawn(this.k6BinaryPath, ['version'], { timeout: 5000 });

        let output = '';
        k6Process.stdout?.on('data', (data) => {
          output += data.toString();
        });

        k6Process.on('close', (code) => {
          if (code === 0) {
            const versionMatch = output.match(/k6 v([^\s]+)/);
            resolve({
              healthy: true,
              version: versionMatch ? versionMatch[1] : 'unknown'
            });
          } else {
            resolve({
              healthy: false,
              error: `k6 process exited with code ${code}`
            });
          }
        });

        k6Process.on('error', (error) => {
          resolve({
            healthy: false,
            error: error.message
          });
        });
      });
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Export singleton instance
export const k6Executor = new K6LoadTestExecutor();