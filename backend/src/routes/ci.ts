/**
 * CI/CD API Routes
 * Comprehensive REST API for CI/CD pipeline management
 * Integrates with existing QA Intelligence backend patterns
 */

import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import {
  CreateCIRunRequest,
  UpdateCIRunRequest,
  CreateCIRunSchema,
  UpdateCIRunSchema,
  CIRunDetails,
  CIRunSummary,
  CIDashboardStats,
  CIMetrics,
  CIError,
  CIValidationError,
  CIExecutionError,
  CIRunStatusType,
  CIEnvironmentType
} from '../models/CI';
import { CIOrchestrator } from '../services/CIOrchestrator';
import { JenkinsClient } from '../integrations/JenkinsClient';
import { eventBus } from '../core/wesign/EventBus';
import { logger } from '../utils/logger';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '@/middleware/asyncHandler';

const router = express.Router();
const ciOrchestrator = new CIOrchestrator();
const jenkinsClient = new JenkinsClient();

// ===============================
// MIDDLEWARE
// ===============================

interface CIAuthRequest extends AuthRequest {
  runId?: string;
}

/**
 * Validation middleware for request bodies
 */
const validateRequest = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: express.NextFunction) => {
    try {
      const validatedData = schema.parse(req.body);
      req.body = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid request data',
          details: error.errors
        });
      } else {
        next(error);
      }
    }
  };
};

/**
 * CI Run access control middleware
 */
const checkRunAccess = asyncHandler(async (req: CIAuthRequest, res: Response, next: express.NextFunction) => {
  const runId = req.params.id || req.runId;
  if (!runId) {
    return res.status(400).json({ error: 'Run ID is required' });
  }

  try {
    const run = await ciOrchestrator.getCIRun(runId);
    if (!run) {
      return res.status(404).json({ error: 'CI run not found' });
    }

    // Check tenant access
    if (run.tenantId && run.tenantId !== req.tenantId) {
      return res.status(403).json({ error: 'Access denied to CI run' });
    }

    req.runId = runId;
    next();
  } catch (error) {
    logger.error('Error checking CI run access', { error, runId, userId: req.userId });
    res.status(500).json({ error: 'Failed to verify run access' });
  }
});

// ===============================
// CI RUNS ENDPOINTS
// ===============================

/**
 * POST /api/ci/runs
 * Create a new CI/CD deployment run
 */
router.post('/runs',
  auth,
  validateRequest(CreateCIRunSchema),
  asyncHandler(async (req: AuthRequest, res: Response, next: express.NextFunction) => {
    const createRequest: CreateCIRunRequest = req.body;

    try {
      logger.info('Creating new CI run', {
        request: createRequest,
        userId: req.userId,
        tenantId: req.tenantId
      });

      const runId = uuidv4();
      const run = await ciOrchestrator.createCIRun({
        ...createRequest,
        runId,
        createdBy: req.userId,
        tenantId: req.tenantId
      });

      // Publish creation event
      await eventBus.createAndPublish('ci_run', 'ci-api', {
        runId: run.runId,
        action: 'created',
        status: run.status,
        environment: run.environment,
        branch: run.branch,
        createdBy: req.userId
      });

      logger.info('CI run created successfully', {
        runId: run.runId,
        userId: req.userId
      });

      res.status(201).json({
        success: true,
        message: 'CI run created successfully',
        data: run
      });

    } catch (error) {
      logger.error('Failed to create CI run', { error, request: createRequest, userId: req.userId });

      if (error instanceof CIValidationError) {
        res.status(400).json({
          error: 'Validation Error',
          message: error.message,
          details: error.details
        });
      } else if (error instanceof CIExecutionError) {
        res.status(500).json({
          error: 'Execution Error',
          message: error.message
        });
      } else {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to create CI run'
        });
      }
    }
  }));

/**
 * GET /api/ci/runs/:id
 * Get CI run status and details
 */
