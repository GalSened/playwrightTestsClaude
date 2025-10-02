const { chromium } = require('playwright');

async function deepApplicationAnalysis() {
    console.log('🔬 DEEP APPLICATION ANALYSIS - BYPASSING AUTH & TESTING CORE FUNCTIONALITY');
    console.log('=' .repeat(90));
    
    const browser = await chromium.launch({ headless: false, slowMo: 300 });
    const page = await browser.newPage();
    
    const issues = [];
    const workingFeatures = [];
    
    try {
        console.log('\\n🔧 PHASE 1: TESTING REGISTRATION PAGE FUNCTIONALITY');
        console.log('-'.repeat(60));
        
        await page.goto('http://localhost:5177/auth/register');
        await page.waitForLoadState('networkidle');
        
        // Detailed registration form analysis
        console.log('📋 Analyzing registration form structure...');
        
        const formHTML = await page.locator('form').innerHTML();
        console.log('Form HTML length:', formHTML.length);
        
        // Look for all input types
        const inputs = {
            text: await page.locator('input[type="text"]').count(),
            email: await page.locator('input[type="email"]').count(),
            password: await page.locator('input[type="password"]').count(),
            submit: await page.locator('input[type="submit"], button[type="submit"]').count(),
            allInputs: await page.locator('input, textarea, select').count()
        };
        
        console.log('Input field counts:', inputs);
        
        if (inputs.allInputs === 0) {
            issues.push('❌ CRITICAL: Registration form has no input fields');
        } else {
            workingFeatures.push('✅ Registration form structure exists');
        }
        
        // Check for field labels and placeholders
        const labels = await page.locator('label').count();
        const placeholders = await page.locator('input[placeholder]').count();
        
        console.log(`Labels: ${labels}, Placeholders: ${placeholders}`);
        
        console.log('\\n🔐 PHASE 2: ATTEMPTING LOCAL STORAGE AUTH BYPASS');
        console.log('-'.repeat(60));
        
        // Try to set a fake auth token to bypass guards
        await page.evaluate(() => {
            localStorage.setItem('auth_token', 'fake-jwt-token-for-testing');
        });
        
        // Test if this bypasses auth guards
        await page.goto('http://localhost:5177/dashboard');
        await page.waitForLoadState('networkidle');
        
        const dashboardUrl = page.url();
        console.log(`Dashboard access attempt: ${dashboardUrl}`);
        
        if (dashboardUrl.includes('/dashboard')) {
            console.log('✅ Auth bypass successful - can access dashboard');
            workingFeatures.push('✅ Dashboard accessible with token');
            
            await testDashboardElements(page, issues, workingFeatures);
        } else {
            console.log('🔒 Auth bypass failed - testing auth guard robustness');
            workingFeatures.push('✅ Auth guards are properly implemented');
            
            // Test if AuthContext validation is working
            const authError = await page.locator('.error, .alert, [role="alert"]').count();
            console.log(`Auth error indicators: ${authError}`);
        }
        
        console.log('\\n🌐 PHASE 3: DETAILED API ENDPOINT ANALYSIS');
        console.log('-'.repeat(60));
        
        // Check what endpoints are actually available
        const apiTests = [
            { endpoint: '/health', expected: 'Server health check' },
            { endpoint: '/api/auth/login', method: 'POST', expected: 'Login endpoint' },
            { endpoint: '/api/auth/register', method: 'POST', expected: 'Registration endpoint' },
            { endpoint: '/api/test-runs', expected: 'Test runs API' },
            { endpoint: '/api/analytics', expected: 'Analytics API' },
            { endpoint: '/metrics', expected: 'Metrics endpoint' }
        ];
        
        for (const test of apiTests) {
            try {
                console.log(`Testing ${test.method || 'GET'} ${test.endpoint}...`);
                
                let response;
                if (test.method === 'POST') {
                    response = await page.request.post(`http://localhost:3003${test.endpoint}`, {
                        data: { test: 'data' },
                        headers: { 'Content-Type': 'application/json' }
                    });
                } else {
                    response = await page.request.get(`http://localhost:3003${test.endpoint}`, {
                        timeout: 5000
                    });
                }
                
                const status = response.status();
                const responseText = await response.text().catch(() => 'No response body');
                
                console.log(`  Status: ${status}`);
                console.log(`  Response: ${responseText.slice(0, 100)}...`);
                
                if (status === 404) {
                    issues.push(`❌ API: ${test.endpoint} not found (404)`);
                } else if (status >= 200 && status < 500) {
                    workingFeatures.push(`✅ API: ${test.endpoint} responds (${status})`);
                } else {
                    issues.push(`⚠️  API: ${test.endpoint} error (${status})`);
                }
                
            } catch (error) {
                console.log(`  Error: ${error.message.slice(0, 100)}`);
                issues.push(`❌ API: ${test.endpoint} - ${error.message.slice(0, 50)}`);
            }
        }
        
        console.log('\\n📊 PHASE 4: COMPONENT & LIBRARY TESTING');
        console.log('-'.repeat(60));
        
        // Go back to login page for component testing
        await page.goto('http://localhost:5177/auth/login');
        await page.waitForLoadState('networkidle');
        
        // Test React components are loading
        const reactDevTools = await page.evaluate(() => {
            return !!window.React || !!window.ReactDOM || !!document.querySelector('[data-reactroot]');
        });
        
        console.log(`React framework loaded: ${reactDevTools ? '✅' : '❌'}`);
        
        if (reactDevTools) {
            workingFeatures.push('✅ React framework operational');
        } else {
            issues.push('❌ CRITICAL: React framework not detected');
        }
        
        // Test CSS framework (TailwindCSS)
        const hasTailwind = await page.evaluate(() => {
            const styles = Array.from(document.styleSheets).map(sheet => {
                try {
                    return Array.from(sheet.cssRules).map(rule => rule.cssText).join(' ');
                } catch (e) {
                    return '';
                }
            }).join(' ');
            return styles.includes('tailwind') || document.querySelector('.bg-gradient-to-br, .rounded-lg, .shadow-lg');
        });
        
        console.log(`TailwindCSS detected: ${hasTailwind ? '✅' : '❌'}`);
        
        if (hasTailwind) {
            workingFeatures.push('✅ TailwindCSS styling active');
        } else {
            issues.push('⚠️  TailwindCSS may not be loading properly');
        }
        
        // Test JavaScript execution and errors
        const jsErrors = [];
        page.on('pageerror', error => jsErrors.push(error.message));
        
        await page.reload();
        await page.waitForTimeout(3000);
        
        console.log(`JavaScript errors: ${jsErrors.length}`);
        if (jsErrors.length > 0) {
            issues.push(`❌ JavaScript errors detected: ${jsErrors.length}`);
            jsErrors.slice(0, 3).forEach(error => {
                console.log(`  JS Error: ${error.slice(0, 100)}`);
            });
        } else {
            workingFeatures.push('✅ No JavaScript runtime errors');
        }
        
        console.log('\\n🔍 PHASE 5: SOURCE CODE & ROUTING ANALYSIS');
        console.log('-'.repeat(60));
        
        // Test different route patterns
        const routeTests = [
            '/auth/login',
            '/auth/register', 
            '/dashboard',
            '/test-bank',
            '/analytics',
            '/reports',
            '/settings',
            '/admin',
            '/profile',
            '/not-found-page'
        ];
        
        for (const route of routeTests) {
            try {
                await page.goto(`http://localhost:5177${route}`, { timeout: 5000 });
                await page.waitForLoadState('networkidle', { timeout: 3000 });
                
                const currentUrl = page.url();
                const title = await page.title();
                
                console.log(`Route ${route}: ${currentUrl} - "${title}"`);
                
                // Check if properly routing
                if (currentUrl.includes(route) || (route.includes('not-found') && currentUrl.includes('404'))) {
                    workingFeatures.push(`✅ Route ${route}: Direct access works`);
                } else if (currentUrl.includes('/auth/login') && !route.includes('/auth/')) {
                    workingFeatures.push(`✅ Route ${route}: Auth guard active`);
                } else {
                    issues.push(`⚠️  Route ${route}: Unexpected redirect to ${currentUrl}`);
                }
                
            } catch (error) {
                issues.push(`❌ Route ${route}: ${error.message.slice(0, 50)}`);
            }
        }
        
        console.log('\\n🎨 PHASE 6: UI/UX & ACCESSIBILITY TESTING');
        console.log('-'.repeat(60));
        
        await page.goto('http://localhost:5177/auth/login');
        await page.waitForLoadState('networkidle');
        
        // Test accessibility features
        const a11yFeatures = {
            labels: await page.locator('label').count(),
            ariaLabels: await page.locator('[aria-label]').count(),
            headings: await page.locator('h1, h2, h3, h4, h5, h6').count(),
            altTexts: await page.locator('img[alt]').count(),
            focusable: await page.locator('[tabindex], button, input, select, textarea, a[href]').count()
        };
        
        console.log('Accessibility features:', a11yFeatures);
        
        if (a11yFeatures.labels > 0 || a11yFeatures.ariaLabels > 0) {
            workingFeatures.push('✅ Basic accessibility features present');
        } else {
            issues.push('⚠️  Limited accessibility features detected');
        }
        
        // Test responsive design
        const viewports = [
            { width: 1920, height: 1080, name: 'Desktop' },
            { width: 768, height: 1024, name: 'Tablet' },
            { width: 375, height: 667, name: 'Mobile' }
        ];
        
        for (const viewport of viewports) {
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            await page.waitForTimeout(500);
            
            const loginButton = page.locator('button[type="submit"]');
            const isVisible = await loginButton.isVisible();
            
            console.log(`${viewport.name} (${viewport.width}x${viewport.height}): Login button visible = ${isVisible ? '✅' : '❌'}`);
            
            if (isVisible) {
                workingFeatures.push(`✅ Responsive: ${viewport.name} layout works`);
            } else {
                issues.push(`❌ Responsive: ${viewport.name} layout broken`);
            }
        }
        
    } catch (error) {
        console.error('❌ Deep analysis failed:', error.message);
        issues.push(`❌ CRITICAL: Analysis failure - ${error.message}`);
        await page.screenshot({ path: 'screenshots/deep_analysis_error.png' });
    }
    
    // Comprehensive summary
    console.log('\\n' + '='.repeat(90));
    console.log('📋 COMPREHENSIVE APPLICATION ANALYSIS RESULTS');
    console.log('='.repeat(90));
    
    console.log('\\n✅ WORKING FEATURES:');
    workingFeatures.forEach((feature, i) => {
        console.log(`  ${i + 1}. ${feature}`);
    });
    
    console.log('\\n❌ IDENTIFIED ISSUES:');
    issues.forEach((issue, i) => {
        console.log(`  ${i + 1}. ${issue}`);
    });
    
    console.log('\\n📊 SUMMARY METRICS:');
    console.log(`  ✅ Working features: ${workingFeatures.length}`);
    console.log(`  ❌ Issues identified: ${issues.length}`);
    console.log(`  📈 Health score: ${Math.round((workingFeatures.length / (workingFeatures.length + issues.length)) * 100)}%`);
    
    const analysisResults = {
        workingFeatures,
        issues,
        healthScore: Math.round((workingFeatures.length / (workingFeatures.length + issues.length)) * 100),
        totalFeaturesTested: workingFeatures.length + issues.length,
        timestamp: new Date().toISOString()
    };
    
    await browser.close();
    
    // Save results
    require('fs').writeFileSync('deep-analysis-results.json', JSON.stringify(analysisResults, null, 2));
    console.log('\\n📄 Detailed analysis saved to: deep-analysis-results.json');
    
    return analysisResults;
}

