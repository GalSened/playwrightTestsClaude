const Database = require('better-sqlite3');
const path = require('path');

// Connect to the database
const dbPath = path.join(__dirname, 'backend', 'data', 'scheduler.db');
const db = new Database(dbPath);

console.log('Fixing test is_active status...');

// Check current status
const countBefore = db.prepare('SELECT COUNT(*) as count FROM tests WHERE is_active = 1').get();
console.log('Tests with is_active=1 before fix:', countBefore.count);

const totalTests = db.prepare('SELECT COUNT(*) as count FROM tests').get();
console.log('Total tests in database:', totalTests.count);

// Update all tests to have is_active = 1
const result = db.prepare('UPDATE tests SET is_active = 1').run();
console.log('Updated rows:', result.changes);

// Check after update
const countAfter = db.prepare('SELECT COUNT(*) as count FROM tests WHERE is_active = 1').get();
console.log('Tests with is_active=1 after fix:', countAfter.count);

db.close();
console.log('Database fix completed!');