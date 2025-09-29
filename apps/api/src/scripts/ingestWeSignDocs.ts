import { config } from 'dotenv';
import { OpenAI } from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import Database from 'better-sqlite3';

// Database helper function
function getDatabase() {
  const dbPath = join(process.cwd(), 'data/scheduler.db');
  return new Database(dbPath);
}

// Load environment variables
config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || 'dummy-key'
});

async function chunkText(text: string, maxChunkSize: number = 1000): Promise<string[]> {
  const chunks: string[] = [];
  const lines = text.split('\n');
  let currentChunk = '';
  
  for (const line of lines) {
    if ((currentChunk + line).length > maxChunkSize && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = line;
    } else {
      currentChunk += (currentChunk ? '\n' : '') + line;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text
    });
    return response.data[0].embedding;
  } catch (error) {
    console.log('   ⚠️  Using mock embedding (OpenAI/Pinecone not configured)');
    return Array(1536).fill(0).map(() => Math.random());
  }
}

async function ingestPRD(): Promise<number> {
  const possiblePaths = [
    join(process.cwd(), '../docs/prd/Product Requirements Document (PRD) - WeSign.md'),
    join(process.cwd(), '../docs/prd/wesign-prd.md'),
    join(process.cwd(), '../docs/prd/prd.md'),
    join(process.cwd(), '../docs/prd/WeSign_PRD.md')
  ];
  
  let prdPath = '';
  for (const path of possiblePaths) {
    if (existsSync(path)) {
      prdPath = path;
      break;
    }
  }
  
  if (!prdPath) {
    console.log('❌ WeSign PRD not found. Expected locations:');
    possiblePaths.forEach(path => console.log(`     - ${path}`));
    return 0;
  }
  
  console.log('📄 Ingesting WeSign PRD...');
  console.log('   📂 Path:', prdPath);
  
  const content = readFileSync(prdPath, 'utf-8');
  console.log('   📊 PRD size:', (content.length / 1024).toFixed(2), 'KB');
  
  const chunks = await chunkText(content);
  console.log('   ✂️  Created', chunks.length, 'chunks');
  
  const db = new Database(join(process.cwd(), 'data/scheduler.db'));
  
  // Store chunks in database
  for (let i = 0; i < chunks.length; i++) {
    const embedding = await generateEmbedding(chunks[i]);
    
    const stmt = db.prepare(
      'INSERT OR REPLACE INTO knowledge_base (id, content, type, source, chunk_index) VALUES (?, ?, ?, ?, ?)'
    );
    stmt.run(`prd-${i}`, chunks[i], 'prd', 'wesign-prd', i);
  }
  
  console.log('   ✅ Ingested', chunks.length, 'PRD chunks');
  return chunks.length;
}

