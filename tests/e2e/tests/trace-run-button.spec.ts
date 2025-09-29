import { test, expect } from '@playwright/test';

test.describe('Trace Run Button Execution', () => {
  test('Track exactly what happens when Run is clicked', async ({ page }) => {
    console.log('🔍 TRACING RUN BUTTON EXECUTION');
    
    // Capture all network activity
    const networkRequests: string[] = [];
    const networkResponses: string[] = [];
    const consoleErrors: string[] = [];
    
    page.on('request', request => {
      const requestInfo = `${request.method()} ${request.url()}`;
      networkRequests.push(requestInfo);
      console.log(`📤 REQUEST: ${requestInfo}`);
      
      // Log request body for POST requests
      if (request.method() === 'POST') {
        console.log(`   POST Body: ${request.postData()}`);
      }
    });
    
    page.on('response', response => {
      const responseInfo = `${response.status()} ${response.url()}`;
      networkResponses.push(responseInfo);
      console.log(`📥 RESPONSE: ${responseInfo}`);
      
      // Log response body for API calls
      if (response.url().includes('/api/')) {
        response.text().then(body => {
          console.log(`   Response Body: ${body.substring(0, 200)}${body.length > 200 ? '...' : ''}`);
        }).catch(() => {});
      }
    });
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
        console.log(`🚨 CONSOLE ERROR: ${msg.text()}`);
      }
      // Also capture regular console logs that might show API calls
      if (msg.type() === 'log' && (msg.text().includes('API') || msg.text().includes('fetch') || msg.text().includes('execution'))) {
        console.log(`💬 CONSOLE LOG: ${msg.text()}`);
      }
    });
    
    // Navigate to Test Bank
    console.log('📍 Step 1: Loading Test Bank');
    await page.goto('http://localhost:3001/test-bank');
    await page.waitForTimeout(3000);
    
    // Find the first Run button
    const runButtons = page.locator('button:has-text("Run")');
    const runButtonCount = await runButtons.count();
    console.log(`🎯 Found ${runButtonCount} Run buttons`);
    
    if (runButtonCount > 0) {
      console.log('📍 Step 2: Clicking first Run button');
      
      // Clear previous network activity
      networkRequests.length = 0;
      networkResponses.length = 0;
      consoleErrors.length = 0;
      
      // Click the first Run button
      await runButtons.first().click();
      
      // Wait to see what happens
      console.log('⏳ Waiting 5 seconds to capture all activity...');
      await page.waitForTimeout(5000);
      
      console.log('📊 EXECUTION TRACE RESULTS:');
      console.log(`   Network Requests Made: ${networkRequests.length}`);
      networkRequests.forEach((req, i) => {
        console.log(`   ${i + 1}. ${req}`);
      });
      
      console.log(`   Network Responses: ${networkResponses.length}`);
      networkResponses.forEach((res, i) => {
        console.log(`   ${i + 1}. ${res}`);
      });
      
      console.log(`   Console Errors: ${consoleErrors.length}`);
      consoleErrors.forEach((err, i) => {
        console.log(`   ${i + 1}. ${err}`);
      });
      
      // Check if there were any API calls
      const apiRequests = networkRequests.filter(req => req.includes('/api/'));
      const executionRequests = networkRequests.filter(req => req.includes('execute') || req.includes('pytest'));
      
      console.log(`🔍 API-related requests: ${apiRequests.length}`);
      console.log(`🔍 Execution-related requests: ${executionRequests.length}`);
      
      if (apiRequests.length === 0) {
        console.log('❌ NO API CALLS MADE - Run button is not connected to backend');
      } else {
        console.log('✅ API calls detected');
      }
      
    } else {
      console.log('❌ No Run buttons found');
    }
    
    console.log('🏁 Run button trace complete');
  });
});