import { logger } from '@/utils/logger';
import VisualHealingAI from './visualHealingAI';
import EnhancedLangChainRAGService from './enhancedLangchainRAG';
// import MLPatternLearningService from './mlPatternLearning';
import { getSelfHealingService } from '@/services/selfHealingService';
import type { FailureContext } from '@/services/selfHealingService';

export interface ComprehensiveHealingResult {
  success: boolean;
  healedSelector?: string;
  confidence: number;
  strategy: string;
  executionTime: number;
  
  // Multi-modal analysis results
  visualAnalysis?: any;
  mlPrediction?: any;
  ragInsights?: any;
  traditionalHealing?: any;
  
  // Learning and improvement data
  learningData: {
    strategiesAttempted: string[];
    successFactors: string[];
    improvementAreas: string[];
    confidenceBreakdown: Record<string, number>;
  };
  
  // Proactive recommendations
  recommendations: {
    immediate: string[];
    preventive: string[];
    optimization: string[];
  };
  
  // Future prediction
  futureRisk: {
    similarFailureProbability: number;
    suggestedPreventions: string[];
    monitoringPoints: string[];
  };
}

export interface HealingContext {
  testId: string;
  testName: string;
  failure: FailureContext;
  executionHistory: any[];
  environmentData: Record<string, any>;
  userPreferences?: {
    strategy?: 'aggressive' | 'conservative' | 'balanced';
    learningMode?: boolean;
    debugMode?: boolean;
  };
}

export interface HealingStrategy {
  name: string;
  type: 'visual' | 'ml' | 'rag' | 'traditional' | 'hybrid';
  confidence: number;
  estimatedTime: number;
  riskLevel: 'low' | 'medium' | 'high';
  prerequisites: string[];
  fallbackStrategies: string[];
}

/**
 * Intelligent Healing Orchestrator - Coordinates all AI healing services
 * Provides unified, intelligent healing with multi-modal analysis
 */
export class IntelligentHealingOrchestrator {
  private visualHealingAI: VisualHealingAI;
  private enhancedRAG: EnhancedLangChainRAGService;
  private mlPatternLearning: MLPatternLearningService;
  private traditionalHealing: any;
  
  private strategyCache: Map<string, HealingStrategy[]>;
  private performanceMetrics: Map<string, any>;
  private isInitialized: boolean = false;

  constructor() {
    this.strategyCache = new Map();
    this.performanceMetrics = new Map();
    this.initializeServices();
  }

  private async initializeServices(): Promise<void> {
    try {
      logger.info('Initializing Intelligent Healing Orchestrator...');

      // Initialize all AI services
      this.visualHealingAI = new VisualHealingAI();
      this.enhancedRAG = new EnhancedLangChainRAGService();
      this.mlPatternLearning = new MLPatternLearningService();
      this.traditionalHealing = getSelfHealingService();

      // Ensure ML models are loaded
      await this.ensureMLModelsReady();

      this.isInitialized = true;
      logger.info('Intelligent Healing Orchestrator initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Intelligent Healing Orchestrator:', error);
      this.isInitialized = false;
    }
  }

  private async ensureMLModelsReady(): Promise<void> {
    try {
      const modelMetrics = await this.mlPatternLearning.getModelMetrics();
      
      if (modelMetrics.trainingExamples < 50) {
        logger.info('Insufficient ML training data, initializing with synthetic data');
        await this.generateSyntheticTrainingData();
      }
    } catch (error) {
      logger.warn('ML models not ready, continuing with other strategies:', error);
    }
  }

