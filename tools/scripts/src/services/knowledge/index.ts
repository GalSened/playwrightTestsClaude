import { Elysia, t } from 'elysia';
import { OpenAI } from 'openai';
import Database from 'bun:sqlite';
import { join } from 'path';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'placeholder'
});

const db = new Database(join(process.cwd(), '../backend/data/knowledge.db'));

// Initialize enhanced knowledge base table
db.exec(`
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

export const knowledgeService = new Elysia({ prefix: '/knowledge' })
  // File upload endpoint with streaming support
  .post('/upload', async ({ body, set }) => {
    try {
      const formData = body as any;
      const category = formData.category || 'uploaded';
      
      // Handle both single file and array of files from multipart form
      let files: File[] = [];
      
      if (formData.files) {
        if (Array.isArray(formData.files)) {
          files = formData.files;
        } else {
          files = [formData.files];
        }
      }
      
      if (files.length === 0) {
        set.status = 400;
        return { error: 'No files provided' };
      }

      if (files.length > 10) {
        set.status = 400;
        return { error: 'Maximum 10 files allowed' };
      }

      const results = [];
      const uploadsDir = join(process.cwd(), '../backend/uploads/knowledge');
      
      if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true });
      }

      for (const file of files) {
        // Validate file size (50MB limit)
        if (file.size > 50 * 1024 * 1024) {
          results.push({
            filename: file.name,
            success: false,
            error: 'File too large (max 50MB)'
          });
          continue;
        }

        try {
          // Save file using Bun's optimized file operations
          const buffer = await file.arrayBuffer();
          const filename = `${Date.now()}-${file.name}`;
          const filepath = join(uploadsDir, filename);
          
          await writeFile(filepath, new Uint8Array(buffer));

          // Process content for embedding
          const content = await file.text();
          const chunks = chunkText(content, 1000);
          
          let processedChunks = 0;
          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const chunkId = `${filename}-chunk-${i}`;
            
            // Generate embedding if OpenAI is configured
            let embedding = null;
            if (process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('placeholder')) {
              try {
                const embeddingResponse = await openai.embeddings.create({
                  model: 'text-embedding-3-small',
                  input: chunk
                });
                embedding = Buffer.from(new Float32Array(embeddingResponse.data[0].embedding).buffer);
              } catch (error) {
                console.warn('Failed to generate embedding:', error);
              }
            }

            // Store in database
            db.prepare(`
              INSERT OR REPLACE INTO knowledge_base_enhanced 
              (id, content, type, source, chunk_index, metadata, embedding, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `).run(
              chunkId,
              chunk,
              'document',
              'file-upload',
              i,
              JSON.stringify({
                filename: file.name,
                originalSize: file.size,
                category,
                mimeType: file.type,
                filepath
              }),
              embedding
            );
            
            processedChunks++;
          }

          results.push({
            filename: file.name,
            success: true,
            chunks: processedChunks,
            size: file.size
          });

        } catch (error) {
          results.push({
            filename: file.name,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      return {
        success: true,
        results,
        total: files.length,
        processed: results.filter(r => r.success).length
      };

    } catch (error) {
      set.status = 500;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  })

  // High-performance search endpoint
  .get('/search', async ({ query, set }) => {
    try {
      const { q, limit = 10, category } = query as { q: string, limit?: number, category?: string };
      
      if (!q) {
        set.status = 400;
        return { error: 'Query parameter "q" is required' };
      }

      let sql = `
        SELECT id, content, type, source, metadata, created_at,
               CASE 
                 WHEN content LIKE ? THEN 3
                 WHEN content LIKE ? THEN 2
                 ELSE 1
               END as relevance
        FROM knowledge_base_enhanced 
        WHERE content LIKE ?
      `;
      
      const params = [`%${q}%`, `%${q.toLowerCase()}%`, `%${q}%`];

      if (category) {
        sql += ` AND JSON_EXTRACT(metadata, '$.category') = ?`;
        params.push(category);
      }

      sql += ` ORDER BY relevance DESC, created_at DESC LIMIT ?`;
      params.push(limit);

      const results = db.prepare(sql).all(...params);

      // Parse metadata for each result
      const formattedResults = results.map((row: any) => ({
        ...row,
        metadata: row.metadata ? JSON.parse(row.metadata) : {}
      }));

      return {
        success: true,
        results: formattedResults,
        total: formattedResults.length,
        query: q
      };

    } catch (error) {
      set.status = 500;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  })

  // Vector similarity search (if embeddings available)
  .post('/search/semantic', async ({ body, set }) => {
    try {
      const { query, limit = 10 } = body as { query: string, limit?: number };
      
      if (!query) {
        set.status = 400;
        return { error: 'Query is required' };
      }

      // Check if OpenAI is configured
      if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes('placeholder')) {
        set.status = 503;
        return { error: 'Semantic search requires OpenAI configuration' };
      }

      // Generate query embedding
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query
      });
      
      const queryEmbedding = embeddingResponse.data[0].embedding;

      // For now, fall back to text search (vector similarity requires more complex SQL)
      // In production, this would use proper cosine similarity
      const results = db.prepare(`
        SELECT id, content, type, source, metadata, created_at
        FROM knowledge_base_enhanced 
        WHERE embedding IS NOT NULL 
        AND content LIKE ?
        ORDER BY created_at DESC 
        LIMIT ?
      `).all(`%${query}%`, limit);

      const formattedResults = results.map((row: any) => ({
        ...row,
        metadata: row.metadata ? JSON.parse(row.metadata) : {},
        similarity: 0.8 // Placeholder - would be actual cosine similarity
      }));

      return {
        success: true,
        results: formattedResults,
        total: formattedResults.length,
        query,
        searchType: 'semantic'
      };

    } catch (error) {
      set.status = 500;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }, {
    body: t.Object({
      query: t.String(),
      limit: t.Optional(t.Number())
    })
  })

  // Statistics endpoint
  .get('/stats', () => {
    try {
      const totalDocs = db.prepare('SELECT COUNT(*) as count FROM knowledge_base_enhanced').get() as { count: number };
      const totalChunks = db.prepare('SELECT COUNT(DISTINCT chunk_index) as count FROM knowledge_base_enhanced').get() as { count: number };
      const withEmbeddings = db.prepare('SELECT COUNT(*) as count FROM knowledge_base_enhanced WHERE embedding IS NOT NULL').get() as { count: number };
      
      const categories = db.prepare(`
        SELECT JSON_EXTRACT(metadata, '$.category') as category, COUNT(*) as count 
        FROM knowledge_base_enhanced 
        WHERE JSON_EXTRACT(metadata, '$.category') IS NOT NULL
        GROUP BY category
      `).all();

      const recentUploads = db.prepare(`
        SELECT COUNT(*) as count 
        FROM knowledge_base_enhanced 
        WHERE created_at >= datetime('now', '-7 days')
      `).get() as { count: number };

      return {
        success: true,
        stats: {
          totalDocuments: totalDocs.count,
          totalChunks: totalChunks.count,
          withEmbeddings: withEmbeddings.count,
          recentUploads: recentUploads.count,
          categories: categories,
          embeddingCoverage: totalDocs.count > 0 ? (withEmbeddings.count / totalDocs.count * 100).toFixed(1) : '0'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  })

  // Health check specific to knowledge service
  .get('/health', () => {
    try {
      // Test database connection
      const dbTest = db.prepare('SELECT 1').get();
      
      // Check OpenAI configuration
      const openaiConfigured = process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('placeholder');
      
      return {
        status: 'healthy',
        database: dbTest ? 'connected' : 'disconnected',
        openai: openaiConfigured ? 'configured' : 'not configured',
        embeddings: openaiConfigured ? 'available' : 'unavailable',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  });

// Utility function to chunk text
function chunkText(text: string, maxChunkSize: number): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/[.!?]+/).filter(s => s.trim());
  
  let currentChunk = '';
  
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;
    
    if (currentChunk.length + trimmedSentence.length <= maxChunkSize) {
      currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk + '.');
      }
      currentChunk = trimmedSentence;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk + '.');
  }
  
  // Handle edge case where text has no proper sentences
  if (chunks.length === 0 && text.trim()) {
    const words = text.split(/\s+/);
    let chunk = '';
    
    for (const word of words) {
      if (chunk.length + word.length + 1 <= maxChunkSize) {
        chunk += (chunk ? ' ' : '') + word;
      } else {
        if (chunk) chunks.push(chunk);
        chunk = word;
      }
    }
    
    if (chunk) chunks.push(chunk);
  }
  
  return chunks;
}

export default knowledgeService;