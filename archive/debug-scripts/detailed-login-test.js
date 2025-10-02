const { chromium } = require('playwright');

async function testLoginDetailed() {
    console.log('🔍 Detailed Login Test');
    console.log('=' .repeat(50));
    
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    // Capture network requests and responses
    const requests = [];
    const responses = [];
    
    page.on('request', request => {
        requests.push({
            url: request.url(),
            method: request.method(),
            postData: request.postData(),
            headers: request.headers()
        });
    });
    
    page.on('response', response => {
        responses.push({
            url: response.url(),
            status: response.status(),
            statusText: response.statusText()
        });
    });
    
    // Capture console messages and errors
    const consoleMessages = [];
    const pageErrors = [];
    
    page.on('console', msg => {
        consoleMessages.push(`${msg.type()}: ${msg.text()}`);
    });
    
    page.on('pageerror', error => {
        pageErrors.push(error.message);
    });
    
    try {
        // Navigate to login page
        console.log('📱 Navigating to login page...');
        await page.goto('http://localhost:5177/auth/login');
        await page.waitForLoadState('networkidle');
        
        console.log('✅ Page loaded successfully');
        
        // Fill login form
        console.log('📝 Filling login form...');
        await page.fill('input[type="email"]', 'admin@test.com');
        await page.fill('input[type="password"]', 'TestPassword123!');
        
        // Take screenshot before login
        await page.screenshot({ path: 'screenshots/before_login_attempt.png' });
        
        // Click login button and monitor network activity
        console.log('🔄 Clicking login button...');
        const loginPromise = page.waitForResponse(response => 
            response.url().includes('/api/auth/login') && response.request().method() === 'POST'
        ).catch(() => null); // Don't fail if no response
        
        await page.click('button[type="submit"]');
        
        // Wait for either response or timeout
        console.log('⏳ Waiting for API response...');
        const loginResponse = await Promise.race([
            loginPromise,
            new Promise(resolve => setTimeout(() => resolve(null), 5000))
        ]);
        
        if (loginResponse) {
            const status = loginResponse.status();
            const responseText = await loginResponse.text();
            console.log(`✅ Login API response: ${status}`);
            console.log(`📄 Response body: ${responseText.slice(0, 200)}`);
        } else {
            console.log('❌ No login API response received within 5 seconds');
        }
        
        // Wait a bit more for any navigation
        await page.waitForTimeout(3000);
        
        const finalUrl = page.url();
        console.log(`📍 Final URL: ${finalUrl}`);
        
        // Take final screenshot
        await page.screenshot({ path: 'screenshots/after_login_attempt.png' });
        
        // Log all network requests related to authentication
        console.log('\n🌐 Network Requests:');
        requests.filter(req => req.url.includes('/api/auth')).forEach((req, i) => {
            console.log(`  ${i + 1}. ${req.method} ${req.url}`);
            if (req.postData) {
                console.log(`     Data: ${req.postData.slice(0, 100)}`);
            }
        });
        
        console.log('\n📡 Network Responses:');
        responses.filter(resp => resp.url.includes('/api/auth')).forEach((resp, i) => {
            console.log(`  ${i + 1}. ${resp.status} ${resp.statusText} - ${resp.url}`);
        });
        
        // Log console messages and errors
        if (consoleMessages.length > 0) {
            console.log('\n📝 Console Messages:');
            consoleMessages.forEach((msg, i) => {
                console.log(`  ${i + 1}. ${msg}`);
            });
        }
        
        if (pageErrors.length > 0) {
            console.log('\n❌ Page Errors:');
            pageErrors.forEach((error, i) => {
                console.log(`  ${i + 1}. ${error}`);
            });
        }
        
        // Check if user is redirected or logged in
        const isDashboard = finalUrl.includes('/dashboard');
        const isLogin = finalUrl.includes('/login');
        
        if (isDashboard) {
            console.log('✅ Login successful - redirected to dashboard');
        } else if (isLogin) {
            console.log('❌ Login failed - still on login page');
        } else {
            console.log(`❓ Unknown state - URL: ${finalUrl}`);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        await page.screenshot({ path: 'screenshots/test_error.png' });
    } finally {
        await browser.close();
    }
}

testLoginDetailed().catch(console.error);