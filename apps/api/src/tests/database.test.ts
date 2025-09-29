import { SchedulerDatabase } from '@/database/database';
import { Schedule, ScheduleRun } from '@/types/scheduler';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';

describe('SchedulerDatabase', () => {
  let db: SchedulerDatabase;
  let testDbPath: string;

  beforeAll(() => {
    // Create test directory
    const testDir = join(__dirname, '../../../test-data');
    mkdirSync(testDir, { recursive: true });
    testDbPath = join(testDir, 'test-scheduler.db');
  });

  beforeEach(() => {
    // Create fresh database for each test
    db = new SchedulerDatabase(testDbPath);
  });

  afterEach(async () => {
    // Clean up database
    await db.close();
  });

  afterAll(() => {
    // Clean up test directory
    try {
      rmSync(join(__dirname, '../../../test-data'), { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Schedule CRUD operations', () => {
    it('should create a schedule', async () => {
      const scheduleData = {
        suite_id: 'test-suite-1',
        suite_name: 'Test Suite 1',
        timezone: 'Asia/Jerusalem',
        run_at_utc: '2024-12-01T12:00:00.000Z',
        run_at_local: '2024-12-01T14:00:00.000+02:00',
        priority: 5,
        status: 'scheduled' as const,
        max_retries: 3
      };

      const created = await db.createSchedule(scheduleData);

      expect(created.id).toBeDefined();
      expect(created.suite_id).toBe(scheduleData.suite_id);
      expect(created.suite_name).toBe(scheduleData.suite_name);
      expect(created.status).toBe('scheduled');
      expect(created.created_at).toBeDefined();
      expect(created.updated_at).toBeDefined();
    });

    it('should retrieve a schedule by ID', () => {
      const scheduleData = {
        suite_id: 'test-suite-1',
        suite_name: 'Test Suite 1',
        timezone: 'Asia/Jerusalem',
        run_at_utc: '2024-12-01T12:00:00.000Z',
        run_at_local: '2024-12-01T14:00:00.000+02:00',
        priority: 5,
        status: 'scheduled' as const,
        max_retries: 3
      };

      const created = db.createSchedule(scheduleData);
      const retrieved = db.getScheduleById(created.id);

      expect(retrieved).toEqual(created);
    });

    it('should update a schedule', async () => {
      const scheduleData = {
        suite_id: 'test-suite-1',
        suite_name: 'Test Suite 1',
        timezone: 'Asia/Jerusalem',
        run_at_utc: '2024-12-01T12:00:00.000Z',
        run_at_local: '2024-12-01T14:00:00.000+02:00',
        priority: 5,
        status: 'scheduled' as const,
        max_retries: 3
      };

      const created = await db.createSchedule(scheduleData);
      const updated = await db.updateSchedule(created.id, { 
        priority: 8,
        notes: 'Updated notes'
      });

      expect(updated.priority).toBe(8);
      expect(updated.notes).toBe('Updated notes');
      expect(updated.updated_at).not.toBe(created.updated_at);
    });

    it('should delete a schedule', async () => {
      const scheduleData = {
        suite_id: 'test-suite-1',
        suite_name: 'Test Suite 1',
        timezone: 'Asia/Jerusalem',
        run_at_utc: '2024-12-01T12:00:00.000Z',
        run_at_local: '2024-12-01T14:00:00.000+02:00',
        priority: 5,
        status: 'scheduled' as const,
        max_retries: 3
      };

      const created = await db.createSchedule(scheduleData);
      await db.deleteSchedule(created.id);

      const retrieved = db.getScheduleById(created.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('Schedule querying', () => {
    beforeEach(async () => {
      // Create test schedules
      await db.createSchedule({
        suite_id: 'suite-1',
        suite_name: 'Suite 1',
        timezone: 'Asia/Jerusalem',
        run_at_utc: '2024-12-01T12:00:00.000Z',
        run_at_local: '2024-12-01T14:00:00.000+02:00',
        status: 'scheduled',
        priority: 5,
        max_retries: 3
      });

      await db.createSchedule({
        suite_id: 'suite-2',
        suite_name: 'Suite 2',
        timezone: 'Asia/Jerusalem',
        run_at_utc: '2024-12-02T12:00:00.000Z',
        run_at_local: '2024-12-02T14:00:00.000+02:00',
        status: 'completed',
        priority: 7,
        max_retries: 3
      });
    });

    it('should query schedules with filters', async () => {
      const { schedules, total } = await db.querySchedules({
        status: ['scheduled'],
        limit: 10
      });

      expect(total).toBe(1);
      expect(schedules).toHaveLength(1);
      expect(schedules[0].status).toBe('scheduled');
    });

    it('should support pagination', async () => {
      const { schedules, total } = await db.querySchedules({
        limit: 1,
        offset: 0
      });

      expect(total).toBe(2);
      expect(schedules).toHaveLength(1);
    });
  });

  describe('Worker coordination', () => {
    let scheduleId: string;

    beforeEach(async () => {
      const schedule = await db.createSchedule({
        suite_id: 'test-suite',
        suite_name: 'Test Suite',
        timezone: 'Asia/Jerusalem',
        run_at_utc: new Date(Date.now() - 60000).toISOString(), // 1 minute ago (claimable)
        run_at_local: new Date(Date.now() - 60000).toISOString(),
        status: 'scheduled',
        priority: 5,
        max_retries: 3
      });
      scheduleId = schedule.id;
    });

    it('should claim a schedule', async () => {
      const workerId = 'worker-test';
      const claimed = await db.claimSchedule(scheduleId, workerId);

      expect(claimed).toBe(true);

      const schedule = db.getScheduleById(scheduleId);
      expect(schedule?.claimed_by).toBe(workerId);
      expect(schedule?.status).toBe('running');
    });

    it('should not double-claim a schedule', async () => {
      const workerId1 = 'worker-1';
      const workerId2 = 'worker-2';

      const claimed1 = await db.claimSchedule(scheduleId, workerId1);
      const claimed2 = await db.claimSchedule(scheduleId, workerId2);

      expect(claimed1).toBe(true);
      expect(claimed2).toBe(false);
    });

    it('should get claimable schedules', async () => {
      const claimable = await db.getClaimableSchedules(5);

      expect(claimable).toHaveLength(1);
      expect(claimable[0].id).toBe(scheduleId);
    });

    it('should release schedule claim', async () => {
      const workerId = 'worker-test';
      await db.claimSchedule(scheduleId, workerId);
      await db.releaseScheduleClaim(scheduleId, workerId);

      const schedule = db.getScheduleById(scheduleId);
      expect(schedule?.claimed_by).toBeUndefined();
      expect(schedule?.claimed_at).toBeUndefined();
    });
  });

  describe('Schedule runs', () => {
    let scheduleId: string;

    beforeEach(async () => {
      const schedule = await db.createSchedule({
        suite_id: 'test-suite',
        suite_name: 'Test Suite',
        timezone: 'Asia/Jerusalem',
        run_at_utc: '2024-12-01T12:00:00.000Z',
        run_at_local: '2024-12-01T14:00:00.000+02:00',
        status: 'scheduled',
        priority: 5,
        max_retries: 3
      });
      scheduleId = schedule.id;
    });

    it('should create a schedule run', async () => {
      const runData = {
        schedule_id: scheduleId,
        started_at: new Date().toISOString(),
        status: 'running' as const,
        tests_total: 0,
        tests_passed: 0,
        tests_failed: 0,
        tests_skipped: 0
      };

      const created = await db.createScheduleRun(runData);

      expect(created.id).toBeDefined();
      expect(created.schedule_id).toBe(scheduleId);
      expect(created.status).toBe('running');
    });

    it('should update a schedule run', async () => {
      const runData = {
        schedule_id: scheduleId,
        started_at: new Date().toISOString(),
        status: 'running' as const,
        tests_total: 0,
        tests_passed: 0,
        tests_failed: 0,
        tests_skipped: 0
      };

      const created = await db.createScheduleRun(runData);
      const updated = await db.updateScheduleRun(created.id, {
        finished_at: new Date().toISOString(),
        status: 'completed',
        tests_total: 10,
        tests_passed: 8,
        tests_failed: 2
      });

      expect(updated.status).toBe('completed');
      expect(updated.tests_total).toBe(10);
      expect(updated.tests_passed).toBe(8);
      expect(updated.tests_failed).toBe(2);
    });

    it('should get schedule runs for a schedule', async () => {
      const runData = {
        schedule_id: scheduleId,
        started_at: new Date().toISOString(),
        status: 'completed' as const,
        tests_total: 5,
        tests_passed: 5,
        tests_failed: 0,
        tests_skipped: 0
      };

      await db.createScheduleRun(runData);
      const runs = await db.getScheduleRuns(scheduleId, 10);

      expect(runs).toHaveLength(1);
      expect(runs[0].schedule_id).toBe(scheduleId);
    });
  });

  describe('Database health and cleanup', () => {
    it('should pass health check', async () => {
      const healthy = await db.healthCheck();
      expect(healthy).toBe(true);
    });

    it('should clean up old records', async () => {
      // Create old completed schedule
      await db.createSchedule({
        suite_id: 'old-suite',
        suite_name: 'Old Suite',
        timezone: 'Asia/Jerusalem',
        run_at_utc: '2023-01-01T12:00:00.000Z',
        run_at_local: '2023-01-01T14:00:00.000+02:00',
        status: 'completed',
        priority: 5,
        max_retries: 3
      });

      const result = await db.cleanup(0); // Clean up all records
      
      expect(typeof result.schedules).toBe('number');
      expect(typeof result.runs).toBe('number');
    });
  });
});