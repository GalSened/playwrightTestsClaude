const Database = require('better-sqlite3');

const db = new Database('data/tests.db');
const rows = db.prepare('PRAGMA table_info(tests)').all();
console.log('Tests table columns:');
rows.forEach(r => console.log(`  ${r.name}: ${r.type}`));

const sample = db.prepare('SELECT * FROM tests LIMIT 1').get();
console.log('\nSample test record:');
console.log(sample);

db.close();