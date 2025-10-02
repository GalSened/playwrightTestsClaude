/**
 * JWT Verification for A2A Messaging
 * Verifies JWT tokens attached to A2A envelopes for authentication
 */

import jwt from 'jsonwebtoken';
import type { JwtPayload, VerifyOptions } from 'jsonwebtoken';
import { JWTErrorCode as ErrorCode } from './errors.js';

/**
 * JWT claims expected in A2A tokens
 */
export interface A2AJWTClaims extends JwtPayload {
  /**
   * Subject: agent_id
   */
  sub: string;

  /**
   * Tenant identifier
   */
  tenant: string;

  /**
   * Project identifier
   */
  project: string;

  /**
   * Scopes/permissions (array of scope strings)
   * Examples: "context.read:*", "repo.write:healing/*", "admin"
   */
  scopes: string[];

  /**
   * Issuer (control-plane identifier)
   */
  iss?: string;

  /**
   * Audience (service/API identifier)
   */
  aud?: string | string[];

  /**
   * Issued at (Unix timestamp)
   */
  iat?: number;

  /**
   * Expiration time (Unix timestamp)
   */
  exp?: number;

  /**
   * Not before (Unix timestamp)
   */
  nbf?: number;

  /**
   * JWT ID (unique identifier for this token)
   */
  jti?: string;
}

/**
 * JWT verification configuration
 */
export interface JWTVerificationConfig {
  /**
   * Secret key for HS256 or public key for RS256
   */
  key: string;

  /**
   * Algorithm (default: HS256)
   */
  algorithm?: 'HS256' | 'RS256';

  /**
   * Expected issuer (optional)
   */
  issuer?: string;

  /**
   * Expected audience (optional)
   */
  audience?: string | string[];

  /**
   * Clock tolerance in seconds (default: 0)
   */
  clockTolerance?: number;
}

/**
 * JWT verification result
 */
export interface JWTVerificationResult {
  /**
   * Whether verification succeeded
   */
  valid: boolean;

  /**
   * Decoded claims (if valid)
   */
  claims?: A2AJWTClaims;

  /**
   * Error code (if invalid)
   */
  errorCode?: string;

  /**
   * Error message (if invalid)
   */
  errorMessage?: string;
}

/**
 * JWT error codes (re-exported from errors.ts for backwards compatibility)
 */
export { JWTErrorCode } from './errors.js';

/**
 * Verify JWT token
 *
 * @param token - JWT token string
 * @param config - Verification configuration
 * @returns Verification result
 */
export function verifyJWT(
  token: string,
  config: JWTVerificationConfig
): JWTVerificationResult {
  try {
    // Prepare verification options
    const options: VerifyOptions = {
      algorithms: [config.algorithm || 'HS256'],
      issuer: config.issuer,
      audience: config.audience,
      clockTolerance: config.clockTolerance || 0,
    };

    // Verify and decode token
    const decoded = jwt.verify(token, config.key, options) as A2AJWTClaims;

    // Validate required claims
    const validationResult = validateClaims(decoded);
    if (!validationResult.valid) {
      return validationResult;
    }

    return {
      valid: true,
      claims: decoded,
    };
  } catch (error) {
    const err = error as Error;

    // Map JWT errors to our error codes
    if (err.name === 'TokenExpiredError') {
      return {
        valid: false,
        errorCode: ErrorCode.EXPIRED,
        errorMessage: 'JWT token has expired',
      };
    }

    if (err.name === 'NotBeforeError') {
      return {
        valid: false,
        errorCode: ErrorCode.NOT_BEFORE,
        errorMessage: 'JWT token not yet valid (nbf claim)',
      };
    }

    if (err.name === 'JsonWebTokenError') {
      if (err.message.includes('invalid signature')) {
        return {
          valid: false,
          errorCode: ErrorCode.INVALID_SIGNATURE,
          errorMessage: 'JWT signature verification failed',
        };
      }

      if (err.message.includes('jwt malformed')) {
        return {
          valid: false,
          errorCode: ErrorCode.MALFORMED,
          errorMessage: 'JWT token is malformed',
        };
      }

      if (err.message.includes('invalid issuer')) {
        return {
          valid: false,
          errorCode: ErrorCode.INVALID_ISSUER,
          errorMessage: 'JWT issuer mismatch',
        };
      }

      if (err.message.includes('invalid audience')) {
        return {
          valid: false,
          errorCode: ErrorCode.INVALID_AUDIENCE,
          errorMessage: 'JWT audience mismatch',
        };
      }
    }

    // Generic error
    return {
      valid: false,
      errorCode: ErrorCode.INVALID_CLAIMS,
      errorMessage: err.message || 'JWT verification failed',
    };
  }
}

