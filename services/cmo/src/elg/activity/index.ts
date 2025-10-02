/**
 * ActivityClient Implementation
 * Enforces determinism by recording all I/O operations
 * Supports record/replay/live modes for time-travel debugging
 */

import { createHash, randomBytes } from 'crypto';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import type { Checkpointer } from '../checkpointer/index.js';
import { ActivityClient, ActivityMode } from '../activity.js';
import pino from 'pino';

/**
 * Activity record stored in checkpointer
 */
export interface ActivityRecord {
  activityType: string;
  requestHash: string;
  requestData: unknown;
  responseData?: unknown;
  responseBlobRef?: string;
  timestamp: string;
  durationMs?: number;
  error?: { message: string; stack?: string };
}

/**
 * S3 configuration
 */
export interface S3Config {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  forcePathStyle?: boolean;
}

/**
 * ActivityClient configuration
 */
export interface ActivityClientConfig {
  mode: ActivityMode;
  traceId: string;
  checkpointer: Checkpointer;
  s3?: S3Config;
  logger?: pino.Logger;

  /**
   * For replay mode: pre-loaded activities
   */
  replayActivities?: ActivityRecord[];

  /**
   * For deterministic time in record mode
   */
  baseTimestamp?: string;

  /**
   * For deterministic randomness
   */
  randomSeed?: number;

  /**
   * Max size for inline storage (larger goes to S3)
   */
  maxInlineSize?: number;
}

/**
 * ActivityClientImpl enforces all I/O through activities
 * - RECORD mode: execute and save all activities
 * - REPLAY mode: return saved responses without executing
 * - LIVE mode: execute without saving (for production)
 */
export class ActivityClientImpl implements ActivityClient {
  private mode: ActivityMode;
  private traceId: string;
  private checkpointer: Checkpointer;
  private s3Client?: S3Client;
  private s3BucketName?: string;
  private logger: pino.Logger;

  private currentStepIndex: number = 0;
  private activityIndexWithinStep: number = 0;

  // For replay mode
  private replayActivities: Map<string, ActivityRecord> = new Map();
  private replayIndex: number = 0;

  // For deterministic time
  private baseTime: Date;
  private virtualTimeOffset: number = 0;

  // For deterministic randomness
  private rng: SeededRNG;

  private maxInlineSize: number;

  constructor(config: ActivityClientConfig) {
    this.mode = config.mode;
    this.traceId = config.traceId;
    this.checkpointer = config.checkpointer;
    this.logger = config.logger || pino({ name: 'activity-client' });
    this.maxInlineSize = config.maxInlineSize || 1024 * 100; // 100KB default

    // Initialize S3 if configured
    if (config.s3) {
      this.s3Client = new S3Client({
        endpoint: config.s3.endpoint,
        region: config.s3.region,
        credentials: {
          accessKeyId: config.s3.accessKeyId,
          secretAccessKey: config.s3.secretAccessKey,
        },
        forcePathStyle: config.s3.forcePathStyle ?? true,
      });
      this.s3BucketName = config.s3.bucketName;
    }

    // Initialize time
    this.baseTime = config.baseTimestamp
      ? new Date(config.baseTimestamp)
      : new Date();

    // Initialize RNG
    this.rng = new SeededRNG(config.randomSeed || Date.now());

    // Load replay activities
    if (config.mode === ActivityMode.REPLAY && config.replayActivities) {
      for (const activity of config.replayActivities) {
        const key = this.makeActivityKey(activity.activityType, activity.requestHash);
        this.replayActivities.set(key, activity);
      }
    }
  }

  /**
   * Get current execution mode
   */
  getMode(): ActivityMode {
    return this.mode;
  }

  /**
   * Get current step index
   */
  getCurrentStepIndex(): number {
    return this.currentStepIndex;
  }

  /**
   * Increment step index (called by runtime after each node)
   */
  incrementStepIndex(): void {
    this.currentStepIndex++;
    this.activityIndexWithinStep = 0;
  }

  /**
   * Flush any pending activities
   */
  async flush(): Promise<void> {
    // Currently no-op; could batch writes here
    this.logger.debug({ traceId: this.traceId, step: this.currentStepIndex }, 'Flushed activities');
  }

