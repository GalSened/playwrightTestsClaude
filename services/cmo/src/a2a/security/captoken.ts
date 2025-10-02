/**
 * Capability Token Validation
 * Validates fine-grained capability tokens (nested JWS) for specific operations
 */

import jwt from 'jsonwebtoken';
import type { JwtPayload, VerifyOptions } from 'jsonwebtoken';

/**
 * Capability token claims
 */
export interface CapabilityTokenClaims extends JwtPayload {
  /**
   * Capability scopes granted by this token
   * Examples: "context.read:*", "repo.write:healing/selectors"
   */
  capabilities: string[];

  /**
   * Resource this token is scoped to (optional)
   * Example: "trace:abc-123-def-456"
   */
  resource?: string;

  /**
   * Operation this token is scoped to (optional)
   * Example: "heal_selector", "read_context"
   */
  operation?: string;

  /**
   * Issuer (usually the agent that granted this capability)
   */
  iss: string;

  /**
   * Subject (agent_id that receives this capability)
   */
  sub: string;

  /**
   * Expiration (Unix timestamp)
   */
  exp: number;

  /**
   * Issued at (Unix timestamp)
   */
  iat?: number;

  /**
   * Not before (Unix timestamp)
   */
  nbf?: number;
}

/**
 * Capability token verification config
 */
export interface CapabilityTokenConfig {
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
   * Clock tolerance in seconds (default: 0)
   */
  clockTolerance?: number;
}

/**
 * Capability token verification result
 */
export interface CapabilityTokenResult {
  /**
   * Whether verification succeeded
   */
  valid: boolean;