/**
 * Validate required A2A claims
 */
function validateClaims(claims: Partial<A2AJWTClaims>): JWTVerificationResult {
  // Required claims: sub, tenant, project, scopes
  const requiredClaims: Array<keyof A2AJWTClaims> = ['sub', 'tenant', 'project', 'scopes'];

  for (const claim of requiredClaims) {
    if (!claims[claim]) {
      return {
        valid: false,
        errorCode: ErrorCode.INVALID_CLAIMS,
        errorMessage: `Missing required claim: ${claim}`,
      };
    }
  }

  // Validate scopes is an array
  if (!Array.isArray(claims.scopes)) {
    return {
      valid: false,
      errorCode: ErrorCode.INVALID_CLAIMS,
      errorMessage: 'Claim "scopes" must be an array',
    };
  }

  // Validate tenant and project format (lowercase alphanumeric, hyphens, underscores)
  const idPattern = /^[a-z0-9_-]+$/;

  if (!idPattern.test(claims.tenant!)) {
    return {
      valid: false,
      errorCode: ErrorCode.INVALID_CLAIMS,
      errorMessage: 'Claim "tenant" must be lowercase alphanumeric (with hyphens/underscores)',
    };
  }

  if (!idPattern.test(claims.project!)) {
    return {
      valid: false,
      errorCode: ErrorCode.INVALID_CLAIMS,
      errorMessage: 'Claim "project" must be lowercase alphanumeric (with hyphens/underscores)',
    };
  }

  return { valid: true };
}

/**
 * Verify JWT and throw on failure
 */
export function verifyJWTOrThrow(
  token: string,
  config: JWTVerificationConfig
): A2AJWTClaims {
  const result = verifyJWT(token, config);

  if (!result.valid) {
    throw new Error(`${result.errorCode}: ${result.errorMessage}`);
  }

  return result.claims!;
}

/**
 * Extract JWT claims without verification (UNSAFE - for debugging only)
 * @param token - JWT token string
 * @returns Decoded claims (unverified)
 */
export function decodeJWT(token: string): A2AJWTClaims | null {
  try {
    const decoded = jwt.decode(token) as A2AJWTClaims;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Check if token matches tenant/project
 */
export function tokenMatchesTenantProject(
  claims: A2AJWTClaims,
  tenant: string,
  project: string
): boolean {
  return claims.tenant === tenant && claims.project === project;
}

/**
 * Check if token has required scope
 * Supports wildcard matching:
 * - "context.read:*" matches any context.read scope
 * - "repo.write:healing/*" matches repo.write:healing/selectors, repo.write:healing/assertions, etc.
 */
export function tokenHasScope(claims: A2AJWTClaims, requiredScope: string): boolean {
  // Check for exact match first
  if (claims.scopes.includes(requiredScope)) {
    return true;
  }

  // Check for wildcard matches
  for (const scope of claims.scopes) {
    if (scope === '*' || scope === 'admin') {
      // Full access
      return true;
    }

    if (scope.endsWith(':*') || scope.endsWith('/*')) {
      // Wildcard scope
      const prefix = scope.slice(0, -2); // Remove ':*' or '/*'
      if (requiredScope.startsWith(prefix)) {
        return true;
      }
    }
  }

  return false;
}
