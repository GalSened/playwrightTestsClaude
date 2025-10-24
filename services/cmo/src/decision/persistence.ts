/**
 * Grading Event Persistence
 *
 * PostgreSQL storage for grading decisions, scores, and audit trail.
 * Supports idempotency checks and historical queries.
 */

/**
 * Grading event record
 */
export interface GradingEvent {
  /**
   * Message ID (primary key)
   */
  message_id: string;

  /**
   * Trace ID for correlation across retries
   */
  trace_id: string;

  /**
   * Attempt number (0 = first attempt, 1 = first retry, etc.)
   */
  attempt_no: number;

  /**
   * Decision outcome
   */
  decision: 'ACCEPT' | 'RETRY' | 'ESCALATE';

  /**
   * QScore (calibrated)
   */
  qscore: number;

  /**
   * Classification and reasoning
   */
  reasons: {
    category?: string;
    confidence?: number;
    explanation?: string;
    signals?: Record<string, number>;
  };

  /**
   * Idempotency key for deduplication
   */
  idempotency_key: string;

  /**
   * Timestamp
   */
  created_at: Date;

  /**
   * Specialist ID that produced the result
   */
  specialist_id: string;

  /**
   * Optional: retry target specialist
   */
  retry_target_specialist?: string;
}

/**
 * Query filters
 */
export interface GradingEventQuery {
  trace_id?: string;
  message_id?: string;
  decision?: 'ACCEPT' | 'RETRY' | 'ESCALATE';
  specialist_id?: string;
  min_qscore?: number;
  max_qscore?: number;
  start_date?: Date;
  end_date?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Grading Event Store (interface)
 *
 * Abstract interface for persistence layer.
 * Implementations can use PG, in-memory, or other stores.
 */
export interface IGradingEventStore {
  /**
   * Record a grading event
   *
   * @param event - grading event to record
   * @throws IdempotencyViolationError if duplicate idempotency_key
   */
  record(event: GradingEvent): Promise<void>;

  /**
   * Check if idempotency key already exists
   *
   * @param idempotencyKey - key to check
   * @returns true if duplicate, false if new
   */
  isDuplicate(idempotencyKey: string): Promise<boolean>;

  /**
   * Get grading events by trace ID
   *
   * @param traceId - trace ID to query
   * @returns array of grading events (ordered by attempt_no ASC)
   */
  getByTraceId(traceId: string): Promise<GradingEvent[]>;

  /**
   * Get grading event by message ID
   *
   * @param messageId - message ID to query
   * @returns grading event or undefined
   */
  getByMessageId(messageId: string): Promise<GradingEvent | undefined>;

  /**
   * Query grading events with filters
   *
   * @param query - query filters
   * @returns array of matching grading events
   */
  query(query: GradingEventQuery): Promise<GradingEvent[]>;

  /**
   * Get latest attempt for trace ID
   *
   * @param traceId - trace ID
   * @returns latest grading event or undefined
   */
  getLatestByTraceId(traceId: string): Promise<GradingEvent | undefined>;

  /**
   * Count events by decision type
   *
   * @param decision - decision type filter (optional)
   * @param startDate - start date filter (optional)
   * @param endDate - end date filter (optional)
   * @returns count of events
   */
  count(
    decision?: 'ACCEPT' | 'RETRY' | 'ESCALATE',
    startDate?: Date,
    endDate?: Date
  ): Promise<number>;
}

/**
 * In-Memory Grading Event Store (for testing)
 */
export class InMemoryGradingEventStore implements IGradingEventStore {
  private events: Map<string, GradingEvent> = new Map();
  private idempotencyIndex: Map<string, string> = new Map();
  private traceIndex: Map<string, string[]> = new Map();

  async record(event: GradingEvent): Promise<void> {
    // Check idempotency
    if (this.idempotencyIndex.has(event.idempotency_key)) {
      const existingMessageId = this.idempotencyIndex.get(event.idempotency_key)!;
      throw new Error(
        `Idempotency violation: key ${event.idempotency_key} already exists for message ${existingMessageId}`
      );
    }

    // Store event
    this.events.set(event.message_id, event);
    this.idempotencyIndex.set(event.idempotency_key, event.message_id);

    // Update trace index
    if (!this.traceIndex.has(event.trace_id)) {
      this.traceIndex.set(event.trace_id, []);
    }
    this.traceIndex.get(event.trace_id)!.push(event.message_id);
  }

