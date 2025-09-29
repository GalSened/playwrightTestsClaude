import { Router } from 'express';
import { MCPRegressionService } from '../services/mcpRegressionService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import logger from '../utils/logger.js';

const router = Router();
const mcpService = new MCPRegressionService();

/**
 * Smart test selection based on code changes
 */
router.post('/smart-selection', asyncHandler(async (req, res) => {
  const { changedFiles = [] } = req.body;
  
  try {
    const selection = await mcpService.analyzeCodeChanges(changedFiles);
    
    res.json({
      success: true,
      data: selection
    });
  } catch (error) {
    logger.error('Smart selection failed:', error);
    res.status(500).json({
      success: false,
      error: 'Smart test selection failed'
    });
  }
}));

/**
 * Execute regression suite with MCP analysis
 */
router.post('/execute', asyncHandler(async (req, res) => {
  const {
    selectedTests,
    mode = 'headless',
    browsers = ['chromium'],
    smartSelection = true
  } = req.body;
  
  try {
    // Start execution (non-blocking)
    const executionPromise = mcpService.executeRegressionSuite({
      selectedTests,
      mode,
      browsers,
      smartSelection
    });
    
    // Return execution ID immediately
    const executionId = `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Handle results asynchronously
    executionPromise.then(result => {
      logger.info(`MCP regression completed: ${result.executionId}`);
    }).catch(error => {
      logger.error(`MCP regression failed: ${executionId}`, error);
    });
    
    res.json({
      success: true,
      data: {
        executionId,
        message: 'MCP regression execution started'
      }
    });
  } catch (error) {
    logger.error('MCP execution failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start MCP regression execution'
    });
  }
}));

/**
 * Analyze test failures using AI
 */
router.post('/analyze-failures', asyncHandler(async (req, res) => {
  const { failures } = req.body;
  
  if (!failures || !Array.isArray(failures)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid failures data'
    });
  }
  
  try {
    const analysis = await mcpService.analyzeTestFailures(failures);
    
    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    logger.error('Failure analysis failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failure analysis failed'
    });
  }
}));

/**
 * Generate new regression tests
 */
router.post('/generate-tests', asyncHandler(async (req, res) => {
  const { category, existingTests = [] } = req.body;
  
  if (!category) {
    return res.status(400).json({
      success: false,
      error: 'Category is required'
    });
  }
  
  try {
    const newTests = await mcpService.generateRegressionTests(category, existingTests);
    
    res.json({
      success: true,
      data: {
        category,
        generatedTests: newTests,
        count: newTests.length
      }
    });
  } catch (error) {
    logger.error('Test generation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Test generation failed'
    });
  }
}));

/**
 * Get MCP regression insights and metrics
 */
router.get('/insights', asyncHandler(async (req, res) => {
  try {
    // Get insights from service (mock implementation)
    const insights = {
      totalRegressionTests: 109,
      flakynessRate: 8.5,
      averageExecutionTime: 450,
      topFailurePatterns: [
        { pattern: 'Element locator failures', frequency: 12, category: 'ui' },
        { pattern: 'Timeout in document workflows', frequency: 8, category: 'timing' },
        { pattern: 'Bilingual UI text validation', frequency: 6, category: 'data' }
      ],
      riskAreas: [
        { area: 'Document signing workflow', risk: 0.7 },
        { area: 'Payment integration', risk: 0.6 },
        { area: 'Smart card authentication', risk: 0.5 }
      ],
      recommendations: [
        'Increase wait times for document processing steps',
        'Implement more robust bilingual text validation',
        'Add retry logic for payment API calls',
        'Stabilize smart card connection handling'
      ]
    };
    
    res.json({
      success: true,
      data: insights
    });
  } catch (error) {
    logger.error('Failed to get insights:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get MCP insights'
    });
  }
}));

/**
 * Get regression execution status
 */
router.get('/status/:executionId', asyncHandler(async (req, res) => {
  const { executionId } = req.params;
  
  try {
    // Mock status for demo - in real implementation, track execution status
    const status = {
      executionId,
      status: 'running',
      progress: 75,
      testsCompleted: 82,
      totalTests: 109,
      startTime: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      estimatedCompletion: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
      currentTest: 'test_document_workflows_bilingual',
      aiInsights: 'Detected 3 potential flaky tests, analyzing failure patterns...'
    };
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Failed to get status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get execution status'
    });
  }
}));

/**
 * Trigger daily regression workflow
 */
router.post('/daily-regression', asyncHandler(async (req, res) => {
  try {
    // Mock daily regression trigger
    const workflow = {
      id: `daily_${new Date().toISOString().split('T')[0]}`,
      type: 'daily',
      startTime: new Date().toISOString(),
      smartSelection: true,
      estimatedTests: 45,
      estimatedDuration: 1350, // seconds
      priority: 'high',
      aiRecommendations: [
        'Focus on auth and document workflows based on recent changes',
        'Include flaky test verification',
        'Run cross-browser tests for payment flows'
      ]
    };
    
    res.json({
      success: true,
      data: workflow
    });
  } catch (error) {
    logger.error('Daily regression failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger daily regression'
    });
  }
}));

export default router;