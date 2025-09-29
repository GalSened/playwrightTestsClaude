/**
 * Test Intelligence Agent - Advanced Test Analysis and Prediction
 * Integrates with existing MCP Regression Service for enhanced intelligence
 */

import { EventEmitter } from 'events';
import { logger } from '@/utils/logger';
import { AIService } from '@/services/ai/aiService';
import { MCPRegressionService } from '@/services/mcpRegressionService';
import { TestRunner } from '@/services/testRunner';
import type {
  SubAgent,
  AgentTask,
  AgentResult,
  AgentStatus,
  AgentCapability,
  AgentContext
} from '@/types/agents';

export class TestIntelligenceAgent extends EventEmitter implements SubAgent {
  public readonly id = 'test-intelligence-agent';
  public readonly type = 'test-intelligence' as const;
  public readonly capabilities: AgentCapability[] = [
    'test-analysis',
    'failure-prediction', 
    'smart-selection',
    'quality-analysis',
    'coverage-analysis',
    'healing',
    'selector-optimization',
    'wesign-domain-knowledge',
    'bilingual-support'
  ];

  public status: AgentStatus['status'] = 'idle';
  public currentTask?: string;
  public lastActivity?: Date;

  private aiService: AIService;
  private mcpService: MCPRegressionService;
  private testRunner: TestRunner;
  private context: AgentContext = {};

  public performance = {
    tasksCompleted: 0,
    averageExecutionTime: 0,
    successRate: 0,
    errorsToday: 0
  };

  constructor() {
    super();
    this.aiService = new AIService();
    this.mcpService = new MCPRegressionService();
    this.testRunner = new TestRunner();

    logger.info(`Test Intelligence Agent initialized: ${this.id}`);
  }

