import { logger } from '@/utils/logger';
import { EventEmitter } from 'events';
import WeSignCodebaseAnalyzer, { WeSignCodeStructure } from './wesignCodebaseAnalyzer';
import UnifiedKnowledgeService from './unifiedKnowledgeService';
import { FailureAnalysisAgent } from './failure-analysis-agent';
import { SelfHealingService } from '../selfHealingService';
import VisualHealingAI from './visualHealingAI';
import PerformanceIntelligenceSystem from './performanceIntelligence';
import PredictiveAnalyticsEngine from './predictiveAnalyticsEngine';
import { AIService } from './aiService';

export interface UnifiedAIRequest {
  type: 'analysis' | 'healing' | 'prediction' | 'optimization' | 'knowledge';
  context: {
    testId?: string;
    testName?: string;
    url?: string;
    error?: string;
    metrics?: any;
    screenshot?: Buffer;
    environment?: any;
  };
  priority: 'low' | 'medium' | 'high' | 'critical';
  requiredServices: string[];
  wesignContext?: {
    workflow?: string;
    component?: string;
    feature?: string;
    businessCriticality?: 'low' | 'medium' | 'high' | 'critical';
  };
}

export interface UnifiedAIResponse {
  requestId: string;
  success: boolean;
  results: {
    failureAnalysis?: any;
    healing?: any;
    visualHealing?: any;
    performance?: any;
    predictions?: any;
    knowledge?: any;
  };
  insights: {
    overallConfidence: number;
    wesignSpecificInsights: string[];
    actionableRecommendations: string[];
    businessImpact: string;
    technicalDetails: any;
  };
  orchestrationMetrics: {
    totalProcessingTime: number;
    servicesUsed: string[];
    cacheHits: number;
    aiTokensUsed: number;
  };
  nextSteps?: string[];
}

export interface AIServiceHealth {
  serviceName: string;
  status: 'healthy' | 'degraded' | 'failing' | 'offline';
  responseTime: number;
  accuracy: number;
  lastCheck: Date;
  errorRate: number;
}

/**
 * Unified AI Orchestrator - Master coordination service for all WeSign AI capabilities
 *
 * This service orchestrates and coordinates all AI services to provide unified,
 * intelligent responses for WeSign platform testing and optimization.
 */
export class UnifiedAIOrchestrator extends EventEmitter {
  private codebaseAnalyzer: WeSignCodebaseAnalyzer;
  private knowledgeService: UnifiedKnowledgeService;
  private failureAnalysisAgent: FailureAnalysisAgent;
  private selfHealingService: SelfHealingService;
  private visualHealingAI: VisualHealingAI;
  private performanceIntelligence: PerformanceIntelligenceSystem;
  private predictiveAnalytics: PredictiveAnalyticsEngine;
  private aiService: AIService;

  private codeStructure: WeSignCodeStructure | null = null;
  private serviceHealth: Map<string, AIServiceHealth> = new Map();
  private responseCache: Map<string, any> = new Map();
  private processingQueue: UnifiedAIRequest[] = [];
  private isProcessing: boolean = false;

  constructor() {
    super();

    // Initialize all AI services
    this.codebaseAnalyzer = new WeSignCodebaseAnalyzer();
    this.knowledgeService = new UnifiedKnowledgeService();
    this.failureAnalysisAgent = new FailureAnalysisAgent();
    this.selfHealingService = new SelfHealingService();
    this.visualHealingAI = new VisualHealingAI();
    this.performanceIntelligence = new PerformanceIntelligenceSystem();
    this.predictiveAnalytics = new PredictiveAnalyticsEngine();
    this.aiService = new AIService();

    // Initialize the orchestrator
    this.initialize();

    logger.info('Unified AI Orchestrator initialized with all WeSign-aware services');
  }

  /**
   * Initialize the AI orchestrator with WeSign intelligence
   */
  private async initialize(): Promise<void> {
    try {
      logger.info('Initializing Unified AI Orchestrator with WeSign intelligence');

      // Initialize codebase awareness
      this.codeStructure = await this.codebaseAnalyzer.analyzeFullCodebase();

      // Initialize service health monitoring
      await this.initializeServiceHealthMonitoring();

      // Set up event listeners for cross-service communication
      this.setupServiceEventListeners();

      // Start background processing
      this.startBackgroundProcessing();

      logger.info('Unified AI Orchestrator fully initialized', {
        codebaseFeatures: this.codeStructure.features.length,
        workflows: this.codeStructure.workflows.length,
        servicesRegistered: this.serviceHealth.size
      });

      this.emit('orchestrator-ready', {
        timestamp: new Date(),
        servicesCount: this.serviceHealth.size,
        codebaseLoaded: !!this.codeStructure
      });

    } catch (error) {
      logger.error('Failed to initialize Unified AI Orchestrator:', error);
      throw error;
    }
  }

