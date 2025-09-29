/**
 * Sub-Agent Management API Routes
 * RESTful endpoints for managing Claude Code sub-agents
 */

import { Router } from 'express';
import { agentOrchestrator } from '@/services/subAgents/AgentOrchestrator';
import { TestIntelligenceAgent } from '@/services/subAgents/TestIntelligenceAgent';
import { metricsCollector } from '@/services/subAgents/MetricsCollector';
import { logger } from '@/utils/logger';
import type { AgentWorkflow, AgentTask } from '@/types/agents';

const router = Router();

/**
 * Get status of all registered sub-agents
 */
router.get('/status', async (req, res) => {
  try {
    const agentStatus = agentOrchestrator.getAgentStatus();
    
    res.json({
      success: true,
      data: {
        totalAgents: Object.keys(agentStatus).length,
        agents: agentStatus,
        orchestratorStatus: {
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          timestamp: new Date()
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get agent status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get agent status'
    });
  }
});

/**
 * Execute a single task using optimal agent
 */
router.post('/execute-task', async (req, res) => {
  try {
    const task: AgentTask = req.body;
    
    if (!task.id || !task.type) {
      return res.status(400).json({
        success: false,
        error: 'Task must have id and type'
      });
    }

    const result = await agentOrchestrator.delegateTask(task);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Task execution failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Task execution failed'
    });
  }
});

/**
 * Execute a complex workflow using multiple agents
 */
router.post('/execute-workflow', async (req, res) => {
  try {
    const workflow: AgentWorkflow = req.body;
    
    if (!workflow.id || !workflow.steps || workflow.steps.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Workflow must have id and at least one step'
      });
    }

    const result = await agentOrchestrator.executeWorkflow(workflow);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Workflow execution failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Workflow execution failed'
    });
  }
});

/**
 * Intelligent Test Analysis Endpoint
 */
router.post('/analyze-test-intelligence', async (req, res) => {
  try {
    const { failures, testContext, analysisType } = req.body;

    if (!failures || !Array.isArray(failures)) {
      return res.status(400).json({
        success: false,
        error: 'Failures array is required'
      });
    }

    const task: AgentTask = {
      id: `analysis_${Date.now()}`,
      type: 'analyze-failures',
      data: { failures, testContext, analysisType },
      context: {
        failureHistory: {
          recentFailures: failures,
          patterns: []
        }
      },
      priority: 'high'
    };

    const result = await agentOrchestrator.delegateTask(task);
    
    res.json({
      success: true,
      data: {
        analysisId: task.id,
        result,
        recommendations: result.data.recommendations || [],
        confidence: result.confidence || 0,
        executionTime: result.executionTime
      }
    });
  } catch (error) {
    logger.error('Test intelligence analysis failed:', error);
    res.status(500).json({
      success: false,
      error: 'Analysis failed'
    });
  }
});

/**
 * Smart Test Execution Planning
 */
router.post('/plan-execution', async (req, res) => {
  try {
    const { 
      availableTests, 
      codeChanges, 
      timeConstraints, 
      executionHistory,
      businessPriority 
    } = req.body;

    const task: AgentTask = {
      id: `planning_${Date.now()}`,
      type: 'plan-execution',
      data: { 
        availableTests, 
        codeChanges, 
        timeConstraints, 
        executionHistory,
        businessPriority 
      },
      context: {
        codeChanges,
        systemHealth: {
          cpuUsage: 0,
          memoryUsage: 0,
          diskSpace: 0
        }
      },
      priority: 'medium'
    };

    const result = await agentOrchestrator.delegateTask(task);
    
    res.json({
      success: true,
      data: {
        planningId: task.id,
        executionPlan: result.data.executionPlan,
        recommendations: result.data.recommendations || [],
        estimatedDuration: result.data.estimatedDuration || 0,
        confidence: result.confidence || 0
      }
    });
  } catch (error) {
    logger.error('Execution planning failed:', error);
    res.status(500).json({
      success: false,
      error: 'Execution planning failed'
    });
  }
});

/**
 * Dynamic Workflow Templates based on discovered tests
 */
