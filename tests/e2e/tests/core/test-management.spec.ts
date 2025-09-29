import { test, expect, Page } from '@playwright/test';

test.describe('Core Test Management - 311 WeSign Tests', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    
    // Login as admin
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    const emailInput = page.locator('input[type="email"], input[placeholder*="Email"], input[name*="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[placeholder*="Password"], input[name*="password"]').first();
    const signInButton = page.locator('button:has-text("Sign In"), button[type="submit"]').first();
    
    await emailInput.fill('admin@demo.com');
    await passwordInput.fill('demo123');
    await signInButton.click();
    await page.waitForTimeout(3000);
    
    // Navigate to Test Bank
    await page.goto('/test-bank');
    await page.waitForLoadState('networkidle');
  });

  test('Verify 311 WeSign tests are displayed', async () => {
    // Wait for test discovery to complete
    await page.waitForSelector('[data-testid="tests-table"]', { timeout: 30000 });
    
    // Check total test count in UI
    const testCountElement = await page.locator('[data-testid="selected-tests-count"]');
    await expect(testCountElement).toBeVisible();
    
    // Verify table loads with tests
    const testRows = page.locator('[data-testid="test-checkbox"]');
    const testCount = await testRows.count();
    
    // Should have 311+ tests from WeSign discovery
    expect(testCount).toBeGreaterThanOrEqual(311);
    
    // Verify page title indicates correct count
    const pageTitle = await page.locator('[data-testid="page-title"]');
    await expect(pageTitle).toContainText('Test Bank');
  });

  test('Test 7 core modules are present', async () => {
    const expectedModules = ['admin', 'auth', 'contacts', 'dashboard', 'documents', 'integrations', 'templates'];
    
    // Check module filter dropdown
    const moduleFilter = page.locator('[data-testid="filter-module"]');
    await moduleFilter.click();
    
    for (const module of expectedModules) {
      const moduleOption = page.locator(`option[value="${module}"]`);
      await expect(moduleOption).toBeVisible();
    }
  });

  test('Test filtering by module works correctly', async () => {
    // Filter by auth module
    await page.selectOption('[data-testid="filter-module"]', 'auth');
    await page.waitForTimeout(1000); // Wait for filter to apply
    
    // Verify all visible tests are from auth module
    const moduleLabels = page.locator('[data-testid="test-module"]');
    const count = await moduleLabels.count();
    
    for (let i = 0; i < count; i++) {
      const moduleText = await moduleLabels.nth(i).textContent();
      expect(moduleText?.toLowerCase()).toContain('auth');
    }
    
    // Clear filter
    await page.click('[data-testid="clear-filters"]');
    await page.waitForTimeout(1000);
    
    // Verify more tests are visible after clearing
    const allTestsCount = await page.locator('[data-testid="test-checkbox"]').count();
    expect(allTestsCount).toBeGreaterThan(count);
  });

  test('Test risk level filtering', async () => {
    // Filter by high risk
    await page.selectOption('[data-testid="filter-risk"]', 'high');
    await page.waitForTimeout(1000);
    
    // Verify all visible tests are high risk
    const riskBadges = page.locator('[data-testid="test-risk-badge"]');
    const count = await riskBadges.count();
    
    for (let i = 0; i < count; i++) {
      const riskText = await riskBadges.nth(i).textContent();
      expect(riskText?.toUpperCase()).toBe('HIGH');
    }
  });

  test('Test suite creation from multiple selections', async () => {
    // Select first 5 tests
    const testCheckboxes = page.locator('[data-testid="test-checkbox"]');
    for (let i = 0; i < 5; i++) {
      await testCheckboxes.nth(i).check();
    }
    
    // Verify selection count updates
    const selectionCount = page.locator('[data-testid="selected-tests-count"]');
    await expect(selectionCount).toContainText('5 tests selected');
    
    // Fill suite details
    await page.fill('[data-testid="suite-name-input"]', 'Test Suite Auto');
    await page.fill('[data-testid="suite-description-input"]', 'Automatically created test suite');
    
    // Configure execution options
    await page.selectOption('[data-testid="execution-mode-select"]', 'headless');
    await page.selectOption('[data-testid="execution-type-select"]', 'parallel');
    await page.selectOption('[data-testid="retry-count-select"]', '2');
    
    // Create suite
    await page.click('[data-testid="create-suite-button"]');
    
    // Verify suite appears in existing suites section
    await expect(page.locator('[data-testid="suite-name"]').filter({ hasText: 'Test Suite Auto' })).toBeVisible();
  });

  test('Test search functionality', async () => {
    const searchTerm = 'login';
    
    // Enter search term
    await page.fill('[data-testid="test-search"]', searchTerm);
    await page.waitForTimeout(1000);
    
    // Verify search results contain the term
    const testNames = page.locator('[data-testid="test-name"]');
    const count = await testNames.count();
    
    expect(count).toBeGreaterThan(0);
    
    for (let i = 0; i < Math.min(count, 5); i++) {
      const nameText = await testNames.nth(i).textContent();
      expect(nameText?.toLowerCase()).toContain(searchTerm.toLowerCase());
    }
  });

  test('Test bulk operations - select all', async () => {
    // Click select all checkbox
    await page.click('[data-testid="select-all-tests"]');
    await page.waitForTimeout(1000);
    
    // Verify selection count shows total tests
    const selectionCount = page.locator('[data-testid="selected-tests-count"]');
    const countText = await selectionCount.textContent();
    const selectedCount = parseInt(countText?.match(/(\d+)/)?.[1] || '0');
    
    expect(selectedCount).toBeGreaterThan(300); // Should be 311+
    
    // Clear selection
    await page.click('[data-testid="clear-selection"]');
    await expect(selectionCount).toContainText('0 tests selected');
  });

  test('Test suite presets functionality', async () => {
    // Verify preset suites are available
    const presetSuites = [
      'Regression Suite',
      'Sanity Suite',
      'Smoke Suite',
      'English Language Suite',
      'Authentication Suite'
    ];
    
    for (const presetName of presetSuites) {
      const presetButton = page.locator('button', { hasText: 'Create Suite' }).filter({ hasText: presetName });
      await expect(presetButton.first()).toBeVisible();
    }
  });

  test('Test execution options configuration', async () => {
    // Select a test
    await page.locator('[data-testid="test-checkbox"]').first().check();
    
    // Test execution mode options
    const executionMode = page.locator('[data-testid="execution-mode-select"]');
    await expect(executionMode.locator('option[value="headless"]')).toBeVisible();
    await expect(executionMode.locator('option[value="headed"]')).toBeVisible();
    
    // Test execution type options
    const executionType = page.locator('[data-testid="execution-type-select"]');
    await expect(executionType.locator('option[value="parallel"]')).toBeVisible();
    await expect(executionType.locator('option[value="sequential"]')).toBeVisible();
    
    // Test retry count options
    const retryCount = page.locator('[data-testid="retry-count-select"]');
    await expect(retryCount.locator('option[value="1"]')).toBeVisible();
    await expect(retryCount.locator('option[value="2"]')).toBeVisible();
    await expect(retryCount.locator('option[value="3"]')).toBeVisible();
  });

  test('Test individual test execution', async () => {
    // Click run button for first test
    const runButton = page.locator('[data-testid="run-single-test"]').first();
    await runButton.click();
    
    // Verify loading state
    await expect(page.locator('.animate-spin')).toBeVisible();
    
    // Wait for execution to complete or timeout
    await page.waitForSelector('[data-testid="run-single-test"]', { 
      timeout: 30000,
      state: 'visible' 
    });
  });

  test.afterEach(async () => {
    await page.close();
  });
});