  /**
   * Main healing orchestration method - intelligently coordinates all healing strategies
   */
  async orchestrateHealing(context: HealingContext): Promise<ComprehensiveHealingResult> {
    const startTime = Date.now();
    
    if (!this.isInitialized) {
      await this.initializeServices();
    }

    logger.info('Starting intelligent healing orchestration', {
      testId: context.testId,
      testName: context.testName,
      failureType: context.failure.error
    });

    try {
      // Phase 1: Analyze and plan healing strategies
      const healingPlan = await this.analyzeSituationAndPlanStrategies(context);
      
      // Phase 2: Execute strategies in optimal order
      const healingResult = await this.executeHealingPlan(healingPlan, context);
      
      // Phase 3: Learn from the results
      await this.learnFromHealingAttempt(context, healingResult);
      
      // Phase 4: Generate proactive insights and recommendations
      const insights = await this.generateProactiveInsights(context, healingResult);

      const executionTime = Date.now() - startTime;
      
      const comprehensiveResult: ComprehensiveHealingResult = {
        ...healingResult,
        executionTime,
        ...insights
      };

      logger.info('Intelligent healing orchestration completed', {
        success: comprehensiveResult.success,
        strategy: comprehensiveResult.strategy,
        confidence: comprehensiveResult.confidence,
        executionTime
      });

      return comprehensiveResult;

    } catch (error) {
      logger.error('Healing orchestration failed:', error);
      
      // Fallback to traditional healing
      const fallbackResult = await this.fallbackHealing(context);
      
      return {
        success: fallbackResult.success,
        healedSelector: fallbackResult.healedSelector,
        confidence: fallbackResult.confidence || 0.1,
        strategy: 'fallback',
        executionTime: Date.now() - startTime,
        learningData: {
          strategiesAttempted: ['fallback'],
          successFactors: [],
          improvementAreas: ['orchestration-error'],
          confidenceBreakdown: { fallback: fallbackResult.confidence || 0.1 }
        },
        recommendations: {
          immediate: ['Review system logs', 'Check AI service health'],
          preventive: ['Implement better error handling'],
          optimization: ['Improve orchestration reliability']
        },
        futureRisk: {
          similarFailureProbability: 0.8,
          suggestedPreventions: ['System health monitoring'],
          monitoringPoints: ['AI service availability', 'Database connectivity']
        }
      };
    }
  }

  /**
   * Analyze the situation and plan optimal healing strategies
   */
  private async analyzeSituationAndPlanStrategies(context: HealingContext): Promise<HealingStrategy[]> {
    const strategies: HealingStrategy[] = [];

    // Get comprehensive situation analysis
    const situationAnalysis = await this.analyzeSituation(context);
    
    logger.info('Situation analysis completed', situationAnalysis);

    // Strategy 1: ML-Powered Pattern Recognition (if models available)
    if (await this.isMLStrategyViable(context)) {
      strategies.push({
        name: 'ML Pattern Recognition',
        type: 'ml',
        confidence: situationAnalysis.mlConfidence || 0.7,
        estimatedTime: 2000,
        riskLevel: 'low',
        prerequisites: ['ml-models-loaded'],
        fallbackStrategies: ['visual', 'rag']
      });
    }

    // Strategy 2: Visual AI Analysis (if screenshot available)
    if (context.failure.screenshot && context.failure.screenshot.length > 0) {
      strategies.push({
        name: 'Visual AI Analysis',
        type: 'visual',
        confidence: situationAnalysis.visualConfidence || 0.8,
        estimatedTime: 3000,
        riskLevel: 'low',
        prerequisites: ['screenshot-available'],
        fallbackStrategies: ['rag', 'traditional']
      });
    }

    // Strategy 3: Enhanced RAG Knowledge Query
    strategies.push({
      name: 'Enhanced RAG Knowledge',
      type: 'rag',
      confidence: situationAnalysis.ragConfidence || 0.6,
      estimatedTime: 1500,
      riskLevel: 'low',
      prerequisites: ['knowledge-base-available'],
      fallbackStrategies: ['traditional']
    });

    // Strategy 4: Traditional Healing (always available)
    strategies.push({
      name: 'Traditional Healing',
      type: 'traditional',
      confidence: situationAnalysis.traditionalConfidence || 0.5,
      estimatedTime: 1000,
      riskLevel: 'low',
      prerequisites: [],
      fallbackStrategies: []
    });

    // Strategy 5: Hybrid Approach (combine multiple strategies)
    if (strategies.length >= 3) {
      strategies.push({
        name: 'Hybrid Multi-Modal',
        type: 'hybrid',
        confidence: Math.min(
          strategies.reduce((sum, s) => sum + s.confidence, 0) / strategies.length + 0.1,
          0.95
        ),
        estimatedTime: 4000,
        riskLevel: 'medium',
        prerequisites: ['multiple-strategies-available'],
        fallbackStrategies: ['ml', 'visual']
      });
    }

    // Sort strategies by confidence and user preferences
    const sortedStrategies = this.prioritizeStrategies(strategies, context.userPreferences);
    
    // Cache strategies for future use
    this.strategyCache.set(context.testId, sortedStrategies);
    
    return sortedStrategies;
  }

