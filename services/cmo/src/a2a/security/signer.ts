/**
 * Message Signing & Idempotency
 * Signs A2A envelopes for integrity verification and generates idempotency keys
 */

import { createHmac, createHash, randomBytes } from 'crypto';
import type { A2AEnvelope, EnvelopeMeta } from '../envelopes/types.js';
import { ReplayProtectionErrorCode } from './errors.js';

/**
 * Signing configuration
 */
export interface SigningConfig {
  /**
   * Secret key for HMAC signing
   */
  secretKey: string;

  /**
   * Algorithm (default: sha256)
   */
  algorithm?: 'sha256' | 'sha512';
}

/**
 * Signature verification result
 */
export interface SignatureVerificationResult {
  /**
   * Whether signature is valid
   */
  valid: boolean;

  /**
   * Error message (if invalid)
   */
  errorMessage?: string;

  /**
   * Error code (if invalid)
   */
  errorCode?: string;
}

/**
 * Replay protection configuration
 */
export interface ReplayProtectionConfig {
  /**
   * Maximum age of timestamp in seconds (default: 300 = 5 minutes)
   */
  freshnessWindowSeconds?: number;

  /**
   * Signing configuration for signature verification (optional)
   */
  signing?: SigningConfig;
}

/**
 * Replay protection result
 */
export interface ReplayProtectionResult {
  /**
   * Whether replay protection check passed
   */
  valid: boolean;

  /**
   * Error code (if invalid)
   */
  errorCode?: string;

  /**
   * Error message (if invalid)
   */
  errorMessage?: string;

  /**
   * Reason for failure (if invalid)
   */
  reason?: string;
}

/**
 * Sign an A2A envelope
 *
 * Creates HMAC signature of the canonical form of the envelope
 * (meta + payload, excluding the signature field itself)
 *
 * @param envelope - Envelope to sign
 * @param config - Signing configuration
 * @returns Signature string (hex-encoded)
 */
export function signEnvelope(envelope: A2AEnvelope, config: SigningConfig): string {
  const algorithm = config.algorithm || 'sha256';

  // Create canonical form (excluding signature)
  const canonical = createCanonicalForm(envelope);

  // Create HMAC signature
  const hmac = createHmac(algorithm, config.secretKey);
  hmac.update(canonical);

  return hmac.digest('hex');
}

/**
 * Verify envelope signature
 *
 * @param envelope - Envelope to verify
 * @param signature - Signature to verify against (hex string)
 * @param config - Signing configuration
 * @returns Verification result
 */
export function verifyEnvelopeSignature(
  envelope: A2AEnvelope,
  signature: string,
  config: SigningConfig
): SignatureVerificationResult {
  if (!signature || signature.length === 0) {
    return {
      valid: false,
      errorCode: 'E_SIG_MISSING',
      errorMessage: 'No signature provided',
    };
  }

  // Compute expected signature
  const expectedSignature = signEnvelope(envelope, config);

  // Constant-time comparison to prevent timing attacks
  if (!timingSafeEqual(signature, expectedSignature)) {
    return {
      valid: false,
      errorCode: 'E_SIGNATURE_MISMATCH',
      errorMessage: 'Signature verification failed',
    };
  }

  return {
    valid: true,
  };
}

/**
 * Verify signature or throw error
 */
export function verifyEnvelopeSignatureOrThrow(
  envelope: A2AEnvelope,
  signature: string,
  config: SigningConfig
): void {
  const result = verifyEnvelopeSignature(envelope, signature, config);

  if (!result.valid) {
    throw new Error(`Signature verification failed: ${result.errorMessage}`);
  }
}

/**
 * Generate idempotency key for an envelope
 *
 * Idempotency key is a hash of:
 * - trace_id
 * - message_id
 * - timestamp
 * - from.id
 *
 * This ensures uniqueness while being deterministic for replays
 *
 * @param envelope - Envelope to generate key for
 * @returns Idempotency key (hex string)
 */
export function generateIdempotencyKey(envelope: A2AEnvelope): string {
  const components = [
    envelope.meta.trace_id,
    envelope.meta.message_id,
    envelope.meta.ts,
    envelope.meta.from.id,
  ];

  const hash = createHash('sha256');
  hash.update(components.join(':'));

  return hash.digest('hex');
}

/**
 * Generate unique message ID
 *
 * @returns Message ID (hex string, 32 chars)
 */
