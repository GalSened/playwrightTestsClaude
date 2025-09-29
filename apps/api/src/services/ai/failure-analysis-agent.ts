import { EventEmitter } from 'events';
import { logger } from '@/utils/logger';
import { SubAgent, AgentCapability, AgentTask, AgentResult } from './agent-orchestrator';
import { AIService } from '@/services/ai/AIService';
import { mcpRegressionService } from '@/services/mcpRegressionService';
import { getSelfHealingService } from '@/services/selfHealingService';

export interface FailureAnalysisResult {
  failureType: string;
  rootCause: string;
  recommendations: string[];
  confidence: number;
  patterns: string[];
}

export class FailureAnalysisAgent extends EventEmitter implements SubAgent {
  public readonly id = 'failure-analysis-agent';
  public readonly type = 'failure-analysis';
  public readonly version = '2.0.0';
  public readonly capabilities: AgentCapability[] = [
    'test-analysis',
    'failure-prediction',
    'root-cause-analysis',
    'test-failure-investigation'
  ];
  public status: 'idle' | 'active' | 'error' | 'initializing' = 'idle';

  private aiService: AIService;
  private mcpService: any;
  private selfHealingService: any;

  constructor() {
    super();
    this.aiService = new AIService();
    this.mcpService = mcpRegressionService;
    this.selfHealingService = getSelfHealingService();

    logger.info('FailureAnalysisAgent initialized with AI services', {
      id: this.id,
      capabilities: this.capabilities.length
    });

    // Start listening for test execution events
    this.setupEventListeners();
  }

  /**
   * Setup event listeners for real-time failure analysis
   */
  private setupEventListeners(): void {
    // This will be called when TestIntelligenceAgent registers
    this.on('testIntelligenceAgentReady', (testIntelligenceAgent) => {
      this.connectToTestIntelligenceAgent(testIntelligenceAgent);
    });
  }

  /**
   * Connect to TestIntelligenceAgent to listen for test execution events
   */
  private connectToTestIntelligenceAgent(testIntelligenceAgent: any): void {
    testIntelligenceAgent.on('testExecuted', async (eventData: any) => {
      await this.handleTestExecutionEvent(eventData);
    });

    testIntelligenceAgent.on('suiteExecuted', async (eventData: any) => {
      await this.handleSuiteExecutionEvent(eventData);
    });

    logger.info('FailureAnalysisAgent connected to TestIntelligenceAgent for real-time failure analysis');
  }

  /**
   * Handle real-time test execution events
   */
  private async handleTestExecutionEvent(eventData: any): Promise<void> {
    try {
      const { testId, result, analysis } = eventData;

      // Only analyze if there are failures
      if (result.status === 'failed' || result.failures?.length > 0) {
        logger.info('FailureAnalysisAgent analyzing real-time test failure', {
          testId,
          failureCount: result.failures?.length || 0
        });

        // Perform immediate failure analysis
        const failureAnalysis = await this.analyzeRealTimeFailures({
          testId,
          failures: result.failures || [],
          testResult: result,
          testContext: analysis || {},
          executionContext: eventData
        });

        // Integrate with self-healing if failures detected
        if (failureAnalysis.patterns.includes('healable-failure')) {
          await this.triggerSelfHealing(testId, result.failures[0], failureAnalysis);
        }

        // Emit analysis results for other agents
        this.emit('failureAnalysisComplete', {
          testId,
          analysis: failureAnalysis,
          timestamp: new Date(),
          healingTriggered: failureAnalysis.patterns.includes('healable-failure')
        });
      }
    } catch (error) {
      logger.error('Failed to handle test execution event', { error, eventData });
    }
  }

  /**
   * Handle real-time suite execution events
   */
  private async handleSuiteExecutionEvent(eventData: any): Promise<void> {
    try {
      const { suiteName, results, analysis } = eventData;

      // Aggregate failures across the suite
      const allFailures = results.reduce((acc: any[], result: any) => {
        return acc.concat(result.failures || []);
      }, []);

      if (allFailures.length > 0) {
        logger.info('FailureAnalysisAgent analyzing suite failures', {
          suiteName,
          totalFailures: allFailures.length,
          affectedTests: results.filter((r: any) => r.failures?.length > 0).length
        });

        // Analyze patterns across the entire suite
        const suiteAnalysis = await this.analyzeSuiteFailurePatterns({
          suiteName,
          failures: allFailures,
          suiteResults: results,
          analysis
        });

        // Emit suite analysis results
        this.emit('suiteAnalysisComplete', {
          suiteName,
          analysis: suiteAnalysis,
          timestamp: new Date(),
          affectedTests: results.filter((r: any) => r.failures?.length > 0).length
        });
      }
    } catch (error) {
      logger.error('Failed to handle suite execution event', { error, eventData });
    }
  }

