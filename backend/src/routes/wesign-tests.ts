/**
 * WeSign Tests API Routes
 * Provides RESTful API for WeSign test orchestration and execution
 */

import express from 'express';
import { logger } from '@/utils/logger';
import { getWeSignTestOrchestrator, TestExecutionConfig } from '@/services/wesignTestOrchestrator';
import { eventBus } from '@/core/wesign/EventBus';

const router = express.Router();

// Initialize orchestrator on first access
let orchestrator: any = null;
const getOrchestrator = async () => {
  if (!orchestrator) {
    const { initializeWeSignTestOrchestrator } = await import('@/services/wesignTestOrchestrator');
    orchestrator = await initializeWeSignTestOrchestrator();

    // Set up WebSocket event forwarding
    orchestrator.on('executionStarted', (data: any) => {
      eventBus.emit('wesign-test-execution-started', data);
    });

    orchestrator.on('testCompleted', (data: any) => {
      eventBus.emit('wesign-test-completed', data);
    });

    orchestrator.on('executionCompleted', (data: any) => {
      eventBus.emit('wesign-test-execution-completed', data);
    });

    orchestrator.on('executionFailed', (data: any) => {
      eventBus.emit('wesign-test-execution-failed', data);
    });
  }
  return orchestrator;
};

/**
 * Get all individual tests (flattened from all suites)
 */
router.get('/tests', async (req, res) => {
  try {
    const orchestrator = await getOrchestrator();
    const suites = orchestrator.getTestSuites();

    // Flatten all tests from all suites
    const allTests = suites.reduce((acc: any[], suite: any) => {
      const suiteTests = suite.tests.map((test: any) => ({
        ...test,
        suiteId: suite.id,
        suiteName: suite.name,
        category: suite.category,
        type: suite.type,
        priority: suite.priority
      }));
      return acc.concat(suiteTests);
    }, []);

    const summary = {
      totalTests: allTests.length,
      categories: [...new Set(allTests.map((t: any) => t.category))],
      suites: [...new Set(allTests.map((t: any) => t.suiteName))],
      priorities: [...new Set(allTests.map((t: any) => t.priority))],
      types: [...new Set(allTests.map((t: any) => t.type))]
    };

    res.json({
      success: true,
      data: {
        tests: allTests,
        summary
      }
    });
  } catch (error: any) {
    logger.error('Failed to get tests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve tests'
    });
  }
});

/**
 * Get all available test suites
 */
router.get('/suites', async (req, res) => {
  try {
    const orchestrator = await getOrchestrator();
    const suites = orchestrator.getTestSuites();

    const summary = {
      totalSuites: suites.length,
      categories: [...new Set(suites.map((s: any) => s.category))],
      types: [...new Set(suites.map((s: any) => s.type))],
      totalTests: suites.reduce((sum: number, s: any) => sum + s.tests.length, 0),
      estimatedDuration: suites.reduce((sum: number, s: any) => sum + s.estimatedDuration, 0)
    };

    res.json({
      success: true,
      data: {
        suites,
        summary
      }
    });
  } catch (error: any) {
    logger.error('Failed to get test suites:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve test suites'
    });
  }
});

/**
 * Get specific test suite details
 */
router.get('/suites/:suiteId', async (req, res) => {
  try {
    const { suiteId } = req.params;
    const orchestrator = await getOrchestrator();
    const suite = orchestrator.getTestSuite(suiteId);

    if (!suite) {
      return res.status(404).json({
        success: false,
        error: 'Test suite not found'
      });
    }

    res.json({
      success: true,
      data: suite
    });
  } catch (error: any) {
    logger.error('Failed to get test suite:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve test suite'
    });
  }
});

/**
 * Execute tests with comprehensive configuration
 */
