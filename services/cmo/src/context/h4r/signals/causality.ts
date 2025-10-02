/**
 * Causality Signal
 *
 * Causal chain relevance: items closer in causal graph score higher
 * Formula: 1 / (1 + distance) where distance is graph hops
 */

/**
 * Calculate causality score
 *
 * @param causalDistance - Distance in causal graph (number of hops, null if not connected)
 * @param maxDistance - Maximum meaningful distance (default: 5)
 * @returns Score between 0 and 1
 */
export function calculateCausality(
  causalDistance: number | null = null,
  maxDistance: number = 5
): number {
  // If no causal connection, return neutral score
  if (causalDistance === null || causalDistance < 0) {
    return 0.5;
  }

  // Inverse distance: closer = higher score
  // 1 / (1 + d) gives: d=0 → 1.0, d=1 → 0.5, d=5 → 0.17
  const score = 1 / (1 + Math.min(causalDistance, maxDistance));

  return Math.max(0, Math.min(1, score));
}
