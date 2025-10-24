/**
 * Frequency Signal
 *
 * Access count weighting: frequently accessed items score higher
 * Formula: log(access_count + 1) / log(max_expected_count + 1)
 */

/**
 * Calculate frequency score
 *
 * @param accessCount - Number of times item has been accessed
 * @param maxExpected - Expected maximum access count for normalization (default: 100)
 * @returns Score between 0 and 1
 */
export function calculateFrequency(
  accessCount: number = 0,
  maxExpected: number = 100
): number {
  // log(n + 1) to handle zero gracefully and dampen large counts
  const score = Math.log(accessCount + 1) / Math.log(maxExpected + 1);

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, score));
}
