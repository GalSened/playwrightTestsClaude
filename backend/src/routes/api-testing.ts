/**
 * API Testing Routes using Newman
 * Integrated with the existing QA Intelligence platform
 */

import express from 'express';
import multer from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '@/utils/logger';
import { newmanExecutor } from '@/services/newman/newmanExecutor';
import { NewmanTestConfig } from '@/services/newman/types';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/newman/',
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only JSON files
    if (file.mimetype === 'application/json' || file.originalname.endsWith('.json')) {
      cb(null, true);
    } else {
      cb(new Error('Only JSON files are allowed'));
    }
  }
});

// Get all collections
router.get('/collections', async (req, res) => {
  try {
    const collections = await newmanExecutor.getCollections();
    res.json({
      success: true,
      data: collections
    });
  } catch (error: any) {
    logger.error('Failed to get collections:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve collections'
    });
  }
});

// Upload and save a collection
router.post('/collections', upload.single('collection'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No collection file provided'
      });
    }

    const { name } = req.body;
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Collection name is required'
      });
    }

    // Read and parse the uploaded collection
    const collectionData = JSON.parse(fs.readFileSync(req.file.path, 'utf-8'));

    // Save the collection
    const collectionInfo = await newmanExecutor.saveCollection(name, collectionData);

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.status(201).json({
      success: true,
      data: collectionInfo
    });
  } catch (error: any) {
    logger.error('Failed to save collection:', error);

    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to save collection'
    });
  }
});

// Delete a collection
router.delete('/collections/:collectionId', async (req, res) => {
  try {
    const { collectionId } = req.params;
    const collectionPath = path.resolve(__dirname, '../../data/newman/collections', `${collectionId}.json`);

    if (!fs.existsSync(collectionPath)) {
      return res.status(404).json({
        success: false,
        error: 'Collection not found'
      });
    }

    fs.unlinkSync(collectionPath);

    res.json({
      success: true,
      message: 'Collection deleted successfully'
    });
  } catch (error: any) {
    logger.error('Failed to delete collection:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete collection'
    });
  }
});

// Execute a collection
router.post('/execute', async (req, res) => {
  try {
    const config: NewmanTestConfig = req.body;

    // Validate required fields
    if (!config.collection) {
      return res.status(400).json({
        success: false,
        error: 'Collection is required'
      });
    }

    // Set default reporters if not provided
    if (!config.reporters || config.reporters.length === 0) {
      config.reporters = ['cli', 'json', 'html'];
      config.reporterOptions = {
        json: { export: '' }, // Will be set by NewmanExecutor
        html: { export: '' }  // Will be set by NewmanExecutor
      };
    }

    // Execute the collection
    const runId = await newmanExecutor.executeCollection(config);

    res.status(201).json({
      success: true,
      data: {
        runId,
        status: 'started',
        message: 'API test execution started'
      }
    });
  } catch (error: any) {
    logger.error('Failed to execute collection:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to execute collection'
    });
  }
});

// Get test run status and results
router.get('/runs/:runId', async (req, res) => {
  try {
    const { runId } = req.params;
    const result = await newmanExecutor.getTestResult(runId);

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
      const runningTests = await newmanExecutor.getAllRunningTests();
      res.json({
        success: true,
        data: runningTests
      });
    } else {
      // For now, return running tests. In a full implementation,
      // this would fetch from database with pagination and filters
      const runningTests = await newmanExecutor.getAllRunningTests();
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
    const cancelled = await newmanExecutor.cancelTest(runId);

    if (!cancelled) {
      return res.status(404).json({
        success: false,
        error: 'Test run not found or cannot be cancelled'
      });
    }

    res.json({
      success: true,
      message: 'Test run cancelled successfully'
    });
  } catch (error: any) {
    logger.error('Failed to cancel test run:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel test run'
    });
  }
});

