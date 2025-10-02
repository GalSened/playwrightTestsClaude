/**
 * Schema Validation Module
 * Validates A2A envelopes and graph definitions using JSON Schema
 */

import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pino from 'pino';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors?: Array<{
    field: string;
    message: string;
    value?: unknown;
  }>;
}

/**
 * Schema names
 */
export enum SchemaName {
  ENVELOPE_META = 'EnvelopeMeta',
  AGENT_ID = 'AgentId',
  SPECIALIST_INVOCATION_REQUEST = 'SpecialistInvocationRequest',
  SPECIALIST_RESULT = 'SpecialistResult',
  RETRY_DIRECTIVE = 'RetryDirective',
  DECISION_NOTICE = 'DecisionNotice',
}

/**
 * Schema Validator
 * Loads and compiles JSON schemas, provides validation interface
 */
export class SchemaValidator {
  private ajv: Ajv;
  private validators: Map<string, ValidateFunction> = new Map();
  private logger: pino.Logger;
  private schemasPath: string;

  constructor(options?: { logger?: pino.Logger; schemasPath?: string }) {
    this.logger = options?.logger || pino({ name: 'schema-validator' });

    // Default schemas path: src/schemas/
    this.schemasPath =
      options?.schemasPath || join(__dirname, '..', '..', 'schemas');

    // Initialize ajv with strict mode and formats
    this.ajv = new Ajv({
      allErrors: true,
      strict: true,
      strictSchema: true,
      validateFormats: true,
      $data: true,
    });

    // Add format validators (date-time, email, uri, etc.)
    addFormats(this.ajv);
  }

  /**
   * Load and compile all schemas
   */
  async initialize(): Promise<void> {
    const schemaFiles = [
      { name: SchemaName.ENVELOPE_META, file: 'EnvelopeMeta.schema.json' },
      { name: SchemaName.AGENT_ID, file: 'AgentId.schema.json' },
      {
        name: SchemaName.SPECIALIST_INVOCATION_REQUEST,
        file: 'SpecialistInvocationRequest.schema.json',
      },
      { name: SchemaName.SPECIALIST_RESULT, file: 'SpecialistResult.schema.json' },
      { name: SchemaName.RETRY_DIRECTIVE, file: 'RetryDirective.schema.json' },
      { name: SchemaName.DECISION_NOTICE, file: 'DecisionNotice.schema.json' },
    ];

    for (const { name, file } of schemaFiles) {
      try {
        const schemaPath = join(this.schemasPath, file);
        const schemaContent = readFileSync(schemaPath, 'utf-8');
        const schema = JSON.parse(schemaContent);

        // Compile schema
        const validate = this.ajv.compile(schema);
        this.validators.set(name, validate);

        this.logger.debug({ schema: name, file }, 'Loaded schema');
      } catch (error) {
        this.logger.error({ schema: name, file, error }, 'Failed to load schema');
        throw new Error(`Failed to load schema ${name}: ${(error as Error).message}`);
      }
    }

    this.logger.info({ count: this.validators.size }, 'Schema validator initialized');
  }

  /**
   * Validate data against a named schema
   */
  validate(schemaName: SchemaName, data: unknown): ValidationResult {
    const validator = this.validators.get(schemaName);

    if (!validator) {
      throw new Error(`Schema not loaded: ${schemaName}`);
    }

    const valid = validator(data);

    if (valid) {
      return { valid: true };
    }

    // Map ajv errors to our format
    const errors = (validator.errors || []).map((err) => ({
      field: err.instancePath || err.schemaPath,
      message: err.message || 'Validation failed',
      value: err.data,
    }));

    return {
      valid: false,
      errors,
    };
  }

  /**
   * Validate or throw
   */
  validateOrThrow(schemaName: SchemaName, data: unknown): void {
    const result = this.validate(schemaName, data);

    if (!result.valid) {
      const errorMessages = result.errors!.map((e) => `${e.field}: ${e.message}`).join(', ');
      throw new Error(`Schema validation failed for ${schemaName}: ${errorMessages}`);
    }
  }

  /**
   * Validate A2A envelope (common use case)
   */
  validateEnvelope(envelope: unknown): ValidationResult {
    // First validate the meta structure
    const metaResult = this.validate(SchemaName.ENVELOPE_META, (envelope as any)?.meta);

    if (!metaResult.valid) {
      return metaResult;
    }

    // Determine message type from meta and validate payload
    const messageType = (envelope as any)?.meta?.messageType;

    switch (messageType) {
      case 'specialist-invocation':
        return this.validate(SchemaName.SPECIALIST_INVOCATION_REQUEST, envelope);

      case 'specialist-result':
        return this.validate(SchemaName.SPECIALIST_RESULT, envelope);

      case 'retry-directive':
        return this.validate(SchemaName.RETRY_DIRECTIVE, envelope);

      case 'decision':
        return this.validate(SchemaName.DECISION_NOTICE, envelope);

      default:
        return {
          valid: false,
          errors: [
            {
              field: 'meta.messageType',
              message: `Unknown message type: ${messageType}`,
            },
          ],
        };
    }
  }

  /**
   * Get validator function for custom usage
   */
  getValidator(schemaName: SchemaName): ValidateFunction | undefined {
    return this.validators.get(schemaName);
  }
}

/**
 * Global singleton validator instance (lazy-initialized)
 */
let globalValidator: SchemaValidator | null = null;

/**
 * Get or create global validator
 */
export async function getGlobalValidator(): Promise<SchemaValidator> {
  if (!globalValidator) {
    globalValidator = new SchemaValidator();
    await globalValidator.initialize();
  }
  return globalValidator;
}

/**
 * Convenience function: validate envelope
 */
export async function validateEnvelope(envelope: unknown): Promise<ValidationResult> {
  const validator = await getGlobalValidator();
  return validator.validateEnvelope(envelope);
}

/**
 * Convenience function: validate or throw
 */
export async function validateEnvelopeOrThrow(envelope: unknown): Promise<void> {
  const result = await validateEnvelope(envelope);
  if (!result.valid) {
    const errorMessages = result.errors!.map((e) => `${e.field}: ${e.message}`).join(', ');
    throw new Error(`Envelope validation failed: ${errorMessages}`);
  }
}
