const { chromium } = require('playwright');

async function testWithRealCredentials() {
    console.log('🔑 TESTING WITH REAL DEMO CREDENTIALS');
    console.log('=' .repeat(60));
    console.log('📧 Email: admin@demo.com');
    console.log('🔒 Password: demo123');
    console.log('');
    
    const browser = await chromium.launch({ headless: false, slowMo: 1000 });
    const page = await browser.newPage();
    
    const testResults = [];
    
    try {
        // Test 1: Navigate to login and use real credentials
        console.log('1️⃣  Testing login with demo credentials...');
        await page.goto('http://localhost:5177/auth/login');
        await page.waitForLoadState('networkidle');
        
        // Fill with demo credentials
        await page.fill('input[type="email"]', 'admin@demo.com');
        await page.fill('input[type="password"]', 'demo123');
        
        console.log('   ✅ Filled demo credentials');
        await page.screenshot({ path: 'screenshots/demo_credentials_filled.png' });
        
        // Monitor network requests
        let loginResponse = null;
        page.on('response', response => {
            if (response.url().includes('/api/auth/login')) {
                loginResponse = response;
            }
        });
        
        // Click login button
        await page.click('button[type="submit"]');
        console.log('   🔄 Login button clicked, waiting for response...');
        
        // Wait for either success or failure
        await page.waitForTimeout(5000);
        
        const currentUrl = page.url();
        console.log(`   📍 Current URL: ${currentUrl}`);
        
        if (loginResponse) {
            const status = loginResponse.status();
            console.log(`   📡 Login API Response: ${status}`);
            
            if (status === 200) {
                testResults.push('✅ Login successful with demo credentials');
                console.log('   🎉 LOGIN SUCCESSFUL!');
                
                // Test 2: Explore the authenticated application
                await testAuthenticatedApp(page, testResults);
                
            } else {
                testResults.push(`❌ Login failed with status ${status}`);
                console.log(`   ❌ Login failed with status: ${status}`);
                
                try {
                    const responseText = await loginResponse.text();
                    console.log(`   📄 Response: ${responseText.slice(0, 200)}`);
                } catch (e) {
                    console.log('   📄 Could not read response body');
                }
            }
        } else {
            testResults.push('❌ No login response received');
            console.log('   ❌ No login response received');
        }
        
        await page.screenshot({ path: 'screenshots/after_demo_login.png' });
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        testResults.push(`❌ Test error: ${error.message}`);
        await page.screenshot({ path: 'screenshots/demo_test_error.png' });
    } finally {
        await browser.close();
    }
    
    console.log('\n📊 DEMO CREDENTIALS TEST RESULTS:');
    console.log('='.repeat(40));
    testResults.forEach((result, i) => {
        console.log(`${i + 1}. ${result}`);
    });
    
    return testResults;
}

