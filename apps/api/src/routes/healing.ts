import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getSelfHealingService } from '@/services/selfHealingService';
import { asyncHandler } from '@/middleware/error-handler';
import { logger } from '@/utils/logger';

const router = Router();

// Validation schemas
const AddToQueueSchema = z.object({
  testId: z.string().min(1),
  testName: z.string().min(1),
  error: z.object({
    message: z.string()
  }),
  context: z.object({
    dom: z.string(),
    screenshot: z.string().optional(), // Base64 encoded
    consoleErrors: z.array(z.string()).default([]),
    networkLogs: z.array(z.any()).default([]),
    url: z.string(),
    selector: z.string().optional(),
  })
});

const UpdateHealingItemSchema = z.object({
  status: z.enum(['pending', 'analyzing', 'healed', 'failed', 'bug_confirmed']).optional(),
  healedSelector: z.string().optional(),
  confidenceScore: z.number().min(0).max(1).optional(),
  healingAttempts: z.number().min(0).optional()
});

const GetQueueSchema = z.object({
  status: z.string().optional(),
  failure_type: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0)
});

/**
 * GET /api/healing/stats
 * Get healing system statistics
 */
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  logger.info('Fetching healing statistics');
  
  const healingService = getSelfHealingService();
  const stats = await healingService.getHealingStats();
  
  res.json(stats);
}));

/**
 * GET /api/healing/queue
 * Get healing queue items with filtering
 */
router.get('/queue', asyncHandler(async (req: Request, res: Response) => {
  const validation = GetQueueSchema.safeParse(req.query);
  
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid query parameters',
      details: validation.error.errors
    });
  }
  
  const { status, failure_type, limit, offset } = validation.data;
  
  logger.info('Fetching healing queue', { status, failure_type, limit, offset });
  
  const healingService = getSelfHealingService();
  const items = await healingService.getHealingQueue({
    status,
    failureType: failure_type,
    limit,
    offset
  });
  
  res.json({
    success: true,
    items,
    pagination: {
      limit,
      offset,
      total: items.length
    }
  });
}));

/**
 * POST /api/healing/queue
 * Add a new failure to the healing queue
 */
router.post('/queue', asyncHandler(async (req: Request, res: Response) => {
  const validation = AddToQueueSchema.safeParse(req.body);
  
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request data',
      details: validation.error.errors
    });
  }
  
  const { testId, testName, error, context } = validation.data;
  
  logger.info('Adding failure to healing queue', { testId, testName, errorMessage: error.message });
  
  // Convert base64 screenshot to buffer if provided
  let screenshot = Buffer.alloc(0);
  if (context.screenshot) {
    try {
      screenshot = Buffer.from(context.screenshot, 'base64');
    } catch (err) {
      logger.warn('Failed to decode screenshot', { error: err });
    }
  }
  
  const contextWithBuffer = {
    ...context,
    screenshot,
    error: error.message
  };
  
  const healingService = getSelfHealingService();
  const queueId = await healingService.addToHealingQueue(testId, testName, error, contextWithBuffer);
  
  res.status(201).json({
    success: true,
    queueId,
    message: 'Failure added to healing queue'
  });
}));

/**
 * PUT /api/healing/queue/:id
 * Update a healing queue item
 */
router.put('/queue/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  
  if (isNaN(id)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid queue item ID'
    });
  }
  
  const validation = UpdateHealingItemSchema.safeParse(req.body);
  
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid update data',
      details: validation.error.errors
    });
  }
  
  const updates = validation.data;
  
  logger.info('Updating healing queue item', { id, updates });
  
  const healingService = getSelfHealingService();
  await healingService.updateHealingItem(id, updates);
  
  res.json({
    success: true,
    message: 'Healing item updated successfully'
  });
}));

/**
 * GET /api/healing/queue/:id
 * Get detailed information about a specific healing queue item
 */
router.get('/queue/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  
  if (isNaN(id)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid queue item ID'
    });
  }
  
  logger.info('Fetching healing queue item details', { id });
  
  const healingService = getSelfHealingService();
  const items = await healingService.getHealingQueue({ limit: 1, offset: 0 });
  const item = items.find(i => i.id === id);
  
  if (!item) {
    return res.status(404).json({
      success: false,
      error: 'Healing queue item not found'
    });
  }
  
  res.json({
    success: true,
    item
  });
}));