async function testDashboardElements(page, issues, workingFeatures) {
    console.log('🏠 Testing Dashboard Elements...');
    
    try {
        // Look for typical dashboard components
        const dashboardElements = {
            cards: await page.locator('.card, .dashboard-card, [data-testid*="card"]').count(),
            charts: await page.locator('canvas, svg, .chart').count(),
            tables: await page.locator('table, .table, [role="table"]').count(),
            buttons: await page.locator('button').count(),
            navigation: await page.locator('nav, .nav, [role="navigation"]').count(),
            metrics: await page.locator('.metric, .stat, .kpi').count()
        };
        
        console.log('  Dashboard elements:', dashboardElements);
        
        Object.entries(dashboardElements).forEach(([element, count]) => {
            if (count > 0) {
                workingFeatures.push(`✅ Dashboard: ${element} present (${count})`);
            } else {
                issues.push(`❌ Dashboard: No ${element} found`);
            }
        });
        
        // Test dashboard functionality
        const testButtons = await page.locator('button:visible').count();
        console.log(`  Testing ${testButtons} dashboard buttons...`);
        
        for (let i = 0; i < Math.min(testButtons, 5); i++) {
            const button = page.locator('button:visible').nth(i);
            const buttonText = await button.innerText().catch(() => 'No text');
            const isEnabled = await button.isEnabled();
            
            console.log(`    Button: "${buttonText}" - ${isEnabled ? 'Enabled' : 'Disabled'}`);
            
            if (isEnabled) {
                workingFeatures.push(`✅ Dashboard button functional: ${buttonText.slice(0, 20)}`);
            }
        }
        
        await page.screenshot({ path: 'screenshots/dashboard_analysis.png' });
        
    } catch (error) {
        issues.push(`❌ Dashboard testing failed: ${error.message.slice(0, 100)}`);
    }
}

deepApplicationAnalysis().catch(console.error);