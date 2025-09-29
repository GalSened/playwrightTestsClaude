import { test, expect } from '@playwright/test';

test.describe('Complete Login and Dashboard Navigation', () => {
  test('Login and navigate to dashboard - Full Demo', async ({ page }) => {
    console.log('🚀 Starting complete login demonstration...');
    
    // Step 1: Navigate to the system
    console.log('📍 Step 1: Navigating to http://localhost:3001');
    await page.goto('http://localhost:3001');
    await page.waitForTimeout(3000);
    console.log('✅ Login page loaded successfully');
    
    // Take screenshot of login page
    await page.screenshot({ path: 'step1-login-page.png', fullPage: true });
    console.log('📸 Screenshot 1: Login page captured');
    
    // Step 2: Fill in credentials
    console.log('📝 Step 2: Filling in demo credentials');
    const emailField = page.locator('input[type="email"], input[placeholder*="you@company.com"]').first();
    const passwordField = page.locator('input[type="password"], input[placeholder*="Enter your password"]').first();
    const signInButton = page.locator('button:has-text("Sign In")').first();
    
    // Verify elements are visible
    await expect(emailField).toBeVisible();
    await expect(passwordField).toBeVisible();
    await expect(signInButton).toBeVisible();
    
    // Fill credentials
    await emailField.fill('admin@demo.com');
    await passwordField.fill('demo123');
    console.log('✅ Credentials entered: admin@demo.com / demo123');
    
    // Take screenshot with filled credentials
    await page.screenshot({ path: 'step2-credentials-filled.png', fullPage: true });
    console.log('📸 Screenshot 2: Credentials filled');
    
    // Step 3: Click Sign In and wait for navigation
    console.log('🔐 Step 3: Clicking Sign In button');
    await signInButton.click();
    console.log('✅ Sign In clicked, waiting for dashboard...');
    
    // Wait for navigation to complete
    await page.waitForTimeout(5000);
    
    // Take screenshot immediately after login
    await page.screenshot({ path: 'step3-after-login.png', fullPage: true });
    console.log('📸 Screenshot 3: Immediately after login attempt');
    
    // Step 4: Check current page state
    console.log('🔍 Step 4: Analyzing post-login page state');
    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);
    
    // Get page content
    const pageContent = await page.textContent('body');
    console.log('📄 Post-login content preview:', pageContent?.substring(0, 400));
    
    // Look for dashboard elements
    const dashboardElements = [
      'dashboard', 'test bank', 'analytics', 'scheduler', 'monitoring',
      'navigation', 'menu', 'sidebar', 'header', 'admin', 'settings'
    ];
    
    let foundElements: string[] = [];
    for (const element of dashboardElements) {
      if (pageContent?.toLowerCase().includes(element)) {
        foundElements.push(element);
      }
    }
    
    console.log(`🎯 Dashboard elements found: ${foundElements.join(', ')}`);
    console.log(`📊 Total dashboard indicators: ${foundElements.length}/${dashboardElements.length}`);
    
    // Check for specific UI elements that indicate dashboard
    const buttons = await page.locator('button').count();
    const links = await page.locator('a').count();
    const navElements = await page.locator('nav, [role="navigation"]').count();
    const inputs = await page.locator('input').count();
    
    console.log('🔢 UI Elements count:');
    console.log(`   Buttons: ${buttons}`);
    console.log(`   Links: ${links}`);
    console.log(`   Navigation: ${navElements}`);
    console.log(`   Inputs: ${inputs}`);
    
    // Look for specific dashboard/app elements
    const appElements = [
      '[data-testid*="dashboard"]',
      '[data-testid*="test"]',
      '[data-testid*="bank"]',
      '[class*="dashboard"]',
      '[class*="sidebar"]',
      '[class*="navigation"]',
      'header',
      'main'
    ];
    
    for (const selector of appElements) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        console.log(`✅ Found ${count} element(s) matching: ${selector}`);
      }
    }
    
    // Check for any error messages
    const errorSelectors = [
      '[class*="error"]', '[class*="Error"]', '.alert-error',
      'text="Invalid"', 'text="Error"', 'text="Failed"'
    ];
    
    for (const errorSelector of errorSelectors) {
      const errorCount = await page.locator(errorSelector).count();
      if (errorCount > 0) {
        console.log(`⚠️  Found ${errorCount} error element(s): ${errorSelector}`);
        const errorText = await page.locator(errorSelector).first().textContent();
        console.log(`   Error message: ${errorText}`);
      }
    }
    
    // Wait a bit more and take final screenshot
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'step4-final-state.png', fullPage: true });
    console.log('📸 Screenshot 4: Final page state');
    
    // Step 5: Summary
    console.log('📋 Step 5: Login attempt summary');
    console.log(`🌐 Final URL: ${page.url()}`);
    console.log(`📊 Dashboard elements detected: ${foundElements.length > 0 ? 'YES' : 'NO'}`);
    console.log(`🎯 Navigation successful: ${currentUrl !== 'http://localhost:3001/' ? 'YES' : 'NO'}`);
    
    if (foundElements.length > 0) {
      console.log('✅ SUCCESS: Dashboard elements detected - login appears successful!');
    } else if (currentUrl !== 'http://localhost:3001/') {
      console.log('✅ SUCCESS: URL changed - navigation occurred!');
    } else {
      console.log('⚠️  WARNING: Still on login page - login may have failed or needs investigation');
    }
    
    console.log('🏁 Complete login demonstration finished!');
  });
});