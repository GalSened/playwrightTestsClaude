/**
 * Envelope Test Factories
 * Helper functions to create valid and invalid A2A envelopes for testing
 */

import { randomUUID } from 'crypto';
import type {
  A2AEnvelope,
  AgentId,
  EnvelopeMeta,
  TaskRequest,
  TaskResult,
  MemoryEvent,
  ContextSliceRequest,
  ContextSliceResponse,
  SpecialistInvocationRequest,
  SpecialistInvocationResult,
  RegistryHeartbeat,
  RegistryDiscoveryRequest,
  RegistryDiscoveryResponse,
  SystemEvent,
  SpecialistEventNotification,
} from '../../src/a2a/envelopes/types.js';

/**
 * Generate a unique message ID (hex UUID without dashes)
 */
export function generateMessageId(): string {
  return randomUUID().replace(/-/g, '');
}

/**
 * Create a test agent ID
 */
export function createTestAgentId(
  id: string = 'test-agent-001',
  type: string = 'cmo',
  version: string = '1.0.0'
): AgentId {
  return { id, type, version };
}

/**
 * Create base envelope metadata
 */
export function createBaseMeta(overrides: Partial<EnvelopeMeta> = {}): EnvelopeMeta {
  return {
    a2a_version: '1.0',
    message_id: generateMessageId(),
    trace_id: `test-trace-${Date.now()}`,
    ts: new Date().toISOString(),
    from: createTestAgentId('test-cmo-001', 'cmo'),
    to: [createTestAgentId('test-specialist-001', 'specialist')],
    tenant: 'test-tenant',
    project: 'test-project',
    type: 'TaskRequest',
    priority: 'normal',
    ...overrides,
  };
}

/**
 * Create a TaskRequest envelope
 */
export function createTaskRequest(overrides: Partial<TaskRequest> = {}): TaskRequest {
  return {
    meta: createBaseMeta({ type: 'TaskRequest', ...overrides.meta }),
    payload: {
      task: 'test-analysis',
      inputs: {
        input: 'test-data',
        context_slice_id: 'ctx-001',
        deadline: new Date(Date.now() + 60000).toISOString(),
      },
      retry_policy: { max_attempts: 3, backoff_ms: 1000 },
      ...overrides.payload,
    },
  };
}

/**
 * Create a TaskResult envelope
 */
export function createTaskResult(overrides: Partial<TaskResult> = {}): TaskResult {
  return {
    meta: createBaseMeta({ type: 'TaskResult', ...overrides.meta }),
    payload: {
      task: 'test-analysis',
      status: 'success',
      result: { output: 'test-result' },
      duration_ms: 1234,
      ...overrides.payload,
    },
  };
}

/**
 * Create a MemoryEvent envelope
 */
export function createMemoryEvent(overrides: Partial<MemoryEvent> = {}): MemoryEvent {
  return {
    meta: createBaseMeta({ type: 'MemoryEvent', ...overrides.meta }),
    payload: {
      event_type: 'created',
      memory_key: 'test_results/2025-10-02/mem-001',
      value: { content: 'test-memory' },
      ...overrides.payload,
    },
  };
}

/**
 * Create a ContextSliceRequest envelope (mapped to ContextRequest schema)
 */
export function createContextSliceRequest(
  overrides: Partial<ContextSliceRequest> = {}
): ContextSliceRequest {
  return {
    meta: createBaseMeta({ type: 'ContextRequest', ...overrides.meta }),
    payload: {
      query: {
        type: 'semantic',
        text: 'test query',
        filters: { tags: ['test'] },
      },
      limit: 100,
      ...overrides.payload,
    },
  };
}

/**
 * Create a ContextSliceResponse envelope (mapped to ContextResult schema)
 */
