import { z } from 'zod';

// Database schema types (matching SQL schema)
export const ScheduleStatus = z.enum(['scheduled', 'running', 'completed', 'failed', 'canceled']);
export const RunStatus = z.enum(['running', 'completed', 'failed', 'canceled', 'timeout']);
export const RecurrenceType = z.enum(['none', 'daily', 'weekly', 'monthly']);

// Core Schedule model
export const Schedule = z.object({
  id: z.string(),
  suite_id: z.string(),
  suite_name: z.string(),
  user_id: z.string().optional(),
  
  // Timezone handling
  timezone: z.string().default('Asia/Jerusalem'),
  run_at_utc: z.string(), // ISO 8601 UTC
  run_at_local: z.string(), // ISO 8601 local time for display
  
  // Recurrence
  recurrence_type: RecurrenceType.default('none'),
  recurrence_interval: z.number().int().min(1).default(1),
  recurrence_days: z.string().optional(), // JSON array for weekly schedules
  recurrence_end_date: z.string().optional(),
  
  // Metadata
  notes: z.string().optional(),
  tags: z.string().optional(), // JSON array
  priority: z.number().int().min(1).max(10).default(5),
  
  // Status
  status: ScheduleStatus.default('scheduled'),
  created_at: z.string(),
  updated_at: z.string(),
  
  // Execution
  execution_options: z.string().optional(), // JSON object
  last_run_id: z.string().optional(),
  next_run_at: z.string().optional(),
  
  // Worker coordination
  claimed_at: z.string().optional(),
  claimed_by: z.string().optional(),
  retry_count: z.number().int().min(0).default(0),
  max_retries: z.number().int().min(0).default(3),
});

export const ScheduleRun = z.object({
  id: z.string(),
  schedule_id: z.string(),
  
  // Timing
  started_at: z.string(),
  finished_at: z.string().optional(),
  duration_ms: z.number().int().min(0).optional(),
  
  // Results
  status: RunStatus,
  exit_code: z.number().int().optional(),
  error_message: z.string().optional(),
  
  // Test statistics
  tests_total: z.number().int().min(0).default(0),
  tests_passed: z.number().int().min(0).default(0),
  tests_failed: z.number().int().min(0).default(0),
  tests_skipped: z.number().int().min(0).default(0),
  
  // Artifacts
  artifacts_path: z.string().optional(),
  log_output: z.string().optional(),
  result_summary: z.string().optional(), // JSON
  
  // Retry info
  attempt_number: z.number().int().min(1).default(1),
  retry_reason: z.string().optional(),
  
  // Environment
  environment: z.string().default('local'),
  browser: z.string().optional(),
  test_runner_version: z.string().optional(),
});

// API DTOs
export const CreateScheduleRequest = z.object({
  suite_id: z.string().min(1),
  suite_name: z.string().min(1),
  
  // Time in user's timezone - will be converted to UTC
  run_at: z.string().datetime(), // ISO 8601 in user's timezone
  timezone: z.string().default('Asia/Jerusalem'),
  
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  priority: z.number().int().min(1).max(10).default(5),
  
  // Execution options
  execution_options: z.object({
    mode: z.enum(['headed', 'headless']).default('headless'),
    execution: z.enum(['parallel', 'sequential']).default('parallel'),
    retries: z.number().int().min(0).max(5).default(1),
    timeout_ms: z.number().int().min(30000).max(3600000).default(300000), // 5-60min
    browser: z.enum(['chromium', 'firefox', 'webkit', 'all']).default('chromium'),
    environment: z.string().default('staging'),
  }).optional(),
  
  // Future: recurrence
  recurrence_type: RecurrenceType.default('none'),
  recurrence_interval: z.number().int().min(1).default(1),
  recurrence_days: z.array(z.string()).optional(), // For weekly schedules
  recurrence_end_date: z.string().datetime().optional(),
  
  // Run immediately in addition to scheduling
  run_now: z.boolean().default(false),
});

export const UpdateScheduleRequest = z.object({
  run_at: z.string().datetime().optional(),
  timezone: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  priority: z.number().int().min(1).max(10).optional(),
  execution_options: z.object({
    mode: z.enum(['headed', 'headless']).optional(),
    execution: z.enum(['parallel', 'sequential']).optional(),
    retries: z.number().int().min(0).max(5).optional(),
    timeout_ms: z.number().int().min(30000).max(3600000).optional(),
    browser: z.enum(['chromium', 'firefox', 'webkit', 'all']).optional(),
    environment: z.string().optional(),
  }).optional(),
  recurrence_type: RecurrenceType.optional(),
  recurrence_interval: z.number().int().min(1).optional(),
  recurrence_days: z.array(z.string()).optional(),
  recurrence_end_date: z.string().datetime().optional(),
});

