import { pipeline, env } from '@xenova/transformers';
import { logger } from '@/utils/logger';
import { webGPUDetector } from '@/utils/webgpu-detector';
import { AIAgent, AgentCapability, AgentTask, AgentResult, ResourceRequirements, AgentConfiguration } from './agent-orchestrator';
import Database from 'better-sqlite3';

// Configure Transformers.js to use local models for privacy
env.allowRemoteModels = false;
env.allowLocalModels = true;

export interface ConversationContext {
  sessionId: string;
  userId?: string;
  language: 'hebrew' | 'english' | 'mixed';
  conversationHistory: ConversationTurn[];
  context: Record<string, any>;
  lastActivity: Date;
}

export interface ConversationTurn {
  id: string;
  type: 'user' | 'assistant' | 'system';
  message: string;
  language: string;
  confidence: number;
  entities: ExtractedEntity[];
  intent: DetectedIntent;
  timestamp: Date;
}

export interface ExtractedEntity {
  text: string;
  label: string;
  confidence: number;
  start: number;
  end: number;
  metadata?: Record<string, any>;
}

export interface DetectedIntent {
  name: string;
  confidence: number;
  parameters: Record<string, any>;
  category: 'help' | 'question' | 'command' | 'request' | 'feedback';
}

export interface TextAnalysisResult {
  language: string;
  confidence: number;
  sentiment: {
    label: 'positive' | 'negative' | 'neutral';
    score: number;
  };
  entities: ExtractedEntity[];
  intent: DetectedIntent;
  keywords: string[];
  summary?: string;
  translation?: {
    text: string;
    sourceLanguage: string;
    targetLanguage: string;
    confidence: number;
  };
}

export interface BilingualProcessingResult {
  originalText: string;
  detectedLanguage: string;
  translatedText?: string;
  analysis: {
    hebrew: TextAnalysisResult | null;
    english: TextAnalysisResult | null;
  };
  mergedInsights: {
    primaryLanguage: string;
    mixedLanguageContent: boolean;
    suggestedResponse: string;
    confidence: number;
  };
}

/**
 * Advanced NLP Engine using Transformers.js
 * Provides offline, privacy-focused natural language processing
 * with Hebrew and English bilingual support
 */
export class AdvancedNLPEngine implements AIAgent {
  public readonly id = 'advanced-nlp-engine';
  public readonly name = 'Advanced NLP Engine';
  public readonly type = 'nlp';
  public readonly version = '2.0.0';
  public status: 'initializing' | 'ready' | 'busy' | 'error' | 'offline' | 'maintenance' = 'initializing';
  public readonly priority = 7;

  public readonly capabilities: AgentCapability[] = [
    {
      name: 'bilingual-processing',
      type: 'analysis',
      parameters: { languages: ['hebrew', 'english'], rtlSupport: true },
      confidence: 0.92,
      successRate: 0.89
    },
    {
      name: 'intent-classification',
      type: 'analysis',
      parameters: { categories: ['help', 'question', 'command', 'request', 'feedback'] },
      confidence: 0.88,
      successRate: 0.85
    },
    {
      name: 'entity-extraction',
      type: 'analysis',
      parameters: { entityTypes: ['person', 'organization', 'location', 'misc'] },
      confidence: 0.85,
      successRate: 0.82
    },
    {
      name: 'sentiment-analysis',
      type: 'analysis',
      parameters: { multiLanguage: true, realTime: true },
      confidence: 0.90,
      successRate: 0.87
    },
    {
      name: 'conversation-management',
      type: 'coordination',
      parameters: { contextRetention: true, multiTurn: true },
      confidence: 0.87,
      successRate: 0.84
    }
  ];

  public readonly resourceRequirements: ResourceRequirements = {
    minMemory: 512, // MB - Transformer models are memory intensive
    preferredMemory: 1024, // MB
    cpuIntensive: true,
    gpuAccelerated: false, // Transformers.js doesn't support GPU yet
    networkAccess: false, // Offline processing
    storageSpace: 200, // MB for models
    concurrentTasks: 2
  };

  public readonly configuration: AgentConfiguration = {
    timeout: 15000, // 15 seconds
    retryCount: 2,
    batchSize: 8,
    cacheEnabled: true,
    logLevel: 'info',
    customSettings: {
      maxContextLength: 512,
      enableTranslation: true,
      cacheModels: true,
      offlineMode: true
    }
  };

