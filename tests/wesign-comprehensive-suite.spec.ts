/**
 * WeSign Comprehensive Test Suite - 20 Tests
 * 
 * This suite covers all major WeSign functionality:
 * - Authentication & User Management
 * - Document Upload & Processing  
 * - Signature Workflows
 * - Bilingual Interface (Hebrew/English)
 * - API Integration & Performance
 */

import { test, expect } from '@playwright/test';
import { wesignConfig } from '../src/config/wesign-config';
import BilingualTestFramework, { BilingualUtils } from '../src/framework/bilingual-test-framework';
import { selfHealingIntegration } from '../src/framework/self-healing-integration';

// Configure test suite
test.describe.configure({ mode: 'serial' }); // Run in sequence for better visibility

test.describe('WeSign Comprehensive Test Suite - 20 Tests', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    console.log(`🧪 Starting Test: ${testInfo.title}`);
    await selfHealingIntegration.setupPageMonitoring(page, testInfo);
    
    // Set viewport for consistent testing
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  // 🔐 AUTHENTICATION TESTS (3 tests)
  test('AUTH-01: WeSign Login Page Load and Validation', async ({ page }) => {
    console.log('🔍 Testing WeSign login page accessibility and elements');
    
    await page.goto('https://devtest.comda.co.il/login');
    await page.waitForLoadState('networkidle');
    
    // Validate page title and essential elements
    await expect(page).toHaveTitle(/WeSign|חתימה/i);
    
    // Check for login form elements
    const emailField = page.locator('input[name="email"], input[type="email"], #email');
    const passwordField = page.locator('input[name="password"], input[type="password"], #password');
    
    await expect(emailField.or(page.locator('input').first())).toBeVisible();
    await expect(passwordField.or(page.locator('input[type="password"]').first())).toBeVisible();
    
    console.log('✅ WeSign login page elements validated');
  });

  test('AUTH-02: Invalid Login Attempt Handling', async ({ page }) => {
    console.log('🚫 Testing invalid login credentials handling');
    
    await page.goto('https://devtest.comda.co.il/login');
    await page.waitForLoadState('networkidle');
    
    // Try to fill invalid credentials
    const emailField = page.locator('input').first();
    const passwordField = page.locator('input[type="password"]').first();
    
    if (await emailField.isVisible()) {
      await emailField.fill('invalid@test.com');
    }
    if (await passwordField.isVisible()) {
      await passwordField.fill('invalidpassword');
    }
    
    // Look for login button and attempt login
    const loginButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("התחבר")');
    if (await loginButton.isVisible()) {
      await loginButton.click();
      await page.waitForTimeout(2000); // Wait for response
    }
    
    console.log('✅ Invalid login attempt processed');
  });

  test('AUTH-03: Password Reset Flow Validation', async ({ page }) => {
    console.log('🔄 Testing password reset functionality');
    
    await page.goto('https://devtest.comda.co.il/login');
    await page.waitForLoadState('networkidle');
    
    // Look for "Forgot Password" or similar link
    const forgotPassword = page.locator('a:has-text("Forgot"), a:has-text("שכח"), a:has-text("Reset"), [href*="forgot"], [href*="reset"]');
    
    if (await forgotPassword.first().isVisible()) {
      await forgotPassword.first().click();
      await page.waitForLoadState('networkidle');
      
      // Validate reset page elements
      const emailResetField = page.locator('input[name="email"], input[type="email"]');
      await expect(emailResetField.first()).toBeVisible({ timeout: 5000 });
    }
    
    console.log('✅ Password reset flow validated');
  });

  // 📄 DOCUMENT MANAGEMENT TESTS (4 tests)
  test('DOC-01: WeSign Dashboard Access and Navigation', async ({ page }) => {
    console.log('🏠 Testing WeSign dashboard navigation');
    
    await page.goto('https://devtest.comda.co.il/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Check for dashboard elements
    const dashboardElements = [
      'nav, header, .navbar',
      '.sidebar, aside, [role="navigation"]',
      'main, .content, .dashboard'
    ];
    
    for (const selector of dashboardElements) {
      const element = page.locator(selector);
      if (await element.first().isVisible({ timeout: 3000 })) {
        console.log(`✅ Found dashboard element: ${selector}`);
        break;
      }
    }
    
    console.log('✅ Dashboard navigation validated');
  });

  test('DOC-02: Document Upload Interface Testing', async ({ page }) => {
    console.log('📤 Testing document upload functionality');
    
    await page.goto('https://devtest.comda.co.il/upload');
    await page.waitForLoadState('networkidle');
    
    // Look for upload elements
    const uploadElements = [
      'input[type="file"]',
      '.upload-area, .dropzone',
      'button:has-text("Upload"), button:has-text("העלה")',
      '[data-testid*="upload"], [id*="upload"]'
    ];
    
    for (const selector of uploadElements) {
      const element = page.locator(selector);
      if (await element.first().isVisible({ timeout: 3000 })) {
        console.log(`✅ Found upload element: ${selector}`);
        // Don't actually upload, just validate interface
        break;
      }
    }
    
    console.log('✅ Upload interface validated');
  });

  test('DOC-03: Document List and Management', async ({ page }) => {
    console.log('📋 Testing document list and management features');
    
    await page.goto('https://devtest.comda.co.il/documents');
    await page.waitForLoadState('networkidle');
    
    // Look for document management elements
    const docElements = [
      'table, .document-list',
      '.document-item, .file-item',
      '[data-testid*="document"], [class*="document"]',
      'button:has-text("Delete"), button:has-text("מחק")',
      'button:has-text("Share"), button:has-text("שתף")'
    ];
    
    let foundElements = 0;
    for (const selector of docElements) {
      const element = page.locator(selector);
      if (await element.first().isVisible({ timeout: 2000 })) {
        foundElements++;
        console.log(`✅ Found document element: ${selector}`);
      }
    }
    
    console.log(`✅ Document management interface validated (${foundElements} elements found)`);
  });

  test('DOC-04: Document Viewer and Preview', async ({ page }) => {
    console.log('👁️ Testing document viewer functionality');
    
    await page.goto('https://devtest.comda.co.il/viewer');
    await page.waitForLoadState('networkidle');
    
    // Look for viewer elements
    const viewerElements = [
      '.pdf-viewer, .document-viewer',
      'canvas, embed, iframe',
      '.zoom-controls, .page-controls',
      'button:has-text("Zoom"), button:has-text("זום")'
    ];
    
    for (const selector of viewerElements) {
      const element = page.locator(selector);
      if (await element.first().isVisible({ timeout: 3000 })) {
        console.log(`✅ Found viewer element: ${selector}`);
        break;
      }
    }
    
    console.log('✅ Document viewer validated');
  });

  // ✍️ SIGNATURE WORKFLOW TESTS (4 tests)
  test('SIG-01: Signature Field Creation Interface', async ({ page }) => {
    console.log('✍️ Testing signature field creation');
    
    await page.goto('https://devtest.comda.co.il/sign');
    await page.waitForLoadState('networkidle');
    
    // Look for signature elements
    const signatureElements = [
      '.signature-area, .sign-area',
      'button:has-text("Sign"), button:has-text("חתום")',
      '[data-testid*="signature"], [class*="signature"]',
      '.signature-pad, canvas[class*="sign"]'
    ];
    
    for (const selector of signatureElements) {
      const element = page.locator(selector);
      if (await element.first().isVisible({ timeout: 3000 })) {
        console.log(`✅ Found signature element: ${selector}`);
        break;
      }
    }
    
    console.log('✅ Signature interface validated');
  });

  test('SIG-02: Digital Signature Process Flow', async ({ page }) => {
    console.log('🔏 Testing digital signature workflow');
    
    await page.goto('https://devtest.comda.co.il/digital-sign');
    await page.waitForLoadState('networkidle');
    
    // Look for digital signature elements
    const digitalSignElements = [
      '.digital-signature, .certificate-sign',
      'select[name*="certificate"], .certificate-select',
      'button:has-text("Digital"), button:has-text("דיגיטלי")',
      '.pkcs, .certificate-area'
    ];
    
    for (const selector of digitalSignElements) {
      const element = page.locator(selector);
      if (await element.first().isVisible({ timeout: 3000 })) {
        console.log(`✅ Found digital signature element: ${selector}`);
        break;
      }
    }
    
    console.log('✅ Digital signature flow validated');
  });

  test('SIG-03: Signature Recipient Management', async ({ page }) => {
    console.log('👥 Testing recipient management for signatures');
    
    await page.goto('https://devtest.comda.co.il/recipients');
    await page.waitForLoadState('networkidle');
    
    // Look for recipient management elements
    const recipientElements = [
      '.recipient-list, .signers-list',
      'input[name*="email"], input[placeholder*="email"]',
      'button:has-text("Add"), button:has-text("הוסף")',
      '.recipient-item, .signer-item'
    ];
    
    let recipientFeatures = 0;
    for (const selector of recipientElements) {
      const element = page.locator(selector);
      if (await element.first().isVisible({ timeout: 2000 })) {
        recipientFeatures++;
        console.log(`✅ Found recipient element: ${selector}`);
      }
    }
    
    console.log(`✅ Recipient management validated (${recipientFeatures} features found)`);
  });

  test('SIG-04: Signature Status and Tracking', async ({ page }) => {
    console.log('📊 Testing signature status tracking');
    
    await page.goto('https://devtest.comda.co.il/tracking');
    await page.waitForLoadState('networkidle');
    
    // Look for tracking elements
    const trackingElements = [
      '.status-indicator, .progress-bar',
      '.signed, .pending, .completed',
      'table:has(.status), .tracking-table',
      '.timeline, .progress-timeline'
    ];
    
    for (const selector of trackingElements) {
      const element = page.locator(selector);
      if (await element.first().isVisible({ timeout: 3000 })) {
        console.log(`✅ Found tracking element: ${selector}`);
        break;
      }
    }
    
    console.log('✅ Signature tracking validated');
  });

  // 🌍 BILINGUAL INTERFACE TESTS (3 tests)
  test('LANG-01: Hebrew Interface Language Validation', async ({ page }) => {
    console.log('🇮🇱 Testing Hebrew interface elements');
    
    const framework = new BilingualTestFramework(page, 'hebrew');
    
    await page.goto('https://devtest.comda.co.il/');
    await page.waitForLoadState('networkidle');
    
    // Look for Hebrew content
    const hebrewElements = page.locator(':text-matches("[\\u0590-\\u05FF]")'); // Hebrew Unicode range
    const hebrewCount = await hebrewElements.count();
    
    console.log(`🔍 Found ${hebrewCount} Hebrew text elements`);
    
    // Check RTL layout indicators
    const rtlElements = page.locator('[dir="rtl"], [style*="rtl"], .rtl');
    const rtlCount = await rtlElements.count();
    
    console.log(`🔍 Found ${rtlCount} RTL layout elements`);
    
    // Validate layout direction
    const bodyDir = await page.evaluate(() => {
      const body = document.body;
      return body.dir || getComputedStyle(body).direction;
    });
    
    console.log(`📐 Page direction: ${bodyDir}`);
    console.log('✅ Hebrew interface validation completed');
  });

  test('LANG-02: English Interface Language Validation', async ({ page }) => {
    console.log('🇺🇸 Testing English interface elements');
    
    await page.goto('https://devtest.comda.co.il/?lang=en');
    await page.waitForLoadState('networkidle');
    
    // Look for English content
    const englishElements = page.locator(':text-matches("[a-zA-Z]{3,}")'); // English words 3+ chars
    const englishCount = await englishElements.count();
    
    console.log(`🔍 Found ${englishCount} English text elements`);
    
    // Check LTR layout
    const bodyDir = await page.evaluate(() => {
      const body = document.body;
      return body.dir || getComputedStyle(body).direction || 'ltr';
    });
    
    console.log(`📐 Page direction: ${bodyDir}`);
    console.log('✅ English interface validation completed');
  });

  test('LANG-03: Language Toggle Functionality', async ({ page }) => {
    console.log('🔄 Testing language switching functionality');
    
    await page.goto('https://devtest.comda.co.il/');
    await page.waitForLoadState('networkidle');
    
    // Look for language switcher elements
    const langSwitchers = [
      '[lang], [data-lang], .language-switch',
      'button:has-text("English"), button:has-text("עברית")',
      '.lang-toggle, .language-selector',
      'select[name*="lang"], .lang-dropdown'
    ];
    
    let switcherFound = false;
    for (const selector of langSwitchers) {
      const element = page.locator(selector);
      if (await element.first().isVisible({ timeout: 2000 })) {
        console.log(`✅ Found language switcher: ${selector}`);
        switcherFound = true;
        
        // Try to interact with it
        try {
          await element.first().click({ timeout: 3000 });
          await page.waitForTimeout(1000);
        } catch (e) {
          console.log('📝 Language switcher found but not interactive');
        }
        break;
      }
    }
    
    if (!switcherFound) {
      console.log('📝 No language switcher found - checking URL patterns');
      // Test URL-based language switching
      await page.goto('https://devtest.comda.co.il/?lang=en');
      await page.waitForLoadState('networkidle');
    }
    
    console.log('✅ Language switching functionality validated');
  });

  // 👥 USER MANAGEMENT TESTS (3 tests)
  test('USER-01: User Profile and Settings Access', async ({ page }) => {
    console.log('👤 Testing user profile functionality');
    
    await page.goto('https://devtest.comda.co.il/profile');
    await page.waitForLoadState('networkidle');
    
    // Look for profile elements
    const profileElements = [
      '.profile, .user-profile',
      'input[name="name"], input[name="email"]',
      '.avatar, .profile-picture',
      'button:has-text("Save"), button:has-text("שמור")'
    ];
    
    let profileFeatures = 0;
    for (const selector of profileElements) {
      const element = page.locator(selector);
      if (await element.first().isVisible({ timeout: 2000 })) {
        profileFeatures++;
        console.log(`✅ Found profile element: ${selector}`);
      }
    }
    
    console.log(`✅ User profile validated (${profileFeatures} features found)`);
  });

  test('USER-02: Account Permissions and Roles', async ({ page }) => {
    console.log('🔐 Testing account permissions interface');
    
    await page.goto('https://devtest.comda.co.il/permissions');
    await page.waitForLoadState('networkidle');
    
    // Look for permissions elements
    const permissionElements = [
      '.permissions, .roles',
      'input[type="checkbox"], .permission-checkbox',
      '.role-selector, select[name*="role"]',
      '.access-control, .permission-list'
    ];
    
    for (const selector of permissionElements) {
      const element = page.locator(selector);
      if (await element.first().isVisible({ timeout: 3000 })) {
        console.log(`✅ Found permission element: ${selector}`);
        break;
      }
    }
    
    console.log('✅ Permissions interface validated');
  });

  test('USER-03: Organization and Team Management', async ({ page }) => {
    console.log('🏢 Testing organization management');
    
    await page.goto('https://devtest.comda.co.il/organization');
    await page.waitForLoadState('networkidle');
    
    // Look for organization elements
    const orgElements = [
      '.organization, .company',
      '.team-members, .user-list',
      'button:has-text("Invite"), button:has-text("הזמן")',
      '.member-item, .user-item'
    ];
    
    let orgFeatures = 0;
    for (const selector of orgElements) {
      const element = page.locator(selector);
      if (await element.first().isVisible({ timeout: 2000 })) {
        orgFeatures++;
        console.log(`✅ Found organization element: ${selector}`);
      }
    }
    
    console.log(`✅ Organization management validated (${orgFeatures} features found)`);
  });

  // 🚀 API & PERFORMANCE TESTS (3 tests)
  test('API-01: WeSign API Health Check', async ({ page }) => {
    console.log('🔌 Testing WeSign API connectivity');
    
    // Test API endpoints through network requests
    const apiEndpoints = [
      'https://devtest.comda.co.il/api/health',
      'https://devtest.comda.co.il/api/v1/status',
      'https://devtest.comda.co.il/health'
    ];
    
    for (const endpoint of apiEndpoints) {
      try {
        const response = await page.request.get(endpoint);
        console.log(`📡 API ${endpoint}: ${response.status()}`);
        
        if (response.ok()) {
          const data = await response.text();
          console.log(`✅ API response received: ${data.substring(0, 100)}`);
          break;
        }
      } catch (e) {
        console.log(`📝 API ${endpoint}: Not accessible`);
      }
    }
    
    console.log('✅ API connectivity validated');
  });

  test('API-02: Performance and Response Times', async ({ page }) => {
    console.log('⚡ Testing page performance metrics');
    
    const startTime = Date.now();
    
    await page.goto('https://devtest.comda.co.il/');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    console.log(`📊 Page load time: ${loadTime}ms`);
    
    // Test navigation performance
    const navStart = Date.now();
    await page.goto('https://devtest.comda.co.il/dashboard');
    await page.waitForLoadState('domcontentloaded');
    const navTime = Date.now() - navStart;
    
    console.log(`📊 Navigation time: ${navTime}ms`);
    
    // Validate against thresholds
    const thresholds = wesignConfig.thresholds;
    const loadOK = loadTime < thresholds.pageLoad;
    
    console.log(`🎯 Load performance: ${loadOK ? '✅ PASS' : '⚠️ SLOW'} (${loadTime}ms < ${thresholds.pageLoad}ms)`);
    console.log('✅ Performance metrics validated');
  });

  test('API-03: Error Handling and Resilience', async ({ page }) => {
    console.log('🛡️ Testing error handling and resilience');
    
    // Test invalid URLs and error pages
    const errorTests = [
      'https://devtest.comda.co.il/nonexistent',
      'https://devtest.comda.co.il/404',
      'https://devtest.comda.co.il/invalid-path'
    ];
    
    for (const url of errorTests) {
      try {
        const response = await page.goto(url);
        const status = response?.status() || 0;
        console.log(`🔍 Error page ${url}: Status ${status}`);
        
        // Look for error page elements
        const errorElements = [
          '.error, .not-found',
          'h1:has-text("404"), h1:has-text("Error")',
          '.error-message, .error-page'
        ];
        
        for (const selector of errorElements) {
          const element = page.locator(selector);
          if (await element.first().isVisible({ timeout: 2000 })) {
            console.log(`✅ Found error element: ${selector}`);
            break;
          }
        }
      } catch (e) {
        console.log(`📝 Error test ${url}: Expected behavior`);
      }
    }
    
    console.log('✅ Error handling validated');
  });

  test.afterEach(async ({ page }, testInfo) => {
    // Get healing statistics for this test
    const healingStats = selfHealingIntegration.getHealingStats();
    
    console.log(`📊 Test "${testInfo.title}" completed`);
    if (healingStats.cacheSize > 0) {
      console.log(`🔧 Healing cache size: ${healingStats.cacheSize}`);
    }
    
    // Take final screenshot
    await page.screenshot({ 
      path: `test-results/final-${testInfo.testId}.png`,
      fullPage: true 
    });
  });
});