async function testAuthenticatedApp(page, testResults) {
    console.log('\n2️⃣  Testing authenticated application access...');
    
    // Wait a bit more for any redirects
    await page.waitForTimeout(3000);
    
    const currentUrl = page.url();
    console.log(`   📍 Post-login URL: ${currentUrl}`);
    
    if (currentUrl.includes('/dashboard')) {
        testResults.push('✅ Successfully redirected to dashboard');
        console.log('   🏠 Redirected to dashboard - testing dashboard elements...');
        
        await testDashboardElements(page, testResults);
        
    } else if (currentUrl.includes('/auth/login')) {
        testResults.push('⚠️  Still on login page - login may have failed');
        console.log('   ⚠️  Still on login page - checking for error messages...');
        
        const errorMessages = await page.locator('.error, .alert-error, [role="alert"]').count();
        console.log(`   📢 Error messages visible: ${errorMessages}`);
        
    } else {
        testResults.push(`✅ Redirected to: ${currentUrl}`);
        console.log(`   📍 Redirected to: ${currentUrl}`);
    }
    
    // Test navigation to other pages
    const pagesToTest = [
        { url: '/dashboard', name: 'Dashboard' },
        { url: '/test-bank', name: 'Test Bank' },
        { url: '/analytics', name: 'Analytics' },
        { url: '/reports', name: 'Reports' }
    ];
    
    for (const pageTest of pagesToTest) {
        try {
            console.log(`   🔍 Testing ${pageTest.name} page...`);
            await page.goto(`http://localhost:5177${pageTest.url}`);
            await page.waitForLoadState('networkidle', { timeout: 5000 });
            
            const finalUrl = page.url();
            console.log(`     📍 ${pageTest.name} URL: ${finalUrl}`);
            
            if (finalUrl.includes(pageTest.url)) {
                testResults.push(`✅ ${pageTest.name} page accessible`);
                console.log(`     ✅ ${pageTest.name} page loaded successfully`);
                
                // Quick test of page elements
                const buttons = await page.locator('button').count();
                const links = await page.locator('a').count();
                const tables = await page.locator('table, [role="table"]').count();
                
                console.log(`     📊 Elements: ${buttons} buttons, ${links} links, ${tables} tables`);
                
                if (buttons > 0 || links > 0 || tables > 0) {
                    testResults.push(`✅ ${pageTest.name} has functional elements`);
                }
                
            } else if (finalUrl.includes('/auth/login')) {
                testResults.push(`❌ ${pageTest.name} redirected to login - auth expired?`);
                console.log(`     🔒 ${pageTest.name} redirected to login - auth may have expired`);
            } else {
                testResults.push(`⚠️  ${pageTest.name} redirected to: ${finalUrl}`);
                console.log(`     ⚠️  ${pageTest.name} redirected to: ${finalUrl}`);
            }
            
            await page.screenshot({ path: `screenshots/demo_${pageTest.name.toLowerCase()}.png` });
            
        } catch (error) {
            testResults.push(`❌ ${pageTest.name} error: ${error.message.slice(0, 50)}`);
            console.log(`     ❌ ${pageTest.name} error: ${error.message.slice(0, 50)}`);
        }
    }
}

async function testDashboardElements(page, testResults) {
    try {
        console.log('   🏠 Testing dashboard functionality...');
        
        // Test dashboard elements
        const cards = await page.locator('.card, .dashboard-card, [data-testid*="card"]').count();
        const charts = await page.locator('canvas, svg, .chart, .recharts-wrapper').count();
        const metrics = await page.locator('.metric, .stat, .kpi, [data-testid*="metric"]').count();
        const buttons = await page.locator('button:visible').count();
        const tables = await page.locator('table, .table, [role="table"]').count();
        
        console.log(`     📊 Dashboard elements found:`);
        console.log(`       - Cards: ${cards}`);
        console.log(`       - Charts: ${charts}`);
        console.log(`       - Metrics: ${metrics}`);
        console.log(`       - Buttons: ${buttons}`);
        console.log(`       - Tables: ${tables}`);
        
        if (cards > 0) testResults.push(`✅ Dashboard cards working (${cards})`);
        if (charts > 0) testResults.push(`✅ Dashboard charts working (${charts})`);
        if (metrics > 0) testResults.push(`✅ Dashboard metrics working (${metrics})`);
        if (buttons > 0) testResults.push(`✅ Dashboard buttons working (${buttons})`);
        if (tables > 0) testResults.push(`✅ Dashboard tables working (${tables})`);
        
        // Test a few buttons
        if (buttons > 0) {
            console.log('     🔘 Testing dashboard button functionality...');
            
            for (let i = 0; i < Math.min(buttons, 3); i++) {
                try {
                    const button = page.locator('button:visible').nth(i);
                    const buttonText = (await button.innerText()).slice(0, 20) || 'No text';
                    const isEnabled = await button.isEnabled();
                    
                    console.log(`       Button ${i+1}: "${buttonText}" - ${isEnabled ? 'Enabled' : 'Disabled'}`);
                    
                    if (isEnabled && !/(delete|remove|clear)/i.test(buttonText)) {
                        await button.click();
                        await page.waitForTimeout(1000);
                        testResults.push(`✅ Dashboard button clickable: ${buttonText}`);
                    }
                } catch (btnError) {
                    console.log(`       Button ${i+1}: Error - ${btnError.message.slice(0, 30)}`);
                }
            }
        }
        
        await page.screenshot({ path: 'screenshots/demo_dashboard_detailed.png' });
        
    } catch (error) {
        testResults.push(`❌ Dashboard testing error: ${error.message.slice(0, 50)}`);
        console.log(`     ❌ Dashboard testing error: ${error.message.slice(0, 50)}`);
    }
}

testWithRealCredentials().catch(console.error);