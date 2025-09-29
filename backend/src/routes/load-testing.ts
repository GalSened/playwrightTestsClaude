/**
 * Load Testing Routes using k6
 * Integrated with the existing QA Intelligence platform
 */

import express from 'express';
import multer from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '@/utils/logger';
import { k6Executor } from '@/services/k6/k6Executor';
import { K6TestConfig } from '@/services/k6/types';

const router = express.Router();

// Configure multer for script uploads
const upload = multer({
  dest: 'uploads/k6/',
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit for scripts
  },
  fileFilter: (req, file, cb) => {
    // Accept JavaScript files and JSON files
    if (file.mimetype === 'application/javascript' ||
        file.mimetype === 'text/javascript' ||
        file.originalname.endsWith('.js') ||
        file.originalname.endsWith('.json')) {
      cb(null, true);
    } else {
      cb(new Error('Only JavaScript (.js) and JSON (.json) files are allowed'));
    }
  }
});

// Get all saved scripts
router.get('/scripts', async (req, res) => {
  try {
    const scripts = k6Executor.getScripts();
    res.json({
      success: true,
      data: scripts
    });
  } catch (error: any) {
    logger.error('Failed to get load test scripts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve scripts'
    });
  }
});

// Upload and save a load test script
router.post('/scripts', upload.single('script'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No script file provided'
      });
    }

    const { name, description, tags } = req.body;
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Script name is required'
      });
    }

    // Read the uploaded script content
    const scriptContent = fs.readFileSync(req.file.path, 'utf-8');

    // Parse tags if provided
    let parsedTags: string[] = [];
    if (tags) {
      try {
        parsedTags = Array.isArray(tags) ? tags : JSON.parse(tags);
      } catch {
        parsedTags = tags.split(',').map((tag: string) => tag.trim());
      }
    }

    // Save the script
    const scriptInfo = await k6Executor.saveScript({
      name,
      description: description || '',
      content: scriptContent,
      tags: parsedTags,
      createdBy: 'system' // In a real app, this would be the authenticated user
    });

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.status(201).json({
      success: true,
      data: scriptInfo
    });
  } catch (error: any) {
    logger.error('Failed to save load test script:', error);

    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to save script'
    });
  }
});

// Get script templates
router.get('/templates', async (req, res) => {
  try {
    const templates = k6Executor.getTemplates();
    res.json({
      success: true,
      data: templates
    });
  } catch (error: any) {
    logger.error('Failed to get script templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve templates'
    });
  }
});

// Get predefined load test scenarios
router.get('/scenarios', async (req, res) => {
  try {
    const scenarios = k6Executor.getScenarios();
    res.json({
      success: true,
      data: scenarios
    });
  } catch (error: any) {
    logger.error('Failed to get load test scenarios:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve scenarios'
    });
  }
});

// Execute a load test
router.post('/execute', async (req, res) => {
  try {
    const config: K6TestConfig = req.body;

    // Validate required fields
    if (!config.script && !config.scriptPath) {
      return res.status(400).json({
        success: false,
        error: 'Either script content or scriptPath is required'
      });
    }

    // Set default options if not provided
    if (!config.options) {
      config.options = {
        vus: 10,
        duration: '30s',
        thresholds: {
          'http_req_duration': ['p(95)<500'],
          'http_req_failed': ['rate<0.1']
        }
      };
    }

    // Execute the load test
    const runId = await k6Executor.executeLoadTest(config);

    res.status(201).json({
      success: true,
      data: {
        runId,
        status: 'started',
        message: 'Load test execution started'
      }
    });
  } catch (error: any) {
    logger.error('Failed to execute load test:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to execute load test'
    });
  }
});

// Get test run status and results
router.get('/runs/:runId', async (req, res) => {
  try {
    const { runId } = req.params;
    const result = k6Executor.getTestResult(runId);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Test run not found'
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    logger.error('Failed to get test run:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve test run'
    });
  }
});

// Get all running tests
router.get('/runs', async (req, res) => {
  try {
    const { status } = req.query;

    if (status === 'running') {
      const runningTests = k6Executor.getAllRunningTests();
      res.json({
        success: true,
        data: runningTests
      });
    } else {
      // For now, return running tests. In a full implementation,
      // this would fetch from database with pagination and filters
      const runningTests = k6Executor.getAllRunningTests();
      res.json({
        success: true,
        data: runningTests,
        pagination: {
          total: runningTests.length,
          limit: 20,
          offset: 0,
          hasMore: false
        }
      });
    }
  } catch (error: any) {
    logger.error('Failed to get test runs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve test runs'
    });
  }
});

