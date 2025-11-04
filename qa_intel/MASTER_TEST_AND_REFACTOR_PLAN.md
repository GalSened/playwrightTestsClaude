# QA Intelligence Platform - Master Test & Refactor Plan
## From Current State → Perfect Working System

**Version**: 1.0
**Date**: 2025-10-19
**Objective**: Test all features, refactor until perfect, achieve 100% working system
**Timeline**: 12 weeks (3 months)
**Team**: QA Engineers + Developers

---

## 🎯 Definition of "Perfect"

### System-Wide Success Criteria

| Category | Metric | Target | Current | Gap |
|----------|--------|--------|---------|-----|
| **Backend API** | All endpoints functional | 100% | ~60% | 40% |
| **Frontend UI** | All pages render & work | 100% | ~70% | 30% |
| **Integration** | All workflows complete | 100% | ~50% | 50% |
| **Test Coverage** | Code coverage | >85% | 0% | 85% |
| **Pass Rate** | Automated tests passing | >98% | 0% | 98% |
| **Performance** | API response < 100ms | 95% | Unknown | TBD |
| **Stability** | Uptime | 99.9% | Unknown | TBD |
| **Security** | No critical vulnerabilities | 0 | Unknown | TBD |
| **Documentation** | All features documented | 100% | ~30% | 70% |

**Perfect System = All targets met + zero critical bugs + full documentation**

---

## 📅 12-Week Execution Plan

```
┌─────────────────────────────────────────────────────────────┐
│  PHASE 1: FOUNDATION (Weeks 1-3)                            │
│  ├─ Week 1: Environment Setup & Baseline                    │
│  ├─ Week 2: Backend Core Testing                            │
│  └─ Week 3: Backend Core Refactoring                        │
├─────────────────────────────────────────────────────────────┤
│  PHASE 2: CORE FEATURES (Weeks 4-6)                         │
│  ├─ Week 4: Frontend Core Testing                           │
│  ├─ Week 5: Frontend Core Refactoring                       │
│  └─ Week 6: Integration Testing                             │
├─────────────────────────────────────────────────────────────┤
│  PHASE 3: ADVANCED FEATURES (Weeks 7-9)                     │
│  ├─ Week 7: Advanced Features Testing                       │
│  ├─ Week 8: Advanced Features Refactoring                   │
│  └─ Week 9: Performance & Security                          │
├─────────────────────────────────────────────────────────────┤
│  PHASE 4: PERFECTION (Weeks 10-12)                          │
│  ├─ Week 10: Edge Cases & Polish                            │
│  ├─ Week 11: Full System Validation                         │
│  └─ Week 12: Production Readiness                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 PHASE 1: FOUNDATION (Weeks 1-3)

### Week 1: Environment Setup & Baseline

#### Day 1: Development Environment
**Goal**: Get everything running locally

**Tasks**:
1. **Backend Setup**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Configure database
   npm run migrate
   npm run dev
   # Verify: http://localhost:8082/health
   ```

2. **Frontend Setup**
   ```bash
   cd apps/frontend/dashboard
   npm install
   cp .env.example .env
   npm run dev
   # Verify: http://localhost:3001
   ```

3. **Database Setup**
   ```bash
   # Create fresh database
   sqlite3 backend/data/qa-intel.db

   # Run all migrations
   cd backend
   npm run migrate:all

   # Verify tables
   sqlite3 data/qa-intel.db ".tables"
   ```

**Validation Checklist**:
- [ ] Backend starts without errors
- [ ] Frontend loads at localhost:3001
- [ ] Database has all tables
- [ ] Health endpoint returns 200
- [ ] No console errors in browser
- [ ] Can navigate between pages

**Success Criteria**: Everything runs locally, no errors

---

#### Day 2-3: Automated Testing Infrastructure

**Goal**: Set up comprehensive testing framework

**1. Backend Testing Setup**

```bash
# Install testing dependencies
cd backend
npm install --save-dev \
  jest \
  @types/jest \
  supertest \
  @types/supertest \
  ts-jest

# Create jest.config.js
```

```javascript
// backend/jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/types/**',
  ],
  coverageThresholds: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
```

**2. Create Test Structure**

```
backend/
├── tests/
│   ├── unit/           # Unit tests
│   ├── integration/    # API integration tests
│   ├── e2e/           # End-to-end tests
│   ├── fixtures/      # Test data
│   └── helpers/       # Test utilities
```

**3. Frontend Testing Setup**

```bash
# Install testing dependencies
cd apps/frontend/dashboard
npm install --save-dev \
  @testing-library/react \
  @testing-library/jest-dom \
  @testing-library/user-event \
  vitest \
  @vitest/ui \
  jsdom

# Create vitest.config.ts
```

**4. E2E Testing Setup**

```bash
# Already have Playwright, verify installation
cd new_tests_for_wesign
py -m pip install pytest pytest-playwright allure-pytest

# Create pytest.ini
```

```ini
# pytest.ini
[pytest]
minversion = 6.0
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
markers =
    smoke: Smoke tests
    regression: Regression tests
    slow: Slow running tests
    integration: Integration tests
addopts =
    -v
    --tb=short
    --strict-markers
    --disable-warnings
    --alluredir=allure-results
    --html=reports/report.html
    --self-contained-html
timeout = 300
```

**Validation Checklist**:
- [ ] Backend test command works: `npm test`
- [ ] Frontend test command works: `npm test`
- [ ] E2E test command works: `pytest --collect-only`
- [ ] Coverage reports generate
- [ ] Test reports (HTML, JSON, Allure) generate

---

#### Day 4-5: Baseline Testing & Metrics

**Goal**: Establish current state metrics

**1. Run Baseline Tests**

```bash
# Backend API tests (create minimal smoke tests first)
cd backend
npm run test:coverage

# Frontend component tests
cd apps/frontend/dashboard
npm run test:coverage

# E2E tests (with proper environment)
cd new_tests_for_wesign
pytest tests/ -m smoke --maxfail=10
```

**2. Document Baseline Metrics**

Create `BASELINE_METRICS.md`:
```markdown
# Baseline Metrics - 2025-10-19

## Backend
- Total endpoints: 150+
- Endpoints tested: 0
- Unit tests: 0
- Integration tests: 0
- Code coverage: 0%
- Performance: Unknown

## Frontend
- Total components: 50+
- Components tested: 0
- Unit tests: 0
- Integration tests: 0
- Code coverage: 0%

## E2E
- Total tests: 427
- Tests passing: Unknown (environment issues)
- Flakiness rate: Unknown
- Avg duration: Unknown

## Critical Issues Found
1. Environment dependency blocks E2E tests
2. No automated test coverage
3. Hard-coded credentials
4. Hard-coded waits in tests
5. No cleanup/teardown
```

**3. Create Issues Backlog**

```markdown
# Issues Backlog (Priority Order)

## P0 - Blockers (Week 1)
- [ ] Fix environment access for E2E tests
- [ ] Remove hard-coded credentials
- [ ] Add test timeouts
- [ ] Create database test fixtures

## P1 - Critical (Week 2-3)
- [ ] Replace hard waits with smart waits
- [ ] Add cleanup/teardown to all tests
- [ ] Fix browser fixture (session scope)
- [ ] Add screenshot on failure

## P2 - Important (Week 4-6)
- [ ] Improve test assertions
- [ ] Add error scenario coverage
- [ ] Implement retry logic
- [ ] Add test data factories
```

**Validation**: Baseline documented, issues tracked

---

### Week 2: Backend Core Testing

**Goal**: Test and fix core backend APIs

#### Priority 1: Test Banks Module (Days 1-2)

**1. Create Unit Tests**

