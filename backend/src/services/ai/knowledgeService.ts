import { AIService } from './aiService';
import { Pinecone } from '@pinecone-database/pinecone';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/utils/logger';

export class KnowledgeService extends AIService {
  private pinecone: Pinecone;
  
  constructor() {
    super();
    this.pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || ''
    });
  }
  
  async ingestDocument(content: string, metadata: any) {
    try {
      logger.info('Starting document ingestion', { source: metadata.source, type: metadata.type });
      
      // Chunk the document
      const chunks = this.chunkText(content, 500);
      logger.info(`Document chunked into ${chunks.length} pieces`);
      
      // Generate embeddings for each chunk
      const embeddings = await Promise.all(
        chunks.map((chunk, i) => {
          logger.debug(`Generating embedding for chunk ${i + 1}/${chunks.length}`);
          return this.generateEmbedding(chunk);
        })
      );
      
      // Prepare vectors for Pinecone
      const vectors = chunks.map((chunk, i) => ({
        id: `${metadata.source}-${uuidv4()}-${i}`,
        values: embeddings[i],
        metadata: {
          text: chunk,
          source: metadata.source,
          type: metadata.type,
          chunkIndex: i,
          totalChunks: chunks.length,
          timestamp: new Date().toISOString()
        }
      }));
      
      // Store in vector database
      const indexName = process.env.PINECONE_INDEX_NAME || 'wesign-knowledge';
      const index = this.pinecone.Index(indexName);
      
      // Upsert in batches to avoid rate limits
      const batchSize = 10;
      for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize);
        await index.upsert(batch);
        logger.debug(`Upserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(vectors.length / batchSize)}`);
      }
      
      logger.info('Document ingestion completed successfully', { 
        chunks: chunks.length, 
        vectors: vectors.length 
      });
      
      return { 
        chunks: chunks.length, 
        vectors: vectors.length,
        status: 'success',
        message: `Successfully ingested document with ${chunks.length} chunks`
      };
      
    } catch (error) {
      logger.error('Document ingestion failed:', error);
      return {
        chunks: 0,
        vectors: 0,
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  async searchSimilar(query: string, topK: number = 5) {
    try {
      logger.info('Searching for similar content', { query: query.substring(0, 100), topK });
      
      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Search in Pinecone
      const indexName = process.env.PINECONE_INDEX_NAME || 'wesign-knowledge';
      const index = this.pinecone.Index(indexName);
      
      const queryResponse = await index.query({
        vector: queryEmbedding,
        topK,
        includeMetadata: true,
        includeValues: false
      });
      
      const results = queryResponse.matches?.map(match => ({
        id: match.id,
        score: match.score,
        text: match.metadata?.text,
        source: match.metadata?.source,
        type: match.metadata?.type,
        timestamp: match.metadata?.timestamp
      })) || [];
      
      logger.info(`Found ${results.length} similar documents`);
      
      return {
        results,
        query,
        status: 'success'
      };
      
    } catch (error) {
      logger.error('Similarity search failed:', error);
      return {
        results: [],
        query,
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  private chunkText(text: string, maxTokens: number): string[] {
    // Simple word-based chunking - can be improved with sentence/paragraph awareness
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    let currentChunk = '';
    
    for (const word of words) {
      const testChunk = currentChunk ? `${currentChunk} ${word}` : word;
      
      // Rough estimation: 1 token ≈ 4 characters
      if (testChunk.length > maxTokens * 4) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = word;
        } else {
          // Single word is too long, split it
          chunks.push(word);
          currentChunk = '';
        }
      } else {
        currentChunk = testChunk;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks.filter(chunk => chunk.length > 0);
  }
  
  async deleteDocuments(source: string) {
    try {
      logger.info('Deleting documents by source', { source });
      
      const indexName = process.env.PINECONE_INDEX_NAME || 'wesign-knowledge';
      const index = this.pinecone.Index(indexName);
      
      // Pinecone doesn't support direct deletion by metadata filter in free tier
      // We would need to query first, then delete by IDs
      // For now, we'll return a message about this limitation
      
      return {
        status: 'info',
        message: 'Document deletion requires upgrade to Pinecone paid plan for metadata filtering'
      };
      
    } catch (error) {
      logger.error('Document deletion failed:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}