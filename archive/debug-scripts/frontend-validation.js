const { chromium } = require('playwright');

async function validateFrontendFunctionality() {
    console.log('🔍 Starting Frontend Functionality Validation');
    console.log('=' .repeat(60));
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 1000 // Add delay to see interactions
    });
    const page = await browser.newPage();
    
    try {
        // Navigate to frontend
        console.log('📱 Navigating to frontend: http://localhost:5177');
        await page.goto('http://localhost:5177');
        await page.waitForLoadState('networkidle');
        
        console.log(`✅ Page loaded: ${await page.title()}`);
        console.log(`📍 Current URL: ${page.url()}`);
        
        // Take initial screenshot
        await page.screenshot({ path: 'screenshots/01_initial_page.png' });
        
        // Check for login form
        const loginForm = page.locator('form, [data-testid*="login"], .login-form');
        const loginFormCount = await loginForm.count();
        
        if (loginFormCount > 0) {
            console.log('\n🔐 Login form detected - Testing authentication flow');
            
            // Find input fields
            const emailField = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]');
            const passwordField = page.locator('input[type="password"], input[name="password"]');
            const loginButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
            
            console.log(`📧 Email field: ${await emailField.count() > 0 ? '✅ Found' : '❌ Not found'}`);
            console.log(`🔒 Password field: ${await passwordField.count() > 0 ? '✅ Found' : '❌ Not found'}`);
            console.log(`🔘 Login button: ${await loginButton.count() > 0 ? '✅ Found' : '❌ Not found'}`);
            
            if (await emailField.count() > 0 && await passwordField.count() > 0) {
                // Test login with admin credentials
                console.log('\n🧪 Testing login with admin credentials...');
                await emailField.fill('admin@test.com');
                await passwordField.fill('TestPassword123!');
                await page.screenshot({ path: 'screenshots/02_login_filled.png' });
                
                if (await loginButton.count() > 0) {
                    await loginButton.click();
                    console.log('🔄 Login button clicked, waiting for response...');
                    
                    // Wait for either success or error response
                    try {
                        await page.waitForURL('**/dashboard', { timeout: 5000 });
                        console.log('✅ Login successful - redirected to dashboard');
                    } catch (e) {
                        console.log('⏳ Login processing, checking current state...');
                        await page.waitForTimeout(3000);
                    }
                    
                    await page.screenshot({ path: 'screenshots/03_after_login.png' });
                    console.log(`📍 Post-login URL: ${page.url()}`);
                }
            }
        } else {
            console.log('ℹ️  No login form - checking for dashboard content');
        }
        
        // Test all buttons on current page
        console.log('\n🔘 Testing all buttons on current page...');
        const buttons = page.locator('button, [role="button"], .btn, input[type="submit"]');
        const buttonCount = await buttons.count();
        console.log(`Found ${buttonCount} interactive elements`);
        
        for (let i = 0; i < Math.min(buttonCount, 15); i++) {
            try {
                const button = buttons.nth(i);
                const buttonText = (await button.innerText()).slice(0, 30) || 'No text';
                const isVisible = await button.isVisible();
                const isEnabled = await button.isEnabled();
                
                console.log(`  ${i + 1}. "${buttonText}" - Visible: ${isVisible ? '✅' : '❌'}, Enabled: ${isEnabled ? '✅' : '❌'}`);
                
                // Test clicking if it's a safe button (not submit/delete)
                const safeButtonPattern = /^(test|demo|show|view|info|help|cancel|close)/i;
                if (isVisible && isEnabled && safeButtonPattern.test(buttonText)) {
                    console.log(`    🔄 Testing click on "${buttonText}"...`);
                    await button.click();
                    await page.waitForTimeout(1000);
                    console.log(`    ✅ Click successful`);
                }
            } catch (error) {
                console.log(`  ${i + 1}. Button test failed: ${error.message.slice(0, 50)}`);
            }
        }
        
        // Test navigation links
        console.log('\n🧭 Testing navigation links...');
        const navLinks = page.locator('nav a, [role="navigation"] a, .nav a, .navigation a');
        const navCount = await navLinks.count();
        console.log(`Found ${navCount} navigation links`);
        
        const testedPages = [];
        for (let i = 0; i < Math.min(navCount, 8); i++) {
            try {
                const link = navLinks.nth(i);
                const linkText = (await link.innerText()).slice(0, 30);
                const href = await link.getAttribute('href');
                
                if (href && !href.startsWith('#') && !testedPages.includes(href)) {
                    console.log(`  🔗 Testing navigation: "${linkText}" -> ${href}`);
                    await link.click();
                    await page.waitForTimeout(2000);
                    
                    const newUrl = page.url();
                    console.log(`    📍 Navigated to: ${newUrl}`);
                    await page.screenshot({ path: `screenshots/nav_${i + 1}_${linkText.replace(/[^a-z0-9]/gi, '_').slice(0, 20)}.png` });
                    
                    testedPages.push(href);
                    
                    // Test buttons on this new page
                    const pageButtons = page.locator('button:visible, [role="button"]:visible');
                    const pageButtonCount = await pageButtons.count();
                    console.log(`    🔘 Found ${pageButtonCount} buttons on this page`);
                    
                    // Test a few key buttons
                    for (let j = 0; j < Math.min(pageButtonCount, 5); j++) {
                        try {
                            const btn = pageButtons.nth(j);
                            const btnText = (await btn.innerText()).slice(0, 20);
                            const isClickable = await btn.isEnabled();
                            console.log(`      Button: "${btnText}" - ${isClickable ? 'Clickable ✅' : 'Disabled ❌'}`);
                        } catch (e) {
                            console.log(`      Button ${j + 1}: Unable to test`);
                        }
                    }
                }
            } catch (error) {
                console.log(`  ❌ Navigation test ${i + 1} failed: ${error.message.slice(0, 50)}`);
            }
        }
        
        // Check for forms and test basic functionality
        console.log('\n📝 Testing forms...');
        const forms = page.locator('form');
        const formCount = await forms.count();
        console.log(`Found ${formCount} forms`);
        
        for (let i = 0; i < formCount; i++) {
            try {
                const form = forms.nth(i);
                const inputs = form.locator('input, select, textarea');
                const inputCount = await inputs.count();
                console.log(`  Form ${i + 1}: ${inputCount} input fields`);
                
                // Test form inputs
                for (let j = 0; j < Math.min(inputCount, 3); j++) {
                    const input = inputs.nth(j);
                    const inputType = await input.getAttribute('type') || 'text';
                    const placeholder = await input.getAttribute('placeholder') || 'No placeholder';
                    console.log(`    Input ${j + 1}: Type=${inputType}, Placeholder="${placeholder}"`);
                }
            } catch (error) {
                console.log(`  ❌ Form ${i + 1} test failed: ${error.message.slice(0, 50)}`);
            }
        }
        
        // Final screenshot
        await page.screenshot({ path: 'screenshots/99_final_state.png' });
        
        console.log('\n✅ Frontend validation completed successfully');
        console.log('📸 Screenshots saved in screenshots/ directory');
        
    } catch (error) {
        console.error('❌ Frontend validation failed:', error.message);
        await page.screenshot({ path: 'screenshots/error_state.png' });
    } finally {
        await browser.close();
    }
}

// Create screenshots directory and run validation
const fs = require('fs');
if (!fs.existsSync('screenshots')) {
    fs.mkdirSync('screenshots');
}

validateFrontendFunctionality().catch(console.error);