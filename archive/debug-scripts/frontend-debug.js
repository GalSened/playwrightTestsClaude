const { chromium } = require('playwright');

async function debugFrontendContent() {
    console.log('🔍 Debugging Frontend Content');
    console.log('=' .repeat(50));
    
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    try {
        await page.goto('http://localhost:5177');
        await page.waitForLoadState('networkidle');
        
        console.log(`Title: ${await page.title()}`);
        console.log(`URL: ${page.url()}`);
        
        // Get the full HTML content
        const htmlContent = await page.content();
        console.log('\n📄 HTML Content Length:', htmlContent.length);
        
        // Get the body content
        const bodyContent = await page.locator('body').innerHTML();
        console.log('\n📄 Body Content:');
        console.log('─'.repeat(100));
        console.log(bodyContent.slice(0, 2000)); // First 2000 characters
        if (bodyContent.length > 2000) {
            console.log('\n... (truncated, total length:', bodyContent.length, 'characters)');
        }
        console.log('─'.repeat(100));
        
        // Check for JavaScript errors
        const jsErrors = [];
        page.on('pageerror', error => {
            jsErrors.push(error.message);
        });
        
        // Wait a bit for any JS errors to appear
        await page.waitForTimeout(3000);
        
        if (jsErrors.length > 0) {
            console.log('\n❌ JavaScript Errors Found:');
            jsErrors.forEach((error, i) => {
                console.log(`  ${i + 1}. ${error}`);
            });
        } else {
            console.log('\n✅ No JavaScript errors detected');
        }
        
        // Check network requests
        const responses = [];
        page.on('response', response => {
            responses.push({
                url: response.url(),
                status: response.status(),
                contentType: response.headers()['content-type']
            });
        });
        
        // Reload to capture network requests
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        console.log('\n🌐 Network Requests:');
        responses.forEach((resp, i) => {
            console.log(`  ${i + 1}. ${resp.status} - ${resp.url.slice(-50)} (${resp.contentType || 'unknown'})`);
        });
        
        // Check console messages
        const consoleLogs = [];
        page.on('console', msg => {
            consoleLogs.push(`${msg.type()}: ${msg.text()}`);
        });
        
        await page.reload();
        await page.waitForTimeout(2000);
        
        if (consoleLogs.length > 0) {
            console.log('\n📝 Console Messages:');
            consoleLogs.slice(0, 10).forEach((log, i) => {
                console.log(`  ${i + 1}. ${log}`);
            });
        }
        
        await page.screenshot({ path: 'screenshots/debug_full_page.png', fullPage: true });
        
    } catch (error) {
        console.error('❌ Debug failed:', error.message);
        await page.screenshot({ path: 'screenshots/debug_error.png' });
    } finally {
        await browser.close();
    }
}

debugFrontendContent().catch(console.error);