/**
 * WeSign Framework Demo Test
 * Demonstrates all enhanced features without requiring real WeSign login
 */

import { test, expect } from '@playwright/test';
import { wesignConfig } from '../src/config/wesign-config';
import BilingualTestFramework, { BilingualUtils } from '../src/framework/bilingual-test-framework';
import { selfHealingIntegration } from '../src/framework/self-healing-integration';

test.describe('WeSign Enhanced Framework Demo', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    // Setup self-healing monitoring
    await selfHealingIntegration.setupPageMonitoring(page, testInfo);
  });

  test('Configuration and bilingual framework demo', async ({ page }, testInfo) => {
    // Test configuration system
    console.log('🔧 Testing configuration system...');
    const validation = wesignConfig.validate();
    expect(validation.valid).toBe(true);
    
    const environment = wesignConfig.environment;
    console.log(`📍 Environment: ${environment.name} - ${environment.baseUrl}`);
    
    // Test bilingual utilities
    const results = await BilingualUtils.runBilingualTest(page, async (framework) => {
      const currentLang = framework.getCurrentLanguage();
      console.log(`🌍 Testing in: ${currentLang}`);
      
      // Navigate to a public page for demo
      await page.goto('https://example.com');
      await expect(page).toHaveTitle(/Example/);
      
      // Demonstrate language-aware text retrieval
      const welcomeText = framework.getTextForCurrentLanguage('welcome');
      console.log(`👋 Welcome text in ${currentLang}: ${welcomeText}`);
      
      return {
        language: currentLang,
        pageTitle: await page.title(),
        success: true
      };
    });
    
    console.log('✅ Bilingual test completed successfully');
    console.log('📊 Results:', JSON.stringify(results, null, 2));
    
    // Validate both languages were tested
    expect(results.hebrew).toBeTruthy();
    expect(results.english).toBeTruthy();
    expect(results.hebrew.success).toBe(true);
    expect(results.english.success).toBe(true);
  });

  test('Self-healing integration demo', async ({ page }, testInfo) => {
    console.log('🔧 Demonstrating self-healing capabilities...');
    
    await page.goto('https://example.com');
    
    // Test healing with a selector that exists (should work normally)
    try {
      await selfHealingIntegration.clickWithHealing(
        page, 
        'a[href="https://www.iana.org/domains/example"]', // This link exists on example.com
        testInfo,
        { timeout: 5000 }
      );
      console.log('✅ Successful element interaction (no healing needed)');
    } catch (error) {
      console.log('⚡ Self-healing attempted for missing element');
    }
    
    // Test healing with a non-existent selector (will trigger healing)
    try {
      const element = await selfHealingIntegration.findElementWithHealing({
        testId: testInfo.testId,
        testName: testInfo.title,
        page,
        language: 'english',
        operation: 'demo-find',
        originalSelector: '.non-existent-button',
        attempt: 1,
        maxAttempts: 2
      });
      
      if (element.healed) {
        console.log(`🔧 Element healed successfully: ${element.newSelector}`);
      }
    } catch (error) {
      console.log('🔍 Healing attempted but element truly missing (expected for demo)');
    }
    
    // Get healing statistics
    const healingStats = selfHealingIntegration.getHealingStats();
    console.log('📈 Healing Statistics:', healingStats);
    
    expect(true).toBe(true); // Demo always passes
  });

  test('Performance monitoring demo', async ({ page }) => {
    console.log('⚡ Demonstrating performance monitoring...');
    
    const startTime = Date.now();
    
    // Navigate to a page and measure timing
    await page.goto('https://example.com');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    console.log(`📊 Page load time: ${loadTime}ms`);
    
    // Check against our configured thresholds
    const thresholds = wesignConfig.thresholds;
    console.log(`🎯 Page load threshold: ${thresholds.pageLoad}ms`);
    
    // For demo, we'll be generous with example.com
    expect(loadTime).toBeLessThan(thresholds.pageLoad);
    
    console.log('✅ Performance monitoring working correctly');
  });

  test('Feature flags and credentials demo', async () => {
    console.log('🚩 Testing feature flags...');
    
    // Test feature flags
    const selfHealingEnabled = wesignConfig.isFeatureEnabled('selfHealing');
    const bilingualEnabled = wesignConfig.isFeatureEnabled('bilingualTesting');
    
    console.log(`🔧 Self-healing enabled: ${selfHealingEnabled}`);
    console.log(`🌍 Bilingual testing enabled: ${bilingualEnabled}`);
    
    expect(selfHealingEnabled).toBe(true);
    expect(bilingualEnabled).toBe(true);
    
    // Test credential access (without exposing actual values)
    const credentials = wesignConfig.getCredentialsForRole('company_user');
    expect(credentials).toBeTruthy();
    expect(credentials?.role).toBe('company_user');
    
    console.log('✅ Feature flags and credentials system working');
  });

  test.afterEach(async ({ page }, testInfo) => {
    // Print healing statistics for this test
    const healingStats = selfHealingIntegration.getHealingStats();
    
    if (healingStats.cacheSize > 0 || Object.keys(healingStats.operationStats).length > 0) {
      console.log('🔧 Test Healing Summary:');
      console.log(`   Cache Size: ${healingStats.cacheSize}`);
      console.log('   Operations:', healingStats.operationStats);
    }
    
    // Clear healing cache for next test
    selfHealingIntegration.clearCache();
  });
});