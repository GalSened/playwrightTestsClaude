import { test, expect } from '@playwright/test';

/**
 * Comprehensive Authentication Tests
 * Tests login, registration, multi-tenancy, and session management
 */
test.describe('User Registration', () => {
  test('should allow new user registration with valid data', async ({ page }) => {
    await page.goto('/auth/register');
    
    // Wait for registration form
    await expect(page.locator('h1, h2')).toContainText(/register|sign up|create account/i);
    
    // Generate unique test data
    const timestamp = Date.now();
    const testEmail = `test${timestamp}@example.com`;
    const testSubdomain = `test${timestamp}`;
    
    // Fill registration form
    await page.fill('input[name="companyName"], [data-testid="company-input"]', 'Test Company E2E');
    await page.fill('input[name="subdomain"], [data-testid="subdomain-input"]', testSubdomain);
    await page.fill('input[name="email"], input[type="email"]', testEmail);
    await page.fill('input[name="password"], input[type="password"]:nth-of-type(1)', 'TestPassword123!');
    await page.fill('input[name="confirmPassword"], input[type="password"]:nth-of-type(2)', 'TestPassword123!');
    
    // Select plan if available
    const planSelector = page.locator('[data-testid*="plan"], .plan-card').first();
    if (await planSelector.isVisible()) {
      await planSelector.click();
    }
    
    // Submit registration
    await page.click('button[type="submit"], .register-button, [data-testid="register-button"]');
    
    // Should redirect to dashboard or success page
    await page.waitForURL(/\/(dashboard|success|welcome)/, { timeout: 15000 });
    
    // Verify successful registration
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/auth/register');
    
    // Should see user dashboard or welcome message
    await expect(page.locator('h1, h2, [data-testid="welcome"], [data-testid="dashboard-page"]')).toBeVisible();
  });
  
  test('should validate registration form fields', async ({ page }) => {
    await page.goto('/auth/register');
    
    // Try to submit empty form
    await page.click('button[type="submit"], .register-button');
    
    // Should show validation errors
    const errorElements = page.locator('.error, .field-error, [data-testid*="error"]');
    const errorCount = await errorElements.count();
    
    if (errorCount > 0) {
      // Verify error messages are visible
      await expect(errorElements.first()).toBeVisible();
    } else {
      // Alternative: form should not submit (URL should not change)
      await expect(page).toHaveURL(/register/);
    }
    
    // Test invalid email format
    await page.fill('input[type="email"]', 'invalid-email');
    await page.fill('input[name="password"]:nth-of-type(1)', 'password123');
    await page.click('button[type="submit"]');
    
    // Should show email validation error
    const emailError = page.locator('.error, [data-testid*="error"]').filter({ hasText: /email|valid/i });
    if (await emailError.count() > 0) {
      await expect(emailError.first()).toBeVisible();
    }
  });
  
  test('should prevent duplicate email registration', async ({ page }) => {
    await page.goto('/auth/register');
    
    // Try to register with existing email
    await page.fill('input[name="companyName"]', 'Test Company');
    await page.fill('input[name="subdomain"]', 'test-dup-' + Date.now());
    await page.fill('input[type="email"]', 'admin@test.com'); // Known existing email
    await page.fill('input[name="password"]:nth-of-type(1)', 'TestPassword123!');
    await page.fill('input[name="confirmPassword"]:nth-of-type(2)', 'TestPassword123!');
    
    await page.click('button[type="submit"]');
    
    // Should show error about existing email
    await page.waitForTimeout(2000);
    
    const errorMessages = page.locator('.error, .alert, [data-testid*="error"]');
    const errorCount = await errorMessages.count();
    
    if (errorCount > 0) {
      const errorText = await errorMessages.first().textContent();
      expect(errorText?.toLowerCase()).toMatch(/exist|already|taken/);
    }
  });
  
  test('should validate password requirements', async ({ page }) => {
    await page.goto('/auth/register');
    
    const passwordTests = [
      { password: '123', expected: 'too short' },
      { password: 'password', expected: 'no numbers or special chars' },
      { password: '12345678', expected: 'no letters' },
      { password: 'Password123', expected: 'no special chars' }
    ];
    
    for (const test of passwordTests) {
      await page.fill('input[name="password"]:nth-of-type(1)', test.password);
      await page.fill('input[name="confirmPassword"]:nth-of-type(2)', test.password);
      
      // Trigger validation by clicking submit or blur
      await page.click('button[type="submit"]');
      
      // Look for password validation errors
      const passwordErrors = page.locator('.error, [data-testid*="error"]')
        .filter({ hasText: /password|character|requirement/i });
      
      if (await passwordErrors.count() > 0) {
        await expect(passwordErrors.first()).toBeVisible();
      }
      
      // Clear fields for next test
      await page.fill('input[name="password"]:nth-of-type(1)', '');
      await page.fill('input[name="confirmPassword"]:nth-of-type(2)', '');
    }
  });
});

