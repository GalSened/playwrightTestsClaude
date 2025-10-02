import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getSelfHealingService } from '@/services/selfHealingService';
import { asyncHandler } from '@/middleware/error-handler';
import { logger } from '@/utils/logger';
import { getDatabase } from '@/database/database';

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

const ApplyHealingSchema = z.object({
  queueId: z.number().min(1),
  selector: z.string().min(1),
  testType: z.string().min(1),
  autoApply: z.boolean().default(false)
});

/**
 * GET /api/healing/dashboard
 * Get comprehensive healing dashboard statistics
 */
router.get('/dashboard', asyncHandler(async (req: Request, res: Response) => {
  logger.info('Fetching healing dashboard statistics');

  const healingService = getSelfHealingService();
  const db = getDatabase();
  const dbInstance = (db as any).db;

  try {
    // Get basic healing stats
    const stats = await healingService.getHealingStats();

    // Get failure type distribution
    const failureTypeStmt = dbInstance.prepare(`
      SELECT failure_type, COUNT(*) as count
      FROM healing_queue
      WHERE date(created_at) >= date('now', '-30 days')
      GROUP BY failure_type
      ORDER BY count DESC
    `);
    const failureTypes = failureTypeStmt.all();

    // Get healing trends (last 30 days)
    const trendsStmt = dbInstance.prepare(`
      SELECT
        date(created_at) as date,
        COUNT(*) as total_failures,
        COUNT(CASE WHEN status = 'healed' THEN 1 END) as healed_count,
        AVG(CASE WHEN confidence_score > 0 THEN confidence_score END) as avg_confidence
      FROM healing_queue
      WHERE date(created_at) >= date('now', '-30 days')
      GROUP BY date(created_at)
      ORDER BY date
    `);
    const trends = trendsStmt.all();

    // Get top test failures
    const topFailuresStmt = dbInstance.prepare(`
      SELECT
        test_name,
        failure_type,
        COUNT(*) as failure_count,
        COUNT(CASE WHEN status = 'healed' THEN 1 END) as healed_count,
        AVG(CASE WHEN confidence_score > 0 THEN confidence_score END) as avg_confidence
      FROM healing_queue
      WHERE date(created_at) >= date('now', '-30 days')
      GROUP BY test_name, failure_type
      ORDER BY failure_count DESC
      LIMIT 10
    `);
    const topFailures = topFailuresStmt.all();

    // Get WeSign-specific metrics
    const wesignStmt = dbInstance.prepare(`
      SELECT
        CASE
          WHEN failure_type LIKE '%WESIGN%' THEN 'WeSign Specific'
          WHEN failure_type LIKE '%HEBREW%' THEN 'Hebrew/RTL'
          WHEN failure_type LIKE '%SIGNING%' THEN 'Digital Signature'
          WHEN failure_type LIKE '%CONTACT%' THEN 'Contact Management'
          WHEN failure_type LIKE '%DOCUMENT%' THEN 'Document Management'
          ELSE 'General'
        END as category,
        COUNT(*) as count,
        COUNT(CASE WHEN status = 'healed' THEN 1 END) as healed,
        AVG(CASE WHEN confidence_score > 0 THEN confidence_score END) as avg_confidence
      FROM healing_queue
      WHERE date(created_at) >= date('now', '-30 days')
      GROUP BY category
      ORDER BY count DESC
    `);
    const wesignMetrics = wesignStmt.all();

    // Calculate healing effectiveness
    const effectiveness = {
      overallSuccessRate: stats.successRate,
      avgHealingTime: 'N/A', // Could be calculated if we track timing
      patternReuseRate: 'N/A', // Could be calculated from patterns table
      weeklyImprovement: trends.length > 7 ?
        ((trends[trends.length - 1]?.healed_count || 0) - (trends[trends.length - 7]?.healed_count || 0)) : 0
    };

    res.json({
      success: true,
      dashboard: {
        overview: stats,
        failureTypes,
        trends,
        topFailures,
        wesignMetrics,
        effectiveness,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Failed to fetch healing dashboard', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch healing dashboard statistics'
    });
  }
}));

/**
 * GET /api/healing/suggestions
 * Get AI-powered healing suggestions for a failure
 */
router.get('/suggestions', asyncHandler(async (req: Request, res: Response) => {
  const { error, context, testType } = req.query;

  if (!error || !context) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: error, context'
    });
  }

  logger.info('Getting AI healing suggestions', { error, testType });

  try {
    const healingService = getSelfHealingService();

    // Parse context if it's a string
    const parsedContext = typeof context === 'string' ? JSON.parse(context) : context;

    // Create error object
    const errorObj = new Error(error as string);

    // Get failure classification
    const failureType = await healingService.classifyFailure(errorObj, parsedContext);

    // Find alternative selectors if it's a selector issue
    let alternatives = [];
    if (failureType.includes('SELECTOR') && parsedContext.selector && parsedContext.dom) {
      alternatives = await healingService.findAlternativeSelectors(
        parsedContext.selector,
        parsedContext.dom,
        parsedContext
      );
    }

    // Look for existing patterns
    let existingPattern = null;
    if (parsedContext.selector && testType) {
      existingPattern = await healingService.findHealingPattern(
        testType as string,
        parsedContext.selector,
        parsedContext.url
      );
    }

    // Generate recommendations
    const recommendations = getHealingRecommendations(failureType);

    // Calculate confidence score
    const confidenceScore = calculateSuggestionConfidence(
      failureType,
      alternatives.length,
      existingPattern?.confidence_score || 0
    );

    res.json({
      success: true,
      suggestions: {
        failureType,
        classification: getFailureTypeDescription(failureType),
        alternatives: alternatives.slice(0, 3), // Top 3 alternatives
        existingPattern,
        recommendations,
        confidenceScore,
        autoHealable: alternatives.length > 0 && confidenceScore > 0.7,
        estimatedSuccessRate: Math.round(confidenceScore * 100)
      }
    });

  } catch (error) {
    logger.error('Failed to get healing suggestions', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to generate healing suggestions'
    });
  }
}));

