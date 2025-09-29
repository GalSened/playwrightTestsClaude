import { config } from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import Database from 'better-sqlite3';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Document } from '@langchain/core/documents';

config();

async function main() {
  console.log('🚀 Starting LangChain WeSign Ingestion...\n');

  const db = new Database(join(process.cwd(), 'data/scheduler.db'));
  
  // Clean and setup enhanced table
  db.exec('DELETE FROM knowledge_base');
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_base_enhanced (
      id TEXT PRIMARY KEY,
      content TEXT,
      type TEXT,
      source TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec('DELETE FROM knowledge_base_enhanced');

  // Smart text splitter
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 800,
    chunkOverlap: 100,
    separators: ['\n\n', '\n', '. ', ' ', ''],
  });

  let totalChunks = 0;

  // 1. System definition
  console.log('🎯 Adding WeSign system definition...');
  const systemDef = `SYSTEM: WeSign - Document Signing Platform (NOT a test management system!)

WeSign is like DocuSign - a web application for electronic document signing.

URL: https://devtest.comda.co.il
Login: admin@demo.com / demo123

Key Features:
- Document Upload (העלאת קובץ)
- Digital Signatures (חתימה דיגיטלית) 
- Contact Management (אנשי קשר)
- Template Management (תבניות)
- Merge Files (איחוד קבצים)
- Bilingual UI (Hebrew/English)

WeSign allows users to upload documents, add signature fields, send for signing, and track completion.
This is the APPLICATION being tested with Playwright, not a test management tool.`;

  const stmt = db.prepare('INSERT INTO knowledge_base_enhanced (id, content, type, source, metadata) VALUES (?, ?, ?, ?, ?)');
  stmt.run('system-def', systemDef, 'system', 'core', JSON.stringify({importance: 'critical'}));
  totalChunks++;

  // 2. PRD with smart chunking
  const prdPath = join(process.cwd(), '../docs/prd/Product Requirements Document (PRD) - WeSign.md');
  if (existsSync(prdPath)) {
    console.log('📄 Processing WeSign PRD with LangChain...');
    const prdContent = readFileSync(prdPath, 'utf-8');
    
    const prdDoc = new Document({ pageContent: prdContent });
    const prdChunks = await textSplitter.splitDocuments([prdDoc]);
    
    prdChunks.forEach((chunk, i) => {
      stmt.run(`prd-${i}`, chunk.pageContent, 'prd', 'wesign-requirements', JSON.stringify({chunk: i}));
    });
    
    console.log(`   ✅ ${prdChunks.length} intelligent PRD chunks`);
    totalChunks += prdChunks.length;
  }

  // 3. Test context
  console.log('🧪 Adding Playwright test context...');
  const testContext = `WeSign Testing with Playwright:

Test Environment: https://devtest.comda.co.il
Credentials: admin@demo.com / demo123

Key Test Scenarios:
1. Login/Authentication
2. Document Upload (.pdf, .docx)
3. Digital Signature Creation
4. Contact Management
5. Document Templates
6. File Merging
7. Bilingual Interface (Hebrew/English)

WeSign is a document signing platform being tested, not a test management system.

Common Test Patterns:
- Page Object Model for WeSign UI
- File upload testing with fixtures
- Signature workflow testing
- Cross-browser compatibility
- Hebrew/English bilingual testing`;

  stmt.run('test-context', testContext, 'test-context', 'playwright-guidance', JSON.stringify({framework: 'playwright'}));
  totalChunks++;

  // Final stats
  const stats = db.prepare('SELECT type, COUNT(*) as count FROM knowledge_base_enhanced GROUP BY type').all();
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 LANGCHAIN INGESTION RESULTS');
  console.log('='.repeat(50));
  console.table(stats);
  console.log(`\n✅ Total chunks: ${totalChunks}`);
  console.log('🧠 Enhanced with LangChain semantic chunking');
  console.log('🎯 WeSign system understanding improved');

  db.close();
}

if (require.main === module) {
  main().catch(console.error);
}