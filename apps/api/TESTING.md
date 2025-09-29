# Backend Testing Guide

This guide covers the comprehensive testing setup for the Playwright Test Management Platform backend.

## 🧪 Test Architecture

Our testing strategy follows enterprise-grade practices with multiple test types:

- **Unit Tests**: Fast, isolated tests for individual functions and classes
- **Integration Tests**: Full API endpoint tests with real database
- **Performance Tests**: Load testing and benchmark validations
- **End-to-End Tests**: Complete workflow testing

## 🔧 Setup

### Prerequisites

1. **Node.js** 18+ installed
2. **PostgreSQL** 12+ running locally
3. **Docker** (optional, for containerized testing)

### Database Setup

```bash
# Check database connection
npm run test:db:check

# Setup test database template
npm run test:db:setup

# Cleanup old test databases
npm run test:db:cleanup
```

### Environment Variables

Create a `.env.test` file:

```bash
# Test Database
TEST_DB_HOST=localhost
TEST_DB_PORT=5432
TEST_DB_USER=postgres
TEST_DB_PASSWORD=postgres

# Test Configuration
NODE_ENV=test
LOG_LEVEL=error
JWT_SECRET=test-jwt-secret-for-testing-only
```

## 🏃‍♂️ Running Tests

### Quick Commands

```bash
# Run all tests
npm test

# Run specific test types
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests (requires database)
npm run test:performance    # Performance tests

# Development workflow
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage report

# CI/Production
npm run test:ci            # CI environment with coverage and bail
```

### Advanced Test Runner

The custom test runner provides extensive options:

```bash
# Run tests with specific patterns
node scripts/test-runner.js --grep "auth"

# Run in different environments
node scripts/test-runner.js --env development
node scripts/test-runner.js --env ci

# Performance and debugging
node scripts/test-runner.js --verbose --bail
node scripts/test-runner.js --parallel  # For unit tests only
```

### Test Runner Options

| Option | Description | Example |
|--------|-------------|---------|
| `--type` | Test type (unit/integration/performance/all) | `--type integration` |
| `--env` | Environment (development/test/ci) | `--env ci` |
| `--watch` | Watch for file changes | `--watch` |
| `--coverage` | Generate coverage report | `--coverage` |
| `--verbose` | Detailed output | `--verbose` |
| `--bail` | Stop on first failure | `--bail` |
| `--parallel` | Run tests in parallel (unit only) | `--parallel` |
| `--grep` | Run tests matching pattern | `--grep "authentication"` |

## 📁 Test Structure

```
backend/src/tests/
├── fixtures/               # Test data and fixtures
│   └── database-fixtures.ts
├── helpers/                # Test utilities and helpers
│   └── test-helpers.ts
├── setup/                  # Test environment setup
│   ├── test-database.ts    # Database management
│   ├── global-setup.ts     # Jest global setup
│   └── global-teardown.ts  # Jest global teardown
├── integration/            # API integration tests
│   ├── auth-api.test.ts
│   └── test-runs-api.test.ts
├── performance/            # Performance tests
└── unit/                   # Unit tests
```

## 🎯 Writing Tests

### Unit Tests

```typescript
// src/services/auth.unit.test.ts
import { AuthService } from '../auth-service';

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
  });

  it('should validate JWT token', () => {
    const token = authService.generateToken({ userId: '123' });
    const decoded = authService.verifyToken(token);
    
    expect(decoded.userId).toBe('123');
  });
});
```

### Integration Tests

```typescript
// src/tests/integration/users-api.test.ts
import request from 'supertest';
import { TestDatabase } from '../setup/test-database';
import { TestHelpers } from '../helpers/test-helpers';
import { app } from '../../server-enterprise';

describe('Users API', () => {
  let testDb: TestDatabase;
  let authenticatedUser: any;

  beforeAll(async () => {
    testDb = new TestDatabase();
    await testDb.setup();
    TestHelpers.setDatabase(testDb);
  });

  afterAll(async () => {
    await testDb.teardown();
  });

  beforeEach(async () => {
    await TestHelpers.clearAllTables();
    const seeded = await TestHelpers.seedMinimalData();
    authenticatedUser = seeded.adminUser;
  });

  it('should get user profile', async () => {
    const response = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${authenticatedUser.token}`)
      .expect(200);

    TestHelpers.expectValidUser(response.body.user);
  });
});
```

## 🗃️ Test Database

### Database Per Test

Each test gets its own isolated database:

```typescript
describe('My Test Suite', () => {
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = new TestDatabase();
    await testDb.setup();
  });

  afterAll(async () => {
    await testDb.teardown();
  });
});
```

### Using Fixtures

```typescript
import { TestHelpers } from '../helpers/test-helpers';
import { tenantFixtures, userFixtures } from '../fixtures/database-fixtures';

// Use predefined fixtures
const tenant = tenantFixtures[0];
const user = userFixtures[0];

// Generate dynamic test data
const testRun = TestHelpers.generateTestRunData({
  tenant_id: tenant.id,
  project_name: 'my-project'
});
```

### Database Helpers

```typescript
// Clear specific tables
await TestHelpers.clearAllTables();

// Seed minimal required data
const { tenant, adminUser, regularUser } = await TestHelpers.seedMinimalData();

