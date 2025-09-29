import { test, expect } from '@playwright/test';
import { wesignConfig } from '../src/config/wesign-config';

test.describe('WeSign Basic Validation', () => {
  test('Configuration system loads correctly', async () => {
    // Test configuration validation
    const validation = wesignConfig.validate();
    expect(validation.valid).toBe(true);
    
    if (!validation.valid) {
      console.error('Configuration errors:', validation.errors);
    }
    
    console.log('✅ Configuration system working properly');
  });
  
  test('Environment variables are loaded', async () => {
    // Test environment access
    const environment = wesignConfig.environment;
    expect(environment.baseUrl).toBeTruthy();
    expect(environment.name).toBeTruthy();
    
    console.log(`📍 Testing against: ${environment.baseUrl} (${environment.name})`);
  });
  
  test('Basic browser navigation works', async ({ page }) => {
    // Test basic Playwright functionality  
    await page.goto('https://www.google.com');
    await expect(page).toHaveTitle(/Google/);
    
    console.log('🌐 Basic browser navigation working');
  });
});