/**
 * POST /api/healing/apply
 * Apply healing suggestion automatically
 */
router.post('/apply', asyncHandler(async (req: Request, res: Response) => {
  const validation = ApplyHealingSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request data',
      details: validation.error.errors
    });
  }

  const { queueId, selector, testType, autoApply } = validation.data;

  logger.info('Applying healing suggestion', { queueId, selector, testType, autoApply });

  try {
    const healingService = getSelfHealingService();

    // Get the healing queue item
    const items = await healingService.getHealingQueue({ limit: 1000, offset: 0 });
    const item = items.find(i => i.id === queueId);

    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Healing queue item not found'
      });
    }

    // Calculate confidence for the new selector
    const confidence = autoApply ? 0.9 : 0.8; // Higher confidence for manual application

    // Update the healing item with the new selector
    await healingService.updateHealingItem(queueId, {
      status: 'healed',
      healedSelector: selector,
      confidenceScore: confidence,
      healingAttempts: (item.healing_attempts || 0) + 1
    });

    // Store the healing pattern for future use
    await healingService.storeHealingPattern(
      testType,
      item.original_selector || '',
      selector,
      confidence,
      'https://devtest.comda.co.il',
      `Auto-healing applied for test: ${item.test_name}`
    );

    // Record the healing for analytics
    await healingService.recordHealing(
      item.test_id,
      item.test_name,
      item.failure_type,
      item.original_selector || '',
      selector,
      confidence
    );

    res.json({
      success: true,
      message: 'Healing applied successfully',
      healing: {
        queueId,
        originalSelector: item.original_selector,
        healedSelector: selector,
        confidence,
        status: 'healed'
      }
    });

  } catch (error) {
    logger.error('Failed to apply healing', { error, queueId, selector });
    res.status(500).json({
      success: false,
      error: 'Failed to apply healing suggestion'
    });
  }
}));

/**
 * GET /api/healing/history
 * Get healing history and analytics
 */
