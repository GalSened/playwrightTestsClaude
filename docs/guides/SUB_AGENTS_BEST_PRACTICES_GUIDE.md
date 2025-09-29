# Claude Code Sub-Agents System - Best Practices Guide

## Overview

This comprehensive guide covers best practices for using the complete Claude Code sub-agents system in your QA Intelligence platform. The system includes five specialized agents working in coordination to provide autonomous, intelligent test automation capabilities.

## System Architecture Overview

### Sub-Agents Ecosystem
```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│ TestIntelligence    │    │ HealingAgent        │    │ CodeGeneration      │
│ Agent               │◄──►│                     │◄──►│ Agent               │
│ - Failure Analysis  │    │ - Selector Healing  │    │ - AI Test Creation  │
│ - Smart Planning    │    │ - Pattern Learning  │    │ - Template System   │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
           ▲                          ▲                          ▲
           │                          │                          │
           ▼                          ▼                          ▼
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│ QualityAssurance    │    │ AgentOrchestrator   │    │ PerformanceOptimi-  │
│ Agent               │◄──►│                     │◄──►│ zation Agent        │
│ - Code Review       │    │ - Task Delegation   │    │ - Resource Tuning   │
│ - Standards Check   │    │ - Context Sharing   │    │ - Bottleneck Fix    │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

### Core Components
- **AgentOrchestrator**: Central coordination and task delegation
- **ContextManager**: Real-time context sharing across agents
- **HealthMonitor**: Agent health monitoring and recovery
- **Database Layer**: Persistent storage for metrics, patterns, and history

## Getting Started

### System Requirements
- Node.js 18+ with TypeScript support
- SQLite database with Better-SQLite3
- Playwright testing framework
- OpenAI API access for AI capabilities
- WeSign platform access for domain-specific testing

### Initial Setup

1. **Start the Backend Server**
   ```bash
   cd backend
   PORT=8080 npm run dev
   ```

2. **Start the Frontend Dashboard**
   ```bash
   cd playwright-smart
   npm run dev
   ```

3. **Verify Agent Status**
   - Navigate to `http://localhost:3001/sub-agents`
   - Confirm all agents show "ACTIVE" status
   - Check system health metrics

## Agent-Specific Best Practices

### 1. TestIntelligenceAgent

**Purpose**: AI-powered test analysis and failure prediction

**Best Practices:**
```typescript
// Optimal usage for failure analysis
const analysisResult = await agentOrchestrator.delegateTask({
  id: 'analyze-failures',
  type: 'analyze-failures',
  data: {
    failures: recentTestFailures,
    testContext: {
      environment: 'staging',
      browser: 'chromium',
      language: 'he', // Hebrew interface testing
      module: 'documents'
    }
  },
  requirements: ['test-analysis', 'wesign-domain-knowledge']
});
```

**Recommendations:**
- **Use for Complex Failures**: Delegate complex, multi-test failures for pattern recognition
- **Provide Rich Context**: Include environment, browser, language, and module information
- **Regular Pattern Learning**: Run analysis weekly to improve prediction accuracy
- **Bilingual Testing**: Leverage Hebrew/English domain knowledge for WeSign workflows

**Avoid:**
- Using for simple, single-test failures that have obvious causes
- Running analysis on every test failure (use sampling for frequent issues)
- Ignoring confidence scores below 0.7

### 2. HealingAgent

**Purpose**: Autonomous test repair and selector optimization

**Best Practices:**
```typescript
// Optimal healing workflow
const healingResult = await agentOrchestrator.delegateTask({
  id: 'heal-selectors',
  type: 'heal-selectors', 
  data: {
    failedTest: testInfo,
    originalSelector: '[data-testid="submit-button"]',
    context: {
      pageType: 'document-signing',
      language: 'he',
      retryCount: 0
    }
  },
  requirements: ['selector-healing', 'pattern-learning']
});

// Validate healing success
if (healingResult.data.healingAttempt.success) {
  // Update test with healed selector
  await updateTestSelector(testInfo.id, healingResult.data.healedSelector);
}
```

