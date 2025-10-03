/**
 * Retry Policy
 *
 * Determines retry strategy based on error taxonomy and context.
 * Maps error categories to specialist routing and context adjustments.
 */

import { ErrorCategory } from './taxonomy.js';

/**
 * Retry action
 */
export enum RetryAction {
  /**
   * Accept result (no retry needed)
   */
  ACCEPT = 'ACCEPT',

  /**
   * Retry with same specialist, expanded context
   */
  RETRY_EXPAND_CONTEXT = 'RETRY_EXPAND_CONTEXT',

  /**
   * Retry with different specialist
   */
  RETRY_DIFFERENT_SPECIALIST = 'RETRY_DIFFERENT_SPECIALIST',

  /**
   * Retry with schema hints
   */
  RETRY_WITH_SCHEMA = 'RETRY_WITH_SCHEMA',

  /**
   * Retry with stability-focused specialist
   */
  RETRY_STABILITY = 'RETRY_STABILITY',

  /**
   * Retry with selector-healing specialist
   */
  RETRY_SELECTOR_HEAL = 'RETRY_SELECTOR_HEAL',

  /**
   * Escalate to human review
   */
  ESCALATE = 'ESCALATE',
}

/**
 * Retry decision
 */
export interface RetryDecision {
  /**
   * Recommended action
   */
  action: RetryAction;

  /**
   * Target specialist ID (if retry)
   */
  targetSpecialist?: string;

  /**
   * Context adjustments (delta to apply)
   */
  contextDelta?: {
    expandBudget?: number; // increase budget by N bytes
    addHints?: string[]; // additional hints to provide
    includeSchema?: boolean; // include schema in context
  };

  /**
   * Max retries allowed for this category
   */
  maxRetries: number;

  /**
   * Human-readable reason
   */
  reason: string;

  /**
   * Confidence in decision ∈ [0, 1]
   */
  confidence: number;
}

/**
 * Retry policy configuration
 */
export interface RetryPolicyConfig {
  /**
   * Global max retry depth (across all categories)
   */
  globalMaxRetries?: number;

  /**
   * Per-category max retries
   */
  categoryMaxRetries?: Partial<Record<ErrorCategory, number>>;

  /**
   * Specialist routing map
   */
  specialistRouting?: Partial<Record<ErrorCategory, string>>;

  /**
   * Enable escalation
   */
  enableEscalation?: boolean;
}

/**
 * Default category max retries
 */
const DEFAULT_CATEGORY_MAX_RETRIES: Record<ErrorCategory, number> = {
  [ErrorCategory.SCHEMA_VIOLATION]: 2,
  [ErrorCategory.MISSING_EVIDENCE]: 3,
  [ErrorCategory.FLAKY_PATTERN]: 2,
  [ErrorCategory.SELECTOR_ISSUE]: 2,
  [ErrorCategory.POLICY_DEGRADED]: 0, // no retry, escalate immediately
  [ErrorCategory.LOW_CONFIDENCE]: 2,
  [ErrorCategory.TIMEOUT]: 1,
  [ErrorCategory.INCONSISTENT]: 2,
  [ErrorCategory.UNKNOWN]: 1,
};

/**
 * Default specialist routing
 */
const DEFAULT_SPECIALIST_ROUTING: Partial<Record<ErrorCategory, string>> = {
  [ErrorCategory.FLAKY_PATTERN]: 'specialist-stability',
  [ErrorCategory.SELECTOR_ISSUE]: 'specialist-selector-heal',
  [ErrorCategory.TIMEOUT]: 'specialist-performance',
};

/**
 * Retry Policy
 *
 * Encodes retry logic based on error taxonomy.
 */
export class RetryPolicy {
  private config: Required<RetryPolicyConfig>;

  constructor(config: RetryPolicyConfig = {}) {
    this.config = {
      globalMaxRetries: config.globalMaxRetries ?? 3,
      categoryMaxRetries: {
        ...DEFAULT_CATEGORY_MAX_RETRIES,
        ...config.categoryMaxRetries,
      },
      specialistRouting: {
        ...DEFAULT_SPECIALIST_ROUTING,
        ...config.specialistRouting,
      },
      enableEscalation: config.enableEscalation ?? true,
    };
  }

