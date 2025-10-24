/**
 * Novelty Signal (Inverse)
 *
 * Stability preference: favor established patterns over novel items
 * Formula: 1 - novelty, where novelty decreases with age and access
 */

/**
 * Calculate inverse novelty score (higher = more stable/established)
 *
 * @param createdAt - Creation timestamp
 * @param accessCount - Number of accesses
 * @param now - Current time (for testing)
 * @returns Score between 0 and 1
 */
export function calculateNoveltyInverse(
  createdAt: Date,
  accessCount: number = 0,
  now: Date = new Date()
): number {
  const ageMs = now.getTime() - createdAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  // Novelty = 1 for brand new items with no accesses
  // Novelty → 0 as item ages and gets accessed

  // Age factor: items older than 30 days are "established"
  const ageFactor = Math.min(ageDays / 30, 1.0);

  // Access factor: items with 10+ accesses are "established"
  const accessFactor = Math.min(accessCount / 10, 1.0);

  // Combined: take max to give benefit to either age or access
  const stability = Math.max(ageFactor, accessFactor);

  // Inverse novelty: higher score = more stable
  return Math.max(0, Math.min(1, stability));
}
