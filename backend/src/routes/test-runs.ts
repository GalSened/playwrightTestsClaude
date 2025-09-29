/**
 * Test Runs API Routes
 * Simplified test run management with demo data
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/test-runs
 * Get list of test runs with optional filtering
 */
router.get('/', asyncHandler(async (req, res) => {
  // Mock data for demo - in real app would query database
  const testRuns = [
    {
      id: 'run-001',
      name: 'Smoke Tests',
      status: 'passed',
      startTime: '2025-08-28T10:00:00Z',
      endTime: '2025-08-28T10:05:30Z',
      duration: 330000,
      totalTests: 25,
      passed: 23,
      failed: 2,
      skipped: 0,
      environment: 'staging'
    },
    {
      id: 'run-002', 
      name: 'Regression Suite',
      status: 'failed',
      startTime: '2025-08-28T09:00:00Z',
      endTime: '2025-08-28T09:45:20Z',
      duration: 2720000,
      totalTests: 156,
      passed: 142,
      failed: 14,
      skipped: 0,
      environment: 'production'
    }
  ];

  res.json({ runs: testRuns, total: testRuns.length });
}));

/**
 * GET /api/test-runs/:id
 * Get specific test run with test cases
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { tenantId } = req.user;
  const { id } = req.params;

  try {
    // Get test run
    const run = await enterpriseDb.get(`
      SELECT 
        tr.*,
        u.name as user_name,
        u.email as user_email
      FROM test_runs tr
      LEFT JOIN users u ON tr.user_id = u.id
      WHERE tr.id = ? AND tr.tenant_id = ?
    `, [id, tenantId]);

    if (!run) {
      return res.status(404).json({
        error: 'Test run not found'
      });
    }

    // Get test cases for this run
    const testCases = await enterpriseDb.all(`
      SELECT * FROM test_cases 
      WHERE test_run_id = ? AND tenant_id = ?
      ORDER BY created_at ASC
    `, [id, tenantId]);

    // Parse JSON fields
    const processedRun = {
      ...run,
      metadata: run.metadata ? JSON.parse(run.metadata) : {},
      artifacts: run.artifacts ? JSON.parse(run.artifacts) : []
    };

    const processedTestCases = testCases.map(testCase => ({
      ...testCase,
      annotations: testCase.annotations ? JSON.parse(testCase.annotations) : [],
      steps: testCase.steps ? JSON.parse(testCase.steps) : [],
      attachments: testCase.attachments ? JSON.parse(testCase.attachments) : []
    }));

    res.json({
      run: processedRun,
      testCases: processedTestCases
    });

  } catch (error) {
    logger.error('Error fetching test run', { error, runId: id, tenantId });
    res.status(500).json({
      error: 'Failed to fetch test run'
    });
  }
}));

/**
 * POST /api/test-runs
 * Create a new test run
 */
