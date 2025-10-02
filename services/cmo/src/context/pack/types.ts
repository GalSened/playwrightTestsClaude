/**
 * Context Pack Types
 *
 * Structured context delivery for specialists
 */

import type { H4RQuery, H4RResponse } from '../h4r/types.js';
import type { AgentContextSlice } from '../scs/types.js';

/**
 * Causal graph (optional)
 */
export interface CausalGraph {
  /**
   * Nodes (evidence items)
   */
  nodes: Array<{
    id: string;
    label: string;
  }>;

  /**
   * Edges (causal relationships)
   */
  edges: Array<{
    from: string;
    to: string;
    type: 'causes' | 'precedes' | 'influences';
    weight?: number;
  }>;
}

/**
 * Affordance (action hint)
 */
export interface Affordance {
  /**
   * Action type
   */
  type:
    | 'retry_with_healing'
    | 'escalate_to_human'
    | 'request_more_context'
    | 'suggest_fix'
    | 'rerun_tests'
    | 'custom';

  /**
   * Human-readable description
   */
  description: string;

  /**
   * Confidence (0-1)
   */
  confidence: number;

  /**
   * Action parameters (optional)
   */
  parameters?: Record<string, unknown>;
}

/**
 * TL;DR summary
 */
export interface TLDRSummary {
  /**
   * Extractive summary text
   */
  summary: string;

  /**
   * Citation IDs (evidence items)
   */
  citations: string[];

  /**
   * Number of sentences in summary
   */
  sentenceCount: number;
}

/**
 * Evidence item (from H4R results)
 */
export interface EvidenceItem {
  /**
   * Item ID
   */
  id: string;

  /**
   * Content
   */
  content: unknown;

  /**
   * Relevance score
   */
  score: number;

  /**
   * Source
   */
  source: string;

  /**
   * Metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Context Pack metadata
 */
export interface ContextPackMetadata {
  /**
   * Retrieval time (ms)
   */
  retrievalMs: number;

  /**
   * Slicing time (ms)
   */
  slicingMs: number;

  /**
   * Summarization time (ms)
   */
  summarizationMs: number;

  /**
   * Total time (ms)
   */
  totalMs: number;

  /**
   * Total bytes
   */
  totalBytes: number;

  /**
   * Redaction applied
   */
  redacted: boolean;

  /**
   * Budget exhausted
   */
  budgetExhausted: boolean;

  /**
   * Warnings
   */
  warnings: string[];
}

/**
 * Context Pack
 */
export interface ContextPack {
  /**
   * Original query
   */
  query: H4RQuery;

  /**
   * TL;DR summary
   */
  tldr: TLDRSummary;

  /**
   * Evidence items (full, pre-sliced)
   */
  evidence: EvidenceItem[];

  /**
   * Causal graph (optional)
   */
  causalGraph?: CausalGraph;

  /**
   * Affordances (action hints)
   */
  affordances: Affordance[];

  /**
   * Agent-specific slice (least context, policy-aware)
   */
  agentSlice: AgentContextSlice;

  /**
   * Metadata
   */
  metadata: ContextPackMetadata;
}

/**
 * Context Pack builder options
 */
export interface ContextPackOptions {
  /**
   * Include causal graph
   */
  includeCausalGraph?: boolean;

  /**
   * Number of TL;DR sentences
   */
  tldrSentences?: number;

  /**
   * Generate affordances
   */
  generateAffordances?: boolean;
}