router.get('/runs/:id',
  auth,
  checkRunAccess,
  asyncHandler(async (req: CIAuthRequest, res: Response) => {
    try {
      const runDetails = await ciOrchestrator.getCIRunDetails(req.runId!);

      if (!runDetails) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'CI run not found'
        });
      }

      res.json({
        success: true,
        data: runDetails
      });

    } catch (error) {
      logger.error('Failed to get CI run details', { error, runId: req.runId, userId: req.userId });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve CI run details'
      });
    }
  })
);

/**
 * PUT /api/ci/runs/:id
 * Update CI run status and details
 */
router.put('/runs/:id',
  auth,
  checkRunAccess,
  validateRequest(UpdateCIRunSchema),
  asyncHandler(async (req: CIAuthRequest, res: Response) => {
    const updateRequest: UpdateCIRunRequest = req.body;

    try {
      const updatedRun = await ciOrchestrator.updateCIRun(req.runId!, updateRequest);

      // Publish update event
      await eventBus.createAndPublish('ci_run', 'ci-api', {
        runId: req.runId!,
        action: 'updated',
        status: updatedRun.status,
        updatedBy: req.userId,
        changes: updateRequest
      });

      res.json({
        success: true,
        message: 'CI run updated successfully',
        data: updatedRun
      });

    } catch (error) {
      logger.error('Failed to update CI run', { error, runId: req.runId, updateRequest, userId: req.userId });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to update CI run'
      });
    }
  })
);

/**
 * GET /api/ci/runs
 * List all CI runs with filtering and pagination
 */
router.get('/runs',
  auth,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const {
        page = '1',
        limit = '20',
        status,
        environment,
        branch,
        from,
        to
      } = req.query;

      const filters = {
        status: status as CIRunStatusType,
        environment: environment as CIEnvironmentType,
        branch: branch as string,
        from: from as string,
        to: to as string,
        tenantId: req.tenantId
      };

      const pagination = {
        page: parseInt(page as string, 10),
        limit: Math.min(parseInt(limit as string, 10), 100) // Max 100 per page
      };

      const result = await ciOrchestrator.getCIRuns(filters, pagination);

      res.json({
        success: true,
        data: result.runs,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / pagination.limit)
        }
      });

    } catch (error) {
      logger.error('Failed to get CI runs', { error, userId: req.userId });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve CI runs'
      });
    }
  })
);

/**
 * POST /api/ci/runs/:id/start
 * Start a CI run execution
 */
router.post('/runs/:id/start',
  auth,
  checkRunAccess,
  asyncHandler(async (req: CIAuthRequest, res: Response) => {
    try {
      const run = await ciOrchestrator.startCIRun(req.runId!, req.userId!);

      // Publish start event
      await eventBus.createAndPublish('ci_run', 'ci-api', {
        runId: req.runId!,
        action: 'started',
        status: run.status,
        environment: run.environment,
        startedBy: req.userId
      });

      res.json({
        success: true,
        message: 'CI run started successfully',
        data: run
      });

    } catch (error) {
      logger.error('Failed to start CI run', { error, runId: req.runId, userId: req.userId });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to start CI run'
      });
    }
  })
);

/**
 * POST /api/ci/runs/:id/cancel
 * Cancel a running CI run
 */
router.post('/runs/:id/cancel',
  auth,
  checkRunAccess,
  asyncHandler(async (req: CIAuthRequest, res: Response) => {
    try {
      const run = await ciOrchestrator.cancelCIRun(req.runId!, req.userId!);

      // Publish cancellation event
      await eventBus.createAndPublish('ci_run', 'ci-api', {
        runId: req.runId!,
        action: 'cancelled',
        status: run.status,
        cancelledBy: req.userId
      });

      res.json({
        success: true,
        message: 'CI run cancelled successfully',
        data: run
      });

    } catch (error) {
      logger.error('Failed to cancel CI run', { error, runId: req.runId, userId: req.userId });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to cancel CI run'
      });
    }
  })
);

/**
 * POST /api/ci/runs/:id/rollback
 * Trigger rollback for a deployment
 */
