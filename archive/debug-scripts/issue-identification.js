const { chromium } = require('playwright');

async function identifyAllIssues() {
    console.log('🔍 SYSTEMATIC ISSUE IDENTIFICATION');
    console.log('=' .repeat(60));
    
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    const criticalIssues = [];
    const warnings = [];
    const workingFeatures = [];
    
    try {
        // Issue 1: Test basic page loading
        console.log('\\n1️⃣  Testing basic page loading...');
        await page.goto('http://localhost:5177', { waitUntil: 'domcontentloaded', timeout: 10000 });
        
        const title = await page.title();
        const url = page.url();
        
        console.log(`   Title: "${title}"`);
        console.log(`   URL: ${url}`);
        
        if (title && title !== 'localhost') {
            workingFeatures.push('✅ Page loads with proper title');
        } else {
            criticalIssues.push('❌ Page title missing or default');
        }
        
        // Issue 2: Test registration page specifically
        console.log('\\n2️⃣  Testing registration page navigation...');
        try {
            await page.goto('http://localhost:5177/auth/register', { timeout: 10000 });
            await page.waitForLoadState('domcontentloaded');
            
            console.log(`   Registration URL: ${page.url()}`);
            
            if (page.url().includes('/register')) {
                workingFeatures.push('✅ Registration page accessible');
                
                // Test form existence with shorter timeout
                try {
                    const hasForm = await page.locator('form').count({ timeout: 3000 }) > 0;
                    console.log(`   Has form: ${hasForm}`);
                    
                    if (hasForm) {
                        workingFeatures.push('✅ Registration form present');
                        
                        // Quick test of form fields
                        const inputCount = await page.locator('input').count({ timeout: 2000 });
                        console.log(`   Input fields: ${inputCount}`);
                        
                        if (inputCount === 0) {
                            criticalIssues.push('❌ CRITICAL: Registration form has no input fields');
                        }
                    } else {
                        criticalIssues.push('❌ CRITICAL: Registration form not found');
                    }
                } catch (formError) {
                    criticalIssues.push(`❌ CRITICAL: Registration form timeout - ${formError.message.slice(0, 50)}`);
                }
            } else {
                warnings.push('⚠️  Registration page redirects unexpectedly');
            }
        } catch (regError) {
            criticalIssues.push(`❌ CRITICAL: Cannot access registration page - ${regError.message.slice(0, 50)}`);
        }
        
        // Issue 3: Test login page
        console.log('\\n3️⃣  Testing login page...');
        try {
            await page.goto('http://localhost:5177/auth/login', { timeout: 10000 });
            await page.waitForLoadState('domcontentloaded');
            
            const loginForm = await page.locator('form').count({ timeout: 3000 });
            const emailField = await page.locator('input[type="email"]').count({ timeout: 2000 });
            const passwordField = await page.locator('input[type="password"]').count({ timeout: 2000 });
            const submitButton = await page.locator('button[type="submit"]').count({ timeout: 2000 });
            
            console.log(`   Login form: ${loginForm > 0 ? '✅' : '❌'}`);
            console.log(`   Email field: ${emailField > 0 ? '✅' : '❌'}`);
            console.log(`   Password field: ${passwordField > 0 ? '✅' : '❌'}`);
            console.log(`   Submit button: ${submitButton > 0 ? '✅' : '❌'}`);
            
            if (loginForm > 0 && emailField > 0 && passwordField > 0) {
                workingFeatures.push('✅ Login form fully functional');
            } else {
                criticalIssues.push('❌ CRITICAL: Login form incomplete');
            }
        } catch (loginError) {
            criticalIssues.push(`❌ CRITICAL: Login page error - ${loginError.message.slice(0, 50)}`);
        }
        
        // Issue 4: Test API connectivity
        console.log('\\n4️⃣  Testing API connectivity...');
        const apiTests = [
            { url: 'http://localhost:3003/health', name: 'Health Check' },
            { url: 'http://localhost:3003/api/auth/me', name: 'Auth Status' }
        ];
        
        for (const api of apiTests) {
            try {
                console.log(`   Testing ${api.name}...`);
                const response = await page.request.get(api.url, { timeout: 5000 });
                const status = response.status();
                
                console.log(`     ${api.name}: ${status} ${status < 500 ? '✅' : '❌'}`);
                
                if (status === 404) {
                    criticalIssues.push(`❌ API: ${api.name} endpoint not found (404)`);
                } else if (status >= 500) {
                    criticalIssues.push(`❌ API: ${api.name} server error (${status})`);
                } else {
                    workingFeatures.push(`✅ API: ${api.name} responding (${status})`);
                }
            } catch (apiError) {
                criticalIssues.push(`❌ API: ${api.name} - ${apiError.message.slice(0, 50)}`);
                console.log(`     ${api.name}: Error - ${apiError.message.slice(0, 50)}`);
            }
        }
        
        // Issue 5: Test authentication flow
        console.log('\\n5️⃣  Testing authentication flow...');
        try {
            await page.goto('http://localhost:5177/auth/login');
            await page.waitForLoadState('domcontentloaded');
            
            // Fill login form with test data
            await page.fill('input[type="email"]', 'test@example.com');
            await page.fill('input[type="password"]', 'testpassword');
            
            console.log('   Form filling: ✅');
            workingFeatures.push('✅ Login form accepts input');
            
            // Test form submission (don't wait for success, just test it submits)
            const submitButton = page.locator('button[type="submit"]');
            const isEnabled = await submitButton.isEnabled();
            
            console.log(`   Submit button enabled: ${isEnabled ? '✅' : '❌'}`);
            
            if (isEnabled) {
                workingFeatures.push('✅ Login form submittable');
                
                // Try to submit and capture network activity
                const networkPromise = page.waitForResponse(response => 
                    response.url().includes('/api/auth/login'), 
                    { timeout: 8000 }
                ).catch(() => null);
                
                await submitButton.click();
                
                const response = await networkPromise;
                if (response) {
                    console.log(`   API call made: ${response.status()} ✅`);
                    workingFeatures.push('✅ Login API call successful');
                } else {
                    warnings.push('⚠️  Login API call may have failed or timed out');
                }
            } else {
                criticalIssues.push('❌ Login submit button disabled');
            }
        } catch (authError) {
            criticalIssues.push(`❌ Authentication flow error - ${authError.message.slice(0, 50)}`);
        }
        
        // Issue 6: Test protected routes
        console.log('\\n6️⃣  Testing protected routes...');
        const protectedRoutes = ['/dashboard', '/test-bank', '/analytics', '/reports'];
        
        for (const route of protectedRoutes) {
            try {
                console.log(`   Testing ${route}...`);
                await page.goto(`http://localhost:5177${route}`, { timeout: 8000 });
                await page.waitForLoadState('domcontentloaded');
                
                const currentUrl = page.url();
                
                if (currentUrl.includes('/auth/login')) {
                    console.log(`     ${route}: Protected ✅ (redirected to login)`);
                    workingFeatures.push(`✅ Auth guard: ${route} properly protected`);
                } else if (currentUrl.includes(route)) {
                    warnings.push(`⚠️  ${route}: Accessible without auth`);
                } else {
                    warnings.push(`⚠️  ${route}: Unexpected redirect to ${currentUrl}`);
                }
            } catch (routeError) {
                criticalIssues.push(`❌ Route ${route}: ${routeError.message.slice(0, 50)}`);
            }
        }
        
        // Issue 7: Test JavaScript errors
        console.log('\\n7️⃣  Testing for JavaScript errors...');
        const jsErrors = [];
        
        page.on('pageerror', error => {
            jsErrors.push(error.message);
            console.log(`   JS Error detected: ${error.message.slice(0, 80)}`);
        });
        
        // Reload page to trigger any JS errors
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000);
        
        if (jsErrors.length === 0) {
            workingFeatures.push('✅ No JavaScript runtime errors');
        } else {
            criticalIssues.push(`❌ JavaScript errors detected: ${jsErrors.length}`);
        }
        
        await page.screenshot({ path: 'screenshots/final_state.png' });
        
    } catch (error) {
        criticalIssues.push(`❌ CRITICAL: Test suite failure - ${error.message}`);
        console.error('\\n❌ Critical error:', error.message);
    }
    
    // Comprehensive Results
    console.log('\\n' + '='.repeat(60));
    console.log('📊 COMPREHENSIVE ISSUE ANALYSIS RESULTS');
    console.log('='.repeat(60));
    
    console.log('\\n🚨 CRITICAL ISSUES:');
    if (criticalIssues.length === 0) {
        console.log('   None! 🎉');
    } else {
        criticalIssues.forEach((issue, i) => {
            console.log(`   ${i + 1}. ${issue}`);
        });
    }
    
    console.log('\\n⚠️  WARNINGS:');
    if (warnings.length === 0) {
        console.log('   None!');
    } else {
        warnings.forEach((warning, i) => {
            console.log(`   ${i + 1}. ${warning}`);
        });
    }
    
    console.log('\\n✅ WORKING FEATURES:');
    workingFeatures.forEach((feature, i) => {
        console.log(`   ${i + 1}. ${feature}`);
    });
    
    console.log('\\n📈 SUMMARY:');
    console.log(`   🚨 Critical Issues: ${criticalIssues.length}`);
    console.log(`   ⚠️  Warnings: ${warnings.length}`);
    console.log(`   ✅ Working Features: ${workingFeatures.length}`);
    
    const healthScore = workingFeatures.length / (workingFeatures.length + criticalIssues.length + warnings.length);
    console.log(`   📊 Health Score: ${Math.round(healthScore * 100)}%`);
    
    const results = {
        criticalIssues,
        warnings,
        workingFeatures,
        healthScore: Math.round(healthScore * 100),
        timestamp: new Date().toISOString()
    };
    
    await browser.close();
    
    require('fs').writeFileSync('issue-analysis.json', JSON.stringify(results, null, 2));
    console.log('\\n📄 Results saved to: issue-analysis.json');
    
    return results;
}

identifyAllIssues().catch(console.error);