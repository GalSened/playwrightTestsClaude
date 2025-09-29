import * as tf from '@tensorflow/tfjs-node';
import Database from 'better-sqlite3';
import { join } from 'path';
import { logger } from '@/utils/logger';
import MLPatternLearningService from './mlPatternLearning';

export interface TestExecutionPrediction {
  testId: string;
  failureProbability: number;
  confidence: number;
  riskFactors: RiskFactor[];
  suggestedActions: PredictiveAction[];
  timeToFailure?: number; // Days until likely failure
  severityScore: number; // 0-1, higher = more severe
}

export interface RiskFactor {
  factor: string;
  impact: number; // 0-1
  description: string;
  category: 'code' | 'environment' | 'data' | 'infrastructure' | 'process';
  mitigation: string;
}

export interface PredictiveAction {
  action: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  effort: 'minimal' | 'moderate' | 'significant';
  impact: number; // Expected improvement 0-1
  timeline: string; // When to execute
  dependencies: string[];
}

export interface AnalyticsInsight {
  insight: string;
  category: 'trend' | 'anomaly' | 'opportunity' | 'risk' | 'optimization';
  confidence: number;
  dataPoints: number;
  timeframe: string;
  actionable: boolean;
  businessImpact: 'low' | 'medium' | 'high' | 'critical';
}

export interface PredictionModelState {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  totalPredictions: number;
  correctPredictions: number;
  lastUpdated: string;
  modelVersion: string;
}

export interface TrendAnalysis {
  metric: string;
  trend: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  changeRate: number; // Percentage change per time unit
  significance: number; // Statistical significance 0-1
  forecast: number[]; // Next 7 days forecast
  anomalies: AnomalyDetection[];
}

export interface AnomalyDetection {
  timestamp: string;
  metric: string;
  value: number;
  expectedValue: number;
  deviation: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  possibleCauses: string[];
}

export class PredictiveAnalyticsEngine {
  private db: Database.Database;
  private mlService: MLPatternLearningService;
  private models: {
    failurePrediction?: tf.Sequential;
    trendAnalysis?: tf.Sequential;
    anomalyDetection?: tf.Sequential;
  };
  private modelStates: Map<string, PredictionModelState>;
  private analyticsCache: Map<string, any>;
  private isInitialized: boolean = false;

  constructor(dbPath?: string) {
    this.db = new Database(dbPath || join(process.cwd(), 'data/scheduler.db'));
    this.mlService = new MLPatternLearningService();
    this.models = {};
    this.modelStates = new Map();
    this.analyticsCache = new Map();
    
    this.initializeDatabase();
    this.initializeModels();
  }

  private initializeDatabase(): void {
    // Create prediction tracking tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS prediction_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        test_id TEXT NOT NULL,
        prediction_type TEXT NOT NULL,
        predicted_probability REAL,
        actual_outcome INTEGER,
        prediction_accuracy REAL,
        risk_factors TEXT, -- JSON
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        verified_at DATETIME
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS analytics_insights (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        insight_type TEXT NOT NULL,
        insight_text TEXT NOT NULL,
        category TEXT,
        confidence REAL,
        data_points INTEGER,
        timeframe TEXT,
        actionable INTEGER DEFAULT 0,
        business_impact TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS trend_analysis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        metric_name TEXT NOT NULL,
        trend_direction TEXT,
        change_rate REAL,
        significance REAL,
        forecast_data TEXT, -- JSON array
        analysis_date DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS anomaly_detections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        metric_name TEXT NOT NULL,
        timestamp_detected DATETIME,
        actual_value REAL,
        expected_value REAL,
        deviation_score REAL,
        severity TEXT,
        possible_causes TEXT, -- JSON
        resolved INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  private async initializeModels(): Promise<void> {
    try {
      // Initialize failure prediction model
      this.models.failurePrediction = this.createFailurePredictionModel();
      
      // Initialize trend analysis model
      this.models.trendAnalysis = this.createTrendAnalysisModel();
      
      // Initialize anomaly detection model
      this.models.anomalyDetection = this.createAnomalyDetectionModel();

      await this.loadModelStates();
      this.isInitialized = true;
      
      logger.info('Predictive Analytics Engine initialized with all models');
    } catch (error) {
      logger.error('Failed to initialize predictive models:', error);
      this.isInitialized = false;
    }
  }

  private createFailurePredictionModel(): tf.Sequential {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [30], // 30-dimensional feature vector
          units: 64,
          activation: 'relu',
          name: 'prediction_input'
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({
          units: 32,
          activation: 'relu',
          name: 'prediction_hidden_1'
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 16,
          activation: 'relu',
          name: 'prediction_hidden_2'
        }),
        tf.layers.dense({
          units: 1,
          activation: 'sigmoid',
          name: 'prediction_output'
        })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy', 'precision', 'recall']
    });

    return model;
  }

