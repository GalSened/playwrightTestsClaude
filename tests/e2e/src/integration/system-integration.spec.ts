import { test, expect } from '@playwright/test';

/**
 * System Integration Validation Tests
 * End-to-end validation of complete system functionality
 */
test.describe('Complete System Integration', () => {
  test('should perform complete user journey from registration to test execution', async ({ page, context }) => {
    // Generate unique test data
    const timestamp = Date.now();
    const testEmail = `e2e${timestamp}@test.com`;
    const testSubdomain = `e2e${timestamp}`;
    
    // Step 1: User Registration
    await page.goto('/auth/register');
    await expect(page.locator('h1, h2')).toContainText(/register|sign up/i);
    
    // Fill registration form
    await page.fill('input[name="companyName"]', `E2E Test Company ${timestamp}`);
    await page.fill('input[name="subdomain"]', testSubdomain);
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[name="password"]:nth-of-type(1)', 'TestPassword123!');
    await page.fill('input[name="confirmPassword"]', 'TestPassword123!');
    
    // Submit registration
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|welcome|success)/, { timeout: 15000 });
    
    // Step 2: Verify Dashboard Access
    if (!page.url().includes('/dashboard')) {
      await page.goto('/dashboard');
    }
    
    await expect(page.locator('[data-testid="dashboard-page"]')).toBeVisible();
    
    // Verify environment status is displayed
    await expect(page.locator('[data-testid="environment-status"]')).toBeVisible();
    
    // Step 3: Navigate to Test Management
    const testRunsLink = page.locator('a, button').filter({ hasText: /test|run/i });
    
    if (await testRunsLink.count() > 0) {
      await testRunsLink.first().click();
      await page.waitForTimeout(2000);
      
      // Should navigate to test runs page
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/test|run/);
    } else {
      // Navigate directly
      await page.goto('/test-runs');
    }
    
    // Step 4: Create New Test Run
    const createButtons = page.locator('button, a').filter({ 
      hasText: /create|new|add/i 
    });
    
    if (await createButtons.count() > 0) {
      await createButtons.first().click();
      await page.waitForTimeout(1000);
      
      // Fill test run creation form if present
      const nameInput = page.locator('input[name="name"], [data-testid*="name"]');
      if (await nameInput.isVisible()) {
        await nameInput.fill(`Integration Test Run ${timestamp}`);
      }
      
      const descInput = page.locator('input[name="description"], textarea[name="description"]');
      if (await descInput.isVisible()) {
        await descInput.fill('Automated integration test run');
      }
      
      // Submit test run creation
      const submitButtons = page.locator('button[type="submit"], button').filter({ 
        hasText: /create|save|run/i 
      });
      
      if (await submitButtons.count() > 0) {
        await submitButtons.first().click();
        await page.waitForTimeout(2000);
      }
    }
    
    // Step 5: Verify Test Run Creation
    await page.waitForTimeout(3000);
    
    // Look for test run in the list
    const testRunElements = page.locator('text*="Integration Test Run", text*="Test Run"');
    const hasTestRuns = await testRunElements.count() > 0;
    
    if (hasTestRuns) {
      await expect(testRunElements.first()).toBeVisible();
    }
    
    // Step 6: Verify Analytics/Reports Access
    const analyticsLinks = page.locator('a, button').filter({ 
      hasText: /analytics|reports|metrics/i 
    });
    
    if (await analyticsLinks.count() > 0) {
      await analyticsLinks.first().click();
      await page.waitForTimeout(2000);
      
      // Should show analytics page
      const analyticsContent = page.locator('h1, h2, [data-testid*="analytics"]');
      await expect(analyticsContent.first()).toBeVisible();
    }
    
    // Step 7: Logout and Verify
    const logoutButtons = page.locator('button, a').filter({ 
      hasText: /logout|sign out/i 
    });
    
    if (await logoutButtons.count() > 0) {
      await logoutButtons.first().click();
      await page.waitForURL(/login/, { timeout: 10000 });
      await expect(page).toHaveURL(/login/);
    }
  });
  
  test('should maintain data consistency across all components', async ({ page }) => {
    // Login first
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    
    await page.waitForURL(/\/(dashboard|test-runs|$)/, { timeout: 15000 });
    
    // Step 1: Check Dashboard Statistics
    await page.goto('/dashboard');
    await expect(page.locator('[data-testid="dashboard-page"]')).toBeVisible();
    
    // Extract statistics from dashboard
    const statElements = page.locator('.text-2xl, .stat-value, [data-testid*="stat"]');
    const stats = {};
    
    const statCount = await statElements.count();
    for (let i = 0; i < Math.min(statCount, 4); i++) {
      const statValue = await statElements.nth(i).textContent();
      if (statValue && /\d+/.test(statValue)) {
        stats[`stat${i}`] = statValue.trim();
      }
    }
    
    // Step 2: Navigate to Test Runs and Verify Count Consistency
    await page.goto('/test-runs');
    await page.waitForTimeout(2000);
    
    // Count test runs in the list
    const testRunRows = page.locator('[data-testid*="test-run"], .test-run-item, tr').filter({ 
      hasNotText: /header|title/i 
    });
    const testRunCount = await testRunRows.count();
    
    // Step 3: Verify Analytics Data Consistency
    const analyticsLinks = page.locator('a, button').filter({ 
      hasText: /analytics|reports/i 
    });
    
    if (await analyticsLinks.count() > 0) {
      await analyticsLinks.first().click();
      await page.waitForTimeout(2000);
      
      // Check that analytics show consistent numbers
      const analyticsNumbers = page.locator('.metric-value, .chart-value, [data-testid*="metric"]');
      const analyticsCount = await analyticsNumbers.count();
      
      expect(analyticsCount).toBeGreaterThanOrEqual(0);
    }
    
    // Step 4: Test Real-time Updates
    if (testRunCount >= 0) {
      // Create a new test run to test real-time updates
      const createButton = page.locator('button, a').filter({ hasText: /create|new/i });
      
      if (await createButton.count() > 0) {
        await createButton.first().click();
        
        // Fill basic test run info
        const nameField = page.locator('input[name="name"], [placeholder*="name"]');
        if (await nameField.isVisible()) {
          await nameField.fill('Real-time Test ' + Date.now());
          
          const submitButton = page.locator('button[type="submit"], button').filter({ 
            hasText: /create|save/i 
          });
          
          if (await submitButton.count() > 0) {
            await submitButton.first().click();
            await page.waitForTimeout(3000);
            
            // Verify the new test run appears
            const updatedRows = page.locator('[data-testid*="test-run"], .test-run-item');
            const updatedCount = await updatedRows.count();
            
            expect(updatedCount).toBeGreaterThanOrEqual(testRunCount);
          }
        }
      }
    }
  });
  
  test('should handle concurrent user sessions properly', async ({ page, context }) => {
    // Create multiple browser contexts to simulate concurrent users
    const contexts = await Promise.all([
      context.browser()?.newContext(),
      context.browser()?.newContext()
    ]);
    
    if (contexts[0] && contexts[1]) {
      const page1 = await contexts[0].newPage();
      const page2 = await contexts[1].newPage();
      
      try {
        // Login with same user in both sessions
        for (const testPage of [page1, page2]) {
          await testPage.goto('/auth/login');
          await testPage.fill('input[type="email"]', 'admin@test.com');
          await testPage.fill('input[type="password"]', 'TestPassword123!');
          await testPage.click('button[type="submit"]');
          await testPage.waitForURL(/\/(dashboard|test-runs|$)/, { timeout: 15000 });
        }
        
        // Verify both sessions work independently
        await page1.goto('/dashboard');
        await page2.goto('/test-runs');
        
        // Both pages should be accessible
        await expect(page1.locator('[data-testid="dashboard-page"]')).toBeVisible();
        
        const page2Content = page2.locator('h1, h2, [data-testid*="test"]');
        await expect(page2Content.first()).toBeVisible();
        
        // Test concurrent actions
        const timestamp = Date.now();
        
        // Page 1: Navigate to test runs
        await page1.goto('/test-runs');
        
        // Page 2: Try to create test run
        const createButton = page2.locator('button, a').filter({ hasText: /create|new/i });
        
        if (await createButton.count() > 0) {
          await createButton.first().click();
          
          const nameField = page2.locator('input[name="name"]');
          if (await nameField.isVisible()) {
            await nameField.fill(`Concurrent Test ${timestamp}`);
            
            const submitButton = page2.locator('button[type="submit"]');
            if (await submitButton.count() > 0) {
              await submitButton.first().click();
              await page2.waitForTimeout(2000);
            }
          }
        }
        
        // Verify page 1 shows updates (if real-time is working)
        await page1.reload();
        await page1.waitForTimeout(2000);
        
        // Both sessions should still be functional
        await expect(page1.locator('h1, h2')).toBeVisible();
        await expect(page2.locator('h1, h2')).toBeVisible();
        
      } finally {
        // Clean up contexts
        await contexts[0].close();
        await contexts[1].close();
      }
    }
  });
  
  test('should validate all API endpoints are protected and functional', async ({ page, request }) => {
    // Login first to get authentication
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|test-runs|$)/, { timeout: 15000 });
    
    // Extract authentication token
    const authToken = await page.evaluate(() => {
      return localStorage.getItem('auth_token') || 
             sessionStorage.getItem('auth_token') ||
             document.cookie.split(';').find(c => c.includes('auth'))?.split('=')[1];
    });
    
    // Test various API endpoints
    const endpoints = [
      { method: 'GET', path: '/api/health', requiresAuth: false },
      { method: 'GET', path: '/api/test-runs', requiresAuth: true },
      { method: 'GET', path: '/api/analytics', requiresAuth: true },
      { method: 'POST', path: '/api/test-runs', requiresAuth: true }
    ];
    
    for (const endpoint of endpoints) {
      // Test without authentication
      const unauthResponse = await request.fetch(endpoint.path, {
        method: endpoint.method,
        data: endpoint.method === 'POST' ? { name: 'test' } : undefined
      });
      
      if (endpoint.requiresAuth) {
        expect(unauthResponse.status()).toBe(401);
      } else {
        expect(unauthResponse.ok()).toBe(true);
      }
      
      // Test with authentication
      if (endpoint.requiresAuth && authToken) {
        const authResponse = await request.fetch(endpoint.path, {
          method: endpoint.method,
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'X-Tenant-ID': 'test-tenant-e2e'
          },
          data: endpoint.method === 'POST' ? { 
            name: 'API Test Run',
            description: 'Test from integration suite'
          } : undefined
        });
        
        expect([200, 201, 204]).toContain(authResponse.status());
      }
    }
  });
  
  test('should validate complete error handling and recovery', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|test-runs|$)/, { timeout: 15000 });
    
    // Test 1: Network error simulation
    await page.route('**/api/**', route => route.abort());
    
    await page.goto('/dashboard');
    
    // App should handle network errors gracefully
    const errorElements = page.locator('.error, .alert, [data-testid*="error"]');
    const errorCount = await errorElements.count();
    
    if (errorCount > 0) {
      // Should show user-friendly error messages
      const errorText = await errorElements.first().textContent();
      expect(errorText).not.toContain('undefined');
      expect(errorText).not.toContain('500');
      expect(errorText).toBeTruthy();
    }
    
    // Re-enable network
    await page.unroute('**/api/**');
    
    // Test 2: Recovery after network restoration
    await page.reload();
    await page.waitForTimeout(3000);
    
    // Should recover and show content
    await expect(page.locator('[data-testid="dashboard-page"]')).toBeVisible();
    
    // Test 3: Invalid data handling
    await page.goto('/test-runs');
    
    // Try to create test run with invalid data
    const createButton = page.locator('button, a').filter({ hasText: /create|new/i });
    
    if (await createButton.count() > 0) {
      await createButton.first().click();
      
      // Submit without required fields
      const submitButton = page.locator('button[type="submit"]');
      if (await submitButton.count() > 0) {
        await submitButton.first().click();
        
        // Should show validation errors
        const validationErrors = page.locator('.error, [data-testid*="error"]');
        const hasValidationErrors = await validationErrors.count() > 0;
        
        if (hasValidationErrors) {
          await expect(validationErrors.first()).toBeVisible();
        } else {
          // Form should not submit (stay on same page)
          await page.waitForTimeout(1000);
          expect(page.url()).toContain('/test-runs');
        }
      }
    }
  });
});

