import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * QA Intelligence Platform - Playwright Test Configuration
 *
 * This configuration runs Playwright E2E tests only (excludes Jest unit/integration tests)
 */
export default defineConfig({
  // Test discovery - Only include .spec.ts files in tests/ directory
  testDir: './tests',
  testMatch: '**/*.spec.ts',

  // Exclude Jest test files (*.test.ts), nested e2e configs, and node_modules
  testIgnore: [
    '**/*.test.ts',           // Jest tests
    '**/*.py',                 // Python tests (separate test runner)
    '**/node_modules/**',      // Dependencies
    '**/apps/api/src/tests/**', // API Jest tests
    '**/apps/api/tests/**',     // API service tests
    '**/archive/**',            // Archived tests
    '**/tests/e2e/**',          // Nested e2e directory (has own config)
    '**/tests/unit/**',         // Unit tests (Jest)
    '**/tests/integration/**',  // Integration tests (separate)
  ],

  // Test execution settings
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : undefined,

  // Test timeout configuration
  timeout: 90 * 1000,  // 90 seconds per test
  expect: {
    timeout: 10 * 1000, // 10 seconds for assertions
  },

  // Reporting configuration
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],

  // Global test settings
  use: {
    // Base URL for tests
    baseURL: process.env.QA_INTELLIGENCE_URL || 'http://localhost:3001',

    // Tracing and debugging
    trace: process.env.CI ? 'retain-on-failure' : 'on-first-retry',
    screenshot: 'only-on-failure',
    video: process.env.VIDEO_RECORDING === 'true' ? 'retain-on-failure' : 'off',

    // Browser settings
    headless: process.env.HEADLESS !== 'false',
    viewport: { width: 1920, height: 1080 },

    // Network and timing
    actionTimeout: 30 * 1000,
    navigationTimeout: 60 * 1000,
  },

  // Test projects for different browsers
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--start-maximized'],
        },
      },
    },

    // Uncomment to enable other browsers
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // Output directories
  outputDir: 'test-results',

  // Global setup/teardown
  // globalSetup: require.resolve('./tests/global-setup.ts'),
  // globalTeardown: require.resolve('./tests/global-teardown.ts'),
});
