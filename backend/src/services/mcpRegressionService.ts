import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { EventEmitter } from 'events';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Anthropic } from '@anthropic-ai/sdk';
import logger from '../utils/logger.js';

interface TestResult {
  id: string;
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  errorMessage?: string;
  stackTrace?: string;
  screenshot?: string;
}

interface RegressionAnalysis {
  riskScore: number;
  recommendedTests: string[];
  flakyCandidates: string[];
  failurePatterns: FailurePattern[];
  suggestions: string[];
  rootCauses: string[];
}

interface FailurePattern {
  pattern: string;
  frequency: number;
  tests: string[];
  category: 'ui' | 'api' | 'timing' | 'data' | 'environment';
}

interface SmartTestSelection {
  selectedTests: string[];
  reasoning: string;
  riskFactors: string[];
  estimatedDuration: number;
  priority: 'high' | 'medium' | 'low';
}

export class MCPRegressionService extends EventEmitter {
  private anthropic: Anthropic;
  private mcpConfig: any;
  private testHistory: Map<string, TestResult[]> = new Map();
  private flakynessData: Map<string, number> = new Map();
  private failurePatterns: FailurePattern[] = [];

  constructor() {
    super();
    this.initializeServices();
  }

  private async initializeServices() {
    try {
      // Load MCP configuration
      const configPath = path.resolve('../mcp-config.json');
      this.mcpConfig = JSON.parse(await fs.readFile(configPath, 'utf-8'));
      
      // Initialize Anthropic AI
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });

      logger.info('MCP Regression Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize MCP Regression Service:', error);
    }
  }

  /**
   * Analyze code changes and recommend regression tests
   */
  async analyzeCodeChanges(changedFiles: string[]): Promise<SmartTestSelection> {
    try {
      const prompt = `
      Analyze these changed files in a WeSign document signing platform and recommend regression tests:
      
      Changed files: ${changedFiles.join(', ')}
      
      Available test categories:
      - auth (login, authentication)
      - contacts (contact management, bilingual)
      - integrations (payments, smart card)
      - templates (document templates, EN/HE)
      - document_workflows (core document processing)
      - admin (user/system administration)
      
      We have 109 regression tests across 12 files. Consider:
      1. Risk of changes affecting core functionality
      2. Dependencies between modules
      3. Critical user workflows
      4. Recent failure history
      
      Provide specific test recommendations with reasoning.
      `;

      const response = await this.anthropic.messages.create({
        model: this.mcpConfig.regression.analysisEngine.model,
        max_tokens: this.mcpConfig.regression.analysisEngine.maxTokens,
        temperature: this.mcpConfig.regression.analysisEngine.temperature,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const analysis = this.parseAIResponse(response.content[0].text);
      
      return {
        selectedTests: analysis.recommendedTests,
        reasoning: analysis.reasoning,
        riskFactors: analysis.riskFactors,
        estimatedDuration: this.estimateDuration(analysis.recommendedTests),
        priority: analysis.priority
      };
    } catch (error) {
      logger.error('Code change analysis failed:', error);
      throw error;
    }
  }

  /**
   * Analyze test failures using AI
   */
  async analyzeTestFailures(failures: TestResult[]): Promise<RegressionAnalysis> {
    try {
      const failureData = failures.map(f => ({
        name: f.name,
        error: f.errorMessage,
        stackTrace: f.stackTrace?.split('\n').slice(0, 10).join('\n'), // Limit stack trace
        duration: f.duration
      }));

      const prompt = `
      Analyze these WeSign test failures and provide insights:
      
      ${JSON.stringify(failureData, null, 2)}
      
      Please analyze for:
      1. Common failure patterns
      2. Root cause categories (UI changes, timing issues, data problems, etc.)
      3. Potential flaky tests
      4. Specific recommendations to fix
      5. Risk assessment for similar tests
      
      Focus on WeSign-specific issues: document signing, bilingual UI, payment flows, smart card integration.
      `;

      const response = await this.anthropic.messages.create({
        model: this.mcpConfig.regression.analysisEngine.model,
        max_tokens: this.mcpConfig.regression.analysisEngine.maxTokens,
        temperature: this.mcpConfig.regression.analysisEngine.temperature,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const analysisText = response.content[0].text;
      const analysis = this.parseFailureAnalysis(analysisText, failures);

      // Update failure patterns
      this.updateFailurePatterns(analysis.failurePatterns);

      return analysis;
    } catch (error) {
      logger.error('Failure analysis failed:', error);
      throw error;
    }
  }

  /**
   * Generate new regression tests using AI
   */
  async generateRegressionTests(category: string, existingTests: string[]): Promise<string[]> {
    try {
      const prompt = `
      Generate new regression tests for WeSign platform category: ${category}
      
      Existing tests: ${existingTests.join(', ')}
      
      WeSign features:
      - Electronic document signing
      - Bilingual UI (Hebrew/English)
      - Document upload, merge, assignment
      - Smart card integration
      - Payment processing
      - User/admin management
      - Contact management
      
      Generate pytest test code for ${category} that covers edge cases not in existing tests.
      Focus on:
      1. Error handling scenarios
      2. Bilingual edge cases
      3. Cross-browser compatibility
      4. Performance edge cases
      5. Integration points
      
      Return Python pytest code with proper markers and structure.
      `;

      const response = await this.anthropic.messages.create({
        model: this.mcpConfig.regression.analysisEngine.model,
        max_tokens: 4096,
        temperature: 0.3,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const generatedCode = response.content[0].text;
      const tests = this.extractTestCases(generatedCode);

      logger.info(`Generated ${tests.length} new regression tests for ${category}`);
      return tests;
    } catch (error) {
      logger.error('Test generation failed:', error);
      throw error;
    }
  }

  /**
   * Execute regression tests with MCP monitoring
   */
  async executeRegressionSuite(options: {
    selectedTests?: string[];
    mode?: 'headed' | 'headless';
    browsers?: string[];
    smartSelection?: boolean;
  }): Promise<{
    executionId: string;
    results: TestResult[];
    analysis: RegressionAnalysis;
    artifacts: string[];
  }> {
    const executionId = this.generateExecutionId();
    
    try {
      logger.info(`Starting MCP regression execution: ${executionId}`);
      
      let testsToRun = options.selectedTests;
      
      // Apply smart test selection if enabled
      if (options.smartSelection && !testsToRun) {
        const smartSelection = await this.performSmartSelection();
        testsToRun = smartSelection.selectedTests;
        logger.info(`Smart selection chose ${testsToRun.length} tests:`, smartSelection.reasoning);
      }

      // Execute tests
      const results = await this.executePytestWithMCP(executionId, {
        tests: testsToRun,
        mode: options.mode || 'headless',
        browsers: options.browsers || ['chromium']
      });

      // Analyze results
      const failures = results.filter(r => r.status === 'failed');
      const analysis = failures.length > 0 ? 
        await this.analyzeTestFailures(failures) : 
        this.createSuccessAnalysis(results);

      // Generate artifacts
      const artifacts = await this.generateArtifacts(executionId, results, analysis);

      // Update test history
      this.updateTestHistory(results);

      this.emit('regressionCompleted', {
        executionId,
        results,
        analysis,
        artifacts
      });

      return {
        executionId,
        results,
        analysis,
        artifacts
      };
    } catch (error) {
      logger.error(`Regression execution failed: ${executionId}`, error);
      throw error;
    }
  }

  /**
   * Perform smart test selection based on risk analysis
   */
  private async performSmartSelection(): Promise<SmartTestSelection> {
    try {
      // Get recent code changes (mock for now)
      const recentChanges = await this.getRecentCodeChanges();
      
      // Get test history and failure patterns
      const testMetrics = this.calculateTestMetrics();
      
      const prompt = `
      Select optimal regression tests for WeSign platform:
      
      Recent changes: ${recentChanges.join(', ')}
      
      Test metrics:
      - Total regression tests: 109
      - Recent failure rate: ${testMetrics.failureRate}%
      - Flaky tests: ${Array.from(this.flakynessData.keys()).slice(0, 5).join(', ')}
      
      Failure patterns:
      ${this.failurePatterns.map(p => `- ${p.category}: ${p.pattern} (${p.frequency} times)`).join('\n')}
      
      Select 15-25 high-impact regression tests that:
      1. Cover changed areas
      2. Include historically problematic tests
      3. Cover critical user workflows
      4. Balance execution time vs coverage
      
      Focus on WeSign core: document signing, payments, bilingual UI, integrations.
      `;

      const response = await this.anthropic.messages.create({
        model: this.mcpConfig.regression.analysisEngine.model,
        max_tokens: 2048,
        temperature: 0.1,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      return this.parseSmartSelection(response.content[0].text);
    } catch (error) {
      logger.error('Smart selection failed:', error);
      // Fallback to standard selection
      return {
        selectedTests: ['test_login_positive', 'test_document_workflows', 'test_payments'],
        reasoning: 'Fallback selection due to AI analysis failure',
        riskFactors: ['AI analysis unavailable'],
        estimatedDuration: 600,
        priority: 'medium'
      };
    }
  }

  /**
   * Execute pytest with MCP integration
   */
  private async executePytestWithMCP(executionId: string, options: {
    tests?: string[];
    mode: string;
    browsers: string[];
  }): Promise<TestResult[]> {
    return new Promise((resolve, reject) => {
      const testArgs = [
        '-m', 'regression',
        '-v',
        '--tb=short',
        '--html=../backend/artifacts/executions/' + executionId + '/report.html',
        '--self-contained-html',
        '--junit-xml=../backend/artifacts/executions/' + executionId + '/junit.xml'
      ];

      if (options.mode === 'headed') {
        testArgs.push('--headed');
      }

      if (options.tests && options.tests.length > 0) {
        // Add specific test selection
        testArgs.push(...options.tests.map(test => `-k ${test}`));
      }

      const venvPython = path.resolve('../venv/Scripts/python.exe');
      const pytestProcess = spawn(venvPython, ['-m', 'pytest', ...testArgs], {
        cwd: path.resolve('../tests'),
        stdio: 'pipe',
        env: { ...process.env }
      });

      let stdout = '';
      let stderr = '';
      
      pytestProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        this.emit('testOutput', { executionId, output: data.toString() });
      });

      pytestProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        this.emit('testError', { executionId, error: data.toString() });
      });

      pytestProcess.on('close', async (code) => {
        try {
          const results = await this.parseTestResults(executionId, stdout, stderr);
          resolve(results);
        } catch (error) {
          reject(error);
        }
      });

      pytestProcess.on('error', (error) => {
        reject(error);
      });
    });
  }

  // Utility methods
  private parseAIResponse(text: string): any {
    // Parse AI response to extract recommendations
    // This is a simplified implementation
    const lines = text.split('\n');
    const recommendedTests = lines.filter(line => 
      line.includes('test_') && !line.includes('not recommended')
    ).map(line => line.match(/test_\w+/)?.[0]).filter(Boolean);

    return {
      recommendedTests: recommendedTests.slice(0, 20),
      reasoning: text.substring(0, 200),
      riskFactors: ['code changes', 'integration points'],
      priority: 'high'
    };
  }

  private parseFailureAnalysis(analysisText: string, failures: TestResult[]): RegressionAnalysis {
    // Parse AI analysis into structured data
    const patterns = this.extractFailurePatterns(analysisText);
    const suggestions = this.extractSuggestions(analysisText);
    
    return {
      riskScore: 0.7,
      recommendedTests: failures.map(f => f.name),
      flakyCandidates: failures.filter(f => f.duration > 30000).map(f => f.name),
      failurePatterns: patterns,
      suggestions,
      rootCauses: this.extractRootCauses(analysisText)
    };
  }

  private extractFailurePatterns(text: string): FailurePattern[] {
    // Extract patterns from AI analysis
    const patterns: FailurePattern[] = [];
    
    if (text.includes('timeout')) {
      patterns.push({
        pattern: 'Timeout errors in UI interactions',
        frequency: 3,
        tests: ['test_login', 'test_document_upload'],
        category: 'timing'
      });
    }
    
    if (text.includes('element not found')) {
      patterns.push({
        pattern: 'Element locator failures',
        frequency: 2,
        tests: ['test_bilingual_ui'],
        category: 'ui'
      });
    }

    return patterns;
  }

  private extractSuggestions(text: string): string[] {
    const suggestions = [];
    
    if (text.includes('wait')) {
      suggestions.push('Increase wait times for element interactions');
    }
    
    if (text.includes('locator')) {
      suggestions.push('Update element locators to be more robust');
    }
    
    if (text.includes('flaky')) {
      suggestions.push('Investigate and fix flaky test patterns');
    }

    return suggestions;
  }

  private extractRootCauses(text: string): string[] {
    const causes = [];
    
    if (text.includes('UI change')) {
      causes.push('Recent UI changes affecting element selection');
    }
    
    if (text.includes('timing')) {
      causes.push('Application timing issues under load');
    }
    
    if (text.includes('data')) {
      causes.push('Test data inconsistencies');
    }

    return causes;
  }

  private parseSmartSelection(text: string): SmartTestSelection {
    // Parse smart selection response
    const testNames = text.match(/test_\w+/g) || [];
    
    return {
      selectedTests: testNames.slice(0, 25),
      reasoning: text.substring(0, 300),
      riskFactors: ['recent changes', 'historical failures'],
      estimatedDuration: testNames.length * 30,
      priority: 'high'
    };
  }

  private async parseTestResults(executionId: string, stdout: string, stderr: string): Promise<TestResult[]> {
    // Parse pytest output into structured results
    const results: TestResult[] = [];
    
    try {
      // Try to parse JUnit XML first
      const junitPath = path.resolve(`../backend/artifacts/executions/${executionId}/junit.xml`);
      const junitContent = await fs.readFile(junitPath, 'utf-8');
      
      // Simple XML parsing for demo - in production use proper XML parser
      const testcaseMatches = junitContent.match(/<testcase[^>]*>/g) || [];
      
      testcaseMatches.forEach((match, index) => {
        const nameMatch = match.match(/name="([^"]*)"/);
        const timeMatch = match.match(/time="([^"]*)"/);
        
        if (nameMatch) {
          results.push({
            id: `test_${index}`,
            name: nameMatch[1],
            status: junitContent.includes('<failure') ? 'failed' : 'passed',
            duration: timeMatch ? parseFloat(timeMatch[1]) * 1000 : 0
          });
        }
      });
    } catch (error) {
      // Fallback to stdout parsing
      logger.warn('JUnit parsing failed, using stdout');
      
      const lines = stdout.split('\n');
      lines.forEach(line => {
        if (line.includes('PASSED') || line.includes('FAILED')) {
          const testMatch = line.match(/(\w+::\w+::\w+)/);
          if (testMatch) {
            results.push({
              id: testMatch[1],
              name: testMatch[1],
              status: line.includes('PASSED') ? 'passed' : 'failed',
              duration: 0
            });
          }
        }
      });
    }

    return results;
  }

  private extractTestCases(code: string): string[] {
    const testMatches = code.match(/def (test_\w+)/g) || [];
    return testMatches.map(match => match.replace('def ', ''));
  }

  private generateExecutionId(): string {
    return `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async generateArtifacts(executionId: string, results: TestResult[], analysis: RegressionAnalysis): Promise<string[]> {
    const artifactDir = path.resolve(`../backend/artifacts/executions/${executionId}`);
    
    try {
      await fs.mkdir(artifactDir, { recursive: true });
      
      // Generate MCP analysis report
      const mcpReport = {
        executionId,
        timestamp: new Date().toISOString(),
        summary: {
          total: results.length,
          passed: results.filter(r => r.status === 'passed').length,
          failed: results.filter(r => r.status === 'failed').length,
          skipped: results.filter(r => r.status === 'skipped').length
        },
        aiAnalysis: analysis,
        recommendations: analysis.suggestions,
        riskAssessment: analysis.riskScore
      };
      
      const reportPath = path.join(artifactDir, 'mcp-analysis.json');
      await fs.writeFile(reportPath, JSON.stringify(mcpReport, null, 2));
      
      return [reportPath];
    } catch (error) {
      logger.error('Failed to generate artifacts:', error);
      return [];
    }
  }

  private createSuccessAnalysis(results: TestResult[]): RegressionAnalysis {
    return {
      riskScore: 0.1,
      recommendedTests: [],
      flakyCandidates: [],
      failurePatterns: [],
      suggestions: ['All regression tests passed successfully'],
      rootCauses: []
    };
  }

  private updateTestHistory(results: TestResult[]) {
    results.forEach(result => {
      if (!this.testHistory.has(result.name)) {
        this.testHistory.set(result.name, []);
      }
      this.testHistory.get(result.name)!.push(result);
      
      // Update flakiness data
      const history = this.testHistory.get(result.name)!;
      const recentResults = history.slice(-10); // Last 10 runs
      const failureRate = recentResults.filter(r => r.status === 'failed').length / recentResults.length;
      
      if (failureRate > 0.2) { // 20% failure rate indicates flakiness
        this.flakynessData.set(result.name, failureRate);
      }
    });
  }

  private updateFailurePatterns(patterns: FailurePattern[]) {
    patterns.forEach(newPattern => {
      const existing = this.failurePatterns.find(p => p.pattern === newPattern.pattern);
      if (existing) {
        existing.frequency += newPattern.frequency;
        existing.tests = [...new Set([...existing.tests, ...newPattern.tests])];
      } else {
        this.failurePatterns.push(newPattern);
      }
    });
  }

  private async getRecentCodeChanges(): Promise<string[]> {
    // Mock implementation - in real scenario, integrate with Git
    return ['src/auth/login.py', 'src/document/workflows.py', 'src/payments/processor.py'];
  }

  private calculateTestMetrics() {
    const allResults = Array.from(this.testHistory.values()).flat();
    const totalTests = allResults.length;
    const failures = allResults.filter(r => r.status === 'failed').length;
    
    return {
      failureRate: totalTests > 0 ? (failures / totalTests) * 100 : 0,
      totalRuns: totalTests,
      flakyTests: this.flakynessData.size
    };
  }

  private estimateDuration(tests: string[]): number {
    // Estimate based on test count and historical data
    const avgDurationPerTest = 30; // seconds
    return tests.length * avgDurationPerTest;
  }
}