router.post('/execute', async (req, res) => {
  try {
    const config: TestExecutionConfig = {
      executionType: req.body.executionType || 'suite',
      suiteIds: req.body.suiteIds,
      testIds: req.body.testIds,
      parallel: req.body.parallel !== false, // Default to true
      maxWorkers: req.body.maxWorkers || 3,
      selfHealingEnabled: req.body.selfHealingEnabled !== false, // Default to true
      reportingConfig: {
        newman: req.body.reportingConfig?.newman !== false,
        allure: req.body.reportingConfig?.allure !== false,
        realTimeUpdates: req.body.reportingConfig?.realTimeUpdates !== false,
        webhook: req.body.reportingConfig?.webhook
      },
      environment: {
        baseUrl: req.body.environment?.baseUrl || 'https://devtest.comda.co.il',
        credentials: req.body.environment?.credentials || {},
        locale: req.body.environment?.locale || 'en'
      }
    };

    // Validate configuration
    if (!config.suiteIds && !config.testIds && !['smoke', 'regression', 'full'].includes(config.executionType)) {
      return res.status(400).json({
        success: false,
        error: 'Must specify suiteIds, testIds, or valid executionType (smoke, regression, full)'
      });
    }

    const orchestrator = await getOrchestrator();
    const executionId = await orchestrator.executeTests(config);

    res.status(201).json({
      success: true,
      data: {
        executionId,
        status: 'started',
        message: 'Test execution started successfully',
        config: {
          ...config,
          environment: {
            ...config.environment,
            credentials: '[REDACTED]' // Don't return credentials
          }
        }
      }
    });

    logger.info('Test execution started', { executionId, config: { ...config, environment: { ...config.environment, credentials: '[REDACTED]' } } });

  } catch (error: any) {
    logger.error('Failed to execute tests:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to start test execution'
    });
  }
});

/**
 * Get execution status and results
 */
router.get('/executions/:executionId', async (req, res) => {
  try {
    const { executionId } = req.params;
    const orchestrator = await getOrchestrator();
    const execution = orchestrator.getExecution(executionId);

    if (!execution) {
      return res.status(404).json({
        success: false,
        error: 'Execution not found'
      });
    }

    res.json({
      success: true,
      data: execution
    });
  } catch (error: any) {
    logger.error('Failed to get execution:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve execution'
    });
  }
});

/**
 * Get all active executions
 */
router.get('/executions', async (req, res) => {
  try {
    const { status } = req.query;
    const orchestrator = await getOrchestrator();
    let executions = orchestrator.getActiveExecutions();

    if (status) {
      executions = executions.filter((exec: any) => exec.status === status);
    }

    res.json({
      success: true,
      data: {
        executions,
        summary: {
          total: executions.length,
          running: executions.filter((e: any) => e.status === 'running').length,
          completed: executions.filter((e: any) => e.status === 'completed').length,
          failed: executions.filter((e: any) => e.status === 'failed').length
        }
      }
    });
  } catch (error: any) {
    logger.error('Failed to get executions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve executions'
    });
  }
});

/**
 * Cancel a running execution
 */
router.post('/executions/:executionId/cancel', async (req, res) => {
  try {
    const { executionId } = req.params;
    const orchestrator = await getOrchestrator();
    const cancelled = await orchestrator.cancelExecution(executionId);

    if (!cancelled) {
      return res.status(404).json({
        success: false,
        error: 'Execution not found or cannot be cancelled'
      });
    }

    res.json({
      success: true,
      message: 'Execution cancelled successfully'
    });

    logger.info('Test execution cancelled', { executionId });

  } catch (error: any) {
    logger.error('Failed to cancel execution:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel execution'
    });
  }
});

/**
 * Get execution report
 */
