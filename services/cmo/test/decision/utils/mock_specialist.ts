/**
 * Mock Specialist for Integration Testing
 *
 * Simulates specialist behavior with configurable responses.
 * Supports hint-driven improvements and injectable failures.
 */

/**
 * Mock specialist configuration
 */
export interface MockSpecialistConfig {
  /**
   * Specialist ID
   */
  id?: string;

  /**
   * Default behavior
   */
  defaultBehavior?: 'pass' | 'fail' | 'low_confidence';

  /**
   * Initial pass rate (0-1)
   */
  initialPassRate?: number;

  /**
   * Whether to improve on hints
   */
  improveOnHints?: boolean;

  /**
   * Injectable failures
   */
  injectableFailures?: {
    schemaInvalid?: boolean;
    safetyDeny?: boolean;
    timeout?: boolean;
    lowConfidence?: boolean;
  };
}

/**
 * Specialist response
 */
export interface SpecialistResponse {
  summary: string[];
  affordances: Array<{ action: string; why: string }>;
  confidence?: number;
  metadata?: {
    specialist_id: string;
    total_latency_ms: number;
    schema_valid: boolean;
  };
}

/**
 * Mock Specialist
 *
 * Simulates specialist responses with configurable behavior
 */
export class MockSpecialist {
  private config: Required<MockSpecialistConfig>;
  private attemptCount = 0;

  constructor(config: MockSpecialistConfig = {}) {
    this.config = {
      id: config.id ?? 'mock-specialist-default',
      defaultBehavior: config.defaultBehavior ?? 'pass',
      initialPassRate: config.initialPassRate ?? 0.5,
      improveOnHints: config.improveOnHints ?? true,
      injectableFailures: config.injectableFailures ?? {},
    };
  }

  /**
   * Process task with optional hints
   *
   * @param task - task to process
   * @param hints - retry hints
   * @returns specialist response
   */
  async process(
    task: { type: string; inputs: Record<string, unknown> },
    hints?: string[]
  ): Promise<SpecialistResponse> {
    this.attemptCount++;

    // Check injectable failures
    if (this.config.injectableFailures.schemaInvalid) {
      return this.generateSchemaInvalidResponse();
    }

    if (this.config.injectableFailures.safetyDeny) {
      return this.generateSafetyDenyResponse();
    }

    if (this.config.injectableFailures.timeout) {
      return this.generateTimeoutResponse();
    }

    if (this.config.injectableFailures.lowConfidence) {
      return this.generateLowConfidenceResponse();
    }

    // Process hints
    const improvedByHints = this.processHints(hints);

    // Determine quality based on attempts + hints
    const quality = this.calculateQuality(improvedByHints);

    return this.generateResponse(quality, task);
  }

  /**
   * Reset attempt counter
   */
  reset(): void {
    this.attemptCount = 0;
  }

  /**
   * Get current attempt count
   */
  getAttemptCount(): number {
    return this.attemptCount;
  }

  /**
   * Process hints and determine improvement
   */
  private processHints(hints?: string[]): boolean {
    if (!hints || hints.length === 0 || !this.config.improveOnHints) {
      return false;
    }

    // Check for improvement triggers
    const improvementHints = [
      'selector_tighten',
      'increase_timeout',
      'fix_flaky',
      'Provide more detailed evidence',
      'Ensure result matches expected schema',
      'Focus on stable',
      'Use data-testid',
    ];

    return hints.some((hint) =>
      improvementHints.some((trigger) => hint.includes(trigger))
    );
  }

  /**
   * Calculate response quality
   */
  private calculateQuality(improvedByHints: boolean): number {
    let quality = this.config.initialPassRate;

    // Improve with each attempt (learning)
    if (this.attemptCount > 1) {
      quality += 0.15 * (this.attemptCount - 1);
    }

    // Improve with hints
    if (improvedByHints) {
      quality += 0.25;
    }

    // Cap at 1.0
    return Math.min(quality, 1.0);
  }