router.post('/', asyncHandler(async (req, res) => {
  const { tenantId, userId } = req.user;
  const data = CreateTestRunSchema.parse(req.body);

  try {
    const testRun = {
      id: generateId(),
      tenant_id: tenantId,
      user_id: userId,
      project_name: data.project_name,
      branch: data.branch,
      commit_hash: data.commit_hash,
      status: 'running',
      total_tests: 0,
      passed_tests: 0,
      failed_tests: 0,
      skipped_tests: 0,
      duration_ms: 0,
      metadata: JSON.stringify(data.metadata),
      artifacts: JSON.stringify(data.artifacts),
      started_at: new Date().toISOString(),
      completed_at: null,
      created_at: new Date().toISOString()
    };

    await enterpriseDb.run(`
      INSERT INTO test_runs (
        id, tenant_id, user_id, project_name, branch, commit_hash, status,
        total_tests, passed_tests, failed_tests, skipped_tests, duration_ms,
        metadata, artifacts, started_at, completed_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      testRun.id, testRun.tenant_id, testRun.user_id, testRun.project_name,
      testRun.branch, testRun.commit_hash, testRun.status, testRun.total_tests,
      testRun.passed_tests, testRun.failed_tests, testRun.skipped_tests,
      testRun.duration_ms, testRun.metadata, testRun.artifacts,
      testRun.started_at, testRun.completed_at, testRun.created_at
    ]);

    // Emit real-time update
    const wsService = req.app.get('wsService');
    if (wsService) {
      wsService.emitTestRunCreated(tenantId, {
        ...testRun,
        metadata: data.metadata,
        artifacts: data.artifacts
      });
    }

    res.status(201).json({
      run: {
        ...testRun,
        metadata: data.metadata,
        artifacts: data.artifacts
      }
    });

  } catch (error) {
    logger.error('Error creating test run', { error, data, tenantId });
    res.status(500).json({
      error: 'Failed to create test run'
    });
  }
}));

/**
 * PUT /api/test-runs/:id
 * Update test run status and metrics
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const { tenantId } = req.user;
  const { id } = req.params;
  const updates = UpdateTestRunSchema.parse(req.body);

  try {
    // Verify test run exists and belongs to tenant
    const existingRun = await enterpriseDb.get(`
      SELECT * FROM test_runs WHERE id = ? AND tenant_id = ?
    `, [id, tenantId]);

    if (!existingRun) {
      return res.status(404).json({
        error: 'Test run not found'
      });
    }

    // Validate test count consistency
    if (updates.total_tests !== undefined) {
      const totalCalculated = (updates.passed_tests || 0) + 
                             (updates.failed_tests || 0) + 
                             (updates.skipped_tests || 0);
      
      if (totalCalculated > updates.total_tests) {
        return res.status(400).json({
          error: 'Sum of test results cannot exceed total tests'
        });
      }
    }

    // Build update query
    const updateFields = [];
    const params = [];

    if (updates.status !== undefined) {
      updateFields.push('status = ?');
      params.push(updates.status);
      
      // Set completed_at when status changes to non-running
      if (updates.status !== 'running') {
        updateFields.push('completed_at = ?');
        params.push(new Date().toISOString());
      }
    }

    if (updates.total_tests !== undefined) {
      updateFields.push('total_tests = ?');
      params.push(updates.total_tests);
    }

    if (updates.passed_tests !== undefined) {
      updateFields.push('passed_tests = ?');
      params.push(updates.passed_tests);
    }

    if (updates.failed_tests !== undefined) {
      updateFields.push('failed_tests = ?');
      params.push(updates.failed_tests);
    }

    if (updates.skipped_tests !== undefined) {
      updateFields.push('skipped_tests = ?');
      params.push(updates.skipped_tests);
    }

    if (updates.duration_ms !== undefined) {
      updateFields.push('duration_ms = ?');
      params.push(updates.duration_ms);
    }

    if (updates.metadata !== undefined) {
      updateFields.push('metadata = ?');
      params.push(JSON.stringify(updates.metadata));
    }

    if (updates.artifacts !== undefined) {
      updateFields.push('artifacts = ?');
      params.push(JSON.stringify(updates.artifacts));
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        error: 'No valid updates provided'
      });
    }

    // Execute update
    const query = `
      UPDATE test_runs 
      SET ${updateFields.join(', ')} 
      WHERE id = ? AND tenant_id = ?
    `;
    params.push(id, tenantId);

    await enterpriseDb.run(query, params);

    // Get updated run
    const updatedRun = await enterpriseDb.get(`
      SELECT * FROM test_runs WHERE id = ? AND tenant_id = ?
    `, [id, tenantId]);

    const processedRun = {
      ...updatedRun,
      metadata: updatedRun.metadata ? JSON.parse(updatedRun.metadata) : {},
      artifacts: updatedRun.artifacts ? JSON.parse(updatedRun.artifacts) : []
    };

    // Emit real-time update
    const wsService = req.app.get('wsService');
    if (wsService) {
      wsService.emitTestRunUpdated(tenantId, processedRun);
    }

    res.json({
      run: processedRun
    });

  } catch (error) {
    logger.error('Error updating test run', { error, runId: id, updates, tenantId });
    res.status(500).json({
      error: 'Failed to update test run'
    });
  }
}));

/**
 * DELETE /api/test-runs/:id
 * Delete test run (admin only)
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { tenantId, role } = req.user;
  const { id } = req.params;

  // Check admin permissions
  if (!['admin', 'owner'].includes(role)) {
    return res.status(403).json({
      error: 'Insufficient permissions'
    });
  }

  try {
    // Verify test run exists
    const existingRun = await enterpriseDb.get(`
      SELECT * FROM test_runs WHERE id = ? AND tenant_id = ?
    `, [id, tenantId]);

    if (!existingRun) {
      return res.status(404).json({
        error: 'Test run not found'
      });
    }

    // Delete test run (CASCADE will handle test_cases)
    await enterpriseDb.run(`
      DELETE FROM test_runs WHERE id = ? AND tenant_id = ?
    `, [id, tenantId]);

    // Emit real-time update
    const wsService = req.app.get('wsService');
    if (wsService) {
      wsService.emitTestRunDeleted(tenantId, id);
    }

    res.status(204).send();

  } catch (error) {
    logger.error('Error deleting test run', { error, runId: id, tenantId });
    res.status(500).json({
      error: 'Failed to delete test run'
    });
  }
}));

/**
 * POST /api/test-runs/:id/test-cases
 * Add test case to a test run
 */
router.post('/:id/test-cases', asyncHandler(async (req, res) => {
  const { tenantId } = req.user;
  const { id: testRunId } = req.params;
  const data = CreateTestCaseSchema.parse(req.body);

  try {
    // Verify test run exists
    const testRun = await enterpriseDb.get(`
      SELECT * FROM test_runs WHERE id = ? AND tenant_id = ?
    `, [testRunId, tenantId]);

    if (!testRun) {
      return res.status(404).json({
        error: 'Test run not found'
      });
    }

    const testCase = {
      id: generateId(),
      tenant_id: tenantId,
      test_run_id: testRunId,
      name: data.name,
      suite: data.suite,
      file_path: data.file_path,
      status: data.status,
      duration_ms: data.duration_ms,
      error_message: data.error_message,
      stack_trace: data.stack_trace,
      annotations: JSON.stringify(data.annotations),
      steps: JSON.stringify(data.steps),
      attachments: JSON.stringify(data.attachments),
      retry_count: data.retry_count,
      browser: data.browser,
      viewport: data.viewport,
      created_at: new Date().toISOString()
    };

    await enterpriseDb.run(`
      INSERT INTO test_cases (
        id, tenant_id, test_run_id, name, suite, file_path, status, duration_ms,
        error_message, stack_trace, annotations, steps, attachments, retry_count,
        browser, viewport, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      testCase.id, testCase.tenant_id, testCase.test_run_id, testCase.name,
      testCase.suite, testCase.file_path, testCase.status, testCase.duration_ms,
      testCase.error_message, testCase.stack_trace, testCase.annotations,
      testCase.steps, testCase.attachments, testCase.retry_count,
      testCase.browser, testCase.viewport, testCase.created_at
    ]);

    // Emit real-time update
    const processedTestCase = {
      ...testCase,
      annotations: data.annotations,
      steps: data.steps,
      attachments: data.attachments
    };

    const wsService = req.app.get('wsService');
    if (wsService) {
      wsService.emitTestCaseAdded(tenantId, testRunId, processedTestCase);
    }

    res.status(201).json({
      testCase: processedTestCase
    });

  } catch (error) {
    logger.error('Error creating test case', { error, data, testRunId, tenantId });
    res.status(500).json({
      error: 'Failed to create test case'
    });
  }
}));

