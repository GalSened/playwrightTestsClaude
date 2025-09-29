/**
 * WeSign Healing Reporter
 * 
 * Custom Playwright reporter that provides comprehensive reporting
 * for WeSign test execution with self-healing insights:
 * - Real-time healing statistics
 * - Bilingual test execution tracking
 * - Performance metrics collection
 * - Integration with backend healing service
 */

import {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
  TestStep
} from '@playwright/test/reporter';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { wesignConfig } from '../config/wesign-config';
import { selfHealingIntegration } from '../framework/self-healing-integration';

interface WeSignTestMetrics {
  testId: string;
  testName: string;
  language?: 'hebrew' | 'english';
  category: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'passed' | 'failed' | 'skipped' | 'timedOut' | 'interrupted';
  healingAttempts: number;
  healingSuccesses: number;
  originalFailures: string[];
  healedSelectors: Array<{ original: string; healed: string; confidence: number }>;
  artifacts: string[];
}

interface HealingSessionSummary {
  sessionId: string;
  startTime: string;
  endTime?: string;
  environment: string;
  configuration: any;
  totalTests: number;
  testsByLanguage: { hebrew: number; english: number; mixed: number };
  testsByCategory: Record<string, number>;
  healingStats: {
    totalAttempts: number;
    successfulHealing: number;
    failedHealing: number;
    successRate: number;
    averageHealingTime: number;
  };
  performanceStats: {
    averageTestDuration: number;
    slowestTests: Array<{ name: string; duration: number }>;
    fastestTests: Array<{ name: string; duration: number }>;
  };
  artifacts: {
    screenshots: number;
    videos: number;
    traces: number;
    reports: string[];
  };
}

export class WeSignHealingReporter implements Reporter {
  private config: FullConfig;
  private sessionId: string;
  private sessionStartTime: number;
  private testMetrics: Map<string, WeSignTestMetrics> = new Map();
  private healingEvents: Array<{
    timestamp: number;
    testId: string;
    event: 'attempt' | 'success' | 'failure';
    details: any;
  }> = [];
  private outputDir: string;

