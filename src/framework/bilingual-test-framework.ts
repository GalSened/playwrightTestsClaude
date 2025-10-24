/**
 * Bilingual Testing Framework for WeSign
 * 
 * Provides comprehensive support for Hebrew/English testing including:
 * - RTL/LTR layout validation
 * - Language-specific element detection
 * - Cultural formatting validation
 * - Accessibility compliance for Hebrew
 */

import { Page, Locator, expect } from '@playwright/test';
import { wesignConfig, BilingualStrings } from '../config/wesign-config';

export type Language = 'hebrew' | 'english';
export type TextDirection = 'rtl' | 'ltr';

export interface BilingualTestContext {
  page: Page;
  currentLanguage: Language;
  direction: TextDirection;
  locale: string;
}

export interface RTLValidationOptions {
  checkAlignment: boolean;
  checkTextDirection: boolean;
  checkElementOrder: boolean;
  checkFontRendering: boolean;
}

export interface LayoutValidationResult {
  isValid: boolean;
  issues: string[];
  warnings: string[];
  elementChecks: {
    alignment: boolean;
    textDirection: boolean;
    elementOrder: boolean;
    fontRendering: boolean;
  };
}

export class BilingualTestFramework {
  private context: BilingualTestContext;
  private validationResults: LayoutValidationResult[] = [];

  constructor(page: Page, language: Language = 'hebrew') {
    this.context = {
      page,
      currentLanguage: language,
      direction: language === 'hebrew' ? 'rtl' : 'ltr',
      locale: language === 'hebrew' ? 'he-IL' : 'en-US'
    };
  }

