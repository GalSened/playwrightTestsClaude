import { UniversalFileProcessor } from './universalIngestion';
import Database from 'better-sqlite3';
import { OpenAIEmbeddings } from '@langchain/openai';
import { join } from 'path';

export class KnowledgeIngestionService {
  private processor: UniversalFileProcessor;
  private embeddings: OpenAIEmbeddings;
  private db: Database.Database;
  
  constructor() {
    this.processor = new UniversalFileProcessor();
    this.db = new Database(join(process.cwd(), 'data/scheduler.db'));
    
    // Initialize embeddings if OpenAI key is available
    if (process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('placeholder')) {
      this.embeddings = new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: 'text-embedding-3-small'
      });
    }
    
    // Ensure the knowledge_base_enhanced table exists
    this.initializeDatabase();
  }
  
  private initializeDatabase() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_base_enhanced (
        id TEXT PRIMARY KEY,
        content TEXT,
        type TEXT,
        source TEXT,
        chunk_index INTEGER,
        metadata TEXT,
        embedding BLOB,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
  
  async ingestFile(filePath: string, category: string = 'uploaded'): Promise<any> {
    console.log(`🔄 Ingesting ${filePath} as ${category}`);
    
    try {
      // Process file into documents
      const documents = await this.processor.processFile(filePath, {
        category,
        ingestionTime: new Date().toISOString()
      });
      
      if (documents.length === 0) {
        throw new Error('No documents were generated from the file');
      }
      
      // Prepare database statement
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO knowledge_base_enhanced 
        (id, content, type, source, chunk_index, metadata, embedding) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      // Store each document in knowledge base
      const results = [];
      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        const docId = `${category}-${Date.now()}-${i}`;
        
        // Generate embedding (optional, for vector search)
        let embedding = null;
        if (this.embeddings) {
          try {
            const embedResult = await this.embeddings.embedQuery(doc.pageContent);
            embedding = Buffer.from(new Float64Array(embedResult).buffer);
          } catch (error) {
            console.warn('⚠️ Embedding generation failed:', error.message);
          }
        }
        
        // Store in database
        stmt.run(
          docId,
          doc.pageContent,
          doc.metadata.type || 'unknown',
          doc.metadata.source || filePath,
          i,
          JSON.stringify(doc.metadata),
          embedding
        );
        
        results.push({
          id: docId,
          type: doc.metadata.type,
          contentLength: doc.pageContent.length
        });
      }
      
      console.log(`✅ Ingested ${documents.length} chunks from ${filePath}`);
      
      return {
        success: true,
        fileName: require('path').basename(filePath),
        chunks: documents.length,
        category,
        results,
        types: [...new Set(documents.map(d => d.metadata.type))]
      };
      
    } catch (error) {
      console.error(`❌ Error ingesting ${filePath}:`, error);
      return {
        success: false,
        fileName: require('path').basename(filePath),
        error: error.message,
        category
      };
    }
  }
  
  async ingestMultipleFiles(files: string[], category: string = 'uploaded'): Promise<any[]> {
    console.log(`📁 Ingesting ${files.length} files as ${category}`);
    
    const results = [];
    let totalChunks = 0;
    let successCount = 0;
    
    for (const file of files) {
      const result = await this.ingestFile(file, category);
      results.push(result);
      
      if (result.success) {
        totalChunks += result.chunks;
        successCount++;
      }
    }
    
    console.log(`🎉 Batch ingestion complete: ${successCount}/${files.length} files, ${totalChunks} total chunks`);
    
    return results;
  }
  
  async ingestFromDirectory(directoryPath: string, category: string = 'directory', extensions: string[] = []): Promise<any[]> {
    const fs = require('fs');
    const path = require('path');
    
    const files: string[] = [];
    
    // Get all files from directory
    const scanDirectory = (dir: string) => {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          scanDirectory(fullPath);
        } else if (stat.isFile()) {
          const ext = path.extname(item).toLowerCase();
          if (extensions.length === 0 || extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    };
    
    scanDirectory(directoryPath);
    
    if (files.length === 0) {
      console.log('📂 No matching files found in directory');
      return [];
    }
    
    console.log(`📂 Found ${files.length} files to ingest from ${directoryPath}`);
    
    return this.ingestMultipleFiles(files, category);
  }
  
  async getIngestionStats(): Promise<any> {
    const stats = this.db.prepare(`
      SELECT 
        source,
        type,
        COUNT(*) as count,
        AVG(LENGTH(content)) as avg_content_length,
        MIN(created_at) as first_ingested,
        MAX(created_at) as last_ingested
      FROM knowledge_base_enhanced 
      GROUP BY source, type
      ORDER BY last_ingested DESC
    `).all();
    
    const summary = this.db.prepare(`
      SELECT 
        COUNT(*) as total_chunks,
        COUNT(DISTINCT source) as total_sources,
        COUNT(DISTINCT type) as total_types,
        AVG(LENGTH(content)) as avg_chunk_size
      FROM knowledge_base_enhanced
    `).get();
    
    return {
      summary,
      bySourceAndType: stats,
      recentTypes: this.db.prepare(`
        SELECT type, COUNT(*) as count 
        FROM knowledge_base_enhanced 
        WHERE created_at > datetime('now', '-24 hours')
        GROUP BY type 
        ORDER BY count DESC
      `).all()
    };
  }
  
  async searchKnowledge(query: string, limit: number = 10): Promise<any[]> {
    // Simple text search for now (could be enhanced with vector search)
    const results = this.db.prepare(`
      SELECT id, content, type, source, metadata, created_at,
             CASE 
               WHEN content LIKE ? THEN 3
               WHEN content LIKE ? THEN 2  
               WHEN content LIKE ? THEN 1
               ELSE 0
             END as relevance_score
      FROM knowledge_base_enhanced
      WHERE content LIKE ? OR content LIKE ? OR content LIKE ?
      ORDER BY relevance_score DESC, created_at DESC
      LIMIT ?
    `).all(
      `%${query}%`,
      `%${query.split(' ')[0]}%`, 
      `%${query.split(' ').pop()}%`,
      `%${query}%`,
      `%${query.split(' ')[0]}%`, 
      `%${query.split(' ').pop()}%`,
      limit
    );
    
    return results.map(result => ({
      ...result,
      metadata: JSON.parse(result.metadata || '{}'),
      preview: result.content.substring(0, 200) + '...'
    }));
  }
  
  async clearCategory(category: string): Promise<number> {
    const result = this.db.prepare(`
      DELETE FROM knowledge_base_enhanced 
      WHERE metadata LIKE ?
    `).run(`%"category":"${category}"%`);
    
    console.log(`🗑️ Cleared ${result.changes} chunks from category: ${category}`);
    return result.changes;
  }
  
  close() {
    if (this.db) {
      this.db.close();
    }
  }
}