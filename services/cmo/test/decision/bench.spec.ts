/**
 * Decision Loop Benchmarks
 *
 * P95 SLO enforcement for production readiness.
 * Measures real decision loop performance with realistic payloads.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { DecisionLoop } from '../../src/decision/loop.js';
import type { DecisionInput } from '../../src/decision/loop.js';
import { SchemaVerifier } from '../../src/decision/verifiers/schema.js';
import { ReplayVerifier } from '../../src/decision/verifiers/replay.js';
import { SmokeVerifier } from '../../src/decision/verifiers/smoke.js';
import { QScoreCalculator } from '../../src/decision/qscore/calculator.js';
import { RetryPolicy } from '../../src/decision/policy/retry.js';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

// SLO Targets (P95)
const SLO_VERIFIERS_QSCORE_P95_MS = 20;
const SLO_DECISION_LOOP_P95_MS = 40;
const SLO_RETRY_PLANNER_P95_MS = 10;

// Benchmark iterations
const ITERATIONS_HIGH = 10000;
const ITERATIONS_MEDIUM = 5000;
const ITERATIONS_LOW = 1000;

/**
 * Calculate percentile
 */
function percentile(values: number[], p: number): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[index] ?? 0;
}

/**
 * Realistic decision input (based on actual specialist results)
 */
const realisticInputs: DecisionInput[] = [
  // High quality result
  {
    contextResult: {
      summary: [
        'Test login-spec-001 executed successfully',
        'All assertions passed',
        'User authentication verified',
        'Session token validated',
      ],
      affordances: [
        { action: 'verify login credentials', why: 'to authenticate user' },
        { action: 'check session state', why: 'to ensure persistence' },
        { action: 'validate security tokens', why: 'to verify authorization' },
      ],
    },
    task: {
      type: 'test-execution',
      inputs: { test_id: 'login-001', test_name: 'user login flow' },
    },
    metadata: {
      specialist_id: 'specialist-playwright-healer',
      message_id: 'bench-msg-001',
      retry_depth: 0,
      total_latency_ms: 1200,
      schema_valid: true,
    },
  },
  // Medium quality result
  {
    contextResult: {
      summary: [
        'Checkout flow partially completed',
        'Payment step skipped due to timeout',
        'Cart state preserved',
      ],
      affordances: [
        { action: 'retry payment', why: 'to complete transaction' },
        { action: 'increase timeout', why: 'to allow processing time' },
      ],
    },
    task: {
      type: 'test-execution',
      inputs: { test_id: 'checkout-001', flow: 'payment' },
    },
    metadata: {
      specialist_id: 'specialist-default',
      message_id: 'bench-msg-002',
      retry_depth: 1,
      total_latency_ms: 3500,
      schema_valid: true,
    },
  },
  // Low quality result (needs retry)
  {
    contextResult: {
      summary: ['Test failed', 'Element not found'],
      affordances: [{ action: 'retry with better selector', why: 'element missing' }],
    },
    task: {
      type: 'test-execution',
      inputs: { test_id: 'search-001' },
    },
    metadata: {
      specialist_id: 'specialist-default',
      message_id: 'bench-msg-003',
      retry_depth: 0,
      total_latency_ms: 800,
      schema_valid: true,
    },
  },
];

