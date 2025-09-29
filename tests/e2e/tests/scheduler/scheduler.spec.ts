import { test, expect, Page } from '@playwright/test';

test.describe('Cron-Based Test Scheduler', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    
    // Login as admin
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    const emailInput = page.locator('input[type="email"], input[placeholder*="Email"], input[name*="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[placeholder*="Password"], input[name*="password"]').first();
    const signInButton = page.locator('button:has-text("Sign In"), button[type="submit"]').first();
    
    await emailInput.fill('admin@demo.com');
    await passwordInput.fill('demo123');
    await signInButton.click();
    await page.waitForTimeout(3000);
    
    // Navigate to Test Bank and then Scheduler
    await page.goto('/test-bank');
    await page.click('[data-testid="scheduler-tab"]');
    await page.waitForLoadState('networkidle');
  });

  test('Create daily schedule (9 AM)', async () => {
    // First create a test suite to schedule
    await page.click('[data-testid="tests-tab"]');
    await page.locator('[data-testid="test-checkbox"]').first().check();
    await page.fill('[data-testid="suite-name-input"]', 'Daily Regression');
    await page.click('[data-testid="create-suite-button"]');
    
    // Switch to scheduler tab
    await page.click('[data-testid="scheduler-tab"]');
    
    // Create daily schedule
    const scheduleForm = page.locator('[data-testid="schedule-form"]');
    await expect(scheduleForm).toBeVisible();
    
    await page.fill('[data-testid="schedule-name"]', 'Daily 9AM Regression');
    await page.fill('[data-testid="cron-expression"]', '0 9 * * *');
    await page.selectOption('[data-testid="environment-select"]', 'staging');
    await page.selectOption('[data-testid="suite-select"]', { label: 'Daily Regression' });
    
    // Configure notification settings
    await page.check('[data-testid="email-notifications"]');
    await page.fill('[data-testid="notification-email"]', 'admin@company.com');
    
    // Save schedule
    await page.click('[data-testid="create-schedule-button"]');
    
    // Verify schedule appears in list
    const scheduleList = page.locator('[data-testid="schedule-list"]');
    await expect(scheduleList.locator('text=Daily 9AM Regression')).toBeVisible();
    
    // Verify cron expression is correct
    await expect(scheduleList.locator('text=0 9 * * *')).toBeVisible();
    
    // Verify next run time is displayed
    await expect(scheduleList.locator('[data-testid="next-run"]')).toBeVisible();
  });

  test('Create hourly schedule', async () => {
    // Create hourly smoke test schedule
    await page.fill('[data-testid="schedule-name"]', 'Hourly Smoke Tests');
    await page.fill('[data-testid="cron-expression"]', '0 * * * *');
    await page.selectOption('[data-testid="environment-select"]', 'development');
    
    // Set resource limits for frequent execution
    await page.fill('[data-testid="max-parallel"]', '2');
    await page.fill('[data-testid="timeout-minutes"]', '30');
    
    await page.click('[data-testid="create-schedule-button"]');
    
    // Verify schedule created
    await expect(page.locator('text=Hourly Smoke Tests')).toBeVisible();
    await expect(page.locator('text=0 * * * *')).toBeVisible();
  });

  test('Create weekly schedule', async () => {
    // Create comprehensive weekly schedule
    await page.fill('[data-testid="schedule-name"]', 'Weekly Full Regression');
    await page.fill('[data-testid="cron-expression"]', '0 2 * * 1'); // Monday 2AM
    await page.selectOption('[data-testid="environment-select"]', 'production');
    
    // Configure advanced options
    await page.check('[data-testid="slack-notifications"]');
    await page.fill('[data-testid="slack-webhook"]', 'https://hooks.slack.com/services/test');
    
    // Set retry configuration
    await page.fill('[data-testid="max-retries"]', '3');
    await page.check('[data-testid="retry-on-failure"]');
    
    await page.click('[data-testid="create-schedule-button"]');
    
    // Verify weekly schedule
    await expect(page.locator('text=Weekly Full Regression')).toBeVisible();
    await expect(page.locator('text=0 2 * * 1')).toBeVisible();
  });

  test('Test environment targeting (dev, staging, prod)', async () => {
    const environments = ['development', 'staging', 'production'];
    
    for (const env of environments) {
      const scheduleName = `${env.toUpperCase()} Environment Test`;
      
      await page.fill('[data-testid="schedule-name"]', scheduleName);
      await page.fill('[data-testid="cron-expression"]', '0 10 * * *');
      await page.selectOption('[data-testid="environment-select"]', env);
      
      // Verify environment-specific configurations are available
      if (env === 'production') {
        // Production should have additional safety checks
        await expect(page.locator('[data-testid="require-approval"]')).toBeVisible();
        await page.check('[data-testid="require-approval"]');
      }
      
      await page.click('[data-testid="create-schedule-button"]');
      
      // Verify environment is correctly displayed
      const scheduleItem = page.locator('[data-testid="schedule-item"]').filter({ hasText: scheduleName });
      await expect(scheduleItem.locator('[data-testid="environment-badge"]')).toContainText(env);
      
      // Clear form for next iteration
      await page.click('[data-testid="clear-form"]');
    }
  });

  test('Test conditional execution rules', async () => {
    await page.fill('[data-testid="schedule-name"]', 'Conditional Execution Test');
    await page.fill('[data-testid="cron-expression"]', '0 8 * * 1-5'); // Weekdays only
    
    // Configure conditions
    await page.click('[data-testid="add-condition"]');
    
    // Only run if previous tests passed
    await page.selectOption('[data-testid="condition-type"]', 'previous_run_status');
    await page.selectOption('[data-testid="condition-value"]', 'passed');
    
    // Add resource availability condition
    await page.click('[data-testid="add-condition"]');
    await page.selectOption('[data-testid="condition-type"]:nth-child(2)', 'resource_usage');
    await page.fill('[data-testid="condition-threshold"]', '75'); // Only run if CPU < 75%
    
    await page.click('[data-testid="create-schedule-button"]');
    
    // Verify conditions are saved
    const conditionsList = page.locator('[data-testid="conditions-list"]');
    await expect(conditionsList).toContainText('previous_run_status: passed');
    await expect(conditionsList).toContainText('resource_usage < 75%');
  });

  test('Verify resource allocation settings', async () => {
    await page.fill('[data-testid="schedule-name"]', 'Resource Managed Test');
    await page.fill('[data-testid="cron-expression"]', '0 12 * * *');
    
    // Configure resource limits
    await page.fill('[data-testid="max-parallel"]', '4');
    await page.fill('[data-testid="memory-limit"]', '2048'); // 2GB
    await page.fill('[data-testid="cpu-limit"]', '2'); // 2 cores
    await page.fill('[data-testid="timeout-minutes"]', '120'); // 2 hours
    
    // Set priority
    await page.selectOption('[data-testid="priority-level"]', 'high');
    
    await page.click('[data-testid="create-schedule-button"]');
    
    // Verify resource settings are displayed
    const resourceInfo = page.locator('[data-testid="resource-info"]');
    await expect(resourceInfo).toContainText('4 parallel');
    await expect(resourceInfo).toContainText('2GB memory');
    await expect(resourceInfo).toContainText('2 CPU cores');
    await expect(resourceInfo).toContainText('120 min timeout');
  });

  test('Manual trigger of scheduled run', async () => {
    // Assuming we have at least one schedule created
    await page.goto('/test-bank');
    await page.click('[data-testid="scheduler-tab"]');
    
    const scheduleItem = page.locator('[data-testid="schedule-item"]').first();
    await scheduleItem.locator('[data-testid="trigger-now"]').click();
    
    // Confirm manual trigger
    await page.click('[data-testid="confirm-trigger"]');
    
    // Verify run is triggered
    await expect(page.locator('[data-testid="trigger-success"]')).toBeVisible();
    
    // Check that run appears in recent runs
    await page.goto('/reports');
    const recentRuns = page.locator('[data-testid="runs-table"]');
    await expect(recentRuns.locator('tr').first()).toContainText('running');
  });

  test('Pause and resume schedule', async () => {
    const scheduleItem = page.locator('[data-testid="schedule-item"]').first();
    
    // Pause schedule
    await scheduleItem.locator('[data-testid="pause-schedule"]').click();
    await page.click('[data-testid="confirm-pause"]');
    
    // Verify paused state
    await expect(scheduleItem.locator('[data-testid="status-badge"]')).toContainText('Paused');
    await expect(scheduleItem.locator('[data-testid="next-run"]')).toContainText('Paused');
    
    // Resume schedule
    await scheduleItem.locator('[data-testid="resume-schedule"]').click();
    
    // Verify active state
    await expect(scheduleItem.locator('[data-testid="status-badge"]')).toContainText('Active');
    await expect(scheduleItem.locator('[data-testid="next-run"]')).not.toContainText('Paused');
  });

  test('Delete schedule with confirmation', async () => {
    const initialScheduleCount = await page.locator('[data-testid="schedule-item"]').count();
    
    const scheduleToDelete = page.locator('[data-testid="schedule-item"]').first();
    const scheduleName = await scheduleToDelete.locator('[data-testid="schedule-name"]').textContent();
    
    // Delete schedule
    await scheduleToDelete.locator('[data-testid="delete-schedule"]').click();
    
    // Confirm deletion
    await expect(page.locator('[data-testid="delete-confirmation"]')).toBeVisible();
    await expect(page.locator('[data-testid="delete-confirmation"]')).toContainText(scheduleName || '');
    
    await page.click('[data-testid="confirm-delete"]');
    
    // Verify schedule is deleted
    const finalScheduleCount = await page.locator('[data-testid="schedule-item"]').count();
    expect(finalScheduleCount).toBe(initialScheduleCount - 1);
    
    // Verify schedule no longer appears
    await expect(page.locator(`text=${scheduleName}`)).not.toBeVisible();
  });

  test('Schedule validation and error handling', async () => {
    // Test invalid cron expression
    await page.fill('[data-testid="schedule-name"]', 'Invalid Cron Test');
    await page.fill('[data-testid="cron-expression"]', 'invalid cron');
    
    await page.click('[data-testid="create-schedule-button"]');
    
    // Verify error message
    await expect(page.locator('[data-testid="cron-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="cron-error"]')).toContainText('Invalid cron expression');
    
    // Test missing required fields
    await page.fill('[data-testid="cron-expression"]', '0 9 * * *');
    await page.fill('[data-testid="schedule-name"]', ''); // Clear name
    
    await page.click('[data-testid="create-schedule-button"]');
    
    // Verify validation error
    await expect(page.locator('[data-testid="name-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="name-error"]')).toContainText('Schedule name is required');
  });

  test.afterEach(async () => {
    await page.close();
  });
});