/**
 * SCS (Specialist Context Slicer) - Unit Tests
 *
 * Test policy-aware slicing with:
 * - Budget enforcement (bytes, tokens, items)
 * - Redaction rules (fallback when OPA unavailable)
 * - Security level filtering
 * - Group-based access control
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ContextSlicer } from '../../../src/context/scs/slicer.js';
import {
  applyFallbackRules,
  redactContent,
} from '../../../src/context/scs/policies/redaction-rules.js';
import type { SpecialistMetadata } from '../../../src/context/scs/types.js';
import type { H4RResult } from '../../../src/context/h4r/types.js';

// Helper to create test specialists
function createSpecialist(
  overrides?: Partial<SpecialistMetadata>
): SpecialistMetadata {
  return {
    type: 'specialist',
    id: 'test-specialist',
    securityLevel: 'internal',
    authorizedGroups: ['team-a', 'team-b'],
    ...overrides,
  };
}

// Helper to create test H4R results
function createResult(
  id: string,
  contentSize: number = 100,
  metadataOverrides?: Record<string, unknown>
): H4RResult {
  const content = { data: 'x'.repeat(contentSize) };

  return {
    id,
    content,
    score: 0.75,
    signals: {
      recency: 0.8,
      frequency: 0.6,
      importance: 0.7,
      causality: 0.5,
      noveltyInverse: 0.5,
      trust: 0.7,
      sensitivityInverse: 0.8,
    },
    reason: 'kept',
    explanation: 'Test result',
    metadata: {
      source: 'postgres',
      createdAt: new Date('2025-10-01T12:00:00Z'),
      accessCount: 10,
      importance: 0.7,
      trust: 0.7,
      sensitivity: 0.2,
      ...metadataOverrides,
    },
  };
}

describe('SCS Context Slicer', () => {
  describe('Budget Enforcement - Bytes', () => {
    it('should respect maxBytes limit', async () => {
      const slicer = new ContextSlicer({
        budget: {
          maxBytes: 500, // ~5 items of 100 bytes each
        },
        fallbackToLocal: true,
      });

      const results = Array.from({ length: 10 }, (_, i) =>
        createResult(`item-${i}`, 100)
      );

      const specialist = createSpecialist();
      const slice = await slicer.slice(specialist, results);

      expect(slice.totalIncluded).toBeLessThanOrEqual(5);
      expect(slice.budgetUsed.bytes).toBeLessThanOrEqual(500);
      expect(slice.totalDroppedBudget).toBeGreaterThan(0);
      expect(slice.warnings.some(w => w.includes('Budget exhausted'))).toBe(true);
    });

    it('should include all items when under budget', async () => {
      const slicer = new ContextSlicer({
        budget: {
          maxBytes: 10000, // Large enough for all
        },
        fallbackToLocal: true,
      });

      const results = Array.from({ length: 5 }, (_, i) =>
        createResult(`item-${i}`, 100)
      );

      const specialist = createSpecialist();
      const slice = await slicer.slice(specialist, results);

      expect(slice.totalIncluded).toBe(5);
      expect(slice.totalDroppedBudget).toBe(0);
      expect(slice.warnings.some(w => w.includes('Budget exhausted'))).toBe(false);
    });

    it('should calculate byte size accurately', async () => {
      const slicer = new ContextSlicer({
        budget: { maxBytes: 10000 },
        fallbackToLocal: true,
      });

      const results = [
        createResult('small', 50),
        createResult('medium', 200),
        createResult('large', 500),
      ];

      const specialist = createSpecialist();
      const slice = await slicer.slice(specialist, results);

      // Each item's byteSize should reflect content
      slice.items.forEach((item) => {
        expect(item.byteSize).toBeGreaterThan(0);
      });

      const totalBytes = slice.items.reduce((sum, item) => sum + item.byteSize, 0);
      expect(slice.budgetUsed.bytes).toBe(totalBytes);
    });
  });

  describe('Budget Enforcement - Tokens', () => {
    it('should respect maxTokens limit', async () => {
      const slicer = new ContextSlicer({
        budget: {
          maxTokens: 100, // ~400 bytes / 4
        },
        fallbackToLocal: true,
      });

      const results = Array.from({ length: 10 }, (_, i) =>
        createResult(`item-${i}`, 100)
      );

      const specialist = createSpecialist();
      const slice = await slicer.slice(specialist, results);

      expect(slice.budgetUsed.estimatedTokens).toBeLessThanOrEqual(100);
      expect(slice.totalDroppedBudget).toBeGreaterThan(0);
    });

    it('should estimate tokens as bytes/4', async () => {
      const slicer = new ContextSlicer({
        budget: { maxBytes: 10000, maxTokens: 10000 },
        fallbackToLocal: true,
      });

      const results = [createResult('test', 400)]; // ~400 bytes

      const specialist = createSpecialist();
      const slice = await slicer.slice(specialist, results);

      const estimatedTokens = Math.ceil(slice.budgetUsed.bytes / 4);
      expect(slice.budgetUsed.estimatedTokens).toBe(estimatedTokens);
    });
  });

  describe('Budget Enforcement - Items', () => {
    it('should respect maxItems limit', async () => {
      const slicer = new ContextSlicer({
        budget: {
          maxItems: 3,
        },
        fallbackToLocal: true,
      });

      const results = Array.from({ length: 10 }, (_, i) =>
        createResult(`item-${i}`, 50)
      );

      const specialist = createSpecialist();
      const slice = await slicer.slice(specialist, results);

      expect(slice.totalIncluded).toBeLessThanOrEqual(3);
      expect(slice.budgetUsed.items).toBeLessThanOrEqual(3);
      expect(slice.totalDroppedBudget).toBeGreaterThan(0);
    });

    it('should stop at first limit reached', async () => {
      const slicer = new ContextSlicer({
        budget: {
          maxBytes: 1000,
          maxTokens: 50, // This will hit first
          maxItems: 100,
        },
        fallbackToLocal: true,
      });

      const results = Array.from({ length: 20 }, (_, i) =>
        createResult(`item-${i}`, 100)
      );

      const specialist = createSpecialist();
      const slice = await slicer.slice(specialist, results);

      // Token limit should be the constraint
      expect(slice.budgetUsed.estimatedTokens).toBeLessThanOrEqual(50);
      expect(slice.budgetUsed.bytes).toBeLessThan(1000);
      expect(slice.budgetUsed.items).toBeLessThan(100);
    });
  });

  describe('Fallback Redaction Rules - Sensitivity', () => {
    it('should block high-sensitivity items for public specialists', async () => {
      const slicer = new ContextSlicer({ fallbackToLocal: true });

      const results = [
        createResult('sensitive', 100, { sensitivity: 0.9 }),
        createResult('public', 100, { sensitivity: 0.1 }),
      ];

      const specialist = createSpecialist({ securityLevel: 'public' });
      const slice = await slicer.slice(specialist, results);

      expect(slice.totalIncluded).toBe(1);
      expect(slice.items[0].original.id).toBe('public');
      expect(slice.totalRedacted).toBe(1);
    });

    it('should block high-sensitivity items for internal specialists', async () => {
      const slicer = new ContextSlicer({ fallbackToLocal: true });

      const results = [createResult('very-sensitive', 100, { sensitivity: 0.95 })];

      const specialist = createSpecialist({ securityLevel: 'internal' });
      const slice = await slicer.slice(specialist, results);

      expect(slice.totalIncluded).toBe(0);
      expect(slice.totalRedacted).toBe(1);
    });

    it('should allow high-sensitivity items for confidential specialists', async () => {
      const slicer = new ContextSlicer({ fallbackToLocal: true });

      const results = [createResult('sensitive', 100, { sensitivity: 0.9 })];

      const specialist = createSpecialist({ securityLevel: 'confidential' });
      const slice = await slicer.slice(specialist, results);

      expect(slice.totalIncluded).toBe(1);
      expect(slice.totalRedacted).toBe(0);
    });
  });

  describe('Fallback Redaction Rules - PII', () => {
    it('should redact items with PII markers', async () => {
      const slicer = new ContextSlicer({ fallbackToLocal: true });

      const results = [
        createResult('with-pii', 100, { containsPII: true }),
        createResult('no-pii', 100, { containsPII: false }),
      ];

      const specialist = createSpecialist();
      const slice = await slicer.slice(specialist, results);

      expect(slice.totalIncluded).toBe(2);

      const piiItem = slice.items.find((i) => i.original.id === 'with-pii');
      expect(piiItem?.opaDecision.redact).toBe(true);
      expect(piiItem?.redactedContent).toBeDefined();

      const noPiiItem = slice.items.find((i) => i.original.id === 'no-pii');
      expect(noPiiItem?.opaDecision.redact).toBeFalsy();
    });

    it('should redact items with hasPersonalData', async () => {
      const slicer = new ContextSlicer({ fallbackToLocal: true });

      const results = [createResult('personal', 100, { hasPersonalData: true })];

      const specialist = createSpecialist();
      const slice = await slicer.slice(specialist, results);

      expect(slice.totalIncluded).toBe(1);
      expect(slice.items[0].opaDecision.redact).toBe(true);
      expect(slice.items[0].opaDecision.redactedFields).toContain(
        '$.content.personalData'
      );
    });
  });

  describe('Fallback Redaction Rules - Credentials', () => {
    it('should block items with credentials', async () => {
      const slicer = new ContextSlicer({ fallbackToLocal: true });

      const results = [
        createResult('with-creds', 100, { hasCredentials: true }),
        createResult('safe', 100, { hasCredentials: false }),
      ];

      const specialist = createSpecialist();
      const slice = await slicer.slice(specialist, results);

      expect(slice.totalIncluded).toBe(1);
      expect(slice.items[0].original.id).toBe('safe');
      expect(slice.totalRedacted).toBe(1);
    });

    it('should block items with secrets', async () => {
      const slicer = new ContextSlicer({ fallbackToLocal: true });

      const results = [createResult('with-secrets', 100, { containsSecrets: true })];

      const specialist = createSpecialist();
      const slice = await slicer.slice(specialist, results);

      expect(slice.totalIncluded).toBe(0);
      expect(slice.totalRedacted).toBe(1);
    });
  });

  describe('Fallback Redaction Rules - Trust', () => {
    it('should block low-trust items', async () => {
      const slicer = new ContextSlicer({ fallbackToLocal: true });

      const results = [
        createResult('low-trust', 100, { trust: 0.2 }),
        createResult('high-trust', 100, { trust: 0.8 }),
      ];

      const specialist = createSpecialist();
      const slice = await slicer.slice(specialist, results);

      expect(slice.totalIncluded).toBe(1);
      expect(slice.items[0].original.id).toBe('high-trust');
      expect(slice.totalRedacted).toBe(1);
    });

    it('should use default trust 0.7 when undefined', async () => {
      const slicer = new ContextSlicer({ fallbackToLocal: true });

      const results = [createResult('default-trust', 100, { trust: undefined })];

      const specialist = createSpecialist();
      const slice = await slicer.slice(specialist, results);

      expect(slice.totalIncluded).toBe(1); // 0.7 > 0.3 threshold
    });
  });

  describe('Fallback Redaction Rules - Group Access', () => {
    it('should allow items when specialist has required group', async () => {
      const slicer = new ContextSlicer({ fallbackToLocal: true });

      const results = [
        createResult('restricted', 100, { restrictedToGroups: ['team-a'] }),
      ];

      const specialist = createSpecialist({ authorizedGroups: ['team-a', 'team-b'] });
      const slice = await slicer.slice(specialist, results);

      expect(slice.totalIncluded).toBe(1);
      expect(slice.totalRedacted).toBe(0);
    });

    it('should block items when specialist lacks required group', async () => {
      const slicer = new ContextSlicer({ fallbackToLocal: true });

      const results = [
        createResult('restricted', 100, { restrictedToGroups: ['team-x'] }),
      ];

      const specialist = createSpecialist({ authorizedGroups: ['team-a', 'team-b'] });
      const slice = await slicer.slice(specialist, results);

      expect(slice.totalIncluded).toBe(0);
      expect(slice.totalRedacted).toBe(1);
    });

    it('should allow when any required group matches', async () => {
      const slicer = new ContextSlicer({ fallbackToLocal: true });

      const results = [
        createResult('multi-group', 100, { restrictedToGroups: ['team-x', 'team-a'] }),
      ];

      const specialist = createSpecialist({ authorizedGroups: ['team-a'] });
      const slice = await slicer.slice(specialist, results);

      expect(slice.totalIncluded).toBe(1);
    });

    it('should allow when no group restriction', async () => {
      const slicer = new ContextSlicer({ fallbackToLocal: true });

      const results = [createResult('unrestricted', 100, {})];

      const specialist = createSpecialist({ authorizedGroups: [] });
      const slice = await slicer.slice(specialist, results);

      expect(slice.totalIncluded).toBe(1);
    });
  });

  describe('Redaction Content', () => {
    it('should mark redacted content with metadata', () => {
      const content = { name: 'John Doe', email: 'john@example.com' };
      const redactedFields = ['$.content.personalData'];

      const redacted = redactContent(content, redactedFields);

      expect(redacted).toHaveProperty('_redacted', true);
      expect(redacted).toHaveProperty('_redactedFields', redactedFields);
    });

    it('should return original content when no fields to redact', () => {
      const content = { public: 'data' };
      const redacted = redactContent(content, []);

      expect(redacted).toEqual(content);
      expect(redacted).not.toHaveProperty('_redacted');
    });

    it('should handle non-object content', () => {
      const content = 'string content';
      const redacted = redactContent(content, ['$.field']);

      // Should still return the content (no redaction for primitives)
      expect(redacted).toBe(content);
    });
  });

  describe('Combined Budget and Redaction', () => {
    it('should apply redaction before budget calculation', async () => {
      const slicer = new ContextSlicer({
        budget: { maxBytes: 10000 },
        fallbackToLocal: true,
      });

      const results = [
        createResult('needs-redaction', 200, { containsPII: true }),
        createResult('clean', 200, {}),
      ];

      const specialist = createSpecialist();
      const slice = await slicer.slice(specialist, results);

      expect(slice.totalIncluded).toBe(2);

      const redactedItem = slice.items.find(
        (i) => i.original.id === 'needs-redaction'
      );
      expect(redactedItem?.redactedContent).toBeDefined();
      expect(redactedItem?.byteSize).toBeGreaterThan(0);
    });

    it('should count redacted items in totalRedacted', async () => {
      const slicer = new ContextSlicer({ fallbackToLocal: true });

      const results = [
        createResult('blocked-sensitive', 100, { sensitivity: 0.95 }),
        createResult('redacted-pii', 100, { containsPII: true }),
        createResult('clean', 100, {}),
      ];

      const specialist = createSpecialist({ securityLevel: 'internal' });
      const slice = await slicer.slice(specialist, results);

      expect(slice.totalIncluded).toBe(2); // redacted-pii + clean
      expect(slice.totalRedacted).toBe(2); // blocked-sensitive + redacted-pii
    });
  });

  describe('Slice Metadata', () => {
    it('should report correct totalAvailable', async () => {
      const slicer = new ContextSlicer({ fallbackToLocal: true });

      const results = Array.from({ length: 15 }, (_, i) =>
        createResult(`item-${i}`, 50)
      );

      const specialist = createSpecialist();
      const slice = await slicer.slice(specialist, results);

      expect(slice.totalAvailable).toBe(15);
    });

    it('should report correct totalIncluded', async () => {
      const slicer = new ContextSlicer({
        budget: { maxItems: 5 },
        fallbackToLocal: true,
      });

      const results = Array.from({ length: 10 }, (_, i) =>
        createResult(`item-${i}`, 50)
      );

      const specialist = createSpecialist();
      const slice = await slicer.slice(specialist, results);

      expect(slice.totalIncluded).toBe(5);
    });

    it('should include budget limits in slice', async () => {
      const slicer = new ContextSlicer({
        budget: {
          maxBytes: 1000,
          maxTokens: 250,
          maxItems: 10,
        },
        fallbackToLocal: true,
      });

      const results = [createResult('test', 100)];
      const specialist = createSpecialist();
      const slice = await slicer.slice(specialist, results);

      expect(slice.budgetLimits).toEqual({
        maxBytes: 1000,
        maxTokens: 250,
        maxItems: 10,
      });
    });

    it('should include warnings array', async () => {
      const slicer = new ContextSlicer({
        budget: { maxItems: 2 },
        fallbackToLocal: true,
      });

      const results = Array.from({ length: 5 }, (_, i) =>
        createResult(`item-${i}`, 50)
      );

      const specialist = createSpecialist();
      const slice = await slicer.slice(specialist, results);

      expect(slice.warnings).toBeDefined();
      expect(Array.isArray(slice.warnings)).toBe(true);
      expect(slice.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty results array', async () => {
      const slicer = new ContextSlicer({ fallbackToLocal: true });

      const specialist = createSpecialist();
      const slice = await slicer.slice(specialist, []);

      expect(slice.totalAvailable).toBe(0);
      expect(slice.totalIncluded).toBe(0);
      expect(slice.totalRedacted).toBe(0);
      expect(slice.totalDroppedBudget).toBe(0);
      expect(slice.items).toEqual([]);
    });

    it('should handle zero budget', async () => {
      const slicer = new ContextSlicer({
        budget: { maxBytes: 0 },
        fallbackToLocal: true,
      });

      const results = [createResult('test', 100)];
      const specialist = createSpecialist();
      const slice = await slicer.slice(specialist, results);

      expect(slice.totalIncluded).toBe(0);
      expect(slice.totalDroppedBudget).toBe(1);
    });

    it('should handle very large items', async () => {
      const slicer = new ContextSlicer({
        budget: { maxBytes: 50000 },
        fallbackToLocal: true,
      });

      const results = [createResult('huge', 10000)];

      const specialist = createSpecialist();
      const slice = await slicer.slice(specialist, results);

      expect(slice.totalIncluded).toBe(1);
      expect(slice.budgetUsed.bytes).toBeGreaterThan(10000);
    });

    it('should handle specialist with no security level', async () => {
      const slicer = new ContextSlicer({ fallbackToLocal: true });

      const results = [createResult('test', 100, { sensitivity: 0.9 })];

      const specialist = createSpecialist({ securityLevel: undefined });
      const slice = await slicer.slice(specialist, results);

      // Should default to 'public' behavior
      expect(slice.totalIncluded).toBe(0);
    });
  });

  describe('OPA Fallback Behavior', () => {
    it('should warn when OPA unavailable and fallback disabled', async () => {
      const slicer = new ContextSlicer({
        opaUrl: '', // No OPA
        fallbackToLocal: false,
      });

      const results = [createResult('test', 100)];
      const specialist = createSpecialist();
      const slice = await slicer.slice(specialist, results);

      expect(slice.warnings).toContain('OPA unavailable and fallback disabled');
    });

    it('should use fallback rules when OPA unavailable and fallback enabled', async () => {
      const slicer = new ContextSlicer({
        opaUrl: '', // No OPA
        fallbackToLocal: true,
      });

      const results = [createResult('test', 100)];
      const specialist = createSpecialist();
      const slice = await slicer.slice(specialist, results);

      // Should apply fallback rules successfully
      expect(slice.totalIncluded).toBe(1);
      expect(slice.items[0].opaDecision).toBeDefined();
      expect(slice.items[0].opaDecision.allow).toBe(true);
    });
  });

  describe('applyFallbackRules Unit Tests', () => {
    it('should allow items passing all rules', () => {
      const specialist = createSpecialist();
      const result = createResult('safe', 100, {
        sensitivity: 0.5,
        trust: 0.8,
      });

      const decision = applyFallbackRules(specialist, result);

      expect(decision.allow).toBe(true);
      expect(decision.reason).toContain('allowed');
    });

    it('should provide clear reasons for blocking', () => {
      const specialist = createSpecialist({ securityLevel: 'public' });
      const result = createResult('blocked', 100, { sensitivity: 0.95 });

      const decision = applyFallbackRules(specialist, result);

      expect(decision.allow).toBe(false);
      expect(decision.reason).toBeDefined();
      expect(decision.reason).toContain('Sensitivity');
    });
  });
});
