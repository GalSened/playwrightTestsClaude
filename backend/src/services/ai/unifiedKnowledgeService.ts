import { logger } from '@/utils/logger';
import { AdvancedLanguageProcessor, LanguageDetectionResult } from './advancedLanguageProcessor';
import { searchVectors, VectorSearchResult } from './vectorStore';
import Database from 'better-sqlite3';
import { ChatOpenAI } from '@langchain/openai';
import { join } from 'path';
import WeSignCodebaseAnalyzer, { WeSignCodeStructure } from './wesignCodebaseAnalyzer';

export interface KnowledgeSource {
  id: string;
  content: string;
  type: string;
  source: string;
  metadata: any;
  score: number;
}

export interface UnifiedResponse {
  answer: string;
  confidence: number;
  sources: KnowledgeSource[];
  executionTime: number;
  language: 'hebrew' | 'english' | 'mixed';
  recommendations: string[];
  followUpQuestions: string[];
  relatedTopics: string[];
  processingDetails: {
    vectorResults: number;
    databaseResults: number;
    staticResults: number;
    codebaseResults: number;
    languageDetection: LanguageDetectionResult;
  };
}

/**
 * Unified Knowledge Service that connects ALL data sources
 * - 7,697+ knowledge chunks from database
 * - Vector search results
 * - Static WeSign knowledge
 * - Real-time context understanding
 */
export class UnifiedKnowledgeService {
  private languageProcessor: AdvancedLanguageProcessor;
  private knowledgeDB: Database.Database;
  private llm: ChatOpenAI;
  private responseCache: Map<string, { response: UnifiedResponse; timestamp: number }> = new Map();
  private codebaseAnalyzer: WeSignCodebaseAnalyzer;
  private codeStructure: WeSignCodeStructure | null = null;

  // Enhanced WeSign knowledge with proper Hebrew support
  private staticKnowledge = [
    {
      id: 'contact_management_he',
      topics: ['contacts', 'add contact', 'איש קשר', 'הוספת איש קשר'],
      keywords: ['contact', 'add', 'create', 'new', 'איש', 'קשר', 'הוסף', 'הוספה', 'יצירת', 'חדש'],
      responses: {
        hebrew: `להוספת איש קשר חדש ב-WeSign:

1. **התחבר לחשבון WeSign שלך**
2. **לחץ על "אנשי קשר" בתפריט הראשי**
3. **לחץ על כפתור "הוסף איש קשר" (+)**
4. **מלא את הפרטים הנדרשים:**
   - שם מלא
   - כתובת אימייל
   - מספר טלפון (אופציונלי)
   - ארגון (אופציונלי)
5. **לחץ על "שמור"**

לאחר השלמת השלבים, איש הקשר יתווסף לרשימה ויוכל לקבל מסמכים לחתימה.`,
        english: `To add a new contact in WeSign:

1. **Log into your WeSign account**
2. **Click on "Contacts" in the main menu**
3. **Click the "Add Contact" button (+)**
4. **Fill in the required information:**
   - Full name
   - Email address
   - Phone number (optional)
   - Organization (optional)
5. **Click "Save"**

Once completed, the contact will be added to your list and can receive documents for signing.`
      },
      confidence: 0.95
    },
    {
      id: 'document_signing_workflow',
      topics: ['document', 'signing', 'workflow', 'מסמך', 'חתימה', 'תהליך'],
      keywords: ['document', 'sign', 'workflow', 'process', 'מסמך', 'חתום', 'תהליך', 'זרימה'],
      responses: {
        hebrew: `תהליך חתימה על מסמכים ב-WeSign:

1. **העלאת המסמך:**
   - לחץ על "מסמכים חדשים"
   - גרור קובץ או לחץ "העלה קובץ"
   - תמך ב-PDF, Word, Excel ועוד

2. **הגדרת שדות חתימה:**
   - לחץ על "הוסף שדה"
   - גרור שדות לעמדות הנדרשות
   - סוגי שדות: חתימה, תאריך, טקסט, תיבת סימון

3. **הוספת חותמים:**
   - לחץ "הוסף חותם"
   - בחר מרשימת אנשי הקשר או הוסף חדש
   - קבע סדר חתימה

4. **שליחה לחתימה:**
   - סקור את ההגדרות
   - לחץ "שלח לחתימה"
   - החותמים יקבלו הודעת אימייל`,
        english: `Document signing workflow in WeSign:

1. **Upload Document:**
   - Click "New Documents"
   - Drag file or click "Upload File"
   - Supports PDF, Word, Excel and more

2. **Set Signature Fields:**
   - Click "Add Field"
   - Drag fields to required positions
   - Field types: Signature, Date, Text, Checkbox

3. **Add Signers:**
   - Click "Add Signer"
   - Select from contacts or add new
   - Set signing order

4. **Send for Signature:**
   - Review settings
   - Click "Send for Signature"
   - Signers receive email notification`
      },
      confidence: 0.93
    },
    {
      id: 'template_management',
      topics: ['template', 'templates', 'reuse', 'תבנית', 'תבניות', 'שימוש חוזר'],
      keywords: ['template', 'reuse', 'save', 'תבנית', 'שימוש', 'חוזר', 'שמור'],
      responses: {
        hebrew: `ניהול תבניות ב-WeSign:

1. **יצירת תבנית:**
   - העלה מסמך והגדר שדות
   - לחץ "שמור כתבנית"
   - תן שם לתבנית והוסף תיאור

2. **שימוש בתבנית:**
   - לחץ "תבניות"
   - בחר תבנית מהרשימה
   - לחץ "השתמש בתבנית"

3. **עריכת תבנית:**
   - פתח תבנית קיימת
   - ערוך שדות ופריסה
   - שמור שינויים

4. **ניהול תבניות:**
   - ארגן בקטגוריות
   - שתף עם צוות
   - קבע הרשאות גישה`,
        english: `Template management in WeSign:

1. **Create Template:**
   - Upload document and set fields
   - Click "Save as Template"
   - Name template and add description

2. **Use Template:**
   - Click "Templates"
   - Select template from list
   - Click "Use Template"

3. **Edit Template:**
   - Open existing template
   - Edit fields and layout
   - Save changes

4. **Manage Templates:**
   - Organize in categories
   - Share with team
   - Set access permissions`
      },
      confidence: 0.91
    }
  ];

