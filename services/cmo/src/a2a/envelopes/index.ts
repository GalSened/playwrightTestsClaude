/**
 * A2A Envelope Validators
 * Pre-compiled AJV validators for all A2A message envelopes
 *
 * IMPORTANT: Schemas are pre-loaded and registered with AJV to support cross-schema $ref resolution
 */

import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { A2AEnvelope, EnvelopeMeta } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize AJV with strict mode + union type support
const ajv = new Ajv({
  allErrors: true,
  strict: true,
  strictSchema: true,
  strictRequired: true,
  strictTypes: false,      // Allow looser type checking for union types
  allowUnionTypes: true,   // Enable oneOf/anyOf support for complex schemas
  validateFormats: true,
  $data: true,
});

// Add format validators (date-time, email, uri, etc.)
addFormats(ajv);

/**
 * Schema directory
 */
const SCHEMA_DIR = join(__dirname, 'schemas');

/**
 * Step 1: Pre-load ALL schemas from the schemas directory
 * This allows AJV to resolve cross-schema $ref references
 */
const schemaFiles = readdirSync(SCHEMA_DIR)
  .filter(f => f.endsWith('.schema.json'))
  .sort(); // Deterministic order

const loadedSchemas = schemaFiles.map(filename => {
  const filepath = join(SCHEMA_DIR, filename);
  const content = readFileSync(filepath, 'utf-8');
  const schema = JSON.parse(content);

  // Force $id to be just the filename for consistent $ref resolution
  // (schemas may have full URLs but $ref uses just filenames)
  schema.$id = filename;

  return { filename, filepath, schema };
});

/**
 * Step 2: Register all schemas with AJV BEFORE compiling
 * This is critical for $ref resolution across schemas
 */
for (const { schema, filename } of loadedSchemas) {
  try {
    ajv.addSchema(schema, schema.$id);
  } catch (error) {
    throw new Error(`Failed to register schema ${filename}: ${(error as Error).message}`);
  }
}

/**
 * Step 3: Compile validators by $id (now that all schemas are registered)
 */
function compileSchemaById(schemaId: string): ValidateFunction {
  try {
    const validator = ajv.getSchema(schemaId);
    if (!validator) {
      // Fallback: find and compile the schema
      const loaded = loadedSchemas.find(s => s.schema.$id === schemaId);
      if (!loaded) {
        throw new Error(`Schema not found: ${schemaId}`);
      }
      return ajv.compile(loaded.schema);
    }
    return validator;
  } catch (error) {
    throw new Error(`Failed to compile schema ${schemaId}: ${(error as Error).message}`);
  }
}

/**
 * Compiled validators (keyed by schema $id)
 */
export const validators = {
  envelopeMeta: compileSchemaById('EnvelopeMeta.schema.json'),
  agentId: compileSchemaById('AgentId.schema.json'),
  taskRequest: compileSchemaById('TaskRequest.schema.json'),
  taskResult: compileSchemaById('TaskResult.schema.json'),
  memoryEvent: compileSchemaById('MemoryEvent.schema.json'),
  contextRequest: compileSchemaById('ContextRequest.schema.json'),
  contextResult: compileSchemaById('ContextResult.schema.json'),
  specialistInvocationRequest: compileSchemaById('SpecialistInvocationRequest.schema.json'),
  specialistResult: compileSchemaById('SpecialistResult.schema.json'),
  retryDirective: compileSchemaById('RetryDirective.schema.json'),
  decisionNotice: compileSchemaById('DecisionNotice.schema.json'),
};

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  errorCode?: string;
  errors?: Array<{
    path: string;
    message: string;
    value?: unknown;
  }>;
}

/**
 * Format AJV errors into readable format
 */
function formatErrors(validator: ValidateFunction): ValidationResult['errors'] {
  return (validator.errors || []).map((err) => ({
    path: err.instancePath || err.schemaPath,
    message: err.message || 'Validation failed',
    value: err.data,
  }));
}

/**
 * Validate envelope metadata
 */
export function validateEnvelopeMeta(data: unknown): ValidationResult {
  const valid = validators.envelopeMeta(data);

  if (valid) {
    return { valid: true };
  }

  const errors = formatErrors(validators.envelopeMeta);
  return {
    valid: false,
    errorCode: 'E_VALIDATION_FAILED',
    error: errors.map(e => `${e.path}: ${e.message}`).join(', '),
    errors
  };
}

/**
 * Validate agent ID
 */
