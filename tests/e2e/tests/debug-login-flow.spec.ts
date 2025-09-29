import { test, expect } from '@playwright/test';

test.describe('Debug Login Flow with Network Monitoring', () => {
  test('Debug login with full network monitoring', async ({ page }) => {
    console.log('🚀 Starting debug login with network monitoring...');
    
    // Monitor all network requests
    const requests: any[] = [];
    const responses: any[] = [];
    
    page.on('request', request => {
      requests.push({
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        postData: request.postData()
      });
      console.log(`📤 REQUEST: ${request.method()} ${request.url()}`);
    });
    
    page.on('response', response => {
      responses.push({
        url: response.url(),
        status: response.status(),
        statusText: response.statusText()
      });
      console.log(`📥 RESPONSE: ${response.status()} ${response.url()}`);
    });
    
    // Monitor console logs
    page.on('console', msg => {
      console.log(`🖥️  CONSOLE ${msg.type()}: ${msg.text()}`);
    });
    
    // Monitor page errors
    page.on('pageerror', error => {
      console.log(`❌ PAGE ERROR: ${error.message}`);
    });
    
    // Step 1: Navigate to login page
    console.log('📍 Step 1: Navigating to http://localhost:3001');
    await page.goto('http://localhost:3001');
    await page.waitForTimeout(3000);
    
    // Step 2: Fill credentials
    console.log('📝 Step 2: Filling credentials');
    const emailField = page.locator('input[type="email"]').first();
    const passwordField = page.locator('input[type="password"]').first();
    const signInButton = page.locator('button:has-text("Sign In")').first();
    
    await emailField.fill('admin@demo.com');
    await passwordField.fill('demo123');
    
    // Step 3: Monitor login attempt
    console.log('🔐 Step 3: Clicking Sign In and monitoring requests...');
    
    // Clear previous requests/responses
    requests.length = 0;
    responses.length = 0;
    
    // Click login and wait for network activity
    await signInButton.click();
    
    // Wait for potential network requests
    await page.waitForTimeout(5000);
    
    // Analyze network activity
    console.log('🌐 Network Activity Analysis:');
    console.log(`   Total Requests: ${requests.length}`);
    console.log(`   Total Responses: ${responses.length}`);
    
    // Check for login API calls
    const loginRequests = requests.filter(req => 
      req.url.includes('/api/auth/login') || req.url.includes('/login')
    );
    
    console.log(`   Login API Requests: ${loginRequests.length}`);
    
    if (loginRequests.length > 0) {
      loginRequests.forEach((req, i) => {
        console.log(`   Login Request ${i + 1}:`);
        console.log(`     URL: ${req.url}`);
        console.log(`     Method: ${req.method}`);
        console.log(`     Data: ${req.postData || 'No data'}`);
      });
    } else {
      console.log('   ⚠️  NO LOGIN API REQUESTS DETECTED');
    }
    
    // Check for any API requests to backend
    const backendRequests = requests.filter(req => 
      req.url.includes('localhost:8081') || req.url.includes('/api/')
    );
    
    console.log(`   Backend API Requests: ${backendRequests.length}`);
    
    if (backendRequests.length > 0) {
      backendRequests.forEach((req, i) => {
        console.log(`   Backend Request ${i + 1}: ${req.method} ${req.url}`);
      });
    } else {
      console.log('   ⚠️  NO BACKEND API REQUESTS DETECTED');
    }
    
    // Check current page state
    const currentUrl = page.url();
    const pageContent = await page.textContent('body');
    
    console.log('📋 Final State:');
    console.log(`   Current URL: ${currentUrl}`);
    console.log(`   Still on login page: ${currentUrl.includes('/auth/login') ? 'YES' : 'NO'}`);
    
    // Look for error messages
    const errorElements = await page.locator('[class*="error"], [class*="Error"], .alert-error').count();
    if (errorElements > 0) {
      const errorText = await page.locator('[class*="error"], [class*="Error"], .alert-error').first().textContent();
      console.log(`   Error Message: ${errorText}`);
    } else {
      console.log('   No visible error messages');
    }
    
    // Take final screenshot
    await page.screenshot({ path: 'debug-login-final.png', fullPage: true });
    console.log('📸 Final screenshot saved as debug-login-final.png');
    
    console.log('🏁 Debug login analysis complete!');
  });
});