  /**
   * Process unified AI request with intelligent service coordination
   */
  async processRequest(request: UnifiedAIRequest): Promise<UnifiedAIResponse> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      logger.info('Processing unified AI request', {
        requestId,
        type: request.type,
        priority: request.priority,
        requiredServices: request.requiredServices,
        hasWeSignContext: !!request.wesignContext
      });

      // Check cache first
      const cacheKey = this.generateCacheKey(request);
      const cachedResult = this.responseCache.get(cacheKey);
      if (cachedResult && this.isCacheValid(cachedResult)) {
        logger.info('Returning cached response', { requestId, cacheKey });
        return this.enhanceCachedResponse(cachedResult, requestId, startTime);
      }

      // Analyze request and determine optimal service coordination strategy
      const coordinationStrategy = await this.analyzeRequestAndPlanCoordination(request);

      // Execute coordinated AI processing
      const results = await this.executeCoordinatedProcessing(request, coordinationStrategy);

      // Generate unified insights using AI
      const insights = await this.generateUnifiedInsights(request, results, coordinationStrategy);

      // Build comprehensive response
      const response: UnifiedAIResponse = {
        requestId,
        success: true,
        results,
        insights,
        orchestrationMetrics: {
          totalProcessingTime: Date.now() - startTime,
          servicesUsed: coordinationStrategy.servicesUsed,
          cacheHits: coordinationStrategy.cacheHits,
          aiTokensUsed: coordinationStrategy.estimatedTokens
        },
        nextSteps: await this.generateNextSteps(request, results, insights)
      };

      // Cache successful response
      this.responseCache.set(cacheKey, {
        ...response,
        cachedAt: new Date(),
        ttl: this.calculateCacheTTL(request)
      });

      // Update service health metrics
      this.updateServiceHealthMetrics(coordinationStrategy.servicesUsed, true, Date.now() - startTime);

      logger.info('Unified AI request processed successfully', {
        requestId,
        processingTime: response.orchestrationMetrics.totalProcessingTime,
        servicesUsed: response.orchestrationMetrics.servicesUsed.length,
        confidence: response.insights.overallConfidence
      });