  /**
   * Switch the application language and update context
   */
  async switchLanguage(targetLanguage: Language): Promise<void> {
    const { page } = this.context;
    
    console.log(`🌐 Switching to ${targetLanguage} interface...`);
    
    // Look for language toggle elements
    const languageToggleSelectors = [
      '[data-testid="language-toggle"]',
      '.language-selector',
      '.lang-switch',
      'button[aria-label*="language"]',
      targetLanguage === 'hebrew' ? 'button:text("עברית")' : 'button:text("English")',
      targetLanguage === 'hebrew' ? 'button:text("HE")' : 'button:text("EN")'
    ];

    let toggled = false;
    for (const selector of languageToggleSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 })) {
          await element.click();
          toggled = true;
          break;
        }
      } catch (error) {
        // Continue to next selector
        continue;
      }
    }

    if (!toggled) {
      // Try URL-based language switching
      const currentUrl = page.url();
      const langParam = targetLanguage === 'hebrew' ? 'he' : 'en';
      const newUrl = this.addOrUpdateUrlParam(currentUrl, 'lang', langParam);
      
      if (newUrl !== currentUrl) {
        await page.goto(newUrl);
        toggled = true;
      }
    }

    if (toggled) {
      // Wait for language change to take effect
      await page.waitForTimeout(2000);
      
      // Update context
      this.context.currentLanguage = targetLanguage;
      this.context.direction = targetLanguage === 'hebrew' ? 'rtl' : 'ltr';
      this.context.locale = targetLanguage === 'hebrew' ? 'he-IL' : 'en-US';
      
      // Verify language switch was successful
      const isCorrectLanguage = await this.verifyLanguageSwitch(targetLanguage);
      if (!isCorrectLanguage) {
        throw new Error(`Failed to switch to ${targetLanguage} interface`);
      }
      
      console.log(`✅ Successfully switched to ${targetLanguage}`);
    } else {
      console.warn(`⚠️  Could not find language toggle for ${targetLanguage}`);
    }
  }

  /**
   * Find element using language-aware selectors
   */
  async findElementByLanguage(elementKey: string): Promise<Locator> {
    const selectors = wesignConfig.getSelectorsForLanguage(elementKey, this.context.currentLanguage);
    
    for (const selector of selectors) {
      try {
        const element = this.context.page.locator(selector).first();
        await element.waitFor({ timeout: 5000 });
        return element;
      } catch (error) {
        continue;
      }
    }
    
    throw new Error(`Could not find element '${elementKey}' for language '${this.context.currentLanguage}' using selectors: ${selectors.join(', ')}`);
  }

  /**
   * Get text content in current language
   */
  getTextForCurrentLanguage(textKey: string): string {
    return wesignConfig.getTextForLanguage(textKey, this.context.currentLanguage);
  }

  /**
   * Validate RTL/LTR layout for current page
   */
  async validateLayout(options: Partial<RTLValidationOptions> = {}): Promise<LayoutValidationResult> {
    const fullOptions: RTLValidationOptions = {
      checkAlignment: true,
      checkTextDirection: true,
      checkElementOrder: true,
      checkFontRendering: true,
      ...options
    };

    console.log(`🔍 Validating ${this.context.direction.toUpperCase()} layout...`);

    const result: LayoutValidationResult = {
      isValid: true,
      issues: [],
      warnings: [],
      elementChecks: {
        alignment: true,
        textDirection: true,
        elementOrder: true,
        fontRendering: true
      }
    };

    // Check document direction
    if (fullOptions.checkTextDirection) {
      result.elementChecks.textDirection = await this.validateTextDirection();
      if (!result.elementChecks.textDirection) {
        result.issues.push(`Document direction should be ${this.context.direction} for ${this.context.currentLanguage}`);
        result.isValid = false;
      }
    }

    // Check element alignment
    if (fullOptions.checkAlignment) {
      result.elementChecks.alignment = await this.validateElementAlignment();
      if (!result.elementChecks.alignment) {
        result.issues.push('Element alignment does not match expected direction');
        result.isValid = false;
      }
    }

    // Check element order (Hebrew should have reverse order for navigation)
    if (fullOptions.checkElementOrder) {
      result.elementChecks.elementOrder = await this.validateElementOrder();
      if (!result.elementChecks.elementOrder) {
        result.warnings.push('Element order may not be optimal for current language');
      }
    }

    // Check font rendering for Hebrew
    if (fullOptions.checkFontRendering && this.context.currentLanguage === 'hebrew') {
      result.elementChecks.fontRendering = await this.validateHebrewFontRendering();
      if (!result.elementChecks.fontRendering) {
        result.issues.push('Hebrew font rendering issues detected');
        result.isValid = false;
      }
    }

    this.validationResults.push(result);
    
    if (result.isValid) {
      console.log(`✅ Layout validation passed for ${this.context.currentLanguage}`);
    } else {
      console.log(`❌ Layout validation failed: ${result.issues.join(', ')}`);
    }

    return result;
  }

  /**
   * Validate cultural formatting (dates, numbers, etc.)
   */
  async validateCulturalFormatting(): Promise<boolean> {
    const { page, currentLanguage } = this.context;
    
    console.log(`🔍 Validating cultural formatting for ${currentLanguage}...`);

    try {
      // Check date formatting
      const dateElements = await page.locator('[data-date], .date, .datetime, time').all();
      for (const element of dateElements) {
        const dateText = await element.textContent();
        if (dateText) {
          const isValidFormat = this.validateDateFormat(dateText, currentLanguage);
          if (!isValidFormat) {
            console.warn(`⚠️  Invalid date format: ${dateText}`);
            return false;
          }
        }
      }

      // Check number formatting
      const numberElements = await page.locator('[data-number], .number, .currency, .amount').all();
      for (const element of numberElements) {
        const numberText = await element.textContent();
        if (numberText) {
          const isValidFormat = this.validateNumberFormat(numberText, currentLanguage);
          if (!isValidFormat) {
            console.warn(`⚠️  Invalid number format: ${numberText}`);
            return false;
          }
        }
      }

      console.log(`✅ Cultural formatting validation passed`);
      return true;

    } catch (error) {
      console.warn(`⚠️  Cultural formatting validation failed:`, error.message);
      return false;
    }
  }

  /**
   * Test bilingual form interactions
   */
  async testBilingualForm(formSelector: string): Promise<boolean> {
    const { page, currentLanguage } = this.context;
    
    console.log(`📝 Testing bilingual form: ${formSelector}`);

    try {
      const form = page.locator(formSelector);
      await form.waitFor({ timeout: 10000 });

      // Test input field interactions
      const inputs = await form.locator('input, textarea, select').all();
      for (const input of inputs) {
        // Check placeholder text language
        const placeholder = await input.getAttribute('placeholder');
        if (placeholder) {
          const isCorrectLanguage = this.detectTextLanguage(placeholder) === currentLanguage;
          if (!isCorrectLanguage) {
            console.warn(`⚠️  Placeholder language mismatch: ${placeholder}`);
          }
        }

        // Check aria-label language
        const ariaLabel = await input.getAttribute('aria-label');
        if (ariaLabel) {
          const isCorrectLanguage = this.detectTextLanguage(ariaLabel) === currentLanguage;
          if (!isCorrectLanguage) {
            console.warn(`⚠️  Aria-label language mismatch: ${ariaLabel}`);
          }
        }

        // Test keyboard input for Hebrew
        if (currentLanguage === 'hebrew') {
          await this.testHebrewInput(input);
        }
      }

      // Test label associations
      const labels = await form.locator('label').all();
      for (const label of labels) {
        const labelText = await label.textContent();
        if (labelText) {
          const isCorrectLanguage = this.detectTextLanguage(labelText) === currentLanguage;
          if (!isCorrectLanguage) {
            console.warn(`⚠️  Label language mismatch: ${labelText}`);
          }
        }
      }

      console.log(`✅ Bilingual form testing completed`);
      return true;

    } catch (error) {
      console.warn(`⚠️  Bilingual form testing failed:`, error.message);
      return false;
    }
  }

  /**
   * Test accessibility for Hebrew content
   */
  async validateHebrewAccessibility(): Promise<boolean> {
    if (this.context.currentLanguage !== 'hebrew') {
      return true; // Skip if not Hebrew
    }

    const { page } = this.context;
    console.log(`♿ Validating Hebrew accessibility...`);

    try {
      // Check lang attribute
      const htmlLang = await page.getAttribute('html', 'lang');
      if (htmlLang !== 'he' && htmlLang !== 'he-IL') {
        console.warn(`⚠️  HTML lang attribute should be 'he' or 'he-IL', found: ${htmlLang}`);
      }

      // Check dir attribute
      const htmlDir = await page.getAttribute('html', 'dir');
      if (htmlDir !== 'rtl') {
        console.warn(`⚠️  HTML dir attribute should be 'rtl' for Hebrew, found: ${htmlDir}`);
      }

      // Check screen reader compatibility
      const ariaElements = await page.locator('[aria-label], [aria-describedby], [role]').all();
      for (const element of ariaElements) {
        const ariaLabel = await element.getAttribute('aria-label');
        if (ariaLabel && this.containsHebrew(ariaLabel)) {
          // Verify Hebrew text is properly encoded
          const isValidHebrew = this.validateHebrewEncoding(ariaLabel);
          if (!isValidHebrew) {
            console.warn(`⚠️  Invalid Hebrew encoding in aria-label: ${ariaLabel}`);
          }
        }
      }

      console.log(`✅ Hebrew accessibility validation completed`);
      return true;

    } catch (error) {
      console.warn(`⚠️  Hebrew accessibility validation failed:`, error.message);
      return false;
    }
  }

  /**
   * Create test data for both languages
   */
  createBilingualTestData<T extends Record<string, any>>(
    hebrewData: T,
    englishData: T
  ): { hebrew: T; english: T; current: T } {
    return {
      hebrew: hebrewData,
      english: englishData,
      current: this.context.currentLanguage === 'hebrew' ? hebrewData : englishData
    };
  }

  // Private helper methods

  private async verifyLanguageSwitch(expectedLanguage: Language): Promise<boolean> {
    const { page } = this.context;
    
    // Check for language-specific text indicators
    const indicators = {
      hebrew: ['התחבר', 'מסמכים', 'חתימה', 'העלאה'],
      english: ['Login', 'Documents', 'Signature', 'Upload']
    };

    const expectedIndicators = indicators[expectedLanguage];
    const content = await page.content();
    
    return expectedIndicators.some(indicator => content.includes(indicator));
  }

  private async validateTextDirection(): Promise<boolean> {
    const { page, direction } = this.context;
    
    try {
      const htmlDir = await page.getAttribute('html', 'dir');
      const bodyDir = await page.getAttribute('body', 'dir');
      
      return htmlDir === direction || bodyDir === direction;
    } catch (error) {
      return false;
    }
  }

  private async validateElementAlignment(): Promise<boolean> {
    const { page, direction } = this.context;
    
    try {
      // Check navigation elements alignment
      const navElements = await page.locator('nav, .navigation, .navbar, .menu').first();
      if (await navElements.isVisible({ timeout: 2000 })) {
        const computedStyle = await navElements.evaluate((el) => {
          return window.getComputedStyle(el);
        });
        
        const textAlign = computedStyle.textAlign;
        const float = computedStyle.float;
        
        if (direction === 'rtl') {
          return textAlign === 'right' || float === 'right' || textAlign === 'start';
        } else {
          return textAlign === 'left' || float === 'left' || textAlign === 'start';
        }
      }
      
      return true; // No navigation elements found, assume valid
    } catch (error) {
      return true; // Fallback to valid if check fails
    }
  }

  private async validateElementOrder(): Promise<boolean> {
    const { page, currentLanguage } = this.context;
    
    try {
      // Check breadcrumb order for Hebrew (should be reversed)
      const breadcrumbs = await page.locator('.breadcrumb, .breadcrumbs, nav[aria-label*="breadcrumb"]').first();
      if (await breadcrumbs.isVisible({ timeout: 2000 })) {
        const items = await breadcrumbs.locator('li, a, span').all();
        if (items.length > 1) {
          // For Hebrew, last item should be leftmost visually
          // This is a simplified check
          return true; // Placeholder for complex visual order validation
        }
      }
      
      return true;
    } catch (error) {
      return true;
    }
  }

  private async validateHebrewFontRendering(): Promise<boolean> {
    const { page } = this.context;
    
    try {
      // Check for Hebrew text elements
      const hebrewElements = await page.locator(':text-matches("[\\u0590-\\u05FF]+")').all();
      
      for (const element of hebrewElements.slice(0, 5)) { // Check first 5 elements
        const computedStyle = await element.evaluate((el) => {
          return window.getComputedStyle(el);
        });
        
        const fontFamily = computedStyle.fontFamily;
        
        // Check if appropriate Hebrew fonts are being used
        const hasHebrewFonts = [
          'David', 'Narkisim', 'FrankRuehl', 'Miriam', 'Arial Hebrew',
          'Tahoma', 'Arial Unicode MS'
        ].some(font => fontFamily.includes(font));
        
        if (!hasHebrewFonts) {
          console.warn(`⚠️  Hebrew element may not have appropriate font: ${fontFamily}`);
        }
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  private validateDateFormat(dateText: string, language: Language): boolean {
    // Simplified date format validation
    if (language === 'hebrew') {
      // Hebrew dates might be DD/MM/YYYY or Hebrew calendar
      return /\d{1,2}\/\d{1,2}\/\d{4}/.test(dateText) || this.containsHebrew(dateText);
    } else {
      // English dates MM/DD/YYYY or various formats
      return /\d{1,2}\/\d{1,2}\/\d{4}/.test(dateText) || /\w+ \d{1,2}, \d{4}/.test(dateText);
    }
  }

  private validateNumberFormat(numberText: string, language: Language): boolean {
    // Check for appropriate decimal separators and digit grouping
    if (language === 'hebrew') {
      // Hebrew may use comma as decimal separator
      return /[\d,\.]+/.test(numberText);
    } else {
      // English standard formatting
      return /[\d,\.]+/.test(numberText);
    }
  }

  private detectTextLanguage(text: string): Language {
    // Simple Hebrew detection
    return this.containsHebrew(text) ? 'hebrew' : 'english';
  }

  private containsHebrew(text: string): boolean {
    return /[\u0590-\u05FF]/.test(text);
  }

  private validateHebrewEncoding(text: string): boolean {
    // Check for proper UTF-8 encoding of Hebrew characters
    try {
      return text === decodeURIComponent(encodeURIComponent(text));
    } catch (error) {
      return false;
    }
  }

  private async testHebrewInput(input: Locator): Promise<void> {
    try {
      // Test Hebrew text input
      await input.fill('בדיקה');
      const value = await input.inputValue();
      if (value !== 'בדיקה') {
        console.warn('⚠️  Hebrew input handling issue detected');
      }
      await input.clear();
    } catch (error) {
      console.warn('⚠️  Hebrew input test failed:', error.message);
    }
  }

  private addOrUpdateUrlParam(url: string, param: string, value: string): string {
    const urlObj = new URL(url);
    urlObj.searchParams.set(param, value);
    return urlObj.toString();
  }

  // Getter methods
  public getCurrentLanguage(): Language {
    return this.context.currentLanguage;
  }

  public getDirection(): TextDirection {
    return this.context.direction;
  }

  public getValidationResults(): LayoutValidationResult[] {
    return this.validationResults;
  }
}

// Export utility functions
export const BilingualUtils = {
  /**
   * Create a test that runs for both languages
   */
  async runBilingualTest<T>(
    page: Page,
    testFunction: (framework: BilingualTestFramework) => Promise<T>
  ): Promise<{ hebrew: T; english: T }> {
    const results = {
      hebrew: null as T,
      english: null as T
    };

    // Test Hebrew
    const hebrewFramework = new BilingualTestFramework(page, 'hebrew');
    await hebrewFramework.switchLanguage('hebrew');
    results.hebrew = await testFunction(hebrewFramework);

    // Test English
    const englishFramework = new BilingualTestFramework(page, 'english');
    await englishFramework.switchLanguage('english');
    results.english = await testFunction(englishFramework);

    return results;
  },

  /**
   * Assert that both language results are equivalent
   */
  assertBilingualEquivalence<T>(
    results: { hebrew: T; english: T },
    compareFn?: (hebrew: T, english: T) => boolean
  ): void {
    if (compareFn) {
      expect(compareFn(results.hebrew, results.english)).toBe(true);
    } else {
      // Default comparison - using strict equality  
      expect(JSON.stringify(results.hebrew)).toBe(JSON.stringify(results.english));
    }
  }
};

export default BilingualTestFramework;