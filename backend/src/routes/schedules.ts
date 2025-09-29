import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '@/database/database';
import { 
  CreateScheduleRequest,
  UpdateScheduleRequest,
  ScheduleQuery,
  RunNowRequest,
  SchedulerError,
  ScheduleResponse
} from '@/types/scheduler';
import { 
  convertToUTC, 
  validateFutureTime, 
  getMinutesUntilExecution,
  isDSTTransitionRisk,
  getTimezoneInfo 
} from '@/utils/timezone';
import { logger } from '@/utils/logger';
import { executeSchedule } from '@/services/execution';
import { createError, createNotFoundError, createValidationError } from '@/middleware/error-handler';
import { testSuiteRegistry } from '@/services/testSuiteRegistry';

const router = Router();
const db = getDatabase();

// Validation middleware with improved error handling
function validateRequest<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        const validationError = createValidationError(
          firstError.path.join('.'),
          firstError.received,
          firstError.message
        );
        return next(validationError);
      }
      next(error);
    }
  };
}

// POST /api/schedules - Create a new schedule
router.post('/', validateRequest(CreateScheduleRequest), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body as z.infer<typeof CreateScheduleRequest>;
    
    logger.info('Creating new schedule', { 
      suiteId: data.suite_id, 
      runAt: data.run_at, 
      timezone: data.timezone 
    });

    // Convert user time to UTC
    const timeConversion = convertToUTC(data.run_at, data.timezone);
    
    // Validate future time (at least 1 minute from now)
    validateFutureTime(timeConversion.utcDateTime, 1);
    
    // Check for DST transition risk
    if (isDSTTransitionRisk(timeConversion.utcDateTime, data.timezone)) {
      logger.warn('Schedule created during DST transition period', {
        utcTime: timeConversion.utcDateTime,
        timezone: data.timezone
      });
    }

    // Create schedule record
    const schedule = await db.createSchedule({
      suite_id: data.suite_id,
      suite_name: data.suite_name,
      timezone: data.timezone,
      run_at_utc: timeConversion.utcDateTime,
      run_at_local: timeConversion.localDateTime,
      notes: data.notes,
      tags: data.tags ? JSON.stringify(data.tags) : undefined,
      priority: data.priority,
      execution_options: data.execution_options ? JSON.stringify(data.execution_options) : undefined,
      recurrence_type: data.recurrence_type,
      recurrence_interval: data.recurrence_interval,
      recurrence_days: data.recurrence_days ? JSON.stringify(data.recurrence_days) : undefined,
      recurrence_end_date: data.recurrence_end_date,
      status: 'scheduled'
    });

    // If run_now is true, also trigger immediate execution
    let immediateRun = null;
    if (data.run_now) {
      try {
        immediateRun = await executeSchedule(schedule.id, {
          notes: 'Immediate execution requested',
          execution_options: data.execution_options
        });
        logger.info('Immediate execution triggered', { 
          scheduleId: schedule.id, 
          runId: immediateRun.id 
        });
      } catch (error) {
        logger.error('Failed to trigger immediate execution', { 
          scheduleId: schedule.id, 
          error 
        });
        // Don't fail the schedule creation if immediate run fails
      }
    }

    const response: ScheduleResponse = {
      ...schedule,
      tags_parsed: schedule.tags ? JSON.parse(schedule.tags) : undefined,
      execution_options_parsed: schedule.execution_options ? JSON.parse(schedule.execution_options) : undefined,
      recurrence_days_parsed: schedule.recurrence_days ? JSON.parse(schedule.recurrence_days) : undefined,
      minutes_until_run: getMinutesUntilExecution(schedule.run_at_utc),
    };

    res.status(201).json({
      schedule: response,
      immediate_run: immediateRun,
      timezone_info: getTimezoneInfo(data.timezone)
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/schedules - List schedules with filtering
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = ScheduleQuery.parse(req.query);
    
    const { schedules, total } = await db.querySchedules({
      status: query.status,
      suite_id: query.suite_id,
      from_date: query.from_date,
      to_date: query.to_date,
      limit: query.limit,
      offset: query.offset,
      order_by: query.order_by,
      order_dir: query.order_dir
    });

    const responseSchedules: ScheduleResponse[] = schedules.map(schedule => ({
      ...schedule,
      tags_parsed: schedule.tags ? JSON.parse(schedule.tags) : undefined,
      execution_options_parsed: schedule.execution_options ? JSON.parse(schedule.execution_options) : undefined,
      recurrence_days_parsed: schedule.recurrence_days ? JSON.parse(schedule.recurrence_days) : undefined,
      minutes_until_run: schedule.status === 'scheduled' ? getMinutesUntilExecution(schedule.run_at_utc) : undefined,
    }));

    const page = Math.floor(query.offset / query.limit);
    const hasMore = query.offset + query.limit < total;

    res.json({
      schedules: responseSchedules,
      total,
      page,
      limit: query.limit,
      has_more: hasMore
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/schedules/suites - Get available test suites
router.get('/suites', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await testSuiteRegistry.initialize();
    
    const suites = testSuiteRegistry.getAllSuites();
    const categories = testSuiteRegistry.getAllCategories();
    const stats = testSuiteRegistry.getExecutionStats();
    
    res.json({
      suites: suites.map(suite => ({
        id: suite.id,
        name: suite.name,
        description: suite.description,
        category: suite.category,
        test_count: suite.testFiles.length,
        estimated_duration_ms: suite.estimatedDurationMs,
        priority: suite.priority,
        markers: suite.markers
      })),
      categories,
      stats
    });
    
  } catch (error) {
    next(error);
  }
});

// GET /api/schedules/suites/:id - Get specific test suite details
router.get('/suites/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await testSuiteRegistry.initialize();
    
    const suiteId = req.params.id;
    const suite = testSuiteRegistry.getSuite(suiteId);
    
    if (!suite) {
      return res.status(404).json({ error: 'Test suite not found' });
    }
    
    const validation = testSuiteRegistry.validateSuite(suiteId);
    
    res.json({
      suite: {
        ...suite,
        test_files: suite.testFiles.map(file => file.replace(suite.basePath, '').replace(/^[\\\/]/, ''))
      },
      validation,
      can_execute: validation.valid
    });
    
  } catch (error) {
    next(error);
  }
});

// GET /api/schedules/stats/summary - Get scheduling statistics  
router.get('/stats/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { schedules: allSchedules } = await db.querySchedules({ limit: 1000 });
    
    const stats = {
      total: allSchedules.length,
      by_status: {
        scheduled: allSchedules.filter(s => s.status === 'scheduled').length,
        running: allSchedules.filter(s => s.status === 'running').length,
        completed: allSchedules.filter(s => s.status === 'completed').length,
        failed: allSchedules.filter(s => s.status === 'failed').length,
        canceled: allSchedules.filter(s => s.status === 'canceled').length,
      },
      next_24h: allSchedules.filter(s => 
        s.status === 'scheduled' && 
        getMinutesUntilExecution(s.run_at_utc) <= 24 * 60
      ).length,
      overdue: allSchedules.filter(s => 
        s.status === 'scheduled' && 
        getMinutesUntilExecution(s.run_at_utc) < 0
      ).length
    };

    res.json(stats);

  } catch (error) {
    next(error);
  }
});