router.get('/workflow-templates', async (req, res) => {
  try {
    const { testDiscoveryService } = await import('@/services/testDiscoveryService');
    
    // Initialize database if needed
    await testDiscoveryService.initializeDatabase();
    
    // Perform test discovery if no tests are cached
    const { tests, total } = await testDiscoveryService.getTests({ limit: 10 });
    if (total === 0) {
      logger.info('No tests found, performing discovery scan...');
      await testDiscoveryService.performFullScan();
    }
    
    // Generate templates based on discovered tests
    const templates = await testDiscoveryService.generateWorkflowTemplates();
    
    // Extract unique categories
    const categories = [...new Set(templates.map(t => t.category))];
    
    res.json({
      success: true,
      data: {
        templates,
        totalTemplates: templates.length,
        categories,
        totalTestFiles: total,
        message: `Generated ${templates.length} workflow templates based on ${total} discovered tests`
      }
    });
  } catch (error) {
    logger.error('Failed to get workflow templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get workflow templates'
    });
  }
});

/**
 * Execute predefined workflow template
 */
router.post('/execute-template/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;
    const { data, context } = req.body;

    // Get dynamic templates from test discovery service
    const { testDiscoveryService } = await import('@/services/testDiscoveryService');
    await testDiscoveryService.initializeDatabase();
    
    // Get all available templates
    const availableTemplates = await testDiscoveryService.generateWorkflowTemplates();
    const template = availableTemplates.find(t => t.id === templateId);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        error: `Template '${templateId}' not found`,
        availableTemplates: availableTemplates.map(t => ({ id: t.id, name: t.name }))
      });
    }

    // Convert template to AgentWorkflow format
    const workflow: AgentWorkflow = {
      id: `${templateId}_${Date.now()}`,
      name: template.name,
      description: template.description,
      steps: template.steps.map(step => ({
        id: step.id,
        type: step.type,
        data: data || { testFiles: template.testFiles },
        requirements: step.requirements,
        dependsOn: step.dependsOn,
        criticalFailure: step.criticalFailure || false
      })),
      context: {
        ...context,
        templateInfo: {
          originalId: template.id,
          category: template.category,
          estimatedDuration: template.estimatedDuration,
          testFiles: template.testFiles
        }
      },
      priority: 'medium'
    };

    const result = await agentOrchestrator.executeWorkflow(workflow);
    
    res.json({
      success: true,
      data: {
        templateId,
        templateName: template.name,
        workflowId: workflow.id,
        estimatedDuration: template.estimatedDuration,
        testFilesCount: template.testFiles.length,
        result
      }
    });
  } catch (error) {
    logger.error(`Template execution failed for ${req.params.templateId}:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Template execution failed'
    });
  }
});

/**
 * Agent Performance Metrics - Real-time data from MetricsCollector
 */
router.get('/metrics', async (req, res) => {
  try {
    // Get real metrics from MetricsCollector
    const systemMetrics = metricsCollector.getSystemMetrics();
    const agentMetricsData = metricsCollector.getAgentMetrics();
    const agentStatus = agentOrchestrator.getAgentStatus();

    // Transform metrics data for API response
    const agentMetrics = agentMetricsData.map(metricsData => ({
      agentId: metricsData.agentId,
      type: metricsData.type,
      performance: {
        tasksCompleted: metricsData.tasksCompleted,
        averageExecutionTime: metricsData.averageExecutionTime,
        successRate: metricsData.successRate,
        errorsToday: metricsData.errorCount
      },
      resourceUsage: metricsData.resourceUsage,
      status: agentStatus[metricsData.agentId]?.status || 'offline',
      lastActivity: metricsData.lastActivity,
      healthScore: metricsData.healthScore,
      currentTasks: metricsData.currentTasks
    }));

    // Enhanced system summary with real metrics
    const summary = {
      totalAgents: systemMetrics.totalAgents,
      activeAgents: systemMetrics.activeAgents,
      totalTasksCompleted: systemMetrics.totalTasksCompleted,
      averageSuccessRate: systemMetrics.averageSuccessRate,
      totalErrors: systemMetrics.totalErrors,
      systemUptime: systemMetrics.systemUptime,
      systemHealth: {
        averageHealthScore: agentMetricsData.length > 0
          ? agentMetricsData.reduce((sum, a) => sum + a.healthScore, 0) / agentMetricsData.length
          : 0,
        totalCurrentTasks: agentMetricsData.reduce((sum, a) => sum + a.currentTasks, 0),
        averageResponseTime: agentMetricsData.length > 0 
          ? agentMetricsData.reduce((sum, a) => sum + a.averageExecutionTime, 0) / agentMetricsData.length
          : 0
      }
    };

    res.json({
      success: true,
      data: {
        summary,
        agentMetrics,
        systemMetrics: {
          lastUpdated: systemMetrics.lastUpdated,
          dataSource: 'real-time',
          collectorsActive: true
        },
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error('Failed to get agent metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Historical Agent Metrics - Get performance trends over time
 */
router.get('/metrics/historical/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { hours = 24 } = req.query;
    
    const historicalMetrics = await metricsCollector.getHistoricalMetrics(
      agentId, 
      parseInt(hours as string)
    );

    res.json({
      success: true,
      data: {
        agentId,
        period: historicalMetrics.period,
        performance: historicalMetrics.performance,
        resources: historicalMetrics.resources,
        aiUsage: historicalMetrics.aiUsage,
        trends: {
          performanceChange: '0%', // Could calculate trend analysis here
          resourceEfficiency: historicalMetrics.resources.avgCpuUsage < 50 ? 'optimal' : 'high',
          costTrend: historicalMetrics.aiUsage.totalCost < 1 ? 'low' : 'moderate'
        },
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error(`Failed to get historical metrics for ${req.params.agentId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to get historical metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * System Health Check - Comprehensive agent system status
 */
router.get('/metrics/health', async (req, res) => {
  try {
    const systemMetrics = metricsCollector.getSystemMetrics();
    const agentMetrics = metricsCollector.getAgentMetrics();
    
    // Calculate health indicators
    const healthIndicators = {
      overallHealth: agentMetrics.length > 0 
        ? agentMetrics.reduce((sum, a) => sum + a.healthScore, 0) / agentMetrics.length 
        : 0,
      agentsWithIssues: agentMetrics.filter(a => a.healthScore < 0.8).length,
      highResourceUsage: agentMetrics.filter(a => 
        a.resourceUsage.cpuPercent > 80 || a.resourceUsage.memoryMB > 500
      ).length,
      recentErrors: systemMetrics.totalErrors,
      systemLoad: systemMetrics.activeAgents / Math.max(systemMetrics.totalAgents, 1)
    };

    const healthStatus = healthIndicators.overallHealth > 0.9 ? 'excellent' :
                        healthIndicators.overallHealth > 0.7 ? 'good' :
                        healthIndicators.overallHealth > 0.5 ? 'fair' : 'poor';

    res.json({
      success: true,
      data: {
        healthStatus,
        healthIndicators,
        systemMetrics,
        recommendations: [
          ...(healthIndicators.agentsWithIssues > 0 ? [`Review ${healthIndicators.agentsWithIssues} agents with low health scores`] : []),
          ...(healthIndicators.highResourceUsage > 0 ? [`Monitor resource usage for ${healthIndicators.highResourceUsage} agents`] : []),
          ...(healthIndicators.recentErrors > 10 ? ['Investigate recent error patterns'] : []),
          ...(healthIndicators.systemLoad > 0.8 ? ['Consider scaling up agent capacity'] : [])
        ],
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error('Failed to get system health metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get health metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get real test discovery data with comprehensive statistics
 */
router.get('/test-data', async (req, res) => {
  try {
    const { testDiscoveryService } = await import('@/services/testDiscoveryService');
    
    // Initialize database if needed
    await testDiscoveryService.initializeDatabase();
    
    // Get comprehensive test statistics
    const { limit = 50, offset = 0, category } = req.query;
    const { tests, total } = await testDiscoveryService.getTests({ 
      limit: parseInt(limit as string), 
      offset: parseInt(offset as string),
      category: category as string
    });
    
    // Get discovery statistics
    const stats = await testDiscoveryService.getDiscoveryStats();
    
    // Get test categories
    const categories = await testDiscoveryService.getCategories();
    
    // Get tags (acting as types)
    const tags = await testDiscoveryService.getTags();
    
    res.json({
      success: true,
      data: {
        tests,
        totalTests: total,
        statistics: {
          totalFiles: stats.totalFiles,
          totalTestCases: stats.totalTests,
          lastScanDate: stats.lastScanTime.toISOString(),
          avgTestsPerFile: stats.totalFiles > 0 ? Math.round((stats.totalTests / stats.totalFiles) * 100) / 100 : 0
        },
        categories: categories.map(cat => ({
          name: cat.name,
          count: cat.testCount,
          percentage: Math.round((cat.testCount / total) * 100)
        })),
        testTypes: tags.filter(tag => tag.type === 'category').map(tag => ({
          name: tag.name,
          count: tag.testCount,
          percentage: Math.round((tag.testCount / total) * 100)
        })),
        pagination: {
          currentPage: Math.floor((offset as any) / (limit as any)) + 1,
          totalPages: Math.ceil(total / (limit as any)),
          hasNext: ((offset as any) + (limit as any)) < total,
          hasPrevious: (offset as any) > 0
        },
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error('Failed to get test discovery data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get test discovery data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Trigger test discovery scan and return real-time progress
 */
router.post('/test-data/scan', async (req, res) => {
  try {
    const { testDiscoveryService } = await import('@/services/testDiscoveryService');
    
    await testDiscoveryService.initializeDatabase();
    
    // Perform full scan
    const scanResults = await testDiscoveryService.performFullScan();
    
    // Get updated stats after scan
    const stats = await testDiscoveryService.getDiscoveryStats();
    
    res.json({
      success: true,
      data: {
        scanResults,
        newStats: stats,
        message: `Discovered ${stats.totalFiles} test files with ${stats.totalTests} tests`,
        completedAt: new Date()
      }
    });
  } catch (error) {
    logger.error('Test discovery scan failed:', error);
    res.status(500).json({
      success: false,
      error: 'Test discovery scan failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get test analytics and insights
 */
router.get('/test-data/analytics', async (req, res) => {
  try {
    const { testDiscoveryService } = await import('@/services/testDiscoveryService');
    
    await testDiscoveryService.initializeDatabase();
    
    const stats = await testDiscoveryService.getDiscoveryStats();
    const categories = await testDiscoveryService.getCategories();
    const tags = await testDiscoveryService.getTags();
    
    // Calculate insights
    const insights = {
      testCoverage: {
        totalFiles: stats.totalFiles || 0,
        totalTestCases: stats.totalTests || 0,
        averageTestsPerFile: stats.totalFiles > 0 ? Math.round((stats.totalTests / stats.totalFiles) * 100) / 100 : 0
      },
      categoryDistribution: categories.map(cat => ({
        category: cat.name,
        count: cat.testCount,
        percentage: Math.round((cat.testCount / (stats.totalFiles || 1)) * 100)
      })),
      typeDistribution: tags.filter(tag => tag.type === 'category').map(tag => ({
        type: tag.name,
        count: tag.testCount,
        percentage: Math.round((tag.testCount / (stats.totalFiles || 1)) * 100)
      })),
      recommendations: [
        ...(stats.totalTests < 100 ? ['Consider adding more test coverage'] : []),
        ...((stats.totalTests / (stats.totalFiles || 1)) < 5 ? ['Average tests per file is low - consider more comprehensive testing'] : []),
        ...(categories.length < 3 ? ['Diversify test categories for better coverage'] : [])
      ],
      healthScore: Math.min(100, Math.round(
        (stats.totalTests || 0) / Math.max(1, (stats.totalFiles || 1)) * 20 +
        categories.length * 10 +
        tags.length * 5
      ))
    };
    
    res.json({
      success: true,
      data: {
        insights,
        rawStats: stats,
        lastUpdated: new Date()
      }
    });
  } catch (error) {
    logger.error('Failed to get test analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get test analytics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Execute a single test with intelligent analysis
 */
router.post('/execute-test', async (req, res) => {
  try {
    const { testId, options = {} } = req.body;

    if (!testId) {
      return res.status(400).json({
        success: false,
        error: 'testId is required'
      });
    }

    const task: AgentTask = {
      id: `execute_test_${Date.now()}`,
      type: 'execute-test',
      data: { testId, options },
      context: {
        testRun: {
          id: `run_${Date.now()}`,
          suiteName: 'single-test',
          status: 'running',
          startedAt: new Date()
        }
      },
      priority: 'high'
    };

    const result = await agentOrchestrator.delegateTask(task);

    res.json({
      success: true,
      data: {
        executionId: task.id,
        testId,
        result,
        executionTime: result.executionTime,
        confidence: result.confidence,
        recommendations: result.recommendations || []
      }
    });
  } catch (error) {
    logger.error('Test execution failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Test execution failed'
    });
  }
});

/**
 * Execute a test suite with intelligent optimization
 */
router.post('/execute-suite', async (req, res) => {
  try {
    const { suiteName, testIds, options = {} } = req.body;

    if (!suiteName && !testIds) {
      return res.status(400).json({
        success: false,
        error: 'Either suiteName or testIds array is required'
      });
    }

    const task: AgentTask = {
      id: `execute_suite_${Date.now()}`,
      type: 'execute-suite',
      data: { suiteName, testIds, options },
      context: {
        testRun: {
          id: `suite_run_${Date.now()}`,
          suiteName: suiteName || 'custom-suite',
          status: 'running',
          startedAt: new Date()
        }
      },
      priority: 'high'
    };

    const result = await agentOrchestrator.delegateTask(task);

    res.json({
      success: true,
      data: {
        executionId: task.id,
        suiteName,
        testCount: testIds?.length || 0,
        result,
        executionTime: result.executionTime,
        confidence: result.confidence,
        recommendations: result.recommendations || []
      }
    });
  } catch (error) {
    logger.error('Suite execution failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Suite execution failed'
    });
  }
});

/**
 * Schedule a test or suite for future execution
 */
router.post('/schedule-test', async (req, res) => {
  try {
    const { testId, suiteName, scheduleTime, recurrence, options = {} } = req.body;

    if (!testId && !suiteName) {
      return res.status(400).json({
        success: false,
        error: 'Either testId or suiteName is required'
      });
    }

    if (!scheduleTime) {
      return res.status(400).json({
        success: false,
        error: 'scheduleTime is required'
      });
    }

    const task: AgentTask = {
      id: `schedule_${Date.now()}`,
      type: 'schedule-test',
      data: { testId, suiteName, scheduleTime, recurrence, options },
      context: {},
      priority: 'medium'
    };

    const result = await agentOrchestrator.delegateTask(task);

    res.json({
      success: true,
      data: {
        scheduleId: task.id,
        testId,
        suiteName,
        scheduleTime,
        recurrence,
        result,
        confidence: result.confidence,
        recommendations: result.recommendations || []
      }
    });
  } catch (error) {
    logger.error('Test scheduling failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Test scheduling failed'
    });
  }
});

/**
 * Smart execution with AI-powered optimization
 */
router.post('/smart-execution', async (req, res) => {
  try {
    const {
      testIds,
      codeChanges,
      timeConstraints,
      businessPriority,
      options = {}
    } = req.body;

    if (!testIds || !Array.isArray(testIds) || testIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'testIds array is required and must not be empty'
      });
    }

    const task: AgentTask = {
      id: `smart_execution_${Date.now()}`,
      type: 'smart-execution',
      data: {
        testIds,
        codeChanges,
        timeConstraints,
        businessPriority,
        options
      },
      context: {
        codeChanges,
        testRun: {
          id: `smart_run_${Date.now()}`,
          suiteName: 'smart-optimized',
          status: 'running',
          startedAt: new Date()
        }
      },
      priority: 'high'
    };

    const result = await agentOrchestrator.delegateTask(task);

    res.json({
      success: true,
      data: {
        executionId: task.id,
        testCount: testIds.length,
        optimizationApplied: result.data.optimizationApplied || false,
        executionOrder: result.data.executionOrder || testIds,
        result,
        executionTime: result.executionTime,
        confidence: result.confidence,
        recommendations: result.recommendations || []
      }
    });
  } catch (error) {
    logger.error('Smart execution failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Smart execution failed'
    });
  }
});

/**
 * Initialize default agents (called on server startup)
 */
router.post('/initialize', async (req, res) => {
  try {
    logger.info('Initializing default sub-agents...');

    // Initialize Test Intelligence Agent
    const testIntelligenceAgent = new TestIntelligenceAgent();
    await agentOrchestrator.registerAgent(testIntelligenceAgent);

    // TODO: Initialize other agents
    // const healingAgent = new HealingAgent();
    // await agentOrchestrator.registerAgent(healingAgent);

    const agentStatus = agentOrchestrator.getAgentStatus();

    res.json({
      success: true,
      data: {
        message: 'Sub-agents initialized successfully',
        initializedAgents: Object.keys(agentStatus),
        totalAgents: Object.keys(agentStatus).length
      }
    });
  } catch (error) {
    logger.error('Agent initialization failed:', error);
    res.status(500).json({
      success: false,
      error: 'Agent initialization failed'
    });
  }
});

export default router;