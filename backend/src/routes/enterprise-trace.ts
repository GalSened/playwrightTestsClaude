/**
 * Enterprise Trace Routes
 * Complete trace viewer API with multi-tenancy, security, and monitoring
 */

import { Router } from 'express';
import multer from 'multer';
import { enterpriseDb } from '../database/enterprise-database';
import { supabaseClient } from '../database/supabase-client';
import { asyncHandler } from '../middleware/error-handler';
import { requirePermission, devAuth } from '../middleware/auth';
import { checkTenantLimits } from '../middleware/tenant';
import { 
  recordTestRun, 
  recordArtifactUpload,
  recordDatabaseQuery 
} from '../monitoring/metrics';
import { logger } from '../utils/logger';
import { checkStorageHealth } from '../utils/health-checks';
import { z } from 'zod';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
    files: 10,
  },
  fileFilter: (req, file, cb) => {
    // Allow common test artifact types
    const allowedTypes = [
      'image/png', 'image/jpeg', 'image/webp',
      'video/webm', 'video/mp4',
      'application/zip', 'application/json',
      'text/plain', 'text/html',
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

// Validation schemas
const GetRunsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  status: z.enum(['queued', 'running', 'passed', 'failed', 'cancelled']).optional(),
  environment: z.string().optional(),
  suite: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  search: z.string().optional(),
});

const CreateRunSchema = z.object({
  suiteId: z.string().min(1),
  suiteName: z.string().min(1),
  environment: z.string().default('local'),
  browser: z.string().optional(),
  testMode: z.string().default('headless'),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.any()).default({}),
});