  /**
   * Analyze the current situation to determine strategy viability
   */
  private async analyzeSituation(context: HealingContext): Promise<any> {
    const analysis = {
      failureType: '',
      complexity: 0,
      hasScreenshot: false,
      hasHistoricalData: false,
      mlConfidence: 0,
      visualConfidence: 0,
      ragConfidence: 0,
      traditionalConfidence: 0,
      environmentStability: 0.8
    };

    try {
      // Classify failure type
      analysis.failureType = await this.traditionalHealing.classifyFailure(
        new Error(context.failure.error), 
        context.failure
      );

      // Assess complexity
      analysis.complexity = this.assessFailureComplexity(context);

      // Check screenshot availability
      analysis.hasScreenshot = context.failure.screenshot && context.failure.screenshot.length > 0;

      // Check historical data
      analysis.hasHistoricalData = context.executionHistory && context.executionHistory.length > 0;

      // Calculate strategy-specific confidence scores
      if (analysis.hasScreenshot && analysis.failureType === 'SELECTOR_ISSUE') {
        analysis.visualConfidence = 0.85;
      } else if (analysis.hasScreenshot) {
        analysis.visualConfidence = 0.65;
      }

      if (analysis.failureType === 'SELECTOR_ISSUE' || analysis.failureType === 'TIMING_ISSUE') {
        analysis.mlConfidence = 0.75;
      } else {
        analysis.mlConfidence = 0.45;
      }

      // RAG confidence based on knowledge availability
      analysis.ragConfidence = 0.7; // Generally high due to comprehensive knowledge base

      // Traditional confidence based on failure type
      const traditionalSuccessRates: Record<string, number> = {
        'SELECTOR_ISSUE': 0.8,
        'TIMING_ISSUE': 0.6,
        'DOM_CHANGE': 0.7,
        'NETWORK_ISSUE': 0.3,
        'AUTH_ISSUE': 0.4,
        'UNKNOWN': 0.5
      };
      analysis.traditionalConfidence = traditionalSuccessRates[analysis.failureType] || 0.5;

    } catch (error) {
      logger.warn('Situation analysis partially failed:', error);
    }

    return analysis;
  }

  /**
   * Execute the planned healing strategies
   */
  private async executeHealingPlan(
    strategies: HealingStrategy[],
    context: HealingContext
  ): Promise<any> {
    const results: any[] = [];
    let bestResult: any = { success: false, confidence: 0 };

    // User preference: strategy selection mode
    const mode = context.userPreferences?.strategy || 'balanced';
    const strategiesToTry = this.selectStrategiesBasedOnMode(strategies, mode);

    for (const strategy of strategiesToTry) {
      try {
        logger.info(`Attempting healing strategy: ${strategy.name}`);
        
        const strategyResult = await this.executeStrategy(strategy, context);
        results.push({ strategy: strategy.name, ...strategyResult });

        if (strategyResult.success && strategyResult.confidence > bestResult.confidence) {
          bestResult = { ...strategyResult, strategy: strategy.name };
        }

        // Early exit if we have a high-confidence success
        if (strategyResult.success && strategyResult.confidence > 0.9) {
          logger.info(`High confidence healing achieved with ${strategy.name}`);
          break;
        }

      } catch (error) {
        logger.warn(`Strategy ${strategy.name} failed:`, error);
        results.push({ 
          strategy: strategy.name, 
          success: false, 
          error: error.message,
          confidence: 0
        });
      }
    }

    return {
      ...bestResult,
      allResults: results,
      learningData: {
        strategiesAttempted: results.map(r => r.strategy),
        successFactors: results
          .filter(r => r.success)
          .map(r => `${r.strategy}-success`),
        improvementAreas: results
          .filter(r => !r.success)
          .map(r => `${r.strategy}-improvement`),
        confidenceBreakdown: results.reduce((acc, r) => {
          acc[r.strategy] = r.confidence || 0;
          return acc;
        }, {} as Record<string, number>)
      }
    };
  }

  /**
   * Execute a specific healing strategy
   */
  private async executeStrategy(strategy: HealingStrategy, context: HealingContext): Promise<any> {
    switch (strategy.type) {
      case 'visual':
        return await this.executeVisualStrategy(context);
      
      case 'ml':
        return await this.executeMLStrategy(context);
      
      case 'rag':
        return await this.executeRAGStrategy(context);
      
      case 'traditional':
        return await this.executeTraditionalStrategy(context);
      
      case 'hybrid':
        return await this.executeHybridStrategy(context);
      
      default:
        throw new Error(`Unknown strategy type: ${strategy.type}`);
    }
  }

