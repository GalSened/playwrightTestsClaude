/**
 * Recency Signal
 *
 * Time-decay scoring: newer items score higher
 * Formula: exp(-λ * age_days)
 */

/**
 * Calculate recency score
 *
 * @param createdAt - Item creation timestamp
 * @param lambda - Decay factor (default: 0.1, slower decay)
 * @param now - Current time (for testing)
 * @returns Score between 0 and 1
 */
export function calculateRecency(
  createdAt: Date,
  lambda: number = 0.1,
  now: Date = new Date()
): number {
  const ageMs = now.getTime() - createdAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  // exp(-λ * t) where t is age in days
  // λ = 0.1 means ~10% decay per day
  const score = Math.exp(-lambda * ageDays);

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, score));
}
