/**
 * H4R (Human-like Retrieval with 4R Framework) Types
 *
 * Multi-signal retrieval system combining:
 * - Recency: Time decay
 * - Frequency: Access patterns
 * - Importance: User/system priority
 * - Causality: Causal chain relevance
 * Plus additional signals: Novelty, Trust, Sensitivity
 */

/**
 * Query for H4R retrieval
 */
export interface H4RQuery {
  /**
   * Query text (for semantic/keyword search)
   */
  text?: string;

  /**
   * Query type
   */
  type: 'semantic' | 'keyword' | 'hybrid' | 'graph_traversal';

  /**
   * Metadata filters
   */
  filters?: Record<string, unknown>;

  /**
   * Graph traversal parameters (for graph queries)
   */
  graphParams?: {
    startNode: string;
    relationshipTypes?: string[];
    maxDepth?: number;
  };

  /**
   * Maximum candidates to retrieve per source
   */
  candidateLimit?: number;

  /**
   * Specialist metadata (for context-aware retrieval)
   */
  specialistContext?: {
    type: string;
    id: string;
    capabilities?: string[];
  };
}

/**
 * Candidate item from retrieval source
 */
export interface H4RCandidate {
  /**
   * Unique identifier
   */
  id: string;

  /**
   * Content (structure varies by source)
   */
  content: unknown;

  /**
   * Source metadata
   */
  metadata: {
    /**
     * Source system
     */
    source: 'postgres' | 'qdrant' | 'neo4j' | 'redis' | 'memory';

    /**
     * Creation timestamp
     */
    createdAt: Date;

    /**
     * Last accessed timestamp
     */
    lastAccessedAt?: Date;

    /**
     * Access count
     */
    accessCount?: number;

    /**
     * Importance score (0-1, user/system tagged)
     */
    importance?: number;

    /**
     * Source confidence/trust score (0-1)
     */
    trust?: number;

    /**
     * Sensitivity level (0=public, 1=highly sensitive)
     */
    sensitivity?: number;

    /**
     * Tags/labels
     */
    tags?: string[];

    /**
     * Custom metadata
     */
    [key: string]: unknown;
  };

  /**
   * Base retrieval score (from source)
   */
  baseScore?: number;

  /**
   * Embedding vector (optional)
   */
  embedding?: number[];

  /**
   * Graph relationships (for graph sources)
   */
  relationships?: Array<{
    type: string;
    targetId: string;
    properties?: Record<string, unknown>;
  }>;
}

/**
 * Signal scores for ranking
 */
export interface SignalScores {
  /**
   * Recency: exp(-λ * age_days)
   */
  recency: number;

  /**
   * Frequency: log(access_count + 1)
   */
  frequency: number;

  /**
   * Importance: user/system tags (0-1)
   */
  importance: number;

  /**
   * Causality: distance in causal graph (inverse)
   */
  causality: number;

  /**
   * Novelty⁻: 1 - novelty (favor stable patterns)
   */
  noveltyInverse: number;

  /**
   * Trust: source reliability (0-1)
   */
  trust: number;

  /**
   * Sensitivity⁻: redaction penalty (inverse)
   */
  sensitivityInverse: number;
}

/**
 * Ranked H4R result
 */
export interface H4RResult extends H4RCandidate {
  /**
   * Final aggregated score
   */
  score: number;

  /**
   * Per-signal scores
   */
  signals: SignalScores;

  /**
   * Ranking reason
   */
  reason: 'kept' | 'dropped';

  /**
   * Threshold used (if dropped)
   */
  threshold?: number;

  /**
   * Explanation text
   */
  explanation: string;
}

/**
 * Signal weight configuration
 */
export interface SignalWeights {
  recency: number;
  frequency: number;
  importance: number;
  causality: number;
  noveltyInverse: number;
  trust: number;
  sensitivityInverse: number;
}

/**
 * H4R retrieval options
 */
export interface H4ROptions {
  /**
   * Signal weights (must sum to 1.0)
   */
  weights?: Partial<SignalWeights>;

  /**
   * Minimum score threshold for inclusion
   */
  minScore?: number;

  /**
   * Maximum results to return
   */
  limit?: number;

  /**
   * Include explain metadata
   */
  includeExplain?: boolean;

  /**
   * Recency decay factor (λ in exp(-λt))
   */
  recencyDecayLambda?: number;

  /**
   * Enable Qdrant vector search (requires QDRANT_URL)
   */
  enableQdrant?: boolean;

  /**
   * Enable Neo4j graph search (requires NEO4J_URL)
   */
  enableNeo4j?: boolean;
}

/**
 * H4R retrieval response
 */
export interface H4RResponse {
  /**
   * Ranked results (sorted by score descending)
   */
  results: H4RResult[];

  /**
   * Total candidates evaluated
   */
  totalCandidates: number;

  /**
   * Results included (after filtering)
   */
  totalIncluded: number;

  /**
   * Sources queried
   */
  sources: Array<'postgres' | 'qdrant' | 'neo4j' | 'redis' | 'memory'>;

  /**
   * Performance metrics
   */
  metrics: {
    /**
     * Candidate generation time (ms)
     */
    candidateMs: number;

    /**
     * Ranking time (ms)
     */
    rankingMs: number;

    /**
     * Total retrieval time (ms)
     */
    totalMs: number;
  };
}

/**
 * Candidate generator interface
 */
export interface CandidateGenerator {
  /**
   * Generator name
   */
  name: string;

  /**
   * Check if generator is available (e.g., env vars set)
   */
  isAvailable(): Promise<boolean>;

  /**
   * Generate candidates for query
   */
  generate(query: H4RQuery, limit: number): Promise<H4RCandidate[]>;
}
