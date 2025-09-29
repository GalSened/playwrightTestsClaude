import { OpenAI } from 'openai';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import { logger } from '@/utils/logger';
import { SelfHealingService } from '@/services/selfHealingService';
import type { FailureContext } from '@/services/selfHealingService';
import WeSignCodebaseAnalyzer, { WeSignCodeStructure } from './wesignCodebaseAnalyzer';
import UnifiedKnowledgeService from './unifiedKnowledgeService';
import { AIService } from './AIService';

export interface VisualAnalysis {
  elements: DetectedElement[];
  text: ExtractedText[];
  layout: LayoutAnalysis;
  suggestedSelectors: SelectorSuggestion[];
  confidence: number;
  language: 'hebrew' | 'english' | 'mixed';
  wesignContext?: {
    detectedComponents: string[];
    workflowElements: string[];
    hebrewUIElements: number;
    businessCriticalElements: DetectedElement[];
    uiPatterns: string[];
  };
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
  private codebaseAnalyzer: WeSignCodebaseAnalyzer;
  private knowledgeService: UnifiedKnowledgeService;
  private aiService: AIService;
  private codeStructure: WeSignCodeStructure | null = null;

  constructor(dbPath?: string) {
    super(dbPath);
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // Initialize WeSign-aware services
    this.codebaseAnalyzer = new WeSignCodebaseAnalyzer();
    this.knowledgeService = new UnifiedKnowledgeService();
    this.aiService = new AIService();

    // Initialize WeSign visual patterns and OCR
    this.initializeWeSignVisualIntelligence();
    this.initializeOCR();
  }

  /**
   * Initialize WeSign visual intelligence with codebase patterns
   */
  private async initializeWeSignVisualIntelligence(): Promise<void> {
    try {
      logger.info('Initializing WeSign visual intelligence patterns');
      this.codeStructure = await this.codebaseAnalyzer.analyzeFullCodebase();

      logger.info('WeSign-aware visual healing initialized', {
        features: this.codeStructure.features.length,
        workflows: this.codeStructure.workflows.length,
        components: this.codeStructure.frontend.components.length,
        controllers: this.codeStructure.backend.controllers.length
      });
    } catch (error) {
      logger.warn('Failed to initialize WeSign visual intelligence:', error);
      // Continue without codebase knowledge - system still functional
    }
  }