// Insert custom data
const tenantId = await testDb.insertTenant({
  name: 'Test Company',
  subdomain: 'test-co',
  plan: 'professional'
});
```

## 📊 Test Utilities

### Authentication Helpers

```typescript
// Create authenticated user with token
const userWithToken = TestHelpers.createAuthenticatedUser({
  role: 'admin',
  email: 'test@example.com'
});

// Get authorization headers
const headers = TestHelpers.getAuthHeaders(userWithToken.token);
const apiHeaders = TestHelpers.getApiKeyHeaders('test-api-key');
```

### Validation Helpers

```typescript
// Validate response objects
TestHelpers.expectValidUser(responseUser);
TestHelpers.expectValidTenant(responseTenant);
TestHelpers.expectValidTestRun(responseTestRun);
TestHelpers.expectValidTestCase(responseTestCase);

// Validate data formats
expect(TestHelpers.validateUUID(user.id)).toBe(true);
expect(TestHelpers.validateEmail(user.email)).toBe(true);
expect(TestHelpers.validateCommitHash(testRun.commit_hash)).toBe(true);
```

### Performance Testing

```typescript
// Measure execution time
const { result, duration } = await TestHelpers.measureExecutionTime(async () => {
  return request(app).get('/api/test-runs').set(headers);
});

expect(duration).toBeLessThan(1000); // Should complete within 1 second
```

### Bulk Data Generation

```typescript
// Generate large datasets for performance testing
const { tenants, users, testRuns } = TestHelpers.generateBulkData(1000);

// Create performance test scenarios
const largeDataset = generateLargeDataset(5000);
```

## 🚀 CI/CD Integration

### GitHub Actions

```yaml
name: Backend Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Setup test database
        run: npm run test:db:setup
        env:
          TEST_DB_HOST: localhost
          TEST_DB_USER: postgres
          TEST_DB_PASSWORD: postgres
          
      - name: Run tests
        run: npm run test:ci
```

### Docker Testing

```bash
# Start test environment
docker-compose -f docker-compose.test.yml up -d

# Run tests in container
docker-compose -f docker-compose.test.yml exec backend npm run test:ci

# Cleanup
docker-compose -f docker-compose.test.yml down -v
```

## 📈 Coverage Reports

Coverage reports are generated in multiple formats:

- **HTML**: `coverage/index.html` - Interactive web report
- **LCOV**: `coverage/lcov.info` - For CI integration
- **Text**: Console output during test runs

### Coverage Targets

- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Lines**: > 80%

## 🔍 Debugging Tests

### Common Issues

1. **Database Connection Errors**
   ```bash
   npm run test:db:check
   ```

2. **Test Isolation Issues**
   ```bash
   # Ensure tests run serially
   npm run test:integration
   ```

3. **Memory Leaks**
   ```bash
   # Run with memory monitoring
   node --inspect scripts/test-runner.js --type integration
   ```

### Debug Mode

```bash
# Run tests with detailed output
node scripts/test-runner.js --verbose

# Debug specific test
node scripts/test-runner.js --grep "auth login" --verbose
```

### Test Logs

```bash
# View test logs
tail -f test-logs/test-output.log

# Database query logs
tail -f test-logs/database.log
```

## 🎭 Mocking

### External Services

```typescript
// Mock Supabase
const mockSupabase = TestHelpers.mockSupabaseResponse(true, { data: 'test' });

// Mock Redis
const mockRedis = TestHelpers.mockRedisClient();
jest.mocked(redis).mockImplementation(() => mockRedis);
```

### Time-based Tests

```typescript
// Mock Date.now() for consistent testing
jest.useFakeTimers();
jest.setSystemTime(new Date('2024-01-01T00:00:00Z'));

// Advance time
jest.advanceTimersByTime(60000); // 1 minute
```

## 🔄 Continuous Testing

### Watch Mode Best Practices

```bash
# Watch specific test types
npm run test:watch -- --type unit

# Watch with coverage updates
npm run test:watch -- --coverage

# Filter by pattern
npm run test:watch -- --grep "authentication"
```

### Pre-commit Hooks

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run test:unit && npm run lint",
      "pre-push": "npm run test:integration"
    }
  }
}
```

## 📚 Best Practices

1. **Test Naming**: Use descriptive test names that explain the expected behavior
2. **Data Isolation**: Each test should be independent and use fresh data
3. **Assertions**: Use specific assertions rather than truthy/falsy checks
4. **Error Testing**: Test both success and failure scenarios
5. **Performance**: Keep unit tests under 100ms, integration tests under 5s
6. **Clean-up**: Always clean up resources in `afterEach`/`afterAll`
7. **Documentation**: Document complex test scenarios

## 🛠️ Troubleshooting

### Common Error Solutions

| Error | Solution |
|-------|----------|
| `ECONNREFUSED` | Check PostgreSQL is running |
| `Database already exists` | Run `npm run test:db:cleanup` |
| `JWT expired` | Regenerate test tokens |
| `Permission denied` | Check file permissions on test files |
| `Out of memory` | Reduce test parallelism |

### Performance Issues

```bash
# Profile test performance
node --prof scripts/test-runner.js --type integration

# Analyze heap usage
node --inspect --inspect-brk scripts/test-runner.js
```

### Support

For testing issues:
1. Check this documentation
2. Review test logs in `test-logs/`
3. Run database health checks
4. Verify environment variables
5. Check for resource leaks