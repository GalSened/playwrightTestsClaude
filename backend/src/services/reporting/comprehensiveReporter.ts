/**
 * Comprehensive Reporting Integration Service
 * Combines Newman (API tests) and Allure (UI tests) reporting into a unified system
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/utils/logger';
import { newmanExecutor } from '@/services/newman/newmanExecutor';
import { allureReporter, AllureReport } from './allureReporter';
import { ApiTestResult } from '@/services/newman/types';

export interface ComprehensiveReportConfig {
  runId: string;
  testSuiteId: string;
  testSuiteName: string;
  executionType: 'single' | 'suite' | 'regression';
  includeNewman: boolean;
  includeAllure: boolean;
  outputDir?: string;
  format: ('html' | 'json' | 'pdf')[];
  metadata?: {
    environment?: string;
    version?: string;
    branch?: string;
    tester?: string;
    [key: string]: any;
  };
}

export interface ComprehensiveReport {
  id: string;
  config: ComprehensiveReportConfig;
  status: 'generating' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  summary: ComprehensiveReportSummary;
  reports: {
    unified?: string;
    newman?: string;
    allure?: string;
    json?: string;
    pdf?: string;
  };
  errors: string[];
}

export interface ComprehensiveReportSummary {
  overview: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    skippedTests: number;
    brokenTests: number;
    duration: number;
    successRate: number;
  };
  apiTests?: {
    collections: number;
    requests: number;
    passed: number;
    failed: number;
    assertions: {
      total: number;
      passed: number;
      failed: number;
    };
    averageResponseTime: number;
  };
  uiTests?: {
    suites: number;
    tests: number;
    passed: number;
    failed: number;
    broken: number;
    skipped: number;
    flaky: number;
  };
  trends?: {
    historical: Array<{
      date: string;
      passed: number;
      failed: number;
      total: number;
      successRate: number;
    }>;
    improvements: string[];
    regressions: string[];
  };
  coverage?: {
    features: Array<{
      name: string;
      tested: boolean;
      coverage: number;
    }>;
    overall: number;
  };
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  variables: string[];
}

export class ComprehensiveReporter extends EventEmitter {
  private static readonly REPORTS_DIR = path.resolve(__dirname, '../../../data/reports/comprehensive');
  private static readonly TEMPLATES_DIR = path.resolve(__dirname, '../../../templates/reports');

  private activeReports: Map<string, ComprehensiveReport> = new Map();
  private templates: Map<string, ReportTemplate> = new Map();

  constructor() {
    super();
    this.ensureDirectories();
    this.loadTemplates();
    this.setupEventHandlers();
  }

  private ensureDirectories(): void {
    [
      ComprehensiveReporter.REPORTS_DIR,
      ComprehensiveReporter.TEMPLATES_DIR
    ].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info(`Created comprehensive reporter directory: ${dir}`);
      }
    });
  }

  private loadTemplates(): void {
    // Load default templates
    this.loadDefaultTemplates();

    // Load custom templates from filesystem
    this.loadCustomTemplates();
  }

  private loadDefaultTemplates(): void {
    const unifiedTemplate: ReportTemplate = {
      id: 'unified-html',
      name: 'Unified HTML Report',
      description: 'Comprehensive HTML report combining API and UI test results',
      template: this.getDefaultUnifiedTemplate(),
      variables: [
        'reportTitle', 'testSuiteName', 'executionType', 'environment',
        'startTime', 'endTime', 'duration', 'summary', 'apiResults', 'uiResults',
        'trends', 'coverage', 'metadata', 'errors'
      ]
    };

    this.templates.set(unifiedTemplate.id, unifiedTemplate);
  }

  private loadCustomTemplates(): void {
    if (!fs.existsSync(ComprehensiveReporter.TEMPLATES_DIR)) {
      return;
    }

    const templateFiles = fs.readdirSync(ComprehensiveReporter.TEMPLATES_DIR)
      .filter(file => file.endsWith('.template.html') || file.endsWith('.template.json'));

    for (const file of templateFiles) {
      try {
        const templatePath = path.join(ComprehensiveReporter.TEMPLATES_DIR, file);
        const templateContent = fs.readFileSync(templatePath, 'utf-8');
        const templateId = path.basename(file, path.extname(file));

        const template: ReportTemplate = {
          id: templateId,
          name: templateId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          description: `Custom template: ${templateId}`,
          template: templateContent,
          variables: this.extractTemplateVariables(templateContent)
        };

        this.templates.set(templateId, template);
        logger.info(`Loaded custom report template: ${templateId}`);
      } catch (error: any) {
        logger.warn(`Failed to load template ${file}: ${error.message}`);
      }
    }
  }

  private extractTemplateVariables(template: string): string[] {
    const variableRegex = /\{\{(\w+)\}\}/g;
    const variables: string[] = [];
    let match;

    while ((match = variableRegex.exec(template)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }

    return variables;
  }

  private setupEventHandlers(): void {
    // Listen for Newman test completion
    newmanExecutor.on('testComplete', this.handleNewmanComplete.bind(this));

    // Listen for Allure report completion
    allureReporter.on('reportComplete', this.handleAllureComplete.bind(this));
  }

  private handleNewmanComplete(event: { runId: string; result: ApiTestResult }): void {
    this.emit('newmanComplete', event);
  }

  private handleAllureComplete(event: { reportId: string; runId: string; report: AllureReport }): void {
    this.emit('allureComplete', event);
  }

  async generateComprehensiveReport(config: ComprehensiveReportConfig): Promise<string> {
    const reportId = uuidv4();

    logger.info(`📊 Starting comprehensive report generation: ${reportId}`, config);

    const report: ComprehensiveReport = {
      id: reportId,
      config,
      status: 'generating',
      startTime: new Date(),
      summary: this.initializeEmptySummary(),
      reports: {},
      errors: []
    };

    this.activeReports.set(reportId, report);

    try {
      // Generate individual reports
      await this.generateIndividualReports(reportId);

      // Combine reports
      await this.combineReports(reportId);

      // Generate final unified report
      await this.generateUnifiedReport(reportId);

      report.status = 'completed';
      report.endTime = new Date();
      report.duration = report.endTime.getTime() - report.startTime.getTime();

      logger.info(`✅ Comprehensive report generation completed: ${reportId}`);
      this.emit('reportComplete', { reportId, report });

      return reportId;

    } catch (error: any) {
      report.status = 'failed';
      report.endTime = new Date();
      report.errors.push(`Report generation failed: ${error.message}`);

      logger.error(`❌ Comprehensive report generation failed: ${reportId}`, error);
      this.emit('reportError', { reportId, error: error.message });
      throw error;
    }
  }

  private async generateIndividualReports(reportId: string): Promise<void> {
    const report = this.activeReports.get(reportId)!;
    const { config } = report;

    const promises: Promise<any>[] = [];

    // Generate Newman report if requested
    if (config.includeNewman) {
      const newmanPromise = this.generateNewmanReport(reportId)
        .then(reportPath => {
          report.reports.newman = reportPath;
        })
        .catch(error => {
          report.errors.push(`Newman report failed: ${error.message}`);
          logger.warn(`Newman report generation failed for ${reportId}: ${error.message}`);
        });
      promises.push(newmanPromise);
    }

    // Generate Allure report if requested
    if (config.includeAllure) {
      const allurePromise = this.generateAllureReport(reportId)
        .then(reportPath => {
          report.reports.allure = reportPath;
        })
        .catch(error => {
          report.errors.push(`Allure report failed: ${error.message}`);
          logger.warn(`Allure report generation failed for ${reportId}: ${error.message}`);
        });
      promises.push(allurePromise);
    }

    // Wait for all individual reports to complete
    await Promise.allSettled(promises);
  }

  private async generateNewmanReport(reportId: string): Promise<string | null> {
    const report = this.activeReports.get(reportId)!;
    const { config } = report;

    // Get Newman test results for this run
    const newmanResult = await newmanExecutor.getTestResult(config.runId);

    if (!newmanResult) {
      throw new Error(`No Newman test results found for run: ${config.runId}`);
    }

    // Get Newman HTML report if available
    if (newmanResult.reports?.html) {
      return newmanResult.reports.html;
    }

    return null;
  }

  private async generateAllureReport(reportId: string): Promise<string | null> {
    const report = this.activeReports.get(reportId)!;
    const { config } = report;

    // Generate Allure report
    const allureReportId = await allureReporter.generateReport(config.runId, {
      resultsDir: path.join(process.cwd(), 'new_tests_for_wesign', 'allure-results'),
    });

    // Wait for Allure report completion
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Allure report generation timeout'));
      }, 300000); // 5 minutes timeout

      const handleComplete = (event: { reportId: string; report: AllureReport }) => {
        if (event.reportId === allureReportId) {
          clearTimeout(timeout);
          allureReporter.off('reportComplete', handleComplete);
          allureReporter.off('reportError', handleError);
          resolve(event.report.htmlReportPath || null);
        }
      };

      const handleError = (event: { reportId: string; error: string }) => {
        if (event.reportId === allureReportId) {
          clearTimeout(timeout);
          allureReporter.off('reportComplete', handleComplete);
          allureReporter.off('reportError', handleError);
          reject(new Error(event.error));
        }
      };

      allureReporter.on('reportComplete', handleComplete);
      allureReporter.on('reportError', handleError);
    });
  }

  private async combineReports(reportId: string): Promise<void> {
    const report = this.activeReports.get(reportId)!;

    // Combine Newman and Allure data into comprehensive summary
    await this.buildComprehensiveSummary(reportId);

    // Generate JSON report
    if (report.config.format.includes('json')) {
      const jsonReportPath = await this.generateJsonReport(reportId);
      report.reports.json = jsonReportPath;
    }
  }

  private async buildComprehensiveSummary(reportId: string): Promise<void> {
    const report = this.activeReports.get(reportId)!;
    const { config } = report;

    const summary = report.summary;

    // Combine Newman data
    if (config.includeNewman && report.reports.newman) {
      const newmanResult = await newmanExecutor.getTestResult(config.runId);
      if (newmanResult) {
        summary.apiTests = {
          collections: 1,
          requests: newmanResult.totalRequests,
          passed: newmanResult.passedRequests,
          failed: newmanResult.failedRequests,
          assertions: newmanResult.assertions,
          averageResponseTime: newmanResult.responseTime.average
        };

        summary.overview.totalTests += newmanResult.totalRequests;
        summary.overview.passedTests += newmanResult.passedRequests;
        summary.overview.failedTests += newmanResult.failedRequests;
      }
    }

    // Combine Allure data
    if (config.includeAllure && report.reports.allure) {
      // Find the Allure report
      const allureReports = Array.from(allureReporter['activeReports'].values())
        .filter(r => r.runId === config.runId);

      if (allureReports.length > 0) {
        const allureReport = allureReports[0];
        if (allureReport.summary) {
          const alureSummary = allureReport.summary;

          summary.uiTests = {
            suites: alureSummary.suites.length,
            tests: alureSummary.total,
            passed: alureSummary.passed,
            failed: alureSummary.failed,
            broken: alureSummary.broken,
            skipped: alureSummary.skipped,
            flaky: alureSummary.flaky
          };

          summary.overview.totalTests += alureSummary.total;
          summary.overview.passedTests += alureSummary.passed;
          summary.overview.failedTests += alureSummary.failed;
          summary.overview.skippedTests += alureSummary.skipped;
          summary.overview.brokenTests += alureSummary.broken;
        }
      }
    }

    // Calculate success rate
    if (summary.overview.totalTests > 0) {
      summary.overview.successRate = (summary.overview.passedTests / summary.overview.totalTests) * 100;
    }

    // Calculate duration
    if (report.endTime) {
      summary.overview.duration = report.endTime.getTime() - report.startTime.getTime();
    }
  }

  private async generateJsonReport(reportId: string): Promise<string> {
    const report = this.activeReports.get(reportId)!;
    const outputDir = report.config.outputDir || path.join(ComprehensiveReporter.REPORTS_DIR, reportId);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const jsonReportPath = path.join(outputDir, 'comprehensive_report.json');

    const jsonReport = {
      metadata: {
        reportId: report.id,
        generatedAt: new Date().toISOString(),
        version: '1.0.0',
        generator: 'QA Intelligence Platform'
      },
      config: report.config,
      summary: report.summary,
      reports: report.reports,
      errors: report.errors,
      duration: report.duration
    };

    fs.writeFileSync(jsonReportPath, JSON.stringify(jsonReport, null, 2));
    logger.info(`📄 JSON report generated: ${jsonReportPath}`);

    return jsonReportPath;
  }

  private async generateUnifiedReport(reportId: string): Promise<void> {
    const report = this.activeReports.get(reportId)!;

    if (report.config.format.includes('html')) {
      const htmlReportPath = await this.generateHtmlReport(reportId);
      report.reports.unified = htmlReportPath;
    }

    if (report.config.format.includes('pdf')) {
      const pdfReportPath = await this.generatePdfReport(reportId);
      report.reports.pdf = pdfReportPath;
    }
  }

  private async generateHtmlReport(reportId: string): Promise<string> {
    const report = this.activeReports.get(reportId)!;
    const template = this.templates.get('unified-html')!;
    const outputDir = report.config.outputDir || path.join(ComprehensiveReporter.REPORTS_DIR, reportId);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const htmlReportPath = path.join(outputDir, 'comprehensive_report.html');

    // Render template with data
    const renderedHtml = this.renderTemplate(template.template, {
      reportTitle: `${report.config.testSuiteName} - Comprehensive Test Report`,
      testSuiteName: report.config.testSuiteName,
      executionType: report.config.executionType,
      environment: report.config.metadata?.environment || 'Unknown',
      startTime: report.startTime.toISOString(),
      endTime: report.endTime?.toISOString() || 'In Progress',
      duration: this.formatDuration(report.duration || 0),
      summary: JSON.stringify(report.summary, null, 2),
      apiResults: JSON.stringify(report.summary.apiTests || {}, null, 2),
      uiResults: JSON.stringify(report.summary.uiTests || {}, null, 2),
      trends: JSON.stringify(report.summary.trends || {}, null, 2),
      coverage: JSON.stringify(report.summary.coverage || {}, null, 2),
      metadata: JSON.stringify(report.config.metadata || {}, null, 2),
      errors: JSON.stringify(report.errors, null, 2)
    });

    fs.writeFileSync(htmlReportPath, renderedHtml);
    logger.info(`📄 Unified HTML report generated: ${htmlReportPath}`);

    return htmlReportPath;
  }

  private async generatePdfReport(reportId: string): Promise<string> {
    // PDF generation would require additional dependencies like puppeteer
    // For now, return placeholder
    logger.info(`📄 PDF report generation requested for ${reportId} (not implemented)`);
    return '';
  }

  private renderTemplate(template: string, variables: Record<string, string>): string {
    let rendered = template;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      rendered = rendered.replace(regex, value);
    }

    return rendered;
  }

  private formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  private initializeEmptySummary(): ComprehensiveReportSummary {
    return {
      overview: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        brokenTests: 0,
        duration: 0,
        successRate: 0
      }
    };
  }

  private getDefaultUnifiedTemplate(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{reportTitle}}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .content { padding: 30px; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-card { background: #f8f9fa; border-radius: 8px; padding: 20px; border-left: 4px solid #667eea; }
        .metric { font-size: 2.5em; font-weight: bold; color: #333; margin-bottom: 5px; }
        .metric.success { color: #28a745; }
        .metric.error { color: #dc3545; }
        .metric.warning { color: #ffc107; }
        .section { margin-bottom: 40px; }
        .section h2 { color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
        pre { background: #f8f9fa; padding: 15px; border-radius: 6px; overflow-x: auto; }
        .status-badge { padding: 4px 12px; border-radius: 20px; font-size: 0.85em; font-weight: bold; }
        .status-success { background: #d4edda; color: #155724; }
        .status-error { background: #f8d7da; color: #721c24; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; border-top: 1px solid #eee; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{reportTitle}}</h1>
            <p>Test Suite: <strong>{{testSuiteName}}</strong> | Execution Type: <strong>{{executionType}}</strong> | Environment: <strong>{{environment}}</strong></p>
            <p>Generated: {{startTime}} | Duration: {{duration}}</p>
        </div>

        <div class="content">
            <div class="section">
                <h2>📊 Test Summary</h2>
                <div class="summary-grid">
                    <div class="summary-card">
                        <div class="metric success">{{summary.overview.passedTests}}</div>
                        <div>Passed Tests</div>
                    </div>
                    <div class="summary-card">
                        <div class="metric error">{{summary.overview.failedTests}}</div>
                        <div>Failed Tests</div>
                    </div>
                    <div class="summary-card">
                        <div class="metric warning">{{summary.overview.skippedTests}}</div>
                        <div>Skipped Tests</div>
                    </div>
                    <div class="summary-card">
                        <div class="metric">{{summary.overview.totalTests}}</div>
                        <div>Total Tests</div>
                    </div>
                </div>
            </div>

            <div class="section">
                <h2>🔗 API Test Results</h2>
                <pre>{{apiResults}}</pre>
            </div>

            <div class="section">
                <h2>🖥️ UI Test Results</h2>
                <pre>{{uiResults}}</pre>
            </div>

            <div class="section">
                <h2>📈 Trends & Analysis</h2>
                <pre>{{trends}}</pre>
            </div>

            <div class="section">
                <h2>🎯 Test Coverage</h2>
                <pre>{{coverage}}</pre>
            </div>

            <div class="section">
                <h2>ℹ️ Metadata</h2>
                <pre>{{metadata}}</pre>
            </div>

            <div class="section">
                <h2>❌ Errors & Issues</h2>
                <pre>{{errors}}</pre>
            </div>
        </div>

        <div class="footer">
            <p>Generated by QA Intelligence Platform | Comprehensive Test Reporting System</p>
        </div>
    </div>
</body>
</html>`;
  }

  async getReport(reportId: string): Promise<ComprehensiveReport | null> {
    return this.activeReports.get(reportId) || null;
  }

  async getReportContent(reportId: string, format: 'html' | 'json' | 'pdf'): Promise<string | null> {
    const report = this.activeReports.get(reportId);

    if (!report) {
      return null;
    }

    const reportPath = report.reports[format === 'html' ? 'unified' : format];

    if (!reportPath || !fs.existsSync(reportPath)) {
      return null;
    }

    return fs.readFileSync(reportPath, 'utf-8');
  }

  async listReports(): Promise<ComprehensiveReport[]> {
    return Array.from(this.activeReports.values());
  }

  async cleanup(): Promise<void> {
    // Clean up old reports
    try {
      const reportDirs = fs.readdirSync(ComprehensiveReporter.REPORTS_DIR)
        .map(dir => ({
          name: dir,
          path: path.join(ComprehensiveReporter.REPORTS_DIR, dir),
          stats: fs.statSync(path.join(ComprehensiveReporter.REPORTS_DIR, dir))
        }))
        .filter(item => item.stats.isDirectory())
        .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());

      if (reportDirs.length > 20) {
        const dirsToDelete = reportDirs.slice(20);
        for (const dir of dirsToDelete) {
          fs.rmSync(dir.path, { recursive: true, force: true });
          logger.info(`Cleaned up old comprehensive report: ${dir.name}`);
        }
      }
    } catch (error: any) {
      logger.warn(`Failed to cleanup old comprehensive reports: ${error.message}`);
    }

    // Cleanup Newman and Allure services
    await newmanExecutor.cleanup();
    await allureReporter.cleanup();
  }
}

// Create singleton instance
export const comprehensiveReporter = new ComprehensiveReporter();