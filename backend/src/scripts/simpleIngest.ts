import { config } from 'dotenv';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import Database from 'better-sqlite3';

// Load environment variables
config();

async function main() {
  console.log('🚀 Starting WeSign Knowledge Ingestion...\n');
  
  // Initialize database
  const db = new Database(join(process.cwd(), 'data/scheduler.db'));
  
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
  
  let totalItems = 0;
  const results = {
    prd: 0,
    api: 0,
    tests: 0,
    docs: 0
  };
  
  // 1. Look for PRD
  console.log('📄 Looking for WeSign PRD...');
  const prdPaths = [
    '../docs/prd/Product Requirements Document (PRD) - WeSign.md',
    '../docs/prd/wesign-prd.md',
    '../docs/prd/prd.md'
  ];
  
  for (const prdPath of prdPaths) {
    const fullPath = join(process.cwd(), prdPath);
    if (existsSync(fullPath)) {
      console.log('   ✅ Found PRD:', prdPath);
      const content = readFileSync(fullPath, 'utf-8');
      console.log('   📊 Size:', (content.length / 1024).toFixed(2), 'KB');
      
      // Simple chunking - split by paragraphs
      const chunks = content.split('\n\n').filter(chunk => chunk.trim().length > 50);
      console.log('   ✂️  Created', chunks.length, 'chunks');
      
      const stmt = db.prepare('INSERT INTO knowledge_base (id, content, type, source, chunk_index) VALUES (?, ?, ?, ?, ?)');
      chunks.forEach((chunk, i) => {
        stmt.run(`prd-${i}`, chunk.trim(), 'prd', 'wesign-prd', i);
      });
      
      results.prd = chunks.length;
      totalItems += chunks.length;
      break;
    }
  }
  
  if (results.prd === 0) {
    console.log('   ⚠️  No PRD found');
  }
  
  // 2. Look for API docs
  console.log('\n🔌 Looking for API documentation...');
  const apiPaths = [
    '../docs/api/wesign_API.json',
    '../docs/api/wesign-api.json', 
    '../docs/api/postman-collection.json',
    '../docs/api/api-collection.json'
  ];
  
  for (const apiPath of apiPaths) {
    const fullPath = join(process.cwd(), apiPath);
    if (existsSync(fullPath)) {
      console.log('   ✅ Found API:', apiPath);
      const content = readFileSync(fullPath, 'utf-8');
      console.log('   📊 Size:', (content.length / 1024).toFixed(2), 'KB');
      
      // Simple chunking
      const chunks = content.match(/.{1,800}/g) || [content];
      console.log('   ✂️  Created', chunks.length, 'chunks');
      
      const stmt = db.prepare('INSERT INTO knowledge_base (id, content, type, source, chunk_index) VALUES (?, ?, ?, ?, ?)');
      chunks.forEach((chunk, i) => {
        stmt.run(`api-${i}`, chunk, 'api', 'wesign-api', i);
      });
      
      results.api = chunks.length;
      totalItems += chunks.length;
      break;
    }
  }
  
  if (results.api === 0) {
    console.log('   ⚠️  No API documentation found');
  }
  
  // 3. Ingest existing tests
  console.log('\n🧪 Looking for existing tests...');
  try {
    const testQuery = db.prepare('SELECT COUNT(*) as count FROM tests');
    const testCount = testQuery.get() as { count: number };
    
    if (testCount.count > 0) {
      console.log('   ✅ Found', testCount.count, 'tests in database');
      
      const tests = db.prepare('SELECT * FROM tests LIMIT 100').all();
      const stmt = db.prepare('INSERT INTO knowledge_base (id, content, type, source, chunk_index) VALUES (?, ?, ?, ?, ?)');
      
      tests.forEach((test: any, i) => {
        const testInfo = `Test: ${test.name || 'Unnamed'}
Module: ${test.module || 'Unknown'}
Status: ${test.status || 'Unknown'}
File: ${test.file_path || 'Unknown'}`;
        
        stmt.run(`test-${i}`, testInfo, 'test-case', test.file_path || 'unknown', i);
      });
      
      results.tests = tests.length;
      totalItems += tests.length;
      console.log('   ✅ Ingested', tests.length, 'test cases');
    } else {
      console.log('   ⚠️  No tests found in database');
    }
  } catch (error) {
    console.log('   ⚠️  Could not access tests table');
  }
  
  // 4. Ingest existing docs
  console.log('\n📚 Looking for documentation...');
  const docsPath = join(process.cwd(), '../docs');
  
  if (existsSync(docsPath)) {
    const docFiles = readdirSync(docsPath).filter(file => file.endsWith('.md'));
    console.log('   ✅ Found', docFiles.length, 'documentation files');
    
    const stmt = db.prepare('INSERT INTO knowledge_base (id, content, type, source, chunk_index) VALUES (?, ?, ?, ?, ?)');
    let docChunks = 0;
    
    docFiles.forEach(file => {
      const filePath = join(docsPath, file);
      const content = readFileSync(filePath, 'utf-8');
      
      // Split into sections
      const sections = content.split(/\n#{1,3}\s/).filter(section => section.trim().length > 100);
      sections.forEach((section, i) => {
        stmt.run(`doc-${file}-${i}`, section.trim(), 'documentation', file, i);
        docChunks++;
      });
    });
    
    results.docs = docChunks;
    totalItems += docChunks;
    console.log('   ✅ Ingested', docChunks, 'documentation chunks');
  } else {
    console.log('   ⚠️  No docs directory found');
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 WESIGN INGESTION RESULTS');
  console.log('='.repeat(50));
  console.log(`📄 PRD chunks: ${results.prd}`);
  console.log(`🔌 API chunks: ${results.api}`);
  console.log(`🧪 Test cases: ${results.tests}`);
  console.log(`📚 Documentation chunks: ${results.docs}`);
  console.log('─'.repeat(30));
  console.log(`✅ Total knowledge items: ${totalItems}`);
  
  if (totalItems > 0) {
    console.log('\n🎉 WeSign knowledge base is ready!');
    console.log('💡 The AI Assistant now has knowledge about your project');
  } else {
    console.log('\n⚠️  No documents were ingested');
    console.log('💡 Add your WeSign PRD and API collection to docs/ folders');
  }
  
  db.close();
}

if (require.main === module) {
  main().catch(console.error);
}