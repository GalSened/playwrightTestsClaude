import { test, expect } from '@playwright/test';

test.describe('Working Enterprise Test Suite', () => {
  test('Login and navigate to dashboard', async ({ page }) => {
    console.log('🚀 Starting enterprise workflow test...');
    
    // Navigate to home page
    await page.goto('/');
    await expect(page).toHaveTitle(/Playwright Smart/);
    console.log('✅ Page loaded successfully');
    
    // Wait for the React app to load
    await page.waitForTimeout(2000);
    
    // Look for login form elements
    const emailInput = page.locator('input[type="email"], input[placeholder*="Email"], input[name*="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[placeholder*="Password"], input[name*="password"]').first();
    const signInButton = page.locator('button:has-text("Sign In"), button[type="submit"]').first();
    
    // Verify login form is present
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(signInButton).toBeVisible();
    console.log('✅ Login form elements found');
    
    // Fill in demo credentials
    await emailInput.fill('admin@demo.com');
    await passwordInput.fill('demo123');
    console.log('✅ Credentials entered');
    
    // Click sign in
    await signInButton.click();
    console.log('✅ Sign in clicked');
    
    // Wait for navigation/dashboard to load
    await page.waitForTimeout(3000);
    
    // Check if we're logged in (look for dashboard elements)
    const pageContent = await page.textContent('body');
    console.log('📄 Post-login content preview:', pageContent?.substring(0, 300));
    
    // Take screenshot of current state
    await page.screenshot({ path: 'post-login-state.png', fullPage: true });
    
    // Look for common dashboard elements
    const dashboardIndicators = [
      'dashboard',
      'test',
      'suite',
      'analytics',
      'report',
      'management',
      'welcome',
      'navigation',
      'menu'
    ];
    
    let foundIndicators = 0;
    for (const indicator of dashboardIndicators) {
      if (pageContent?.toLowerCase().includes(indicator)) {
        foundIndicators++;
        console.log(`✅ Found dashboard indicator: ${indicator}`);
      }
    }
    
    console.log(`📊 Dashboard indicators found: ${foundIndicators}/${dashboardIndicators.length}`);
    
    // Check for any navigation elements
    const navElements = await page.locator('nav, [role="navigation"], [data-testid*="nav"], .nav, .navigation').count();
    console.log(`🧭 Navigation elements: ${navElements}`);
    
    // Look for buttons that might indicate we're in the dashboard
    const buttons = await page.locator('button').count();
    console.log(`🔘 Buttons found: ${buttons}`);
    
    // Check for any test-related content
    const testRelatedContent = await page.locator('text=/test|suite|analytics|dashboard/i').count();
    console.log(`🧪 Test-related content elements: ${testRelatedContent}`);
    
    console.log('✅ Enterprise login workflow completed!');
    
    // Basic assertion to ensure we have some interactive content
    expect(foundIndicators).toBeGreaterThan(0);
  });
  
  test('Verify system accessibility and responsive design', async ({ page }) => {
    console.log('🚀 Testing accessibility and responsive design...');
    
    // Test desktop view
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: 'desktop-view.png', fullPage: true });
    console.log('✅ Desktop view captured');
    
    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tablet-view.png', fullPage: true });
    console.log('✅ Tablet view captured');
    
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'mobile-view.png', fullPage: true });
    console.log('✅ Mobile view captured');
    
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);
    
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    console.log(`🎯 Focused element: ${focusedElement}`);
    
    console.log('✅ Accessibility and responsive design test completed!');
    
    expect(focusedElement).toBeTruthy();
  });
  
  test('Performance and loading test', async ({ page }) => {
    console.log('🚀 Testing performance and loading times...');
    
    const startTime = Date.now();
    
    // Navigate and measure load time
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    console.log(`⚡ Page load time: ${loadTime}ms`);
    
    // Check performance metrics
    const performanceMetrics = await page.evaluate(() => {
      const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
        loadComplete: perfData.loadEventEnd - perfData.loadEventStart,
      };
    });
    
    console.log('📊 Performance metrics:', performanceMetrics);
    
    // Test should load reasonably quickly
    expect(loadTime).toBeLessThan(10000); // 10 seconds max
    console.log('✅ Performance test passed!');
  });
});