import { test, expect } from '@playwright/test';

test('Quick WeSign Tests Check', async ({ page }) => {
  console.log('=== Quick WeSign Tests Check ===');
  
  await page.goto('http://localhost:5173/test-bank');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  
  // Count total tests
  const testRows = page.locator('tbody tr');
  const totalTests = await testRows.count();
  console.log(`✓ Total tests found: ${totalTests}`);
  
  // Check if we have more tests than before (should be 50+ from our WeSign sample)
  expect(totalTests).toBeGreaterThanOrEqual(40); 
  
  // Check for WeSign-specific test names
  const testNames = await page.locator('tbody tr td:nth-child(2) div.font-medium').allTextContents();
  console.log(`✓ Sample test names: ${testNames.slice(0, 5).join(', ')}`);
  
  // Look for WeSign-specific tests
  const hasWeSignSpecificTests = testNames.some(name => 
    name.includes('WeSign') || 
    name.includes('Administration') || 
    name.includes('Contacts') ||
    name.includes('Payment')
  );
  
  expect(hasWeSignSpecificTests).toBeTruthy();
  console.log('✅ WeSign-specific tests found in Test Bank!');
  
  // Take screenshot
  await page.screenshot({ path: 'test-results/wesign-quick-check.png', fullPage: true });
});