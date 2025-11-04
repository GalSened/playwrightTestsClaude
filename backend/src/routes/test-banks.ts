/**
 * Test Banks API Routes
 * RESTful API for managing separate test banks (E2E, API, Load)
 */

import express, { Request, Response, NextFunction } from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import { logger } from '@/utils/logger';
import { getTestBankDiscoveryService, discoverAllTestBanks } from '@/services/TestBankDiscoveryService';

const router = express.Router();

// Database connection for test banks (separate from scheduler.db)
let testBanksDb: Database.Database | null = null;

function getTestBanksDb(): Database.Database {
  if (!testBanksDb) {
    const dbPath = path.join(process.cwd(), 'data', 'qa-intel.db');
    testBanksDb = new Database(dbPath);
    logger.info('Test Banks database connected', { dbPath });
  }
  return testBanksDb;
}

// ============================================================================
// Test Bank Management Routes
// ============================================================================

/**
 * GET /api/test-banks
 * List all test banks with statistics
 */
router.get('/test-banks', (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getTestBanksDb();

    const banks = db.prepare(`
      SELECT
        tb.*,
        (SELECT COUNT(*) FROM e2e_tests WHERE test_bank_id = tb.id AND status = 'active') as active_count,
        (SELECT COUNT(*) FROM e2e_tests WHERE test_bank_id = tb.id AND last_result = 'passed') as passed_count_e2e,
        (SELECT COUNT(*) FROM api_tests WHERE test_bank_id = tb.id AND status = 'active') as active_count_api,
        (SELECT COUNT(*) FROM api_tests WHERE test_bank_id = tb.id AND last_result = 'passed') as passed_count_api,
        (SELECT COUNT(*) FROM load_tests WHERE test_bank_id = tb.id AND status = 'active') as active_count_load,
        (SELECT COUNT(*) FROM load_tests WHERE test_bank_id = tb.id AND last_result = 'passed') as passed_count_load
      FROM test_banks tb
      ORDER BY
        CASE tb.id
          WHEN 'e2e' THEN 1
          WHEN 'api' THEN 2
          WHEN 'load' THEN 3
          ELSE 4
        END
    `).all();

    // Calculate aggregated stats for each bank
    const enrichedBanks = banks.map(bank => {
      let activeCount = 0;
      let passedCount = 0;

      if (bank.id === 'e2e') {
        activeCount = bank.active_count || 0;
        passedCount = bank.passed_count_e2e || 0;
      } else if (bank.id === 'api') {
        activeCount = bank.active_count_api || 0;
        passedCount = bank.passed_count_api || 0;
      } else if (bank.id === 'load') {
        activeCount = bank.active_count_load || 0;
        passedCount = bank.passed_count_load || 0;
      }

      const passRate = activeCount > 0 ? ((passedCount / activeCount) * 100).toFixed(1) : '0.0';

      return {
        ...bank,
        active_test_count: activeCount,
        passed_test_count: passedCount,
        pass_rate: parseFloat(passRate),
        metadata: bank.metadata ? JSON.parse(bank.metadata) : null
      };
    });

    res.json({
      success: true,
      data: enrichedBanks,
      count: enrichedBanks.length
    });

  } catch (error: any) {
    logger.error('Failed to fetch test banks', { error: error.message });
    next(error);
  }
});

/**
 * GET /api/test-banks/:id
 * Get specific test bank details with full statistics
 */
