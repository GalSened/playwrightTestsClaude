const { chromium } = require('playwright');

async function validateTestBank() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    try {
        // Check for errors
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log('BROWSER ERROR:', msg.text());
            }
        });
        
        console.log('Navigating to Test Bank page...');
        await page.goto('http://localhost:3002/test-bank', { waitUntil: 'load', timeout: 60000 });
        
        // Wait for the page to load completely and API calls to finish
        await page.waitForTimeout(10000);
        
        // Wait for tests to load
        await page.waitForTimeout(5000);
        
        // Check if tests are loading/displayed
        console.log('Checking for test elements...');
        const testElements = await page.$$('[data-testid="test-item"], .test-item, .test-card, .test-row, tr[data-testid="test-row"], .test-definition');
        console.log(`Found ${testElements.length} test elements`);
        
        // Look for table rows specifically
        const tableRows = await page.$$('table tbody tr');
        console.log(`Found ${tableRows.length} table rows`);
        
        // Check for loading skeleton specifically
        const loadingSkeletons = await page.$$('.animate-pulse, [data-testid="skeleton"]');
        console.log(`Found ${loadingSkeletons.length} loading skeletons`);
        
        // Check for loading indicators
        const loadingElements = await page.$$('.loading, [data-testid="loading"], .spinner, .load');
        console.log(`Found ${loadingElements.length} loading indicators`);
        
        // Check for WeSign-specific content
        const wesignElements = await page.$$('*:has-text("wesign"), *:has-text("signing"), *:has-text("WeSign")');
        console.log(`Found ${wesignElements.length} WeSign-related elements`);
        
        // Check for any error messages
        const errorElements = await page.$$('.error, [data-testid="error"], .error-message');
        console.log(`Found ${errorElements.length} error messages`);
        
        // Get page title and URL
        const title = await page.title();
        const url = page.url();
        console.log(`Page title: ${title}`);
        console.log(`Current URL: ${url}`);
        
        // Take screenshot for analysis
        await page.screenshot({ path: 'test-bank-validation.png', fullPage: true });
        console.log('Screenshot saved as test-bank-validation.png');
        
        // Check if there's any content in the main area
        const mainContent = await page.$('main, .main-content, .test-bank-content');
        if (mainContent) {
            const textContent = await mainContent.textContent();
            console.log(`Main content preview: ${textContent.substring(0, 200)}...`);
        }
        
        // Check for specific test bank UI elements
        const testBankElements = await page.$$('.test-bank, #test-bank, [data-testid="test-bank"]');
        console.log(`Found ${testBankElements.length} test bank container elements`);
        
        console.log('Keeping browser open for 30 seconds for manual inspection...');
        await page.waitForTimeout(30000);
        
    } catch (error) {
        console.error('Error during test bank validation:', error);
    } finally {
        await browser.close();
    }
}

validateTestBank();