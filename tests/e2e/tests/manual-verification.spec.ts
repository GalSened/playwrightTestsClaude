import { test, expect } from '@playwright/test';

test.describe('MANUAL SYSTEM VERIFICATION', () => {
  test('Real system test - what actually appears', async ({ page }) => {
    console.log('🔍 MANUAL VERIFICATION: Testing actual system behavior');
    
    // Step 1: Navigate to the system
    console.log('📍 Step 1: Opening http://localhost:3001');
    await page.goto('http://localhost:3001');
    await page.waitForTimeout(3000);
    
    // Take screenshot of what we actually see
    await page.screenshot({ path: 'step1-homepage.png', fullPage: true });
    console.log('📸 Screenshot saved: step1-homepage.png');
    
    const pageTitle = await page.title();
    const url = page.url();
    console.log(`📄 Page Title: "${pageTitle}"`);
    console.log(`🌐 URL: ${url}`);
    
    // Step 2: Try to navigate to Test Bank
    console.log('📍 Step 2: Clicking Test Bank');
    
    const testBankLinks = await page.locator('a:has-text("Test Bank"), [href*="test-bank"], button:has-text("Test Bank")').count();
    console.log(`🎯 Test Bank clickable elements found: ${testBankLinks}`);
    
    if (testBankLinks > 0) {
      await page.locator('a:has-text("Test Bank"), [href*="test-bank"], button:has-text("Test Bank")').first().click();
      await page.waitForTimeout(5000);
      
      await page.screenshot({ path: 'step2-testbank-page.png', fullPage: true });
      console.log('📸 Screenshot saved: step2-testbank-page.png');
      
      const finalUrl = page.url();
      console.log(`📍 After clicking Test Bank, URL: ${finalUrl}`);
      
      // Step 3: Count actual tests
      const testRows = await page.locator('[data-testid="tests-table"] tbody tr, .test-row, table tbody tr').count();
      console.log(`📊 Test rows found in table: ${testRows}`);
      
      // Check for specific content
      const hasTestBankTitle = await page.locator('h1:has-text("Test Bank")').count() > 0;
      const hasTestsTable = await page.locator('[data-testid="tests-table"], table').count() > 0;
      const hasRunButtons = await page.locator('button:has-text("Run")').count();
      
      console.log(`✅ Has "Test Bank" title: ${hasTestBankTitle}`);
      console.log(`✅ Has tests table: ${hasTestsTable}`);
      console.log(`🔘 Number of "Run" buttons: ${hasRunButtons}`);
      
      // Step 4: Try to interact with a test
      if (hasRunButtons > 0) {
        console.log('🔍 Step 4: Testing Run button interaction');
        const firstRunButton = page.locator('button:has-text("Run")').first();
        
        // Check if button is enabled
        const isEnabled = await firstRunButton.isEnabled();
        console.log(`🔘 First Run button enabled: ${isEnabled}`);
        
        if (isEnabled) {
          console.log('👆 Clicking first Run button...');
          await firstRunButton.click();
          await page.waitForTimeout(3000);
          
          await page.screenshot({ path: 'step4-after-run-click.png', fullPage: true });
          console.log('📸 Screenshot saved: step4-after-run-click.png');
          
          // Check for any console errors
          const consoleErrors: string[] = [];
          page.on('console', msg => {
            if (msg.type() === 'error') {
              consoleErrors.push(msg.text());
            }
          });
          
          console.log(`🚨 Console errors found: ${consoleErrors.length}`);
          if (consoleErrors.length > 0) {
            consoleErrors.forEach((error, i) => {
              console.log(`   Error ${i + 1}: ${error}`);
            });
          }
        }
      }
      
      // Check page content for numbers
      const pageText = await page.textContent('body');
      const has156Tests = pageText?.includes('156') || false;
      const has311Tests = pageText?.includes('311') || false;
      
      console.log(`🔍 Page contains "156": ${has156Tests}`);
      console.log(`🔍 Page contains "311": ${has311Tests}`);
      
      // Look for any specific test names
      const hasLoginTest = pageText?.includes('test_login') || pageText?.includes('Login') || false;
      console.log(`🔍 Page contains login-related tests: ${hasLoginTest}`);
      
    } else {
      console.log('❌ No Test Bank navigation found');
      await page.screenshot({ path: 'error-no-testbank-nav.png', fullPage: true });
    }
    
    console.log('🏁 Manual verification completed');
  });
});