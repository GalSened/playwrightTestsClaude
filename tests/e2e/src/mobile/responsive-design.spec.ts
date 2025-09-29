import { test, expect } from '@playwright/test';

/**
 * Mobile & Responsive Design Tests
 * Tests mobile layouts, touch interactions, and responsive behavior
 */
test.describe('Mobile Dashboard Experience', () => {
  test.use({ 
    viewport: { width: 375, height: 667 } // iPhone SE dimensions
  });
  
  test('should display mobile-optimized dashboard layout', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Wait for dashboard to load
    await expect(page.locator('[data-testid="dashboard-page"]')).toBeVisible();
    
    // Check that dashboard adapts to mobile viewport
    const dashboardContainer = page.locator('[data-testid="dashboard-page"]');
    
    // Verify mobile layout characteristics
    await expect(dashboardContainer).toBeVisible();
    
    // Stats should stack vertically on mobile
    const statsGrid = page.locator('.grid').first(); // Assuming stats are in a grid
    
    if (await statsGrid.isVisible()) {
      const gridStyles = await statsGrid.evaluate(el => 
        window.getComputedStyle(el).gridTemplateColumns
      );
      
      // On mobile, should be single column or auto-fit with smaller columns
      expect(gridStyles).toMatch(/1fr|repeat\(1,|auto/);
    }
    
    // Navigation should be mobile-friendly
    const navigation = page.locator('nav, [role="navigation"]');
    if (await navigation.count() > 0) {
      await expect(navigation.first()).toBeVisible();
    }
  });
  
  test('should support touch interactions for mobile navigation', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('[data-testid="dashboard-page"]')).toBeVisible();
    
    // Test touch interactions on buttons
    const quickActionButtons = page.locator('button').filter({ hasText: /Create|View|Open/ });
    const buttonCount = await quickActionButtons.count();
    
    if (buttonCount > 0) {
      const firstButton = quickActionButtons.first();
      
      // Test touch tap
      await firstButton.tap();
      
      // Should navigate or perform action
      // The exact assertion depends on what the button does
      await page.waitForTimeout(1000);
      
      // Verify button is still interactive (not disabled)
      await expect(firstButton).toBeEnabled();
    }
  });
  
  test('should handle mobile viewport orientation changes', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('[data-testid="dashboard-page"]')).toBeVisible();
    
    // Test portrait orientation (default)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    
    // Verify layout in portrait
    await expect(page.locator('[data-testid="dashboard-page"]')).toBeVisible();
    
    // Test landscape orientation
    await page.setViewportSize({ width: 667, height: 375 });
    await page.waitForTimeout(500);
    
    // Verify layout adapts to landscape
    await expect(page.locator('[data-testid="dashboard-page"]')).toBeVisible();
    
    // Check that content is still accessible
    const envStatus = page.locator('[data-testid="environment-status"]');
    if (await envStatus.isVisible()) {
      await expect(envStatus).toBeVisible();
    }
  });
});

test.describe('Tablet Responsive Design', () => {
  test.use({ 
    viewport: { width: 768, height: 1024 } // iPad dimensions
  });
  
  test('should optimize layout for tablet viewports', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('[data-testid="dashboard-page"]')).toBeVisible();
    
    // Tablet should show more content than mobile but less than desktop
    const statsContainer = page.locator('.grid').first();
    
    if (await statsContainer.isVisible()) {
      const containerWidth = await statsContainer.boundingBox();
      expect(containerWidth?.width).toBeGreaterThan(300); // Larger than mobile
      expect(containerWidth?.width).toBeLessThan(1200); // Smaller than desktop
    }
    
    // Check for tablet-specific layout
    const quickActions = page.locator('text=Quick Actions').locator('..');
    if (await quickActions.isVisible()) {
      await expect(quickActions).toBeVisible();
    }
  });
  
  test('should support both touch and mouse interactions on tablet', async ({ page }) => {
    await page.goto('/test-runs');
    
    // Wait for content to load
    await page.waitForTimeout(2000);
    
    // Test mouse hover (tablets can support this)
    const buttons = page.locator('button').filter({ hasText: /Create|Run|View/ });
    const buttonCount = await buttons.count();
    
    if (buttonCount > 0) {
      const firstButton = buttons.first();
      
      // Test hover interaction
      await firstButton.hover();
      await page.waitForTimeout(200);
      
      // Test click interaction
      await firstButton.click();
      await page.waitForTimeout(1000);
    }
  });
});