/**
 * POST /api/healing/patterns
 * Store a new healing pattern
 */
router.post('/patterns', asyncHandler(async (req: Request, res: Response) => {
  const { testType, originalPattern, healedPattern, confidence, pageUrl, domContext } = req.body;
  
  if (!testType || !originalPattern || !healedPattern || confidence === undefined) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: testType, originalPattern, healedPattern, confidence'
    });
  }
  
  if (confidence < 0 || confidence > 1) {
    return res.status(400).json({
      success: false,
      error: 'Confidence score must be between 0 and 1'
    });
  }
  
  logger.info('Storing healing pattern', { testType, originalPattern, healedPattern, confidence });
  
  const healingService = getSelfHealingService();
  await healingService.storeHealingPattern(
    testType,
    originalPattern,
    healedPattern,
    confidence,
    pageUrl,
    domContext
  );
  
  res.status(201).json({
    success: true,
    message: 'Healing pattern stored successfully'
  });
}));

/**
 * GET /api/healing/patterns
 * Find healing patterns for a given selector
 */
router.get('/patterns', asyncHandler(async (req: Request, res: Response) => {
  const { testType, originalSelector, pageUrl } = req.query;
  
  if (!testType || !originalSelector) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: testType, originalSelector'
    });
  }
  
  logger.info('Finding healing pattern', { testType, originalSelector, pageUrl });
  
  const healingService = getSelfHealingService();
  const pattern = await healingService.findHealingPattern(
    testType as string,
    originalSelector as string,
    pageUrl as string
  );
  
  res.json({
    success: true,
    pattern
  });
}));

/**
 * POST /api/healing/analyze
 * Analyze a failure and suggest healing actions
 */
router.post('/analyze', asyncHandler(async (req: Request, res: Response) => {
  const { error, context } = req.body;
  
  if (!error || !context) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: error, context'
    });
  }
  
  logger.info('Analyzing failure for healing suggestions', { 
    errorMessage: error.message,
    url: context.url 
  });
  
  const healingService = getSelfHealingService();
  const failureType = await healingService.classifyFailure(error, context);
  
  // Check for existing patterns that might help
  let suggestedPattern = null;
  if (context.selector && context.testType) {
    suggestedPattern = await healingService.findHealingPattern(
      context.testType,
      context.selector,
      context.url
    );
  }
  
  res.json({
    success: true,
    analysis: {
      failureType,
      classification: getFailureTypeDescription(failureType),
      suggestedPattern,
      confidence: suggestedPattern ? suggestedPattern.confidence_score : 0,
      recommendations: getHealingRecommendations(failureType)
    }
  });
}));

/**
 * DELETE /api/healing/cleanup
 * Clean up old healing queue items
 */
router.delete('/cleanup', asyncHandler(async (req: Request, res: Response) => {
  const olderThanDays = parseInt(req.query.days as string) || 30;
  
  if (olderThanDays < 1 || olderThanDays > 365) {
    return res.status(400).json({
      success: false,
      error: 'Days parameter must be between 1 and 365'
    });
  }
  
  logger.info('Cleaning up healing queue', { olderThanDays });
  
  const healingService = getSelfHealingService();
  const deletedCount = await healingService.cleanup(olderThanDays);
  
  res.json({
    success: true,
    message: `Cleaned up ${deletedCount} old healing items`,
    deletedCount
  });
}));

/**
 * POST /api/healing/test-scenario
 * Test the self-healing system with a simulated failure
 */
