import { config } from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import Database from 'better-sqlite3';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Document } from '@langchain/core/documents';

// Load environment variables
config();

class LangChainIngestionService {
  private db: Database.Database;
  private textSplitter: RecursiveCharacterTextSplitter;
  private embeddings: OpenAIEmbeddings;

  constructor() {
    this.db = new Database(join(process.cwd(), 'data/scheduler.db'));
    
    // Smart text splitter - preserves semantic meaning
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ['\n\n', '\n', '. ', ' ', ''],
    });
    
    // OpenAI embeddings through LangChain
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'text-embedding-3-small',
    });
  }

  async cleanKnowledgeBase(): Promise<void> {
    console.log('🗑️ Cleaning existing knowledge base...');
    this.db.exec('DELETE FROM knowledge_base');
    
    // Enhance the knowledge base schema for LangChain
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
    
    this.db.exec('DELETE FROM knowledge_base_enhanced');
    console.log('✅ Knowledge base cleaned');
  }

  async ingestWeSignSystem(): Promise<number> {
    console.log('🎯 Ingesting WeSign system definition...');
    
    const systemDefinition = `SYSTEM: WeSign
TYPE: Document Signing Platform (like DocuSign)
PURPOSE: Digital document signing and management
URL: https://devtest.comda.co.il
LOGIN: admin@demo.com / demo123

⚠️ CRITICAL UNDERSTANDING: WeSign is NOT a test management system!
WeSign is the APPLICATION BEING TESTED by Playwright tests.

WeSign is a document signing platform that allows users to:

🔹 CORE FEATURES:
• Document Upload (העלאת קובץ) - Upload PDFs, Word docs for signing
• Digital Signatures (חתימה דיגיטלית) - Create and apply electronic signatures  
• Contact Management (אנשי קשר) - Manage signers and recipients
• Template Management (תבניות) - Create reusable document templates
• Merge Files (איחוד קבצים) - Combine multiple documents
• User Authentication - Secure login and user management
• Document Workflows - Send, track, and manage signing processes
• Bilingual Support - Hebrew (עברית) and English interface

🔹 USER WORKFLOWS:
1. Login to WeSign platform
2. Upload documents needing signatures
3. Add signature fields and assign signers
4. Send documents for electronic signing
5. Track signature completion status
6. Download completed signed documents
7. Manage document templates and workflows

🔹 TESTING CONTEXT:
- This is a web application tested with Playwright
- Users interact through browser interface
- Tests verify document upload, signing, and management features
- Bilingual interface requires Hebrew and English test scenarios
- Authentication, file operations, and signature workflows are key test areas

WeSign competes with DocuSign, HelloSign, Adobe Sign in the electronic signature market.`;

    const doc = new Document({
      pageContent: systemDefinition,
      metadata: {
        source: 'system-definition',
        type: 'core-system',
        importance: 'critical',
      },
    });

    await this.storeDocument(doc, 'system-core', 0);
    console.log('✅ System definition stored with LangChain');
    return 1;
  }

  async ingestWeSignPRD(): Promise<number> {
    const prdPath = join(process.cwd(), '../docs/prd/Product Requirements Document (PRD) - WeSign.md');
    
    if (!existsSync(prdPath)) {
      console.log('❌ PRD not found at:', prdPath);
      return 0;
    }

    console.log('📄 Ingesting WeSign PRD with LangChain...');
    const content = readFileSync(prdPath, 'utf-8');
    console.log(`   📊 PRD size: ${(content.length / 1024).toFixed(2)} KB`);

    // Create document with metadata
    const document = new Document({
      pageContent: content,
      metadata: {
        source: 'wesign-prd',
        type: 'product-requirements',
        filename: 'Product Requirements Document (PRD) - WeSign.md',
      },
    });

    // Smart splitting preserves context
    const chunks = await this.textSplitter.splitDocuments([document]);
    console.log(`   ✂️  LangChain created ${chunks.length} intelligent chunks`);

    let chunkCount = 0;
    for (const chunk of chunks) {
      await this.storeDocument(chunk, 'prd', chunkCount);
      chunkCount++;
    }

    console.log(`   ✅ PRD ingested with LangChain: ${chunkCount} chunks`);
    return chunkCount;
  }

  async ingestWeSignAPI(): Promise<number> {
    const apiPath = join(process.cwd(), '../docs/api/wesign_API.json');
    
    if (!existsSync(apiPath)) {
      console.log('❌ API not found at:', apiPath);
      return 0;
    }

    console.log('🔌 Ingesting WeSign API with LangChain...');
    const content = readFileSync(apiPath, 'utf-8');
    console.log(`   📊 API size: ${(content.length / 1024).toFixed(2)} KB`);

    try {
      const apiData = JSON.parse(content);
      let endpointCount = 0;

      if (apiData.paths) {
        console.log('   🔍 Processing OpenAPI/Swagger with LangChain');
        
        // Group related endpoints for better context
        const endpointGroups: { [key: string]: any[] } = {};
        
        for (const [path, methods] of Object.entries(apiData.paths)) {
          const category = this.categorizeEndpoint(path);
          if (!endpointGroups[category]) endpointGroups[category] = [];
          
          for (const [method, details] of Object.entries(methods as any)) {
            endpointGroups[category].push({
              method: method.toUpperCase(),
              path,
              details: details as any,
            });
          }
        }

        // Create documents for each category
        for (const [category, endpoints] of Object.entries(endpointGroups)) {
          const categoryDoc = this.createAPIDocument(category, endpoints);
          const chunks = await this.textSplitter.splitDocuments([categoryDoc]);
          
          for (const chunk of chunks) {
            await this.storeDocument(chunk, 'api', endpointCount);
            endpointCount++;
          }
        }
      }

      console.log(`   ✅ API ingested with LangChain: ${endpointCount} chunks`);
      return endpointCount;
      
    } catch (error) {
      console.error('   ❌ Error processing API:', error);
      return 0;
    }
  }

  async ingestTestingContext(): Promise<number> {
    console.log('🧪 Creating testing context with LangChain...');

    const testingContext = `PLAYWRIGHT TESTING FOR WESIGN

WeSign Test Environment:
- URL: https://devtest.comda.co.il
- Login: admin@demo.com / demo123
- Framework: Playwright with TypeScript
- Languages: Hebrew (עברית) + English

Key Test Scenarios:
1. Authentication Tests
   - Login with valid credentials
   - Logout functionality
   - Session management

2. Document Upload Tests (העלאת מסמכים)
   - Upload PDF documents
   - Upload Word documents
   - File validation and error handling
   - Progress indicators and confirmations

3. Digital Signature Tests (חתימה דיגיטלית)
   - Create signature fields
   - Apply digital signatures
   - Signature validation
   - Multiple signers workflow

4. Contact Management Tests (ניהול אנשי קשר)
   - Add new contacts
   - Edit existing contacts
   - Delete contacts
   - Contact search and filtering

5. Template Management Tests (ניהול תבניות)
   - Create document templates
   - Edit templates
   - Apply templates to documents
   - Template categorization

6. Document Merge Tests (איחוד מסמכים)
   - Select multiple documents
   - Merge into single document
   - Maintain formatting and signatures

7. Workflow Tests
   - Send documents for signing
   - Track signature status
   - Receive completion notifications
   - Download signed documents

8. Bilingual UI Tests
   - Switch between Hebrew and English
   - Verify translations
   - RTL (right-to-left) layout for Hebrew
   - Unicode handling for Hebrew text

Common Test Patterns:
- Page Object Model for WeSign pages
- Fixture management for test documents
- Data-driven tests for different document types
- Cross-browser compatibility testing
- Mobile responsiveness testing

Test Data Management:
- Sample PDF files in fixtures/documents/
- Test user accounts and credentials
- Hebrew text samples for bilingual testing
- API response mocks for unit testing`;

    const doc = new Document({
      pageContent: testingContext,
      metadata: {
        source: 'testing-context',
        type: 'test-guidance',
        framework: 'playwright',
        target: 'wesign-platform',
      },
    });

    await this.storeDocument(doc, 'test-context', 0);
    console.log('   ✅ Testing context stored');
    return 1;
  }

  private async storeDocument(doc: Document, type: string, index: number): Promise<void> {
    try {
      // Generate embedding using LangChain
      const embedding = await this.embeddings.embedQuery(doc.pageContent);
      
      const stmt = this.db.prepare(`
        INSERT INTO knowledge_base_enhanced 
        (id, content, type, source, chunk_index, metadata, embedding) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        `${type}-${index}`,
        doc.pageContent,
        type,
        doc.metadata.source || type,
        index,
        JSON.stringify(doc.metadata),
        Buffer.from(new Float64Array(embedding).buffer)
      );
    } catch (error) {
      console.warn(`   ⚠️  Storing without embedding (API key needed):`, (error as Error).message);
      
      // Fallback to basic storage
      const stmt = this.db.prepare(`
        INSERT INTO knowledge_base_enhanced 
        (id, content, type, source, chunk_index, metadata) 
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        `${type}-${index}`,
        doc.pageContent,
        type,
        doc.metadata.source || type,
        index,
        JSON.stringify(doc.metadata)
      );
    }
  }

  private categorizeEndpoint(path: string): string {
    if (path.includes('/auth') || path.includes('/login')) return 'authentication';
    if (path.includes('/document') || path.includes('/file')) return 'documents';
    if (path.includes('/sign') || path.includes('/signature')) return 'signatures';
    if (path.includes('/contact') || path.includes('/user')) return 'contacts';
    if (path.includes('/template')) return 'templates';
    if (path.includes('/merge')) return 'file-operations';
    return 'general';
  }

  private createAPIDocument(category: string, endpoints: any[]): Document {
    const content = `WeSign API Category: ${category.toUpperCase()}

${endpoints.map(ep => `
Endpoint: ${ep.method} ${ep.path}
Summary: ${ep.details.summary || 'No summary'}
Description: ${ep.details.description || 'No description'}
Parameters: ${JSON.stringify(ep.details.parameters || [], null, 2)}
Responses: ${JSON.stringify(ep.details.responses || {}, null, 2)}
---`).join('\n')}`;

    return new Document({
      pageContent: content,
      metadata: {
        source: 'wesign-api',
        type: 'api-reference',
        category: category,
        endpointCount: endpoints.length,
      },
    });
  }

  async getStats(): Promise<any> {
    const stats = this.db.prepare(`
      SELECT type, COUNT(*) as count 
      FROM knowledge_base_enhanced 
      GROUP BY type
    `).all();

    const total = this.db.prepare(`
      SELECT COUNT(*) as total 
      FROM knowledge_base_enhanced
    `).get() as { total: number };

    return { byType: stats, total: total.total };
  }

  close(): void {
    this.db.close();
  }
}

