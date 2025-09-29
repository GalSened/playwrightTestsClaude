import { test, expect } from '@playwright/test';

test('Simple smoke test - check if system is accessible', async ({ page }) => {
  console.log('🚀 Starting smoke test...');
  
  // Navigate to the home page
  await page.goto('/');
  
  // Take a screenshot to see what we get
  await page.screenshot({ path: 'homepage-screenshot.png', fullPage: true });
  
  // Check if page loads
  await expect(page).toHaveTitle(/Playwright Smart/);
  console.log('✅ Page title matches');
  
  // Check what elements are present
  const bodyContent = await page.locator('body').textContent();
  console.log('📄 Page content preview:', bodyContent?.substring(0, 200));
  
  // Look for common navigation elements
  const navElements = await page.locator('nav, [data-testid*="nav"], [role="navigation"]').count();
  console.log('🧭 Navigation elements found:', navElements);
  
  // Look for any buttons
  const buttons = await page.locator('button').count();
  console.log('🔘 Buttons found:', buttons);
  
  // Look for any forms
  const forms = await page.locator('form').count();
  console.log('📝 Forms found:', forms);
  
  // Look for any inputs
  const inputs = await page.locator('input').count();
  console.log('📥 Inputs found:', inputs);
  
  // Check if this is a React app
  const reactRoot = await page.locator('#root').count();
  console.log('⚛️ React root found:', reactRoot);
  
  // Wait a bit for any dynamic content to load
  await page.waitForTimeout(3000);
  
  // Take another screenshot after waiting
  await page.screenshot({ path: 'homepage-after-wait.png', fullPage: true });
  
  // Get final page state
  const finalContent = await page.locator('body').textContent();
  console.log('📄 Final page content preview:', finalContent?.substring(0, 300));
  
  console.log('✅ Smoke test completed successfully!');
});