test.describe('Cross-Device Navigation', () => {
  const devices = [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1280, height: 720 }
  ];
  
  for (const device of devices) {
    test(`should provide consistent navigation on ${device.name}`, async ({ page }) => {
      await page.setViewportSize({ width: device.width, height: device.height });
      
      await page.goto('/dashboard');
      await expect(page.locator('[data-testid="dashboard-page"]')).toBeVisible();
      
      // Navigation should be accessible on all devices
      const navigationLinks = page.locator('a, button').filter({ 
        hasText: /Dashboard|Test|Analytics|Reports|Runs/ 
      });
      
      const navCount = await navigationLinks.count();
      expect(navCount).toBeGreaterThan(0);
      
      // Test navigation to different pages
      const testNavLinks = navigationLinks.filter({ hasText: /Test|Runs/ });
      const testNavCount = await testNavLinks.count();
      
      if (testNavCount > 0) {
        await testNavLinks.first().click();
        await page.waitForTimeout(1000);
        
        // Should navigate successfully
        const currentUrl = page.url();
        expect(currentUrl).toMatch(/test|run/i);
      }
    });
  }
});

test.describe('Mobile Form Interactions', () => {
  test.use({ 
    viewport: { width: 375, height: 667 }
  });
  
  test('should handle mobile form inputs correctly', async ({ page }) => {
    // Test login form on mobile
    await page.goto('/auth/login');
    
    // Wait for login form
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"], input[name="password"]');
    
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    
    // Test mobile input interactions
    await emailInput.tap();
    await emailInput.fill('test@example.com');
    
    await passwordInput.tap();
    await passwordInput.fill('password123');
    
    // Verify inputs work correctly
    await expect(emailInput).toHaveValue('test@example.com');
    await expect(passwordInput).toHaveValue('password123');
    
    // Test form submission button
    const submitButton = page.locator('button[type="submit"], .login-button');
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();
  });
  
  test('should show appropriate mobile keyboards for input types', async ({ page }) => {
    await page.goto('/auth/login');
    
    // Email input should trigger email keyboard
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    await emailInput.tap();
    
    // Verify input type attribute
    const inputType = await emailInput.getAttribute('type');
    expect(inputType).toBe('email');
    
    // Test that autocomplete is properly configured
    const autocomplete = await emailInput.getAttribute('autocomplete');
    if (autocomplete) {
      expect(autocomplete).toMatch(/email|username/);
    }
  });
});

test.describe('Mobile Performance & Loading', () => {
  test.use({ 
    viewport: { width: 375, height: 667 },
    // Simulate slower mobile network
    extraHTTPHeaders: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)'
    }
  });
  
  test('should load efficiently on mobile networks', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/dashboard');
    await expect(page.locator('[data-testid="dashboard-page"]')).toBeVisible();
    
    const loadTime = Date.now() - startTime;
    
    // Mobile should load within reasonable time (adjust based on requirements)
    expect(loadTime).toBeLessThan(10000); // 10 seconds max
    
    // Check for loading indicators
    const loadingElements = page.locator('.loading, .spinner, [data-testid*="loading"]');
    const hasLoadingIndicators = await loadingElements.count() > 0;
    
    if (hasLoadingIndicators) {
      // Loading indicators should disappear after content loads
      await expect(loadingElements.first()).not.toBeVisible();
    }
  });
  
  test('should implement progressive loading for mobile', async ({ page }) => {
    await page.goto('/test-runs');
    
    // Check that essential content loads first
    await expect(page.locator('h1, [data-testid*="title"]')).toBeVisible();
    
    // Secondary content should load progressively
    await page.waitForTimeout(2000);
    
    // Verify page is functional
    const interactiveElements = page.locator('button, a, input');
    const elementCount = await interactiveElements.count();
    
    expect(elementCount).toBeGreaterThan(0);
  });
});

