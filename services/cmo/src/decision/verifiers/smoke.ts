/**
 * Smoke Verifier
 *
 * Basic sanity checks: non-empty results, reasonable lengths, no obvious errors.
 * Fast, deterministic checks that catch obvious failures.
 */

import type { Verifier, VerificationInput, VerificationResult } from './types.js';

/**
 * Smoke test configuration
 */
interface SmokeConfig {
  minSummaryItems?: number;
  maxSummaryItems?: number;
  minAffordances?: number;
  maxAffordances?: number;
  minSummaryLength?: number;
  maxSummaryLength?: number;
  forbiddenPatterns?: RegExp[];
}

/**
 * Smoke Verifier
 *
 * Fast sanity checks for obviously bad results.
 */
export class SmokeVerifier implements Verifier {
  readonly name = 'smoke';

  private config: Required<SmokeConfig>;

  constructor(config: SmokeConfig = {}) {
    this.config = {
      minSummaryItems: config.minSummaryItems ?? 1,
      maxSummaryItems: config.maxSummaryItems ?? 20,
      minAffordances: config.minAffordances ?? 1,
      maxAffordances: config.maxAffordances ?? 10,
      minSummaryLength: config.minSummaryLength ?? 10,
      maxSummaryLength: config.maxSummaryLength ?? 500,
      forbiddenPatterns: config.forbiddenPatterns ?? [
        /error/i,
        /exception/i,
        /failed to/i,
        /could not/i,
        /unable to/i,
      ],
    };
  }

  async verify(
    input: VerificationInput,
    timeoutMs: number = 2000
  ): Promise<VerificationResult> {
    const start = performance.now();

    try {
      const { contextResult } = input;
      const failures: string[] = [];

      // Check 1: Summary item count
      if (contextResult.summary.length < this.config.minSummaryItems) {
        failures.push(
          `Too few summary items (${contextResult.summary.length} < ${this.config.minSummaryItems})`
        );
      }
      if (contextResult.summary.length > this.config.maxSummaryItems) {
        failures.push(
          `Too many summary items (${contextResult.summary.length} > ${this.config.maxSummaryItems})`
        );
      }

      // Check 2: Affordance count
      if (contextResult.affordances.length < this.config.minAffordances) {
        failures.push(
          `Too few affordances (${contextResult.affordances.length} < ${this.config.minAffordances})`
        );
      }
      if (contextResult.affordances.length > this.config.maxAffordances) {
        failures.push(
          `Too many affordances (${contextResult.affordances.length} > ${this.config.maxAffordances})`
        );
      }

      // Check 3: Summary item lengths
      for (let i = 0; i < contextResult.summary.length; i++) {
        const item = contextResult.summary[i]!;
        if (item.length < this.config.minSummaryLength) {
          failures.push(
            `Summary item ${i} too short (${item.length} < ${this.config.minSummaryLength})`
          );
        }
        if (item.length > this.config.maxSummaryLength) {
          failures.push(
            `Summary item ${i} too long (${item.length} > ${this.config.maxSummaryLength})`
          );
        }
      }

      // Check 4: Forbidden patterns in summary
      const summaryText = contextResult.summary.join(' ');
      for (const pattern of this.config.forbiddenPatterns) {
        if (pattern.test(summaryText)) {
          failures.push(
            `Forbidden pattern detected in summary: ${pattern.source}`
          );
        }
      }

      // Check 5: Affordance structure
      for (let i = 0; i < contextResult.affordances.length; i++) {
        const affordance = contextResult.affordances[i]!;
        if (!affordance.action || affordance.action.trim().length === 0) {
          failures.push(`Affordance ${i} has empty action`);
        }
        if (!affordance.why || affordance.why.trim().length === 0) {
          failures.push(`Affordance ${i} has empty 'why'`);
        }
      }

      // Check 6: Empty strings
      if (contextResult.summary.some((s) => s.trim().length === 0)) {
        failures.push('Summary contains empty strings');
      }

      const passed = failures.length === 0;

      return {
        verifier: this.name,
        passed,
        confidence: 1.0,
        reason: passed
          ? 'All smoke tests passed'
          : `Smoke tests failed: ${failures.join('; ')}`,
        evidence: {
          failures,
          summaryItemCount: contextResult.summary.length,
          affordanceCount: contextResult.affordances.length,
          config: this.config,
        },
        durationMs: performance.now() - start,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        verifier: this.name,
        passed: false,
        confidence: 0.5,
        reason: `Smoke verification error: ${(error as Error).message}`,
        evidence: {
          error: (error as Error).message,
        },
        durationMs: performance.now() - start,
        timestamp: new Date(),
      };
    }
  }
}