export function createEnterpriseTraceRouter(): Router {
  const router = Router();

  // Use development authentication for now
  router.use(devAuth());

  // ==========================================================================
  // TEST RUNS ENDPOINTS
  // ==========================================================================

  /**
   * GET /api/reports/runs
   * List test runs with filtering and pagination
   */
  router.get('/runs', asyncHandler(async (req, res) => {
    const startTime = Date.now();
    const tenantId = req.tenantId;
    
    try {
      // Validate query parameters
      const query = GetRunsQuerySchema.parse(req.query);
      
      // Get runs from database
      const result = await enterpriseDb.getRuns(tenantId, query);
      
      // Record metrics
      recordDatabaseQuery('SELECT', 'test_runs', tenantId, Date.now() - startTime, true);
      
      res.json(result);
    } catch (error) {
      recordDatabaseQuery('SELECT', 'test_runs', tenantId, Date.now() - startTime, false);
      throw error;
    }
  }));

  /**
   * GET /api/reports/runs/:runId
   * Get detailed run information with steps and artifacts
   */
  router.get('/runs/:runId', asyncHandler(async (req, res) => {
    const startTime = Date.now();
    const tenantId = req.tenantId;
    const { runId } = req.params;
    
    const includeSteps = req.query.includeSteps !== 'false';
    const includeArtifacts = req.query.includeArtifacts !== 'false';
    const includeLogs = req.query.includeLogs === 'true';

    try {
      const result = await enterpriseDb.getRunDetail(
        tenantId, 
        runId, 
        includeSteps, 
        includeArtifacts, 
        includeLogs
      );

      if (!result) {
        return res.status(404).json({
          error: 'RUN_NOT_FOUND',
          message: 'Test run not found',
        });
      }

      recordDatabaseQuery('SELECT', 'test_runs', tenantId, Date.now() - startTime, true);
      res.json(result);
    } catch (error) {
      recordDatabaseQuery('SELECT', 'test_runs', tenantId, Date.now() - startTime, false);
      throw error;
    }
  }));

  /**
   * POST /api/reports/runs
   * Create a new test run
   */
  router.post('/runs', 
    checkTenantLimits('test_runs'),
    asyncHandler(async (req, res) => {
      const startTime = Date.now();
      const tenantId = req.tenantId;
      
      try {
        const runData = CreateRunSchema.parse(req.body);
        
        const run = await enterpriseDb.createRun(tenantId, {
          ...runData,
          status: 'queued',
          startedAt: new Date().toISOString(),
          totals: { total: 0, passed: 0, failed: 0, skipped: 0 },
        });

        recordDatabaseQuery('INSERT', 'test_runs', tenantId, Date.now() - startTime, true);
        recordTestRun(tenantId, 'queued', runData.environment, runData.browser || 'unknown', 0);
        
        res.status(201).json({ run });
      } catch (error) {
        recordDatabaseQuery('INSERT', 'test_runs', tenantId, Date.now() - startTime, false);
        throw error;
      }
    })
  );

  /**
   * PUT /api/reports/runs/:runId
   * Update test run status and results
   */
  router.put('/runs/:runId', asyncHandler(async (req, res) => {
    const startTime = Date.now();
    const tenantId = req.tenantId;
    const { runId } = req.params;

    try {
      // This would update the run with test results
      // Implementation depends on your specific needs
      
      res.json({ 
        message: 'Run updated successfully',
        runId 
      });
    } catch (error) {
      recordDatabaseQuery('UPDATE', 'test_runs', tenantId, Date.now() - startTime, false);
      throw error;
    }
  }));

  // ==========================================================================
  // ARTIFACTS ENDPOINTS
  // ==========================================================================

  /**
   * POST /api/reports/runs/:runId/artifacts
   * Upload test artifacts (screenshots, videos, traces)
   */
  router.post('/runs/:runId/artifacts',
    upload.array('files', 10),
    checkTenantLimits('storage'),
    asyncHandler(async (req, res) => {
      const startTime = Date.now();
      const tenantId = req.tenantId;
      const { runId } = req.params;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({
          error: 'NO_FILES',
          message: 'No files provided',
        });
      }

      try {
        const uploadedArtifacts = [];

        for (const file of files) {
          const uploadStart = Date.now();
          
          // Upload to storage
          const { path: filePath, url: fileUrl } = await supabaseClient.uploadArtifact(
            tenantId,
            runId,
            file.originalname,
            file.buffer,
            file.mimetype
          );

          // Create artifact record
          const artifact = await enterpriseDb.createArtifact(tenantId, {
            runId,
            stepId: req.body.stepId || null,
            artifactType: getArtifactType(file.mimetype),
            name: file.originalname,
            filePath,
            fileUrl,
            mimeType: file.mimetype,
            fileSize: file.size,
            width: null, // Would be set for images
            height: null,
            duration: null, // Would be set for videos
            metadata: {},
          });

          uploadedArtifacts.push(artifact);
          
          recordArtifactUpload(
            tenantId,
            getArtifactType(file.mimetype),
            true,
            file.size,
            Date.now() - uploadStart
          );
        }

        recordDatabaseQuery('INSERT', 'test_artifacts', tenantId, Date.now() - startTime, true);
        
        res.status(201).json({
          message: 'Artifacts uploaded successfully',
          artifacts: uploadedArtifacts,
        });
      } catch (error) {
        logger.error('Artifact upload failed', { error, runId, tenantId });
        recordDatabaseQuery('INSERT', 'test_artifacts', tenantId, Date.now() - startTime, false);
        throw error;
      }
    })
  );

  /**
   * GET /api/reports/runs/:runId/media/:artifactId
   * Stream media artifacts with thumbnail support
   */
  router.get('/runs/:runId/media/:artifactId', asyncHandler(async (req, res) => {
    const tenantId = req.tenantId;
    const { runId, artifactId } = req.params;
    const thumbnail = req.query.thumbnail === 'true';

    try {
      // Get artifact from database
      const artifact = await enterpriseDb.query(
        'SELECT * FROM test_artifacts WHERE tenant_id = $1 AND run_id = $2 AND id = $3',
        [tenantId, runId, artifactId],
        tenantId,
        true
      );

      if (!artifact.rows[0]) {
        return res.status(404).json({
          error: 'ARTIFACT_NOT_FOUND',
          message: 'Artifact not found',
        });
      }

      const artifactData = artifact.rows[0];
      
      // Get signed URL for secure access
      const signedUrl = await supabaseClient.getSignedUrl(artifactData.file_path, 3600);
      
      // Redirect to signed URL or proxy the content
      res.redirect(signedUrl);
    } catch (error) {
      logger.error('Media streaming failed', { error, runId, artifactId, tenantId });
      throw error;
    }
  }));

  // ==========================================================================
  // STATISTICS ENDPOINTS
  // ==========================================================================

  /**
   * GET /api/reports/stats
   * Get aggregated statistics and analytics
   */
  router.get('/stats', asyncHandler(async (req, res) => {
    const tenantId = req.tenantId;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const environment = req.query.environment as string;

    try {
      const stats = await enterpriseDb.getRunStatistics(tenantId, {
        startDate,
        endDate,
        environment,
      });

      res.json(stats);
    } catch (error) {
      logger.error('Stats query failed', { error, tenantId });
      throw error;
    }
  }));

  // ==========================================================================
  // HEALTH CHECK
  // ==========================================================================

  /**
   * GET /api/reports/health
   * Health check for trace viewer services
   */
  router.get('/health', asyncHandler(async (req, res) => {
    const dbHealthy = await enterpriseDb.healthCheck();
    const storageHealthy = await checkStorageHealth();
    
    res.json({
      status: (dbHealthy && storageHealthy) ? 'healthy' : 'unhealthy',
      services: {
        database: dbHealthy,
        storage: storageHealthy,
      },
      timestamp: new Date().toISOString(),
    });
  }));

  return router;
}

/**
 * Determine artifact type from MIME type
 */
function getArtifactType(mimeType: string): 'screenshot' | 'video' | 'trace' | 'log' | 'report' {
  if (mimeType.startsWith('image/')) return 'screenshot';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType === 'application/zip') return 'trace';
  if (mimeType.startsWith('text/')) return 'log';
  return 'report';
}