**Recommendations:**
- **Enable Pattern Learning**: Allow the agent to learn from successful healing attempts
- **Use Fallback Strategies**: Configure multiple selector strategies (data-testid, semantic, XPath)
- **Monitor Success Rates**: Track healing effectiveness and adjust thresholds
- **WeSign-Specific Patterns**: Leverage bilingual selector strategies for Hebrew/English content

**Avoid:**
- Applying healing to stable selectors that rarely fail
- Ignoring validation results after healing
- Over-relying on healing without fixing root causes

### 3. CodeGenerationAgent

**Purpose**: AI-powered test creation and template management

**Best Practices:**
```typescript
// Optimal test generation request
const generationRequest = {
  type: 'from-template',
  template: 'wesign-document-upload',
  module: 'documents',
  scenario: 'Upload PDF document with Hebrew filename and validate signature workflow',
  language: 'typescript',
  framework: 'playwright',
  bilingual: true,
  customization: {
    testData: {
      documentType: 'pdf',
      filename: 'טופס_חתימה.pdf',
      signers: ['admin@demo.com', 'user@demo.com']
    },
    assertions: [
      'Document upload successful',
      'Hebrew filename displayed correctly',
      'Signature workflow initiated'
    ]
  },
  qualitySettings: {
    includeErrorHandling: true,
    includeRetries: true,
    includeScreenshots: true,
    codeStyle: 'enterprise'
  }
};

const generatedTest = await agentOrchestrator.delegateTask({
  id: 'generate-test',
  type: 'generate-tests',
  data: { request: generationRequest },
  requirements: ['code-generation', 'wesign-domain-knowledge']
});
```

**Recommendations:**
- **Use Templates First**: Leverage existing templates for common WeSign workflows
- **Rich Context**: Provide detailed scenario descriptions and customization data
- **Quality Review Integration**: Always review generated code with QualityAssuranceAgent
- **Iterative Improvement**: Use feedback to refine templates and generation patterns

**Avoid:**
- Generating tests for simple, repetitive scenarios manually
- Skipping quality validation of generated code
- Creating overly complex scenarios in single generation requests

### 4. QualityAssuranceAgent

**Purpose**: Automated code review and quality analysis

**Best Practices:**
```typescript
// Comprehensive quality assessment
const qualityAssessment = await agentOrchestrator.delegateTask({
  id: 'assess-quality',
  type: 'assess-quality',
  data: {
    target: 'tests/wesign/document-signing.spec.ts',
    targetType: 'test-file',
    standards: ['wesign-coding-standards', 'playwright-best-practices'],
    context: {
      module: 'documents',
      criticality: 'high',
      bilingualRequired: true
    }
  },
  requirements: ['quality-analysis', 'security-scanning']
});

// Act on quality recommendations
if (qualityAssessment.data.assessment.overallScore < 0.8) {
  // Review and implement high-priority recommendations
  const criticalIssues = qualityAssessment.data.issues
    .filter(issue => issue.severity === 'critical' || issue.severity === 'high');
  
  for (const issue of criticalIssues) {
    console.log(`${issue.severity.toUpperCase()}: ${issue.title}`);
    console.log(`Location: ${issue.location.file}:${issue.location.line}`);
    console.log(`Fix: ${issue.suggestedFix}`);
  }
}
```

**Recommendations:**
- **Regular Quality Audits**: Run comprehensive assessments weekly
- **Focus on Critical Issues**: Address critical and high-severity issues immediately
- **Integrate with CI/CD**: Automated quality gates for new code
- **WeSign Compliance**: Ensure bilingual compatibility and security standards

**Avoid:**
- Ignoring low-severity issues (they accumulate over time)
- Manual code review for routine quality checks
- Disabling quality gates without proper justification

### 5. PerformanceOptimizationAgent

**Purpose**: Real-time performance monitoring and optimization