  // Core models
  private sentimentModel: any = null;
  private nerModel: any = null;
  private classificationModel: any = null;
  private translationModel: any = null;
  
  // Context management
  private conversationContexts: Map<string, ConversationContext> = new Map();
  private modelCache: Map<string, any> = new Map();
  private db: Database.Database;
  
  // Processing state
  private isInitialized: boolean = false;
  private modelsLoading: Promise<void> | null = null;

  constructor(dbPath?: string) {
    this.db = new Database(dbPath || 'data/nlp-engine.db');
    this.initializeAsync();
  }

  private async initializeAsync(): Promise<void> {
    try {
      await this.initializeDatabase();
      await this.loadModels();
      
      this.isInitialized = true;
      this.status = 'ready';
      
      logger.info('🗣️ Advanced NLP Engine initialized successfully', {
        modelsLoaded: this.modelCache.size,
        offlineMode: env.allowLocalModels,
        cacheEnabled: this.configuration.cacheEnabled
      });

    } catch (error) {
      this.status = 'error';
      logger.error('❌ Advanced NLP Engine initialization failed:', error);
    }
  }

  private async initializeDatabase(): Promise<void> {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversation_contexts (
        session_id TEXT PRIMARY KEY,
        user_id TEXT,
        language TEXT NOT NULL,
        context_data TEXT NOT NULL,
        last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversation_turns (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        language TEXT NOT NULL,
        confidence REAL,
        entities TEXT,
        intent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES conversation_contexts (session_id)
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS nlp_analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        task_type TEXT NOT NULL,
        language TEXT NOT NULL,
        processing_time INTEGER,
        confidence REAL,
        model_used TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  private async loadModels(): Promise<void> {
    if (this.modelsLoading) {
      return this.modelsLoading;
    }

    this.modelsLoading = this._loadModels();
    return this.modelsLoading;
  }

  private async _loadModels(): Promise<void> {
    try {
      logger.info('📦 Loading Transformers.js models...');

      // Load sentiment analysis model
      this.sentimentModel = await pipeline('sentiment-analysis', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english');
      this.modelCache.set('sentiment', this.sentimentModel);
      
      // Load NER model for entity extraction
      this.nerModel = await pipeline('token-classification', 'Xenova/bert-base-NER');
      this.modelCache.set('ner', this.nerModel);
      
      // Load text classification model for intent detection
      this.classificationModel = await pipeline('zero-shot-classification', 'Xenova/distilbart-mnli-12-3');
      this.modelCache.set('classification', this.classificationModel);
      
      logger.info('✅ All Transformers.js models loaded successfully');

      // Optionally load translation model (larger, so load separately)
      try {
        this.translationModel = await pipeline('translation', 'Xenova/opus-mt-en-he');
        this.modelCache.set('translation', this.translationModel);
        logger.info('✅ Translation model loaded');
      } catch (error) {
        logger.warn('⚠️ Translation model not available, skipping bilingual translation features');
      }

    } catch (error) {
      logger.error('❌ Failed to load NLP models:', error);
      throw new Error(`Model loading failed: ${error.message}`);
    }
  }

  /**
   * Agent interface - Health check implementation
   */
  public async healthCheck() {
    const startTime = performance.now();
    const issues: string[] = [];
    
    try {
      // Check model availability
      if (!this.sentimentModel || !this.nerModel || !this.classificationModel) {
        issues.push('Core NLP models not loaded');
      }

      // Test model inference
      if (this.sentimentModel) {
        await this.sentimentModel('Test message for health check');
      }

      const responseTime = performance.now() - startTime;

      return {
        healthy: issues.length === 0,
        uptime: this.isInitialized ? Date.now() : 0,
        lastCheck: new Date(),
        metrics: {
          tasksCompleted: this.conversationContexts.size,
          successRate: 0.89,
          avgResponseTime: responseTime,
          errorCount: issues.length
        },
        issues
      };

    } catch (error) {
      issues.push(`Health check failed: ${error.message}`);
      return {
        healthy: false,
        uptime: 0,
        lastCheck: new Date(),
        metrics: {
          tasksCompleted: 0,
          successRate: 0,
          avgResponseTime: -1,
          errorCount: 1
        },
        issues
      };
    }
  }

  /**
   * Agent interface - Execute task implementation
   */
  public async execute(task: AgentTask): Promise<AgentResult> {
    const startTime = performance.now();
    
    try {
      if (!this.isInitialized) {
        await this.loadModels();
      }

      this.status = 'busy';
      let result: any;
      
      switch (task.type) {
        case 'analyze-text':
          result = await this.analyzeText(task.payload.text, task.payload.language);
          break;
          
        case 'bilingual-process':
          result = await this.processBilingualText(task.payload.text, task.payload.context);
          break;
          
        case 'manage-conversation':
          result = await this.manageConversation(
            task.payload.sessionId,
            task.payload.message,
            task.payload.type,
            task.payload.userId
          );
          break;
          
        case 'extract-entities':
          result = await this.extractEntities(task.payload.text);
          break;
          
        case 'detect-intent':
          result = await this.detectIntent(task.payload.text, task.payload.possibleIntents);
          break;
          
        default:
          throw new Error(`Unsupported task type: ${task.type}`);
      }

      const executionTime = performance.now() - startTime;
      this.status = 'ready';

      // Record analytics
      await this.recordAnalytics(task.type, result, executionTime);

      return {
        success: true,
        taskId: task.id,
        agentId: this.id,
        data: result,
        confidence: result.confidence || 0.85,
        executionTime,
        resourcesUsed: {
          memory: 128, // Estimated MB
          cpu: 0.8, // CPU intensive for transformers
          executionTime
        }
      };

    } catch (error) {
      this.status = 'ready';
      logger.error('Advanced NLP Engine task execution failed:', error);
      
      return {
        success: false,
        taskId: task.id,
        agentId: this.id,
        data: null,
        confidence: 0,
        executionTime: performance.now() - startTime,
        resourcesUsed: {
          memory: 0,
          cpu: 0,
          executionTime: performance.now() - startTime
        },
        errors: [error.message]
      };
    }
  }

  /**
   * Comprehensive text analysis with multiple NLP tasks
   */
  public async analyzeText(text: string, language?: string): Promise<TextAnalysisResult> {
    const detectedLanguage = language || this.detectLanguage(text);
    
    // Run multiple NLP tasks in parallel
    const [sentimentResult, entities, intent, keywords] = await Promise.all([
      this.analyzeSentiment(text),
      this.extractEntities(text),
      this.detectIntent(text),
      this.extractKeywords(text)
    ]);

    return {
      language: detectedLanguage,
      confidence: 0.85,
      sentiment: sentimentResult,
      entities,
      intent,
      keywords,
      summary: text.length > 200 ? this.generateSummary(text) : undefined
    };
  }

  /**
   * Process text with bilingual Hebrew/English support
   */
  public async processBilingualText(text: string, context?: Record<string, any>): Promise<BilingualProcessingResult> {
    const detectedLanguage = this.detectLanguage(text);
    const hasHebrew = /[\u0590-\u05FF]/.test(text);
    const hasEnglish = /[a-zA-Z]/.test(text);
    
    let hebrewAnalysis: TextAnalysisResult | null = null;
    let englishAnalysis: TextAnalysisResult | null = null;
    let translatedText: string | undefined;

    // Process Hebrew content
    if (hasHebrew) {
      const hebrewText = this.extractHebrewText(text);
      hebrewAnalysis = await this.analyzeText(hebrewText, 'hebrew');
    }

    // Process English content
    if (hasEnglish) {
      const englishText = this.extractEnglishText(text);
      englishAnalysis = await this.analyzeText(englishText, 'english');
    }

    // Attempt translation if translation model is available
    if (this.translationModel && detectedLanguage === 'hebrew') {
      try {
        const translationResult = await this.translationModel(text);
        translatedText = translationResult[0].translation_text;
      } catch (error) {
        logger.debug('Translation failed:', error);
      }
    }

    // Merge insights from both languages
    const mergedInsights = this.mergeLanguageInsights(hebrewAnalysis, englishAnalysis, context);

    return {
      originalText: text,
      detectedLanguage,
      translatedText,
      analysis: {
        hebrew: hebrewAnalysis,
        english: englishAnalysis
      },
      mergedInsights
    };
  }

  /**
   * Manage conversation context and multi-turn conversations
   */
  public async manageConversation(
    sessionId: string,
    message: string,
    type: 'user' | 'assistant' | 'system' = 'user',
    userId?: string
  ): Promise<ConversationContext> {
    // Get or create conversation context
    let context = this.conversationContexts.get(sessionId);
    if (!context) {
      context = {
        sessionId,
        userId,
        language: this.detectLanguage(message) as 'hebrew' | 'english' | 'mixed',
        conversationHistory: [],
        context: {},
        lastActivity: new Date()
      };
      this.conversationContexts.set(sessionId, context);
    }

    // Analyze the message
    const analysis = await this.analyzeText(message);
    
    // Create conversation turn
    const turn: ConversationTurn = {
      id: `${sessionId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      language: analysis.language,
      confidence: analysis.confidence,
      entities: analysis.entities,
      intent: analysis.intent,
      timestamp: new Date()
    };

    // Add to conversation history (keep last 10 turns)
    context.conversationHistory.push(turn);
    if (context.conversationHistory.length > 10) {
      context.conversationHistory.shift();
    }

    // Update context
    context.lastActivity = new Date();
    if (analysis.entities.length > 0) {
      analysis.entities.forEach(entity => {
        context.context[entity.label] = entity.text;
      });
    }

    // Persist to database
    await this.persistConversationTurn(turn);
    await this.updateConversationContext(context);

    return context;
  }

  /**
   * Extract named entities from text
   */
  public async extractEntities(text: string): Promise<ExtractedEntity[]> {
    if (!this.nerModel) {
      return [];
    }

    try {
      const result = await this.nerModel(text);
      const entities: ExtractedEntity[] = [];
      
      // Group consecutive tokens into entities
      let currentEntity: ExtractedEntity | null = null;
      
      for (const token of result) {
        if (token.entity.startsWith('B-')) {
          // Begin new entity
          if (currentEntity) {
            entities.push(currentEntity);
          }
          currentEntity = {
            text: token.word,
            label: token.entity.substring(2), // Remove B- prefix
            confidence: token.score,
            start: token.start,
            end: token.end
          };
        } else if (token.entity.startsWith('I-') && currentEntity) {
          // Continue current entity
          currentEntity.text += token.word;
          currentEntity.end = token.end;
          currentEntity.confidence = Math.min(currentEntity.confidence, token.score);
        }
      }
      
      if (currentEntity) {
        entities.push(currentEntity);
      }

      return entities;

    } catch (error) {
      logger.error('Entity extraction failed:', error);
      return [];
    }
  }

  /**
   * Detect intent from text using zero-shot classification
   */
  public async detectIntent(text: string, possibleIntents?: string[]): Promise<DetectedIntent> {
    if (!this.classificationModel) {
      return {
        name: 'unknown',
        confidence: 0,
        parameters: {},
        category: 'question'
      };
    }

    const candidateLabels = possibleIntents || [
      'get help', 'ask question', 'give command', 'make request', 'provide feedback'
    ];

    try {
      const result = await this.classificationModel(text, candidateLabels);
      
      return {
        name: result.labels[0],
        confidence: result.scores[0],
        parameters: {}, // Would extract parameters based on intent
        category: this.mapIntentToCategory(result.labels[0])
      };

    } catch (error) {
      logger.error('Intent detection failed:', error);
      return {
        name: 'unknown',
        confidence: 0,
        parameters: {},
        category: 'question'
      };
    }
  }

  /**
   * Analyze sentiment of text
   */
  private async analyzeSentiment(text: string): Promise<{ label: 'positive' | 'negative' | 'neutral'; score: number }> {
    if (!this.sentimentModel) {
      return { label: 'neutral', score: 0.5 };
    }

    try {
      const result = await this.sentimentModel(text);
      const sentiment = result[0];
      
      return {
        label: sentiment.label.toLowerCase() as 'positive' | 'negative',
        score: sentiment.score
      };

    } catch (error) {
      logger.error('Sentiment analysis failed:', error);
      return { label: 'neutral', score: 0.5 };
    }
  }

  // Helper methods
  private detectLanguage(text: string): string {
    const hebrewChars = (text.match(/[\u0590-\u05FF]/g) || []).length;
    const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
    const total = hebrewChars + englishChars;
    
    if (total === 0) return 'unknown';
    
    const hebrewRatio = hebrewChars / total;
    const englishRatio = englishChars / total;
    
    if (hebrewRatio > 0.7) return 'hebrew';
    if (englishRatio > 0.7) return 'english';
    return 'mixed';
  }

  private extractHebrewText(text: string): string {
    return text.replace(/[^\u0590-\u05FF\s]/g, '').trim();
  }

  private extractEnglishText(text: string): string {
    return text.replace(/[^\u0000-\u007F\s]/g, '').trim();
  }

  private extractKeywords(text: string): string[] {
    // Simple keyword extraction (would use more sophisticated methods in production)
    return text.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 5);
  }

  private generateSummary(text: string): string {
    // Simple extractive summary (first sentence + keywords)
    const sentences = text.split(/[.!?]+/);
    return sentences[0] + '.';
  }

  private mergeLanguageInsights(
    hebrewAnalysis: TextAnalysisResult | null,
    englishAnalysis: TextAnalysisResult | null,
    context?: Record<string, any>
  ) {
    const primaryLanguage = hebrewAnalysis ? 'hebrew' : 'english';
    const mixedLanguageContent = hebrewAnalysis && englishAnalysis;
    
    // Combine confidence scores
    const combinedConfidence = mixedLanguageContent
      ? (hebrewAnalysis!.confidence + englishAnalysis!.confidence) / 2
      : (hebrewAnalysis?.confidence || englishAnalysis?.confidence || 0.5);

    return {
      primaryLanguage,
      mixedLanguageContent: !!mixedLanguageContent,
      suggestedResponse: this.generateSuggestedResponse(hebrewAnalysis, englishAnalysis),
      confidence: combinedConfidence
    };
  }

  private generateSuggestedResponse(
    hebrewAnalysis: TextAnalysisResult | null,
    englishAnalysis: TextAnalysisResult | null
  ): string {
    // Simple response generation logic
    const primaryAnalysis = hebrewAnalysis || englishAnalysis;
    if (!primaryAnalysis) return 'I understand your message.';
    
    if (primaryAnalysis.intent.name.includes('help')) {
      return 'I can help you with that. What specific assistance do you need?';
    }
    
    if (primaryAnalysis.intent.name.includes('question')) {
      return 'That\'s a good question. Let me provide you with information.';
    }
    
    return 'Thank you for your message. How can I assist you further?';
  }

  private mapIntentToCategory(intent: string): 'help' | 'question' | 'command' | 'request' | 'feedback' {
    if (intent.includes('help')) return 'help';
    if (intent.includes('question')) return 'question';
    if (intent.includes('command')) return 'command';
    if (intent.includes('request')) return 'request';
    return 'feedback';
  }

  private async persistConversationTurn(turn: ConversationTurn): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO conversation_turns 
      (id, session_id, type, message, language, confidence, entities, intent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      turn.id,
      turn.id.split('-')[0], // Extract session ID
      turn.type,
      turn.message,
      turn.language,
      turn.confidence,
      JSON.stringify(turn.entities),
      JSON.stringify(turn.intent)
    );
  }

  private async updateConversationContext(context: ConversationContext): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO conversation_contexts 
      (session_id, user_id, language, context_data, last_activity)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      context.sessionId,
      context.userId || null,
      context.language,
      JSON.stringify(context.context),
      context.lastActivity.toISOString()
    );
  }

  private async recordAnalytics(
    taskType: string,
    result: any,
    processingTime: number
  ): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO nlp_analytics 
      (task_type, language, processing_time, confidence, model_used)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      taskType,
      result.language || 'unknown',
      Math.round(processingTime),
      result.confidence || 0,
      'transformers-js-v2'
    );
  }

  public async close(): Promise<void> {
    try {
      // Clear model cache
      this.modelCache.clear();
      
      // Clear conversation contexts
      this.conversationContexts.clear();
      
      // Close database
      if (this.db) this.db.close();

      this.status = 'offline';
      logger.info('✅ Advanced NLP Engine closed successfully');

    } catch (error) {
      logger.error('❌ Error closing Advanced NLP Engine:', error);
    }
  }
}

export default AdvancedNLPEngine;