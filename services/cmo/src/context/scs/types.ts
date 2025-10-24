/**
 * SCS (Specialist Context Slicer) Types
 *
 * Policy-aware context slicing with budget enforcement
 */

import type { H4RResult } from '../h4r/types.js';

/**
 * Specialist metadata for context slicing
 */
export interface SpecialistMetadata {
  /**
   * Specialist type
   */
  type: string;

  /**
   * Specialist ID
   */
  id: string;

  /**
   * Specialist capabilities
   */
  capabilities?: string[];

  /**
   * Security level (for OPA policy evaluation)
   */
  securityLevel?: 'public' | 'internal' | 'confidential' | 'restricted';

  /**
   * Authorized teams/groups
   */
  authorizedGroups?: string[];
}

/**
 * OPA policy decision
 */
export interface OPADecision {
  /**
   * Allow access
   */
  allow: boolean;

  /**
   * Redaction required
   */
  redact?: boolean;

  /**
   * Redacted fields (JSONPath expressions)
   */
  redactedFields?: string[];

  /**
   * Policy reason
   */
  reason?: string;
}

/**
 * Budget configuration
 */
export interface BudgetConfig {
  /**
   * Maximum bytes
   */
  maxBytes?: number;

  /**
   * Maximum tokens (estimated)
   */
  maxTokens?: number;

  /**
   * Maximum items
   */
  maxItems?: number;
}

/**
 * Sliced result item
 */
export interface SlicedItem {
  /**
   * Original H4R result
   */
  original: H4RResult;

  /**
   * Redacted content (if OPA required redaction)
   */
  redactedContent?: unknown;

  /**
   * OPA decision
   */
  opaDecision: OPADecision;

  /**
   * Byte size (for budget tracking)
   */
  byteSize: number;
}

/**
 * Agent context slice (minimal, policy-aware)
 */
export interface AgentContextSlice {
  /**
   * Sliced items
   */
  items: SlicedItem[];

  /**
   * Total items in original set
   */
  totalAvailable: number;

  /**
   * Total items included
   */
  totalIncluded: number;

  /**
   * Total items redacted
   */
  totalRedacted: number;

  /**
   * Total items dropped due to budget
   */
  totalDroppedBudget: number;

  /**
   * Budget used
   */
  budgetUsed: {
    bytes: number;
    estimatedTokens: number;
    items: number;
  };

  /**
   * Budget limits
   */
  budgetLimits: BudgetConfig;

  /**
   * Warnings
   */
  warnings: string[];
}

/**
 * Slicer options
 */
export interface SlicerOptions {
  /**
   * Budget configuration
   */
  budget?: BudgetConfig;

  /**
   * OPA server URL
   */
  opaUrl?: string;

  /**
   * OPA policy path
   */
  opaPolicyPath?: string;

  /**
   * Cache OPA decisions (TTL in ms)
   */
  opaCacheTtl?: number;

  /**
   * Fallback to local rules if OPA unavailable
   */
  fallbackToLocal?: boolean;
}