// GET /api/schedules/:id - Get single schedule
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schedule = db.getScheduleById(req.params.id);
    
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    // Get recent runs for this schedule
    const runs = await db.getScheduleRuns(schedule.id, 5);
    const lastRun = runs.length > 0 ? runs[0] : undefined;

    const response: ScheduleResponse = {
      ...schedule,
      tags_parsed: schedule.tags ? JSON.parse(schedule.tags) : undefined,
      execution_options_parsed: schedule.execution_options ? JSON.parse(schedule.execution_options) : undefined,
      recurrence_days_parsed: schedule.recurrence_days ? JSON.parse(schedule.recurrence_days) : undefined,
      minutes_until_run: schedule.status === 'scheduled' ? getMinutesUntilExecution(schedule.run_at_utc) : undefined,
      last_run: lastRun
    };

    res.json({
      schedule: response,
      recent_runs: runs,
      timezone_info: getTimezoneInfo(schedule.timezone)
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/schedules/:id - Update schedule
router.patch('/:id', validateRequest(UpdateScheduleRequest), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body as z.infer<typeof UpdateScheduleRequest>;
    const scheduleId = req.params.id;
    
    const existing = db.getScheduleById(scheduleId);
    if (!existing) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    logger.info('Updating schedule', { scheduleId, updates: Object.keys(data) });

    const updates: Partial<typeof existing> = {};

    // Handle time update
    if (data.run_at) {
      const timezone = data.timezone || existing.timezone;
      const timeConversion = convertToUTC(data.run_at, timezone);
      validateFutureTime(timeConversion.utcDateTime, 1);
      
      updates.run_at_utc = timeConversion.utcDateTime;
      updates.run_at_local = timeConversion.localDateTime;
      updates.timezone = timezone;

      if (isDSTTransitionRisk(timeConversion.utcDateTime, timezone)) {
        logger.warn('Schedule updated to DST transition period', {
          scheduleId,
          utcTime: timeConversion.utcDateTime,
          timezone
        });
      }
    }

    // Handle other updates
    if (data.notes !== undefined) updates.notes = data.notes;
    if (data.tags) updates.tags = JSON.stringify(data.tags);
    if (data.priority) updates.priority = data.priority;
    if (data.execution_options) updates.execution_options = JSON.stringify(data.execution_options);
    if (data.recurrence_type) updates.recurrence_type = data.recurrence_type;
    if (data.recurrence_interval) updates.recurrence_interval = data.recurrence_interval;
    if (data.recurrence_days) updates.recurrence_days = JSON.stringify(data.recurrence_days);
    if (data.recurrence_end_date) updates.recurrence_end_date = data.recurrence_end_date;

    const updated = await db.updateSchedule(scheduleId, updates);

    const response: ScheduleResponse = {
      ...updated,
      tags_parsed: updated.tags ? JSON.parse(updated.tags) : undefined,
      execution_options_parsed: updated.execution_options ? JSON.parse(updated.execution_options) : undefined,
      recurrence_days_parsed: updated.recurrence_days ? JSON.parse(updated.recurrence_days) : undefined,
      minutes_until_run: updated.status === 'scheduled' ? getMinutesUntilExecution(updated.run_at_utc) : undefined,
    };

    res.json({
      schedule: response,
      timezone_info: getTimezoneInfo(updated.timezone)
    });

  } catch (error) {
    next(error);
  }
});

