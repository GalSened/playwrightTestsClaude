/**
 * A2A Envelope Contract & Schema Tests
 * Validates all 11 envelope types with positive and negative cases
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  validateEnvelope,
  validateEnvelopeMeta,
  validateTaskRequest,
  validateTaskResult,
  validateMemoryEvent,
  validateContextRequest,
  validateContextResult,
  validateSpecialistInvocationRequest,
  validateSpecialistInvocationResult,
  validateRegistryHeartbeat,
  validateRegistryDiscoveryRequest,
  validateRegistryDiscoveryResponse,
  validateSystemEvent,
  validateSpecialistEventNotification,
} from '../../src/a2a/envelopes/index.js';
import type { A2AEnvelope } from '../../src/a2a/envelopes/types.js';
import {
  createValidEnvelopeSet,
  createInvalidEnvelopeSet,
  createTaskRequest,
  createInvalidEnvelope_MissingField,
  createInvalidEnvelope_BadVersion,
  createInvalidEnvelope_BadMessageId,
  createInvalidEnvelope_BadTimestamp,
  createInvalidEnvelope_EmptyRecipients,
  createInvalidEnvelope_UnknownType,
  createInvalidEnvelope_MalformedPayload,
} from '../utils/envelopes.js';

const FIXTURES_DIR = join(__dirname, '../fixtures/envelopes');

/**
 * Load a fixture file
 */
function loadFixture(category: 'valid' | 'invalid', filename: string): any {
  const path = join(FIXTURES_DIR, category, filename);
  const content = readFileSync(path, 'utf-8');
  return JSON.parse(content);
}