router.get('/history', asyncHandler(async (req: Request, res: Response) => {
  const { period = '30', testName, failureType } = req.query;

  logger.info('Fetching healing history', { period, testName, failureType });

  try {
    const db = getDatabase();
    const dbInstance = (db as any).db;

    let whereClause = `WHERE date(created_at) >= date('now', '-${period} days')`;
    const params: any[] = [];

    if (testName) {
      whereClause += ' AND test_name LIKE ?';
      params.push(`%${testName}%`);
    }

    if (failureType) {
      whereClause += ' AND failure_type = ?';
      params.push(failureType);
    }

    // Get healing history
    const historyStmt = dbInstance.prepare(`
      SELECT
        id, test_id, test_name, failure_type, error_message,
        original_selector, healed_selector, confidence_score,
        status, healing_attempts, created_at, healed_at
      FROM healing_queue
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT 100
    `);
    const history = historyStmt.all(...params);

    // Get success metrics
    const metricsStmt = dbInstance.prepare(`
      SELECT
        COUNT(*) as total_attempts,
        COUNT(CASE WHEN status = 'healed' THEN 1 END) as successful_healings,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_healings,
        COUNT(CASE WHEN status = 'bug_confirmed' THEN 1 END) as confirmed_bugs,
        AVG(CASE WHEN confidence_score > 0 THEN confidence_score END) as avg_confidence,
        AVG(healing_attempts) as avg_attempts
      FROM healing_queue
      ${whereClause}
    `);
    const metrics = metricsStmt.get(...params);

    // Get pattern effectiveness
    const patternsStmt = dbInstance.prepare(`
      SELECT
        test_type, original_pattern, healed_pattern,
        confidence_score, success_count,
        updated_at as last_used
      FROM healing_patterns
      ORDER BY success_count DESC, confidence_score DESC
      LIMIT 20
    `);
    const topPatterns = patternsStmt.all();

    // Calculate time-based analytics
    const timeAnalyticsStmt = dbInstance.prepare(`
      SELECT
        strftime('%Y-%m-%d', created_at) as date,
        COUNT(*) as daily_failures,
        COUNT(CASE WHEN status = 'healed' THEN 1 END) as daily_healings,
        AVG(CASE WHEN confidence_score > 0 THEN confidence_score END) as daily_confidence
      FROM healing_queue
      ${whereClause}
      GROUP BY strftime('%Y-%m-%d', created_at)
      ORDER BY date
    `);
    const timeAnalytics = timeAnalyticsStmt.all(...params);

    res.json({
      success: true,
      history: {
        items: history,
        metrics: {
          ...metrics,
          success_rate: metrics.total_attempts > 0 ?
            Math.round((metrics.successful_healings / metrics.total_attempts) * 100) : 0,
          avg_confidence_percent: Math.round((metrics.avg_confidence || 0) * 100)
        },
        topPatterns,
        timeAnalytics,
        filters: {
          period: parseInt(period as string),
          testName: testName || null,
          failureType: failureType || null
        }
      }
    });

  } catch (error) {
    logger.error('Failed to fetch healing history', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch healing history'
    });
  }
}));

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
    case 'WESIGN_SELECTOR_ISSUE':
    case 'WESIGN_SIGNING_SELECTOR_ISSUE':
    case 'WESIGN_CONTACT_SELECTOR_ISSUE':
    case 'WESIGN_DOCUMENT_SELECTOR_ISSUE':
    case 'WESIGN_TEMPLATE_SELECTOR_ISSUE':
    case 'WESIGN_DASHBOARD_SELECTOR_ISSUE':
    case 'WESIGN_HEBREW_SELECTOR_ISSUE':
      return 'Element selector could not locate the target element. This might be due to DOM changes or incorrect selectors.';
    case 'TIMING_ISSUE':
    case 'WESIGN_TIMING_ISSUE':
    case 'WESIGN_SIGNING_TIMING_ISSUE':
    case 'WESIGN_DOCUMENT_TIMING_ISSUE':
    case 'WESIGN_API_TIMING_ISSUE':
      return 'Operation timed out waiting for element or condition. This suggests timing or synchronization problems.';
    case 'APPLICATION_BUG':
    case 'WESIGN_APPLICATION_BUG':
      return 'Application error detected (HTTP errors, console errors). This indicates a bug in the application under test.';
    case 'DOM_CHANGE':
    case 'WESIGN_DOM_CHANGE':
      return 'DOM structure changed or element became stale. This suggests dynamic content or single-page app navigation issues.';
    case 'NETWORK_ISSUE':
    case 'WESIGN_NETWORK_ISSUE':
      return 'Network or connectivity problem. This could be related to API calls, resource loading, or CORS issues.';
    case 'AUTH_ISSUE':
    case 'WESIGN_AUTH_TOKEN_ISSUE':
    case 'WESIGN_AUTH_PERMISSION_ISSUE':
      return 'Authentication or authorization problem. This suggests session timeout or permission issues.';
    case 'HEBREW_UI_SELECTOR_ISSUE':
    case 'HEBREW_RTL_LAYOUT_ISSUE':
      return 'Hebrew/RTL UI specific issue. Element may have different positioning or text direction in Hebrew interface.';
    case 'SIGNING_CANVAS_ISSUE':
      return 'Digital signature canvas issue. Problem with drawing or canvas element interaction in signing workflow.';
    case 'DOCUMENT_RENDERING_ISSUE':
    case 'DOCUMENT_UPLOAD_ISSUE':
    case 'DOCUMENT_PREVIEW_ISSUE':
      return 'Document processing issue. Problem with document upload, rendering, or preview functionality.';
    case 'CONTACT_FORM_ISSUE':
    case 'CONTACT_LIST_ISSUE':
      return 'Contact management issue. Problem with contact forms, validation, or list display.';
    case 'TEMPLATE_EDITOR_ISSUE':
      return 'Template editor issue. Problem with template design or editing functionality.';
    case 'SIGNING_TIMEOUT_ISSUE':
      return 'Digital signature timeout. Signing process took too long or timed out waiting for user interaction.';
    default:
      return 'Unknown failure type. Manual analysis may be required.';
  }
}

