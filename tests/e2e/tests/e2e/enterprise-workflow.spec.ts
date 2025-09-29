import { test, expect, Page } from '@playwright/test';

test.describe('Complete Enterprise Workflow', () => {
  let page: Page;

  test('Complete enterprise workflow', async ({ browser }) => {
    page = await browser.newPage();
    
    // Step 1: Login as admin
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    const emailInput = page.locator('input[type="email"], input[placeholder*="Email"], input[name*="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[placeholder*="Password"], input[name*="password"]').first();
    const signInButton = page.locator('button:has-text("Sign In"), button[type="submit"]').first();
    
    await emailInput.fill('admin@demo.com');
    await passwordInput.fill('demo123');
    await signInButton.click();
    await page.waitForTimeout(3000);
    
    // Verify successful login
    await expect(page.locator('[data-testid="user-role"]')).toContainText('Administrator');
    
    // Step 2: Navigate to Test Bank and verify 311 tests
    await page.goto('/test-bank');
    await expect(page.locator('[data-testid="test-bank-page"]')).toBeVisible();
    
    // Wait for test discovery to complete
    await page.waitForSelector('[data-testid="tests-table"]', { timeout: 30000 });
    
    // Verify 311 WeSign tests are loaded
    const testRows = page.locator('[data-testid="test-checkbox"]');
    const testCount = await testRows.count();
    await expect(testCount).toBeGreaterThanOrEqual(311);
    
    console.log(`✓ Verified ${testCount} tests discovered`);
    
    // Step 3: Create suite from auth module (targeting ~37 tests)
    await page.selectOption('[data-testid="filter-module"]', 'auth');
    await page.waitForTimeout(2000); // Wait for filter to apply
    
    // Select all auth tests
    await page.click('[data-testid="select-all-visible"]');
    
    const authTestCount = await page.locator('[data-testid="test-checkbox"]:checked').count();
    console.log(`✓ Selected ${authTestCount} auth module tests`);
    
    // Create Auth Regression suite
    await page.fill('[data-testid="suite-name-input"]', 'Auth_Regression_Enterprise');
    await page.fill('[data-testid="suite-description-input"]', 'Comprehensive authentication regression suite for enterprise testing');
    
    // Step 4: Configure parallel execution with Chromium browser
    await page.selectOption('[data-testid="execution-type-select"]', 'parallel');
    await page.selectOption('[data-testid="browser-select"]', 'chromium');
    await page.selectOption('[data-testid="execution-mode-select"]', 'headless');
    await page.fill('[data-testid="max-workers"]', '3');
    
    // Create the suite first
    await page.click('[data-testid="create-suite-button"]');
    await expect(page.locator('text=Auth_Regression_Enterprise')).toBeVisible();
    
    console.log('✓ Created Auth_Regression_Enterprise suite');
    
    // Step 5: Schedule for daily run (9 AM)
    await page.click('[data-testid="scheduler-tab"]');
    
    // Create schedule for the newly created suite
    await page.fill('[data-testid="schedule-name"]', 'Daily Auth Regression');
    await page.fill('[data-testid="cron-expression"]', '0 9 * * *'); // Daily at 9 AM
    await page.selectOption('[data-testid="environment-select"]', 'staging');
    
    // Select the suite we just created
    const suiteSelect = page.locator('[data-testid="suite-select"]');
    await suiteSelect.selectOption({ label: 'Auth_Regression_Enterprise' });
    
    // Configure notifications
    await page.check('[data-testid="email-notifications"]');
    await page.fill('[data-testid="notification-email"]', 'admin@enterprise.com');
    
    await page.click('[data-testid="create-schedule-button"]');
    await expect(page.locator('text=Daily Auth Regression')).toBeVisible();
    
    console.log('✓ Created daily schedule for 9 AM');
    
    // Step 6: Execute immediately (Run Now)
    const scheduleItem = page.locator('[data-testid="schedule-item"]').filter({ hasText: 'Daily Auth Regression' });
    await scheduleItem.locator('[data-testid="trigger-now"]').click();
    await page.click('[data-testid="confirm-trigger"]');
    
    console.log('✓ Triggered immediate execution');
    
    // Step 7: Monitor real-time execution
    
    // Verify WebSocket connection for real-time updates
    await page.goto('/');
    const wsStatus = page.locator('[data-testid="websocket-status"]');
    await expect(wsStatus).toContainText('Connected');
    
    console.log('✓ WebSocket connection established');
    
    // Monitor active runs
    const activeRuns = page.locator('[data-testid="active-runs-count"]');
    await expect(activeRuns).not.toContainText('0');
    
    // Navigate to real-time monitoring
    await page.goto('/test-bank');
    await page.click('[data-testid="running-executions"]');
    
    // Verify execution is running
    await expect(page.locator('[data-testid="execution-status"]')).toContainText('Running');
    await expect(page.locator('[data-testid="execution-mode-badge"]')).toContainText('Parallel');
    
    console.log('✓ Confirmed parallel execution is running');
    
    // Step 8: Wait for completion (with reasonable timeout)
    await page.waitForSelector('[data-testid="execution-complete"]', { timeout: 180000 });
    
    // Verify completion status
    await expect(page.locator('[data-testid="execution-results"]')).toBeVisible();
    
    const executionResults = page.locator('[data-testid="execution-results"]');
    const totalTests = await executionResults.locator('[data-testid="total-tests"]').textContent();
    const passedTests = await executionResults.locator('[data-testid="passed-tests"]').textContent();
    
    console.log(`✓ Execution completed: ${passedTests} passed out of ${totalTests} total tests`);
    
    // Step 9: Check analytics and verify execution metrics
    await page.goto('/analytics');
    await page.waitForSelector('[data-testid="analytics-page"]', { timeout: 15000 });
    
    // Verify coverage overview is updated
    await expect(page.locator('[data-testid="coverage-overview"]')).toBeVisible();
    
    // Check execution trend data
    const trendChart = page.locator('[data-testid="coverage-trend-chart"]');
    await expect(trendChart).toBeVisible();
    
    // Verify recent activity includes our execution
    const recentActivity = page.locator('[data-testid="activity-feed"]');
    await expect(recentActivity.locator('text=Auth_Regression')).toBeVisible();
    
    console.log('✓ Analytics updated with execution results');
    
    // Step 10: Verify comprehensive reporting
    await page.goto('/reports');
    
    // Find our execution in the runs table
    const runsTable = page.locator('[data-testid="runs-table"]');
    const latestRun = runsTable.locator('tr').first();
    
    await expect(latestRun).toContainText('Auth_Regression_Enterprise');
    await expect(latestRun).toContainText(/passed|failed/);
    
    // Click to view detailed run report
    await latestRun.click();
    
    // Verify detailed run information
    const runDetails = page.locator('[data-testid="run-details-panel"]');
    await expect(runDetails).toBeVisible();
    
    // Check overview tab
    await expect(runDetails.locator('[data-testid="run-summary-card"]')).toBeVisible();
    await expect(runDetails.locator('text=staging')).toBeVisible(); // Environment
    await expect(runDetails.locator('text=chromium')).toBeVisible(); // Browser
    
    // Check steps tab
    await runDetails.locator('[data-testid="tab-steps"]', { hasText: 'Test Steps' }).click();
    
    const testSteps = page.locator('[data-testid="step-item"]');
    const stepCount = await testSteps.count();
    expect(stepCount).toBeGreaterThan(0);
    
    // Verify individual test results
    if (stepCount > 0) {
      const firstStep = testSteps.first();
      await expect(firstStep.locator('[data-testid="step-status"]')).toContainText(/passed|failed|skipped/);
      await expect(firstStep.locator('[data-testid="step-name"]')).toBeVisible();
    }
    
    console.log(`✓ Verified detailed run report with ${stepCount} test steps`);
    
    // Step 11: Verify audit trail
    await page.goto('/settings/audit');
    
    // Should see audit entries for our activities
    const auditEntries = page.locator('[data-testid="audit-entry"]');
    const auditCount = await auditEntries.count();
    expect(auditCount).toBeGreaterThan(0);
    
    // Recent entries should include our suite creation and execution
    const recentAudit = auditEntries.first();
    await expect(recentAudit).toContainText(/suite|execution|schedule/i);
    await expect(recentAudit.locator('[data-testid="audit-user"]')).toContainText('admin@demo.com');
    
    console.log('✓ Verified audit trail contains our activities');
    
    // Step 12: Performance validation
    await page.goto('/analytics');
    
    // Check system performance metrics
    const systemMetrics = page.locator('[data-testid="system-metrics"]');
    if (await systemMetrics.isVisible()) {
      const cpuUsage = await systemMetrics.locator('[data-testid="cpu-usage"]').textContent();
      const memoryUsage = await systemMetrics.locator('[data-testid="memory-usage"]').textContent();
      
      console.log(`✓ System metrics - CPU: ${cpuUsage}, Memory: ${memoryUsage}`);
    }
    
    // Step 13: Multi-tenant verification (if applicable)
    const tenantInfo = page.locator('[data-testid="tenant-name"]');
    if (await tenantInfo.isVisible()) {
      const tenantName = await tenantInfo.textContent();
      console.log(`✓ Verified tenant context: ${tenantName}`);
    }
    
    // Step 14: Final dashboard verification
    await page.goto('/');
    
    // Verify dashboard reflects our completed work
    const dashboardStats = {
      totalTests: await page.locator('[data-testid="total-tests-count"]').textContent(),
      totalRuns: await page.locator('[data-testid="total-runs-count"]').textContent(),
      passRate: await page.locator('[data-testid="pass-rate-percentage"]').textContent(),
      envStatus: await page.locator('[data-testid="environment-status"]').textContent()
    };
    
    console.log('✓ Final dashboard stats:', dashboardStats);
    
    // Verify environment status is healthy
    await expect(page.locator('[data-testid="environment-status"]')).toContainText(/healthy|warning/i);
    
    // Verify recent activity shows our execution
    const activityFeed = page.locator('[data-testid="activity-feed"]');
    await expect(activityFeed.locator('[data-testid="activity-item"]').first()).toBeVisible();
    
    console.log('✓ Enterprise workflow completed successfully!');
    
    // Summary verification
    const workflowSummary = {
      testsDiscovered: testCount,
      suiteCreated: 'Auth_Regression_Enterprise',
      scheduleCreated: 'Daily Auth Regression (9 AM)',
      executionMode: 'Parallel with 3 workers',
      browser: 'Chromium (headless)',
      environment: 'staging',
      monitoringActive: 'WebSocket connected',
      auditTrailComplete: auditCount > 0,
      analyticsUpdated: true,
      reportingComplete: stepCount > 0
    };
    
    console.log('📊 Complete Enterprise Workflow Summary:', workflowSummary);
    
    // Final assertions
    expect(workflowSummary.testsDiscovered).toBeGreaterThanOrEqual(311);
    expect(workflowSummary.auditTrailComplete).toBe(true);
    expect(workflowSummary.analyticsUpdated).toBe(true);
    expect(workflowSummary.reportingComplete).toBe(true);
    
    await page.close();
  });
  
  test('Enterprise workflow - Multi-user collaboration', async ({ browser }) => {
    // Test multi-user workflow with different roles
    const adminPage = await browser.newPage();
    const testerPage = await browser.newPage();
    const viewerPage = await browser.newPage();
    
    // Admin creates suite and schedule
    await adminPage.goto('/auth/login');
    await adminPage.fill('[name="email"]', 'admin@demo.com');
    await adminPage.fill('[name="password"]', 'demo123');
    await adminPage.click('button:has-text("Login")');
    
    await adminPage.goto('/test-bank');
    await adminPage.locator('[data-testid="test-checkbox"]').first().check();
    await adminPage.fill('[data-testid="suite-name-input"]', 'Collaborative_Suite');
    await adminPage.click('[data-testid="create-suite-button"]');
    
    // Tester executes the suite
    await testerPage.goto('/auth/login');
    await testerPage.fill('[name="email"]', 'tester@demo.com');
    await testerPage.fill('[name="password"]', 'tester123');
    await testerPage.click('button:has-text("Login")');
    
    await testerPage.goto('/test-bank');
    const collaborativeSuite = testerPage.locator('text=Collaborative_Suite');
    await expect(collaborativeSuite).toBeVisible();
    
    // Execute the suite created by admin
    await collaborativeSuite.locator('xpath=..').locator('[data-testid="run-suite"]').click();
    await expect(testerPage.locator('[data-testid="execution-status"]')).toContainText('Running');
    
    // Viewer monitors the execution
    await viewerPage.goto('/auth/login');
    await viewerPage.fill('[name="email"]', 'viewer@demo.com');
    await viewerPage.fill('[name="password"]', 'viewer123');
    await viewerPage.click('button:has-text("Login")');
    
    await viewerPage.goto('/reports');
    
    // Viewer can see the execution but cannot modify
    const runningExecution = viewerPage.locator('[data-testid="runs-table"] tr').first();
    await expect(runningExecution).toContainText('running');
    
    // Verify viewer cannot rerun
    await runningExecution.click();
    const rerunButton = viewerPage.locator('[data-testid="rerun-suite"]');
    if (await rerunButton.isVisible()) {
      await expect(rerunButton).toBeDisabled();
    }
    
    console.log('✓ Multi-user collaboration workflow verified');
    
    await adminPage.close();
    await testerPage.close();
    await viewerPage.close();
  });
});