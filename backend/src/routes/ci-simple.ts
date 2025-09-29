/**
 * Simplified CI/CD API Routes
 * For testing purposes to fix import issues
 */

import express from 'express';

const router = express.Router();

// Test endpoint
router.get('/dashboard', (req, res) => {
  res.json({
    success: true,
    data: {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      activeRuns: 0,
      averageDuration: 0,
      successRate: 0,
      deploymentsToday: 0
    }
  });
});

router.get('/runs', (req, res) => {
  res.json({
    success: true,
    data: []
  });
});

router.get('/environments', (req, res) => {
  res.json({
    success: true,
    data: []
  });
});

export { router as ciRouter };