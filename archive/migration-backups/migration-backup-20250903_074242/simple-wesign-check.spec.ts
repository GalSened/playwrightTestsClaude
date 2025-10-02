import { test, expect } from '@playwright/test';

test('Simple WeSign Application Check', async ({ page }) => {
  console.log('=== Testing WeSign Application Accessibility ===');
  
  // Test the actual WeSign application
  await page.goto('https://devtest.comda.co.il');
  await page.waitForLoadState('networkidle');
  
  // Check if the page loads successfully
  const title = await page.title();
  console.log(`✓ Page title: ${title}`);
  
  // Take screenshot
  await page.screenshot({ 
    path: 'test-results/wesign-application-check.png', 
    fullPage: true 
  });
  
  // Check for login form or basic elements
  const hasLoginElements = await page.locator('input[type="email"], input[type="password"], [data-testid="login"], [class*="login"], [id*="login"]').count() > 0;
  console.log(`✓ Has login elements: ${hasLoginElements}`);
  
  // Basic assertion that the page loaded
  expect(title.length).toBeGreaterThan(0);
  console.log('✅ WeSign application is accessible and responding!');
});