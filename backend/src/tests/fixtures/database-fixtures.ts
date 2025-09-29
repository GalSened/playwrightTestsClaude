// Database fixtures for comprehensive testing
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';

export interface TenantFixture {
  id: string;
  name: string;
  subdomain: string;
  plan: 'free' | 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'suspended' | 'cancelled';
  settings: Record<string, any>;
}

export interface UserFixture {
  id: string;
  tenant_id: string;
  email: string;
  password: string;
  password_hash: string;
  name: string;
  role: 'admin' | 'manager' | 'user' | 'viewer';
  is_active: boolean;
  settings: Record<string, any>;
}

export interface TestRunFixture {
  id: string;
  tenant_id: string;
  user_id: string;
  project_name: string;
  branch: string;
  commit_hash: string;
  status: 'running' | 'passed' | 'failed' | 'cancelled' | 'timeout';
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  skipped_tests: number;
  duration_ms: number;
  metadata: Record<string, any>;
  artifacts: any[];
  started_at: Date;
  completed_at: Date | null;
}

export interface TestCaseFixture {
  id: string;
  tenant_id: string;
  test_run_id: string;
  name: string;
  suite: string;
  file_path: string;
  status: 'passed' | 'failed' | 'skipped' | 'timedout';
  duration_ms: number;
  error_message: string | null;
  stack_trace: string | null;
  annotations: any[];
  steps: any[];
  attachments: any[];
  retry_count: number;
  browser: string;
  viewport: string;
}

export interface ApiKeyFixture {
  id: string;
  tenant_id: string;
  user_id: string;
  name: string;
  key_hash: string;
  actual_key: string; // For testing purposes only
  permissions: any[];
  is_active: boolean;
  expires_at: Date | null;
}

// Base tenant fixtures
export const tenantFixtures: TenantFixture[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Acme Corporation',
    subdomain: 'acme',
    plan: 'enterprise',
    status: 'active',
    settings: {
      features: ['advanced_analytics', 'custom_integrations'],
      limits: { concurrent_runs: 50, storage_gb: 1000 }
    }
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'StartupCo',
    subdomain: 'startup',
    plan: 'professional',
    status: 'active',
    settings: {
      features: ['basic_analytics'],
      limits: { concurrent_runs: 10, storage_gb: 100 }
    }
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'FreeTier User',
    subdomain: 'freetier',
    plan: 'free',
    status: 'active',
    settings: {
      features: [],
      limits: { concurrent_runs: 2, storage_gb: 5 }
    }
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    name: 'Suspended Company',
    subdomain: 'suspended',
    plan: 'starter',
    status: 'suspended',
    settings: {
      features: [],
      limits: { concurrent_runs: 5, storage_gb: 25 }
    }
  }
];

// User fixtures (passwords are all 'testpass123')
const passwordHash = bcrypt.hashSync('testpass123', 12);

export const userFixtures: UserFixture[] = [
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    tenant_id: '11111111-1111-1111-1111-111111111111',
    email: 'admin@acme.com',
    password: 'testpass123',
    password_hash: passwordHash,
    name: 'Alice Admin',
    role: 'admin',
    is_active: true,
    settings: { theme: 'dark', language: 'en' }
  },
  {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    tenant_id: '11111111-1111-1111-1111-111111111111',
    email: 'manager@acme.com',
    password: 'testpass123',
    password_hash: passwordHash,
    name: 'Bob Manager',
    role: 'manager',
    is_active: true,
    settings: { theme: 'light', language: 'en' }
  },
  {
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    tenant_id: '11111111-1111-1111-1111-111111111111',
    email: 'user@acme.com',
    password: 'testpass123',
    password_hash: passwordHash,
    name: 'Charlie User',
    role: 'user',
    is_active: true,
    settings: { theme: 'light', language: 'en' }
  },
  {
    id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    tenant_id: '22222222-2222-2222-2222-222222222222',
    email: 'founder@startup.com',
    password: 'testpass123',
    password_hash: passwordHash,
    name: 'Diana Founder',
    role: 'admin',
    is_active: true,
    settings: { theme: 'dark', language: 'en' }
  },
  {
    id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    tenant_id: '33333333-3333-3333-3333-333333333333',
    email: 'free@user.com',
    password: 'testpass123',
    password_hash: passwordHash,
    name: 'Eva Freeuser',
    role: 'user',
    is_active: true,
    settings: { theme: 'light', language: 'en' }
  },
  {
    id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
    tenant_id: '11111111-1111-1111-1111-111111111111',
    email: 'viewer@acme.com',
    password: 'testpass123',
    password_hash: passwordHash,
    name: 'Frank Viewer',
    role: 'viewer',
    is_active: true,
    settings: { theme: 'light', language: 'en' }
  },
  {
    id: '99999999-9999-9999-9999-999999999999',
    tenant_id: '44444444-4444-4444-4444-444444444444',
    email: 'suspended@company.com',
    password: 'testpass123',
    password_hash: passwordHash,
    name: 'Sam Suspended',
    role: 'admin',
    is_active: false,
    settings: { theme: 'light', language: 'en' }
  }
];

