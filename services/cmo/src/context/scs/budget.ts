/**
 * SCS Budget Manager
 *
 * Enforce byte/token limits on context slices
 */

import type { BudgetConfig } from './types.js';

/**
 * Default budget limits
 */
export const DEFAULT_BUDGET: Required<BudgetConfig> = {
  maxBytes: 122880, // 120KB
  maxTokens: 30000, // ~120KB / 4 chars per token
  maxItems: 100,
};

/**
 * Budget tracker
 */
export class BudgetTracker {
  private limits: Required<BudgetConfig>;
  private used: Required<BudgetConfig>;

  constructor(limits: BudgetConfig = {}) {
    this.limits = {
      maxBytes: limits.maxBytes ?? DEFAULT_BUDGET.maxBytes,
      maxTokens: limits.maxTokens ?? DEFAULT_BUDGET.maxTokens,
      maxItems: limits.maxItems ?? DEFAULT_BUDGET.maxItems,
    };

    this.used = {
      maxBytes: 0,
      maxTokens: 0,
      maxItems: 0,
    };
  }

  /**
   * Estimate tokens from text
   * Simple heuristic: ~4 chars per token
   */
  static estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate byte size of content
   */
  static calculateBytes(content: unknown): number {
    const json = JSON.stringify(content);
    return new TextEncoder().encode(json).length;
  }

  /**
   * Check if adding item would exceed budget
   */
  canAdd(byteSize: number, tokenEstimate?: number): boolean {
    const tokens = tokenEstimate ?? BudgetTracker.estimateTokens(
      byteSize.toString()
    );

    return (
      this.used.maxBytes + byteSize <= this.limits.maxBytes &&
      this.used.maxTokens + tokens <= this.limits.maxTokens &&
      this.used.maxItems + 1 <= this.limits.maxItems
    );
  }

  /**
   * Add item to budget
   */
  add(byteSize: number, tokenEstimate?: number): void {
    const tokens = tokenEstimate ?? BudgetTracker.estimateTokens(
      byteSize.toString()
    );

    this.used.maxBytes += byteSize;
    this.used.maxTokens += tokens;
    this.used.maxItems += 1;
  }

  /**
   * Get remaining budget
   */
  remaining(): Required<BudgetConfig> {
    return {
      maxBytes: Math.max(0, this.limits.maxBytes - this.used.maxBytes),
      maxTokens: Math.max(0, this.limits.maxTokens - this.used.maxTokens),
      maxItems: Math.max(0, this.limits.maxItems - this.used.maxItems),
    };
  }

  /**
   * Get used budget
   */
  getUsed(): Required<BudgetConfig> {
    return { ...this.used };
  }

  /**
   * Get limits
   */
  getLimits(): Required<BudgetConfig> {
    return { ...this.limits };
  }

  /**
   * Check if budget exhausted
   */
  isExhausted(): boolean {
    return (
      this.used.maxBytes >= this.limits.maxBytes ||
      this.used.maxTokens >= this.limits.maxTokens ||
      this.used.maxItems >= this.limits.maxItems
    );
  }

  /**
   * Get utilization percentage
   */
  utilization(): {
    bytes: number;
    tokens: number;
    items: number;
  } {
    return {
      bytes: (this.used.maxBytes / this.limits.maxBytes) * 100,
      tokens: (this.used.maxTokens / this.limits.maxTokens) * 100,
      items: (this.used.maxItems / this.limits.maxItems) * 100,
    };
  }
}