  private readonly CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
  private readonly MAX_CACHE_SIZE = 1000;

  constructor() {
    this.languageProcessor = new AdvancedLanguageProcessor();

    // Initialize codebase analyzer
    this.codebaseAnalyzer = new WeSignCodebaseAnalyzer();

    // Initialize database connection
    this.knowledgeDB = new Database(join(process.cwd(), 'data/scheduler.db'));

    // Initialize LLM
    this.llm = new ChatOpenAI({
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 1000,
      timeout: 30000
    });

    logger.info('Unified Knowledge Service initialized', {
      staticKnowledge: this.staticKnowledge.length,
      databaseConnected: !!this.knowledgeDB,
      llmConfigured: !!this.llm
    });

    // Initialize codebase analysis in background
    this.initializeCodebaseKnowledge();
  }

  /**
   * Initialize WeSign codebase knowledge
   */
  private async initializeCodebaseKnowledge(): Promise<void> {
    try {
      logger.info('Initializing WeSign codebase knowledge analysis');
      this.codeStructure = await this.codebaseAnalyzer.analyzeFullCodebase();

      logger.info('WeSign codebase knowledge initialized successfully', {
        features: this.codeStructure.features.length,
        workflows: this.codeStructure.workflows.length,
        apiEndpoints: this.codeStructure.apiEndpoints.length,
        frontendComponents: this.codeStructure.frontend.components.length,
        backendControllers: this.codeStructure.backend.controllers.length
      });
    } catch (error) {
      logger.warn('Failed to initialize codebase knowledge, using fallback:', error);
      // Continue without codebase knowledge - system still functional
    }
  }

  /**
   * Main query processing with unified knowledge search
   */
  async processQuery(query: string, context?: any): Promise<UnifiedResponse> {
    const startTime = Date.now();
    const cacheKey = this.createCacheKey(query, context);

    // Check cache first
    if (this.responseCache.has(cacheKey)) {
      const cached = this.responseCache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
        return cached.response;
      }
      this.responseCache.delete(cacheKey);
    }

