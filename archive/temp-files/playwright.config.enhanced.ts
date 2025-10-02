import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'path';

/**
 * Enhanced WeSign-Optimized Playwright Configuration
 * 
 * Key Features:
 * - Bilingual testing support (Hebrew/English)
 * - WeSign-specific timeouts and settings
 * - Self-healing integration hooks
 * - Comprehensive reporting pipeline
 * - Production-ready CI/CD configuration
 */

// Environment-based configuration
const isCI = !!process.env.CI;
const baseURL = process.env.WESIGN_BASE_URL || 'https://devtest.comda.co.il/';
const headless = process.env.HEADLESS !== 'false';

export default defineConfig({
  testDir: './tests',
  
  // WeSign-optimized concurrency settings
  fullyParallel: false, // Sequential for document workflows
  forbidOnly: isCI,
  
  // Enhanced retry strategy for stability
  retries: isCI ? 3 : 1,
  workers: isCI ? 2 : 3, // Conservative for WeSign complexity
  
  // Extended timeouts for WeSign operations
  timeout: 90000, // 90s for document processing
  expect: { timeout: 15000 }, // 15s for assertions
  
  // Comprehensive reporter configuration
  reporter: [
    // HTML report with WeSign branding
    ['html', { 
      outputFolder: 'reports/html',
      open: 'never',
      host: '0.0.0.0',
      port: 9323
    }],
    
    // JSON for programmatic analysis
    ['json', { 
      outputFile: 'reports/results.json' 
    }],
    
    // JUnit for CI/CD integration
    ['junit', { 
      outputFile: 'reports/junit.xml' 
    }],
    
    // Allure for advanced reporting
    ['allure-playwright', {
      outputFolder: 'reports/allure-results',
      detail: true,
      suiteTitle: 'WeSign E2E Test Suite',
      categories: [
        {
          name: 'Authentication Failures',
          matchedStatuses: ['failed'],
          messageRegex: '.*login.*|.*authentication.*|.*התחברות.*'
        },
        {
          name: 'Document Processing Issues',
          matchedStatuses: ['failed', 'broken'],
          messageRegex: '.*document.*|.*upload.*|.*מסמך.*|.*העלאה.*'
        },
        {
          name: 'Bilingual Interface Issues',
          matchedStatuses: ['failed'],
          messageRegex: '.*hebrew.*|.*english.*|.*locale.*|.*עברית.*'
        }
      ]
    }],
    
    // List for console output
    ['list', { printSteps: true }]
  ],

  // Global test configuration
  use: {
    // WeSign application URL
    baseURL,
    
    // Enhanced tracing for debugging
    trace: isCI ? 'retain-on-failure' : 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // WeSign-specific settings
    locale: 'he-IL', // Hebrew primary locale
    timezoneId: 'Asia/Jerusalem',
    colorScheme: 'light',
    
    // Browser context options
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: false,
    bypassCSP: false,
    
    // Enhanced timeouts for WeSign operations
    navigationTimeout: 45000, // Document loading
    actionTimeout: 20000, // UI interactions
    
    // Extra HTTP headers for WeSign
    extraHTTPHeaders: {
      'Accept-Language': 'he,en-US;q=0.9,en;q=0.8',
      'Cache-Control': 'no-cache'
    }
  },

  // Multi-project configuration for comprehensive testing
  projects: [
    // Hebrew interface testing
    {
      name: 'wesign-hebrew',
      testMatch: /.*\.(spec|test)\.(js|ts)$/,
      use: {
        ...devices['Desktop Chrome'],
        locale: 'he-IL',
        extraHTTPHeaders: {
          'Accept-Language': 'he,en-US;q=0.9'
        },
        contextOptions: {
          // Hebrew-specific settings
          permissions: ['clipboard-read', 'clipboard-write'],
          geolocation: { latitude: 31.7683, longitude: 35.2137 }, // Jerusalem
        }
      },
      metadata: {
        language: 'hebrew',
        direction: 'rtl'
      }
    },

    // English interface testing
    {
      name: 'wesign-english',
      testMatch: /.*\.(spec|test)\.(js|ts)$/,
      use: {
        ...devices['Desktop Chrome'],
        locale: 'en-US',
        extraHTTPHeaders: {
          'Accept-Language': 'en-US,en;q=0.9'
        }
      },
      metadata: {
        language: 'english',
        direction: 'ltr'
      }
    },

    // Firefox for cross-browser validation
    {
      name: 'wesign-firefox',
      testMatch: /.*cross-browser.*\.(spec|test)\.(js|ts)$/,
      use: {
        ...devices['Desktop Firefox'],
        locale: 'he-IL'
      }
    },

    // Mobile testing for responsive design
    {
      name: 'wesign-mobile',
      testMatch: /.*mobile.*\.(spec|test)\.(js|ts)$/,
      use: {
        ...devices['iPhone 13'],
        locale: 'he-IL'
      }
    },

    // API testing for backend validation
    {
      name: 'wesign-api',
      testMatch: /.*api.*\.(spec|test)\.(js|ts)$/,
      use: {
        baseURL: process.env.WESIGN_API_URL || 'https://devtest.comda.co.il/api/'
      }
    }
  ],

  // Global setup and teardown
  globalSetup: resolve(__dirname, 'src/setup/global-setup.ts'),
  globalTeardown: resolve(__dirname, 'src/setup/global-teardown.ts'),

  // Test output directories
  outputDir: 'test-results/',
  
  // Metadata for test management
  metadata: {
    application: 'WeSign',
    version: process.env.WESIGN_VERSION || '1.0.0',
    environment: process.env.TEST_ENV || 'development',
    browser: 'chromium',
    platform: process.platform,
    timestamp: new Date().toISOString()
  },

  // Development server configuration (optional)
  webServer: process.env.START_LOCAL_SERVER ? {
    command: 'cd backend && npm run dev',
    port: 8081,
    reuseExistingServer: !isCI,
    timeout: 60 * 1000,
    env: {
      NODE_ENV: 'test'
    }
  } : undefined
});

// Export configuration for external usage
export const wesignConfig = {
  baseURL,
  isCI,
  headless,
  supportedLanguages: ['he-IL', 'en-US'],
  supportedBrowsers: ['chromium', 'firefox', 'webkit'],
  testCategories: [
    'authentication',
    'document-upload', 
    'document-signing',
    'bilingual',
    'cross-browser',
    'mobile',
    'api'
  ]
};