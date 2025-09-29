// Integration tests for test runs API
import request from 'supertest';
import { TestDatabase } from '../setup/test-database';
import { TestHelpers } from '../helpers/test-helpers';
import { app } from '../../server-enterprise';

describe('Test Runs API', () => {
  let testDb: TestDatabase;
  let server: any;
  let authenticatedUser: any;

  beforeAll(async () => {
    testDb = new TestDatabase();
    await testDb.setup();
    TestHelpers.setDatabase(testDb);
    TestHelpers.setTestEnvironment();
    
    server = app.listen(0);
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
    await testDb.teardown();
  });

  beforeEach(async () => {
    await TestHelpers.clearAllTables();
    const seeded = await TestHelpers.seedMinimalData();
    authenticatedUser = seeded.adminUser;
  });

  describe('GET /api/test-runs', () => {
    it('should return paginated test runs for authenticated user', async () => {
      // Create some test runs
      const testRunData = TestHelpers.generateTestRunData({
        tenant_id: authenticatedUser.tenant_id,
        user_id: authenticatedUser.id
      });
      
      await testDb.insertTestRun(testRunData);

      const response = await request(app)
        .get('/api/test-runs')
        .set('Authorization', `Bearer ${authenticatedUser.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('runs');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.runs)).toBe(true);
      
      if (response.body.runs.length > 0) {
        TestHelpers.expectValidTestRun(response.body.runs[0]);
        expect(response.body.runs[0].tenant_id).toBe(authenticatedUser.tenant_id);
      }
    });

    it('should filter test runs by project name', async () => {
      // Create test runs with different project names
      await testDb.insertTestRun(TestHelpers.generateTestRunData({
        tenant_id: authenticatedUser.tenant_id,
        project_name: 'frontend-app'
      }));
      
      await testDb.insertTestRun(TestHelpers.generateTestRunData({
        tenant_id: authenticatedUser.tenant_id,
        project_name: 'backend-api'
      }));

      const response = await request(app)
        .get('/api/test-runs?project=frontend-app')
        .set('Authorization', `Bearer ${authenticatedUser.token}`)
        .expect(200);

      expect(response.body.runs).toHaveLength(1);
      expect(response.body.runs[0].project_name).toBe('frontend-app');
    });

    it('should filter test runs by status', async () => {
      await testDb.insertTestRun(TestHelpers.generateTestRunData({
        tenant_id: authenticatedUser.tenant_id,
        status: 'passed'
      }));
      
      await testDb.insertTestRun(TestHelpers.generateTestRunData({
        tenant_id: authenticatedUser.tenant_id,
        status: 'failed'
      }));

      const response = await request(app)
        .get('/api/test-runs?status=failed')
        .set('Authorization', `Bearer ${authenticatedUser.token}`)
        .expect(200);

      expect(response.body.runs).toHaveLength(1);
      expect(response.body.runs[0].status).toBe('failed');
    });

    it('should reject unauthorized requests', async () => {
      await request(app)
        .get('/api/test-runs')
        .expect(401);
    });

    it('should only return runs for user tenant', async () => {
      // Create test run for different tenant
      const otherTenantId = await testDb.insertTenant({
        name: 'Other Tenant',
        subdomain: 'other',
        plan: 'free'
      });

      await testDb.insertTestRun(TestHelpers.generateTestRunData({
        tenant_id: otherTenantId
      }));

      // Create test run for authenticated user's tenant
      await testDb.insertTestRun(TestHelpers.generateTestRunData({
        tenant_id: authenticatedUser.tenant_id
      }));

      const response = await request(app)
        .get('/api/test-runs')
        .set('Authorization', `Bearer ${authenticatedUser.token}`)
        .expect(200);

      expect(response.body.runs).toHaveLength(1);
      expect(response.body.runs[0].tenant_id).toBe(authenticatedUser.tenant_id);
    });
  });

  describe('GET /api/test-runs/:id', () => {
    it('should return specific test run with test cases', async () => {
      const testRunId = await testDb.insertTestRun(TestHelpers.generateTestRunData({
        tenant_id: authenticatedUser.tenant_id,
        user_id: authenticatedUser.id
      }));

      // Create test cases for this run
      const testCase1Data = TestHelpers.generateTestCaseData(testRunId, {
        tenant_id: authenticatedUser.tenant_id,
        name: 'should login successfully'
      });
      
      const testCase2Data = TestHelpers.generateTestCaseData(testRunId, {
        tenant_id: authenticatedUser.tenant_id,
        name: 'should display dashboard'
      });

      await testDb.query(`
        INSERT INTO test_cases (
          id, tenant_id, test_run_id, name, suite, file_path, status, duration_ms,
          error_message, stack_trace, annotations, steps, attachments, retry_count,
          browser, viewport, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      `, [
        testCase1Data.id, testCase1Data.tenant_id, testCase1Data.test_run_id,
        testCase1Data.name, testCase1Data.suite, testCase1Data.file_path,
        testCase1Data.status, testCase1Data.duration_ms, testCase1Data.error_message,
        testCase1Data.stack_trace, JSON.stringify(testCase1Data.annotations),
        JSON.stringify(testCase1Data.steps), JSON.stringify(testCase1Data.attachments),
        testCase1Data.retry_count, testCase1Data.browser, testCase1Data.viewport,
        new Date()
      ]);

      const response = await request(app)
        .get(`/api/test-runs/${testRunId}`)
        .set('Authorization', `Bearer ${authenticatedUser.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('run');
      expect(response.body).toHaveProperty('testCases');
      
      TestHelpers.expectValidTestRun(response.body.run);
      expect(response.body.run.id).toBe(testRunId);
      
      expect(Array.isArray(response.body.testCases)).toBe(true);
      expect(response.body.testCases.length).toBeGreaterThan(0);
      
      response.body.testCases.forEach((testCase: any) => {
        TestHelpers.expectValidTestCase(testCase);
        expect(testCase.test_run_id).toBe(testRunId);
      });
    });

    it('should return 404 for non-existent test run', async () => {
      const nonExistentId = '99999999-9999-9999-9999-999999999999';
      
      await request(app)
        .get(`/api/test-runs/${nonExistentId}`)
        .set('Authorization', `Bearer ${authenticatedUser.token}`)
        .expect(404);
    });

    it('should not allow access to other tenant test runs', async () => {
      const otherTenantId = await testDb.insertTenant({
        name: 'Other Tenant',
        subdomain: 'other',
        plan: 'free'
      });

      const testRunId = await testDb.insertTestRun(TestHelpers.generateTestRunData({
        tenant_id: otherTenantId
      }));

      await request(app)
        .get(`/api/test-runs/${testRunId}`)
        .set('Authorization', `Bearer ${authenticatedUser.token}`)
        .expect(403);
    });
  });

  describe('POST /api/test-runs', () => {
    it('should create a new test run', async () => {
      const newTestRunData = {
        project_name: 'new-project',
        branch: 'feature/test',
        commit_hash: TestHelpers.generateCommitHash(),
        metadata: {
          environment: 'staging',
          ci_provider: 'github',
          pull_request: '456'
        }
      };

      const response = await request(app)
        .post('/api/test-runs')
        .set('Authorization', `Bearer ${authenticatedUser.token}`)
        .send(newTestRunData)
        .expect(201);

      expect(response.body).toHaveProperty('run');
      TestHelpers.expectValidTestRun(response.body.run);
      
      expect(response.body.run.project_name).toBe(newTestRunData.project_name);
      expect(response.body.run.branch).toBe(newTestRunData.branch);
      expect(response.body.run.commit_hash).toBe(newTestRunData.commit_hash);
      expect(response.body.run.status).toBe('running');
      expect(response.body.run.tenant_id).toBe(authenticatedUser.tenant_id);
      expect(response.body.run.user_id).toBe(authenticatedUser.id);
    });

    it('should reject invalid project name', async () => {
      const invalidData = {
        project_name: '', // Empty name
        branch: 'main'
      };

      await request(app)
        .post('/api/test-runs')
        .set('Authorization', `Bearer ${authenticatedUser.token}`)
        .send(invalidData)
        .expect(400);
    });

    it('should reject invalid commit hash format', async () => {
      const invalidData = {
        project_name: 'test-project',
        branch: 'main',
        commit_hash: 'invalid-hash'
      };

      await request(app)
        .post('/api/test-runs')
        .set('Authorization', `Bearer ${authenticatedUser.token}`)
        .send(invalidData)
        .expect(400);
    });
  });

  describe('PUT /api/test-runs/:id', () => {
    let testRunId: string;

    beforeEach(async () => {
      testRunId = await testDb.insertTestRun(TestHelpers.generateTestRunData({
        tenant_id: authenticatedUser.tenant_id,
        user_id: authenticatedUser.id,
        status: 'running'
      }));
    });

    it('should update test run status and metrics', async () => {
      const updateData = {
        status: 'passed',
        total_tests: 150,
        passed_tests: 145,
        failed_tests: 3,
        skipped_tests: 2,
        duration_ms: 180000
      };

      const response = await request(app)
        .put(`/api/test-runs/${testRunId}`)
        .set('Authorization', `Bearer ${authenticatedUser.token}`)
        .send(updateData)
        .expect(200);

      expect(response.body.run.status).toBe(updateData.status);
      expect(response.body.run.total_tests).toBe(updateData.total_tests);
      expect(response.body.run.passed_tests).toBe(updateData.passed_tests);
      expect(response.body.run.failed_tests).toBe(updateData.failed_tests);
      expect(response.body.run.skipped_tests).toBe(updateData.skipped_tests);
      expect(response.body.run.duration_ms).toBe(updateData.duration_ms);
      expect(response.body.run.completed_at).toBeTruthy();
    });

    it('should validate test count consistency', async () => {
      const invalidData = {
        total_tests: 100,
        passed_tests: 80,
        failed_tests: 30, // This would exceed total_tests
        skipped_tests: 5
      };

      await request(app)
        .put(`/api/test-runs/${testRunId}`)
        .set('Authorization', `Bearer ${authenticatedUser.token}`)
        .send(invalidData)
        .expect(400);
    });

    it('should not allow updating other tenant test runs', async () => {
      const otherTenantId = await testDb.insertTenant({
        name: 'Other Tenant',
        subdomain: 'other',
        plan: 'free'
      });

      const otherTestRunId = await testDb.insertTestRun(TestHelpers.generateTestRunData({
        tenant_id: otherTenantId
      }));

      await request(app)
        .put(`/api/test-runs/${otherTestRunId}`)
        .set('Authorization', `Bearer ${authenticatedUser.token}`)
        .send({ status: 'passed' })
        .expect(403);
    });
  });

  describe('DELETE /api/test-runs/:id', () => {
    let testRunId: string;

    beforeEach(async () => {
      testRunId = await testDb.insertTestRun(TestHelpers.generateTestRunData({
        tenant_id: authenticatedUser.tenant_id,
        user_id: authenticatedUser.id
      }));
    });

    it('should delete test run (admin only)', async () => {
      await request(app)
        .delete(`/api/test-runs/${testRunId}`)
        .set('Authorization', `Bearer ${authenticatedUser.token}`)
        .expect(204);

      // Verify deletion
      const checkResponse = await request(app)
        .get(`/api/test-runs/${testRunId}`)
        .set('Authorization', `Bearer ${authenticatedUser.token}`)
        .expect(404);
    });

    it('should reject deletion by non-admin user', async () => {
      const seeded = await TestHelpers.seedMinimalData();
      const regularUser = seeded.regularUser;

      await request(app)
        .delete(`/api/test-runs/${testRunId}`)
        .set('Authorization', `Bearer ${regularUser.token}`)
        .expect(403);
    });
  });

  describe('GET /api/test-runs/analytics/summary', () => {
    beforeEach(async () => {
      // Create test runs with different statuses
      const testRuns = [
        { status: 'passed', total_tests: 100, passed_tests: 95, failed_tests: 5 },
        { status: 'failed', total_tests: 80, passed_tests: 70, failed_tests: 10 },
        { status: 'passed', total_tests: 120, passed_tests: 118, failed_tests: 2 },
      ];

      for (const runData of testRuns) {
        await testDb.insertTestRun(TestHelpers.generateTestRunData({
          tenant_id: authenticatedUser.tenant_id,
          ...runData
        }));
      }
    });

    it('should return analytics summary', async () => {
      const response = await request(app)
        .get('/api/test-runs/analytics/summary')
        .set('Authorization', `Bearer ${authenticatedUser.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalRuns');
      expect(response.body).toHaveProperty('passRate');
      expect(response.body).toHaveProperty('averageDuration');
      expect(response.body).toHaveProperty('statusDistribution');
      
      expect(response.body.totalRuns).toBe(3);
      expect(response.body.statusDistribution).toHaveProperty('passed');
      expect(response.body.statusDistribution).toHaveProperty('failed');
    });

    it('should filter analytics by date range', async () => {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 7); // Last 7 days
      
      const response = await request(app)
        .get(`/api/test-runs/analytics/summary?from=${fromDate.toISOString()}`)
        .set('Authorization', `Bearer ${authenticatedUser.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalRuns');
      expect(typeof response.body.totalRuns).toBe('number');
    });
  });

  describe('Performance Tests', () => {
    it('should handle large result sets efficiently', async () => {
      // Create 1000 test runs
      const testRuns = Array.from({ length: 100 }, () => 
        TestHelpers.generateTestRunData({
          tenant_id: authenticatedUser.tenant_id
        })
      );

      // Insert in batches to avoid overwhelming the database
      for (let i = 0; i < testRuns.length; i += 10) {
        const batch = testRuns.slice(i, i + 10);
        await Promise.all(batch.map(run => testDb.insertTestRun(run)));
      }

      const { result, duration } = await TestHelpers.measureExecutionTime(async () => {
        return request(app)
          .get('/api/test-runs?limit=50')
          .set('Authorization', `Bearer ${authenticatedUser.token}`)
          .expect(200);
      });

      expect(result.body.runs).toHaveLength(50);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});