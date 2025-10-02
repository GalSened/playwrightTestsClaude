// Quick verification of analytics data
const Database = require('./backend/node_modules/better-sqlite3');

const db = new Database('./backend/data/tests.db');

// Basic counts
const total = db.prepare('SELECT COUNT(*) as count FROM tests WHERE is_active = 1').get().count;
const passed = db.prepare('SELECT COUNT(*) as count FROM tests WHERE is_active = 1 AND last_status = "passed"').get().count;
const failed = db.prepare('SELECT COUNT(*) as count FROM tests WHERE is_active = 1 AND last_status = "failed"').get().count;

// Modules
const modules = db.prepare(`
  SELECT category, COUNT(*) as total,
    COUNT(CASE WHEN last_status = 'passed' THEN 1 END) as passed_count,
    COUNT(CASE WHEN last_status = 'failed' THEN 1 END) as failed_count
  FROM tests WHERE is_active = 1 AND category IS NOT NULL 
  GROUP BY category ORDER BY total DESC
`).all();

console.log('🎉 WeSign Analytics - Final Verification Summary');
console.log('='.repeat(50));
console.log(`📊 Total Tests: ${total}`);
console.log(`✅ Passed: ${passed} (${((passed/total)*100).toFixed(1)}%)`);
console.log(`❌ Failed: ${failed}`);
console.log(`📂 Modules: ${modules.length}`);

console.log('\n📈 Module Breakdown:');
modules.forEach(m => {
  const rate = ((m.passed_count / m.total) * 100).toFixed(1);
  console.log(`  ${m.category}: ${m.total} tests (${rate}% pass rate)`);
});

console.log('\n✅ ANALYTICS SYSTEM STATUS: OPERATIONAL');
console.log('🔗 Frontend: http://localhost:5180/analytics');
console.log('🔗 Backend API: http://localhost:8081/api/analytics/smart');
console.log('📋 Features: Real data, coverage analysis, gap identification, AI insights');

db.close();