**Best Practices:**
```typescript
// Continuous performance monitoring
const performanceMonitoring = await agentOrchestrator.delegateTask({
  id: 'monitor-performance',
  type: 'monitor-performance',
  data: {
    monitoringType: 'continuous',
    metrics: ['system', 'test-execution', 'playwright', 'wesign'],
    alertThresholds: {
      'system.cpuUsage': { value: 80, operator: '>', severity: 'high' },
      'wesign.documentProcessingTime': { value: 10000, operator: '>', severity: 'medium' }
    }
  },
  requirements: ['performance-monitoring', 'bottleneck-detection']
});

// Apply recommended optimizations
const optimizations = await agentOrchestrator.delegateTask({
  id: 'analyze-bottlenecks',
  type: 'analyze-bottlenecks', 
  data: { timeRange: '24h', includeRecommendations: true },
  requirements: ['bottleneck-detection', 'automated-improvements']
});

// Review and apply safe optimizations
for (const optimization of optimizations.data.optimizations) {
  if (optimization.riskLevel === 'low' && optimization.confidence > 0.8) {
    await agentOrchestrator.delegateTask({
      id: `apply-optimization-${optimization.id}`,
      type: 'apply-optimizations',
      data: { optimizationId: optimization.id },
      requirements: ['automated-improvements']
    });
  }
}
```

**Recommendations:**
- **Continuous Monitoring**: Enable real-time performance tracking
- **Proactive Optimization**: Apply low-risk, high-confidence optimizations automatically
- **Performance Baselines**: Establish and monitor performance SLAs
- **WeSign-Specific Tuning**: Optimize document processing and bilingual workflows

**Avoid:**
- Applying high-risk optimizations without validation
- Ignoring performance alerts until critical issues occur
- Manual performance tuning for routine optimizations

## Workflow Integration Patterns

### 1. Complete Test Creation Workflow

```typescript
// End-to-end automated test creation with quality assurance
async function createQualityTest(scenario: string, module: WeSignModule) {
  // Step 1: Generate test code
  const generatedCode = await agentOrchestrator.executeWorkflow({
    id: 'test-creation-workflow',
    name: 'Complete Test Creation',
    steps: [
      {
        id: 'generate-code',
        type: 'generate-tests',
        requirements: ['code-generation', 'wesign-domain-knowledge'],
        data: { scenario, module }
      },
      {
        id: 'review-quality', 
        type: 'review-code',
        requirements: ['code-review', 'security-scanning'],
        data: { code: '${generate-code.result}' },
        dependsOn: ['generate-code']
      },
      {
        id: 'optimize-performance',
        type: 'check-performance',
        requirements: ['performance-analysis'],
        data: { code: '${generate-code.result}' },
        dependsOn: ['generate-code']
      }
    ]
  });

  return generatedCode;
}
```

### 2. Intelligent Test Maintenance Workflow

```typescript
// Automated test healing and optimization
async function maintainTestSuite() {
  // Step 1: Analyze recent failures
  const failureAnalysis = await agentOrchestrator.delegateTask({
    type: 'analyze-failures',
    data: { recentFailures: await getRecentFailures() },
    requirements: ['test-analysis', 'failure-prediction']
  });

  // Step 2: Apply healing for pattern-based failures
  const healingTasks = failureAnalysis.data.recommendations
    .filter(r => r.type === 'selector-healing')
    .map(r => ({
      type: 'heal-selectors',
      data: r.context,
      requirements: ['selector-healing']
    }));

  await Promise.all(healingTasks.map(task => agentOrchestrator.delegateTask(task)));

  // Step 3: Performance optimization
  const performanceOpts = await agentOrchestrator.delegateTask({
    type: 'optimize-test-execution',
    data: { testSuite: 'full' },
    requirements: ['test-execution-optimization']
  });

  return {
    failuresAnalyzed: failureAnalysis.data.patterns.length,
    healingAttempts: healingTasks.length,
    optimizationsApplied: performanceOpts.data.applied.length
  };
}
```

### 3. Quality-First Development Workflow