```typescript
// backend/tests/unit/test-banks.test.ts

import request from 'supertest';
import { app } from '../../src/server';
import { getDatabase } from '../../src/database/database';

describe('Test Banks API', () => {
  let db;

  beforeAll(async () => {
    db = await getDatabase();
    // Seed test data
    await db.run('DELETE FROM test_banks');
    await db.run(`INSERT INTO test_banks VALUES
      ('e2e', 'e2e', 'End-to-End Tests', ...),
      ('api', 'api', 'API Tests', ...),
      ('load', 'load', 'Load Tests', ...)`);
  });

  afterAll(async () => {
    await db.run('DELETE FROM test_banks');
  });

  describe('GET /api/test-banks', () => {
    it('should return all test banks', async () => {
      const response = await request(app)
        .get('/api/test-banks')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.data[0].id).toBe('e2e');
    });

    it('should handle database errors gracefully', async () => {
      // Mock database failure
      jest.spyOn(db, 'all').mockRejectedValueOnce(new Error('DB Error'));

      const response = await request(app)
        .get('/api/test-banks')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('database');
    });

    it('should return data within 50ms', async () => {
      const start = Date.now();
      await request(app).get('/api/test-banks');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50);
    });
  });

  describe('POST /api/test-banks/:id/discover', () => {
    it('should discover E2E tests', async () => {
      const response = await request(app)
        .post('/api/test-banks/e2e/discover')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tests_discovered).toBeGreaterThan(0);
    });

    it('should return 404 for invalid bank', async () => {
      await request(app)
        .post('/api/test-banks/invalid/discover')
        .expect(404);
    });

    it('should handle pytest not installed', async () => {
      // Test with pytest unavailable
      // Mock exec to throw error
      const response = await request(app)
        .post('/api/test-banks/e2e/discover')
        .expect(500); // Or appropriate error code

      expect(response.body.error).toContain('pytest');
    });
  });
});
```

**2. Run Tests & Document Failures**

```bash
npm test -- test-banks.test.ts
# Document all failures in issues
```

**3. Fix Issues**

For each failing test:
1. Identify root cause
2. Implement fix
3. Re-run test
4. Document fix

**Validation**:
- [ ] All Test Banks API tests pass
- [ ] Code coverage >80% for test-banks.ts
- [ ] Performance targets met (<50ms)
- [ ] All edge cases handled

---

#### Priority 2: Test Discovery Module (Day 3)

**Repeat pattern**:
1. Write comprehensive tests
2. Run tests
3. Document failures
4. Fix issues
5. Validate

**Test Coverage**:
- Discovery for E2E/API/Load
- Error scenarios
- Edge cases
- Performance

---

#### Priority 3: Test Execution Module (Day 4)

**Critical Tests**:
- Single test execution
- Suite execution
- Parallel execution
- Timeout handling
- Result tracking

---

#### Priority 4: Analytics & Reports (Day 5)

**Tests**:
- Metric calculations
- Data aggregation
- Report generation
- Performance

---

### Week 3: Backend Core Refactoring

**Goal**: Fix all issues found in Week 2

#### Day 1: Code Quality Improvements

**1. Fix Hard-coded Values**

```typescript
// BEFORE (backend/src/services/TestBankDiscoveryService.ts)
const testsPath = 'C:/Users/gals/Desktop/playwright/tests';

// AFTER
import { config } from '../config';
const testsPath = config.testsPath || process.env.TESTS_PATH || './tests';
```

**2. Move Credentials to Environment**

```typescript
// BEFORE
const credentials = {
  email: 'user@example.com',
  password: 'password123'
};

// AFTER
const credentials = {
  email: process.env.TEST_USER_EMAIL,
  password: process.env.TEST_USER_PASSWORD
};
```

**3. Add Proper Error Handling**

```typescript
// BEFORE
async function getTestBanks() {
  const banks = await db.all('SELECT * FROM test_banks');
  return banks;
}

// AFTER
async function getTestBanks() {
  try {
    const banks = await db.all('SELECT * FROM test_banks');
    return { success: true, data: banks };
  } catch (error) {
    logger.error('Failed to fetch test banks', { error });
    throw new DatabaseError('Failed to fetch test banks', {
      cause: error,
      code: 'DB_QUERY_FAILED'
    });
  }
}
```

---

#### Day 2-3: Performance Optimization

**1. Add Database Indexes**

```sql
-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_e2e_category ON e2e_tests(category);
CREATE INDEX IF NOT EXISTS idx_e2e_priority ON e2e_tests(priority);
CREATE INDEX IF NOT EXISTS idx_e2e_status ON e2e_tests(status);
CREATE INDEX IF NOT EXISTS idx_api_module ON api_tests(module);
CREATE INDEX IF NOT EXISTS idx_load_type ON load_tests(scenario_type);
```

**2. Optimize Queries**

```typescript
// BEFORE (N+1 query problem)
const banks = await db.all('SELECT * FROM test_banks');
for (const bank of banks) {
  bank.tests = await db.all(
    `SELECT * FROM ${bank.id}_tests WHERE bank_id = ?`,
    bank.id
  );
}

// AFTER (Use JOIN)
const banksWithTests = await db.all(`
  SELECT
    tb.*,
    COUNT(e2e.id) as e2e_count,
    COUNT(api.id) as api_count,
    COUNT(load.id) as load_count
  FROM test_banks tb
  LEFT JOIN e2e_tests e2e ON e2e.test_bank_id = tb.id
  LEFT JOIN api_tests api ON api.test_bank_id = tb.id
  LEFT JOIN load_tests load ON load.test_bank_id = tb.id
  GROUP BY tb.id
`);
```

**3. Add Caching**

```typescript
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 300 }); // 5 min cache

async function getTestBanks() {
  const cached = cache.get('test_banks');
  if (cached) return cached;

  const banks = await db.all('SELECT * FROM test_banks');
  cache.set('test_banks', banks);
  return banks;
}
```

---

#### Day 4-5: Security Hardening

**1. Input Validation**

```typescript
import { z } from 'zod';

const DiscoveryRequestSchema = z.object({
  bank_id: z.enum(['e2e', 'api', 'load']),
  options: z.object({
    incremental: z.boolean().optional(),
    paths: z.array(z.string()).optional(),
  }).optional(),
});

router.post('/:id/discover', async (req, res) => {
  try {
    const validated = DiscoveryRequestSchema.parse({
      bank_id: req.params.id,
      options: req.body,
    });

    // Use validated data
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request',
      details: error.errors
    });
  }
});
```

**2. SQL Injection Prevention**

```typescript
// BEFORE (Vulnerable!)
const tests = await db.all(
  `SELECT * FROM e2e_tests WHERE category = '${category}'`
);

// AFTER (Parameterized)
const tests = await db.all(
  'SELECT * FROM e2e_tests WHERE category = ?',
  [category]
);
```

**3. Rate Limiting**

```typescript
import rateLimit from 'express-rate-limit';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later.',
});

app.use('/api/', apiLimiter);
```

**Validation**:
- [ ] All security tests pass
- [ ] No SQL injection vulnerabilities
- [ ] Rate limiting works
- [ ] Input validation on all endpoints

---

## 🔧 PHASE 2: CORE FEATURES (Weeks 4-6)

### Week 4: Frontend Core Testing

**Goal**: Test all frontend components using MCP-integrated UI testing

---

## 🌐 MCP UI Testing Strategy

### Overview: MCP Playwright Integration

The QA Intelligence platform leverages **MCP (Model Context Protocol) Playwright** for advanced UI testing capabilities. This integration provides:

- **Real browser automation** via MCP Playwright server
- **Visual debugging** with automated screenshots
- **Accessibility auditing** via MCP browser-tools
- **Performance profiling** with built-in metrics
- **Cross-browser testing** (Chromium, Firefox, WebKit)
- **Network monitoring** for API validation

### MCP Testing Architecture

```
┌─────────────────────────────────────────────────────┐
│         QA Intelligence Testing Hub                 │
├─────────────────────────────────────────────────────┤
│  Traditional Tests        │  MCP-Enhanced Tests     │
│  (Unit/Integration)       │  (UI/E2E/Visual)        │
├───────────────────────────┼─────────────────────────┤
│  • Vitest/Jest            │  • MCP Playwright       │
│  • React Testing Library  │  • MCP Browser Tools    │
│  • MSW (mocking)          │  • MCP Screenshots      │
│  • Supertest (API)        │  • MCP Accessibility    │
└───────────────────────────┴─────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   MCP Server Layer    │
              ├───────────────────────┤
              │  • Playwright Server  │
              │  • Browser Tools      │
              │  • OpenMemory         │
              │  • Serena (code)      │
              └───────────────────────┘
```

---

### MCP Setup & Configuration (Prerequisite for Week 4)

**1. Install MCP Servers**

```bash
# Install MCP Playwright server
npx @playwright/mcp@latest install --with-deps

# Install MCP Browser Tools
npm install -g @agentdeskai/browser-tools-mcp

# Verify installation
which mcp-playwright
which mcp-browser-tools
```

