/**
 * Neo4j Graph Traversal Adapter
 *
 * Optional candidate generator using Neo4j for graph-based retrieval
 * Enabled via NEO4J_URL environment variable
 */

import type { CandidateGenerator, H4RCandidate, H4RQuery } from '../types.js';

/**
 * Neo4j configuration
 */
export interface Neo4jConfig {
  /**
   * Neo4j server URL (bolt://...)
   */
  url?: string;

  /**
   * Username
   */
  username?: string;

  /**
   * Password
   */
  password?: string;
}

/**
 * Neo4j graph traversal generator
 */
export class Neo4jGenerator implements CandidateGenerator {
  name = 'neo4j';
  private config: Neo4jConfig;

  constructor(config: Neo4jConfig = {}) {
    this.config = {
      url: config.url || process.env.NEO4J_URL || '',
      username: config.username || process.env.NEO4J_USERNAME || 'neo4j',
      password: config.password || process.env.NEO4J_PASSWORD || '',
    };
  }

  /**
   * Check if Neo4j is available
   */
  async isAvailable(): Promise<boolean> {
    if (!this.config.url) {
      return false;
    }

    // TODO: Test Neo4j connection
    return true;
  }

  /**
   * Generate candidates using Neo4j graph traversal
   */
  async generate(query: H4RQuery, limit: number): Promise<H4RCandidate[]> {
    if (!this.config.url || query.type !== 'graph_traversal') {
      return [];
    }

    // NOTE: Stub implementation
    // Real implementation would:
    // 1. Build Cypher query from query.graphParams
    // 2. MATCH path = (start)-[*..maxDepth]-(related)
    //    WHERE id(start) = $startNode
    //    RETURN related, length(path) as distance
    //    ORDER BY distance
    //    LIMIT $limit
    // 3. Map results to H4RCandidate[] with causal distance

    console.warn(
      `[${this.name}] Stub implementation - Neo4j not yet integrated`
    );
    return [];
  }
}

/**
 * Get Neo4j generator if available
 */
export function getNeo4jGenerator(
  config?: Neo4jConfig
): Neo4jGenerator | null {
  const url = config?.url || process.env.NEO4J_URL;
  if (!url) {
    return null;
  }
  return new Neo4jGenerator(config);
}
