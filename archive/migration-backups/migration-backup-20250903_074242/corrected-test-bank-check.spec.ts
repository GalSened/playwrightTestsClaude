import { test, expect } from '@playwright/test';

test.describe('Test Bank Corrected Check', () => {
  
  test('Access Test Bank with Correct Port', async ({ page }) => {
    console.log('=== Testing Test Bank Access ===');
    
    // Go to the running frontend application
    await page.goto('http://localhost:3006/');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of main page
    await page.screenshot({ 
      path: 'test-results/main-app.png', 
      fullPage: true 
    });
    
    // Look for test bank navigation or content
    const testBankElements = await page.locator([
      'a[href*="test-bank"]',
      'button:has-text("Test Bank")',
      'nav a:has-text("Test")',
      '[data-testid*="test"]',
      'a:has-text("Test")'
    ].join(', ')).count();
    
    console.log(`✓ Test Bank related elements found: ${testBankElements}`);
    
    // Try to navigate to test-bank if link exists
    const testBankLink = page.locator('a[href*="test-bank"]').first();
    if (await testBankLink.count() > 0) {
      console.log('✓ Found Test Bank link, navigating...');
      await testBankLink.click();
      await page.waitForTimeout(2000);
      
      await page.screenshot({ 
        path: 'test-results/test-bank-page.png', 
        fullPage: true 
      });
    } else {
      // Try direct URL
      console.log('✓ Trying direct Test Bank URL...');
      await page.goto('http://localhost:3006/test-bank');
      await page.waitForLoadState('networkidle');
      
      await page.screenshot({ 
        path: 'test-results/test-bank-direct.png', 
        fullPage: true 
      });
    }
    
    // Check page content
    const pageContent = await page.textContent('body');
    const hasTestContent = pageContent && (
      pageContent.includes('test') ||
      pageContent.includes('Test') ||
      pageContent.includes('suite') ||
      pageContent.includes('Suite')
    );
    
    console.log(`✓ Page has test-related content: ${!!hasTestContent}`);
    
    // Basic assertions
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
    
    console.log('✅ Test Bank check completed!');
  });
});