router.post('/runs/:id/rollback',
  auth,
  checkRunAccess,
  asyncHandler(async (req: CIAuthRequest, res: Response) => {
    try {
      const {
        rollbackToVersion,
        rollbackToCommit,
        reason
      } = req.body;

      const rollback = await ciOrchestrator.initializeRollback(req.runId!, {
        rollbackToVersion,
        rollbackToCommit,
        reason,
        initiatedBy: req.userId!
      });

      // Publish rollback event
      await eventBus.createAndPublish('ci_rollback', 'ci-api', {
        originalRunId: req.runId!,
        rollbackId: rollback.rollbackId,
        action: 'initiated',
        reason,
        initiatedBy: req.userId
      });

      res.json({
        success: true,
        message: 'Rollback initiated successfully',
        data: rollback
      });

    } catch (error) {
      logger.error('Failed to initiate rollback', { error, runId: req.runId, userId: req.userId });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to initiate rollback'
      });
    }
  })
);

// ===============================
// CI STAGES ENDPOINTS
// ===============================

/**
 * GET /api/ci/runs/:id/stages
 * Get stages for a CI run
 */
router.get('/runs/:id/stages',
  auth,
  checkRunAccess,
  asyncHandler(async (req: CIAuthRequest, res: Response) => {
    try {
      const stages = await ciOrchestrator.getCIStages(req.runId!);

      res.json({
        success: true,
        data: stages
      });

    } catch (error) {
      logger.error('Failed to get CI stages', { error, runId: req.runId, userId: req.userId });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve CI stages'
      });
    }
  })
);

/**
 * GET /api/ci/stages/:stageId/logs
 * Get logs for a specific stage
 */
router.get('/stages/:stageId/logs',
  auth,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { stageId } = req.params;
      const { lines = '100', follow = 'false' } = req.query;

      const logs = await ciOrchestrator.getStageLogs(stageId, {
        lines: parseInt(lines as string, 10),
        follow: follow === 'true'
      });

      res.json({
        success: true,
        data: logs
      });

    } catch (error) {
      logger.error('Failed to get stage logs', { error, stageId: req.params.stageId, userId: req.userId });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve stage logs'
      });
    }
  })
);

// ===============================
// CI ARTIFACTS ENDPOINTS
// ===============================

/**
 * GET /api/ci/runs/:id/artifacts
 * Get artifacts for a CI run
 */
router.get('/runs/:id/artifacts',
  auth,
  checkRunAccess,
  asyncHandler(async (req: CIAuthRequest, res: Response) => {
    try {
      const { type, category } = req.query;
      const artifacts = await ciOrchestrator.getCIArtifacts(req.runId!, {
        type: type as string,
        category: category as string
      });

      res.json({
        success: true,
        data: artifacts
      });

    } catch (error) {
      logger.error('Failed to get CI artifacts', { error, runId: req.runId, userId: req.userId });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve CI artifacts'
      });
    }
  })
);

/**
 * GET /api/ci/artifacts/:artifactId/download
 * Download a specific artifact
 */
router.get('/artifacts/:artifactId/download',
  auth,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { artifactId } = req.params;
      const artifact = await ciOrchestrator.getArtifact(artifactId);

      if (!artifact) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Artifact not found'
        });
      }

      // Check tenant access
      const run = await ciOrchestrator.getCIRun(artifact.ciRunId);
      if (run?.tenantId && run.tenantId !== req.tenantId) {
        return res.status(403).json({ error: 'Access denied to artifact' });
      }

      // Stream file download
      await ciOrchestrator.downloadArtifact(artifactId, res);

      // Update download count
      await ciOrchestrator.updateArtifactDownloadCount(artifactId);

    } catch (error) {
      logger.error('Failed to download artifact', { error, artifactId: req.params.artifactId, userId: req.userId });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to download artifact'
      });
    }
  })
);

// ===============================
// DASHBOARD AND ANALYTICS
// ===============================

/**
 * GET /api/ci/dashboard
 * Get CI/CD dashboard statistics
 */