  /**
   * Generate response based on quality
   */
  private generateResponse(
    quality: number,
    task: { type: string; inputs: Record<string, unknown> }
  ): SpecialistResponse {
    const isHighQuality = quality >= 0.7;

    if (isHighQuality) {
      return {
        summary: [
          `Successfully executed ${task.type}`,
          'All test assertions passed',
          'No errors detected',
          'High confidence result',
        ],
        affordances: [
          { action: 'verify success', why: 'to confirm test passed' },
          { action: 'check assertions', why: 'to validate expectations' },
          { action: 'review logs', why: 'to ensure clean execution' },
        ],
        confidence: quality,
        metadata: {
          specialist_id: this.config.id,
          total_latency_ms: 800,
          schema_valid: true,
        },
      };
    } else {
      return {
        summary: [
          `Test ${task.type} completed with issues`,
          'Some assertions failed',
          'Requires investigation',
        ],
        affordances: [
          { action: 'retry test', why: 'to attempt fix' },
          { action: 'check errors', why: 'to diagnose issues' },
        ],
        confidence: quality,
        metadata: {
          specialist_id: this.config.id,
          total_latency_ms: 1200,
          schema_valid: true,
        },
      };
    }
  }

  /**
   * Generate schema invalid response (missing required fields)
   */
  private generateSchemaInvalidResponse(): SpecialistResponse {
    return {
      summary: [],
      affordances: [],
      metadata: {
        specialist_id: this.config.id,
        total_latency_ms: 500,
        schema_valid: false,
      },
    };
  }

  /**
   * Generate safety deny response (PII detected)
   */
  private generateSafetyDenyResponse(): SpecialistResponse {
    return {
      summary: [
        'Test execution completed',
        'Detected sensitive data: SSN 123-45-6789',
        'Credit card: 4111-1111-1111-1111',
      ],
      affordances: [
        { action: 'redact PII', why: 'to comply with policy' },
      ],
      confidence: 0.8,
      metadata: {
        specialist_id: this.config.id,
        total_latency_ms: 1000,
        schema_valid: true,
      },
    };
  }

  /**
   * Generate timeout response
   */
  private generateTimeoutResponse(): SpecialistResponse {
    return {
      summary: [
        'Test execution timed out after 30 seconds',
        'Element loading too slow',
      ],
      affordances: [
        { action: 'increase timeout', why: 'to allow more time' },
      ],
      confidence: 0.4,
      metadata: {
        specialist_id: this.config.id,
        total_latency_ms: 30000,
        schema_valid: true,
      },
    };
  }

  /**
   * Generate low confidence response
   */
  private generateLowConfidenceResponse(): SpecialistResponse {
    return {
      summary: [
        'Test completed with uncertain results',
        'Unable to verify all assertions',
      ],
      affordances: [
        { action: 'retry with higher confidence', why: 'to improve accuracy' },
      ],
      confidence: 0.2,
      metadata: {
        specialist_id: this.config.id,
        total_latency_ms: 1500,
        schema_valid: true,
      },
    };
  }
}

/**
 * Create mock specialist with preset configurations
 */
export function createMockSpecialist(preset: 'passing' | 'failing' | 'improving' | 'flaky'): MockSpecialist {
  switch (preset) {
    case 'passing':
      return new MockSpecialist({
        id: 'mock-specialist-passing',
        defaultBehavior: 'pass',
        initialPassRate: 0.9,
        improveOnHints: false,
      });

    case 'failing':
      return new MockSpecialist({
        id: 'mock-specialist-failing',
        defaultBehavior: 'fail',
        initialPassRate: 0.3,
        improveOnHints: false,
      });

    case 'improving':
      return new MockSpecialist({
        id: 'mock-specialist-improving',
        defaultBehavior: 'fail',
        initialPassRate: 0.4,
        improveOnHints: true,
      });

    case 'flaky':
      return new MockSpecialist({
        id: 'mock-specialist-flaky',
        defaultBehavior: 'fail',
        initialPassRate: 0.5,
        improveOnHints: true,
      });

    default:
      return new MockSpecialist();
  }
}
