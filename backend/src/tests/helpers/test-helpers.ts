// Test helper utilities for comprehensive testing
import { randomUUID } from 'crypto';
import { sign } from 'jsonwebtoken';
import { TestDatabase } from '../setup/test-database';
import { userFixtures, tenantFixtures } from '../fixtures/database-fixtures';

export interface TestUser {
  id: string;
  tenant_id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'user' | 'viewer';
  token?: string;
}

export interface TestTenant {
  id: string;
  name: string;
  subdomain: string;
  plan: 'free' | 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'suspended' | 'cancelled';
}

export class TestHelpers {
  private static db: TestDatabase;
  private static jwtSecret = 'test-jwt-secret-for-testing-only';

  static setDatabase(database: TestDatabase) {
    this.db = database;
  }

  // Authentication helpers
  static generateJwtToken(payload: any, expiresIn: string = '1h'): string {
    return sign(payload, this.jwtSecret, { expiresIn });
  }

  static createAuthenticatedUser(
    userOverrides: Partial<TestUser> = {},
    tenantOverrides: Partial<TestTenant> = {}
  ): TestUser & { tenant: TestTenant } {
    const tenant = {
      ...tenantFixtures[0],
      ...tenantOverrides
    };

    const user = {
      ...userFixtures[0],
      tenant_id: tenant.id,
      ...userOverrides
    };

    const token = this.generateJwtToken({
      userId: user.id,
      tenantId: user.tenant_id,
      role: user.role,
      email: user.email
    });

    return {
      ...user,
      token,
      tenant
    };
  }

  static getAuthHeaders(token: string): Record<string, string> {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  static getApiKeyHeaders(apiKey: string): Record<string, string> {
    return {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json'
    };
  }

  // Database helpers
  static async clearAllTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const tables = [
      'traces', 'test_cases', 'test_runs', 'browser_sessions',
      'api_keys', 'users', 'tenants'
    ];

    for (const table of tables) {
      await this.db.clearTable(table);
    }
  }

  static async seedMinimalData(): Promise<{
    tenant: TestTenant;
    adminUser: TestUser;
    regularUser: TestUser;
  }> {
    if (!this.db) throw new Error('Database not initialized');

    const tenant = tenantFixtures[0];
    const adminUser = userFixtures[0];
    const regularUser = userFixtures[2];

    await this.db.insertTenant(tenant);
    await this.db.insertUser(adminUser);
    await this.db.insertUser(regularUser);

    return {
      tenant,
      adminUser: {
        ...adminUser,
        token: this.generateJwtToken({
          userId: adminUser.id,
          tenantId: adminUser.tenant_id,
          role: adminUser.role,
          email: adminUser.email
        })
      },
      regularUser: {
        ...regularUser,
        token: this.generateJwtToken({
          userId: regularUser.id,
          tenantId: regularUser.tenant_id,
          role: regularUser.role,
          email: regularUser.email
        })
      }
    };
  }

  // Data generators
  static generateTestRunData(overrides: any = {}) {
    return {
      id: randomUUID(),
      project_name: 'test-project',
      branch: 'main',
      commit_hash: this.generateCommitHash(),
      status: 'running',
      total_tests: 100,
      passed_tests: 0,
      failed_tests: 0,
      skipped_tests: 0,
      duration_ms: 0,
      metadata: {
        environment: 'test',
        ci_provider: 'github',
        pull_request: '123'
      },
      artifacts: [],
      started_at: new Date(),
      completed_at: null,
      ...overrides
    };
  }

  static generateTestCaseData(testRunId: string, overrides: any = {}) {
    return {
      id: randomUUID(),
      test_run_id: testRunId,
      name: 'sample test case',
      suite: 'Sample Suite',
      file_path: 'tests/sample.spec.ts',
      status: 'passed',
      duration_ms: 1000,
      error_message: null,
      stack_trace: null,
      annotations: [],
      steps: [
        { name: 'Navigate to page', duration_ms: 300 },
        { name: 'Perform action', duration_ms: 700 }
      ],
      attachments: [],
      retry_count: 0,
      browser: 'chromium',
      viewport: '1920x1080',
      ...overrides
    };
  }