  async execute(task: AgentTask): Promise<AgentResult> {
    this.status = 'active';
    const startTime = Date.now();

    try {
      logger.info(`FailureAnalysisAgent executing task: ${task.id}`, {
        type: task.type,
        dataKeys: Object.keys(task.data || {})
      });

      let result;
      switch (task.type) {
        case 'analyze-failures':
          result = await this.analyzeFailures(task.data);
          break;
        case 'root-cause-analysis':
          result = await this.performRootCauseAnalysis(task.data);
          break;
        case 'failure-pattern-recognition':
          result = await this.recognizeFailurePatterns(task.data);
          break;
        case 'health-check':
          result = {
            status: 'healthy',
            version: this.version,
            capabilities: this.capabilities.length,
            lastCheck: new Date().toISOString(),
            failureType: 'Health Check',
            rootCause: 'Agent is operational',
            recommendations: ['Continue monitoring'],
            confidence: 1.0,
            patterns: ['health-check']
          };
          break;
        default:
          throw new Error(`Unsupported task type: ${task.type}`);
      }

      const executionTime = Date.now() - startTime;
      this.status = 'idle';

      return {
        taskId: task.id,
        agentId: this.id,
        status: 'success',
        data: result,
        metrics: {
          executionTime,
          confidence: result.confidence || 0.8,
          memoryUsed: process.memoryUsage().heapUsed
        },
        completedAt: new Date()
      };

    } catch (error) {
      this.status = 'error';
      const executionTime = Date.now() - startTime;

      logger.error(`FailureAnalysisAgent task ${task.id} failed:`, error);

      return {
        taskId: task.id,
        agentId: this.id,
        status: 'error',
        data: { error: error instanceof Error ? error.message : 'Unknown error' },
        metrics: {
          executionTime,
          confidence: 0,
          memoryUsed: process.memoryUsage().heapUsed
        },
        completedAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Real-time failure analysis for immediate processing
   */
  private async analyzeRealTimeFailures(data: any): Promise<FailureAnalysisResult> {
    const { testId, failures, testResult, testContext, executionContext } = data;

    logger.info('Performing real-time failure analysis', {
      testId,
      failureCount: failures.length,
      testStatus: testResult.status
    });

    // Enhanced AI analysis with immediate processing focus
    const prompt = `
    URGENT: Real-time test failure analysis for immediate healing decision:

    Test ID: ${testId}
    Failures: ${JSON.stringify(failures, null, 2)}
    Test Result: ${JSON.stringify(testResult, null, 2)}
    Execution Context: ${JSON.stringify(executionContext, null, 2)}

    Perform RAPID analysis and classification:
    1. Is this failure HEALABLE? (selector issues, timing problems, DOM changes)
    2. Failure urgency level (1-5, where 5 = critical business flow)
    3. WeSign-specific impact (Hebrew UI, document signing, payment flow)
    4. Immediate root cause (specific and actionable)
    5. Self-healing confidence score (0-1)
    6. Alternative selectors or healing strategies

    Focus on speed and actionability for real-time healing decisions.
    Classify as 'healable-failure' if automated healing is recommended.
    `;

    const aiResponse = await this.aiService.chatCompletion([
      { role: 'system', content: 'You are a real-time failure analysis specialist. Prioritize speed and healing actionability.' },
      { role: 'user', content: prompt }
    ], {
      reasoning_effort: 'medium',
      verbosity: 'medium',
      maxTokens: 2000
    });

    const analysis = this.parseAIAnalysis(aiResponse.choices[0].message.content || '');

    // Enhanced pattern recognition for real-time processing
    const patterns = this.detectRealTimePatterns(failures, testResult, testContext);

    // Determine if this failure is suitable for self-healing
    const isHealable = this.assessHealability(failures, analysis);
    if (isHealable) {
      patterns.push('healable-failure');
    }

    return {
      failureType: analysis.failureType || this.classifyRealTimeFailure(failures[0]),
      rootCause: analysis.rootCause || 'Real-time analysis in progress',
      recommendations: analysis.recommendations || this.generateRealTimeRecommendations(failures),
      confidence: analysis.confidence || 0.85,
      patterns
    };
  }

  /**
   * Analyze failure patterns across an entire test suite
   */
  private async analyzeSuiteFailurePatterns(data: any): Promise<FailureAnalysisResult> {
    const { suiteName, failures, suiteResults, analysis } = data;

    logger.info('Analyzing suite-wide failure patterns', {
      suiteName,
      totalFailures: failures.length,
      affectedTests: suiteResults.filter((r: any) => r.failures?.length > 0).length
    });

    // Cross-test pattern analysis
    const patterns = this.detectSuitePatterns(failures, suiteResults);
    const commonRootCauses = this.identifyCommonRootCauses(failures);

    // Enhanced suite-level AI analysis
    const prompt = `
    Suite-wide failure pattern analysis for ${suiteName}:

    Total Failures: ${failures.length}
    Affected Tests: ${suiteResults.filter((r: any) => r.failures?.length > 0).length}

    Failures Summary: ${JSON.stringify(failures.slice(0, 5), null, 2)}

    Identify:
    1. Common failure patterns across tests
    2. Systemic issues (infrastructure, environment, configuration)
    3. WeSign platform-specific suite issues
    4. Cascade failure analysis (which failure caused others)
    5. Priority order for healing/fixing
    6. Suite-level recommendations for stability

    Focus on patterns that affect multiple tests and suite-level stability.
    `;

    const aiResponse = await this.aiService.chatCompletion([
      { role: 'system', content: 'You are a suite-level failure pattern analyst specializing in WeSign test automation.' },
      { role: 'user', content: prompt }
    ], {
      reasoning_effort: 'high',
      verbosity: 'high',
      maxTokens: 3000
    });

    const suiteAnalysis = this.parseAIAnalysis(aiResponse.choices[0].message.content || '');

    return {
      failureType: `Suite Pattern: ${suiteAnalysis.failureType || 'Multiple Issues'}`,
      rootCause: suiteAnalysis.rootCause || commonRootCauses[0] || 'Suite-level investigation needed',
      recommendations: suiteAnalysis.recommendations || [
        'Review suite configuration and setup',
        'Check for environmental instability',
        'Analyze test dependencies and execution order',
        'Implement suite-level error handling'
      ],
      confidence: suiteAnalysis.confidence || 0.75,
      patterns: patterns.concat(suiteAnalysis.patterns || [])
    };
  }

  /**
   * Trigger self-healing for healable failures
   */
  private async triggerSelfHealing(testId: string, failure: any, analysis: FailureAnalysisResult): Promise<void> {
    try {
      logger.info('Triggering self-healing process', {
        testId,
        failureType: analysis.failureType,
        confidence: analysis.confidence
      });

      // Create failure context for self-healing
      const failureContext = {
        dom: failure.dom || '',
        screenshot: failure.screenshot || Buffer.alloc(0),
        consoleErrors: failure.consoleErrors || [],
        networkLogs: failure.networkLogs || [],
        error: failure.error || failure.message,
        url: failure.url || '',
        selector: failure.selector,
        testId,
        testName: failure.testName || testId
      };

      // Add to healing queue
      const queueId = await this.selfHealingService.addToHealingQueue(
        testId,
        failure.testName || testId,
        new Error(failure.error || failure.message),
        failureContext
      );

      // Emit healing triggered event
      this.emit('healingTriggered', {
        testId,
        queueId,
        failureType: analysis.failureType,
        confidence: analysis.confidence,
        timestamp: new Date()
      });

      logger.info('Self-healing process initiated', { testId, queueId });

    } catch (error) {
      logger.error('Failed to trigger self-healing', { error, testId, failure });
    }
  }

  /**
   * Detect real-time failure patterns for immediate analysis
   */
  private detectRealTimePatterns(failures: any[], testResult: any, testContext: any): string[] {
    const patterns: string[] = [];

    // Quick pattern detection for real-time processing
    if (failures.some(f => f.selector || f.error?.includes('element'))) {
      patterns.push('selector-failure');
    }

    if (failures.some(f => f.error?.includes('timeout') || f.error?.includes('wait'))) {
      patterns.push('timing-failure');
    }

    if (testResult.executionTime > 30000) {
      patterns.push('performance-degradation');
    }

    if (failures.some(f => f.error?.includes('hebrew') || f.error?.includes('rtl'))) {
      patterns.push('i18n-failure');
    }

    if (failures.some(f => f.url?.includes('sign') || f.testName?.includes('sign'))) {
      patterns.push('signing-workflow-failure');
    }

    return patterns;
  }

  /**
   * Detect patterns across an entire test suite
   */
  private detectSuitePatterns(failures: any[], suiteResults: any[]): string[] {
    const patterns: string[] = [];

    // Cross-test pattern analysis
    const failureTypes = failures.map(f => this.classifyRealTimeFailure(f));
    const uniqueTypes = [...new Set(failureTypes)];

    if (uniqueTypes.length === 1) {
      patterns.push('uniform-failure-pattern');
    }

    if (failures.length > suiteResults.length * 0.7) {
      patterns.push('widespread-failure');
    }

    const timeoutFailures = failures.filter(f => f.error?.includes('timeout'));
    if (timeoutFailures.length > failures.length * 0.5) {
      patterns.push('suite-timing-issue');
    }

    return patterns;
  }

  /**
   * Assess if a failure is suitable for self-healing
   */
  private assessHealability(failures: any[], analysis: any): boolean {
    // Criteria for healable failures
    const healableCriteria = [
      // Selector-related failures are often healable
      failures.some(f => f.selector && (f.error?.includes('element') || f.error?.includes('locator'))),

      // Timing issues with sufficient confidence
      failures.some(f => f.error?.includes('timeout')) && analysis.confidence > 0.7,

      // DOM stability issues
      failures.some(f => f.error?.includes('stale') || f.error?.includes('detached')),

      // Element interaction failures
      failures.some(f => f.error?.includes('click') || f.error?.includes('type') || f.error?.includes('fill'))
    ];

    // Exclude non-healable failures
    const nonHealableCriteria = [
      failures.some(f => f.error?.includes('500') || f.error?.includes('404')), // Server errors
      failures.some(f => f.error?.includes('network') && f.error?.includes('failed')), // Network failures
      failures.some(f => f.error?.includes('authentication') || f.error?.includes('unauthorized')) // Auth issues
    ];

    return healableCriteria.some(Boolean) && !nonHealableCriteria.some(Boolean);
  }

  /**
   * Classify failure type for real-time processing
   */
  private classifyRealTimeFailure(failure: any): string {
    const error = failure.error?.toLowerCase() || failure.message?.toLowerCase() || '';

    if (error.includes('element') || error.includes('selector') || error.includes('locator')) {
      return 'Element Selection';
    }
    if (error.includes('timeout') || error.includes('wait')) {
      return 'Timing Issue';
    }
    if (error.includes('click') || error.includes('type') || error.includes('fill')) {
      return 'Interaction Failure';
    }
    if (error.includes('network') || error.includes('fetch')) {
      return 'Network Issue';
    }

    return 'General Failure';
  }

  /**
   * Generate real-time recommendations for immediate action
   */
  private generateRealTimeRecommendations(failures: any[]): string[] {
    const recommendations: string[] = [];

    if (failures.some(f => f.selector)) {
      recommendations.push('Review and update element selectors');
      recommendations.push('Consider using more stable selector strategies');
    }

    if (failures.some(f => f.error?.includes('timeout'))) {
      recommendations.push('Increase wait timeouts for dynamic content');
      recommendations.push('Add explicit waits before interactions');
    }

    if (failures.some(f => f.error?.includes('hebrew') || f.url?.includes('he'))) {
      recommendations.push('Verify Hebrew/RTL UI element handling');
      recommendations.push('Check text direction and layout stability');
    }

    return recommendations.length > 0 ? recommendations : [
      'Investigate test environment stability',
      'Review test data and prerequisites',
      'Check for application-level issues'
    ];
  }

  /**
   * Identify common root causes across multiple failures
   */
  private identifyCommonRootCauses(failures: any[]): string[] {
    const causes: string[] = [];

    // Group failures by similarity
    const selectorFailures = failures.filter(f => f.selector);
    const timeoutFailures = failures.filter(f => f.error?.includes('timeout'));
    const networkFailures = failures.filter(f => f.error?.includes('network'));

    if (selectorFailures.length > failures.length * 0.6) {
      causes.push('Widespread selector instability');
    }

    if (timeoutFailures.length > failures.length * 0.5) {
      causes.push('Performance degradation or slow loading');
    }

    if (networkFailures.length > 0) {
      causes.push('Network connectivity issues');
    }

    return causes;
  }

  private async analyzeFailures(data: any): Promise<FailureAnalysisResult> {
    const { failures, testResults, testContext } = data;
    
    logger.info(`Advanced AI failure analysis starting for ${failures.length} failures`);

    // Use MCP service for initial analysis
    const mcpAnalysis = await this.mcpService.analyzeTestFailures(failures);

    // Enhanced AI analysis with deep reasoning
    const prompt = `
    You are an expert Failure Analysis Agent specializing in WeSign platform test failures.
    Analyze these test failures with advanced pattern recognition and root cause analysis:

    Failures: ${JSON.stringify(failures, null, 2)}
    MCP Analysis: ${JSON.stringify(mcpAnalysis, null, 2)}
    Test Results: ${JSON.stringify(testResults, null, 2)}
    Context: ${JSON.stringify(testContext, null, 2)}

    Provide comprehensive analysis:
    1. Primary failure classification (element, network, timing, data, logic)
    2. Detailed root cause analysis with technical reasoning
    3. Pattern recognition across failures (recurring selectors, environments, timing)
    4. Confidence scoring based on evidence strength
    5. Specific actionable recommendations for WeSign workflows
    6. Prevention strategies for similar failures

    Focus on WeSign-specific patterns like Hebrew/English UI, document signing flows,
    payment processing, and multi-tenant architecture considerations.
    `;

    const aiResponse = await this.aiService.chatCompletion([
      { role: 'system', content: 'You are an expert test failure analysis agent with deep WeSign domain knowledge.' },
      { role: 'user', content: prompt }
    ], {
      reasoning_effort: 'high',
      verbosity: 'high',
      maxTokens: 4000
    });

    const analysis = this.parseAIAnalysis(aiResponse.choices[0].message.content || '');
    const failureTypes = this.categorizeFailures(failures);
    const rootCauses = this.identifyRootCauses(failures, testResults);
    const patterns = this.extractPatterns(failures);

    return {
      failureType: analysis.failureType || failureTypes[0] || 'Unknown',
      rootCause: analysis.rootCause || rootCauses[0] || 'Investigation needed',
      recommendations: analysis.recommendations || [
        'Review element selectors for stability',
        'Add explicit waits before interactions',
        'Verify test data consistency',
        'Check network conditions during test execution'
      ],
      confidence: analysis.confidence || 0.85,
      patterns: analysis.patterns || patterns
    };
  }

  private async performRootCauseAnalysis(data: any): Promise<FailureAnalysisResult> {
    const { failures, testContext } = data;
    
    logger.info('Performing advanced root cause analysis with AI');

    const prompt = `
    Perform deep root cause analysis for these test failures with forensic precision:
    
    Failures: ${JSON.stringify(failures, null, 2)}
    Context: ${JSON.stringify(testContext, null, 2)}
    
    Analyze systematically:
    1. Timeline reconstruction - what happened step by step
    2. Environmental factors (browser, network, timing, data)
    3. Code/selector stability analysis 
    4. WeSign platform-specific factors (Hebrew/English, document states, user roles)
    5. Infrastructure considerations (load, resources, dependencies)
    
    Provide:
    - Primary root cause with technical evidence
    - Secondary contributing factors
    - Confidence level with reasoning
    - Specific technical remediation steps
    `;

    const aiResponse = await this.aiService.chatCompletion([
      { role: 'system', content: 'You are a forensic test failure analyst with expertise in WeSign platform architecture.' },
      { role: 'user', content: prompt }
    ], {
      reasoning_effort: 'high',
      verbosity: 'high',
      maxTokens: 3500
    });

    const analysis = this.parseAIAnalysis(aiResponse.choices[0].message.content || '');

    return {
      failureType: analysis.failureType || 'Element Not Found',
      rootCause: analysis.rootCause || 'Dynamic DOM changes after page load',
      recommendations: analysis.recommendations || [
        'Use more stable selectors (data-testid)',
        'Increase wait timeout for dynamic elements',
        'Add retry logic for flaky interactions'
      ],
      confidence: analysis.confidence || 0.85,
      patterns: analysis.patterns || ['dom-instability', 'timing-issues']
    };
  }

  private async recognizeFailurePatterns(data: any): Promise<FailureAnalysisResult> {
    // Mock pattern recognition
    await new Promise(resolve => setTimeout(resolve, 80));

    return {
      failureType: 'Pattern: Flaky Element Interaction',
      rootCause: 'Inconsistent element rendering timing',
      recommendations: [
        'Implement smart wait strategies',
        'Use visual regression testing',
        'Add element stability checks'
      ],
      confidence: 0.70,
      patterns: ['flaky-elements', 'timing-dependent', 'dom-mutations']
    };
  }

  private categorizeFailures(failures: any[]): string[] {
    // Simple failure categorization
    const types = [];
    for (const failure of failures) {
      if (failure.error?.includes('element')) {
        types.push('Element Interaction');
      } else if (failure.error?.includes('timeout')) {
        types.push('Timeout');
      } else if (failure.error?.includes('network')) {
        types.push('Network');
      } else {
        types.push('General');
      }
    }
    return [...new Set(types)];
  }

  private identifyRootCauses(failures: any[], testResults: any[]): string[] {
    // Simple root cause identification
    const causes = [];
    
    if (failures.some(f => f.selector)) {
      causes.push('Selector instability');
    }
    if (failures.some(f => f.url?.includes('slow'))) {
      causes.push('Performance issues');
    }
    if (testResults.some(r => r.networkErrors?.length > 0)) {
      causes.push('Network connectivity');
    }
    
    return causes.length > 0 ? causes : ['Unknown root cause'];
  }

  private extractPatterns(failures: any[]): string[] {
    // Simple pattern extraction
    const patterns = [];
    
    if (failures.length > 1) {
      patterns.push('recurring-failures');
    }
    if (failures.some(f => f.screenshot)) {
      patterns.push('visual-failures');
    }
    if (failures.some(f => f.consoleErrors?.length > 0)) {
      patterns.push('javascript-errors');
    }
    
    return patterns;
  }

  /**
   * Parse AI analysis response into structured data
   */
  private parseAIAnalysis(content: string): any {
    try {
      // Extract structured data from AI response
      const lines = content.split('\n');
      const analysis: any = {
        failureType: '',
        rootCause: '',
        recommendations: [],
        patterns: [],
        confidence: 0.8
      };

      // Simple parsing - would be more sophisticated in production
      for (const line of lines) {
        if (line.includes('Failure Type:') || line.includes('failure type')) {
          analysis.failureType = line.split(':')[1]?.trim() || '';
        }
        if (line.includes('Root Cause:') || line.includes('root cause')) {
          analysis.rootCause = line.split(':')[1]?.trim() || '';
        }
        if (line.includes('Confidence:') || line.includes('confidence')) {
          const confidenceMatch = line.match(/(\d+(?:\.\d+)?)/);
          if (confidenceMatch) {
            analysis.confidence = parseFloat(confidenceMatch[1]) / 100;
          }
        }
        if (line.includes('•') || line.includes('-') || line.includes('*')) {
          const recommendation = line.replace(/^[•\-*]\s*/, '').trim();
          if (recommendation && recommendation.length > 10) {
            analysis.recommendations.push(recommendation);
          }
        }
      }

      // Extract patterns from content
      const patternKeywords = ['timing', 'selector', 'network', 'dom', 'element', 'flaky', 'timeout'];
      analysis.patterns = patternKeywords.filter(keyword => 
        content.toLowerCase().includes(keyword)
      );

      return analysis;
    } catch (error) {
      logger.warn('Failed to parse AI analysis:', error);
      return {
        failureType: 'Unknown',
        rootCause: 'Analysis parsing failed',
        recommendations: ['Manual investigation required'],
        patterns: [],
        confidence: 0.5
      };
    }
  }

  getStatus(): any {
    return {
      id: this.id,
      type: this.type,
      status: this.status,
      version: this.version,
      capabilities: this.capabilities.length,
      lastActivity: new Date().toISOString()
    };
  }

  getCapabilities(): AgentCapability[] {
    return [...this.capabilities];
  }

  // Health check method for monitoring
  async healthCheck(): Promise<{ status: string; details: any }> {
    return {
      status: this.status,
      details: {
        id: this.id,
        type: this.type,
        version: this.version,
        capabilities: this.capabilities.length,
        lastCheck: new Date().toISOString()
      }
    };
  }

  // Stub methods to match expected interface
  validateAgentRequirements?(requirements: AgentCapability[]): boolean {
    return requirements.every(req => this.capabilities.includes(req));
  }

  getModelMetrics?(): any {
    return {
      status: this.status,
      version: this.version,
      capabilities: this.capabilities.length,
      lastActivity: new Date().toISOString()
    };
  }
}