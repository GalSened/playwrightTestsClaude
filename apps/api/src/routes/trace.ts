import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { TraceDatabase } from '../database/trace-database';
import { ArtifactManager } from '../services/artifact-manager';
import { PlaywrightTraceParser } from '../services/playwright-trace-parser';
import {
  GetRunsRequest,
  GetRunDetailRequest,
  TraceParseRequest,
  RerunTestRequest,
  ArtifactUploadRequest,
  SignedUrlRequest,
  TraceViewerFilters,
  StepFilters
} from '../types/trace';
import { logger } from '../utils/logger';

// Validation schemas
const GetRunsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  status: z.enum(['queued', 'running', 'passed', 'failed', 'cancelled']).optional(),
  environment: z.string().optional(),
  suite: z.string().optional(),
  branch: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  search: z.string().optional()
});

const RunDetailQuerySchema = z.object({
  includeSteps: z.coerce.boolean().default(true),
  includeArtifacts: z.coerce.boolean().default(true),
  includeLogs: z.coerce.boolean().default(false)
});

const TraceParseSchema = z.object({
  runId: z.string(),
  traceFilePath: z.string(),
  videoFilePath: z.string().optional(),
  screenshotsPath: z.string().optional()
});

const RerunTestSchema = z.object({
  runId: z.string(),
  testId: z.string().optional(),
  environment: z.string().default('local'),
  browser: z.enum(['chromium', 'firefox', 'webkit']).default('chromium'),
  headless: z.boolean().default(true)
});

const CreateRunSchema = z.object({
  suiteId: z.string(),
  suiteName: z.string(),
  environment: z.string().default('local'),
  browser: z.enum(['chromium', 'firefox', 'webkit']).default('chromium'),
  testMode: z.enum(['headed', 'headless']).default('headless'),
  branch: z.string().optional(),
  commitSha: z.string().optional(),
  triggeredBy: z.string().default('api'),
  metadata: z.record(z.any()).optional()
});

