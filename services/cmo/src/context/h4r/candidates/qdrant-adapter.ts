/**
 * Qdrant Vector Search Adapter
 *
 * Optional candidate generator using Qdrant for semantic search
 * Enabled via QDRANT_URL environment variable
 */

import type { CandidateGenerator, H4RCandidate, H4RQuery } from '../types.js';

/**
 * Qdrant configuration
 */
export interface QdrantConfig {
  /**
   * Qdrant server URL
   */
  url?: string;

  /**
   * Collection name
   */
  collection?: string;

  /**
   * API key (if auth enabled)
   */
  apiKey?: string;
}

/**
 * Qdrant vector search generator
 */
export class QdrantGenerator implements CandidateGenerator {
  name = 'qdrant';
  private config: QdrantConfig;

  constructor(config: QdrantConfig = {}) {
    this.config = {
      url: config.url || process.env.QDRANT_URL || '',
      collection: config.collection || 'cmo_context',
      apiKey: config.apiKey || process.env.QDRANT_API_KEY,
    };
  }

  /**
   * Check if Qdrant is available
   */
  async isAvailable(): Promise<boolean> {
    if (!this.config.url) {
      return false;
    }

    // TODO: Ping Qdrant server
    return true;
  }

  /**
   * Generate candidates using Qdrant vector search
   */
  async generate(query: H4RQuery, limit: number): Promise<H4RCandidate[]> {
    if (!this.config.url) {
      return [];
    }

    // NOTE: Stub implementation
    // Real implementation would:
    // 1. Embed query.text using same model as index
    // 2. POST /collections/{collection}/points/search
    // 3. Map results to H4RCandidate[]

    console.warn(
      `[${this.name}] Stub implementation - Qdrant not yet integrated`
    );
    return [];
  }
}

/**
 * Get Qdrant generator if available
 */
export function getQdrantGenerator(
  config?: QdrantConfig
): QdrantGenerator | null {
  const url = config?.url || process.env.QDRANT_URL;
  if (!url) {
    return null;
  }
  return new QdrantGenerator(config);
}