// Main ingestion function
async function main() {
  console.log('🚀 Starting LangChain-Enhanced WeSign Ingestion...\n');

  const service = new LangChainIngestionService();

  try {
    // Step 1: Clean existing knowledge base
    await service.cleanKnowledgeBase();

    // Step 2: Ingest core system definition
    const systemCount = await service.ingestWeSignSystem();

    // Step 3: Ingest PRD with smart chunking
    const prdCount = await service.ingestWeSignPRD();

    // Step 4: Ingest API with categorization
    const apiCount = await service.ingestWeSignAPI();

    // Step 5: Add testing context
    const testCount = await service.ingestTestingContext();

    // Final stats
    console.log('\n' + '='.repeat(50));
    console.log('📊 LANGCHAIN INGESTION COMPLETE');
    console.log('='.repeat(50));

    const stats = await service.getStats();
    console.table(stats.byType);

    console.log(`\n🎉 Total knowledge items: ${stats.total}`);
    console.log(`   🎯 System definition: ${systemCount}`);
    console.log(`   📄 PRD chunks: ${prdCount}`);
    console.log(`   🔌 API chunks: ${apiCount}`);
    console.log(`   🧪 Test context: ${testCount}`);

    console.log('\n✅ LangChain ingestion successful!');
    console.log('🧠 Enhanced semantic chunking and embeddings ready');
    console.log('🔍 Improved context retrieval for WeSign queries');

  } catch (error) {
    console.error('❌ Ingestion failed:', error);
  } finally {
    service.close();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { LangChainIngestionService };