export function createTraceRouter(): Router {
  const router = Router();
  const traceDb = new TraceDatabase();
  const artifactManager = new ArtifactManager();
  const traceParser = new PlaywrightTraceParser();

  // GET /api/reports/runs - List test runs with filtering
  router.get('/runs', async (req: Request, res: Response) => {
    try {
      const query = GetRunsQuerySchema.parse(req.query);
      logger.info('Getting runs with filters', query);

      const response = await traceDb.getRuns(query);
      res.json(response);
    } catch (error) {
      logger.error('Failed to get runs', error);
      res.status(400).json({ error: 'Invalid query parameters', details: error });
    }
  });

  // GET /api/reports/runs/:runId - Get single run with details
  router.get('/runs/:runId', async (req: Request, res: Response) => {
    try {
      const { runId } = req.params;
      const query = RunDetailQuerySchema.parse(req.query);
      
      logger.info('Getting run details', { runId, ...query });

      const run = await traceDb.getRunById(runId);
      if (!run) {
        return res.status(404).json({ error: 'Run not found' });
      }

      const response: any = { run };

      if (query.includeSteps) {
        response.steps = await traceDb.getStepsByRunId(runId);
      }

      if (query.includeArtifacts) {
        response.artifacts = await traceDb.getArtifactsByRunId(runId);
      }

      if (query.includeLogs) {
        response.consoleLogs = await traceDb.getConsoleLogsByRunId(runId);
        response.networkLogs = await traceDb.getNetworkLogsByRunId(runId);
      }

      // Generate timeline if steps are included
      if (response.steps) {
        response.timeline = await generateTimeline(response.steps, response.consoleLogs, response.networkLogs);
      }

      res.json(response);
    } catch (error) {
      logger.error('Failed to get run details', error);
      res.status(500).json({ error: 'Failed to get run details' });
    }
  });

  // POST /api/reports/runs - Create new test run
  router.post('/runs', async (req: Request, res: Response) => {
    try {
      const data = CreateRunSchema.parse(req.body);
      logger.info('Creating new test run', data);

      const run = await traceDb.createRun({
        ...data,
        startedAt: new Date().toISOString(),
        status: 'queued',
        totals: { total: 0, passed: 0, failed: 0, skipped: 0 }
      });

      logger.info('Created test run', { runId: run.id });
      res.status(201).json(run);
    } catch (error) {
      logger.error('Failed to create run', error);
      res.status(400).json({ error: 'Invalid run data', details: error });
    }
  });

  // PATCH /api/reports/runs/:runId - Update test run
  router.patch('/runs/:runId', async (req: Request, res: Response) => {
    try {
      const { runId } = req.params;
      logger.info('Updating test run', { runId, updates: req.body });

      const run = await traceDb.updateRun(runId, req.body);
      if (!run) {
        return res.status(404).json({ error: 'Run not found' });
      }

      res.json(run);
    } catch (error) {
      logger.error('Failed to update run', error);
      res.status(500).json({ error: 'Failed to update run' });
    }
  });

  // DELETE /api/reports/runs/:runId - Delete test run
  router.delete('/runs/:runId', async (req: Request, res: Response) => {
    try {
      const { runId } = req.params;
      logger.info('Deleting test run', { runId });

      const run = await traceDb.getRunById(runId);
      if (!run) {
        return res.status(404).json({ error: 'Run not found' });
      }

      // Delete associated artifacts from storage
      const artifacts = await traceDb.getArtifactsByRunId(runId);
      for (const artifact of artifacts) {
        await artifactManager.deleteArtifact(artifact.filePath);
      }

      await traceDb.deleteRun(runId);
      res.status(204).send();
    } catch (error) {
      logger.error('Failed to delete run', error);
      res.status(500).json({ error: 'Failed to delete run' });
    }
  });

  // GET /api/reports/runs/:runId/steps - Get steps for a run
  router.get('/runs/:runId/steps', async (req: Request, res: Response) => {
    try {
      const { runId } = req.params;
      const filters: StepFilters = {
        status: req.query.status as string[] || [],
        actionTypes: req.query.actionTypes as string[] || [],
        hasError: req.query.hasError === 'true',
        hasScreenshot: req.query.hasScreenshot === 'true',
        duration: {
          min: req.query.minDuration ? Number(req.query.minDuration) : undefined,
          max: req.query.maxDuration ? Number(req.query.maxDuration) : undefined
        }
      };

      logger.info('Getting steps for run', { runId, filters });

      const steps = await traceDb.getStepsByRunId(runId, filters);
      res.json(steps);
    } catch (error) {
      logger.error('Failed to get steps', error);
      res.status(500).json({ error: 'Failed to get steps' });
    }
  });

  // GET /api/reports/runs/:runId/artifacts - Get artifacts for a run
  router.get('/runs/:runId/artifacts', async (req: Request, res: Response) => {
    try {
      const { runId } = req.params;
      const { stepId } = req.query;

      logger.info('Getting artifacts for run', { runId, stepId });

      const artifacts = await traceDb.getArtifactsByRunId(runId, stepId as string);
      res.json(artifacts);
    } catch (error) {
      logger.error('Failed to get artifacts', error);
      res.status(500).json({ error: 'Failed to get artifacts' });
    }
  });

  // GET /api/reports/runs/:runId/media/:artifactId - Stream media artifact
  router.get('/runs/:runId/media/:artifactId', async (req: Request, res: Response) => {
    try {
      const { runId, artifactId } = req.params;
      const { download, thumbnail } = req.query;

      logger.info('Streaming media artifact', { runId, artifactId, download, thumbnail });

      const artifact = await traceDb.getArtifactById(artifactId);
      if (!artifact || artifact.runId !== runId) {
        return res.status(404).json({ error: 'Artifact not found' });
      }

      const filePath = thumbnail === 'true' && artifact.thumbnailPath ? 
        artifact.thumbnailPath : artifact.filePath;

      const stream = await artifactManager.getArtifactStream(filePath);
      
      if (!stream) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Set appropriate headers
      res.setHeader('Content-Type', artifact.mimeType);
      if (download === 'true') {
        res.setHeader('Content-Disposition', `attachment; filename="${artifact.name}"`);
      }

      if (artifact.fileSize) {
        res.setHeader('Content-Length', artifact.fileSize);
      }

      // Enable range requests for video streaming
      if (artifact.artifactType === 'video') {
        res.setHeader('Accept-Ranges', 'bytes');
      }

      stream.pipe(res);
    } catch (error) {
      logger.error('Failed to stream media', error);
      res.status(500).json({ error: 'Failed to stream media' });
    }
  });

  // POST /api/reports/runs/:runId/artifacts - Upload artifact
  router.post('/runs/:runId/artifacts', async (req: Request, res: Response) => {
    try {
      const { runId } = req.params;
      
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { stepId, artifactType, name, metadata } = req.body;

      logger.info('Uploading artifact', { runId, stepId, artifactType, name });

      const run = await traceDb.getRunById(runId);
      if (!run) {
        return res.status(404).json({ error: 'Run not found' });
      }

      // Store the file and create artifact record
      const artifactPath = await artifactManager.storeArtifact(
        req.file.buffer,
        runId,
        stepId,
        artifactType,
        name || req.file.originalname
      );

      let thumbnailPath: string | undefined;
      if (artifactType === 'screenshot' || artifactType === 'video') {
        thumbnailPath = await artifactManager.generateThumbnail(artifactPath);
      }

      const artifact = await traceDb.createArtifact({
        runId,
        stepId: stepId || undefined,
        artifactType,
        name: name || req.file.originalname,
        filePath: artifactPath,
        fileUrl: `/api/reports/runs/${runId}/media/${artifactPath}`,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        thumbnailPath,
        thumbnailUrl: thumbnailPath ? `/api/reports/runs/${runId}/media/${thumbnailPath}?thumbnail=true` : undefined,
        metadata: metadata ? JSON.parse(metadata) : undefined
      });

      res.status(201).json(artifact);
    } catch (error) {
      logger.error('Failed to upload artifact', error);
      res.status(500).json({ error: 'Failed to upload artifact' });
    }
  });

  // POST /api/reports/runs/:runId/parse-trace - Parse trace file
  router.post('/runs/:runId/parse-trace', async (req: Request, res: Response) => {
    try {
      const { runId } = req.params;
      const data = TraceParseSchema.parse(req.body);

      logger.info('Parsing trace file', data);

      const run = await traceDb.getRunById(runId);
      if (!run) {
        return res.status(404).json({ error: 'Run not found' });
      }

      const parseResult = await traceParser.parseTrace(data.traceFilePath);
      
      let stepsCreated = 0;
      let artifactsCreated = 0;
      let logsCreated = 0;
      const errors: string[] = [];

      try {
        // Create steps
        for (const stepData of parseResult.steps) {
          await traceDb.createStep({ ...stepData, runId });
          stepsCreated++;
        }

        // Create artifacts
        for (const artifactData of parseResult.artifacts) {
          await traceDb.createArtifact({ ...artifactData, runId });
          artifactsCreated++;
        }

        // Create console logs
        for (const logData of parseResult.logs) {
          await traceDb.createConsoleLog({ ...logData, runId });
          logsCreated++;
        }

        // Create network logs
        for (const netLogData of parseResult.networkLogs) {
          await traceDb.createNetworkLog({ ...netLogData, runId });
          logsCreated++;
        }

        logger.info('Trace parsing completed', { 
          runId, stepsCreated, artifactsCreated, logsCreated 
        });

        res.json({
          success: true,
          stepsCreated,
          artifactsCreated,
          logsCreated,
          errors
        });

      } catch (dbError) {
        logger.error('Failed to store parsed trace data', dbError);
        errors.push(`Database error: ${dbError}`);
        
        res.status(500).json({
          success: false,
          stepsCreated,
          artifactsCreated,
          logsCreated,
          errors
        });
      }

    } catch (error) {
      logger.error('Failed to parse trace', error);
      res.status(400).json({ error: 'Failed to parse trace', details: error });
    }
  });

  // POST /api/reports/runs/:runId/rerun - Trigger test rerun
  router.post('/runs/:runId/rerun', async (req: Request, res: Response) => {
    try {
      const { runId } = req.params;
      const data = RerunTestSchema.parse(req.body);

      logger.info('Triggering test rerun', { runId, ...data });

      const originalRun = await traceDb.getRunById(runId);
      if (!originalRun) {
        return res.status(404).json({ error: 'Original run not found' });
      }

      // Create new run for rerun
      const newRun = await traceDb.createRun({
        suiteId: originalRun.suiteId,
        suiteName: `${originalRun.suiteName} (Rerun)`,
        environment: data.environment,
        browser: data.browser,
        testMode: data.headless ? 'headless' : 'headed',
        startedAt: new Date().toISOString(),
        status: 'queued',
        totals: { total: 0, passed: 0, failed: 0, skipped: 0 },
        branch: originalRun.branch,
        commitSha: originalRun.commitSha,
        triggeredBy: 'rerun',
        metadata: {
          originalRunId: runId,
          rerunReason: data.testId ? `Rerun specific test: ${data.testId}` : 'Full rerun',
          ...originalRun.metadata
        }
      });

      // TODO: Integrate with actual test runner (Playwright MCP)
      // For now, just return the new run ID

      logger.info('Created rerun', { originalRunId: runId, newRunId: newRun.id });

      res.json({
        newRunId: newRun.id,
        status: 'queued',
        estimatedDuration: originalRun.duration
      });

    } catch (error) {
      logger.error('Failed to trigger rerun', error);
      res.status(500).json({ error: 'Failed to trigger rerun' });
    }
  });

  // GET /api/reports/stats - Get overall statistics
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const filters: any = {};
      
      // Parse filter parameters
      if (req.query.status) {
        filters.status = Array.isArray(req.query.status) ? req.query.status : [req.query.status];
      }
      if (req.query.environments) {
        filters.environments = Array.isArray(req.query.environments) ? req.query.environments : [req.query.environments];
      }
      if (req.query.startDate) {
        filters.dateRange = { start: req.query.startDate as string };
      }
      if (req.query.endDate) {
        filters.dateRange = { ...filters.dateRange, end: req.query.endDate as string };
      }

      logger.info('Getting run statistics', { filters });

      const stats = await traceDb.getRunStatistics(filters);
      res.json(stats);
    } catch (error) {
      logger.error('Failed to get statistics', error);
      res.status(500).json({ error: 'Failed to get statistics' });
    }
  });

  // POST /api/reports/cleanup - Cleanup old runs and artifacts
  router.post('/cleanup', async (req: Request, res: Response) => {
    try {
      const { daysOld = 30 } = req.body;
      
      logger.info('Starting cleanup', { daysOld });

      const result = await traceDb.cleanup(daysOld);
      
      logger.info('Cleanup completed', result);
      res.json(result);
    } catch (error) {
      logger.error('Failed to cleanup', error);
      res.status(500).json({ error: 'Failed to cleanup' });
    }
  });

  return router;
}

