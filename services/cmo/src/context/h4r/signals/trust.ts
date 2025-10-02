/**
 * Trust Signal
 *
 * Source reliability: trusted sources score higher
 * Value is already in [0, 1] range from metadata
 */

/**
 * Calculate trust score
 *
 * @param trust - Trust value from metadata (0-1, where 1 = fully trusted)
 * @returns Score between 0 and 1
 */
export function calculateTrust(trust: number = 0.7): number {
  // Already normalized, just clamp
  // Default 0.7 assumes moderate trust for untagged sources
  return Math.max(0, Math.min(1, trust));
}