      return response;

    } catch (error) {
      logger.error('Failed to process unified AI request', { requestId, error });

      // Update service health metrics for failure
      this.updateServiceHealthMetrics(request.requiredServices, false, Date.now() - startTime);

      return {
        requestId,
        success: false,
        results: {},
        insights: {
          overallConfidence: 0,
          wesignSpecificInsights: ['AI processing failed - using fallback analysis'],
          actionableRecommendations: ['Review request parameters and try again'],
          businessImpact: 'Unable to assess due to processing failure',
          technicalDetails: { error: error.message }
        },
        orchestrationMetrics: {
          totalProcessingTime: Date.now() - startTime,
          servicesUsed: [],
          cacheHits: 0,
          aiTokensUsed: 0
        }
      };
    }
  }

  /**
   * Analyze request and plan optimal service coordination
   */
  private async analyzeRequestAndPlanCoordination(request: UnifiedAIRequest): Promise<any> {
    const strategy = {
      servicesUsed: [],
      executionOrder: [],
      parallelGroups: [],
      dependencies: new Map(),
      cacheHits: 0,
      estimatedTokens: 0,
      wesignOptimizations: []
    };

    // Determine required services based on request type and context
    switch (request.type) {
      case 'analysis':
        strategy.servicesUsed = ['failureAnalysis', 'knowledge'];
        if (request.context.screenshot) strategy.servicesUsed.push('visualHealing');
        if (request.context.metrics) strategy.servicesUsed.push('performance');
        break;

      case 'healing':
        strategy.servicesUsed = ['selfHealing'];
        if (request.context.screenshot) strategy.servicesUsed.push('visualHealing');
        strategy.servicesUsed.push('failureAnalysis', 'knowledge');
        break;

      case 'prediction':
        strategy.servicesUsed = ['predictiveAnalytics', 'performance', 'knowledge'];
        break;

      case 'optimization':
        strategy.servicesUsed = ['performance', 'predictiveAnalytics', 'knowledge'];
        break;

      case 'knowledge':
        strategy.servicesUsed = ['knowledge'];
        if (this.codeStructure) strategy.servicesUsed.push('codebaseAnalysis');
        break;
    }

    // Add WeSign-specific optimizations
    if (request.wesignContext) {
      strategy.wesignOptimizations = await this.identifyWeSignOptimizations(request);
    }

    // Plan execution order and parallelization
    strategy.parallelGroups = this.planParallelExecution(strategy.servicesUsed);
    strategy.estimatedTokens = this.estimateTokenUsage(request, strategy.servicesUsed);

    return strategy;
  }

  /**
   * Execute coordinated processing across multiple AI services
   */
  private async executeCoordinatedProcessing(
    request: UnifiedAIRequest,
    strategy: any
  ): Promise<any> {
    const results: any = {};

    try {
      // Execute services in parallel groups for optimal performance
      for (const group of strategy.parallelGroups) {
        const groupPromises = group.map(async (serviceName: string) => {
          return this.executeService(serviceName, request, results);
        });

        const groupResults = await Promise.allSettled(groupPromises);

        // Process group results
        groupResults.forEach((result, index) => {
          const serviceName = group[index];
          if (result.status === 'fulfilled') {
            results[serviceName] = result.value;
          } else {
            logger.warn(`Service ${serviceName} failed:`, result.reason);
            results[serviceName] = { error: result.reason.message };
          }
        });
      }

      return results;

    } catch (error) {
      logger.error('Coordinated processing failed:', error);
      throw error;
    }
  }

  /**
   * Execute individual AI service
   */
  private async executeService(serviceName: string, request: UnifiedAIRequest, existingResults: any): Promise<any> {
    const startTime = Date.now();

    try {
      let result;

      switch (serviceName) {
        case 'failureAnalysis':
          result = await this.failureAnalysisAgent.analyzeFailures({
            failures: [{ error: request.context.error, url: request.context.url }],
            testResults: existingResults,
            testContext: request.context
          });
          break;

        case 'selfHealing':
          if (request.context.error && request.context.url) {
            result = await this.selfHealingService.healWithContext({
              error: new Error(request.context.error),
              url: request.context.url,
              screenshot: request.context.screenshot || Buffer.alloc(0),
              consoleErrors: [],
              networkLogs: [],
              dom: '',
              selector: '',
              testId: request.context.testId || '',
              testName: request.context.testName || ''
            });
          }
          break;

        case 'visualHealing':
          if (request.context.screenshot) {
            result = await this.visualHealingAI.healWithVisualAI({
              screenshot: request.context.screenshot,
              error: request.context.error || '',
              url: request.context.url || '',
              dom: '',
              consoleErrors: [],
              networkLogs: [],
              testId: request.context.testId || '',
              testName: request.context.testName || ''
            });
          }
          break;

        case 'performance':
          if (request.context.metrics) {
            result = await this.performanceIntelligence.analyzePerformance(
              request.context.metrics,
              request.context.environment || {}
            );
          }
          break;

        case 'predictiveAnalytics':
          result = await this.predictiveAnalytics.predictTestFailures({
            testId: request.context.testId || '',
            historicalData: existingResults.performance || []
          });
          break;

        case 'knowledge':
          result = await this.knowledgeService.processQuery(
            this.buildKnowledgeQuery(request),
            {
              language: this.detectLanguage(request),
              includeCodebase: !!this.codeStructure,
              maxResults: 10
            }
          );
          break;

        default:
          throw new Error(`Unknown service: ${serviceName}`);
      }

      // Update service health
      this.updateServiceHealth(serviceName, true, Date.now() - startTime);

      return result;

    } catch (error) {
      this.updateServiceHealth(serviceName, false, Date.now() - startTime);
      throw error;
    }
  }

  /**
   * Generate unified insights using AI analysis
   */
  private async generateUnifiedInsights(
    request: UnifiedAIRequest,
    results: any,
    strategy: any
  ): Promise<any> {
    try {
      const prompt = `
Analyze these AI service results for WeSign platform testing and provide unified insights:

REQUEST CONTEXT:
Type: ${request.type}
Priority: ${request.priority}
WeSign Context: ${JSON.stringify(request.wesignContext || {}, null, 2)}

SERVICE RESULTS:
${JSON.stringify(results, null, 2)}

CODEBASE CONTEXT:
${this.codeStructure ? `
Features: ${this.codeStructure.features.slice(0, 10).map(f => f.name).join(', ')}
Workflows: ${this.codeStructure.workflows.slice(0, 5).map(w => w.name).join(', ')}
Components: ${this.codeStructure.frontend.components.slice(0, 10).map(c => c.name).join(', ')}
` : 'No codebase context available'}

Provide comprehensive analysis:
1. Overall confidence score (0-1) based on service agreement and data quality
2. WeSign-specific insights related to the platform and workflows
3. Actionable recommendations prioritized by business impact
4. Business impact assessment for WeSign operations
5. Technical details and next steps

Focus on WeSign platform specifics: Hebrew/English UI, digital signatures, document management, contact workflows, and authentication systems.
`;

      const response = await this.aiService.chatCompletion([
        {
          role: 'system',
          content: 'You are a WeSign platform AI expert providing unified analysis of multiple AI service results. Provide structured, actionable insights focused on WeSign business value.'
        },
        { role: 'user', content: prompt }
      ], {
        reasoning_effort: 'medium',
        maxTokens: 2000
      });

      const analysis = this.parseUnifiedInsights(response.choices[0].message.content || '');

      return {
        overallConfidence: analysis.confidence || 0.8,
        wesignSpecificInsights: analysis.wesignInsights || [
          'WeSign platform analysis completed with available data'
        ],
        actionableRecommendations: analysis.recommendations || [
          'Review results and implement suggested optimizations'
        ],
        businessImpact: analysis.businessImpact || 'Medium impact on WeSign platform operations',
        technicalDetails: analysis.technicalDetails || results
      };

    } catch (error) {
      logger.warn('Failed to generate unified insights, using fallback:', error);

      return {
        overallConfidence: 0.6,
        wesignSpecificInsights: ['Analysis completed with limited AI insight generation'],
        actionableRecommendations: ['Review individual service results for detailed recommendations'],
        businessImpact: 'Impact assessment unavailable due to insight generation failure',
        technicalDetails: results
      };
    }
  }

  /**
   * Initialize service health monitoring
   */
  private async initializeServiceHealthMonitoring(): Promise<void> {
    const services = [
      'failureAnalysis', 'selfHealing', 'visualHealing',
      'performance', 'predictiveAnalytics', 'knowledge', 'codebaseAnalysis'
    ];

    services.forEach(service => {
      this.serviceHealth.set(service, {
        serviceName: service,
        status: 'healthy',
        responseTime: 0,
        accuracy: 1.0,
        lastCheck: new Date(),
        errorRate: 0
      });
    });

    // Start periodic health checks
    setInterval(() => this.performHealthChecks(), 60000); // Every minute
  }

  /**
   * Set up event listeners for cross-service communication
   */
  private setupServiceEventListeners(): void {
    // Listen for failure analysis results to trigger healing
    this.failureAnalysisAgent.on('analysis-complete', (data) => {
      if (data.confidence > 0.8 && data.wesignContext?.businessCriticality === 'critical') {
        this.emit('critical-failure-detected', data);
      }
    });

    // Listen for performance degradation
    this.performanceIntelligence.on('performance-alert', (alert) => {
      if (alert.severity === 'critical') {
        this.emit('performance-critical', alert);
      }
    });

    // Listen for predictive alerts
    this.predictiveAnalytics.on('prediction-alert', (prediction) => {
      if (prediction.failureProbability > 0.9) {
        this.emit('failure-prediction-high', prediction);
      }
    });
  }

  // Helper methods
  private generateCacheKey(request: UnifiedAIRequest): string {
    return `${request.type}_${JSON.stringify(request.context)}_${JSON.stringify(request.wesignContext)}`;
  }

  private isCacheValid(cachedResult: any): boolean {
    const ttl = cachedResult.ttl || 300000; // 5 minutes default
    return (Date.now() - new Date(cachedResult.cachedAt).getTime()) < ttl;
  }

  private enhanceCachedResponse(cachedResult: any, requestId: string, startTime: number): UnifiedAIResponse {
    return {
      ...cachedResult,
      requestId,
      orchestrationMetrics: {
        ...cachedResult.orchestrationMetrics,
        totalProcessingTime: Date.now() - startTime,
        cacheHits: 1
      }
    };
  }

  private async identifyWeSignOptimizations(request: UnifiedAIRequest): Promise<string[]> {
    const optimizations = [];

    if (request.wesignContext?.workflow === 'Digital Signature') {
      optimizations.push('signature-canvas-optimization', 'document-rendering-priority');
    }

    if (request.wesignContext?.component?.includes('Hebrew')) {
      optimizations.push('hebrew-rtl-optimization', 'font-loading-priority');
    }

    if (request.wesignContext?.businessCriticality === 'critical') {
      optimizations.push('priority-processing', 'enhanced-monitoring');
    }

    return optimizations;
  }

  private planParallelExecution(services: string[]): string[][] {
    // Group services that can run in parallel
    const groups = [];

    // Independent services that can run in parallel
    const independentServices = ['knowledge', 'codebaseAnalysis'];
    const analysisServices = ['failureAnalysis', 'performance', 'predictiveAnalytics'];
    const healingServices = ['selfHealing', 'visualHealing'];

    if (services.some(s => independentServices.includes(s))) {
      groups.push(services.filter(s => independentServices.includes(s)));
    }

    if (services.some(s => analysisServices.includes(s))) {
      groups.push(services.filter(s => analysisServices.includes(s)));
    }

    if (services.some(s => healingServices.includes(s))) {
      groups.push(services.filter(s => healingServices.includes(s)));
    }

    return groups.length > 0 ? groups : [services];
  }

  private estimateTokenUsage(request: UnifiedAIRequest, services: string[]): number {
    let tokens = 0;

    // Base tokens per service type
    const serviceTokens: Record<string, number> = {
      failureAnalysis: 1500,
      knowledge: 800,
      visualHealing: 2000,
      selfHealing: 1000,
      performance: 1200,
      predictiveAnalytics: 1800
    };

    services.forEach(service => {
      tokens += serviceTokens[service] || 500;
    });

    // Add context complexity multiplier
    if (request.context.screenshot) tokens *= 1.5;
    if (request.wesignContext) tokens *= 1.2;

    return Math.round(tokens);
  }

  private buildKnowledgeQuery(request: UnifiedAIRequest): string {
    let query = '';

    if (request.context.error) {
      query += `Error: ${request.context.error} `;
    }

    if (request.wesignContext?.workflow) {
      query += `WeSign ${request.wesignContext.workflow} `;
    }

    if (request.wesignContext?.component) {
      query += `${request.wesignContext.component} `;
    }

    return query.trim() || 'WeSign platform information';
  }

  private detectLanguage(request: UnifiedAIRequest): string {
    const text = `${request.context.error || ''} ${request.context.url || ''}`;
    return /[\u0590-\u05FF]/.test(text) ? 'hebrew' : 'english';
  }

  private parseUnifiedInsights(content: string): any {
    try {
      // Try to parse JSON if present
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback to text parsing
      return {
        confidence: 0.7,
        wesignInsights: [content.substring(0, 200)],
        recommendations: ['Review detailed analysis'],
        businessImpact: 'Standard impact assessment',
        technicalDetails: { rawResponse: content }
      };
    } catch (error) {
      return {
        confidence: 0.6,
        wesignInsights: ['Analysis completed with basic insights'],
        recommendations: ['Review individual service outputs'],
        businessImpact: 'Unable to assess business impact',
        technicalDetails: { parseError: error.message }
      };
    }
  }

  private async generateNextSteps(request: UnifiedAIRequest, results: any, insights: any): Promise<string[]> {
    const nextSteps = [];

    // Generate context-specific next steps
    if (request.type === 'healing' && insights.overallConfidence > 0.8) {
      nextSteps.push('Apply suggested healing solutions');
      nextSteps.push('Monitor test stability after fixes');
    }

    if (request.type === 'analysis' && results.failureAnalysis?.wesignContext?.businessCriticality === 'critical') {
      nextSteps.push('Escalate to WeSign development team');
      nextSteps.push('Implement immediate workarounds');
    }

    if (request.type === 'prediction' && results.predictiveAnalytics?.failureProbability > 0.8) {
      nextSteps.push('Implement preventive measures');
      nextSteps.push('Schedule proactive maintenance');
    }

    if (nextSteps.length === 0) {
      nextSteps.push('Review analysis results');
      nextSteps.push('Consider implementing recommendations');
    }

    return nextSteps;
  }

  private updateServiceHealthMetrics(services: string[], success: boolean, responseTime: number): void {
    services.forEach(serviceName => {
      const health = this.serviceHealth.get(serviceName);
      if (health) {
        health.lastCheck = new Date();
        health.responseTime = (health.responseTime + responseTime) / 2; // Moving average

        if (success) {
          health.errorRate = Math.max(0, health.errorRate - 0.01);
          health.accuracy = Math.min(1.0, health.accuracy + 0.001);
        } else {
          health.errorRate = Math.min(1.0, health.errorRate + 0.05);
          health.accuracy = Math.max(0, health.accuracy - 0.01);
        }

        // Update status based on metrics
        if (health.errorRate > 0.5) {
          health.status = 'failing';
        } else if (health.errorRate > 0.2) {
          health.status = 'degraded';
        } else {
          health.status = 'healthy';
        }

        this.serviceHealth.set(serviceName, health);
      }
    });
  }

  private updateServiceHealth(serviceName: string, success: boolean, responseTime: number): void {
    this.updateServiceHealthMetrics([serviceName], success, responseTime);
  }

  private calculateCacheTTL(request: UnifiedAIRequest): number {
    // Cache TTL based on request type and priority
    const baseTTL = {
      knowledge: 3600000, // 1 hour
      analysis: 600000,   // 10 minutes
      healing: 300000,    // 5 minutes
      prediction: 1800000, // 30 minutes
      optimization: 900000 // 15 minutes
    };

    let ttl = baseTTL[request.type] || 600000;

    // Adjust based on priority
    if (request.priority === 'critical') ttl /= 2;
    if (request.priority === 'low') ttl *= 2;

    return ttl;
  }

  private async performHealthChecks(): Promise<void> {
    // Basic health check - more sophisticated checks could be added
    this.serviceHealth.forEach((health, serviceName) => {
      // Mark services as offline if not checked recently
      const timeSinceLastCheck = Date.now() - health.lastCheck.getTime();
      if (timeSinceLastCheck > 300000) { // 5 minutes
        health.status = 'offline';
        this.serviceHealth.set(serviceName, health);
      }
    });
  }

  private startBackgroundProcessing(): void {
    setInterval(() => {
      if (this.processingQueue.length > 0 && !this.isProcessing) {
        this.processQueuedRequests();
      }
    }, 1000);
  }

  private async processQueuedRequests(): Promise<void> {
    if (this.isProcessing || this.processingQueue.length === 0) return;

    this.isProcessing = true;

    try {
      // Process high priority requests first
      this.processingQueue.sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

      const request = this.processingQueue.shift();
      if (request) {
        await this.processRequest(request);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get current service health status
   */
  public getServiceHealth(): Map<string, AIServiceHealth> {
    return new Map(this.serviceHealth);
  }

  /**
   * Get orchestrator statistics
   */
  public getOrchestrationStats(): any {
    return {
      totalRequests: this.responseCache.size,
      queuedRequests: this.processingQueue.length,
      servicesRegistered: this.serviceHealth.size,
      healthyServices: Array.from(this.serviceHealth.values()).filter(h => h.status === 'healthy').length,
      cacheHitRate: this.calculateCacheHitRate(),
      averageResponseTime: this.calculateAverageResponseTime(),
      codebaseLoaded: !!this.codeStructure,
      lastHealthCheck: new Date()
    };
  }

  private calculateCacheHitRate(): number {
    // Placeholder - implement based on actual cache hit tracking
    return 0.25; // 25% cache hit rate example
  }

  private calculateAverageResponseTime(): number {
    const services = Array.from(this.serviceHealth.values());
    if (services.length === 0) return 0;

    const totalTime = services.reduce((sum, service) => sum + service.responseTime, 0);
    return totalTime / services.length;
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    try {
      // Clear caches
      this.responseCache.clear();
      this.processingQueue = [];

      // Cleanup individual services
      if (this.performanceIntelligence) {
        this.performanceIntelligence.cleanup();
      }

      if (this.visualHealingAI) {
        await this.visualHealingAI.close();
      }

      // Remove all listeners
      this.removeAllListeners();

      logger.info('Unified AI Orchestrator cleaned up successfully');
    } catch (error) {
      logger.error('Error during AI Orchestrator cleanup:', error);
    }
  }
}

export default UnifiedAIOrchestrator;