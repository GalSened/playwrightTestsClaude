#!/usr/bin/env node
/**
 * Clear all test data from the database and rescan only current test files
 */

const Database = require('better-sqlite3');
const path = require('path');

async function clearTestDatabase() {
  try {
    console.log('Opening database...');
    const dbPath = path.join(__dirname, 'backend', 'data', 'tests.db');
    const db = new Database(dbPath);
    
    console.log('Clearing test tables...');
    
    // Clear all test data
    const clearTestsResult = db.prepare('DELETE FROM tests').run();
    const clearTagsResult = db.prepare('DELETE FROM test_tags').run(); 
    
    console.log(`Deleted ${clearTestsResult.changes} tests`);
    console.log(`Deleted ${clearTagsResult.changes} test tags`);
    
    db.close();
    
    console.log('Database cleared successfully!');
    return true;
    
  } catch (error) {
    console.error('Error clearing database:', error);
    return false;
  }
}

clearTestDatabase().then(success => {
  if (success) {
    console.log('✅ Test database cleared successfully');
  } else {
    console.log('❌ Failed to clear test database');
  }
});