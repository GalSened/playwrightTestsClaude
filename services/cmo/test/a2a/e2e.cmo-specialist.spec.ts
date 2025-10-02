/**
 * A2A End-to-End Integration Tests
 * Full CMO↔specialist flow with InvokeSpecialist, OPA, and Decision flows
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import type { RedisClientType } from 'redis';
import type { Pool } from 'pg';
import { RedisA2ATransport, createRedisA2ATransport } from '../../src/a2a/transport/redis-streams.js';
import { InvokeSpecialistActivity } from '../../src/elg/activity/invoke-specialist.js';
import { InboundHandler, createInboundHandler } from '../../src/a2a/handlers/inbound.js';
import { DecisionNoticePublisher, createDecisionNoticePublisher } from '../../src/a2a/publishers/decision-notice.js';
import { OPAWireGates } from '../../src/a2a/middleware/opa-wire-gates.js';
import { IdempotencyGuard } from '../../src/a2a/middleware/idempotency.js';
import type { A2AEnvelope, A2AMessageHandler } from '../../src/a2a/transport/types.js';
import type { Decision } from '../../src/a2a/publishers/decision-notice.js';
import { createTestRedisClient, flushTestDB } from '../utils/redis.js';
import { createTestPool, truncateTestTables } from '../utils/postgres.js';
import {
  createMockOPAServer,
  createAlwaysAllowPolicy,
  createAlwaysDenyPolicy,
  createTenantPolicy,
  createMessageTypePolicy,
} from '../utils/opa.js';
import {
  createTaskRequest,
  createTaskResult,
  createSpecialistInvocationRequest,
  createSpecialistInvocationResult,
  createTestAgentId,
} from '../utils/envelopes.js';

describe('A2A E2E Integration Tests - CMO↔Specialist', () => {
  let redisClient: RedisClientType;
  let pool: Pool;
  let transport: RedisA2ATransport;
  let mockOPA: ReturnType<typeof createMockOPAServer>;

  const CMO_AGENT_ID = createTestAgentId('cmo-001', 'cmo');
  const SPECIALIST_AGENT_ID = createTestAgentId('specialist-healing-001', 'specialist');
  const SPECIALIST_TOPIC = 'test:a2a:qa.wesign.test.specialists.healing.invoke';

  beforeAll(async () => {
    redisClient = await createTestRedisClient();
    pool = createTestPool();
  });

  beforeEach(async () => {
    await flushTestDB(redisClient);
    await truncateTestTables(pool);

    transport = createRedisA2ATransport({
      redisClient,
      validateOnPublish: true,
      validateOnSubscribe: true,
    });

    mockOPA = createMockOPAServer();
  });

  afterEach(async () => {
    mockOPA.reset();
  });

  afterAll(async () => {
    await redisClient.disconnect();
    await pool.end();
  });

  describe('CMO → Specialist Invocation Flow', () => {
    it('should complete a full invocation request-response cycle', async () => {
      // 1. CMO publishes InvokeSpecialist request
      const request = createSpecialistInvocationRequest({
        meta: {
          from: CMO_AGENT_ID,
          to: [SPECIALIST_AGENT_ID],
          tenant: 'wesign',
          project: 'qa-platform',
        } as any,
        payload: {
          task: { type: 'self-healing', description: 'Fix login test' },
          inputs: { test_id: 'login-001' },
          context_slice: { items: [] },
          budget: { max_duration_ms: 30000, max_cost_cents: 100 },
        } as any,
      });

      await transport.publish(SPECIALIST_TOPIC, request);

      // 2. Specialist receives and processes request
      const specialistReceived = vi.fn();
      const specialistHandler: A2AMessageHandler = async (envelope, ack) => {
        specialistReceived();
        expect(envelope.meta.type).toBe('SpecialistInvocationRequest');
        expect((envelope as any).payload.task.type).toBe('self-healing');

        // 3. Specialist sends response
        const response = createSpecialistInvocationResult({
          meta: {
            from: SPECIALIST_AGENT_ID,
            to: [CMO_AGENT_ID],
            reply_to: envelope.meta.message_id,
            trace_id: envelope.meta.trace_id,
          } as any,
          payload: {
            status: 'success',
            result: { fix_applied: true, selector: '#loginBtn' },
            duration_ms: 5000,
            cost_cents: 25,
          } as any,
        });

        const responseTopic = 'test:a2a:qa.wesign.test.cmo.results';
        await transport.publish(responseTopic, response);

        await ack.ack();
      };

      const specialistSub = await transport.subscribe(SPECIALIST_TOPIC, specialistHandler, {
        consumerGroup: 'specialist-group',
        consumerName: 'specialist-001',
      });

      // 4. CMO receives response
      const cmoReceived = vi.fn();
      const cmoHandler: A2AMessageHandler = async (envelope, ack) => {
        cmoReceived();
        expect(envelope.meta.type).toBe('SpecialistInvocationResult');
        expect((envelope as any).payload.status).toBe('success');
        expect((envelope as any).payload.result.fix_applied).toBe(true);

        await ack.ack();
      };

      const cmoSub = await transport.subscribe('test:a2a:qa.wesign.test.cmo.results', cmoHandler, {
        consumerGroup: 'cmo-group',
        consumerName: 'cmo-001',
      });

      // Wait for flow to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));

      await specialistSub.unsubscribe();
      await cmoSub.unsubscribe();

      expect(specialistReceived).toHaveBeenCalled();
      expect(cmoReceived).toHaveBeenCalled();
    });

    it('should handle specialist failure responses', async () => {
      const request = createSpecialistInvocationRequest();

      await transport.publish(SPECIALIST_TOPIC, request);

      const specialistHandler: A2AMessageHandler = async (envelope, ack) => {
        // Specialist returns failure
        const response = createSpecialistInvocationResult({
          meta: {
            from: SPECIALIST_AGENT_ID,
            to: [CMO_AGENT_ID],
            reply_to: envelope.meta.message_id,
            trace_id: envelope.meta.trace_id,
          } as any,
          payload: {
            status: 'failed',
            error: 'Unable to generate fix',
            duration_ms: 2000,
            cost_cents: 10,
          } as any,
        });

        await transport.publish('test:a2a:qa.wesign.test.cmo.results', response);
        await ack.ack();
      };

      const specialistSub = await transport.subscribe(SPECIALIST_TOPIC, specialistHandler, {
        consumerGroup: 'specialist-failure-group',
        consumerName: 'specialist-001',
      });

      const cmoReceivedFailure = vi.fn();
      const cmoHandler: A2AMessageHandler = async (envelope, ack) => {
        const result = envelope as any;
        if (result.payload.status === 'failed') {
          cmoReceivedFailure();
          expect(result.payload.error).toBe('Unable to generate fix');
        }
        await ack.ack();
      };

      const cmoSub = await transport.subscribe('test:a2a:qa.wesign.test.cmo.results', cmoHandler, {
        consumerGroup: 'cmo-failure-group',
        consumerName: 'cmo-001',
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      await specialistSub.unsubscribe();
      await cmoSub.unsubscribe();

      expect(cmoReceivedFailure).toHaveBeenCalled();
    });
  });

  describe('Inbound Handler Routing', () => {
    it('should route different message types to appropriate handlers', async () => {
      const taskRequestHandler = vi.fn(async (envelope: A2AEnvelope) => undefined);
      const memoryEventHandler = vi.fn(async (envelope: A2AEnvelope) => undefined);
      const systemEventHandler = vi.fn(async (envelope: A2AEnvelope) => undefined);

      const inboundHandler = createInboundHandler({
        validateEnvelopes: true,
      });

      inboundHandler.registerHandler('TaskRequest', taskRequestHandler);
      inboundHandler.registerHandler('MemoryEvent', memoryEventHandler);
      inboundHandler.registerHandler('SystemEvent', systemEventHandler);

      // Publish different message types
      await transport.publish('test:a2a:qa.wesign.test.inbound', createTaskRequest());
      await transport.publish('test:a2a:qa.wesign.test.inbound', {
        meta: createTaskRequest().meta,
        payload: { event_type: 'memory_added', memory_id: 'mem-001', details: {} },
      } as any);
      await transport.publish('test:a2a:qa.wesign.test.inbound', {
        meta: { ...createTaskRequest().meta, type: 'SystemEvent' } as any,
        payload: { event_type: 'agent_registered', severity: 'info', details: {} },
      });

      // Subscribe with inbound handler
      const messageHandler: A2AMessageHandler = async (envelope, ack) => {
        await inboundHandler.handle(envelope);
        await ack.ack();
      };

      const sub = await transport.subscribe('test:a2a:qa.wesign.test.inbound', messageHandler, {
        consumerGroup: 'inbound-routing-group',
        consumerName: 'handler-001',
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      await sub.unsubscribe();

      expect(taskRequestHandler).toHaveBeenCalled();
      expect(memoryEventHandler).toHaveBeenCalled();
      expect(systemEventHandler).toHaveBeenCalled();
    });

    it('should use default handler for unregistered message types', async () => {
      const defaultHandler = vi.fn(async (envelope: A2AEnvelope) => undefined);

      const inboundHandler = createInboundHandler({
        validateEnvelopes: true,
        defaultHandler,
      });

      const unknownEnvelope = {
        ...createTaskRequest(),
        meta: { ...createTaskRequest().meta, type: 'UnregisteredMessageType' as any },
      };

      await transport.publish('test:a2a:qa.wesign.test.inbound.default', unknownEnvelope);

      const messageHandler: A2AMessageHandler = async (envelope, ack) => {
        await inboundHandler.handle(envelope);
        await ack.ack();
      };

      const sub = await transport.subscribe('test:a2a:qa.wesign.test.inbound.default', messageHandler, {
        consumerGroup: 'default-handler-group',
        consumerName: 'handler-001',
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      await sub.unsubscribe();

      expect(defaultHandler).toHaveBeenCalled();
    });
  });

  describe('DecisionNotice Publisher', () => {
    it('should publish an approval decision', async () => {
      const publisher = createDecisionNoticePublisher({
        transport,
        tenant: 'wesign',
        project: 'qa-platform',
        cmoAgentId: CMO_AGENT_ID,
        decisionTopic: 'test:a2a:qa.wesign.test.decisions',
      });

      const decisionReceived = vi.fn();
      const handler: A2AMessageHandler = async (envelope, ack) => {
        decisionReceived();
        const payload = (envelope as any).payload;
        expect(payload.decision).toBe('approve');
        expect(payload.rationale).toBe('Test passed');
        await ack.ack();
      };

      const sub = await transport.subscribe('test:a2a:qa.wesign.test.decisions', handler, {
        consumerGroup: 'decision-group',
        consumerName: 'decision-consumer',
      });

      await publisher.approve({ proposal: 'Test proposal' }, 'Test passed');

      await new Promise((resolve) => setTimeout(resolve, 500));

      await sub.unsubscribe();

      expect(decisionReceived).toHaveBeenCalled();
    });

    it('should publish a rejection decision', async () => {
      const publisher = createDecisionNoticePublisher({
        transport,
        tenant: 'wesign',
        project: 'qa-platform',
        cmoAgentId: CMO_AGENT_ID,
        decisionTopic: 'test:a2a:qa.wesign.test.decisions',
      });

      const decisionReceived = vi.fn();
      const handler: A2AMessageHandler = async (envelope, ack) => {
        decisionReceived();
        const payload = (envelope as any).payload;
        expect(payload.decision).toBe('reject');
        expect(payload.rejectionReasons).toContain('Insufficient data');
        await ack.ack();
      };

      const sub = await transport.subscribe('test:a2a:qa.wesign.test.decisions', handler, {
        consumerGroup: 'rejection-group',
        consumerName: 'decision-consumer',
      });

      await publisher.reject('Test failed', ['Insufficient data', 'Invalid input']);

      await new Promise((resolve) => setTimeout(resolve, 500));

      await sub.unsubscribe();

      expect(decisionReceived).toHaveBeenCalled();
    });

    it('should publish a defer decision', async () => {
      const publisher = createDecisionNoticePublisher({
        transport,
        tenant: 'wesign',
        project: 'qa-platform',
        cmoAgentId: CMO_AGENT_ID,
        decisionTopic: 'test:a2a:qa.wesign.test.decisions',
      });

      const decisionReceived = vi.fn();
      const handler: A2AMessageHandler = async (envelope, ack) => {
        decisionReceived();
        const payload = (envelope as any).payload;
        expect(payload.decision).toBe('defer');
        await ack.ack();
      };

      const sub = await transport.subscribe('test:a2a:qa.wesign.test.decisions', handler, {
        consumerGroup: 'defer-group',
        consumerName: 'decision-consumer',
      });

      await publisher.defer('Awaiting additional data', 'Waiting for more context');

      await new Promise((resolve) => setTimeout(resolve, 500));

      await sub.unsubscribe();

      expect(decisionReceived).toHaveBeenCalled();
    });
  });

  describe('OPA Wire Gates Integration', () => {
    it('should allow message when OPA policy permits', async () => {
      mockOPA.registerPolicy('a2a/wire_gates', createAlwaysAllowPolicy());

      const opaGates = new OPAWireGates({
        url: 'http://mock-opa:8181',
        preSendPolicyPath: 'a2a/wire_gates',
        disabled: false,
      });

      // Mock the OPA query to use our mock server
      vi.spyOn(opaGates as any, 'queryOPA').mockImplementation(async (policyPath: string, input: any) => {
        return mockOPA.evaluate(policyPath, input);
      });

      const envelope = createTaskRequest();

      const result = await opaGates.checkPreSend(envelope);

      expect(result.allow).toBe(true);
      expect(mockOPA.getCallCount('a2a/wire_gates')).toBe(1);
    });

    it('should reject message when OPA policy denies', async () => {
      mockOPA.registerPolicy('a2a/wire_gates', createAlwaysDenyPolicy('Policy violation'));

      const opaGates = new OPAWireGates({
        url: 'http://mock-opa:8181',
        preSendPolicyPath: 'a2a/wire_gates',
        disabled: false,
      });

      vi.spyOn(opaGates as any, 'queryOPA').mockImplementation(async (policyPath: string, input: any) => {
        return mockOPA.evaluate(policyPath, input);
      });

      const envelope = createTaskRequest();

      const result = await opaGates.checkPreSend(envelope);

      expect(result.allow).toBe(false);
      expect(result.reason).toBe('Policy violation');
    });

    it('should enforce tenant-based policy', async () => {
      mockOPA.registerPolicy('a2a/wire_gates', createTenantPolicy('wesign'));

      const opaGates = new OPAWireGates({
        url: 'http://mock-opa:8181',
        preSendPolicyPath: 'a2a/wire_gates',
        disabled: false,
      });

      vi.spyOn(opaGates as any, 'queryOPA').mockImplementation(async (policyPath: string, input: any) => {
        return mockOPA.evaluate(policyPath, input);
      });

      const validEnvelope = createTaskRequest({
        meta: { tenant: 'wesign' } as any,
      });

      const invalidEnvelope = createTaskRequest({
        meta: { tenant: 'other-tenant' } as any,
      });

      const validResult = await opaGates.checkPreSend(validEnvelope);
      const invalidResult = await opaGates.checkPreSend(invalidEnvelope);

      expect(validResult.allow).toBe(true);
      expect(invalidResult.allow).toBe(false);
    });

    it('should enforce message-type policy', async () => {
      mockOPA.registerPolicy('a2a/wire_gates', createMessageTypePolicy(['TaskRequest', 'TaskResult']));

      const opaGates = new OPAWireGates({
        url: 'http://mock-opa:8181',
        preSendPolicyPath: 'a2a/wire_gates',
        disabled: false,
      });

      vi.spyOn(opaGates as any, 'queryOPA').mockImplementation(async (policyPath: string, input: any) => {
        return mockOPA.evaluate(policyPath, input);
      });

      const allowedEnvelope = createTaskRequest();
      const deniedEnvelope = {
        ...createTaskRequest(),
        meta: { ...createTaskRequest().meta, type: 'MemoryEvent' as any },
      };

      const allowedResult = await opaGates.checkPreSend(allowedEnvelope);
      const deniedResult = await opaGates.checkPreSend(deniedEnvelope);

      expect(allowedResult.allow).toBe(true);
      expect(deniedResult.allow).toBe(false);
    });

    it('should bypass OPA when disabled', async () => {
      const opaGates = new OPAWireGates({
        url: 'http://mock-opa:8181',
        preSendPolicyPath: 'a2a/wire_gates',
        disabled: true,
      });

      const envelope = createTaskRequest();

      const result = await opaGates.checkPreSend(envelope);

      expect(result.allow).toBe(true);
      expect(mockOPA.getCallCount('a2a/wire_gates')).toBe(0);
    });
  });

  describe('Complete E2E Flow with All Components', () => {
    it('should complete a full flow: CMO → OPA → Specialist → Decision → Publish', async () => {
      // 1. Setup OPA
      mockOPA.registerPolicy('a2a/wire_gates', createAlwaysAllowPolicy());

      const opaGates = new OPAWireGates({
        url: 'http://mock-opa:8181',
        preSendPolicyPath: 'a2a/wire_gates',
        postReceivePolicyPath: 'a2a/wire_gates',
        disabled: false,
      });

      vi.spyOn(opaGates as any, 'queryOPA').mockImplementation(async (policyPath: string, input: any) => {
        return mockOPA.evaluate(policyPath, input);
      });

      // 2. Setup Inbound Handler
      const inboundHandler = createInboundHandler({
        validateEnvelopes: true,
        opaGates,
      });

      inboundHandler.registerHandler('SpecialistInvocationRequest', async (envelope) => {
        // Process request and return result
        return createSpecialistInvocationResult({
          meta: {
            from: SPECIALIST_AGENT_ID,
            to: [(envelope as any).meta.from],
            reply_to: envelope.meta.message_id,
            trace_id: envelope.meta.trace_id,
          } as any,
          payload: {
            status: 'success',
            result: { fix: 'applied' },
            duration_ms: 3000,
            cost_cents: 15,
          } as any,
        });
      });

      // 3. Setup Decision Publisher
      const decisionPublisher = createDecisionNoticePublisher({
        transport,
        tenant: 'wesign',
        project: 'qa-platform',
        cmoAgentId: CMO_AGENT_ID,
        decisionTopic: 'test:a2a:qa.wesign.test.decisions.final',
      });

      // 4. CMO publishes request
      const request = createSpecialistInvocationRequest({
        meta: {
          from: CMO_AGENT_ID,
          to: [SPECIALIST_AGENT_ID],
        } as any,
      });

      // Check OPA pre-send
      const preSendCheck = await opaGates.checkPreSend(request);
      expect(preSendCheck.allow).toBe(true);

      await transport.publish(SPECIALIST_TOPIC, request);

      // 5. Specialist receives and processes
      const specialistHandler: A2AMessageHandler = async (envelope, ack) => {
        const response = await inboundHandler.handle(envelope);
        if (response) {
          await transport.publish('test:a2a:qa.wesign.test.cmo.results.final', response);
        }
        await ack.ack();
      };

      const specialistSub = await transport.subscribe(SPECIALIST_TOPIC, specialistHandler, {
        consumerGroup: 'specialist-e2e-group',
        consumerName: 'specialist-001',
      });

      // 6. CMO receives response and publishes decision
      const decisionPublished = vi.fn();
      const cmoHandler: A2AMessageHandler = async (envelope, ack) => {
        const result = (envelope as any).payload;
        if (result.status === 'success') {
          await decisionPublisher.approve(result.result, 'Specialist succeeded');
          decisionPublished();
        }
        await ack.ack();
      };

      const cmoSub = await transport.subscribe('test:a2a:qa.wesign.test.cmo.results.final', cmoHandler, {
        consumerGroup: 'cmo-e2e-group',
        consumerName: 'cmo-001',
      });

      // 7. Decision consumer receives decision
      const decisionReceived = vi.fn();
      const decisionHandler: A2AMessageHandler = async (envelope, ack) => {
        decisionReceived();
        const payload = (envelope as any).payload;
        expect(payload.decision).toBe('approve');
        await ack.ack();
      };

      const decisionSub = await transport.subscribe('test:a2a:qa.wesign.test.decisions.final', decisionHandler, {
        consumerGroup: 'decision-e2e-group',
        consumerName: 'decision-consumer',
      });

      // Wait for full flow
      await new Promise((resolve) => setTimeout(resolve, 1500));

      await specialistSub.unsubscribe();
      await cmoSub.unsubscribe();
      await decisionSub.unsubscribe();

      expect(decisionPublished).toHaveBeenCalled();
      expect(decisionReceived).toHaveBeenCalled();
      expect(mockOPA.getCallCount('a2a/wire_gates')).toBeGreaterThan(0);
    });
  });

  describe('Error Propagation E2E', () => {
    it('should handle errors throughout the complete flow', async () => {
      const request = createSpecialistInvocationRequest();

      await transport.publish(SPECIALIST_TOPIC, request);

      // Specialist throws error
      const specialistErrorHandler: A2AMessageHandler = async (envelope, ack) => {
        throw new Error('Specialist processing error');
      };

      const specialistSub = await transport.subscribe(SPECIALIST_TOPIC, specialistErrorHandler, {
        consumerGroup: 'specialist-error-e2e-group',
        consumerName: 'specialist-001',
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      await specialistSub.unsubscribe();

      // Message should be redelivered or sent to DLQ
      // Verify it wasn't lost
    });
  });
});
