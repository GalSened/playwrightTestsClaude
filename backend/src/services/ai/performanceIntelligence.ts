import * as tf from '@tensorflow/tfjs-node';
import { logger } from '@/utils/logger';
import WeSignCodebaseAnalyzer, { WeSignCodeStructure } from './wesignCodebaseAnalyzer';
import UnifiedKnowledgeService from './unifiedKnowledgeService';
import { AIService } from './AIService';

// Interfaces
export interface PerformanceMetrics {
  testExecutionTime: number;
  memoryCpuUsage: {
    memory: number;
    cpu: number;
  };
  networkLatency: number;
  renderingTime: number;
  domReadyTime: number;
  fullLoadTime: number;
  screenshot?: Buffer;
  timestamp: Date;
  testId: string;
  url: string;
  wesignMetrics?: {
    componentLoadTimes: Record<string, number>;
    apiResponseTimes: Record<string, number>;
    hebrewRenderingTime: number;
    documentProcessingTime: number;
    signatureCanvasInitTime: number;
    workflowCompletionTime: number;
    businessCriticalPath: string;
    uiInteractionLatency: number;
    authenticationTime: number;
  };
}

export interface TestEnvironmentData {
  browserType: string;
  browserVersion: string;
  viewport: { width: number; height: number };
  deviceType: 'desktop' | 'mobile' | 'tablet';
  networkCondition: string;
  location: string;
  os: string;
}

export interface PerformanceBottleneck {
  type: 'network' | 'rendering' | 'javascript' | 'memory' | 'dom' | 'resource';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: number; // 0-100
  location: {
    url?: string;
    selector?: string;
    resource?: string;
    line?: number;
  };
  suggestedFix: string;
  estimatedImprovement: string;
  confidence: number; // 0-1
}

export interface PerformanceTrend {
  metric: keyof PerformanceMetrics;
  direction: 'improving' | 'degrading' | 'stable';
  changeRate: number; // percentage per day
  significance: number; // statistical significance 0-1
  timeframe: {
    start: Date;
    end: Date;
  };
  dataPoints: number;
}

export interface OptimizationRecommendation {
  priority: 'high' | 'medium' | 'low';
  category: 'infrastructure' | 'test-design' | 'application' | 'environment';
  title: string;
  description: string;
  implementation: {
    effort: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high';
    timeframe: string;
    dependencies: string[];
  };
  expectedBenefits: {
    performanceGain: string;
    reliabilityImprovement: string;
    maintainabilityBoost: string;
  };
  technicalDetails: {
    approach: string;
    codeChanges?: string[];
    configurationChanges?: string[];
    infrastructureChanges?: string[];
  };
}

export interface RealTimeMonitoringAlert {
  alertId: string;
  type: 'performance_degradation' | 'bottleneck_detected' | 'trend_anomaly' | 'resource_exhaustion';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  details: any;
  timestamp: Date;
  testContext: {
    testId?: string;
    testName?: string;
    url?: string;
    environment?: TestEnvironmentData;
  };
  recommendations: string[];
  autoResolve: boolean;
}

export interface PerformanceIntelligenceReport {
  reportId: string;
  generatedAt: Date;
  timeframe: {
    start: Date;
    end: Date;
  };
  summary: {
    totalTests: number;
    averagePerformance: PerformanceMetrics;
    performanceScore: number; // 0-100
    trendsIdentified: number;
    bottlenecksFound: number;
    recommendationsGenerated: number;
  };
  keyFindings: {
    criticalBottlenecks: PerformanceBottleneck[];
    significantTrends: PerformanceTrend[];
    topRecommendations: OptimizationRecommendation[];
  };
  detailedAnalysis: {
    performanceBreakdown: Record<string, number>;
    environmentalImpact: Record<string, PerformanceMetrics>;
    temporalPatterns: any[];
    comparisonBaselines: Record<string, PerformanceMetrics>;
  };
  predictiveInsights: {
    futurePerformance: any[];
    riskFactors: string[];
    proactiveActions: string[];
  };
}

export class PerformanceIntelligenceSystem {
  private performanceModel?: tf.LayersModel;
  private bottleneckDetectionModel?: tf.LayersModel;
  private trendAnalysisModel?: tf.LayersModel;
  private codebaseAnalyzer: WeSignCodebaseAnalyzer;
  private knowledgeService: UnifiedKnowledgeService;
  private aiService: AIService;
  private codeStructure: WeSignCodeStructure | null = null;

  private readonly modelPaths = {
    performance: 'file://./models/performance_model.json',
    bottleneck: 'file://./models/bottleneck_model.json',
    trend: 'file://./models/trend_model.json'
  };

  private metricsHistory: PerformanceMetrics[] = [];
  private realTimeAlerts: RealTimeMonitoringAlert[] = [];
  private readonly alertThresholds = {
    executionTime: { warning: 30000, critical: 60000 }, // ms
    memoryUsage: { warning: 512, critical: 1024 }, // MB
    cpuUsage: { warning: 70, critical: 90 }, // percentage
    networkLatency: { warning: 2000, critical: 5000 }, // ms
    renderingTime: { warning: 3000, critical: 6000 }, // ms
    // WeSign-specific thresholds
    wesignThresholds: {
      hebrewRenderingTime: { warning: 1500, critical: 3000 },
      documentProcessingTime: { warning: 5000, critical: 10000 },
      signatureCanvasInitTime: { warning: 2000, critical: 4000 },
      workflowCompletionTime: { warning: 15000, critical: 30000 },
      uiInteractionLatency: { warning: 500, critical: 1000 },
      authenticationTime: { warning: 3000, critical: 6000 }
    }
  };

  constructor() {
    // Initialize WeSign-aware services
    this.codebaseAnalyzer = new WeSignCodebaseAnalyzer();
    this.knowledgeService = new UnifiedKnowledgeService();
    this.aiService = new AIService();

    // Initialize models and WeSign intelligence
    this.initializeModels();
    this.initializeWeSignPerformanceIntelligence();
  }

