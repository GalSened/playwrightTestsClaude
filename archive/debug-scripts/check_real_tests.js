const Database = require('./backend/node_modules/better-sqlite3');

console.log('=== CHECKING REAL TEST DATA ===');

// Check scheduler.db (the real database)
const schedulerDb = new Database('./backend/data/scheduler.db');

const testCount = schedulerDb.prepare('SELECT COUNT(*) as count FROM tests').get();
console.log(`Real tests count: ${testCount.count}`);

const sampleTests = schedulerDb.prepare('SELECT test_name, file_path, category FROM tests LIMIT 5').all();
console.log('\nSample tests:');
sampleTests.forEach(t => {
  console.log(`  ${t.test_name} (${t.category || 'no category'})`);
});

const categories = schedulerDb.prepare('SELECT DISTINCT category, COUNT(*) as count FROM tests WHERE category IS NOT NULL GROUP BY category').all();
console.log('\nTest categories:');
categories.forEach(c => {
  console.log(`  ${c.category}: ${c.count} tests`);
});

// Check if knowledge base exists
const knowledgeCount = schedulerDb.prepare('SELECT COUNT(*) as count FROM knowledge_base').get();
console.log(`\nKnowledge base chunks: ${knowledgeCount.count}`);

schedulerDb.close();
console.log('\n=== CHECK COMPLETE ===');