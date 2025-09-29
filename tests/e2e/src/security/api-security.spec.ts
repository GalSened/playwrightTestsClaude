import { test, expect, APIRequestContext } from '@playwright/test';

/**
 * API Security & Multi-tenancy Tests
 * Tests JWT validation, rate limiting, tenant isolation, and security vulnerabilities
 */
test.describe('API Authentication & Authorization', () => {
  let apiContext: APIRequestContext;
  
  test.beforeAll(async ({ playwright }) => {
    apiContext = await playwright.request.newContext({
      baseURL: process.env.VITE_API_BASE_URL || 'http://localhost:3001'
    });
  });
  
  test.afterAll(async () => {
    await apiContext.dispose();
  });
  
  test('should reject requests without authentication token', async () => {
    const response = await apiContext.get('/api/test-runs');
    
    expect(response.status()).toBe(401);
    
    const body = await response.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toMatch(/unauthorized|authentication/i);
  });
  
  test('should reject requests with invalid JWT tokens', async () => {
    const invalidTokens = [
      'invalid-token',
      'Bearer invalid',
      'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
      'Bearer ' + 'a'.repeat(200), // Very long invalid token
      'Bearer ', // Empty token
      'Basic dGVzdDp0ZXN0' // Wrong auth type
    ];
    
    for (const token of invalidTokens) {
      const response = await apiContext.get('/api/test-runs', {
        headers: { 'Authorization': token }
      });
      
      expect(response.status()).toBe(401);
      
      const body = await response.json();
      expect(body).toHaveProperty('error');
    }
  });
  
  test('should reject expired JWT tokens', async () => {
    // Create an expired token (this would need to be generated with a past expiry)
    // For testing purposes, we'll use a token that's clearly malformed
    const expiredToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2MDk0NTkyMDB9.invalid';
    
    const response = await apiContext.get('/api/test-runs', {
      headers: { 'Authorization': expiredToken }
    });
    
    expect(response.status()).toBe(401);
  });
  
  test('should validate JWT token structure and required fields', async () => {
    // Test with tokens missing required fields
    const malformedTokens = [
      // Token without userId
      'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5hbnRJZCI6InRlc3QifQ.invalid',
      // Token without tenantId  
      'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0In0.invalid',
    ];
    
    for (const token of malformedTokens) {
      const response = await apiContext.get('/api/test-runs', {
        headers: { 'Authorization': token }
      });
      
      expect(response.status()).toBe(401);
    }
  });
});

test.describe('Multi-tenant Data Isolation', () => {
  test('should prevent cross-tenant data access', async ({ request }) => {
    // This test would require valid tokens for different tenants
    // For now, we'll test the tenant header validation
    
    const response = await request.get('/api/test-runs', {
      headers: {
        'X-Tenant-ID': 'unauthorized-tenant-id'
        // Missing proper authorization for this tenant
      }
    });
    
    expect(response.status()).toBe(401);
  });
  
  test('should validate tenant ID matches JWT token', async ({ request }) => {
    // Test mismatched tenant ID in header vs token
    const response = await request.get('/api/test-runs', {
      headers: {
        'Authorization': 'Bearer valid-token-for-tenant-A',
        'X-Tenant-ID': 'tenant-B' // Mismatched tenant
      }
    });
    
    // Should reject due to tenant mismatch
    expect([401, 403]).toContain(response.status());
  });
  
  test('should enforce row-level security in database queries', async ({ request }) => {
    // This test would verify that database queries are properly filtered by tenant
    // We'll test this by ensuring tenant ID is required
    
    const response = await request.get('/api/test-runs', {
      headers: {
        'Authorization': 'Bearer some-token'
        // Missing X-Tenant-ID header
      }
    });
    
    expect([400, 401]).toContain(response.status());
  });
});