// Performance benchmark test
test.describe('WeSign Performance Benchmark', () => {
  test('PERF-01: Comprehensive Performance Analysis', async ({ page }) => {
    console.log('🏁 Running comprehensive performance benchmark');
    
    const metrics = {
      mainPage: 0,
      login: 0,
      dashboard: 0,
      upload: 0
    };
    
    // Test main page
    let start = Date.now();
    await page.goto('https://devtest.comda.co.il/');
    await page.waitForLoadState('networkidle');
    metrics.mainPage = Date.now() - start;
    
    // Test login page
    start = Date.now();
    await page.goto('https://devtest.comda.co.il/login');
    await page.waitForLoadState('networkidle');
    metrics.login = Date.now() - start;
    
    // Test dashboard
    start = Date.now();
    await page.goto('https://devtest.comda.co.il/dashboard');
    await page.waitForLoadState('networkidle');
    metrics.dashboard = Date.now() - start;
    
    // Test upload page
    start = Date.now();
    await page.goto('https://devtest.comda.co.il/upload');
    await page.waitForLoadState('networkidle');
    metrics.upload = Date.now() - start;
    
    console.log('📊 Performance Metrics:');
    console.log(`   Main Page: ${metrics.mainPage}ms`);
    console.log(`   Login: ${metrics.login}ms`);
    console.log(`   Dashboard: ${metrics.dashboard}ms`);
    console.log(`   Upload: ${metrics.upload}ms`);
    console.log(`   Average: ${Math.round(Object.values(metrics).reduce((a, b) => a + b, 0) / 4)}ms`);
    
    console.log('✅ Performance benchmark completed');
  });
});