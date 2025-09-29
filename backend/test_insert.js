const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'scheduler.db');
const db = new Database(dbPath);

console.log('=== Testing test insert ===');

try {
  // Try the exact INSERT that test discovery service uses
  const insertTestStmt = db.prepare(`
    INSERT INTO tests
    (id, file_path, test_name, class_name, function_name, description, category, line_number,
     test_type, steps, complexity, estimated_duration, tags, is_active, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const testData = [
    'test_123',                          // id
    '/test/path.py',                     // file_path
    'test_sample',                       // test_name
    'TestClass',                         // class_name
    'test_sample',                       // function_name
    'Test description',                  // description
    'auth',                              // category
    10,                                  // line_number
    'python',                           // test_type
    'Step 1, Step 2',                   // steps
    'medium',                           // complexity
    60,                                 // estimated_duration
    'tag1,tag2',                        // tags
    1,                                  // is_active
    new Date().toISOString()            // updated_at
  ];

  console.log('Attempting insert with data:', testData);

  const result = insertTestStmt.run(...testData);
  console.log('Insert successful:', result);

} catch (error) {
  console.error('Insert failed with error:', error.message);
  console.error('Full error:', error);

  // Check schema to see what might be missing
  console.log('\n=== Checking for NOT NULL constraints ===');
  const schema = db.prepare("PRAGMA table_info(tests)").all();
  const notNullColumns = schema.filter(col => col.notnull && col.dflt_value === null);
  console.log('NOT NULL columns without defaults:');
  notNullColumns.forEach(col => {
    console.log(`  ${col.name}: ${col.type}`);
  });

} finally {
  db.close();
}