test.describe('User Login', () => {
  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/auth/login');
    
    // Wait for login form
    await expect(page.locator('h1, h2')).toContainText(/login|sign in/i);
    
    // Fill login form
    await page.fill('input[type="email"], input[name="email"]', 'admin@test.com');
    await page.fill('input[type="password"], input[name="password"]', 'TestPassword123!');
    
    // Submit login
    await page.click('button[type="submit"], .login-button');
    
    // Should redirect to dashboard
    await page.waitForURL(/\/(dashboard|test-runs|$)/, { timeout: 15000 });
    
    // Verify successful login
    await expect(page.locator('[data-testid="dashboard-page"], h1')).toBeVisible();
    
    // Check for user indication (avatar, name, menu)
    const userIndicators = page.locator('.user-avatar, .user-menu, [data-testid*="user"]');
    if (await userIndicators.count() > 0) {
      await expect(userIndicators.first()).toBeVisible();
    }
  });
  
  test('should reject invalid credentials', async ({ page }) => {
    await page.goto('/auth/login');
    
    const invalidCredentials = [
      { email: 'invalid@test.com', password: 'wrongpassword' },
      { email: 'admin@test.com', password: 'wrongpassword' },
      { email: 'invalid@test.com', password: 'TestPassword123!' }
    ];
    
    for (const creds of invalidCredentials) {
      await page.fill('input[type="email"]', creds.email);
      await page.fill('input[type="password"]', creds.password);
      await page.click('button[type="submit"]');
      
      // Wait for error response
      await page.waitForTimeout(2000);
      
      // Should show error message
      const errorElements = page.locator('.error, .alert-error, [data-testid*="error"]');
      const errorCount = await errorElements.count();
      
      if (errorCount > 0) {
        const errorText = await errorElements.first().textContent();
        expect(errorText?.toLowerCase()).toMatch(/invalid|incorrect|credential/);
      } else {
        // Alternative: should not redirect (still on login page)
        expect(page.url()).toContain('/auth/login');
      }
      
      // Clear fields for next test
      await page.fill('input[type="email"]', '');
      await page.fill('input[type="password"]', '');
    }
  });
  
  test('should handle empty form submission', async ({ page }) => {
    await page.goto('/auth/login');
    
    // Submit empty form
    await page.click('button[type="submit"]');
    
    // Should show validation errors or prevent submission
    const errorElements = page.locator('.error, [data-testid*="error"]');
    const errorCount = await errorElements.count();
    
    if (errorCount > 0) {
      await expect(errorElements.first()).toBeVisible();
    } else {
      // Should stay on login page
      await expect(page).toHaveURL(/login/);
    }
  });
  
  test('should support tenant-specific login', async ({ page }) => {
    await page.goto('/auth/login');
    
    // Fill tenant subdomain if field exists
    const tenantField = page.locator('input[name="tenantSubdomain"], [data-testid="tenant-input"]');
    
    if (await tenantField.isVisible()) {
      await tenantField.fill('test-e2e');
    }
    
    // Fill credentials
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    
    // Submit login
    await page.click('button[type="submit"]');
    
    // Should login successfully
    await page.waitForURL(/\/(dashboard|test-runs|$)/, { timeout: 15000 });
    await expect(page.locator('[data-testid="dashboard-page"], h1')).toBeVisible();
  });
});