router.get('/executions/:executionId/report', async (req, res) => {
  try {
    const { executionId } = req.params;
    const { format = 'json' } = req.query;
    const orchestrator = await getOrchestrator();
    const execution = orchestrator.getExecution(executionId);

    if (!execution) {
      return res.status(404).json({
        success: false,
        error: 'Execution not found'
      });
    }

    if (execution.status === 'running' || execution.status === 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Execution is still running, report not available yet'
      });
    }

    // Return appropriate report based on format
    if (format === 'allure' && execution.reportPaths.allure) {
      res.redirect(`/reports/allure/${path.basename(execution.reportPaths.allure)}`);
    } else if (format === 'newman' && execution.reportPaths.newman) {
      res.sendFile(execution.reportPaths.newman);
    } else {
      // Return comprehensive JSON report
      res.json({
        success: true,
        data: {
          execution,
          downloadLinks: {
            allure: execution.reportPaths.allure ? `/api/wesign-tests/executions/${executionId}/download/allure` : null,
            newman: execution.reportPaths.newman ? `/api/wesign-tests/executions/${executionId}/download/newman` : null,
            comprehensive: execution.reportPaths.comprehensive ? `/api/wesign-tests/executions/${executionId}/download/comprehensive` : null
          }
        }
      });
    }
  } catch (error: any) {
    logger.error('Failed to get execution report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve execution report'
    });
  }
});

/**
 * Download execution reports
 */
router.get('/executions/:executionId/download/:format', async (req, res) => {
  try {
    const { executionId, format } = req.params;
    const orchestrator = await getOrchestrator();
    const execution = orchestrator.getExecution(executionId);

    if (!execution) {
      return res.status(404).json({
        success: false,
        error: 'Execution not found'
      });
    }

    let filePath: string | undefined;
    let contentType: string;
    let filename: string;

    switch (format) {
      case 'allure':
        filePath = execution.reportPaths.allure;
        contentType = 'application/zip';
        filename = `allure-report-${executionId}.zip`;
        break;
      case 'newman':
        filePath = execution.reportPaths.newman;
        contentType = 'application/json';
        filename = `newman-report-${executionId}.json`;
        break;
      case 'comprehensive':
        filePath = execution.reportPaths.comprehensive;
        contentType = 'application/json';
        filename = `comprehensive-report-${executionId}.json`;
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid report format'
        });
    }

    if (!filePath || !require('fs').existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'Report file not found'
      });
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.sendFile(require('path').resolve(filePath));

  } catch (error: any) {
    logger.error('Failed to download report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download report'
    });
  }
});

/**
 * Get pre-configured test execution templates
 */
router.get('/templates', async (req, res) => {
  try {
    const templates = [
      {
        id: 'smoke-tests',
        name: 'Smoke Tests',
        description: 'Quick validation of critical functionality',
        config: {
          executionType: 'smoke',
          parallel: true,
          maxWorkers: 2,
          selfHealingEnabled: true,
          reportingConfig: {
            newman: true,
            allure: true,
            realTimeUpdates: true
          }
        },
        estimatedDuration: 600, // 10 minutes
        testCount: 'Critical tests only'
      },
      {
        id: 'regression-suite',
        name: 'Regression Suite',
        description: 'Comprehensive regression testing',
        config: {
          executionType: 'regression',
          parallel: true,
          maxWorkers: 4,
          selfHealingEnabled: true,
          reportingConfig: {
            newman: true,
            allure: true,
            realTimeUpdates: true
          }
        },
        estimatedDuration: 3600, // 1 hour
        testCount: 'Critical + High priority tests'
      },
      {
        id: 'full-suite',
        name: 'Full Test Suite',
        description: 'Complete test coverage - all tests',
        config: {
          executionType: 'full',
          parallel: true,
          maxWorkers: 6,
          selfHealingEnabled: true,
          reportingConfig: {
            newman: true,
            allure: true,
            realTimeUpdates: true
          }
        },
        estimatedDuration: 7200, // 2 hours
        testCount: 'All tests (607+)'
      },
      {
        id: 'auth-focused',
        name: 'Authentication Focus',
        description: 'Authentication and security testing',
        config: {
          suiteIds: ['auth-comprehensive'],
          parallel: true,
          maxWorkers: 2,
          selfHealingEnabled: true
        },
        estimatedDuration: 900, // 15 minutes
        testCount: '~50 authentication tests'
      },
      {
        id: 'signing-focused',
        name: 'Digital Signing Focus',
        description: 'Digital signing workflows and scenarios',
        config: {
          suiteIds: ['signing-comprehensive'],
          parallel: false, // Signing tests run sequentially
          maxWorkers: 1,
          selfHealingEnabled: true
        },
        estimatedDuration: 1800, // 30 minutes
        testCount: '~100 signing tests'
      },
      {
        id: 'api-only',
        name: 'API Tests Only',
        description: 'API testing with Newman (Postman collections)',
        config: {
          suiteIds: ['api-wesign_ultimate_complete_api_testing_suite'],
          parallel: true,
          maxWorkers: 3,
          selfHealingEnabled: false,
          reportingConfig: {
            newman: true,
            allure: false,
            realTimeUpdates: true
          }
        },
        estimatedDuration: 300, // 5 minutes
        testCount: '~30 API tests'
      }
    ];

    res.json({
      success: true,
      data: templates
    });
  } catch (error: any) {
    logger.error('Failed to get execution templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve execution templates'
    });
  }
});

