const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'scheduler.db');
const db = new Database(dbPath);

console.log('=== Checking tests table schema in scheduler.db ===');

try {
  // Check if tests table exists
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tests'").all();
  console.log('Tests table exists:', tables.length > 0);

  if (tables.length > 0) {
    // Get table schema
    const schema = db.prepare("PRAGMA table_info(tests)").all();
    console.log('\nTests table schema:');
    schema.forEach(col => {
      console.log(`  ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
    });

    // Count existing tests
    const count = db.prepare("SELECT COUNT(*) as count FROM tests").get();
    console.log(`\nCurrent test count: ${count.count}`);

    // Check for active tests
    const activeCount = db.prepare("SELECT COUNT(*) as count FROM tests WHERE is_active = 1").get();
    console.log(`Active test count: ${activeCount.count}`);

  } else {
    console.log('Tests table does not exist in scheduler.db');
  }

  // Check if test_tags table exists
  const tagTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='test_tags'").all();
  console.log('Test_tags table exists:', tagTables.length > 0);

} catch (error) {
  console.error('Error checking schema:', error);
} finally {
  db.close();
}