**2. Configure MCP in Claude Desktop**

```json
// ~/.claude/claude_desktop_config.json (macOS)
// %APPDATA%\Claude\claude_desktop_config.json (Windows)
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"],
      "env": {
        "PWDEBUG": "0",
        "PLAYWRIGHT_BROWSERS_PATH": "~/.cache/ms-playwright"
      }
    },
    "browser-tools": {
      "command": "npx",
      "args": ["-y", "@agentdeskai/browser-tools-mcp@latest"],
      "env": {
        "BROWSER_TOOLS_PORT": "8765"
      }
    }
  }
}
```

**3. Create MCP Test Client Wrapper**

```typescript
// apps/frontend/dashboard/tests/utils/mcp-client.ts

import { MCPClient } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

export class MCPPlaywrightClient {
  private client: MCPClient;
  private transport: SSEClientTransport;

  static async connect() {
    const instance = new MCPPlaywrightClient();
    await instance.init();
    return instance;
  }

  private async init() {
    // Connect to MCP Playwright server
    this.transport = new SSEClientTransport(
      new URL('http://localhost:8765/mcp/playwright/sse')
    );

    this.client = new MCPClient(
      {
        name: 'qa-intelligence-test-client',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    await this.client.connect(this.transport);
  }

  async disconnect() {
    await this.client.close();
  }

  // Wrapper methods for common MCP operations
  async browser_navigate(params: { url: string }) {
    return await this.client.callTool('mcp__playwright__browser_navigate', params);
  }

  async browser_snapshot() {
    const result = await this.client.callTool('mcp__playwright__browser_snapshot', {});
    return result.content?.[0]?.text || '';
  }

  async browser_click(params: { element: string; ref: string }) {
    return await this.client.callTool('mcp__playwright__browser_click', params);
  }

  async browser_type(params: { element: string; ref: string; text: string; submit?: boolean }) {
    return await this.client.callTool('mcp__playwright__browser_type', params);
  }

  async browser_select_option(params: { element: string; ref: string; values: string[] }) {
    return await this.client.callTool('mcp__playwright__browser_select_option', params);
  }

  async browser_wait_for(params: { text?: string; textGone?: string; time?: number }) {
    return await this.client.callTool('mcp__playwright__browser_wait_for', params);
  }

  async browser_take_screenshot(params: { filename?: string; fullPage?: boolean; type?: 'png' | 'jpeg' }) {
    return await this.client.callTool('mcp__playwright__browser_take_screenshot', params);
  }

  async browser_network_requests() {
    const result = await this.client.callTool('mcp__playwright__browser_network_requests', {});
    return JSON.parse(result.content?.[0]?.text || '[]');
  }

  async browser_press_key(params: { key: string }) {
    return await this.client.callTool('mcp__playwright__browser_press_key', params);
  }

  async getConsoleLogs() {
    const result = await this.client.callTool('mcp__browser-tools__getConsoleLogs', {});
    return JSON.parse(result.content?.[0]?.text || '[]');
  }

  async getConsoleErrors() {
    const result = await this.client.callTool('mcp__browser-tools__getConsoleErrors', {});
    return JSON.parse(result.content?.[0]?.text || '[]');
  }

  async runAccessibilityAudit() {
    const result = await this.client.callTool('mcp__browser-tools__runAccessibilityAudit', {});
    return JSON.parse(result.content?.[0]?.text || '{}');
  }

  async runPerformanceAudit() {
    const result = await this.client.callTool('mcp__browser-tools__runPerformanceAudit', {});
    return JSON.parse(result.content?.[0]?.text || '{}');
  }
}
```

**4. Update package.json Scripts**

```json
// apps/frontend/dashboard/package.json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest --coverage",
    "test:mcp": "vitest --config vitest.mcp.config.ts",
    "test:all": "npm run test:coverage && npm run test:mcp",
    "test:ui": "vitest --ui"
  }
}
```

**5. Create MCP Test Configuration**

```typescript
// apps/frontend/dashboard/vitest.mcp.config.ts

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'mcp-tests',
    include: ['tests/mcp/**/*.test.ts'],
    setupFiles: ['tests/mcp/setup.ts'],
    testTimeout: 60000, // 60s for MCP tests (browser operations)
    hookTimeout: 30000,
    globals: true,
    environment: 'node', // MCP tests run in Node, not jsdom
  },
});
```

**6. MCP Test Setup File**

```typescript
// apps/frontend/dashboard/tests/mcp/setup.ts

import { beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';

let backendProcess: ChildProcess;
let frontendProcess: ChildProcess;

beforeAll(async () => {
  // Start backend server
  backendProcess = spawn('npm', ['run', 'dev'], {
    cwd: '../../../backend',
    shell: true,
  });

  // Start frontend dev server
  frontendProcess = spawn('npm', ['run', 'dev'], {
    shell: true,
  });

  // Wait for servers to be ready
  await new Promise(resolve => setTimeout(resolve, 10000)); // 10s warmup

  console.log('✅ Test servers started');
});

afterAll(async () => {
  // Clean up servers
  backendProcess?.kill();
  frontendProcess?.kill();

  console.log('✅ Test servers stopped');
});
```

**7. Environment Variables**

```bash
# .env.test
VITE_API_URL=http://localhost:8082
MCP_PLAYWRIGHT_URL=http://localhost:8765/mcp/playwright/sse
MCP_BROWSER_TOOLS_URL=http://localhost:8766
HEADLESS=true
SLOW_MO=0
SCREENSHOT_ON_FAILURE=true
```

**Validation Checklist**:
- [ ] MCP Playwright server running
- [ ] MCP Browser Tools server running
- [ ] MCPPlaywrightClient connects successfully
- [ ] Can navigate to test URLs
- [ ] Can capture snapshots
- [ ] Can take screenshots
- [ ] Accessibility audits working

---

#### Day 1-2: MCP-Integrated Component Testing

**1. Traditional Unit Tests (Day 1)**

```typescript
// apps/frontend/dashboard/src/components/TestBankSelector.test.tsx

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TestBankSelector } from './TestBankSelector';
import { rest } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  rest.get('/api/test-banks', (req, res, ctx) => {
    return res(ctx.json({
      success: true,
      data: [
        { id: 'e2e', name: 'e2e', test_count: 427 },
        { id: 'api', name: 'api', test_count: 97 },
        { id: 'load', name: 'load', test_count: 9 },
      ],
    }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('TestBankSelector', () => {
  it('renders 3 test bank cards', async () => {
    render(<TestBankSelector />);

    await waitFor(() => {
      expect(screen.getByText('End-to-End Tests')).toBeInTheDocument();
      expect(screen.getByText('API Tests')).toBeInTheDocument();
      expect(screen.getByText('Load Tests')).toBeInTheDocument();
    });
  });

  it('displays correct test counts', async () => {
    render(<TestBankSelector />);

    await waitFor(() => {
      expect(screen.getByText('427')).toBeInTheDocument();
      expect(screen.getByText('97')).toBeInTheDocument();
      expect(screen.getByText('9')).toBeInTheDocument();
    });
  });

  it('switches bank on click', async () => {
    const onBankChange = jest.fn();
    render(<TestBankSelector onBankChange={onBankChange} />);

    await waitFor(() => screen.getByText('API Tests'));

    fireEvent.click(screen.getByText('API Tests'));

    expect(onBankChange).toHaveBeenCalledWith('api');
  });

  it('triggers discovery on button click', async () => {
    let discoverCalled = false;
    server.use(
      rest.post('/api/test-banks/all/discover', (req, res, ctx) => {
        discoverCalled = true;
        return res(ctx.json({ success: true }));
      })
    );

    render(<TestBankSelector />);

    await waitFor(() => screen.getByText('Discover Tests'));
    fireEvent.click(screen.getByText('Discover Tests'));

    await waitFor(() => expect(discoverCalled).toBe(true));
  });

  it('shows loading state during discovery', async () => {
    server.use(
      rest.post('/api/test-banks/all/discover', async (req, res, ctx) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return res(ctx.json({ success: true }));
      })
    );

    render(<TestBankSelector />);

    fireEvent.click(screen.getByText('Discover Tests'));

    expect(screen.getByText('Discovering...')).toBeInTheDocument();
  });

  it('handles API errors gracefully', async () => {
    server.use(
      rest.get('/api/test-banks', (req, res, ctx) => {
        return res(ctx.status(500));
      })
    );

    render(<TestBankSelector />);

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });
});
```

