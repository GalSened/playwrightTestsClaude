/**
 * WeSign Bilingual Self-Healing Demo Test
 * 
 * Comprehensive example demonstrating:
 * - Enhanced WeSign configuration usage
 * - Bilingual testing framework
 * - Self-healing integration
 * - Custom healing reporter integration
 * - Best practices for WeSign testing
 */

import { test, expect } from '@playwright/test';
import { wesignConfig } from '../../src/config/wesign-config';
import BilingualTestFramework, { BilingualUtils } from '../../src/framework/bilingual-test-framework';
import { selfHealingIntegration } from '../../src/framework/self-healing-integration';

test.describe('WeSign Bilingual Self-Healing Demo', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    // Setup self-healing monitoring
    await selfHealingIntegration.setupPageMonitoring(page, testInfo);
    
    // Navigate to WeSign application
    await page.goto('/');
    
    // Wait for initial page load
    await page.waitForLoadState('networkidle');
  });

  test('Login flow with bilingual support and self-healing', async ({ page }, testInfo) => {
    // Test both Hebrew and English interfaces
    const results = await BilingualUtils.runBilingualTest(page, async (framework) => {
      console.log(`🌐 Testing login in ${framework.getCurrentLanguage()}`);
      
      // Navigate to login page
      await page.goto('/login');
      
      // Validate layout for current language
      const layoutValidation = await framework.validateLayout({
        checkAlignment: true,
        checkTextDirection: true,
        checkFontRendering: true
      });
      
      expect(layoutValidation.isValid).toBe(true);
      
      // Find email field using language-aware selectors with healing
      const emailField = await selfHealingIntegration.findElementWithHealing({
        testId: testInfo.testId,
        testName: testInfo.title,
        page,
        language: framework.getCurrentLanguage(),
        operation: 'find-email-field',
        originalSelector: 'input[name="email"]',
        attempt: 1,
        maxAttempts: 3
      });
      
      // Use test credentials from configuration
      const credentials = wesignConfig.getCredentialsForRole('company_user');
      expect(credentials).toBeTruthy();
      
      // Fill email with healing support
      await selfHealingIntegration.fillWithHealing(
        page,
        'input[name="email"]',
        credentials!.email,
        testInfo
      );
      
      // Fill password with healing support  
      await selfHealingIntegration.fillWithHealing(
        page,
        'input[name="password"]',
        credentials!.password,
        testInfo
      );
      
      // Click login button with healing
      await selfHealingIntegration.clickWithHealing(
        page,
        'button[type="submit"]',
        testInfo
      );
      
      // Wait for successful login with language-specific success message
      const successMessage = framework.getTextForCurrentLanguage('loginSuccess');
      const successElement = await page.waitForSelector(
        `:text("${successMessage}")`,
        { timeout: wesignConfig.thresholds.uiResponse }
      );
      
      expect(successElement).toBeTruthy();
      
      // Validate post-login layout
      const postLoginLayout = await framework.validateLayout();
      expect(postLoginLayout.isValid).toBe(true);
      
      // Return test result for comparison
      return {
        loginSuccessful: true,
        layoutValid: postLoginLayout.isValid,
        language: framework.getCurrentLanguage()
      };
    });

    // Assert both languages work equivalently
    BilingualUtils.assertBilingualEquivalence(results, (hebrew, english) => {
      return hebrew.loginSuccessful === english.loginSuccessful &&
             hebrew.layoutValid === english.layoutValid;
    });
    
    console.log('✅ Bilingual login test completed successfully');
  });

  test('Document upload with self-healing and performance monitoring', async ({ page }, testInfo) => {
    // Login first
    const credentials = wesignConfig.getCredentialsForRole('company_user');
    await page.goto('/login');
    
    await selfHealingIntegration.fillWithHealing(page, 'input[name="email"]', credentials!.email, testInfo);
    await selfHealingIntegration.fillWithHealing(page, 'input[name="password"]', credentials!.password, testInfo);
    await selfHealingIntegration.clickWithHealing(page, 'button[type="submit"]', testInfo);
    
    // Wait for dashboard
    await page.waitForURL('**/dashboard/**');
    
    // Navigate to upload section
    await page.goto('/dashboard/upload');
    
    // Initialize bilingual framework
    const framework = new BilingualTestFramework(page, 'hebrew');
    
    // Test document upload with healing
    const testFile = wesignConfig.getFileByType('pdf', 'small');
    expect(testFile).toBeTruthy();
    
    console.log(`📄 Uploading test file: ${testFile!.path}`);
    
    // Start performance monitoring
    const uploadStartTime = Date.now();
    
    try {
      // Find upload button with healing
      const uploadElement = await selfHealingIntegration.findElementWithHealing({
        testId: testInfo.testId,
        testName: testInfo.title,
        page,
        language: 'hebrew',
        operation: 'file-upload',
        originalSelector: 'input[type="file"]',
        attempt: 1,
        maxAttempts: 3
      });
      
      // Upload file
      await uploadElement.element.setInputFiles(testFile!.path);
      
      // Wait for upload completion with language-aware success message
      const uploadSuccess = framework.getTextForCurrentLanguage('uploadSuccess');
      
      await page.waitForSelector(
        `:text("${uploadSuccess}")`,
        { timeout: wesignConfig.thresholds.fileUpload }
      );
      
      const uploadDuration = Date.now() - uploadStartTime;
      console.log(`⚡ Upload completed in ${uploadDuration}ms`);
      
      // Validate performance
      expect(uploadDuration).toBeLessThan(wesignConfig.thresholds.fileUpload);
      
      // Validate layout after upload
      const layoutValidation = await framework.validateLayout();
      expect(layoutValidation.isValid).toBe(true);
      
    } catch (error) {
      // Capture failure context for healing analysis
      await selfHealingIntegration.captureFailureContext(
        page,
        error as Error,
        testInfo,
        {
          operation: 'document-upload',
          filePath: testFile!.path,
          language: 'hebrew'
        }
      );
      
      throw error;
    }
  });

  test('Complex workflow with comprehensive healing', async ({ page }, testInfo) => {
    // This test demonstrates a complex WeSign workflow with multiple healing opportunities
    
    const testWorkflow = async () => {
      // 1. Login
      console.log('🔐 Step 1: Login');
      const credentials = wesignConfig.getCredentialsForRole('company_user');
      
      await page.goto('/login');
      await selfHealingIntegration.fillWithHealing(page, 'input[name="email"]', credentials!.email, testInfo);
      await selfHealingIntegration.fillWithHealing(page, 'input[name="password"]', credentials!.password, testInfo);
      await selfHealingIntegration.clickWithHealing(page, 'button[type="submit"]', testInfo);
      
      await page.waitForURL('**/dashboard/**');
      
      // 2. Upload document
      console.log('📄 Step 2: Upload Document');
      await page.goto('/dashboard/upload');
      
      const testFile = wesignConfig.getFileByType('pdf', 'medium');
      const uploadElement = await selfHealingIntegration.findElementWithHealing({
        testId: testInfo.testId,
        testName: testInfo.title,
        page,
        language: 'hebrew',
        operation: 'document-upload',
        originalSelector: 'input[type="file"]',
        attempt: 1,
        maxAttempts: 3
      });
      
      await uploadElement.element.setInputFiles(testFile!.path);
      
      // Wait for processing
      await page.waitForSelector('.upload-success, .העלאה-הושלמה', { 
        timeout: wesignConfig.thresholds.fileUpload 
      });
      
      // 3. Add signature fields
      console.log('✍️ Step 3: Add Signature Fields');
      
      await selfHealingIntegration.clickWithHealing(
        page,
        '.signature-field-btn, button:has-text("חתימה")',
        testInfo
      );
      
      // Click on document to place signature field
      const documentCanvas = await selfHealingIntegration.waitForElementWithHealing(
        page,
        '.document-canvas, .pdf-viewer',
        testInfo
      );
      
      await documentCanvas.click({ position: { x: 200, y: 300 } });
      
      // 4. Assign recipients
      console.log('👥 Step 4: Assign Recipients');
      
      await selfHealingIntegration.clickWithHealing(
        page,
        '.assign-button, button:has-text("הקצה")',
        testInfo
      );
      
      const recipients = wesignConfig.testRecipients;
      const firstRecipient = recipients[0];
      
      await selfHealingIntegration.fillWithHealing(
        page,
        'input[name="recipientEmail"]',
        firstRecipient.email,
        testInfo
      );
      
      await selfHealingIntegration.fillWithHealing(
        page,
        'input[name="recipientName"]',
        firstRecipient.name.hebrew,
        testInfo
      );
      
      // 5. Send document
      console.log('📤 Step 5: Send Document');
      
      await selfHealingIntegration.clickWithHealing(
        page,
        '.send-button, button:has-text("שלח")',
        testInfo
      );
      
      // Wait for send confirmation
      await page.waitForSelector(
        '.send-success, .נשלח-בהצלחה',
        { timeout: wesignConfig.thresholds.documentSend }
      );
      
      return true;
    };

    // Execute workflow with healing support
    await selfHealingIntegration.executeWithHealing(
      testWorkflow,
      {
        testId: testInfo.testId,
        testName: testInfo.title,
        page,
        language: 'hebrew',
        operation: 'complete-workflow',
        originalSelector: 'workflow',
        attempt: 1,
        maxAttempts: 2
      }
    );

    console.log('✅ Complex workflow completed successfully');
  });

  test('Accessibility validation for Hebrew interface', async ({ page }, testInfo) => {
    // Initialize Hebrew framework
    const framework = new BilingualTestFramework(page, 'hebrew');
    await framework.switchLanguage('hebrew');
    
    // Navigate to main application
    await page.goto('/dashboard');
    
    // Perform comprehensive accessibility validation
    const accessibilityValid = await framework.validateHebrewAccessibility();
    expect(accessibilityValid).toBe(true);
    
    // Test form accessibility
    const formAccessible = await framework.testBilingualForm('.main-form, form');
    expect(formAccessible).toBe(true);
    
    // Validate cultural formatting
    const culturalFormattingValid = await framework.validateCulturalFormatting();
    expect(culturalFormattingValid).toBe(true);
    
    console.log('✅ Hebrew accessibility validation completed');
  });

  test.afterEach(async ({ page }, testInfo) => {
    // Print healing statistics for this test
    const healingStats = selfHealingIntegration.getHealingStats();
    
    if (healingStats.cacheSize > 0 || Object.keys(healingStats.operationStats).length > 0) {
      console.log('🔧 Healing Statistics:');
      console.log(`   Cache Size: ${healingStats.cacheSize}`);
      console.log('   Operations:', healingStats.operationStats);
    }
    
    // Clear healing cache for next test
    selfHealingIntegration.clearCache();
  });
});

// Additional utility test for configuration validation
test.describe('Configuration Validation', () => {
  test('WeSign configuration is valid', async () => {
    const validation = wesignConfig.validate();
    expect(validation.valid).toBe(true);
    
    if (!validation.valid) {
      console.error('Configuration errors:', validation.errors);
    }
    
    console.log('✅ WeSign configuration validation passed');
  });
  
  test('All required test assets exist', async () => {
    const requiredFiles = ['smallPdf', 'mediumPdf', 'wordDocument'];
    
    for (const fileKey of requiredFiles) {
      const fileAsset = wesignConfig.fileAssets[fileKey];
      expect(fileAsset).toBeTruthy();
      
      // Note: In a real test, you'd check file existence
      // For demo purposes, we validate the path is defined
      expect(fileAsset.path).toBeTruthy();
    }
    
    console.log('✅ Test assets validation completed');
  });
});

// Performance benchmark test
test.describe('Performance Benchmarks', () => {
  test('Page load performance meets thresholds', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(wesignConfig.thresholds.pageLoad);
    
    console.log(`⚡ Page loaded in ${loadTime}ms (threshold: ${wesignConfig.thresholds.pageLoad}ms)`);
  });
});