/**
 * GET /api/test-runs/analytics/summary
 * Get analytics summary for tenant
 */
router.get('/analytics/summary', asyncHandler(async (req, res) => {
  const { tenantId } = req.user;
  const { from, to, project } = req.query;

  try {
    // Build date filter
    let dateFilter = '';
    const params = [tenantId];
    
    if (from) {
      dateFilter += ' AND created_at >= ?';
      params.push(from as string);
    }
    if (to) {
      dateFilter += ' AND created_at <= ?';
      params.push(to as string);
    }
    if (project) {
      dateFilter += ' AND project_name = ?';
      params.push(project as string);
    }

    // Get basic metrics
    const summary = await enterpriseDb.get(`
      SELECT 
        COUNT(*) as totalRuns,
        AVG(duration_ms) as averageDuration,
        COUNT(CASE WHEN status = 'passed' THEN 1 END) as passedRuns,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failedRuns,
        COUNT(CASE WHEN status = 'running' THEN 1 END) as runningRuns
      FROM test_runs 
      WHERE tenant_id = ? ${dateFilter}
    `, params);

    // Get status distribution
    const statusDistribution = await enterpriseDb.all(`
      SELECT status, COUNT(*) as count
      FROM test_runs 
      WHERE tenant_id = ? ${dateFilter}
      GROUP BY status
    `, params);

    // Get project breakdown
    const projectBreakdown = await enterpriseDb.all(`
      SELECT 
        project_name,
        COUNT(*) as runs,
        AVG(CASE WHEN total_tests > 0 THEN passed_tests * 100.0 / total_tests ELSE 0 END) as passRate
      FROM test_runs 
      WHERE tenant_id = ? ${dateFilter}
      GROUP BY project_name
      ORDER BY runs DESC
      LIMIT 10
    `, params);

    const passRate = summary.totalRuns > 0 ? 
      (summary.passedRuns / summary.totalRuns) * 100 : 0;

    const statusDist = statusDistribution.reduce((acc, item) => {
      acc[item.status] = item.count;
      return acc;
    }, {} as Record<string, number>);

    res.json({
      totalRuns: summary.totalRuns,
      passRate: Math.round(passRate * 100) / 100,
      averageDuration: Math.round(summary.averageDuration || 0),
      statusDistribution: statusDist,
      projectBreakdown: projectBreakdown.map(p => ({
        project: p.project_name,
        runs: p.runs,
        passRate: Math.round(p.passRate * 100) / 100
      }))
    });

  } catch (error) {
    logger.error('Error fetching analytics summary', { error, tenantId });
    res.status(500).json({
      error: 'Failed to fetch analytics summary'
    });
  }
}));

// Helper function to generate IDs
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export { router as testRunsRouter };