router.get('/test-banks/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const db = getTestBanksDb();

    const bank = db.prepare('SELECT * FROM test_banks WHERE id = ?').get(id);

    if (!bank) {
      return res.status(404).json({
        success: false,
        error: 'Test bank not found',
        bankId: id
      });
    }

    // Get detailed statistics based on bank type
    let stats: any = {};

    if (id === 'e2e') {
      stats = db.prepare(`
        SELECT
          COUNT(*) as total_tests,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_tests,
          SUM(CASE WHEN last_result = 'passed' THEN 1 ELSE 0 END) as passed_tests,
          SUM(CASE WHEN last_result = 'failed' THEN 1 ELSE 0 END) as failed_tests,
          SUM(CASE WHEN last_result = 'skipped' THEN 1 ELSE 0 END) as skipped_tests,
          SUM(CASE WHEN last_result = 'healed' THEN 1 ELSE 0 END) as healed_tests,
          ROUND(AVG(CASE WHEN last_result = 'passed' THEN 100.0 ELSE 0.0 END), 2) as pass_rate,
          ROUND(AVG(actual_duration), 0) as avg_duration,
          COUNT(DISTINCT category) as category_count
        FROM e2e_tests
      `).get();

      // Get category breakdown
      const categories = db.prepare(`
        SELECT
          category,
          COUNT(*) as count,
          SUM(CASE WHEN last_result = 'passed' THEN 1 ELSE 0 END) as passed,
          ROUND(AVG(CASE WHEN last_result = 'passed' THEN 100.0 ELSE 0.0 END), 1) as pass_rate
        FROM e2e_tests
        WHERE status = 'active'
        GROUP BY category
        ORDER BY count DESC
      `).all();

      stats.categories = categories;

    } else if (id === 'api') {
      stats = db.prepare(`
        SELECT
          COUNT(*) as total_tests,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_tests,
          SUM(CASE WHEN last_result = 'passed' THEN 1 ELSE 0 END) as passed_tests,
          SUM(CASE WHEN last_result = 'failed' THEN 1 ELSE 0 END) as failed_tests,
          SUM(CASE WHEN last_result = 'skipped' THEN 1 ELSE 0 END) as skipped_tests,
          ROUND(AVG(CASE WHEN last_result = 'passed' THEN 100.0 ELSE 0.0 END), 2) as pass_rate,
          ROUND(AVG(avg_response_time), 0) as avg_response_time,
          COUNT(DISTINCT module) as module_count
        FROM api_tests
      `).get();

      // Get module breakdown
      const modules = db.prepare(`
        SELECT
          module,
          COUNT(*) as count,
          SUM(CASE WHEN last_result = 'passed' THEN 1 ELSE 0 END) as passed,
          ROUND(AVG(avg_response_time), 0) as avg_response_time
        FROM api_tests
        WHERE status = 'active'
        GROUP BY module
        ORDER BY count DESC
      `).all();

      stats.modules = modules;

    } else if (id === 'load') {
      stats = db.prepare(`
        SELECT
          COUNT(*) as total_tests,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_tests,
          SUM(CASE WHEN last_result = 'passed' THEN 1 ELSE 0 END) as passed_tests,
          SUM(CASE WHEN last_result = 'failed' THEN 1 ELSE 0 END) as failed_tests,
          ROUND(AVG(CASE WHEN last_result = 'passed' THEN 100.0 ELSE 0.0 END), 2) as pass_rate,
          ROUND(AVG(p95_response_time), 0) as avg_p95_response_time,
          COUNT(DISTINCT scenario_type) as scenario_type_count
        FROM load_tests
      `).get();

      // Get scenario type breakdown
      const scenarios = db.prepare(`
        SELECT
          scenario_type,
          COUNT(*) as count,
          SUM(CASE WHEN last_result = 'passed' THEN 1 ELSE 0 END) as passed,
          ROUND(AVG(p95_response_time), 0) as avg_p95_response_time
        FROM load_tests
        WHERE status = 'active'
        GROUP BY scenario_type
        ORDER BY
          CASE scenario_type
            WHEN 'smoke' THEN 1
            WHEN 'load' THEN 2
            WHEN 'stress' THEN 3
            WHEN 'spike' THEN 4
            WHEN 'soak' THEN 5
            WHEN 'volume' THEN 6
            ELSE 7
          END
      `).all();

      stats.scenarios = scenarios;
    }

    res.json({
      success: true,
      data: {
        ...bank,
        statistics: stats,
        metadata: bank.metadata ? JSON.parse(bank.metadata) : null
      }
    });

  } catch (error: any) {
    logger.error('Failed to fetch test bank details', { error: error.message });
    next(error);
  }
});

/**
 * POST /api/test-banks/:id/discover
 * Trigger test discovery for specific bank or all banks
 */
