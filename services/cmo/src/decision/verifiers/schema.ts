/**
 * Schema Verifier
 *
 * Validates context result against expected JSON schema.
 * Uses Ajv for validation with strict mode.
 */

import Ajv from 'ajv';
import type { Verifier, VerificationInput, VerificationResult } from './types.js';

/**
 * Default schema for ContextResult
 */
const DEFAULT_CONTEXT_RESULT_SCHEMA = {
  type: 'object',
  required: ['summary', 'affordances'],
  properties: {
    summary: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
      minItems: 1,
    },
    affordances: {
      type: 'array',
      items: {
        type: 'object',
        required: ['action', 'why'],
        properties: {
          action: { type: 'string', minLength: 1 },
          why: { type: 'string', minLength: 1 },
        },
      },
      minItems: 1,
    },
    explain: {
      type: 'object',
    },
  },
};

/**
 * Schema Verifier
 *
 * Validates context result structure and content against schema.
 */
export class SchemaVerifier implements Verifier {
  readonly name = 'schema';

  private ajv: Ajv;
  private defaultSchema: Record<string, unknown>;

  constructor(options: { strictMode?: boolean } = {}) {
    this.ajv = new Ajv({
      strict: options.strictMode ?? true,
      allErrors: true,
      verbose: true,
    });

    this.defaultSchema = DEFAULT_CONTEXT_RESULT_SCHEMA;
  }

  async verify(
    input: VerificationInput,
    timeoutMs: number = 2000
  ): Promise<VerificationResult> {
    const start = performance.now();

    try {
      // Use provided schema or default
      const schema = input.expectedSchema ?? this.defaultSchema;

      // Compile schema
      const validate = this.ajv.compile(schema);

      // Validate
      const valid = validate(input.contextResult);

      const durationMs = performance.now() - start;

      if (valid) {
        return {
          verifier: this.name,
          passed: true,
          confidence: 1.0,
          reason: 'Context result matches expected schema',
          evidence: {
            schema,
            validated: true,
          },
          durationMs,
          timestamp: new Date(),
        };
      } else {
        return {
          verifier: this.name,
          passed: false,
          confidence: 1.0, // we're confident it's invalid
          reason: `Schema validation failed: ${this.ajv.errorsText(validate.errors)}`,
          evidence: {
            schema,
            errors: validate.errors ?? [],
          },
          durationMs,
          timestamp: new Date(),
        };
      }
    } catch (error) {
      const durationMs = performance.now() - start;
      return {
        verifier: this.name,
        passed: false,
        confidence: 0.5, // uncertain due to error
        reason: `Schema verification error: ${(error as Error).message}`,
        evidence: {
          error: (error as Error).message,
        },
        durationMs,
        timestamp: new Date(),
      };
    }
  }
}
