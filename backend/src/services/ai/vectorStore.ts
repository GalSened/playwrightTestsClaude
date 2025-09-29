import { logger } from '@/utils/logger';
import { OpenAIEmbeddings } from '@langchain/openai';
import { FaissStore } from '@langchain/community/vectorstores/faiss';
import { Document } from '@langchain/core/documents';
import Database from 'better-sqlite3';
import { join } from 'path';
import fs from 'fs';

export interface VectorEntry {
  id: string;
  text: string;
  metadata: Record<string, any>;
  vector?: number[];
}

export interface VectorSearchResult {
  id: string;
  text: string;
  metadata: Record<string, any>;
  score: number;
}

export interface VectorStoreConfig {
  type: 'local' | 'pinecone';
  namespace: string;
  dimensions: number;
  indexPath?: string; // For local storage
  pineconeConfig?: {
    apiKey: string;
    environment: string;
    indexName: string;
  };
}

/**
 * Standardized Vector Store for QA Intelligence Platform
 * Single source of truth for vector storage with fallback capabilities
 */
export class StandardizedVectorStore {
  private config: VectorStoreConfig;
  private embeddings: OpenAIEmbeddings;
  private localStore?: FaissStore;
  private db: Database.Database;
  private isInitialized = false;

  constructor(config: VectorStoreConfig) {
    this.config = config;
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY!,
      modelName: 'text-embedding-3-large',
      dimensions: config.dimensions
    });

    // Initialize SQLite database for metadata and backup
    const dbPath = join(process.cwd(), 'data', 'vectors.db');
    this.db = new Database(dbPath);
    this.initializeDatabase();
  }

  /**
   * Initialize the vector store based on configuration
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    logger.info('Initializing standardized vector store', {
      type: this.config.type,
      namespace: this.config.namespace,
      dimensions: this.config.dimensions
    });

    try {
      if (this.config.type === 'local') {
        await this.initializeLocalStore();
      } else if (this.config.type === 'pinecone') {
        await this.initializePineconeStore();
      }

      this.isInitialized = true;
      logger.info('Vector store initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize vector store:', error);
      // Fallback to local store if remote fails
      if (this.config.type === 'pinecone') {
        logger.warn('Falling back to local vector store');
        await this.initializeLocalStore();
        this.isInitialized = true;
      } else {
        throw error;
      }
    }
  }

  /**
   * Initialize local FAISS-based vector store
   */
  private async initializeLocalStore(): Promise<void> {
    const indexPath = this.config.indexPath || join(process.cwd(), 'data', 'vectors', this.config.namespace);

    // Create directory if it doesn't exist
    if (!fs.existsSync(indexPath)) {
      fs.mkdirSync(indexPath, { recursive: true });
    }

    const indexFile = join(indexPath, 'index.faiss');
    const storeFile = join(indexPath, 'store.json');

    try {
      // Try to load existing store
      if (fs.existsSync(indexFile) && fs.existsSync(storeFile)) {
        this.localStore = await FaissStore.load(indexPath, this.embeddings);
        logger.info('Loaded existing local vector store', { path: indexPath });
      } else {
        // Create new empty store
        this.localStore = await FaissStore.fromTexts(
          ['initialization'],
          [{ init: true }],
          this.embeddings
        );
        await this.localStore.save(indexPath);
        logger.info('Created new local vector store', { path: indexPath });
      }
    } catch (error) {
      logger.error('Failed to initialize local vector store:', error);
      throw error;
    }
  }

  /**
   * Initialize Pinecone vector store (future implementation)
   */
  private async initializePineconeStore(): Promise<void> {
    // Note: Pinecone implementation would go here
    // For now, we'll use local store as the primary option
    throw new Error('Pinecone integration not yet implemented. Use local store instead.');
  }

  /**
   * Initialize SQLite database for metadata storage
   */
  private initializeDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS vector_metadata (
        id TEXT PRIMARY KEY,
        namespace TEXT NOT NULL,
        text TEXT NOT NULL,
        metadata TEXT NOT NULL,
        vector_hash TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
      );

      CREATE INDEX IF NOT EXISTS idx_vector_namespace ON vector_metadata(namespace);
      CREATE INDEX IF NOT EXISTS idx_vector_created ON vector_metadata(created_at);
      CREATE INDEX IF NOT EXISTS idx_vector_hash ON vector_metadata(vector_hash);

      CREATE TABLE IF NOT EXISTS vector_stats (
        namespace TEXT PRIMARY KEY,
        total_vectors INTEGER DEFAULT 0,
        last_updated TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
      );
    `);
  }

  /**
   * Add a vector entry to the store
   */
  async addVector(entry: VectorEntry, namespace?: string): Promise<void> {
    await this.ensureInitialized();

    const targetNamespace = namespace || this.config.namespace;

    try {
      // Create document for vector store
      const doc = new Document({
        pageContent: entry.text,
        metadata: {
          ...entry.metadata,
          id: entry.id,
          namespace: targetNamespace
        }
      });

      // Add to vector store
      if (this.localStore) {
        await this.localStore.addDocuments([doc]);
        await this.saveLocalStore();
      }

      // Store metadata in SQLite
      const vectorHash = this.calculateVectorHash(entry.vector || []);
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO vector_metadata
        (id, namespace, text, metadata, vector_hash, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now', 'utc'))
      `);

      stmt.run(
        entry.id,
        targetNamespace,
        entry.text,
        JSON.stringify(entry.metadata),
        vectorHash
      );

      // Update stats
      this.updateNamespaceStats(targetNamespace);

      logger.debug('Vector added successfully', {
        id: entry.id,
        namespace: targetNamespace,
        textLength: entry.text.length
      });

    } catch (error) {
      logger.error('Failed to add vector:', error);
      throw error;
    }
  }

  /**
   * Search vectors by similarity
   */
  async searchVectors(
    query: string,
    options: {
      namespace?: string;
      topK?: number;
      threshold?: number;
      filter?: Record<string, any>;
    } = {}
  ): Promise<VectorSearchResult[]> {
    await this.ensureInitialized();

    const {
      namespace = this.config.namespace,
      topK = 10,
      threshold = 0.7,
      filter = {}
    } = options;

    try {
      if (!this.localStore) {
        throw new Error('Vector store not initialized');
      }

      // Validate and truncate query to prevent token limit issues
      const maxQueryChars = 2000; // ~500 tokens
      const processedQuery = query.length > maxQueryChars
        ? query.substring(0, maxQueryChars)
        : query;

      logger.debug('Vector search query', {
        originalLength: query.length,
        processedLength: processedQuery.length,
        truncated: query.length > maxQueryChars
      });

      // Add namespace to filter
      const searchFilter = {
        ...filter,
        namespace
      };

      // Perform similarity search
      const results = await this.localStore.similaritySearchWithScore(
        processedQuery,
        topK,
        searchFilter
      );

      // Filter by threshold and format results
      const formattedResults: VectorSearchResult[] = results
        .filter(([doc, score]) => score >= threshold)
        .map(([doc, score]) => ({
          id: doc.metadata.id,
          text: doc.pageContent,
          metadata: doc.metadata,
          score
        }));

      logger.debug('Vector search completed', {
        query: query.substring(0, 100),
        namespace,
        resultsCount: formattedResults.length,
        topScore: formattedResults[0]?.score || 0
      });

      return formattedResults;

    } catch (error) {
      logger.error('Vector search failed:', error);
      throw error;
    }
  }

  /**
   * Get vector store statistics
   */
  async getStats(namespace?: string): Promise<VectorStoreStats> {
    const targetNamespace = namespace || this.config.namespace;

    const stmt = this.db.prepare(`
      SELECT * FROM vector_stats WHERE namespace = ?
    `);
    const stats = stmt.get(targetNamespace) as any;

    const detailStmt = this.db.prepare(`
      SELECT
        COUNT(*) as total_entries,
        COUNT(DISTINCT JSON_EXTRACT(metadata, '$.lang')) as languages,
        COUNT(DISTINCT JSON_EXTRACT(metadata, '$.type')) as types,
        MIN(created_at) as oldest_entry,
        MAX(created_at) as newest_entry
      FROM vector_metadata
      WHERE namespace = ?
    `);
    const details = detailStmt.get(targetNamespace) as any;

    return {
      namespace: targetNamespace,
      totalVectors: stats?.total_vectors || 0,
      lastUpdated: stats?.last_updated || null,
      ...details
    };
  }

  /**
   * Clear all vectors in a namespace
   */
  async clearNamespace(namespace: string): Promise<number> {
    try {
      // Get count before deletion
      const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM vector_metadata WHERE namespace = ?');
      const { count } = countStmt.get(namespace) as any;

      // Delete from metadata
      const deleteStmt = this.db.prepare('DELETE FROM vector_metadata WHERE namespace = ?');
      deleteStmt.run(namespace);

      // Update stats
      const statsStmt = this.db.prepare(`
        INSERT OR REPLACE INTO vector_stats (namespace, total_vectors, last_updated)
        VALUES (?, 0, datetime('now', 'utc'))
      `);
      statsStmt.run(namespace);

      // Note: For local store, we'd need to rebuild the entire index
      // This is a limitation of FAISS - consider this for future improvements

      logger.info('Namespace cleared', { namespace, deletedCount: count });
      return count;

    } catch (error) {
      logger.error('Failed to clear namespace:', error);
      throw error;
    }
  }

  /**
   * Close the vector store and cleanup resources
   */
  async close(): Promise<void> {
    try {
      if (this.localStore) {
        await this.saveLocalStore();
      }
      this.db.close();
      this.isInitialized = false;
      logger.info('Vector store closed successfully');
    } catch (error) {
      logger.error('Error closing vector store:', error);
    }
  }

  // Private utility methods

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  private async saveLocalStore(): Promise<void> {
    if (!this.localStore || !this.config.indexPath) {
      return;
    }

    const indexPath = this.config.indexPath || join(process.cwd(), 'data', 'vectors', this.config.namespace);
    await this.localStore.save(indexPath);
  }

  private calculateVectorHash(vector: number[]): string {
    // Simple hash for vector deduplication
    const str = vector.slice(0, 10).map(n => n.toFixed(4)).join(',');
    return Buffer.from(str).toString('base64').substring(0, 16);
  }

  private updateNamespaceStats(namespace: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO vector_stats (namespace, total_vectors, last_updated)
      VALUES (?, (
        SELECT COUNT(*) FROM vector_metadata WHERE namespace = ?
      ), datetime('now', 'utc'))
    `);
    stmt.run(namespace, namespace);
  }
}

export interface VectorStoreStats {
  namespace: string;
  totalVectors: number;
  lastUpdated: string | null;
  total_entries: number;
  languages: number;
  types: number;
  oldest_entry: string;
  newest_entry: string;
}

// Factory functions and utilities

/**
 * Create a standardized vector store instance
 */
export function createVectorStore(config?: Partial<VectorStoreConfig>): StandardizedVectorStore {
  const defaultConfig: VectorStoreConfig = {
    type: 'local',
    namespace: 'qa-intel',
    dimensions: 1536,
    indexPath: join(process.cwd(), 'data', 'vectors', 'qa-intel')
  };

  const finalConfig = { ...defaultConfig, ...config };
  return new StandardizedVectorStore(finalConfig);
}

/**
 * Global vector store instance (singleton pattern)
 */
let globalVectorStore: StandardizedVectorStore | null = null;

export function getVectorStore(): StandardizedVectorStore {
  if (!globalVectorStore) {
    globalVectorStore = createVectorStore();
  }
  return globalVectorStore;
}

/**
 * Convenience function to save a vector
 */
export async function saveVector(entry: VectorEntry, namespace?: string): Promise<void> {
  const store = getVectorStore();
  await store.addVector(entry, namespace);
}

/**
 * Convenience function to search vectors
 */
export async function searchVectors(
  query: string,
  options?: {
    namespace?: string;
    topK?: number;
    threshold?: number;
    filter?: Record<string, any>;
  }
): Promise<VectorSearchResult[]> {
  const store = getVectorStore();
  return await store.searchVectors(query, options);
}

export default StandardizedVectorStore;