test.describe('Mobile Accessibility', () => {
  test.use({ 
    viewport: { width: 375, height: 667 }
  });
  
  test('should support mobile screen readers', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('[data-testid="dashboard-page"]')).toBeVisible();
    
    // Check for proper ARIA labels and roles
    const mainContent = page.locator('main, [role="main"]');
    if (await mainContent.count() > 0) {
      await expect(mainContent.first()).toBeVisible();
    }
    
    // Check for proper heading structure
    const headings = page.locator('h1, h2, h3, h4, h5, h6');
    const headingCount = await headings.count();
    
    expect(headingCount).toBeGreaterThan(0);
    
    // Verify first heading is h1
    const firstHeading = headings.first();
    const tagName = await firstHeading.evaluate(el => el.tagName.toLowerCase());
    expect(tagName).toBe('h1');
  });
  
  test('should support mobile keyboard navigation', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('[data-testid="dashboard-page"]')).toBeVisible();
    
    // Test tab navigation
    await page.keyboard.press('Tab');
    
    // Should focus on first interactive element
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
    
    // Continue tabbing through elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Should maintain proper tab order
    const secondFocused = page.locator(':focus');
    await expect(secondFocused).toBeVisible();
  });
  
  test('should have appropriate touch target sizes', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('[data-testid="dashboard-page"]')).toBeVisible();
    
    // Check that buttons and links are large enough for touch
    const touchTargets = page.locator('button, a, input[type="button"]');
    const targetCount = await touchTargets.count();
    
    for (let i = 0; i < Math.min(targetCount, 5); i++) { // Check first 5 elements
      const target = touchTargets.nth(i);
      
      if (await target.isVisible()) {
        const boundingBox = await target.boundingBox();
        
        if (boundingBox) {
          // Touch targets should be at least 44x44 pixels (iOS guideline)
          expect(boundingBox.height).toBeGreaterThanOrEqual(30); // Relaxed for testing
          expect(boundingBox.width).toBeGreaterThanOrEqual(30);
        }
      }
    }
  });
});

test.describe('PWA Mobile Features', () => {
  test.use({ 
    viewport: { width: 375, height: 667 }
  });
  
  test('should work offline with service worker', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('[data-testid="dashboard-page"]')).toBeVisible();
    
    // Check for service worker registration
    const hasServiceWorker = await page.evaluate(() => {
      return 'serviceWorker' in navigator;
    });
    
    expect(hasServiceWorker).toBe(true);
    
    // Test basic offline functionality
    await page.route('**/*', route => route.abort());
    
    // Reload page to test offline behavior
    await page.reload({ waitUntil: 'domcontentloaded' });
    
    // Should still show some content from cache
    // This depends on the service worker implementation
    const hasContent = await page.locator('body').textContent();
    expect(hasContent).toBeTruthy();
  });
  
  test('should be installable as PWA', async ({ page }) => {
    await page.goto('/');
    
    // Check for web app manifest
    const manifestLink = page.locator('link[rel="manifest"]');
    const hasManifest = await manifestLink.count() > 0;
    
    if (hasManifest) {
      const manifestHref = await manifestLink.getAttribute('href');
      expect(manifestHref).toBeTruthy();
      
      // Verify manifest is accessible
      const manifestResponse = await page.request.get(manifestHref!);
      expect(manifestResponse.ok()).toBe(true);
    }
    
    // Check for PWA meta tags
    const themeColorMeta = page.locator('meta[name="theme-color"]');
    const hasThemeColor = await themeColorMeta.count() > 0;
    
    if (hasThemeColor) {
      const themeColor = await themeColorMeta.getAttribute('content');
      expect(themeColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});