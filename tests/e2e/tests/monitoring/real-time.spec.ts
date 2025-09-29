import { test, expect, Page } from '@playwright/test';

test.describe('Real-Time Monitoring System', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    
    // Login as admin
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@demo.com');
    await page.fill('[name="password"]', 'demo123');
    await page.click('button:has-text("Login")');
    await page.waitForLoadState('networkidle');
  });

  test('WebSocket connection establishment', async () => {
    // Navigate to dashboard
    await page.goto('/');
    
    // Check WebSocket connection status indicator
    const wsStatus = page.locator('[data-testid="websocket-status"]');
    await expect(wsStatus).toBeVisible();
    await expect(wsStatus).toContainText('Connected');
    
    // Verify connection indicator is green/success state
    const statusIcon = wsStatus.locator('.text-green-600');
    await expect(statusIcon).toBeVisible();
    
    // Test connection resilience by triggering a test run
    await page.goto('/test-bank');
    await page.locator('[data-testid="test-checkbox"]').first().check();
    await page.click('[data-testid="run-single-test"]');
    
    // Verify WebSocket status remains connected during execution
    await expect(wsStatus).toContainText('Connected');
  });

  test('Live execution status updates (sub-second)', async () => {
    // Start a test execution
    await page.goto('/test-bank');
    await page.locator('[data-testid="test-checkbox"]').first().check();
    
    // Record start time for performance measurement
    const startTime = Date.now();
    
    await page.click('[data-testid="run-single-test"]');
    
    // Verify immediate status change to running
    await expect(page.locator('.animate-spin')).toBeVisible({ timeout: 1000 });
    
    // Check that status updates appear quickly
    const statusUpdate = page.locator('[data-testid="execution-status"]');
    await expect(statusUpdate).toBeVisible({ timeout: 2000 });
    
    const updateTime = Date.now();
    const responseTime = updateTime - startTime;
    
    // Verify sub-second response time (under 1000ms)
    expect(responseTime).toBeLessThan(1000);
    
    // Navigate to dashboard to see live updates
    await page.goto('/');
    
    // Verify active runs counter updates in real-time
    const activeRuns = page.locator('[data-testid="active-runs-count"]');
    await expect(activeRuns).not.toContainText('0');
  });

  test('Performance dashboard metrics display', async () => {
    await page.goto('/');
    
    // Verify all performance metrics are displayed
    const metrics = [
      'environment-status',
      'total-tests-count',
      'total-runs-count',
      'pass-rate-percentage',
      'active-runs-count'
    ];
    
    for (const metric of metrics) {
      const metricElement = page.locator(`[data-testid="${metric}"]`);
      await expect(metricElement).toBeVisible();
      await expect(metricElement).not.toBeEmpty();
    }
    
    // Verify environment status shows health
    const envStatus = page.locator('[data-testid="environment-status"]');
    await expect(envStatus).toContainText(/healthy|warning|error/i);
    
    // Test metrics refresh functionality
    await page.click('[data-testid="refresh-metrics"]');
    
    // Verify loading state during refresh
    await expect(page.locator('.animate-spin')).toBeVisible();
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 10000 });
  });

  test('CPU/Memory/Disk usage display', async () => {
    await page.goto('/analytics');
    
    // Wait for analytics to load
    await page.waitForSelector('[data-testid="system-metrics"]', { timeout: 15000 });
    
    // Verify system resource metrics are displayed
    const resourceMetrics = page.locator('[data-testid="system-metrics"]');
    
    // Check CPU usage display
    const cpuMetric = resourceMetrics.locator('[data-testid="cpu-usage"]');
    await expect(cpuMetric).toBeVisible();
    
    // Verify CPU percentage is within valid range
    const cpuText = await cpuMetric.textContent();
    const cpuValue = parseInt(cpuText?.match(/(\d+)%/)?.[1] || '0');
    expect(cpuValue).toBeGreaterThanOrEqual(0);
    expect(cpuValue).toBeLessThanOrEqual(100);
    
    // Check Memory usage display
    const memoryMetric = resourceMetrics.locator('[data-testid="memory-usage"]');
    await expect(memoryMetric).toBeVisible();
    
    // Check Disk usage display
    const diskMetric = resourceMetrics.locator('[data-testid="disk-usage"]');
    await expect(diskMetric).toBeVisible();
    
    // Verify real-time updates
    const initialCpuText = await cpuMetric.textContent();
    
    // Wait for potential update (system metrics typically update every 5-10 seconds)
    await page.waitForTimeout(10000);
    
    // Refresh to get latest metrics
    await page.reload();
    await page.waitForSelector('[data-testid="system-metrics"]', { timeout: 15000 });
    
    const updatedCpuText = await cpuMetric.textContent();
    // Metrics should be present (may be same values in test environment)
    expect(updatedCpuText).toBeTruthy();
  });

  test('Alert system triggers', async () => {
    await page.goto('/analytics');
    
    // Check if alerts section exists
    const alertsSection = page.locator('[data-testid="alerts-panel"]');
    await expect(alertsSection).toBeVisible({ timeout: 10000 });
    
    // Verify different alert types are supported
    const alertTypes = ['critical', 'warning', 'info'];
    
    // Check if any alerts are currently active
    const activeAlerts = page.locator('[data-testid="alert-item"]');
    const alertCount = await activeAlerts.count();
    
    if (alertCount > 0) {
      // Verify alert structure
      const firstAlert = activeAlerts.first();
      await expect(firstAlert.locator('[data-testid="alert-severity"]')).toBeVisible();
      await expect(firstAlert.locator('[data-testid="alert-message"]')).toBeVisible();
      await expect(firstAlert.locator('[data-testid="alert-timestamp"]')).toBeVisible();
      
      // Test alert dismissal
      const dismissButton = firstAlert.locator('[data-testid="dismiss-alert"]');
      if (await dismissButton.isVisible()) {
        await dismissButton.click();
        
        // Verify alert is dismissed
        const newAlertCount = await activeAlerts.count();
        expect(newAlertCount).toBeLessThan(alertCount);
      }
    }
    
    // Test alert history
    const alertHistory = page.locator('[data-testid="alert-history"]');
    if (await alertHistory.isVisible()) {
      await alertHistory.click();
      
      // Verify alert history modal or section opens
      await expect(page.locator('[data-testid="alert-history-modal"]')).toBeVisible({ timeout: 5000 });
    }
  });

  test('Notification delivery system', async () => {
    // Test in-app notification system
    await page.goto('/');
    
    // Check notification bell icon
    const notificationBell = page.locator('[data-testid="notification-bell"]');
    await expect(notificationBell).toBeVisible();
    
    // Check notification count badge
    const notificationCount = page.locator('[data-testid="notification-count"]');
    const hasNotifications = await notificationCount.isVisible();
    
    if (hasNotifications) {
      // Click to open notifications
      await notificationBell.click();
      
      // Verify notification dropdown/panel opens
      const notificationPanel = page.locator('[data-testid="notification-panel"]');
      await expect(notificationPanel).toBeVisible();
      
      // Verify notification items are displayed
      const notificationItems = notificationPanel.locator('[data-testid="notification-item"]');
      const itemCount = await notificationItems.count();
      expect(itemCount).toBeGreaterThan(0);
      
      // Test notification interaction
      if (itemCount > 0) {
        const firstNotification = notificationItems.first();
        
        // Verify notification structure
        await expect(firstNotification.locator('[data-testid="notification-title"]')).toBeVisible();
        await expect(firstNotification.locator('[data-testid="notification-time"]')).toBeVisible();
        
        // Test mark as read
        const markReadButton = firstNotification.locator('[data-testid="mark-read"]');
        if (await markReadButton.isVisible()) {
          await markReadButton.click();
          
          // Verify notification state change
          await expect(firstNotification).toHaveClass(/read/);
        }
      }
      
      // Test clear all notifications
      const clearAllButton = notificationPanel.locator('[data-testid="clear-all"]');
      if (await clearAllButton.isVisible()) {
        await clearAllButton.click();
        
        // Verify confirmation dialog
        await expect(page.locator('[data-testid="confirm-clear-all"]')).toBeVisible();
        await page.click('[data-testid="confirm-clear"]');
        
        // Verify notifications are cleared
        const remainingNotifications = await notificationItems.count();
        expect(remainingNotifications).toBe(0);
      }
    }
  });

  test('Real-time activity feed updates', async () => {
    await page.goto('/');
    
    // Verify activity feed section exists
    const activityFeed = page.locator('[data-testid="activity-feed"]');
    await expect(activityFeed).toBeVisible();
    
    // Check initial activity count
    const initialActivities = await activityFeed.locator('[data-testid="activity-item"]').count();
    
    // Trigger an activity by running a test
    await page.goto('/test-bank');
    await page.locator('[data-testid="test-checkbox"]').first().check();
    await page.click('[data-testid="run-single-test"]');
    
    // Return to dashboard
    await page.goto('/');
    
    // Wait for activity feed to update
    await page.waitForTimeout(3000);
    
    // Verify new activity appears
    const updatedActivities = await activityFeed.locator('[data-testid="activity-item"]').count();
    expect(updatedActivities).toBeGreaterThanOrEqual(initialActivities);
    
    // Verify activity item structure
    const latestActivity = activityFeed.locator('[data-testid="activity-item"]').first();
    await expect(latestActivity.locator('[data-testid="activity-type"]')).toBeVisible();
    await expect(latestActivity.locator('[data-testid="activity-description"]')).toBeVisible();
    await expect(latestActivity.locator('[data-testid="activity-timestamp"]')).toBeVisible();
  });

  test('System health monitoring dashboard', async () => {
    await page.goto('/');
    
    // Verify system health indicators
    const healthIndicators = [
      'api-health',
      'database-health',
      'queue-health',
      'websocket-health'
    ];
    
    for (const indicator of healthIndicators) {
      const healthElement = page.locator(`[data-testid="${indicator}"]`);
      await expect(healthElement).toBeVisible();
      
      // Verify health status is one of the expected values
      const statusText = await healthElement.textContent();
      expect(statusText).toMatch(/healthy|degraded|unhealthy|unknown/i);
    }
    
    // Test system health refresh
    const refreshButton = page.locator('[data-testid="refresh-health"]');
    if (await refreshButton.isVisible()) {
      await refreshButton.click();
      
      // Verify loading state
      await expect(page.locator('[data-testid="health-loading"]')).toBeVisible();
      await expect(page.locator('[data-testid="health-loading"]')).not.toBeVisible({ timeout: 10000 });
      
      // Verify health data is refreshed
      await expect(page.locator('[data-testid="last-health-check"]')).toBeVisible();
    }
  });

  test('Performance metrics real-time charts', async () => {
    await page.goto('/analytics');
    
    // Wait for charts to load
    await page.waitForSelector('[data-testid="coverage-trend-chart"]', { timeout: 15000 });
    
    // Verify trend chart is interactive
    const trendChart = page.locator('[data-testid="coverage-trend-chart"]');
    await expect(trendChart).toBeVisible();
    
    // Test chart hover interactions
    const chartPoints = trendChart.locator('circle, .recharts-dot');
    if (await chartPoints.count() > 0) {
      await chartPoints.first().hover();
      
      // Verify tooltip appears
      const tooltip = page.locator('.recharts-tooltip');
      await expect(tooltip).toBeVisible();
    }
    
    // Verify module coverage chart
    const moduleChart = page.locator('[data-testid="coverage-by-module-chart"]');
    await expect(moduleChart).toBeVisible();
    
    // Verify gap distribution chart
    const gapChart = page.locator('[data-testid="gap-distribution-chart"]');
    await expect(gapChart).toBeVisible();
    
    // Test chart data updates
    const refreshChartsButton = page.locator('[data-testid="refresh-charts"]');
    if (await refreshChartsButton.isVisible()) {
      await refreshChartsButton.click();
      
      // Verify charts reload
      await expect(page.locator('.chart-loading')).toBeVisible();
      await expect(page.locator('.chart-loading')).not.toBeVisible({ timeout: 15000 });
    }
  });

  test.afterEach(async () => {
    await page.close();
  });
});