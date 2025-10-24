/**
 * H4R (Human-like Retrieval with 4R Framework)
 *
 * Public API for multi-signal context retrieval
 */

export * from './types.js';
export * from './retriever.js';
export * from './ranker.js';
export * from './explainer.js';

// Export candidate generators
export {
  PostgresFTSGenerator,
  getPostgresFTSGenerator,
} from './candidates/postgres-fts.js';
export {
  QdrantGenerator,
  getQdrantGenerator,
} from './candidates/qdrant-adapter.js';
export {
  Neo4jGenerator,
  getNeo4jGenerator,
} from './candidates/neo4j-adapter.js';

// Export signal functions
export { calculateRecency } from './signals/recency.js';
export { calculateFrequency } from './signals/frequency.js';
export { calculateImportance } from './signals/importance.js';
export { calculateCausality } from './signals/causality.js';
export { calculateNoveltyInverse } from './signals/novelty.js';
export { calculateTrust } from './signals/trust.js';
export { calculateSensitivityInverse } from './signals/sensitivity.js';
