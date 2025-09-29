/**
 * Self-Healing Integration for WeSign Tests
 * 
 * Provides seamless integration between Playwright tests and
 * the WeSign self-healing backend service, enabling:
 * - Automatic failure capture and analysis
 * - Real-time selector healing during test execution
 * - Pattern learning and application
 * - Intelligent retry mechanisms
 */

import { Page, Locator, TestInfo } from '@playwright/test';
import { wesignConfig } from '../config/wesign-config';
import BilingualTestFramework, { Language } from './bilingual-test-framework';

export interface HealingContext {
  testId: string;
  testName: string;
  page: Page;
  language: Language;
  operation: string;
  originalSelector: string;
  attempt: number;
  maxAttempts: number;
}

export interface HealingResult {
  healed: boolean;
  newSelector?: string;
  confidence?: number;
  strategy?: string;
  duration: number;
}

export interface FailureAnalysis {
  failureType: string;
  classification: string;
  canHeal: boolean;
  suggestedActions: string[];
  confidence: number;
}

export class SelfHealingIntegration {
  private healingServiceUrl: string;
  private isEnabled: boolean;
  private healingCache: Map<string, string> = new Map();
  private performanceMetrics: Map<string, number[]> = new Map();

  constructor() {
    this.healingServiceUrl = `${wesignConfig.environment.baseUrl.replace(/\/$/, '')}:8081/api/healing`;
    this.isEnabled = wesignConfig.isFeatureEnabled('selfHealing');
    console.log(`🔧 Self-healing ${this.isEnabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Setup page monitoring for self-healing
   */
  async setupPageMonitoring(page: Page, testInfo: TestInfo): Promise<void> {
    if (!this.isEnabled) return;

    console.log(`👀 Setting up self-healing monitoring for: ${testInfo.title}`);

    // Monitor console errors
    page.on('console', (message) => {
      if (message.type() === 'error') {
        this.recordConsoleError(testInfo.testId, message.text());
      }
    });

    // Monitor network failures
    page.on('response', (response) => {
      if (response.status() >= 400) {
        this.recordNetworkError(testInfo.testId, {
          url: response.url(),
          status: response.status(),
          statusText: response.statusText()
        });
      }
    });

    // Monitor page crashes
    page.on('crash', () => {
      this.recordPageCrash(testInfo.testId);
    });
  }

  /**
   * Enhanced element finder with self-healing
   */
  async findElementWithHealing(
    context: HealingContext
  ): Promise<{ element: Locator; healed: boolean; newSelector?: string }> {
    const startTime = Date.now();
    
    try {
      // Try original selector first
      const originalElement = context.page.locator(context.originalSelector);
      await originalElement.waitFor({ timeout: 5000 });
      
      // Success with original selector
      return { element: originalElement, healed: false };
      
    } catch (originalError) {
      if (!this.isEnabled) {
        throw originalError;
      }

      console.log(`🔄 Original selector failed, attempting healing: ${context.originalSelector}`);
      
      // Attempt healing
      const healingResult = await this.attemptHealing(context, originalError as Error);
      
      if (healingResult.healed && healingResult.newSelector) {
        try {
          const healedElement = context.page.locator(healingResult.newSelector);
          await healedElement.waitFor({ timeout: 5000 });
          
          console.log(`✅ Element healed! New selector: ${healingResult.newSelector} (confidence: ${healingResult.confidence})`);
          
          // Cache successful healing
          this.cacheHealedSelector(context.originalSelector, healingResult.newSelector);
          
          // Record performance
          this.recordHealingPerformance(context.operation, Date.now() - startTime);
          
          return { 
            element: healedElement, 
            healed: true, 
            newSelector: healingResult.newSelector 
          };
          
        } catch (healedError) {
          console.log(`❌ Healed selector also failed: ${healingResult.newSelector}`);
          throw originalError;
        }
      }
      
      throw originalError;
    }
  }

  /**
   * Intelligent click with self-healing
   */
  async clickWithHealing(
    page: Page,
    selector: string,
    testInfo: TestInfo,
    options: { timeout?: number; force?: boolean } = {}
  ): Promise<void> {
    const context: HealingContext = {
      testId: testInfo.testId,
      testName: testInfo.title,
      page,
      language: 'hebrew', // Default, should be detected
      operation: 'click',
      originalSelector: selector,
      attempt: 1,
      maxAttempts: 3
    };

    const result = await this.findElementWithHealing(context);
    await result.element.click(options);
    
    if (result.healed) {
      await this.reportSuccessfulHealing(context, result.newSelector!);
    }
  }

  /**
   * Fill input with self-healing
   */
  async fillWithHealing(
    page: Page,
    selector: string,
    value: string,
    testInfo: TestInfo,
    options: { timeout?: number } = {}
  ): Promise<void> {
    const context: HealingContext = {
      testId: testInfo.testId,
      testName: testInfo.title,
      page,
      language: 'hebrew',
      operation: 'fill',
      originalSelector: selector,
      attempt: 1,
      maxAttempts: 3
    };

    const result = await this.findElementWithHealing(context);
    await result.element.fill(value, options);
    
    if (result.healed) {
      await this.reportSuccessfulHealing(context, result.newSelector!);
    }
  }

  /**
   * Wait for element with self-healing
   */
  async waitForElementWithHealing(
    page: Page,
    selector: string,
    testInfo: TestInfo,
    options: { timeout?: number; state?: 'visible' | 'hidden' | 'attached' | 'detached' } = {}
  ): Promise<Locator> {
    const context: HealingContext = {
      testId: testInfo.testId,
      testName: testInfo.title,
      page,
      language: 'hebrew',
      operation: 'waitFor',
      originalSelector: selector,
      attempt: 1,
      maxAttempts: 3
    };

    const result = await this.findElementWithHealing(context);
    
    if (result.healed) {
      await this.reportSuccessfulHealing(context, result.newSelector!);
    }
    
    return result.element;
  }

  /**
   * Capture comprehensive failure context
   */
  async captureFailureContext(
    page: Page,
    error: Error,
    testInfo: TestInfo,
    additionalContext?: Record<string, any>
  ): Promise<void> {
    if (!this.isEnabled) return;

    console.log(`📸 Capturing failure context for: ${testInfo.title}`);

    try {
      // Capture DOM state
      const dom = await page.content().catch(() => '');
      
      // Capture screenshot
      const screenshot = await page.screenshot({ 
        fullPage: true,
        type: 'png'
      }).catch(() => Buffer.alloc(0));

      // Get current URL
      const url = page.url();

      // Capture console errors
      const consoleErrors = this.getConsoleErrors(testInfo.testId);
      
      // Capture network logs
      const networkLogs = this.getNetworkErrors(testInfo.testId);

      const failureContext = {
        testId: testInfo.testId,
        testName: testInfo.title,
        error: {
          message: error.message,
          stack: error.stack
        },
        context: {
          dom,
          screenshot: screenshot.toString('base64'),
          consoleErrors,
          networkLogs,
          url,
          selector: additionalContext?.selector,
          language: additionalContext?.language || 'hebrew',
          timestamp: new Date().toISOString(),
          ...additionalContext
        }
      };

      // Send to healing service
      await this.sendFailureToHealingService(failureContext);

    } catch (captureError) {
      console.warn('⚠️  Failed to capture failure context:', captureError.message);
    }
  }

  /**
   * Test execution wrapper with self-healing
   */
  async executeWithHealing<T>(
    testFunction: () => Promise<T>,
    context: HealingContext
  ): Promise<T> {
    if (!this.isEnabled) {
      return await testFunction();
    }

    let lastError: Error;
    
    for (let attempt = 1; attempt <= context.maxAttempts; attempt++) {
      context.attempt = attempt;
      
      try {
        console.log(`🚀 Executing test attempt ${attempt}/${context.maxAttempts}: ${context.testName}`);
        return await testFunction();
        
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < context.maxAttempts) {
          console.log(`🔄 Test failed, analyzing for healing opportunities...`);
          
          // Analyze failure and potentially heal
          const analysis = await this.analyzeFailure(error as Error, context);
          
          if (analysis.canHeal) {
            console.log(`🔧 Applying healing strategy: ${analysis.classification}`);
            await this.delay(2000); // Brief delay before retry
            continue;
          }
        }
        
        // If we can't heal or reached max attempts, capture failure
        await this.captureFailureContext(
          context.page,
          error as Error,
          { testId: context.testId, title: context.testName } as any,
          { operation: context.operation, selector: context.originalSelector }
        );
        
        throw error;
      }
    }
    
    throw lastError!;
  }

  // Private helper methods

  private async attemptHealing(context: HealingContext, error: Error): Promise<HealingResult> {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cachedSelector = this.healingCache.get(context.originalSelector);
      if (cachedSelector) {
        return {
          healed: true,
          newSelector: cachedSelector,
          confidence: 0.9,
          strategy: 'cached',
          duration: Date.now() - startTime
        };
      }

      // Get DOM content for analysis
      const domContent = await context.page.content();
      
      // Call healing service
      const response = await fetch(`${this.healingServiceUrl}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: { message: error.message },
          context: {
            dom: domContent,
            selector: context.originalSelector,
            url: context.page.url(),
            testType: 'wesign',
            language: context.language,
            operation: context.operation
          }
        })
      });

      if (response.ok) {
        const analysis = await response.json();
        
        if (analysis.success && analysis.analysis.suggestedPattern) {
          return {
            healed: true,
            newSelector: analysis.analysis.suggestedPattern.healed_pattern,
            confidence: analysis.analysis.confidence,
            strategy: 'service',
            duration: Date.now() - startTime
          };
        }
      }

      // Fallback to local healing strategies
      return await this.localHealingStrategies(context, error, domContent, startTime);

    } catch (healingError) {
      console.warn('⚠️  Healing service error:', healingError.message);
      
      // Fallback to local strategies
      const domContent = await context.page.content().catch(() => '');
      return await this.localHealingStrategies(context, error, domContent, startTime);
    }
  }

  private async localHealingStrategies(
    context: HealingContext,
    error: Error,
    domContent: string,
    startTime: number
  ): Promise<HealingResult> {
    
    // Strategy 1: Try WeSign-specific patterns
    const wesignAlternatives = this.getWeSignAlternatives(context.originalSelector, context.language);
    for (const alternative of wesignAlternatives) {
      if (domContent.includes(alternative.toLowerCase()) || 
          domContent.includes(alternative.split(' ')[0])) {
        return {
          healed: true,
          newSelector: alternative,
          confidence: 0.8,
          strategy: 'wesign-patterns',
          duration: Date.now() - startTime
        };
      }
    }

    // Strategy 2: Relaxed selectors
    const relaxedSelector = this.createRelaxedSelector(context.originalSelector);
    if (relaxedSelector !== context.originalSelector) {
      return {
        healed: true,
        newSelector: relaxedSelector,
        confidence: 0.6,
        strategy: 'relaxed',
        duration: Date.now() - startTime
      };
    }

    // Strategy 3: Text-based fallback for bilingual
    const textFallback = this.createTextBasedFallback(context.originalSelector, context.language);
    if (textFallback) {
      return {
        healed: true,
        newSelector: textFallback,
        confidence: 0.7,
        strategy: 'text-fallback',
        duration: Date.now() - startTime
      };
    }

    return {
      healed: false,
      strategy: 'none',
      duration: Date.now() - startTime
    };
  }

  private getWeSignAlternatives(selector: string, language: Language): string[] {
    const alternatives: string[] = [];

    // Extract element type from selector
    const elementType = this.extractElementType(selector);
    
    // Get language-specific alternatives from config
    const configAlternatives = wesignConfig.getSelectorsForLanguage(elementType, language);
    alternatives.push(...configAlternatives);

    // Add common WeSign patterns
    const commonPatterns = {
      button: [
        'button[type="submit"]',
        '.btn', '.button',
        '[role="button"]',
        'input[type="submit"]'
      ],
      input: [
        'input[type="text"]',
        'input[type="email"]', 
        'input[type="password"]',
        '.form-control',
        '.input'
      ],
      upload: [
        'input[type="file"]',
        '.upload-btn',
        '.file-upload',
        '[data-upload]'
      ]
    };

    if (commonPatterns[elementType]) {
      alternatives.push(...commonPatterns[elementType]);
    }

    return alternatives;
  }

  private createRelaxedSelector(original: string): string {
    // Remove specific attributes and make selector more generic
    return original
      .replace(/\[data-testid="[^"]*"\]/, '')
      .replace(/#[a-zA-Z0-9-_]+/, '')
      .replace(/\.[a-zA-Z0-9-_]+:nth-child\(\d+\)/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private createTextBasedFallback(selector: string, language: Language): string | null {
    // Create text-based selectors for common elements
    const textMappings = {
      hebrew: {
        login: 'button:text("התחבר")',
        submit: 'button:text("שלח")',
        upload: 'button:text("העלה")',
        sign: 'button:text("חתום")'
      },
      english: {
        login: 'button:text("Login")',
        submit: 'button:text("Submit")', 
        upload: 'button:text("Upload")',
        sign: 'button:text("Sign")'
      }
    };

    const mappings = textMappings[language];
    
    // Try to match based on selector content
    for (const [key, textSelector] of Object.entries(mappings)) {
      if (selector.toLowerCase().includes(key)) {
        return textSelector;
      }
    }

    return null;
  }

  private extractElementType(selector: string): string {
    if (selector.includes('button') || selector.includes('btn')) return 'button';
    if (selector.includes('input')) return 'input';
    if (selector.includes('upload') || selector.includes('file')) return 'upload';
    if (selector.includes('login') || selector.includes('auth')) return 'login';
    return 'generic';
  }

  private async analyzeFailure(error: Error, context: HealingContext): Promise<FailureAnalysis> {
    const errorMessage = error.message.toLowerCase();
    
    // Classify failure type
    let failureType = 'UNKNOWN';
    let canHeal = false;
    let confidence = 0;
    const suggestedActions: string[] = [];

    if (errorMessage.includes('element not found') || errorMessage.includes('locator.click')) {
      failureType = 'SELECTOR_ISSUE';
      canHeal = true;
      confidence = 0.8;
      suggestedActions.push('Try alternative selectors', 'Use text-based selection');
    } else if (errorMessage.includes('timeout')) {
      failureType = 'TIMING_ISSUE';
      canHeal = true;
      confidence = 0.6;
      suggestedActions.push('Increase timeout', 'Wait for element to be ready');
    } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      failureType = 'NETWORK_ISSUE';
      canHeal = false;
      confidence = 0.3;
      suggestedActions.push('Check network connectivity', 'Retry request');
    }

    return {
      failureType,
      classification: this.getFailureTypeDescription(failureType),
      canHeal,
      suggestedActions,
      confidence
    };
  }

  private getFailureTypeDescription(failureType: string): string {
    const descriptions = {
      'SELECTOR_ISSUE': 'Element selector could not locate the target element',
      'TIMING_ISSUE': 'Operation timed out waiting for element or condition',
      'NETWORK_ISSUE': 'Network or connectivity problem detected',
      'DOM_CHANGE': 'DOM structure changed or element became stale',
      'UNKNOWN': 'Unclassified failure type'
    };

    return descriptions[failureType] || descriptions.UNKNOWN;
  }

  private async sendFailureToHealingService(failureData: any): Promise<void> {
    try {
      const response = await fetch(`${this.healingServiceUrl}/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(failureData)
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Failure sent to healing queue: ${result.queueId}`);
      }
    } catch (error) {
      console.warn('⚠️  Failed to send failure to healing service:', error.message);
    }
  }

  private async reportSuccessfulHealing(context: HealingContext, newSelector: string): Promise<void> {
    try {
      await fetch(`${this.healingServiceUrl}/patterns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testType: 'wesign',
          originalPattern: context.originalSelector,
          healedPattern: newSelector,
          confidence: 0.9,
          pageUrl: context.page.url(),
          domContext: context.operation
        })
      });
      
      console.log(`✅ Healing pattern stored: ${context.originalSelector} → ${newSelector}`);
    } catch (error) {
      console.warn('⚠️  Failed to report healing success:', error.message);
    }
  }

  // Utility methods

  private cacheHealedSelector(original: string, healed: string): void {
    this.healingCache.set(original, healed);
  }

  private recordHealingPerformance(operation: string, duration: number): void {
    if (!this.performanceMetrics.has(operation)) {
      this.performanceMetrics.set(operation, []);
    }
    this.performanceMetrics.get(operation)!.push(duration);
  }

  private consoleErrorsMap = new Map<string, string[]>();
  private networkErrorsMap = new Map<string, any[]>();

  private recordConsoleError(testId: string, error: string): void {
    if (!this.consoleErrorsMap.has(testId)) {
      this.consoleErrorsMap.set(testId, []);
    }
    this.consoleErrorsMap.get(testId)!.push(error);
  }

  private recordNetworkError(testId: string, error: any): void {
    if (!this.networkErrorsMap.has(testId)) {
      this.networkErrorsMap.set(testId, []);
    }
    this.networkErrorsMap.get(testId)!.push(error);
  }

  private recordPageCrash(testId: string): void {
    this.recordConsoleError(testId, 'PAGE_CRASH_DETECTED');
  }

  private getConsoleErrors(testId: string): string[] {
    return this.consoleErrorsMap.get(testId) || [];
  }

  private getNetworkErrors(testId: string): any[] {
    return this.networkErrorsMap.get(testId) || [];
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public utility methods
  public getHealingStats(): any {
    const operations = Array.from(this.performanceMetrics.keys());
    const stats = {};
    
    operations.forEach(op => {
      const durations = this.performanceMetrics.get(op)!;
      stats[op] = {
        count: durations.length,
        averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
        maxDuration: Math.max(...durations),
        minDuration: Math.min(...durations)
      };
    });

    return {
      cacheSize: this.healingCache.size,
      operationStats: stats,
      isEnabled: this.isEnabled
    };
  }

  public clearCache(): void {
    this.healingCache.clear();
    this.consoleErrorsMap.clear();
    this.networkErrorsMap.clear();
    this.performanceMetrics.clear();
  }
}

// Export singleton instance
export const selfHealingIntegration = new SelfHealingIntegration();

export default SelfHealingIntegration;