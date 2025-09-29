import request from 'supertest';
import express from 'express';
import { createTraceRouter } from '../routes/trace';
import { TraceDatabase } from '../database/trace-database';
import { join } from 'path';
import { promises as fs } from 'fs';

// Mock the database and services
jest.mock('../database/trace-database');
jest.mock('../services/artifact-manager');
jest.mock('../services/playwright-trace-parser');

const MockTraceDatabase = TraceDatabase as jest.MockedClass<typeof TraceDatabase>;

describe('Trace Routes', () => {
  let app: express.Application;
  let mockDb: jest.Mocked<TraceDatabase>;

  beforeEach(() => {
    // Setup Express app with trace routes
    app = express();
    app.use(express.json());
    
    // Create mock database instance
    mockDb = new MockTraceDatabase() as jest.Mocked<TraceDatabase>;
    
    // Mock the database constructor to return our mock
    MockTraceDatabase.mockImplementation(() => mockDb);
    
    app.use('/api/reports', createTraceRouter());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/reports/runs', () => {
    const mockRuns = [
      {
        id: 'run-1',
        suiteId: 'suite-1',
        suiteName: 'Test Suite 1',
        startedAt: '2024-01-01T10:00:00.000Z',
        status: 'passed',
        environment: 'local',
        totals: { total: 10, passed: 9, failed: 1, skipped: 0 },
        passRate: 90,
        createdAt: '2024-01-01T10:00:00.000Z',
        updatedAt: '2024-01-01T10:30:00.000Z'
      },
      {
        id: 'run-2',
        suiteId: 'suite-2',
        suiteName: 'Test Suite 2',
        startedAt: '2024-01-01T11:00:00.000Z',
        status: 'failed',
        environment: 'staging',
        totals: { total: 5, passed: 2, failed: 3, skipped: 0 },
        passRate: 40,
        createdAt: '2024-01-01T11:00:00.000Z',
        updatedAt: '2024-01-01T11:20:00.000Z'
      }
    ];

    test('should return paginated runs', async () => {
      mockDb.getRuns.mockResolvedValue({
        runs: mockRuns,
        total: 2,
        page: 1,
        limit: 50,
        hasMore: false
      });

      const response = await request(app)
        .get('/api/reports/runs')
        .expect(200);

      expect(response.body.runs).toHaveLength(2);
      expect(response.body.total).toBe(2);
      expect(response.body.hasMore).toBe(false);
      expect(mockDb.getRuns).toHaveBeenCalledWith({
        page: 1,
        limit: 50
      });
    });

    test('should handle query parameters', async () => {
      mockDb.getRuns.mockResolvedValue({
        runs: [mockRuns[0]],
        total: 1,
        page: 1,
        limit: 10,
        hasMore: false
      });

      await request(app)
        .get('/api/reports/runs')
        .query({
          status: 'passed',
          environment: 'local',
          limit: '10',
          search: 'suite'
        })
        .expect(200);

      expect(mockDb.getRuns).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        status: 'passed',
        environment: 'local',
        search: 'suite'
      });
    });

    test('should validate query parameters', async () => {
      const response = await request(app)
        .get('/api/reports/runs')
        .query({ limit: '200' }) // Exceeds max limit
        .expect(400);

      expect(response.body.error).toContain('Invalid query parameters');
    });
  });

  describe('GET /api/reports/runs/:runId', () => {
    const mockRunDetail = {
      run: mockRuns[0],
      steps: [
        {
          id: 'step-1',
          runId: 'run-1',
          testName: 'Login Test',
          stepIndex: 0,
          actionName: 'Click login button',
          startedAt: '2024-01-01T10:01:00.000Z',
          status: 'passed',
          retryCount: 0,
          createdAt: '2024-01-01T10:01:00.000Z'
        }
      ],
      artifacts: [
        {
          id: 'artifact-1',
          runId: 'run-1',
          stepId: 'step-1',
          artifactType: 'screenshot',
          name: 'screenshot.png',
          filePath: '/path/to/screenshot.png',
          mimeType: 'image/png',
          createdAt: '2024-01-01T10:01:30.000Z'
        }
      ]
    };

    test('should return run details with steps and artifacts', async () => {
      mockDb.getRunById.mockResolvedValue(mockRunDetail.run as any);
      mockDb.getStepsByRunId.mockResolvedValue(mockRunDetail.steps as any);
      mockDb.getArtifactsByRunId.mockResolvedValue(mockRunDetail.artifacts as any);

      const response = await request(app)
        .get('/api/reports/runs/run-1')
        .expect(200);

      expect(response.body.run).toEqual(mockRunDetail.run);
      expect(response.body.steps).toEqual(mockRunDetail.steps);
      expect(response.body.artifacts).toEqual(mockRunDetail.artifacts);
    });

    test('should return 404 for non-existent run', async () => {
      mockDb.getRunById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/reports/runs/non-existent')
        .expect(404);

      expect(response.body.error).toBe('Run not found');
    });

    test('should respect include options', async () => {
      mockDb.getRunById.mockResolvedValue(mockRunDetail.run as any);

      await request(app)
        .get('/api/reports/runs/run-1')
        .query({
          includeSteps: 'false',
          includeArtifacts: 'true',
          includeLogs: 'false'
        })
        .expect(200);

      expect(mockDb.getStepsByRunId).not.toHaveBeenCalled();
      expect(mockDb.getArtifactsByRunId).toHaveBeenCalledWith('run-1');
      expect(mockDb.getConsoleLogsByRunId).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/reports/runs', () => {
    const validRunData = {
      suiteId: 'suite-123',
      suiteName: 'New Test Suite',
      environment: 'local',
      browser: 'chromium',
      testMode: 'headless'
    };

    test('should create a new run', async () => {
      const createdRun = {
        id: 'run-123',
        ...validRunData,
        startedAt: '2024-01-01T10:00:00.000Z',
        status: 'queued',
        totals: { total: 0, passed: 0, failed: 0, skipped: 0 },
        passRate: 0,
        createdAt: '2024-01-01T10:00:00.000Z',
        updatedAt: '2024-01-01T10:00:00.000Z'
      };

      mockDb.createRun.mockResolvedValue(createdRun as any);

      const response = await request(app)
        .post('/api/reports/runs')
        .send(validRunData)
        .expect(201);

      expect(response.body.id).toBe('run-123');
      expect(response.body.suiteName).toBe(validRunData.suiteName);
      expect(mockDb.createRun).toHaveBeenCalledWith(
        expect.objectContaining({
          ...validRunData,
          status: 'queued',
          totals: { total: 0, passed: 0, failed: 0, skipped: 0 }
        })
      );
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/reports/runs')
        .send({ suiteName: 'Missing suite ID' })
        .expect(400);

      expect(response.body.error).toContain('Invalid run data');
    });

    test('should handle database errors', async () => {
      mockDb.createRun.mockRejectedValue(new Error('Database error'));

      await request(app)
        .post('/api/reports/runs')
        .send(validRunData)
        .expect(400);
    });
  });

  describe('PATCH /api/reports/runs/:runId', () => {
    test('should update run', async () => {
      const updatedRun = {
        id: 'run-1',
        status: 'completed',
        finishedAt: '2024-01-01T10:30:00.000Z'
      };

      mockDb.updateRun.mockResolvedValue(updatedRun as any);

      const response = await request(app)
        .patch('/api/reports/runs/run-1')
        .send({ status: 'completed', finishedAt: updatedRun.finishedAt })
        .expect(200);

      expect(response.body.status).toBe('completed');
      expect(mockDb.updateRun).toHaveBeenCalledWith('run-1', {
        status: 'completed',
        finishedAt: updatedRun.finishedAt
      });
    });

    test('should return 404 for non-existent run', async () => {
      mockDb.updateRun.mockResolvedValue(null);

      await request(app)
        .patch('/api/reports/runs/non-existent')
        .send({ status: 'completed' })
        .expect(404);
    });
  });

  describe('DELETE /api/reports/runs/:runId', () => {
    test('should delete run and its artifacts', async () => {
      mockDb.getRunById.mockResolvedValue({ id: 'run-1' } as any);
      mockDb.getArtifactsByRunId.mockResolvedValue([]);
      mockDb.deleteRun.mockResolvedValue(undefined);

      await request(app)
        .delete('/api/reports/runs/run-1')
        .expect(204);

      expect(mockDb.deleteRun).toHaveBeenCalledWith('run-1');
    });

    test('should return 404 for non-existent run', async () => {
      mockDb.getRunById.mockResolvedValue(null);

      await request(app)
        .delete('/api/reports/runs/non-existent')
        .expect(404);
    });
  });

  describe('GET /api/reports/runs/:runId/steps', () => {
    test('should return filtered steps', async () => {
      const mockSteps = [
        {
          id: 'step-1',
          runId: 'run-1',
          status: 'passed',
          actionType: 'click'
        },
        {
          id: 'step-2',
          runId: 'run-1',
          status: 'failed',
          actionType: 'fill'
        }
      ];

      mockDb.getStepsByRunId.mockResolvedValue(mockSteps as any);

      const response = await request(app)
        .get('/api/reports/runs/run-1/steps')
        .query({ status: 'failed' })
        .expect(200);

      expect(mockDb.getStepsByRunId).toHaveBeenCalledWith('run-1', 
        expect.objectContaining({
          status: ['failed']
        })
      );
    });
  });

  describe('POST /api/reports/runs/:runId/rerun', () => {
    test('should create rerun', async () => {
      const originalRun = {
        id: 'run-1',
        suiteId: 'suite-1',
        suiteName: 'Original Suite',
        duration: 30000
      };

      const newRun = {
        id: 'run-2',
        suiteName: 'Original Suite (Rerun)'
      };

      mockDb.getRunById.mockResolvedValue(originalRun as any);
      mockDb.createRun.mockResolvedValue(newRun as any);

      const response = await request(app)
        .post('/api/reports/runs/run-1/rerun')
        .send({ environment: 'staging' })
        .expect(200);

      expect(response.body.newRunId).toBe('run-2');
      expect(response.body.status).toBe('queued');
      expect(mockDb.createRun).toHaveBeenCalledWith(
        expect.objectContaining({
          suiteName: 'Original Suite (Rerun)',
          environment: 'staging'
        })
      );
    });

    test('should return 404 for non-existent original run', async () => {
      mockDb.getRunById.mockResolvedValue(null);

      await request(app)
        .post('/api/reports/runs/non-existent/rerun')
        .send({})
        .expect(404);
    });
  });

  describe('GET /api/reports/stats', () => {
    test('should return statistics', async () => {
      const mockStats = {
        totalRuns: 10,
        passRate: 85.5,
        averageDuration: 45000,
        mostFailedTests: [
          { testName: 'Login Test', failureCount: 3 }
        ],
        environmentStats: [
          { environment: 'local', runs: 5, passRate: 90 },
          { environment: 'staging', runs: 5, passRate: 80 }
        ],
        browserStats: [],
        trendData: []
      };

      mockDb.getRunStatistics.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/reports/stats')
        .expect(200);

      expect(response.body).toEqual(mockStats);
    });

    test('should handle filtered statistics', async () => {
      mockDb.getRunStatistics.mockResolvedValue({} as any);

      await request(app)
        .get('/api/reports/stats')
        .query({
          status: 'passed',
          environments: 'local,staging',
          startDate: '2024-01-01T00:00:00.000Z'
        })
        .expect(200);

      expect(mockDb.getRunStatistics).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ['passed'],
          environments: ['local', 'staging'],
          dateRange: { start: '2024-01-01T00:00:00.000Z' }
        })
      );
    });
  });

  describe('POST /api/reports/cleanup', () => {
    test('should cleanup old runs', async () => {
      const cleanupResult = {
        runsDeleted: 5,
        artifactsDeleted: 15
      };

      mockDb.cleanup.mockResolvedValue(cleanupResult);

      const response = await request(app)
        .post('/api/reports/cleanup')
        .send({ daysOld: 60 })
        .expect(200);

      expect(response.body).toEqual(cleanupResult);
      expect(mockDb.cleanup).toHaveBeenCalledWith(60);
    });

    test('should use default days if not provided', async () => {
      mockDb.cleanup.mockResolvedValue({ runsDeleted: 0, artifactsDeleted: 0 });

      await request(app)
        .post('/api/reports/cleanup')
        .send({})
        .expect(200);

      expect(mockDb.cleanup).toHaveBeenCalledWith(30);
    });
  });

  describe('Error Handling', () => {
    test('should handle database connection errors', async () => {
      mockDb.getRuns.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/reports/runs')
        .expect(500);

      expect(response.body.error).toBe('Failed to get runs');
    });

    test('should handle invalid JSON in request body', async () => {
      const response = await request(app)
        .post('/api/reports/runs')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
    });

    test('should handle missing required parameters', async () => {
      const response = await request(app)
        .get('/api/reports/runs/') // Missing runId
        .expect(404);
    });
  });

  describe('Input Validation', () => {
    test('should validate run status values', async () => {
      const response = await request(app)
        .post('/api/reports/runs')
        .send({
          suiteId: 'suite-123',
          suiteName: 'Test Suite',
          status: 'invalid-status' // Invalid status
        })
        .expect(400);

      expect(response.body.error).toContain('Invalid run data');
    });

    test('should validate browser values', async () => {
      const response = await request(app)
        .post('/api/reports/runs/run-1/rerun')
        .send({
          browser: 'invalid-browser' // Invalid browser
        })
        .expect(400);
    });

    test('should validate date formats', async () => {
      mockDb.getRuns.mockResolvedValue({ runs: [], total: 0, page: 1, limit: 50, hasMore: false });

      const response = await request(app)
        .get('/api/reports/runs')
        .query({
          startDate: 'invalid-date'
        })
        .expect(400);
    });
  });

  describe('Security', () => {
    test('should handle SQL injection attempts', async () => {
      mockDb.getRuns.mockResolvedValue({ runs: [], total: 0, page: 1, limit: 50, hasMore: false });

      // Attempt SQL injection in search parameter
      await request(app)
        .get('/api/reports/runs')
        .query({
          search: "'; DROP TABLE runs; --"
        })
        .expect(200);

      // Should not crash or cause issues
      expect(mockDb.getRuns).toHaveBeenCalled();
    });

    test('should handle path traversal attempts in runId', async () => {
      mockDb.getRunById.mockResolvedValue(null);

      await request(app)
        .get('/api/reports/runs/../../../etc/passwd')
        .expect(404);
    });
  });
});