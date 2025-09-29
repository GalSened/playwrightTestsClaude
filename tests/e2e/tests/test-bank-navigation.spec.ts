import { test, expect } from '@playwright/test';

test.describe('Test Bank Navigation Fix', () => {
  test('Click Test Bank and debug navigation', async ({ page }) => {
    console.log('🔧 FIXING: Test Bank Navigation Issue');
    
    // Navigate to dashboard
    console.log('📍 Step 1: Loading dashboard');
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');
    
    // Wait for page to be fully loaded
    await page.waitForTimeout(2000);
    
    // Take initial screenshot
    await page.screenshot({ path: 'before-testbank-click.png', fullPage: true });
    
    // Try different ways to click Test Bank
    console.log('🎯 Step 2: Attempting to click Test Bank');
    
    // Method 1: Try direct text click
    try {
      const testBankLink = page.locator('a:has-text("Test Bank")');
      const count = await testBankLink.count();
      console.log(`Found ${count} Test Bank links`);
      
      if (count > 0) {
        console.log('Clicking Test Bank link...');
        await testBankLink.click();
        await page.waitForTimeout(2000);
        console.log('✅ Test Bank clicked successfully');
      }
    } catch (error) {
      console.log(`❌ Method 1 failed: ${error}`);
    }
    
    // Method 2: Try navigation element
    try {
      const navTestBank = page.locator('nav a[href*="test-bank"], .nav a[href*="test-bank"]');
      const navCount = await navTestBank.count();
      console.log(`Found ${navCount} nav Test Bank elements`);
      
      if (navCount > 0) {
        console.log('Clicking nav Test Bank...');
        await navTestBank.first().click();
        await page.waitForTimeout(2000);
        console.log('✅ Nav Test Bank clicked successfully');
      }
    } catch (error) {
      console.log(`❌ Method 2 failed: ${error}`);
    }
    
    // Method 3: Try direct URL navigation
    console.log('🔗 Step 3: Trying direct URL navigation');
    await page.goto('http://localhost:3001/test-bank');
    await page.waitForTimeout(3000);
    
    // Take screenshot after navigation attempt
    await page.screenshot({ path: 'after-testbank-navigation.png', fullPage: true });
    
    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);
    
    // Check what's on the page now
    const pageContent = await page.textContent('body');
    console.log(`📄 Page contains "Test Bank": ${pageContent?.includes('Test Bank') ? 'YES' : 'NO'}`);
    console.log(`📄 Page contains "404": ${pageContent?.includes('404') ? 'YES' : 'NO'}`);
    console.log(`📄 Page contains "Not Found": ${pageContent?.includes('Not Found') ? 'YES' : 'NO'}`);
    
    // Check for specific Test Bank page elements
    const testBankElements = await page.locator('h1, h2, h3').allTextContents();
    console.log('📊 Page headers found:');
    testBankElements.forEach((text, i) => {
      console.log(`   ${i + 1}. ${text}`);
    });
    
    // Check for any error messages or routing issues
    const errorElements = await page.locator('.error, [role="alert"], .alert').count();
    console.log(`🚨 Error elements on page: ${errorElements}`);
    
    if (errorElements > 0) {
      const errorText = await page.locator('.error, [role="alert"], .alert').first().textContent();
      console.log(`🚨 Error message: ${errorText}`);
    }
  });
});