**2. MCP-Enhanced UI Tests (Day 2)**

```typescript
// apps/frontend/dashboard/tests/mcp/test-bank-selector-mcp.test.ts

import { MCPPlaywrightClient } from '@playwright/mcp';

describe('TestBankSelector - MCP UI Tests', () => {
  let mcp: MCPPlaywrightClient;

  beforeAll(async () => {
    mcp = await MCPPlaywrightClient.connect();
    await mcp.browser_navigate({ url: 'http://localhost:3001/test-banks' });
  });

  afterAll(async () => {
    await mcp.disconnect();
  });

  it('should render test banks UI correctly with MCP', async () => {
    // Take accessibility snapshot to validate structure
    const snapshot = await mcp.browser_snapshot();

    expect(snapshot).toContain('End-to-End Tests');
    expect(snapshot).toContain('API Tests');
    expect(snapshot).toContain('Load Tests');

    // Verify test counts visible
    expect(snapshot).toContain('427');
    expect(snapshot).toContain('97');
    expect(snapshot).toContain('9');
  });

  it('should handle test bank selection via MCP', async () => {
    // Click E2E bank card using MCP
    await mcp.browser_click({
      element: 'E2E Test Bank Card',
      ref: '[data-testid="e2e-bank-card"]'
    });

    // Verify navigation/state change
    const snapshot = await mcp.browser_snapshot();
    expect(snapshot).toContain('E2E Test Details');
  });

  it('should capture screenshot on failure', async () => {
    try {
      await mcp.browser_click({
        element: 'Non-existent Button',
        ref: '[data-testid="does-not-exist"]'
      });
    } catch (error) {
      // Capture failure screenshot
      const screenshot = await mcp.browser_take_screenshot({
        filename: 'test-bank-selector-failure.png',
        fullPage: true
      });

      console.log('Failure screenshot saved:', screenshot);
      throw error;
    }
  });

  it('should validate UI performance with MCP', async () => {
    // Get network logs to check API performance
    const networkLogs = await mcp.browser_network_requests();

    const testBanksRequest = networkLogs.find(
      log => log.url.includes('/api/test-banks')
    );

    expect(testBanksRequest).toBeDefined();
    expect(testBanksRequest.duration).toBeLessThan(500); // < 500ms
  });

  it('should run accessibility audit via MCP', async () => {
    // Use MCP browser-tools for a11y testing
    const a11yResults = await mcp.runAccessibilityAudit();

    expect(a11yResults.violations.length).toBe(0);
    expect(a11yResults.score).toBeGreaterThan(90); // > 90% a11y score
  });
});
```

**3. Run Tests**

```bash
# Traditional unit tests
npm run test:coverage

# MCP-enhanced UI tests
npm run test:mcp

# Combined test suite
npm run test:all
```

**4. Visual Regression Testing with MCP**

```typescript
// apps/frontend/dashboard/tests/mcp/visual-regression.test.ts

import { MCPPlaywrightClient } from '@playwright/mcp';
import { compareScreenshots } from '../utils/visual-compare';

describe('TestBankSelector Visual Regression', () => {
  let mcp: MCPPlaywrightClient;

  beforeAll(async () => {
    mcp = await MCPPlaywrightClient.connect();
    await mcp.browser_navigate({ url: 'http://localhost:3001/test-banks' });
  });

  it('matches baseline screenshot', async () => {
    // Wait for full render
    await mcp.browser_wait_for({ time: 2 });

    // Capture current screenshot
    const screenshot = await mcp.browser_take_screenshot({
      filename: 'test-banks-current.png',
      fullPage: false,
      type: 'png'
    });

    // Compare with baseline
    const baselineExists = await fs.existsSync('baselines/test-banks-baseline.png');

    if (!baselineExists) {
      // First run - save as baseline
      await fs.copyFile(screenshot, 'baselines/test-banks-baseline.png');
      console.log('Baseline screenshot saved');
    } else {
      // Compare with baseline
      const diff = await compareScreenshots(
        'baselines/test-banks-baseline.png',
        screenshot
      );

      expect(diff.percentage).toBeLessThan(5); // < 5% difference
    }
  });
});
```

---

#### Day 3-4: MCP-Enhanced Page Integration Tests

**Test Complete Pages with MCP**:

```typescript
// apps/frontend/dashboard/tests/mcp/full-workflow.test.ts

import { MCPPlaywrightClient } from '@playwright/mcp';

describe('Complete User Workflow - MCP E2E', () => {
  let mcp: MCPPlaywrightClient;

  beforeAll(async () => {
    mcp = await MCPPlaywrightClient.connect();
  });

  afterAll(async () => {
    await mcp.disconnect();
  });

  it('completes discovery → view → analyze workflow', async () => {
    // Step 1: Navigate to test banks
    await mcp.browser_navigate({ url: 'http://localhost:3001/test-banks' });

    const snapshot1 = await mcp.browser_snapshot();
    expect(snapshot1).toContain('Test Banks');

    // Step 2: Trigger discovery
    await mcp.browser_click({
      element: 'Discover All Tests Button',
      ref: '[data-testid="discover-all-button"]'
    });

    // Wait for discovery to complete (watch for loading state)
    await mcp.browser_wait_for({
      textGone: 'Discovering...',
    });

    // Verify counts updated
    const snapshot2 = await mcp.browser_snapshot();
    expect(snapshot2).toMatch(/\d{3}\+/); // At least 3-digit count

    // Step 3: Select E2E bank
    await mcp.browser_click({
      element: 'E2E Bank Card',
      ref: '[data-testid="e2e-bank-card"]'
    });

    const snapshot3 = await mcp.browser_snapshot();
    expect(snapshot3).toContain('End-to-End Tests');

    // Step 4: Filter by category
    await mcp.browser_select_option({
      element: 'Category Filter Dropdown',
      ref: '[data-testid="category-filter"]',
      values: ['auth']
    });

    await mcp.browser_wait_for({ time: 1 }); // Wait for filter

    const snapshot4 = await mcp.browser_snapshot();
    expect(snapshot4).toContain('Authentication');

    // Step 5: Run test suite (if available)
    const runButton = await mcp.browser_snapshot();
    if (runButton.includes('Run Suite')) {
      await mcp.browser_click({
        element: 'Run Suite Button',
        ref: '[data-testid="run-suite-button"]'
      });
    }

    // Step 6: Navigate to Analytics
    await mcp.browser_click({
      element: 'Analytics Link',
      ref: 'a[href="/analytics"]'
    });

    const snapshot5 = await mcp.browser_snapshot();
    expect(snapshot5).toContain('Analytics');

    // Capture final screenshot
    await mcp.browser_take_screenshot({
      filename: 'workflow-complete.png',
      fullPage: true
    });

    // Get console logs for debugging
    const consoleLogs = await mcp.getConsoleLogs();
    const errors = consoleLogs.filter(log => log.type === 'error');

    expect(errors.length).toBe(0); // No console errors
  });

  it('validates network performance across workflow', async () => {
    await mcp.browser_navigate({ url: 'http://localhost:3001/test-banks' });

    // Trigger multiple actions
    await mcp.browser_click({
      element: 'Discover Button',
      ref: '[data-testid="discover-all-button"]'
    });

    await mcp.browser_wait_for({ time: 10 }); // Wait for discovery

    // Get all network requests
    const networkLogs = await mcp.browser_network_requests();

    // Analyze performance
    const apiRequests = networkLogs.filter(log =>
      log.url.includes('/api/')
    );

    // All API requests should be < 1s
    apiRequests.forEach(request => {
      expect(request.duration).toBeLessThan(1000);
    });

    // No failed requests
    const failedRequests = networkLogs.filter(log =>
      log.status >= 400
    );
    expect(failedRequests.length).toBe(0);
  });
});
```

**Pattern for Each Page**:
1. Navigate with MCP
2. Capture accessibility snapshot
3. Test user interactions via MCP
4. Validate state with snapshots
5. Test error scenarios
6. Capture screenshots on failures
7. Monitor network performance

---

#### Day 5: Comprehensive Accessibility Testing with MCP

