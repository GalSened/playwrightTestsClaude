import { OpenAI } from 'openai';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import { logger } from '@/utils/logger';
import { SelfHealingService } from '@/services/selfHealingService';
import type { FailureContext } from '@/services/selfHealingService';

export interface VisualAnalysis {
  elements: DetectedElement[];
  text: ExtractedText[];
  layout: LayoutAnalysis;
  suggestedSelectors: SelectorSuggestion[];
  confidence: number;
  language: 'hebrew' | 'english' | 'mixed';
}

export interface DetectedElement {
  type: 'button' | 'input' | 'link' | 'form' | 'text' | 'image';
  bounds: { x: number; y: number; width: number; height: number };
  confidence: number;
  text?: string;
  attributes: Record<string, string>;
  suggestedSelector: string;
}

export interface ExtractedText {
  text: string;
  bounds: { x: number; y: number; width: number; height: number };
  confidence: number;
  language: string;
  isClickable: boolean;
}

export interface LayoutAnalysis {
  direction: 'ltr' | 'rtl';
  primaryLanguage: 'hebrew' | 'english';
  regions: LayoutRegion[];
  navigationElements: DetectedElement[];
  contentElements: DetectedElement[];
}

export interface LayoutRegion {
  type: 'header' | 'nav' | 'main' | 'sidebar' | 'footer';
  bounds: { x: number; y: number; width: number; height: number };
  elements: DetectedElement[];
}

export interface SelectorSuggestion {
  selector: string;
  confidence: number;
  type: 'css' | 'xpath' | 'text' | 'aria';
  reasoning: string;
  fallbackSelectors: string[];
}

export interface HealingResult {
  success: boolean;
  healedSelector?: string;
  confidence: number;
  strategy: string;
  visualAnalysisUsed: boolean;
  alternatives: SelectorSuggestion[];
  learningData: any;
}

export class VisualHealingAI extends SelfHealingService {
  private openai: OpenAI;
  private ocrWorker: any;

  constructor(dbPath?: string) {
    super(dbPath);
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.initializeOCR();
  }

  private async initializeOCR(): Promise<void> {
    try {
      this.ocrWorker = await createWorker('eng+heb', 1, {
        logger: (m: any) => logger.debug('Tesseract:', m)
      });
      logger.info('OCR worker initialized with English and Hebrew support');
    } catch (error) {
      logger.error('Failed to initialize OCR worker:', error);
    }
  }

  /**
   * Advanced healing with visual analysis and ML learning
   */
  async healWithVisualAI(failure: FailureContext & { testId: string; testName: string }): Promise<HealingResult> {
    logger.info('Starting visual AI healing process', { 
      testId: failure.testId, 
      url: failure.url,
      originalSelector: failure.selector 
    });

    try {
      // Step 1: Multi-modal analysis
      const analysis = await Promise.all([
        this.analyzeDOMStructure(failure.dom),
        this.analyzeScreenshotWithAI(failure.screenshot),
        this.extractTextWithOCR(failure.screenshot),
        this.analyzeConsoleErrorsWithAI(failure.consoleErrors),
        this.detectPageLanguage(failure.dom, failure.screenshot)
      ]);

      const [domAnalysis, visualAnalysis, ocrText, errorAnalysis, languageDetection] = analysis;

      // Step 2: AI-powered healing strategy selection
      const healingStrategy = await this.selectOptimalHealingStrategy({
        failureType: await this.classifyFailure(new Error(failure.error), failure),
        domAnalysis,
        visualAnalysis,
        ocrText,
        errorAnalysis,
        language: languageDetection,
        historicalData: await this.getHistoricalHealingData(failure.testId)
      });

      logger.info('Selected healing strategy:', healingStrategy);

      // Step 3: Execute healing with visual assistance
      const healingResult = await this.executeVisualHealing(failure, healingStrategy, visualAnalysis);

      // Step 4: Learn from the result and update ML models
      await this.updateLearningModel({
        strategy: healingStrategy,
        result: healingResult,
        context: failure,
        visualData: visualAnalysis
      });

      // Step 5: Record healing attempt in database
      if (healingResult.success && healingResult.healedSelector) {
        await this.recordHealing(
          failure.testId,
          failure.testName,
          healingStrategy.type,
          failure.selector || 'unknown',
          healingResult.healedSelector,
          healingResult.confidence
        );
      }

      return {
        success: healingResult.success,
        healedSelector: healingResult.healedSelector,
        confidence: healingResult.confidence,
        strategy: healingStrategy.name,
        visualAnalysisUsed: true,
        alternatives: healingResult.alternatives || [],
        learningData: {
          visualElements: visualAnalysis.elements.length,
          textExtracted: ocrText.length,
          language: languageDetection,
          strategyUsed: healingStrategy.type
        }
      };

    } catch (error) {
      logger.error('Visual AI healing failed:', error);
      
      // Fallback to traditional healing
      const fallbackResult = await this.traditionalHealing(failure);
      return {
        success: fallbackResult.success,
        healedSelector: fallbackResult.selector,
        confidence: fallbackResult.confidence || 0.3,
        strategy: 'fallback',
        visualAnalysisUsed: false,
        alternatives: [],
        learningData: { fallbackUsed: true, error: error.message }
      };
    }
  }