router.post('/test-scenario', asyncHandler(async (req: Request, res: Response) => {
  const { testId, testName, error, originalSelector, domContent } = req.body;
  
  if (!testId || !testName || !error || !originalSelector || !domContent) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: testId, testName, error, originalSelector, domContent'
    });
  }
  
  logger.info('Running healing test scenario', { testId, testName, error });
  
  const healingService = getSelfHealingService();
  
  // Create error object
  const errorObj = new Error(error);
  
  // Create failure context
  const context = {
    dom: domContent,
    screenshot: Buffer.alloc(0),
    consoleErrors: [],
    networkLogs: [],
    error: error,
    url: 'https://devtest.comda.co.il',
    selector: originalSelector,
    testId,
    testName
  };
  
  try {
    // Test the healing process
    const failureType = await healingService.classifyFailure(errorObj, context);
    console.log('Failure type:', failureType);
    
    let healed = false;
    let newSelector = null;
    let confidence = 0;
    
    if (failureType === 'SELECTOR_ISSUE') {
      // Test alternative selector finding
      const alternatives = await healingService.findAlternativeSelectors(
        originalSelector,
        domContent
      );
      
      console.log('Found alternatives:', alternatives);
      
      if (alternatives && alternatives.length > 0) {
        healed = true;
        newSelector = alternatives[0].selector;
        confidence = alternatives[0].confidence;
        
        // Record the healing attempt
        await healingService.recordHealing(
          testId,
          testName,
          failureType,
          originalSelector,
          newSelector,
          confidence
        );
      }
    }
    
    // Add to healing queue for tracking
    await healingService.addToHealingQueue(testId, testName, errorObj, context);
    
    res.json({
      success: true,
      healed,
      failureType,
      originalSelector,
      newSelector,
      confidence,
      alternatives: healed ? 1 : 0,
      message: healed ? 
        `Healing succeeded! Found new selector: ${newSelector}` : 
        `Healing failed. No alternatives found for: ${originalSelector}`
    });
    
  } catch (error: any) {
    logger.error('Test scenario failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Test scenario execution failed',
      details: error.message
    });
  }
}));

/**
 * GET /api/healing/health
 * Health check for the healing system
 */
router.get('/health', asyncHandler(async (req: Request, res: Response) => {
  const healingService = getSelfHealingService();
  const healthy = await healingService.healthCheck();
  
  res.status(healthy ? 200 : 503).json({
    success: healthy,
    status: healthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString()
  });
}));

// Helper functions
function getFailureTypeDescription(failureType: string): string {
  switch (failureType) {
    case 'SELECTOR_ISSUE':
      return 'Element selector could not locate the target element. This might be due to DOM changes or incorrect selectors.';
    case 'TIMING_ISSUE':
      return 'Operation timed out waiting for element or condition. This suggests timing or synchronization problems.';
    case 'APPLICATION_BUG':
      return 'Application error detected (HTTP errors, console errors). This indicates a bug in the application under test.';
    case 'DOM_CHANGE':
      return 'DOM structure changed or element became stale. This suggests dynamic content or single-page app navigation issues.';
    case 'NETWORK_ISSUE':
      return 'Network or connectivity problem. This could be related to API calls, resource loading, or CORS issues.';
    case 'AUTH_ISSUE':
      return 'Authentication or authorization problem. This suggests session timeout or permission issues.';
    default:
      return 'Unknown failure type. Manual analysis may be required.';
  }
}

function getHealingRecommendations(failureType: string): string[] {
  switch (failureType) {
    case 'SELECTOR_ISSUE':
      return [
        'Try more robust selectors (CSS attributes, text content, ARIA labels)',
        'Use hierarchical selectors to be more specific',
        'Consider waiting for element to be present before interaction',
        'Check if element is within an iframe or shadow DOM'
      ];
    case 'TIMING_ISSUE':
      return [
        'Increase wait timeouts for slow operations',
        'Wait for specific conditions instead of fixed delays',
        'Check for loading indicators and wait for them to disappear',
        'Use explicit waits instead of implicit waits'
      ];
    case 'APPLICATION_BUG':
      return [
        'Report this as a bug to the development team',
        'Check if this is a known issue in the bug tracker',
        'Skip this test until the application bug is fixed',
        'Add conditional logic to handle error states'
      ];
    case 'DOM_CHANGE':
      return [
        'Refresh page or re-navigate to reset DOM state',
        'Wait for DOM to stabilize before interacting',
        'Use more stable selectors that survive DOM changes',
        'Handle single-page app navigation properly'
      ];
    case 'NETWORK_ISSUE':
      return [
        'Check network connectivity and API endpoints',
        'Implement retry logic for network operations',
        'Verify CORS configuration for cross-origin requests',
        'Add proper error handling for failed requests'
      ];
    case 'AUTH_ISSUE':
      return [
        'Re-authenticate or refresh session tokens',
        'Check if test user has proper permissions',
        'Verify authentication flow is working correctly',
        'Handle session timeout scenarios gracefully'
      ];
    default:
      return [
        'Review test logs and screenshots for more context',
        'Check if this is an environmental issue',
        'Consider if test data or setup is correct',
        'Manual investigation may be required'
      ];
  }
}

export default router;