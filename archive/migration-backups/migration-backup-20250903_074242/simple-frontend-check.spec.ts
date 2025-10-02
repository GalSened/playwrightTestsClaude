import { test, expect } from '@playwright/test';

test('Simple Frontend Application Check', async ({ page }) => {
  console.log('=== Testing Local Frontend Application ===');
  
  // Test our local React application
  await page.goto('http://localhost:3003/');
  await page.waitForLoadState('networkidle', { timeout: 10000 });
  
  // Check if the page loads successfully
  const title = await page.title();
  console.log(`✓ Page title: ${title}`);
  
  // Check for basic React elements
  const hasContent = await page.locator('body').textContent();
  console.log(`✓ Page has content: ${hasContent ? hasContent.length > 0 : false}`);
  
  // Take screenshot
  await page.screenshot({ 
    path: 'test-results/local-frontend-check.png', 
    fullPage: true 
  });
  
  // Basic assertion that the page loaded
  expect(title.length).toBeGreaterThan(0);
  console.log('✅ Local frontend application is running and accessible!');
});