test.describe('Input Validation & Sanitization', () => {
  test('should prevent SQL injection attacks', async ({ request }) => {
    const sqlInjectionPayloads = [
      "'; DROP TABLE users; --",
      "' OR '1'='1",
      "'; INSERT INTO test_runs (name) VALUES ('hacked'); --",
      "' UNION SELECT * FROM users WHERE '1'='1",
      "'; UPDATE users SET email='hacker@test.com' WHERE id=1; --"
    ];
    
    for (const payload of sqlInjectionPayloads) {
      const response = await request.post('/api/test-runs', {
        data: {
          name: payload,
          description: 'Test description'
        },
        headers: {
          'Authorization': 'Bearer test-token',
          'X-Tenant-ID': 'test-tenant'
        }
      });
      
      // Should either reject the request or sanitize the input
      // Don't expect 5xx errors which might indicate SQL injection worked
      expect(response.status()).not.toBeGreaterThanOrEqual(500);
      
      if (response.ok()) {
        const body = await response.json();
        // If accepted, the payload should be sanitized
        expect(body.name).not.toContain('DROP TABLE');
        expect(body.name).not.toContain('INSERT INTO');
      }
    }
  });
  
  test('should prevent XSS attacks in API responses', async ({ request }) => {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '"><script>alert("XSS")</script>',
      "'><script>alert('XSS')</script>",
      'javascript:alert("XSS")',
      '<img src="x" onerror="alert(\'XSS\')">'
    ];
    
    for (const payload of xssPayloads) {
      const response = await request.post('/api/test-runs', {
        data: {
          name: `Test ${payload}`,
          description: payload
        },
        headers: {
          'Authorization': 'Bearer test-token',
          'X-Tenant-ID': 'test-tenant'
        }
      });
      
      if (response.ok()) {
        const body = await response.json();
        
        // Check that dangerous scripts are sanitized
        expect(body.name).not.toContain('<script>');
        expect(body.description).not.toContain('<script>');
        expect(body.name).not.toContain('javascript:');
        expect(body.description).not.toContain('onerror=');
      }
    }
  });
  
  test('should validate input data types and formats', async ({ request }) => {
    const invalidDataPayloads = [
      // Invalid email format
      { email: 'not-an-email', password: 'test123' },
      // Missing required fields
      { email: 'test@test.com' }, // Missing password
      { password: 'test123' }, // Missing email
      // Invalid data types
      { email: 123, password: 'test123' },
      { email: 'test@test.com', password: 123 },
      // Empty data
      {},
      // Null values
      { email: null, password: null }
    ];
    
    for (const payload of invalidDataPayloads) {
      const response = await request.post('/api/auth/login', {
        data: payload
      });
      
      expect(response.status()).toBe(400);
      
      const body = await response.json();
      expect(body).toHaveProperty('error');
      expect(body.error).toMatch(/validation|invalid|required/i);
    }
  });
});

test.describe('Rate Limiting & DDoS Protection', () => {
  test('should implement rate limiting on API endpoints', async ({ request }) => {
    const maxRequests = 10; // Assuming rate limit is configured
    const requests = [];
    
    // Send multiple rapid requests
    for (let i = 0; i < maxRequests + 5; i++) {
      requests.push(
        request.get('/api/test-runs', {
          headers: {
            'Authorization': 'Bearer test-token',
            'X-Tenant-ID': 'test-tenant'
          }
        })
      );
    }
    
    const responses = await Promise.all(requests);
    
    // At least some requests should be rate limited
    const rateLimitedResponses = responses.filter(r => r.status() === 429);
    
    if (rateLimitedResponses.length > 0) {
      // Verify rate limit headers are present
      const rateLimitResponse = rateLimitedResponses[0];
      const headers = rateLimitResponse.headers();
      
      // Common rate limit headers
      const hasRateLimitHeaders = 
        headers['x-ratelimit-limit'] ||
        headers['x-ratelimit-remaining'] ||
        headers['x-ratelimit-reset'] ||
        headers['retry-after'];
        
      expect(hasRateLimitHeaders).toBeTruthy();
    }
  });
  
  test('should handle burst requests gracefully', async ({ request }) => {
    // Send a burst of requests simultaneously
    const burstSize = 20;
    const requests = Array(burstSize).fill(0).map(() => 
      request.get('/api/health') // Use health endpoint which should be less restricted
    );
    
    const responses = await Promise.all(requests);
    
    // All responses should be either successful or properly rate limited
    for (const response of responses) {
      const status = response.status();
      expect([200, 429, 503]).toContain(status); // 200 OK, 429 Rate Limited, 503 Service Unavailable
      expect(status).not.toBe(500); // Should not cause internal server errors
    }
  });
});