  private async executeVisualStrategy(context: HealingContext): Promise<any> {
    const result = await this.visualHealingAI.healWithVisualAI({
      ...context.failure,
      testId: context.testId,
      testName: context.testName
    });

    return {
      success: result.success,
      healedSelector: result.healedSelector,
      confidence: result.confidence,
      visualAnalysis: result.learningData
    };
  }

  private async executeMLStrategy(context: HealingContext): Promise<any> {
    // Get ML prediction for healing success
    const prediction = await this.mlPatternLearning.predictHealingSuccess(
      context.failure.selector || '',
      context.failure.selector || '', // Would normally have a suggested healed selector
      context.failure.dom,
      context.testName,
      context.failure.url
    );

    if (prediction.alternativeSelectors.length > 0) {
      const bestAlternative = prediction.alternativeSelectors[0];
      return {
        success: prediction.confidence > 0.6,
        healedSelector: bestAlternative,
        confidence: prediction.confidence,
        mlPrediction: prediction
      };
    }

    return {
      success: false,
      confidence: prediction.confidence,
      mlPrediction: prediction
    };
  }

  private async executeRAGStrategy(context: HealingContext): Promise<any> {
    // Use RAG to get healing insights
    const healingQuery = this.constructHealingQuery(context);
    
    const ragResponse = await this.enhancedRAG.enhancedChat(healingQuery, {
      userId: 'healing-orchestrator',
      sessionId: context.testId,
      testContext: {
        testId: context.testId,
        testName: context.testName,
        failure: context.failure,
        url: context.failure.url
      }
    });

    // Extract healing suggestions from RAG response
    const healingSuggestions = this.extractHealingSuggestionsFromRAG(ragResponse.answer);

    if (healingSuggestions.length > 0) {
      return {
        success: true,
        healedSelector: healingSuggestions[0],
        confidence: ragResponse.confidence,
        ragInsights: {
          suggestions: healingSuggestions,
          reasoning: ragResponse.answer,
          recommendations: ragResponse.recommendations
        }
      };
    }

    return {
      success: false,
      confidence: ragResponse.confidence * 0.5, // Lower confidence if no suggestions
      ragInsights: {
        reasoning: ragResponse.answer,
        recommendations: ragResponse.recommendations
      }
    };
  }

  private async executeTraditionalStrategy(context: HealingContext): Promise<any> {
    // Use traditional healing service
    const alternatives = await this.traditionalHealing.findAlternativeSelectors(
      context.failure.selector || '',
      context.failure.dom
    );

    if (alternatives.length > 0) {
      return {
        success: true,
        healedSelector: alternatives[0].selector,
        confidence: alternatives[0].confidence,
        traditionalHealing: { alternatives }
      };
    }

    return {
      success: false,
      confidence: 0.1,
      traditionalHealing: { alternatives: [] }
    };
  }

  private async executeHybridStrategy(context: HealingContext): Promise<any> {
    // Execute multiple strategies and combine results
    const [visualResult, mlResult, ragResult] = await Promise.allSettled([
      this.executeVisualStrategy(context).catch(e => ({ success: false, error: e.message })),
      this.executeMLStrategy(context).catch(e => ({ success: false, error: e.message })),
      this.executeRAGStrategy(context).catch(e => ({ success: false, error: e.message }))
    ]);

    const results = [
      visualResult.status === 'fulfilled' ? visualResult.value : { success: false },
      mlResult.status === 'fulfilled' ? mlResult.value : { success: false },
      ragResult.status === 'fulfilled' ? ragResult.value : { success: false }
    ];

    // Find the best result
    const successfulResults = results.filter(r => r.success);
    if (successfulResults.length > 0) {
      const bestResult = successfulResults.reduce((best, current) => 
        current.confidence > best.confidence ? current : best
      );

      return {
        ...bestResult,
        confidence: Math.min(bestResult.confidence * 1.1, 0.95), // Boost hybrid confidence
        hybridResults: results
      };
    }

    // No successful results, return the highest confidence failure
    const bestFailure = results.reduce((best, current) => 
      (current.confidence || 0) > (best.confidence || 0) ? current : best
    );

    return {
      success: false,
      confidence: bestFailure.confidence || 0.1,
      hybridResults: results
    };
  }