  private async initializeModels(): Promise<void> {
    try {
      logger.info('Initializing Performance Intelligence models...');

      // Performance prediction model (Dense Neural Network)
      this.performanceModel = tf.sequential({
        layers: [
          tf.layers.dense({
            units: 128,
            activation: 'relu',
            inputShape: [35] // Performance features
          }),
          tf.layers.dropout({ rate: 0.3 }),
          tf.layers.dense({
            units: 64,
            activation: 'relu'
          }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({
            units: 32,
            activation: 'relu'
          }),
          tf.layers.dense({
            units: 5, // Prediction outputs: exec_time, memory, cpu, network, rendering
            activation: 'linear'
          })
        ]
      });

      this.performanceModel.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'meanSquaredError',
        metrics: ['mae']
      });

      // Bottleneck detection model (Autoencoder + Classification)
      this.bottleneckDetectionModel = tf.sequential({
        layers: [
          tf.layers.dense({
            units: 64,
            activation: 'relu',
            inputShape: [25] // Bottleneck features
          }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({
            units: 32,
            activation: 'relu'
          }),
          tf.layers.dense({
            units: 16,
            activation: 'relu'
          }),
          tf.layers.dense({
            units: 6, // Types of bottlenecks
            activation: 'softmax'
          })
        ]
      });

      this.bottleneckDetectionModel.compile({
        optimizer: tf.train.adam(0.0005),
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
      });

      // Trend analysis model (LSTM for time series)
      this.trendAnalysisModel = tf.sequential({
        layers: [
          tf.layers.lstm({
            units: 50,
            returnSequences: true,
            inputShape: [30, 10] // 30 time steps, 10 features per step
          }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.lstm({
            units: 25,
            returnSequences: false
          }),
          tf.layers.dropout({ rate: 0.1 }),
          tf.layers.dense({
            units: 15,
            activation: 'relu'
          }),
          tf.layers.dense({
            units: 3, // Trend direction: improving, stable, degrading
            activation: 'softmax'
          })
        ]
      });

      this.trendAnalysisModel.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
      });

      logger.info('Performance Intelligence models initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize Performance Intelligence models:', error);
      throw error;
    }
  }

  /**
   * Initialize WeSign-specific performance intelligence
   */
  private async initializeWeSignPerformanceIntelligence(): Promise<void> {
    try {
      logger.info('Initializing WeSign-aware performance intelligence');
      this.codeStructure = await this.codebaseAnalyzer.analyzeFullCodebase();

      logger.info('WeSign performance intelligence initialized', {
        features: this.codeStructure.features.length,
        workflows: this.codeStructure.workflows.length,
        components: this.codeStructure.frontend.components.length,
        controllers: this.codeStructure.backend.controllers.length
      });
    } catch (error) {
      logger.warn('Failed to initialize WeSign performance intelligence:', error);
      // Continue without codebase knowledge - system still functional
    }
  }

  // Main WeSign-aware performance analysis method
  public async analyzePerformance(
    metrics: PerformanceMetrics,
    environment: TestEnvironmentData,
    historicalData?: PerformanceMetrics[]
  ): Promise<{
    performanceScore: number;
    bottlenecks: PerformanceBottleneck[];
    trends: PerformanceTrend[];
    recommendations: OptimizationRecommendation[];
    alerts: RealTimeMonitoringAlert[];
    predictiveInsights: any;
    wesignInsights?: any;
  }> {
    try {
      logger.info('Starting WeSign-aware comprehensive performance analysis', {
        testId: metrics.testId,
        url: metrics.url,
        hasWesignMetrics: !!metrics.wesignMetrics
      });

      // Store metrics for historical analysis
      this.metricsHistory.push(metrics);

      // Keep only last 1000 entries for memory management
      if (this.metricsHistory.length > 1000) {
        this.metricsHistory = this.metricsHistory.slice(-1000);
      }

      // Enhanced parallel analysis execution with WeSign context
      const [
        performanceScore,
        bottlenecks,
        trends,
        alerts,
        predictiveInsights,
        wesignInsights
      ] = await Promise.all([
        this.calculateWeSignAwarePerformanceScore(metrics, environment),
        this.detectWeSignSpecificBottlenecks(metrics, environment),
        this.analyzeWeSignPerformanceTrends(historicalData || this.metricsHistory.slice(-50)),
        this.generateWeSignRealTimeAlerts(metrics, environment),
        this.generateWeSignPredictiveInsights(metrics, environment, this.metricsHistory),
        this.analyzeWeSignSpecificPerformance(metrics, environment)
      ]);

      // Generate WeSign-aware recommendations based on all findings
      const recommendations = await this.generateWeSignOptimizationRecommendations(
        metrics,
        environment,
        bottlenecks,
        trends,
        wesignInsights
      );

      return {
        performanceScore,
        bottlenecks,
        trends,
        recommendations,
        alerts,
        predictiveInsights,
        wesignInsights
      };

    } catch (error) {
      logger.error('WeSign performance analysis failed:', error);
      throw error;
    }
  }

  private async calculatePerformanceScore(
    metrics: PerformanceMetrics,
    environment: TestEnvironmentData
  ): Promise<number> {
    try {
      // Feature extraction for performance scoring
      const features = this.extractPerformanceFeatures(metrics, environment);
      const inputTensor = tf.tensor2d([features]);

      if (!this.performanceModel) {
        throw new Error('Performance model not initialized');
      }

      const prediction = this.performanceModel.predict(inputTensor) as tf.Tensor;
      const predictionData = await prediction.data();

      // Convert predictions to performance score (0-100)
      const normalizedScores = {
        executionTime: Math.max(0, 100 - (predictionData[0] / 1000) * 10),
        memory: Math.max(0, 100 - (predictionData[1] / 10)),
        cpu: Math.max(0, 100 - predictionData[2]),
        network: Math.max(0, 100 - (predictionData[3] / 100) * 10),
        rendering: Math.max(0, 100 - (predictionData[4] / 100) * 10)
      };

      // Weighted average
      const overallScore = (
        normalizedScores.executionTime * 0.3 +
        normalizedScores.memory * 0.2 +
        normalizedScores.cpu * 0.2 +
        normalizedScores.network * 0.15 +
        normalizedScores.rendering * 0.15
      );

      // Cleanup tensors
      inputTensor.dispose();
      prediction.dispose();

      return Math.round(Math.max(0, Math.min(100, overallScore)));

    } catch (error) {
      logger.error('Performance score calculation failed:', error);
      return 50; // Fallback score
    }
  }

  private async detectBottlenecks(
    metrics: PerformanceMetrics,
    environment: TestEnvironmentData
  ): Promise<PerformanceBottleneck[]> {
    try {
      const features = this.extractBottleneckFeatures(metrics, environment);
      const inputTensor = tf.tensor2d([features]);

      if (!this.bottleneckDetectionModel) {
        throw new Error('Bottleneck detection model not initialized');
      }

      const prediction = this.bottleneckDetectionModel.predict(inputTensor) as tf.Tensor;
      const predictionData = await prediction.data();

      const bottleneckTypes = ['network', 'rendering', 'javascript', 'memory', 'dom', 'resource'];
      const bottlenecks: PerformanceBottleneck[] = [];

      // Analyze each bottleneck type probability
      for (let i = 0; i < bottleneckTypes.length; i++) {
        const probability = predictionData[i];
        
        if (probability > 0.6) { // High confidence threshold
          const bottleneck = await this.createBottleneckReport(
            bottleneckTypes[i] as PerformanceBottleneck['type'],
            probability,
            metrics,
            environment
          );
          bottlenecks.push(bottleneck);
        }
      }

      // Sort by impact severity
      bottlenecks.sort((a, b) => {
        const severityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
        return severityWeight[b.severity] - severityWeight[a.severity] || b.impact - a.impact;
      });

      // Cleanup tensors
      inputTensor.dispose();
      prediction.dispose();

      return bottlenecks;

    } catch (error) {
      logger.error('Bottleneck detection failed:', error);
      return [];
    }
  }

  private async analyzeTrends(historicalData: PerformanceMetrics[]): Promise<PerformanceTrend[]> {
    try {
      if (historicalData.length < 10) {
        return []; // Not enough data for trend analysis
      }

      const trends: PerformanceTrend[] = [];
      const timeSeriesData = this.prepareTimeSeriesData(historicalData);
      
      if (timeSeriesData.length < 30) {
        return []; // Need at least 30 data points for LSTM
      }

      const inputTensor = tf.tensor3d([timeSeriesData]);

      if (!this.trendAnalysisModel) {
        throw new Error('Trend analysis model not initialized');
      }

      const prediction = this.trendAnalysisModel.predict(inputTensor) as tf.Tensor;
      const predictionData = await prediction.data();

      const trendClasses = ['improving', 'stable', 'degrading'] as const;
      const dominantTrend = trendClasses[predictionData.indexOf(Math.max(...Array.from(predictionData)))];

      // Calculate trends for different metrics
      const metricKeys: (keyof PerformanceMetrics)[] = [
        'testExecutionTime', 'networkLatency', 'renderingTime', 'domReadyTime', 'fullLoadTime'
      ];

      for (const metric of metricKeys) {
        const metricTrend = this.calculateMetricTrend(historicalData, metric);
        if (metricTrend) {
          trends.push({
            ...metricTrend,
            direction: dominantTrend
          });
        }
      }

      // Cleanup tensors
      inputTensor.dispose();
      prediction.dispose();

      return trends;

    } catch (error) {
      logger.error('Trend analysis failed:', error);
      return [];
    }
  }

  private async generateRealTimeAlerts(
    metrics: PerformanceMetrics,
    environment: TestEnvironmentData
  ): Promise<RealTimeMonitoringAlert[]> {
    const alerts: RealTimeMonitoringAlert[] = [];

    try {
      // Check execution time thresholds
      if (metrics.testExecutionTime > this.alertThresholds.executionTime.critical) {
        alerts.push({
          alertId: `exec-time-critical-${Date.now()}`,
          type: 'performance_degradation',
          severity: 'critical',
          message: `Test execution time extremely high: ${metrics.testExecutionTime}ms`,
          details: { executionTime: metrics.testExecutionTime, threshold: this.alertThresholds.executionTime.critical },
          timestamp: new Date(),
          testContext: {
            testId: metrics.testId,
            url: metrics.url,
            environment
          },
          recommendations: [
            'Review test logic for efficiency improvements',
            'Check for network latency issues',
            'Consider test environment resource constraints'
          ],
          autoResolve: false
        });
      } else if (metrics.testExecutionTime > this.alertThresholds.executionTime.warning) {
        alerts.push({
          alertId: `exec-time-warning-${Date.now()}`,
          type: 'performance_degradation',
          severity: 'warning',
          message: `Test execution time elevated: ${metrics.testExecutionTime}ms`,
          details: { executionTime: metrics.testExecutionTime, threshold: this.alertThresholds.executionTime.warning },
          timestamp: new Date(),
          testContext: {
            testId: metrics.testId,
            url: metrics.url,
            environment
          },
          recommendations: [
            'Monitor for consistent slowdowns',
            'Review recent changes to test environment'
          ],
          autoResolve: true
        });
      }

      // Check memory usage
      if (metrics.memoryCpuUsage.memory > this.alertThresholds.memoryUsage.critical) {
        alerts.push({
          alertId: `memory-critical-${Date.now()}`,
          type: 'resource_exhaustion',
          severity: 'critical',
          message: `Memory usage critical: ${metrics.memoryCpuUsage.memory}MB`,
          details: { memoryUsage: metrics.memoryCpuUsage.memory, threshold: this.alertThresholds.memoryUsage.critical },
          timestamp: new Date(),
          testContext: {
            testId: metrics.testId,
            url: metrics.url,
            environment
          },
          recommendations: [
            'Investigate memory leaks in test application',
            'Optimize test data management',
            'Consider increasing available memory resources'
          ],
          autoResolve: false
        });
      }

      // Check CPU usage
      if (metrics.memoryCpuUsage.cpu > this.alertThresholds.cpuUsage.critical) {
        alerts.push({
          alertId: `cpu-critical-${Date.now()}`,
          type: 'resource_exhaustion',
          severity: 'critical',
          message: `CPU usage critical: ${metrics.memoryCpuUsage.cpu}%`,
          details: { cpuUsage: metrics.memoryCpuUsage.cpu, threshold: this.alertThresholds.cpuUsage.critical },
          timestamp: new Date(),
          testContext: {
            testId: metrics.testId,
            url: metrics.url,
            environment
          },
          recommendations: [
            'Review CPU-intensive test operations',
            'Consider test parallelization adjustments',
            'Check for background processes affecting performance'
          ],
          autoResolve: false
        });
      }

      // Check network latency
      if (metrics.networkLatency > this.alertThresholds.networkLatency.critical) {
        alerts.push({
          alertId: `network-critical-${Date.now()}`,
          type: 'bottleneck_detected',
          severity: 'critical',
          message: `Network latency critical: ${metrics.networkLatency}ms`,
          details: { networkLatency: metrics.networkLatency, threshold: this.alertThresholds.networkLatency.critical },
          timestamp: new Date(),
          testContext: {
            testId: metrics.testId,
            url: metrics.url,
            environment
          },
          recommendations: [
            'Check network connectivity and stability',
            'Review API response times',
            'Consider using local test environments'
          ],
          autoResolve: false
        });
      }

      // Store alerts for historical analysis
      this.realTimeAlerts.push(...alerts);
      
      // Keep only recent alerts (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      this.realTimeAlerts = this.realTimeAlerts.filter(alert => alert.timestamp > oneDayAgo);

      return alerts;

    } catch (error) {
      logger.error('Real-time alert generation failed:', error);
      return alerts;
    }
  }

  private async generateOptimizationRecommendations(
    metrics: PerformanceMetrics,
    environment: TestEnvironmentData,
    bottlenecks: PerformanceBottleneck[],
    trends: PerformanceTrend[]
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    try {
      // High-priority recommendations based on critical bottlenecks
      const criticalBottlenecks = bottlenecks.filter(b => b.severity === 'critical');
      for (const bottleneck of criticalBottlenecks) {
        const recommendation = this.createBottleneckRecommendation(bottleneck);
        if (recommendation) {
          recommendations.push(recommendation);
        }
      }

      // Recommendations based on performance trends
      const degradingTrends = trends.filter(t => t.direction === 'degrading' && t.significance > 0.7);
      for (const trend of degradingTrends) {
        const recommendation = this.createTrendRecommendation(trend);
        if (recommendation) {
          recommendations.push(recommendation);
        }
      }

      // General performance optimization recommendations
      if (metrics.testExecutionTime > 30000) {
        recommendations.push({
          priority: 'high',
          category: 'test-design',
          title: 'Optimize Test Execution Time',
          description: 'Test execution time is significantly above optimal thresholds',
          implementation: {
            effort: 'medium',
            impact: 'high',
            timeframe: '1-2 weeks',
            dependencies: ['Test architecture review', 'Performance profiling tools']
          },
          expectedBenefits: {
            performanceGain: '30-50% faster execution',
            reliabilityImprovement: 'Reduced timeout failures',
            maintainabilityBoost: 'Easier debugging and maintenance'
          },
          technicalDetails: {
            approach: 'Implement parallel test execution and optimize wait strategies',
            codeChanges: [
              'Implement intelligent wait conditions',
              'Add test data caching mechanisms',
              'Optimize selector strategies'
            ],
            configurationChanges: [
              'Adjust timeout configurations',
              'Configure parallel execution limits',
              'Optimize test environment resources'
            ]
          }
        });
      }

      // Network optimization recommendations
      if (metrics.networkLatency > 2000) {
        recommendations.push({
          priority: 'medium',
          category: 'infrastructure',
          title: 'Network Performance Optimization',
          description: 'Network latency is impacting overall test performance',
          implementation: {
            effort: 'medium',
            impact: 'medium',
            timeframe: '2-3 weeks',
            dependencies: ['Infrastructure team coordination', 'CDN configuration']
          },
          expectedBenefits: {
            performanceGain: '20-40% faster network operations',
            reliabilityImprovement: 'Reduced network-related failures',
            maintainabilityBoost: 'More predictable test execution times'
          },
          technicalDetails: {
            approach: 'Implement network optimization strategies and caching',
            infrastructureChanges: [
              'Configure content delivery network (CDN)',
              'Implement request caching strategies',
              'Optimize API endpoint locations'
            ]
          }
        });
      }

      // Sort recommendations by priority and impact
      recommendations.sort((a, b) => {
        const priorityWeight = { high: 3, medium: 2, low: 1 };
        const impactWeight = { high: 3, medium: 2, low: 1 };
        
        const aScore = priorityWeight[a.priority] + impactWeight[a.implementation.impact];
        const bScore = priorityWeight[b.priority] + impactWeight[b.implementation.impact];
        
        return bScore - aScore;
      });

      return recommendations.slice(0, 10); // Return top 10 recommendations

    } catch (error) {
      logger.error('Optimization recommendation generation failed:', error);
      return recommendations;
    }
  }

  private async generatePredictiveInsights(
    metrics: PerformanceMetrics,
    environment: TestEnvironmentData,
    historicalData: PerformanceMetrics[]
  ): Promise<any> {
    try {
      if (historicalData.length < 20) {
        return {
          futurePerformance: [],
          riskFactors: ['Insufficient historical data for accurate predictions'],
          proactiveActions: ['Continue collecting performance metrics for better predictions']
        };
      }

      // Predict future performance trends
      const futurePerformance = this.predictFuturePerformance(historicalData);
      
      // Identify risk factors
      const riskFactors = this.identifyRiskFactors(metrics, environment, historicalData);
      
      // Generate proactive actions
      const proactiveActions = this.generateProactiveActions(futurePerformance, riskFactors);

      return {
        futurePerformance,
        riskFactors,
        proactiveActions
      };

    } catch (error) {
      logger.error('Predictive insights generation failed:', error);
      return {
        futurePerformance: [],
        riskFactors: ['Prediction analysis failed'],
        proactiveActions: ['Review performance monitoring setup']
      };
    }
  }

  // Comprehensive reporting method
  public async generatePerformanceReport(
    timeframe: { start: Date; end: Date }
  ): Promise<PerformanceIntelligenceReport> {
    try {
      const relevantMetrics = this.metricsHistory.filter(
        m => m.timestamp >= timeframe.start && m.timestamp <= timeframe.end
      );

      if (relevantMetrics.length === 0) {
        throw new Error('No performance data available for the specified timeframe');
      }

      // Calculate summary statistics
      const averagePerformance = this.calculateAverageMetrics(relevantMetrics);
      const performanceScore = await this.calculatePerformanceScore(
        averagePerformance,
        { browserType: 'chrome', browserVersion: '120', viewport: { width: 1920, height: 1080 }, deviceType: 'desktop', networkCondition: 'fast', location: 'local', os: 'windows' }
      );

      // Analyze all metrics for comprehensive insights
      const allBottlenecks: PerformanceBottleneck[] = [];
      const allTrends: PerformanceTrend[] = [];
      const allRecommendations: OptimizationRecommendation[] = [];

      // Batch analysis for efficiency
      for (let i = 0; i < relevantMetrics.length; i += 10) {
        const batch = relevantMetrics.slice(i, i + 10);
        const batchAnalysis = await Promise.all(
          batch.map(metric => this.analyzePerformance(
            metric,
            { browserType: 'chrome', browserVersion: '120', viewport: { width: 1920, height: 1080 }, deviceType: 'desktop', networkCondition: 'fast', location: 'local', os: 'windows' },
            relevantMetrics
          ))
        );

        // Aggregate results
        batchAnalysis.forEach(analysis => {
          allBottlenecks.push(...analysis.bottlenecks);
          allTrends.push(...analysis.trends);
          allRecommendations.push(...analysis.recommendations);
        });
      }

      // Deduplicate and prioritize findings
      const criticalBottlenecks = this.deduplicateBottlenecks(allBottlenecks)
        .filter(b => b.severity === 'critical' || b.severity === 'high')
        .slice(0, 5);

      const significantTrends = this.deduplicateTrends(allTrends)
        .filter(t => t.significance > 0.6)
        .slice(0, 5);

      const topRecommendations = this.deduplicateRecommendations(allRecommendations)
        .slice(0, 8);

      const report: PerformanceIntelligenceReport = {
        reportId: `perf-report-${Date.now()}`,
        generatedAt: new Date(),
        timeframe,
        summary: {
          totalTests: relevantMetrics.length,
          averagePerformance,
          performanceScore,
          trendsIdentified: significantTrends.length,
          bottlenecksFound: criticalBottlenecks.length,
          recommendationsGenerated: topRecommendations.length
        },
        keyFindings: {
          criticalBottlenecks,
          significantTrends,
          topRecommendations
        },
        detailedAnalysis: {
          performanceBreakdown: this.calculatePerformanceBreakdown(relevantMetrics),
          environmentalImpact: this.calculateEnvironmentalImpact(relevantMetrics),
          temporalPatterns: this.identifyTemporalPatterns(relevantMetrics),
          comparisonBaselines: this.calculateComparisonBaselines(relevantMetrics)
        },
        predictiveInsights: {
          futurePerformance: this.predictFuturePerformance(relevantMetrics),
          riskFactors: this.identifyRiskFactors(averagePerformance, { browserType: 'chrome', browserVersion: '120', viewport: { width: 1920, height: 1080 }, deviceType: 'desktop', networkCondition: 'fast', location: 'local', os: 'windows' }, relevantMetrics),
          proactiveActions: this.generateProactiveActions([], [])
        }
      };

      return report;

    } catch (error) {
      logger.error('Performance report generation failed:', error);
      throw error;
    }
  }

  // Helper methods for feature extraction
  private extractPerformanceFeatures(metrics: PerformanceMetrics, environment: TestEnvironmentData): number[] {
    const features: number[] = [];
    
    // Time-based features
    features.push(
      metrics.testExecutionTime / 1000, // normalize to seconds
      metrics.networkLatency / 1000,
      metrics.renderingTime / 1000,
      metrics.domReadyTime / 1000,
      metrics.fullLoadTime / 1000
    );
    
    // Resource usage features
    features.push(
      metrics.memoryCpuUsage.memory / 100, // normalize MB to units
      metrics.memoryCpuUsage.cpu / 100 // normalize percentage
    );
    
    // Environment features (encoded)
    features.push(
      environment.viewport.width / 1000,
      environment.viewport.height / 1000,
      environment.deviceType === 'desktop' ? 1 : environment.deviceType === 'tablet' ? 0.5 : 0,
      environment.browserType === 'chrome' ? 1 : environment.browserType === 'firefox' ? 0.8 : 0.6
    );
    
    // Time-based features (hour of day, day of week)
    const timestamp = new Date(metrics.timestamp);
    features.push(
      Math.sin((timestamp.getHours() / 24) * 2 * Math.PI),
      Math.cos((timestamp.getHours() / 24) * 2 * Math.PI),
      Math.sin((timestamp.getDay() / 7) * 2 * Math.PI),
      Math.cos((timestamp.getDay() / 7) * 2 * Math.PI)
    );
    
    // URL complexity features
    const urlComplexity = this.calculateUrlComplexity(metrics.url);
    features.push(...urlComplexity);
    
    // Historical context features (if available)
    const recentMetrics = this.metricsHistory.slice(-5);
    if (recentMetrics.length >= 3) {
      const avgExecTime = recentMetrics.reduce((sum, m) => sum + m.testExecutionTime, 0) / recentMetrics.length;
      const avgMemory = recentMetrics.reduce((sum, m) => sum + m.memoryCpuUsage.memory, 0) / recentMetrics.length;
      features.push(
        avgExecTime / 1000,
        avgMemory / 100,
        metrics.testExecutionTime / avgExecTime, // current vs historical ratio
        metrics.memoryCpuUsage.memory / avgMemory
      );
    } else {
      features.push(0, 0, 1, 1); // neutral values
    }
    
    // Pad or truncate to exactly 35 features
    while (features.length < 35) {
      features.push(0);
    }
    
    return features.slice(0, 35);
  }

  private extractBottleneckFeatures(metrics: PerformanceMetrics, environment: TestEnvironmentData): number[] {
    const features: number[] = [];
    
    // Performance ratios and thresholds
    features.push(
      Math.min(metrics.testExecutionTime / 30000, 2), // execution time ratio
      Math.min(metrics.networkLatency / 2000, 2), // network latency ratio
      Math.min(metrics.renderingTime / 3000, 2), // rendering time ratio
      Math.min(metrics.memoryCpuUsage.memory / 512, 2), // memory usage ratio
      Math.min(metrics.memoryCpuUsage.cpu / 70, 2) // CPU usage ratio
    );
    
    // Performance distribution
    const totalTime = metrics.networkLatency + metrics.renderingTime + metrics.domReadyTime;
    if (totalTime > 0) {
      features.push(
        metrics.networkLatency / totalTime,
        metrics.renderingTime / totalTime,
        metrics.domReadyTime / totalTime
      );
    } else {
      features.push(0, 0, 0);
    }
    
    // Environment stress indicators
    features.push(
      environment.deviceType === 'mobile' ? 1 : 0,
      environment.networkCondition === 'slow' ? 1 : environment.networkCondition === 'fast' ? 0 : 0.5,
      environment.viewport.width < 1024 ? 1 : 0,
      environment.viewport.height < 768 ? 1 : 0
    );
    
    // Temporal patterns
    const hour = new Date(metrics.timestamp).getHours();
    features.push(
      hour >= 9 && hour <= 17 ? 1 : 0, // business hours
      hour >= 0 && hour <= 6 ? 1 : 0 // night hours
    );
    
    // Resource efficiency indicators
    const efficiency = metrics.testExecutionTime > 0 ? (metrics.fullLoadTime / metrics.testExecutionTime) : 1;
    features.push(
      Math.min(efficiency, 2),
      metrics.memoryCpuUsage.memory > 0 ? (metrics.memoryCpuUsage.cpu / metrics.memoryCpuUsage.memory * 100) : 0
    );
    
    // URL and test complexity
    const urlFeatures = this.calculateUrlComplexity(metrics.url);
    features.push(...urlFeatures.slice(0, 3));
    
    // Recent performance context
    if (this.metricsHistory.length >= 3) {
      const recent = this.metricsHistory.slice(-3);
      const avgExecTime = recent.reduce((sum, m) => sum + m.testExecutionTime, 0) / recent.length;
      features.push(metrics.testExecutionTime > avgExecTime * 1.5 ? 1 : 0);
    } else {
      features.push(0);
    }
    
    // Pad to exactly 25 features
    while (features.length < 25) {
      features.push(0);
    }
    
    return features.slice(0, 25);
  }

  private prepareTimeSeriesData(historicalData: PerformanceMetrics[]): number[][] {
    if (historicalData.length < 30) {
      return [];
    }

    const timeSeriesData: number[][] = [];
    const sortedData = historicalData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Create sliding windows of 30 time steps
    for (let i = 0; i <= sortedData.length - 30; i++) {
      const window = sortedData.slice(i, i + 30);
      const windowFeatures = window.map(metrics => [
        metrics.testExecutionTime / 1000,
        metrics.networkLatency / 1000,
        metrics.renderingTime / 1000,
        metrics.memoryCpuUsage.memory / 100,
        metrics.memoryCpuUsage.cpu / 100,
        metrics.domReadyTime / 1000,
        metrics.fullLoadTime / 1000,
        new Date(metrics.timestamp).getHours() / 24,
        new Date(metrics.timestamp).getDay() / 7,
        Math.random() * 0.1 // small noise for regularization
      ]);
      timeSeriesData.push(...windowFeatures);
    }
    
    return timeSeriesData.length >= 30 ? timeSeriesData.slice(0, 30) : [];
  }

  private calculateUrlComplexity(url: string): number[] {
    const features: number[] = [];
    
    try {
      const urlObj = new URL(url);
      
      // Basic URL features
      features.push(
        urlObj.pathname.length / 100, // normalize path length
        urlObj.search.length / 100, // query string length
        (urlObj.pathname.match(/\//g) || []).length / 10, // path depth
        urlObj.hostname.split('.').length / 5, // subdomain count
        urlObj.port ? 1 : 0 // has custom port
      );
      
    } catch (error) {
      // Fallback for invalid URLs
      features.push(
        url.length / 100,
        (url.match(/\?/g) || []).length,
        (url.match(/\//g) || []).length / 10,
        (url.match(/\./g) || []).length / 5,
        0
      );
    }
    
    return features;
  }

  // Additional helper methods for analysis
  private calculateMetricTrend(
    historicalData: PerformanceMetrics[],
    metric: keyof PerformanceMetrics
  ): Omit<PerformanceTrend, 'direction'> | null {
    if (historicalData.length < 5) return null;

    const values = historicalData.map(data => {
      const value = data[metric];
      if (typeof value === 'number') return value;
      if (typeof value === 'object' && value !== null) {
        // Handle nested objects like memoryCpuUsage
        return Object.values(value)[0] as number;
      }
      return 0;
    });

    const timeframe = {
      start: historicalData[0].timestamp,
      end: historicalData[historicalData.length - 1].timestamp
    };

    // Simple linear regression for trend calculation
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, index) => sum + val * index, 0);
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const changeRate = (slope / (sumY / n)) * 100; // percentage change per time unit

    // Calculate significance (R-squared)
    const meanY = sumY / n;
    const ssRes = values.reduce((sum, val, index) => {
      const predicted = meanY + slope * (index - (n - 1) / 2);
      return sum + Math.pow(val - predicted, 2);
    }, 0);
    const ssTot = values.reduce((sum, val) => sum + Math.pow(val - meanY, 2), 0);
    const significance = ssTot > 0 ? 1 - (ssRes / ssTot) : 0;

    return {
      metric,
      changeRate,
      significance: Math.max(0, Math.min(1, significance)),
      timeframe,
      dataPoints: n
    };
  }

  private createBottleneckReport(
    type: PerformanceBottleneck['type'],
    probability: number,
    metrics: PerformanceMetrics,
    environment: TestEnvironmentData
  ): Promise<PerformanceBottleneck> {
    return new Promise((resolve) => {
      const bottleneckDetails = this.getBottleneckDetails(type, metrics, environment);
      
      resolve({
        type,
        severity: probability > 0.9 ? 'critical' : probability > 0.8 ? 'high' : probability > 0.7 ? 'medium' : 'low',
        description: bottleneckDetails.description,
        impact: Math.round(probability * 100),
        location: bottleneckDetails.location,
        suggestedFix: bottleneckDetails.suggestedFix,
        estimatedImprovement: bottleneckDetails.estimatedImprovement,
        confidence: probability
      });
    });
  }

  private getBottleneckDetails(
    type: PerformanceBottleneck['type'],
    metrics: PerformanceMetrics,
    environment: TestEnvironmentData
  ): { description: string; location: any; suggestedFix: string; estimatedImprovement: string } {
    switch (type) {
      case 'network':
        return {
          description: `High network latency detected: ${metrics.networkLatency}ms`,
          location: { url: metrics.url },
          suggestedFix: 'Optimize API calls, implement caching, or improve network infrastructure',
          estimatedImprovement: '20-40% faster load times'
        };
      
      case 'rendering':
        return {
          description: `Slow rendering performance: ${metrics.renderingTime}ms`,
          location: { url: metrics.url },
          suggestedFix: 'Optimize DOM structure, reduce complex CSS, minimize JavaScript blocking',
          estimatedImprovement: '15-30% faster rendering'
        };
      
      case 'memory':
        return {
          description: `High memory usage: ${metrics.memoryCpuUsage.memory}MB`,
          location: { url: metrics.url },
          suggestedFix: 'Optimize memory management, fix memory leaks, reduce object creation',
          estimatedImprovement: '25-50% memory reduction'
        };
      
      case 'javascript':
        return {
          description: `JavaScript execution bottleneck detected`,
          location: { url: metrics.url },
          suggestedFix: 'Optimize JavaScript execution, reduce computational complexity, implement lazy loading',
          estimatedImprovement: '20-35% faster script execution'
        };
      
      case 'dom':
        return {
          description: `DOM processing performance issues: ${metrics.domReadyTime}ms`,
          location: { url: metrics.url },
          suggestedFix: 'Reduce DOM complexity, optimize selector performance, minimize DOM manipulations',
          estimatedImprovement: '15-25% faster DOM operations'
        };
      
      case 'resource':
        return {
          description: `Resource loading bottleneck detected`,
          location: { url: metrics.url },
          suggestedFix: 'Optimize resource loading, implement resource prioritization, use CDN',
          estimatedImprovement: '20-40% faster resource loading'
        };
      
      default:
        return {
          description: 'Performance bottleneck detected',
          location: { url: metrics.url },
          suggestedFix: 'Review performance metrics and optimize accordingly',
          estimatedImprovement: '10-20% general improvement'
        };
    }
  }

  private createBottleneckRecommendation(bottleneck: PerformanceBottleneck): OptimizationRecommendation {
    return {
      priority: bottleneck.severity === 'critical' ? 'high' : bottleneck.severity === 'high' ? 'medium' : 'low',
      category: 'application',
      title: `Resolve ${bottleneck.type} bottleneck`,
      description: bottleneck.description,
      implementation: {
        effort: bottleneck.impact > 80 ? 'high' : bottleneck.impact > 50 ? 'medium' : 'low',
        impact: bottleneck.severity === 'critical' ? 'high' : bottleneck.severity === 'high' ? 'medium' : 'low',
        timeframe: bottleneck.impact > 80 ? '2-3 weeks' : '1-2 weeks',
        dependencies: [`${bottleneck.type} optimization tools`, 'Performance monitoring setup']
      },
      expectedBenefits: {
        performanceGain: bottleneck.estimatedImprovement,
        reliabilityImprovement: `Reduced ${bottleneck.type}-related failures`,
        maintainabilityBoost: 'Improved overall system performance'
      },
      technicalDetails: {
        approach: bottleneck.suggestedFix,
        codeChanges: [`Implement ${bottleneck.type} optimization strategies`]
      }
    };
  }

  private createTrendRecommendation(trend: PerformanceTrend): OptimizationRecommendation {
    return {
      priority: trend.significance > 0.8 ? 'high' : 'medium',
      category: 'test-design',
      title: `Address degrading ${trend.metric} trend`,
      description: `${trend.metric} is degrading at ${trend.changeRate.toFixed(2)}% per time unit`,
      implementation: {
        effort: 'medium',
        impact: trend.significance > 0.8 ? 'high' : 'medium',
        timeframe: '2-4 weeks',
        dependencies: ['Trend analysis tools', 'Historical data review']
      },
      expectedBenefits: {
        performanceGain: 'Stabilize or improve trending metrics',
        reliabilityImprovement: 'Prevent further performance degradation',
        maintainabilityBoost: 'Better long-term system health'
      },
      technicalDetails: {
        approach: `Implement monitoring and optimization for ${trend.metric}`,
        codeChanges: [`Add specific optimizations for ${trend.metric}`]
      }
    };
  }

  private calculateAverageMetrics(metrics: PerformanceMetrics[]): PerformanceMetrics {
    const count = metrics.length;
    return {
      testExecutionTime: metrics.reduce((sum, m) => sum + m.testExecutionTime, 0) / count,
      memoryCpuUsage: {
        memory: metrics.reduce((sum, m) => sum + m.memoryCpuUsage.memory, 0) / count,
        cpu: metrics.reduce((sum, m) => sum + m.memoryCpuUsage.cpu, 0) / count
      },
      networkLatency: metrics.reduce((sum, m) => sum + m.networkLatency, 0) / count,
      renderingTime: metrics.reduce((sum, m) => sum + m.renderingTime, 0) / count,
      domReadyTime: metrics.reduce((sum, m) => sum + m.domReadyTime, 0) / count,
      fullLoadTime: metrics.reduce((sum, m) => sum + m.fullLoadTime, 0) / count,
      timestamp: new Date(),
      testId: 'average',
      url: 'multiple'
    };
  }

  private predictFuturePerformance(historicalData: PerformanceMetrics[]): any[] {
    // Simple trend-based prediction
    const predictions = [];
    const metrics = ['testExecutionTime', 'networkLatency', 'renderingTime'];
    
    for (const metric of metrics) {
      const trend = this.calculateMetricTrend(historicalData, metric as keyof PerformanceMetrics);
      if (trend) {
        predictions.push({
          metric,
          predictedChange: trend.changeRate,
          confidence: trend.significance,
          timeframe: '7-14 days'
        });
      }
    }
    
    return predictions;
  }

  private identifyRiskFactors(
    metrics: PerformanceMetrics,
    environment: TestEnvironmentData,
    historicalData: PerformanceMetrics[]
  ): string[] {
    const risks = [];
    
    if (metrics.testExecutionTime > 45000) {
      risks.push('Extremely high execution times may lead to timeout failures');
    }
    
    if (metrics.memoryCpuUsage.memory > 800) {
      risks.push('High memory usage may cause system instability');
    }
    
    if (metrics.memoryCpuUsage.cpu > 85) {
      risks.push('High CPU usage may impact test reliability');
    }
    
    if (metrics.networkLatency > 3000) {
      risks.push('High network latency may cause network-related test failures');
    }
    
    // Check for increasing trends
    const recentTrend = this.calculateMetricTrend(historicalData.slice(-10), 'testExecutionTime');
    if (recentTrend && recentTrend.changeRate > 10) {
      risks.push('Execution time is trending upward, indicating potential performance degradation');
    }
    
    return risks;
  }

  private generateProactiveActions(futurePerformance: any[], riskFactors: string[]): string[] {
    const actions = [];
    
    if (riskFactors.length > 0) {
      actions.push('Implement performance monitoring alerts for early detection');
      actions.push('Schedule regular performance review sessions');
    }
    
    if (futurePerformance.some(p => p.predictedChange > 15)) {
      actions.push('Plan performance optimization sprint');
      actions.push('Evaluate test infrastructure scaling options');
    }
    
    actions.push('Establish performance baselines and SLA metrics');
    actions.push('Implement automated performance regression detection');
    
    return actions;
  }

  // Deduplication methods
  private deduplicateBottlenecks(bottlenecks: PerformanceBottleneck[]): PerformanceBottleneck[] {
    const unique = new Map<string, PerformanceBottleneck>();
    
    bottlenecks.forEach(bottleneck => {
      const key = `${bottleneck.type}-${bottleneck.location.url}`;
      if (!unique.has(key) || unique.get(key)!.confidence < bottleneck.confidence) {
        unique.set(key, bottleneck);
      }
    });
    
    return Array.from(unique.values());
  }

  private deduplicateTrends(trends: PerformanceTrend[]): PerformanceTrend[] {
    const unique = new Map<string, PerformanceTrend>();
    
    trends.forEach(trend => {
      const key = trend.metric;
      if (!unique.has(key) || unique.get(key)!.significance < trend.significance) {
        unique.set(key, trend);
      }
    });
    
    return Array.from(unique.values());
  }

  private deduplicateRecommendations(recommendations: OptimizationRecommendation[]): OptimizationRecommendation[] {
    const unique = new Map<string, OptimizationRecommendation>();
    
    recommendations.forEach(rec => {
      const key = `${rec.category}-${rec.title}`;
      if (!unique.has(key)) {
        unique.set(key, rec);
      }
    });
    
    return Array.from(unique.values());
  }

  private calculatePerformanceBreakdown(metrics: PerformanceMetrics[]): Record<string, number> {
    const breakdown: Record<string, number> = {};
    
    breakdown.networkTime = metrics.reduce((sum, m) => sum + m.networkLatency, 0) / metrics.length;
    breakdown.renderingTime = metrics.reduce((sum, m) => sum + m.renderingTime, 0) / metrics.length;
    breakdown.domReadyTime = metrics.reduce((sum, m) => sum + m.domReadyTime, 0) / metrics.length;
    breakdown.fullLoadTime = metrics.reduce((sum, m) => sum + m.fullLoadTime, 0) / metrics.length;
    breakdown.executionTime = metrics.reduce((sum, m) => sum + m.testExecutionTime, 0) / metrics.length;
    
    return breakdown;
  }

  private calculateEnvironmentalImpact(metrics: PerformanceMetrics[]): Record<string, PerformanceMetrics> {
    // Group by URL and calculate averages
    const grouped = metrics.reduce((groups, metric) => {
      if (!groups[metric.url]) {
        groups[metric.url] = [];
      }
      groups[metric.url].push(metric);
      return groups;
    }, {} as Record<string, PerformanceMetrics[]>);

    const impact: Record<string, PerformanceMetrics> = {};
    
    Object.keys(grouped).forEach(url => {
      impact[url] = this.calculateAverageMetrics(grouped[url]);
    });
    
    return impact;
  }

  private identifyTemporalPatterns(metrics: PerformanceMetrics[]): any[] {
    const patterns = [];
    
    // Group by hour of day
    const hourlyGroups = metrics.reduce((groups, metric) => {
      const hour = new Date(metric.timestamp).getHours();
      if (!groups[hour]) {
        groups[hour] = [];
      }
      groups[hour].push(metric);
      return groups;
    }, {} as Record<number, PerformanceMetrics[]>);

    // Find patterns in hourly performance
    Object.keys(hourlyGroups).forEach(hour => {
      const hourMetrics = hourlyGroups[parseInt(hour)];
      if (hourMetrics.length >= 3) {
        const avgExecTime = hourMetrics.reduce((sum, m) => sum + m.testExecutionTime, 0) / hourMetrics.length;
        patterns.push({
          type: 'hourly',
          hour: parseInt(hour),
          averageExecutionTime: avgExecTime,
          sampleSize: hourMetrics.length
        });
      }
    });
    
    return patterns;
  }

  private calculateComparisonBaselines(metrics: PerformanceMetrics[]): Record<string, PerformanceMetrics> {
    const baselines: Record<string, PerformanceMetrics> = {};
    
    // Best performance baseline (10th percentile)
    const sortedByExecTime = [...metrics].sort((a, b) => a.testExecutionTime - b.testExecutionTime);
    const bestPerformanceIndex = Math.floor(sortedByExecTime.length * 0.1);
    baselines.best = sortedByExecTime[bestPerformanceIndex];
    
    // Worst performance baseline (90th percentile)
    const worstPerformanceIndex = Math.floor(sortedByExecTime.length * 0.9);
    baselines.worst = sortedByExecTime[worstPerformanceIndex];
    
    // Median performance
    const medianIndex = Math.floor(sortedByExecTime.length * 0.5);
    baselines.median = sortedByExecTime[medianIndex];
    
    return baselines;
  }

  // Model management methods
  public async saveModels(directory: string): Promise<void> {
    try {
      if (this.performanceModel) {
        await this.performanceModel.save(`file://${directory}/performance_model.json`);
      }
      
      if (this.bottleneckDetectionModel) {
        await this.bottleneckDetectionModel.save(`file://${directory}/bottleneck_model.json`);
      }
      
      if (this.trendAnalysisModel) {
        await this.trendAnalysisModel.save(`file://${directory}/trend_model.json`);
      }
      
      logger.info(`Performance Intelligence models saved to ${directory}`);
    } catch (error) {
      logger.error('Failed to save Performance Intelligence models:', error);
      throw error;
    }
  }

  public async loadModels(directory: string): Promise<void> {
    try {
      this.performanceModel = await tf.loadLayersModel(`file://${directory}/performance_model.json`);
      this.bottleneckDetectionModel = await tf.loadLayersModel(`file://${directory}/bottleneck_model.json`);
      this.trendAnalysisModel = await tf.loadLayersModel(`file://${directory}/trend_model.json`);
      
      logger.info(`Performance Intelligence models loaded from ${directory}`);
    } catch (error) {
      logger.error('Failed to load Performance Intelligence models:', error);
      // Fall back to creating new models
      await this.initializeModels();
    }
  }

  public getModelMetrics(): any {
    return {
      performanceModelLayers: this.performanceModel?.layers.length || 0,
      bottleneckModelLayers: this.bottleneckDetectionModel?.layers.length || 0,
      trendModelLayers: this.trendAnalysisModel?.layers.length || 0,
      metricsHistorySize: this.metricsHistory.length,
      activeAlertsCount: this.realTimeAlerts.length,
      lastAnalysisTimestamp: this.metricsHistory.length > 0 ? this.metricsHistory[this.metricsHistory.length - 1].timestamp : null
    };
  }

  // Cleanup method
  public cleanup(): void {
    if (this.performanceModel) {
      this.performanceModel.dispose();
    }
    
    if (this.bottleneckDetectionModel) {
      this.bottleneckDetectionModel.dispose();
    }
    
    if (this.trendAnalysisModel) {
      this.trendAnalysisModel.dispose();
    }
    
    this.metricsHistory = [];
    this.realTimeAlerts = [];
    
    logger.info('Performance Intelligence System cleaned up');
  }
}

export default PerformanceIntelligenceSystem;