// Test run fixtures
export const testRunFixtures: TestRunFixture[] = [
  {
    id: 'run11111-1111-1111-1111-111111111111',
    tenant_id: '11111111-1111-1111-1111-111111111111',
    user_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    project_name: 'ecommerce-web',
    branch: 'main',
    commit_hash: 'abc123def456789012345678901234567890abcd',
    status: 'passed',
    total_tests: 145,
    passed_tests: 142,
    failed_tests: 2,
    skipped_tests: 1,
    duration_ms: 180000,
    metadata: {
      ci_provider: 'github',
      pull_request: '123',
      environment: 'staging'
    },
    artifacts: [
      { type: 'trace', path: '/traces/run1-trace1.zip' },
      { type: 'screenshot', path: '/screenshots/run1-screenshot1.png' }
    ],
    started_at: new Date('2024-01-15T10:00:00Z'),
    completed_at: new Date('2024-01-15T10:03:00Z')
  },
  {
    id: 'run22222-2222-2222-2222-222222222222',
    tenant_id: '11111111-1111-1111-1111-111111111111',
    user_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    project_name: 'mobile-app',
    branch: 'feature/auth-flow',
    commit_hash: 'def456abc123789012345678901234567890bcde',
    status: 'failed',
    total_tests: 89,
    passed_tests: 76,
    failed_tests: 13,
    skipped_tests: 0,
    duration_ms: 240000,
    metadata: {
      ci_provider: 'gitlab',
      merge_request: '456',
      environment: 'development'
    },
    artifacts: [
      { type: 'trace', path: '/traces/run2-trace1.zip' },
      { type: 'video', path: '/videos/run2-video1.webm' }
    ],
    started_at: new Date('2024-01-15T11:00:00Z'),
    completed_at: new Date('2024-01-15T11:04:00Z')
  },
  {
    id: 'run33333-3333-3333-3333-333333333333',
    tenant_id: '22222222-2222-2222-2222-222222222222',
    user_id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    project_name: 'api-gateway',
    branch: 'main',
    commit_hash: 'ghi789def456abc123456789012345678901cdef',
    status: 'running',
    total_tests: 67,
    passed_tests: 45,
    failed_tests: 0,
    skipped_tests: 0,
    duration_ms: 0,
    metadata: {
      ci_provider: 'jenkins',
      build_number: '789',
      environment: 'production'
    },
    artifacts: [],
    started_at: new Date(),
    completed_at: null
  }
];

// Test case fixtures
export const testCaseFixtures: TestCaseFixture[] = [
  {
    id: 'case1111-1111-1111-1111-111111111111',
    tenant_id: '11111111-1111-1111-1111-111111111111',
    test_run_id: 'run11111-1111-1111-1111-111111111111',
    name: 'should login with valid credentials',
    suite: 'Authentication',
    file_path: 'tests/auth/login.spec.ts',
    status: 'passed',
    duration_ms: 2500,
    error_message: null,
    stack_trace: null,
    annotations: [
      { type: 'slow', description: 'This test involves network requests' }
    ],
    steps: [
      { name: 'Navigate to login page', duration_ms: 500 },
      { name: 'Enter credentials', duration_ms: 800 },
      { name: 'Click login button', duration_ms: 1200 }
    ],
    attachments: [
      { name: 'login-success.png', contentType: 'image/png' }
    ],
    retry_count: 0,
    browser: 'chromium',
    viewport: '1920x1080'
  },
  {
    id: 'case2222-2222-2222-2222-222222222222',
    tenant_id: '11111111-1111-1111-1111-111111111111',
    test_run_id: 'run11111-1111-1111-1111-111111111111',
    name: 'should display error for invalid password',
    suite: 'Authentication',
    file_path: 'tests/auth/login.spec.ts',
    status: 'failed',
    duration_ms: 3200,
    error_message: 'Expected error message not displayed',
    stack_trace: `Error: Expected error message not displayed
    at Object.<anonymous> (tests/auth/login.spec.ts:45:12)
    at Promise.then.completed`,
    annotations: [
      { type: 'issue', url: 'https://github.com/company/repo/issues/123' }
    ],
    steps: [
      { name: 'Navigate to login page', duration_ms: 500 },
      { name: 'Enter invalid password', duration_ms: 800 },
      { name: 'Click login button', duration_ms: 900 },
      { name: 'Verify error message', duration_ms: 1000 }
    ],
    attachments: [
      { name: 'login-error-failed.png', contentType: 'image/png' },
      { name: 'trace.zip', contentType: 'application/zip' }
    ],
    retry_count: 2,
    browser: 'firefox',
    viewport: '1366x768'
  },
  {
    id: 'case3333-3333-3333-3333-333333333333',
    tenant_id: '11111111-1111-1111-1111-111111111111',
    test_run_id: 'run22222-2222-2222-2222-222222222222',
    name: 'should navigate through product catalog',
    suite: 'E-commerce',
    file_path: 'tests/ecommerce/catalog.spec.ts',
    status: 'passed',
    duration_ms: 4500,
    error_message: null,
    stack_trace: null,
    annotations: [],
    steps: [
      { name: 'Navigate to catalog', duration_ms: 800 },
      { name: 'Filter by category', duration_ms: 1200 },
      { name: 'Sort by price', duration_ms: 900 },
      { name: 'Select product', duration_ms: 1600 }
    ],
    attachments: [
      { name: 'catalog-view.png', contentType: 'image/png' }
    ],
    retry_count: 0,
    browser: 'webkit',
    viewport: '1280x720'
  }
];