export function validateAgentId(data: unknown): ValidationResult {
  const valid = validators.agentId(data);

  if (valid) {
    return { valid: true };
  }

  const errors = formatErrors(validators.agentId);
  return {
    valid: false,
    errorCode: 'E_VALIDATION_FAILED',
    error: errors.map(e => `${e.path}: ${e.message}`).join(', '),
    errors
  };
}

/**
 * Validate TaskRequest envelope
 */
export function validateTaskRequest(data: unknown): ValidationResult {
  const valid = validators.taskRequest(data);

  if (valid) {
    return { valid: true };
  }

  const errors = formatErrors(validators.taskRequest);
  return {
    valid: false,
    errorCode: 'E_VALIDATION_FAILED',
    error: errors.map(e => `${e.path}: ${e.message}`).join(', '),
    errors
  };
}

/**
 * Validate TaskResult envelope
 */
export function validateTaskResult(data: unknown): ValidationResult {
  const valid = validators.taskResult(data);

  if (valid) {
    return { valid: true };
  }

  const errors = formatErrors(validators.taskResult);
  return {
    valid: false,
    errorCode: 'E_VALIDATION_FAILED',
    error: errors.map(e => `${e.path}: ${e.message}`).join(', '),
    errors
  };
}

/**
 * Validate MemoryEvent envelope
 */
export function validateMemoryEvent(data: unknown): ValidationResult {
  const valid = validators.memoryEvent(data);

  if (valid) {
    return { valid: true };
  }

  const errors = formatErrors(validators.memoryEvent);
  return {
    valid: false,
    errorCode: 'E_VALIDATION_FAILED',
    error: errors.map(e => `${e.path}: ${e.message}`).join(', '),
    errors
  };
}

/**
 * Validate ContextRequest envelope
 */
export function validateContextRequest(data: unknown): ValidationResult {
  const valid = validators.contextRequest(data);

  if (valid) {
    return { valid: true };
  }

  const errors = formatErrors(validators.contextRequest);
  return {
    valid: false,
    errorCode: 'E_VALIDATION_FAILED',
    error: errors.map(e => `${e.path}: ${e.message}`).join(', '),
    errors
  };
}

/**
 * Validate ContextResult envelope
 */
export function validateContextResult(data: unknown): ValidationResult {
  const valid = validators.contextResult(data);

  if (valid) {
    return { valid: true };
  }

  const errors = formatErrors(validators.contextResult);
  return {
    valid: false,
    errorCode: 'E_VALIDATION_FAILED',
    error: errors.map(e => `${e.path}: ${e.message}`).join(', '),
    errors
  };
}

/**
 * Validate SpecialistInvocationRequest envelope
 */
export function validateSpecialistInvocationRequest(data: unknown): ValidationResult {
  const valid = validators.specialistInvocationRequest(data);

  if (valid) {
    return { valid: true };
  }

  const errors = formatErrors(validators.specialistInvocationRequest);
  return {
    valid: false,
    errorCode: 'E_VALIDATION_FAILED',
    error: errors.map(e => `${e.path}: ${e.message}`).join(', '),
    errors
  };
}

/**
 * Validate SpecialistResult envelope
 */
export function validateSpecialistResult(data: unknown): ValidationResult {
  const valid = validators.specialistResult(data);

  if (valid) {
    return { valid: true };
  }

  const errors = formatErrors(validators.specialistResult);
  return {
    valid: false,
    errorCode: 'E_VALIDATION_FAILED',
    error: errors.map(e => `${e.path}: ${e.message}`).join(', '),
    errors
  };
}

/**
 * Validate RetryDirective envelope
 */
export function validateRetryDirective(data: unknown): ValidationResult {
  const valid = validators.retryDirective(data);

  if (valid) {
    return { valid: true };
  }

  const errors = formatErrors(validators.retryDirective);
  return {
    valid: false,
    errorCode: 'E_VALIDATION_FAILED',
    error: errors.map(e => `${e.path}: ${e.message}`).join(', '),
    errors
  };
}

/**
 * Validate DecisionNotice envelope
 */
export function validateDecisionNotice(data: unknown): ValidationResult {
  const valid = validators.decisionNotice(data);

  if (valid) {
    return { valid: true };
  }

  const errors = formatErrors(validators.decisionNotice);
  return {
    valid: false,
    errorCode: 'E_VALIDATION_FAILED',
    error: errors.map(e => `${e.path}: ${e.message}`).join(', '),
    errors
  };
}