router.post('/test-banks/:id/discover', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    logger.info(`🔍 Starting test discovery for bank: ${id}`);

    if (id === 'all') {
      // Discover all banks
      const result = await discoverAllTestBanks();

      res.json({
        success: true,
        message: 'Discovery completed for all test banks',
        data: result.summary
      });

    } else {
      // Discover specific bank
      const discoveryService = getTestBankDiscoveryService();

      let tests: any[] = [];
      let count = 0;

      if (id === 'e2e') {
        tests = await discoveryService['discoverE2ETests']();
        count = tests.length;
      } else if (id === 'api') {
        tests = await discoveryService['discoverAPITests']();
        count = tests.length;
      } else if (id === 'load') {
        tests = await discoveryService['discoverLoadTests']();
        count = tests.length;
      } else {
        return res.status(404).json({
          success: false,
          error: 'Invalid test bank ID',
          validIds: ['e2e', 'api', 'load', 'all']
        });
      }

      res.json({
        success: true,
        message: `Discovery completed for ${id} test bank`,
        data: {
          bank_id: id,
          tests_discovered: count,
          timestamp: new Date().toISOString()
        }
      });
    }

  } catch (error: any) {
    logger.error('Test discovery failed', { error: error.message });
    next(error);
  }
});

/**
 * GET /api/test-banks/:id/stats
 * Get detailed statistics for test bank
 */
router.get('/test-banks/:id/stats', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const db = getTestBanksDb();

    let stats: any = null;

    if (id === 'e2e') {
      stats = db.prepare('SELECT * FROM v_e2e_by_category').all();
    } else if (id === 'api') {
      stats = db.prepare('SELECT * FROM v_api_by_module').all();
    } else if (id === 'load') {
      stats = db.prepare('SELECT * FROM v_load_by_scenario').all();
    } else {
      return res.status(404).json({
        success: false,
        error: 'Invalid test bank ID'
      });
    }

    res.json({
      success: true,
      data: stats
    });

  } catch (error: any) {
    logger.error('Failed to fetch test bank stats', { error: error.message });
    next(error);
  }
});

// ============================================================================
// E2E Tests Routes
// ============================================================================

/**
 * GET /api/e2e-tests
 * List all E2E tests with optional filtering
 */
router.get('/e2e-tests', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, priority, status, limit = 100, offset = 0 } = req.query;
    const db = getTestBanksDb();

    let query = 'SELECT * FROM e2e_tests WHERE 1=1';
    const params: any[] = [];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    if (priority) {
      query += ' AND priority = ?';
      params.push(priority);
    }

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY category, priority DESC, test_name';
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit as string), parseInt(offset as string));

    const tests = db.prepare(query).all(...params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM e2e_tests WHERE 1=1';
    const countParams: any[] = [];

    if (category) {
      countQuery += ' AND category = ?';
      countParams.push(category);
    }
    if (priority) {
      countQuery += ' AND priority = ?';
      countParams.push(priority);
    }
    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }

    const { total } = db.prepare(countQuery).get(...countParams) as any;

    res.json({
      success: true,
      data: tests.map((t: any) => ({
        ...t,
        tags: t.tags ? JSON.parse(t.tags) : [],
        markers: t.markers ? JSON.parse(t.markers) : [],
        metadata: t.metadata ? JSON.parse(t.metadata) : null
      })),
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: parseInt(offset as string) + tests.length < total
      }
    });

  } catch (error: any) {
    logger.error('Failed to fetch E2E tests', { error: error.message });
    next(error);
  }
});

/**
 * GET /api/e2e-tests/category/:category
 * Get E2E tests by category
 */
router.get('/e2e-tests/category/:category', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category } = req.params;
    const db = getTestBanksDb();

    const tests = db.prepare(
      'SELECT * FROM e2e_tests WHERE category = ? AND status = ? ORDER BY priority DESC, test_name'
    ).all(category, 'active');

    res.json({
      success: true,
      data: tests,
      count: tests.length
    });

  } catch (error: any) {
    logger.error('Failed to fetch E2E tests by category', { error: error.message });
    next(error);
  }
});

// ============================================================================
// API Tests Routes
// ============================================================================

/**
 * GET /api/api-tests
 * List all API tests with optional filtering
 */