/**
 * Execute tests using a template
 */
router.post('/templates/:templateId/execute', async (req, res) => {
  try {
    const { templateId } = req.params;

    // Get the template (this would be stored in database in production)
    const templatesResponse = await req.app.request.get('/api/wesign-tests/templates');
    const templates = JSON.parse(templatesResponse.body).data;
    const template = templates.find((t: any) => t.id === templateId);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // Merge template config with any overrides from request body
    const config: TestExecutionConfig = {
      ...template.config,
      ...req.body,
      environment: {
        baseUrl: 'https://devtest.comda.co.il',
        credentials: req.body.environment?.credentials || {},
        locale: req.body.environment?.locale || 'en',
        ...req.body.environment
      }
    };

    const orchestrator = await getOrchestrator();
    const executionId = await orchestrator.executeTests(config);

    res.status(201).json({
      success: true,
      data: {
        executionId,
        template: template,
        status: 'started',
        estimatedDuration: template.estimatedDuration,
        message: `Started execution using template: ${template.name}`
      }
    });

    logger.info('Test execution started from template', { executionId, templateId, templateName: template.name });

  } catch (error: any) {
    logger.error('Failed to execute template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute template'
    });
  }
});

/**
 * Health check for WeSign test system
 */
router.get('/health', async (req, res) => {
  try {
    const orchestrator = await getOrchestrator();
    const suites = orchestrator.getTestSuites();
    const activeExecutions = orchestrator.getActiveExecutions();

    res.json({
      success: true,
      status: 'healthy',
      data: {
        testSuites: suites.length,
        totalTests: suites.reduce((sum: number, s: any) => sum + s.tests.length, 0),
        activeExecutions: activeExecutions.length,
        categories: [...new Set(suites.map((s: any) => s.category))],
        capabilities: [
          'UI Testing (Playwright + Pytest)',
          'API Testing (Newman + Postman)',
          'Performance Testing',
          'Self-Healing Integration',
          'Real-time Reporting',
          'Allure Reports',
          'Parallel Execution',
          'Hebrew/RTL Support'
        ]
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * WebSocket endpoint info for real-time updates
 */
router.get('/ws-info', (req, res) => {
  res.json({
    success: true,
    data: {
      wsEndpoint: '/ws/wesign',
      events: [
        'wesign-test-execution-started',
        'wesign-test-completed',
        'wesign-test-execution-completed',
        'wesign-test-execution-failed'
      ],
      message: 'Connect to WebSocket endpoint for real-time test execution updates'
    }
  });
});

export { router as wesignTestsRouter };