import Database from 'better-sqlite3';
import { join } from 'path';

const db = new Database(join(process.cwd(), 'data/scheduler.db'));

console.log('📊 Knowledge Base Verification\n');

// Count by type
const typeResults = db.prepare('SELECT type, COUNT(*) as count FROM knowledge_base GROUP BY type').all();
console.log('Knowledge Base Contents:');
typeResults.forEach((row: any) => {
  console.log(`  ${row.type}: ${row.count} items`);
});

// Sample PRD content
console.log('\n📄 PRD Sample:');
const prdSample = db.prepare("SELECT content FROM knowledge_base WHERE type = 'prd' LIMIT 1").get() as any;
if (prdSample) {
  console.log('   ' + prdSample.content.substring(0, 200) + '...');
} else {
  console.log('   No PRD content found');
}

// Sample API content
console.log('\n🔌 API Sample:');
const apiSample = db.prepare("SELECT content FROM knowledge_base WHERE type = 'api' LIMIT 1").get() as any;
if (apiSample) {
  console.log('   ' + apiSample.content.substring(0, 200) + '...');
} else {
  console.log('   No API content found');
}

// Sample test content
console.log('\n🧪 Test Sample:');
const testSample = db.prepare("SELECT content FROM knowledge_base WHERE type = 'test-case' LIMIT 1").get() as any;
if (testSample) {
  console.log('   ' + testSample.content.substring(0, 200) + '...');
} else {
  console.log('   No test content found');
}

// Total items
const total = db.prepare('SELECT COUNT(*) as count FROM knowledge_base').get() as any;
console.log(`\n✅ Total Items in Knowledge Base: ${total.count}`);

db.close();