  async isDuplicate(idempotencyKey: string): Promise<boolean> {
    return this.idempotencyIndex.has(idempotencyKey);
  }

  async getByTraceId(traceId: string): Promise<GradingEvent[]> {
    const messageIds = this.traceIndex.get(traceId) ?? [];
    const events = messageIds
      .map((id) => this.events.get(id))
      .filter((e): e is GradingEvent => e !== undefined);

    // Sort by attempt_no ascending
    return events.sort((a, b) => a.attempt_no - b.attempt_no);
  }

  async getByMessageId(messageId: string): Promise<GradingEvent | undefined> {
    return this.events.get(messageId);
  }

  async query(query: GradingEventQuery): Promise<GradingEvent[]> {
    let results = Array.from(this.events.values());

    // Apply filters
    if (query.trace_id) {
      results = results.filter((e) => e.trace_id === query.trace_id);
    }
    if (query.message_id) {
      results = results.filter((e) => e.message_id === query.message_id);
    }
    if (query.decision) {
      results = results.filter((e) => e.decision === query.decision);
    }
    if (query.specialist_id) {
      results = results.filter((e) => e.specialist_id === query.specialist_id);
    }
    if (query.min_qscore !== undefined) {
      results = results.filter((e) => e.qscore >= query.min_qscore!);
    }
    if (query.max_qscore !== undefined) {
      results = results.filter((e) => e.qscore <= query.max_qscore!);
    }
    if (query.start_date) {
      results = results.filter((e) => e.created_at >= query.start_date!);
    }
    if (query.end_date) {
      results = results.filter((e) => e.created_at <= query.end_date!);
    }

    // Sort by created_at descending
    results.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

    // Apply pagination
    const offset = query.offset ?? 0;
    const limit = query.limit ?? results.length;
    return results.slice(offset, offset + limit);
  }

  async getLatestByTraceId(traceId: string): Promise<GradingEvent | undefined> {
    const events = await this.getByTraceId(traceId);
    return events.length > 0 ? events[events.length - 1] : undefined;
  }

  async count(
    decision?: 'ACCEPT' | 'RETRY' | 'ESCALATE',
    startDate?: Date,
    endDate?: Date
  ): Promise<number> {
    let events = Array.from(this.events.values());

    if (decision) {
      events = events.filter((e) => e.decision === decision);
    }
    if (startDate) {
      events = events.filter((e) => e.created_at >= startDate);
    }
    if (endDate) {
      events = events.filter((e) => e.created_at <= endDate);
    }

    return events.length;
  }

  /**
   * Clear all events (for testing)
   */
  clear(): void {
    this.events.clear();
    this.idempotencyIndex.clear();
    this.traceIndex.clear();
  }

  /**
   * Get all events (for testing)
   */
  getAll(): GradingEvent[] {
    return Array.from(this.events.values());
  }
}

/**
 * PG SQL schema
 *
 * CREATE TABLE grading_events (
 *   message_id VARCHAR(32) PRIMARY KEY,
 *   trace_id VARCHAR(32) NOT NULL,
 *   attempt_no INT NOT NULL,
 *   decision VARCHAR(10) NOT NULL CHECK (decision IN ('ACCEPT', 'RETRY', 'ESCALATE')),
 *   qscore FLOAT NOT NULL CHECK (qscore >= 0 AND qscore <= 1),
 *   reasons JSONB NOT NULL,
 *   idempotency_key VARCHAR(64) UNIQUE NOT NULL,
 *   specialist_id VARCHAR(64) NOT NULL,
 *   retry_target_specialist VARCHAR(64),
 *   created_at TIMESTAMP NOT NULL DEFAULT NOW()
 * );
 *
 * CREATE INDEX idx_grading_trace ON grading_events(trace_id, attempt_no);
 * CREATE INDEX idx_grading_idem ON grading_events(idempotency_key);
 * CREATE INDEX idx_grading_decision ON grading_events(decision, created_at);
 * CREATE INDEX idx_grading_specialist ON grading_events(specialist_id);
 */