async function ingestAPI(): Promise<number> {
  const possiblePaths = [
    join(process.cwd(), '../docs/api/wesign_API.json'),
    join(process.cwd(), '../docs/api/wesign-api.json'),
    join(process.cwd(), '../docs/api/api-collection.json'),
    join(process.cwd(), '../docs/api/postman-collection.json'),
    join(process.cwd(), '../docs/api/wesign_API.yaml'),
    join(process.cwd(), '../docs/api/openapi.yaml'),
    join(process.cwd(), '../docs/api/swagger.json')
  ];
  
  let apiPath = '';
  for (const path of possiblePaths) {
    if (existsSync(path)) {
      apiPath = path;
      break;
    }
  }
  
  if (!apiPath) {
    console.log('❌ WeSign API not found. Expected locations:');
    possiblePaths.forEach(path => console.log(`     - ${path}`));
    return 0;
  }
  
  console.log('🔌 Ingesting WeSign API...');
  console.log('   📂 Path:', apiPath);
  
  const content = readFileSync(apiPath, 'utf-8');
  console.log('   📊 API size:', (content.length / 1024).toFixed(2), 'KB');
  
  const db = new Database(join(process.cwd(), 'data/scheduler.db'));
  let chunks = 0;
  
  // Try to parse as JSON first (OpenAPI/Postman)
  try {
    const apiData = JSON.parse(content);
    
    // Handle OpenAPI format
    if (apiData.paths) {
      console.log('   🔍 Detected OpenAPI/Swagger format');
      const stmt = db.prepare(
        'INSERT OR REPLACE INTO knowledge_base (id, content, type, source, chunk_index) VALUES (?, ?, ?, ?, ?)'
      );
      
      for (const [path, methods] of Object.entries(apiData.paths)) {
        for (const [method, details] of Object.entries(methods as any)) {
          const endpoint = `${method.toUpperCase()} ${path}\nSummary: ${(details as any).summary || 'No description'}\nDescription: ${(details as any).description || 'No description'}`;
          
          stmt.run(`api-endpoint-${chunks}`, endpoint, 'api-endpoint', 'wesign-api', chunks);
          chunks++;
        }
      }
      console.log('   ✅ Extracted', chunks, 'API endpoints');
    }
    
    // Handle Postman collection format
    else if (apiData.info && apiData.item) {
      console.log('   🔍 Detected Postman collection format');
      
      const processItems = async (items: any[], path = '') => {
        for (const item of items) {
          if (item.item) {
            // It's a folder
            await processItems(item.item, `${path}${item.name}/`);
          } else if (item.request) {
            // It's a request
            const url = typeof item.request.url === 'string' 
              ? item.request.url 
              : item.request.url?.raw || JSON.stringify(item.request.url);
              
            const endpoint = `${item.request.method || 'GET'} ${path}${item.name}\nURL: ${url}\nDescription: ${item.request.description || item.description || 'No description'}`;
            
            await db.run(
              'INSERT OR REPLACE INTO knowledge_base (id, content, type, source, chunk_index) VALUES (?, ?, ?, ?, ?)',
              [`api-postman-${chunks}`, endpoint, 'api-endpoint', 'wesign-api', chunks]
            );
            chunks++;
          }
        }
      };
      
      await processItems(apiData.item);
      console.log('   ✅ Extracted', chunks, 'Postman requests');
    }
    
    // Fall back to chunking the entire content
    else {
      console.log('   🔍 Unknown API format, chunking entire content');
      const textChunks = await chunkText(content, 500);
      
      for (let i = 0; i < textChunks.length; i++) {
        await db.run(
          'INSERT OR REPLACE INTO knowledge_base (id, content, type, source, chunk_index) VALUES (?, ?, ?, ?, ?)',
          [`api-text-${i}`, textChunks[i], 'api-doc', 'wesign-api', i]
        );
      }
      chunks = textChunks.length;
      console.log('   ✅ Created', chunks, 'API chunks');
    }
    
  } catch (error) {
    console.log('   ⚠️  Not valid JSON, treating as text');
    const textChunks = await chunkText(content, 500);
    
    for (let i = 0; i < textChunks.length; i++) {
      await db.run(
        'INSERT OR REPLACE INTO knowledge_base (id, content, type, source, chunk_index) VALUES (?, ?, ?, ?, ?)',
        [`api-yaml-${i}`, textChunks[i], 'api-doc', 'wesign-api', i]
      );
    }
    chunks = textChunks.length;
    console.log('   ✅ Created', chunks, 'API chunks');
  }
  
  return chunks;
}

