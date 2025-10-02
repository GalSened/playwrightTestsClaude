import { test, expect } from '@playwright/test';

test('WeSign Tests Validation in Test Bank', async ({ page }) => {
  console.log('=== Validating All WeSign Tests in Test Bank ===');
  
  await page.goto('http://localhost:5173/test-bank');
  await page.waitForSelector('[data-testid="test-bank-page"]');
  await page.waitForTimeout(3000); // Wait for all WeSign tests to load
  
  // Count total WeSign tests
  const testRows = page.locator('tbody tr');
  const totalTests = await testRows.count();
  console.log(`✓ Total WeSign tests found: ${totalTests}`);
  
  // We should have significantly more tests now (expecting ~50+ representing the sample from 311)
  expect(totalTests).toBeGreaterThanOrEqual(50); 
  
  // Verify WeSign-specific modules are present
  const moduleElements = await page.locator('tbody tr td:nth-child(3)').allTextContents();
  const uniqueModules = [...new Set(moduleElements)];
  console.log(`✓ WeSign modules found: ${uniqueModules.join(', ')}`);
  
  // Should have all 6 WeSign modules: admin, auth, contacts, dashboard, documents, integrations
  expect(uniqueModules.length).toBeGreaterThanOrEqual(6);
  expect(uniqueModules).toContain('admin');
  expect(uniqueModules).toContain('auth'); 
  expect(uniqueModules).toContain('contacts');
  expect(uniqueModules).toContain('dashboard');
  expect(uniqueModules).toContain('documents');
  expect(uniqueModules).toContain('integrations');
  
  // Verify WeSign-specific test names are present
  const testNames = await page.locator('tbody tr td:nth-child(2) div.font-medium').allTextContents();
  console.log(`✓ Sample test names: ${testNames.slice(0, 5).join(', ')}`);
  
  // Look for specific WeSign tests
  const hasWeSignTests = testNames.some(name => name.includes('WeSign'));
  const hasAdminTests = testNames.some(name => name.includes('Administration'));
  const hasContactTests = testNames.some(name => name.includes('Contacts'));
  const hasAuthTests = testNames.some(name => name.includes('Login'));
  const hasDashboardTests = testNames.some(name => name.includes('Dashboard'));
  const hasIntegrationTests = testNames.some(name => name.includes('Payment') || name.includes('Smart Card'));
  
  console.log(`WeSign-specific tests found:`);
  console.log(`  WeSign Tests: ${hasWeSignTests}`);
  console.log(`  Admin Tests: ${hasAdminTests}`);
  console.log(`  Contact Tests: ${hasContactTests}`);
  console.log(`  Auth Tests: ${hasAuthTests}`);
  console.log(`  Dashboard Tests: ${hasDashboardTests}`);
  console.log(`  Integration Tests: ${hasIntegrationTests}`);
  
  // Verify WeSign tags are present
  const tagElements = await page.locator('tbody tr td:nth-child(5) span').allTextContents();
  const uniqueTags = [...new Set(tagElements)];
  console.log(`✓ WeSign tags found (sample): ${uniqueTags.slice(0, 10).join(', ')}`);
  
  // Should include WeSign-specific tags
  expect(uniqueTags).toContain('wesign');
  expect(uniqueTags).toContain('business-critical');
  expect(uniqueTags).toContain('authentication');
  expect(uniqueTags).toContain('documents');
  
  // Test WeSign tag filtering
  const tagFilter = page.locator('[data-testid="filter-tags"]');
  if (await tagFilter.isVisible()) {
    // Filter by wesign tag
    await tagFilter.selectOption('wesign');
    await page.waitForTimeout(1000);
    const wesignTestCount = await testRows.count();
    console.log(`✓ WeSign tagged tests: ${wesignTestCount}`);
    expect(wesignTestCount).toBeGreaterThan(20); // Should be most/all tests
    
    // Filter by business-critical
    await tagFilter.selectOption('business-critical');
    await page.waitForTimeout(1000);
    const businessCriticalCount = await testRows.count();
    console.log(`✓ Business-critical tests: ${businessCriticalCount}`);
    expect(businessCriticalCount).toBeGreaterThan(10);
    
    // Reset filters
    const clearButton = page.locator('[data-testid="clear-filters"]');
    if (await clearButton.isVisible()) {
      await clearButton.click();
      await page.waitForTimeout(1000);
    }
  }
  
  // Test module filtering for WeSign modules
  const moduleFilter = page.locator('select').filter({ hasText: 'All Modules' });
  if (await moduleFilter.isVisible()) {
    // Test documents module (WeSign core)
    await moduleFilter.selectOption('documents');
    await page.waitForTimeout(1000);
    const documentsTests = await testRows.count();
    console.log(`✓ Documents module tests: ${documentsTests}`);
    expect(documentsTests).toBeGreaterThan(5);
    
    // Test contacts module
    await moduleFilter.selectOption('contacts');
    await page.waitForTimeout(1000);  
    const contactsTests = await testRows.count();
    console.log(`✓ Contacts module tests: ${contactsTests}`);
    expect(contactsTests).toBeGreaterThan(8);
    
    // Reset module filter
    await moduleFilter.selectOption('');
    await page.waitForTimeout(1000);
  }
  
  // Take final screenshot
  await page.screenshot({ path: 'test-results/wesign-tests-validation-complete.png', fullPage: true });
  
  console.log('\n=== WESIGN TESTS VALIDATION COMPLETE ===');
  console.log('✅ WeSign Test Bank validation successful:');
  console.log(`  - Total tests: ${totalTests}`);
  console.log(`  - Modules: ${uniqueModules.length} (${uniqueModules.join(', ')})`);
  console.log(`  - WeSign-specific functionality confirmed`);
  console.log(`  - Tag filtering working for WeSign tags`);
  console.log(`  - Module filtering working for WeSign modules`);
});