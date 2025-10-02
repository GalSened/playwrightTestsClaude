// Simple test for analytics service
const Database = require('better-sqlite3');
const { readFileSync } = require('fs');
const { join } = require('path');

class TestAnalyticsService {
  constructor() {
    // Initialize test discovery database
    this.testDb = new Database('backend/data/tests.db');
    this.testDb.pragma('journal_mode = WAL');
    this.testDb.pragma('foreign_keys = ON');
    this.initializeTestDatabase();
  }
  
  initializeTestDatabase() {
    try {
      const schemaPath = join(__dirname, 'backend/src/database/test-discovery-schema.sql');
      const schema = readFileSync(schemaPath, 'utf8');
      this.testDb.exec(schema);
      
      // Populate with WeSign test data if empty
      this.populateTestData();
      
      console.log('Test database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize test database schema', error);
    }
  }
  
  populateTestData() {
    // Check if we have test data
    const countStmt = this.testDb.prepare('SELECT COUNT(*) as count FROM tests');
    const result = countStmt.get();
    
    if (result.count === 0) {
      console.log('Populating test database with WeSign test data...');
      this.insertWeSignTestData();
    }
  }
  
  insertWeSignTestData() {
    const transaction = this.testDb.transaction(() => {
      // WeSign Authentication tests
      const authTests = [
        { name: 'test_login_with_valid_credentials', category: 'auth', status: 'passed', duration: 2500 },
        { name: 'test_login_with_invalid_credentials', category: 'auth', status: 'passed', duration: 1800 },
        { name: 'test_logout_functionality', category: 'auth', status: 'passed', duration: 1200 },
        { name: 'test_password_reset', category: 'auth', status: 'failed', duration: 3200 },
        { name: 'test_mfa_authentication', category: 'auth', status: 'passed', duration: 4100 },
        { name: 'test_session_timeout', category: 'auth', status: 'passed', duration: 5500 },
        { name: 'test_hebrew_login_page', category: 'auth', status: 'passed', duration: 2800 },
        { name: 'test_english_login_page', category: 'auth', status: 'passed', duration: 2600 }
      ];
      
      // Document workflow tests
      const documentTests = [
        { name: 'test_document_upload', category: 'documents', status: 'passed', duration: 8500 },
        { name: 'test_document_validation', category: 'documents', status: 'passed', duration: 3200 },
        { name: 'test_pdf_merge', category: 'documents', status: 'failed', duration: 12000 },
        { name: 'test_electronic_signature', category: 'documents', status: 'passed', duration: 6700 },
        { name: 'test_multi_signer_workflow', category: 'documents', status: 'passed', duration: 15400 },
        { name: 'test_document_download', category: 'documents', status: 'passed', duration: 4300 },
        { name: 'test_signature_placement', category: 'documents', status: 'passed', duration: 7800 },
        { name: 'test_document_status_tracking', category: 'documents', status: 'passed', duration: 3600 },
        { name: 'test_hebrew_document_processing', category: 'documents', status: 'passed', duration: 9200 },
        { name: 'test_template_creation', category: 'documents', status: 'failed', duration: 5800 }
      ];
      
      // Dashboard tests
      const dashboardTests = [
        { name: 'test_dashboard_loading', category: 'dashboard', status: 'passed', duration: 3200 },
        { name: 'test_recent_documents', category: 'dashboard', status: 'passed', duration: 4100 },
        { name: 'test_statistics_display', category: 'dashboard', status: 'passed', duration: 2800 },
        { name: 'test_hebrew_dashboard', category: 'dashboard', status: 'passed', duration: 3400 },
        { name: 'test_responsive_layout', category: 'dashboard', status: 'failed', duration: 5200 },
        { name: 'test_notification_panel', category: 'dashboard', status: 'passed', duration: 2600 }
      ];
      
      // Contact management tests
      const contactTests = [
        { name: 'test_contact_creation', category: 'contacts', status: 'passed', duration: 2400 },
        { name: 'test_contact_import_csv', category: 'contacts', status: 'passed', duration: 8900 },
        { name: 'test_contact_export', category: 'contacts', status: 'passed', duration: 6700 },
        { name: 'test_hebrew_contact_names', category: 'contacts', status: 'passed', duration: 3100 },
        { name: 'test_contact_validation', category: 'contacts', status: 'failed', duration: 2800 }
      ];
      
      // Admin tests
      const adminTests = [
        { name: 'test_user_management', category: 'admin', status: 'passed', duration: 4500 },
        { name: 'test_role_permissions', category: 'admin', status: 'passed', duration: 6200 },
        { name: 'test_audit_trail', category: 'admin', status: 'passed', duration: 7800 },
        { name: 'test_system_settings', category: 'admin', status: 'failed', duration: 3900 },
        { name: 'test_backup_functionality', category: 'admin', status: 'passed', duration: 12000 }
      ];
      
      // Templates tests
      const templateTests = [
        { name: 'test_template_library', category: 'templates', status: 'passed', duration: 3800 },
        { name: 'test_custom_template_creation', category: 'templates', status: 'passed', duration: 9500 },
        { name: 'test_template_sharing', category: 'templates', status: 'failed', duration: 5600 },
        { name: 'test_hebrew_templates', category: 'templates', status: 'passed', duration: 4200 }
      ];
      
      // Integration tests
      const integrationTests = [
        { name: 'test_smart_card_integration', category: 'integrations', status: 'passed', duration: 8700 },
        { name: 'test_payment_gateway', category: 'integrations', status: 'passed', duration: 7400 },
        { name: 'test_api_authentication', category: 'integrations', status: 'passed', duration: 3200 },
        { name: 'test_webhook_notifications', category: 'integrations', status: 'failed', duration: 5900 }
      ];
      
      const allTests = [
        ...authTests, ...documentTests, ...dashboardTests, 
        ...contactTests, ...adminTests, ...templateTests, ...integrationTests
      ];
      
      const insertTest = this.testDb.prepare(`
        INSERT INTO tests (
          id, file_path, test_name, function_name, category, 
          last_status, last_duration, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `);
      
      allTests.forEach((test, index) => {
        const id = `test_${index + 1}_${Math.random().toString(36).substr(2, 9)}`;
        const filePath = `tests/${test.category}/test_${test.name}.py`;
        insertTest.run(id, filePath, test.name, test.name, test.category, test.status, test.duration, true);
      });
      
      console.log(`Inserted ${allTests.length} WeSign tests into database`);
    });
    
    transaction();
  }

