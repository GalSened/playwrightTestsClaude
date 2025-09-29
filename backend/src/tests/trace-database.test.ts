import { TraceDatabase } from '../database/trace-database';
import { TraceViewerRun, TraceStep, TraceArtifact } from '../types/trace';
import { join } from 'path';
import { promises as fs } from 'fs';

describe('TraceDatabase', () => {
  let db: TraceDatabase;
  let tempDbPath: string;

  beforeEach(async () => {
    // Create temporary database for each test
    tempDbPath = join(__dirname, '../../test-data', `test-${Date.now()}.db`);
    await fs.mkdir(join(__dirname, '../../test-data'), { recursive: true });
    db = new TraceDatabase(tempDbPath);
  });

  afterEach(async () => {
    // Clean up
    db.close();
    try {
      await fs.unlink(tempDbPath);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Test Runs', () => {
    const mockRunData = {
      suiteId: 'suite-123',
      suiteName: 'Test Suite',
      startedAt: new Date().toISOString(),
      status: 'running' as const,
      environment: 'local',
      totals: {
        total: 10,
        passed: 7,
        failed: 2,
        skipped: 1
      }
    };

    test('should create a test run', async () => {
      const run = await db.createRun(mockRunData);

      expect(run.id).toBeDefined();
      expect(run.suiteId).toBe(mockRunData.suiteId);
      expect(run.suiteName).toBe(mockRunData.suiteName);
      expect(run.status).toBe(mockRunData.status);
      expect(run.totals).toEqual(mockRunData.totals);
      expect(run.passRate).toBe(70); // 7/10 * 100
    });

    test('should get run by id', async () => {
      const createdRun = await db.createRun(mockRunData);
      const retrievedRun = await db.getRunById(createdRun.id);

      expect(retrievedRun).toEqual(createdRun);
    });

    test('should return null for non-existent run', async () => {
      const run = await db.getRunById('non-existent');
      expect(run).toBeNull();
    });

    test('should update run', async () => {
      const createdRun = await db.createRun(mockRunData);
      
      const updates = {
        status: 'completed' as const,
        finishedAt: new Date().toISOString(),
        duration: 30000,
        totals: {
          total: 10,
          passed: 8,
          failed: 2,
          skipped: 0
        }
      };

      const updatedRun = await db.updateRun(createdRun.id, updates);

      expect(updatedRun?.status).toBe(updates.status);
      expect(updatedRun?.finishedAt).toBe(updates.finishedAt);
      expect(updatedRun?.duration).toBe(updates.duration);
      expect(updatedRun?.totals).toEqual(updates.totals);
      expect(updatedRun?.passRate).toBe(80); // 8/10 * 100
    });

    test('should get runs with filters', async () => {
      // Create multiple runs
      await db.createRun({ ...mockRunData, status: 'passed', environment: 'staging' });
      await db.createRun({ ...mockRunData, status: 'failed', environment: 'local' });
      await db.createRun({ ...mockRunData, status: 'running', environment: 'local' });

      // Test status filter
      const passedRuns = await db.getRuns({ status: 'passed' });
      expect(passedRuns.runs).toHaveLength(1);
      expect(passedRuns.runs[0].status).toBe('passed');

      // Test environment filter
      const localRuns = await db.getRuns({ environment: 'local' });
      expect(localRuns.runs).toHaveLength(2);

      // Test pagination
      const firstPage = await db.getRuns({ limit: 2, page: 1 });
      expect(firstPage.runs).toHaveLength(2);
      expect(firstPage.hasMore).toBe(true);

      const secondPage = await db.getRuns({ limit: 2, page: 2 });
      expect(secondPage.runs).toHaveLength(1);
      expect(secondPage.hasMore).toBe(false);
    });

    test('should search runs', async () => {
      await db.createRun({ ...mockRunData, suiteName: 'Regression Tests' });
      await db.createRun({ ...mockRunData, suiteName: 'Smoke Tests' });

      const searchResults = await db.getRuns({ search: 'regression' });
      expect(searchResults.runs).toHaveLength(1);
      expect(searchResults.runs[0].suiteName).toBe('Regression Tests');
    });
  });

  describe('Test Steps', () => {
    let testRunId: string;

    beforeEach(async () => {
      const run = await db.createRun({
        suiteId: 'suite-123',
        suiteName: 'Test Suite',
        startedAt: new Date().toISOString(),
        status: 'running',
        environment: 'local',
        totals: { total: 1, passed: 0, failed: 0, skipped: 0 }
      });
      testRunId = run.id;
    });

    const mockStepData = {
      testName: 'Login Test',
      stepIndex: 0,
      actionName: 'Click login button',
      actionType: 'click',
      startedAt: new Date().toISOString(),
      status: 'passed' as const,
      retryCount: 0
    };

    test('should create a test step', async () => {
      const step = await db.createStep({
        ...mockStepData,
        runId: testRunId
      });

      expect(step.id).toBeDefined();
      expect(step.runId).toBe(testRunId);
      expect(step.testName).toBe(mockStepData.testName);
      expect(step.actionName).toBe(mockStepData.actionName);
      expect(step.stepIndex).toBe(mockStepData.stepIndex);
    });

    test('should get steps by run id', async () => {
      // Create multiple steps
      await db.createStep({ ...mockStepData, runId: testRunId, stepIndex: 0 });
      await db.createStep({ ...mockStepData, runId: testRunId, stepIndex: 1, status: 'failed' });
      await db.createStep({ ...mockStepData, runId: testRunId, stepIndex: 2 });

      const steps = await db.getStepsByRunId(testRunId);
      expect(steps).toHaveLength(3);
      expect(steps[0].stepIndex).toBe(0);
      expect(steps[1].stepIndex).toBe(1);
      expect(steps[2].stepIndex).toBe(2);
    });

    test('should filter steps', async () => {
      await db.createStep({ ...mockStepData, runId: testRunId, status: 'passed' });
      await db.createStep({ ...mockStepData, runId: testRunId, status: 'failed', errorMessage: 'Test error' });

      // Test status filter
      const failedSteps = await db.getStepsByRunId(testRunId, {
        status: ['failed'],
        actionTypes: [],
        hasError: false,
        hasScreenshot: false,
        duration: {}
      });
      expect(failedSteps).toHaveLength(1);
      expect(failedSteps[0].status).toBe('failed');

      // Test error filter
      const errorSteps = await db.getStepsByRunId(testRunId, {
        status: [],
        actionTypes: [],
        hasError: true,
        hasScreenshot: false,
        duration: {}
      });
      expect(errorSteps).toHaveLength(1);
      expect(errorSteps[0].errorMessage).toBe('Test error');
    });
  });

  describe('Artifacts', () => {
    let testRunId: string;
    let testStepId: string;

    beforeEach(async () => {
      const run = await db.createRun({
        suiteId: 'suite-123',
        suiteName: 'Test Suite',
        startedAt: new Date().toISOString(),
        status: 'running',
        environment: 'local',
        totals: { total: 1, passed: 0, failed: 0, skipped: 0 }
      });
      testRunId = run.id;

      const step = await db.createStep({
        runId: testRunId,
        testName: 'Test',
        stepIndex: 0,
        actionName: 'Action',
        startedAt: new Date().toISOString(),
        status: 'passed',
        retryCount: 0
      });
      testStepId = step.id;
    });

    const mockArtifactData = {
      artifactType: 'screenshot' as const,
      name: 'screenshot.png',
      filePath: '/path/to/screenshot.png',
      mimeType: 'image/png',
      fileSize: 1024
    };

    test('should create an artifact', async () => {
      const artifact = await db.createArtifact({
        ...mockArtifactData,
        runId: testRunId,
        stepId: testStepId
      });

      expect(artifact.id).toBeDefined();
      expect(artifact.runId).toBe(testRunId);
      expect(artifact.stepId).toBe(testStepId);
      expect(artifact.name).toBe(mockArtifactData.name);
      expect(artifact.artifactType).toBe(mockArtifactData.artifactType);
    });

    test('should get artifacts by run id', async () => {
      await db.createArtifact({ ...mockArtifactData, runId: testRunId, stepId: testStepId });
      await db.createArtifact({ 
        ...mockArtifactData, 
        runId: testRunId, 
        stepId: undefined, // Run-level artifact
        name: 'video.mp4',
        artifactType: 'video'
      });

      const allArtifacts = await db.getArtifactsByRunId(testRunId);
      expect(allArtifacts).toHaveLength(2);

      const stepArtifacts = await db.getArtifactsByRunId(testRunId, testStepId);
      expect(stepArtifacts).toHaveLength(1);
      expect(stepArtifacts[0].stepId).toBe(testStepId);
    });
  });

  describe('Console Logs', () => {
    let testRunId: string;

    beforeEach(async () => {
      const run = await db.createRun({
        suiteId: 'suite-123',
        suiteName: 'Test Suite',
        startedAt: new Date().toISOString(),
        status: 'running',
        environment: 'local',
        totals: { total: 1, passed: 0, failed: 0, skipped: 0 }
      });
      testRunId = run.id;
    });

    test('should create and retrieve console logs', async () => {
      const logData = {
        runId: testRunId,
        timestamp: new Date().toISOString(),
        level: 'error' as const,
        source: 'console',
        message: 'Test error message'
      };

      const log = await db.createConsoleLog(logData);
      expect(log.id).toBeDefined();
      expect(log.message).toBe(logData.message);

      const logs = await db.getConsoleLogsByRunId(testRunId);
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe(logData.message);
    });
  });

  describe('Network Logs', () => {
    let testRunId: string;

    beforeEach(async () => {
      const run = await db.createRun({
        suiteId: 'suite-123',
        suiteName: 'Test Suite',
        startedAt: new Date().toISOString(),
        status: 'running',
        environment: 'local',
        totals: { total: 1, passed: 0, failed: 0, skipped: 0 }
      });
      testRunId = run.id;
    });

    test('should create and retrieve network logs', async () => {
      const logData = {
        runId: testRunId,
        timestamp: new Date().toISOString(),
        method: 'GET',
        url: 'https://api.example.com/data',
        statusCode: 200,
        failed: false
      };

      const log = await db.createNetworkLog(logData);
      expect(log.id).toBeDefined();
      expect(log.url).toBe(logData.url);

      const logs = await db.getNetworkLogsByRunId(testRunId);
      expect(logs).toHaveLength(1);
      expect(logs[0].url).toBe(logData.url);
    });
  });

  describe('Statistics', () => {
    beforeEach(async () => {
      // Create test data for statistics
      await db.createRun({
        suiteId: 'suite-1',
        suiteName: 'Suite 1',
        startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        status: 'passed',
        environment: 'local',
        totals: { total: 10, passed: 9, failed: 1, skipped: 0 },
        duration: 30000
      });

      await db.createRun({
        suiteId: 'suite-2',
        suiteName: 'Suite 2',
        startedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
        status: 'failed',
        environment: 'staging',
        totals: { total: 5, passed: 2, failed: 3, skipped: 0 },
        duration: 45000
      });
    });

    test('should calculate run statistics', async () => {
      const stats = await db.getRunStatistics();

      expect(stats.totalRuns).toBe(2);
      expect(stats.passRate).toBeGreaterThan(0);
      expect(stats.averageDuration).toBeGreaterThan(0);
      expect(stats.environmentStats).toHaveLength(2);
      
      const localStats = stats.environmentStats.find(env => env.environment === 'local');
      expect(localStats?.runs).toBe(1);
      expect(localStats?.passRate).toBe(90); // 9/10 * 100
    });

    test('should filter statistics by date range', async () => {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

      const stats = await db.getRunStatistics({
        dateRange: {
          start: oneDayAgo,
          end: sixHoursAgo
        },
        status: [],
        environments: [],
        browsers: [],
        suites: [],
        branches: [],
        duration: {},
        passRate: {}
      });

      expect(stats.totalRuns).toBe(1); // Only the 12-hour-old run should match
    });
  });

  describe('Cleanup', () => {
    test('should delete old runs and return counts', async () => {
      const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000); // 40 days ago
      const recentDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago

      // Create old run
      const oldRun = await db.createRun({
        suiteId: 'suite-old',
        suiteName: 'Old Suite',
        startedAt: oldDate.toISOString(),
        status: 'passed',
        environment: 'local',
        totals: { total: 1, passed: 1, failed: 0, skipped: 0 }
      });

      // Create recent run
      await db.createRun({
        suiteId: 'suite-recent',
        suiteName: 'Recent Suite',
        startedAt: recentDate.toISOString(),
        status: 'passed',
        environment: 'local',
        totals: { total: 1, passed: 1, failed: 0, skipped: 0 }
      });

      // Create artifact for old run
      await db.createArtifact({
        runId: oldRun.id,
        artifactType: 'screenshot',
        name: 'old-screenshot.png',
        filePath: '/path/to/old-screenshot.png',
        mimeType: 'image/png'
      });

      const result = await db.cleanup(30); // Delete runs older than 30 days

      expect(result.runsDeleted).toBe(1);
      expect(result.artifactsDeleted).toBe(1);

      // Verify old run is deleted
      const oldRunCheck = await db.getRunById(oldRun.id);
      expect(oldRunCheck).toBeNull();

      // Verify recent run still exists
      const recentRuns = await db.getRuns({});
      expect(recentRuns.runs).toHaveLength(1);
      expect(recentRuns.runs[0].suiteName).toBe('Recent Suite');
    });
  });

  describe('Database Schema', () => {
    test('should handle database constraints', async () => {
      // Test foreign key constraint
      await expect(
        db.createStep({
          runId: 'non-existent-run',
          testName: 'Test',
          stepIndex: 0,
          actionName: 'Action',
          startedAt: new Date().toISOString(),
          status: 'passed',
          retryCount: 0
        })
      ).rejects.toThrow();
    });

    test('should handle invalid status values', async () => {
      await expect(
        db.createRun({
          suiteId: 'suite-123',
          suiteName: 'Test Suite',
          startedAt: new Date().toISOString(),
          status: 'invalid-status' as any,
          environment: 'local',
          totals: { total: 1, passed: 0, failed: 0, skipped: 0 }
        })
      ).rejects.toThrow();
    });
  });

  describe('Concurrent Operations', () => {
    test('should handle concurrent run creation', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        db.createRun({
          suiteId: `suite-${i}`,
          suiteName: `Suite ${i}`,
          startedAt: new Date().toISOString(),
          status: 'running',
          environment: 'local',
          totals: { total: 1, passed: 0, failed: 0, skipped: 0 }
        })
      );

      const runs = await Promise.all(promises);
      expect(runs).toHaveLength(5);
      
      const allRuns = await db.getRuns({});
      expect(allRuns.runs).toHaveLength(5);
    });
  });
});