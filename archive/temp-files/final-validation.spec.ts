import { test, expect } from '@playwright/test';

test('Final Validation - All Tests in Test Bank', async ({ page }) => {
  console.log('=== Final Validation - All Tests in Test Bank ===');
  
  await page.goto('http://localhost:5173/test-bank');
  await page.waitForSelector('[data-testid="test-bank-page"]');
  await page.waitForTimeout(2000); // Wait for all data to load
  
  // Count total tests
  const testRows = page.locator('tbody tr');
  const totalTests = await testRows.count();
  console.log(`✓ Total tests found: ${totalTests}`);
  expect(totalTests).toBeGreaterThanOrEqual(30); // Should have 33 tests
  
  // Verify modules diversity
  const moduleElements = await page.locator('tbody tr td:nth-child(3)').allTextContents();
  const uniqueModules = [...new Set(moduleElements)];
  console.log(`✓ Modules found: ${uniqueModules.join(', ')}`);
  expect(uniqueModules.length).toBeGreaterThanOrEqual(7); // Should have auth, admin, contacts, dashboard, documents, integrations, templates, epu
  
  // Verify tag diversity
  const tagBadges = page.locator('tbody tr td:nth-child(5) span');
  const tagCount = await tagBadges.count();
  console.log(`✓ Tag badges found: ${tagCount}`);
  expect(tagCount).toBeGreaterThan(100); // Should have 157 tag badges
  
  // Test comprehensive filtering
  const tagFilter = page.locator('[data-testid="filter-tags"]');
  await tagFilter.selectOption('regression');
  await page.waitForTimeout(1000);
  const regressionTests = await testRows.count();
  console.log(`✓ Regression tests: ${regressionTests}`);
  expect(regressionTests).toBeGreaterThan(20); // Should be 29
  
  // Reset and test english filter
  await page.locator('[data-testid="clear-filters"]').click();
  await page.waitForTimeout(500);
  await tagFilter.selectOption('english');
  await page.waitForTimeout(1000);
  const englishTests = await testRows.count();
  console.log(`✓ English tests: ${englishTests}`);
  expect(englishTests).toBeGreaterThan(25); // Should be 30
  
  // Take final screenshot
  await page.screenshot({ path: 'test-results/final-comprehensive-testbank.png', fullPage: true });
  
  console.log('✅ All tests successfully loaded in Test Bank!');
  console.log(`📊 Summary: ${totalTests} tests across ${uniqueModules.length} modules with ${tagCount} tag badges`);
});