```typescript
// apps/frontend/dashboard/tests/mcp/accessibility-audit.test.ts

import { MCPPlaywrightClient } from '@playwright/mcp';

describe('Accessibility Audit - MCP Browser Tools', () => {
  let mcp: MCPPlaywrightClient;

  const pages = [
    '/test-banks',
    '/dashboard',
    '/analytics',
    '/reports',
    '/scheduler',
    '/ai-assistant'
  ];

  beforeAll(async () => {
    mcp = await MCPPlaywrightClient.connect();
  });

  afterAll(async () => {
    await mcp.disconnect();
  });

  pages.forEach(page => {
    it(`${page} passes accessibility audit`, async () => {
      await mcp.browser_navigate({
        url: `http://localhost:3001${page}`
      });

      // Wait for full render
      await mcp.browser_wait_for({ time: 2 });

      // Run comprehensive accessibility audit
      const auditResults = await mcp.runAccessibilityAudit();

      // Log results
      console.log(`\n=== Accessibility Audit: ${page} ===`);
      console.log(`Score: ${auditResults.score}/100`);
      console.log(`Violations: ${auditResults.violations.length}`);

      if (auditResults.violations.length > 0) {
        console.log('\nViolations found:');
        auditResults.violations.forEach((v, i) => {
          console.log(`${i + 1}. ${v.id}: ${v.description}`);
          console.log(`   Impact: ${v.impact}`);
          console.log(`   Elements: ${v.nodes.length}`);
        });
      }

      // Capture screenshot if violations found
      if (auditResults.violations.length > 0) {
        await mcp.browser_take_screenshot({
          filename: `a11y-violations-${page.replace('/', '-')}.png`,
          fullPage: true
        });
      }

      // Assertions
      expect(auditResults.violations.length).toBe(0);
      expect(auditResults.score).toBeGreaterThanOrEqual(90);
    });

    it(`${page} supports keyboard navigation`, async () => {
      await mcp.browser_navigate({
        url: `http://localhost:3001${page}`
      });

      // Test Tab key navigation
      await mcp.browser_press_key({ key: 'Tab' });

      let snapshot = await mcp.browser_snapshot();
      expect(snapshot).toContain('focused'); // Some element has focus

      // Test navigation through interactive elements
      for (let i = 0; i < 5; i++) {
        await mcp.browser_press_key({ key: 'Tab' });
      }

      // Test Enter to activate
      await mcp.browser_press_key({ key: 'Enter' });

      // Verify no keyboard traps
      await mcp.browser_press_key({ key: 'Escape' });

      snapshot = await mcp.browser_snapshot();
      // Page should still be accessible
    });
  });

  it('generates comprehensive accessibility report', async () => {
    const report = {
      date: new Date().toISOString(),
      pages: []
    };

    for (const page of pages) {
      await mcp.browser_navigate({
        url: `http://localhost:3001${page}`
      });

      const audit = await mcp.runAccessibilityAudit();

      report.pages.push({
        url: page,
        score: audit.score,
        violations: audit.violations.length,
        passes: audit.passes.length,
        criticalIssues: audit.violations.filter(v =>
          v.impact === 'critical'
        ).length,
      });
    }

    // Save report
    await fs.writeFile(
      'reports/accessibility-report.json',
      JSON.stringify(report, null, 2)
    );

    console.log('\n=== Accessibility Summary ===');
    console.log(`Pages tested: ${report.pages.length}`);
    console.log(`Average score: ${
      report.pages.reduce((sum, p) => sum + p.score, 0) / pages.length
    }/100`);
    console.log(`Total violations: ${
      report.pages.reduce((sum, p) => sum + p.violations, 0)
    }`);
  });
});
```

---

### Week 5: Frontend Core Refactoring

#### Day 1-2: Component Cleanup

**1. Extract Reusable Components**

```typescript
// BEFORE: Duplicate code in E2ETestBankView and APITestBankView
const getMethodColor = (method: string) => {
  switch (method) {
    case 'GET': return 'bg-blue-100';
    case 'POST': return 'bg-green-100';
    // ...
  }
};

// AFTER: Shared component
// components/ui/MethodBadge.tsx
export const MethodBadge: React.FC<{ method: string }> = ({ method }) => {
  const colorMap = {
    GET: 'bg-blue-100 text-blue-800',
    POST: 'bg-green-100 text-green-800',
    PUT: 'bg-amber-100 text-amber-800',
    DELETE: 'bg-red-100 text-red-800',
  };

  return (
    <span className={`px-2 py-1 rounded ${colorMap[method]}`}>
      {method}
    </span>
  );
};
```

**2. Custom Hooks for Logic**

```typescript
// hooks/useTestBanks.ts
export function useTestBanks() {
  const [banks, setBanks] = useState<TestBank[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBanks = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/test-banks');
      const data = await response.json();
      setBanks(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBanks();
  }, [fetchBanks]);

  return { banks, loading, error, refetch: fetchBanks };
}

// Usage in component
const { banks, loading, error } = useTestBanks();
```

---

#### Day 3-4: Performance Optimization

**1. Implement Code Splitting**

```typescript
// BEFORE: Import all at once
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import Reports from './pages/Reports';

// AFTER: Lazy load
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Reports = lazy(() => import('./pages/Reports'));

<Suspense fallback={<LoadingSpinner />}>
  <Routes>
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/analytics" element={<Analytics />} />
    <Route path="/reports" element={<Reports />} />
  </Routes>
</Suspense>
```

**2. Optimize Re-renders**

```typescript
// BEFORE: Re-renders on every parent update
export const TestCard: React.FC<Props> = ({ test }) => {
  return <div>{test.name}</div>;
};

// AFTER: Memoize
export const TestCard = React.memo<Props>(({ test }) => {
  return <div>{test.name}</div>;
}, (prev, next) => prev.test.id === next.test.id);
```

**3. Virtual Scrolling for Large Lists**

```typescript
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={tests.length}
  itemSize={80}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <TestCard test={tests[index]} />
    </div>
  )}
