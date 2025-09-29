import { test, expect, Page } from '@playwright/test';

test.describe('Test Execution Modes - Parallel & Sequential', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    
    // Login as admin
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@demo.com');
    await page.fill('[name="password"]', 'demo123');
    await page.click('button:has-text("Login")');
    
    await page.goto('/test-bank');
    await page.waitForLoadState('networkidle');
  });

  test('Parallel execution of 5 tests', async () => {
    // Select exactly 5 tests for parallel execution
    for (let i = 0; i < 5; i++) {
      await page.locator('[data-testid="test-checkbox"]').nth(i).check();
    }
    
    // Verify 5 tests are selected
    await expect(page.locator('[data-testid="selected-tests-count"]')).toContainText('5 tests selected');
    
    // Configure for parallel execution
    await page.fill('[data-testid="suite-name-input"]', 'Parallel Suite Test');
    await page.selectOption('[data-testid="execution-type-select"]', 'parallel');
    await page.selectOption('[data-testid="execution-mode-select"]', 'headless');
    await page.fill('[data-testid="max-workers"]', '3'); // Run with 3 parallel workers
    
    // Record start time
    const startTime = Date.now();
    
    // Execute the suite
    await page.click('[data-testid="create-and-run-suite"]');
    
    // Verify parallel execution indicators
    await expect(page.locator('[data-testid="execution-mode-badge"]')).toContainText('Parallel');
    await expect(page.locator('[data-testid="worker-count"]')).toContainText('3 workers');
    
    // Monitor execution progress
    await expect(page.locator('[data-testid="execution-status"]')).toContainText('Running');
    
    // Verify multiple tests are running simultaneously
    const runningTests = page.locator('[data-testid="running-test-item"]');
    
    // In parallel execution, should see multiple tests running at once
    await expect(runningTests).toHaveCount(3, { timeout: 10000 }); // Up to 3 workers
    
    // Wait for completion
    await page.waitForSelector('[data-testid="execution-complete"]', { timeout: 120000 });
    
    const endTime = Date.now();
    const totalDuration = endTime - startTime;
    
    // Verify execution results
    await expect(page.locator('[data-testid="execution-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-tests"]')).toContainText('5');
    
    // Navigate to reports to verify results
    await page.goto('/reports');
    
    const latestRun = page.locator('[data-testid="runs-table"] tr').first();
    await expect(latestRun).toContainText('Parallel Suite Test');
    await expect(latestRun).toContainText(/passed|failed/);
    
    // Verify parallel execution was more efficient than sequential would be
    // (This is a rough estimate - parallel should be significantly faster)
    console.log(`Parallel execution completed in ${totalDuration}ms`);
  });

  test('Sequential execution of same 5 tests', async () => {
    // Select the same 5 tests for sequential execution
    for (let i = 0; i < 5; i++) {
      await page.locator('[data-testid="test-checkbox"]').nth(i).check();
    }
    
    // Configure for sequential execution
    await page.fill('[data-testid="suite-name-input"]', 'Sequential Suite Test');
    await page.selectOption('[data-testid="execution-type-select"]', 'sequential');
    await page.selectOption('[data-testid="execution-mode-select"]', 'headless');
    
    // Record start time
    const startTime = Date.now();
    
    // Execute the suite
    await page.click('[data-testid="create-and-run-suite"]');
    
    // Verify sequential execution indicators
    await expect(page.locator('[data-testid="execution-mode-badge"]')).toContainText('Sequential');
    await expect(page.locator('[data-testid="worker-count"]')).toContainText('1 worker');
    
    // Monitor execution progress
    await expect(page.locator('[data-testid="execution-status"]')).toContainText('Running');
    
    // In sequential execution, should only see one test running at a time
    const runningTests = page.locator('[data-testid="running-test-item"]');
    
    // Should only see 1 test running at a time in sequential mode
    await expect(runningTests).toHaveCount(1, { timeout: 10000 });
    
    // Verify test execution order (tests should run one after another)
    const testProgressList = page.locator('[data-testid="test-progress-list"]');
    
    // Wait a bit to see progress
    await page.waitForTimeout(5000);
    
    // Verify sequential progress pattern
    const completedTests = await testProgressList.locator('[data-testid="test-completed"]').count();
    const runningTest = await testProgressList.locator('[data-testid="test-running"]').count();
    const pendingTests = await testProgressList.locator('[data-testid="test-pending"]').count();
    
    expect(runningTest).toBeLessThanOrEqual(1); // At most 1 running
    expect(completedTests + runningTest + pendingTests).toBe(5); // Total of 5 tests
    
    // Wait for completion
    await page.waitForSelector('[data-testid="execution-complete"]', { timeout: 180000 }); // Longer timeout for sequential
    
    const endTime = Date.now();
    const totalDuration = endTime - startTime;
    
    // Verify results
    await expect(page.locator('[data-testid="execution-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-tests"]')).toContainText('5');
    
    console.log(`Sequential execution completed in ${totalDuration}ms`);
  });

  test('Mixed mode execution (some parallel, some sequential)', async () => {
    // Create a complex suite with mixed execution requirements
    
    // First, create a group for parallel execution
    for (let i = 0; i < 3; i++) {
      await page.locator('[data-testid="test-checkbox"]').nth(i).check();
    }
    
    await page.click('[data-testid="create-execution-group"]');
    await page.fill('[data-testid="group-name"]', 'Parallel Group');
    await page.selectOption('[data-testid="group-execution-type"]', 'parallel');
    await page.click('[data-testid="save-group"]');
    
    // Clear selection and create sequential group
    await page.click('[data-testid="clear-selection"]');
    
    for (let i = 3; i < 5; i++) {
      await page.locator('[data-testid="test-checkbox"]').nth(i).check();
    }
    
    await page.click('[data-testid="create-execution-group"]');
    await page.fill('[data-testid="group-name"]', 'Sequential Group');
    await page.selectOption('[data-testid="group-execution-type"]', 'sequential');
    await page.click('[data-testid="save-group"]');
    
    // Configure overall suite execution
    await page.fill('[data-testid="suite-name-input"]', 'Mixed Mode Suite');
    await page.selectOption('[data-testid="suite-execution-strategy"]', 'mixed');
    
    // Define execution order: Parallel Group first, then Sequential Group
    await page.selectOption('[data-testid="group-execution-order"]', 'parallel-first');
    
    // Execute mixed mode suite
    await page.click('[data-testid="create-and-run-suite"]');
    
    // Verify mixed mode indicators
    await expect(page.locator('[data-testid="execution-mode-badge"]')).toContainText('Mixed');
    
    // Monitor execution pattern
    const executionLog = page.locator('[data-testid="execution-log"]');
    await expect(executionLog).toBeVisible();
    
    // Should see parallel group executing first (multiple tests running)
    await expect(executionLog.locator('text=Parallel Group: Starting')).toBeVisible();
    
    // Wait for parallel group to complete and sequential to start
    await expect(executionLog.locator('text=Sequential Group: Starting')).toBeVisible({ timeout: 60000 });
    
    // Wait for completion
    await page.waitForSelector('[data-testid="execution-complete"]', { timeout: 180000 });
    
    // Verify execution summary shows mixed mode details
    const executionSummary = page.locator('[data-testid="execution-summary"]');
    await expect(executionSummary).toContainText('Mixed Mode');
    await expect(executionSummary).toContainText('2 groups');
  });

  test('Browser selection - Chromium, Firefox, WebKit', async () => {
    const browsers = ['chromium', 'firefox', 'webkit'];
    
    for (const browser of browsers) {
      // Select a test
      await page.locator('[data-testid="test-checkbox"]').first().check();
      
      // Configure browser-specific execution
      await page.fill('[data-testid="suite-name-input"]', `${browser.charAt(0).toUpperCase() + browser.slice(1)} Suite`);
      await page.selectOption('[data-testid="browser-select"]', browser);
      await page.selectOption('[data-testid="execution-mode-select"]', 'headless');
      
      // Execute suite
      await page.click('[data-testid="create-and-run-suite"]');
      
      // Verify browser selection
      await expect(page.locator('[data-testid="browser-badge"]')).toContainText(browser);
      
      // Wait for execution to start
      await expect(page.locator('[data-testid="execution-status"]')).toContainText('Running');
      
      // Monitor browser-specific execution
      const executionDetails = page.locator('[data-testid="execution-details"]');
      await expect(executionDetails).toContainText(browser);
      
      // Wait for completion
      await page.waitForSelector('[data-testid="execution-complete"]', { timeout: 120000 });
      
      // Verify browser was used correctly
      await page.goto('/reports');
      const latestRun = page.locator('[data-testid="runs-table"] tr').first();
      
      // Check run details for browser info
      await latestRun.click();
      const runDetails = page.locator('[data-testid="run-details-panel"]');
      await expect(runDetails).toContainText(browser);
      
      // Return to test bank for next browser test
      await page.goto('/test-bank');
      await page.click('[data-testid="clear-selection"]');
    }
  });

  test('Headed vs Headless modes comparison', async () => {
    const executionModes = ['headless', 'headed'];
    const results = [];
    
    for (const mode of executionModes) {
      // Select same test for both modes
      await page.locator('[data-testid="test-checkbox"]').first().check();
      
      // Configure execution mode
      await page.fill('[data-testid="suite-name-input"]', `${mode.charAt(0).toUpperCase() + mode.slice(1)} Mode Test`);
      await page.selectOption('[data-testid="execution-mode-select"]', mode);
      await page.selectOption('[data-testid="browser-select"]', 'chromium');
      
      // Record start time
      const startTime = Date.now();
      
      // Execute suite
      await page.click('[data-testid="create-and-run-suite"]');
      
      // Verify execution mode
      await expect(page.locator('[data-testid="mode-badge"]')).toContainText(mode);
      
      // For headed mode, verify additional UI elements
      if (mode === 'headed') {
        await expect(page.locator('[data-testid="browser-visibility-notice"]')).toContainText('Browser window will be visible');
      }
      
      // Wait for completion
      await page.waitForSelector('[data-testid="execution-complete"]', { timeout: 180000 });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      results.push({ mode, duration });
      
      // Clear for next iteration
      await page.click('[data-testid="clear-selection"]');
      await page.waitForTimeout(2000);
    }
    
    // Compare results (headless is typically faster)
    const headlessResult = results.find(r => r.mode === 'headless');
    const headedResult = results.find(r => r.mode === 'headed');
    
    console.log(`Headless execution: ${headlessResult?.duration}ms`);
    console.log(`Headed execution: ${headedResult?.duration}ms`);
    
    // Typically headless should be faster, but not always guaranteed in test environment
    expect(headlessResult?.duration).toBeLessThan(300000); // Should complete within 5 minutes
    expect(headedResult?.duration).toBeLessThan(400000); // Headed might take a bit longer
  });

  test('Resource optimization verification', async () => {
    // Test resource-conscious execution
    await page.goto('/test-bank');
    
    // Select multiple tests (10 tests)
    for (let i = 0; i < 10; i++) {
      await page.locator('[data-testid="test-checkbox"]').nth(i).check();
    }
    
    await page.fill('[data-testid="suite-name-input"]', 'Resource Optimized Suite');
    
    // Configure resource optimization settings
    await page.selectOption('[data-testid="execution-type-select"]', 'parallel');
    await page.fill('[data-testid="max-workers"]', '2'); // Limit to 2 workers
    await page.fill('[data-testid="memory-limit-mb"]', '1024'); // 1GB memory limit
    await page.fill('[data-testid="cpu-limit-percent"]', '50'); // 50% CPU limit
    
    // Enable resource monitoring
    await page.check('[data-testid="enable-resource-monitoring"]');
    
    // Execute suite
    await page.click('[data-testid="create-and-run-suite"]');
    
    // Verify resource constraints are applied
    await expect(page.locator('[data-testid="resource-constraints"]')).toBeVisible();
    await expect(page.locator('[data-testid="max-workers-display"]')).toContainText('2');
    await expect(page.locator('[data-testid="memory-limit-display"]')).toContainText('1024 MB');
    
    // Monitor resource usage during execution
    const resourceMonitor = page.locator('[data-testid="resource-monitor"]');
    await expect(resourceMonitor).toBeVisible();
    
    // Check that resource usage stays within limits
    const cpuUsage = resourceMonitor.locator('[data-testid="cpu-usage"]');
    const memoryUsage = resourceMonitor.locator('[data-testid="memory-usage"]');
    
    // Wait for some execution time to measure resources
    await page.waitForTimeout(10000);
    
    // Verify resources are being monitored
    await expect(cpuUsage).toBeVisible();
    await expect(memoryUsage).toBeVisible();
    
    // Check that CPU usage doesn't exceed limit (with some tolerance)
    const cpuText = await cpuUsage.textContent();
    const cpuPercent = parseInt(cpuText?.match(/(\d+)%/)?.[1] || '0');
    expect(cpuPercent).toBeLessThanOrEqual(70); // 50% + 20% tolerance
    
    // Wait for completion
    await page.waitForSelector('[data-testid="execution-complete"]', { timeout: 300000 });
    
    // Verify resource optimization report
    const resourceReport = page.locator('[data-testid="resource-optimization-report"]');
    await expect(resourceReport).toBeVisible();
    
    await expect(resourceReport.locator('[data-testid="peak-cpu-usage"]')).toBeVisible();
    await expect(resourceReport.locator('[data-testid="peak-memory-usage"]')).toBeVisible();
    await expect(resourceReport.locator('[data-testid="resource-efficiency-score"]')).toBeVisible();
  });

  test('Execution retry and failure handling', async () => {
    // Select tests that might have flaky behavior
    await page.locator('[data-testid="test-checkbox"]').first().check();
    
    await page.fill('[data-testid="suite-name-input"]', 'Retry Test Suite');
    
    // Configure retry settings
    await page.selectOption('[data-testid="retry-count"]', '2'); // 2 retries
    await page.check('[data-testid="retry-on-failure"]');
    await page.fill('[data-testid="retry-delay-seconds"]', '5'); // 5-second delay between retries
    
    // Execute suite
    await page.click('[data-testid="create-and-run-suite"]');
    
    // Verify retry configuration is active
    await expect(page.locator('[data-testid="retry-config-display"]')).toContainText('2 retries');
    await expect(page.locator('[data-testid="retry-delay-display"]')).toContainText('5s delay');
    
    // Monitor for retry behavior (if test fails)
    const executionLog = page.locator('[data-testid="execution-log"]');
    
    // Wait for completion
    await page.waitForSelector('[data-testid="execution-complete"]', { timeout: 300000 });
    
    // Check execution results
    const executionResults = page.locator('[data-testid="execution-results"]');
    await expect(executionResults).toBeVisible();
    
    // If there were retries, verify they are logged
    const retryEntries = executionLog.locator('[data-testid="retry-entry"]');
    const retryCount = await retryEntries.count();
    
    if (retryCount > 0) {
      // Verify retry information is captured
      await expect(retryEntries.first()).toContainText('Retry attempt');
      await expect(retryEntries.first()).toContainText(/\d+ of \d+/); // "1 of 2" format
    }
    
    // Navigate to detailed report
    await page.goto('/reports');
    const latestRun = page.locator('[data-testid="runs-table"] tr').first();
    await latestRun.click();
    
    // Check retry details in run report
    const runDetails = page.locator('[data-testid="run-details-panel"]');
    await runDetails.locator('[data-testid="tab-steps"]').click();
    
    // Verify retry information is preserved in the report
    const testSteps = page.locator('[data-testid="step-item"]');
    if (await testSteps.count() > 0) {
      const firstStep = testSteps.first();
      await firstStep.click(); // Expand details
      
      // If there were retries, should see retry information
      const stepDetails = firstStep.locator('[data-testid="step-details"]');
      if (retryCount > 0) {
        await expect(stepDetails).toContainText(/retry|attempt/i);
      }
    }
  });

  test.afterEach(async () => {
    await page.close();
  });
});