// Helper function to generate timeline from steps and logs
async function generateTimeline(steps: any[], consoleLogs: any[] = [], networkLogs: any[] = []): Promise<any[]> {
  const timeline: any[] = [];

  // Add steps to timeline
  steps.forEach(step => {
    timeline.push({
      id: step.id,
      type: 'step',
      timestamp: step.startedAt,
      duration: step.duration,
      status: step.status === 'failed' ? 'failed' : 
             step.status === 'passed' ? 'passed' : 'info',
      title: step.actionName,
      description: step.errorMessage || `${step.actionType}: ${step.selector}`,
      stepId: step.id,
      metadata: {
        actionType: step.actionType,
        selector: step.selector,
        url: step.url,
        retryCount: step.retryCount
      }
    });
  });

  // Add console logs to timeline
  consoleLogs.forEach(log => {
    timeline.push({
      id: log.id,
      type: 'log',
      timestamp: log.timestamp,
      status: log.level === 'error' ? 'failed' : 
             log.level === 'warn' ? 'warning' : 'info',
      title: `Console ${log.level}`,
      description: log.message,
      stepId: log.stepId,
      metadata: {
        level: log.level,
        source: log.source,
        url: log.url
      }
    });
  });

  // Add network logs to timeline
  networkLogs.forEach(netLog => {
    timeline.push({
      id: netLog.id,
      type: 'network',
      timestamp: netLog.timestamp,
      duration: netLog.duration,
      status: netLog.failed ? 'failed' :
             netLog.statusCode && netLog.statusCode >= 400 ? 'warning' : 'info',
      title: `${netLog.method} ${new URL(netLog.url).pathname}`,
      description: `${netLog.statusCode} ${netLog.statusText}`,
      stepId: netLog.stepId,
      metadata: {
        method: netLog.method,
        url: netLog.url,
        statusCode: netLog.statusCode,
        duration: netLog.duration,
        requestSize: netLog.requestSize,
        responseSize: netLog.responseSize
      }
    });
  });

  // Sort by timestamp
  timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return timeline;
}