</FixedSizeList>
```

---

#### Day 5: Error Handling & UX Polish

**1. Error Boundaries**

```typescript
// components/ErrorBoundary.tsx
export class ErrorBoundary extends React.Component<Props, State> {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught:', error, errorInfo);
    // Send to error tracking service
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <h2>Something went wrong</h2>
          <button onClick={() => this.setState({ hasError: false })}>
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

**2. Loading States**

```typescript
// Use Suspense + transitions
import { useTransition } from 'react';

const [isPending, startTransition] = useTransition();

const handleBankChange = (bankId: string) => {
  startTransition(() => {
    setSelectedBank(bankId);
  });
};

return (
  <div className={isPending ? 'opacity-50' : ''}>
    {/* Content */}
  </div>
);
```

---

### Week 6: Integration Testing with MCP

**Goal**: Test complete workflows end-to-end using MCP for comprehensive validation

#### Day 1-2: Critical User Journeys with MCP Integration

**Journey 1: Discovery → View → Execute (MCP-Enhanced)**

```typescript
// tests/integration/discovery-execution-mcp.test.ts
import { MCPPlaywrightClient } from '@playwright/mcp';

describe('Discovery to Execution Flow - MCP Enhanced', () => {
  let mcp: MCPPlaywrightClient;

  beforeAll(async () => {
    mcp = await MCPPlaywrightClient.connect();
  });

  afterAll(async () => {
    await mcp.disconnect();
  });

  it('completes full workflow with comprehensive validation', async () => {
    // Step 1: Navigate to Test Banks
    await mcp.browser_navigate({ url: 'http://localhost:3001/test-banks' });

    const snapshot1 = await mcp.browser_snapshot();
    expect(snapshot1).toContain('Test Banks');

    // Capture baseline screenshot
    await mcp.browser_take_screenshot({
      filename: 'journey1-step1-test-banks.png',
      fullPage: true
    });

    // Step 2: Trigger Discovery with MCP
    await mcp.browser_click({
      element: 'Discover All Tests Button',
      ref: '[data-testid="discover-button"]'
    });

    // Validate loading state
    const snapshot2 = await mcp.browser_snapshot();
    expect(snapshot2).toContain('Discovering');

    // Wait for completion (smart wait)
    await mcp.browser_wait_for({
      textGone: 'Discovering...'
    });

    // Step 3: Verify Counts Updated
    const snapshot3 = await mcp.browser_snapshot();
    expect(snapshot3).toMatch(/\d{3}/); // At least 3-digit count

    // Network validation - ensure discovery API succeeded
    const networkLogs = await mcp.browser_network_requests();
    const discoveryRequest = networkLogs.find(log =>
      log.url.includes('/api/test-banks/all/discover')
    );
    expect(discoveryRequest.status).toBe(200);
    expect(discoveryRequest.duration).toBeLessThan(30000); // < 30s

    // Step 4: Select E2E Bank
    await mcp.browser_click({
      element: 'E2E Bank Card',
      ref: '[data-testid="e2e-bank-card"]'
    });

    const snapshot4 = await mcp.browser_snapshot();
    expect(snapshot4).toContain('End-to-End Tests');

    await mcp.browser_take_screenshot({
      filename: 'journey1-step4-e2e-bank.png'
    });

    // Step 5: Filter by Category
    await mcp.browser_select_option({
      element: 'Category Filter',
      ref: '[data-testid="category-filter"]',
      values: ['auth']
    });

    await mcp.browser_wait_for({ time: 1 }); // Wait for filter to apply

    const snapshot5 = await mcp.browser_snapshot();
    const authTestCount = (snapshot5.match(/test-row/g) || []).length;
    expect(authTestCount).toBeGreaterThan(0);

    // Step 6: Run Test Suite
    await mcp.browser_click({
      element: 'Run Suite Button',
      ref: '[data-testid="run-suite-button"]'
    });

    // Validate execution started
    const snapshot6 = await mcp.browser_snapshot();
    expect(snapshot6).toContain('Running');

    // Step 7: Wait for Completion (with timeout protection)
    await mcp.browser_wait_for({
      text: 'Completed'
    });

    const snapshot7 = await mcp.browser_snapshot();
    expect(snapshot7).toContain('Completed');

    await mcp.browser_take_screenshot({
      filename: 'journey1-step7-execution-complete.png'
    });

    // Step 8: Navigate to Reports
    await mcp.browser_click({
      element: 'Reports Link',
      ref: 'a[href="/reports"]'
    });

    const snapshot8 = await mcp.browser_snapshot();
    expect(snapshot8).toContain('Reports');

    // Step 9: Verify Report Generated
    const snapshot9 = await mcp.browser_snapshot();
    expect(snapshot9).toContain('auth');
    expect(snapshot9).toMatch(/\d+ tests? passed/);

    // Final screenshot
    await mcp.browser_take_screenshot({
      filename: 'journey1-complete.png',
      fullPage: true
    });

    // Console validation - no errors
    const consoleLogs = await mcp.getConsoleLogs();
    const errors = consoleLogs.filter(log => log.type === 'error');
    expect(errors.length).toBe(0);

    // Network validation - no failed requests
    const finalNetworkLogs = await mcp.browser_network_requests();
    const failedRequests = finalNetworkLogs.filter(log => log.status >= 400);
    expect(failedRequests.length).toBe(0);

    // Performance validation
    const apiRequests = finalNetworkLogs.filter(log => log.url.includes('/api/'));
    apiRequests.forEach(request => {
      expect(request.duration).toBeLessThan(5000); // All APIs < 5s
    });
  });
});
```

**Journey 2: Scheduled Execution with MCP**

```typescript
// tests/integration/scheduled-execution-mcp.test.ts
describe('Scheduled Execution Flow - MCP', () => {
  let mcp: MCPPlaywrightClient;

  beforeAll(async () => {
    mcp = await MCPPlaywrightClient.connect();
  });

  it('creates and executes scheduled test run', async () => {
    // Navigate to Scheduler
    await mcp.browser_navigate({ url: 'http://localhost:3001/scheduler' });

    const snapshot1 = await mcp.browser_snapshot();
    expect(snapshot1).toContain('Scheduler');

    // Create new schedule
    await mcp.browser_click({
      element: 'New Schedule Button',
      ref: '[data-testid="new-schedule-button"]'
    });

    // Fill schedule form
    await mcp.browser_type({
      element: 'Schedule Name Input',
      ref: '[data-testid="schedule-name"]',
      text: 'Nightly Regression Tests'
    });

    await mcp.browser_select_option({
      element: 'Test Bank Selector',
      ref: '[data-testid="test-bank-select"]',
      values: ['e2e']
    });

    await mcp.browser_type({
      element: 'Cron Expression Input',
      ref: '[data-testid="cron-expression"]',
      text: '0 2 * * *' // Daily at 2 AM
    });

    await mcp.browser_take_screenshot({
      filename: 'scheduler-form-filled.png'
    });

    // Save schedule
    await mcp.browser_click({
      element: 'Save Schedule Button',
      ref: '[data-testid="save-schedule"]'
    });

    await mcp.browser_wait_for({
      text: 'Schedule created successfully'
    });

    const snapshot2 = await mcp.browser_snapshot();
    expect(snapshot2).toContain('Nightly Regression Tests');
    expect(snapshot2).toContain('0 2 * * *');

    // Trigger immediate execution for testing
    await mcp.browser_click({
      element: 'Run Now Button',
      ref: '[data-testid="run-now-button"]'
    });

    await mcp.browser_wait_for({
      text: 'Execution started'
    });

    // Monitor execution (navigate to executions page)
    await mcp.browser_click({
      element: 'Executions Link',
      ref: 'a[href="/executions"]'
    });

    const snapshot3 = await mcp.browser_snapshot();
    expect(snapshot3).toContain('Running');

    // Validate real-time updates (check for changing numbers)
    await mcp.browser_wait_for({ time: 5 });

    const snapshot4 = await mcp.browser_snapshot();
    // Progress should have changed
    expect(snapshot4).toMatch(/\d+\/\d+ tests/);

    await mcp.browser_take_screenshot({
      filename: 'scheduler-execution-in-progress.png',
      fullPage: true
    });
  });
});
```

**Journey 3: Self-Healing Flow with MCP**

```typescript
// tests/integration/self-healing-flow-mcp.test.ts
describe('Self-Healing Flow - MCP', () => {
  let mcp: MCPPlaywrightClient;

  beforeAll(async () => {
    mcp = await MCPPlaywrightClient.connect();
  });

  it('demonstrates self-healing capabilities', async () => {
    // Navigate to a test that's expected to fail
    await mcp.browser_navigate({ url: 'http://localhost:3001/test-banks' });

    // Select E2E bank
    await mcp.browser_click({
      element: 'E2E Bank Card',
      ref: '[data-testid="e2e-bank-card"]'
    });

    // Find a test with known selector issues
    await mcp.browser_type({
      element: 'Search Input',
      ref: '[data-testid="test-search"]',
      text: 'login'
    });

    const snapshot1 = await mcp.browser_snapshot();
    expect(snapshot1).toContain('test_login');

    // Click on a specific test
    await mcp.browser_click({
      element: 'Test Row',
      ref: '[data-testid="test-row"]:has-text("test_login")'
    });

    // View test details
    const snapshot2 = await mcp.browser_snapshot();
    expect(snapshot2).toContain('Test Details');
    expect(snapshot2).toContain('Selectors');

    // Run test with self-healing enabled
    await mcp.browser_click({
      element: 'Run with Self-Healing',
      ref: '[data-testid="run-self-healing"]'
    });

    // Monitor execution
    await mcp.browser_wait_for({
      text: 'Self-healing activated'
    });

    await mcp.browser_take_screenshot({
      filename: 'self-healing-activated.png'
    });

    // Wait for healing to complete
    await mcp.browser_wait_for({
      text: 'Healing complete'
    });

    const snapshot3 = await mcp.browser_snapshot();
    expect(snapshot3).toContain('Alternative selector found');
    expect(snapshot3).toContain('Confidence: 8'); // At least 80% confidence

    // View healing report
    await mcp.browser_click({
      element: 'View Healing Report',
      ref: '[data-testid="view-healing-report"]'
    });

    const snapshot4 = await mcp.browser_snapshot();
    expect(snapshot4).toContain('Before:');
    expect(snapshot4).toContain('After:');
    expect(snapshot4).toContain('input[name="email"]');

    await mcp.browser_take_screenshot({
      filename: 'self-healing-report.png',
      fullPage: true
    });

    // Apply suggested fix
    await mcp.browser_click({
      element: 'Apply Fix',
      ref: '[data-testid="apply-fix"]'
    });

    await mcp.browser_wait_for({
      text: 'Selector updated successfully'
    });

    const finalSnapshot = await mcp.browser_snapshot();
    expect(finalSnapshot).toContain('Updated selector');
  });
});
```

**Journey 4: AI Analysis with MCP**

```typescript
// tests/integration/ai-analysis-flow-mcp.test.ts
describe('AI Analysis Flow - MCP', () => {
  let mcp: MCPPlaywrightClient;

  beforeAll(async () => {
    mcp = await MCPPlaywrightClient.connect();
  });

  it('analyzes test results with AI assistant', async () => {
    // Navigate to AI Assistant
    await mcp.browser_navigate({ url: 'http://localhost:3001/ai-assistant' });

    const snapshot1 = await mcp.browser_snapshot();
    expect(snapshot1).toContain('AI Assistant');

    // Ask for test failure analysis
    await mcp.browser_type({
      element: 'AI Prompt Input',
      ref: '[data-testid="ai-prompt"]',
      text: 'Analyze recent test failures in auth category'
    });

    await mcp.browser_click({
      element: 'Ask AI Button',
      ref: '[data-testid="ask-ai"]'
    });

    // Wait for AI response
    await mcp.browser_wait_for({
      text: 'Analysis complete'
    });

    await mcp.browser_take_screenshot({
      filename: 'ai-analysis-result.png',
      fullPage: true
    });

    const snapshot2 = await mcp.browser_snapshot();
    expect(snapshot2).toContain('Root Cause Analysis');
    expect(snapshot2).toContain('Recommendations');

    // Verify AI suggestions are actionable
    expect(snapshot2).toMatch(/\d+ failures analyzed/);
    expect(snapshot2).toContain('Suggested fix');

    // Test AI-generated test case
    await mcp.browser_click({
      element: 'Generate Test',
      ref: '[data-testid="generate-test"]'
    });

    await mcp.browser_type({
      element: 'Test Description Input',
      ref: '[data-testid="test-description"]',
      text: 'Test login with invalid email format'
    });

    await mcp.browser_click({
      element: 'Generate Button',
      ref: '[data-testid="generate"]'
    });

    await mcp.browser_wait_for({
      text: 'Test generated'
    });

    const snapshot3 = await mcp.browser_snapshot();
    expect(snapshot3).toContain('@pytest.mark');
    expect(snapshot3).toContain('async def test_');

    await mcp.browser_take_screenshot({
      filename: 'ai-generated-test.png'
    });
  });
});
```

---

#### Day 3-4: API Integration Tests

**Test Backend ↔ Frontend Integration**

```typescript
// Start real backend for integration tests
describe('API Integration', () => {
  let backend: ChildProcess;

  beforeAll(async () => {
    // Start backend server
    backend = spawn('npm', ['run', 'dev'], {
      cwd: path.join(__dirname, '../../backend'),
    });

    // Wait for server to be ready
    await waitForServer('http://localhost:8082/health');
  });

  afterAll(() => {
    backend.kill();
  });

  it('frontend can fetch test banks from backend', async () => {
    const response = await fetch('http://localhost:8082/api/test-banks');
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(3);
  });

  it('discovery updates database and frontend sees changes', async () => {
    // Trigger discovery via API
    const discoverResponse = await fetch(
      'http://localhost:8082/api/test-banks/e2e/discover',
      { method: 'POST' }
    );
    expect(discoverResponse.ok).toBe(true);

    // Fetch updated banks
    const banksResponse = await fetch('http://localhost:8082/api/test-banks');
    const data = await banksResponse.json();

    const e2eBank = data.data.find(b => b.id === 'e2e');
    expect(e2eBank.test_count).toBeGreaterThan(0);
  });
});
```

---

#### Day 5: Database Integration Tests

**Test Migrations & Data Integrity**

```typescript
describe('Database Integration', () => {
  let db;

  beforeEach(async () => {
    // Create fresh test database
    db = await createTestDatabase();
    await runMigrations(db);
  });

  afterEach(async () => {
    await db.close();
    await deleteTestDatabase();
  });

  it('migrations create all required tables', async () => {
    const tables = await db.all(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );

    const tableNames = tables.map(t => t.name);
    expect(tableNames).toContain('test_banks');
    expect(tableNames).toContain('e2e_tests');
    expect(tableNames).toContain('api_tests');
    expect(tableNames).toContain('load_tests');
    expect(tableNames).toContain('test_executions');
  });

  it('foreign key constraints work', async () => {
    await expect(async () => {
      await db.run(
        'INSERT INTO e2e_tests (id, test_bank_id, test_name) VALUES (?, ?, ?)',
        ['test1', 'invalid_bank', 'Test Name']
      );
    }).rejects.toThrow('FOREIGN KEY constraint failed');
  });

  it('views calculate statistics correctly', async () => {
    // Insert test data
    await seedTestData(db);

    // Query view
    const stats = await db.all('SELECT * FROM v_e2e_by_category');

    expect(stats).toHaveLength(5); // 5 categories
    expect(stats[0]).toHaveProperty('total_tests');
    expect(stats[0]).toHaveProperty('avg_pass_rate');
  });
});
```

---

## 🔧 PHASE 3: ADVANCED FEATURES (Weeks 7-9)

### Week 7: Advanced Features Testing

#### Self-Healing, AI Assistant, Scheduler, CI/CD

**Pattern for each feature**:
1. Unit tests for core logic
2. Integration tests for workflows
3. E2E tests for UI
4. Performance tests
5. Error scenario coverage

---

### Week 8: Advanced Features Refactoring

**Focus Areas**:
- Code quality improvements
- Performance optimization
- Security hardening
- User experience polish

---

### Week 9: Performance & Security

#### Day 1-2: Load Testing

```typescript
// k6 load test script
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests < 500ms
    http_req_failed: ['rate<0.01'],   // <1% failure rate
  },
};

export default function () {
  // Test GET /api/test-banks
  const res = http.get('http://localhost:8082/api/test-banks');

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

**Run Load Tests**:
```bash
k6 run load-tests/api-performance.js
```

**Optimization Targets**:
- API endpoints: P95 < 200ms
- Page load: < 2 seconds
- Time to interactive: < 3 seconds

---

#### Day 3-4: Security Audit

**1. Automated Security Scanning**

```bash
# Install dependencies
npm install --save-dev eslint-plugin-security

# Run security audit
npm audit
npm audit fix

# Scan for vulnerabilities
npx snyk test

# Check for secrets in code
npx secretlint "**/*"
```

**2. Penetration Testing Checklist**

- [ ] SQL Injection
- [ ] XSS (Cross-Site Scripting)
- [ ] CSRF (Cross-Site Request Forgery)
- [ ] Authentication bypass
- [ ] Authorization bypass
- [ ] Rate limiting bypass
- [ ] API key exposure
- [ ] Session hijacking

**3. Security Headers**

```typescript
// Add security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
}));
```

---

#### Day 5: Accessibility Audit

```bash
# Run automated a11y tests
npm run test:a11y

