const { chromium } = require('playwright');

async function navigateToTestBank() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    try {
        console.log('Navigating to Test Bank...');
        await page.goto('http://localhost:3002/test-bank', { waitUntil: 'networkidle' });
        
        await page.waitForTimeout(3000);
        
        // Take a screenshot
        await page.screenshot({ path: 'test-bank-screenshot.png', fullPage: true });
        console.log('Screenshot saved as test-bank-screenshot.png');
        
        // Check if tests are loading
        const testElements = await page.$$('[data-testid="test-item"], .test-item, .test-card');
        console.log(`Found ${testElements.length} test elements on page`);
        
        // Check for loading indicators
        const loadingElements = await page.$$('.loading, [data-testid="loading"], .spinner');
        console.log(`Found ${loadingElements.length} loading indicators`);
        
        // Check for any error messages
        const errorElements = await page.$$('.error, [data-testid="error"], .error-message');
        console.log(`Found ${errorElements.length} error messages`);
        
        // Get page content for analysis
        const pageContent = await page.content();
        console.log('Page loaded, taking screenshot and keeping browser open for inspection...');
        
        // Keep browser open for manual inspection
        await page.waitForTimeout(30000); // 30 seconds to inspect
        
    } catch (error) {
        console.error('Error navigating to test bank:', error);
    } finally {
        await browser.close();
    }
}

navigateToTestBank();