describe('Decision Benchmarks (SLO Enforcement)', () => {
  let loop: DecisionLoop;
  const verifiers = [new SchemaVerifier(), new ReplayVerifier(), new SmokeVerifier()];

  beforeAll(() => {
    loop = new DecisionLoop(verifiers, { acceptThreshold: 0.7 });

    // Warmup: run loop once to settle JIT/caches
    void loop.decide(realisticInputs[0]!);
  });

  it('should meet P95 SLO for verifiers + qscore (≤20ms)', async () => {
    const durations: number[] = [];

    for (let i = 0; i < ITERATIONS_HIGH; i++) {
      const input = realisticInputs[i % realisticInputs.length]!;

      const start = performance.now();

      // Measure verifiers + qscore only (core decision logic)
      const qscoreCalc = new QScoreCalculator();
      qscoreCalc.compute({
        contextResult: input.contextResult,
        task: input.task,
        metadata: input.metadata,
      });

      const verifierSuite = loop['verificationSuite'];
      await verifierSuite.verify({
        contextResult: input.contextResult,
        task: input.task,
        metadata: input.metadata,
      });

      const end = performance.now();
      durations.push(end - start);
    }

    const p50 = percentile(durations, 50);
    const p95 = percentile(durations, 95);
    const p99 = percentile(durations, 99);

    console.log(`\n📊 Verifiers + QScore Benchmark (${ITERATIONS_HIGH} iterations):`);
    console.log(`   P50: ${p50.toFixed(2)}ms`);
    console.log(`   P95: ${p95.toFixed(2)}ms`);
    console.log(`   P99: ${p99.toFixed(2)}ms`);
    console.log(`   SLO: ≤${SLO_VERIFIERS_QSCORE_P95_MS}ms (P95)`);

    // Hard fail if SLO breached
    expect(p95).toBeLessThanOrEqual(SLO_VERIFIERS_QSCORE_P95_MS);
  });

  it('should meet P95 SLO for full decision loop (≤40ms)', async () => {
    const durations: number[] = [];

    for (let i = 0; i < ITERATIONS_MEDIUM; i++) {
      const input = realisticInputs[i % realisticInputs.length]!;

      const start = performance.now();
      await loop.decide(input);
      const end = performance.now();

      durations.push(end - start);
    }

    const p50 = percentile(durations, 50);
    const p95 = percentile(durations, 95);
    const p99 = percentile(durations, 99);

    console.log(`\n📊 Full Decision Loop Benchmark (${ITERATIONS_MEDIUM} iterations):`);
    console.log(`   P50: ${p50.toFixed(2)}ms`);
    console.log(`   P95: ${p95.toFixed(2)}ms`);
    console.log(`   P99: ${p99.toFixed(2)}ms`);
    console.log(`   SLO: ≤${SLO_DECISION_LOOP_P95_MS}ms (P95)`);

    // Hard fail if SLO breached
    expect(p95).toBeLessThanOrEqual(SLO_DECISION_LOOP_P95_MS);
  });

  it('should meet P95 SLO for retry planner (≤10ms)', async () => {
    const durations: number[] = [];
    const policy = new RetryPolicy();

    for (let i = 0; i < ITERATIONS_HIGH; i++) {
      const input = realisticInputs[i % realisticInputs.length]!;

      // Simulate classification result
      const category = i % 3 === 0 ? 'SCHEMA_VIOLATION' : i % 3 === 1 ? 'LOW_CONFIDENCE' : 'TIMEOUT';

      const start = performance.now();

      policy.decide({
        category: category as any,
        currentRetryDepth: input.metadata.retry_depth,
        currentSpecialist: input.metadata.specialist_id,
        categoryConfidence: 0.8,
      });

      const end = performance.now();
      durations.push(end - start);
    }

    const p50 = percentile(durations, 50);
    const p95 = percentile(durations, 95);
    const p99 = percentile(durations, 99);

    console.log(`\n📊 Retry Planner Benchmark (${ITERATIONS_HIGH} iterations):`);
    console.log(`   P50: ${p50.toFixed(2)}ms`);
    console.log(`   P95: ${p95.toFixed(2)}ms`);
    console.log(`   P99: ${p99.toFixed(2)}ms`);
    console.log(`   SLO: ≤${SLO_RETRY_PLANNER_P95_MS}ms (P95)`);

    // Hard fail if SLO breached
    expect(p95).toBeLessThanOrEqual(SLO_RETRY_PLANNER_P95_MS);
  });

  it('should export benchmark results to JSON', async () => {
    const durations: number[] = [];

    for (let i = 0; i < ITERATIONS_LOW; i++) {
      const input = realisticInputs[i % realisticInputs.length]!;
      const start = performance.now();
      await loop.decide(input);
      const end = performance.now();
      durations.push(end - start);
    }

    const results = {
      timestamp: new Date().toISOString(),
      iterations: ITERATIONS_LOW,
      slos: {
        verifiers_qscore_p95_ms: SLO_VERIFIERS_QSCORE_P95_MS,
        decision_loop_p95_ms: SLO_DECISION_LOOP_P95_MS,
        retry_planner_p95_ms: SLO_RETRY_PLANNER_P95_MS,
      },
      results: {
        decision_loop: {
          p50_ms: percentile(durations, 50),
          p95_ms: percentile(durations, 95),
          p99_ms: percentile(durations, 99),
          passed: percentile(durations, 95) <= SLO_DECISION_LOOP_P95_MS,
        },
      },
    };

    // Write to reports directory
    const reportPath = 'reports/grade-bench.json';
    try {
      mkdirSync(dirname(reportPath), { recursive: true });
      writeFileSync(reportPath, JSON.stringify(results, null, 2));
      console.log(`\n✅ Benchmark results exported to ${reportPath}`);
    } catch (err) {
      console.warn(`⚠️  Could not write benchmark report: ${err}`);
    }

    expect(results.results.decision_loop.passed).toBe(true);
  });
});
