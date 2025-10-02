/**
 * Context Pack Builder
 *
 * Orchestrates H4R → SCS → summarizer → affordances
 */

import type {
  ContextPack,
  ContextPackOptions,
  EvidenceItem,
} from './types.js';
import type { H4RQuery, H4RResponse } from '../h4r/types.js';
import type { SpecialistMetadata } from '../scs/types.js';
import { H4RRetriever } from '../h4r/retriever.js';
import { ContextSlicer } from '../scs/slicer.js';
import { Summarizer } from './summarizer.js';
import { AffordanceGenerator } from './affordances.js';
import { CausalGraphBuilder } from './causal-graph.js';
import { BudgetTracker } from '../scs/budget.js';

/**
 * Context Pack builder configuration
 */
export interface PackBuilderConfig {
  /**
   * H4R options
   */
  h4rOptions?: {
    weights?: Record<string, number>;
    minScore?: number;
    limit?: number;
    recencyDecayLambda?: number;
    enableQdrant?: boolean;
    enableNeo4j?: boolean;
  };

  /**
   * SCS options
   */
  scsOptions?: {
    budget?: {
      maxBytes?: number;
      maxTokens?: number;
      maxItems?: number;
    };
    opaUrl?: string;
    opaPolicyPath?: string;
    opaCacheTtl?: number;
    fallbackToLocal?: boolean;
  };

  /**
   * Pack options
   */
  packOptions?: ContextPackOptions;
}

/**
 * Context Pack Builder
 */
export class ContextPackBuilder {
  private retriever: H4RRetriever;
  private slicer: ContextSlicer;
  private packOptions: Required<ContextPackOptions>;

  constructor(config: PackBuilderConfig = {}) {
    this.retriever = new H4RRetriever(config.h4rOptions || {});
    this.slicer = new ContextSlicer(config.scsOptions || {});
    this.packOptions = {
      includeCausalGraph:
        config.packOptions?.includeCausalGraph ??
        (process.env.CONTEXT_PACK_INCLUDE_GRAPH === 'true' || false),
      tldrSentences:
        config.packOptions?.tldrSentences ??
        parseInt(process.env.CONTEXT_PACK_TLDR_SENTENCES || '5', 10),
      generateAffordances: config.packOptions?.generateAffordances ?? true,
    };
  }

  /**
   * Build Context Pack
   */
  async build(
    query: H4RQuery,
    specialist: SpecialistMetadata
  ): Promise<ContextPack> {
    const startTime = performance.now();
    const warnings: string[] = [];

    // 1. H4R Retrieval
    const retrievalStart = performance.now();
    const h4rResponse: H4RResponse = await this.retriever.retrieve(query);
    const retrievalMs = Math.round(performance.now() - retrievalStart);

    if (h4rResponse.results.length === 0) {
      warnings.push('No evidence found for query');
    }

    // 2. SCS Slicing
    const slicingStart = performance.now();
    const agentSlice = await this.slicer.slice(
      specialist,
      h4rResponse.results
    );
    const slicingMs = Math.round(performance.now() - slicingStart);

    warnings.push(...agentSlice.warnings);

    // 3. Summarization
    const summarizationStart = performance.now();
    const tldr = Summarizer.summarize(
      h4rResponse.results,
      this.packOptions.tldrSentences
    );
    const summarizationMs = Math.round(
      performance.now() - summarizationStart
    );

    // 4. Affordances
    const affordances = this.packOptions.generateAffordances
      ? AffordanceGenerator.generate(h4rResponse.results)
      : [];

    // 5. Causal Graph (optional)
    const causalGraph =
      this.packOptions.includeCausalGraph
        ? CausalGraphBuilder.build(h4rResponse.results)
        : undefined;

    // 6. Evidence items (map H4R results to Evidence)
    const evidence: EvidenceItem[] = h4rResponse.results.map((r) => ({
      id: r.id,
      content: r.content,
      score: r.score,
      source: r.metadata.source,
      metadata: r.metadata as Record<string, unknown>,
    }));

    // 7. Calculate total bytes
    const totalBytes = BudgetTracker.calculateBytes({
      tldr,
      evidence,
      causalGraph,
      affordances,
      agentSlice,
    });

    const totalMs = Math.round(performance.now() - startTime);

    return {
      query,
      tldr,
      evidence,
      causalGraph,
      affordances,
      agentSlice,
      metadata: {
        retrievalMs,
        slicingMs,
        summarizationMs,
        totalMs,
        totalBytes,
        redacted: agentSlice.totalRedacted > 0,
        budgetExhausted: agentSlice.totalDroppedBudget > 0,
        warnings,
      },
    };
  }

  /**
   * Get active H4R generators
   */
  getActiveGenerators(): string[] {
    return this.retriever.getActiveGenerators();
  }

  /**
   * Get OPA cache stats
   */
  getOPACacheStats(): { size: number; ttl: number } {
    return this.slicer.getOPACacheStats();
  }

  /**
   * Clear OPA cache
   */
  clearOPACache(): void {
    this.slicer.clearOPACache();
  }
}
