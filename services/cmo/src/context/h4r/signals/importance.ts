/**
 * Importance Signal
 *
 * User/system priority tagging: explicitly important items score higher
 * Value is already in [0, 1] range from metadata
 */

/**
 * Calculate importance score
 *
 * @param importance - Importance value from metadata (0-1)
 * @returns Score between 0 and 1
 */
export function calculateImportance(importance: number = 0.5): number {
  // Already normalized, just clamp
  return Math.max(0, Math.min(1, importance));
}