```typescript
// Integrated quality assurance in development cycle
async function qualityFirstDevelopment(newCode: string, context: any) {
  const workflow = await agentOrchestrator.executeWorkflow({
    id: 'quality-first-development',
    steps: [
      // Initial quality assessment
      {
        id: 'assess-quality',
        type: 'assess-quality',
        requirements: ['quality-analysis', 'security-scanning'],
        data: { code: newCode, context }
      },
      // Performance impact analysis
      {
        id: 'performance-impact',
        type: 'analyze-bottlenecks',
        requirements: ['performance-analysis'],
        data: { changes: newCode, baseline: context.currentPerformance }
      },
      // Generate additional tests if needed
      {
        id: 'coverage-analysis',
        type: 'generate-tests',
        requirements: ['code-generation', 'coverage-analysis'],
        data: { 
          targetCode: newCode,
          existingCoverage: context.coverage
        },
        condition: '${assess-quality.result.testCoverage} < 80'
      }
    ]
  });

  return workflow.result;
}
```

## Performance Optimization

### System Configuration

**Recommended Settings:**
```typescript
// playwright.config.ts
export default defineConfig({
  // Optimal worker configuration
  workers: Math.floor(require('os').cpus().length * 0.5),
  
  // Enable full parallelization
  fullyParallel: true,
  
  // Optimized browser settings
  use: {
    launchOptions: {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage',
        '--memory-pressure-off'
      ]
    }
  },

  // Sub-agent integration
  globalSetup: require.resolve('./global-setup'),
  globalTeardown: require.resolve('./global-teardown')
});
```

**Global Setup Integration:**
```typescript
// global-setup.ts
import { agentOrchestrator } from './src/services/subAgents/AgentOrchestrator';

async function globalSetup() {
  // Initialize performance monitoring
  await agentOrchestrator.delegateTask({
    type: 'monitor-performance',
    data: { 
      sessionType: 'test-execution',
      baseline: true 
    },
    requirements: ['performance-monitoring']
  });

  // Pre-test system optimization
  await agentOrchestrator.delegateTask({
    type: 'optimize-resources',
    data: { scope: 'test-session' },
    requirements: ['resource-optimization']
  });
}

export default globalSetup;
```

### Resource Management

**Memory Optimization:**
```typescript
// Efficient agent resource usage
const resourceConfig = {
  maxConcurrentTasks: {
    'test-intelligence': 2,
    'healing': 3,
    'code-generation': 1,
    'quality-assurance': 2,
    'performance-optimization': 1
  },
  
  taskPriorities: {
    'health-check': 'critical',
    'heal-selectors': 'high',
    'monitor-performance': 'high',
    'generate-tests': 'medium',
    'assess-quality': 'medium'
  },
  
  resourceLimits: {
    cpuThreshold: 80,
    memoryThreshold: 85,
    taskTimeout: 300000 // 5 minutes
  }
};
```

## Error Handling and Recovery

### Agent Health Monitoring

```typescript
// Comprehensive health monitoring
class AgentHealthManager {
  async monitorAgentHealth() {
    const healthChecks = await Promise.allSettled([
      this.checkAgentHealth('test-intelligence-agent'),
      this.checkAgentHealth('healing-agent'),
      this.checkAgentHealth('code-generation-agent'),
      this.checkAgentHealth('quality-assurance-agent'),
      this.checkAgentHealth('performance-optimization-agent')
    ]);

    const unhealthyAgents = healthChecks
      .filter(result => result.status === 'rejected' || 
        (result.status === 'fulfilled' && result.value.status !== 'healthy'))
      .map((result, index) => this.getAgentNames()[index]);

    if (unhealthyAgents.length > 0) {
      await this.initiateRecovery(unhealthyAgents);
    }
  }

  private async initiateRecovery(agents: string[]) {
    for (const agentId of agents) {
      logger.warn(`Initiating recovery for unhealthy agent: ${agentId}`);
      
      try {
        await agentOrchestrator.restartAgent(agentId);
        await this.validateAgentRecovery(agentId);
      } catch (error) {
        logger.error(`Failed to recover agent ${agentId}:`, error);
        await this.escalateAgentFailure(agentId);
      }
    }
  }
}
```

### Fallback Strategies