  /**
   * Learn from healing attempts to improve future performance
   */
  private async learnFromHealingAttempt(
    context: HealingContext,
    result: any
  ): Promise<void> {
    try {
      // Record learning data for ML model
      if (result.healedSelector) {
        await this.mlPatternLearning.learnFromHealingAttempt(
          context.failure.selector || '',
          result.healedSelector,
          result.success,
          context.failure.dom,
          context.testName,
          context.failure.url
        );
      }

      // Update performance metrics
      this.updatePerformanceMetrics(context, result);

      logger.info('Learning from healing attempt completed', {
        testId: context.testId,
        success: result.success,
        strategy: result.strategy
      });

    } catch (error) {
      logger.warn('Failed to learn from healing attempt:', error);
    }
  }

  /**
   * Generate proactive insights and recommendations
   */
  private async generateProactiveInsights(
    context: HealingContext,
    result: any
  ): Promise<any> {
    const insights = {
      recommendations: {
        immediate: [],
        preventive: [],
        optimization: []
      },
      futureRisk: {
        similarFailureProbability: 0.5,
        suggestedPreventions: [],
        monitoringPoints: []
      }
    };

    try {
      // Generate immediate recommendations
      if (result.success) {
        insights.recommendations.immediate.push(
          `Healing successful with ${result.strategy}. Consider updating test selectors.`
        );
        
        if (result.confidence < 0.7) {
          insights.recommendations.immediate.push(
            'Low confidence healing. Manual review recommended.'
          );
        }
      } else {
        insights.recommendations.immediate.push(
          'Healing failed. Manual intervention required.'
        );
        insights.recommendations.immediate.push(
          'Review test selectors and application changes.'
        );
      }

      // Predict future risk using ML model
      if (context.executionHistory.length > 0) {
        const failurePrediction = await this.mlPatternLearning.predictTestFailure(
          context.testId,
          {
            complexity: this.assessFailureComplexity(context),
            historicalFailureRate: this.calculateHistoricalFailureRate(context.executionHistory),
            environmentFactors: context.environmentData || {},
            codeChanges: []
          }
        );

        insights.futureRisk = {
          similarFailureProbability: failurePrediction.probability,
          suggestedPreventions: failurePrediction.suggestedMitigations,
          monitoringPoints: failurePrediction.riskFactors
        };
      }

      // Generate optimization recommendations
      if (result.learningData?.strategiesAttempted.length > 1) {
        insights.recommendations.optimization.push(
          'Multiple strategies attempted. Consider optimizing test reliability.'
        );
      }

      if (result.executionTime > 5000) {
        insights.recommendations.optimization.push(
          'Long healing time detected. Consider selector optimization.'
        );
      }

    } catch (error) {
      logger.warn('Failed to generate proactive insights:', error);
    }

    return insights;
  }

  // Helper methods
  private prioritizeStrategies(
    strategies: HealingStrategy[],
    preferences?: any
  ): HealingStrategy[] {
    return strategies.sort((a, b) => {
      // Primary: User preference for strategy type
      if (preferences?.strategy === 'aggressive' && a.type === 'hybrid') return -1;
      if (preferences?.strategy === 'conservative' && a.type === 'traditional') return -1;
      
      // Secondary: Confidence score
      if (a.confidence !== b.confidence) return b.confidence - a.confidence;
      
      // Tertiary: Estimated time (faster is better)
      return a.estimatedTime - b.estimatedTime;
    });
  }

  private selectStrategiesBasedOnMode(
    strategies: HealingStrategy[],
    mode: 'aggressive' | 'conservative' | 'balanced'
  ): HealingStrategy[] {
    switch (mode) {
      case 'aggressive':
        return strategies.slice(0, 4); // Try up to 4 strategies
      case 'conservative':
        return strategies.slice(0, 2); // Try up to 2 strategies
      case 'balanced':
      default:
        return strategies.slice(0, 3); // Try up to 3 strategies
    }
  }

  private async isMLStrategyViable(context: HealingContext): Promise<boolean> {
    try {
      const modelMetrics = await this.mlPatternLearning.getModelMetrics();
      return modelMetrics.accuracy > 0.6 && modelMetrics.trainingExamples > 100;
    } catch {
      return false;
    }
  }

  private assessFailureComplexity(context: HealingContext): number {
    let complexity = 0.5; // Base complexity
    
    // Increase complexity based on various factors
    if (context.failure.selector && context.failure.selector.includes(':nth-child')) complexity += 0.2;
    if (context.failure.consoleErrors.length > 5) complexity += 0.2;
    if (context.failure.networkLogs.some(log => log.status >= 400)) complexity += 0.1;
    if (context.failure.dom.includes('loading') || context.failure.dom.includes('spinner')) complexity += 0.1;
    
    return Math.min(complexity, 1.0);
  }