  static generateCommitHash(): string {
    return Array.from({ length: 40 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }

  // Validation helpers
  static validateUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validateCommitHash(hash: string): boolean {
    return /^[a-f0-9]{40}$/.test(hash);
  }

  // Assertion helpers
  static expectValidTestRun(testRun: any): void {
    expect(testRun).toHaveProperty('id');
    expect(this.validateUUID(testRun.id)).toBe(true);
    expect(testRun).toHaveProperty('project_name');
    expect(testRun).toHaveProperty('status');
    expect(['running', 'passed', 'failed', 'cancelled', 'timeout']).toContain(testRun.status);
    expect(testRun.total_tests).toBeGreaterThanOrEqual(0);
    expect(testRun.passed_tests).toBeGreaterThanOrEqual(0);
    expect(testRun.failed_tests).toBeGreaterThanOrEqual(0);
    expect(testRun.skipped_tests).toBeGreaterThanOrEqual(0);
  }

  static expectValidTestCase(testCase: any): void {
    expect(testCase).toHaveProperty('id');
    expect(this.validateUUID(testCase.id)).toBe(true);
    expect(testCase).toHaveProperty('name');
    expect(testCase).toHaveProperty('status');
    expect(['passed', 'failed', 'skipped', 'timedout']).toContain(testCase.status);
    expect(testCase.duration_ms).toBeGreaterThanOrEqual(0);
    expect(testCase.retry_count).toBeGreaterThanOrEqual(0);
  }

  static expectValidUser(user: any): void {
    expect(user).toHaveProperty('id');
    expect(this.validateUUID(user.id)).toBe(true);
    expect(user).toHaveProperty('email');
    expect(this.validateEmail(user.email)).toBe(true);
    expect(user).toHaveProperty('role');
    expect(['admin', 'manager', 'user', 'viewer']).toContain(user.role);
    expect(user).toHaveProperty('is_active');
    expect(typeof user.is_active).toBe('boolean');
  }

  static expectValidTenant(tenant: any): void {
    expect(tenant).toHaveProperty('id');
    expect(this.validateUUID(tenant.id)).toBe(true);
    expect(tenant).toHaveProperty('subdomain');
    expect(tenant.subdomain).toMatch(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/);
    expect(tenant).toHaveProperty('plan');
    expect(['free', 'starter', 'professional', 'enterprise']).toContain(tenant.plan);
    expect(tenant).toHaveProperty('status');
    expect(['active', 'suspended', 'cancelled']).toContain(tenant.status);
  }

  // Performance testing helpers
  static async measureExecutionTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const start = process.hrtime.bigint();
    const result = await fn();
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1_000_000; // Convert to milliseconds
    
    return { result, duration };
  }

  static generateBulkData(count: number) {
    const tenants = Array.from({ length: Math.ceil(count / 100) }, (_, i) => ({
      id: randomUUID(),
      name: `Test Tenant ${i + 1}`,
      subdomain: `test-tenant-${i + 1}`,
      plan: ['free', 'starter', 'professional', 'enterprise'][i % 4] as any,
      status: 'active' as any,
      settings: {}
    }));

    const users = tenants.flatMap((tenant, tenantIndex) => 
      Array.from({ length: 10 }, (_, userIndex) => ({
        id: randomUUID(),
        tenant_id: tenant.id,
        email: `user${tenantIndex * 10 + userIndex}@test.com`,
        password_hash: '$2a$12$rQvK7sL8YQHfDcVgmRfpQeLF7lJ5zN5GxP3fKsH6l.Lx8KZN6xGDG',
        name: `Test User ${tenantIndex * 10 + userIndex}`,
        role: ['admin', 'manager', 'user', 'viewer'][userIndex % 4] as any,
        is_active: true,
        settings: {}
      }))
    );

    const testRuns = Array.from({ length: count }, (_, i) => ({
      id: randomUUID(),
      tenant_id: tenants[i % tenants.length].id,
      user_id: users[i % users.length].id,
      project_name: `project-${i % 20}`,
      branch: ['main', 'develop', 'feature/test'][i % 3],
      commit_hash: this.generateCommitHash(),
      status: ['passed', 'failed', 'running'][i % 3] as any,
      total_tests: Math.floor(Math.random() * 200) + 50,
      passed_tests: Math.floor(Math.random() * 150) + 40,
      failed_tests: Math.floor(Math.random() * 20),
      skipped_tests: Math.floor(Math.random() * 10),
      duration_ms: Math.floor(Math.random() * 300000) + 30000,
      metadata: {
        environment: ['test', 'staging', 'production'][i % 3],
        ci_provider: ['github', 'gitlab', 'jenkins'][i % 3]
      },
      artifacts: [],
      started_at: new Date(Date.now() - Math.random() * 86400000 * 7), // Last 7 days
      completed_at: new Date()
    }));

    return { tenants, users, testRuns };
  }

  // Mock data for external services
  static mockSupabaseResponse(success: boolean = true, data: any = null) {
    return success 
      ? { data, error: null }
      : { data: null, error: { message: 'Mock error', status: 500 } };
  }

  static mockRedisClient() {
    const store = new Map<string, string>();
    
    return {
      get: jest.fn((key: string) => Promise.resolve(store.get(key) || null)),
      set: jest.fn((key: string, value: string, options?: any) => {
        store.set(key, value);
        return Promise.resolve('OK');
      }),
      del: jest.fn((key: string) => {
        const existed = store.has(key);
        store.delete(key);
        return Promise.resolve(existed ? 1 : 0);
      }),
      exists: jest.fn((key: string) => Promise.resolve(store.has(key) ? 1 : 0)),
      flushall: jest.fn(() => {
        store.clear();
        return Promise.resolve('OK');
      })
    };
  }

  // Test environment helpers
  static setTestEnvironment(): void {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = this.jwtSecret;
    process.env.LOG_LEVEL = 'error';
    process.env.REDIS_URL = 'redis://localhost:6379/1'; // Use test database
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/playwright_test';
  }

  static isCI(): boolean {
    return !!(process.env.CI || process.env.CONTINUOUS_INTEGRATION);
  }

  static skipIfNoDatabase(): void {
    if (!process.env.TEST_DATABASE_URL && !process.env.TEST_DB_HOST) {
      console.warn('Skipping test: No test database configuration found');
      return;
    }
  }

  // Cleanup helpers
  static async cleanupTestFiles(directory: string): Promise<void> {
    const { promises: fs } = require('fs');
    const { join } = require('path');
    
    try {
      const files = await fs.readdir(directory);
      const testFiles = files.filter((f: string) => f.includes('test-'));
      
      for (const file of testFiles) {
        await fs.unlink(join(directory, file));
      }
    } catch (error) {
      // Directory doesn't exist or other error - safe to ignore in tests
    }
  }

  static async waitFor(condition: () => boolean | Promise<boolean>, timeout: number = 5000): Promise<void> {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  }
}