import { logger } from '@/utils/logger';
import { ChatOpenAI } from '@langchain/openai';
import Database from 'better-sqlite3';
import { join } from 'path';

interface TestExecution {
  runId: string;
  suite: string;
  language: string;
  browser: string;
  status: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  duration: number;
  startTime: string;
  endTime: string;
}

interface FailurePrediction {
  testSuite: string;
  browser: string;
  language: string;
  failureProbability: number;
  confidence: number;
  riskFactors: string[];
  recommendations: string[];
  historicalPattern: string;
  nextRunPrediction: {
    expectedDuration: number;
    expectedFailures: number;
    criticalAreas: string[];
  };
}

interface PredictiveInsight {
  type: 'trend' | 'anomaly' | 'pattern' | 'recommendation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  data: any;
  confidence: number;
  actionable: boolean;
  recommendations: string[];
}

export class PredictiveFailureAnalysis {
  private llm: ChatOpenAI;
  private db: Database.Database;

  constructor() {
    // Initialize OpenAI for AI-powered analysis
    if (process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('placeholder')) {
      this.llm = new ChatOpenAI({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: 'gpt-4o',
        temperature: 0.1, // Low temperature for analytical consistency
        maxTokens: 2000
      });
    }

    // Connect to analytics database
    this.db = new Database(join(process.cwd(), 'data/realtime-analytics.db'));
  }

  /**
   * Analyze historical test data to predict failure patterns
   */
  async predictFailures(timeframeDays: number = 30): Promise<FailurePrediction[]> {
    try {
      logger.info('Starting predictive failure analysis', { timeframeDays });

      // Get historical test execution data
      const historicalData = this.getHistoricalTestData(timeframeDays);

      if (historicalData.length === 0) {
        logger.warn('No historical data available for prediction');
        return [];
      }

      // Group by test suite, browser, and language combinations
      const testGroups = this.groupTestExecutions(historicalData);

      const predictions: FailurePrediction[] = [];

      for (const [key, executions] of testGroups) {
        const [suite, browser, language] = key.split('|');

        // Calculate failure statistics
        const failureStats = this.calculateFailureStatistics(executions);

        // Generate AI-powered prediction
        const prediction = await this.generateFailurePrediction(
          suite, browser, language, executions, failureStats
        );

        predictions.push(prediction);
      }

      // Sort by failure probability (highest risk first)
      predictions.sort((a, b) => b.failureProbability - a.failureProbability);

      logger.info('Predictive analysis completed', {
        predictionsGenerated: predictions.length,
        avgFailureProbability: predictions.reduce((sum, p) => sum + p.failureProbability, 0) / predictions.length
      });

      return predictions;

    } catch (error) {
      logger.error('Predictive failure analysis failed:', error);
      throw error;
    }
  }

  /**
   * Generate predictive insights for dashboard
   */
  async generatePredictiveInsights(): Promise<PredictiveInsight[]> {
    try {
      const insights: PredictiveInsight[] = [];

      // Analyze recent trends
      const trendInsight = await this.analyzeTrends();
      if (trendInsight) insights.push(trendInsight);

      // Detect anomalies
      const anomalies = await this.detectAnomalies();
      insights.push(...anomalies);

      // Pattern recognition
      const patterns = await this.recognizePatterns();
      insights.push(...patterns);

      // Strategic recommendations
      const recommendations = await this.generateRecommendations();
      insights.push(...recommendations);

      // Sort by severity and confidence
      insights.sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        if (severityOrder[b.severity] !== severityOrder[a.severity]) {
          return severityOrder[b.severity] - severityOrder[a.severity];
        }
        return b.confidence - a.confidence;
      });