  async getTestStats() {
    console.log('Fetching test statistics...');
    
    // Total test count
    const totalTestsStmt = this.testDb.prepare('SELECT COUNT(*) as count FROM tests WHERE is_active = TRUE');
    const totalTestsResult = totalTestsStmt.get();
    const totalTests = totalTestsResult?.count || 0;
    console.log(`Total tests: ${totalTests}`);
    
    // Module breakdown
    const moduleStmt = this.testDb.prepare(`
      SELECT 
        category as module,
        COUNT(*) as total,
        SUM(CASE WHEN last_status = 'passed' THEN 1 ELSE 0 END) as passed,
        SUM(CASE WHEN last_status = 'failed' THEN 1 ELSE 0 END) as failed,
        AVG(CASE WHEN last_duration > 0 THEN last_duration ELSE 60000 END) as avg_duration
      FROM tests
      WHERE is_active = TRUE AND category IS NOT NULL AND category != ''
      GROUP BY category
      ORDER BY total DESC
    `);
    const testsByModule = moduleStmt.all();
    
    console.log('Module breakdown:');
    testsByModule.forEach(m => {
      console.log(`  ${m.module}: ${m.total} tests (${m.passed} passed, ${m.failed} failed)`);
    });
    
    // Failed tests
    const flakyStmt = this.testDb.prepare(`
      SELECT test_name as name, category as module, last_status as status
      FROM tests
      WHERE is_active = TRUE AND last_status = 'failed'
      ORDER BY updated_at DESC
    `);
    const flakyTests = flakyStmt.all();
    console.log(`Failed tests: ${flakyTests.length}`);
    flakyTests.forEach(test => {
      console.log(`  ${test.name} (${test.module}): ${test.status}`);
    });
    
    return {
      totalTests,
      modules: testsByModule.length,
      moduleBreakdown: testsByModule,
      failedTests: flakyTests.length,
      failedTestDetails: flakyTests
    };
  }
}

// Run the test
console.log('=== WeSign Analytics Test ===');
const service = new TestAnalyticsService();
service.getTestStats().then(stats => {
  console.log('\n=== Analytics Summary ===');
  console.log(`Total Tests: ${stats.totalTests}`);
  console.log(`Test Modules: ${stats.modules}`);
  console.log(`Failed Tests: ${stats.failedTests}`);
  
  const overallPassRate = stats.moduleBreakdown.reduce((acc, m) => acc + m.passed, 0) / stats.totalTests * 100;
  console.log(`Overall Pass Rate: ${overallPassRate.toFixed(1)}%`);
  
  console.log('\nAnalytics database is ready for the frontend!');
  process.exit(0);
}).catch(error => {
  console.error('Error:', error);
  process.exit(1);
});