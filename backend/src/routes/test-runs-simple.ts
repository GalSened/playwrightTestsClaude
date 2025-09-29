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
 * Get specific test run details
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Mock data for demo
  const testRun = {
    id,
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
  };

  const testCases = [
    {
      id: 'test-001',
      name: 'User Login Flow',
      status: 'passed',
      duration: 2500,
      file: 'auth.spec.ts'
    },
    {
      id: 'test-002',
      name: 'Dashboard Load Test',
      status: 'failed',
      duration: 8000,
      file: 'dashboard.spec.ts',
      error: 'Element not found: [data-testid="metrics-card"]'
    }
  ];

  res.json({ run: testRun, testCases });
}));

/**
 * POST /api/test-runs
 * Create new test run
 */
router.post('/', asyncHandler(async (req, res) => {
  const { name, environment = 'development' } = req.body;
  
  const newRun = {
    id: `run-${Date.now()}`,
    name,
    status: 'running',
    startTime: new Date().toISOString(),
    environment,
    totalTests: 0,
    passed: 0,
    failed: 0,
    skipped: 0
  };

  logger.info('New test run created', { runId: newRun.id, name });
  
  res.status(201).json({ run: newRun });
}));

/**
 * PUT /api/test-runs/:id
 * Update test run
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  logger.info('Test run updated', { runId: id, updates });
  
  const updatedRun = {
    id,
    ...updates,
    updatedAt: new Date().toISOString()
  };

  res.json({ run: updatedRun });
}));

/**
 * DELETE /api/test-runs/:id
 * Delete test run
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  logger.info('Test run deleted', { runId: id });
  
  res.status(204).send();
}));

/**
 * POST /api/test-runs/:testRunId/test-cases
 * Add test case result to run
 */
router.post('/:testRunId/test-cases', asyncHandler(async (req, res) => {
  const { testRunId } = req.params;
  const testCaseData = req.body;
  
  const testCase = {
    id: `test-${Date.now()}`,
    testRunId,
    ...testCaseData,
    timestamp: new Date().toISOString()
  };

  logger.info('Test case added to run', { testRunId, testCaseId: testCase.id });
  
  res.status(201).json({ testCase });
}));

/**
 * GET /api/test-runs/analytics/summary
 * Get analytics summary data
 */
router.get('/analytics/summary', asyncHandler(async (req, res) => {
  // Mock analytics data for demo
  const summary = {
    totalRuns: 156,
    successRate: 87.5,
    avgDuration: 285000,
    trendsLast30Days: {
      runs: [12, 8, 15, 11, 9, 13, 10, 7, 14, 12],
      successRates: [85, 88, 92, 87, 83, 89, 91, 86, 88, 87]
    },
    topFailingTests: [
      { name: 'Dashboard Load Test', failures: 14, successRate: 72 },
      { name: 'Payment Flow', failures: 8, successRate: 85 },
      { name: 'User Registration', failures: 6, successRate: 88 }
    ],
    environmentStats: {
      staging: { runs: 89, successRate: 89.2 },
      production: { runs: 67, successRate: 85.1 }
    }
  };

  res.json(summary);
}));

export { router as testRunsRouter };