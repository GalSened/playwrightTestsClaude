const Database = require('better-sqlite3');

const db = new Database('data/scheduler.db');

console.log('Before clearing:');
console.log('Tests:', db.prepare('SELECT COUNT(*) as count FROM tests').get());
console.log('Test tags:', db.prepare('SELECT COUNT(*) as count FROM test_tags').get());

// Clear test data
const clearTests = db.prepare('DELETE FROM tests').run();
const clearTags = db.prepare('DELETE FROM test_tags').run();

console.log(`\nCleared ${clearTests.changes} tests`);
console.log(`Cleared ${clearTags.changes} test tags`);

console.log('\nAfter clearing:');
console.log('Tests:', db.prepare('SELECT COUNT(*) as count FROM tests').get());
console.log('Test tags:', db.prepare('SELECT COUNT(*) as count FROM test_tags').get());

db.close();
console.log('✅ Test data cleared from scheduler database');