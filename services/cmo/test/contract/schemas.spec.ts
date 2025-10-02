/**
 * Schema Validation Contract Tests
 * Verifies JSON Schema validation for all envelope types
 */

import { describe, it, expect } from 'vitest';
import {
  validateEnvelope,
  validateEnvelopeMeta,
  validateSpecialistInvocationRequest,
  validateSpecialistResult,
  validateRetryDirective,
  validateDecisionNotice,
  validateEnvelopeOrThrow,
} from '../../src/schemas/index.js';

describe('Schema Validation', () => {
  describe('Envelope Meta', () => {
    it('validates correct envelope meta', () => {
      const validMeta = {
        correlationId: 'abc-123',
        traceId: 'trace-456',
        messageType: 'specialist-invocation',
        timestamp: '2025-01-02T00:00:00.000Z',
      };

      const result = validateEnvelopeMeta(validMeta);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('rejects meta without required fields', () => {
      const invalidMeta = {
        correlationId: 'abc-123',
        // missing traceId, messageType, timestamp
      };

      const result = validateEnvelopeMeta(invalidMeta);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });
  });

  describe('Specialist Invocation Request', () => {
    it('validates correct invocation request', () => {
      const validRequest = {
        meta: {
          correlationId: 'abc-123',
          traceId: 'trace-456',
          messageType: 'specialist-invocation',
          timestamp: '2025-01-02T00:00:00.000Z',
        },
        payload: {
          task: 'analyze',
          input: { data: 'test' },
        },
      };

      const result = validateSpecialistInvocationRequest(validRequest);

      expect(result.valid).toBe(true);
    });

    it('rejects request with invalid meta', () => {
      const invalidRequest = {
        meta: {
          correlationId: 'abc-123',
          // missing required fields
        },
        payload: {
          task: 'analyze',
        },
      };

      const result = validateSpecialistInvocationRequest(invalidRequest);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('Specialist Result', () => {
    it('validates correct result', () => {
      const validResult = {
        meta: {
          correlationId: 'abc-123',
          traceId: 'trace-456',
          messageType: 'specialist-result',
          timestamp: '2025-01-02T00:00:01.000Z',
        },
        payload: {
          status: 'success',
          output: { result: 'data' },
        },
      };

      const result = validateSpecialistResult(validResult);

      expect(result.valid).toBe(true);
    });
  });

  describe('Retry Directive', () => {
    it('validates correct retry directive', () => {
      const validDirective = {
        meta: {
          correlationId: 'abc-123',
          traceId: 'trace-456',
          messageType: 'retry-directive',
          timestamp: '2025-01-02T00:00:02.000Z',
        },
        payload: {
          reason: 'transient-error',
          retryAfterMs: 1000,
        },
      };

      const result = validateRetryDirective(validDirective);

      expect(result.valid).toBe(true);
    });
  });

  describe('Decision Notice', () => {
    it('validates correct decision notice', () => {
      const validDecision = {
        meta: {
          correlationId: 'abc-123',
          traceId: 'trace-456',
          messageType: 'decision',
          timestamp: '2025-01-02T00:00:03.000Z',
        },
        payload: {
          decision: 'proceed',
          reason: 'all-checks-passed',
        },
      };

      const result = validateDecisionNotice(validDecision);

      expect(result.valid).toBe(true);
    });
  });

  describe('Generic Envelope Validation', () => {
    it('validates envelope based on message type', () => {
      const envelope = {
        meta: {
          correlationId: 'abc-123',
          traceId: 'trace-456',
          messageType: 'specialist-invocation',
          timestamp: '2025-01-02T00:00:00.000Z',
        },
        payload: {
          task: 'test',
          input: {},
        },
      };

      const result = validateEnvelope(envelope);

      expect(result.valid).toBe(true);
    });

    it('rejects envelope with unknown message type', () => {
      const envelope = {
        meta: {
          correlationId: 'abc-123',
          traceId: 'trace-456',
          messageType: 'unknown-type',
          timestamp: '2025-01-02T00:00:00.000Z',
        },
        payload: {},
      };

      const result = validateEnvelope(envelope);

      expect(result.valid).toBe(false);
      expect(result.errors![0]!.message).toContain('Unknown message type');
    });

    it('rejects malformed envelope', () => {
      const malformed = {
        meta: {
          // missing required fields
        },
      };

      const result = validateEnvelope(malformed);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('validateEnvelopeOrThrow', () => {
    it('does not throw for valid envelope', () => {
      const validEnvelope = {
        meta: {
          correlationId: 'abc-123',
          traceId: 'trace-456',
          messageType: 'specialist-invocation',
          timestamp: '2025-01-02T00:00:00.000Z',
        },
        payload: {
          task: 'test',
          input: {},
        },
      };

      expect(() => validateEnvelopeOrThrow(validEnvelope)).not.toThrow();
    });

    it('throws for invalid envelope', () => {
      const invalidEnvelope = {
        meta: {
          correlationId: 'abc-123',
          // missing required fields
        },
      };

      expect(() => validateEnvelopeOrThrow(invalidEnvelope)).toThrow('Envelope validation failed');
    });
  });
});