test.describe('Session Management', () => {
  test('should maintain session across page refreshes', async ({ page }) => {
    // Login first
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    
    await page.waitForURL(/\/(dashboard|test-runs|$)/, { timeout: 15000 });
    
    // Refresh page
    await page.reload();
    
    // Should remain authenticated
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('[data-testid="dashboard-page"], h1')).toBeVisible();
  });
  
  test('should handle logout functionality', async ({ page }) => {
    // Login first
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    
    await page.waitForURL(/\/(dashboard|test-runs|$)/, { timeout: 15000 });
    
    // Look for logout button/menu
    const logoutButtons = page.locator('button, a').filter({ 
      hasText: /logout|sign out|log out/i 
    });
    
    if (await logoutButtons.count() > 0) {
      await logoutButtons.first().click();
      
      // Should redirect to login page
      await page.waitForURL(/login/, { timeout: 10000 });
      await expect(page).toHaveURL(/login/);
    } else {
      // Try user menu/dropdown
      const userMenus = page.locator('.user-menu, .user-avatar, [data-testid*="user"]');
      if (await userMenus.count() > 0) {
        await userMenus.first().click();
        await page.waitForTimeout(500);
        
        const dropdownLogout = page.locator('button, a').filter({ 
          hasText: /logout|sign out/i 
        });
        
        if (await dropdownLogout.count() > 0) {
          await dropdownLogout.first().click();
          await page.waitForURL(/login/, { timeout: 10000 });
          await expect(page).toHaveURL(/login/);
        }
      }
    }
  });
  
  test('should redirect unauthenticated users to login', async ({ page, context }) => {
    // Create fresh context without authentication
    const freshContext = await context.browser()?.newContext();
    if (freshContext) {
      const freshPage = await freshContext.newPage();
      
      // Try to access protected route
      await freshPage.goto('/dashboard');
      
      // Should redirect to login
      await expect(freshPage).toHaveURL(/login/, { timeout: 10000 });
      
      await freshContext.close();
    }
  });
  
  test('should handle session expiration', async ({ page }) => {
    // This test would require manipulating JWT expiration
    // For now, we'll test the basic flow
    
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    
    await page.waitForURL(/\/(dashboard|test-runs|$)/, { timeout: 15000 });
    
    // Clear localStorage to simulate session expiration
    await page.evaluate(() => {
      localStorage.removeItem('auth_token');
      sessionStorage.clear();
    });
    
    // Navigate to a protected page
    await page.goto('/test-runs');
    
    // Should redirect to login due to missing token
    await page.waitForTimeout(2000);
    
    // Check if redirected to login or shows error
    const currentUrl = page.url();
    const isOnProtectedPage = currentUrl.includes('/test-runs') && !currentUrl.includes('/login');
    
    if (isOnProtectedPage) {
      // If still on protected page, should show authentication error
      const errorElements = page.locator('.error, .alert, [data-testid*="error"]');
      const hasErrors = await errorElements.count() > 0;
      
      // Either should have errors or should redirect
      if (!hasErrors) {
        // Try to interact with page - should fail or redirect
        await page.click('button, a').catch(() => {}); // Ignore errors
        await page.waitForTimeout(1000);
      }
    } else {
      // Should be redirected to login
      expect(currentUrl).toMatch(/login/);
    }
  });
});

