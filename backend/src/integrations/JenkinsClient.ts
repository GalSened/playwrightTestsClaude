/**
 * Jenkins API Client
 * Secure integration with Jenkins for CI/CD pipeline automation
 * Handles authentication, job management, and build monitoring
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import * as crypto from 'crypto';
import { logger } from '../utils/logger';
import { CIJenkinsError } from '../models/CI';

// ===============================
// INTERFACES
// ===============================

export interface JenkinsConfig {
  url: string;
  username: string;
  token: string; // API token or password
  timeout?: number;
  retryAttempts?: number;
}

export interface JenkinsJob {
  name: string;
  url: string;
  description?: string;
  buildable: boolean;
  color: string; // Jenkins color code (blue, red, yellow, etc.)
  lastBuild?: JenkinsBuild;
  lastSuccessfulBuild?: JenkinsBuild;
  lastFailedBuild?: JenkinsBuild;
  healthReport?: JenkinsHealthReport[];
}

export interface JenkinsBuild {
  number: number;
  url: string;
  result?: string; // SUCCESS, FAILURE, UNSTABLE, ABORTED
  building: boolean;
  duration: number;
  estimatedDuration: number;
  timestamp: number;
  description?: string;
  displayName: string;
  queueId?: number;
  actions?: any[];
}

export interface JenkinsHealthReport {
  description: string;
  iconClassName: string;
  iconUrl: string;
  score: number;
}

export interface JenkinsQueue {
  items: JenkinsQueueItem[];
}

export interface JenkinsQueueItem {
  id: number;
  task: {
    name: string;
    url: string;
  };
  stuck: boolean;
  blocked: boolean;
  buildable: boolean;
  params?: string;
  why?: string;
  inQueueSince: number;
}

export interface JenkinsTriggerResult {
  queueId: number;
  location: string;
  job: string;
  parameters?: Record<string, any>;
}

export interface JenkinsConsoleLog {
  text: string;
  hasMore: boolean;
  size: number;
}

export interface JenkinsArtifact {
  displayPath: string;
  fileName: string;
  relativePath: string;
  size: number;
}

export interface JenkinsTestResult {
  failCount: number;
  passCount: number;
  skipCount: number;
  totalCount: number;
  urlName: string;
  suites: JenkinsTestSuite[];
}

export interface JenkinsTestSuite {
  name: string;
  duration: number;
  cases: JenkinsTestCase[];
}

export interface JenkinsTestCase {
  name: string;
  className: string;
  duration: number;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  errorDetails?: string;
  errorStackTrace?: string;
}

// ===============================
// JENKINS CLIENT
// ===============================

export class JenkinsClient {
  private client: AxiosInstance;
  private config: JenkinsConfig;
  private encryptionKey: string;

  constructor(config?: Partial<JenkinsConfig>) {
    this.config = {
      url: process.env.CI_JENKINS_URL || 'http://localhost:8080',
      username: process.env.CI_JENKINS_USER || '',
      token: process.env.CI_JENKINS_TOKEN || '',
      timeout: 30000,
      retryAttempts: 3,
      ...config
    };

    // Generate encryption key for storing credentials
    this.encryptionKey = process.env.JENKINS_ENCRYPTION_KEY || this.generateEncryptionKey();

    this.client = axios.create({
      baseURL: this.config.url,
      timeout: this.config.timeout,
      auth: {
        username: this.config.username,
        password: this.config.token
      },
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    this.setupInterceptors();
    logger.info('Jenkins client initialized', {
      url: this.config.url,
      username: this.config.username,
      timeout: this.config.timeout
    });
  }

  private generateEncryptionKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private setupInterceptors(): void {
    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('Jenkins API request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          params: config.params
        });
        return config;
      },
      (error) => {
        logger.error('Jenkins API request error', { error });
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('Jenkins API response', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        const errorMessage = error.response?.data?.message || error.message;
        const statusCode = error.response?.status;

        logger.error('Jenkins API response error', {
          error: errorMessage,
          status: statusCode,
          url: error.config?.url
        });

        throw new CIJenkinsError(`Jenkins API error: ${errorMessage}`, {
          status: statusCode,
          url: error.config?.url,
          response: error.response?.data
        });
      }
    );
  }

  // ===============================
  // CREDENTIAL MANAGEMENT
  // ===============================

  private encryptCredentials(credentials: string): string {
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    let encrypted = cipher.update(credentials, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  private decryptCredentials(encryptedCredentials: string): string {
    const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
    let decrypted = decipher.update(encryptedCredentials, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  public updateCredentials(username: string, token: string): void {
    this.config.username = username;
    this.config.token = token;

    this.client.defaults.auth = {
      username,
      password: token
    };

    logger.info('Jenkins credentials updated', { username });
  }

  // ===============================
  // CONNECTION TESTING
  // ===============================

  public async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/json');
      return response.status === 200;
    } catch (error) {
      logger.error('Jenkins connection test failed', { error });
      return false;
    }
  }

  public async getServerInfo(): Promise<any> {
    try {
      const response = await this.client.get('/api/json');
      return response.data;
    } catch (error) {
      throw new CIJenkinsError('Failed to get Jenkins server info', error);
    }
  }

  // ===============================
  // JOB MANAGEMENT
  // ===============================

  public async getJobs(): Promise<JenkinsJob[]> {
    try {
      const response = await this.client.get('/api/json?tree=jobs[name,url,description,buildable,color,lastBuild[number,url,result,building,duration,timestamp,displayName],lastSuccessfulBuild[number,url,result,building,duration,timestamp,displayName],lastFailedBuild[number,url,result,building,duration,timestamp,displayName],healthReport[description,iconClassName,iconUrl,score]]');

      return response.data.jobs || [];
    } catch (error) {
      throw new CIJenkinsError('Failed to get Jenkins jobs', error);
    }
  }

  public async getJob(jobName: string): Promise<JenkinsJob> {
    try {
      const encodedJobName = encodeURIComponent(jobName);
      const response = await this.client.get(`/job/${encodedJobName}/api/json?tree=name,url,description,buildable,color,lastBuild[number,url,result,building,duration,timestamp,displayName,queueId,actions],lastSuccessfulBuild[number,url,result,building,duration,timestamp,displayName],lastFailedBuild[number,url,result,building,duration,timestamp,displayName],healthReport[description,iconClassName,iconUrl,score]`);

      return response.data;
    } catch (error) {
      throw new CIJenkinsError(`Failed to get Jenkins job: ${jobName}`, error);
    }
  }

  public async triggerJob(jobName: string, parameters?: Record<string, any>): Promise<JenkinsTriggerResult> {
    try {
      const encodedJobName = encodeURIComponent(jobName);
      let url = `/job/${encodedJobName}`;

      if (parameters && Object.keys(parameters).length > 0) {
        url += '/buildWithParameters';

        const response = await this.client.post(url, null, {
          params: parameters,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });

        // Extract queue ID from Location header
        const location = response.headers.location;
        const queueId = this.extractQueueIdFromLocation(location);

        return {
          queueId,
          location,
          job: jobName,
          parameters
        };
      } else {
        url += '/build';

        const response = await this.client.post(url);

        const location = response.headers.location;
        const queueId = this.extractQueueIdFromLocation(location);

        return {
          queueId,
          location,
          job: jobName
        };
      }
    } catch (error) {
      throw new CIJenkinsError(`Failed to trigger Jenkins job: ${jobName}`, error);
    }
  }

  private extractQueueIdFromLocation(location: string): number {
    const matches = location.match(/\/queue\/item\/(\d+)\//);
    return matches ? parseInt(matches[1], 10) : 0;
  }

  public async stopBuild(jobName: string, buildNumber: number): Promise<boolean> {
    try {
      const encodedJobName = encodeURIComponent(jobName);
      await this.client.post(`/job/${encodedJobName}/${buildNumber}/stop`);
      return true;
    } catch (error) {
      throw new CIJenkinsError(`Failed to stop Jenkins build: ${jobName}#${buildNumber}`, error);
    }
  }

  // ===============================
  // BUILD MONITORING
  // ===============================

  public async getBuild(jobName: string, buildNumber: number): Promise<JenkinsBuild> {
    try {
      const encodedJobName = encodeURIComponent(jobName);
      const response = await this.client.get(`/job/${encodedJobName}/${buildNumber}/api/json`);

      return response.data;
    } catch (error) {
      throw new CIJenkinsError(`Failed to get Jenkins build: ${jobName}#${buildNumber}`, error);
    }
  }

  public async getLastBuild(jobName: string): Promise<JenkinsBuild | null> {
    try {
      const job = await this.getJob(jobName);
      return job.lastBuild || null;
    } catch (error) {
      throw new CIJenkinsError(`Failed to get last build for job: ${jobName}`, error);
    }
  }

  public async isBuildCompleted(jobName: string, buildNumber: number): Promise<boolean> {
    try {
      const build = await this.getBuild(jobName, buildNumber);
      return !build.building && build.result !== null;
    } catch (error) {
      logger.warn('Failed to check build completion status', { error, jobName, buildNumber });
      return false;
    }
  }

  public async waitForBuildCompletion(
    jobName: string,
    buildNumber: number,
    options: { timeout?: number; pollInterval?: number } = {}
  ): Promise<JenkinsBuild> {
    const timeout = options.timeout || 600000; // 10 minutes default
    const pollInterval = options.pollInterval || 5000; // 5 seconds default
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const build = await this.getBuild(jobName, buildNumber);

        if (!build.building && build.result !== null) {
          return build;
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        logger.warn('Error polling build status', { error, jobName, buildNumber });
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    throw new CIJenkinsError(`Timeout waiting for build completion: ${jobName}#${buildNumber}`);
  }

  // ===============================
  // CONSOLE LOGS
  // ===============================

  public async getConsoleLog(jobName: string, buildNumber: number, start: number = 0): Promise<JenkinsConsoleLog> {
    try {
      const encodedJobName = encodeURIComponent(jobName);
      const response = await this.client.get(`/job/${encodedJobName}/${buildNumber}/logText/progressiveText`, {
        params: { start },
        headers: {
          'Accept': 'text/plain'
        },
        responseType: 'text'
      });

      const hasMore = response.headers['x-more-data'] === 'true';
      const size = parseInt(response.headers['x-text-size'] || '0', 10);

      return {
        text: response.data,
        hasMore,
        size
      };
    } catch (error) {
      throw new CIJenkinsError(`Failed to get console log: ${jobName}#${buildNumber}`, error);
    }
  }

  public async getFullConsoleLog(jobName: string, buildNumber: number): Promise<string> {
    try {
      const encodedJobName = encodeURIComponent(jobName);
      const response = await this.client.get(`/job/${encodedJobName}/${buildNumber}/consoleText`, {
        headers: {
          'Accept': 'text/plain'
        },
        responseType: 'text'
      });

      return response.data;
    } catch (error) {
      throw new CIJenkinsError(`Failed to get full console log: ${jobName}#${buildNumber}`, error);
    }
  }

  // ===============================
  // ARTIFACTS
  // ===============================

  public async getBuildArtifacts(jobName: string, buildNumber: number): Promise<JenkinsArtifact[]> {
    try {
      const build = await this.getBuild(jobName, buildNumber);
      return (build as any).artifacts || [];
    } catch (error) {
      throw new CIJenkinsError(`Failed to get build artifacts: ${jobName}#${buildNumber}`, error);
    }
  }

  public async downloadArtifact(jobName: string, buildNumber: number, artifactPath: string): Promise<Buffer> {
    try {
      const encodedJobName = encodeURIComponent(jobName);
      const encodedPath = encodeURIComponent(artifactPath);
      const response = await this.client.get(`/job/${encodedJobName}/${buildNumber}/artifact/${encodedPath}`, {
        responseType: 'arraybuffer'
      });

      return Buffer.from(response.data);
    } catch (error) {
      throw new CIJenkinsError(`Failed to download artifact: ${jobName}#${buildNumber}/${artifactPath}`, error);
    }
  }

  // ===============================
  // TEST RESULTS
  // ===============================

  public async getTestResults(jobName: string, buildNumber: number): Promise<JenkinsTestResult | null> {
    try {
      const encodedJobName = encodeURIComponent(jobName);
      const response = await this.client.get(`/job/${encodedJobName}/${buildNumber}/testReport/api/json`);

      return response.data;
    } catch (error) {
      // Test results might not exist for all builds
      if (error instanceof CIJenkinsError && error.details?.status === 404) {
        return null;
      }
      throw new CIJenkinsError(`Failed to get test results: ${jobName}#${buildNumber}`, error);
    }
  }

  // ===============================
  // QUEUE MANAGEMENT
  // ===============================

  public async getQueue(): Promise<JenkinsQueue> {
    try {
      const response = await this.client.get('/queue/api/json');
      return response.data;
    } catch (error) {
      throw new CIJenkinsError('Failed to get Jenkins queue', error);
    }
  }

  public async getQueueItem(queueId: number): Promise<JenkinsQueueItem | null> {
    try {
      const response = await this.client.get(`/queue/item/${queueId}/api/json`);
      return response.data;
    } catch (error) {
      if (error instanceof CIJenkinsError && error.details?.status === 404) {
        return null; // Queue item no longer exists (probably started building)
      }
      throw new CIJenkinsError(`Failed to get queue item: ${queueId}`, error);
    }
  }

  public async cancelQueueItem(queueId: number): Promise<boolean> {
    try {
      await this.client.post(`/queue/cancelItem?id=${queueId}`);
      return true;
    } catch (error) {
      throw new CIJenkinsError(`Failed to cancel queue item: ${queueId}`, error);
    }
  }

  // ===============================
  // UTILITY METHODS
  // ===============================

  public async getBuildNumberFromQueueId(queueId: number, timeout: number = 60000): Promise<number | null> {
    const startTime = Date.now();
    const pollInterval = 2000; // 2 seconds

    while (Date.now() - startTime < timeout) {
      try {
        const queueItem = await this.getQueueItem(queueId);

        if (!queueItem) {
          // Queue item no longer exists, it might have started building
          // We need to find the build number by checking recent builds
          return null;
        }

        if ((queueItem as any).executable) {
          return (queueItem as any).executable.number;
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        logger.warn('Error polling queue item', { error, queueId });
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    return null;
  }

  public sanitizeLogOutput(log: string): string {
    // Remove ANSI escape codes and other sensitive information
    return log
      .replace(/\u001b\[[0-9;]*m/g, '') // Remove ANSI escape codes
      .replace(/password=[\w-]+/gi, 'password=***') // Redact passwords
      .replace(/token=[\w-]+/gi, 'token=***') // Redact tokens
      .replace(/api[_-]?key=[\w-]+/gi, 'api_key=***'); // Redact API keys
  }

  // ===============================
  // HEALTH CHECK
  // ===============================

  public async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      const serverInfo = await this.getServerInfo();
      const jobs = await this.getJobs();

      return {
        healthy: true,
        details: {
          serverVersion: serverInfo.version,
          totalJobs: jobs.length,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      };
    }
  }
}

// Export singleton instance
export const jenkinsClient = new JenkinsClient();