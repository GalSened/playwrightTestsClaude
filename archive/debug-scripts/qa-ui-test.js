const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

async function testQAIntelligenceUI() {
    console.log('Starting QA Intelligence UI Testing...');
    console.log('=' * 60);
    
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    const testResults = [];
    const consoleErrors = [];
    const networkErrors = [];
    
    // Collect console errors
    page.on('console', (msg) => {
        if (msg.type() === 'error') {
            consoleErrors.push({
                type: 'console',
                message: msg.text(),
                url: page.url(),
                timestamp: new Date().toISOString()
            });
        }
    });
    
    // Collect network errors
    page.on('response', (response) => {
        if (response.status() >= 400) {
            networkErrors.push({
                type: 'network',
                status: response.status(),
                url: response.url(),
                timestamp: new Date().toISOString()
            });
        }
    });
    
    const pages = [
        { name: 'Main Dashboard', path: '/', filename: '01-main-dashboard.png' },
        { name: 'Sub-Agents', path: '/sub-agents', filename: '02-sub-agents.png' },
        { name: 'Schedules', path: '/schedules', filename: '03-schedules.png' },
        { name: 'Test Runs', path: '/test-runs', filename: '04-test-runs.png' },
        { name: 'Reports', path: '/reports', filename: '05-reports.png' },
        { name: 'Analytics', path: '/analytics', filename: '06-analytics.png' }
    ];
    
    for (const pageInfo of pages) {
        console.log(`\nTesting: ${pageInfo.name} (${pageInfo.path})`);
        console.log('-'.repeat(50));
        
        try {
            const startTime = Date.now();
            
            // Navigate to page
            const url = `http://localhost:3002${pageInfo.path}`;
            console.log(`Navigating to: ${url}`);
            
            const response = await page.goto(url, { 
                waitUntil: 'networkidle', 
                timeout: 10000 
            });
            
            const loadTime = Date.now() - startTime;
            
            if (response) {
                console.log(`✓ Page loaded (${response.status()}) in ${loadTime}ms`);
            }
            
            // Wait for content to load
            await page.waitForTimeout(2000);
            
            // Take screenshot
            const screenshotPath = path.join('screenshots', pageInfo.filename);
            await page.screenshot({ 
                path: screenshotPath, 
                fullPage: true 
            });
            console.log(`✓ Screenshot saved: ${screenshotPath}`);
            
            // Get page title
            const title = await page.title();
            console.log(`✓ Page title: "${title}"`);
            
            // Check for main content
            const mainContent = await page.locator('main, .main-content, #root, .container').first();
            const hasMainContent = await mainContent.count() > 0;
            console.log(`${hasMainContent ? '✓' : '⚠'} Main content container: ${hasMainContent ? 'found' : 'not found'}`);
            
            // Check for navigation
            const navElements = await page.locator('nav, .nav, .navigation, .navbar').count();
            console.log(`✓ Navigation elements found: ${navElements}`);
            
            // Check for buttons and links
            const buttons = await page.locator('button').count();
            const links = await page.locator('a').count();
            console.log(`✓ Interactive elements - Buttons: ${buttons}, Links: ${links}`);
            
            // Check for error elements
            const errorElements = await page.locator('.error, .alert-error, [class*="error"], .alert-danger').count();
            if (errorElements > 0) {
                console.log(`⚠ Found ${errorElements} potential error elements`);
            }
            
            // Check for loading states
            const loadingElements = await page.locator('.loading, .spinner, [class*="loading"]').count();
            if (loadingElements > 0) {
                console.log(`⚠ Found ${loadingElements} loading elements (might indicate incomplete loading)`);
            }
            
            // Try to find specific page content
            let specificContent = '';
            if (pageInfo.path === '/') {
                specificContent = await page.locator('h1, .dashboard, .welcome').first().textContent() || 'No main heading found';
            } else if (pageInfo.path === '/sub-agents') {
                specificContent = await page.locator('.agent, .sub-agent, .agent-card').count() + ' agent elements found';
            } else if (pageInfo.path === '/schedules') {
                specificContent = await page.locator('.schedule, .schedule-item, table tr').count() + ' schedule items found';
            } else if (pageInfo.path === '/test-runs') {
                specificContent = await page.locator('.test-run, .run-item, table tr').count() + ' test run items found';
            } else if (pageInfo.path === '/reports') {
                specificContent = await page.locator('.report, .report-item, .chart').count() + ' report elements found';
            } else if (pageInfo.path === '/analytics') {
                specificContent = await page.locator('.chart, .metric, .analytics').count() + ' analytics elements found';
            }
            
            console.log(`✓ Page-specific content: ${specificContent}`);
            
            // Test navigation links if on main page
            if (pageInfo.path === '/') {
                const navLinks = await page.locator('nav a, .nav a, .navigation a').all();
                console.log(`✓ Found ${navLinks.length} navigation links`);
                
                for (const link of navLinks.slice(0, 3)) { // Test first 3 links
                    const href = await link.getAttribute('href');
                    const text = await link.textContent();
                    console.log(`  - Link: "${text}" -> ${href}`);
                }
            }
            
            testResults.push({
                page: pageInfo.name,
                path: pageInfo.path,
                url: url,
                status: 'success',
                loadTime: loadTime,
                title: title,
                hasMainContent: hasMainContent,
                navElements: navElements,
                buttons: buttons,
                links: links,
                errorElements: errorElements,
                loadingElements: loadingElements,
                specificContent: specificContent,
                consoleErrorsCount: consoleErrors.length,
                networkErrorsCount: networkErrors.length
            });
            
        } catch (error) {
            console.log(`✗ Error testing ${pageInfo.name}: ${error.message}`);
            testResults.push({
                page: pageInfo.name,
                path: pageInfo.path,
                url: `http://localhost:3002${pageInfo.path}`,
                status: 'error',
                error: error.message
            });
        }
    }
    
    await browser.close();
    
    // Generate summary report
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY REPORT');
    console.log('='.repeat(60));
    
    const successfulTests = testResults.filter(r => r.status === 'success');
    const failedTests = testResults.filter(r => r.status === 'error');
    
    console.log(`\nOverall Results:`);
    console.log(`✓ Successful pages: ${successfulTests.length}/${testResults.length}`);
    console.log(`✗ Failed pages: ${failedTests.length}/${testResults.length}`);
    console.log(`⚠ Total console errors: ${consoleErrors.length}`);
    console.log(`⚠ Total network errors: ${networkErrors.length}`);
    
    if (failedTests.length > 0) {
        console.log(`\nFailed Pages:`);
        failedTests.forEach(test => {
            console.log(`✗ ${test.page}: ${test.error}`);
        });
    }
    
    if (consoleErrors.length > 0) {
        console.log(`\nConsole Errors:`);
        consoleErrors.forEach(error => {
            console.log(`  - ${error.message} (${error.url})`);
        });
    }
    
    if (networkErrors.length > 0) {
        console.log(`\nNetwork Errors:`);
        networkErrors.forEach(error => {
            console.log(`  - ${error.status} ${error.url}`);
        });
    }
    
    // Save detailed report to file
    const report = {
        timestamp: new Date().toISOString(),
        summary: {
            total: testResults.length,
            successful: successfulTests.length,
            failed: failedTests.length,
            consoleErrors: consoleErrors.length,
            networkErrors: networkErrors.length
        },
        testResults: testResults,
        consoleErrors: consoleErrors,
        networkErrors: networkErrors
    };
    
    await fs.writeFile('qa-ui-test-report.json', JSON.stringify(report, null, 2));
    console.log(`\n✓ Detailed report saved to: qa-ui-test-report.json`);
    
    return report;
}

// Run the test
testQAIntelligenceUI().catch(console.error);