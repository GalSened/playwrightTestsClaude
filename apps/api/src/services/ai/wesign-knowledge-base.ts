import { ChatOpenAI } from '@langchain/openai';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { OpenAIEmbeddings } from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Document } from 'langchain/document';
import Database from 'better-sqlite3';
import { join } from 'path';
import { readFileSync, readdirSync, statSync } from 'fs';
import { logger } from '@/utils/logger';

interface WeSignKnowledgeEntry {
  id: string;
  type: 'test_case' | 'page_object' | 'locator' | 'workflow' | 'documentation';
  title: string;
  content: string;
  metadata: Record<string, any>;
  embedding?: number[];
  created_at: string;
  updated_at: string;
}

interface WeSignQueryResult {
  entry: WeSignKnowledgeEntry;
  relevanceScore: number;
  summary: string;
}

export class WeSignKnowledgeBase {
  private llm: ChatOpenAI;
  private embeddings: OpenAIEmbeddings;
  private vectorStore: MemoryVectorStore | null = null;
  private db: Database.Database;
  private textSplitter: RecursiveCharacterTextSplitter;

  constructor() {
    // Initialize AI components if API key is available
    if (process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('placeholder')) {
      this.llm = new ChatOpenAI({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: 'gpt-4o',
        temperature: 0.1,
        maxTokens: 2000
      });

      this.embeddings = new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: 'text-embedding-3-small'
      });
    }

    // Initialize database
    this.db = new Database(join(process.cwd(), 'data/wesign-knowledge.db'));
    this.initializeDatabase();

    // Text splitter for chunking documents
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ['\n\n', '\n', '. ', ' ', '']
    });
  }

  private initializeDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_entries (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS knowledge_vectors (
        entry_id TEXT PRIMARY KEY,
        embedding TEXT,
        FOREIGN KEY (entry_id) REFERENCES knowledge_entries(id)
      );

      CREATE INDEX IF NOT EXISTS idx_knowledge_type ON knowledge_entries(type);
      CREATE INDEX IF NOT EXISTS idx_knowledge_title ON knowledge_entries(title);
      CREATE INDEX IF NOT EXISTS idx_knowledge_updated ON knowledge_entries(updated_at);
    `);
  }

  async ingestWeSignTestSuite(testSuitePath: string): Promise<void> {
    try {
      logger.info(`Starting WeSign test suite ingestion from: ${testSuitePath}`);

      const testFiles = this.findTestFiles(testSuitePath);
      const pageObjects = this.findPageObjects(testSuitePath);
      const configFiles = this.findConfigFiles(testSuitePath);

      let processedCount = 0;

      // Process test files
      for (const testFile of testFiles) {
        try {
          const content = readFileSync(testFile, 'utf-8');
          const metadata = this.extractTestMetadata(content, testFile);

          await this.addKnowledgeEntry({
            id: `test_${Date.now()}_${processedCount++}`,
            type: 'test_case',
            title: this.extractTestTitle(testFile),
            content: content,
            metadata: metadata
          });
        } catch (error) {
          logger.error(`Failed to process test file ${testFile}:`, error);
        }
      }

      // Process page objects
      for (const pageFile of pageObjects) {
        try {
          const content = readFileSync(pageFile, 'utf-8');
          const metadata = this.extractPageObjectMetadata(content, pageFile);

          await this.addKnowledgeEntry({
            id: `page_${Date.now()}_${processedCount++}`,
            type: 'page_object',
            title: this.extractPageObjectTitle(pageFile),
            content: content,
            metadata: metadata
          });
        } catch (error) {
          logger.error(`Failed to process page object ${pageFile}:`, error);
        }
      }

      // Process configuration files
      for (const configFile of configFiles) {
        try {
          const content = readFileSync(configFile, 'utf-8');
          const metadata = this.extractConfigMetadata(content, configFile);

          await this.addKnowledgeEntry({
            id: `config_${Date.now()}_${processedCount++}`,
            type: 'documentation',
            title: this.extractConfigTitle(configFile),
            content: content,
            metadata: metadata
          });
        } catch (error) {
          logger.error(`Failed to process config file ${configFile}:`, error);
        }
      }

      // Initialize vector store after ingestion
      await this.initializeVectorStore();

      logger.info(`WeSign knowledge ingestion completed. Processed ${processedCount} files.`);
    } catch (error) {
      logger.error('Failed to ingest WeSign test suite:', error);
      throw error;
    }
  }

  private findTestFiles(basePath: string): string[] {
    const testFiles: string[] = [];
    this.traverseDirectory(basePath, (filePath) => {
      if (filePath.includes('/tests/') && filePath.endsWith('.py')) {
        testFiles.push(filePath);
      }
    });
    return testFiles;
  }

  private findPageObjects(basePath: string): string[] {
    const pageFiles: string[] = [];
    this.traverseDirectory(basePath, (filePath) => {
      if (filePath.includes('/pages/') && filePath.endsWith('.py')) {
        pageFiles.push(filePath);
      }
    });
    return pageFiles;
  }

  private findConfigFiles(basePath: string): string[] {
    const configFiles: string[] = [];
    this.traverseDirectory(basePath, (filePath) => {
      if (filePath.endsWith('.json') || filePath.endsWith('.ini') || filePath.endsWith('.md')) {
        configFiles.push(filePath);
      }
    });
    return configFiles;
  }

  private traverseDirectory(dirPath: string, callback: (filePath: string) => void): void {
    try {
      const items = readdirSync(dirPath);

      for (const item of items) {
        const fullPath = join(dirPath, item);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          if (!item.startsWith('.') && !item.includes('node_modules') && !item.includes('__pycache__')) {
            this.traverseDirectory(fullPath, callback);
          }
        } else if (stat.isFile()) {
          callback(fullPath);
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
      logger.warn(`Cannot read directory ${dirPath}:`, error);
    }
  }

  private extractTestMetadata(content: string, filePath: string): Record<string, any> {
    const metadata: Record<string, any> = {
      filePath,
      language: 'python',
      framework: 'pytest',
      fileType: 'test_case'
    };

    // Extract test methods
    const testMethods = content.match(/def test_\w+/g) || [];
    metadata.testMethods = testMethods.map(m => m.replace('def ', ''));
    metadata.testCount = testMethods.length;

    // Extract imports to understand dependencies
    const imports = content.match(/^(?:from|import)\s+[\w.]+/gm) || [];
    metadata.dependencies = imports;

    // Extract WeSign-specific patterns
    if (content.includes('wesign') || content.includes('WeSign')) {
      metadata.isWeSignRelated = true;
    }

    // Extract test categories
    if (filePath.includes('auth')) metadata.category = 'authentication';
    else if (filePath.includes('signing')) metadata.category = 'digital_signing';
    else if (filePath.includes('documents')) metadata.category = 'document_management';
    else if (filePath.includes('templates')) metadata.category = 'templates';
    else if (filePath.includes('contacts')) metadata.category = 'contact_management';
    else metadata.category = 'general';

    return metadata;
  }

  private extractPageObjectMetadata(content: string, filePath: string): Record<string, any> {
    const metadata: Record<string, any> = {
      filePath,
      language: 'python',
      fileType: 'page_object'
    };

    // Extract class name
    const classMatch = content.match(/class\s+(\w+)/);
    if (classMatch) {
      metadata.className = classMatch[1];
    }

    // Extract locators
    const locators = content.match(/[\w_]+\s*=\s*["'][^"']+["']/g) || [];
    metadata.locators = locators;
    metadata.locatorCount = locators.length;

    // Extract methods
    const methods = content.match(/def\s+\w+/g) || [];
    metadata.methods = methods.map(m => m.replace('def ', ''));

    return metadata;
  }

  private extractConfigMetadata(content: string, filePath: string): Record<string, any> {
    const metadata: Record<string, any> = {
      filePath,
      fileType: 'configuration'
    };

    if (filePath.endsWith('.json')) {
      try {
        const jsonData = JSON.parse(content);
        metadata.configKeys = Object.keys(jsonData);
        metadata.format = 'json';
      } catch (e) {
        metadata.format = 'json_invalid';
      }
    } else if (filePath.endsWith('.ini')) {
      metadata.format = 'ini';
    } else if (filePath.endsWith('.md')) {
      metadata.format = 'markdown';
      const headers = content.match(/^#+\s+.+$/gm) || [];
      metadata.sections = headers;
    }

    return metadata;
  }

  private extractTestTitle(filePath: string): string {
    const fileName = filePath.split(/[\\/]/).pop() || '';
    return fileName.replace('.py', '').replace(/_/g, ' ').replace(/^test /, '');
  }

  private extractPageObjectTitle(filePath: string): string {
    const fileName = filePath.split(/[\\/]/).pop() || '';
    return fileName.replace('.py', '').replace(/_/g, ' ');
  }

  private extractConfigTitle(filePath: string): string {
    const fileName = filePath.split(/[\\/]/).pop() || '';
    return fileName;
  }

  async addKnowledgeEntry(entry: Omit<WeSignKnowledgeEntry, 'created_at' | 'updated_at'>): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO knowledge_entries (id, type, title, content, metadata, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `);

      stmt.run(
        entry.id,
        entry.type,
        entry.title,
        entry.content,
        JSON.stringify(entry.metadata)
      );

      // Generate embedding if OpenAI is available
      if (this.embeddings) {
        try {
          const embedding = await this.embeddings.embedQuery(entry.content);

          const vectorStmt = this.db.prepare(`
            INSERT OR REPLACE INTO knowledge_vectors (entry_id, embedding)
            VALUES (?, ?)
          `);

          vectorStmt.run(entry.id, JSON.stringify(embedding));
        } catch (error) {
          logger.warn(`Failed to generate embedding for entry ${entry.id}:`, error);
        }
      }

      logger.debug(`Added knowledge entry: ${entry.title} (${entry.type})`);
    } catch (error) {
      logger.error(`Failed to add knowledge entry ${entry.id}:`, error);
      throw error;
    }
  }

  async queryKnowledge(query: string, limit: number = 10): Promise<WeSignQueryResult[]> {
    try {
      if (!this.llm) {
        throw new Error('OpenAI API key not configured');
      }

      const results: WeSignQueryResult[] = [];

      // Semantic search using embeddings if available
      if (this.vectorStore) {
        const semanticResults = await this.vectorStore.similaritySearch(query, limit);

        for (const doc of semanticResults) {
          const entry = this.getKnowledgeEntryById(doc.metadata.id);
          if (entry) {
            // Generate AI summary of relevance
            const summary = await this.generateRelevanceSummary(query, entry);

            results.push({
              entry,
              relevanceScore: doc.metadata.score || 0.8,
              summary
            });
          }
        }
      } else {
        // Fallback to keyword search
        const keywordResults = this.keywordSearch(query, limit);

        for (const entry of keywordResults) {
          const summary = await this.generateRelevanceSummary(query, entry);

          results.push({
            entry,
            relevanceScore: 0.6,
            summary
          });
        }
      }

      return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
    } catch (error) {
      logger.error('Failed to query knowledge base:', error);
      throw error;
    }
  }

  private async generateRelevanceSummary(query: string, entry: WeSignKnowledgeEntry): Promise<string> {
    try {
      if (!this.llm) {
        return `${entry.type}: ${entry.title}`;
      }

      const prompt = `
Query: "${query}"

Knowledge Entry:
Type: ${entry.type}
Title: ${entry.title}
Content: ${entry.content.substring(0, 500)}...

Explain in 1-2 sentences how this knowledge entry is relevant to the query. Focus on practical applications for WeSign testing.
      `;

      const response = await this.llm.invoke(prompt);
      return response.content.toString().trim();
    } catch (error) {
      logger.warn('Failed to generate relevance summary:', error);
      return `${entry.type}: ${entry.title}`;
    }
  }

  private keywordSearch(query: string, limit: number): WeSignKnowledgeEntry[] {
    const keywords = query.toLowerCase().split(/\s+/);

    const stmt = this.db.prepare(`
      SELECT * FROM knowledge_entries
      WHERE (
        LOWER(title) LIKE ? OR
        LOWER(content) LIKE ? OR
        LOWER(metadata) LIKE ?
      )
      ORDER BY updated_at DESC
      LIMIT ?
    `);

    const searchPattern = `%${keywords.join('%')}%`;
    const rows = stmt.all(searchPattern, searchPattern, searchPattern, limit) as any[];

    return rows.map(row => ({
      ...row,
      metadata: JSON.parse(row.metadata || '{}')
    }));
  }

  private getKnowledgeEntryById(id: string): WeSignKnowledgeEntry | null {
    const stmt = this.db.prepare('SELECT * FROM knowledge_entries WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;

    return {
      ...row,
      metadata: JSON.parse(row.metadata || '{}')
    };
  }

  private async initializeVectorStore(): Promise<void> {
    try {
      if (!this.embeddings) {
        logger.warn('Cannot initialize vector store without embeddings');
        return;
      }

      const stmt = this.db.prepare(`
        SELECT ke.*, kv.embedding
        FROM knowledge_entries ke
        LEFT JOIN knowledge_vectors kv ON ke.id = kv.entry_id
      `);

      const entries = stmt.all() as any[];
      const documents: Document[] = [];

      for (const entry of entries) {
        const chunks = await this.textSplitter.splitText(entry.content);

        for (const chunk of chunks) {
          documents.push(new Document({
            pageContent: chunk,
            metadata: {
              id: entry.id,
              type: entry.type,
              title: entry.title,
              ...JSON.parse(entry.metadata || '{}')
            }
          }));
        }
      }

      if (documents.length > 0) {
        this.vectorStore = await MemoryVectorStore.fromDocuments(documents, this.embeddings);
        logger.info(`Initialized vector store with ${documents.length} document chunks`);
      }
    } catch (error) {
      logger.error('Failed to initialize vector store:', error);
    }
  }

  async getKnowledgeStats(): Promise<Record<string, any>> {
    const stats = {
      totalEntries: 0,
      entriesByType: {} as Record<string, number>,
      recentActivity: [] as any[],
      topCategories: [] as any[]
    };

    // Total entries
    const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM knowledge_entries');
    stats.totalEntries = (totalStmt.get() as any).count;

    // Entries by type
    const typeStmt = this.db.prepare(`
      SELECT type, COUNT(*) as count
      FROM knowledge_entries
      GROUP BY type
    `);
    const typeResults = typeStmt.all() as any[];
    for (const result of typeResults) {
      stats.entriesByType[result.type] = result.count;
    }

    // Recent activity
    const recentStmt = this.db.prepare(`
      SELECT title, type, updated_at
      FROM knowledge_entries
      ORDER BY updated_at DESC
      LIMIT 10
    `);
    stats.recentActivity = recentStmt.all();

    return stats;
  }

  close(): void {
    if (this.db) {
      this.db.close();
    }
  }
}

export default WeSignKnowledgeBase;