  constructor() {
    this.sessionId = `wesign-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.sessionStartTime = Date.now();
    this.outputDir = resolve(process.cwd(), 'reports/healing');
    
    // Ensure output directory exists
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }

    console.log(`🎯 WeSign Healing Reporter initialized (Session: ${this.sessionId})`);
  }

  onBegin(config: FullConfig, suite: Suite): void {
    this.config = config;
    
    console.log('🚀 WeSign Test Suite Starting');
    console.log(`📋 Environment: ${wesignConfig.environment.name}`);
    console.log(`🌐 Base URL: ${wesignConfig.environment.baseUrl}`);
    console.log(`🔧 Self-healing: ${wesignConfig.isFeatureEnabled('selfHealing') ? 'Enabled' : 'Disabled'}`);
    console.log(`🌍 Bilingual testing: ${wesignConfig.isFeatureEnabled('bilingualTesting') ? 'Enabled' : 'Disabled'}`);
    
    const totalTests = this.countTests(suite);
    console.log(`📊 Total tests to execute: ${totalTests}`);
    
    // Initialize session tracking
    this.createSessionStartReport();
  }

  onTestBegin(test: TestCase, result: TestResult): void {
    const testMetrics: WeSignTestMetrics = {
      testId: test.id,
      testName: test.title,
      language: this.detectTestLanguage(test),
      category: this.categorizeTest(test),
      startTime: Date.now(),
      status: 'passed', // Will be updated
      healingAttempts: 0,
      healingSuccesses: 0,
      originalFailures: [],
      healedSelectors: [],
      artifacts: []
    };

    this.testMetrics.set(test.id, testMetrics);
    
    // Log test start with emoji indicators
    const languageIcon = testMetrics.language === 'hebrew' ? '🇮🇱' : '🇺🇸';
    const categoryIcon = this.getCategoryIcon(testMetrics.category);
    
    console.log(`${categoryIcon} ${languageIcon} Starting: ${test.title}`);
  }

  onStepEnd(test: TestCase, result: TestResult, step: TestStep): void {
    const metrics = this.testMetrics.get(test.id);
    if (!metrics) return;

    // Track healing-related steps
    if (step.title.includes('healing') || step.title.includes('retry')) {
      metrics.healingAttempts++;
      
      this.healingEvents.push({
        timestamp: Date.now(),
        testId: test.id,
        event: 'attempt',
        details: {
          stepTitle: step.title,
          duration: step.duration,
          category: step.category
        }
      });

      if (step.error) {
        console.log(`🔄 Healing attempt for ${test.title}: ${step.title}`);
      } else {
        metrics.healingSuccesses++;
        console.log(`✅ Successful healing for ${test.title}: ${step.title}`);
        
        this.healingEvents.push({
          timestamp: Date.now(),
          testId: test.id,
          event: 'success',
          details: {
            stepTitle: step.title,
            duration: step.duration
          }
        });
      }
    }

    // Track artifacts
    if (step.category === 'attach') {
      const attachmentName = step.title;
      metrics.artifacts.push(attachmentName);
      
      if (attachmentName.includes('screenshot')) {
        console.log(`📸 Screenshot captured for ${test.title}`);
      } else if (attachmentName.includes('video')) {
        console.log(`🎥 Video recorded for ${test.title}`);
      } else if (attachmentName.includes('trace')) {
        console.log(`🔍 Trace saved for ${test.title}`);
      }
    }
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const metrics = this.testMetrics.get(test.id);
    if (!metrics) return;

    // Update metrics
    metrics.endTime = Date.now();
    metrics.duration = metrics.endTime - metrics.startTime;
    metrics.status = result.status;

    // Track failures for healing analysis
    if (result.status === 'failed' && result.error) {
      metrics.originalFailures.push(result.error.message || 'Unknown error');
      
      // Log failure with healing context
      if (metrics.healingAttempts > 0) {
        if (metrics.healingSuccesses > 0) {
          console.log(`🔧 Test partially healed but ultimately failed: ${test.title}`);
        } else {
          console.log(`❌ Test failed despite healing attempts: ${test.title}`);
        }
      } else {
        console.log(`❌ Test failed without healing attempts: ${test.title}`);
      }

      this.healingEvents.push({
        timestamp: Date.now(),
        testId: test.id,
        event: 'failure',
        details: {
          error: result.error.message,
          healingAttempts: metrics.healingAttempts,
          healingSuccesses: metrics.healingSuccesses
        }
      });
    }

    // Success logging
    if (result.status === 'passed') {
      const statusIcon = metrics.healingSuccesses > 0 ? '🔧✅' : '✅';
      const healingInfo = metrics.healingSuccesses > 0 
        ? ` (healed ${metrics.healingSuccesses}/${metrics.healingAttempts})`
        : '';
      
      console.log(`${statusIcon} ${test.title}${healingInfo} (${metrics.duration}ms)`);
    }

    // Update the stored metrics
    this.testMetrics.set(test.id, metrics);
  }

  onEnd(result: FullResult): void {
    console.log('\n🎯 WeSign Test Suite Completed');
    console.log('=' .repeat(60));

    // Generate comprehensive session summary
    const sessionSummary = this.generateSessionSummary(result);
    
    // Write detailed reports
    this.writeHealingAnalysisReport(sessionSummary);
    this.writeBilingualTestReport(sessionSummary);
    this.writePerformanceReport(sessionSummary);
    this.writeExecutiveSummary(sessionSummary);
    
    // Console summary
    this.printConsoleSummary(sessionSummary);
    
    // Send to healing service if enabled
    if (wesignConfig.isFeatureEnabled('selfHealing')) {
      this.sendSessionDataToHealingService(sessionSummary).catch(error => {
        console.warn('⚠️  Failed to send session data to healing service:', error.message);
      });
    }

    console.log(`\n📁 Reports saved to: ${this.outputDir}`);
  }

  private generateSessionSummary(result: FullResult): HealingSessionSummary {
    const allTests = Array.from(this.testMetrics.values());
    const totalTests = allTests.length;
    
    // Language distribution
    const languageStats = allTests.reduce((acc, test) => {
      if (test.language) {
        acc[test.language]++;
      } else {
        acc.mixed++;
      }
      return acc;
    }, { hebrew: 0, english: 0, mixed: 0 });

    // Category distribution
    const categoryStats = allTests.reduce((acc, test) => {
      acc[test.category] = (acc[test.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Healing statistics
    const totalHealingAttempts = allTests.reduce((sum, test) => sum + test.healingAttempts, 0);
    const totalHealingSuccesses = allTests.reduce((sum, test) => sum + test.healingSuccesses, 0);
    const healingSuccessRate = totalHealingAttempts > 0 
      ? Math.round((totalHealingSuccesses / totalHealingAttempts) * 100) 
      : 0;

    // Performance statistics
    const testDurations = allTests.filter(t => t.duration).map(t => t.duration!);
    const averageTestDuration = testDurations.length > 0 
      ? Math.round(testDurations.reduce((a, b) => a + b) / testDurations.length)
      : 0;

    const sortedTests = allTests
      .filter(t => t.duration)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0));

    const slowestTests = sortedTests.slice(0, 5).map(t => ({
      name: t.testName,
      duration: t.duration || 0
    }));

    const fastestTests = sortedTests.slice(-5).reverse().map(t => ({
      name: t.testName,
      duration: t.duration || 0
    }));

    // Artifact counts
    const totalScreenshots = allTests.reduce((sum, test) => 
      sum + test.artifacts.filter(a => a.includes('screenshot')).length, 0);
    const totalVideos = allTests.reduce((sum, test) => 
      sum + test.artifacts.filter(a => a.includes('video')).length, 0);
    const totalTraces = allTests.reduce((sum, test) => 
      sum + test.artifacts.filter(a => a.includes('trace')).length, 0);

    return {
      sessionId: this.sessionId,
      startTime: new Date(this.sessionStartTime).toISOString(),
      endTime: new Date().toISOString(),
      environment: wesignConfig.environment.name,
      configuration: {
        baseUrl: wesignConfig.environment.baseUrl,
        features: wesignConfig.features,
        selfHealingEnabled: wesignConfig.isFeatureEnabled('selfHealing'),
        bilingualEnabled: wesignConfig.isFeatureEnabled('bilingualTesting')
      },
      totalTests,
      testsByLanguage: languageStats,
      testsByCategory: categoryStats,
      healingStats: {
        totalAttempts: totalHealingAttempts,
        successfulHealing: totalHealingSuccesses,
        failedHealing: totalHealingAttempts - totalHealingSuccesses,
        successRate: healingSuccessRate,
        averageHealingTime: this.calculateAverageHealingTime()
      },
      performanceStats: {
        averageTestDuration,
        slowestTests,
        fastestTests
      },
      artifacts: {
        screenshots: totalScreenshots,
        videos: totalVideos,
        traces: totalTraces,
        reports: ['healing-analysis.json', 'bilingual-report.json', 'performance-report.json']
      }
    };
  }

  private writeHealingAnalysisReport(summary: HealingSessionSummary): void {
    const report = {
      ...summary,
      healingEvents: this.healingEvents,
      healedSelectors: this.getAllHealedSelectors(),
      recommendations: this.generateHealingRecommendations(summary)
    };

    const filePath = resolve(this.outputDir, 'healing-analysis.json');
    writeFileSync(filePath, JSON.stringify(report, null, 2));
  }

  private writeBilingualTestReport(summary: HealingSessionSummary): void {
    const bilingualTests = Array.from(this.testMetrics.values())
      .filter(test => test.language);

    const report = {
      summary: {
        totalBilingualTests: bilingualTests.length,
        hebrewTests: summary.testsByLanguage.hebrew,
        englishTests: summary.testsByLanguage.english
      },
      testDetails: bilingualTests.map(test => ({
        name: test.testName,
        language: test.language,
        status: test.status,
        duration: test.duration,
        healingApplied: test.healingSuccesses > 0
      })),
      languageSpecificIssues: this.identifyLanguageSpecificIssues(),
      recommendations: this.generateBilingualRecommendations()
    };

    const filePath = resolve(this.outputDir, 'bilingual-report.json');
    writeFileSync(filePath, JSON.stringify(report, null, 2));
  }

  private writePerformanceReport(summary: HealingSessionSummary): void {
    const report = {
      summary: summary.performanceStats,
      thresholds: wesignConfig.thresholds,
      violations: this.identifyPerformanceViolations(),
      healingPerformance: selfHealingIntegration.getHealingStats(),
      recommendations: this.generatePerformanceRecommendations(summary)
    };

    const filePath = resolve(this.outputDir, 'performance-report.json');
    writeFileSync(filePath, JSON.stringify(report, null, 2));
  }

  private writeExecutiveSummary(summary: HealingSessionSummary): void {
    const executiveSummary = `
WeSign Test Execution - Executive Summary
========================================

Session: ${summary.sessionId}
Executed: ${summary.endTime}
Environment: ${summary.environment}

Test Results Overview:
---------------------
Total Tests: ${summary.totalTests}
Hebrew Tests: ${summary.testsByLanguage.hebrew}
English Tests: ${summary.testsByLanguage.english}
Mixed Language: ${summary.testsByLanguage.mixed}

Self-Healing Performance:
------------------------
Healing Success Rate: ${summary.healingStats.successRate}%
Total Healing Attempts: ${summary.healingStats.totalAttempts}
Successful Healings: ${summary.healingStats.successfulHealing}
Failed Healings: ${summary.healingStats.failedHealing}

Performance Metrics:
-------------------
Average Test Duration: ${summary.performanceStats.averageTestDuration}ms
Artifacts Generated: ${summary.artifacts.screenshots} screenshots, ${summary.artifacts.videos} videos

Key Insights:
------------
${this.generateExecutiveInsights(summary).join('\n')}

Next Steps:
----------
${this.generateExecutiveRecommendations(summary).join('\n')}
`;

    const filePath = resolve(this.outputDir, 'executive-summary.txt');
    writeFileSync(filePath, executiveSummary);
  }

  private printConsoleSummary(summary: HealingSessionSummary): void {
    console.log(`📊 Tests by Language: Hebrew (${summary.testsByLanguage.hebrew}) | English (${summary.testsByLanguage.english}) | Mixed (${summary.testsByLanguage.mixed})`);
    console.log(`🔧 Self-Healing: ${summary.healingStats.successfulHealing}/${summary.healingStats.totalAttempts} successful (${summary.healingStats.successRate}%)`);
    console.log(`⚡ Performance: Avg ${summary.performanceStats.averageTestDuration}ms per test`);
    console.log(`📁 Artifacts: ${summary.artifacts.screenshots} screenshots, ${summary.artifacts.videos} videos, ${summary.artifacts.traces} traces`);
    
    if (summary.healingStats.successRate >= 80) {
      console.log('✅ Excellent self-healing performance!');
    } else if (summary.healingStats.successRate >= 60) {
      console.log('⚠️  Moderate self-healing performance - review patterns');
    } else if (summary.healingStats.totalAttempts > 0) {
      console.log('❌ Poor self-healing performance - investigation needed');
    }
  }

  // Helper methods

  private countTests(suite: Suite): number {
    let count = suite.tests.length;
    suite.suites.forEach(childSuite => {
      count += this.countTests(childSuite);
    });
    return count;
  }

  private detectTestLanguage(test: TestCase): 'hebrew' | 'english' | undefined {
    const title = test.title.toLowerCase();
    const fileName = test.location.file.toLowerCase();
    
    if (title.includes('hebrew') || fileName.includes('hebrew') || fileName.includes('he-')) {
      return 'hebrew';
    }
    if (title.includes('english') || fileName.includes('english') || fileName.includes('en-')) {
      return 'english';
    }
    
    return undefined;
  }

  private categorizeTest(test: TestCase): string {
    const title = test.title.toLowerCase();
    const fileName = test.location.file.toLowerCase();
    
    if (title.includes('login') || title.includes('auth')) return 'authentication';
    if (title.includes('upload') || title.includes('document')) return 'document-management';
    if (title.includes('sign') || title.includes('signature')) return 'signature';
    if (title.includes('mobile') || fileName.includes('mobile')) return 'mobile';
    if (fileName.includes('api')) return 'api';
    
    return 'functional';
  }

  private getCategoryIcon(category: string): string {
    const icons = {
      'authentication': '🔐',
      'document-management': '📄',
      'signature': '✍️',
      'mobile': '📱',
      'api': '🔌',
      'functional': '⚙️'
    };
    
    return icons[category] || '🧪';
  }

  private createSessionStartReport(): void {
    const startReport = {
      sessionId: this.sessionId,
      startTime: new Date(this.sessionStartTime).toISOString(),
      environment: wesignConfig.environment.name,
      configuration: wesignConfig.features,
      status: 'started'
    };

    const filePath = resolve(this.outputDir, `session-${this.sessionId}-start.json`);
    writeFileSync(filePath, JSON.stringify(startReport, null, 2));
  }

  private calculateAverageHealingTime(): number {
    const healingEvents = this.healingEvents.filter(event => event.event === 'success');
    if (healingEvents.length === 0) return 0;
    
    const totalTime = healingEvents.reduce((sum, event) => sum + (event.details.duration || 0), 0);
    return Math.round(totalTime / healingEvents.length);
  }

  private getAllHealedSelectors(): Array<{ original: string; healed: string; confidence: number; testId: string }> {
    const healedSelectors: Array<{ original: string; healed: string; confidence: number; testId: string }> = [];
    
    this.testMetrics.forEach((metrics, testId) => {
      metrics.healedSelectors.forEach(selector => {
        healedSelectors.push({
          ...selector,
          testId
        });
      });
    });
    
    return healedSelectors;
  }

  private generateHealingRecommendations(summary: HealingSessionSummary): string[] {
    const recommendations: string[] = [];
    
    if (summary.healingStats.successRate < 60) {
      recommendations.push('Review and update healing patterns for WeSign-specific elements');
      recommendations.push('Consider increasing confidence thresholds for healing decisions');
    }
    
    if (summary.testsByLanguage.hebrew > 0 && summary.testsByLanguage.english > 0) {
      recommendations.push('Implement bilingual healing patterns for consistent cross-language support');
    }
    
    if (summary.healingStats.averageHealingTime > 5000) {
      recommendations.push('Optimize healing algorithms for faster response times');
    }
    
    return recommendations;
  }

  private identifyLanguageSpecificIssues(): Array<{ language: string; issue: string; count: number }> {
    const issues: Array<{ language: string; issue: string; count: number }> = [];
    
    // Analyze failures by language
    const hebrewFailures = Array.from(this.testMetrics.values())
      .filter(test => test.language === 'hebrew' && test.status === 'failed');
    
    const englishFailures = Array.from(this.testMetrics.values())
      .filter(test => test.language === 'english' && test.status === 'failed');
    
    if (hebrewFailures.length > englishFailures.length * 1.5) {
      issues.push({
        language: 'hebrew',
        issue: 'Higher failure rate in Hebrew interface',
        count: hebrewFailures.length
      });
    }
    
    return issues;
  }

  private generateBilingualRecommendations(): string[] {
    return [
      'Ensure consistent element selectors across Hebrew and English interfaces',
      'Validate RTL layout compatibility for Hebrew tests',
      'Consider separate healing patterns for each language',
      'Monitor performance differences between language variants'
    ];
  }

  private identifyPerformanceViolations(): Array<{ test: string; violation: string; threshold: number; actual: number }> {
    const violations: Array<{ test: string; violation: string; threshold: number; actual: number }> = [];
    
    this.testMetrics.forEach(test => {
      if (test.duration && test.category === 'document-management' && test.duration > wesignConfig.thresholds.fileUpload) {
        violations.push({
          test: test.testName,
          violation: 'File upload timeout exceeded',
          threshold: wesignConfig.thresholds.fileUpload,
          actual: test.duration
        });
      }
    });
    
    return violations;
  }

  private generatePerformanceRecommendations(summary: HealingSessionSummary): string[] {
    const recommendations: string[] = [];
    
    if (summary.performanceStats.averageTestDuration > 30000) {
      recommendations.push('Consider optimizing test execution time - current average exceeds 30 seconds');
    }
    
    recommendations.push('Monitor document upload performance for large files');
    recommendations.push('Implement parallel test execution where possible');
    
    return recommendations;
  }

  private generateExecutiveInsights(summary: HealingSessionSummary): string[] {
    const insights: string[] = [];
    
    insights.push(`Self-healing technology ${summary.healingStats.successRate >= 80 ? 'significantly reduced' : 'partially reduced'} test maintenance overhead`);
    
    if (summary.testsByLanguage.hebrew > 0 && summary.testsByLanguage.english > 0) {
      insights.push('Bilingual testing coverage ensures consistent user experience across languages');
    }
    
    insights.push(`Generated ${summary.artifacts.screenshots + summary.artifacts.videos} artifacts for failure analysis`);
    
    return insights;
  }

  private generateExecutiveRecommendations(summary: HealingSessionSummary): string[] {
    const recommendations: string[] = [];
    
    if (summary.healingStats.successRate < 90) {
      recommendations.push('Invest in healing pattern improvements to achieve >90% success rate');
    }
    
    recommendations.push('Continue bilingual testing to ensure WeSign accessibility');
    recommendations.push('Review performance metrics against business SLAs');
    
    return recommendations;
  }

  private async sendSessionDataToHealingService(summary: HealingSessionSummary): Promise<void> {
    try {
      const response = await fetch(`${wesignConfig.environment.baseUrl.replace(/\/$/, '')}:8081/api/healing/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(summary)
      });

      if (response.ok) {
        console.log('✅ Session data sent to healing service for analysis');
      }
    } catch (error) {
      // Silently fail - this is supplementary functionality
    }
  }
}

export default WeSignHealingReporter;