router.get('/api-tests', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { module, method, priority, status, limit = 100, offset = 0 } = req.query;
    const db = getTestBanksDb();

    let query = 'SELECT * FROM api_tests WHERE 1=1';
    const params: any[] = [];

    if (module) {
      query += ' AND module = ?';
      params.push(module);
    }

    if (method) {
      query += ' AND http_method = ?';
      params.push(method);
    }

    if (priority) {
      query += ' AND priority = ?';
      params.push(priority);
    }

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY module, http_method, test_name';
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit as string), parseInt(offset as string));

    const tests = db.prepare(query).all(...params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM api_tests WHERE 1=1';
    const countParams: any[] = [];

    if (module) {
      countQuery += ' AND module = ?';
      countParams.push(module);
    }
    if (method) {
      countQuery += ' AND http_method = ?';
      countParams.push(method);
    }
    if (priority) {
      countQuery += ' AND priority = ?';
      countParams.push(priority);
    }
    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }

    const { total } = db.prepare(countQuery).get(...countParams) as any;

    res.json({
      success: true,
      data: tests.map((t: any) => ({
        ...t,
        tags: t.tags ? JSON.parse(t.tags) : [],
        metadata: t.metadata ? JSON.parse(t.metadata) : null
      })),
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: parseInt(offset as string) + tests.length < total
      }
    });

  } catch (error: any) {
    logger.error('Failed to fetch API tests', { error: error.message });
    next(error);
  }
});

/**
 * GET /api/api-tests/module/:module
 * Get API tests by module
 */
router.get('/api-tests/module/:module', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { module } = req.params;
    const db = getTestBanksDb();

    const tests = db.prepare(
      'SELECT * FROM api_tests WHERE module = ? AND status = ? ORDER BY http_method, test_name'
    ).all(module, 'active');

    res.json({
      success: true,
      data: tests,
      count: tests.length
    });

  } catch (error: any) {
    logger.error('Failed to fetch API tests by module', { error: error.message });
    next(error);
  }
});

// ============================================================================
// Load Tests Routes
// ============================================================================

/**
 * GET /api/load-tests
 * List all load tests with optional filtering
 */
router.get('/load-tests', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { scenario_type, priority, status, limit = 50, offset = 0 } = req.query;
    const db = getTestBanksDb();

    let query = 'SELECT * FROM load_tests WHERE 1=1';
    const params: any[] = [];

    if (scenario_type) {
      query += ' AND scenario_type = ?';
      params.push(scenario_type);
    }

    if (priority) {
      query += ' AND priority = ?';
      params.push(priority);
    }

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY scenario_type, test_name';
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit as string), parseInt(offset as string));

    const tests = db.prepare(query).all(...params);

    const { total } = db.prepare('SELECT COUNT(*) as total FROM load_tests').get() as any;

    res.json({
      success: true,
      data: tests.map((t: any) => ({
        ...t,
        thresholds: t.thresholds ? JSON.parse(t.thresholds) : {},
        tags: t.tags ? JSON.parse(t.tags) : [],
        metadata: t.metadata ? JSON.parse(t.metadata) : null
      })),
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: parseInt(offset as string) + tests.length < total
      }
    });

  } catch (error: any) {
    logger.error('Failed to fetch load tests', { error: error.message });
    next(error);
  }
});

/**
 * GET /api/load-tests/type/:type
 * Get load tests by scenario type
 */
router.get('/load-tests/type/:type', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type } = req.params;
    const db = getTestBanksDb();

    const tests = db.prepare(
      'SELECT * FROM load_tests WHERE scenario_type = ? AND status = ? ORDER BY test_name'
    ).all(type, 'active');

    res.json({
      success: true,
      data: tests,
      count: tests.length
    });

  } catch (error: any) {
    logger.error('Failed to fetch load tests by type', { error: error.message });
    next(error);
  }
});

// ============================================================================
// Summary & Health Routes
// ============================================================================

/**
 * GET /api/test-banks/summary
 * Get summary of all test banks
 */
router.get('/test-banks/summary', (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getTestBanksDb();

    const summary = db.prepare('SELECT * FROM v_active_tests_summary').all();

    res.json({
      success: true,
      data: summary
    });

  } catch (error: any) {
    logger.error('Failed to fetch test banks summary', { error: error.message });
    next(error);
  }
});

export default router;
