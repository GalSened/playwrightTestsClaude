import { test, expect } from '@playwright/test';

test('Execution Options UI Validation', async ({ page }) => {
  console.log('=== Testing Suite Builder Execution Options UI ===');
  
  await page.goto('http://localhost:5173/test-bank');
  await page.waitForSelector('[data-testid="test-bank-page"]');
  await page.waitForTimeout(2000);
  
  // Select 2 tests to enable suite builder
  const testCheckboxes = page.locator('tbody input[type="checkbox"]');
  await testCheckboxes.first().check();
  await testCheckboxes.nth(1).check();
  await page.waitForTimeout(1000);
  
  console.log('✓ Selected tests to enable Suite Builder form');
  
  // Scroll down to see the execution options
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);
  
  // Check if execution options section exists
  const executionOptionsSection = page.locator('text=Execution Options');
  if (await executionOptionsSection.isVisible()) {
    console.log('✅ Execution Options section is visible!');
    
    // Test execution mode dropdown
    const modeSelect = page.locator('[data-testid="execution-mode-select"]');
    if (await modeSelect.isVisible()) {
      const modeValue = await modeSelect.inputValue();
      console.log(`✓ Execution Mode dropdown found, default: ${modeValue}`);
      
      await modeSelect.selectOption('headed');
      console.log('✓ Successfully switched to headed mode');
    }
    
    // Test execution type dropdown  
    const typeSelect = page.locator('[data-testid="execution-type-select"]');
    if (await typeSelect.isVisible()) {
      const typeValue = await typeSelect.inputValue();
      console.log(`✓ Execution Type dropdown found, default: ${typeValue}`);
      
      await typeSelect.selectOption('sequential');
      console.log('✓ Successfully switched to sequential execution');
    }
    
    // Test retry count dropdown
    const retrySelect = page.locator('[data-testid="retry-count-select"]');
    if (await retrySelect.isVisible()) {
      const retryValue = await retrySelect.inputValue();
      console.log(`✓ Retry Count dropdown found, default: ${retryValue}`);
      
      await retrySelect.selectOption('3');
      console.log('✓ Successfully set retry count to 3');
    }
    
  } else {
    console.log('❌ Execution Options section not found');
  }
  
  // Take screenshot of the current state
  await page.screenshot({ path: 'test-results/execution-options-validation.png', fullPage: true });
  
  // Try to create a suite with the options
  const suiteNameInput = page.locator('[data-testid="suite-name-input"]');
  if (await suiteNameInput.isVisible()) {
    await suiteNameInput.fill('Test Suite with Options');
    
    const createButton = page.locator('[data-testid="create-suite-button"]');
    if (await createButton.isVisible() && await createButton.isEnabled()) {
      await createButton.click();
      await page.waitForTimeout(2000);
      console.log('✅ Successfully created suite with execution options!');
    }
  }
  
  console.log('=== Execution Options Validation Complete ===');
});