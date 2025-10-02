import { test, expect } from '@playwright/test';

test('Test Bank - Test Steps Implementation Validation', async ({ page }) => {
  console.log('=== Validating Test Steps Implementation & No Duplicates ===');
  
  await page.goto('http://localhost:5173/test-bank');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  
  // 1. VERIFY TEST STEPS COLUMN EXISTS
  console.log('\n1. Testing Test Steps Column Implementation...');
  
  // Check if Test Steps column header exists
  const stepsHeader = page.locator('th:has-text("Test Steps")');
  await expect(stepsHeader).toBeVisible();
  console.log('✓ Test Steps column header found');
  
  // Verify old Tags column is gone
  const tagsHeader = page.locator('th:has-text("Tags")');
  expect(await tagsHeader.count()).toBe(0);
  console.log('✓ Tags column successfully replaced');
  
  // 2. VALIDATE TEST STEPS CONTENT
  console.log('\n2. Validating Test Steps Content...');
  
  const testRows = page.locator('tbody tr');
  const totalTests = await testRows.count();
  console.log(`✓ Total unique tests found: ${totalTests}`);
  
  // Check that we have fewer tests now (removed duplicates)
  expect(totalTests).toBeLessThan(50); // Should be around 21 unique tests
  expect(totalTests).toBeGreaterThan(15); // But still substantial
  
  // 3. VERIFY SEMANTIC TEST STEPS FORMAT
  console.log('\n3. Testing Semantic Test Steps Format...');
  
  const firstTestSteps = page.locator('tbody tr:first-child [data-testid="test-steps"]');
  await expect(firstTestSteps).toBeVisible();
  
  // Check for numbered steps format
  const stepItems = firstTestSteps.locator('li');
  const stepCount = await stepItems.count();
  console.log(`✓ First test has ${stepCount} visible steps`);
  expect(stepCount).toBeGreaterThanOrEqual(3); // Should show at least 3 steps
  
  // Verify step numbering and semantic content
  const firstStep = stepItems.first();
  const stepNumber = firstStep.locator('span.text-accent').first();
  await expect(stepNumber).toHaveText('1.');
  console.log('✓ Step numbering format correct');
  
  const stepText = await firstStep.locator('span:not(.text-accent)').textContent();
  expect(stepText?.length).toBeGreaterThan(10); // Should have meaningful content
  console.log(`✓ First step content: "${stepText?.slice(0, 30)}..."`);
  
  // 4. TEST UNIQUE TEST NAMES (NO DUPLICATES)
  console.log('\n4. Validating No Duplicate Tests...');
  
  const testNames = await page.locator('tbody tr td:nth-child(2) div.font-medium').allTextContents();
  const uniqueNames = new Set(testNames);
  
  console.log(`Total tests: ${testNames.length}, Unique names: ${uniqueNames.size}`);
  expect(testNames.length).toBe(uniqueNames.size); // Should be equal (no duplicates)
  console.log('✓ No duplicate test names found');
  
  // Log some test names for verification
  console.log(`Sample test names: ${Array.from(uniqueNames).slice(0, 5).join(', ')}`);
  
  // 5. VERIFY WESIGN-SPECIFIC TEST CATEGORIES
  console.log('\n5. Testing WeSign Test Categories...');
  
  const hasUserManagement = testNames.some(name => name.includes('User Management'));
  const hasDocumentWorkflow = testNames.some(name => name.includes('Document Workflow') || name.includes('Upload'));
  const hasContactManagement = testNames.some(name => name.includes('Contact'));
  const hasAuthentication = testNames.some(name => name.includes('Login') || name.includes('Authentication'));
  
  expect(hasUserManagement).toBeTruthy();
  expect(hasDocumentWorkflow).toBeTruthy();
  expect(hasContactManagement).toBeTruthy();
  expect(hasAuthentication).toBeTruthy();
  
  console.log('✓ WeSign core test categories present:');
  console.log(`  - User Management: ${hasUserManagement}`);
  console.log(`  - Document Workflow: ${hasDocumentWorkflow}`);
  console.log(`  - Contact Management: ${hasContactManagement}`);
  console.log(`  - Authentication: ${hasAuthentication}`);
  
  // 6. VERIFY TEST STEPS SHOW MORE THAN 3
  console.log('\n6. Testing "More Steps" Indicator...');
  
  const moreStepsIndicator = page.locator('[data-testid="test-steps"] li:has-text("more steps")');
  const moreStepsCount = await moreStepsIndicator.count();
  console.log(`✓ Found ${moreStepsCount} tests with "more steps" indicator`);
  expect(moreStepsCount).toBeGreaterThan(0); // Should have tests with >3 steps
  
  // 7. TEST MODULE DIVERSITY
  console.log('\n7. Validating Module Diversity...');
  
  const moduleElements = await page.locator('tbody tr td:nth-child(3)').allTextContents();
  const uniqueModules = [...new Set(moduleElements)];
  console.log(`✓ Modules found: ${uniqueModules.join(', ')}`);
  
  // Should have all core WeSign modules
  expect(uniqueModules).toContain('admin');
  expect(uniqueModules).toContain('auth');
  expect(uniqueModules).toContain('contacts');
  expect(uniqueModules).toContain('documents');
  expect(uniqueModules.length).toBeGreaterThanOrEqual(6); // Should have 6 modules
  
  // 8. VERIFY SEMANTIC STEP CONTENT QUALITY
  console.log('\n8. Testing Step Content Quality...');
  
  // Get all step texts from multiple tests
  const allStepTexts = await page.locator('[data-testid="test-steps"] li span:not(.text-accent)').allTextContents();
  
  // Check for semantic, action-oriented steps
  const hasNavigationSteps = allStepTexts.some(step => step.toLowerCase().includes('navigate'));
  const hasActionSteps = allStepTexts.some(step => step.toLowerCase().includes('click') || step.toLowerCase().includes('enter'));
  const hasValidationSteps = allStepTexts.some(step => step.toLowerCase().includes('verify') || step.toLowerCase().includes('validate'));
  
  expect(hasNavigationSteps).toBeTruthy();
  expect(hasActionSteps).toBeTruthy();
  expect(hasValidationSteps).toBeTruthy();
  
  console.log('✓ Semantic step content quality verified:');
  console.log(`  - Navigation steps: ${hasNavigationSteps}`);
  console.log(`  - Action steps: ${hasActionSteps}`);
  console.log(`  - Validation steps: ${hasValidationSteps}`);
  
  // Take final screenshot
  await page.screenshot({ path: 'test-results/test-steps-validation-complete.png', fullPage: true });
  
  console.log('\n=== TEST STEPS IMPLEMENTATION VALIDATION COMPLETE ===');
  console.log('✅ All validations successful:');
  console.log(`  - Test Steps column implemented replacing Tags`);
  console.log(`  - ${totalTests} unique tests (duplicates removed)`);
  console.log(`  - Semantic step content with proper numbering`);
  console.log(`  - ${uniqueModules.length} WeSign modules covered`);
  console.log(`  - Quality action-oriented test steps`);
});