// Get test report
router.get('/runs/:runId/reports/:format', async (req, res) => {
  try {
    const { runId, format } = req.params;

    if (format !== 'json' && format !== 'html') {
      return res.status(400).json({
        success: false,
        error: 'Invalid report format. Use "json" or "html"'
      });
    }

    const report = await newmanExecutor.getReport(runId, format as 'json' | 'html');

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found or test still running'
      });
    }

    if (format === 'html') {
      res.setHeader('Content-Type', 'text/html');
      res.send(report);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.send(report);
    }
  } catch (error: any) {
    logger.error('Failed to get test report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve test report'
    });
  }
});

// API Testing Dashboard - Summary statistics
router.get('/dashboard', async (req, res) => {
  try {
    const runningTests = await newmanExecutor.getAllRunningTests();

    // In a full implementation, these would be calculated from database
    // For now, return basic statistics from running tests
    const totalRuns = runningTests.length;
    const activeRuns = runningTests.filter(r => r.status === 'running').length;

    res.json({
      success: true,
      data: {
        totalCollections: (await newmanExecutor.getCollections()).length,
        totalRuns,
        activeRuns,
        completedRuns: 0, // Would be calculated from database
        failedRuns: 0,    // Would be calculated from database
        averageResponseTime: 0, // Would be calculated from completed runs
        successRate: 100, // Would be calculated from completed runs
        apiTestsToday: totalRuns
      }
    });
  } catch (error: any) {
    logger.error('Failed to get API testing dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve dashboard data'
    });
  }
});

// Environment management
router.post('/environments', upload.single('environment'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No environment file provided'
      });
    }

    const { name } = req.body;
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Environment name is required'
      });
    }

    // Read and parse the uploaded environment
    const environmentData = JSON.parse(fs.readFileSync(req.file.path, 'utf-8'));

    // Save environment to the environments directory
    const envId = Date.now().toString();
    const envPath = path.resolve(__dirname, '../../data/newman/environments', `${envId}.json`);

    // Ensure directory exists
    const envDir = path.dirname(envPath);
    if (!fs.existsSync(envDir)) {
      fs.mkdirSync(envDir, { recursive: true });
    }

    fs.writeFileSync(envPath, JSON.stringify(environmentData, null, 2));

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    const environmentInfo = {
      id: envId,
      name,
      values: environmentData.values || [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    res.status(201).json({
      success: true,
      data: environmentInfo
    });
  } catch (error: any) {
    logger.error('Failed to save environment:', error);

    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to save environment'
    });
  }
});

// Get environments
router.get('/environments', async (req, res) => {
  try {
    const environments: any[] = [];
    const envDir = path.resolve(__dirname, '../../data/newman/environments');

    if (fs.existsSync(envDir)) {
      const files = fs.readdirSync(envDir).filter(file => file.endsWith('.json'));

      for (const file of files) {
        try {
          const envPath = path.join(envDir, file);
          const envData = JSON.parse(fs.readFileSync(envPath, 'utf-8'));
          const stats = fs.statSync(envPath);

          environments.push({
            id: path.basename(file, '.json'),
            name: envData.name || file,
            values: envData.values || [],
            createdAt: stats.birthtime,
            updatedAt: stats.mtime
          });
        } catch (error) {
          logger.warn(`Failed to parse environment file ${file}:`, error);
        }
      }
    }

    res.json({
      success: true,
      data: environments
    });
  } catch (error: any) {
    logger.error('Failed to get environments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve environments'
    });
  }
});

// Health check for Newman
router.get('/health', async (req, res) => {
  try {
    // Test Newman installation
    const { spawn } = require('child_process');
    const newman = spawn('newman', ['--version']);

    newman.on('close', (code: number) => {
      if (code === 0) {
        res.json({
          success: true,
          status: 'healthy',
          newman: 'installed',
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(500).json({
          success: false,
          status: 'unhealthy',
          error: 'Newman not properly installed',
          timestamp: new Date().toISOString()
        });
      }
    });

    newman.on('error', () => {
      res.status(500).json({
        success: false,
        status: 'unhealthy',
        error: 'Newman not found',
        timestamp: new Date().toISOString()
      });
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

export { router as apiTestingRouter };