# Use axe DevTools in browser
# Manual testing with screen reader
# Keyboard navigation testing
```

**Accessibility Checklist**:
- [ ] All images have alt text
- [ ] Proper heading hierarchy
- [ ] Keyboard navigation works
- [ ] Focus indicators visible
- [ ] ARIA labels on interactive elements
- [ ] Color contrast meets WCAG AA
- [ ] Screen reader compatible
- [ ] No keyboard traps

---

## 🔧 PHASE 4: PERFECTION (Weeks 10-12)

### Week 10: Edge Cases & Polish

#### Day 1-2: Edge Case Testing

**Run ALL edge case tests from the comprehensive plan**

```bash
# Run edge case test suite
npm run test:edge-cases

# Categories:
# - Data edge cases (null, empty, special chars)
# - Concurrency edge cases
# - Performance edge cases
# - Error edge cases
# - Browser edge cases
```

**Fix ALL Edge Cases Found**

---

#### Day 3-4: UI/UX Polish

**1. Consistent Design System**

- Standardize colors, fonts, spacing
- Create reusable component library
- Implement dark mode (if needed)
- Add micro-interactions
- Improve loading states
- Better error messages

**2. Responsive Design**

- Test on mobile (375px)
- Test on tablet (768px)
- Test on desktop (1024px, 1440px, 1920px)
- Fix any layout issues

**3. User Feedback**

- Add success toasts
- Add error notifications
- Add confirmation dialogs
- Add progress indicators
- Add helpful tooltips

---

#### Day 5: Documentation

**Complete Documentation**:

1. **API Documentation** (Swagger/OpenAPI)
2. **User Guide** (How to use platform)
3. **Developer Guide** (How to extend)
4. **Deployment Guide** (How to deploy)
5. **Troubleshooting Guide** (Common issues)

---

### Week 11: Full System Validation

#### Day 1: Regression Testing

**Run FULL test suite**:

```bash
# Backend
cd backend
npm run test:all