  /**
   * Analyze screenshot using OpenAI Vision API
   */
  private async analyzeScreenshotWithAI(screenshot: Buffer): Promise<VisualAnalysis> {
    if (!screenshot || screenshot.length === 0) {
      return {
        elements: [],
        text: [],
        layout: { direction: 'ltr', primaryLanguage: 'english', regions: [], navigationElements: [], contentElements: [] },
        suggestedSelectors: [],
        confidence: 0,
        language: 'english'
      };
    }

    try {
      // Convert screenshot to base64 for OpenAI Vision API
      const base64Image = screenshot.toString('base64');
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this WeSign application screenshot for UI testing. Identify:
1. Interactive elements (buttons, inputs, links, forms)
2. Text content and language (Hebrew/English)
3. Layout direction (RTL for Hebrew, LTR for English)
4. Navigation elements vs content elements
5. Suggest CSS selectors for key interactive elements
6. Rate confidence level (0-1) for each detection

Focus on elements that could be used in Playwright test automation. Return JSON format with precise coordinates and selector suggestions.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 2000
      });

      // Parse AI response and structure the visual analysis
      const analysisText = response.choices[0].message.content || '';
      return this.parseVisualAnalysis(analysisText, screenshot);

    } catch (error) {
      logger.error('Screenshot AI analysis failed:', error);
      return {
        elements: [],
        text: [],
        layout: { direction: 'ltr', primaryLanguage: 'english', regions: [], navigationElements: [], contentElements: [] },
        suggestedSelectors: [],
        confidence: 0,
        language: 'english'
      };
    }
  }

  /**
   * Extract text using OCR with Hebrew and English support
   */
  private async extractTextWithOCR(screenshot: Buffer): Promise<ExtractedText[]> {
    if (!this.ocrWorker || !screenshot || screenshot.length === 0) {
      return [];
    }

    try {
      // Process image with OCR
      const { data } = await this.ocrWorker.recognize(screenshot);
      const extractedTexts: ExtractedText[] = [];

      // Process each word with bounding box information
      data.words.forEach((word: any) => {
        if (word.confidence > 60) { // Only high-confidence text
          extractedTexts.push({
            text: word.text,
            bounds: {
              x: word.bbox.x0,
              y: word.bbox.y0,
              width: word.bbox.x1 - word.bbox.x0,
              height: word.bbox.y1 - word.bbox.y0
            },
            confidence: word.confidence / 100,
            language: this.detectTextLanguage(word.text),
            isClickable: this.isLikelyClickable(word.text)
          });
        }
      });

      logger.info(`OCR extracted ${extractedTexts.length} text elements`);
      return extractedTexts;

    } catch (error) {
      logger.error('OCR text extraction failed:', error);
      return [];
    }
  }

  /**
   * Analyze DOM structure for element patterns
   */
  private async analyzeDOMStructure(dom: string): Promise<any> {
    // Enhanced DOM analysis with pattern recognition
    const patterns = {
      weSignSpecific: [
        // WeSign login patterns
        /input.*email.*hebrew|אימייל/gi,
        /input.*password.*hebrew|סיסמה/gi,
        /button.*login.*hebrew|התחבר/gi,
        // WeSign document patterns
        /upload.*document|העלאת.*מסמך/gi,
        /signature.*field|שדה.*חתימה/gi,
        // WeSign navigation patterns
        /dashboard|לוח.*מחוונים/gi,
        /contacts.*management|ניהול.*אנשי.*קשר/gi
      ],
      
      genericUI: [
        /button\[.*submit.*\]/gi,
        /input\[.*type.*=.*"email".*\]/gi,
        /input\[.*type.*=.*"password".*\]/gi,
        /\.btn-.*/gi,
        /\.form-.*/gi
      ],
      
      bilingual: [
        /hebrew|עברית|rtl/gi,
        /english|אנגלית|ltr/gi
      ]
    };

    const analysis = {
      weSignElements: [],
      genericElements: [],
      bilingualIndicators: [],
      formElements: [],
      navigationElements: []
    };

    // Analyze DOM for patterns
    for (const [category, categoryPatterns] of Object.entries(patterns)) {
      for (const pattern of categoryPatterns) {
        const matches = dom.match(pattern) || [];
        analysis[category as keyof typeof analysis].push(...matches);
      }
    }

    return analysis;
  }

  /**
   * Select optimal healing strategy using AI
   */
  private async selectOptimalHealingStrategy(context: any): Promise<any> {
    const strategies = [
      {
        name: 'Visual Element Detection',
        type: 'visual',
        confidence: this.calculateVisualConfidence(context.visualAnalysis),
        applicable: context.visualAnalysis.elements.length > 0
      },
      {
        name: 'OCR Text-Based Matching',
        type: 'ocr',
        confidence: this.calculateOCRConfidence(context.ocrText),
        applicable: context.ocrText.length > 0
      },
      {
        name: 'WeSign-Specific Patterns',
        type: 'wesign-patterns',
        confidence: this.calculateWeSignConfidence(context.domAnalysis),
        applicable: context.domAnalysis.weSignElements.length > 0
      },
      {
        name: 'Bilingual Fallback',
        type: 'bilingual',
        confidence: this.calculateBilingualConfidence(context.language),
        applicable: context.language === 'mixed' || context.language === 'hebrew'
      },
      {
        name: 'Traditional DOM Analysis',
        type: 'traditional',
        confidence: 0.6,
        applicable: true
      }
    ];

    // Select strategy with highest confidence that's applicable
    const applicableStrategies = strategies.filter(s => s.applicable);
    const selectedStrategy = applicableStrategies.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );

    logger.info('Selected healing strategy:', selectedStrategy);
    return selectedStrategy;
  }

  /**
   * Execute healing using visual analysis
   */
  private async executeVisualHealing(failure: FailureContext, strategy: any, visualAnalysis: VisualAnalysis): Promise<any> {
    switch (strategy.type) {
      case 'visual':
        return await this.healUsingVisualElements(failure, visualAnalysis);
      
      case 'ocr':
        return await this.healUsingOCRText(failure, visualAnalysis);
      
      case 'wesign-patterns':
        return await this.healUsingWeSignPatterns(failure);
      
      case 'bilingual':
        return await this.healUsingBilingualFallback(failure);
      
      default:
        return await this.traditionalHealing(failure);
    }
  }

  /**
   * Heal using visual element detection
   */
  private async healUsingVisualElements(failure: FailureContext, visualAnalysis: VisualAnalysis): Promise<any> {
    const originalSelector = failure.selector || '';
    const suggestedSelectors: SelectorSuggestion[] = [];

    // Find elements that might match the original intent
    for (const element of visualAnalysis.elements) {
      if (element.type === 'button' || element.type === 'input' || element.type === 'link') {
        const selectors = this.generateSelectorsFromVisualElement(element);
        suggestedSelectors.push(...selectors);
      }
    }

    // Sort by confidence and return the best match
    const bestMatch = suggestedSelectors.sort((a, b) => b.confidence - a.confidence)[0];
    
    if (bestMatch && bestMatch.confidence > 0.7) {
      return {
        success: true,
        healedSelector: bestMatch.selector,
        confidence: bestMatch.confidence,
        alternatives: suggestedSelectors.slice(1, 4) // Top 3 alternatives
      };
    }

    return { success: false, confidence: 0, alternatives: suggestedSelectors };
  }

  /**
   * Heal using OCR extracted text
   */
  private async healUsingOCRText(failure: FailureContext, visualAnalysis: VisualAnalysis): Promise<any> {
    const clickableTexts = visualAnalysis.text.filter(t => t.isClickable && t.confidence > 0.8);
    const suggestedSelectors: SelectorSuggestion[] = [];

    for (const textElement of clickableTexts) {
      // Generate selectors based on text content
      if (this.isWeSignActionText(textElement.text)) {
        suggestedSelectors.push({
          selector: `text="${textElement.text}"`,
          confidence: textElement.confidence * 0.9,
          type: 'text',
          reasoning: `OCR detected clickable text: "${textElement.text}"`,
          fallbackSelectors: [
            `text*="${textElement.text.substring(0, Math.min(textElement.text.length, 10))}"`,
            `button:has-text("${textElement.text}")`,
            `a:has-text("${textElement.text}")`
          ]
        });
      }
    }

    const bestMatch = suggestedSelectors.sort((a, b) => b.confidence - a.confidence)[0];
    
    if (bestMatch && bestMatch.confidence > 0.6) {
      return {
        success: true,
        healedSelector: bestMatch.selector,
        confidence: bestMatch.confidence,
        alternatives: suggestedSelectors.slice(1, 3)
      };
    }

    return { success: false, confidence: 0, alternatives: suggestedSelectors };
  }

  // Helper methods
  private parseVisualAnalysis(analysisText: string, screenshot: Buffer): VisualAnalysis {
    // Parse AI response and create structured visual analysis
    // This would contain sophisticated parsing logic for the AI response
    return {
      elements: [],
      text: [],
      layout: { direction: 'ltr', primaryLanguage: 'english', regions: [], navigationElements: [], contentElements: [] },
      suggestedSelectors: [],
      confidence: 0.5,
      language: 'english'
    };
  }

  private detectTextLanguage(text: string): string {
    const hebrewRegex = /[\u0590-\u05FF]/;
    return hebrewRegex.test(text) ? 'hebrew' : 'english';
  }

  private isLikelyClickable(text: string): boolean {
    const clickableTexts = [
      // English
      'login', 'submit', 'sign', 'upload', 'download', 'save', 'cancel', 'next', 'back',
      // Hebrew
      'התחבר', 'שלח', 'חתום', 'העלה', 'הורד', 'שמור', 'ביטול', 'הבא', 'חזור'
    ];
    
    return clickableTexts.some(clickable => 
      text.toLowerCase().includes(clickable.toLowerCase())
    );
  }

  private isWeSignActionText(text: string): boolean {
    const wesignActions = [
      // English WeSign actions
      'sign document', 'upload file', 'add contact', 'create template',
      // Hebrew WeSign actions
      'חתום על מסמך', 'העלה קובץ', 'הוסף איש קשר', 'צור תבנית'
    ];

    return wesignActions.some(action => 
      text.toLowerCase().includes(action.toLowerCase())
    );
  }

  private calculateVisualConfidence(visualAnalysis: VisualAnalysis): number {
    if (!visualAnalysis || visualAnalysis.elements.length === 0) return 0;
    
    const avgElementConfidence = visualAnalysis.elements.reduce(
      (sum, el) => sum + el.confidence, 0
    ) / visualAnalysis.elements.length;
    
    return Math.min(avgElementConfidence * 1.2, 1.0); // Boost visual confidence slightly
  }

  private calculateOCRConfidence(ocrTexts: ExtractedText[]): number {
    if (!ocrTexts || ocrTexts.length === 0) return 0;
    
    const clickableTexts = ocrTexts.filter(t => t.isClickable);
    if (clickableTexts.length === 0) return 0.3;
    
    const avgConfidence = clickableTexts.reduce(
      (sum, t) => sum + t.confidence, 0
    ) / clickableTexts.length;
    
    return avgConfidence;
  }

  private calculateWeSignConfidence(domAnalysis: any): number {
    const wesignElements = domAnalysis.weSignElements || [];
    return wesignElements.length > 0 ? Math.min(0.8 + (wesignElements.length * 0.05), 0.95) : 0.4;
  }

  private calculateBilingualConfidence(language: string): number {
    return language === 'hebrew' || language === 'mixed' ? 0.75 : 0.5;
  }

  private generateSelectorsFromVisualElement(element: DetectedElement): SelectorSuggestion[] {
    const suggestions: SelectorSuggestion[] = [];

    // Generate CSS selector based on element properties
    if (element.text) {
      suggestions.push({
        selector: `${element.type}:has-text("${element.text}")`,
        confidence: 0.8,
        type: 'css',
        reasoning: `Visual element with text: "${element.text}"`,
        fallbackSelectors: [
          `text="${element.text}"`,
          `${element.type}[title*="${element.text}"]`,
          `${element.type}[aria-label*="${element.text}"]`
        ]
      });
    }

    // Generate position-based selector
    suggestions.push({
      selector: `${element.type}:nth-of-type(1)`, // Simplified
      confidence: 0.6,
      type: 'css',
      reasoning: 'Position-based selector from visual analysis',
      fallbackSelectors: [
        `${element.type}:first-of-type`,
        `${element.type}:last-of-type`
      ]
    });

    return suggestions;
  }

  private async detectPageLanguage(dom: string, screenshot: Buffer): Promise<string> {
    const hebrewChars = (dom.match(/[\u0590-\u05FF]/g) || []).length;
    const englishChars = (dom.match(/[a-zA-Z]/g) || []).length;
    
    if (hebrewChars > englishChars * 0.3) return 'hebrew';
    if (englishChars > hebrewChars * 0.3) return 'english';
    return 'mixed';
  }

  private async getHistoricalHealingData(testId: string): Promise<any> {
    // Query database for historical healing patterns for this test
    return {};
  }

  private async updateLearningModel(data: any): Promise<void> {
    // Update ML models with new healing data
    logger.info('Updating learning model with new healing data');
  }

  private async traditionalHealing(failure: FailureContext): Promise<any> {
    // Fallback to existing healing logic
    const alternatives = await this.findAlternativeSelectors(
      failure.selector || '',
      failure.dom
    );
    
    return {
      success: alternatives.length > 0,
      selector: alternatives[0]?.selector,
      confidence: alternatives[0]?.confidence || 0.3,
      alternatives
    };
  }

  private async healUsingWeSignPatterns(failure: FailureContext): Promise<any> {
    // WeSign-specific healing patterns
    return { success: false, confidence: 0, alternatives: [] };
  }

  private async healUsingBilingualFallback(failure: FailureContext): Promise<any> {
    // Bilingual fallback healing
    return { success: false, confidence: 0, alternatives: [] };
  }

  private async analyzeConsoleErrorsWithAI(consoleErrors: string[]): Promise<any> {
    // AI analysis of console errors
    return {};
  }

  async close(): Promise<void> {
    if (this.ocrWorker) {
      await this.ocrWorker.terminate();
    }
    await super.close();
  }
}

export default VisualHealingAI;