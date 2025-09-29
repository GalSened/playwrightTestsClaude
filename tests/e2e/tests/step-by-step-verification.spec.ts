import { test, expect } from '@playwright/test';

test.describe('Step-by-Step System Verification', () => {
  test('Proof of what actually works', async ({ page }) => {
    console.log('🔍 STEP-BY-STEP VERIFICATION WITH PROOF');
    
    // Capture console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
        console.log(`🚨 CONSOLE ERROR: ${msg.text()}`);
      }
    });
    
    // Capture network failures
    const networkFailures: string[] = [];
    page.on('response', response => {
      if (!response.ok()) {
        networkFailures.push(`${response.status()} ${response.url()}`);
        console.log(`🌐 NETWORK ERROR: ${response.status()} ${response.url()}`);
      }
    });
    
    console.log('📍 STEP 2: Loading http://localhost:3001');
    
    try {
      await page.goto('http://localhost:3001');
      await page.waitForTimeout(5000);
      
      const pageTitle = await page.title();
      const currentUrl = page.url();
      
      console.log(`✅ PAGE LOADED SUCCESSFULLY`);
      console.log(`📄 Title: "${pageTitle}"`);
      console.log(`🌐 URL: ${currentUrl}`);
      
      await page.screenshot({ path: 'step2-page-loads.png', fullPage: true });
      console.log('📸 Screenshot: step2-page-loads.png');
      
      // Check if logged in
      const isLoggedIn = await page.locator('text="Dashboard"').count() > 0;
      console.log(`🔐 Appears logged in: ${isLoggedIn}`);
      
      if (!isLoggedIn) {
        console.log('🔐 Not logged in, attempting login...');
        const emailInput = page.locator('input[type="email"]').first();
        const passwordInput = page.locator('input[type="password"]').first();
        const signInButton = page.locator('button:has-text("Sign In")').first();
        
        await emailInput.fill('admin@demo.com');
        await passwordInput.fill('demo123');
        await signInButton.click();
        await page.waitForTimeout(3000);
        
        await page.screenshot({ path: 'step2-after-login.png', fullPage: true });
        console.log('📸 Screenshot: step2-after-login.png');
      }
      
    } catch (error) {
      console.log(`❌ PAGE FAILED TO LOAD: ${error}`);
      await page.screenshot({ path: 'step2-load-failed.png', fullPage: true });
      console.log('📸 Screenshot: step2-load-failed.png');
      return;
    }
    
    console.log('📍 STEP 3: Navigating to Test Bank');
    
    try {
      // Look for Test Bank navigation
      const testBankLinks = await page.locator('a:has-text("Test Bank"), [href*="test-bank"], button:has-text("Test Bank")');
      const testBankCount = await testBankLinks.count();
      
      console.log(`🎯 Test Bank navigation elements found: ${testBankCount}`);
      
      if (testBankCount > 0) {
        await testBankLinks.first().click();
        await page.waitForTimeout(5000);
        
        const testBankUrl = page.url();
        console.log(`📍 Test Bank URL: ${testBankUrl}`);
        
        await page.screenshot({ path: 'step3-test-bank.png', fullPage: true });
        console.log('📸 Screenshot: step3-test-bank.png');
        
        console.log('📍 STEP 4: Counting what is visible');
        
        // Check for Test Bank page elements
        const hasTitle = await page.locator('h1:has-text("Test Bank")').count() > 0;
        const hasTestsTable = await page.locator('table, [data-testid="tests-table"]').count() > 0;
        const testRows = await page.locator('table tbody tr, [data-testid="test-row"]').count();
        const runButtons = await page.locator('button:has-text("Run")').count();
        
        console.log(`✅ Has "Test Bank" title: ${hasTitle}`);
        console.log(`📊 Has tests table: ${hasTestsTable}`);
        console.log(`📈 Visible test rows: ${testRows}`);
        console.log(`🔘 Run buttons count: ${runButtons}`);
        
        // Look for test count numbers
        const pageText = await page.textContent('body');
        const matches156 = pageText?.match(/156/g);
        const matches311 = pageText?.match(/311/g);
        
        console.log(`🔍 Text "156" appears: ${matches156?.length || 0} times`);
        console.log(`🔍 Text "311" appears: ${matches311?.length || 0} times`);
        
        // Check for specific test content
        const hasLoginTests = pageText?.toLowerCase().includes('login') || false;
        const hasAuthTests = pageText?.toLowerCase().includes('auth') || false;
        const hasContactTests = pageText?.toLowerCase().includes('contact') || false;
        
        console.log(`🔍 Contains "login" tests: ${hasLoginTests}`);
        console.log(`🔍 Contains "auth" tests: ${hasAuthTests}`);
        console.log(`🔍 Contains "contact" tests: ${hasContactTests}`);
        
      } else {
        console.log('❌ No Test Bank navigation found');
        await page.screenshot({ path: 'step3-no-test-bank-nav.png', fullPage: true });
      }
      
    } catch (error) {
      console.log(`❌ TEST BANK NAVIGATION FAILED: ${error}`);
      await page.screenshot({ path: 'step3-test-bank-failed.png', fullPage: true });
    }
    
    console.log('📍 STEP 5: Summary of errors');
    console.log(`🚨 Console errors found: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      consoleErrors.forEach((error, i) => {
        console.log(`   ${i + 1}. ${error}`);
      });
    }
    
    console.log(`🌐 Network failures: ${networkFailures.length}`);
    if (networkFailures.length > 0) {
      networkFailures.forEach((failure, i) => {
        console.log(`   ${i + 1}. ${failure}`);
      });
    }
    
    console.log('🏁 VERIFICATION COMPLETE');
  });
});