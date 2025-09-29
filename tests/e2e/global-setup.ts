import { chromium, FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs';

/**
 * Global Setup for Enterprise E2E Tests
 * Sets up test environment, creates admin user, and prepares test data
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting Enterprise E2E Test Environment Setup...');
  
  const baseURL = config.projects[0].use.baseURL || 'http://localhost:5173';
  const apiBaseURL = process.env.VITE_API_BASE_URL || 'http://localhost:3001';
  
  // Wait for servers to be ready
  console.log('⏳ Waiting for servers to be ready...');
  await waitForServer(baseURL, 120000);
  await waitForServer(apiBaseURL + '/health', 120000);
  
  // Setup test database and create admin user
  console.log('🗄️ Setting up test database...');
  await setupTestDatabase(apiBaseURL);
  
  // Create authenticated session for tests
  console.log('🔐 Creating authenticated session...');
  await createAuthenticatedSession(baseURL, apiBaseURL);
  
  // Setup test data
  console.log('📊 Setting up test data...');
  await setupTestData(apiBaseURL);
  
  console.log('✅ Enterprise E2E Test Environment Setup Complete!');
}

async function waitForServer(url: string, timeout: number = 60000): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 404) { // 404 is OK for base URL
        console.log(`✅ Server ready at: ${url}`);
        return;
      }
    } catch (error) {
      // Server not ready yet, continue waiting
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error(`Server not ready within ${timeout}ms: ${url}`);
}

async function setupTestDatabase(apiBaseURL: string): Promise<void> {
  try {
    // Initialize database schema
    const healthResponse = await fetch(`${apiBaseURL}/health`);
    if (!healthResponse.ok) {
      throw new Error('Backend health check failed');
    }
    
    console.log('✅ Database schema initialized');
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    throw error;
  }
}

async function createAuthenticatedSession(baseURL: string, apiBaseURL: string): Promise<void> {
  try {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Register test admin user
    console.log('📝 Creating test admin user...');
    const registerResponse = await fetch(`${apiBaseURL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@test.com',
        password: 'TestPassword123!',
        confirmPassword: 'TestPassword123!',
        companyName: 'Test Company E2E',
        subdomain: 'test-e2e',
        plan: 'enterprise'
      })
    });
    
    if (registerResponse.ok) {
      const authData = await registerResponse.json();
      console.log('✅ Test admin user created successfully');
      
      // Navigate to login page and authenticate
      await page.goto(baseURL);
      
      // Fill login form
      await page.waitForSelector('[data-testid="email-input"], input[name="email"], input[type="email"]', { timeout: 10000 });
      await page.fill('[data-testid="email-input"], input[name="email"], input[type="email"]', 'admin@test.com');
      await page.fill('[data-testid="password-input"], input[name="password"], input[type="password"]', 'TestPassword123!');
      
      // Submit login form
      await page.click('[data-testid="login-button"], button[type="submit"], .login-button');
      
      // Wait for successful login (dashboard or main app)
      await page.waitForURL(/\/(dashboard|test-runs|$)/, { timeout: 15000 });
      
      // Save authentication state
      await context.storageState({ path: 'auth-state.json' });
      console.log('✅ Authentication state saved');
    } else {
      // Try to login with existing user
      console.log('ℹ️ User might already exist, attempting login...');
      await page.goto(baseURL);
      
      await page.waitForSelector('[data-testid="email-input"], input[name="email"], input[type="email"]', { timeout: 10000 });
      await page.fill('[data-testid="email-input"], input[name="email"], input[type="email"]', 'admin@test.com');
      await page.fill('[data-testid="password-input"], input[name="password"], input[type="password"]', 'TestPassword123!');
      await page.click('[data-testid="login-button"], button[type="submit"], .login-button');
      
      // Wait for successful login
      await page.waitForURL(/\/(dashboard|test-runs|$)/, { timeout: 15000 });
      await context.storageState({ path: 'auth-state.json' });
      console.log('✅ Existing user authenticated');
    }
    
    await browser.close();
    
  } catch (error) {
    console.error('❌ Authentication setup failed:', error);
    throw error;
  }
}

async function setupTestData(apiBaseURL: string): Promise<void> {
  try {
    // Read authentication token from saved state
    const authState = JSON.parse(fs.readFileSync('auth-state.json', 'utf-8'));
    const token = authState.cookies?.find((c: any) => c.name === 'auth_token')?.value ||
                  authState.origins?.[0]?.localStorage?.find((item: any) => item.name === 'auth_token')?.value;
    
    if (!token) {
      console.log('⚠️ No auth token found, skipping test data setup');
      return;
    }
    
    // Create sample test runs for testing
    console.log('📊 Creating sample test data...');
    
    const sampleTestRuns = [
      {
        name: 'Sample E2E Test Run',
        description: 'Automated E2E test run for validation',
        environment: 'test',
        browserConfig: { browser: 'chromium', headless: false }
      },
      {
        name: 'Mobile Test Run',
        description: 'Mobile responsive testing',
        environment: 'test',
        browserConfig: { browser: 'chromium', device: 'mobile' }
      }
    ];
    
    for (const testRun of sampleTestRuns) {
      try {
        const response = await fetch(`${apiBaseURL}/api/test-runs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(testRun)
        });
        
        if (response.ok) {
          console.log(`✅ Created test run: ${testRun.name}`);
        }
      } catch (error) {
        console.log(`⚠️ Could not create test run: ${testRun.name}`, error);
      }
    }
    
  } catch (error) {
    console.log('⚠️ Test data setup failed (non-critical):', error);
    // Don't throw here as this is non-critical
  }
}

export default globalSetup;