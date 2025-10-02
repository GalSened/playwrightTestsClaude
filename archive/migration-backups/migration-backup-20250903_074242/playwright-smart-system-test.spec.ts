import { test, expect } from '@playwright/test';

test.describe('Playwright Smart Test Management System', () => {
  
  test('Full System Integration Test', async ({ page }) => {
    console.log('=== Testing Playwright Smart Test Management System ===');
    
    // Test the main application
    await page.goto('http://localhost:3006/');
    await page.waitForLoadState('networkidle');
    
    // Check if app loads successfully
    const title = await page.title();
    console.log(`✓ App loaded with title: ${title}`);
    
    // Take screenshot of initial state
    await page.screenshot({ 
      path: 'test-results/system-test-initial.png', 
      fullPage: true 
    });
    
    // Check for navigation elements
    const hasNavigation = await page.locator('nav, [role="navigation"], header').count() > 0;
    console.log(`✓ Navigation present: ${hasNavigation}`);
    
    // Check for main content area
    const hasContent = await page.locator('main, [role="main"], .main-content').count() > 0 || 
                       await page.locator('body').textContent() !== '';
    console.log(`✓ Content area present: ${hasContent}`);
    
    // Test navigation to test bank (if available)
    const testBankLink = page.locator('a[href*="test-bank"], button:has-text("Test Bank"), [data-testid*="test"]');
    const testBankExists = await testBankLink.count() > 0;
    
    if (testBankExists) {
      console.log('✓ Test Bank navigation found, testing...');
      await testBankLink.first().click();
      await page.waitForTimeout(2000);
      
      await page.screenshot({ 
        path: 'test-results/system-test-testbank.png', 
        fullPage: true 
      });
    }
    
    // Test API connectivity by checking for data loading
    await page.waitForTimeout(3000);
    const pageContent = await page.textContent('body');
    const hasData = pageContent && (
      pageContent.includes('test') ||
      pageContent.includes('suite') ||
      pageContent.includes('dashboard') ||
      pageContent.length > 1000
    );
    console.log(`✓ Application has meaningful data: ${!!hasData}`);
    
    // Basic assertions
    expect(title.length).toBeGreaterThan(0);
    expect(hasNavigation || hasContent).toBeTruthy();
    
    console.log('✅ Playwright Smart system test completed successfully!');
  });
  
  test('Backend API Connectivity Test', async ({ page }) => {
    console.log('=== Testing Backend API Connectivity ===');
    
    // Test direct API endpoints
    const apiTests = [
      { endpoint: '/api/test-runs', description: 'Test runs endpoint' },
      { endpoint: '/api/schedules', description: 'Schedules endpoint' }
    ];
    
    for (const apiTest of apiTests) {
      try {
        const response = await page.request.get(`http://localhost:8081${apiTest.endpoint}`);
        const status = response.status();
        console.log(`✓ ${apiTest.description}: HTTP ${status}`);
        
        if (status === 200) {
          const data = await response.json();
          console.log(`  - Response data keys: ${Object.keys(data).join(', ')}`);
        }
      } catch (error) {
        console.log(`✗ ${apiTest.description}: Failed - ${error}`);
      }
    }
    
    console.log('✅ Backend API connectivity test completed!');
  });
});