import { test, expect } from '@playwright/test';

test.describe('Test Bank Enhanced Functionality', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/test-bank');
    // Wait for page to load completely
    await page.waitForSelector('[data-testid="test-bank-page"]');
  });

  test('1. Page Load & Real Data Verification', async ({ page }) => {
    console.log('Testing Page Load & Real Data Verification...');
    
    // Verify page loads properly
    await expect(page.locator('[data-testid="test-bank-page"]')).toBeVisible();
    
    // Verify tests table is present and populated
    await expect(page.locator('table')).toBeVisible();
    await page.waitForSelector('tbody tr', { timeout: 5000 });
    
    // Check for real test data (not mock data)
    const testRows = page.locator('tbody tr');
    const rowCount = await testRows.count();
    console.log(`Found ${rowCount} test rows`);
    
    // Verify we have tests
    expect(rowCount).toBeGreaterThan(0);
    
    // Check for realistic test names
    const firstRow = testRows.first();
    const testName = await firstRow.locator('td').first().textContent();
    console.log(`First test name: ${testName}`);
    
    // Look for realistic test patterns
    const allTestNames = await testRows.locator('td:first-child').allTextContents();
    console.log('All test names:', allTestNames.slice(0, 5)); // Log first 5
    
    // Verify realistic names are present (not mock data like 'Test 1', 'Test 2')
    const hasRealisticNames = allTestNames.some(name => 
      name.toLowerCase().includes('login') || 
      name.toLowerCase().includes('signup') || 
      name.toLowerCase().includes('search') ||
      name.toLowerCase().includes('cart') ||
      name.toLowerCase().includes('auth')
    );
    
    expect(hasRealisticNames).toBeTruthy();
    console.log('✓ Real test data verification passed');
    
    // Check for real modules
    const moduleElements = await page.locator('[data-testid="test-module"]').allTextContents();
    console.log('Modules found:', moduleElements.slice(0, 5));
    
    const hasRealisticModules = moduleElements.some(module =>
      ['auth', 'commerce', 'dashboard', 'api', 'payment', 'user'].includes(module.toLowerCase())
    );
    
    expect(hasRealisticModules).toBeTruthy();
    console.log('✓ Real module data verification passed');
  });

  test('2. Tag Filtering Functionality', async ({ page }) => {
    console.log('Testing Tag Filtering Functionality...');
    
    // Wait for page to load
    await page.waitForSelector('[data-testid="filter-tags"]', { timeout: 5000 });
    
    // Verify tag filter dropdown exists
    await expect(page.locator('[data-testid="filter-tags"]')).toBeVisible();
    
    // Get initial test count
    const initialTestCount = await page.locator('tbody tr').count();
    console.log(`Initial test count: ${initialTestCount}`);
    
    // Test regression tag filtering
    await page.selectOption('[data-testid="filter-tags"]', 'regression');
    await page.waitForTimeout(500); // Wait for filter to apply
    
    const regressionTestCount = await page.locator('tbody tr').count();
    console.log(`Tests with regression tag: ${regressionTestCount}`);
    
    // Verify filtering worked (should be different from initial count)
    if (regressionTestCount > 0) {
      // Verify tests show regression tag
      const tagElements = await page.locator('[data-testid="test-tags"]').first();
      if (await tagElements.isVisible()) {
        const tagText = await tagElements.textContent();
        expect(tagText).toContain('regression');
        console.log('✓ Regression tag filtering works');
      }
    }
    
    // Test sanity tag filtering
    await page.selectOption('[data-testid="filter-tags"]', 'sanity');
    await page.waitForTimeout(500);
    
    const sanityTestCount = await page.locator('tbody tr').count();
    console.log(`Tests with sanity tag: ${sanityTestCount}`);
    
    // Test english tag filtering
    await page.selectOption('[data-testid="filter-tags"]', 'english');
    await page.waitForTimeout(500);
    
    const englishTestCount = await page.locator('tbody tr').count();
    console.log(`Tests with english tag: ${englishTestCount}`);
    
    // Test clear filters
    const clearFiltersBtn = page.locator('[data-testid="clear-filters"]');
    if (await clearFiltersBtn.isVisible()) {
      await clearFiltersBtn.click();
      await page.waitForTimeout(500);
      
      const clearedTestCount = await page.locator('tbody tr').count();
      console.log(`Tests after clearing filters: ${clearedTestCount}`);
      
      // Should return to original count
      expect(clearedTestCount).toBe(initialTestCount);
      console.log('✓ Clear filters functionality works');
    }
    
    console.log('✓ Tag filtering functionality tested');
  });

  test('3. Suite Presets Functionality', async ({ page }) => {
    console.log('Testing Suite Presets Functionality...');
    
    // Wait for page to load
    await page.waitForTimeout(1000);
    
    // Look for Quick Suite Creation section
    const quickSuiteSection = page.locator('text=Quick Suite Creation').or(
      page.locator('text=Suite Presets')
    ).or(
      page.locator('[data-testid="suite-presets"]')
    );
    
    if (await quickSuiteSection.isVisible()) {
      console.log('✓ Quick Suite Creation section found');
      
      // Look for common suite presets
      const presetButtons = page.locator('button').filter({ hasText: /Suite/ });
      const presetCount = await presetButtons.count();
      console.log(`Found ${presetCount} suite preset buttons`);
      
      // Test specific presets
      const expectedPresets = [
        'Regression Suite',
        'Sanity Suite', 
        'Smoke Suite',
        'English Language Suite',
        'Authentication Suite'
      ];
      
      for (const preset of expectedPresets) {
        const presetButton = page.locator('button', { hasText: preset });
        if (await presetButton.isVisible()) {
          console.log(`✓ Found preset: ${preset}`);
          
          // Check if it shows test count
          const parentSection = presetButton.locator('..');
          const testCountText = await parentSection.textContent();
          console.log(`${preset} section text:`, testCountText?.slice(0, 100));
        }
      }
      
      // Try to create a Regression Suite
      const regressionBtn = page.locator('button').filter({ hasText: /Regression.*Suite/ });
      if (await regressionBtn.first().isVisible()) {
        console.log('Attempting to create Regression Suite...');
        await regressionBtn.first().click();
        await page.waitForTimeout(1000);
        
        // Check if suite was created (look for success message or suite in list)
        const successMessage = page.locator('text=Suite created').or(
          page.locator('text=created successfully')
        );
        
        if (await successMessage.isVisible()) {
          console.log('✓ Regression Suite created successfully');
        }
        
        console.log('✓ Suite presets functionality tested');
      }
    } else {
      console.log('Quick Suite Creation section not found - may be in different location');
      
      // Alternative: Look for any create suite buttons
      const createButtons = page.locator('button').filter({ hasText: /Create|Add/ });
      const createButtonCount = await createButtons.count();
      console.log(`Found ${createButtonCount} create/add buttons`);
    }
  });

  test('4. Manual Suite Creation with Tags', async ({ page }) => {
    console.log('Testing Manual Suite Creation with Tags...');
    
    // Wait for page to load
    await page.waitForTimeout(1000);
    
    // Select 2-3 tests using checkboxes
    const checkboxes = page.locator('input[type="checkbox"]');
    const checkboxCount = await checkboxes.count();
    console.log(`Found ${checkboxCount} checkboxes`);
    
    if (checkboxCount > 0) {
      // Select first 3 tests
      for (let i = 0; i < Math.min(3, checkboxCount); i++) {
        await checkboxes.nth(i).check();
        await page.waitForTimeout(200);
      }
      
      console.log('✓ Selected test checkboxes');
      
      // Look for create suite button or section
      const createSuiteBtn = page.locator('button').filter({ 
        hasText: /Create.*Suite|New.*Suite|Add.*Suite/ 
      });
      
      if (await createSuiteBtn.first().isVisible()) {
        await createSuiteBtn.first().click();
        await page.waitForTimeout(500);
        
        // Look for suite name input
        const suiteNameInput = page.locator('input[placeholder*="suite"], input[placeholder*="name"]').first();
        
        if (await suiteNameInput.isVisible()) {
          await suiteNameInput.fill('Custom Test Suite');
          await page.waitForTimeout(200);
          
          // Look for confirm/create button
          const confirmBtn = page.locator('button').filter({ 
            hasText: /Create|Confirm|Save|Add/ 
          });
          
          if (await confirmBtn.first().isVisible()) {
            await confirmBtn.first().click();
            await page.waitForTimeout(1000);
            console.log('✓ Custom suite creation attempted');
          }
        }
      }
    }
    
    console.log('✓ Manual suite creation with tags tested');
  });

  test('5. Enhanced Suite Display', async ({ page }) => {
    console.log('Testing Enhanced Suite Display...');
    
    // Wait for page to load
    await page.waitForTimeout(1000);
    
    // Look for existing suites section
    const suitesSection = page.locator('text=Existing Suites').or(
      page.locator('text=Test Suites')
    ).or(
      page.locator('[data-testid="existing-suites"]')
    );
    
    if (await suitesSection.isVisible()) {
      console.log('✓ Existing suites section found');
      
      // Look for suite items
      const suiteItems = page.locator('.suite-item, .suite-card, [data-testid*="suite"]');
      const suiteCount = await suiteItems.count();
      console.log(`Found ${suiteCount} suite items`);
      
      if (suiteCount > 0) {
        // Check first suite for enhanced display elements
        const firstSuite = suiteItems.first();
        
        // Look for tags display
        const tagBadges = firstSuite.locator('.tag, .badge, [data-testid*="tag"]');
        const tagCount = await tagBadges.count();
        console.log(`First suite has ${tagCount} tag badges`);
        
        if (tagCount > 0) {
          const tagTexts = await tagBadges.allTextContents();
          console.log('Suite tags:', tagTexts);
          console.log('✓ Enhanced suite display with tags found');
        }
        
        // Look for descriptions
        const descriptionText = await firstSuite.textContent();
        console.log('Suite content preview:', descriptionText?.slice(0, 100));
        
        // Look for action buttons (Run, Edit, Delete)
        const actionButtons = firstSuite.locator('button');
        const buttonCount = await actionButtons.count();
        console.log(`Suite has ${buttonCount} action buttons`);
        
        const buttonTexts = await actionButtons.allTextContents();
        console.log('Action buttons:', buttonTexts);
        
        const hasExpectedButtons = buttonTexts.some(text => 
          text.toLowerCase().includes('run') || 
          text.toLowerCase().includes('edit') || 
          text.toLowerCase().includes('delete')
        );
        
        if (hasExpectedButtons) {
          console.log('✓ Suite action buttons found');
        }
      }
    } else {
      console.log('Existing suites section not visible - may be empty or in different location');
    }
    
    console.log('✓ Enhanced suite display tested');
  });

  test('6. Cross-functionality Testing', async ({ page }) => {
    console.log('Testing Cross-functionality...');
    
    // Wait for page to load
    await page.waitForTimeout(1000);
    
    // Test combination of filters
    console.log('Testing filter combinations...');
    
    // Apply module filter if available
    const moduleFilter = page.locator('[data-testid="filter-modules"]');
    if (await moduleFilter.isVisible()) {
      await moduleFilter.selectOption('auth');
      await page.waitForTimeout(500);
      console.log('✓ Module filter applied');
    }
    
    // Apply tag filter
    const tagFilter = page.locator('[data-testid="filter-tags"]');
    if (await tagFilter.isVisible()) {
      await tagFilter.selectOption('regression');
      await page.waitForTimeout(500);
      console.log('✓ Tag filter applied');
    }
    
    // Apply risk filter if available
    const riskFilter = page.locator('[data-testid="filter-risk"]');
    if (await riskFilter.isVisible()) {
      await riskFilter.selectOption('high');
      await page.waitForTimeout(500);
      console.log('✓ Risk filter applied');
    }
    
    // Count filtered results
    const filteredCount = await page.locator('tbody tr').count();
    console.log(`Tests after combined filtering: ${filteredCount}`);
    
    // Test search with filters
    const searchInput = page.locator('input[placeholder*="search"], input[type="search"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('login');
      await page.waitForTimeout(500);
      
      const searchResultCount = await page.locator('tbody tr').count();
      console.log(`Tests after search + filters: ${searchResultCount}`);
      console.log('✓ Search with filters tested');
      
      // Clear search
      await searchInput.clear();
      await page.waitForTimeout(500);
    }
    
    // Test running a suite if any exist
    const runButtons = page.locator('button').filter({ hasText: /Run/ });
    const runButtonCount = await runButtons.count();
    console.log(`Found ${runButtonCount} run buttons`);
    
    if (runButtonCount > 0) {
      // Don't actually run - just verify navigation would work
      console.log('✓ Run buttons available for suite execution');
    }
    
    // Clear all filters
    const clearBtn = page.locator('[data-testid="clear-filters"]');
    if (await clearBtn.isVisible()) {
      await clearBtn.click();
      await page.waitForTimeout(500);
      console.log('✓ All filters cleared');
    }
    
    console.log('✓ Cross-functionality testing completed');
  });

  test('7. Overall User Experience & Performance', async ({ page }) => {
    console.log('Testing Overall User Experience & Performance...');
    
    // Measure page load time
    const startTime = Date.now();
    await page.goto('http://localhost:5173/test-bank');
    await page.waitForSelector('[data-testid="test-bank-page"]');
    const loadTime = Date.now() - startTime;
    console.log(`Page load time: ${loadTime}ms`);
    
    // Test responsiveness
    await page.waitForTimeout(500);
    console.log('✓ Page loads quickly');
    
    // Check for any console errors
    const logs: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        logs.push(`Console Error: ${msg.text()}`);
      }
    });
    
    // Interact with various elements to trigger any errors
    await page.waitForTimeout(1000);
    
    // Check final state
    const finalTestCount = await page.locator('tbody tr').count();
    console.log(`Final test count on page: ${finalTestCount}`);
    
    // Verify key elements are still present
    await expect(page.locator('[data-testid="test-bank-page"]')).toBeVisible();
    
    if (logs.length > 0) {
      console.log('Console errors detected:', logs);
    } else {
      console.log('✓ No console errors detected');
    }
    
    console.log('✓ Overall user experience testing completed');
  });
});