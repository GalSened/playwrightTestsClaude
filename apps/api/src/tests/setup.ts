// Jest setup file
import { mkdirSync } from 'fs';
import { join } from 'path';

// Create test directories
beforeAll(() => {
  const testDataDir = join(__dirname, '../../../test-data');
  const testLogsDir = join(__dirname, '../../../test-logs');
  
  mkdirSync(testDataDir, { recursive: true });
  mkdirSync(testLogsDir, { recursive: true });
});

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise in tests
process.env.DATABASE_PATH = ':memory:'; // Use in-memory database for most tests