async function ingestExistingTests(): Promise<number> {
  console.log('🧪 Ingesting existing tests...');
  
  const db = getDatabase();
  
  try {
    const tests = db.prepare('SELECT * FROM tests LIMIT 311').all();
    console.log('   🔍 Found', tests.length, 'tests in database');

    const stmt = db.prepare('INSERT OR REPLACE INTO knowledge_base (id, content, type, source, chunk_index) VALUES (?, ?, ?, ?, ?)');

    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      const testInfo = `Test: ${test.name || 'Unnamed Test'}
Module: ${test.module || 'Unknown'}
File: ${test.file_path || 'Unknown'}
Status: ${test.status || 'Unknown'}
Markers: ${test.markers || 'None'}
Description: ${test.description || 'No description'}
Created: ${test.created_at || 'Unknown'}`;

      stmt.run(`test-${i}`, testInfo, 'test-case', test.file_path || 'unknown', i);
    }
    
    console.log('   ✅ Ingested', tests.length, 'test cases');
    return tests.length;
  } catch (error) {
    console.log('   ⚠️  Could not access tests table:', (error as Error).message);
    return 0;
  }
}

async function ingestExistingDocuments(): Promise<number> {
  console.log('📚 Ingesting existing documentation...');
  
  const db = getDatabase();
  const docsPath = join(process.cwd(), '../docs');
  let count = 0;
  
  // Get all .md files we found earlier
  const docFiles = [
    'CONTACTS_TESTS_README.md',
    'DASHBOARD_TESTS_README.md', 
    'ENHANCED_TEST_REPORT.md',
    'REPORTS_TRACE_VIEWER.md',
    'SETUP_COMPLETE.md',
    'TEMPLATES_TEST_README.md',
    'TEST_SCHEDULER.md',
    'WeSign_Sending_Documents_Tests.md'
  ];
  
  const docStmt = db.prepare('INSERT OR REPLACE INTO knowledge_base (id, content, type, source, chunk_index) VALUES (?, ?, ?, ?, ?)');

  for (const file of docFiles) {
    const filePath = join(docsPath, file);
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf-8');
      const chunks = await chunkText(content, 800);

      for (let i = 0; i < chunks.length; i++) {
        docStmt.run(`doc-${file}-${i}`, chunks[i], 'documentation', file, i);
        count++;
      }
    }
  }
  
  console.log('   ✅ Ingested', count, 'documentation chunks');
  return count;
}

async function main() {
  console.log('🚀 Starting WeSign Knowledge Ingestion...\n');
  
  // Initialize database
  const db = getDatabase();
  
  // Create knowledge_base table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_base (
      id TEXT PRIMARY KEY,
      content TEXT,
      type TEXT,
      source TEXT,
      chunk_index INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('✅ Knowledge base table ready\n');

  // Clear existing knowledge base
  db.exec('DELETE FROM knowledge_base');
  console.log('🗑️  Cleared existing knowledge base\n');
  
  // Run ingestion
  const prdChunks = await ingestPRD();
  const apiChunks = await ingestAPI();
  const testCount = await ingestExistingTests();
  const docChunks = await ingestExistingDocuments();
  
  const total = prdChunks + apiChunks + testCount + docChunks;
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 WESIGN INGESTION RESULTS');
  console.log('='.repeat(50));
  console.log(`📄 PRD chunks: ${prdChunks}`);
  console.log(`🔌 API endpoints/chunks: ${apiChunks}`);
  console.log(`🧪 Test cases: ${testCount}`);
  console.log(`📚 Documentation chunks: ${docChunks}`);
  console.log('─'.repeat(30));
  console.log(`✅ Total knowledge items: ${total}`);
  
  if (total > 0) {
    console.log('\n🎉 WeSign knowledge base is ready!');
    console.log('💡 The AI Assistant now knows about:');
    if (prdChunks > 0) console.log('   📋 WeSign product requirements and features');
    if (apiChunks > 0) console.log('   🔌 WeSign API endpoints and specifications');
    if (testCount > 0) console.log('   🧪 Existing test cases and patterns');
    if (docChunks > 0) console.log('   📚 Project documentation and guides');
  } else {
    console.log('\n⚠️  No documents were ingested');
    console.log('💡 Add your WeSign PRD and API collection to get started');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { main as ingestWeSignDocs };