router.get('/dashboard',
  auth,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { timeframe = '7d' } = req.query;
      const stats = await ciOrchestrator.getDashboardStats(req.tenantId!, timeframe as string);

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Failed to get dashboard stats', { error, userId: req.userId });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve dashboard statistics'
      });
    }
  })
);

/**
 * GET /api/ci/metrics
 * Get CI/CD DORA metrics
 */
router.get('/metrics',
  auth,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { timeframe = '30d' } = req.query;
      const metrics = await ciOrchestrator.getCIMetrics(req.tenantId!, timeframe as string);

      res.json({
        success: true,
        data: metrics
      });

    } catch (error) {
      logger.error('Failed to get CI metrics', { error, userId: req.userId });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve CI metrics'
      });
    }
  })
);

// ===============================
// CONFIGURATION ENDPOINTS
// ===============================

/**
 * GET /api/ci/configurations
 * Get available CI configurations
 */
router.get('/configurations',
  auth,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const configurations = await ciOrchestrator.getCIConfigurations(req.tenantId!);

      res.json({
        success: true,
        data: configurations
      });

    } catch (error) {
      logger.error('Failed to get CI configurations', { error, userId: req.userId });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve CI configurations'
      });
    }
  })
);

/**
 * GET /api/ci/environments
 * Get available CI environments
 */
router.get('/environments',
  auth,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const environments = await ciOrchestrator.getCIEnvironments(req.tenantId!);

      res.json({
        success: true,
        data: environments
      });

    } catch (error) {
      logger.error('Failed to get CI environments', { error, userId: req.userId });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve CI environments'
      });
    }
  })
);

// ===============================
// JENKINS INTEGRATION
// ===============================

/**
 * GET /api/ci/jenkins/jobs
 * Get available Jenkins jobs
 */
router.get('/jenkins/jobs',
  auth,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const jobs = await jenkinsClient.getJobs();

      res.json({
        success: true,
        data: jobs
      });

    } catch (error) {
      logger.error('Failed to get Jenkins jobs', { error, userId: req.userId });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve Jenkins jobs'
      });
    }
  })
);

/**
 * POST /api/ci/jenkins/trigger
 * Trigger a Jenkins job
 */
router.post('/jenkins/trigger',
  auth,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { jobName, parameters } = req.body;

      if (!jobName) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Job name is required'
        });
      }

      const buildResult = await jenkinsClient.triggerJob(jobName, parameters);

      res.json({
        success: true,
        message: 'Jenkins job triggered successfully',
        data: buildResult
      });

    } catch (error) {
      logger.error('Failed to trigger Jenkins job', { error, userId: req.userId });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to trigger Jenkins job'
      });
    }
  })
);

// ===============================
// WEBSOCKET LIVE LOGS ENDPOINT
// ===============================

/**
 * GET /api/ci/runs/:id/logs/stream
 * Setup WebSocket connection info for live log streaming
 */
router.get('/runs/:id/logs/stream',
  auth,
  checkRunAccess,
  asyncHandler(async (req: CIAuthRequest, res: Response) => {
    try {
      // Return WebSocket connection information
      const wsInfo = {
        wsUrl: `/ws/ci/${req.runId!}/logs`,
        protocol: 'ci-logs',
        authToken: req.headers.authorization // Pass through for WebSocket auth
      };

      res.json({
        success: true,
        message: 'WebSocket connection info for CI run logs',
        data: wsInfo
      });

    } catch (error) {
      logger.error('Failed to setup log streaming', { error, runId: req.runId, userId: req.userId });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to setup log streaming'
      });
    }
  })
);

// ===============================
// ERROR HANDLING MIDDLEWARE
// ===============================

router.use((error: any, req: Request, res: Response, next: express.NextFunction) => {
  logger.error('CI API error', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body
  });

  if (error instanceof CIError) {
    res.status(400).json({
      error: error.name,
      message: error.message,
      code: error.code,
      details: error.details
    });
  } else {
    res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});

export { router as ciRouter };