// POST /api/schedules/:id/run-now - Trigger immediate execution
router.post('/:id/run-now', validateRequest(RunNowRequest), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body as z.infer<typeof RunNowRequest>;
    const scheduleId = req.params.id;
    
    const schedule = db.getScheduleById(scheduleId);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    logger.info('Triggering immediate execution', { scheduleId });

    const run = await executeSchedule(scheduleId, {
      notes: data.notes || 'Manual execution triggered',
      execution_options: data.execution_options
    });

    res.json({
      message: 'Execution triggered successfully',
      run,
      schedule_remains: schedule.status === 'scheduled' // Schedule still exists for future execution
    });

  } catch (error) {
    next(error);
  }
});

// POST /api/schedules/:id/cancel - Cancel scheduled run
router.post('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scheduleId = req.params.id;
    
    const schedule = db.getScheduleById(scheduleId);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    if (schedule.status !== 'scheduled') {
      return res.status(400).json({ 
        error: 'Can only cancel scheduled runs',
        current_status: schedule.status
      });
    }

    logger.info('Canceling schedule', { scheduleId });

    const updated = await db.updateSchedule(scheduleId, { 
      status: 'canceled',
      claimed_at: undefined,
      claimed_by: undefined
    });

    res.json({
      message: 'Schedule canceled successfully',
      schedule: {
        id: updated.id,
        status: updated.status,
        updated_at: updated.updated_at
      }
    });

  } catch (error) {
    next(error);
  }
});

// DELETE /api/schedules/:id - Delete schedule
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scheduleId = req.params.id;
    
    const schedule = db.getScheduleById(scheduleId);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    logger.info('Deleting schedule', { scheduleId });

    await db.deleteSchedule(scheduleId);

    res.json({
      message: 'Schedule deleted successfully'
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/schedules/:id/runs - Get execution history
router.get('/:id/runs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scheduleId = req.params.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    
    const schedule = db.getScheduleById(scheduleId);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const runs = await db.getScheduleRuns(scheduleId, limit);

    res.json({
      runs,
      schedule: {
        id: schedule.id,
        suite_name: schedule.suite_name,
        status: schedule.status
      }
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/schedules/suites - Get available test suites
router.get('/suites', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await testSuiteRegistry.initialize();
    
    const suites = testSuiteRegistry.getAllSuites();
    const categories = testSuiteRegistry.getAllCategories();
    const stats = testSuiteRegistry.getExecutionStats();
    
    res.json({
      suites: suites.map(suite => ({
        id: suite.id,
        name: suite.name,
        description: suite.description,
        category: suite.category,
        test_count: suite.testFiles.length,
        estimated_duration_ms: suite.estimatedDurationMs,
        priority: suite.priority,
        markers: suite.markers
      })),
      categories,
      stats
    });
    
  } catch (error) {
    next(error);
  }
});

// GET /api/schedules/suites/:id - Get specific test suite details
router.get('/suites/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await testSuiteRegistry.initialize();
    
    const suiteId = req.params.id;
    const suite = testSuiteRegistry.getSuite(suiteId);
    
    if (!suite) {
      return res.status(404).json({ error: 'Test suite not found' });
    }
    
    const validation = testSuiteRegistry.validateSuite(suiteId);
    
    res.json({
      suite: {
        ...suite,
        test_files: suite.testFiles.map(file => file.replace(suite.basePath, '').replace(/^[\\/]/, ''))
      },
      validation,
      can_execute: validation.valid
    });
    
  } catch (error) {
    next(error);
  }
});

// Error handling middleware
router.use((error: any, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof SchedulerError) {
    const statusCode = error.code === 'NOT_FOUND' ? 404 :
                      error.code === 'VALIDATION_ERROR' ? 400 :
                      error.code === 'PAST_TIME' ? 400 :
                      error.code === 'INVALID_TIMEZONE' ? 400 :
                      error.code === 'CONCURRENCY_CONFLICT' ? 409 : 500;

    return res.status(statusCode).json({
      error: error.message,
      code: error.code,
      details: error.details
    });
  }

  logger.error('Unhandled error in schedules router', { error });
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

export { router as schedulesRouter };