export function generateMessageId(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Check if envelope timestamp is fresh (within replay protection window)
 *
 * @param envelope - Envelope to check
 * @param maxAgeSeconds - Maximum age in seconds (default: 300 = 5 minutes)
 * @returns True if timestamp is fresh
 */
export function isTimestampFresh(envelope: A2AEnvelope, maxAgeSeconds: number = 300): boolean {
  const now = new Date();
  const ts = new Date(envelope.meta.ts);

  const ageSeconds = (now.getTime() - ts.getTime()) / 1000;

  return ageSeconds >= 0 && ageSeconds <= maxAgeSeconds;
}

/**
 * Validate envelope for replay protection
 *
 * Checks:
 * 1. Timestamp is fresh (within window)
 * 2. Signature is valid (if present)
 *
 * @param envelope - Envelope to validate
 * @param config - Signing configuration (optional, for signature verification)
 * @param maxAgeSeconds - Maximum timestamp age (default: 300)
 * @returns Validation result
 */
export function validateReplayProtection(
  envelope: A2AEnvelope,
  config?: SigningConfig,
  maxAgeSeconds: number = 300
): { valid: boolean; reason?: string } {
  // Check timestamp freshness
  if (!isTimestampFresh(envelope, maxAgeSeconds)) {
    return {
      valid: false,
      reason: 'Timestamp is stale (potential replay attack)',
    };
  }

  // Check signature if present
  if (envelope.meta.signature && config) {
    const signatureResult = verifyEnvelopeSignature(envelope, envelope.meta.signature, config);

    if (!signatureResult.valid) {
      return {
        valid: false,
        reason: `Signature verification failed: ${signatureResult.errorMessage}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Check envelope replay protection
 *
 * Validates timestamp freshness and optionally signature to prevent replay attacks.
 *
 * @param envelope - Envelope to check
 * @param config - Replay protection configuration
 * @returns Replay protection result
 */
export function checkReplayProtection(
  envelope: A2AEnvelope,
  config: ReplayProtectionConfig = {}
): ReplayProtectionResult {
  const maxAge = config.freshnessWindowSeconds ?? 300;

  // Check if timestamp exists
  if (!envelope.meta.ts) {
    return {
      valid: false,
      errorCode: ReplayProtectionErrorCode.TIMESTAMP_MISSING,
      errorMessage: 'Envelope timestamp is missing',
      reason: 'Missing timestamp',
    };
  }

  // Parse and validate timestamp
  const now = new Date();
  const ts = new Date(envelope.meta.ts);

  if (isNaN(ts.getTime())) {
    return {
      valid: false,
      errorCode: ReplayProtectionErrorCode.TIMESTAMP_MISSING,
      errorMessage: 'Envelope timestamp is invalid',
      reason: 'Invalid timestamp format',
    };
  }

  // Calculate age
  const ageSeconds = (now.getTime() - ts.getTime()) / 1000;

  // Check if timestamp is in the future
  if (ageSeconds < -30) {
    // Allow 30s clock skew
    return {
      valid: false,
      errorCode: ReplayProtectionErrorCode.TIMESTAMP_FUTURE,
      errorMessage: 'Envelope timestamp is in the future',
      reason: 'Timestamp is in the future (potential clock skew or attack)',
    };
  }

  // Check if timestamp is stale
  if (ageSeconds > maxAge) {
    return {
      valid: false,
      errorCode: ReplayProtectionErrorCode.TIMESTAMP_STALE,
      errorMessage: `Envelope timestamp is too old (age: ${Math.floor(ageSeconds)}s, max: ${maxAge}s)`,
      reason: `Timestamp is stale (age: ${Math.floor(ageSeconds)}s > max: ${maxAge}s)`,
    };
  }

  // Check signature if signing config provided
  if (config.signing && envelope.meta.signature) {
    const signatureResult = verifyEnvelopeSignature(envelope, envelope.meta.signature, config.signing);

    if (!signatureResult.valid) {
      return {
        valid: false,
        errorCode: ReplayProtectionErrorCode.SIGNATURE_FAILED,
        errorMessage: signatureResult.errorMessage,
        reason: `Signature verification failed: ${signatureResult.errorMessage}`,
      };
    }
  }

  return {
    valid: true,
  };
}

/**
 * Create canonical form of envelope for signing
 *
 * Canonical form is a deterministic JSON string of envelope
 * with signature field removed
 *
 * @param envelope - Envelope to canonicalize
 * @returns Canonical string
 */
function createCanonicalForm(envelope: A2AEnvelope): string {
  // Clone envelope and remove signature
  const clone = JSON.parse(JSON.stringify(envelope)) as A2AEnvelope;
  delete clone.meta.signature;

  // Sort keys recursively for determinism
  const sorted = sortObjectKeys(clone);

  // Return stable JSON string
  return JSON.stringify(sorted);
}

/**
 * Sort object keys recursively for deterministic serialization
 */
function sortObjectKeys(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }

  const sorted: any = {};
  const keys = Object.keys(obj).sort();

  for (const key of keys) {
    sorted[key] = sortObjectKeys(obj[key]);
  }

  return sorted;
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let diff = 0;

  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return diff === 0;
}

/**
 * Hash envelope payload for deduplication
 *
 * Useful for detecting duplicate payloads even if message_id differs
 *
 * @param envelope - Envelope to hash
 * @returns Payload hash (hex string)
 */
export function hashEnvelopePayload(envelope: A2AEnvelope): string {
  const payloadJson = JSON.stringify(sortObjectKeys(envelope.payload));
  const hash = createHash('sha256');
  hash.update(payloadJson);

  return hash.digest('hex');
}

/**
 * Create signed envelope with all security fields populated
 *
 * @param meta - Envelope metadata (without signature/idempotency_key)
 * @param payload - Envelope payload
 * @param config - Signing configuration
 * @returns Signed envelope
 */
export function createSignedEnvelope<T>(
  meta: Omit<EnvelopeMeta, 'signature' | 'idempotency_key'>,
  payload: T,
  config: SigningConfig
): A2AEnvelope {
  // Create unsigned envelope
  const envelope: A2AEnvelope = {
    meta: meta as EnvelopeMeta,
    payload,
  };

  // Generate idempotency key
  envelope.meta.idempotency_key = generateIdempotencyKey(envelope);

  // Sign envelope
  envelope.meta.signature = signEnvelope(envelope, config);

  return envelope;
}
