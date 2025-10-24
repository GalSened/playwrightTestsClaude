/**
 * SCS (Specialist Context Slicer)
 *
 * Policy-aware context slicing with budget enforcement
 */

import type {
  SpecialistMetadata,
  SlicerOptions,
  AgentContextSlice,
  SlicedItem,
} from './types.js';
import type { H4RResult } from '../h4r/types.js';
import { BudgetTracker } from './budget.js';
import { OPAClient } from './policies/opa-client.js';
import {
  applyFallbackRules,
  redactContent,
} from './policies/redaction-rules.js';

/**
 * Specialist Context Slicer
 */
export class ContextSlicer {
  private options: Required<SlicerOptions>;
  private opaClient: OPAClient;

  constructor(options: SlicerOptions = {}) {
    this.options = {
      budget: options.budget || {},
      opaUrl: options.opaUrl || process.env.SCS_OPA_URL || '',
      opaPolicyPath:
        options.opaPolicyPath ||
        process.env.SCS_OPA_POLICY_PATH ||
        '/v1/data/cmo/context',
      opaCacheTtl: options.opaCacheTtl ?? 60000,
      fallbackToLocal: options.fallbackToLocal ?? true,
    };

    this.opaClient = new OPAClient({
      url: this.options.opaUrl,
      policyPath: this.options.opaPolicyPath,
      cacheTtl: this.options.opaCacheTtl,
    });
  }

  /**
   * Slice context for specialist
   */
  async slice(
    specialist: SpecialistMetadata,
    results: H4RResult[]
  ): Promise<AgentContextSlice> {
    const budget = new BudgetTracker(this.options.budget);
    const warnings: string[] = [];
    const slicedItems: SlicedItem[] = [];

    let totalRedacted = 0;
    let totalDroppedBudget = 0;

    // Use OPA if available, otherwise fallback
    const useOPA = this.opaClient.isAvailable();
    if (!useOPA && !this.options.fallbackToLocal) {
      warnings.push('OPA unavailable and fallback disabled');
    }

    for (const result of results) {
      // 1. Evaluate policy
      const opaDecision = useOPA
        ? await this.opaClient.evaluate(specialist, result)
        : applyFallbackRules(specialist, result);

      // 2. Check if allowed
      if (!opaDecision.allow) {
        totalRedacted++;
        continue;
      }

      // 3. Apply redaction if needed
      let content = result.content;
      if (opaDecision.redact && opaDecision.redactedFields) {
        content = redactContent(content, opaDecision.redactedFields);
        totalRedacted++;
      }

      // 4. Calculate byte size and token estimate
      const byteSize = BudgetTracker.calculateBytes(content);
      const contentJson = JSON.stringify(content);
      const tokenEstimate = BudgetTracker.estimateTokens(contentJson);

      // 5. Check budget
      if (!budget.canAdd(byteSize, tokenEstimate)) {
        totalDroppedBudget++;
        continue;
      }

      // 6. Add to slice
      budget.add(byteSize, tokenEstimate);
      slicedItems.push({
        original: result,
        redactedContent: opaDecision.redact ? content : undefined,
        opaDecision,
        byteSize,
      });
    }

    // Check if budget was exhausted prematurely
    if (totalDroppedBudget > 0) {
      warnings.push(
        `Budget exhausted: ${totalDroppedBudget} items dropped`
      );
    }

    return {
      items: slicedItems,
      totalAvailable: results.length,
      totalIncluded: slicedItems.length,
      totalRedacted,
      totalDroppedBudget,
      budgetUsed: {
        bytes: budget.getUsed().maxBytes,
        estimatedTokens: budget.getUsed().maxTokens,
        items: budget.getUsed().maxItems,
      },
      budgetLimits: budget.getLimits(),
      warnings,
    };
  }

  /**
   * Get OPA cache stats
   */
  getOPACacheStats(): { size: number; ttl: number } {
    return this.opaClient.getCacheStats();
  }

  /**
   * Clear OPA cache
   */
  clearOPACache(): void {
    this.opaClient.clearCache();
  }
}