```typescript
// Graceful degradation patterns
async function executeWithFallback<T>(
  primaryTask: () => Promise<T>,
  fallbackTask: () => Promise<T>,
  taskDescription: string
): Promise<T> {
  try {
    const result = await primaryTask();
    logger.info(`${taskDescription} completed successfully via primary method`);
    return result;
  } catch (error) {
    logger.warn(`Primary method failed for ${taskDescription}, attempting fallback:`, error);
    
    try {
      const fallbackResult = await fallbackTask();
      logger.info(`${taskDescription} completed successfully via fallback method`);
      return fallbackResult;
    } catch (fallbackError) {
      logger.error(`Both primary and fallback methods failed for ${taskDescription}:`, fallbackError);
      throw new Error(`${taskDescription} failed: ${fallbackError.message}`);
    }
  }
}

// Usage example
const testResult = await executeWithFallback(
  () => agentOrchestrator.delegateTask({
    type: 'generate-tests',
    requirements: ['code-generation'],
    data: { scenario: complexScenario }
  }),
  () => generateTestsManually(complexScenario),
  'Test generation'
);
```

## Security Best Practices

### Data Protection

```typescript
// Secure context sharing
class SecureContextManager extends ContextManager {
  async updateContext(agentId: string, contextUpdate: Partial<UnifiedContext>) {
    // Sanitize sensitive data
    const sanitizedContext = this.sanitizeContext(contextUpdate);
    
    // Encrypt sensitive fields
    const encryptedContext = await this.encryptSensitiveFields(sanitizedContext);
    
    // Apply context update
    await super.updateContext(agentId, encryptedContext);
    
    // Audit context changes
    await this.auditContextChange(agentId, contextUpdate);
  }

  private sanitizeContext(context: any): any {
    // Remove or mask sensitive information
    const sensitive_patterns = [
      /password/i,
      /token/i, 
      /key/i,
      /secret/i,
      /credential/i
    ];

    return this.deepSanitize(context, sensitive_patterns);
  }
}
```

### Access Control

```typescript
// Role-based agent access
const agentPermissions = {
  'test-intelligence-agent': [
    'read:test-results',
    'read:failure-patterns', 
    'write:analysis-reports'
  ],
  'healing-agent': [
    'read:test-failures',
    'write:selector-changes',
    'write:healing-patterns'
  ],
  'code-generation-agent': [
    'read:test-templates',
    'write:generated-tests',
    'write:test-templates'
  ],
  'quality-assurance-agent': [
    'read:source-code',
    'write:quality-reports',
    'write:issue-tracking'
  ],
  'performance-optimization-agent': [
    'read:system-metrics',
    'write:performance-optimizations',
    'write:system-configurations'
  ]
};
```

## Monitoring and Observability

### Metrics Collection

```typescript
// Comprehensive system metrics
interface SubAgentMetrics {
  system: {
    agentHealth: Map<string, AgentHealthStatus>;
    taskThroughput: number;
    averageResponseTime: number;
    errorRate: number;
  };
  
  business: {
    testsGenerated: number;
    issuesHealed: number;
    qualityImprovements: number;
    performanceGains: number;
  };
  
  quality: {
    testCoverage: number;
    codeQualityScore: number;
    securityVulnerabilities: number;
    performanceRegressions: number;
  };
}

// Metrics dashboard integration
class MetricsDashboard {
  async updateDashboard() {
    const metrics = await this.collectAllMetrics();
    
    await Promise.all([
      this.updateSystemHealthPanel(metrics.system),
      this.updateBusinessMetricsPanel(metrics.business),
      this.updateQualityMetricsPanel(metrics.quality),
      this.updatePerformancePanel(metrics.performance)
    ]);
  }
}
```

### Alerting Configuration

```typescript
// Intelligent alerting system
const alertingRules = {
  critical: [
    {
      name: 'Agent Down',
      condition: 'agent.status == "offline"',
      threshold: '30s',
      actions: ['page-oncall', 'restart-agent', 'escalate-after-5min']
    },
    {
      name: 'High Test Failure Rate',
      condition: 'test.failure_rate > 50%',
      threshold: '5min',
      actions: ['notify-team', 'trigger-analysis', 'disable-flaky-tests']
    }
  ],
  
  warning: [
    {
      name: 'Performance Degradation',
      condition: 'performance.avg_response_time > 2x_baseline',
      threshold: '10min',
      actions: ['trigger-optimization', 'notify-team']
    },
    {
      name: 'Quality Score Drop',
      condition: 'quality.overall_score < 80%',
      threshold: '1hour',
      actions: ['trigger-quality-review', 'notify-maintainers']
    }
  ]
};
```

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. Agent Not Responding