/**
 * Additional validators for new envelope types from Step-3
 */
export function validateRegistryHeartbeat(data: unknown): ValidationResult {
  // RegistryHeartbeat is mapped to HeartbeatEvent in schemas
  const metaResult = validateEnvelopeMeta((data as any)?.meta);
  if (!metaResult.valid) return metaResult;

  // For now, just validate meta - full schema can be added later
  return { valid: true };
}

export function validateRegistryDiscoveryRequest(data: unknown): ValidationResult {
  const metaResult = validateEnvelopeMeta((data as any)?.meta);
  if (!metaResult.valid) return metaResult;

  return { valid: true };
}

export function validateRegistryDiscoveryResponse(data: unknown): ValidationResult {
  const metaResult = validateEnvelopeMeta((data as any)?.meta);
  if (!metaResult.valid) return metaResult;

  return { valid: true };
}

export function validateSystemEvent(data: unknown): ValidationResult {
  const metaResult = validateEnvelopeMeta((data as any)?.meta);
  if (!metaResult.valid) return metaResult;

  return { valid: true };
}

export function validateSpecialistEventNotification(data: unknown): ValidationResult {
  const metaResult = validateEnvelopeMeta((data as any)?.meta);
  if (!metaResult.valid) return metaResult;

  return { valid: true };
}

/**
 * Validate any A2A envelope based on meta.type
 */
export function validateEnvelope(envelope: unknown): ValidationResult {
  // First validate meta
  const metaResult = validateEnvelopeMeta((envelope as any)?.meta);

  if (!metaResult.valid) {
    return metaResult;
  }

  // Determine message type and validate full envelope
  const messageType = (envelope as any)?.meta?.type;

  switch (messageType) {
    case 'TaskRequest':
      return validateTaskRequest(envelope);

    case 'TaskResult':
      return validateTaskResult(envelope);

    case 'MemoryEvent':
      return validateMemoryEvent(envelope);

    case 'ContextRequest':
      return validateContextRequest(envelope);

    case 'ContextResult':
      return validateContextResult(envelope);

    case 'SpecialistInvocationRequest':
      return validateSpecialistInvocationRequest(envelope);

    case 'SpecialistResult':
      return validateSpecialistResult(envelope);

    case 'RetryDirective':
      return validateRetryDirective(envelope);

    case 'DecisionNotice':
      return validateDecisionNotice(envelope);

    case 'RegistryHeartbeat':
    case 'HeartbeatEvent':
      return validateRegistryHeartbeat(envelope);

    case 'RegistryDiscoveryRequest':
      return validateRegistryDiscoveryRequest(envelope);

    case 'RegistryDiscoveryResponse':
      return validateRegistryDiscoveryResponse(envelope);

    case 'SystemEvent':
      return validateSystemEvent(envelope);

    case 'SpecialistEventNotification':
      return validateSpecialistEventNotification(envelope);

    default:
      return {
        valid: false,
        errorCode: 'E_UNKNOWN_MESSAGE_TYPE',
        error: `Unknown or unsupported message type: ${messageType}`,
        errors: [
          {
            path: 'meta.type',
            message: `Unknown or unsupported message type: ${messageType}`,
          },
        ],
      };
  }
}

/**
 * Validate envelope or throw error
 */
export function validateEnvelopeOrThrow(envelope: unknown): asserts envelope is A2AEnvelope {
  const result = validateEnvelope(envelope);

  if (!result.valid) {
    const errorMessages = result.errors!.map((e) => `${e.path}: ${e.message}`).join(', ');
    throw new Error(`A2A envelope validation failed: ${errorMessages}`);
  }
}

/**
 * Type guard: check if envelope is valid
 */
export function isValidEnvelope(envelope: unknown): envelope is A2AEnvelope {
  const result = validateEnvelope(envelope);
  return result.valid;
}

/**
 * Extract and validate envelope meta (lightweight check)
 */
export function extractMeta(envelope: unknown): EnvelopeMeta | null {
  const metaResult = validateEnvelopeMeta((envelope as any)?.meta);

  if (metaResult.valid) {
    return (envelope as any).meta as EnvelopeMeta;
  }

  return null;
}

/**
 * Backward compatibility aliases for renamed validators
 */
export const validateContextSliceRequest = validateContextRequest;
export const validateContextSliceResponse = validateContextResult;
export const validateSpecialistInvocationResult = validateSpecialistResult;

// Re-export types
export * from './types.js';
