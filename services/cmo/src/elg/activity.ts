/**
 * Activity Client Interface
 * ALL external I/O must go through this interface to enable record/replay
 * This enforces the activity boundary for deterministic execution
 */

/**
 * Activity types for recording
 */
export enum ActivityType {
  SEND_A2A = 'send_a2a',
  CALL_MCP = 'call_mcp',
  READ_ARTIFACT = 'read_artifact',
  WRITE_ARTIFACT = 'write_artifact',
  NOW = 'now',
  RAND = 'rand',
  HTTP_REQUEST = 'http_request',
  DATABASE_QUERY = 'database_query',
}

/**
 * Activity record for replay
 */
export interface ActivityRecord {
  /**
   * Activity ID (unique per execution)
   */
  id: string;

  /**
   * Trace ID
   */
  traceId: string;

  /**
   * Step index when activity occurred
   */
  stepIndex: number;

  /**
   * Activity type
   */
  type: ActivityType;

  /**
   * Request data (hashed for deduplication)
   */
  requestHash: string;

  /**
   * Request data (full, for replay)
   */
  request: unknown;

  /**
   * Response data
   */
  response: unknown;

  /**
   * Response blob reference (if large)
   * Points to S3 object key
   */
  responseBlobRef?: string;

  /**
   * Timestamp when activity was recorded
   */
  timestamp: string;

  /**
   * Duration in milliseconds
   */
  duration: number;

  /**
   * Error (if activity failed)
   */
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
}

/**
 * Mode for activity client
 */
export enum ActivityMode {
  /**
   * Record all activities to enable replay
   */
  RECORD = 'record',

  /**
   * Replay from recorded activities
   */
  REPLAY = 'replay',

  /**
   * Live execution without recording
   */
  LIVE = 'live',
}

/**
 * Activity Client Configuration
 */
export interface ActivityClientConfig {
  /**
   * Execution mode
   */
  mode: ActivityMode;

  /**
   * Trace ID
   */
  traceId: string;

  /**
   * Activity storage (for record/replay)
   */
  storage?: ActivityStorage;

  /**
   * Transport adapter (for A2A messaging)
   */
  transport?: unknown; // TransportAdapter (defined later)

  /**
   * S3 client (for artifacts)
   */
  s3Client?: unknown; // S3Client

  /**
   * Activity timeout in milliseconds
   */
  timeout?: number;
}

/**
 * Activity storage interface
 */
export interface ActivityStorage {
  /**
   * Save activity record
   */
  save(record: ActivityRecord): Promise<void>;

  /**
   * Get activity by request hash (for idempotency)
   */
  getByRequestHash(
    traceId: string,
    stepIndex: number,
    type: ActivityType,
    requestHash: string
  ): Promise<ActivityRecord | null>;

  /**
   * Get all activities for a trace
   */
  getByTrace(traceId: string): Promise<ActivityRecord[]>;

  /**
   * Get activities for a specific step
   */
  getByStep(traceId: string, stepIndex: number): Promise<ActivityRecord[]>;
}

/**
 * Activity Client
 * Enforces activity boundary and enables record/replay
 */
export interface ActivityClient {
  /**
   * Send Agent-to-Agent (A2A) message
   * Records the envelope and response for replay
   *
   * @param envelope - Message envelope to send
   * @returns Response envelope
   */
  sendA2A(envelope: unknown): Promise<unknown>;

  /**
   * Call MCP (Model Context Protocol) tool
   * Records the tool call and result for replay
   *
   * @param tool - Tool name
   * @param args - Tool arguments
   * @returns Tool result
   */
  callMCP(tool: string, args: unknown): Promise<unknown>;

  /**
   * Read artifact from S3
   * Records metadata (size, hash) for determinism
   *
   * @param ref - S3 object key or reference
   * @returns Artifact metadata
   */
  readArtifact(ref: string): Promise<{
    size: number;
    hash: string;
    contentType?: string;
  }>;

  /**
   * Write artifact to S3
   * Records the S3 key for replay
   *
   * @param data - Artifact data
   * @param metadata - Optional metadata
   * @returns S3 object key
   */
  writeArtifact(
    data: Buffer | string,
    metadata?: {
      contentType?: string;
      tags?: Record<string, string>;
    }
  ): Promise<string>;

  /**
   * Get current time (virtual clock for determinism)
   * Records the timestamp for replay
   *
   * @returns ISO 8601 timestamp
   */
  now(): Promise<string>;

  /**
   * Generate random number (seeded for determinism)
   * Records the value for replay
   *
   * @param max - Maximum value (exclusive)
   * @returns Random integer [0, max)
   */
  rand(max: number): Promise<number>;

  /**
   * Make HTTP request (recorded)
   *
   * @param url - Request URL
   * @param options - Request options
   * @returns Response
   */
  httpRequest(
    url: string,
    options?: {
      method?: string;
      headers?: Record<string, string>;
      body?: unknown;
    }
  ): Promise<{
    status: number;
    headers: Record<string, string>;
    body: unknown;
  }>;

  /**
   * Execute database query (recorded)
   * NOTE: For checkpointer only - nodes should NOT access DB directly
   *
   * @param query - SQL query
   * @param params - Query parameters
   * @returns Query result
   */
  databaseQuery(query: string, params?: unknown[]): Promise<unknown>;

  /**
   * Get current step index
   */
  getCurrentStepIndex(): number;

  /**
   * Increment step index (called by runtime)
   */
  incrementStepIndex(): void;

  /**
   * Get activity mode
   */
  getMode(): ActivityMode;

  /**
   * Flush pending activities (for batch storage)
   */
  flush(): Promise<void>;
}

/**
 * Activity Client Factory
 */
export interface ActivityClientFactory {
  /**
   * Create activity client for a new execution
   */
  create(config: ActivityClientConfig): ActivityClient;
}

/**
 * Utility: Hash request for deduplication
 */
export function hashRequest(request: unknown): string {
  // Simple JSON stringification + SHA-256 hash
  // Will be implemented in actual file
  return '';
}

/**
 * Utility: Check if current code is running inside an activity
 * Throws error if called outside activity boundary
 */
export function ensureActivity(): void {
  // Check if ActivityClient is in context
  // Will be implemented with async local storage
}