  /**
   * Decide retry action based on error category and retry depth
   *
   * @param params - decision inputs
   * @returns retry decision
   */
  decide(params: {
    category: ErrorCategory;
    currentRetryDepth: number;
    currentSpecialist: string;
    categoryConfidence: number;
  }): RetryDecision {
    const { category, currentRetryDepth, currentSpecialist, categoryConfidence } =
      params;

    // Check global max retries
    if (currentRetryDepth >= this.config.globalMaxRetries) {
      return {
        action: RetryAction.ESCALATE,
        maxRetries: this.config.globalMaxRetries,
        reason: `Global max retries reached (${currentRetryDepth}/${this.config.globalMaxRetries})`,
        confidence: 1.0,
      };
    }

    // Check category max retries
    const categoryMax = this.config.categoryMaxRetries[category] ?? 1;
    if (currentRetryDepth >= categoryMax) {
      return {
        action: this.config.enableEscalation ? RetryAction.ESCALATE : RetryAction.ACCEPT,
        maxRetries: categoryMax,
        reason: `Category max retries reached (${currentRetryDepth}/${categoryMax})`,
        confidence: 1.0,
      };
    }

    // Route based on category
    switch (category) {
      case ErrorCategory.SCHEMA_VIOLATION:
        return {
          action: RetryAction.RETRY_WITH_SCHEMA,
          targetSpecialist: currentSpecialist, // same specialist
          contextDelta: {
            includeSchema: true,
            addHints: ['Ensure result matches expected schema'],
          },
          maxRetries: categoryMax,
          reason: 'Retry with schema validation hints',
          confidence: 0.9,
        };

      case ErrorCategory.MISSING_EVIDENCE:
        return {
          action: RetryAction.RETRY_EXPAND_CONTEXT,
          targetSpecialist: currentSpecialist,
          contextDelta: {
            expandBudget: 10000, // increase budget by 10KB
            addHints: ['Provide more detailed evidence'],
          },
          maxRetries: categoryMax,
          reason: 'Retry with expanded context budget',
          confidence: 0.85,
        };

      case ErrorCategory.FLAKY_PATTERN:
        return {
          action: RetryAction.RETRY_STABILITY,
          targetSpecialist:
            this.config.specialistRouting[category] ?? 'specialist-stability',
          contextDelta: {
            addHints: ['Focus on stable, deterministic patterns'],
          },
          maxRetries: categoryMax,
          reason: 'Retry with stability-focused specialist',
          confidence: 0.8,
        };

      case ErrorCategory.SELECTOR_ISSUE:
        return {
          action: RetryAction.RETRY_SELECTOR_HEAL,
          targetSpecialist:
            this.config.specialistRouting[category] ?? 'specialist-selector-heal',
          contextDelta: {
            addHints: ['Use data-testid or robust selectors'],
          },
          maxRetries: categoryMax,
          reason: 'Retry with selector-healing specialist',
          confidence: 0.8,
        };

      case ErrorCategory.POLICY_DEGRADED:
        return {
          action: RetryAction.ESCALATE,
          maxRetries: 0,
          reason: 'Policy violation requires human review',
          confidence: 1.0,
        };

      case ErrorCategory.LOW_CONFIDENCE:
        return {
          action: RetryAction.RETRY_DIFFERENT_SPECIALIST,
          targetSpecialist: this.selectAlternativeSpecialist(currentSpecialist),
          contextDelta: {
            addHints: ['Provide higher confidence analysis'],
          },
          maxRetries: categoryMax,
          reason: 'Retry with alternative specialist',
          confidence: 0.7,
        };

      case ErrorCategory.TIMEOUT:
        return {
          action: RetryAction.RETRY_DIFFERENT_SPECIALIST,
          targetSpecialist:
            this.config.specialistRouting[category] ?? 'specialist-performance',
          maxRetries: categoryMax,
          reason: 'Retry with performance-optimized specialist',
          confidence: 0.75,
        };

      case ErrorCategory.INCONSISTENT:
        return {
          action: RetryAction.RETRY_EXPAND_CONTEXT,
          targetSpecialist: currentSpecialist,
          contextDelta: {
            addHints: ['Ensure consistency with previous results'],
          },
          maxRetries: categoryMax,
          reason: 'Retry with consistency enforcement',
          confidence: 0.7,
        };

      case ErrorCategory.UNKNOWN:
      default:
        return {
          action:
            currentRetryDepth === 0
              ? RetryAction.RETRY_DIFFERENT_SPECIALIST
              : RetryAction.ESCALATE,
          targetSpecialist:
            currentRetryDepth === 0
              ? this.selectAlternativeSpecialist(currentSpecialist)
              : undefined,
          maxRetries: categoryMax,
          reason:
            currentRetryDepth === 0
              ? 'Unknown error, retry once with alternative specialist'
              : 'Unknown error after retry, escalate',
          confidence: 0.5,
        };
    }
  }

  /**
   * Select alternative specialist (simple round-robin for now)
   *
   * @param currentSpecialist - current specialist ID
   * @returns alternative specialist ID
   */
  private selectAlternativeSpecialist(currentSpecialist: string): string {
    // Simple mapping for demo purposes
    const alternatives: Record<string, string> = {
      'specialist-default': 'specialist-advanced',
      'specialist-advanced': 'specialist-default',
    };

    return alternatives[currentSpecialist] ?? 'specialist-advanced';
  }
}
