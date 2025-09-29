import { KnowledgeService } from './knowledgeService';
import { getDatabase } from '@/database/database';
import { logger } from '@/utils/logger';
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

export class TestIngestionService {
  private knowledgeService: KnowledgeService;
  private db: any;

  constructor() {
    this.knowledgeService = new KnowledgeService();
    this.db = getDatabase();
  }

  async ingestExistingTests() {
    try {
      logger.info('Starting ingestion of existing tests...');
      
      // Get tests from database if available
      let dbTests = [];
      try {
        dbTests = await this.db.all('SELECT * FROM tests LIMIT 50'); // Limit for demo
      } catch (error) {
        logger.warn('Could not fetch tests from database:', error);
      }

      // Also scan for test files in the project
      const testFiles = await this.scanTestFiles();
      
      let totalIngested = 0;

      // Ingest database tests
      for (const test of dbTests) {
        try {
          const testContent = this.formatTestForIngestion(test);
          await this.knowledgeService.ingestDocument(testContent, {
            source: 'database-test',
            testId: test.id,
            module: test.module || 'unknown',
            type: 'test-case',
            framework: 'playwright',
            markers: test.markers || [],
            title: test.name || `Test ${test.id}`
          });
          totalIngested++;
        } catch (error) {
          logger.warn(`Failed to ingest test ${test.id}:`, error);
        }
      }

      // Ingest test files
      for (const filePath of testFiles) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const fileName = path.basename(filePath);
          
          await this.knowledgeService.ingestDocument(content, {
            source: 'test-file',
            filePath: filePath,
            fileName: fileName,
            type: 'test-source-code',
            framework: this.detectFramework(content),
            title: `Test File: ${fileName}`
          });
          totalIngested++;
        } catch (error) {
          logger.warn(`Failed to ingest test file ${filePath}:`, error);
        }
      }

      // Add some general testing knowledge
      await this.ingestGeneralTestingKnowledge();
      totalIngested += 5; // Count the general knowledge docs

      logger.info(`Successfully ingested ${totalIngested} test-related documents`);
      
      return { 
        success: true, 
        ingested: totalIngested,
        sources: {
          databaseTests: dbTests.length,
          testFiles: testFiles.length,
          generalKnowledge: 5
        }
      };

    } catch (error) {
      logger.error('Test ingestion failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        ingested: 0 
      };
    }
  }

  private async scanTestFiles(): Promise<string[]> {
    const testPatterns = [
      'tests/**/*.spec.ts',
      'tests/**/*.test.ts',
      'tests/**/*.spec.js', 
      'tests/**/*.test.js',
      'tests/**/*.py',
      '**/*.spec.ts',
      '**/*.test.ts'
    ];

    let allFiles: string[] = [];

    for (const pattern of testPatterns) {
      try {
        const files = await glob(pattern, { 
          ignore: ['node_modules/**', 'dist/**', 'build/**'],
          absolute: true
        });
        allFiles = [...allFiles, ...files];
      } catch (error) {
        logger.warn(`Failed to scan pattern ${pattern}:`, error);
      }
    }

    // Remove duplicates and limit for demo
    const uniqueFiles = [...new Set(allFiles)].slice(0, 20);
    logger.info(`Found ${uniqueFiles.length} test files to ingest`);
    
    return uniqueFiles;
  }

  private formatTestForIngestion(test: any): string {
    return `
Test Case: ${test.name || 'Unnamed Test'}
ID: ${test.id}
Module: ${test.module || 'Unknown'}
Status: ${test.status || 'Unknown'}
Framework: Playwright

Description: ${test.description || 'No description available'}

${test.code ? `
Test Code:
\`\`\`typescript
${test.code}
\`\`\`
` : ''}

${test.markers && test.markers.length > 0 ? `
Test Markers: ${test.markers.join(', ')}
` : ''}

${test.requirements ? `
Requirements: ${test.requirements}
` : ''}

Created: ${test.created_at || 'Unknown'}
Updated: ${test.updated_at || 'Unknown'}
    `.trim();
  }

  private detectFramework(content: string): string {
    if (content.includes('@playwright/test') || content.includes('playwright')) return 'playwright';
    if (content.includes('pytest') || content.includes('def test_')) return 'pytest';
    if (content.includes('jest') || content.includes('describe(')) return 'jest';
    if (content.includes('selenium')) return 'selenium';
    return 'unknown';
  }

  private async ingestGeneralTestingKnowledge() {
    const knowledgeDocs = [
      {
        title: 'Playwright Testing Best Practices',
        content: `
# Playwright Testing Best Practices

