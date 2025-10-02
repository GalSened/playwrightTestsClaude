const { chromium } = require('playwright');

async function testAnalyticsPage() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('Navigating to analytics page...');
    await page.goto('http://localhost:5180/analytics');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    console.log('Page loaded successfully');
    
    // Take a screenshot
    await page.screenshot({ path: 'analytics-screenshot.png', fullPage: true });
    console.log('Screenshot saved as analytics-screenshot.png');
    
    // Check for specific data elements
    const totalTests = await page.locator('text=/Total tests/i').first();
    if (await totalTests.isVisible()) {
      const testsText = await totalTests.textContent();
      console.log('Total tests element found:', testsText);
    }
    
    // Look for health score
    const healthScore = await page.locator('text=/health score/i').first();
    if (await healthScore.isVisible()) {
      const healthText = await healthScore.textContent();
      console.log('Health score element found:', healthText);
    }
    
    // Look for modules
    const modules = await page.locator('text=/module/i');
    const moduleCount = await modules.count();
    console.log('Found', moduleCount, 'module references');
    
    // Wait a bit to see the page
    await page.waitForTimeout(5000);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

testAnalyticsPage();