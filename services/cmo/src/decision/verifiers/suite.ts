/**
 * Verification Suite
 *
 * Orchestrates multiple verifiers with timeout enforcement.
 * Runs verifiers in parallel, collects results, determines overall pass/fail.
 */

import type {
  Verifier,
  VerificationInput,
  VerificationResult,
  VerificationSuiteResult,
  VerifierConfig,
} from './types.js';

/**
 * Verification Suite
 *
 * Manages a collection of verifiers and runs them in parallel.
 */
export class VerificationSuite {
  private verifiers: Verifier[];
  private defaultTimeoutMs: number;
  private enabledVerifiers?: Set<string>;

  constructor(verifiers: Verifier[], config: VerifierConfig = {}) {
    this.verifiers = verifiers;
    this.defaultTimeoutMs = config.defaultTimeoutMs ?? 2000;

    if (config.enabledVerifiers) {
      this.enabledVerifiers = new Set(config.enabledVerifiers);
    }
  }

  /**
   * Run all enabled verifiers
   *
   * @param input - verification input
   * @returns suite result
   */
  async verify(input: VerificationInput): Promise<VerificationSuiteResult> {
    const start = performance.now();

    // Filter enabled verifiers
    const activeVerifiers = this.verifiers.filter(
      (v) => !this.enabledVerifiers || this.enabledVerifiers.has(v.name)
    );

    if (activeVerifiers.length === 0) {
      return {
        passed: true,
        results: [],
        totalDurationMs: performance.now() - start,
        averageConfidence: 1.0,
        timestamp: new Date(),
      };
    }

    // Run verifiers in parallel with timeout enforcement
    const resultPromises = activeVerifiers.map((verifier) =>
      this.runWithTimeout(verifier, input, this.defaultTimeoutMs)
    );

    const results = await Promise.all(resultPromises);

    // Determine overall pass/fail
    const passed = results.every((r) => r.passed);

    // Calculate average confidence
    const averageConfidence =
      results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

    return {
      passed,
      results,
      totalDurationMs: performance.now() - start,
      averageConfidence,
      timestamp: new Date(),
    };
  }

  /**
   * Run verifier with timeout enforcement
   *
   * @param verifier - verifier instance
   * @param input - verification input
   * @param timeoutMs - timeout in milliseconds
   * @returns verification result (or timeout failure)
   */
  private async runWithTimeout(
    verifier: Verifier,
    input: VerificationInput,
    timeoutMs: number
  ): Promise<VerificationResult> {
    const timeoutPromise = new Promise<VerificationResult>((resolve) => {
      setTimeout(() => {
        resolve({
          verifier: verifier.name,
          passed: false,
          confidence: 0.0,
          reason: `Verifier timed out after ${timeoutMs}ms`,
          evidence: { timeout: true },
          durationMs: timeoutMs,
          timestamp: new Date(),
        });
      }, timeoutMs);
    });

    const verifyPromise = verifier.verify(input, timeoutMs);

    return Promise.race([verifyPromise, timeoutPromise]);
  }

  /**
   * Add a verifier to the suite
   *
   * @param verifier - verifier to add
   */
  addVerifier(verifier: Verifier): void {
    this.verifiers.push(verifier);
  }

  /**
   * Remove a verifier from the suite
   *
   * @param name - verifier name
   */
  removeVerifier(name: string): void {
    this.verifiers = this.verifiers.filter((v) => v.name !== name);
  }

  /**
   * Get all registered verifier names
   *
   * @returns array of verifier names
   */
  getVerifierNames(): string[] {
    return this.verifiers.map((v) => v.name);
  }
}