  private calculateHistoricalFailureRate(history: any[]): number {
    if (history.length === 0) return 0;
    const failures = history.filter(h => h.status === 'failed').length;
    return failures / history.length;
  }

  private constructHealingQuery(context: HealingContext): string {
    return `
      I have a test failure in WeSign application. Please provide specific healing suggestions.
      
      Test: ${context.testName}
      Error: ${context.failure.error}
      Selector: ${context.failure.selector || 'unknown'}
      URL: ${context.failure.url}
      
      The element could not be found or interacted with. What are the best alternative selectors 
      or approaches for this specific WeSign functionality? Consider both Hebrew and English 
      interface elements.
    `;
  }

  private extractHealingSuggestionsFromRAG(ragResponse: string): string[] {
    const suggestions: string[] = [];
    
    // Extract selectors from RAG response
    const selectorMatches = ragResponse.match(/[#.][\w-]+|text\s*=\s*"[^"]+"|button\s*:\s*has-text\([^)]+\)/gi);
    if (selectorMatches) {
      suggestions.push(...selectorMatches.slice(0, 3));
    }
    
    // Extract quoted selectors
    const quotedMatches = ragResponse.match(/"([^"]*(?:button|input|select|textarea)[^"]*)"/gi);
    if (quotedMatches) {
      suggestions.push(...quotedMatches.map(m => m.replace(/"/g, '')).slice(0, 2));
    }
    
    return [...new Set(suggestions)]; // Remove duplicates
  }

  private updatePerformanceMetrics(context: HealingContext, result: any): void {
    const metrics = this.performanceMetrics.get(context.testId) || {
      attempts: 0,
      successes: 0,
      averageTime: 0,
      strategies: {}
    };

    metrics.attempts++;
    if (result.success) metrics.successes++;
    metrics.averageTime = (metrics.averageTime + result.executionTime) / 2;
    
    if (!metrics.strategies[result.strategy]) {
      metrics.strategies[result.strategy] = { attempts: 0, successes: 0 };
    }
    metrics.strategies[result.strategy].attempts++;
    if (result.success) metrics.strategies[result.strategy].successes++;

    this.performanceMetrics.set(context.testId, metrics);
  }

  private async fallbackHealing(context: HealingContext): Promise<any> {
    try {
      const alternatives = await this.traditionalHealing.findAlternativeSelectors(
        context.failure.selector || '',
        context.failure.dom
      );

      if (alternatives.length > 0) {
        return {
          success: true,
          healedSelector: alternatives[0].selector,
          confidence: alternatives[0].confidence
        };
      }

      return { success: false, confidence: 0.1 };
    } catch (error) {
      logger.error('Even fallback healing failed:', error);
      return { success: false, confidence: 0, error: error.message };
    }
  }

  private async generateSyntheticTrainingData(): Promise<void> {
    // Generate synthetic training data for ML models when insufficient real data exists
    const syntheticData = [
      // WeSign login patterns
      { original: '#email', healed: 'input[type="email"]', success: true, type: 'login' },
      { original: '#password', healed: 'input[type="password"]', success: true, type: 'login' },
      { original: '.login-btn', healed: 'button:has-text("התחבר")', success: true, type: 'login' },
      
      // WeSign document patterns
      { original: '#fileUpload', healed: 'input[type="file"]', success: true, type: 'document' },
      { original: '.upload-button', healed: 'button:has-text("העלה")', success: true, type: 'document' },
      
      // Generic patterns
      { original: '.btn-primary', healed: 'button[class*="primary"]', success: true, type: 'generic' }
    ];

    for (const data of syntheticData) {
      await this.mlPatternLearning.learnFromHealingAttempt(
        data.original,
        data.healed,
        data.success,
        `<html><body>Mock DOM for ${data.type}</body></html>`,
        data.type,
        'https://devtest.comda.co.il'
      );
    }

    logger.info('Synthetic training data generated');
  }

  async getPerformanceMetrics(): Promise<Map<string, any>> {
    return this.performanceMetrics;
  }

  async close(): Promise<void> {
    if (this.visualHealingAI) await this.visualHealingAI.close();
    if (this.enhancedRAG) await this.enhancedRAG.close();
    if (this.mlPatternLearning) await this.mlPatternLearning.close();
  }
}

export default IntelligentHealingOrchestrator;