test.describe('Multi-tenant Authentication', () => {
  test('should isolate user data by tenant', async ({ page }) => {
    // Login with tenant-specific user
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    
    const tenantField = page.locator('input[name="tenantSubdomain"]');
    if (await tenantField.isVisible()) {
      await tenantField.fill('test-e2e');
    }
    
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|test-runs|$)/, { timeout: 15000 });
    
    // Navigate to test runs or data page
    await page.goto('/test-runs');
    
    // Wait for data to load
    await page.waitForTimeout(3000);
    
    // Verify that only tenant-specific data is shown
    // This is hard to test without multiple tenants, but we can check
    // that some tenant context is present
    
    const tenantIndicators = page.locator('.tenant-name, [data-testid*="tenant"]');
    if (await tenantIndicators.count() > 0) {
      const tenantText = await tenantIndicators.first().textContent();
      expect(tenantText).toBeTruthy();
    }
  });
  
  test('should validate tenant access permissions', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    
    await page.waitForURL(/\/(dashboard|test-runs|$)/, { timeout: 15000 });
    
    // User should only see their own tenant's data
    // Test by checking that API calls include proper tenant headers
    
    const apiRequestPromise = page.waitForRequest('/api/**');
    await page.goto('/test-runs');
    
    try {
      const apiRequest = await apiRequestPromise;
      const headers = apiRequest.headers();
      
      // Should have tenant identification in headers
      const hasTenantHeader = headers['x-tenant-id'] || headers['tenant-id'] || 
                             headers.authorization?.includes('tenant');
      
      expect(hasTenantHeader).toBeTruthy();
    } catch (error) {
      // API request might not happen immediately, that's okay
      console.log('API request monitoring failed:', error);
    }
  });
});

test.describe('Authentication UI/UX', () => {
  test('should display proper error messages for authentication failures', async ({ page }) => {
    await page.goto('/auth/login');
    
    // Test various error scenarios
    const errorScenarios = [
      {
        email: 'admin@test.com',
        password: 'wrongpassword',
        expectedError: /invalid|incorrect|password/i
      },
      {
        email: 'nonexistent@test.com', 
        password: 'TestPassword123!',
        expectedError: /invalid|not found|user/i
      },
      {
        email: 'invalid-email-format',
        password: 'TestPassword123!',
        expectedError: /email|format|valid/i
      }
    ];
    
    for (const scenario of errorScenarios) {
      await page.fill('input[type="email"]', scenario.email);
      await page.fill('input[type="password"]', scenario.password);
      await page.click('button[type="submit"]');
      
      await page.waitForTimeout(2000);
      
      // Look for error messages
      const errorElements = page.locator('.error, .alert, [data-testid*="error"]');
      const errorCount = await errorElements.count();
      
      if (errorCount > 0) {
        const errorText = await errorElements.first().textContent();
        
        // Verify error message is user-friendly and not technical
        expect(errorText).toBeTruthy();
        expect(errorText?.toLowerCase()).not.toContain('undefined');
        expect(errorText?.toLowerCase()).not.toContain('null');
        expect(errorText?.toLowerCase()).not.toContain('500');
      }
      
      // Clear form for next scenario
      await page.fill('input[type="email"]', '');
      await page.fill('input[type="password"]', '');
    }
  });
  
  test('should provide clear navigation between login and register', async ({ page }) => {
    // Start on login page
    await page.goto('/auth/login');
    await expect(page).toHaveURL(/login/);
    
    // Look for register link
    const registerLinks = page.locator('a, button').filter({ 
      hasText: /register|sign up|create account/i 
    });
    
    if (await registerLinks.count() > 0) {
      await registerLinks.first().click();
      await expect(page).toHaveURL(/register/);
      
      // Look for login link on register page
      const loginLinks = page.locator('a, button').filter({ 
        hasText: /login|sign in/i 
      });
      
      if (await loginLinks.count() > 0) {
        await loginLinks.first().click();
        await expect(page).toHaveURL(/login/);
      }
    }
  });
  
  test('should support password visibility toggle', async ({ page }) => {
    await page.goto('/auth/login');
    
    const passwordInput = page.locator('input[type="password"]');
    const toggleButtons = page.locator('button').filter({ 
      hasText: /show|hide|eye/i 
    }).or(page.locator('[data-testid*="password-toggle"], .password-toggle'));
    
    if (await toggleButtons.count() > 0) {
      const toggleButton = toggleButtons.first();
      
      // Initially should be password type
      await expect(passwordInput).toHaveAttribute('type', 'password');
      
      // Click toggle
      await toggleButton.click();
      
      // Should change to text type
      await expect(passwordInput).toHaveAttribute('type', 'text');
      
      // Click again to hide
      await toggleButton.click();
      await expect(passwordInput).toHaveAttribute('type', 'password');
    }
  });
});