// Cancel a test run
router.post('/runs/:runId/cancel', async (req, res) => {
  try {
    const { runId } = req.params;
    const cancelled = await k6Executor.cancelTest(runId);

    if (!cancelled) {
      return res.status(404).json({
        success: false,
        error: 'Test run not found or cannot be cancelled'
      });
    }

    res.json({
      success: true,
      message: 'Load test cancelled successfully'
    });
  } catch (error: any) {
    logger.error('Failed to cancel test run:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel test run'
    });
  }
});

// Get test results file
router.get('/runs/:runId/results', async (req, res) => {
  try {
    const { runId } = req.params;
    const { format = 'json' } = req.query;

    const result = k6Executor.getTestResult(runId);
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Test run not found'
      });
    }

    if (result.status === 'running' || result.status === 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Test is still running, results not available yet'
      });
    }

    let filePath: string | undefined;
    let contentType: string;

    if (format === 'json' && result.resultsPath) {
      filePath = result.resultsPath;
      contentType = 'application/json';
    } else if (format === 'summary' && result.outputPath) {
      filePath = result.outputPath;
      contentType = 'application/json';
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid format. Use "json" or "summary"'
      });
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'Results file not found'
      });
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${runId}-${format}.json"`);
    res.sendFile(path.resolve(filePath));

  } catch (error: any) {
    logger.error('Failed to get test results:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve test results'
    });
  }
});

// Load Testing Dashboard - Summary statistics
router.get('/dashboard', async (req, res) => {
  try {
    const runningTests = k6Executor.getAllRunningTests();

    // In a full implementation, these would be calculated from database
    // For now, return basic statistics from running tests
    const totalRuns = runningTests.length;
    const activeRuns = runningTests.filter(r => r.status === 'running').length;

    // Calculate some basic metrics from running tests
    let avgDuration = 0;
    let totalVUs = 0;
    if (runningTests.length > 0) {
      totalVUs = runningTests.reduce((sum, test) => sum + (test.metrics?.vus || 0), 0);
      const completedTests = runningTests.filter(t => t.status === 'completed' && t.duration);
      if (completedTests.length > 0) {
        avgDuration = completedTests.reduce((sum, test) => sum + (test.duration || 0), 0) / completedTests.length;
      }
    }

    res.json({
      success: true,
      data: {
        totalScripts: k6Executor.getScripts().length,
        totalRuns,
        activeRuns,
        completedRuns: 0, // Would be calculated from database
        failedRuns: 0,    // Would be calculated from database
        averageDuration: Math.round(avgDuration / 1000), // Convert to seconds
        currentVUs: totalVUs,
        loadTestsToday: totalRuns,
        templates: k6Executor.getTemplates().length,
        scenarios: k6Executor.getScenarios().length
      }
    });
  } catch (error: any) {
    logger.error('Failed to get load testing dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve dashboard data'
    });
  }
});

// Quick test endpoint for simple load tests
router.post('/quick-test', async (req, res) => {
  try {
    const { url, vus = 5, duration = '30s', name = 'Quick Load Test' } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Target URL is required'
      });
    }

    // Create a simple k6 script for the URL
    const script = `
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  vus: ${vus},
  duration: '${duration}',
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.1'],
  },
};

export default function() {
  let response = http.get('${url}');
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 1s': (r) => r.timings.duration < 1000,
  });
  sleep(1);
}
    `.trim();

    const config: K6TestConfig = {
      script,
      name,
      description: `Quick load test for ${url}`,
      options: {
        vus: parseInt(vus.toString()),
        duration,
        thresholds: {
          'http_req_duration': ['p(95)<1000'],
          'http_req_failed': ['rate<0.1']
        }
      },
      tags: {
        type: 'quick-test',
        url: new URL(url).hostname
      }
    };

    const runId = await k6Executor.executeLoadTest(config);

    res.status(201).json({
      success: true,
      data: {
        runId,
        config,
        status: 'started',
        message: `Quick load test started for ${url}`
      }
    });

  } catch (error: any) {
    logger.error('Failed to execute quick test:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to execute quick test'
    });
  }
});

// Health check for k6
router.get('/health', async (req, res) => {
  try {
    const healthCheck = await k6Executor.healthCheck();

    if (healthCheck.healthy) {
      res.json({
        success: true,
        status: 'healthy',
        k6: 'installed',
        version: healthCheck.version,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        status: 'unhealthy',
        error: healthCheck.error,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// WebSocket endpoint for real-time metrics (route info)
router.get('/ws-info', (req, res) => {
  res.json({
    success: true,
    data: {
      wsEndpoint: '/ws/load-testing',
      events: [
        'testStarted',
        'testProgress',
        'testMetrics',
        'testCompleted',
        'testFailed',
        'testCancelled'
      ],
      message: 'Connect to WebSocket endpoint for real-time load test updates'
    }
  });
});

export { router as loadTestingRouter };