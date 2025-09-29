import { EventEmitter } from 'events';
import { logger } from '@/utils/logger';
import { SubAgent, AgentCapability, AgentTask, AgentResult } from './agent-orchestrator';
import { AIService } from '@/services/ai/AIService';
import { mcpRegressionService } from '@/services/mcpRegressionService';
import { getSelfHealingService } from '@/services/selfHealingService';
import WeSignCodebaseAnalyzer, { WeSignCodeStructure } from './wesignCodebaseAnalyzer';
import { WeSignKnowledgeIntegrator } from './wesignKnowledgeIntegrator';
import UnifiedKnowledgeService from './unifiedKnowledgeService';

export interface FailureAnalysisResult {
  failureType: string;
  rootCause: string;
  recommendations: string[];
  confidence: number;
  patterns: string[];
  wesignContext?: {
    affectedComponent: string;
    relatedWorkflow: string;
    apiEndpoint?: string;
    businessImpact: string;
  };
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
  private codebaseAnalyzer: WeSignCodebaseAnalyzer;
  private knowledgeService: UnifiedKnowledgeService;
  private wesignKnowledgeIntegrator: WeSignKnowledgeIntegrator;
  private codeStructure: WeSignCodeStructure | null = null;

  constructor() {
    super();
    this.aiService = new AIService();
    this.mcpService = mcpRegressionService;
    this.selfHealingService = getSelfHealingService();
    this.codebaseAnalyzer = new WeSignCodebaseAnalyzer();
    this.knowledgeService = new UnifiedKnowledgeService();
    this.wesignKnowledgeIntegrator = new WeSignKnowledgeIntegrator();

    // Initialize WeSign codebase knowledge
    this.initializeWeSignKnowledge();

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
   * Initialize WeSign codebase knowledge for context-aware failure analysis
   */
  private async initializeWeSignKnowledge(): Promise<void> {
    try {
      logger.info('Initializing WeSign codebase knowledge for failure analysis');
      this.codeStructure = await this.codebaseAnalyzer.analyzeFullCodebase();

      logger.info('WeSign-aware failure analysis initialized', {
        features: this.codeStructure.features.length,
        workflows: this.codeStructure.workflows.length,
        components: this.codeStructure.frontend.components.length,
        controllers: this.codeStructure.backend.controllers.length
      });
    } catch (error) {
      logger.warn('Failed to initialize WeSign knowledge for failure analysis:', error);
      // Continue without codebase knowledge - system still functional
    }
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

    logger.info(`Advanced WeSign-aware AI failure analysis starting for ${failures.length} failures`);

    // Get enhanced WeSign knowledge base
    const wesignKnowledgeBase = await this.wesignKnowledgeIntegrator.initializeWeSignKnowledge();

    // Use MCP service for initial analysis
    const mcpAnalysis = await this.mcpService.analyzeTestFailures(failures);

    // Get WeSign context for codebase-aware analysis
    const wesignContext = await this.getWeSignFailureContext(failures, testContext);

    // Get relevant WeSign knowledge for the failure scenario using enhanced integrator
    const enhancedKnowledgeContext = await this.wesignKnowledgeIntegrator.getKnowledgeForQuery(
      this.buildFailureQueryFromContext(failures, testContext)
    );

    // Map failures to specific WeSign components using knowledge base
    const componentMapping = await this.mapFailuresToComponents(failures, wesignKnowledgeBase);

    // Get workflow context if failure affects critical workflows
    const workflowContext = this.getWorkflowContext(failures, wesignKnowledgeBase);

    // Get selector recommendations for healing
    const selectorRecommendations = this.getSelectorRecommendations(failures, wesignKnowledgeBase);

    // Enhanced AI analysis with comprehensive WeSign knowledge
    const prompt = `
    You are an expert WeSign Failure Analysis Agent with comprehensive knowledge of the WeSign digital signature platform.

    COMPREHENSIVE WESIGN KNOWLEDGE CONTEXT:
    Components in Knowledge Base: ${wesignKnowledgeBase.componentMap.size}
    Workflows in Knowledge Base: ${wesignKnowledgeBase.workflowMap.size}
    Selectors in Knowledge Base: ${wesignKnowledgeBase.selectorMap.size}

    FAILURE COMPONENT MAPPING:
    ${JSON.stringify(componentMapping, null, 2)}

    WORKFLOW CONTEXT:
    ${JSON.stringify(workflowContext, null, 2)}

    SELECTOR RECOMMENDATIONS:
    ${JSON.stringify(selectorRecommendations, null, 2)}

    ENHANCED KNOWLEDGE CONTEXT:
    ${JSON.stringify(enhancedKnowledgeContext.results.slice(0, 5), null, 2)}

    FAILURE DATA:
    Failures: ${JSON.stringify(failures, null, 2)}
    MCP Analysis: ${JSON.stringify(mcpAnalysis, null, 2)}
    Test Results: ${JSON.stringify(testResults, null, 2)}
    Test Context: ${JSON.stringify(testContext, null, 2)}

    Provide comprehensive WeSign-specific failure analysis:

    1. **Component-Specific Analysis**: Map each failure to specific WeSign Angular components with exact business function understanding

    2. **Workflow Impact Assessment**: Determine which WeSign workflows are affected (Document Signing, Authentication, etc.)

    3. **Selector Stability Analysis**: Evaluate selector stability and recommend healing strategies based on actual component knowledge

    4. **Hebrew/English UI Considerations**: Consider RTL/LTR layout impacts and i18n-specific issues

    5. **Business Impact Scoring**: Rate impact on critical WeSign business functions (1-10 scale)

    6. **Healing Strategy Recommendations**: Provide specific, actionable healing approaches based on component knowledge

    7. **Prevention Strategies**: Suggest improvements to prevent similar failures using WeSign architecture knowledge

    8. **Confidence Assessment**: Score confidence based on knowledge base evidence strength

    Focus specifically on:
    - WeSign Angular component stability patterns from knowledge base
    - Document signing workflow integrity and common failure points
    - Authentication flow robustness (OAuth, Smart Card, OTP)
    - Form field interaction patterns and validation issues
    - Hebrew UI rendering and RTL layout stability
    - Selector reliability based on actual component analysis
    - API endpoint reliability and error handling patterns

    Use the comprehensive component and workflow knowledge to provide precise, actionable analysis.
    `;

    const aiResponse = await this.aiService.chatCompletion([
      {
        role: 'system',
        content: 'You are a WeSign platform expert with comprehensive knowledge base access. Use the provided component, workflow, and selector knowledge to deliver precise failure analysis and healing recommendations.'
      },
      { role: 'user', content: prompt }
    ], {
      reasoning_effort: 'high',
      verbosity: 'high',
      maxTokens: 6000
    });

    const analysis = this.parseAIAnalysis(aiResponse.choices[0].message.content || '');

    // Enhanced analysis with knowledge base integration
    const enhancedFailureTypes = this.categorizeFailuresWithKnowledgeBase(failures, wesignKnowledgeBase);
    const enhancedRootCauses = this.identifyRootCausesWithKnowledgeBase(failures, testResults, wesignKnowledgeBase);
    const enhancedPatterns = this.extractPatternsWithKnowledgeBase(failures, wesignKnowledgeBase);

    // Build comprehensive WeSign-specific context for the result
    const resultWesignContext = {
      affectedComponent: componentMapping.primaryComponent || 'Unknown Component',
      relatedWorkflow: workflowContext.primaryWorkflow || 'Unknown Workflow',
      apiEndpoint: componentMapping.apiEndpoint,
      businessImpact: this.assessEnhancedBusinessImpact(componentMapping, workflowContext),
      selectorRecommendations: selectorRecommendations,
      knowledgeBaseEvidence: {
        componentsAnalyzed: componentMapping.componentsFound,
        workflowsAffected: workflowContext.workflowsAffected,
        selectorStability: selectorRecommendations.averageStability,
        confidenceScore: analysis.confidence || 0.9
      }
    };

    return {
      failureType: analysis.failureType || enhancedFailureTypes[0] || 'WeSign Component Issue',
      rootCause: analysis.rootCause || enhancedRootCauses[0] || 'WeSign workflow investigation needed',
      recommendations: analysis.recommendations || this.getEnhancedRecommendations(failures, wesignKnowledgeBase),
      confidence: analysis.confidence || 0.92,
      patterns: analysis.patterns || enhancedPatterns,
      wesignContext: resultWesignContext
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
   * Get WeSign-specific context for failure analysis
   */
  private async getWeSignFailureContext(failures: any[], testContext: any): Promise<any> {
    if (!this.codeStructure) {
      logger.warn('WeSign codebase not initialized, using basic context');
      return { components: [], workflows: [], apiEndpoints: [] };
    }

    const context = {
      components: [],
      workflows: [],
      apiEndpoints: [],
      features: []
    };

    // Map failures to WeSign components based on selectors, URLs, or test names
    for (const failure of failures) {
      const failureContext = this.mapFailureToWeSignComponents(failure);
      if (failureContext.component) context.components.push(failureContext.component);
      if (failureContext.workflow) context.workflows.push(failureContext.workflow);
      if (failureContext.apiEndpoint) context.apiEndpoints.push(failureContext.apiEndpoint);
      if (failureContext.feature) context.features.push(failureContext.feature);
    }

    return {
      components: [...new Set(context.components)],
      workflows: [...new Set(context.workflows)],
      apiEndpoints: [...new Set(context.apiEndpoints)],
      features: [...new Set(context.features)]
    };
  }

  /**
   * Map individual failure to WeSign components
   */
  private mapFailureToWeSignComponents(failure: any): any {
    const result = { component: null, workflow: null, apiEndpoint: null, feature: null };

    const url = failure.url || '';
    const selector = failure.selector || '';
    const testName = failure.testName || '';
    const error = failure.error || '';

    // Map based on URL patterns
    if (url.includes('/contacts') || testName.includes('contact') || selector.includes('contact')) {
      result.component = 'ContactManagementComponent';
      result.workflow = 'Contact Management';
      result.apiEndpoint = '/api/contacts';
      result.feature = 'Contact Management';
    } else if (url.includes('/documents') || testName.includes('document') || selector.includes('document')) {
      result.component = 'DocumentManagementComponent';
      result.workflow = 'Document Processing';
      result.apiEndpoint = '/api/documents';
      result.feature = 'Document Management';
    } else if (url.includes('/templates') || testName.includes('template') || selector.includes('template')) {
      result.component = 'TemplateManagementComponent';
      result.workflow = 'Template Management';
      result.apiEndpoint = '/api/templates';
      result.feature = 'Template Management';
    } else if (url.includes('/sign') || testName.includes('sign') || selector.includes('sign')) {
      result.component = 'SigningComponent';
      result.workflow = 'Digital Signature';
      result.apiEndpoint = '/api/signing';
      result.feature = 'Digital Signing';
    } else if (url.includes('/auth') || testName.includes('login') || selector.includes('auth')) {
      result.component = 'AuthenticationComponent';
      result.workflow = 'Authentication';
      result.apiEndpoint = '/api/auth';
      result.feature = 'Authentication';
    } else if (url.includes('/dashboard') || testName.includes('dashboard')) {
      result.component = 'DashboardComponent';
      result.workflow = 'Dashboard Navigation';
      result.feature = 'Dashboard';
    }

    // Additional Hebrew-specific mappings
    if (error.includes('hebrew') || testName.includes('hebrew') || url.includes('/he')) {
      result.feature = result.feature ? `${result.feature} (Hebrew)` : 'Hebrew UI';
    }

    return result;
  }

  /**
   * Build failure query for knowledge service
   */
  private buildFailureQueryFromContext(failures: any[], testContext: any): string {
    const errorTypes = failures.map(f => {
      if (f.error?.includes('element')) return 'element selection';
      if (f.error?.includes('timeout')) return 'timeout';
      if (f.error?.includes('network')) return 'network';
      return 'general error';
    });

    const workflows = failures.map(f => this.mapFailureToWeSignComponents(f).workflow).filter(Boolean);
    const components = failures.map(f => this.mapFailureToWeSignComponents(f).component).filter(Boolean);

    return `WeSign test failure: ${errorTypes.join(', ')} in ${workflows.join(', ')} ${components.join(', ')}`;
  }

  /**
   * Format WeSign context for AI prompt
   */
  private formatWeSignContext(wesignContext: any): string {
    return `
Components: ${wesignContext.components.join(', ')}
Workflows: ${wesignContext.workflows.join(', ')}
API Endpoints: ${wesignContext.apiEndpoints.join(', ')}
Features: ${wesignContext.features.join(', ')}
    `.trim();
  }

  /**
   * Format knowledge context for AI prompt
   */
  private formatKnowledgeContext(knowledgeContext: any): string {
    if (!knowledgeContext || !knowledgeContext.results) {
      return 'No specific knowledge found for this failure scenario.';
    }

    return knowledgeContext.results.slice(0, 5).map((result: any, index: number) =>
      `${index + 1}. ${result.title || result.content?.substring(0, 100)}...`
    ).join('\n');
  }

  /**
   * Categorize failures with WeSign-specific knowledge
   */
  private categorizeWeSignFailures(failures: any[], wesignContext: any): string[] {
    const types = [];

    for (const failure of failures) {
      const mapping = this.mapFailureToWeSignComponents(failure);

      if (failure.error?.includes('element') && mapping.component) {
        types.push(`${mapping.component} Element Issue`);
      } else if (failure.error?.includes('timeout') && mapping.workflow) {
        types.push(`${mapping.workflow} Timing Issue`);
      } else if (failure.error?.includes('network') && mapping.apiEndpoint) {
        types.push(`${mapping.apiEndpoint} Network Issue`);
      } else if (mapping.feature) {
        types.push(`${mapping.feature} General Failure`);
      } else {
        types.push('Unknown WeSign Component');
      }
    }

    return [...new Set(types)];
  }

  /**
   * Identify WeSign-specific root causes
   */
  private identifyWeSignRootCauses(failures: any[], testResults: any[], wesignContext: any): string[] {
    const causes = [];

    // WeSign-specific root cause patterns
    if (failures.some(f => f.error?.includes('hebrew') || f.url?.includes('/he'))) {
      causes.push('Hebrew/RTL UI layout instability');
    }

    if (failures.some(f => f.selector?.includes('sign') || f.url?.includes('sign'))) {
      causes.push('Digital signature component DOM changes');
    }

    if (failures.some(f => f.error?.includes('document') && f.error?.includes('upload'))) {
      causes.push('Document upload/processing pipeline issues');
    }

    if (failures.some(f => f.selector?.includes('contact') || f.url?.includes('contact'))) {
      causes.push('Contact management UI component instability');
    }

    if (wesignContext.workflows.includes('Authentication') && failures.some(f => f.error?.includes('401'))) {
      causes.push('WeSign authentication token expiration');
    }

    // Fallback to general causes
    if (causes.length === 0) {
      if (failures.some(f => f.selector)) causes.push('WeSign component selector changes');
      if (failures.some(f => f.error?.includes('timeout'))) causes.push('WeSign API performance degradation');
    }

    return causes.length > 0 ? causes : ['WeSign platform investigation required'];
  }

  /**
   * Extract WeSign-specific patterns
   */
  private extractWeSignPatterns(failures: any[], wesignContext: any): string[] {
    const patterns = [];

    // WeSign workflow patterns
    if (wesignContext.workflows.includes('Digital Signature')) {
      patterns.push('signing-workflow-issues');
    }

    if (wesignContext.workflows.includes('Contact Management')) {
      patterns.push('contact-management-issues');
    }

    if (wesignContext.workflows.includes('Document Processing')) {
      patterns.push('document-processing-issues');
    }

    // Hebrew/localization patterns
    if (failures.some(f => f.error?.includes('hebrew') || f.url?.includes('/he'))) {
      patterns.push('hebrew-localization-issues');
    }

    // API patterns
    if (wesignContext.apiEndpoints.length > 0) {
      patterns.push('wesign-api-integration-issues');
    }

    // Component patterns
    if (wesignContext.components.length > 1) {
      patterns.push('multi-component-failure');
    }

    return patterns;
  }

  /**
   * Build WeSign context for result
   */
  private buildResultWeSignContext(failures: any[], wesignContext: any, analysis: any): any {
    const primaryFailure = failures[0];
    const mapping = this.mapFailureToWeSignComponents(primaryFailure);

    return {
      affectedComponent: mapping.component || wesignContext.components[0] || 'Unknown Component',
      relatedWorkflow: mapping.workflow || wesignContext.workflows[0] || 'Unknown Workflow',
      apiEndpoint: mapping.apiEndpoint || wesignContext.apiEndpoints[0],
      businessImpact: this.assessBusinessImpact(mapping.workflow || wesignContext.workflows[0])
    };
  }

  /**
   * Get WeSign-specific recommendations
   */
  private getWeSignSpecificRecommendations(failures: any[], wesignContext: any): string[] {
    const recommendations = [];

    // Component-specific recommendations
    if (wesignContext.components.includes('ContactManagementComponent')) {
      recommendations.push('Review contact form validation and data binding');
      recommendations.push('Check contact list pagination and sorting stability');
    }

    if (wesignContext.components.includes('SigningComponent')) {
      recommendations.push('Verify digital signature canvas rendering');
      recommendations.push('Check document loading and signature placement');
    }

    if (wesignContext.components.includes('DocumentManagementComponent')) {
      recommendations.push('Review file upload progress indicators');
      recommendations.push('Check document preview and download functionality');
    }

    // Hebrew/RTL recommendations
    if (failures.some(f => f.error?.includes('hebrew') || f.url?.includes('/he'))) {
      recommendations.push('Review Hebrew text rendering and RTL layout');
      recommendations.push('Check text alignment and direction in forms');
    }

    // API recommendations
    if (wesignContext.apiEndpoints.length > 0) {
      recommendations.push('Monitor WeSign API response times and error rates');
      recommendations.push('Implement retry logic for transient API failures');
    }

    return recommendations.length > 0 ? recommendations : [
      'Review WeSign component stability and error handling',
      'Add comprehensive logging for WeSign workflow failures',
      'Implement graceful degradation for WeSign features'
    ];
  }

  /**
   * Assess business impact of WeSign workflow failures
   */
  private assessBusinessImpact(workflow: string): string {
    const impactMap: { [key: string]: string } = {
      'Digital Signature': 'High - Core business function affecting document signing capabilities',
      'Contact Management': 'Medium - User management functionality impacted',
      'Document Processing': 'High - Document handling and workflow management affected',
      'Template Management': 'Medium - Template creation and management affected',
      'Authentication': 'Critical - User access and security compromised',
      'Dashboard Navigation': 'Low - User experience and navigation affected'
    };

    return impactMap[workflow] || 'Medium - WeSign functionality may be impacted';
  }

  /**
   * Map failures to WeSign components using knowledge base
   */
  private async mapFailuresToComponents(failures: any[], knowledgeBase: any): Promise<any> {
    const mapping = {
      primaryComponent: null,
      apiEndpoint: null,
      componentsFound: [],
      confidence: 0
    };

    for (const failure of failures) {
      const testName = failure.testName || '';
      const selector = failure.selector || '';
      const url = failure.url || '';

      // Search for matching components in knowledge base
      for (const [componentName, componentKnowledge] of knowledgeBase.componentMap) {
        if (testName.toLowerCase().includes(componentName.toLowerCase()) ||
            selector.includes(componentName) ||
            url.includes(componentName)) {

          mapping.componentsFound.push({
            name: componentName,
            businessFunction: componentKnowledge.businessFunction,
            matchReason: 'test name/selector match'
          });

          if (!mapping.primaryComponent) {
            mapping.primaryComponent = componentName;
            mapping.confidence = 0.85;
          }
        }
      }
    }

    return mapping;
  }

  /**
   * Get workflow context for failures
   */
  private getWorkflowContext(failures: any[], knowledgeBase: any): any {
    const context = {
      primaryWorkflow: null,
      workflowsAffected: [],
      criticalPathImpacted: false
    };

    for (const [workflowName, workflowKnowledge] of knowledgeBase.workflowMap) {
      const isAffected = failures.some(failure => {
        const testName = failure.testName || '';
        return workflowKnowledge.components.some((comp: string) =>
          testName.toLowerCase().includes(comp.toLowerCase())
        );
      });

      if (isAffected) {
        context.workflowsAffected.push({
          name: workflowName,
          criticalPath: workflowKnowledge.criticalPath,
          components: workflowKnowledge.components
        });

        if (!context.primaryWorkflow) {
          context.primaryWorkflow = workflowName;
        }

        if (workflowKnowledge.criticalPath) {
          context.criticalPathImpacted = true;
        }
      }
    }

    return context;
  }

  /**
   * Get selector recommendations using knowledge base
   */
  private getSelectorRecommendations(failures: any[], knowledgeBase: any): any {
    const recommendations = {
      averageStability: 0,
      recommendations: [],
      totalSelectors: knowledgeBase.selectorMap.size
    };

    const stabilities = [];

    for (const failure of failures) {
      const selector = failure.selector;
      if (selector) {
        // Find matching selector knowledge
        for (const [elementKey, selectorKnowledge] of knowledgeBase.selectorMap) {
          if (selector.includes(selectorKnowledge.primary) ||
              selectorKnowledge.alternatives.includes(selector)) {

            recommendations.recommendations.push({
              currentSelector: selector,
              primaryRecommendation: selectorKnowledge.primary,
              alternatives: selectorKnowledge.alternatives,
              stability: selectorKnowledge.stability,
              component: selectorKnowledge.component
            });

            stabilities.push(selectorKnowledge.stability);
          }
        }
      }
    }

    recommendations.averageStability = stabilities.length > 0 ?
      stabilities.reduce((a, b) => a + b, 0) / stabilities.length : 0.5;

    return recommendations;
  }

  /**
   * Enhanced failure categorization with knowledge base
   */
  private categorizeFailuresWithKnowledgeBase(failures: any[], knowledgeBase: any): string[] {
    const types = [];

    for (const failure of failures) {
      // Use knowledge base to determine precise failure type
      const componentContext = this.findComponentForFailure(failure, knowledgeBase);

      if (componentContext) {
        if (failure.error?.includes('element') || failure.error?.includes('selector')) {
          types.push(`${componentContext.businessFunction} - Element Selection Issue`);
        } else if (failure.error?.includes('timeout')) {
          types.push(`${componentContext.businessFunction} - Timing Issue`);
        } else {
          types.push(`${componentContext.businessFunction} - General Issue`);
        }
      } else {
        // Fallback to basic categorization
        types.push(this.classifyRealTimeFailure(failure));
      }
    }

    return [...new Set(types)];
  }

  /**
   * Enhanced root cause identification with knowledge base
   */
  private identifyRootCausesWithKnowledgeBase(failures: any[], testResults: any[], knowledgeBase: any): string[] {
    const causes = [];

    // WeSign-specific root causes based on knowledge base
    for (const failure of failures) {
      const componentContext = this.findComponentForFailure(failure, knowledgeBase);

      if (componentContext) {
        // Check for common failure patterns in this component
        if (componentContext.commonFailures && componentContext.commonFailures.length > 0) {
          componentContext.commonFailures.forEach((failurePattern: any) => {
            if (failure.error?.toLowerCase().includes(failurePattern.type.toLowerCase())) {
              causes.push(`${componentContext.businessFunction}: ${failurePattern.description}`);
            }
          });
        }
      }
    }

    // Add workflow-specific causes
    const workflowContext = this.getWorkflowContext(failures, knowledgeBase);
    workflowContext.workflowsAffected.forEach((workflow: any) => {
      if (workflow.criticalPath) {
        causes.push(`Critical workflow disrupted: ${workflow.name}`);
      }
    });

    return causes.length > 0 ? causes : ['WeSign component investigation needed'];
  }

  /**
   * Enhanced pattern extraction with knowledge base
   */
  private extractPatternsWithKnowledgeBase(failures: any[], knowledgeBase: any): string[] {
    const patterns = [];

    // Component-based patterns
    const componentPatterns = new Map();
    failures.forEach(failure => {
      const componentContext = this.findComponentForFailure(failure, knowledgeBase);
      if (componentContext) {
        const existing = componentPatterns.get(componentContext.businessFunction) || 0;
        componentPatterns.set(componentContext.businessFunction, existing + 1);
      }
    });

    // If multiple failures in same business function
    componentPatterns.forEach((count, businessFunction) => {
      if (count > 1) {
        patterns.push(`multiple-${businessFunction.toLowerCase().replace(/\s+/g, '-')}-failures`);
      }
    });

    // Workflow patterns
    const workflowContext = this.getWorkflowContext(failures, knowledgeBase);
    if (workflowContext.criticalPathImpacted) {
      patterns.push('critical-workflow-impacted');
    }

    // Selector stability patterns
    const selectorRecommendations = this.getSelectorRecommendations(failures, knowledgeBase);
    if (selectorRecommendations.averageStability < 0.7) {
      patterns.push('low-selector-stability');
    }

    return patterns;
  }

  /**
   * Find component context for a specific failure
   */
  private findComponentForFailure(failure: any, knowledgeBase: any): any {
    const testName = failure.testName || '';
    const selector = failure.selector || '';
    const url = failure.url || '';

    for (const [componentName, componentKnowledge] of knowledgeBase.componentMap) {
      if (testName.toLowerCase().includes(componentName.toLowerCase()) ||
          selector.includes(componentName) ||
          url.includes(componentName)) {
        return componentKnowledge;
      }
    }

    return null;
  }

  /**
   * Assess enhanced business impact
   */
  private assessEnhancedBusinessImpact(componentMapping: any, workflowContext: any): string {
    let impact = 'Medium';
    let score = 5;

    // Critical workflow impact
    if (workflowContext.criticalPathImpacted) {
      score += 3;
      impact = 'High';
    }

    // Component-specific impact
    if (componentMapping.primaryComponent) {
      const criticalComponents = ['main-signer', 'sign-pad', 'oauth-comsign-idp'];
      if (criticalComponents.some(comp =>
        componentMapping.primaryComponent.toLowerCase().includes(comp))) {
        score += 2;
        impact = 'Critical';
      }
    }

    // Multiple components affected
    if (componentMapping.componentsFound.length > 2) {
      score += 1;
    }

    if (score >= 8) return 'Critical - Core business function compromised';
    if (score >= 6) return 'High - Important functionality affected';
    if (score >= 4) return 'Medium - User experience impacted';
    return 'Low - Minor functionality affected';
  }

  /**
   * Get enhanced recommendations
   */
  private getEnhancedRecommendations(failures: any[], knowledgeBase: any): string[] {
    const recommendations = [];

    // Component-specific recommendations
    const componentMapping = this.mapFailuresToComponents(failures, knowledgeBase);
    if (componentMapping && componentMapping.componentsFound.length > 0) {
      componentMapping.componentsFound.forEach((comp: any) => {
        recommendations.push(`Review ${comp.businessFunction} component stability`);
        recommendations.push(`Verify ${comp.name} component testable elements and selectors`);
      });
    }

    // Workflow-specific recommendations
    const workflowContext = this.getWorkflowContext(failures, knowledgeBase);
    workflowContext.workflowsAffected.forEach((workflow: any) => {
      if (workflow.criticalPath) {
        recommendations.push(`Priority fix required: ${workflow.name} is a critical path workflow`);
      }
      recommendations.push(`Test ${workflow.name} workflow end-to-end after fixes`);
    });

    // Selector stability recommendations
    const selectorRecommendations = this.getSelectorRecommendations(failures, knowledgeBase);
    if (selectorRecommendations.averageStability < 0.7) {
      recommendations.push('Improve selector stability by using data-testid attributes');
      recommendations.push('Review and update element selection strategies');
    }

    selectorRecommendations.recommendations.forEach((rec: any) => {
      if (rec.stability < 0.6) {
        recommendations.push(`Update selector for ${rec.component}: use ${rec.primaryRecommendation}`);
      }
    });

    return recommendations.length > 0 ? recommendations : [
      'Perform comprehensive WeSign component analysis',
      'Review test automation selector strategies',
      'Implement component-specific error handling'
    ];
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