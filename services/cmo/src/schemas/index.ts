/**
 * Compiled Schema Validators
 * Pre-compiled AJV validators for all CMO/ELG envelope schemas
 */

import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize AJV with strict mode
const ajv = new Ajv({
  allErrors: true,
  strict: true,
  strictSchema: true,
  validateFormats: true,
  $data: true,
});

// Add format validators (date-time, email, uri, etc.)
addFormats(ajv);

/**
 * Schema file paths
 */
const SCHEMA_DIR = join(__dirname, '..');
const SCHEMAS = {
  envelopeMeta: join(SCHEMA_DIR, 'elg/schemas/common/EnvelopeMeta.schema.json'),
  agentId: join(SCHEMA_DIR, 'elg/schemas/common/AgentId.schema.json'),
  specialistInvocationRequest: join(SCHEMA_DIR, 'elg/schemas/envelopes/SpecialistInvocationRequest.schema.json'),
  specialistResult: join(SCHEMA_DIR, 'elg/schemas/envelopes/SpecialistResult.schema.json'),
  retryDirective: join(SCHEMA_DIR, 'elg/schemas/envelopes/RetryDirective.schema.json'),
  decisionNotice: join(SCHEMA_DIR, 'elg/schemas/envelopes/DecisionNotice.schema.json'),
};

/**
 * Load and compile a schema
 */
function compileSchema(schemaPath: string): ValidateFunction {
  try {
    const schemaContent = readFileSync(schemaPath, 'utf-8');
    const schema = JSON.parse(schemaContent);
    return ajv.compile(schema);
  } catch (error) {
    throw new Error(`Failed to compile schema ${schemaPath}: ${(error as Error).message}`);
  }
}

/**
 * Compiled validators
 */
export const validators = {
  envelopeMeta: compileSchema(SCHEMAS.envelopeMeta),
  agentId: compileSchema(SCHEMAS.agentId),
  specialistInvocationRequest: compileSchema(SCHEMAS.specialistInvocationRequest),
  specialistResult: compileSchema(SCHEMAS.specialistResult),
  retryDirective: compileSchema(SCHEMAS.retryDirective),
  decisionNotice: compileSchema(SCHEMAS.decisionNotice),
};

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean;
  errors?: Array<{
    path: string;
    message: string;
    value?: unknown;
  }>;
}

/**
 * Validate envelope metadata
 */
export function validateEnvelopeMeta(data: unknown): ValidationResult {
  const valid = validators.envelopeMeta(data);

  if (valid) {
    return { valid: true };
  }

  const errors = (validators.envelopeMeta.errors || []).map((err) => ({
    path: err.instancePath || err.schemaPath,
    message: err.message || 'Validation failed',
    value: err.data,
  }));

  return { valid: false, errors };
}

/**
 * Validate agent ID
 */
export function validateAgentId(data: unknown): ValidationResult {
  const valid = validators.agentId(data);

  if (valid) {
    return { valid: true };
  }

  const errors = (validators.agentId.errors || []).map((err) => ({
    path: err.instancePath || err.schemaPath,
    message: err.message || 'Validation failed',
    value: err.data,
  }));

  return { valid: false, errors };
}

/**
 * Validate specialist invocation request
 */
export function validateSpecialistInvocationRequest(data: unknown): ValidationResult {
  const valid = validators.specialistInvocationRequest(data);

  if (valid) {
    return { valid: true };
  }

  const errors = (validators.specialistInvocationRequest.errors || []).map((err) => ({
    path: err.instancePath || err.schemaPath,
    message: err.message || 'Validation failed',
    value: err.data,
  }));

  return { valid: false, errors };
}

/**
 * Validate specialist result
 */
export function validateSpecialistResult(data: unknown): ValidationResult {
  const valid = validators.specialistResult(data);

  if (valid) {
    return { valid: true };
  }

  const errors = (validators.specialistResult.errors || []).map((err) => ({
    path: err.instancePath || err.schemaPath,
    message: err.message || 'Validation failed',
    value: err.data,
  }));

  return { valid: false, errors };
}

/**
 * Validate retry directive
 */
export function validateRetryDirective(data: unknown): ValidationResult {
  const valid = validators.retryDirective(data);

  if (valid) {
    return { valid: true };
  }

  const errors = (validators.retryDirective.errors || []).map((err) => ({
    path: err.instancePath || err.schemaPath,
    message: err.message || 'Validation failed',
    value: err.data,
  }));

  return { valid: false, errors };
}

/**
 * Validate decision notice
 */
export function validateDecisionNotice(data: unknown): ValidationResult {
  const valid = validators.decisionNotice(data);

  if (valid) {
    return { valid: true };
  }

  const errors = (validators.decisionNotice.errors || []).map((err) => ({
    path: err.instancePath || err.schemaPath,
    message: err.message || 'Validation failed',
    value: err.data,
  }));

  return { valid: false, errors };
}

/**
 * Validate envelope based on message type
 */
export function validateEnvelope(envelope: unknown): ValidationResult {
  // First validate meta
  const metaResult = validateEnvelopeMeta((envelope as any)?.meta);

  if (!metaResult.valid) {
    return metaResult;
  }

  // Determine message type and validate payload
  const messageType = (envelope as any)?.meta?.messageType;

  switch (messageType) {
    case 'specialist-invocation':
      return validateSpecialistInvocationRequest(envelope);

    case 'specialist-result':
      return validateSpecialistResult(envelope);

    case 'retry-directive':
      return validateRetryDirective(envelope);

    case 'decision':
      return validateDecisionNotice(envelope);

    default:
      return {
        valid: false,
        errors: [
          {
            path: 'meta.messageType',
            message: `Unknown message type: ${messageType}`,
          },
        ],
      };
  }
}

/**
 * Validate or throw error
 */
export function validateEnvelopeOrThrow(envelope: unknown): void {
  const result = validateEnvelope(envelope);

  if (!result.valid) {
    const errorMessages = result.errors!.map((e) => `${e.path}: ${e.message}`).join(', ');
    throw new Error(`Envelope validation failed: ${errorMessages}`);
  }
}
