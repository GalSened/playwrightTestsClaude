import { test, expect } from '@playwright/test';

test.describe('Live Debug Session', () => {
  test('Real-time debugging of login issue', async ({ page }) => {
    console.log('🔍 LIVE DEBUG SESSION - Finding the exact issue');
    
    // Monitor ALL network activity
    page.on('request', request => {
      if (request.url().includes('api') || request.url().includes('8082') || request.url().includes('8081')) {
        console.log(`📤 API REQUEST: ${request.method()} ${request.url()}`);
        if (request.postData()) {
          console.log(`   Data: ${request.postData()}`);
        }
      }
    });
    
    page.on('response', response => {
      if (response.url().includes('api') || response.url().includes('8082') || response.url().includes('8081')) {
        console.log(`📥 API RESPONSE: ${response.status()} ${response.url()}`);
      }
    });
    
    // Monitor console messages for errors
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.text().includes('CORS') || msg.text().includes('failed')) {
        console.log(`❌ CONSOLE ERROR: ${msg.text()}`);
      }
    });
    
    // Step 1: Go to the page
    console.log('📍 Navigating to http://localhost:3001');
    await page.goto('http://localhost:3001');
    
    // Wait for page to fully load
    await page.waitForTimeout(5000);
    console.log('✅ Page loaded, checking current state...');
    
    // Check what port the frontend is actually trying to connect to
    const apiClientCode = await page.evaluate(() => {
      // Try to find the API base URL in the global scope or localStorage
      return {
        localStorage: Object.keys(localStorage).map(key => ({key, value: localStorage.getItem(key)})),
        windowLocation: window.location.href,
        // Check if apiClient is available globally
        apiClientInfo: typeof window !== 'undefined' && (window as any).apiClient ? 'Found' : 'Not found'
      };
    });
    
    console.log('🔍 Frontend state check:');
    console.log(`   Current URL: ${apiClientCode.windowLocation}`);
    console.log(`   LocalStorage: ${JSON.stringify(apiClientCode.localStorage)}`);
    
    // Fill the login form
    console.log('📝 Filling login form...');
    const emailField = page.locator('input[type="email"]').first();
    const passwordField = page.locator('input[type="password"]').first();
    const signInButton = page.locator('button:has-text("Sign In")').first();
    
    await emailField.clear();
    await emailField.fill('admin@demo.com');
    await passwordField.clear(); 
    await passwordField.fill('demo123');
    
    console.log('🔐 About to click Sign In - monitoring network...');
    
    // Click and wait for network activity
    const responsePromise = page.waitForResponse(
      response => response.url().includes('/api/auth/login'),
      { timeout: 10000 }
    ).catch(() => null);
    
    await signInButton.click();
    console.log('✅ Sign In clicked, waiting for API response...');
    
    const response = await responsePromise;
    
    if (response) {
      console.log(`📥 LOGIN RESPONSE RECEIVED: ${response.status()}`);
      const responseBody = await response.text();
      console.log(`   Response body: ${responseBody.substring(0, 200)}...`);
    } else {
      console.log('❌ NO LOGIN API RESPONSE RECEIVED');
      console.log('   This indicates the request is not reaching the backend');
    }
    
    // Wait and check final state
    await page.waitForTimeout(3000);
    
    const finalUrl = page.url();
    console.log(`🎯 Final URL: ${finalUrl}`);
    
    // Check for any error messages on page
    const errorMessages = await page.locator('[class*="error"], [class*="Error"], .text-red, .text-danger').allTextContents();
    if (errorMessages.length > 0) {
      console.log('❌ Error messages found:');
      errorMessages.forEach(msg => console.log(`   ${msg}`));
    } else {
      console.log('✅ No visible error messages on page');
    }
    
    console.log('');
    console.log('🔧 DIAGNOSIS COMPLETE');
    
    if (finalUrl.includes('/auth/login')) {
      console.log('❌ PROBLEM: Still on login page');
      console.log('💡 LIKELY CAUSES:');
      console.log('   1. Frontend still connecting to wrong port (8081 instead of 8082)');
      console.log('   2. CORS still blocking the request');
      console.log('   3. Frontend cache not cleared');
      console.log('   4. JavaScript error preventing form submission');
    } else {
      console.log('✅ SUCCESS: Navigated away from login page');
    }
  });
});