function getHealingRecommendations(failureType: string): string[] {
  switch (failureType) {
    case 'SELECTOR_ISSUE':
    case 'WESIGN_SELECTOR_ISSUE':
    case 'WESIGN_SIGNING_SELECTOR_ISSUE':
    case 'WESIGN_CONTACT_SELECTOR_ISSUE':
    case 'WESIGN_DOCUMENT_SELECTOR_ISSUE':
    case 'WESIGN_TEMPLATE_SELECTOR_ISSUE':
    case 'WESIGN_DASHBOARD_SELECTOR_ISSUE':
      return [
        'Try more robust selectors (CSS attributes, text content, ARIA labels)',
        'Use hierarchical selectors to be more specific',
        'Consider waiting for element to be present before interaction',
        'Check if element is within an iframe or shadow DOM',
        'Use WeSign-specific data-testid attributes where available'
      ];
    case 'WESIGN_HEBREW_SELECTOR_ISSUE':
    case 'HEBREW_UI_SELECTOR_ISSUE':
    case 'HEBREW_RTL_LAYOUT_ISSUE':
      return [
        'Use text-independent selectors (data-testid, ARIA labels)',
        'Account for RTL layout differences in positioning',
        'Use :has-text() for Hebrew content with fallback',
        'Check element positioning with dir="rtl" attribute',
        'Consider using English UI for more stable automation'
      ];
    case 'TIMING_ISSUE':
    case 'WESIGN_TIMING_ISSUE':
    case 'WESIGN_SIGNING_TIMING_ISSUE':
    case 'WESIGN_DOCUMENT_TIMING_ISSUE':
    case 'WESIGN_API_TIMING_ISSUE':
    case 'SIGNING_TIMEOUT_ISSUE':
      return [
        'Increase wait timeouts for slow operations',
        'Wait for specific conditions instead of fixed delays',
        'Check for loading indicators and wait for them to disappear',
        'Use explicit waits instead of implicit waits',
        'Wait for WeSign API responses before proceeding'
      ];
    case 'APPLICATION_BUG':
    case 'WESIGN_APPLICATION_BUG':
      return [
        'Report this as a bug to the WeSign development team',
        'Check if this is a known issue in the bug tracker',
        'Skip this test until the application bug is fixed',
        'Add conditional logic to handle error states',
        'Verify WeSign environment is properly configured'
      ];
    case 'DOM_CHANGE':
    case 'WESIGN_DOM_CHANGE':
      return [
        'Refresh page or re-navigate to reset DOM state',
        'Wait for DOM to stabilize before interacting',
        'Use more stable selectors that survive DOM changes',
        'Handle single-page app navigation properly',
        'Wait for WeSign components to fully load'
      ];
    case 'NETWORK_ISSUE':
    case 'WESIGN_NETWORK_ISSUE':
      return [
        'Check network connectivity and API endpoints',
        'Implement retry logic for network operations',
        'Verify CORS configuration for cross-origin requests',
        'Add proper error handling for failed requests',
        'Check WeSign backend service health'
      ];
    case 'AUTH_ISSUE':
    case 'WESIGN_AUTH_TOKEN_ISSUE':
    case 'WESIGN_AUTH_PERMISSION_ISSUE':
      return [
        'Re-authenticate or refresh WeSign session tokens',
        'Check if test user has proper WeSign permissions',
        'Verify WeSign authentication flow is working correctly',
        'Handle session timeout scenarios gracefully',
        'Ensure test environment has valid WeSign credentials'
      ];
    case 'SIGNING_CANVAS_ISSUE':
      return [
        'Verify canvas element is fully loaded before interaction',
        'Use proper canvas drawing coordinates',
        'Check if canvas is within viewport',
        'Wait for signature drawing tools to initialize',
        'Handle canvas events with proper timing'
      ];
    case 'DOCUMENT_RENDERING_ISSUE':
    case 'DOCUMENT_UPLOAD_ISSUE':
    case 'DOCUMENT_PREVIEW_ISSUE':
      return [
        'Wait for document processing to complete',
        'Verify document file format is supported',
        'Check document size limits',
        'Wait for preview rendering to finish',
        'Handle document upload progress indicators'
      ];
    case 'CONTACT_FORM_ISSUE':
    case 'CONTACT_LIST_ISSUE':
      return [
        'Validate form fields before submission',
        'Check for form validation errors',
        'Wait for contact list to load completely',
        'Handle contact search and filtering properly',
        'Verify contact data formatting requirements'
      ];
    case 'TEMPLATE_EDITOR_ISSUE':
      return [
        'Wait for template editor to fully initialize',
        'Handle template saving and loading properly',
        'Check template design tool interactions',
        'Verify template preview functionality',
        'Handle template validation errors'
      ];
    default:
      return [
        'Review test logs and screenshots for more context',
        'Check if this is an environmental issue',
        'Consider if test data or setup is correct',
        'Manual investigation may be required',
        'Consult WeSign documentation for specific guidance'
      ];
  }
}

function calculateSuggestionConfidence(failureType: string, alternativesCount: number, existingPatternConfidence: number): number {
  let baseConfidence = 0.3; // Base confidence

  // Boost confidence based on failure type
  if (failureType.includes('SELECTOR')) {
    baseConfidence += 0.3;
  } else if (failureType.includes('TIMING')) {
    baseConfidence += 0.2;
  } else if (failureType.includes('APPLICATION_BUG')) {
    baseConfidence -= 0.1; // Lower confidence for app bugs
  }

  // Boost confidence based on available alternatives
  if (alternativesCount > 0) {
    baseConfidence += Math.min(alternativesCount * 0.1, 0.3);
  }

  // Use existing pattern confidence if available
  if (existingPatternConfidence > 0) {
    baseConfidence = Math.max(baseConfidence, existingPatternConfidence);
  }

  // WeSign-specific confidence boosts
  if (failureType.includes('WESIGN')) {
    baseConfidence += 0.1; // Higher confidence for WeSign-specific issues
  }

  return Math.min(Math.max(baseConfidence, 0), 1); // Ensure 0-1 range
}

export default router;