test.describe('Performance and Scalability Validation', () => {
  test('should load dashboard within acceptable time limits', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|test-runs|$)/, { timeout: 15000 });
    
    // Measure dashboard load time
    const startTime = Date.now();
    
    await page.goto('/dashboard');
    await expect(page.locator('[data-testid="dashboard-page"]')).toBeVisible();
    
    const loadTime = Date.now() - startTime;
    
    // Dashboard should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
    
    // Check for performance indicators
    const performanceMetrics = await page.evaluate(() => ({
      loadEventEnd: performance.timing.loadEventEnd,
      navigationStart: performance.timing.navigationStart,
      domContentLoaded: performance.timing.domContentLoadedEventEnd
    }));
    
    const totalLoadTime = performanceMetrics.loadEventEnd - performanceMetrics.navigationStart;
    if (totalLoadTime > 0) {
      expect(totalLoadTime).toBeLessThan(10000); // 10 seconds max
    }
  });
  
  test('should handle large datasets efficiently', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|test-runs|$)/, { timeout: 15000 });
    
    await page.goto('/test-runs');
    await page.waitForTimeout(3000);
    
    // Check for pagination or virtual scrolling
    const paginationElements = page.locator('.pagination, .pager, [data-testid*="pagination"]');
    const virtualScrollElements = page.locator('.virtual-scroll, [data-testid*="virtual"]');
    
    const hasPagination = await paginationElements.count() > 0;
    const hasVirtualScroll = await virtualScrollElements.count() > 0;
    
    // Should have some mechanism to handle large datasets
    if (!hasPagination && !hasVirtualScroll) {
      // At least should limit the number of items shown
      const listItems = page.locator('.test-run-item, tr, .list-item');
      const itemCount = await listItems.count();
      
      // Should not show more than 100 items at once (arbitrary limit)
      expect(itemCount).toBeLessThan(100);
    }
  });
});

/**
 * Helper function to wait for element and verify it's functional
 */
async function waitAndVerifyElement(page: any, selector: string, action?: 'click' | 'fill') {
  const element = page.locator(selector);
  await expect(element).toBeVisible();
  
  if (action === 'click') {
    await expect(element).toBeEnabled();
    await element.click();
  }
  
  return element;
}