**Symptoms:**
- Agent status shows "offline" or "error"
- Tasks timeout without response
- Health check failures

**Diagnosis:**
```typescript
// Check agent health
const healthStatus = await agentOrchestrator.getAgentHealth('agent-id');
console.log('Agent Status:', healthStatus);

// Check system resources
const systemMetrics = await performanceAgent.getSystemMetrics();
console.log('System Load:', systemMetrics.system);
```

**Solutions:**
1. **Restart Agent**: `await agentOrchestrator.restartAgent('agent-id')`
2. **Check Resources**: Ensure sufficient CPU/memory available
3. **Review Logs**: Check agent-specific error logs
4. **Database Integrity**: Verify database connectivity and schema

#### 2. Poor Quality Results

**Symptoms:**
- Low confidence scores in agent responses
- Frequent false positives/negatives
- Inconsistent recommendations

**Diagnosis:**
```typescript
// Analyze recent task performance
const taskHistory = await database.getTaskHistory('agent-id', { 
  timeRange: '24h',
  includeMetrics: true 
});

const avgConfidence = taskHistory.reduce((sum, task) => 
  sum + (task.confidence || 0), 0) / taskHistory.length;

console.log('Average Confidence:', avgConfidence);
```

**Solutions:**
1. **Update Training Data**: Refresh AI models with recent data
2. **Adjust Thresholds**: Fine-tune confidence and quality thresholds
3. **Context Enhancement**: Provide more detailed context in task data
4. **Pattern Review**: Manually validate and correct learning patterns

#### 3. Performance Bottlenecks

**Symptoms:**
- Slow task execution
- High resource usage
- Task queue backlog

**Diagnosis:**
```typescript
// Performance analysis
const bottlenecks = await performanceAgent.analyzeBottlenecks({
  timeRange: '1h',
  includeSystemMetrics: true
});

console.log('Detected Bottlenecks:', bottlenecks);
```

**Solutions:**
1. **Resource Scaling**: Increase worker processes or system resources  
2. **Task Prioritization**: Implement priority queues for critical tasks
3. **Caching**: Enable result caching for repeated operations
4. **Parallel Processing**: Increase parallelization where safe

## Advanced Usage Patterns

### Multi-Agent Workflows

```typescript
// Complex orchestrated workflow
const advancedWorkflow: AgentWorkflow = {
  id: 'comprehensive-test-pipeline',
  name: 'Comprehensive Test Pipeline',
  description: 'End-to-end automated test creation, validation, and optimization',
  steps: [
    // Parallel analysis phase
    {
      id: 'analyze-requirements',
      type: 'analyze-failures',
      requirements: ['test-analysis'],
      data: { scope: 'comprehensive' }
    },
    {
      id: 'performance-baseline',
      type: 'monitor-performance', 
      requirements: ['performance-monitoring'],
      data: { baseline: true },
      parallel: ['analyze-requirements']
    },
    
    // Generation phase
    {
      id: 'generate-tests',
      type: 'generate-tests',
      requirements: ['code-generation', 'wesign-domain-knowledge'],
      data: { insights: '${analyze-requirements.result}' },
      dependsOn: ['analyze-requirements']
    },
    
    // Quality gates
    {
      id: 'quality-review',
      type: 'review-code',
      requirements: ['code-review', 'security-scanning'],
      data: { code: '${generate-tests.result}' },
      dependsOn: ['generate-tests'],
      criticalFailure: true
    },
    
    // Optimization and healing
    {
      id: 'optimize-selectors',
      type: 'heal-selectors',
      requirements: ['selector-healing'],
      data: { tests: '${generate-tests.result}' },
      dependsOn: ['quality-review']
    },
    {
      id: 'performance-optimize',
      type: 'optimize-test-execution',
      requirements: ['performance-optimization'],
      data: { 
        tests: '${generate-tests.result}',
        baseline: '${performance-baseline.result}'
      },
      dependsOn: ['performance-baseline', 'optimize-selectors']
    }
  ],
  
  onSuccess: 'deploy-tests',
  onFailure: 'notify-team',
  maxDuration: 1800000, // 30 minutes
  priority: 'high'
};
```