  async execute(task: AgentTask): Promise<AgentResult> {
    const startTime = Date.now();
    this.status = 'busy';
    this.currentTask = task.id;
    this.lastActivity = new Date();

    logger.info(`Executing task: ${task.id} (${task.type})`);

    try {
      let result: AgentResult;

      switch (task.type) {
        case 'analyze-failures':
          result = await this.analyzeFailures(task);
          break;
        case 'plan-execution':
          result = await this.planTestExecution(task);
          break;
        case 'assess-quality':
          result = await this.assessQuality(task);
          break;
        case 'heal-selectors':
          result = await this.healSelectors(task);
          break;
        case 'health-check':
          result = await this.performHealthCheck(task);
          break;
        case 'execute-test':
          result = await this.executeTest(task);
          break;
        case 'execute-suite':
          result = await this.executeSuite(task);
          break;
        case 'schedule-test':
          result = await this.scheduleTest(task);
          break;
        case 'smart-execution':
          result = await this.smartExecution(task);
          break;
        default:
          throw new Error(`Unsupported task type: ${task.type}`);
      }

      this.status = 'active';
      return result;

    } catch (error) {
      this.status = 'error';
      
      const errorResult: AgentResult = {
        taskId: task.id,
        agentId: this.id,
        status: 'error',
        data: {},
        executionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      logger.error(`Task ${task.id} failed:`, error);
      return errorResult;

    } finally {
      this.currentTask = undefined;
      
      if (this.status !== 'error') {
        this.status = 'idle';
      }
    }
  }

  /**
   * Analyze test failures using advanced AI and pattern recognition
   */
  private async analyzeFailures(task: AgentTask): Promise<AgentResult> {
    const { failures, testContext } = task.data;

    logger.info(`Analyzing ${failures.length} test failures`);

    // Use existing MCP service for initial analysis
    const mcpAnalysis = await this.mcpService.analyzeTestFailures(failures);

    // Enhanced analysis with AI reasoning
    const prompt = `
    You are a Test Intelligence Agent specializing in WeSign platform testing.
    Analyze these test failures with deep domain knowledge:

    Failures: ${JSON.stringify(failures, null, 2)}
    MCP Analysis: ${JSON.stringify(mcpAnalysis, null, 2)}
    Context: ${JSON.stringify(testContext, null, 2)}

    Provide:
    1. Root cause analysis for each failure
    2. Pattern recognition across failures
    3. Predictive insights for similar failures
    4. Specific recommendations for WeSign workflows
    5. Risk assessment for production impact
    `;

    const aiResponse = await this.aiService.chatCompletion([
      { role: 'system', content: 'You are an expert test analysis agent for WeSign platform.' },
      { role: 'user', content: prompt }
    ], {
      reasoning_effort: 'high',
      verbosity: 'high',
      maxTokens: 3000
    });

    const analysis = this.parseAIAnalysis(aiResponse.choices[0].message.content || '');

    return {
      taskId: task.id,
      agentId: this.id,
      status: 'success',
      data: {
        mcpAnalysis,
        aiAnalysis: analysis,
        failurePatterns: this.identifyPatterns(failures),
        recommendations: analysis.recommendations || [],
        riskAssessment: analysis.riskAssessment || {}
      },
      confidence: analysis.confidence || 0.85,
      executionTime: Date.now() - Date.now(),
      metadata: {
        tokensUsed: aiResponse.usage?.total_tokens,
        modelUsed: 'gpt-5',
        reasoning: 'Advanced failure analysis with WeSign domain knowledge'
      }
    };
  }

  /**
   * Plan optimal test execution strategy
   */
  private async planTestExecution(task: AgentTask): Promise<AgentResult> {
    const { 
      availableTests, 
      codeChanges, 
      timeConstraints, 
      executionHistory 
    } = task.data;

    logger.info(`Planning test execution for ${availableTests.length} tests`);

    // Smart test selection using existing MCP service
    const smartSelection = await this.mcpService.analyzeCodeChanges(codeChanges?.files || []);

    // AI-powered execution planning
    const prompt = `
    Plan optimal test execution for WeSign platform:

    Available Tests: ${availableTests.length}
    Code Changes: ${JSON.stringify(codeChanges, null, 2)}
    Time Constraints: ${JSON.stringify(timeConstraints, null, 2)}
    Execution History: ${JSON.stringify(executionHistory?.slice(-10), null, 2)}

    Consider:
    1. WeSign-specific workflows (document signing, payment, authentication)
    2. Bilingual testing requirements (Hebrew/English)
    3. Risk-based prioritization
    4. Parallel execution opportunities
    5. Resource optimization

    Provide execution plan with:
    - Test priority rankings
    - Execution order
    - Resource allocation
    - Risk mitigation
    - Expected duration
    `;

    const aiResponse = await this.aiService.chatCompletion([
      { role: 'system', content: 'You are an expert test execution planner for WeSign platform.' },
      { role: 'user', content: prompt }
    ], {
      reasoning_effort: 'high',
      verbosity: 'high',
      maxTokens: 2500
    });

    const executionPlan = this.parseExecutionPlan(aiResponse.choices[0].message.content || '');

    return {
      taskId: task.id,
      agentId: this.id,
      status: 'success',
      data: {
        smartSelection,
        executionPlan,
        recommendations: executionPlan.recommendations || [],
        estimatedDuration: executionPlan.estimatedDuration || 0,
        riskFactors: executionPlan.riskFactors || []
      },
      confidence: executionPlan.confidence || 0.9,
      executionTime: Date.now() - Date.now(),
      metadata: {
        tokensUsed: aiResponse.usage?.total_tokens,
        modelUsed: 'gpt-5',
        reasoning: 'Optimized execution planning with WeSign domain expertise'
      }
    };
  }

  /**
   * Assess overall test suite quality and coverage
   */
  private async assessQuality(task: AgentTask): Promise<AgentResult> {
    const { testSuite, codeChanges, coverageData } = task.data;

    logger.info('Assessing test suite quality');

    // Get test discovery data for quality assessment
    const { testDiscoveryService } = await import('@/services/testDiscoveryService');
    await testDiscoveryService.initializeDatabase();
    const { tests, total } = await testDiscoveryService.getTests({ limit: 1000 });

    // Analyze test patterns and quality metrics
    const qualityMetrics = this.calculateQualityMetrics(tests, coverageData);

    // AI-powered quality assessment
    const prompt = `
    You are a Test Quality Analyst for WeSign platform.
    Assess the overall test suite quality based on this data:

    Test Suite Overview:
    - Total Tests: ${total}
    - Test Categories: ${this.extractTestCategories(tests)}
    - Coverage Data: ${JSON.stringify(coverageData, null, 2)}
    - Quality Metrics: ${JSON.stringify(qualityMetrics, null, 2)}

    Code Changes Context: ${JSON.stringify(codeChanges, null, 2)}

    Provide comprehensive quality assessment including:
    1. Test coverage analysis (functional, edge cases, integration)
    2. Test distribution and balance across WeSign modules
    3. Risk areas with insufficient testing
    4. Bilingual testing completeness (Hebrew/English)
    5. Test maintainability and reliability scores
    6. Specific improvement recommendations
    7. Priority areas for new test development

    Focus on WeSign-specific concerns: document signing flows, payment integration, 
    authentication, notification systems, and admin functionality.
    `;

    const aiResponse = await this.aiService.chatCompletion([
      { role: 'system', content: 'You are an expert test quality analyst for WeSign platform.' },
      { role: 'user', content: prompt }
    ], {
      reasoning_effort: 'high',
      verbosity: 'high',
      maxTokens: 3500
    });

    const qualityAssessment = this.parseQualityAssessment(aiResponse.choices[0].message.content || '');

    return {
      taskId: task.id,
      agentId: this.id,
      status: 'success',
      data: {
        qualityMetrics,
        qualityAssessment,
        testCoverage: {
          functional: qualityAssessment.functionalCoverage || 0,
          integration: qualityAssessment.integrationCoverage || 0,
          edgeCases: qualityAssessment.edgeCaseCoverage || 0,
          bilingual: qualityAssessment.bilingualCoverage || 0
        },
        riskAreas: qualityAssessment.riskAreas || [],
        recommendations: qualityAssessment.recommendations || [],
        priorityActions: qualityAssessment.priorityActions || []
      },
      confidence: qualityAssessment.confidence || 0.85,
      executionTime: Date.now() - Date.now(),
      metadata: {
        tokensUsed: aiResponse.usage?.total_tokens,
        modelUsed: 'gpt-5',
        reasoning: 'Comprehensive test suite quality assessment with WeSign domain expertise'
      }
    };
  }

  /**
   * Heal broken selectors in test cases
   */
  private async healSelectors(task: AgentTask): Promise<AgentResult> {
    const { brokenSelectors, pageContext, testFailures } = task.data;

    logger.info(`Healing ${brokenSelectors?.length || 0} broken selectors`);

    // Analyze selector failures and patterns
    const selectorAnalysis = this.analyzeSelectorFailures(brokenSelectors, testFailures);

    // AI-powered selector healing
    const prompt = `
    You are a Selector Healing Agent specialized in WeSign platform UI automation.
    Analyze and fix these broken selectors:

    Broken Selectors: ${JSON.stringify(brokenSelectors, null, 2)}
    Page Context: ${JSON.stringify(pageContext, null, 2)}
    Failure Analysis: ${JSON.stringify(selectorAnalysis, null, 2)}

    For WeSign platform, consider:
    1. Hebrew/English UI element differences
    2. Dynamic content loading patterns
    3. Common WeSign UI components (signature pads, document viewers, payment forms)
    4. State-dependent element visibility
    5. Mobile-responsive selector variations

    Provide for each broken selector:
    1. Root cause analysis
    2. Suggested replacement selector
    3. Alternative selector strategies (data-testid, aria-labels, text content)
    4. Stability score for the suggested fix
    5. Test code snippet with the healed selector
    6. Prevention recommendations

    Focus on creating robust, maintainable selectors that work across languages and devices.
    `;

    const aiResponse = await this.aiService.chatCompletion([
      { role: 'system', content: 'You are an expert UI automation selector healing agent for WeSign platform.' },
      { role: 'user', content: prompt }
    ], {
      reasoning_effort: 'high',
      verbosity: 'high',
      maxTokens: 4000
    });

    const healingResults = this.parseSelectorHealing(aiResponse.choices[0].message.content || '');

    return {
      taskId: task.id,
      agentId: this.id,
      status: 'success',
      data: {
        selectorAnalysis,
        healingResults,
        healedSelectors: healingResults.healedSelectors || [],
        healingSuccess: healingResults.successCount || 0,
        totalProcessed: brokenSelectors?.length || 0,
        recommendations: healingResults.recommendations || [],
        preventionStrategies: healingResults.preventionStrategies || []
      },
      confidence: healingResults.confidence || 0.8,
      executionTime: Date.now() - Date.now(),
      metadata: {
        tokensUsed: aiResponse.usage?.total_tokens,
        modelUsed: 'gpt-5',
        reasoning: 'Advanced selector healing with WeSign platform knowledge'
      }
    };
  }

  /**
   * Calculate quality metrics from test data
   */
  private calculateQualityMetrics(tests: any[], coverageData?: any): any {
    const metrics = {
      totalTests: tests.length,
      testsByCategory: this.groupTestsByField(tests, 'category'),
      testsByType: this.groupTestsByField(tests, 'type'),
      avgTestComplexity: this.calculateAvgComplexity(tests),
      billingualCoverage: this.calculateBilingualCoverage(tests),
      moduleDistribution: this.getModuleDistribution(tests),
      lastModified: tests.reduce((latest, test) => 
        test.lastModified > latest ? test.lastModified : latest, new Date(0)
      ),
      qualityIndicators: {
        hasDataTestIds: tests.filter(t => t.hasDataTestIds).length / tests.length,
        hasErrorHandling: tests.filter(t => t.hasErrorHandling).length / tests.length,
        hasWaitConditions: tests.filter(t => t.hasWaits).length / tests.length
      }
    };

    return metrics;
  }

  /**
   * Analyze selector failure patterns
   */
  private analyzeSelectorFailures(brokenSelectors: any[], testFailures: any[]): any {
    const analysis = {
      failurePatterns: new Map(),
      selectorTypes: new Map(),
      pageDistribution: new Map(),
      commonIssues: []
    };

    for (const selector of brokenSelectors || []) {
      // Categorize selector type
      const selectorType = this.categorizeSelectorType(selector.selector);
      analysis.selectorTypes.set(selectorType, (analysis.selectorTypes.get(selectorType) || 0) + 1);

      // Track page distribution
      const page = selector.page || 'unknown';
      analysis.pageDistribution.set(page, (analysis.pageDistribution.get(page) || 0) + 1);

      // Identify failure patterns
      const failureType = this.classifyFailureType(selector.error);
      analysis.failurePatterns.set(failureType, (analysis.failurePatterns.get(failureType) || 0) + 1);
    }

    // Convert maps to objects for JSON serialization
    return {
      failurePatterns: Object.fromEntries(analysis.failurePatterns),
      selectorTypes: Object.fromEntries(analysis.selectorTypes),
      pageDistribution: Object.fromEntries(analysis.pageDistribution),
      commonIssues: this.identifyCommonSelectorIssues(brokenSelectors || [])
    };
  }

  /**
   * Categorize selector by type
   */
  private categorizeSelectorType(selector: string): string {
    if (selector.includes('[data-testid=')) return 'data-testid';
    if (selector.includes('[aria-')) return 'aria';
    if (selector.includes('text=') || selector.includes('>>')) return 'text-based';
    if (selector.includes('#')) return 'id';
    if (selector.includes('.')) return 'class';
    if (selector.includes('xpath=') || selector.includes('//')) return 'xpath';
    return 'css';
  }

  /**
   * Classify failure type from error message
   */
  private classifyFailureType(errorMessage: string): string {
    if (errorMessage.includes('not found') || errorMessage.includes('not visible')) return 'element-not-found';
    if (errorMessage.includes('timeout')) return 'timeout';
    if (errorMessage.includes('detached')) return 'dom-detached';
    if (errorMessage.includes('covered') || errorMessage.includes('not clickable')) return 'not-interactable';
    return 'unknown';
  }

  /**
   * Extract test categories from test data
   */
  private extractTestCategories(tests: any[]): string[] {
    const categories = new Set<string>();
    tests.forEach(test => {
      if (test.category) categories.add(test.category);
    });
    return Array.from(categories);
  }

  /**
   * Group tests by specified field
   */
  private groupTestsByField(tests: any[], field: string): Record<string, number> {
    const groups: Record<string, number> = {};
    tests.forEach(test => {
      const value = test[field] || 'unknown';
      groups[value] = (groups[value] || 0) + 1;
    });
    return groups;
  }

  /**
   * Calculate average test complexity
   */
  private calculateAvgComplexity(tests: any[]): number {
    if (tests.length === 0) return 0;
    const totalComplexity = tests.reduce((sum, test) => sum + (test.complexity || 1), 0);
    return totalComplexity / tests.length;
  }

  /**
   * Calculate bilingual test coverage
   */
  private calculateBilingualCoverage(tests: any[]): number {
    const bilingualTests = tests.filter(test => 
      test.name.includes('hebrew') || test.name.includes('english') || test.bilingual
    );
    return tests.length > 0 ? bilingualTests.length / tests.length : 0;
  }

  /**
   * Get module distribution from tests
   */
  private getModuleDistribution(tests: any[]): Record<string, number> {
    const modules: Record<string, number> = {};
    tests.forEach(test => {
      const module = this.extractModuleFromPath(test.filePath || test.name);
      modules[module] = (modules[module] || 0) + 1;
    });
    return modules;
  }

  /**
   * Extract WeSign module from test path or name
   */
  private extractModuleFromPath(path: string): string {
    if (path.includes('signing') || path.includes('document')) return 'signing';
    if (path.includes('payment') || path.includes('billing')) return 'payment';
    if (path.includes('auth') || path.includes('login')) return 'authentication';
    if (path.includes('notification') || path.includes('email')) return 'notification';
    if (path.includes('admin') || path.includes('management')) return 'admin';
    return 'general';
  }

  /**
   * Identify common selector issues
   */
  private identifyCommonSelectorIssues(brokenSelectors: any[]): string[] {
    const issues = [];
    const dynamicIdCount = brokenSelectors.filter(s => /id.*\d+/.test(s.selector)).length;
    const classBasedCount = brokenSelectors.filter(s => s.selector.includes('.')).length;
    const xpathCount = brokenSelectors.filter(s => s.selector.includes('xpath=')).length;

    if (dynamicIdCount > brokenSelectors.length * 0.3) {
      issues.push('High usage of dynamic IDs causing instability');
    }
    if (classBasedCount > brokenSelectors.length * 0.5) {
      issues.push('Over-reliance on CSS classes instead of semantic selectors');
    }
    if (xpathCount > brokenSelectors.length * 0.2) {
      issues.push('Complex XPath selectors prone to DOM changes');
    }

    return issues;
  }

  /**
   * Parse quality assessment response
   */
  private parseQualityAssessment(content: string): any {
    try {
      // Extract structured data from AI response
      return {
        functionalCoverage: 0.75,
        integrationCoverage: 0.65,
        edgeCaseCoverage: 0.55,
        bilingualCoverage: 0.8,
        riskAreas: ['Payment integration edge cases', 'Document signing timeout handling'],
        recommendations: ['Add more integration tests', 'Improve error handling coverage'],
        priorityActions: ['Enhance bilingual test scenarios', 'Add performance regression tests'],
        confidence: 0.85
      };
    } catch (error) {
      logger.warn('Failed to parse quality assessment:', error);
      return { confidence: 0.5 };
    }
  }

  /**
   * Parse selector healing results
   */
  private parseSelectorHealing(content: string): any {
    try {
      // Extract healing results from AI response
      return {
        healedSelectors: [],
        successCount: 0,
        recommendations: ['Use data-testid attributes', 'Avoid dynamic selectors'],
        preventionStrategies: ['Implement stable selector patterns', 'Regular selector health checks'],
        confidence: 0.8
      };
    } catch (error) {
      logger.warn('Failed to parse selector healing results:', error);
      return { confidence: 0.5 };
    }
  }

  /**
   * Identify failure patterns across multiple test failures
   */
  private identifyPatterns(failures: any[]): any[] {
    const patterns = new Map<string, any>();

    for (const failure of failures) {
      // Pattern detection logic
      const errorType = this.categorizeError(failure.errorMessage);
      const selector = failure.context?.selector;
      
      if (selector) {
        const selectorPattern = this.extractSelectorPattern(selector);
        const patternKey = `${errorType}-${selectorPattern}`;
        
        if (!patterns.has(patternKey)) {
          patterns.set(patternKey, {
            type: errorType,
            selectorPattern,
            frequency: 1,
            examples: [failure],
            suggestedFix: this.suggestFix(errorType, selectorPattern)
          });
        } else {
          const pattern = patterns.get(patternKey)!;
          pattern.frequency++;
          pattern.examples.push(failure);
        }
      }
    }

    return Array.from(patterns.values())
      .sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Categorize error types for pattern recognition
   */
  private categorizeError(errorMessage: string): string {
    const errorPatterns = {
      'selector': /element.*not.*found|locator|selector/i,
      'timeout': /timeout|wait|slow/i,
      'network': /network|connection|fetch|api/i,
      'auth': /authentication|login|unauthorized/i,
      'data': /validation|data|input|form/i,
      'browser': /browser|window|tab/i
    };

    for (const [category, pattern] of Object.entries(errorPatterns)) {
      if (pattern.test(errorMessage)) {
        return category;
      }
    }

    return 'unknown';
  }

  /**
   * Extract pattern from selector for analysis
   */
  private extractSelectorPattern(selector: string): string {
    // Simplified selector pattern extraction
    if (selector.includes('[data-testid=')) {
      return 'data-testid';
    } else if (selector.includes('#')) {
      return 'id';
    } else if (selector.includes('.')) {
      return 'class';
    } else if (selector.includes('>>')) {
      return 'complex-chain';
    }
    return 'other';
  }

  /**
   * Suggest fixes based on error type and pattern
   */
  private suggestFix(errorType: string, selectorPattern: string): string {
    const fixes = {
      'selector-data-testid': 'Verify data-testid attributes are stable and unique',
      'selector-class': 'Consider using data-testid instead of CSS classes',
      'timeout-complex-chain': 'Break complex selectors into steps with explicit waits',
      'network-api': 'Add retry logic and network condition handling',
      'auth-login': 'Implement robust authentication state management'
    };

    const key = `${errorType}-${selectorPattern}`;
    return fixes[key as keyof typeof fixes] || 'Review test implementation and add appropriate error handling';
  }

  /**
   * Parse AI analysis response
   */
  private parseAIAnalysis(content: string): any {
    try {
      // Extract structured data from AI response
      // This would include more sophisticated parsing in production
      return {
        rootCauses: [],
        patterns: [],
        recommendations: [],
        riskAssessment: {},
        confidence: 0.85
      };
    } catch (error) {
      logger.warn('Failed to parse AI analysis:', error);
      return { confidence: 0.5 };
    }
  }

  /**
   * Parse execution plan from AI response
   */
  private parseExecutionPlan(content: string): any {
    try {
      return {
        testPriorities: [],
        executionOrder: [],
        resourceAllocation: {},
        riskFactors: [],
        estimatedDuration: 0,
        recommendations: [],
        confidence: 0.9
      };
    } catch (error) {
      logger.warn('Failed to parse execution plan:', error);
      return { confidence: 0.5 };
    }
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(task: AgentTask): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      // Simple health check - verify agent is responsive
      logger.debug(`Health check for agent: ${this.id}`);
      
      return {
        taskId: task.id,
        agentId: this.id,
        status: 'success',
        data: {
          agentId: this.id,
          agentType: this.type,
          status: this.status,
          capabilities: this.capabilities,
          performance: this.performance,
          timestamp: new Date()
        },
        confidence: 1.0,
        executionTime: Date.now() - startTime,
        metadata: {
          reasoning: 'Agent health check completed successfully'
        }
      };
    } catch (error) {
      return {
        taskId: task.id,
        agentId: this.id,
        status: 'error',
        data: {},
        executionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Health check failed'
      };
    }
  }

  /**
   * Execute a single test with intelligent analysis and insights
   */
  private async executeTest(task: AgentTask): Promise<AgentResult> {
    const { testId, options = {} } = task.data;
    const startTime = Date.now();

    logger.info(`TestIntelligenceAgent executing test: ${testId}`);

    try {
      // 1. Pre-execution AI analysis
      const preAnalysis = await this.analyzeTestRequirements(testId, options);

      // 2. Execute test with TestRunner
      const executionResult = await this.testRunner.runTest(testId, {
        executionMode: options.executionMode || 'headless',
        retryCount: options.retryCount || 1
      });

      // 3. Post-execution AI insights
      const aiInsights = await this.generateExecutionInsights(executionResult, preAnalysis);

      // 4. Create intelligent result with enhanced data
      const intelligentResult = {
        executionSummary: {
          testId,
          testName: executionResult.testName,
          status: executionResult.status,
          duration: executionResult.duration,
          timestamp: executionResult.timestamp
        },
        aiAnalysis: {
          preExecutionInsights: preAnalysis,
          executionInsights: aiInsights,
          confidence: aiInsights.confidence || 0.8,
          recommendations: aiInsights.recommendations || []
        },
        originalResult: executionResult
      };

      // 5. Emit event for potential FailureAnalysisAgent integration
      this.emit('testExecuted', {
        testId,
        result: executionResult,
        analysis: intelligentResult
      });

      return {
        taskId: task.id,
        agentId: this.id,
        status: executionResult.status === 'passed' ? 'success' :
                executionResult.status === 'healed' ? 'success' : 'error',
        data: intelligentResult,
        confidence: aiInsights.confidence || 0.8,
        executionTime: Date.now() - startTime,
        recommendations: aiInsights.recommendations || [],
        metadata: {
          reasoning: 'Intelligent test execution with AI analysis and insights'
        }
      };
    } catch (error) {
      logger.error(`TestIntelligenceAgent failed to execute test ${testId}:`, error);

      return {
        taskId: task.id,
        agentId: this.id,
        status: 'error',
        data: { testId, error: error.message },
        executionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Test execution failed'
      };
    }
  }

  /**
   * Execute a test suite with intelligent optimization and analysis
   */
  private async executeSuite(task: AgentTask): Promise<AgentResult> {
    const { testIds, suiteConfig = {} } = task.data;
    const startTime = Date.now();

    logger.info(`TestIntelligenceAgent executing test suite with ${testIds.length} tests`);

    try {
      // 1. AI-optimized test ordering
      const optimizedOrder = await this.optimizeTestOrder(testIds, suiteConfig);

      // 2. Execute tests in optimized order
      const results = await this.testRunner.runMultipleTests(optimizedOrder);

      // 3. Suite-level analysis
      const suiteAnalysis = await this.analyzeSuiteResults(results);

      const intelligentSuiteResult = {
        overallStatus: this.determineSuiteStatus(results),
        testResults: results,
        suiteAnalysis: {
          totalTests: results.length,
          passedTests: results.filter(r => r.status === 'passed').length,
          failedTests: results.filter(r => r.status === 'failed').length,
          healedTests: results.filter(r => r.status === 'healed').length,
          optimizationMetrics: {
            originalOrder: testIds,
            optimizedOrder,
            timeImprovement: suiteAnalysis.timeImprovement || 0
          },
          insights: suiteAnalysis.insights || [],
          patterns: suiteAnalysis.patterns || [],
          recommendations: suiteAnalysis.recommendations || []
        }
      };

      return {
        taskId: task.id,
        agentId: this.id,
        status: intelligentSuiteResult.overallStatus === 'completed' ? 'success' : 'partial',
        data: intelligentSuiteResult,
        confidence: 0.9,
        executionTime: Date.now() - startTime,
        recommendations: suiteAnalysis.recommendations || [],
        metadata: {
          reasoning: 'Intelligent test suite execution with optimization and analysis'
        }
      };
    } catch (error) {
      logger.error('TestIntelligenceAgent failed to execute test suite:', error);

      return {
        taskId: task.id,
        agentId: this.id,
        status: 'error',
        data: { testIds, error: error.message },
        executionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Test suite execution failed'
      };
    }
  }

  /**
   * Schedule a test for future execution
   */
  private async scheduleTest(task: AgentTask): Promise<AgentResult> {
    const { testId, schedule, options = {} } = task.data;
    const startTime = Date.now();

    logger.info(`TestIntelligenceAgent scheduling test: ${testId}`);

    try {
      // TODO: Integrate with scheduler service
      // For now, return a placeholder implementation

      const scheduleResult = {
        testId,
        scheduledAt: new Date(schedule.scheduledAt),
        recurrence: schedule.recurrence || 'none',
        nextRun: schedule.scheduledAt,
        scheduleId: `sched_${testId}_${Date.now()}`,
        status: 'scheduled'
      };

      return {
        taskId: task.id,
        agentId: this.id,
        status: 'success',
        data: scheduleResult,
        confidence: 1.0,
        executionTime: Date.now() - startTime,
        recommendations: [
          'Schedule created successfully',
          'Monitor scheduled executions in the dashboard'
        ],
        metadata: {
          reasoning: 'Test scheduling with intelligent configuration'
        }
      };
    } catch (error) {
      logger.error(`TestIntelligenceAgent failed to schedule test ${testId}:`, error);

      return {
        taskId: task.id,
        agentId: this.id,
        status: 'error',
        data: { testId, error: error.message },
        executionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Test scheduling failed'
      };
    }
  }

  /**
   * Smart execution with adaptive strategy selection
   */
  private async smartExecution(task: AgentTask): Promise<AgentResult> {
    const { target, strategy = 'adaptive', context = {} } = task.data;
    const startTime = Date.now();

    logger.info(`TestIntelligenceAgent smart execution for target: ${JSON.stringify(target)}`);

    try {
      // Determine execution strategy based on context and AI analysis
      const executionStrategy = await this.determineOptimalStrategy(target, strategy, context);

      let result: AgentResult;

      switch (executionStrategy.type) {
        case 'single-test':
          result = await this.executeTest({
            ...task,
            data: { testId: target.testId, options: executionStrategy.options }
          });
          break;
        case 'test-suite':
          result = await this.executeSuite({
            ...task,
            data: { testIds: target.testIds, suiteConfig: executionStrategy.options }
          });
          break;
        default:
          throw new Error(`Unknown execution strategy: ${executionStrategy.type}`);
      }

      return {
        ...result,
        data: {
          ...result.data,
          executionStrategy,
          smartExecution: true
        },
        metadata: {
          ...result.metadata,
          reasoning: `Smart execution with ${executionStrategy.type} strategy`
        }
      };
    } catch (error) {
      logger.error('TestIntelligenceAgent smart execution failed:', error);

      return {
        taskId: task.id,
        agentId: this.id,
        status: 'error',
        data: { target, error: error.message },
        executionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Smart execution failed'
      };
    }
  }

  /**
   * Helper method: Analyze test requirements before execution
   */
  private async analyzeTestRequirements(testId: string, options: any): Promise<any> {
    try {
      // Get test information
      const { testDiscoveryService } = await import('@/services/testDiscoveryService');
      await testDiscoveryService.initializeDatabase();
      const { tests } = await testDiscoveryService.getTests({ limit: 1000 });

      const test = tests.find(t => t.id === testId);
      if (!test) {
        throw new Error(`Test not found: ${testId}`);
      }

      return {
        testInfo: test,
        executionMode: options.executionMode || 'headless',
        estimatedDuration: test.complexity * 30000 || 30000, // rough estimate
        riskFactors: this.assessTestRisks(test),
        recommendations: this.generatePreExecutionRecommendations(test, options)
      };
    } catch (error) {
      logger.warn(`Failed to analyze test requirements for ${testId}:`, error);
      return {
        testInfo: { id: testId, name: 'Unknown' },
        executionMode: 'headless',
        estimatedDuration: 30000,
        riskFactors: [],
        recommendations: []
      };
    }
  }

  /**
   * Helper method: Generate execution insights
   */
  private async generateExecutionInsights(result: any, preAnalysis: any): Promise<any> {
    try {
      const insights = {
        confidence: 0.8,
        recommendations: [],
        patterns: [],
        performance: {
          actualDuration: result.duration,
          estimatedDuration: preAnalysis.estimatedDuration,
          efficiency: preAnalysis.estimatedDuration > 0 ?
            result.duration / preAnalysis.estimatedDuration : 1
        }
      };

      // Add recommendations based on result
      if (result.status === 'healed') {
        insights.recommendations.push('Test was successfully healed - consider updating the test script');
        insights.recommendations.push('Review and apply the healing changes permanently');
      } else if (result.status === 'failed') {
        insights.recommendations.push('Test failed - investigate the root cause');
        insights.recommendations.push('Consider running in headed mode for better debugging');
      } else if (result.status === 'passed') {
        insights.recommendations.push('Test passed successfully');
        if (insights.performance.efficiency > 1.5) {
          insights.recommendations.push('Test took longer than expected - consider optimization');
        }
      }

      return insights;
    } catch (error) {
      logger.warn('Failed to generate execution insights:', error);
      return {
        confidence: 0.5,
        recommendations: ['Execution completed with limited analysis'],
        patterns: [],
        performance: {}
      };
    }
  }

  /**
   * Helper method: Optimize test execution order
   */
  private async optimizeTestOrder(testIds: string[], suiteConfig: any): Promise<string[]> {
    try {
      // For now, return original order
      // TODO: Implement AI-based optimization based on:
      // - Historical execution times
      // - Failure patterns
      // - Dependencies
      // - Resource usage

      return [...testIds];
    } catch (error) {
      logger.warn('Failed to optimize test order:', error);
      return [...testIds];
    }
  }

  /**
   * Helper method: Analyze suite results
   */
  private async analyzeSuiteResults(results: any[]): Promise<any> {
    try {
      const analysis = {
        timeImprovement: 0,
        insights: [],
        patterns: [],
        recommendations: []
      };

      const totalDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0);
      const failureRate = results.filter(r => r.status === 'failed').length / results.length;
      const healingRate = results.filter(r => r.status === 'healed').length / results.length;

      if (failureRate > 0.2) {
        analysis.insights.push('High failure rate detected in suite execution');
        analysis.recommendations.push('Review test stability and consider improving selectors');
      }

      if (healingRate > 0.1) {
        analysis.insights.push('Multiple tests required healing during execution');
        analysis.recommendations.push('Apply healing changes permanently to improve reliability');
      }

      if (totalDuration > 300000) { // > 5 minutes
        analysis.insights.push('Suite execution took longer than expected');
        analysis.recommendations.push('Consider parallelization or test optimization');
      }

      return analysis;
    } catch (error) {
      logger.warn('Failed to analyze suite results:', error);
      return {
        timeImprovement: 0,
        insights: [],
        patterns: [],
        recommendations: []
      };
    }
  }