## Page Object Model
- Create page classes to encapsulate page elements and actions
- Use locators instead of selectors where possible
- Keep page objects focused and single-responsibility

## Test Organization
- Group related tests using describe blocks
- Use meaningful test names that describe the expected behavior
- Implement proper test setup and teardown

## Locator Strategies
- Prefer user-facing locators (role, label, text)
- Use data-testid for elements without semantic meaning
- Avoid CSS selectors and XPath when possible

## Async/Await Patterns
- Always await Playwright actions
- Use auto-waiting features instead of manual waits
- Handle promises properly in test code

## Error Handling
- Implement proper error messages in assertions
- Use soft assertions for multiple checks
- Capture screenshots on failures
        `
      },
      {
        title: 'Common Playwright Test Patterns',
        content: `
# Common Playwright Test Patterns

## Login Flow
\`\`\`typescript
test('user login', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[data-testid="email"]', 'user@example.com');
  await page.fill('[data-testid="password"]', 'password');
  await page.click('[data-testid="login-button"]');
  await expect(page).toHaveURL('/dashboard');
});
\`\`\`

## Form Validation
\`\`\`typescript
test('form validation', async ({ page }) => {
  await page.goto('/form');
  await page.click('[data-testid="submit"]');
  await expect(page.locator('.error-message')).toBeVisible();
});
\`\`\`

## API Testing
\`\`\`typescript
test('API response', async ({ request }) => {
  const response = await request.get('/api/users');
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.users).toHaveLength(5);
});
\`\`\`

## File Upload
\`\`\`typescript
test('file upload', async ({ page }) => {
  await page.goto('/upload');
  await page.setInputFiles('[data-testid="file-input"]', 'test-file.pdf');
  await page.click('[data-testid="upload-button"]');
  await expect(page.locator('.success-message')).toBeVisible();
});
\`\`\`
        `
      },
      {
        title: 'Test Data Management',
        content: `
# Test Data Management

## Environment Configuration
- Use .env files for environment-specific data
- Keep sensitive data out of test code
- Use configuration objects for test settings

## Test Fixtures
- Create reusable test data fixtures
- Use factory functions for dynamic data
- Implement data cleanup after tests

## Database Setup
- Use transactions for test isolation
- Implement proper test database seeding
- Clean up test data to avoid conflicts

## Mock Data
- Create realistic mock data for API tests
- Use faker libraries for generating test data
- Implement mock servers for external dependencies
        `
      },
      {
        title: 'Accessibility Testing',
        content: `
# Accessibility Testing with Playwright

## Basic Accessibility Checks
\`\`\`typescript
test('accessibility check', async ({ page }) => {
  await page.goto('/page');
  const results = await page.accessibility.snapshot();
  // Analyze accessibility tree
});
\`\`\`

## Keyboard Navigation
\`\`\`typescript
test('keyboard navigation', async ({ page }) => {
  await page.goto('/form');
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-testid="first-input"]')).toBeFocused();
});
\`\`\`

## Screen Reader Testing
- Test with aria-labels and roles
- Verify heading hierarchy
- Check focus management
- Test skip links and landmarks

## Color Contrast
- Verify sufficient color contrast ratios
- Test with high contrast mode
- Ensure information isn't conveyed by color alone
        `
      },
      {
        title: 'Performance Testing',
        content: `
# Performance Testing

## Load Time Measurement
\`\`\`typescript
test('page load performance', async ({ page }) => {
  const startTime = Date.now();
  await page.goto('/page');
  await page.waitForLoadState('networkidle');
  const loadTime = Date.now() - startTime;
  expect(loadTime).toBeLessThan(3000);
});
\`\`\`

## Network Monitoring
\`\`\`typescript
test('API response time', async ({ page }) => {
  const [response] = await Promise.all([
    page.waitForResponse('/api/data'),
    page.click('[data-testid="load-data"]')
  ]);
  expect(response.status()).toBe(200);
});
\`\`\`

## Resource Usage
- Monitor memory usage during tests
- Check for memory leaks
- Measure CPU usage for heavy operations
- Test with throttled connections
        `
      }
    ];

    for (const doc of knowledgeDocs) {
      await this.knowledgeService.ingestDocument(doc.content, {
        source: 'general-knowledge',
        type: 'documentation',
        category: 'testing-best-practices',
        title: doc.title
      });
    }
  }

  async getIngestionStatus() {
    try {
      const response = await fetch('http://localhost:8081/api/ai/stats');
      const data = await response.json();
      return data;
    } catch (error) {
      logger.warn('Could not get ingestion status:', error);
      return null;
    }
  }
}