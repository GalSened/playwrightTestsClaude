/**
 * Idempotency & Retry Limit Tests
 *
 * Validates hash generation, deduplication, and retry limit enforcement.
 */

import { describe, it, expect } from 'vitest';
import {
  generateIdempotencyKey,
  RetryLimitGuard,
  DEFAULT_RETRY_LIMIT_CONFIG,
  IdempotencyViolationError,
  RetryLimitExceededError,
} from '../../../src/decision/idempotency.js';
import {
  InMemoryGradingEventStore,
  type GradingEvent,
} from '../../../src/decision/persistence.js';

describe('Idempotency', () => {
  describe('generateIdempotencyKey', () => {
    it('should generate consistent keys for same inputs', () => {
      const params = {
        trace_id: 'trace-123',
        task: { type: 'analyze', inputs: { test: 'login' } },
        attempt_no: 0,
        reason_codes: ['SCHEMA_VIOLATION', 'LOW_CONFIDENCE'],
      };

      const key1 = generateIdempotencyKey(params);
      const key2 = generateIdempotencyKey(params);

      expect(key1.key).toBe(key2.key);
      expect(key1.trace_id).toBe('trace-123');
      expect(key1.attempt_no).toBe(0);
    });

    it('should generate different keys for different attempt numbers', () => {
      const base = {
        trace_id: 'trace-123',
        task: { type: 'analyze', inputs: { test: 'login' } },
        reason_codes: ['SCHEMA_VIOLATION'],
      };

      const key0 = generateIdempotencyKey({ ...base, attempt_no: 0 });
      const key1 = generateIdempotencyKey({ ...base, attempt_no: 1 });

      expect(key0.key).not.toBe(key1.key);
    });

    it('should generate same key regardless of reason_codes order', () => {
      const base = {
        trace_id: 'trace-123',
        task: { type: 'analyze', inputs: { test: 'login' } },
        attempt_no: 0,
      };

      const keyA = generateIdempotencyKey({
        ...base,
        reason_codes: ['SCHEMA_VIOLATION', 'LOW_CONFIDENCE'],
      });
      const keyB = generateIdempotencyKey({
        ...base,
        reason_codes: ['LOW_CONFIDENCE', 'SCHEMA_VIOLATION'],
      });

      expect(keyA.key).toBe(keyB.key);
    });

    it('should generate different keys for different trace IDs', () => {
      const base = {
        task: { type: 'analyze', inputs: { test: 'login' } },
        attempt_no: 0,
        reason_codes: ['SCHEMA_VIOLATION'],
      };

      const keyA = generateIdempotencyKey({ ...base, trace_id: 'trace-1' });
      const keyB = generateIdempotencyKey({ ...base, trace_id: 'trace-2' });

      expect(keyA.key).not.toBe(keyB.key);
    });

    it('should generate different keys for different task inputs', () => {
      const base = {
        trace_id: 'trace-123',
        attempt_no: 0,
        reason_codes: ['SCHEMA_VIOLATION'],
      };

      const keyA = generateIdempotencyKey({
        ...base,
        task: { type: 'analyze', inputs: { test: 'login' } },
      });
      const keyB = generateIdempotencyKey({
        ...base,
        task: { type: 'analyze', inputs: { test: 'checkout' } },
      });

      expect(keyA.key).not.toBe(keyB.key);
    });

    it('should generate 64-character hex keys', () => {
      const params = {
        trace_id: 'trace-123',
        task: { type: 'analyze', inputs: {} },
        attempt_no: 0,
        reason_codes: [],
      };

      const key = generateIdempotencyKey(params);

      expect(key.key).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('RetryLimitGuard', () => {
    it('should allow retry when under global limit', () => {
      const guard = new RetryLimitGuard({ maxAttempts: 3 });

      expect(guard.isRetryAllowed({ currentAttempt: 0, category: 'UNKNOWN' })).toBe(
        true
      );
      expect(guard.isRetryAllowed({ currentAttempt: 2, category: 'UNKNOWN' })).toBe(
        true
      );
    });

    it('should deny retry when at global limit', () => {
      const guard = new RetryLimitGuard({ maxAttempts: 3 });

      expect(guard.isRetryAllowed({ currentAttempt: 3, category: 'UNKNOWN' })).toBe(
        false
      );
      expect(guard.isRetryAllowed({ currentAttempt: 5, category: 'UNKNOWN' })).toBe(
        false
      );
    });

    it('should enforce category-specific limits', () => {
      const guard = new RetryLimitGuard({
        maxAttempts: 5,
        categoryOverrides: { SCHEMA_VIOLATION: 2 },
      });

      expect(
        guard.isRetryAllowed({ currentAttempt: 1, category: 'SCHEMA_VIOLATION' })
      ).toBe(true);
      expect(
        guard.isRetryAllowed({ currentAttempt: 2, category: 'SCHEMA_VIOLATION' })
      ).toBe(false);
    });

    it('should deny POLICY_DEGRADED immediately (0 retries)', () => {
      const guard = new RetryLimitGuard(DEFAULT_RETRY_LIMIT_CONFIG);

      expect(
        guard.isRetryAllowed({ currentAttempt: 0, category: 'POLICY_DEGRADED' })
      ).toBe(false);
    });

    it('should calculate remaining attempts correctly', () => {
      const guard = new RetryLimitGuard({ maxAttempts: 3 });

      expect(
        guard.getRemainingAttempts({ currentAttempt: 0, category: 'UNKNOWN' })
      ).toBe(3);
      expect(
        guard.getRemainingAttempts({ currentAttempt: 1, category: 'UNKNOWN' })
      ).toBe(2);
      expect(
        guard.getRemainingAttempts({ currentAttempt: 3, category: 'UNKNOWN' })
      ).toBe(0);
    });

    it('should return 0 remaining when limit exceeded', () => {
      const guard = new RetryLimitGuard({ maxAttempts: 3 });

      expect(
        guard.getRemainingAttempts({ currentAttempt: 5, category: 'UNKNOWN' })
      ).toBe(0);
    });

    it('should get max attempts for category', () => {
      const guard = new RetryLimitGuard({
        maxAttempts: 5,
        categoryOverrides: { SCHEMA_VIOLATION: 2, TIMEOUT: 1 },
      });

      expect(guard.getMaxAttempts('SCHEMA_VIOLATION')).toBe(2);
      expect(guard.getMaxAttempts('TIMEOUT')).toBe(1);
      expect(guard.getMaxAttempts('UNKNOWN')).toBe(5);
    });

    it('should respect global limit even if category override is higher', () => {
      const guard = new RetryLimitGuard({
        maxAttempts: 2,
        categoryOverrides: { SCHEMA_VIOLATION: 5 },
      });

      // Category says 5, but global is 2, so effective limit is 2
      expect(guard.getMaxAttempts('SCHEMA_VIOLATION')).toBe(2);
      expect(
        guard.isRetryAllowed({ currentAttempt: 2, category: 'SCHEMA_VIOLATION' })
      ).toBe(false);
    });
  });

  describe('InMemoryGradingEventStore', () => {
    it('should record and retrieve grading events', async () => {
      const store = new InMemoryGradingEventStore();

      const event: GradingEvent = {
        message_id: 'msg-123',
        trace_id: 'trace-456',
        attempt_no: 0,
        decision: 'ACCEPT',
        qscore: 0.85,
        reasons: { category: 'NONE' },
        idempotency_key: 'idem-abc',
        created_at: new Date(),
        specialist_id: 'specialist-default',
      };

      await store.record(event);

      const retrieved = await store.getByMessageId('msg-123');
      expect(retrieved).toEqual(event);
    });

    it('should detect duplicate idempotency keys', async () => {
      const store = new InMemoryGradingEventStore();

      const event1: GradingEvent = {
        message_id: 'msg-1',
        trace_id: 'trace-1',
        attempt_no: 0,
        decision: 'ACCEPT',
        qscore: 0.8,
        reasons: {},
        idempotency_key: 'idem-same',
        created_at: new Date(),
        specialist_id: 'specialist-default',
      };

      const event2: GradingEvent = {
        ...event1,
        message_id: 'msg-2',
      };

      await store.record(event1);

      // Second record with same idempotency_key should throw
      await expect(store.record(event2)).rejects.toThrow('Idempotency violation');
    });

    it('should check if idempotency key is duplicate', async () => {
      const store = new InMemoryGradingEventStore();

      expect(await store.isDuplicate('idem-new')).toBe(false);

      const event: GradingEvent = {
        message_id: 'msg-1',
        trace_id: 'trace-1',
        attempt_no: 0,
        decision: 'ACCEPT',
        qscore: 0.8,
        reasons: {},
        idempotency_key: 'idem-exists',
        created_at: new Date(),
        specialist_id: 'specialist-default',
      };

      await store.record(event);

      expect(await store.isDuplicate('idem-exists')).toBe(true);
      expect(await store.isDuplicate('idem-new')).toBe(false);
    });

    it('should retrieve events by trace ID in order', async () => {
      const store = new InMemoryGradingEventStore();

      const events: GradingEvent[] = [
        {
          message_id: 'msg-1',
          trace_id: 'trace-same',
          attempt_no: 0,
          decision: 'RETRY',
          qscore: 0.6,
          reasons: {},
          idempotency_key: 'idem-1',
          created_at: new Date('2025-01-01'),
          specialist_id: 'specialist-default',
        },
        {
          message_id: 'msg-2',
          trace_id: 'trace-same',
          attempt_no: 1,
          decision: 'RETRY',
          qscore: 0.65,
          reasons: {},
          idempotency_key: 'idem-2',
          created_at: new Date('2025-01-02'),
          specialist_id: 'specialist-advanced',
        },
        {
          message_id: 'msg-3',
          trace_id: 'trace-same',
          attempt_no: 2,
          decision: 'ACCEPT',
          qscore: 0.8,
          reasons: {},
          idempotency_key: 'idem-3',
          created_at: new Date('2025-01-03'),
          specialist_id: 'specialist-advanced',
        },
      ];

      for (const event of events) {
        await store.record(event);
      }

      const retrieved = await store.getByTraceId('trace-same');

      expect(retrieved).toHaveLength(3);
      expect(retrieved[0]!.attempt_no).toBe(0);
      expect(retrieved[1]!.attempt_no).toBe(1);
      expect(retrieved[2]!.attempt_no).toBe(2);
    });

    it('should get latest event by trace ID', async () => {
      const store = new InMemoryGradingEventStore();

      await store.record({
        message_id: 'msg-1',
        trace_id: 'trace-1',
        attempt_no: 0,
        decision: 'RETRY',
        qscore: 0.6,
        reasons: {},
        idempotency_key: 'idem-1',
        created_at: new Date(),
        specialist_id: 'specialist-default',
      });

      await store.record({
        message_id: 'msg-2',
        trace_id: 'trace-1',
        attempt_no: 1,
        decision: 'ACCEPT',
        qscore: 0.8,
        reasons: {},
        idempotency_key: 'idem-2',
        created_at: new Date(),
        specialist_id: 'specialist-advanced',
      });

      const latest = await store.getLatestByTraceId('trace-1');

      expect(latest?.message_id).toBe('msg-2');
      expect(latest?.attempt_no).toBe(1);
      expect(latest?.decision).toBe('ACCEPT');
    });

    it('should count events by decision type', async () => {
      const store = new InMemoryGradingEventStore();

      await store.record({
        message_id: 'msg-1',
        trace_id: 'trace-1',
        attempt_no: 0,
        decision: 'ACCEPT',
        qscore: 0.8,
        reasons: {},
        idempotency_key: 'idem-1',
        created_at: new Date(),
        specialist_id: 'specialist-default',
      });

      await store.record({
        message_id: 'msg-2',
        trace_id: 'trace-2',
        attempt_no: 0,
        decision: 'RETRY',
        qscore: 0.6,
        reasons: {},
        idempotency_key: 'idem-2',
        created_at: new Date(),
        specialist_id: 'specialist-default',
      });

      await store.record({
        message_id: 'msg-3',
        trace_id: 'trace-3',
        attempt_no: 0,
        decision: 'ACCEPT',
        qscore: 0.85,
        reasons: {},
        idempotency_key: 'idem-3',
        created_at: new Date(),
        specialist_id: 'specialist-default',
      });

      expect(await store.count()).toBe(3);
      expect(await store.count('ACCEPT')).toBe(2);
      expect(await store.count('RETRY')).toBe(1);
      expect(await store.count('ESCALATE')).toBe(0);
    });

    it('should query events with filters', async () => {
      const store = new InMemoryGradingEventStore();

      await store.record({
        message_id: 'msg-1',
        trace_id: 'trace-1',
        attempt_no: 0,
        decision: 'ACCEPT',
        qscore: 0.9,
        reasons: {},
        idempotency_key: 'idem-1',
        created_at: new Date('2025-01-01'),
        specialist_id: 'specialist-default',
      });

      await store.record({
        message_id: 'msg-2',
        trace_id: 'trace-2',
        attempt_no: 0,
        decision: 'RETRY',
        qscore: 0.6,
        reasons: {},
        idempotency_key: 'idem-2',
        created_at: new Date('2025-01-02'),
        specialist_id: 'specialist-advanced',
      });

      const acceptResults = await store.query({ decision: 'ACCEPT' });
      expect(acceptResults).toHaveLength(1);
      expect(acceptResults[0]!.message_id).toBe('msg-1');

      const qscoreResults = await store.query({ min_qscore: 0.8 });
      expect(qscoreResults).toHaveLength(1);
      expect(qscoreResults[0]!.qscore).toBe(0.9);

      const specialistResults = await store.query({
        specialist_id: 'specialist-advanced',
      });
      expect(specialistResults).toHaveLength(1);
      expect(specialistResults[0]!.message_id).toBe('msg-2');
    });
  });
});