      return insights.slice(0, 10); // Return top 10 insights

    } catch (error) {
      logger.error('Failed to generate predictive insights:', error);
      return [];
    }
  }

  /**
   * Get historical test execution data
   */
  private getHistoricalTestData(days: number): TestExecution[] {
    const stmt = this.db.prepare(`
      SELECT
        run_id, suite, language, browser, status,
        total_tests, passed_tests, failed_tests, skipped_tests,
        duration, start_time, end_time
      FROM test_executions
      WHERE start_time >= datetime('now', '-${days} days')
      AND status IN ('completed', 'failed')
      ORDER BY start_time DESC
    `);

    return stmt.all() as TestExecution[];
  }

  /**
   * Group test executions by suite, browser, and language
   */
  private groupTestExecutions(executions: TestExecution[]): Map<string, TestExecution[]> {
    const groups = new Map<string, TestExecution[]>();

    for (const execution of executions) {
      const key = `${execution.suite}|${execution.browser}|${execution.language}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(execution);
    }

    return groups;
  }

  /**
   * Calculate failure statistics for a group of executions
   */
  private calculateFailureStatistics(executions: TestExecution[]) {
    const totalExecutions = executions.length;
    const failedExecutions = executions.filter(e => e.status === 'failed').length;
    const failureRate = totalExecutions > 0 ? failedExecutions / totalExecutions : 0;

    const avgDuration = executions.reduce((sum, e) => sum + (e.duration || 0), 0) / totalExecutions;
    const avgFailedTests = executions.reduce((sum, e) => sum + e.failedTests, 0) / totalExecutions;

    // Calculate trend (recent vs older executions)
    const recentExecutions = executions.slice(0, Math.ceil(totalExecutions / 3));
    const recentFailureRate = recentExecutions.length > 0
      ? recentExecutions.filter(e => e.status === 'failed').length / recentExecutions.length
      : 0;

    const trend = recentFailureRate > failureRate ? 'increasing' :
                  recentFailureRate < failureRate ? 'decreasing' : 'stable';

    return {
      totalExecutions,
      failedExecutions,
      failureRate,
      avgDuration,
      avgFailedTests,
      recentFailureRate,
      trend
    };
  }

  /**
   * Generate AI-powered failure prediction
   */
  private async generateFailurePrediction(
    suite: string,
    browser: string,
    language: string,
    executions: TestExecution[],
    stats: any
  ): Promise<FailurePrediction> {

    // Base prediction using statistical analysis
    let failureProbability = Math.min(stats.failureRate * 100, 95); // Cap at 95%

    // Adjust based on trend
    if (stats.trend === 'increasing') {
      failureProbability = Math.min(failureProbability * 1.3, 95);
    } else if (stats.trend === 'decreasing') {
      failureProbability = Math.max(failureProbability * 0.7, 5);
    }

    // Calculate confidence based on data size and consistency
    const confidence = Math.min(
      (stats.totalExecutions / 10) * 0.8 + 0.2, // More executions = higher confidence
      1.0
    );

    const riskFactors: string[] = [];
    const recommendations: string[] = [];

    // Identify risk factors
    if (stats.failureRate > 0.3) {
      riskFactors.push('High historical failure rate');
      recommendations.push('Investigate recurring test failures in this configuration');
    }

    if (stats.trend === 'increasing') {
      riskFactors.push('Increasing failure trend');
      recommendations.push('Monitor recent changes that may be causing regression');
    }

    if (browser === 'firefox' && stats.failureRate > 0.2) {
      riskFactors.push('Firefox compatibility issues');
      recommendations.push('Review Firefox-specific test implementations');
    }

    if (language === 'hebrew' && stats.failureRate > 0.25) {
      riskFactors.push('Hebrew language processing issues');
      recommendations.push('Verify Hebrew text handling and RTL layout tests');
    }

    // Generate AI-powered analysis if available
    let historicalPattern = `Failure rate: ${(stats.failureRate * 100).toFixed(1)}%, Trend: ${stats.trend}`;

    if (this.llm && stats.totalExecutions >= 5) {
      try {
        const aiAnalysis = await this.getAIAnalysis(suite, browser, language, executions, stats);
        if (aiAnalysis) {
          historicalPattern = aiAnalysis.pattern;
          recommendations.push(...aiAnalysis.recommendations);
          riskFactors.push(...aiAnalysis.riskFactors);
        }
      } catch (error) {
        logger.warn('AI analysis failed, using statistical analysis only:', error);
      }
    }

    return {
      testSuite: suite,
      browser,
      language,
      failureProbability: Number(failureProbability.toFixed(1)),
      confidence: Number((confidence * 100).toFixed(1)),
      riskFactors,
      recommendations,
      historicalPattern,
      nextRunPrediction: {
        expectedDuration: Math.round(stats.avgDuration),
        expectedFailures: Math.round(stats.avgFailedTests),
        criticalAreas: this.identifyCriticalAreas(suite, executions)
      }
    };
  }

  /**
   * Get AI-powered analysis of test patterns
   */
  private async getAIAnalysis(
    suite: string,
    browser: string,
    language: string,
    executions: TestExecution[],
    stats: any
  ): Promise<{ pattern: string; recommendations: string[]; riskFactors: string[] } | null> {

    const prompt = `Analyze this WeSign test execution pattern for predictive insights:

Test Configuration:
- Suite: ${suite}
- Browser: ${browser}
- Language: ${language}

Historical Data (last ${executions.length} executions):
- Total executions: ${stats.totalExecutions}
- Failed executions: ${stats.failedExecutions}
- Failure rate: ${(stats.failureRate * 100).toFixed(1)}%
- Average duration: ${Math.round(stats.avgDuration)}ms
- Average failed tests per run: ${stats.avgFailedTests.toFixed(1)}
- Recent trend: ${stats.trend}

Recent execution timeline:
${executions.slice(0, 5).map(e =>
  `- ${e.startTime}: ${e.status} (${e.failedTests}/${e.totalTests} failed, ${e.duration}ms)`
).join('\n')}

Provide analysis in this JSON format:
{
  "pattern": "Brief description of the failure pattern",
  "recommendations": ["recommendation1", "recommendation2"],
  "riskFactors": ["risk1", "risk2"]
}

Focus on WeSign-specific issues: authentication, document workflows, Hebrew/English UI, signing processes.`;

    try {
      const response = await this.llm.invoke(prompt);
      const content = response.content as string;

      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return null;
    } catch (error) {
      logger.warn('AI analysis parsing failed:', error);
      return null;
    }
  }

  /**
   * Identify critical areas based on execution history
   */
  private identifyCriticalAreas(suite: string, executions: TestExecution[]): string[] {
    const areas: string[] = [];

    // Analyze based on suite type
    switch (suite) {
      case 'auth':
        areas.push('Login validation', 'Session management');
        break;
      case 'documents':
        areas.push('Document upload', 'File processing');
        break;
      case 'signing':
        areas.push('Signature placement', 'Workflow completion');
        break;
      case 'contacts':
        areas.push('Contact validation', 'Email verification');
        break;
      case 'templates':
        areas.push('Template rendering', 'Field mapping');
        break;
      default:
        areas.push('Core functionality', 'Integration points');
    }

    return areas;
  }

  /**
   * Analyze trends in test execution data
   */
  private async analyzeTrends(): Promise<PredictiveInsight | null> {
    const recentData = this.getHistoricalTestData(7); // Last 7 days
    const olderData = this.getHistoricalTestData(14).slice(recentData.length); // Previous 7 days

    if (recentData.length === 0 || olderData.length === 0) {
      return null;
    }

    const recentFailureRate = recentData.filter(e => e.status === 'failed').length / recentData.length;
    const olderFailureRate = olderData.filter(e => e.status === 'failed').length / olderData.length;

    const trendChange = ((recentFailureRate - olderFailureRate) / (olderFailureRate || 0.01)) * 100;

    if (Math.abs(trendChange) > 20) { // Significant change
      return {
        type: 'trend',
        severity: Math.abs(trendChange) > 50 ? 'high' : 'medium',
        title: trendChange > 0 ? 'Increasing Failure Rate Detected' : 'Improving Test Stability',
        description: `Test failure rate has ${trendChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(trendChange).toFixed(1)}% over the past week`,
        data: { recentFailureRate, olderFailureRate, trendChange },
        confidence: 85,
        actionable: true,
        recommendations: trendChange > 0
          ? ['Investigate recent code changes', 'Review failing test patterns', 'Check environment stability']
          : ['Document successful practices', 'Maintain current quality standards']
      };
    }

    return null;
  }

  /**
   * Detect anomalies in test execution patterns
   */
  private async detectAnomalies(): Promise<PredictiveInsight[]> {
    const insights: PredictiveInsight[] = [];
    const data = this.getHistoricalTestData(14);

    if (data.length < 10) return insights;

    // Detect duration anomalies
    const durations = data.map(e => e.duration).filter(d => d > 0);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const stdDev = Math.sqrt(durations.reduce((sq, n) => sq + Math.pow(n - avgDuration, 2), 0) / durations.length);

    const recentAnomalies = data.slice(0, 5).filter(e =>
      e.duration > 0 && Math.abs(e.duration - avgDuration) > 2 * stdDev
    );

    if (recentAnomalies.length > 0) {
      insights.push({
        type: 'anomaly',
        severity: 'medium',
        title: 'Unusual Test Execution Times',
        description: `${recentAnomalies.length} recent test runs had unusually ${recentAnomalies[0].duration > avgDuration ? 'long' : 'short'} execution times`,
        data: { anomalies: recentAnomalies.length, avgDuration, maxDeviation: Math.max(...recentAnomalies.map(a => Math.abs(a.duration - avgDuration))) },
        confidence: 75,
        actionable: true,
        recommendations: ['Check system performance', 'Review test data volume', 'Monitor resource usage']
      });
    }

    return insights;
  }

  /**
   * Recognize patterns in test failures
   */
  private async recognizePatterns(): Promise<PredictiveInsight[]> {
    const insights: PredictiveInsight[] = [];
    const data = this.getHistoricalTestData(21);

    // Group by browser and analyze patterns
    const browserGroups = this.groupTestExecutions(data);

    for (const [key, executions] of browserGroups) {
      const [suite, browser, language] = key.split('|');
      const failureRate = executions.filter(e => e.status === 'failed').length / executions.length;

      if (failureRate > 0.4 && executions.length >= 5) {
        insights.push({
          type: 'pattern',
          severity: failureRate > 0.6 ? 'high' : 'medium',
          title: `High Failure Rate Pattern: ${suite} on ${browser}`,
          description: `${(failureRate * 100).toFixed(1)}% failure rate detected for ${suite} tests on ${browser} browser with ${language} language`,
          data: { suite, browser, language, failureRate, executions: executions.length },
          confidence: Math.min(90, 50 + executions.length * 5),
          actionable: true,
          recommendations: [
            `Focus on ${suite} test stability for ${browser}`,
            `Review ${browser}-specific test implementations`,
            'Consider browser-specific test strategies'
          ]
        });
      }
    }

    return insights;
  }

  /**
   * Generate strategic recommendations
   */
  private async generateRecommendations(): Promise<PredictiveInsight[]> {
    const insights: PredictiveInsight[] = [];
    const data = this.getHistoricalTestData(30);

    if (data.length === 0) return insights;

    // Analyze overall test health
    const overallFailureRate = data.filter(e => e.status === 'failed').length / data.length;

    if (overallFailureRate > 0.2) {
      insights.push({
        type: 'recommendation',
        severity: 'high',
        title: 'Test Suite Stability Improvement Needed',
        description: `Overall failure rate of ${(overallFailureRate * 100).toFixed(1)}% indicates need for systematic improvement`,
        data: { overallFailureRate, totalExecutions: data.length },
        confidence: 90,
        actionable: true,
        recommendations: [
          'Implement comprehensive test review process',
          'Increase test maintenance frequency',
          'Consider test environment stability improvements',
          'Review test data management practices'
        ]
      });
    }

    return insights;
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

export default PredictiveFailureAnalysis;