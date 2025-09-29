import { test, expect } from '@playwright/test';

test.describe('System Diagnostic', () => {
  test('Check current system state on port 3001', async ({ page }) => {
  console.log('🔍 Diagnosing system on port 3001...');
  
  // Navigate to port 3001
  await page.goto('http://localhost:3001');
  
  // Wait for page to load
  await page.waitForTimeout(5000);
  
  // Take screenshot
  await page.screenshot({ path: 'current-system-state.png', fullPage: true });
  
  // Get page content
  const pageContent = await page.textContent('body');
  console.log('📄 Page content:', pageContent?.substring(0, 500));
  
  // Check if login form elements exist
  const emailInputs = await page.locator('input[type="email"], input[name*="email"], input[placeholder*="Email"]').count();
  const passwordInputs = await page.locator('input[type="password"], input[name*="password"], input[placeholder*="Password"]').count();
  const buttons = await page.locator('button').count();
  
  console.log('🔍 Form elements found:');
  console.log(`   Email inputs: ${emailInputs}`);
  console.log(`   Password inputs: ${passwordInputs}`);
  console.log(`   Buttons: ${buttons}`);
  
  // Check for any error messages
  const errorMessages = await page.locator('[class*="error"], [class*="Error"], .alert, .warning').count();
  console.log(`   Error messages: ${errorMessages}`);
  
  // Get page title
  const title = await page.title();
  console.log(`   Page title: ${title}`);
  
  // Check console errors
  const logs: string[] = [];
  page.on('console', msg => logs.push(`CONSOLE: ${msg.text()}`));
  page.on('pageerror', error => logs.push(`ERROR: ${error.message}`));
  
  await page.waitForTimeout(2000);
  
  if (logs.length > 0) {
    console.log('📋 Console logs/errors:');
    logs.forEach(log => console.log(`   ${log}`));
  }
  
  // Check network requests
  const responses: string[] = [];
  page.on('response', response => {
    responses.push(`${response.status()} ${response.url()}`);
  });
  
  await page.reload();
  await page.waitForTimeout(3000);
  
  console.log('🌐 Recent network responses:');
  responses.slice(-10).forEach(response => console.log(`   ${response}`));
  });
});