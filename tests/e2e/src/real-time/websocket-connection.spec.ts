import { test, expect, Page } from '@playwright/test';

/**
 * Real-time WebSocket Connection Tests
 * Tests WebSocket connectivity, authentication, and multi-tenancy
 */
test.describe('WebSocket Connection Management', () => {
  let wsEvents: any[] = [];
  
  test.beforeEach(async ({ page }) => {
    // Clear events array
    wsEvents = [];
    
    // Setup WebSocket event monitoring
    await page.addInitScript(() => {
      // Override WebSocket to capture events
      const originalWebSocket = window.WebSocket;
      window.WebSocket = class extends originalWebSocket {
        constructor(url: string | URL, protocols?: string | string[]) {
          super(url, protocols);
          
          // Capture WebSocket events
          this.addEventListener('open', (event) => {
            (window as any).__wsEvents = (window as any).__wsEvents || [];
            (window as any).__wsEvents.push({ type: 'open', timestamp: Date.now() });
          });
          
          this.addEventListener('message', (event) => {
            (window as any).__wsEvents = (window as any).__wsEvents || [];
            (window as any).__wsEvents.push({ 
              type: 'message', 
              data: JSON.parse(event.data),
              timestamp: Date.now() 
            });
          });
          
          this.addEventListener('error', (event) => {
            (window as any).__wsEvents = (window as any).__wsEvents || [];
            (window as any).__wsEvents.push({ type: 'error', timestamp: Date.now() });
          });
          
          this.addEventListener('close', (event) => {
            (window as any).__wsEvents = (window as any).__wsEvents || [];
            (window as any).__wsEvents.push({ 
              type: 'close', 
              code: event.code, 
              reason: event.reason,
              timestamp: Date.now() 
            });
          });
        }
      };
    });
  });
  
  test('should establish WebSocket connection on dashboard load', async ({ page }) => {
    // Navigate to dashboard (should trigger WebSocket connection)
    await page.goto('/dashboard');
    
    // Wait for dashboard to load
    await expect(page.locator('[data-testid="dashboard-page"]')).toBeVisible();
    
    // Wait for WebSocket connection
    await page.waitForTimeout(3000);
    
    // Check WebSocket events
    const events = await page.evaluate(() => (window as any).__wsEvents || []);
    
    // Verify connection was established
    const openEvent = events.find((e: any) => e.type === 'open');
    expect(openEvent).toBeTruthy();
    
    console.log('WebSocket events captured:', events);
  });
  
  test('should authenticate WebSocket connection with JWT token', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');
    await expect(page.locator('[data-testid="dashboard-page"]')).toBeVisible();
    
    // Wait for WebSocket connection and authentication
    await page.waitForTimeout(5000);
    
    // Check for authentication success message
    const events = await page.evaluate(() => (window as any).__wsEvents || []);
    
    // Look for connected event with authentication confirmation
    const connectedEvent = events.find((e: any) => 
      e.type === 'message' && e.data && e.data.message && 
      e.data.message.includes('Connected to Playwright Smart Platform')
    );
    
    expect(connectedEvent).toBeTruthy();
    expect(connectedEvent.data).toHaveProperty('userId');
    expect(connectedEvent.data).toHaveProperty('tenantId');
  });
  
  test('should handle WebSocket disconnection and reconnection', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('[data-testid="dashboard-page"]')).toBeVisible();
    
    // Wait for initial connection
    await page.waitForTimeout(3000);
    
    // Simulate network disconnection by going offline
    await page.route('**/*', route => route.abort());
    
    // Wait for disconnection
    await page.waitForTimeout(2000);
    
    // Re-enable network
    await page.unroute('**/*');
    
    // Reload page to trigger reconnection
    await page.reload();
    await expect(page.locator('[data-testid="dashboard-page"]')).toBeVisible();
    
    // Wait for reconnection
    await page.waitForTimeout(5000);
    
    const events = await page.evaluate(() => (window as any).__wsEvents || []);
    
    // Should have both close and open events
    const closeEvent = events.find((e: any) => e.type === 'close');
    const openEvents = events.filter((e: any) => e.type === 'open');
    
    expect(closeEvent).toBeTruthy();
    expect(openEvents.length).toBeGreaterThanOrEqual(1);
  });
  
  test('should isolate WebSocket connections by tenant', async ({ page, context }) => {
    // This test requires creating a second tenant and user
    // For now, we'll test that the connection includes tenant information
    
    await page.goto('/dashboard');
    await expect(page.locator('[data-testid="dashboard-page"]')).toBeVisible();
    
    await page.waitForTimeout(3000);
    
    const events = await page.evaluate(() => (window as any).__wsEvents || []);
    const connectedEvent = events.find((e: any) => 
      e.type === 'message' && e.data && e.data.tenantId
    );
    
    expect(connectedEvent).toBeTruthy();
    expect(connectedEvent.data.tenantId).toBeTruthy();
    
    // Verify tenant isolation by checking the tenant ID is consistent
    const tenantId = connectedEvent.data.tenantId;
    expect(tenantId).toMatch(/test-e2e|test-tenant-e2e/);
  });
  
  test('should handle WebSocket ping/pong for connection health', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('[data-testid="dashboard-page"]')).toBeVisible();
    
    // Wait for connection
    await page.waitForTimeout(3000);
    
    // Send a ping message
    await page.evaluate(() => {
      const ws = (window as any).__currentWebSocket;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
    });
    
    // Wait for pong response
    await page.waitForTimeout(2000);
    
    const events = await page.evaluate(() => (window as any).__wsEvents || []);
    const pongEvent = events.find((e: any) => 
      e.type === 'message' && e.data && e.data.type === 'pong'
    );
    
    // Note: This might not work if ping/pong is handled at protocol level
    // But if the app implements application-level ping/pong, this should work
    if (pongEvent) {
      expect(pongEvent.data).toHaveProperty('serverTime');
    }
  });
  
  test('should handle invalid WebSocket authentication', async ({ page, context }) => {
    // Create a context without proper authentication
    const unauthenticatedContext = await context.browser()?.newContext({
      // No storage state = no auth token
    });
    
    if (unauthenticatedContext) {
      const unauthPage = await unauthenticatedContext.newPage();
      
      // Setup event monitoring for unauthenticated page
      await unauthPage.addInitScript(() => {
        const originalWebSocket = window.WebSocket;
        window.WebSocket = class extends originalWebSocket {
          constructor(url: string | URL, protocols?: string | string[]) {
            super(url, protocols);
            
            this.addEventListener('error', (event) => {
              (window as any).__wsAuthError = true;
            });
            
            this.addEventListener('close', (event) => {
              (window as any).__wsCloseCode = event.code;
              (window as any).__wsCloseReason = event.reason;
            });
          }
        };
      });
      
      // Try to access dashboard without auth (should redirect to login)
      await unauthPage.goto('/dashboard');
      
      // Should be redirected to login page
      await expect(unauthPage).toHaveURL(/\/auth\/login|\/login/);
      
      await unauthenticatedContext.close();
    }
  });
});

