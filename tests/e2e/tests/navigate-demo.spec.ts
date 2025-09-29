import { test, expect } from '@playwright/test';

test.describe('Live Navigation Demo', () => {
  test('Navigate to system and demonstrate login', async ({ page }) => {
    console.log('🚀 Starting live navigation demo...');
    
    // Navigate to the system
    console.log('📍 Navigating to http://localhost:3001');
    await page.goto('http://localhost:3001');
    
    // Wait for page to load
    await page.waitForTimeout(3000);
    console.log('✅ Page loaded successfully');
    
    // Take initial screenshot
    await page.screenshot({ path: 'demo-login-page.png', fullPage: true });
    console.log('📸 Screenshot saved as demo-login-page.png');
    
    // Verify the login form elements are visible
    const companyField = page.locator('input[placeholder*="your-company"], input[name*="company"], input[name*="subdomain"]').first();
    const emailField = page.locator('input[type="email"], input[placeholder*="you@company.com"]').first();
    const passwordField = page.locator('input[type="password"], input[placeholder*="Enter your password"]').first();
    const signInButton = page.locator('button:has-text("Sign In")').first();
    
    console.log('🔍 Verifying form elements...');
    await expect(emailField).toBeVisible();
    await expect(passwordField).toBeVisible();
    await expect(signInButton).toBeVisible();
    console.log('✅ All form elements are visible and ready');
    
    // Fill in the demo credentials (but don't submit to avoid affecting user session)
    console.log('📝 Filling in demo credentials...');
    await emailField.fill('admin@demo.com');
    await passwordField.fill('demo123');
    
    // Take screenshot with filled credentials
    await page.screenshot({ path: 'demo-credentials-filled.png', fullPage: true });
    console.log('📸 Screenshot with credentials saved as demo-credentials-filled.png');
    
    // Highlight the Sign In button
    await signInButton.hover();
    await page.waitForTimeout(1000);
    
    console.log('✅ Demo complete! Ready to sign in with:');
    console.log('   📧 Email: admin@demo.com');
    console.log('   🔐 Password: demo123');
    console.log('   🌐 URL: http://localhost:3001');
    
    // Verify demo credentials text is visible
    const demoText = page.locator('text=Demo credentials');
    if (await demoText.isVisible()) {
      console.log('📋 Demo credentials help text is visible on page');
    }
  });
});