/**
 * Context System Benchmarks
 *
 * Performance validation with P95 SLO enforcement:
 * - H4R Retrieval: P95 ≤ 300ms
 * - SCS Slicing: P95 ≤ 50ms
 * - Pack Assembly: P95 ≤ 100ms
 *
 * Run with: npm run bench:context
 */

import { describe, it, expect } from 'vitest';
import { Ranker } from '../../src/context/h4r/ranker.js';
import { ContextSlicer } from '../../src/context/scs/slicer.js';
import { Summarizer } from '../../src/context/pack/summarizer.js';
import { AffordanceGenerator } from '../../src/context/pack/affordances.js';
import type { SpecialistMetadata } from '../../src/context/scs/types.js';
import { generateDeterministicCorpus } from './utils/seed.js';

describe('Context System Benchmarks', () => {
  const now = new Date('2025-10-03T12:00:00Z');

  const specialist: SpecialistMetadata = {
    type: 'specialist',
    id: 'benchmark-bot',
    securityLevel: 'internal',
    authorizedGroups: ['qa-team'],
  };

  describe('H4R Ranker Performance', () => {
    it('should meet P95 ≤ 300ms for 1000-item corpus', () => {
      const corpus = generateDeterministicCorpus(42, 1000);
      const ranker = new Ranker({ now });

      const samples: number[] = [];

      // Run 100 iterations to get P95
      for (let i = 0; i < 100; i++) {
        const start = performance.now();
        ranker.rankAll(corpus);
        const duration = performance.now() - start;
        samples.push(duration);
      }

      // Calculate P95
      samples.sort((a, b) => a - b);
      const p95Index = Math.floor(samples.length * 0.95);
      const p95 = samples[p95Index];

      console.log(`  H4R P95: ${p95.toFixed(2)}ms`);
      expect(p95).toBeLessThanOrEqual(300);
    });

    it('should meet P95 ≤ 100ms for 100-item corpus', () => {
      const corpus = generateDeterministicCorpus(42, 100);
      const ranker = new Ranker({ now });

      const samples: number[] = [];

      for (let i = 0; i < 100; i++) {
        const start = performance.now();
        ranker.rankAll(corpus);
        const duration = performance.now() - start;
        samples.push(duration);
      }

      samples.sort((a, b) => a - b);
      const p95 = samples[Math.floor(samples.length * 0.95)];

      console.log(`  H4R P95 (100 items): ${p95.toFixed(2)}ms`);
      expect(p95).toBeLessThanOrEqual(100);
    });
  });

  describe('SCS Slicer Performance', () => {
    it('should meet P95 ≤ 50ms for 100-item slicing', async () => {
      const corpus = generateDeterministicCorpus(42, 100);
      const ranker = new Ranker({ now });
      const ranked = ranker.rankAll(corpus);

      const slicer = new ContextSlicer({
        budget: { maxBytes: 50000 },
        fallbackToLocal: true,
      });

      const samples: number[] = [];

      for (let i = 0; i < 100; i++) {
        const start = performance.now();
        await slicer.slice(specialist, ranked);
        const duration = performance.now() - start;
        samples.push(duration);
      }

      samples.sort((a, b) => a - b);
      const p95 = samples[Math.floor(samples.length * 0.95)];

      console.log(`  SCS P95: ${p95.toFixed(2)}ms`);
      expect(p95).toBeLessThanOrEqual(50);
    });

    it('should meet P95 ≤ 20ms for 10-item slicing', async () => {
      const corpus = generateDeterministicCorpus(42, 10);
      const ranker = new Ranker({ now });
      const ranked = ranker.rankAll(corpus);

      const slicer = new ContextSlicer({
        budget: { maxBytes: 10000 },
        fallbackToLocal: true,
      });

      const samples: number[] = [];

      for (let i = 0; i < 100; i++) {
        const start = performance.now();
        await slicer.slice(specialist, ranked);
        const duration = performance.now() - start;
        samples.push(duration);
      }

      samples.sort((a, b) => a - b);
      const p95 = samples[Math.floor(samples.length * 0.95)];

      console.log(`  SCS P95 (10 items): ${p95.toFixed(2)}ms`);
      expect(p95).toBeLessThanOrEqual(20);
    });
  });

  describe('Pack Assembly Performance', () => {
    it('should meet P95 ≤ 100ms for summarization + affordances', () => {
      const corpus = generateDeterministicCorpus(42, 50);
      const ranker = new Ranker({ now });
      const ranked = ranker.rankAll(corpus);

      const samples: number[] = [];

      for (let i = 0; i < 100; i++) {
        const start = performance.now();
        Summarizer.summarize(ranked, 5);
        AffordanceGenerator.generate(ranked);
        const duration = performance.now() - start;
        samples.push(duration);
      }

      samples.sort((a, b) => a - b);
      const p95 = samples[Math.floor(samples.length * 0.95)];

      console.log(`  Pack P95: ${p95.toFixed(2)}ms`);
      expect(p95).toBeLessThanOrEqual(100);
    });
  });

  describe('End-to-End Pipeline Performance', () => {
    it('should meet P95 ≤ 450ms for complete pipeline (100 items)', async () => {
      const corpus = generateDeterministicCorpus(42, 100);

      const samples: number[] = [];

      for (let i = 0; i < 50; i++) {
        const start = performance.now();

        // H4R
        const ranker = new Ranker({ now });
        const ranked = ranker.rankAll(corpus);

        // SCS
        const slicer = new ContextSlicer({ fallbackToLocal: true });
        await slicer.slice(specialist, ranked);

        // Pack
        Summarizer.summarize(ranked, 5);
        AffordanceGenerator.generate(ranked);

        const duration = performance.now() - start;
        samples.push(duration);
      }

      samples.sort((a, b) => a - b);
      const p95 = samples[Math.floor(samples.length * 0.95)];

      console.log(`  E2E P95: ${p95.toFixed(2)}ms`);

      // Combined SLO: 300 + 50 + 100 = 450ms
      expect(p95).toBeLessThanOrEqual(450);
    });
  });

  describe('Scalability Tests', () => {
    it('should scale linearly with corpus size', () => {
      const sizes = [10, 50, 100, 500, 1000];
      const timings: Array<{ size: number; avgMs: number }> = [];

      for (const size of sizes) {
        const corpus = generateDeterministicCorpus(42, size);
        const ranker = new Ranker({ now });

        const samples: number[] = [];
        for (let i = 0; i < 20; i++) {
          const start = performance.now();
          ranker.rankAll(corpus);
          samples.push(performance.now() - start);
        }

        const avgMs = samples.reduce((a, b) => a + b, 0) / samples.length;
        timings.push({ size, avgMs });
        console.log(`  ${size} items: ${avgMs.toFixed(2)}ms avg`);
      }

      // Verify reasonable scaling (not exponential)
      for (let i = 1; i < timings.length; i++) {
        const ratio = timings[i].avgMs / timings[i - 1].avgMs;
        const sizeRatio = timings[i].size / timings[i - 1].size;

        // Time should not grow faster than size grows
        expect(ratio).toBeLessThan(sizeRatio * 2);
      }
    });

    it('should handle large corpus without memory issues', () => {
      const corpus = generateDeterministicCorpus(42, 5000);
      const ranker = new Ranker({ now });

      const start = performance.now();
      const ranked = ranker.rankAll(corpus);
      const duration = performance.now() - start;

      console.log(`  5000 items: ${duration.toFixed(2)}ms`);

      expect(ranked).toHaveLength(5000);
      expect(duration).toBeLessThan(2000); // Should complete in < 2s
    });
  });

  describe('Memory Efficiency', () => {
    it('should not leak memory across iterations', () => {
      const corpus = generateDeterministicCorpus(42, 200);
      const ranker = new Ranker({ now });

      // Warmup
      for (let i = 0; i < 10; i++) {
        ranker.rankAll(corpus);
      }

      // Force GC if available
      if (global.gc) {
        global.gc();
      }

      const initialMemory = process.memoryUsage().heapUsed;

      // Run many iterations
      for (let i = 0; i < 100; i++) {
        ranker.rankAll(corpus);
      }

      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowthMB = (finalMemory - initialMemory) / 1024 / 1024;

      console.log(`  Memory growth: ${memoryGrowthMB.toFixed(2)}MB`);

      // Should not grow significantly (< 10MB for 100 iterations)
      expect(memoryGrowthMB).toBeLessThan(10);
    });
  });

  describe('Concurrency Tests', () => {
    it('should handle concurrent requests efficiently', async () => {
      const corpus = generateDeterministicCorpus(42, 50);
      const ranker = new Ranker({ now });
      const slicer = new ContextSlicer({ fallbackToLocal: true });

      const concurrentRequests = 10;

      const start = performance.now();

      await Promise.all(
        Array.from({ length: concurrentRequests }, async () => {
          const ranked = ranker.rankAll(corpus);
          await slicer.slice(specialist, ranked);
          Summarizer.summarize(ranked, 5);
          AffordanceGenerator.generate(ranked);
        })
      );

      const duration = performance.now() - start;
      const avgPerRequest = duration / concurrentRequests;

      console.log(`  ${concurrentRequests} concurrent: ${duration.toFixed(2)}ms total`);
      console.log(`  Avg per request: ${avgPerRequest.toFixed(2)}ms`);

      // Concurrent should be more efficient than sequential
      expect(avgPerRequest).toBeLessThan(200);
    });
  });
});