export function createContextSliceResponse(
  overrides: Partial<ContextSliceResponse> = {}
): ContextSliceResponse {
  return {
    meta: createBaseMeta({ type: 'ContextResult', ...overrides.meta }),
    payload: {
      results: [{ id: 'item-001', content: { data: 'test-item' }, score: 0.95 }],
      total_count: 1,
      ...overrides.payload,
    },
  };
}

/**
 * Create a SpecialistInvocationRequest envelope
 */
export function createSpecialistInvocationRequest(
  overrides: Partial<SpecialistInvocationRequest> = {}
): SpecialistInvocationRequest {
  return {
    meta: createBaseMeta({ type: 'SpecialistInvocationRequest', ...overrides.meta }),
    payload: {
      task: 'code-review',
      inputs: { pr_number: 123, repo: 'test/repo' },
      context_slice: { test_results: [] },
      budget: { max_minutes: 30, max_cost_usd: 0.50 },
      ...overrides.payload,
    },
  };
}

/**
 * Create a SpecialistInvocationResult envelope (mapped to SpecialistResult schema)
 */
export function createSpecialistInvocationResult(
  overrides: Partial<SpecialistInvocationResult> = {}
): SpecialistInvocationResult {
  return {
    meta: createBaseMeta({ type: 'SpecialistResult', ...overrides.meta }),
    payload: {
      task: 'code-review',
      status: 'success',
      confidence: 0.95,
      proposal: { findings: [] },
      metrics: { duration_ms: 5000, cost_usd: 0.25 },
      ...overrides.payload,
    },
  };
}

/**
 * Create a RegistryHeartbeat envelope
 */
export function createRegistryHeartbeat(overrides: Partial<RegistryHeartbeat> = {}): RegistryHeartbeat {
  return {
    meta: createBaseMeta({ type: 'RegistryHeartbeat', ...overrides.meta }),
    payload: {
      agent_id: 'test-agent-001',
      status: 'HEALTHY',
      metrics: { cpu_percent: 45, memory_mb: 512 },
      ...overrides.payload,
    },
  };
}

/**
 * Create a RegistryDiscoveryRequest envelope
 */
export function createRegistryDiscoveryRequest(
  overrides: Partial<RegistryDiscoveryRequest> = {}
): RegistryDiscoveryRequest {
  return {
    meta: createBaseMeta({ type: 'RegistryDiscoveryRequest', ...overrides.meta }),
    payload: {
      filters: { capability: 'code-review', tenant: 'test-tenant' },
      ...overrides.payload,
    },
  };
}

/**
 * Create a RegistryDiscoveryResponse envelope
 */
export function createRegistryDiscoveryResponse(
  overrides: Partial<RegistryDiscoveryResponse> = {}
): RegistryDiscoveryResponse {
  return {
    meta: createBaseMeta({ type: 'RegistryDiscoveryResponse', ...overrides.meta }),
    payload: {
      agents: [
        {
          agent_id: 'test-specialist-001',
          capabilities: ['code-review'],
          status: 'HEALTHY',
          last_heartbeat: new Date().toISOString(),
        },
      ],
      total_count: 1,
      ...overrides.payload,
    },
  };
}

/**
 * Create a SystemEvent envelope
 */
export function createSystemEvent(overrides: Partial<SystemEvent> = {}): SystemEvent {
  return {
    meta: createBaseMeta({ type: 'SystemEvent', ...overrides.meta }),
    payload: {
      event_type: 'agent_registered',
      severity: 'info',
      details: { agent_id: 'test-agent-001' },
      ...overrides.payload,
    },
  };
}

/**
 * Create a SpecialistEventNotification envelope
 */
export function createSpecialistEventNotification(
  overrides: Partial<SpecialistEventNotification> = {}
): SpecialistEventNotification {
  return {
    meta: createBaseMeta({ type: 'SpecialistEventNotification', ...overrides.meta }),
    payload: {
      event_type: 'task_completed',
      task_id: 'task-001',
      details: { result: 'success' },
      ...overrides.payload,
    },
  };
}