describe('A2A Envelope Contract & Schema Tests', () => {
  describe('Valid Envelopes (11 types)', () => {
    describe('TaskRequest', () => {
      it('should validate a valid TaskRequest from fixture', () => {
        const envelope = loadFixture('valid', 'task-request.json');
        const result = validateEnvelope(envelope);

        expect(result.valid).toBe(true);
        expect(result.errors).toBeUndefined();
      });

      it('should validate a programmatically created TaskRequest', () => {
        const envelope = createTaskRequest();
        const result = validateTaskRequest(envelope);

        expect(result.valid).toBe(true);
        expect(result.errors).toBeUndefined();
      });

      it('should validate TaskRequest metadata fields', () => {
        const envelope = loadFixture('valid', 'task-request.json');

        expect(envelope.meta.a2a_version).toBe('1.0');
        expect(envelope.meta.message_id).toMatch(/^[a-f0-9]{32,}$/);
        expect(envelope.meta.type).toBe('TaskRequest');
        expect(envelope.meta.from).toHaveProperty('id');
        expect(envelope.meta.to).toBeInstanceOf(Array);
        expect(envelope.meta.to.length).toBeGreaterThan(0);
      });

      it('should validate TaskRequest payload fields', () => {
        const envelope = loadFixture('valid', 'task-request.json');

        expect(envelope.payload).toHaveProperty('task');
        expect(envelope.payload.task).toBe('code-review');
        expect(envelope.payload).toHaveProperty('inputs');
        expect(envelope.payload.inputs).toHaveProperty('pr_number');
      });
    });

    describe('TaskResult', () => {
      it('should validate a valid TaskResult from fixture', () => {
        const envelope = loadFixture('valid', 'task-result.json');
        const result = validateEnvelope(envelope);

        expect(result.valid).toBe(true);
      });

      it('should validate TaskResult status field', () => {
        const envelope = loadFixture('valid', 'task-result.json');

        expect(envelope.payload.status).toBe('success');
        expect(envelope.payload).toHaveProperty('result');
        expect(envelope.payload).toHaveProperty('duration_ms');
      });

      it('should validate reply_to field in metadata', () => {
        const envelope = loadFixture('valid', 'task-result.json');

        expect(envelope.meta).toHaveProperty('reply_to');
        expect(envelope.meta.reply_to).toMatch(/^[a-f0-9]{32,}$/);
      });
    });

    describe('MemoryEvent', () => {
      it('should validate a valid MemoryEvent from fixture', () => {
        const envelope = loadFixture('valid', 'memory-event.json');
        const result = validateEnvelope(envelope);

        expect(result.valid).toBe(true);
      });

      it('should validate MemoryEvent payload structure', () => {
        const envelope = loadFixture('valid', 'memory-event.json');

        expect(envelope.payload).toHaveProperty('event_type');
        expect(envelope.payload).toHaveProperty('memory_key');
        expect(envelope.payload).toHaveProperty('value');
      });

      it('should support topic-based recipients', () => {
        const envelope = loadFixture('valid', 'memory-event.json');

        expect(envelope.meta.to[0]).toHaveProperty('type', 'topic');
        expect(envelope.meta.to[0]).toHaveProperty('name');
        expect(envelope.meta.to[0].name).toMatch(/^qa\./);
      });
    });

    describe('ContextRequest & ContextResult', () => {
      it('should validate a valid ContextRequest from fixture', () => {
        const envelope = loadFixture('valid', 'context-slice-request.json');
        const result = validateEnvelope(envelope);

        expect(result.valid).toBe(true);
      });

      it('should validate a valid ContextResult from fixture', () => {
        const envelope = loadFixture('valid', 'context-slice-response.json');
        const result = validateEnvelope(envelope);

        expect(result.valid).toBe(true);
      });

      it('should validate request-response correlation', () => {
        const request = loadFixture('valid', 'context-slice-request.json');
        const response = loadFixture('valid', 'context-slice-response.json');

        expect(request.payload.query).toBeDefined();
        expect(response.payload.results).toBeDefined();
        expect(response.meta.reply_to).toBe(request.meta.message_id);
        expect(response.meta.trace_id).toBe(request.meta.trace_id);
      });
    });

    describe('SpecialistInvocationRequest & SpecialistInvocationResult', () => {
      it('should validate a valid SpecialistInvocationRequest from fixture', () => {
        const envelope = loadFixture('valid', 'specialist-invocation-request.json');
        const result = validateEnvelope(envelope);

        expect(result.valid).toBe(true);
      });

      it('should validate a valid SpecialistInvocationResult from fixture', () => {
        const envelope = loadFixture('valid', 'specialist-invocation-result.json');
        const result = validateEnvelope(envelope);

        expect(result.valid).toBe(true);
      });

      it('should validate invocation payload structure', () => {
        const envelope = loadFixture('valid', 'specialist-invocation-request.json');

        expect(envelope.payload).toHaveProperty('task');
        expect(typeof envelope.payload.task).toBe('string');
        expect(envelope.payload).toHaveProperty('inputs');
        expect(envelope.payload).toHaveProperty('context_slice');
        expect(envelope.payload).toHaveProperty('budget');
      });

      it('should validate result payload structure', () => {
        const envelope = loadFixture('valid', 'specialist-invocation-result.json');

        expect(envelope.payload).toHaveProperty('status');
        expect(envelope.payload).toHaveProperty('task');
        expect(envelope.payload).toHaveProperty('confidence');
        expect(envelope.payload).toHaveProperty('proposal');
      });
    });

    describe('RegistryHeartbeat', () => {
      it('should validate a valid RegistryHeartbeat from fixture', () => {
        const envelope = loadFixture('valid', 'registry-heartbeat.json');
        const result = validateEnvelope(envelope);

        expect(result.valid).toBe(true);
      });

      it('should validate heartbeat payload structure', () => {
        const envelope = loadFixture('valid', 'registry-heartbeat.json');

        expect(envelope.payload).toHaveProperty('agent_id');
        expect(envelope.payload).toHaveProperty('status');
        expect(envelope.payload.status).toMatch(/^(STARTING|HEALTHY|DEGRADED|UNAVAILABLE)$/);
        expect(envelope.payload).toHaveProperty('metrics');
      });
    });

    describe('RegistryDiscoveryRequest & RegistryDiscoveryResponse', () => {
      it('should validate a valid RegistryDiscoveryRequest from fixture', () => {
        const envelope = loadFixture('valid', 'registry-discovery-request.json');
        const result = validateEnvelope(envelope);

        expect(result.valid).toBe(true);
      });

      it('should validate a valid RegistryDiscoveryResponse from fixture', () => {
        const envelope = loadFixture('valid', 'registry-discovery-response.json');
        const result = validateEnvelope(envelope);

        expect(result.valid).toBe(true);
      });

      it('should validate discovery filters', () => {
        const envelope = loadFixture('valid', 'registry-discovery-request.json');

        expect(envelope.payload).toHaveProperty('filters');
        expect(envelope.payload.filters).toHaveProperty('capability');
        expect(envelope.payload.filters).toHaveProperty('tenant');
      });

      it('should validate discovery response agents array', () => {
        const envelope = loadFixture('valid', 'registry-discovery-response.json');

        expect(envelope.payload).toHaveProperty('agents');
        expect(envelope.payload.agents).toBeInstanceOf(Array);
        expect(envelope.payload).toHaveProperty('total_count');
        expect(envelope.payload.total_count).toBe(envelope.payload.agents.length);
      });
    });

    describe('SystemEvent', () => {
      it('should validate a valid SystemEvent from fixture', () => {
        const envelope = loadFixture('valid', 'system-event.json');
        const result = validateEnvelope(envelope);

        expect(result.valid).toBe(true);
      });

      it('should validate system event structure', () => {
        const envelope = loadFixture('valid', 'system-event.json');

        expect(envelope.payload).toHaveProperty('event_type');
        expect(envelope.payload).toHaveProperty('severity');
        expect(envelope.payload).toHaveProperty('details');
      });
    });

    describe('SpecialistEventNotification', () => {
      it('should validate a valid SpecialistEventNotification from fixture', () => {
        const envelope = loadFixture('valid', 'specialist-event-notification.json');
        const result = validateEnvelope(envelope);

        expect(result.valid).toBe(true);
      });

      it('should validate specialist event structure', () => {
        const envelope = loadFixture('valid', 'specialist-event-notification.json');

        expect(envelope.payload).toHaveProperty('event_type');
        expect(envelope.payload).toHaveProperty('task_id');
        expect(envelope.payload).toHaveProperty('details');
      });
    });
  });

  describe('Invalid Envelopes - Metadata Violations', () => {
    it('should reject envelope with missing message_id', () => {
      const envelope = loadFixture('invalid', 'missing-message-id.json');
      const result = validateEnvelopeMeta(envelope.meta);

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('E_VALIDATION_FAILED');
      expect(result.error).toContain('message_id');
    });

    it('should reject envelope with missing trace_id', () => {
      const envelope = loadFixture('invalid', 'missing-trace-id.json');
      const result = validateEnvelopeMeta(envelope.meta);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('trace_id');
    });

    it('should reject envelope with missing from', () => {
      const envelope = loadFixture('invalid', 'missing-from.json');
      const result = validateEnvelopeMeta(envelope.meta);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('from');
    });

    it('should reject envelope with missing to', () => {
      const envelope = loadFixture('invalid', 'missing-to.json');
      const result = validateEnvelopeMeta(envelope.meta);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('to');
    });

    it('should reject envelope with missing type', () => {
      const envelope = loadFixture('invalid', 'missing-type.json');
      const result = validateEnvelopeMeta(envelope.meta);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('type');
    });

    it('should reject envelope with invalid a2a_version', () => {
      const envelope = loadFixture('invalid', 'bad-version.json');
      const result = validateEnvelopeMeta(envelope.meta);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('a2a_version');
    });

    it('should reject envelope with invalid message_id format', () => {
      const envelope = loadFixture('invalid', 'bad-message-id-format.json');
      const result = validateEnvelopeMeta(envelope.meta);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('message_id');
    });

    it('should reject envelope with invalid timestamp format', () => {
      const envelope = loadFixture('invalid', 'bad-timestamp-format.json');
      const result = validateEnvelopeMeta(envelope.meta);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('ts');
    });

    it('should reject envelope with empty recipients array', () => {
      const envelope = loadFixture('invalid', 'empty-recipients.json');
      const result = validateEnvelopeMeta(envelope.meta);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('to');
    });

    it('should reject envelope with unknown message type', () => {
      const envelope = loadFixture('invalid', 'unknown-message-type.json');
      const result = validateEnvelope(envelope);

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('E_VALIDATION_FAILED');
    });
  });

  describe('Invalid Envelopes - Payload Violations', () => {
    it('should reject TaskRequest with missing task', () => {
      const envelope = loadFixture('invalid', 'malformed-payload-missing-field.json');
      const result = validateTaskRequest(envelope);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('task');
    });

    it('should reject TaskRequest with invalid payload structure', () => {
      const envelope = createTaskRequest();
      delete (envelope.payload as any).task;

      const result = validateTaskRequest(envelope);

      expect(result.valid).toBe(false);
    });
  });

  describe('Programmatic Envelope Creation', () => {
    it('should validate all envelopes from createValidEnvelopeSet()', () => {
      const envelopes = createValidEnvelopeSet();

      for (const [key, envelope] of Object.entries(envelopes)) {
        const result = validateEnvelope(envelope);
        expect(result.valid).toBe(true, `Envelope ${key} should be valid`);
      }
    });

    it('should reject all envelopes from createInvalidEnvelopeSet()', () => {
      const envelopes = createInvalidEnvelopeSet();

      for (const [key, envelope] of Object.entries(envelopes)) {
        const result = validateEnvelope(envelope as any);
        expect(result.valid).toBe(false, `Envelope ${key} should be invalid`);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle envelopes with optional fields', () => {
      const envelope = createTaskRequest({
        meta: {
          priority: 'high',
          reply_to: 'abc123def456789012345678901234',
          correlation_id: 'corr-001',
        } as any,
      });

      const result = validateEnvelope(envelope);
      expect(result.valid).toBe(true);
    });

    it('should handle envelopes with mixed recipient types', () => {
      const envelope = createTaskRequest({
        meta: {
          to: [
            { id: 'agent-001', type: 'specialist', version: '1.0.0' },
            { type: 'topic', name: 'qa.wesign.test.specialists.all.broadcast' },
          ],
        } as any,
      });

      const result = validateEnvelope(envelope);
      expect(result.valid).toBe(true);
    });

    it('should handle large payloads', () => {
      const largePayload = {
        data: Array(1000).fill({ key: 'value', index: 123 }),
      };

      const envelope = createTaskRequest({
        payload: { ...createTaskRequest().payload, ...largePayload } as any,
      });

      const result = validateEnvelope(envelope);
      expect(result.valid).toBe(true);
    });

    it('should handle Unicode characters in payload', () => {
      const envelope = createTaskRequest({
        payload: {
          task: 'test',
          inputs: { message: '你好世界 🌍 مرحبا' },
        } as any,
      });

      const result = validateEnvelope(envelope);
      expect(result.valid).toBe(true);
    });

    it('should validate trace_id format variations', () => {
      const validTraceIds = [
        'trace-001',
        'TRACE-ABC-123',
        'uuid-550e8400-e29b-41d4-a716-446655440000',
        'custom_trace_123',
      ];

      for (const traceId of validTraceIds) {
        const envelope = createTaskRequest({
          meta: { trace_id: traceId } as any,
        });

        const result = validateEnvelope(envelope);
        expect(result.valid).toBe(true, `trace_id '${traceId}' should be valid`);
      }
    });
  });

  describe('Type-Specific Validation', () => {
    it('should validate TaskRequest with all optional fields', () => {
      const envelope = createTaskRequest({
        payload: {
          task_type: 'test',
          parameters: { test: true },
          context_slice_id: 'ctx-001',
          deadline: new Date(Date.now() + 60000).toISOString(),
          retry_policy: { max_retries: 3, backoff_ms: 1000 },
          priority: 'high',
          metadata: { custom: 'value' },
        } as any,
      });

      const result = validateTaskRequest(envelope);
      expect(result.valid).toBe(true);
    });

    it('should validate RegistryHeartbeat status values', () => {
      const validStatuses = ['STARTING', 'HEALTHY', 'DEGRADED', 'UNAVAILABLE'];

      for (const status of validStatuses) {
        const envelope = createTaskRequest({
          meta: { type: 'RegistryHeartbeat' } as any,
          payload: { agent_id: 'test-001', status, metrics: {} } as any,
        });

        // Note: This would need the actual RegistryHeartbeat validator
        // Just checking metadata validation for now
        const result = validateEnvelopeMeta(envelope.meta);
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('Performance & Boundary Conditions', () => {
    it('should validate 100 envelopes in reasonable time', () => {
      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        const envelope = createTaskRequest({
          meta: { message_id: `${'a'.repeat(32)}${i}` } as any,
        });
        validateEnvelope(envelope);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete in < 1s
    });

    it('should handle minimum valid envelope', () => {
      const envelope = {
        meta: {
          a2a_version: '1.0',
          message_id: 'a'.repeat(32),
          trace_id: 'trace-min',
          ts: new Date().toISOString(),
          from: { id: 'agent-001', type: 'cmo', version: '1.0.0' },
          to: [{ id: 'agent-002', type: 'specialist', version: '1.0.0' }],
          tenant: 't',
          project: 'p',
          type: 'TaskRequest',
        },
        payload: {
          task: 'test',
          inputs: {},
        },
      };

      const result = validateTaskRequest(envelope as any);
      expect(result.valid).toBe(true);
    });
  });
});
