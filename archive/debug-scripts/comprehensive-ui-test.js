const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testQAIntelligenceUI() {
  const browser = await chromium.launch({ 
    headless: false, // Show browser for better debugging
    slowMo: 1000 // Slow down actions
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Create screenshots directory
  const screenshotsDir = path.join(__dirname, 'screenshots', 'ui-test-' + Date.now());
  fs.mkdirSync(screenshotsDir, { recursive: true });

  const testResults = [];

  // Enable console logging
  page.on('console', msg => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      console.log(`[CONSOLE ${type.toUpperCase()}]: ${msg.text()}`);
    }
  });

  // Enable network request logging
  const networkRequests = [];
  page.on('request', request => {
    if (request.url().includes('localhost:808')) {
      networkRequests.push({
        url: request.url(),
        method: request.method(),
        timestamp: new Date().toISOString()
      });
    }
  });

  page.on('response', response => {
    if (response.url().includes('localhost:808')) {
      console.log(`[NETWORK] ${response.status()} ${response.url()}`);
    }
  });

  const pages = [
    { name: 'Main Dashboard', url: 'http://localhost:3002/', path: '/' },
    { name: 'Sub-Agents', url: 'http://localhost:3002/sub-agents', path: '/sub-agents' },
    { name: 'Schedules', url: 'http://localhost:3002/schedules', path: '/schedules' },
    { name: 'Test Runs', url: 'http://localhost:3002/test-runs', path: '/test-runs' },
    { name: 'Reports', url: 'http://localhost:3002/reports', path: '/reports' },
    { name: 'Analytics', url: 'http://localhost:3002/analytics', path: '/analytics' }
  ];

  for (const pageInfo of pages) {
    console.log(`\n=== Testing ${pageInfo.name} ===`);
    
    try {
      // Navigate to page
      console.log(`Navigating to ${pageInfo.url}`);
      await page.goto(pageInfo.url, { waitUntil: 'networkidle' });

      // Wait for page to load
      await page.waitForTimeout(3000);

      // Take screenshot
      const screenshotPath = path.join(screenshotsDir, `${pageInfo.name.replace(/\s+/g, '-').toLowerCase()}.png`);
      await page.screenshot({ 
        path: screenshotPath, 
        fullPage: true 
      });

      // Get page title
      const title = await page.title();

      // Check for specific elements based on page
      let specificChecks = {};
      
      try {
        if (pageInfo.path === '/') {
          // Main Dashboard checks
          const dashboardElements = await page.locator('h1, h2, .dashboard-card, .metric-card').count();
          specificChecks.dashboardElements = dashboardElements;
        } else if (pageInfo.path === '/sub-agents') {
          // Sub-Agents checks
          const agentElements = await page.locator('.agent-card, .agent-item, .sub-agent').count();
          const agentStatus = await page.locator('[class*="status"], [class*="active"], [class*="inactive"]').count();
          specificChecks.agentElements = agentElements;
          specificChecks.agentStatus = agentStatus;
        } else if (pageInfo.path === '/schedules') {
          // Schedules checks
          const scheduleElements = await page.locator('.schedule-item, .schedule-card, table tr').count();
          specificChecks.scheduleElements = scheduleElements;
        } else if (pageInfo.path === '/test-runs') {
          // Test Runs checks
          const testRunElements = await page.locator('.test-run, .run-item, table tr').count();
          specificChecks.testRunElements = testRunElements;
        } else if (pageInfo.path === '/reports') {
          // Reports checks
          const reportElements = await page.locator('.report-item, .report-card, table tr').count();
          specificChecks.reportElements = reportElements;
        } else if (pageInfo.path === '/analytics') {
          // Analytics checks
          const chartElements = await page.locator('canvas, svg, .chart').count();
          specificChecks.chartElements = chartElements;
        }
      } catch (error) {
        specificChecks.error = error.message;
      }

      // Check for common error indicators
      const errorMessages = await page.locator('[class*="error"], .error-message, .alert-danger').count();
      const loadingSpinners = await page.locator('[class*="loading"], [class*="spinner"], .loading').count();

      // Get console errors during page load
      const consoleErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      const result = {
        page: pageInfo.name,
        url: pageInfo.url,
        title: title,
        screenshot: screenshotPath,
        errorMessages: errorMessages,
        loadingSpinners: loadingSpinners,
        specificChecks: specificChecks,
        networkRequests: networkRequests.filter(req => req.timestamp > (new Date(Date.now() - 10000)).toISOString()),
        timestamp: new Date().toISOString(),
        success: true
      };

      testResults.push(result);
      console.log(`✓ ${pageInfo.name} tested successfully`);
      
    } catch (error) {
      console.error(`✗ Failed to test ${pageInfo.name}:`, error.message);
      testResults.push({
        page: pageInfo.name,
        url: pageInfo.url,
        error: error.message,
        success: false,
        timestamp: new Date().toISOString()
      });
    }

    // Clear network requests for next page
    networkRequests.length = 0;
  }

  // Save test results
  const resultsPath = path.join(screenshotsDir, 'test-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(testResults, null, 2));

  console.log(`\n=== Test Results Summary ===`);
  console.log(`Screenshots saved to: ${screenshotsDir}`);
  console.log(`Test results saved to: ${resultsPath}`);

  testResults.forEach(result => {
    if (result.success) {
      console.log(`✓ ${result.page}: SUCCESS`);
    } else {
      console.log(`✗ ${result.page}: FAILED - ${result.error}`);
    }
  });

  await browser.close();
  return { testResults, screenshotsDir, resultsPath };
}

// Run the test
testQAIntelligenceUI().then(({ testResults, screenshotsDir, resultsPath }) => {
  console.log('\n=== Final Summary ===');
  console.log(`Total pages tested: ${testResults.length}`);
  console.log(`Successful: ${testResults.filter(r => r.success).length}`);
  console.log(`Failed: ${testResults.filter(r => !r.success).length}`);
  console.log(`Results directory: ${screenshotsDir}`);
}).catch(console.error);