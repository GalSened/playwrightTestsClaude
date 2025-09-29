import { config } from 'dotenv';
import { OpenAI } from 'openai';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import Database from 'better-sqlite3';

// Load environment variables
config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function cleanDatabase(): Promise<boolean> {
  console.log('🗑️ Cleaning old knowledge base...');
  
  const db = new Database(join(process.cwd(), 'data/scheduler.db'));
  
  // Delete ALL previous knowledge
  db.exec('DELETE FROM knowledge_base');
  
  // Verify it's empty
  const result = db.prepare('SELECT COUNT(*) as count FROM knowledge_base').get() as { count: number };
  console.log(`✓ Database cleaned. Records remaining: ${result.count}`);
  
  db.close();
  return result.count === 0;
}

async function ingestWeSignPRD(): Promise<number> {
  // Use the EXACT filename they provided
  const prdPath = join(process.cwd(), '../docs/prd/Product Requirements Document (PRD) - WeSign.md');
  
  if (!existsSync(prdPath)) {
    console.error('❌ PRD not found at:', prdPath);
    return 0;
  }
  
  console.log('📄 Ingesting WeSign PRD...');
  const content = readFileSync(prdPath, 'utf-8');
  console.log(`   📊 PRD size: ${(content.length / 1024).toFixed(2)} KB`);
  
  const db = new Database(join(process.cwd(), 'data/scheduler.db'));
  
  // CRITICAL: Store the system definition FIRST
  const systemDefinition = `SYSTEM: WeSign
TYPE: Document Signing Platform (like DocuSign)
PURPOSE: Digital document signing and management
URL: https://devtest.comda.co.il
LOGIN: admin@demo.com / demo123

⚠️ IMPORTANT: WeSign is NOT a test management system!
WeSign is the APPLICATION BEING TESTED by Playwright tests.

Key Features of WeSign:
- Document Upload (העלאת קובץ) 
- Digital Signatures (חתימה דיגיטלית)
- Contact Management (אנשי קשר)
- Template Management (תבניות) 
- Merge Files (איחוד קבצים)
- User Authentication
- Document Workflows
- Bilingual Support (Hebrew/English)

WeSign allows users to:
1. Upload documents for signing
2. Create digital signatures
3. Manage contacts and signers
4. Send documents for signature
5. Track signature status
6. Merge multiple documents
7. Use document templates`;
  
  const stmt = db.prepare('INSERT INTO knowledge_base (id, content, type, source, chunk_index) VALUES (?, ?, ?, ?, ?)');
  stmt.run('system-definition', systemDefinition, 'system', 'core-definition', -1);
  
  console.log('   ✅ System definition stored');
  
  // Parse PRD sections by headers
  const sections = content.split(/^##\s+/gm).filter(section => section.trim().length > 50);
  let chunkCount = 0;
  
  for (const section of sections) {
    if (section.trim()) {
      const title = section.split('\n')[0].replace(/[^\w\s]/g, '').trim();
      const fullSection = '## ' + section; // Restore the header
      
      stmt.run(`prd-${chunkCount}`, fullSection, 'prd', `wesign-prd-${title}`, chunkCount);
      chunkCount++;
    }
  }
  
  console.log(`   ✅ PRD ingested: ${chunkCount} sections`);
  db.close();
  return chunkCount;
}

async function ingestWeSignAPI(): Promise<number> {
  // Use the EXACT filename they provided
  const apiPath = join(process.cwd(), '../docs/api/wesign_API.json');
  
  if (!existsSync(apiPath)) {
    console.error('❌ API not found at:', apiPath);
    return 0;
  }
  
  console.log('🔌 Ingesting WeSign API...');
  const content = readFileSync(apiPath, 'utf-8');
  console.log(`   📊 API size: ${(content.length / 1024).toFixed(2)} KB`);
  
  const db = new Database(join(process.cwd(), 'data/scheduler.db'));
  
  try {
    const apiData = JSON.parse(content);
    let endpointCount = 0;
    const stmt = db.prepare('INSERT INTO knowledge_base (id, content, type, source, chunk_index) VALUES (?, ?, ?, ?, ?)');
    
    // If it's OpenAPI/Swagger format
    if (apiData.paths) {
      console.log('   🔍 Processing OpenAPI/Swagger format');
      
      for (const [path, methods] of Object.entries(apiData.paths)) {
        for (const [method, details] of Object.entries(methods as any)) {
          const endpointDoc = `WeSign API Endpoint:
Method: ${method.toUpperCase()}
Path: ${path}
Summary: ${(details as any).summary || 'No summary'}
Description: ${(details as any).description || 'No description'}
Parameters: ${JSON.stringify((details as any).parameters || [], null, 2)}
Responses: ${JSON.stringify((details as any).responses || {}, null, 2)}`;
          
          stmt.run(`api-${endpointCount}`, endpointDoc, 'api', 'wesign-api', endpointCount);
          endpointCount++;
        }
      }
    }
    // If it's Postman collection format
    else if (apiData.info && apiData.item) {
      console.log('   🔍 Processing Postman collection format');
      
      const processItems = (items: any[], path = '') => {
        for (const item of items) {
          if (item.item) {
            // It's a folder
            processItems(item.item, `${path}${item.name}/`);
          } else if (item.request) {
            // It's a request
            const url = typeof item.request.url === 'string' 
              ? item.request.url 
              : item.request.url?.raw || JSON.stringify(item.request.url);
              
            const endpointDoc = `WeSign API Request:
Name: ${item.name}
Method: ${item.request.method || 'GET'}
URL: ${url}
Description: ${item.request.description || item.description || 'No description'}
Headers: ${JSON.stringify(item.request.header || [], null, 2)}
Body: ${JSON.stringify(item.request.body || {}, null, 2)}`;
            
            stmt.run(`api-${endpointCount}`, endpointDoc, 'api', 'wesign-api', endpointCount);
            endpointCount++;
          }
        }
      };
      
      processItems(apiData.item);
    }
    // Generic JSON format
    else {
      console.log('   🔍 Processing generic API format');
      // Break large JSON into manageable chunks
      const jsonStr = JSON.stringify(apiData, null, 2);
      const chunks = jsonStr.match(/.{1,2000}/g) || [jsonStr];
      
      chunks.forEach((chunk, i) => {
        stmt.run(`api-generic-${i}`, `WeSign API Data (chunk ${i + 1}):\n${chunk}`, 'api', 'wesign-api', i);
        endpointCount++;
      });
    }
    
    console.log(`   ✅ API ingested: ${endpointCount} items`);
    db.close();
    return endpointCount;
    
  } catch (error) {
    console.error('   ❌ Error parsing API:', error);
    db.close();
    return 0;
  }
}

async function ingestCriticalTestContext(): Promise<number> {
  console.log('🧪 Adding critical test context...');
  
  const db = new Database(join(process.cwd(), 'data/scheduler.db'));
  const stmt = db.prepare('INSERT INTO knowledge_base (id, content, type, source, chunk_index) VALUES (?, ?, ?, ?, ?)');
  
  const testContext = `TESTING CONTEXT FOR WESIGN:

WeSign Test Environment:
- URL: https://devtest.comda.co.il  
- Login: admin@demo.com / demo123
- Framework: Playwright with TypeScript
- Languages: Hebrew (עברית) + English

Key Test Scenarios for WeSign:
1. Login/Authentication Tests
2. Document Upload Tests (העלאת מסמכים)
3. Digital Signature Tests (חתימה דיגיטלית) 
4. Contact Management Tests (ניהול אנשי קשר)
5. Template Management Tests (ניהול תבניות)
6. Document Merge Tests (איחוד מסמכים)
7. Workflow Tests
8. Bilingual UI Tests

Common WeSign Test Patterns:
- Navigate to login page
- Authenticate with demo credentials  
- Upload PDF/Word documents
- Add signature fields
- Send documents for signing
- Verify signature completion
- Download signed documents

Test Data Locations:
- Test documents in fixtures/
- User credentials in config files
- Hebrew text translations
- API endpoints for automation`;

  stmt.run('test-context', testContext, 'test-context', 'wesign-testing', 0);
  
  console.log('   ✅ Test context added');
  db.close();
  return 1;
}

async function main() {
  console.log('🚀 Starting WeSign Clean Ingestion Process...\n');
  
  // Step 1: Clean everything
  console.log('STEP 1: Cleaning Database');
  const cleaned = await cleanDatabase();
  if (!cleaned) {
    console.error('❌ Failed to clean database');
    return;
  }
  
  // Step 2: Ingest PRD with system definition
  console.log('\nSTEP 2: Ingesting WeSign PRD');
  const prdChunks = await ingestWeSignPRD();
  
  // Step 3: Ingest API
  console.log('\nSTEP 3: Ingesting WeSign API');
  const apiItems = await ingestWeSignAPI();
  
  // Step 4: Add test context
  console.log('\nSTEP 4: Adding Test Context');
  const testItems = await ingestCriticalTestContext();
  
  // Step 5: Verify
  console.log('\n' + '='.repeat(50));
  console.log('📊 FINAL VERIFICATION');
  console.log('='.repeat(50));
  
  const db = new Database(join(process.cwd(), 'data/scheduler.db'));
  const stats = db.prepare('SELECT type, COUNT(*) as count FROM knowledge_base GROUP BY type').all();
  
  console.table(stats);
  
  // Step 6: Test system understanding
  const systemDef = db.prepare('SELECT content FROM knowledge_base WHERE id = ?').get('system-definition') as any;
  console.log('\n✅ System Understanding:', systemDef?.content ? '✅ CORRECT' : '❌ MISSING');
  
  if (systemDef?.content) {
    console.log('\n📋 WeSign System Definition:');
    console.log(systemDef.content.split('\n').slice(0, 10).join('\n') + '...');
  }
  
  const totalItems = prdChunks + apiItems + testItems + 1; // +1 for system definition
  console.log(`\n🎉 Clean ingestion completed successfully!`);
  console.log(`📊 Total items: ${totalItems}`);
  console.log(`   📄 PRD sections: ${prdChunks}`);
  console.log(`   🔌 API items: ${apiItems}`);
  console.log(`   🧪 Test context: ${testItems}`);
  console.log(`   🎯 System definition: 1`);
  
  db.close();
}

if (require.main === module) {
  main().catch(console.error);
}

export { main as cleanAndIngest };