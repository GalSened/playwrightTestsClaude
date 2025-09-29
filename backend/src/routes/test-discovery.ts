/**
 * Test Discovery API Routes
 * Handles automatic test discovery, scanning, and management
 */

import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/error-handler';
import { testDiscoveryService } from '../services/testDiscoveryService';
import { fileWatcherService } from '../services/fileWatcherService';
import { TestRunner } from '../services/testRunner';
import { logger } from '../utils/logger';
import { authMiddleware } from '../middleware/auth';
import { getDatabase } from '../database/database';

const router = Router();

// Validation schemas
const GetTestsSchema = z.object({
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['passed', 'failed', 'skipped']).optional(),
  search: z.string().optional(),
  limit: z.number().min(1).max(1000).optional(),
  offset: z.number().min(0).optional()
});

const CreateSuiteSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  filters: z.object({
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    status: z.string().optional(),
    search: z.string().optional()
  })
});

/**
 * GET /api/tests
 * Get all available tests (forwards to WeSign tests)
 */
router.get('/', asyncHandler(async (req, res) => {
  try {
    // Forward to WeSign test discovery
    const wesignRouter = require('./wesign/index').default;
    const mockReq = { ...req, params: {}, query: req.query };
    const mockRes = {
      json: (data: any) => {
        if (data.success && data.tests) {
          res.json(data.tests);
        } else {
          res.json([]);
        }
      },
      status: (code: number) => ({
        json: (data: any) => res.status(code).json(data)
      })
    };

    // Call the WeSign tests endpoint
    await wesignRouter.stack.find((layer: any) =>
      layer.route && layer.route.path === '/tests' && layer.route.methods.get
    ).route.stack[0].handle(mockReq, mockRes);

  } catch (error: any) {
    logger.error('Failed to get tests', { error: error.message });
    res.json([]);
  }
}));

/**
 * POST /api/tests/scan
 * Trigger full test discovery scan
 */
