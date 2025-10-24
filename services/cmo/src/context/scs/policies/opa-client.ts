/**
 * OPA (Open Policy Agent) Client
 *
 * Query OPA for policy decisions with caching
 */

import type { OPADecision, SpecialistMetadata } from '../types.js';
import type { H4RResult } from '../../h4r/types.js';

/**
 * OPA query input
 */
interface OPAInput {
  specialist: SpecialistMetadata;
  item: {
    id: string;
    content: unknown;
    metadata: Record<string, unknown>;
  };
}

/**
 * OPA response
 */
interface OPAResponse {
  result: OPADecision;
}

/**
 * Cache entry
 */
interface CacheEntry {
  decision: OPADecision;
  timestamp: number;
}

/**
 * OPA client configuration
 */
export interface OPAClientConfig {
  /**
   * OPA server URL
   */
  url?: string;

  /**
   * Policy path (e.g., /v1/data/cmo/context)
   */
  policyPath?: string;

  /**
   * Cache TTL in milliseconds
   */
  cacheTtl?: number;

  /**
   * Request timeout in milliseconds
   */
  timeout?: number;
}

/**
 * OPA client
 */
export class OPAClient {
  private config: Required<OPAClientConfig>;
  private cache: Map<string, CacheEntry> = new Map();

  constructor(config: OPAClientConfig = {}) {
    this.config = {
      url: config.url || process.env.SCS_OPA_URL || '',
      policyPath:
        config.policyPath ||
        process.env.SCS_OPA_POLICY_PATH ||
        '/v1/data/cmo/context',
      cacheTtl: config.cacheTtl ?? 60000, // 1 minute
      timeout: config.timeout ?? 5000,
    };
  }

  /**
   * Check if OPA is available
   */
  isAvailable(): boolean {
    return Boolean(this.config.url);
  }

  /**
   * Generate cache key
   */
  private getCacheKey(
    specialist: SpecialistMetadata,
    item: H4RResult
  ): string {
    return `${specialist.type}:${specialist.id}:${item.id}`;
  }

  /**
   * Get cached decision if valid
   */
  private getCached(key: string): OPADecision | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    const age = Date.now() - entry.timestamp;
    if (age > this.config.cacheTtl) {
      this.cache.delete(key);
      return null;
    }

    return entry.decision;
  }

  /**
   * Set cached decision
   */
  private setCached(key: string, decision: OPADecision): void {
    this.cache.set(key, {
      decision,
      timestamp: Date.now(),
    });
  }

  /**
   * Query OPA for policy decision
   */
  async evaluate(
    specialist: SpecialistMetadata,
    item: H4RResult
  ): Promise<OPADecision> {
    const cacheKey = this.getCacheKey(specialist, item);

    // Check cache first
    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached;
    }

    // If OPA not available, return permissive default
    if (!this.isAvailable()) {
      const defaultDecision: OPADecision = {
        allow: true,
        reason: 'OPA not configured',
      };
      return defaultDecision;
    }

    // Query OPA
    try {
      const input: OPAInput = {
        specialist,
        item: {
          id: item.id,
          content: item.content,
          metadata: item.metadata as Record<string, unknown>,
        },
      };

      const url = `${this.config.url}${this.config.policyPath}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.timeout
      );

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`OPA returned ${response.status}`);
      }

      const data: OPAResponse = await response.json();
      const decision = data.result;

      // Cache decision
      this.setCached(cacheKey, decision);

      return decision;
    } catch (error) {
      console.error('[OPA] Query failed:', error);

      // Return permissive fallback
      return {
        allow: true,
        reason: `OPA query failed: ${error}`,
      };
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { size: number; ttl: number } {
    return {
      size: this.cache.size,
      ttl: this.config.cacheTtl,
    };
  }
}