    try {
      // Advanced language detection
      const languageDetection = this.languageProcessor.detectLanguage(query);

      logger.info('Processing unified query', {
        query: query.substring(0, 100),
        detectedLanguage: languageDetection.language,
        confidence: languageDetection.confidence
      });

      // Search all knowledge sources in parallel
      const [vectorResults, databaseResults, staticResults, codebaseResults] = await Promise.all([
        this.searchVectorKnowledge(query, languageDetection),
        this.searchDatabaseKnowledge(query, languageDetection),
        this.searchStaticKnowledge(query, languageDetection),
        this.searchCodebaseKnowledge(query, languageDetection)
      ]);

      // Combine and rank results
      const combinedSources = this.combineKnowledgeSources(vectorResults, databaseResults, staticResults, codebaseResults);

      // Generate unified response using LLM
      const response = await this.generateUnifiedResponse(
        query,
        languageDetection,
        combinedSources
      );

      const finalResponse: UnifiedResponse = {
        ...response,
        executionTime: Date.now() - startTime,
        processingDetails: {
          vectorResults: vectorResults.length,
          databaseResults: databaseResults.length,
          staticResults: staticResults.length,
          codebaseResults: codebaseResults.length,
          languageDetection
        }
      };

      // Cache the response
      this.cacheResponse(cacheKey, finalResponse);

      return finalResponse;

    } catch (error) {
      logger.error('Unified query processing failed:', error);
      return this.generateFallbackResponse(query, Date.now() - startTime);
    }
  }

  /**
   * Search vector knowledge store
   */
  private async searchVectorKnowledge(query: string, languageDetection: LanguageDetectionResult): Promise<KnowledgeSource[]> {
    try {
      const vectorResults = await searchVectors(query, 10, 0.7);

      return vectorResults.map(result => ({
        id: `vector_${result.id || 'unknown'}`,
        content: result.content || '',
        type: 'vector',
        source: 'vector_store',
        metadata: result.metadata || {},
        score: result.score || 0
      }));
    } catch (error) {
      logger.warn('Vector search failed:', error);
      return [];
    }
  }

  /**
   * Search database knowledge (7,697+ chunks)
   */
  private async searchDatabaseKnowledge(query: string, languageDetection: LanguageDetectionResult): Promise<KnowledgeSource[]> {
    try {
      // Enhanced database search with language awareness
      const searchTerms = this.extractSearchTerms(query, languageDetection.language);

      const results = this.knowledgeDB.prepare(`
        SELECT id, content, type, source, metadata,
               CASE
                 WHEN content LIKE ? THEN 10
                 WHEN content LIKE ? THEN 8
                 WHEN content LIKE ? THEN 6
                 WHEN content LIKE ? THEN 4
                 ELSE 2
               END as relevance_score
        FROM knowledge_base_enhanced
        WHERE content LIKE ? OR content LIKE ? OR content LIKE ? OR content LIKE ?
        ORDER BY relevance_score DESC, created_at DESC
        LIMIT 15
      `).all(
        `%${searchTerms.primary}%`,
        `%${searchTerms.secondary}%`,
        `%${searchTerms.tertiary}%`,
        `%${searchTerms.fallback}%`,
        `%${searchTerms.primary}%`,
        `%${searchTerms.secondary}%`,
        `%${searchTerms.tertiary}%`,
        `%${searchTerms.fallback}%`
      );

      return results.map((result: any) => ({
        id: result.id,
        content: result.content,
        type: result.type,
        source: result.source,
        metadata: JSON.parse(result.metadata || '{}'),
        score: result.relevance_score / 10
      }));
    } catch (error) {
      logger.warn('Database search failed:', error);
      return [];
    }
  }

  /**
   * Search static knowledge with improved matching
   */
  private searchStaticKnowledge(query: string, languageDetection: LanguageDetectionResult): Promise<KnowledgeSource[]> {
    const results: KnowledgeSource[] = [];
    const queryLower = query.toLowerCase();

    for (const knowledge of this.staticKnowledge) {
      let score = 0;

      // Check keywords
      for (const keyword of knowledge.keywords) {
        if (queryLower.includes(keyword.toLowerCase())) {
          score += 0.3;
        }
      }

      // Check topics
      for (const topic of knowledge.topics) {
        if (queryLower.includes(topic.toLowerCase())) {
          score += 0.4;
        }
      }

      if (score > 0.2) {
        const response = languageDetection.language === 'hebrew'
          ? knowledge.responses.hebrew
          : knowledge.responses.english;

        results.push({
          id: knowledge.id,
          content: response,
          type: 'static',
          source: 'static_knowledge',
          metadata: {
            topics: knowledge.topics,
            originalScore: knowledge.confidence
          },
          score: Math.min(score, 0.95)
        });
      }
    }

    return Promise.resolve(results.sort((a, b) => b.score - a.score));
  }

  /**
   * Extract intelligent search terms based on language
   */
  private extractSearchTerms(query: string, language: 'hebrew' | 'english' | 'mixed'): {
    primary: string;
    secondary: string;
    tertiary: string;
    fallback: string;
  } {
    const words = query.split(/\s+/).filter(w => w.length > 2);

    // Language-specific term mapping
    const termMappings = {
      'איך': ['how', 'איך'],
      'מה': ['what', 'מה'],
      'קשר': ['contact', 'קשר'],
      'מסמך': ['document', 'מסמך'],
      'תבנית': ['template', 'תבנית'],
      'חתימה': ['signature', 'חתימה'],
      'הוסף': ['add', 'הוסף'],
      'ערוך': ['edit', 'ערוך'],
      'מחק': ['delete', 'מחק']
    };

    const primary = words[0] || query;
    const secondary = words.length > 1 ? words.slice(0, 2).join(' ') : primary;
    const tertiary = words.length > 2 ? words.slice(0, 3).join(' ') : secondary;
    const fallback = query.substring(0, 50);

    return { primary, secondary, tertiary, fallback };
  }

  /**
   * Combine knowledge sources with intelligent ranking
   */
  private combineKnowledgeSources(
    vectorResults: KnowledgeSource[],
    databaseResults: KnowledgeSource[],
    staticResults: KnowledgeSource[],
    codebaseResults: KnowledgeSource[] = []
  ): KnowledgeSource[] {
    const combined = [...vectorResults, ...databaseResults, ...staticResults, ...codebaseResults];

    // Remove duplicates and rank by score
    const unique = combined.filter((source, index, self) =>
      index === self.findIndex(s => s.id === source.id)
    );

    // Enhanced scoring with source type weights
    const weighted = unique.map(source => ({
      ...source,
      score: source.score * this.getSourceWeight(source.type)
    }));

    return weighted
      .sort((a, b) => b.score - a.score)
      .slice(0, 8); // Top 8 sources for context
  }

  private getSourceWeight(sourceType: string): number {
    const weights = {
      'static': 1.2,     // Static knowledge is curated and reliable
      'vector': 1.0,     // Vector search is contextually relevant
      'api': 0.9,        // API documentation is technical but valuable
      'text': 0.8,       // General text content
      'json-value': 0.7, // Configuration values
      'markdown': 0.8,   // Documentation
      'code-full': 0.6   // Code content
    };

    return weights[sourceType] || 0.7;
  }

  /**
   * Generate unified response using LLM with context
   */
  private async generateUnifiedResponse(
    query: string,
    languageDetection: LanguageDetectionResult,
    sources: KnowledgeSource[]
  ): Promise<Omit<UnifiedResponse, 'executionTime' | 'processingDetails'>> {
    const language = languageDetection.language;
    const isHebrew = language === 'hebrew' || (language === 'mixed' && languageDetection.confidence > 0.6);

    // Build context from sources
    const context = sources.map(source =>
      `[${source.type}] ${source.content.substring(0, 500)}`
    ).join('\n\n');

    const systemPrompt = isHebrew ? `
אתה מומחה WeSign המתמחה בפלטפורמת החתימות הדיגיטליות.
מטרתך לספק הדרכה מדויקת ומעשית למשתמשים בעברית.

הנחיות:
- תן תשובות ברורות ומפורטות בעברית
- כלול שלבים ממוספרים כשמתאים
- התייחס ספציפית לתכונות WeSign
- הוסף המלצות מעשיות
- שמור על טון מקצועי וידידותי
` : `
You are a WeSign expert specializing in the digital signature platform.
Your goal is to provide accurate and practical guidance to users.

Guidelines:
- Provide clear and detailed answers in English
- Include numbered steps when appropriate
- Reference specific WeSign features
- Add practical recommendations
- Maintain a professional and friendly tone
`;

    const userPrompt = isHebrew ? `
שאלת המשתמש: ${query}

מידע רלוונטי מבסיס הידע:
${context}

אנא תן תשובה מקיפה ומועילה בעברית שעונה על השאלה בצורה מדויקת.
` : `
User question: ${query}

Relevant information from knowledge base:
${context}

Please provide a comprehensive and helpful answer in English that accurately addresses the question.
`;

    try {
      const response = await this.llm.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]);

      const answer = response.content as string;

      return {
        answer,
        confidence: Math.min(0.95, 0.7 + (sources.length * 0.05)),
        sources,
        language,
        recommendations: this.generateRecommendations(query, language, sources),
        followUpQuestions: this.generateFollowUpQuestions(query, language),
        relatedTopics: this.extractRelatedTopics(sources)
      };

    } catch (error) {
      logger.error('LLM response generation failed:', error);

      // Fallback to best matching static response
      const bestSource = sources.find(s => s.type === 'static');
      if (bestSource) {
        return {
          answer: bestSource.content,
          confidence: bestSource.score,
          sources: [bestSource],
          language,
          recommendations: [],
          followUpQuestions: [],
          relatedTopics: []
        };
      }

      throw error;
    }
  }

  private generateRecommendations(query: string, language: 'hebrew' | 'english' | 'mixed', sources: KnowledgeSource[]): string[] {
    const isHebrew = language === 'hebrew';

    const baseRecommendations = isHebrew ? [
      'בדוק שהפרטים נכונים לפני השמירה',
      'שמור עותק של המסמך החתום',
      'ודא שהאימייל של החותמים נכון'
    ] : [
      'Double-check information before saving',
      'Keep a copy of signed documents',
      'Verify signer email addresses are correct'
    ];

    return baseRecommendations.slice(0, 3);
  }

  private generateFollowUpQuestions(query: string, language: 'hebrew' | 'english' | 'mixed'): string[] {
    const isHebrew = language === 'hebrew';

    if (query.toLowerCase().includes('contact') || query.includes('קשר')) {
      return isHebrew ? [
        'איך אני יכול לערוך איש קשר קיים?',
        'האם יש הגבלה על מספר אנשי הקשר?',
        'איך אני מייבא אנשי קשר מקובץ?'
      ] : [
        'How can I edit an existing contact?',
        'Is there a limit on the number of contacts?',
        'How do I import contacts from a file?'
      ];
    }

    return isHebrew ? [
      'איך אני יכול לקבל עזרה נוספת?',
      'איפה אני מוצא את ההגדרות?'
    ] : [
      'How can I get additional help?',
      'Where do I find the settings?'
    ];
  }

  private extractRelatedTopics(sources: KnowledgeSource[]): string[] {
    const topics = new Set<string>();

    sources.forEach(source => {
      if (source.metadata?.topics) {
        source.metadata.topics.forEach((topic: string) => topics.add(topic));
      }
    });

    return Array.from(topics).slice(0, 5);
  }

  private generateFallbackResponse(query: string, executionTime: number): UnifiedResponse {
    return {
      answer: 'I apologize, but I encountered an issue processing your request. Please try rephrasing your question or contact support for assistance.',
      confidence: 0.1,
      sources: [],
      executionTime,
      language: 'english',
      recommendations: [],
      followUpQuestions: [],
      relatedTopics: [],
      processingDetails: {
        vectorResults: 0,
        databaseResults: 0,
        staticResults: 0,
        codebaseResults: 0,
        languageDetection: {
          language: 'english',
          confidence: 0.5,
          patterns: { hebrew: 0, english: 0.5, mixed: 0 },
          details: {
            hebrewChars: 0,
            englishChars: 0,
            totalChars: 0,
            hebrewWords: 0,
            englishWords: 0,
            mixedPatterns: 0
          }
        }
      }
    };
  }

  private createCacheKey(query: string, context?: any): string {
    const contextStr = context ? JSON.stringify(context) : '';
    return `${query.toLowerCase().trim()}_${contextStr}`.substring(0, 100);
  }

  private cacheResponse(key: string, response: UnifiedResponse): void {
    // LRU cache management
    if (this.responseCache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.responseCache.keys().next().value;
      this.responseCache.delete(firstKey);
    }

    this.responseCache.set(key, {
      response,
      timestamp: Date.now()
    });
  }

  /**
   * Search WeSign codebase knowledge
   */
  private async searchCodebaseKnowledge(query: string, languageDetection: LanguageDetectionResult): Promise<KnowledgeSource[]> {
    if (!this.codeStructure) {
      return [];
    }

    const results: KnowledgeSource[] = [];
    const queryLower = query.toLowerCase();

    try {
      // Search features
      for (const feature of this.codeStructure.features) {
        let score = 0;

        // Check feature name match
        if (feature.name.toLowerCase().includes(queryLower)) {
          score += 0.8;
        }

        // Check Hebrew terms
        for (const hebrewTerm of feature.hebrewTerms) {
          if (query.includes(hebrewTerm)) {
            score += 0.9;
          }
        }

        // Check English terms
        for (const englishTerm of feature.englishTerms) {
          if (queryLower.includes(englishTerm.toLowerCase())) {
            score += 0.7;
          }
        }

        if (score > 0.3) {
          results.push({
            id: `feature_${feature.name}`,
            content: this.generateFeatureContent(feature),
            type: 'codebase_feature',
            source: 'WeSign Codebase',
            metadata: {
              feature: feature.name,
              components: feature.frontendComponents,
              controllers: feature.backendControllers,
              workflows: feature.workflows
            },
            score
          });
        }
      }

      // Search workflows
      for (const workflow of this.codeStructure.workflows) {
        let score = 0;

        if (workflow.name.toLowerCase().includes(queryLower)) {
          score += 0.8;
        }

        if (workflow.description.toLowerCase().includes(queryLower)) {
          score += 0.6;
        }

        if (score > 0.3) {
          results.push({
            id: `workflow_${workflow.name}`,
            content: this.generateWorkflowContent(workflow),
            type: 'codebase_workflow',
            source: 'WeSign Codebase',
            metadata: {
              workflow: workflow.name,
              steps: workflow.steps.length,
              userRoles: workflow.userRoles,
              businessRules: workflow.businessRules
            },
            score
          });
        }
      }

      // Search API endpoints
      for (const endpoint of this.codeStructure.apiEndpoints) {
        let score = 0;

        if (endpoint.path.toLowerCase().includes(queryLower)) {
          score += 0.7;
        }

        if (endpoint.description.toLowerCase().includes(queryLower)) {
          score += 0.5;
        }

        if (score > 0.3) {
          results.push({
            id: `api_${endpoint.controller}_${endpoint.action}`,
            content: this.generateApiContent(endpoint),
            type: 'codebase_api',
            source: 'WeSign Codebase',
            metadata: {
              controller: endpoint.controller,
              action: endpoint.action,
              method: endpoint.method,
              path: endpoint.path
            },
            score
          });
        }
      }

    } catch (error) {
      logger.warn('Error searching codebase knowledge:', error);
    }

    return results.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  /**
   * Generate feature content for AI responses
   */
  private generateFeatureContent(feature: any): string {
    return `**${feature.name}**

${feature.description}

**Frontend Components**: ${feature.frontendComponents.join(', ')}
**Backend Controllers**: ${feature.backendControllers.join(', ')}
**Key Workflows**: ${feature.workflows.join(', ')}

**Hebrew Terms**: ${feature.hebrewTerms.join(', ')}
**English Terms**: ${feature.englishTerms.join(', ')}`;
  }

  /**
   * Generate workflow content for AI responses
   */
  private generateWorkflowContent(workflow: any): string {
    const steps = workflow.steps.map((step: any, index: number) =>
      `${index + 1}. **${step.name}**: ${step.description} (${step.component})`
    ).join('\n');

    return `**${workflow.name}**

${workflow.description}

**Steps**:
${steps}

**User Roles**: ${workflow.userRoles.join(', ')}
**Business Rules**: ${workflow.businessRules.join(', ')}`;
  }

  /**
   * Generate API content for AI responses
   */
  private generateApiContent(endpoint: any): string {
    const params = endpoint.parameters.map((param: any) =>
      `- ${param.name} (${param.type})${param.required ? ' *required*' : ''}: ${param.description}`
    ).join('\n');

    return `**${endpoint.method} ${endpoint.path}**

${endpoint.description}

**Controller**: ${endpoint.controller}
**Action**: ${endpoint.action}
**Parameters**:
${params}

**Business Logic**: ${endpoint.businessLogic}`;
  }

  /**
   * Get service statistics
   */
  getStats() {
    const codebaseStats = this.codeStructure ? {
      features: this.codeStructure.features.length,
      workflows: this.codeStructure.workflows.length,
      apiEndpoints: this.codeStructure.apiEndpoints.length,
      frontendComponents: this.codeStructure.frontend.components.length,
      backendControllers: this.codeStructure.backend.controllers.length
    } : null;

    return {
      cacheSize: this.responseCache.size,
      staticKnowledge: this.staticKnowledge.length,
      databaseConnected: !!this.knowledgeDB,
      codebaseKnowledge: codebaseStats,
      lastUpdated: new Date().toISOString()
    };
  }
}

export default UnifiedKnowledgeService;