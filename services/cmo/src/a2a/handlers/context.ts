/**
 * A2A Context Handler
 *
 * Handle ContextRequest envelopes and return ContextResult
 */

import type { A2AEnvelope } from '../envelopes/types.js';
import type { H4RQuery } from '../../context/h4r/types.js';
import type { SpecialistMetadata } from '../../context/scs/types.js';
import { ContextPackBuilder } from '../../context/pack/pack-builder.js';

/**
 * Context handler configuration
 */
export interface ContextHandlerConfig {
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
}

/**
 * Context Request Handler
 */
export class ContextHandler {
  private packBuilder: ContextPackBuilder;

  constructor(config: ContextHandlerConfig = {}) {
    this.packBuilder = new ContextPackBuilder({
      h4rOptions: config.h4rOptions,
      scsOptions: config.scsOptions,
    });
  }

  /**
   * Handle ContextRequest envelope
   */
  async handle(envelope: A2AEnvelope): Promise<A2AEnvelope> {
    if (envelope.meta.type !== 'ContextRequest') {
      throw new Error(
        `Invalid envelope type: expected ContextRequest, got ${envelope.meta.type}`
      );
    }

    const payload = envelope.payload as {
      query: {
        type: 'semantic' | 'keyword' | 'hybrid' | 'graph_traversal';
        text?: string;
        filters?: Record<string, unknown>;
        graph_params?: {
          start_node: string;
          relationship_types?: string[];
          max_depth?: number;
        };
      };
      limit?: number;
      include_embeddings?: boolean;
      include_scores?: boolean;
    };

    // Extract specialist metadata from envelope
    const specialist: SpecialistMetadata = {
      type: envelope.meta.from.type,
      id: envelope.meta.from.id,
      capabilities: (envelope.meta.from as any).capabilities,
      securityLevel:
        (envelope.meta.from as any).securityLevel || 'internal',
      authorizedGroups: (envelope.meta.from as any).authorizedGroups || [],
    };

    // Build H4R query from A2A payload
    const h4rQuery: H4RQuery = {
      text: payload.query.text,
      type: payload.query.type,
      filters: payload.query.filters,
      graphParams: payload.query.graph_params
        ? {
            startNode: payload.query.graph_params.start_node,
            relationshipTypes:
              payload.query.graph_params.relationship_types,
            maxDepth: payload.query.graph_params.max_depth,
          }
        : undefined,
      candidateLimit: payload.limit,
      specialistContext: specialist,
    };

    // Build Context Pack
    const contextPack = await this.packBuilder.build(h4rQuery, specialist);

    // Map Context Pack to ContextResult payload
    const resultPayload = {
      results: contextPack.agentSlice.items.map((item) => ({
        id: item.original.id,
        content: item.redactedContent || item.original.content,
        score: payload.include_scores ? item.original.score : undefined,
        metadata: {
          source: item.original.metadata.source,
          redacted: Boolean(item.redactedContent),
          byteSize: item.byteSize,
        },
      })),
      total_count: contextPack.agentSlice.totalAvailable,
      query_duration_ms: contextPack.metadata.retrievalMs,
      sources: this.packBuilder.getActiveGenerators() as Array<
        'qdrant' | 'neo4j' | 'postgres' | 'redis' | 'memory'
      >,
      // Add explainability metadata (extension to schema)
      explainability: {
        tldr: contextPack.tldr,
        affordances: contextPack.affordances,
        causalGraph: contextPack.causalGraph,
        slicing: {
          totalRedacted: contextPack.agentSlice.totalRedacted,
          totalDroppedBudget: contextPack.agentSlice.totalDroppedBudget,
          budgetUsed: contextPack.agentSlice.budgetUsed,
        },
        timings: {
          retrievalMs: contextPack.metadata.retrievalMs,
          slicingMs: contextPack.metadata.slicingMs,
          summarizationMs: contextPack.metadata.summarizationMs,
          totalMs: contextPack.metadata.totalMs,
        },
        warnings: contextPack.metadata.warnings,
      },
    };

    // Build response envelope
    const responseEnvelope: A2AEnvelope = {
      meta: {
        a2a_version: '1.0',
        message_id: this.generateMessageId(),
        trace_id: envelope.meta.trace_id,
        ts: new Date().toISOString(),
        from: {
          type: 'cmo',
          id: 'cmo-001',
          version: '1.0.0',
        },
        to: [envelope.meta.from],
        tenant: envelope.meta.tenant,
        project: envelope.meta.project,
        type: 'ContextResult',
        reply_to: envelope.meta.message_id,
      },
      payload: resultPayload,
    };

    return responseEnvelope;
  }

  /**
   * Generate message ID
   * TODO: Use proper ID generation from security module
   */
  private generateMessageId(): string {
    return Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }
}

/**
 * Create default context handler
 */
export function createContextHandler(
  config?: ContextHandlerConfig
): ContextHandler {
  return new ContextHandler(config);
}