// API key fixtures
export const apiKeyFixtures: ApiKeyFixture[] = [
  {
    id: 'key11111-1111-1111-1111-111111111111',
    tenant_id: '11111111-1111-1111-1111-111111111111',
    user_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'CI/CD Pipeline Key',
    key_hash: 'sha256hash1234567890abcdef1234567890abcdef1234567890abcdef12',
    actual_key: 'pw_test_1234567890abcdef1234567890abcdef',
    permissions: ['read:tests', 'write:tests', 'read:analytics'],
    is_active: true,
    expires_at: new Date('2025-12-31T23:59:59Z')
  },
  {
    id: 'key22222-2222-2222-2222-222222222222',
    tenant_id: '11111111-1111-1111-1111-111111111111',
    user_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    name: 'Read-only Analytics Key',
    key_hash: 'sha256hash2345678901bcdef12345678901bcdef12345678901bcdef123',
    actual_key: 'pw_test_2345678901bcdef12345678901bcdef',
    permissions: ['read:analytics', 'read:reports'],
    is_active: true,
    expires_at: null
  },
  {
    id: 'key33333-3333-3333-3333-333333333333',
    tenant_id: '22222222-2222-2222-2222-222222222222',
    user_id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    name: 'Development API Key',
    key_hash: 'sha256hash3456789012cdef123456789012cdef123456789012cdef1234',
    actual_key: 'pw_test_3456789012cdef123456789012cdef',
    permissions: ['read:tests', 'write:tests'],
    is_active: true,
    expires_at: new Date('2024-12-31T23:59:59Z')
  },
  {
    id: 'key44444-4444-4444-4444-444444444444',
    tenant_id: '11111111-1111-1111-1111-111111111111',
    user_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    name: 'Expired Key',
    key_hash: 'sha256hash4567890123def1234567890123def1234567890123def12345',
    actual_key: 'pw_test_4567890123def1234567890123def',
    permissions: ['read:tests'],
    is_active: false,
    expires_at: new Date('2023-12-31T23:59:59Z')
  }
];

// Helper functions to generate additional test data
export function generateTestRun(overrides: Partial<TestRunFixture> = {}): TestRunFixture {
  const base: TestRunFixture = {
    id: randomUUID(),
    tenant_id: tenantFixtures[0].id,
    user_id: userFixtures[0].id,
    project_name: 'test-project',
    branch: 'main',
    commit_hash: 'abc123def456789012345678901234567890abcd',
    status: 'passed',
    total_tests: 100,
    passed_tests: 95,
    failed_tests: 5,
    skipped_tests: 0,
    duration_ms: 120000,
    metadata: { environment: 'test' },
    artifacts: [],
    started_at: new Date(),
    completed_at: new Date()
  };
  return { ...base, ...overrides };
}

export function generateTestCase(overrides: Partial<TestCaseFixture> = {}): TestCaseFixture {
  const base: TestCaseFixture = {
    id: randomUUID(),
    tenant_id: tenantFixtures[0].id,
    test_run_id: testRunFixtures[0].id,
    name: 'sample test case',
    suite: 'Sample Suite',
    file_path: 'tests/sample.spec.ts',
    status: 'passed',
    duration_ms: 1000,
    error_message: null,
    stack_trace: null,
    annotations: [],
    steps: [],
    attachments: [],
    retry_count: 0,
    browser: 'chromium',
    viewport: '1920x1080'
  };
  return { ...base, ...overrides };
}

export function generateUser(overrides: Partial<UserFixture> = {}): UserFixture {
  const base: UserFixture = {
    id: randomUUID(),
    tenant_id: tenantFixtures[0].id,
    email: `user${Date.now()}@test.com`,
    password: 'testpass123',
    password_hash: passwordHash,
    name: 'Test User',
    role: 'user',
    is_active: true,
    settings: {}
  };
  return { ...base, ...overrides };
}

// Performance test data generators
export function generateLargeDataset(count: number) {
  const testRuns = Array.from({ length: count }, (_, i) => 
    generateTestRun({
      project_name: `project-${i % 10}`,
      status: ['passed', 'failed', 'running'][i % 3] as any,
      total_tests: Math.floor(Math.random() * 200) + 50
    })
  );

  const testCases = testRuns.flatMap(run => 
    Array.from({ length: run.total_tests }, (_, i) => 
      generateTestCase({
        test_run_id: run.id,
        tenant_id: run.tenant_id,
        name: `test case ${i + 1}`,
        status: ['passed', 'failed', 'skipped'][i % 3] as any
      })
    )
  );

  return { testRuns, testCases };
}