  /**
   * Send Agent-to-Agent message
   */
  async sendA2A(envelope: unknown): Promise<unknown> {
    return this.executeActivity('a2a', envelope, async (req) => {
      // In reality, would publish to transport and wait for response
      // For now, return mock response
      this.logger.info({ envelope }, 'Sending A2A message');
      return { status: 'acknowledged', correlationId: (req as any).meta?.correlationId };
    });
  }

  /**
   * Call MCP tool
   */
  async callMCP(tool: string, args: unknown): Promise<unknown> {
    return this.executeActivity('mcp', { tool, args }, async (req) => {
      // In reality, would call MCP server
      this.logger.info({ tool, args }, 'Calling MCP tool');
      throw new Error(`MCP integration not yet implemented: ${tool}`);
    });
  }

  /**
   * Read artifact from S3
   */
  async readArtifact(ref: string): Promise<{ size: number; hash: string }> {
    return this.executeActivity('artifact-read', { ref }, async (req) => {
      if (!this.s3Client || !this.s3BucketName) {
        throw new Error('S3 not configured');
      }

      const command = new GetObjectCommand({
        Bucket: this.s3BucketName,
        Key: ref,
      });

      const response = await this.s3Client.send(command);
      const bodyBytes = await response.Body!.transformToByteArray();

      const hash = createHash('sha256').update(bodyBytes).digest('hex');

      return { size: bodyBytes.length, hash };
    });
  }

  /**
   * Write artifact to S3
   */
  async writeArtifact(data: Buffer | string, metadata?: any): Promise<string> {
    return this.executeActivity('artifact-write', { metadata, size: data.length }, async (req) => {
      if (!this.s3Client || !this.s3BucketName) {
        throw new Error('S3 not configured');
      }

      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8');
      const hash = createHash('sha256').update(buffer).digest('hex');
      const key = `${this.traceId}/${this.currentStepIndex}/${hash}`;

      const command = new PutObjectCommand({
        Bucket: this.s3BucketName,
        Key: key,
        Body: buffer,
        Metadata: metadata,
      });

      await this.s3Client.send(command);

      this.logger.info({ key, size: buffer.length }, 'Wrote artifact to S3');
      return key;
    });
  }

  /**
   * Get current time (virtual in record/replay modes)
   */
  async now(): Promise<string> {
    return this.executeActivity('time', {}, async () => {
      const virtualTime = new Date(this.baseTime.getTime() + this.virtualTimeOffset);
      this.virtualTimeOffset += 1; // Increment by 1ms for each call
      return virtualTime.toISOString();
    });
  }

  /**
   * Get random number (deterministic in record/replay modes)
   */
  async rand(max: number): Promise<number> {
    return this.executeActivity('random', { max }, async (req) => {
      return this.rng.next(max);
    });
  }

  /**
   * Make HTTP request
   */
  async httpRequest(url: string, options?: any): Promise<any> {
    return this.executeActivity('http', { url, options }, async (req) => {
      const { url, options } = req as { url: string; options?: any };

      // Use fetch (available in Node 18+)
      const response = await fetch(url, options);
      const body = await response.text();

      return {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body,
      };
    });
  }

  /**
   * Execute database query
   */
  async databaseQuery(query: string, params?: unknown[]): Promise<unknown> {
    return this.executeActivity('database', { query, params }, async (req) => {
      // In reality, would execute against a connection pool
      this.logger.warn({ query }, 'Database query not yet implemented');
      throw new Error('Database query integration not yet implemented');
    });
  }