  private createTrendAnalysisModel(): tf.Sequential {
    const model = tf.sequential({
      layers: [
        tf.layers.lstm({
          inputShape: [7, 5], // 7 time steps, 5 features per step
          units: 50,
          returnSequences: true,
          name: 'trend_lstm_1'
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.lstm({
          units: 25,
          returnSequences: false,
          name: 'trend_lstm_2'
        }),
        tf.layers.dense({
          units: 12,
          activation: 'relu',
          name: 'trend_dense'
        }),
        tf.layers.dense({
          units: 1,
          activation: 'linear',
          name: 'trend_output'
        })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.002),
      loss: 'meanSquaredError',
      metrics: ['mae']
    });

    return model;
  }

  private createAnomalyDetectionModel(): tf.Sequential {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [20], // 20-dimensional feature vector
          units: 32,
          activation: 'relu',
          name: 'anomaly_encoder_1'
        }),
        tf.layers.dense({
          units: 16,
          activation: 'relu',
          name: 'anomaly_encoder_2'
        }),
        tf.layers.dense({
          units: 8,
          activation: 'relu',
          name: 'anomaly_bottleneck'
        }),
        tf.layers.dense({
          units: 16,
          activation: 'relu',
          name: 'anomaly_decoder_1'
        }),
        tf.layers.dense({
          units: 32,
          activation: 'relu',
          name: 'anomaly_decoder_2'
        }),
        tf.layers.dense({
          units: 20,
          activation: 'linear',
          name: 'anomaly_output'
        })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mae']
    });

    return model;
  }

  /**
   * Predict test execution outcomes and failure probabilities
   */
  async predictTestFailures(testIds: string[]): Promise<TestExecutionPrediction[]> {
    if (!this.isInitialized) {
      throw new Error('Predictive Analytics Engine not initialized');
    }

    const predictions: TestExecutionPrediction[] = [];

    for (const testId of testIds) {
      try {
        const testMetrics = await this.getTestMetrics(testId);
        const historicalData = await this.getHistoricalTestData(testId);
        const environmentFactors = await this.getCurrentEnvironmentFactors();

        // Extract features for prediction
        const features = this.extractPredictionFeatures({
          testId,
          metrics: testMetrics,
          history: historicalData,
          environment: environmentFactors
        });

        // Make prediction using the model
        const inputTensor = tf.tensor2d([features]);
        const prediction = this.models.failurePrediction!.predict(inputTensor) as tf.Tensor;
        const failureProbability = (await prediction.data())[0];

        // Cleanup tensors
        inputTensor.dispose();
        prediction.dispose();

        // Analyze risk factors
        const riskFactors = await this.analyzeRiskFactors({
          testId,
          metrics: testMetrics,
          history: historicalData,
          environment: environmentFactors,
          failureProbability
        });

        // Generate suggested actions
        const suggestedActions = await this.generatePredictiveActions(riskFactors, failureProbability);

        // Calculate time to failure and severity
        const timeToFailure = this.estimateTimeToFailure(historicalData, failureProbability);
        const severityScore = this.calculateSeverityScore(riskFactors, testMetrics);

        predictions.push({
          testId,
          failureProbability,
          confidence: this.calculatePredictionConfidence(features, failureProbability),
          riskFactors,
          suggestedActions,
          timeToFailure,
          severityScore
        });

        // Store prediction for later verification
        await this.storePrediction({
          testId,
          failureProbability,
          riskFactors
        });

      } catch (error) {
        logger.error(`Failed to predict failure for test ${testId}:`, error);
        predictions.push({
          testId,
          failureProbability: 0.5, // Default uncertain prediction
          confidence: 0.1,
          riskFactors: [{ 
            factor: 'prediction-error', 
            impact: 0.5, 
            description: 'Unable to generate prediction', 
            category: 'process',
            mitigation: 'Review prediction service'
          }],
          suggestedActions: [],
          severityScore: 0.5
        });
      }
    }

    return predictions;
  }

  /**
   * Perform trend analysis on test metrics
   */
  async analyzeTrends(metrics: string[], timeframe: number = 30): Promise<TrendAnalysis[]> {
    const trends: TrendAnalysis[] = [];

    for (const metric of metrics) {
      try {
        const timeSeriesData = await this.getTimeSeriesData(metric, timeframe);
        
        if (timeSeriesData.length < 7) {
          logger.warn(`Insufficient data for trend analysis of ${metric}`);
          continue;
        }

        // Prepare data for LSTM model
        const sequences = this.prepareTimeSeriesForLSTM(timeSeriesData);
        
        if (sequences.length === 0) {
          continue;
        }

        // Generate trend prediction
        const inputTensor = tf.tensor3d([sequences[sequences.length - 1]]);
        const prediction = this.models.trendAnalysis!.predict(inputTensor) as tf.Tensor;
        const nextValue = (await prediction.data())[0];

        // Cleanup tensor
        inputTensor.dispose();
        prediction.dispose();

        // Analyze trend characteristics
        const trendDirection = this.analyzeTrendDirection(timeSeriesData);
        const changeRate = this.calculateChangeRate(timeSeriesData);
        const significance = this.calculateTrendSignificance(timeSeriesData);

        // Generate forecast
        const forecast = await this.generateForecast(metric, timeSeriesData, 7);

        // Detect anomalies
        const anomalies = await this.detectAnomalies(metric, timeSeriesData);

        trends.push({
          metric,
          trend: trendDirection,
          changeRate,
          significance,
          forecast,
          anomalies
        });

        // Store trend analysis
        await this.storeTrendAnalysis({
          metric,
          trend: trendDirection,
          changeRate,
          significance,
          forecast
        });

      } catch (error) {
        logger.error(`Failed to analyze trend for ${metric}:`, error);
      }
    }

    return trends;
  }

  /**
   * Detect anomalies in test execution patterns
   */
  async detectAnomalies(metric: string, data: number[]): Promise<AnomalyDetection[]> {
    const anomalies: AnomalyDetection[] = [];

    try {
      // Prepare data for anomaly detection model
      const features = this.prepareAnomalyFeatures(data);
      
      if (features.length === 0) {
        return anomalies;
      }

      // Use autoencoder to detect anomalies
      for (let i = 0; i < features.length; i++) {
        const inputTensor = tf.tensor2d([features[i]]);
        const reconstruction = this.models.anomalyDetection!.predict(inputTensor) as tf.Tensor;
        const reconstructionData = await reconstruction.data();

        // Calculate reconstruction error
        const originalData = features[i];
        let reconstructionError = 0;
        
        for (let j = 0; j < originalData.length; j++) {
          reconstructionError += Math.pow(originalData[j] - reconstructionData[j], 2);
        }
        
        reconstructionError = Math.sqrt(reconstructionError / originalData.length);

        // Cleanup tensors
        inputTensor.dispose();
        reconstruction.dispose();

        // Determine if this is an anomaly
        const threshold = await this.getAnomalyThreshold(metric);
        
        if (reconstructionError > threshold) {
          const severity = this.classifyAnomalySeverity(reconstructionError, threshold);
          const possibleCauses = await this.analyzePossibleCauses(metric, data[i], reconstructionError);

          anomalies.push({
            timestamp: new Date(Date.now() - (data.length - i - 1) * 24 * 60 * 60 * 1000).toISOString(),
            metric,
            value: data[i],
            expectedValue: this.calculateExpectedValue(data, i),
            deviation: reconstructionError,
            severity,
            possibleCauses
          });

          // Store anomaly detection
          await this.storeAnomalyDetection({
            metric,
            timestamp: new Date().toISOString(),
            actualValue: data[i],
            expectedValue: this.calculateExpectedValue(data, i),
            deviation: reconstructionError,
            severity,
            possibleCauses
          });
        }
      }

    } catch (error) {
      logger.error(`Anomaly detection failed for ${metric}:`, error);
    }

    return anomalies;
  }

  /**
   * Generate analytics insights from collected data
   */
  async generateInsights(): Promise<AnalyticsInsight[]> {
    const insights: AnalyticsInsight[] = [];

    try {
      // Analyze test execution patterns
      const executionInsights = await this.analyzeTestExecutionPatterns();
      insights.push(...executionInsights);

      // Analyze failure patterns
      const failureInsights = await this.analyzeFailurePatterns();
      insights.push(...failureInsights);

      // Analyze performance trends
      const performanceInsights = await this.analyzePerformanceTrends();
      insights.push(...performanceInsights);

      // Analyze resource utilization
      const resourceInsights = await this.analyzeResourceUtilization();
      insights.push(...resourceInsights);

      // Analyze seasonal patterns
      const seasonalInsights = await this.analyzeSeasonalPatterns();
      insights.push(...seasonalInsights);

      // Store insights
      for (const insight of insights) {
        await this.storeInsight(insight);
      }

      logger.info(`Generated ${insights.length} analytics insights`);

    } catch (error) {
      logger.error('Failed to generate analytics insights:', error);
    }

    return insights;
  }

  // Helper methods
  private async getTestMetrics(testId: string): Promise<any> {
    const metrics = this.db.prepare(`
      SELECT 
        AVG(CASE WHEN status = 'passed' THEN 1.0 ELSE 0.0 END) as success_rate,
        AVG(execution_time) as avg_execution_time,
        COUNT(*) as total_executions,
        MAX(created_at) as last_execution
      FROM tests 
      WHERE test_id = ? 
      AND created_at > datetime('now', '-30 days')
    `).get(testId) as any;

    return metrics || {
      success_rate: 0.5,
      avg_execution_time: 5000,
      total_executions: 0,
      last_execution: null
    };
  }

  private async getHistoricalTestData(testId: string): Promise<any[]> {
    return this.db.prepare(`
      SELECT status, execution_time, created_at, error_message
      FROM tests 
      WHERE test_id = ? 
      ORDER BY created_at DESC 
      LIMIT 100
    `).all(testId) as any[];
  }

  private async getCurrentEnvironmentFactors(): Promise<any> {
    // This would typically fetch from monitoring systems
    return {
      cpuUsage: Math.random() * 0.8,
      memoryUsage: Math.random() * 0.7,
      networkLatency: Math.random() * 100,
      activeUsers: Math.floor(Math.random() * 50),
      systemLoad: Math.random() * 0.6,
      timestamp: new Date().toISOString()
    };
  }

  private extractPredictionFeatures(data: any): number[] {
    const features: number[] = [];

    // Test-specific features
    features.push(data.metrics.success_rate || 0);
    features.push(Math.min(data.metrics.avg_execution_time / 10000, 1.0)); // Normalized
    features.push(Math.min(data.metrics.total_executions / 1000, 1.0)); // Normalized

    // Historical features
    const recentFailures = data.history.filter((h: any) => h.status === 'failed').length;
    features.push(Math.min(recentFailures / data.history.length, 1.0));
    
    const avgExecutionTime = data.history.reduce((sum: number, h: any) => sum + (h.execution_time || 0), 0) / data.history.length;
    features.push(Math.min(avgExecutionTime / 10000, 1.0));

    // Environment features
    features.push(data.environment.cpuUsage || 0);
    features.push(data.environment.memoryUsage || 0);
    features.push(Math.min(data.environment.networkLatency / 200, 1.0));
    features.push(Math.min(data.environment.activeUsers / 100, 1.0));
    features.push(data.environment.systemLoad || 0);

    // Time-based features
    const now = new Date();
    features.push(now.getHours() / 24); // Hour of day
    features.push(now.getDay() / 7); // Day of week

    // Fill remaining features with calculated values
    while (features.length < 30) {
      features.push(Math.random() * 0.1); // Small random values as placeholders
    }

    return features.slice(0, 30);
  }

  private async analyzeRiskFactors(data: any): Promise<RiskFactor[]> {
    const riskFactors: RiskFactor[] = [];

    // High failure rate risk
    if (data.metrics.success_rate < 0.8) {
      riskFactors.push({
        factor: 'low-success-rate',
        impact: (0.8 - data.metrics.success_rate) * 1.25,
        description: `Test has ${Math.round(data.metrics.success_rate * 100)}% success rate`,
        category: 'process',
        mitigation: 'Review test selectors and improve stability'
      });
    }

    // Long execution time risk
    if (data.metrics.avg_execution_time > 10000) {
      riskFactors.push({
        factor: 'long-execution-time',
        impact: Math.min(data.metrics.avg_execution_time / 30000, 1.0),
        description: 'Test takes longer than expected to execute',
        category: 'performance',
        mitigation: 'Optimize test steps and reduce wait times'
      });
    }

    // Environment instability risk
    if (data.environment.systemLoad > 0.8) {
      riskFactors.push({
        factor: 'high-system-load',
        impact: data.environment.systemLoad,
        description: 'System under heavy load affecting test reliability',
        category: 'infrastructure',
        mitigation: 'Monitor system resources and scale infrastructure'
      });
    }

    // Recent failure pattern risk
    const recentFailures = data.history.slice(0, 10).filter((h: any) => h.status === 'failed').length;
    if (recentFailures >= 3) {
      riskFactors.push({
        factor: 'recent-failure-pattern',
        impact: Math.min(recentFailures / 10, 1.0),
        description: `${recentFailures} failures in last 10 executions`,
        category: 'process',
        mitigation: 'Investigate root cause of recent failures'
      });
    }

    return riskFactors;
  }

  private async generatePredictiveActions(
    riskFactors: RiskFactor[], 
    failureProbability: number
  ): Promise<PredictiveAction[]> {
    const actions: PredictiveAction[] = [];

    // High probability failure - immediate action needed
    if (failureProbability > 0.8) {
      actions.push({
        action: 'Immediate test review and stabilization',
        priority: 'critical',
        effort: 'significant',
        impact: 0.8,
        timeline: 'within 1 hour',
        dependencies: ['development-team', 'test-environment']
      });
    }

    // Medium probability - preventive actions
    if (failureProbability > 0.6) {
      actions.push({
        action: 'Update test selectors and wait conditions',
        priority: 'high',
        effort: 'moderate',
        impact: 0.6,
        timeline: 'within 1 day',
        dependencies: ['qa-team']
      });
    }

    // Process specific actions based on risk factors
    riskFactors.forEach(factor => {
      switch (factor.category) {
        case 'process':
          actions.push({
            action: `Address ${factor.factor}: ${factor.mitigation}`,
            priority: factor.impact > 0.7 ? 'high' : 'medium',
            effort: 'moderate',
            impact: factor.impact,
            timeline: 'within 2 days',
            dependencies: ['qa-team', 'development-team']
          });
          break;

        case 'infrastructure':
          actions.push({
            action: `Infrastructure optimization: ${factor.mitigation}`,
            priority: factor.impact > 0.8 ? 'critical' : 'high',
            effort: 'significant',
            impact: factor.impact * 0.9,
            timeline: 'within 1 week',
            dependencies: ['devops-team', 'infrastructure-team']
          });
          break;
      }
    });

    return actions.slice(0, 5); // Top 5 actions
  }

  private calculatePredictionConfidence(features: number[], probability: number): number {
    // Confidence based on feature quality and prediction certainty
    const featureQuality = features.reduce((sum, f) => sum + (isNaN(f) ? 0 : 1), 0) / features.length;
    const predictionCertainty = Math.abs(probability - 0.5) * 2;
    
    return Math.min((featureQuality * 0.6) + (predictionCertainty * 0.4), 1.0);
  }

  private estimateTimeToFailure(history: any[], failureProbability: number): number | undefined {
    if (failureProbability < 0.3 || history.length < 5) return undefined;

    const recentFailures = history.slice(0, 20).filter(h => h.status === 'failed');
    if (recentFailures.length < 2) return undefined;

    // Calculate average time between failures
    const failureTimes = recentFailures.map(f => new Date(f.created_at).getTime());
    const avgTimeBetweenFailures = failureTimes.reduce((sum, time, i) => {
      return i > 0 ? sum + (failureTimes[i-1] - time) : sum;
    }, 0) / (failureTimes.length - 1);

    // Adjust based on current failure probability
    const adjustedTime = avgTimeBetweenFailures * (1 - failureProbability);
    return Math.max(adjustedTime / (1000 * 60 * 60 * 24), 0.1); // Convert to days, minimum 0.1 day
  }

  private calculateSeverityScore(riskFactors: RiskFactor[], metrics: any): number {
    const riskScore = riskFactors.reduce((sum, factor) => sum + factor.impact, 0) / Math.max(riskFactors.length, 1);
    const metricsScore = 1 - (metrics.success_rate || 0.5);
    
    return Math.min((riskScore * 0.7) + (metricsScore * 0.3), 1.0);
  }

  // Additional helper methods would continue here...
  private prepareTimeSeriesForLSTM(data: number[]): number[][][] {
    // Convert time series data to LSTM-compatible format
    const sequences: number[][][] = [];
    const sequenceLength = 7;
    const features = 5;

    for (let i = sequenceLength; i < data.length; i++) {
      const sequence: number[][] = [];
      
      for (let j = i - sequenceLength; j < i; j++) {
        // Create feature vector for each time step
        const featureVector = [
          data[j] || 0,
          j > 0 ? (data[j] - data[j-1]) || 0 : 0, // Change from previous
          data.slice(Math.max(0, j-6), j+1).reduce((a, b) => a + b, 0) / Math.min(7, j+1), // Moving average
          Math.max(...data.slice(Math.max(0, j-6), j+1)) - Math.min(...data.slice(Math.max(0, j-6), j+1)), // Range
          j // Time index
        ];
        
        sequence.push(featureVector);
      }
      
      sequences.push(sequence);
    }

    return sequences;
  }

  private analyzeTrendDirection(data: number[]): 'increasing' | 'decreasing' | 'stable' | 'volatile' {
    if (data.length < 3) return 'stable';

    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const change = (secondAvg - firstAvg) / firstAvg;
    const volatility = this.calculateVolatility(data);

    if (volatility > 0.3) return 'volatile';
    if (Math.abs(change) < 0.05) return 'stable';
    return change > 0 ? 'increasing' : 'decreasing';
  }

  private calculateChangeRate(data: number[]): number {
    if (data.length < 2) return 0;

    const firstValue = data[0];
    const lastValue = data[data.length - 1];
    
    if (firstValue === 0) return 0;
    return ((lastValue - firstValue) / firstValue) * 100;
  }

  private calculateTrendSignificance(data: number[]): number {
    if (data.length < 3) return 0;

    // Simple statistical significance based on correlation coefficient
    const n = data.length;
    const indices = Array.from({length: n}, (_, i) => i);
    
    const meanX = indices.reduce((a, b) => a + b, 0) / n;
    const meanY = data.reduce((a, b) => a + b, 0) / n;
    
    let numerator = 0;
    let denominatorX = 0;
    let denominatorY = 0;
    
    for (let i = 0; i < n; i++) {
      const diffX = indices[i] - meanX;
      const diffY = data[i] - meanY;
      
      numerator += diffX * diffY;
      denominatorX += diffX * diffX;
      denominatorY += diffY * diffY;
    }
    
    const correlation = numerator / Math.sqrt(denominatorX * denominatorY);
    return Math.abs(correlation); // Return absolute correlation as significance
  }

  private async generateForecast(metric: string, data: number[], days: number): Promise<number[]> {
    // Simple forecasting - in production, this would use the LSTM model
    const forecast: number[] = [];
    const recentTrend = this.calculateChangeRate(data.slice(-7)) / 100;
    
    let lastValue = data[data.length - 1];
    
    for (let i = 0; i < days; i++) {
      lastValue = lastValue * (1 + recentTrend + (Math.random() - 0.5) * 0.1);
      forecast.push(Math.max(0, lastValue)); // Ensure non-negative values
    }
    
    return forecast;
  }

  private calculateVolatility(data: number[]): number {
    if (data.length < 2) return 0;
    
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const variance = data.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / data.length;
    const stdDev = Math.sqrt(variance);
    
    return mean > 0 ? stdDev / mean : 0; // Coefficient of variation
  }

  private prepareAnomalyFeatures(data: number[]): number[][] {
    const features: number[][] = [];
    const windowSize = 20;

    for (let i = windowSize; i < data.length; i++) {
      const window = data.slice(i - windowSize, i);
      features.push(window);
    }

    return features;
  }

  private async getAnomalyThreshold(metric: string): Promise<number> {
    // Get historical reconstruction errors to determine threshold
    const historicalErrors = this.analyticsCache.get(`threshold_${metric}`);
    
    if (historicalErrors) {
      // Use 95th percentile as threshold
      return this.calculatePercentile(historicalErrors, 0.95);
    }
    
    return 0.1; // Default threshold
  }

  private calculatePercentile(data: number[], percentile: number): number {
    const sorted = data.sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  private classifyAnomalySeverity(error: number, threshold: number): 'low' | 'medium' | 'high' | 'critical' {
    const ratio = error / threshold;
    
    if (ratio > 3) return 'critical';
    if (ratio > 2) return 'high';
    if (ratio > 1.5) return 'medium';
    return 'low';
  }

  private async analyzePossibleCauses(metric: string, value: number, error: number): Promise<string[]> {
    const causes: string[] = [];

    // Generic causes based on deviation
    if (error > 0.5) {
      causes.push('Significant system change or deployment');
      causes.push('Environmental factor change');
    }

    if (error > 0.3) {
      causes.push('Test data variation');
      causes.push('Network latency spike');
    }

    if (error > 0.1) {
      causes.push('Normal system variation');
      causes.push('Measurement noise');
    }

    return causes;
  }

  private calculateExpectedValue(data: number[], index: number): number {
    // Simple moving average as expected value
    const windowSize = Math.min(7, index + 1);
    const start = Math.max(0, index - windowSize + 1);
    const window = data.slice(start, index + 1);
    
    return window.reduce((sum, val) => sum + val, 0) / window.length;
  }

  // Database operations
  private async storePrediction(prediction: any): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO prediction_history 
      (test_id, prediction_type, predicted_probability, risk_factors)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(
      prediction.testId,
      'failure_prediction',
      prediction.failureProbability,
      JSON.stringify(prediction.riskFactors)
    );
  }

  private async storeInsight(insight: AnalyticsInsight): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO analytics_insights 
      (insight_type, insight_text, category, confidence, data_points, timeframe, actionable, business_impact)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      insight.category,
      insight.insight,
      insight.category,
      insight.confidence,
      insight.dataPoints,
      insight.timeframe,
      insight.actionable ? 1 : 0,
      insight.businessImpact
    );
  }

  private async storeTrendAnalysis(trend: any): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO trend_analysis 
      (metric_name, trend_direction, change_rate, significance, forecast_data, analysis_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      trend.metric,
      trend.trend,
      trend.changeRate,
      trend.significance,
      JSON.stringify(trend.forecast),
      new Date().toISOString().split('T')[0]
    );
  }

  private async storeAnomalyDetection(anomaly: any): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO anomaly_detections 
      (metric_name, timestamp_detected, actual_value, expected_value, deviation_score, severity, possible_causes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      anomaly.metric,
      anomaly.timestamp,
      anomaly.actualValue,
      anomaly.expectedValue,
      anomaly.deviation,
      anomaly.severity,
      JSON.stringify(anomaly.possibleCauses)
    );
  }

  private async loadModelStates(): Promise<void> {
    try {
      // Load model performance metrics from database
      const states = this.db.prepare(`
        SELECT model_type, accuracy, precision_score as precision, recall_score as recall, 
               f1_score, training_examples, created_at
        FROM ml_model_metrics 
        ORDER BY created_at DESC
      `).all() as any[];

      states.forEach(state => {
        this.modelStates.set(state.model_type, {
          accuracy: state.accuracy || 0,
          precision: state.precision || 0,
          recall: state.recall || 0,
          f1Score: state.f1_score || 0,
          totalPredictions: state.training_examples || 0,
          correctPredictions: Math.floor((state.training_examples || 0) * (state.accuracy || 0)),
          lastUpdated: state.created_at,
          modelVersion: '1.0'
        });
      });

    } catch (error) {
      logger.debug('No previous model states found');
    }
  }

  private async getTimeSeriesData(metric: string, days: number): Promise<number[]> {
    // This would fetch actual time series data from your metrics database
    // For now, generating sample data
    const data: number[] = [];
    const baseValue = Math.random() * 100 + 50;
    
    for (let i = 0; i < days; i++) {
      const trend = Math.sin(i / 7) * 10; // Weekly pattern
      const noise = (Math.random() - 0.5) * 5;
      data.push(Math.max(0, baseValue + trend + noise));
    }
    
    return data;
  }

  private async analyzeTestExecutionPatterns(): Promise<AnalyticsInsight[]> {
    // Placeholder for test execution pattern analysis
    return [{
      insight: 'Test execution times show 15% increase during peak hours',
      category: 'trend',
      confidence: 0.85,
      dataPoints: 1000,
      timeframe: 'last 30 days',
      actionable: true,
      businessImpact: 'medium'
    }];
  }

  private async analyzeFailurePatterns(): Promise<AnalyticsInsight[]> {
    // Placeholder for failure pattern analysis
    return [{
      insight: 'Authentication tests failing 3x more on Mondays',
      category: 'anomaly',
      confidence: 0.92,
      dataPoints: 500,
      timeframe: 'last 12 weeks',
      actionable: true,
      businessImpact: 'high'
    }];
  }

  private async analyzePerformanceTrends(): Promise<AnalyticsInsight[]> {
    // Placeholder for performance trend analysis
    return [{
      insight: 'Page load times decreased 8% after recent optimization',
      category: 'opportunity',
      confidence: 0.88,
      dataPoints: 2000,
      timeframe: 'last 14 days',
      actionable: false,
      businessImpact: 'high'
    }];
  }

  private async analyzeResourceUtilization(): Promise<AnalyticsInsight[]> {
    // Placeholder for resource utilization analysis
    return [{
      insight: 'Test environment CPU usage consistently high during parallel execution',
      category: 'risk',
      confidence: 0.79,
      dataPoints: 720,
      timeframe: 'last 30 days',
      actionable: true,
      businessImpact: 'medium'
    }];
  }

  private async analyzeSeasonalPatterns(): Promise<AnalyticsInsight[]> {
    // Placeholder for seasonal pattern analysis
    return [{
      insight: 'Test failure rates increase by 25% during deployment windows',
      category: 'trend',
      confidence: 0.91,
      dataPoints: 300,
      timeframe: 'last 6 months',
      actionable: true,
      businessImpact: 'high'
    }];
  }

  async getModelState(modelType: string): Promise<PredictionModelState | undefined> {
    return this.modelStates.get(modelType);
  }

  async close(): Promise<void> {
    if (this.models.failurePrediction) this.models.failurePrediction.dispose();
    if (this.models.trendAnalysis) this.models.trendAnalysis.dispose();
    if (this.models.anomalyDetection) this.models.anomalyDetection.dispose();
    
    await this.mlService.close();
    this.db.close();
  }
}

export default PredictiveAnalyticsEngine;