### Custom Agent Extensions

```typescript
// Creating domain-specific agents
class WeSignDocumentAgent extends EventEmitter implements SubAgent {
  public readonly id = 'wesign-document-agent';
  public readonly type = 'specialist' as const;
  public readonly capabilities = [
    'document-processing',
    'hebrew-text-handling',
    'signature-validation',
    'wesign-domain-knowledge'
  ];

  async execute(task: AgentTask): Promise<AgentResult> {
    switch (task.type) {
      case 'process-document':
        return this.processDocument(task);
      case 'validate-hebrew-text':
        return this.validateHebrewText(task);
      case 'check-signature-flow':
        return this.checkSignatureFlow(task);
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  private async processDocument(task: AgentTask): Promise<AgentResult> {
    // WeSign-specific document processing logic
    const { document, processingType } = task.data;
    
    // Implement specialized document handling
    const processingResult = await this.handleWeSignDocument(
      document, 
      processingType
    );
    
    return {
      taskId: task.id,
      agentId: this.id,
      status: 'success',
      data: processingResult,
      confidence: 0.95
    };
  }
}
```

## Deployment and Maintenance

### Production Deployment

```typescript
// Production configuration
const productionConfig = {
  agents: {
    healthCheckInterval: 30000, // 30 seconds
    taskTimeout: 600000,       // 10 minutes
    maxRetries: 3,
    persistentStorage: true
  },
  
  performance: {
    metricsRetention: '30d',
    alertingEnabled: true,
    autoOptimization: true,
    resourceLimits: {
      cpu: '80%',
      memory: '4GB',
      workers: 'auto'
    }
  },
  
  security: {
    encryptionAtRest: true,
    auditLogging: true,
    accessControl: 'rbac',
    dataRetention: '1y'
  }
};
```

### Maintenance Procedures

```typescript
// Regular maintenance tasks
class MaintenanceManager {
  async performWeeklyMaintenance() {
    await Promise.all([
      this.cleanupOldMetrics(),
      this.updateLearningPatterns(),
      this.optimizeDatabase(),
      this.validateAgentHealth(),
      this.updateSecurityPolicies()
    ]);
  }

  async performMonthlyMaintenance() {
    await Promise.all([
      this.archiveHistoricalData(),
      this.updateAIModels(),
      this.reviewPerformanceBaselines(),
      this.auditSystemAccess(),
      this.planCapacityUpgrades()
    ]);
  }
}
```

## Success Metrics and KPIs

### Key Performance Indicators

```typescript
interface SystemKPIs {
  // Operational Excellence
  agentAvailability: number;        // Target: >99.9%
  taskSuccessRate: number;          // Target: >95%
  averageResponseTime: number;      // Target: <30s
  
  // Quality Improvements  
  testCoverage: number;             // Target: >80%
  codeQualityScore: number;         // Target: >85%
  securityVulnerabilities: number;  // Target: <5 critical
  
  // Business Impact
  developmentEfficiency: number;    // Target: +40%
  manualEffortReduction: number;    // Target: +60%
  timeToDetection: number;          // Target: <5min
  
  // User Satisfaction
  developerExperience: number;      // Target: >8.5/10
  systemReliability: number;        // Target: >99%
  supportTicketReduction: number;   // Target: +50%
}
```

## Conclusion

This comprehensive guide provides the foundation for effectively using the Claude Code sub-agents system. The key to success lies in:

1. **Understanding Each Agent's Strengths**: Use the right agent for the right task
2. **Workflow Integration**: Combine agents for complex, multi-step automation
3. **Continuous Monitoring**: Track performance and health metrics
4. **Iterative Improvement**: Learn from results and refine approaches
5. **Security and Compliance**: Maintain proper access controls and data protection

The sub-agents system represents a significant advancement in test automation intelligence. By following these best practices, you can achieve substantial improvements in testing efficiency, code quality, and overall development productivity while maintaining the highest standards of security and reliability.

For additional support or advanced customization needs, refer to the individual agent implementation plans or contact the development team for specialized assistance.