  /**
   * Core activity execution logic
   * - RECORD: execute and save
   * - REPLAY: return saved response
   * - LIVE: execute without saving
   */
  private async executeActivity<T>(
    activityType: string,
    request: unknown,
    executor: (req: unknown) => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    const requestHash = this.hashRequest(request);
    const activityKey = this.makeActivityKey(activityType, requestHash);

    // REPLAY mode: return saved response
    if (this.mode === ActivityMode.REPLAY) {
      const saved = this.replayActivities.get(activityKey);
      if (!saved) {
        throw new Error(
          `Replay failed: activity not found (type=${activityType}, hash=${requestHash})`
        );
      }

      this.logger.debug({ activityType, requestHash }, 'Replaying activity');

      if (saved.error) {
        throw new Error(saved.error.message);
      }

      // Load from S3 if blob ref
      if (saved.responseBlobRef) {
        const artifact = await this.loadFromS3(saved.responseBlobRef);
        return artifact as T;
      }

      return saved.responseData as T;
    }

    // RECORD or LIVE mode: execute
    let response: T;
    let error: Error | undefined;

    try {
      response = await executor(request);
    } catch (err) {
      error = err as Error;
      throw err;
    } finally {
      const durationMs = Date.now() - startTime;

      // Save in RECORD mode
      if (this.mode === ActivityMode.RECORD) {
        await this.saveActivity({
          activityType,
          requestHash,
          requestData: request,
          responseData: error ? undefined : response,
          timestamp: new Date().toISOString(),
          durationMs,
          error: error ? { message: error.message, stack: error.stack } : undefined,
        });
      }
    }

    return response!;
  }

  /**
   * Save activity to checkpointer
   */
  private async saveActivity(activity: ActivityRecord): Promise<void> {
    const { activityType, requestHash, requestData, responseData, timestamp, durationMs, error } = activity;

    // Check if response is too large for inline storage
    let responseBlobRef: string | undefined;
    let finalResponseData = responseData;

    if (responseData && !error) {
      const size = JSON.stringify(responseData).length;
      if (size > this.maxInlineSize && this.s3Client && this.s3BucketName) {
        // Store in S3
        const buffer = Buffer.from(JSON.stringify(responseData), 'utf-8');
        responseBlobRef = await this.writeToS3(buffer);
        finalResponseData = undefined; // Don't store inline
        this.logger.debug({ size, ref: responseBlobRef }, 'Stored large response in S3');
      }
    }

    await this.checkpointer.saveActivity(
      this.traceId,
      this.currentStepIndex,
      activityType,
      requestHash,
      requestData,
      finalResponseData,
      responseBlobRef,
      timestamp,
      durationMs,
      error
    );

    this.activityIndexWithinStep++;
  }

  /**
   * Write data to S3
   */
  private async writeToS3(data: Buffer): Promise<string> {
    if (!this.s3Client || !this.s3BucketName) {
      throw new Error('S3 not configured');
    }

    const hash = createHash('sha256').update(data).digest('hex');
    const key = `${this.traceId}/activities/${this.currentStepIndex}/${hash}`;

    const command = new PutObjectCommand({
      Bucket: this.s3BucketName,
      Key: key,
      Body: data,
    });

    await this.s3Client.send(command);
    return key;
  }

  /**
   * Load data from S3
   */
  private async loadFromS3(key: string): Promise<unknown> {
    if (!this.s3Client || !this.s3BucketName) {
      throw new Error('S3 not configured');
    }

    const command = new GetObjectCommand({
      Bucket: this.s3BucketName,
      Key: key,
    });

    const response = await this.s3Client.send(command);
    const bodyBytes = await response.Body!.transformToByteArray();
    const text = Buffer.from(bodyBytes).toString('utf-8');

    return JSON.parse(text);
  }

  /**
   * Hash request for idempotency
   */
  private hashRequest(request: unknown): string {
    const json = JSON.stringify(request, Object.keys(request as any).sort());
    return createHash('sha256').update(json).digest('hex').substring(0, 16);
  }

  /**
   * Make unique activity key
   */
  private makeActivityKey(activityType: string, requestHash: string): string {
    return `${activityType}:${requestHash}`;
  }
}

/**
 * Seeded RNG for deterministic randomness
 */
class SeededRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  /**
   * Generate next random number [0, max)
   * Using a simple LCG (Linear Congruential Generator)
   */
  next(max: number): number {
    // LCG parameters (from Numerical Recipes)
    const a = 1664525;
    const c = 1013904223;
    const m = 2 ** 32;

    this.state = (a * this.state + c) % m;

    // Map to [0, max)
    return Math.floor((this.state / m) * max);
  }
}
