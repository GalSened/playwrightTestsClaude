/**
 * Causal Graph Builder
 *
 * Optional: Build causal relationships between evidence items
 */

import type { H4RResult } from '../h4r/types.js';
import type { CausalGraph } from './types.js';

/**
 * Causal graph builder
 */
export class CausalGraphBuilder {
  /**
   * Build causal graph from evidence
   *
   * This is a placeholder implementation.
   * Real implementation would:
   * 1. Extract temporal relationships from timestamps
   * 2. Identify cause-effect patterns in content
   * 3. Use graph algorithms to find chains
   *
   * @param results - H4R results
   * @returns Causal graph (or null if insufficient data)
   */
  static build(results: H4RResult[]): CausalGraph | null {
    if (results.length < 2) {
      return null;
    }

    // Build nodes from results
    const nodes = results.map((r) => ({
      id: r.id,
      label: this.generateLabel(r),
    }));

    // Infer edges from temporal order and causal keywords
    const edges: CausalGraph['edges'] = [];

    for (let i = 0; i < results.length - 1; i++) {
      const current = results[i];
      const next = results[i + 1];

      // Check if there's a causal relationship
      const relationship = this.inferRelationship(current, next);

      if (relationship) {
        edges.push({
          from: current.id,
          to: next.id,
          type: relationship.type,
          weight: relationship.weight,
        });
      }
    }

    // Only return graph if we found meaningful edges
    if (edges.length === 0) {
      return null;
    }

    return { nodes, edges };
  }

  /**
   * Generate node label from result
   */
  private static generateLabel(result: H4RResult): string {
    const text = JSON.stringify(result.content);

    // Extract first meaningful sentence
    const sentences = text
      .split(/[.!?]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);

    if (sentences.length > 0) {
      // Truncate to 50 chars
      const label = sentences[0].substring(0, 50);
      return label.length < sentences[0].length ? label + '...' : label;
    }

    return `Item ${result.id.substring(0, 8)}`;
  }

  /**
   * Infer relationship between two items
   */
  private static inferRelationship(
    from: H4RResult,
    to: H4RResult
  ): { type: CausalGraph['edges'][0]['type']; weight: number } | null {
    const fromText = JSON.stringify(from.content).toLowerCase();
    const toText = JSON.stringify(to.content).toLowerCase();

    // Check for causal keywords
    if (
      toText.includes('because') ||
      toText.includes('caused by') ||
      toText.includes('due to')
    ) {
      return { type: 'causes', weight: 0.8 };
    }

    // Check for temporal precedence
    const fromTime = from.metadata.createdAt;
    const toTime = to.metadata.createdAt;

    if (fromTime < toTime) {
      return { type: 'precedes', weight: 0.5 };
    }

    // Check for influence keywords
    if (
      toText.includes('influenced by') ||
      toText.includes('related to') ||
      toText.includes('affected by')
    ) {
      return { type: 'influences', weight: 0.6 };
    }

    return null;
  }
}
