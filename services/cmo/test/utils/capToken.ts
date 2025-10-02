/**
 * Capability Token Test Helper
 * Fake capability token creation for A2A tests
 */

import * as jwt from 'jsonwebtoken';
import { TEST_SECRET } from './fakeJwt.js';
import type { CapabilityToken } from '../../src/a2a/security/jwt.js';

/**
 * Capability token payload
 */
export interface CapabilityTokenPayload {
  grant: string; // e.g., "context.read:test_results"
  resource?: string; // Optional resource identifier
  constraints?: Record<string, unknown>;
  expiresIn?: string | number;
}

/**
 * Create a fake capability token (nested JWS)
 */
export function createFakeCapabilityToken(
  payload: CapabilityTokenPayload,
  secret: string = TEST_SECRET
): string {
  const claims = {
    grant: payload.grant,
    resource: payload.resource,
    constraints: payload.constraints,
  };

  return jwt.sign(claims, secret, {
    algorithm: 'HS256',
    expiresIn: payload.expiresIn || '5m',
    issuer: 'qa-intel-test-captoken',
  });
}

/**
 * Create an expired capability token
 */
export function createExpiredCapabilityToken(
  payload: CapabilityTokenPayload,
  secret: string = TEST_SECRET
): string {
  const claims = {
    grant: payload.grant,
    resource: payload.resource,
    constraints: payload.constraints,
  };

  return jwt.sign(claims, secret, {
    algorithm: 'HS256',
    expiresIn: -1, // Expired 1 second ago
    issuer: 'qa-intel-test-captoken',
  });
}

/**
 * Create a malformed capability token
 */
export function createMalformedCapabilityToken(
  payload: CapabilityTokenPayload,
  secret: string = TEST_SECRET
): string {
  const token = createFakeCapabilityToken(payload, secret);
  const parts = token.split('.');
  // Corrupt the signature
  const corruptedSig = parts[2].split('').reverse().join('');
  return `${parts[0]}.${parts[1]}.${corruptedSig}`;
}

/**
 * Verify a capability token (test helper)
 */
export function verifyCapabilityToken(
  token: string,
  secret: string = TEST_SECRET
): { valid: boolean; claims?: any; error?: string } {
  try {
    const claims = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      issuer: 'qa-intel-test-captoken',
    });
    return { valid: true, claims };
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
}

/**
 * Decode capability token without verification
 */
export function decodeCapabilityToken(token: string): any {
  return jwt.decode(token);
}

/**
 * Create capability token with specific grant
 */
export function createCapTokenForGrant(
  grant: string,
  options: { resource?: string; constraints?: Record<string, unknown>; expiresIn?: string | number } = {}
): string {
  return createFakeCapabilityToken({
    grant,
    resource: options.resource,
    constraints: options.constraints,
    expiresIn: options.expiresIn,
  });
}

/**
 * Create capability token set for common test scenarios
 */
export function createTestCapTokenSet(): {
  contextRead: string;
  contextWrite: string;
  specialistInvoke: string;
  adminWildcard: string;
} {
  return {
    contextRead: createCapTokenForGrant('context.read:*'),
    contextWrite: createCapTokenForGrant('context.write:*'),
    specialistInvoke: createCapTokenForGrant('specialists.invoke:*'),
    adminWildcard: createCapTokenForGrant('*'),
  };
}