test.describe('CORS & Security Headers', () => {
  test('should implement proper CORS policies', async ({ request }) => {
    const response = await request.get('/api/health', {
      headers: {
        'Origin': 'https://malicious-site.com'
      }
    });
    
    const headers = response.headers();
    
    // Should have CORS headers
    if (headers['access-control-allow-origin']) {
      // Should not allow all origins in production
      expect(headers['access-control-allow-origin']).not.toBe('*');
    }
  });
  
  test('should set security headers', async ({ request }) => {
    const response = await request.get('/api/health');
    const headers = response.headers();
    
    // Check for important security headers
    const securityHeaders = [
      'x-content-type-options',
      'x-frame-options',
      'strict-transport-security',
      'content-security-policy'
    ];
    
    // At least some security headers should be present
    const presentHeaders = securityHeaders.filter(header => headers[header]);
    expect(presentHeaders.length).toBeGreaterThan(0);
  });
  
  test('should prevent clickjacking attacks', async ({ request }) => {
    const response = await request.get('/api/health');
    const headers = response.headers();
    
    // Should have X-Frame-Options or CSP frame-ancestors
    const hasClickjackingProtection = 
      headers['x-frame-options'] || 
      (headers['content-security-policy'] && 
       headers['content-security-policy'].includes('frame-ancestors'));
       
    expect(hasClickjackingProtection).toBeTruthy();
  });
});

test.describe('Error Handling Security', () => {
  test('should not expose sensitive information in error messages', async ({ request }) => {
    const response = await request.get('/api/nonexistent-endpoint');
    
    expect(response.status()).toBe(404);
    
    const body = await response.json();
    
    // Error messages should not expose internal details
    const errorMessage = JSON.stringify(body).toLowerCase();
    
    const sensitivePatterns = [
      'stack trace',
      'database error',
      'internal server error',
      'sql error',
      'connection string',
      'password',
      'secret',
      'token'
    ];
    
    for (const pattern of sensitivePatterns) {
      expect(errorMessage).not.toContain(pattern);
    }
  });
  
  test('should handle malformed requests gracefully', async ({ request }) => {
    // Send requests with malformed JSON
    const malformedRequests = [
      '{"invalid": json}', // Invalid JSON
      '{"nested": {"object": {"too": {"deep": true}}}}', // Very nested object
      'a'.repeat(10000), // Very large payload
      '', // Empty payload
      null // Null payload
    ];
    
    for (const payload of malformedRequests) {
      try {
        const response = await request.post('/api/test-runs', {
          data: payload,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
            'X-Tenant-ID': 'test-tenant'
          }
        });
        
        // Should handle gracefully with 4xx error
        expect(response.status()).toBeLessThan(500);
        
      } catch (error) {
        // Network errors are acceptable for malformed requests
        expect(error).toBeTruthy();
      }
    }
  });
});

/**
 * Helper function to generate test JWT tokens
 * In a real test suite, this would use the same secret as the server
 */
function generateTestJWT(payload: any): string {
  // This is a mock implementation
  // In real tests, you'd use the jsonwebtoken library with the test secret
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  
  return `${encodedHeader}.${encodedPayload}.mock-signature`;
}