  private async initializeOCR(): Promise<void> {
    try {
      this.ocrWorker = await createWorker('eng+heb', 1, {
        logger: (m: any) => logger.debug('Tesseract:', m)
      });
      logger.info('WeSign-aware OCR worker initialized with English and Hebrew support');
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
   * Analyze screenshot using WeSign-aware OpenAI Vision API
   */
  private async analyzeScreenshotWithAI(screenshot: Buffer, context?: FailureContext): Promise<VisualAnalysis> {
    if (!screenshot || screenshot.length === 0) {
      return this.createEmptyAnalysis();
    }

    try {
      // Convert screenshot to base64 for OpenAI Vision API
      const base64Image = screenshot.toString('base64');

      // Get WeSign knowledge context for enhanced analysis
      const wesignKnowledge = await this.getWeSignVisualContext(context);

      const response = await this.aiService.chatCompletion([
        {
          role: 'system',
          content: `You are a WeSign platform visual analysis expert specializing in UI test automation. You have deep knowledge of WeSign's Angular frontend and .NET Core backend architecture. Analyze screenshots with expertise in:

- WeSign component patterns and UI conventions
- Hebrew/English bilingual interfaces with RTL/LTR layouts
- Digital signature workflows and document management UIs
- Contact management, template editing, and authentication flows
- WeSign-specific CSS classes, data attributes, and element patterns

Return analysis in precise JSON format for test automation use.`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this WeSign application screenshot for intelligent UI test automation healing:

WESIGN CONTEXT:
${this.formatWeSignVisualContext(wesignKnowledge)}

FAILURE CONTEXT:
URL: ${context?.url || 'Unknown'}
Original Selector: ${context?.selector || 'Unknown'}
Error: ${context?.error || 'Unknown'}

Perform comprehensive analysis:
1. Detect WeSign-specific UI components (contact forms, document viewers, signature canvases, template editors)
2. Identify interactive elements with WeSign CSS patterns (mat-, app-, wesign- prefixes)
3. Analyze Hebrew/English text and RTL/LTR layout direction
4. Map elements to WeSign workflows (sign, upload, contact, template, auth)
5. Generate robust selector suggestions prioritizing:
   - data-testid attributes
   - WeSign-specific classes and IDs
   - Semantic HTML5 elements
   - ARIA labels and roles
   - Text-based selectors for Hebrew/English content
6. Rate confidence (0-1) based on visual clarity and WeSign pattern matching

Focus on elements crucial for WeSign test automation. Return structured JSON with coordinates, confidence scores, and WeSign-specific insights.`
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${base64Image}`
              }
            }
          ]
        }
      ], {
        reasoning_effort: 'high',
        maxTokens: 3000
      });

      // Parse AI response and structure the visual analysis
      const analysisText = response.choices[0].message.content || '';
      const analysis = await this.parseWeSignVisualAnalysis(analysisText, screenshot, context);

      // Enhance with codebase-aware WeSign context
      analysis.wesignContext = await this.buildWeSignVisualContext(analysis, context);

      return analysis;

    } catch (error) {
      logger.error('WeSign screenshot AI analysis failed:', error);
      return this.createEmptyAnalysis();
    }
  }

  /**
   * Create empty analysis structure
   */
  private createEmptyAnalysis(): VisualAnalysis {
    return {
      elements: [],
      text: [],
      layout: { direction: 'ltr', primaryLanguage: 'english', regions: [], navigationElements: [], contentElements: [] },
      suggestedSelectors: [],
      confidence: 0,
      language: 'english',
      wesignContext: {
        detectedComponents: [],
        workflowElements: [],
        hebrewUIElements: 0,
        businessCriticalElements: [],
        uiPatterns: []
      }
    };
  }

  /**
   * Get WeSign visual context for enhanced analysis
   */
  private async getWeSignVisualContext(context?: FailureContext): Promise<any> {
    if (!this.codeStructure) {
      return { components: [], workflows: [], features: [] };
    }

    const visualContext = {
      components: this.codeStructure.frontend.components.slice(0, 10),
      workflows: this.codeStructure.workflows.slice(0, 8),
      features: this.codeStructure.features.slice(0, 15),
      uiPatterns: [
        'mat-button', 'mat-form-field', 'mat-input', 'mat-card',
        'app-contact-form', 'app-document-viewer', 'app-signature-canvas',
        'wesign-template-editor', 'wesign-upload-area'
      ]
    };

    return visualContext;
  }

  /**
   * Format WeSign visual context for AI prompt
   */
  private formatWeSignVisualContext(wesignKnowledge: any): string {
    return `
WeSign Components: ${wesignKnowledge.components?.map((c: any) => c.name || c).join(', ') || 'None'}
WeSign Workflows: ${wesignKnowledge.workflows?.map((w: any) => w.name || w).join(', ') || 'None'}
WeSign Features: ${wesignKnowledge.features?.map((f: any) => f.name || f).join(', ') || 'None'}
Common UI Patterns: ${wesignKnowledge.uiPatterns?.join(', ') || 'None'}
    `.trim();
  }

  /**
   * Build WeSign-specific visual context from analysis
   */
  private async buildWeSignVisualContext(analysis: VisualAnalysis, context?: FailureContext): Promise<any> {
    const detectedComponents = this.detectWeSignComponents(analysis.elements);
    const workflowElements = this.identifyWorkflowElements(analysis.elements);
    const hebrewUIElements = this.countHebrewElements(analysis.text);
    const businessCriticalElements = this.identifyBusinessCriticalElements(analysis.elements);
    const uiPatterns = this.extractUIPatterns(analysis.elements);

    return {
      detectedComponents,
      workflowElements,
      hebrewUIElements,
      businessCriticalElements,
      uiPatterns
    };
  }

  /**
   * Detect WeSign components from visual elements
   */
  private detectWeSignComponents(elements: DetectedElement[]): string[] {
    const components = [];

    for (const element of elements) {
      if (element.text?.includes('Sign') || element.text?.includes('חתימה')) {
        components.push('SigningComponent');
      }
      if (element.text?.includes('Contact') || element.text?.includes('איש קשר')) {
        components.push('ContactManagementComponent');
      }
      if (element.text?.includes('Document') || element.text?.includes('מסמך')) {
        components.push('DocumentManagementComponent');
      }
      if (element.text?.includes('Template') || element.text?.includes('תבנית')) {
        components.push('TemplateManagementComponent');
      }
      if (element.text?.includes('Login') || element.text?.includes('התחבר')) {
        components.push('AuthenticationComponent');
      }
    }

    return [...new Set(components)];
  }

  /**
   * Identify workflow elements from visual analysis
   */
  private identifyWorkflowElements(elements: DetectedElement[]): string[] {
    const workflows = [];

    for (const element of elements) {
      if (element.type === 'button') {
        if (element.text?.match(/upload|העלאה/i)) workflows.push('Document Upload');
        if (element.text?.match(/sign|חתום/i)) workflows.push('Digital Signature');
        if (element.text?.match(/add.*contact|הוסף.*איש.*קשר/i)) workflows.push('Add Contact');
        if (element.text?.match(/create.*template|צור.*תבנית/i)) workflows.push('Create Template');
        if (element.text?.match(/login|התחבר/i)) workflows.push('Authentication');
      }
    }

    return [...new Set(workflows)];
  }

  /**
   * Count Hebrew UI elements
   */
  private countHebrewElements(textElements: ExtractedText[]): number {
    return textElements.filter(text =>
      /[\u0590-\u05FF]/.test(text.text)
    ).length;
  }

  /**
   * Identify business critical elements
   */
  private identifyBusinessCriticalElements(elements: DetectedElement[]): DetectedElement[] {
    return elements.filter(element => {
      const criticalPatterns = [
        /sign|signature|חתימה/i,
        /upload|העלאה/i,
        /save|שמור/i,
        /submit|שלח/i,
        /login|התחבר/i
      ];

      return criticalPatterns.some(pattern =>
        element.text && pattern.test(element.text)
      );
    });
  }

  /**
   * Extract UI patterns from elements
   */
  private extractUIPatterns(elements: DetectedElement[]): string[] {
    const patterns = [];

    for (const element of elements) {
      if (element.attributes) {
        Object.entries(element.attributes).forEach(([key, value]) => {
          if (key === 'class' && typeof value === 'string') {
            const classes = value.split(' ');
            patterns.push(...classes.filter(cls =>
              cls.startsWith('mat-') ||
              cls.startsWith('app-') ||
              cls.startsWith('wesign-')
            ));
          }
        });
      }
    }

    return [...new Set(patterns)];
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

  // Helper methods for WeSign-aware visual analysis
  private async parseWeSignVisualAnalysis(analysisText: string, screenshot: Buffer, context?: FailureContext): Promise<VisualAnalysis> {
    try {
      // Attempt to parse JSON response from AI
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      let aiAnalysis = {};

      if (jsonMatch) {
        try {
          aiAnalysis = JSON.parse(jsonMatch[0]);
        } catch (parseError) {
          logger.warn('Failed to parse AI analysis JSON, using text analysis');
        }
      }

      // Extract elements from AI analysis or create defaults
      const elements = this.extractElementsFromAnalysis(aiAnalysis, analysisText);
      const text = this.extractTextFromAnalysis(aiAnalysis, analysisText);
      const layout = this.extractLayoutFromAnalysis(aiAnalysis, analysisText, context);
      const suggestedSelectors = this.extractSelectorsFromAnalysis(aiAnalysis, elements);
      const language = this.detectLanguageFromAnalysis(text, context);

      return {
        elements,
        text,
        layout,
        suggestedSelectors,
        confidence: this.calculateAnalysisConfidence(elements, text, aiAnalysis),
        language,
        wesignContext: {
          detectedComponents: [],
          workflowElements: [],
          hebrewUIElements: 0,
          businessCriticalElements: [],
          uiPatterns: []
        }
      };

    } catch (error) {
      logger.error('Failed to parse WeSign visual analysis:', error);
      return this.createEmptyAnalysis();
    }
  }

  /**
   * Extract elements from AI analysis
   */
  private extractElementsFromAnalysis(aiAnalysis: any, analysisText: string): DetectedElement[] {
    const elements: DetectedElement[] = [];

    // Try to extract from structured AI response
    if (aiAnalysis.elements && Array.isArray(aiAnalysis.elements)) {
      return aiAnalysis.elements.map((el: any) => ({
        type: el.type || 'button',
        bounds: el.bounds || { x: 0, y: 0, width: 100, height: 30 },
        confidence: el.confidence || 0.8,
        text: el.text || '',
        attributes: el.attributes || {},
        suggestedSelector: el.suggestedSelector || el.selector || 'button'
      }));
    }

    // Fallback: extract from text analysis
    const buttonPattern = /button.*?(?:sign|login|submit|upload|save|התחבר|חתום|שלח|העלה|שמור)/gi;
    const inputPattern = /input.*?(?:email|password|name|אימייל|סיסמה|שם)/gi;

    let match;
    while ((match = buttonPattern.exec(analysisText)) !== null) {
      elements.push({
        type: 'button',
        bounds: { x: 0, y: 0, width: 100, height: 30 },
        confidence: 0.7,
        text: match[0],
        attributes: {},
        suggestedSelector: 'button'
      });
    }

    while ((match = inputPattern.exec(analysisText)) !== null) {
      elements.push({
        type: 'input',
        bounds: { x: 0, y: 0, width: 200, height: 30 },
        confidence: 0.7,
        text: match[0],
        attributes: {},
        suggestedSelector: 'input'
      });
    }

    return elements;
  }

  /**
   * Extract text elements from analysis
   */
  private extractTextFromAnalysis(aiAnalysis: any, analysisText: string): ExtractedText[] {
    const textElements: ExtractedText[] = [];

    if (aiAnalysis.text && Array.isArray(aiAnalysis.text)) {
      return aiAnalysis.text.map((t: any) => ({
        text: t.text || '',
        bounds: t.bounds || { x: 0, y: 0, width: 100, height: 20 },
        confidence: t.confidence || 0.8,
        language: this.detectTextLanguage(t.text || ''),
        isClickable: this.isLikelyClickable(t.text || '')
      }));
    }

    // Extract Hebrew and English text patterns
    const hebrewPattern = /[\u0590-\u05FF][^.!?]*[.!?]?/g;
    const englishPattern = /[A-Z][a-z\s]*[.!?]?/g;

    let match;
    while ((match = hebrewPattern.exec(analysisText)) !== null) {
      textElements.push({
        text: match[0].trim(),
        bounds: { x: 0, y: 0, width: 150, height: 20 },
        confidence: 0.8,
        language: 'hebrew',
        isClickable: this.isLikelyClickable(match[0])
      });
    }

    while ((match = englishPattern.exec(analysisText)) !== null) {
      textElements.push({
        text: match[0].trim(),
        bounds: { x: 0, y: 0, width: 150, height: 20 },
        confidence: 0.8,
        language: 'english',
        isClickable: this.isLikelyClickable(match[0])
      });
    }

    return textElements;
  }

  /**
   * Extract layout information from analysis
   */
  private extractLayoutFromAnalysis(aiAnalysis: any, analysisText: string, context?: FailureContext): LayoutAnalysis {
    const isHebrew = /hebrew|rtl|[\u0590-\u05FF]/i.test(analysisText) || context?.url?.includes('/he');

    return {
      direction: isHebrew ? 'rtl' : 'ltr',
      primaryLanguage: isHebrew ? 'hebrew' : 'english',
      regions: aiAnalysis.layout?.regions || [],
      navigationElements: aiAnalysis.layout?.navigationElements || [],
      contentElements: aiAnalysis.layout?.contentElements || []
    };
  }

  /**
   * Extract selectors from analysis
   */
  private extractSelectorsFromAnalysis(aiAnalysis: any, elements: DetectedElement[]): SelectorSuggestion[] {
    const selectors: SelectorSuggestion[] = [];

    if (aiAnalysis.selectors && Array.isArray(aiAnalysis.selectors)) {
      return aiAnalysis.selectors.map((s: any) => ({
        selector: s.selector || 'button',
        confidence: s.confidence || 0.7,
        type: s.type || 'css',
        reasoning: s.reasoning || 'AI suggested',
        fallbackSelectors: s.fallbackSelectors || []
      }));
    }

    // Generate selectors from detected elements
    for (const element of elements.slice(0, 5)) {
      if (element.text) {
        selectors.push({
          selector: `${element.type}:has-text("${element.text}")`,
          confidence: element.confidence,
          type: 'css',
          reasoning: `Element detected with text: ${element.text}`,
          fallbackSelectors: [
            `text="${element.text}"`,
            `${element.type}[title*="${element.text}"]`
          ]
        });
      }
    }

    return selectors;
  }

  /**
   * Detect language from analysis
   */
  private detectLanguageFromAnalysis(textElements: ExtractedText[], context?: FailureContext): 'hebrew' | 'english' | 'mixed' {
    const hebrewCount = textElements.filter(t => t.language === 'hebrew').length;
    const englishCount = textElements.filter(t => t.language === 'english').length;

    if (hebrewCount > 0 && englishCount > 0) return 'mixed';
    if (hebrewCount > englishCount) return 'hebrew';
    return 'english';
  }

  /**
   * Calculate overall analysis confidence
   */
  private calculateAnalysisConfidence(elements: DetectedElement[], text: ExtractedText[], aiAnalysis: any): number {
    const elementConfidence = elements.length > 0 ?
      elements.reduce((sum, el) => sum + el.confidence, 0) / elements.length : 0;

    const textConfidence = text.length > 0 ?
      text.reduce((sum, t) => sum + t.confidence, 0) / text.length : 0;

    const aiConfidence = aiAnalysis.confidence || 0.7;

    return Math.min((elementConfidence + textConfidence + aiConfidence) / 3, 1.0);
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