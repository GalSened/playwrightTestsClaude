import { test, expect } from '@playwright/test';

test.describe('Test Bank Debug Session', () => {
  test('Navigate to Test Bank and debug issues', async ({ page }) => {
    console.log('🔍 DEBUG SESSION: Test Bank Navigation and Troubleshooting');
    
    // Monitor network requests
    const requests: any[] = [];
    const responses: any[] = [];
    const errors: any[] = [];
    
    page.on('request', request => {
      requests.push(`${request.method()} ${request.url()}`);
      if (request.url().includes('test-bank') || request.url().includes('api')) {
        console.log(`📤 REQUEST: ${request.method()} ${request.url()}`);
      }
    });
    
    page.on('response', response => {
      responses.push(`${response.status()} ${response.url()}`);
      if (response.url().includes('test-bank') || response.url().includes('api')) {
        console.log(`📥 RESPONSE: ${response.status()} ${response.url()}`);
      }
    });
    
    page.on('pageerror', error => {
      errors.push(error.message);
      console.log(`🚨 PAGE ERROR: ${error.message}`);
    });
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`🚨 CONSOLE ERROR: ${msg.text()}`);
      }
    });
    
    // Step 1: Navigate to dashboard
    console.log('📍 Step 1: Navigating to dashboard');
    await page.goto('http://localhost:3001');
    await page.waitForTimeout(3000);
    
    // Take screenshot of dashboard
    await page.screenshot({ path: 'debug-dashboard.png', fullPage: true });
    console.log('📸 Screenshot: debug-dashboard.png');
    
    // Step 2: Click on Test Bank navigation
    console.log('📍 Step 2: Clicking on Test Bank');
    const testBankButton = page.locator('text="Test Bank", [href*="test-bank"], button:has-text("Test Bank")');
    
    const testBankCount = await testBankButton.count();
    console.log(`🎯 Found ${testBankCount} Test Bank elements`);
    
    if (testBankCount > 0) {
      await testBankButton.first().click();
      console.log('✅ Clicked Test Bank button');
    } else {
      console.log('❌ No Test Bank button found');
      // Look for alternative navigation
      const navElements = await page.locator('nav a, .nav a, [role="navigation"] a').all();
      console.log(`🔍 Found ${navElements.length} navigation elements`);
      
      for (let i = 0; i < navElements.length; i++) {
        const text = await navElements[i].textContent();
        console.log(`   Nav ${i + 1}: ${text}`);
      }
    }
    
    // Wait for navigation
    await page.waitForTimeout(3000);
    
    // Step 3: Take screenshot of current state
    await page.screenshot({ path: 'debug-after-test-bank-click.png', fullPage: true });
    console.log('📸 Screenshot: debug-after-test-bank-click.png');
    
    // Step 4: Check current URL and page state
    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);
    
    // Check for test bank specific elements
    const testBankElements = [
      'text="Test Bank"',
      '[data-testid*="test-bank"]',
      '.test-bank',
      'text="Create Test"',
      'text="Test Suite"',
      'text="Available Tests"'
    ];
    
    console.log('🔍 Checking for Test Bank page elements:');
    for (const selector of testBankElements) {
      const count = await page.locator(selector).count();
      console.log(`   ${selector}: ${count} found`);
    }
    
    // Check for any error messages
    const errorSelectors = ['.error', '[role="alert"]', '.alert-danger', '.error-message'];
    console.log('🚨 Checking for error messages:');
    for (const selector of errorSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        const text = await page.locator(selector).first().textContent();
        console.log(`   ERROR FOUND (${selector}): ${text}`);
      }
    }
    
    // Step 5: Check page content and debug info
    const pageTitle = await page.title();
    console.log(`📄 Page Title: ${pageTitle}`);
    
    const bodyText = await page.locator('body').textContent();
    if (bodyText && bodyText.includes('404')) {
      console.log('❌ 404 Error detected on page');
    } else if (bodyText && bodyText.includes('Error')) {
      console.log('❌ Generic error detected on page');
    } else {
      console.log('✅ No obvious errors in page content');
    }
    
    // Step 6: Summary
    console.log('📊 DEBUG SUMMARY:');
    console.log(`   Total Requests: ${requests.length}`);
    console.log(`   Total Responses: ${responses.length}`);
    console.log(`   Page Errors: ${errors.length}`);
    console.log(`   Final URL: ${currentUrl}`);
    
    if (errors.length > 0) {
      console.log('🚨 JavaScript Errors Found:');
      errors.forEach((error, i) => console.log(`   ${i + 1}. ${error}`));
    }
  });
});