const Database = require('better-sqlite3');

const db = new Database('data/tests.db');
console.log('Tables:');
const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all();
console.log(tables);

for (const table of tables) {
  const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
  console.log(`${table.name}: ${count.count} rows`);
}

db.close();