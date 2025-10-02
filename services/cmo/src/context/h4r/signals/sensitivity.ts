/**
 * Sensitivity Signal (Inverse)
 *
 * Security/privacy penalty: highly sensitive items score lower
 * Formula: 1 - sensitivity, where sensitivity is in [0, 1]
 */

/**
 * Calculate inverse sensitivity score
 *
 * @param sensitivity - Sensitivity level (0=public, 1=highly sensitive)
 * @returns Score between 0 and 1 (higher = less sensitive = safer to include)
 */
export function calculateSensitivityInverse(sensitivity: number = 0): number {
  // Inverse: low sensitivity = high score
  const score = 1 - Math.max(0, Math.min(1, sensitivity));

  return Math.max(0, Math.min(1, score));
}