  /**
   * Decoded claims (if valid)
   */
  claims?: CapabilityTokenClaims;

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
 * Capability token error codes
 */
export enum CapabilityTokenErrorCode {
  INVALID_SIGNATURE = 'E_CAPTOKEN_INVALID_SIGNATURE',
  EXPIRED = 'E_CAPTOKEN_EXPIRED',
  NOT_BEFORE = 'E_CAPTOKEN_NOT_BEFORE',
  INVALID_ISSUER = 'E_CAPTOKEN_INVALID_ISSUER',
  MISSING_CAPABILITIES = 'E_CAPTOKEN_MISSING_CAPABILITIES',
  INVALID_CLAIMS = 'E_CAPTOKEN_INVALID_CLAIMS',
  MALFORMED = 'E_CAPTOKEN_MALFORMED',
  INSUFFICIENT_CAPABILITIES = 'E_CAPTOKEN_INSUFFICIENT_CAPABILITIES',
}

/**
 * Verify capability token
 *
 * @param token - Capability token string (JWS)
 * @param config - Verification configuration
 * @returns Verification result
 */
export function verifyCapabilityToken(
  token: string,
  config: CapabilityTokenConfig
): CapabilityTokenResult {
  try {
    // Prepare verification options
    const options: VerifyOptions = {
      algorithms: [config.algorithm || 'HS256'],
      issuer: config.issuer,
      clockTolerance: config.clockTolerance || 0,
    };

    // Verify and decode token
    const decoded = jwt.verify(token, config.key, options) as CapabilityTokenClaims;

    // Validate required claims
    if (!decoded.capabilities || !Array.isArray(decoded.capabilities)) {
      return {
        valid: false,
        errorCode: CapabilityTokenErrorCode.MISSING_CAPABILITIES,
        errorMessage: 'Missing or invalid "capabilities" claim',
      };
    }

    if (!decoded.iss) {
      return {
        valid: false,
        errorCode: CapabilityTokenErrorCode.INVALID_CLAIMS,
        errorMessage: 'Missing "iss" (issuer) claim',
      };
    }

    if (!decoded.sub) {
      return {
        valid: false,
        errorCode: CapabilityTokenErrorCode.INVALID_CLAIMS,
        errorMessage: 'Missing "sub" (subject) claim',
      };
    }

    return {
      valid: true,
      claims: decoded,
    };
  } catch (error) {
    const err = error as Error;

    // Map JWT errors to capability token error codes
    if (err.name === 'TokenExpiredError') {
      return {
        valid: false,
        errorCode: CapabilityTokenErrorCode.EXPIRED,
        errorMessage: 'Capability token has expired',
      };
    }

    if (err.name === 'NotBeforeError') {
      return {
        valid: false,
        errorCode: CapabilityTokenErrorCode.NOT_BEFORE,
        errorMessage: 'Capability token not yet valid (nbf claim)',
      };
    }

    if (err.name === 'JsonWebTokenError') {
      if (err.message.includes('invalid signature')) {
        return {
          valid: false,
          errorCode: CapabilityTokenErrorCode.INVALID_SIGNATURE,
          errorMessage: 'Capability token signature verification failed',
        };
      }

      if (err.message.includes('jwt malformed')) {
        return {
          valid: false,
          errorCode: CapabilityTokenErrorCode.MALFORMED,
          errorMessage: 'Capability token is malformed',
        };
      }

      if (err.message.includes('invalid issuer')) {
        return {
          valid: false,
          errorCode: CapabilityTokenErrorCode.INVALID_ISSUER,
          errorMessage: 'Capability token issuer mismatch',
        };
      }
    }

    // Generic error
    return {
      valid: false,
      errorCode: CapabilityTokenErrorCode.INVALID_CLAIMS,
      errorMessage: err.message || 'Capability token verification failed',
    };
  }
}

/**
 * Verify capability token and throw on failure
 */
export function verifyCapabilityTokenOrThrow(
  token: string,
  config: CapabilityTokenConfig
): CapabilityTokenClaims {
  const result = verifyCapabilityToken(token, config);

  if (!result.valid) {
    throw new Error(`${result.errorCode}: ${result.errorMessage}`);
  }

  return result.claims!;
}

/**
 * Check if capability token grants required capabilities
 *
 * Supports wildcard matching:
 * - "context.read:*" grants access to any context.read scope
 * - "repo.write:healing/*" grants access to repo.write:healing/selectors, etc.
 *
 * @param claims - Capability token claims
 * @param required - Required capabilities (array of scope strings)
 * @returns True if all required capabilities are granted
 */
export function hasCapabilities(claims: CapabilityTokenClaims, required: string[]): boolean {
  for (const requiredCap of required) {
    if (!hasCapability(claims, requiredCap)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if capability token grants a single required capability
 */
export function hasCapability(claims: CapabilityTokenClaims, required: string): boolean {
  // Check for exact match first
  if (claims.capabilities.includes(required)) {
    return true;
  }

  // Check for wildcard matches
  for (const cap of claims.capabilities) {
    if (cap === '*') {
      // Full access
      return true;
    }

    if (cap.endsWith(':*') || cap.endsWith('/*')) {
      // Wildcard capability
      const prefix = cap.slice(0, -2); // Remove ':*' or '/*'
      if (required.startsWith(prefix)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Validate capability token for specific operation
 *
 * @param token - Capability token string
 * @param config - Verification configuration
 * @param required - Required capabilities
 * @returns Validation result with detailed error
 */
export function validateCapabilityToken(
  token: string,
  config: CapabilityTokenConfig,
  required: string[]
): CapabilityTokenResult {
  // First, verify token signature and expiration
  const verifyResult = verifyCapabilityToken(token, config);

  if (!verifyResult.valid) {
    return verifyResult;
  }

  // Then, check if token grants required capabilities
  const claims = verifyResult.claims!;

  if (!hasCapabilities(claims, required)) {
    const missingCaps = required.filter((cap) => !hasCapability(claims, cap));

    return {
      valid: false,
      errorCode: CapabilityTokenErrorCode.INSUFFICIENT_CAPABILITIES,
      errorMessage: `Capability token does not grant required capabilities: ${missingCaps.join(', ')}`,
    };
  }

  return {
    valid: true,
    claims,
  };
}

/**
 * Check if capability token is scoped to a specific resource
 */
export function isResourceScoped(claims: CapabilityTokenClaims, resource: string): boolean {
  // If no resource claim, token is not resource-scoped
  if (!claims.resource) {
    return false;
  }

  // Check exact match
  if (claims.resource === resource) {
    return true;
  }

  // Check wildcard match (e.g., "trace:*" matches any trace)
  if (claims.resource.endsWith(':*')) {
    const prefix = claims.resource.slice(0, -2);
    return resource.startsWith(prefix);
  }

  return false;
}

/**
 * Check if capability token is scoped to a specific operation
 */
export function isOperationScoped(claims: CapabilityTokenClaims, operation: string): boolean {
  // If no operation claim, token is not operation-scoped
  if (!claims.operation) {
    return false;
  }

  // Check exact match
  return claims.operation === operation;
}