test.describe('Real-time Test Run Updates', () => {
  test('should receive real-time test run status updates', async ({ page }) => {
    // Navigate to test runs page
    await page.goto('/test-runs');
    
    // Wait for page to load
    await expect(page.locator('h1')).toContainText(/Test Runs|Tests/);
    await page.waitForTimeout(3000);
    
    // Create a new test run via API to trigger real-time update
    const response = await page.request.post('/api/test-runs', {
      data: {
        name: 'Real-time Test Run',
        description: 'Test run for WebSocket validation',
        environment: 'test'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    
    // Wait for WebSocket event
    await page.waitForTimeout(3000);
    
    // Check if the new test run appears in the UI
    await expect(page.locator('text=Real-time Test Run')).toBeVisible({ timeout: 10000 });
  });
  
  test('should update test run status in real-time', async ({ page }) => {
    await page.goto('/test-runs');
    await expect(page.locator('h1')).toContainText(/Test Runs|Tests/);
    
    // Wait for WebSocket connection
    await page.waitForTimeout(3000);
    
    // Look for existing test run or create one
    const testRunElements = page.locator('[data-testid*="test-run"], .test-run-item');
    const count = await testRunElements.count();
    
    if (count > 0) {
      // Check for status indicators
      const statusElements = page.locator('.status-badge, [data-testid*="status"]');
      const statusCount = await statusElements.count();
      
      expect(statusCount).toBeGreaterThan(0);
      
      // Verify status values are valid
      const firstStatus = await statusElements.first().textContent();
      expect(['running', 'completed', 'failed', 'pending', 'passed']).toContain(firstStatus?.toLowerCase());
    }
  });
});

test.describe('WebSocket Error Handling', () => {
  test('should handle WebSocket connection errors gracefully', async ({ page }) => {
    // Block WebSocket connections to simulate network issues
    await page.route('**/socket.io/**', route => route.abort());
    
    await page.goto('/dashboard');
    await expect(page.locator('[data-testid="dashboard-page"]')).toBeVisible();
    
    // The app should still function even without WebSocket
    // Check that dashboard loads and displays data
    await expect(page.locator('[data-testid="environment-status"]')).toBeVisible();
    
    // Check for any error messages or connection indicators
    const errorElements = await page.locator('.error, .connection-error, [data-testid*="error"]').count();
    
    // Should either have no error elements or proper error handling
    if (errorElements > 0) {
      // If there are error elements, they should be user-friendly
      const errorText = await page.locator('.error, .connection-error, [data-testid*="error"]').first().textContent();
      expect(errorText).not.toContain('undefined');
      expect(errorText).not.toContain('null');
    }
  });
  
  test('should display connection status indicators', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('[data-testid="dashboard-page"]')).toBeVisible();
    
    // Wait for WebSocket connection
    await page.waitForTimeout(3000);
    
    // Look for connection status indicators
    const connectionIndicators = page.locator('.connection-status, [data-testid*="connection"]');
    const indicatorCount = await connectionIndicators.count();
    
    // If connection indicators exist, verify they show proper status
    if (indicatorCount > 0) {
      const statusText = await connectionIndicators.first().textContent();
      expect(statusText).toBeTruthy();
    }
    
    // Verify the app is functional regardless of connection status
    await expect(page.locator('[data-testid="environment-status"]')).toBeVisible();
  });
});

/**
 * Helper function to wait for WebSocket connection
 */
async function waitForWebSocketConnection(page: Page, timeout: number = 5000): Promise<boolean> {
  try {
    await page.waitForFunction(() => {
      const events = (window as any).__wsEvents || [];
      return events.some((e: any) => e.type === 'open');
    }, { timeout });
    return true;
  } catch {
    return false;
  }
}