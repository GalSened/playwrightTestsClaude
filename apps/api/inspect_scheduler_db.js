const Database = require('better-sqlite3');

const db = new Database('data/scheduler.db');
console.log('Tables in scheduler.db:');
const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all();
console.log(tables);

for (const table of tables) {
  if (table.name.includes('test')) {
    const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
    console.log(`${table.name}: ${count.count} rows`);
  }
}

db.close();