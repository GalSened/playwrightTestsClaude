/**
 * A2A Security Tests
 * JWT verification, capability tokens, signing, replay protection, idempotency
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  verifyJWT,
  tokenHasScope,
  createJWTVerificationConfig,
  type A2AJWTClaims,
} from '../../src/a2a/security/jwt.js';
import {
  signEnvelope,
  verifyEnvelopeSignature,
  generateIdempotencyKey,
  checkReplayProtection,
  type SigningConfig,
  type SignatureVerificationResult,
} from '../../src/a2a/security/signer.js';
import {
  createFakeJWT,
  createExpiredJWT,
  createMalformedJWT,
  createJWTMissingClaims,
  createTestVerificationConfig,
  createJWTWithScopes,
  createJWTForTenantProject,
  TEST_SECRET,
  TEST_RSA_KEYS,
} from '../utils/fakeJwt.js';
import {
  createFakeCapabilityToken,
  createExpiredCapabilityToken,
  createMalformedCapabilityToken,
  verifyCapabilityToken,
  createCapTokenForGrant,
  createTestCapTokenSet,
} from '../utils/capToken.js';
import { createTaskRequest } from '../utils/envelopes.js';
import { createVirtualClock, VirtualClock } from '../utils/clock.js';

describe('A2A Security Tests', () => {
  describe('JWT Verification', () => {
    describe('Valid JWT (HS256)', () => {
      it('should verify a valid HS256 JWT', () => {
        const token = createFakeJWT({ algorithm: 'HS256' });
        const config = createTestVerificationConfig('HS256');
        const result = verifyJWT(token, config);

        expect(result.valid).toBe(true);
        expect(result.claims).toBeDefined();
        expect(result.claims?.sub).toBe('test-agent-001');
        expect(result.claims?.tenant).toBe('test-tenant');
        expect(result.claims?.project).toBe('test-project');
        expect(result.claims?.scopes).toContain('*');
      });

      it('should verify JWT with specific scopes', () => {
        const token = createJWTWithScopes(['context.read:*', 'specialists.invoke:*']);
        const config = createTestVerificationConfig('HS256');
        const result = verifyJWT(token, config);

        expect(result.valid).toBe(true);
        expect(result.claims?.scopes).toHaveLength(2);
        expect(result.claims?.scopes).toContain('context.read:*');
      });

      it('should verify JWT for specific tenant and project', () => {
        const token = createJWTForTenantProject('wesign', 'qa-platform');
        const config = createTestVerificationConfig('HS256');
        const result = verifyJWT(token, config);

        expect(result.valid).toBe(true);
        expect(result.claims?.tenant).toBe('wesign');
        expect(result.claims?.project).toBe('qa-platform');
      });
    });

    describe('Valid JWT (RS256)', () => {
      it('should verify a valid RS256 JWT', () => {
        const token = createFakeJWT({ algorithm: 'RS256' });
        const config = createTestVerificationConfig('RS256');
        const result = verifyJWT(token, config);

        expect(result.valid).toBe(true);
        expect(result.claims).toBeDefined();
      });
    });

    describe('Invalid JWT - Expiry', () => {
      it('should reject an expired JWT', () => {
        const token = createExpiredJWT();
        const config = createTestVerificationConfig('HS256');
        const result = verifyJWT(token, config);

        expect(result.valid).toBe(false);
        expect(result.errorCode).toMatch(/E_JWT_(EXPIRED|INVALID)/);
      });
    });

    describe('Invalid JWT - Signature', () => {
      it('should reject a JWT with invalid signature', () => {
        const token = createMalformedJWT();
        const config = createTestVerificationConfig('HS256');
        const result = verifyJWT(token, config);

        expect(result.valid).toBe(false);
        expect(result.errorCode).toMatch(/E_JWT_(INVALID|SIGNATURE)/);
      });

      it('should reject a JWT signed with wrong secret', () => {
        const token = createFakeJWT({ algorithm: 'HS256' });
        const config = createTestVerificationConfig('HS256');
        config.key = 'wrong-secret-key';

        const result = verifyJWT(token, config);

        expect(result.valid).toBe(false);
      });
    });

    describe('Invalid JWT - Missing Claims', () => {
      it('should reject JWT missing sub claim', () => {
        const token = createJWTMissingClaims('sub');
        const config = createTestVerificationConfig('HS256');
        const result = verifyJWT(token, config);

        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe('E_JWT_INVALID_CLAIMS');
      });

      it('should reject JWT missing tenant claim', () => {
        const token = createJWTMissingClaims('tenant');
        const config = createTestVerificationConfig('HS256');
        const result = verifyJWT(token, config);

        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe('E_JWT_INVALID_CLAIMS');
      });

      it('should reject JWT missing project claim', () => {
        const token = createJWTMissingClaims('project');
        const config = createTestVerificationConfig('HS256');
        const result = verifyJWT(token, config);

        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe('E_JWT_INVALID_CLAIMS');
      });

      it('should reject JWT missing scopes claim', () => {
        const token = createJWTMissingClaims('scopes');
        const config = createTestVerificationConfig('HS256');
        const result = verifyJWT(token, config);

        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe('E_JWT_INVALID_CLAIMS');
      });
    });

    describe('JWT Scope Matching', () => {
      it('should match wildcard scope', () => {
        const claims: A2AJWTClaims = {
          sub: 'agent-001',
          tenant: 'test',
          project: 'test',
          scopes: ['*'],
        };

        expect(tokenHasScope(claims, 'context.read:test_results')).toBe(true);
        expect(tokenHasScope(claims, 'specialists.invoke:healing')).toBe(true);
      });

      it('should match prefix wildcard scope', () => {
        const claims: A2AJWTClaims = {
          sub: 'agent-001',
          tenant: 'test',
          project: 'test',
          scopes: ['context.read:*'],
        };

        expect(tokenHasScope(claims, 'context.read:test_results')).toBe(true);
        expect(tokenHasScope(claims, 'context.read:anything')).toBe(true);
        expect(tokenHasScope(claims, 'context.write:test_results')).toBe(false);
      });

      it('should match exact scope', () => {
        const claims: A2AJWTClaims = {
          sub: 'agent-001',
          tenant: 'test',
          project: 'test',
          scopes: ['context.read:test_results'],
        };

        expect(tokenHasScope(claims, 'context.read:test_results')).toBe(true);
        expect(tokenHasScope(claims, 'context.read:other')).toBe(false);
      });

      it('should match multiple scopes', () => {
        const claims: A2AJWTClaims = {
          sub: 'agent-001',
          tenant: 'test',
          project: 'test',
          scopes: ['context.read:*', 'specialists.invoke:healing'],
        };

        expect(tokenHasScope(claims, 'context.read:test_results')).toBe(true);
        expect(tokenHasScope(claims, 'specialists.invoke:healing')).toBe(true);
        expect(tokenHasScope(claims, 'specialists.invoke:other')).toBe(false);
      });
    });
  });

  describe('Capability Tokens', () => {
    describe('Valid Capability Tokens', () => {
      it('should create and verify a valid capability token', () => {
        const token = createFakeCapabilityToken({ grant: 'context.read:*' });
        const result = verifyCapabilityToken(token);

        expect(result.valid).toBe(true);
        expect(result.claims).toBeDefined();
        expect(result.claims.grant).toBe('context.read:*');
      });

      it('should create capability token with resource constraint', () => {
        const token = createFakeCapabilityToken({
          grant: 'context.read:test_results',
          resource: 'test-123',
        });
        const result = verifyCapabilityToken(token);

        expect(result.valid).toBe(true);
        expect(result.claims.resource).toBe('test-123');
      });

      it('should create capability token with custom constraints', () => {
        const token = createFakeCapabilityToken({
          grant: 'specialists.invoke:healing',
          constraints: { max_duration_ms: 30000, max_cost_cents: 100 },
        });
        const result = verifyCapabilityToken(token);

        expect(result.valid).toBe(true);
        expect(result.claims.constraints).toHaveProperty('max_duration_ms');
      });
    });

    describe('Invalid Capability Tokens', () => {
      it('should reject an expired capability token', () => {
        const token = createExpiredCapabilityToken({ grant: 'context.read:*' });
        const result = verifyCapabilityToken(token);

        expect(result.valid).toBe(false);
        expect(result.error).toContain('expired');
      });

      it('should reject a malformed capability token', () => {
        const token = createMalformedCapabilityToken({ grant: 'context.read:*' });
        const result = verifyCapabilityToken(token);

        expect(result.valid).toBe(false);
      });
    });

    describe('Capability Token Set', () => {
      it('should create a set of capability tokens for common grants', () => {
        const tokens = createTestCapTokenSet();

        expect(verifyCapabilityToken(tokens.contextRead).valid).toBe(true);
        expect(verifyCapabilityToken(tokens.contextWrite).valid).toBe(true);
        expect(verifyCapabilityToken(tokens.specialistInvoke).valid).toBe(true);
        expect(verifyCapabilityToken(tokens.adminWildcard).valid).toBe(true);
      });
    });
  });

  describe('Message Signing (HMAC)', () => {
    describe('Valid Signatures', () => {
      it('should sign and verify envelope with SHA-256', () => {
        const envelope = createTaskRequest();
        const config: SigningConfig = {
          algorithm: 'sha256',
          secretKey: TEST_SECRET,
        };

        const signature = signEnvelope(envelope, config);

        expect(signature).toBeDefined();
        expect(signature).toMatch(/^[a-f0-9]{64}$/); // SHA-256 produces 64 hex chars
      });

      it('should sign and verify envelope with SHA-512', () => {
        const envelope = createTaskRequest();
        const config: SigningConfig = {
          algorithm: 'sha512',
          secretKey: TEST_SECRET,
        };

        const signature = signEnvelope(envelope, config);

        expect(signature).toBeDefined();
        expect(signature).toMatch(/^[a-f0-9]{128}$/); // SHA-512 produces 128 hex chars
      });

      it('should verify a correctly signed envelope', () => {
        const envelope = createTaskRequest();
        const config: SigningConfig = {
          algorithm: 'sha256',
          secretKey: TEST_SECRET,
        };

        const signature = signEnvelope(envelope, config);
        const result = verifyEnvelopeSignature(envelope, signature, config);

        expect(result.valid).toBe(true);
      });

      it('should produce consistent signatures for identical envelopes', () => {
        const envelope = createTaskRequest();
        const config: SigningConfig = {
          algorithm: 'sha256',
          secretKey: TEST_SECRET,
        };

        const sig1 = signEnvelope(envelope, config);
        const sig2 = signEnvelope(envelope, config);

        expect(sig1).toBe(sig2);
      });
    });

    describe('Invalid Signatures', () => {
      it('should reject envelope with incorrect signature', () => {
        const envelope = createTaskRequest();
        const config: SigningConfig = {
          algorithm: 'sha256',
          secretKey: TEST_SECRET,
        };

        const signature = signEnvelope(envelope, config);
        const tamperedSignature = signature.split('').reverse().join('');

        const result = verifyEnvelopeSignature(envelope, tamperedSignature, config);

        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe('E_SIGNATURE_MISMATCH');
      });

      it('should reject envelope signed with different secret', () => {
        const envelope = createTaskRequest();
        const signingConfig: SigningConfig = {
          algorithm: 'sha256',
          secretKey: TEST_SECRET,
        };
        const verifyConfig: SigningConfig = {
          algorithm: 'sha256',
          secretKey: 'different-secret',
        };

        const signature = signEnvelope(envelope, signingConfig);
        const result = verifyEnvelopeSignature(envelope, signature, verifyConfig);

        expect(result.valid).toBe(false);
      });

      it('should detect envelope tampering after signing', () => {
        const envelope = createTaskRequest();
        const config: SigningConfig = {
          algorithm: 'sha256',
          secretKey: TEST_SECRET,
        };

        const signature = signEnvelope(envelope, config);

        // Tamper with envelope
        (envelope.payload as any).task_type = 'TAMPERED';

        const result = verifyEnvelopeSignature(envelope, signature, config);

        expect(result.valid).toBe(false);
      });
    });
  });

  describe('Replay Protection', () => {
    let clock: VirtualClock;

    beforeEach(() => {
      clock = createVirtualClock(new Date('2025-01-15T12:00:00.000Z'));
      clock.install();
    });

    afterEach(() => {
      clock.uninstall();
    });

    describe('Timestamp Freshness', () => {
      it('should accept message within freshness window', () => {
        const envelope = createTaskRequest({
          meta: { ts: clock.nowAsISO() } as any,
        });

        const result = checkReplayProtection(envelope, {
          freshnessWindowSeconds: 300, // 5 minutes
        });

        expect(result.valid).toBe(true);
      });

      it('should accept message just inside freshness window', async () => {
        const envelope = createTaskRequest({
          meta: { ts: clock.nowAsISO() } as any,
        });

        // Advance time to 299 seconds (just inside 300s window)
        await clock.tick(299 * 1000);

        const result = checkReplayProtection(envelope, {
          freshnessWindowSeconds: 300,
        });

        expect(result.valid).toBe(true);
      });

      it('should reject message outside freshness window', async () => {
        const envelope = createTaskRequest({
          meta: { ts: clock.nowAsISO() } as any,
        });

        // Advance time to 301 seconds (outside 300s window)
        await clock.tick(301 * 1000);

        const result = checkReplayProtection(envelope, {
          freshnessWindowSeconds: 300,
        });

        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe('E_REPLAY_TIMESTAMP_STALE');
      });

      it('should reject message from the future', () => {
        const futureTime = clock.futureTime(60 * 1000).toISOString();
        const envelope = createTaskRequest({
          meta: { ts: futureTime } as any,
        });

        const result = checkReplayProtection(envelope, {
          freshnessWindowSeconds: 300,
        });

        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe('E_REPLAY_TIMESTAMP_FUTURE');
      });

      it('should support configurable freshness window', async () => {
        const envelope = createTaskRequest({
          meta: { ts: clock.nowAsISO() } as any,
        });

        await clock.tick(600 * 1000); // 10 minutes

        const result1 = checkReplayProtection(envelope, {
          freshnessWindowSeconds: 300, // 5 minutes
        });
        const result2 = checkReplayProtection(envelope, {
          freshnessWindowSeconds: 900, // 15 minutes
        });

        expect(result1.valid).toBe(false);
        expect(result2.valid).toBe(true);
      });
    });
  });

  describe('Idempotency Key Generation', () => {
    it('should generate idempotency key from envelope', () => {
      const envelope = createTaskRequest();
      const key = generateIdempotencyKey(envelope);

      expect(key).toBeDefined();
      expect(key).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hash
    });

    it('should generate identical keys for identical envelopes', () => {
      const envelope = createTaskRequest({
        meta: {
          message_id: 'fixed-message-id-001',
          trace_id: 'fixed-trace-001',
          ts: '2025-01-15T12:00:00.000Z',
        } as any,
      });
      envelope.meta.from.id = 'fixed-agent-001';

      const key1 = generateIdempotencyKey(envelope);
      const key2 = generateIdempotencyKey(envelope);

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different message_ids', () => {
      const envelope1 = createTaskRequest({
        meta: { message_id: 'msg-001' } as any,
      });
      const envelope2 = createTaskRequest({
        meta: { message_id: 'msg-002' } as any,
      });

      const key1 = generateIdempotencyKey(envelope1);
      const key2 = generateIdempotencyKey(envelope2);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different trace_ids', () => {
      const envelope1 = createTaskRequest({
        meta: { trace_id: 'trace-001' } as any,
      });
      const envelope2 = createTaskRequest({
        meta: { trace_id: 'trace-002' } as any,
      });

      const key1 = generateIdempotencyKey(envelope1);
      const key2 = generateIdempotencyKey(envelope2);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different timestamps', () => {
      const envelope1 = createTaskRequest({
        meta: { ts: '2025-01-15T12:00:00.000Z' } as any,
      });
      const envelope2 = createTaskRequest({
        meta: { ts: '2025-01-15T12:00:01.000Z' } as any,
      });

      const key1 = generateIdempotencyKey(envelope1);
      const key2 = generateIdempotencyKey(envelope2);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different senders', () => {
      const envelope1 = createTaskRequest();
      envelope1.meta.from.id = 'agent-001';

      const envelope2 = createTaskRequest();
      envelope2.meta.from.id = 'agent-002';

      const key1 = generateIdempotencyKey(envelope1);
      const key2 = generateIdempotencyKey(envelope2);

      expect(key1).not.toBe(key2);
    });
  });

  describe('Security Integration', () => {
    it('should combine JWT + signature + replay protection', async () => {
      const clock = createVirtualClock(new Date('2025-01-15T12:00:00.000Z'));
      clock.install();

      // 1. Create JWT
      const jwt = createFakeJWT({ agentId: 'agent-001', scopes: ['*'] });
      const jwtConfig = createTestVerificationConfig('HS256');
      const jwtResult = verifyJWT(jwt, jwtConfig);
      expect(jwtResult.valid).toBe(true);

      // 2. Create envelope
      const envelope = createTaskRequest({
        meta: { ts: clock.nowAsISO() } as any,
      });

      // 3. Sign envelope
      const signingConfig: SigningConfig = {
        algorithm: 'sha256',
        secretKey: TEST_SECRET,
      };
      const signature = signEnvelope(envelope, signingConfig);
      const sigResult = verifyEnvelopeSignature(envelope, signature, signingConfig);
      expect(sigResult.valid).toBe(true);

      // 4. Check replay protection
      const replayResult = checkReplayProtection(envelope, {
        freshnessWindowSeconds: 300,
      });
      expect(replayResult.valid).toBe(true);

      clock.uninstall();
    });

    it('should reject envelope with valid JWT but stale timestamp', async () => {
      const clock = createVirtualClock(new Date('2025-01-15T12:00:00.000Z'));
      clock.install();

      // Create envelope with current timestamp
      const envelope = createTaskRequest({
        meta: { ts: clock.nowAsISO() } as any,
      });

      // Advance time to make envelope stale
      await clock.tick(400 * 1000); // 400 seconds

      // JWT is still valid
      const jwt = createFakeJWT();
      const jwtResult = verifyJWT(jwt, createTestVerificationConfig('HS256'));
      expect(jwtResult.valid).toBe(true);

      // But replay protection should fail
      const replayResult = checkReplayProtection(envelope, {
        freshnessWindowSeconds: 300,
      });
      expect(replayResult.valid).toBe(false);

      clock.uninstall();
    });
  });

  describe('Performance & Edge Cases', () => {
    it('should verify 1000 JWTs in reasonable time', () => {
      const startTime = Date.now();
      const config = createTestVerificationConfig('HS256');

      for (let i = 0; i < 1000; i++) {
        const token = createFakeJWT();
        verifyJWT(token, config);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // < 5s for 1000 verifications
    });

    it('should handle malformed JWT gracefully', () => {
      const config = createTestVerificationConfig('HS256');
      const result = verifyJWT('not-a-valid-jwt', config);

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBeDefined();
    });

    it('should handle empty signature gracefully', () => {
      const envelope = createTaskRequest();
      const config: SigningConfig = {
        algorithm: 'sha256',
        secretKey: TEST_SECRET,
      };

      const result = verifyEnvelopeSignature(envelope, '', config);

      expect(result.valid).toBe(false);
    });
  });
});
