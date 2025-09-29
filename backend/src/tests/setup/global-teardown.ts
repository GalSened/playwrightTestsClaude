// Global test teardown for Jest
import { Pool } from 'pg';

export default async function globalTeardown() {
  console.log('Cleaning up global test environment...');
  
  // Skip if no database was created
  if (!global.__TEST_DATABASE_NAME__) {
    console.log('No test database to clean up');
    return;
  }
  
  try {
    // Clean up the global test database
    const adminPool = new Pool({
      host: process.env.TEST_DB_HOST || 'localhost',
      port: parseInt(process.env.TEST_DB_PORT || '5432'),
      user: process.env.TEST_DB_USER || 'postgres',
      password: process.env.TEST_DB_PASSWORD || 'postgres',
      database: 'postgres',
    });

    const adminClient = await adminPool.connect();
    
    try {
      // Terminate all connections to the test database
      await adminClient.query(`
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = $1 AND pid <> pg_backend_pid()
      `, [global.__TEST_DATABASE_NAME__]);
      
      // Drop the test database
      await adminClient.query(`DROP DATABASE IF EXISTS "${global.__TEST_DATABASE_NAME__}"`);
      console.log(`Cleaned up test database '${global.__TEST_DATABASE_NAME__}'`);
    } finally {
      adminClient.release();
      await adminPool.end();
    }
  } catch (error) {
    console.error('Failed to cleanup global test database:', error);
    // Don't throw - we don't want to fail the test suite because of cleanup issues
  }
  
  // Clean up global variables
  delete global.__TEST_DATABASE_NAME__;
}