# Frontend
cd apps/frontend/dashboard
npm run test:all

# E2E
cd new_tests_for_wesign
pytest tests/ --maxfail=999

# Integration
npm run test:integration

# Load tests
k6 run load-tests/full-suite.js
```

**Success Criteria**:
- [ ] 100% backend tests passing
- [ ] 100% frontend tests passing
- [ ] >95% E2E tests passing
- [ ] 100% integration tests passing
- [ ] Load tests meet thresholds

---

#### Day 2: Cross-Browser Testing

**Test on**:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

**Use BrowserStack or similar**

---

#### Day 3: User Acceptance Testing (UAT)

**Recruit 5-10 users to test**:

1. Give them common tasks
2. Observe their usage
3. Collect feedback
4. Identify pain points
5. Fix critical UX issues

---

#### Day 4: Performance Benchmarking

**Measure & Document**:

- API response times (all endpoints)
- Page load times (all pages)
- Time to interactive
- Bundle sizes
- Memory usage
- CPU usage
- Network traffic

**Create Performance Report**:
```markdown
# Performance Benchmark - 2025-10-19

## API Performance
- GET /api/test-banks: 25ms (target: <50ms) ✅
- POST /api/test-banks/e2e/discover: 8.2s (target: <10s) ✅
- GET /api/e2e-tests: 45ms (target: <100ms) ✅

## Frontend Performance
- Initial load: 1.8s (target: <2s) ✅
- Time to interactive: 2.4s (target: <3s) ✅
- Bundle size: 245KB (target: <500KB) ✅

## Database Performance
- Query time (avg): 12ms (target: <50ms) ✅
- Connection pool: 10 connections, 90% utilization ✅
```

---

#### Day 5: Security Audit

**Final security review**:

1. Run all security scans
2. Review all dependencies
3. Check for secrets in code
4. Validate authentication/authorization
5. Test rate limiting
6. Review error messages (no leaks)
7. Check HTTPS configuration
8. Review CORS policy

**Security Sign-off Checklist**:
- [ ] No critical vulnerabilities
- [ ] No high vulnerabilities
- [ ] All dependencies up to date
- [ ] Security headers configured
- [ ] Authentication secure
- [ ] Authorization enforced
- [ ] Rate limiting active
- [ ] Secrets in environment variables
- [ ] Error messages don't leak info

---

### Week 12: Production Readiness

#### Day 1: Production Environment Setup

```bash
# Production database setup
# Production environment variables
# Production server configuration
# SSL certificates
# Domain configuration
# CDN setup (optional)
```

---

#### Day 2: CI/CD Pipeline

**Complete CI/CD Setup**:

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          cd backend && npm ci
          cd ../apps/frontend/dashboard && npm ci

      - name: Run backend tests
        run: cd backend && npm run test:coverage

      - name: Run frontend tests
        run: cd apps/frontend/dashboard && npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3

      - name: Build
        run: |
          cd backend && npm run build
          cd ../apps/frontend/dashboard && npm run build

      - name: E2E tests
        run: cd new_tests_for_wesign && pytest tests/ -m smoke

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: |
          # Deployment script
```

---

#### Day 3: Monitoring & Alerting

**Setup Monitoring**:

1. **Application Monitoring**
   - Error tracking (Sentry)
   - Performance monitoring (New Relic / Datadog)
   - Uptime monitoring (UptimeRobot)

2. **Infrastructure Monitoring**
   - Server metrics (CPU, memory, disk)
   - Database metrics
   - Network metrics

3. **Alerts**
   - Error rate > 1%
   - Response time > 1s
   - Uptime < 99.9%
   - Disk usage > 80%

---

#### Day 4: Backup & Disaster Recovery

**Setup Backups**:

```bash
# Daily database backups
0 2 * * * /scripts/backup-database.sh

# Weekly full backups
0 2 * * 0 /scripts/full-backup.sh

# Test restore procedure
```

**Disaster Recovery Plan**:
1. Database restore procedure
2. Server rebuild procedure
3. Rollback procedure
4. Contact list for emergencies

---

#### Day 5: Final Sign-off & Launch

**Pre-Launch Checklist**:

- [ ] All tests passing (100%)
- [ ] Performance targets met
- [ ] Security audit passed
- [ ] Documentation complete
- [ ] CI/CD working
- [ ] Monitoring active
- [ ] Backups configured
- [ ] Rollback plan ready
- [ ] Team trained
- [ ] Support plan in place

**Launch**:
1. Final production deployment
2. Smoke tests on production
3. Monitor for 24 hours
4. Announce launch
5. Celebrate! 🎉

---

## 📊 Success Metrics Tracking

**Weekly Dashboard**:

```markdown
# Week X Progress Report

## Tests
- Backend: 85/150 tests passing (56%)
- Frontend: 40/50 tests passing (80%)
- E2E: 385/427 tests passing (90%)
- Integration: 15/20 tests passing (75%)

## Coverage
- Backend: 72% (target: 85%)
- Frontend: 68% (target: 80%)

## Performance
- API P95: 85ms (target: <100ms) ✅
- Page Load: 2.3s (target: <2s) ⚠️

## Issues
- Critical: 0
- High: 3
- Medium: 12
- Low: 25

## This Week's Achievements
- Fixed Test Banks discovery
- Added 50 new tests
- Improved page load by 0.5s

## Next Week's Goals
- Complete frontend testing
- Fix remaining high priority issues
- Achieve 80% code coverage
```

---

## 🎯 Definition of Done (Final Checklist)

### Backend ✅
- [ ] All 150+ endpoints tested
- [ ] >85% code coverage
- [ ] All APIs respond <100ms (P95)
- [ ] Zero critical vulnerabilities
- [ ] All edge cases handled
- [ ] Comprehensive error handling
- [ ] Full API documentation

### Frontend ✅
- [ ] All 50+ components tested
- [ ] >80% code coverage
- [ ] All pages load <2s
- [ ] Zero accessibility violations
- [ ] Works on all major browsers
- [ ] Fully responsive
- [ ] Complete user guide

### Integration ✅
- [ ] All workflows tested end-to-end
- [ ] Database integrity verified
- [ ] Real-time updates working
- [ ] CI/CD pipeline functional
- [ ] All integrations (JIRA, Jenkins, etc.) working

### Quality ✅
- [ ] >98% test pass rate
- [ ] <2% flakiness rate
- [ ] Zero known critical bugs
- [ ] All edge cases covered
- [ ] Performance benchmarks met
- [ ] Security audit passed
- [ ] Accessibility audit passed

### Operations ✅
- [ ] Production environment ready
- [ ] Monitoring active
- [ ] Backups configured
- [ ] Disaster recovery tested
- [ ] Team trained
- [ ] Documentation complete

---

## 🚀 Quick Reference

### Daily Workflow

**Morning**:
1. Pull latest code
2. Run full test suite
3. Review failures
4. Prioritize fixes

**During Day**:
1. Write tests (TDD)
2. Implement feature/fix
3. Run tests
4. Refactor
5. Commit

**End of Day**:
1. Run full test suite
2. Update progress tracker
3. Document issues
4. Plan next day

### Test Commands

```bash
# Backend
npm run test              # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # With coverage
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests only

# Frontend
npm run test              # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # With coverage
npm run test:ui           # UI tests with Vitest UI

# E2E
pytest tests/             # All E2E tests
pytest tests/ -m smoke    # Smoke tests only
pytest tests/ -m regression  # Regression tests
pytest tests/ --maxfail=10   # Stop after 10 failures

# Load
k6 run load-tests/smoke.js      # Smoke test
k6 run load-tests/load.js       # Load test
k6 run load-tests/stress.js     # Stress test

# All
npm run test:all          # Everything
```

---

**Document Version**: 1.0
**Last Updated**: 2025-10-19
**Status**: Ready for Execution
**Est. Completion**: 12 weeks from start

