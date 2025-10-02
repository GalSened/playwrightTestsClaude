/**
 * Security Error Codes
 * Centralized error codes for A2A security operations
 */

/**
 * JWT verification error codes
 */
export enum JWTErrorCode {
  INVALID_SIGNATURE = 'E_JWT_INVALID_SIGNATURE',
  EXPIRED = 'E_JWT_EXPIRED',
  NOT_BEFORE = 'E_JWT_NOT_BEFORE',
  INVALID_ISSUER = 'E_JWT_INVALID_ISSUER',
  INVALID_AUDIENCE = 'E_JWT_INVALID_AUDIENCE',
  INVALID_CLAIMS = 'E_JWT_INVALID_CLAIMS',
  MALFORMED = 'E_JWT_MALFORMED',
}

/**
 * Signature verification error codes
 */
export enum SignatureErrorCode {
  MISSING_SIGNATURE = 'E_SIG_MISSING',
  INVALID_SIGNATURE = 'E_SIG_INVALID',
  ALGORITHM_MISMATCH = 'E_SIG_ALGORITHM_MISMATCH',
}

/**
 * Replay protection error codes
 */
export enum ReplayProtectionErrorCode {
  TIMESTAMP_STALE = 'E_REPLAY_TIMESTAMP_STALE',
  TIMESTAMP_FUTURE = 'E_REPLAY_TIMESTAMP_FUTURE',
  TIMESTAMP_MISSING = 'E_REPLAY_TIMESTAMP_MISSING',
  SIGNATURE_FAILED = 'E_REPLAY_SIGNATURE_FAILED',
}

/**
 * Capability token error codes
 */
export enum CapabilityTokenErrorCode {
  INVALID_TOKEN = 'E_CAP_INVALID',
  EXPIRED = 'E_CAP_EXPIRED',
  INSUFFICIENT_GRANT = 'E_CAP_INSUFFICIENT_GRANT',
  MALFORMED = 'E_CAP_MALFORMED',
}

/**
 * Generic security error
 */
export class SecurityError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SecurityError';
    Error.captureStackTrace?.(this, SecurityError);
  }
}

/**
 * JWT verification error
 */
export class JWTVerificationError extends SecurityError {
  constructor(code: JWTErrorCode, message: string, details?: Record<string, unknown>) {
    super(code, message, details);
    this.name = 'JWTVerificationError';
  }
}

/**
 * Signature verification error
 */
export class SignatureVerificationError extends SecurityError {
  constructor(code: SignatureErrorCode, message: string, details?: Record<string, unknown>) {
    super(code, message, details);
    this.name = 'SignatureVerificationError';
  }
}

/**
 * Replay protection error
 */
export class ReplayProtectionError extends SecurityError {
  constructor(code: ReplayProtectionErrorCode, message: string, details?: Record<string, unknown>) {
    super(code, message, details);
    this.name = 'ReplayProtectionError';
  }
}

/**
 * Capability token error
 */
export class CapabilityTokenError extends SecurityError {
  constructor(code: CapabilityTokenErrorCode, message: string, details?: Record<string, unknown>) {
    super(code, message, details);
    this.name = 'CapabilityTokenError';
  }
}