router.post('/scan', asyncHandler(async (req, res) => {
  logger.info('Starting test discovery scan');
  
  try {
    const stats = await testDiscoveryService.performFullScan();
    
    logger.info('Test discovery scan completed', { stats });
    
    res.json({
      success: true,
      message: 'Test discovery scan completed successfully',
      stats
    });

  } catch (error) {
    logger.error('Test discovery scan failed', { error });
    res.status(500).json({
      success: false,
      message: 'Test discovery scan failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * GET /api/tests/all
 * Get all discovered tests with optional filtering
 */
router.get('/all', asyncHandler(async (req, res) => {
  try {
    const filters = GetTestsSchema.parse({
      category: req.query.category,
      tags: req.query.tags ? JSON.parse(req.query.tags as string) : undefined,
      status: req.query.status,
      search: req.query.search,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
    });

    const result = await testDiscoveryService.getTests(filters);
    
    res.json({
      success: true,
      tests: result.tests,
      total: result.total,
      filters
    });

  } catch (error) {
    logger.error('Failed to get tests', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve tests',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * GET /api/tests/categories
 * Get all test categories with statistics
 */
router.get('/categories', asyncHandler(async (req, res) => {
  try {
    const categories = await testDiscoveryService.getCategories();
    
    res.json({
      success: true,
      categories
    });

  } catch (error) {
    logger.error('Failed to get categories', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve categories',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * GET /api/tests/tags
 * Get all test tags with counts
 */
router.get('/tags', asyncHandler(async (req, res) => {
  try {
    const tags = await testDiscoveryService.getTags();
    
    res.json({
      success: true,
      tags
    });

  } catch (error) {
    logger.error('Failed to get tags', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve tags',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * GET /api/tests/by-tag/:tag
 * Get tests by specific tag
 */
router.get('/by-tag/:tag', asyncHandler(async (req, res) => {
  try {
    const { tag } = req.params;
    const tests = await testDiscoveryService.getTestsByTag(tag);
    
    res.json({
      success: true,
      tag,
      tests,
      count: tests.length
    });

  } catch (error) {
    logger.error('Failed to get tests by tag', { error, tag: req.params.tag });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve tests by tag',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * POST /api/tests/sync
 * Sync test discovery with file system
 */
router.post('/sync', asyncHandler(async (req, res) => {
  try {
    const syncResult = await testDiscoveryService.syncWithFileSystem();
    
    logger.info('Test discovery sync completed', { syncResult });
    
    res.json({
      success: true,
      message: 'Test discovery sync completed',
      changes: syncResult
    });

  } catch (error) {
    logger.error('Test discovery sync failed', { error });
    res.status(500).json({
      success: false,
      message: 'Test discovery sync failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * GET /api/tests/stats
 * Get test discovery statistics
 */
router.get('/stats', asyncHandler(async (req, res) => {
  try {
    const stats = await testDiscoveryService.getDiscoveryStats();
    
    res.json({
      success: true,
      stats
    });

  } catch (error) {
    logger.error('Failed to get discovery stats', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve discovery statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * POST /api/tests/suites
 * Create a new test suite from filtered tests
 */
router.post('/suites', asyncHandler(async (req, res) => {
  try {
    const data = CreateSuiteSchema.parse(req.body);
    
    const suiteId = await testDiscoveryService.createTestSuite(
      data.name,
      data.description || '',
      data.filters,
      req.user?.id // From auth middleware
    );
    
    logger.info('Test suite created', { suiteId, name: data.name });
    
    res.status(201).json({
      success: true,
      message: 'Test suite created successfully',
      suiteId
    });

  } catch (error) {
    logger.error('Failed to create test suite', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to create test suite',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * POST /api/tests/initialize
 * Initialize test discovery database and perform initial scan
 */
router.post('/initialize', asyncHandler(async (req, res) => {
  try {
    logger.info('Initializing test discovery system');
    
    // Initialize database tables
    await testDiscoveryService.initializeDatabase();
    
    // Perform initial scan
    const stats = await testDiscoveryService.performFullScan();
    
    logger.info('Test discovery system initialized successfully', { stats });
    
    res.json({
      success: true,
      message: 'Test discovery system initialized successfully',
      stats
    });

  } catch (error) {
    logger.error('Failed to initialize test discovery system', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to initialize test discovery system',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * POST /api/tests/watch/start
 * Start file watching for real-time test discovery
 */
router.post('/watch/start', asyncHandler(async (req, res) => {
  try {
    await fileWatcherService.startWatching();
    
    res.json({
      success: true,
      message: 'File watching started successfully',
      status: fileWatcherService.getStatus()
    });

  } catch (error) {
    logger.error('Failed to start file watching', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to start file watching',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * POST /api/tests/watch/stop
 * Stop file watching
 */
router.post('/watch/stop', asyncHandler(async (req, res) => {
  try {
    await fileWatcherService.stopWatching();
    
    res.json({
      success: true,
      message: 'File watching stopped successfully'
    });

  } catch (error) {
    logger.error('Failed to stop file watching', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to stop file watching',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * GET /api/tests/watch/status
 * Get file watcher status
 */
router.get('/watch/status', asyncHandler(async (req, res) => {
  try {
    const status = fileWatcherService.getStatus();
    
    res.json({
      success: true,
      status
    });

  } catch (error) {
    logger.error('Failed to get file watcher status', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to get file watcher status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * POST /api/tests/run/:id
 * Run a single test with self-healing capabilities
 */
router.post('/run/:id', asyncHandler(async (req, res) => {
  try {
    const testId = req.params.id;
    const { executionMode = 'headed', retryCount = 1 } = req.body || {};
    
    const runner = new TestRunner();
    
    logger.info('Running test with self-healing', { testId, executionMode, retryCount });
    
    const result = await runner.runTest(testId, { executionMode, retryCount });
    
    res.json({
      success: true,
      result
    });

  } catch (error) {
    logger.error('Failed to run test', { testId: req.params.id, error });
    res.status(500).json({
      success: false,
      message: 'Failed to run test',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * POST /api/tests/run/multiple
 * Run multiple tests with self-healing capabilities
 */
router.post('/run/multiple', asyncHandler(async (req, res) => {
  try {
    const { testIds } = req.body;
    
    if (!Array.isArray(testIds) || testIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'testIds must be a non-empty array'
      });
    }

    const runner = new TestRunner();
    logger.info('Running multiple tests with self-healing', { count: testIds.length });
    
    const results = await runner.runMultipleTests(testIds);
    
    const summary = {
      total: results.length,
      passed: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed').length,
      healed: results.filter(r => r.status === 'healed').length
    };
    
    res.json({
      success: true,
      results,
      summary
    });

  } catch (error) {
    logger.error('Failed to run multiple tests', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to run multiple tests',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * GET /api/tests/run/history/:id
 * Get test run history for a specific test
 */
router.get('/run/history/:id', asyncHandler(async (req, res) => {
  try {
    const testId = req.params.id;
    const limit = parseInt(req.query.limit as string) || 10;
    
    const runner = new TestRunner();
    const history = await runner.getTestHistory(testId, limit);
    
    res.json({
      success: true,
      history
    });

  } catch (error) {
    logger.error('Failed to get test history', { testId: req.params.id, error });
    res.status(500).json({
      success: false,
      message: 'Failed to get test history',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * GET /api/tests/suites/list
 * Get all existing test suites
 */
router.get('/suites/list', asyncHandler(async (req, res) => {
  try {
    const { apiClient } = await import('../services/apiClient');
    const suites = await apiClient.getSuites();
    
    res.json({
      success: true,
      suites,
      total: suites.length
    });

  } catch (error) {
    logger.error('Failed to get test suites', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to get test suites',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * POST /api/tests/suites/quick
 * Create a quick suite from tags, categories, or specific test IDs
 */
router.post('/suites/quick', asyncHandler(async (req, res) => {
  try {
    const { name, description, tags, categories, testIds, type = 'custom' } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Suite name is required'
      });
    }

    let selectedTestIds: string[] = [];
    
    if (testIds && Array.isArray(testIds)) {
      selectedTestIds = testIds;
    } else {
      // Get tests from database based on tags or categories
      const db = getDatabase().db;
      let query = 'SELECT id FROM tests WHERE 1=1';
      const params: any[] = [];
      
      if (tags && Array.isArray(tags) && tags.length > 0) {
        // Handle both JSON array format and comma-separated string format
        const tagConditions = tags.map(() => `(tags LIKE ? OR tags LIKE ?)`).join(' OR ');
        query += ` AND (${tagConditions})`;
        tags.forEach(tag => {
          params.push(`%"${tag}"%`); // JSON array format: ["tag1", "tag2"]
          params.push(`%${tag}%`);   // Comma-separated format: tag1,tag2
        });
      }
      
      if (categories && Array.isArray(categories) && categories.length > 0) {
        const categoryConditions = categories.map(() => `category = ?`).join(' OR ');
        query += ` AND (${categoryConditions})`;
        categories.forEach(category => params.push(category));
      }
      
      const tests = db.prepare(query).all(...params);
      selectedTestIds = tests.map((test: any) => test.id);
    }

    if (selectedTestIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No tests found matching the specified criteria'
      });
    }

    // Create suite object
    const newSuite = {
      id: `suite-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      description: description || `Auto-generated suite with ${selectedTestIds.length} tests`,
      testIds: selectedTestIds,
      tags: tags || [],
      createdAt: new Date().toISOString(),
      type
    };

    // Store in localStorage-compatible format (for now)
    // In production, this would be stored in a proper database
    res.json({
      success: true,
      message: 'Quick suite created successfully',
      suite: newSuite,
      testsCount: selectedTestIds.length
    });

  } catch (error) {
    logger.error('Failed to create quick suite', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to create quick suite',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * GET /api/tests/categories/list
 * Get list of available test categories for suite building
 */
router.get('/categories/list', asyncHandler(async (req, res) => {
  try {
    const db = getDatabase().db;
    const categories = db.prepare(`
      SELECT DISTINCT category as name, COUNT(*) as testCount 
      FROM tests 
      WHERE category IS NOT NULL 
      GROUP BY category 
      ORDER BY testCount DESC
    `).all();

    res.json({
      success: true,
      categories
    });

  } catch (error) {
    logger.error('Failed to get test categories', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to get test categories',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * GET /api/tests/tags/list
 * Get list of available test tags for suite building
 */
router.get('/tags/list', asyncHandler(async (req, res) => {
  try {
    const db = getDatabase().db;
    const result = db.prepare(`
      SELECT tags FROM tests
      WHERE tags IS NOT NULL AND tags != ''
    `).all();

    const tagCounts: Record<string, number> = {};

    result.forEach((row: any) => {
      try {
        let tags: string[] = [];

        // Handle both JSON array format and comma-separated string format
        if (typeof row.tags === 'string') {
          if (row.tags.startsWith('[') && row.tags.endsWith(']')) {
            // JSON array format
            tags = JSON.parse(row.tags);
          } else {
            // Comma-separated string format
            tags = row.tags.split(',').map((tag: string) => tag.trim());
          }
        } else if (Array.isArray(row.tags)) {
          // Already an array
          tags = row.tags;
        }

        tags.forEach((tag: string) => {
          if (tag && tag.trim()) {
            const cleanTag = tag.trim();
            tagCounts[cleanTag] = (tagCounts[cleanTag] || 0) + 1;
          }
        });
      } catch (parseError) {
        logger.warn('Failed to parse tags for a test', { tags: row.tags, parseError });
      }
    });

    const tags = Object.entries(tagCounts)
      .map(([name, testCount]) => ({ name, testCount }))
      .sort((a, b) => b.testCount - a.testCount);

    res.json({
      success: true,
      tags
    });

  } catch (error) {
    logger.error('Failed to get test tags', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to get test tags',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * POST /api/tests/discover-smart
 * Smart manual test discovery with real-time progress and intelligent analysis
 */
router.post('/discover-smart', asyncHandler(async (req, res) => {
  try {
    const {
      force = false,
      categories = [],
      includeMetrics = true,
      analyzeComplexity = true,
      deepScan = false
    } = req.body;

    logger.info('Starting smart test discovery', {
      force, categories, includeMetrics, analyzeComplexity, deepScan
    });

    // Check if discovery is already in progress
    if (testDiscoveryService.isScanning && !force) {
      return res.status(409).json({
        success: false,
        message: 'Test discovery already in progress',
        inProgress: true,
        lastScanTime: testDiscoveryService.getLastScanTime()
      });
    }

    // Get pre-scan stats for comparison
    const beforeStats = await testDiscoveryService.getDiscoveryStats();
    const startTime = Date.now();

    // Perform intelligent discovery with progress tracking
    const discoveryResult = await testDiscoveryService.performFullScan();

    // Get post-scan stats
    const afterStats = await testDiscoveryService.getDiscoveryStats();
    const duration = Date.now() - startTime;

    // Calculate intelligent insights
    const insights = {
      newTests: afterStats.totalTests - beforeStats.totalTests,
      newCategories: Object.keys(afterStats.categories).length - Object.keys(beforeStats.categories).length,
      testComplexityDistribution: analyzeComplexity ? await calculateComplexityDistribution() : null,
      categoryGrowth: calculateCategoryGrowth(beforeStats.categories, afterStats.categories),
      discoveryEfficiency: {
        testsPerSecond: afterStats.totalTests / (duration / 1000),
        scanDuration: duration,
        filesScanned: afterStats.totalFiles
      }
    };

    // Smart recommendations based on findings
    const recommendations = generateSmartRecommendations(insights, afterStats);

    res.json({
      success: true,
      message: 'Smart test discovery completed successfully',
      stats: afterStats,
      insights,
      recommendations,
      performance: {
        duration,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date().toISOString(),
        testsDiscovered: insights.newTests,
        scanEfficiency: insights.discoveryEfficiency
      }
    });

  } catch (error) {
    logger.error('Smart test discovery failed', { error });
    res.status(500).json({
      success: false,
      message: 'Smart test discovery failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * GET /api/tests/discovery-status
 * Get real-time discovery status and progress
 */
router.get('/discovery-status', asyncHandler(async (req, res) => {
  try {
    const status = {
      isScanning: testDiscoveryService.isScanning,
      lastScanTime: testDiscoveryService.getLastScanTime(),
      autoDiscoveryActive: true, // Since we implemented auto discovery
      stats: await testDiscoveryService.getDiscoveryStats(),
      systemHealth: {
        databaseConnected: !!getDatabase(),
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
      }
    };

    res.json({
      success: true,
      status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get discovery status', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to get discovery status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

// Helper functions for smart analysis
async function calculateComplexityDistribution() {
  try {
    const db = getDatabase();
    if (!db || !db.db) return null;

    const complexityStats = (db as any).db.prepare(`
      SELECT complexity, COUNT(*) as count
      FROM tests
      WHERE is_active = 1
      GROUP BY complexity
    `).all();

    return complexityStats.reduce((acc: any, stat: any) => {
      acc[stat.complexity] = stat.count;
      return acc;
    }, {});
  } catch (error) {
    logger.warn('Failed to calculate complexity distribution', { error });
    return null;
  }
}

function calculateCategoryGrowth(before: Record<string, number>, after: Record<string, number>) {
  const growth: Record<string, { before: number; after: number; growth: number }> = {};

  const allCategories = new Set([...Object.keys(before), ...Object.keys(after)]);

  allCategories.forEach(category => {
    const beforeCount = before[category] || 0;
    const afterCount = after[category] || 0;
    growth[category] = {
      before: beforeCount,
      after: afterCount,
      growth: afterCount - beforeCount
    };
  });

  return growth;
}

function generateSmartRecommendations(insights: any, stats: any) {
  const recommendations = [];

  if (insights.newTests > 50) {
    recommendations.push({
      type: 'optimization',
      priority: 'medium',
      message: `Discovered ${insights.newTests} new tests. Consider organizing them into test suites for better management.`
    });
  }

  if (insights.discoveryEfficiency.testsPerSecond < 1) {
    recommendations.push({
      type: 'performance',
      priority: 'low',
      message: 'Discovery performance could be improved. Consider optimizing file scanning patterns.'
    });
  }

  if (stats.totalTests > 1000) {
    recommendations.push({
      type: 'maintenance',
      priority: 'high',
      message: 'Large test suite detected. Implement parallel execution and smart test selection strategies.'
    });
  }

  const topCategory = Object.entries(stats.categories)
    .sort(([,a], [,b]) => (b as number) - (a as number))[0];

  if (topCategory && topCategory[1] > stats.totalTests * 0.4) {
    recommendations.push({
      type: 'balance',
      priority: 'medium',
      message: `Category "${topCategory[0]}" contains ${Math.round((topCategory[1] as number / stats.totalTests) * 100)}% of tests. Consider better test distribution.`
    });
  }

  return recommendations;
}

export { router as testDiscoveryRouter };