/**
 * H4R Retriever
 *
 * Main coordinator for multi-source retrieval + multi-signal ranking
 */

import type {
  H4RQuery,
  H4ROptions,
  H4RResponse,
  H4RCandidate,
  CandidateGenerator,
} from './types.js';
import { Ranker } from './ranker.js';
import { getPostgresFTSGenerator } from './candidates/postgres-fts.js';
import { getQdrantGenerator } from './candidates/qdrant-adapter.js';
import { getNeo4jGenerator } from './candidates/neo4j-adapter.js';

/**
 * H4R Retriever
 */
export class H4RRetriever {
  private generators: CandidateGenerator[] = [];
  private options: Required<H4ROptions>;

  constructor(options: H4ROptions = {}) {
    this.options = {
      weights: options.weights || {},
      minScore: options.minScore ?? 0.0,
      limit: options.limit ?? 10,
      includeExplain: options.includeExplain ?? true,
      recencyDecayLambda: options.recencyDecayLambda ?? 0.1,
      enableQdrant: options.enableQdrant ?? false,
      enableNeo4j: options.enableNeo4j ?? false,
    };

    // Initialize generators
    this.initializeGenerators();
  }

  /**
   * Initialize candidate generators based on config
   */
  private async initializeGenerators(): Promise<void> {
    const generators: (CandidateGenerator | null)[] = [];

    // Always include Postgres FTS
    generators.push(getPostgresFTSGenerator());

    // Optional: Qdrant
    if (this.options.enableQdrant) {
      generators.push(getQdrantGenerator());
    }

    // Optional: Neo4j
    if (this.options.enableNeo4j) {
      generators.push(getNeo4jGenerator());
    }

    // Filter out null generators and check availability
    for (const gen of generators) {
      if (gen && (await gen.isAvailable())) {
        this.generators.push(gen);
      }
    }
  }

  /**
   * Retrieve and rank results
   */
  async retrieve(query: H4RQuery): Promise<H4RResponse> {
    const startTime = performance.now();

    // Ensure generators are initialized
    if (this.generators.length === 0) {
      await this.initializeGenerators();
    }

    // 1. Generate candidates from all sources
    const candidateStartTime = performance.now();
    const candidateLimit = query.candidateLimit || 50;

    const candidatePromises = this.generators.map((gen) =>
      gen.generate(query, candidateLimit).catch((err) => {
        console.error(`[H4R] Generator ${gen.name} failed:`, err);
        return [] as H4RCandidate[];
      })
    );

    const candidateSets = await Promise.all(candidatePromises);
    const allCandidates = candidateSets.flat();

    const candidateEndTime = performance.now();
    const candidateMs = Math.round(candidateEndTime - candidateStartTime);

    // 2. Rank candidates
    const rankingStartTime = performance.now();

    const ranker = new Ranker({
      weights: this.options.weights,
      minScore: this.options.minScore,
      recencyDecayLambda: this.options.recencyDecayLambda,
    });

    const rankedResults = ranker.rankAndFilter(allCandidates);

    // Limit results
    const limitedResults = rankedResults.slice(0, this.options.limit);

    const rankingEndTime = performance.now();
    const rankingMs = Math.round(rankingEndTime - rankingStartTime);

    const totalMs = Math.round(performance.now() - startTime);

    return {
      results: limitedResults,
      totalCandidates: allCandidates.length,
      totalIncluded: limitedResults.length,
      sources: this.generators.map(
        (g) => g.name as 'postgres' | 'qdrant' | 'neo4j' | 'redis' | 'memory'
      ),
      metrics: {
        candidateMs,
        rankingMs,
        totalMs,
      },
    };
  }

  /**
   * Get active generator names
   */
  getActiveGenerators(): string[] {
    return this.generators.map((g) => g.name);
  }
}