/**
 * Create an envelope with invalid metadata (missing required field)
 */
export function createInvalidEnvelope_MissingField(
  field: keyof EnvelopeMeta
): Partial<A2AEnvelope> {
  const meta = createBaseMeta();
  delete (meta as any)[field];

  return {
    meta: meta as EnvelopeMeta,
    payload: { test: 'invalid' },
  };
}

/**
 * Create an envelope with invalid a2a_version
 */
export function createInvalidEnvelope_BadVersion(): A2AEnvelope {
  return {
    meta: createBaseMeta({ a2a_version: '2.0' as any }),
    payload: { test: 'invalid' },
  } as A2AEnvelope;
}

/**
 * Create an envelope with invalid message_id format
 */
export function createInvalidEnvelope_BadMessageId(): A2AEnvelope {
  return {
    meta: createBaseMeta({ message_id: 'not-a-hex-id' }),
    payload: { test: 'invalid' },
  } as A2AEnvelope;
}

/**
 * Create an envelope with invalid timestamp
 */
export function createInvalidEnvelope_BadTimestamp(): A2AEnvelope {
  return {
    meta: createBaseMeta({ ts: 'not-a-timestamp' }),
    payload: { test: 'invalid' },
  } as A2AEnvelope;
}

/**
 * Create an envelope with empty recipients
 */
export function createInvalidEnvelope_EmptyRecipients(): A2AEnvelope {
  return {
    meta: createBaseMeta({ to: [] }),
    payload: { test: 'invalid' },
  } as A2AEnvelope;
}

/**
 * Create an envelope with unknown message type
 */
export function createInvalidEnvelope_UnknownType(): A2AEnvelope {
  return {
    meta: createBaseMeta({ type: 'UnknownMessageType' as any }),
    payload: { test: 'invalid' },
  } as A2AEnvelope;
}

/**
 * Create an envelope with malformed payload (missing required field)
 */
export function createInvalidEnvelope_MalformedPayload(): TaskRequest {
  const envelope = createTaskRequest();
  delete (envelope.payload as any).task;
  return envelope;
}

/**
 * Create a set of valid envelopes for testing
 */
export function createValidEnvelopeSet(): Record<string, A2AEnvelope> {
  return {
    taskRequest: createTaskRequest(),
    taskResult: createTaskResult(),
    memoryEvent: createMemoryEvent(),
    contextSliceRequest: createContextSliceRequest(),
    contextSliceResponse: createContextSliceResponse(),
    specialistInvocationRequest: createSpecialistInvocationRequest(),
    specialistInvocationResult: createSpecialistInvocationResult(),
    registryHeartbeat: createRegistryHeartbeat(),
    registryDiscoveryRequest: createRegistryDiscoveryRequest(),
    registryDiscoveryResponse: createRegistryDiscoveryResponse(),
    systemEvent: createSystemEvent(),
    specialistEventNotification: createSpecialistEventNotification(),
  };
}

/**
 * Create a set of invalid envelopes for testing
 */
export function createInvalidEnvelopeSet(): Record<string, Partial<A2AEnvelope> | A2AEnvelope> {
  return {
    missingMessageId: createInvalidEnvelope_MissingField('message_id'),
    missingTraceId: createInvalidEnvelope_MissingField('trace_id'),
    missingFrom: createInvalidEnvelope_MissingField('from'),
    missingTo: createInvalidEnvelope_MissingField('to'),
    missingType: createInvalidEnvelope_MissingField('type'),
    badVersion: createInvalidEnvelope_BadVersion(),
    badMessageId: createInvalidEnvelope_BadMessageId(),
    badTimestamp: createInvalidEnvelope_BadTimestamp(),
    emptyRecipients: createInvalidEnvelope_EmptyRecipients(),
    unknownType: createInvalidEnvelope_UnknownType(),
    malformedPayload: createInvalidEnvelope_MalformedPayload(),
  };
}
