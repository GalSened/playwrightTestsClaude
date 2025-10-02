const { chromium } = require('playwright');

async function testAllPagesAndWorkflows() {
    console.log('🔍 COMPREHENSIVE FRONTEND TESTING - ALL PAGES & WORKFLOWS');
    console.log('=' .repeat(80));
    
    const browser = await chromium.launch({ headless: false, slowMo: 500 });
    const page = await browser.newPage();
    
    // Comprehensive testing results
    const testResults = {
        pages: {},
        forms: {},
        buttons: {},
        navigation: {},
        apis: {},
        workflows: {},
        metrics: {},
        reports: {},
        errors: []
    };
    
    // Capture all network requests and errors
    const requests = [];
    const responses = [];
    const errors = [];
    
    page.on('request', req => requests.push({ url: req.url(), method: req.method() }));
    page.on('response', resp => responses.push({ url: resp.url(), status: resp.status() }));
    page.on('pageerror', error => errors.push(error.message));
    
    try {
        console.log('\n📱 PHASE 1: AUTHENTICATION & INITIAL LOAD');
        console.log('-'.repeat(50));
        
        // Test 1: Login Page
        await page.goto('http://localhost:5177');
        await page.waitForLoadState('networkidle');
        
        console.log(`✓ Initial page loaded: ${page.url()}`);
        testResults.pages.login = { status: 'loaded', url: page.url() };
        
        // Test login form elements
        const emailField = page.locator('input[type="email"]');
        const passwordField = page.locator('input[type="password"]');
        const tenantField = page.locator('input[name="tenantSubdomain"]');
        const loginButton = page.locator('button[type="submit"]');
        
        console.log(`📧 Email field: ${await emailField.count() > 0 ? '✅' : '❌'}`);
        console.log(`🔒 Password field: ${await passwordField.count() > 0 ? '✅' : '❌'}`);
        console.log(`🏢 Tenant field: ${await tenantField.count() > 0 ? '✅' : '❌'}`);
        console.log(`🔘 Login button: ${await loginButton.count() > 0 ? '✅' : '❌'}`);
        
        testResults.forms.login = {
            email: await emailField.count() > 0,
            password: await passwordField.count() > 0,
            tenant: await tenantField.count() > 0,
            submitButton: await loginButton.count() > 0
        };
        
        // Test 2: Registration Page
        console.log('\\n🔗 Testing registration page navigation...');
        const registerLink = page.locator('a:has-text("Create account"), a:has-text("Sign up"), a:has-text("Register")');
        if (await registerLink.count() > 0) {
            await registerLink.click();
            await page.waitForLoadState('networkidle');
            console.log(`✓ Registration page: ${page.url()}`);
            testResults.pages.register = { status: 'loaded', url: page.url() };
            
            // Test registration form elements
            const regFields = {
                email: page.locator('input[type="email"]'),
                password: page.locator('input[type="password"]'),
                name: page.locator('input[name="name"], input[placeholder*="name" i]'),
                company: page.locator('input[name="companyName"], input[placeholder*="company" i]'),
                subdomain: page.locator('input[name="subdomain"], input[placeholder*="subdomain" i]')
            };
            
            for (const [field, locator] of Object.entries(regFields)) {
                const exists = await locator.count() > 0;
                console.log(`  ${field}: ${exists ? '✅' : '❌'}`);
            }
            
            testResults.forms.register = {
                email: await regFields.email.count() > 0,
                password: await regFields.password.count() > 0,
                name: await regFields.name.count() > 0,
                company: await regFields.company.count() > 0,
                subdomain: await regFields.subdomain.count() > 0
            };
        } else {
            console.log('❌ No registration link found');
            testResults.pages.register = { status: 'not_found', url: null };
        }
        
        console.log('\\n📊 PHASE 2: ATTEMPTING AUTHENTICATION BYPASS FOR FULL APP TESTING');
        console.log('-'.repeat(50));
        
        // Try direct navigation to dashboard to test other pages
        const testUrls = [
            '/dashboard',
            '/test-bank',
            '/analytics', 
            '/reports',
            '/settings',
            '/schedules'
        ];
        
        for (const url of testUrls) {
            console.log(`\\n🔍 Testing page: ${url}`);
            try {
                await page.goto(`http://localhost:5177${url}`, { timeout: 10000 });
                await page.waitForLoadState('networkidle', { timeout: 5000 });
                
                const currentUrl = page.url();
                const pageTitle = await page.title();
                
                console.log(`  URL: ${currentUrl}`);
                console.log(`  Title: ${pageTitle}`);
                
                // Check if redirected to login (auth guard working)
                if (currentUrl.includes('/auth/login')) {
                    console.log('  🔒 Auth guard active - redirected to login');
                    testResults.pages[url.replace('/', '')] = { 
                        status: 'auth_protected', 
                        redirected: true,
                        authGuard: true
                    };
                } else {
                    console.log('  ✅ Page accessible');
                    testResults.pages[url.replace('/', '')] = { 
                        status: 'accessible', 
                        url: currentUrl,
                        title: pageTitle
                    };
                    
                    // Test elements on this page
                    await testPageElements(page, url, testResults);
                }
                
                await page.screenshot({ path: `screenshots/page_${url.replace('/', '')}.png` });
                
            } catch (error) {
                console.log(`  ❌ Error loading ${url}: ${error.message.slice(0, 100)}`);
                testResults.errors.push(`Page ${url}: ${error.message}`);
                testResults.pages[url.replace('/', '')] = { 
                    status: 'error', 
                    error: error.message
                };
            }
        }
        
        console.log('\\n🔘 PHASE 3: TESTING ALL INTERACTIVE ELEMENTS');
        console.log('-'.repeat(50));
        
        // Go back to main page and test all buttons/links
        await page.goto('http://localhost:5177');
        await page.waitForLoadState('networkidle');
        
        const allButtons = page.locator('button, [role="button"], .btn, input[type="submit"], input[type="button"]');
        const buttonCount = await allButtons.count();
        console.log(`Found ${buttonCount} interactive button elements`);
        
        for (let i = 0; i < Math.min(buttonCount, 20); i++) {
            try {
                const button = allButtons.nth(i);
                const buttonText = (await button.innerText()).slice(0, 30) || await button.getAttribute('aria-label') || 'No text';
                const isVisible = await button.isVisible();
                const isEnabled = await button.isEnabled();
                
                console.log(`  Button ${i+1}: "${buttonText}" - Visible: ${isVisible ? '✅' : '❌'}, Enabled: ${isEnabled ? '✅' : '❌'}`);
                
                testResults.buttons[`button_${i+1}`] = {
                    text: buttonText,
                    visible: isVisible,
                    enabled: isEnabled
                };
                
                // Test safe buttons (avoid destructive actions)
                if (isVisible && isEnabled && !/(delete|remove|clear|reset)/i.test(buttonText)) {
                    console.log(`    🔄 Testing click on "${buttonText}"...`);
                    const originalUrl = page.url();
                    
                    try {
                        await button.click();
                        await page.waitForTimeout(1000);
                        
                        const newUrl = page.url();
                        if (newUrl !== originalUrl) {
                            console.log(`    📍 Navigation occurred: ${newUrl}`);
                            testResults.buttons[`button_${i+1}`].navigation = { from: originalUrl, to: newUrl };
                        } else {
                            console.log(`    ✅ Click successful (no navigation)`);
                        }
                        testResults.buttons[`button_${i+1}`].clickable = true;
                    } catch (error) {
                        console.log(`    ❌ Click failed: ${error.message.slice(0, 50)}`);
                        testResults.buttons[`button_${i+1}`].clickable = false;
                        testResults.buttons[`button_${i+1}`].error = error.message;
                    }
                }
            } catch (error) {
                console.log(`  Button ${i+1}: Test failed - ${error.message.slice(0, 50)}`);
            }
        }
        
        console.log('\\n🌐 PHASE 4: NETWORK & API TESTING');
        console.log('-'.repeat(50));
        
        // Test API endpoints
        const apiEndpoints = [
            '/api/health',
            '/api/auth/me',
            '/api/test-runs',
            '/api/analytics/overview',
            '/api/reports/summary'
        ];
        
        for (const endpoint of apiEndpoints) {
            try {
                console.log(`Testing API: ${endpoint}`);
                const response = await page.request.get(`http://localhost:3003${endpoint}`);
                const status = response.status();
                
                console.log(`  ${endpoint}: ${status} ${status < 400 ? '✅' : '❌'}`);
                
                testResults.apis[endpoint] = {
                    status: status,
                    accessible: status < 500,
                    authenticated: status !== 401
                };
                
                if (status === 200) {
                    const responseBody = await response.text();
                    console.log(`    Response length: ${responseBody.length} chars`);
                }
            } catch (error) {
                console.log(`  ${endpoint}: Error - ${error.message.slice(0, 50)} ❌`);
                testResults.apis[endpoint] = {
                    status: 'error',
                    error: error.message
                };
            }
        }
        
        console.log('\\n📈 PHASE 5: METRICS & CHARTS TESTING');
        console.log('-'.repeat(50));
        
        // Look for chart and metrics elements
        const chartElements = page.locator('canvas, svg, .recharts-wrapper, .chart-container, [data-testid*="chart"]');
        const metricElements = page.locator('.metric, .stat, .kpi, [data-testid*="metric"]');
        
        const chartCount = await chartElements.count();
        const metricCount = await metricElements.count();
        
        console.log(`📊 Charts found: ${chartCount}`);
        console.log(`📈 Metrics found: ${metricCount}`);
        
        testResults.metrics = {
            chartsFound: chartCount,
            metricsFound: metricCount,
            chartsAccessible: chartCount > 0,
            metricsAccessible: metricCount > 0
        };
        
        console.log('\\n📋 PHASE 6: FORMS & INPUT VALIDATION');
        console.log('-'.repeat(50));
        
        const allForms = page.locator('form');
        const allInputs = page.locator('input, textarea, select');
        
        const formCount = await allForms.count();
        const inputCount = await allInputs.count();
        
        console.log(`📝 Forms found: ${formCount}`);
        console.log(`⌨️  Input fields found: ${inputCount}`);
        
        // Test form validation
        for (let i = 0; i < Math.min(formCount, 5); i++) {
            try {
                const form = allForms.nth(i);
                const formInputs = form.locator('input, textarea, select');
                const inputsInForm = await formInputs.count();
                
                console.log(`  Form ${i+1}: ${inputsInForm} inputs`);
                
                // Test required field validation
                const requiredInputs = form.locator('input[required], textarea[required], select[required]');
                const requiredCount = await requiredInputs.count();
                console.log(`    Required fields: ${requiredCount}`);
                
                testResults.forms[`form_${i+1}`] = {
                    totalInputs: inputsInForm,
                    requiredFields: requiredCount,
                    accessible: true
                };
            } catch (error) {
                console.log(`  Form ${i+1}: Error - ${error.message.slice(0, 50)}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Comprehensive test failed:', error.message);
        testResults.errors.push(`Global error: ${error.message}`);
        await page.screenshot({ path: 'screenshots/comprehensive_test_error.png' });
    }
    
    // Final results summary
    console.log('\\n' + '='.repeat(80));
    console.log('📊 COMPREHENSIVE TEST RESULTS SUMMARY');
    console.log('='.repeat(80));
    
    console.log('\\n📄 Pages Tested:');
    for (const [page, result] of Object.entries(testResults.pages)) {
        console.log(`  ${page}: ${result.status} ${getStatusEmoji(result.status)}`);
    }
    
    console.log('\\n📝 Forms Tested:');
    for (const [form, result] of Object.entries(testResults.forms)) {
        if (typeof result === 'object' && result.totalInputs !== undefined) {
            console.log(`  ${form}: ${result.totalInputs} inputs, ${result.requiredFields} required ✅`);
        }
    }
    
    console.log('\\n🔘 Button Summary:');
    const buttonStats = Object.values(testResults.buttons).filter(b => typeof b === 'object');
    const visibleButtons = buttonStats.filter(b => b.visible).length;
    const enabledButtons = buttonStats.filter(b => b.enabled).length;
    const clickableButtons = buttonStats.filter(b => b.clickable).length;
    
    console.log(`  Total: ${buttonStats.length}, Visible: ${visibleButtons}, Enabled: ${enabledButtons}, Clickable: ${clickableButtons}`);
    
    console.log('\\n🌐 API Endpoints:');
    for (const [endpoint, result] of Object.entries(testResults.apis)) {
        console.log(`  ${endpoint}: ${result.status} ${result.accessible ? '✅' : '❌'}`);
    }
    
    console.log('\\n📊 Metrics & Charts:');
    console.log(`  Charts: ${testResults.metrics.chartsFound} ${testResults.metrics.chartsAccessible ? '✅' : '❌'}`);
    console.log(`  Metrics: ${testResults.metrics.metricsFound} ${testResults.metrics.metricsAccessible ? '✅' : '❌'}`);
    
    if (testResults.errors.length > 0) {
        console.log('\\n❌ Errors Encountered:');
        testResults.errors.slice(0, 10).forEach((error, i) => {
            console.log(`  ${i+1}. ${error.slice(0, 100)}`);
        });
    }
    
    console.log('\\n✅ Comprehensive frontend testing completed!');
    console.log(`📸 Screenshots saved: screenshots/ directory`);
    console.log(`📊 Total pages tested: ${Object.keys(testResults.pages).length}`);
    console.log(`🔘 Total buttons tested: ${Object.keys(testResults.buttons).length}`);
    console.log(`📝 Total forms tested: ${Object.keys(testResults.forms).length - 1}`); // -1 for login/register
    
    await browser.close();
    
    // Save detailed results to file
    require('fs').writeFileSync('comprehensive-test-results.json', JSON.stringify(testResults, null, 2));
    console.log(`📄 Detailed results saved to: comprehensive-test-results.json`);
    
    return testResults;
}

async function testPageElements(page, pageUrl, testResults) {
    console.log(`    🔍 Testing elements on ${pageUrl}...`);
    
    try {
        // Count various element types
        const buttons = await page.locator('button, [role="button"]').count();
        const links = await page.locator('a[href]').count();
        const inputs = await page.locator('input, textarea, select').count();
        const charts = await page.locator('canvas, svg, .chart').count();
        const tables = await page.locator('table, .table, [role="table"]').count();
        
        console.log(`      Buttons: ${buttons}, Links: ${links}, Inputs: ${inputs}, Charts: ${charts}, Tables: ${tables}`);
        
        testResults.pages[pageUrl.replace('/', '')].elements = {
            buttons, links, inputs, charts, tables
        };
        
        // Test any visible forms
        const forms = page.locator('form');
        const formCount = await forms.count();
        
        if (formCount > 0) {
            console.log(`      📝 Testing ${formCount} forms...`);
            for (let i = 0; i < formCount; i++) {
                const form = forms.nth(i);
                const formInputs = await form.locator('input, select, textarea').count();
                console.log(`        Form ${i+1}: ${formInputs} inputs`);
            }
        }
        
    } catch (error) {
        console.log(`    ❌ Element testing failed: ${error.message.slice(0, 50)}`);
    }
}

function getStatusEmoji(status) {
    switch (status) {
        case 'loaded': return '✅';
        case 'accessible': return '✅';
        case 'auth_protected': return '🔒';
        case 'error': return '❌';
        case 'not_found': return '❓';
        default: return '❓';
    }
}

testAllPagesAndWorkflows().catch(console.error);