export const ScheduleQuery = z.object({
  status: z.array(ScheduleStatus).optional(),
  suite_id: z.string().optional(),
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  order_by: z.enum(['created_at', 'run_at_utc', 'priority']).default('run_at_utc'),
  order_dir: z.enum(['asc', 'desc']).default('asc'),
});

export const RunNowRequest = z.object({
  // Override execution options for this immediate run
  execution_options: z.object({
    mode: z.enum(['headed', 'headless']).optional(),
    execution: z.enum(['parallel', 'sequential']).optional(),
    browser: z.enum(['chromium', 'firefox', 'webkit', 'all']).optional(),
    environment: z.string().optional(),
  }).optional(),
  notes: z.string().optional(),
});

// API Response types
export const ScheduleResponse = Schedule.extend({
  // Computed fields
  tags_parsed: z.array(z.string()).optional(),
  execution_options_parsed: z.object({
    mode: z.enum(['headed', 'headless']).optional(),
    execution: z.enum(['parallel', 'sequential']).optional(),
    retries: z.number().int().optional(),
    timeout_ms: z.number().int().optional(),
    browser: z.string().optional(),
    environment: z.string().optional(),
  }).optional(),
  recurrence_days_parsed: z.array(z.string()).optional(),
  
  // Time until execution (minutes)
  minutes_until_run: z.number().optional(),
  
  // Last run info (from JOIN)
  last_run: ScheduleRun.optional(),
});

export const ScheduleListResponse = z.object({
  schedules: z.array(ScheduleResponse),
  total: z.number().int().min(0),
  page: z.number().int().min(0),
  limit: z.number().int().min(1),
  has_more: z.boolean(),
});

// Worker coordination types
export const WorkerClaim = z.object({
  schedule_id: z.string(),
  worker_id: z.string(),
  claimed_at: z.string(),
  expires_at: z.string(),
});

export const ExecutionContext = z.object({
  schedule: Schedule,
  run: ScheduleRun,
  worker_id: z.string(),
  artifacts_dir: z.string(),
  temp_dir: z.string(),
});

// Type exports
export type Schedule = z.infer<typeof Schedule>;
export type ScheduleRun = z.infer<typeof ScheduleRun>;
export type ScheduleStatus = z.infer<typeof ScheduleStatus>;
export type RunStatus = z.infer<typeof RunStatus>;
export type CreateScheduleRequest = z.infer<typeof CreateScheduleRequest>;
export type UpdateScheduleRequest = z.infer<typeof UpdateScheduleRequest>;
export type ScheduleQuery = z.infer<typeof ScheduleQuery>;
export type RunNowRequest = z.infer<typeof RunNowRequest>;
export type ScheduleResponse = z.infer<typeof ScheduleResponse>;
export type ScheduleListResponse = z.infer<typeof ScheduleListResponse>;
export type ExecutionContext = z.infer<typeof ExecutionContext>;

// Utility types for DST-safe timezone handling
export interface TimezoneConversion {
  userDateTime: string; // User input in their timezone
  userTimezone: string; // e.g., "Asia/Jerusalem"
  utcDateTime: string; // Stored in database
  localDateTime: string; // For display in UI
  isDST: boolean; // Whether DST is active
  offset: number; // Timezone offset in minutes
}

// Error types
export class SchedulerError extends Error {
  constructor(
    public code: 'INVALID_TIMEZONE' | 'PAST_TIME' | 'CONCURRENCY_CONFLICT' | 'EXECUTION_FAILED' | 'NOT_FOUND' | 'VALIDATION_ERROR' | 'DATABASE_INIT_ERROR' | 'SCHEMA_INTEGRITY_ERROR',
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'SchedulerError';
  }
}

// Execution result interface
export interface ExecutionResult {
  success: boolean;
  exit_code: number;
  duration_ms: number;
  tests_total: number;
  tests_passed: number;
  tests_failed: number;
  tests_skipped: number;
  artifacts_path?: string;
  error_message?: string;
  log_output: string;
  summary: Record<string, unknown>;
}