// Global test setup for Jest
import { TestDatabase } from './test-database';
import { TestHelpers } from '../helpers/test-helpers';

let globalTestDb: TestDatabase;

export default async function globalSetup() {
  console.log('Setting up global test environment...');
  
  // Set test environment variables
  TestHelpers.setTestEnvironment();
  
  // Skip database setup if running in CI without database
  if (process.env.CI && !process.env.TEST_DATABASE_URL) {
    console.warn('Skipping database setup in CI environment');
    return;
  }
  
  try {
    // Initialize global test database for shared use
    globalTestDb = new TestDatabase({
      host: process.env.TEST_DB_HOST,
      port: process.env.TEST_DB_PORT ? parseInt(process.env.TEST_DB_PORT) : undefined,
      username: process.env.TEST_DB_USER,
      password: process.env.TEST_DB_PASSWORD,
    });
    
    await globalTestDb.setup();
    
    // Store database name in global for cleanup
    global.__TEST_DATABASE_NAME__ = globalTestDb.getDatabaseName();
    
    console.log(`Global test database '${globalTestDb.getDatabaseName()}' ready`);
  } catch (error) {
    console.error('Failed to setup global test database:', error);
    throw error;
  }
}

export { globalTestDb };