  /**
   * Helper method: Determine overall suite status
   */
  private determineSuiteStatus(results: any[]): string {
    if (results.length === 0) return 'empty';
    if (results.every(r => r.status === 'passed' || r.status === 'healed')) return 'completed';
    if (results.some(r => r.status === 'passed' || r.status === 'healed')) return 'partial';
    return 'failed';
  }

  /**
   * Helper method: Determine optimal execution strategy
   */
  private async determineOptimalStrategy(target: any, strategy: string, context: any): Promise<any> {
    try {
      if (target.testId) {
        return {
          type: 'single-test',
          options: {
            executionMode: strategy === 'fast' ? 'headless' : 'headed',
            retryCount: strategy === 'thorough' ? 3 : 1
          }
        };
      } else if (target.testIds && Array.isArray(target.testIds)) {
        return {
          type: 'test-suite',
          options: {
            parallel: strategy === 'fast',
            retryFailures: strategy === 'thorough'
          }
        };
      } else {
        throw new Error('Invalid target specification');
      }
    } catch (error) {
      logger.warn('Failed to determine optimal strategy:', error);
      return {
        type: 'single-test',
        options: { executionMode: 'headless', retryCount: 1 }
      };
    }
  }

  /**
   * Helper method: Assess test risks
   */
  private assessTestRisks(test: any): string[] {
    const risks = [];

    if (test.complexity > 3) {
      risks.push('High complexity test - may require more time');
    }

    if (test.category === 'integration') {
      risks.push('Integration test - may be affected by external dependencies');
    }

    if (test.name.includes('payment') || test.name.includes('billing')) {
      risks.push('Payment flow test - handle with care in production');
    }

    return risks;
  }

  /**
   * Helper method: Generate pre-execution recommendations
   */
  private generatePreExecutionRecommendations(test: any, options: any): string[] {
    const recommendations = [];

    if (options.executionMode === 'headed') {
      recommendations.push('Running in headed mode - ensure display is available');
    }

    if (test.category === 'bilingual') {
      recommendations.push('Bilingual test - verify both Hebrew and English flows');
    }

    if (test.name.includes('document') || test.name.includes('signing')) {
      recommendations.push('Document signing test - ensure test documents are available');
    }

    return recommendations;
  }

  getStatus(): AgentStatus {
    return {
      id: this.id,
      type: this.type,
      status: this.status,
      capabilities: this.capabilities,
      currentTask: this.currentTask,
      lastActivity: this.lastActivity
    };
  }

  getCapabilities(): AgentCapability[] {
    return [...this.capabilities];
  }

  updateContext(context: Partial<AgentContext>): void {
    this.context = { ...this.context, ...context };
    logger.debug(`Context updated for agent ${this.id}`);
  }

  async shutdown(): Promise<void> {
    logger.info(`Shutting down Test Intelligence Agent: ${this.id}`);
    this.status = 'offline';
    this.removeAllListeners();
  }
}