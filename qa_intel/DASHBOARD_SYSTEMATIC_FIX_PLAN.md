# QA Intelligence Dashboard - Systematic Fix Plan

**Date**: 2025-10-27
**Status**: 🔧 **ACTIVE FIXING**
**Reference**: See `DASHBOARD_COMPREHENSIVE_ISSUES_ANALYSIS.md` for issue details

---

## Overview

This document provides a **step-by-step, systematic approach** to fixing all dashboard issues identified in the comprehensive analysis. Each fix includes:
- Prerequisite checks
- Exact file changes
- Testing steps
- Verification criteria
- Rollback plan

---

## Fix Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                   FIX WORKFLOW                              │
├─────────────────────────────────────────────────────────────┤
│ 1. Pre-Fix Assessment                                       │
│    ├─ Read issue details                                    │
│    ├─ Understand root cause                                 │
│    └─ Gather evidence (logs, screenshots, API responses)    │
│                                                              │
│ 2. Implementation                                            │
│    ├─ Create feature branch (fix/issue-N)                   │
│    ├─ Make code changes                                     │
│    ├─ Add tests                                             │
│    └─ Update documentation                                  │
│                                                              │
│ 3. Testing                                                   │
│    ├─ Unit tests pass                                       │
│    ├─ Integration tests pass                                │
│    ├─ Manual verification                                   │
│    └─ Regression check                                      │
│                                                              │
│ 4. Verification                                              │
│    ├─ Issue criteria met                                    │
│    ├─ No new issues introduced                              │
│    ├─ Performance acceptable                                │
│    └─ Documentation updated                                 │
│                                                              │
│ 5. Merge & Deploy                                            │
│    ├─ Code review (if team)                                 │
│    ├─ Merge to main                                         │
│    ├─ Deploy to staging                                     │
│    └─ Monitor for 24 hours                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Sprint 1: Critical Blockers (Week 1)

**Goal**: Achieve stable, functional system with accurate data
**Timeline**: 5 days
**Blockers**: None - start immediately

---

### Fix #1.1: Execution Status Update - Debug Event Flow

**Issue**: #1 - Execution Status Not Updating to "Failed"
**Priority**: P0 (Critical)
**Estimated Time**: 4 hours
**Status**: 🔧 In Progress

#### Pre-Fix Assessment

**Current State**:
- Event subscription is created (log confirms)
- Event handler never executes (no "Updated execution status" log)
- Event is published (need to verify)

**Root Cause Hypothesis**:
1. Event type mismatch
2. Timing issue (event published before subscription)
3. EventBus bug
4. Event published on different instance

#### Implementation Steps

**Step 1**: Add Debug Logging to EventBus Publish Method

```typescript
// File: backend/src/core/wesign/EventBus.ts
// Location: Line 55 (publish method)

async createAndPublish(
  eventType: EventType,
  source: string,
  data: Record<string, unknown>
): Promise<void> {
  const event = this.createEvent(eventType, source, data);

  // ✅ ADD THIS DEBUG LOGGING
  const subscriberCount = this.subscribers.get(eventType)?.size || 0;
  logger.info('[EventBus] Publishing event', {
    eventType,
    source,
    subscriberCount,
    hasSubscribers: subscriberCount > 0,
    dataKeys: Object.keys(data)
  });

  await this.publish(event);
}
```

**Step 2**: Add Debug Logging to Event Handler

```typescript
// File: backend/src/core/wesign/ExecutionManager.ts
// Location: Line 631 (in subscribeToExecutionEvents)

globalEventBus.subscribe(EventType.TEST_EXECUTION_COMPLETED, (event) => {
  // ✅ ADD THIS DEBUG LOGGING
  logger.info('[ExecutionManager] TEST_EXECUTION_COMPLETED event received', {
    executionId: event.data.executionId,
    status: event.data.status,
    hasError: !!event.data.error,
    eventId: event.id,
    timestamp: event.timestamp
  });

  const { executionId, status, error } = event.data;
  // ... rest of handler
});
```

**Step 3**: Run Test and Collect Logs

```bash
# Submit test with invalid path
curl -X POST http://localhost:8082/api/wesign/unified/execute \
  -H "Content-Type: application/json" \
  -d '{"framework":"wesign","testIds":["tests/fake/nonexistent.py::test_fake"],"mode":"single","workers":1,"browser":"chromium","headless":false,"aiEnabled":true,"autoHeal":true}'

# Wait 10 seconds, then check logs
# Look for:
# 1. "[EventBus] Publishing event" with eventType: TEST_EXECUTION_COMPLETED
# 2. "[ExecutionManager] TEST_EXECUTION_COMPLETED event received"
```

#### Testing Steps

1. **Start backend with changes**
2. **Submit invalid test** (use curl command above)
3. **Check logs** for event flow
4. **Analyze findings**:
   - If "Publishing event" appears but "event received" doesn't → Subscription issue
   - If neither appears → Event not being published
   - If both appear → Handler logic issue

#### Success Criteria

- [  ] Event publish log appears
- [  ] Event receive log appears
- [  ] Handler executes successfully
- [  ] Execution status updates to "failed" within 5 seconds

#### Rollback Plan

Changes are additive (only logging), safe to keep even if fix doesn't work.

---

### Fix #1.2: Execution Status Update - Implement Direct Update API

**Issue**: #1 (Alternative Approach if Event-Based Fails)
**Priority**: P0 (Critical)
**Estimated Time**: 3 hours
**Status**: ⏳ Pending (depends on Fix #1.1 results)

#### Implementation (If Needed)

If event-based approach proves unreliable, implement direct status update:

```typescript
// File: backend/src/core/wesign/ExecutionManager.ts
// Add new method

/**
 * Directly update execution status (bypasses event system)
 * Use when event-based updates are unreliable
 */
public updateExecutionStatus(
  executionId: string,
  status: ExecutionStatus,
  error?: string
): void {
  const executionHandle = this.activeExecutions.get(executionId);
  if (!executionHandle) {
    logger.warn('Cannot update status - execution not found', { executionId });
    return;
  }

  logger.info('[ExecutionManager] Directly updating execution status', {
    executionId,
    oldStatus: executionHandle.status,
    newStatus: status,
    hasError: !!error
  });

  executionHandle.status = status;
  executionHandle.endTime = new Date();
  if (error) {
    executionHandle.error = error;
  }

  // Schedule cleanup
  setTimeout(() => {
    this.activeExecutions.delete(executionId);
    this.removeFromPool(executionId);
    logger.debug('Removed completed execution from tracking', { executionId });
  }, 60000); // Keep for 1 minute
}
```

Then call from UnifiedTestEngine:

```typescript
// File: backend/src/core/wesign/UnifiedTestEngine.ts
// Location: After catch block (around line 296)

} catch (error) {
  context.status = 'failed';

  // Try event-based update first
  await globalEventBus.createAndPublish(...);

  // Fallback: Direct update (ONLY if event system unreliable)
  try {
    executionManager.updateExecutionStatus(
      executionId,
      'failed',
      error instanceof Error ? error.message : 'Unknown error'
    );
  } catch (updateError) {
    logger.error('Failed to update execution status', { updateError });
  }
}
```

#### Success Criteria

- [  ] Status updates to "failed" immediately
- [  ] Execution removed from active list after 60 seconds
- [  ] Health endpoint shows correct metrics

---

### Fix #2.1: WebSocket Connection - Diagnostic Testing

**Issue**: #2 - WebSocket Connection Failures
**Priority**: P0 (Critical)
**Estimated Time**: 2 hours
**Status**: 📋 Ready to Start

#### Pre-Fix Assessment

**Diagnostic Steps**:

```bash
# 1. Test WebSocket with wscat
npm install -g wscat
wscat -c ws://localhost:8082/ws/wesign

# Expected: Connection established
# Actual: [Record result here]

# 2. Check backend WebSocket setup
# File: backend/src/server.ts
# Search for: wss.on('connection')

# 3. Test simple WebSocket endpoint
# Create minimal test endpoint to verify WebSocket works at all
```

**Common Causes**:
1. Body parser middleware interfering with WebSocket upgrade
2. Missing WebSocket server initialization
3. Path routing incorrect
4. CORS blocking WebSocket handshake

#### Implementation Steps

**Step 1**: Verify WebSocket Server Initialization

```bash
# Check if WebSocket server is created
cd backend/src
grep -n "new WebSocket" server.ts
grep -n "wss.on" server.ts

# Should find WebSocket.Server creation
# Should find connection handler
```

**Step 2**: Add WebSocket Debug Logging

```typescript
// File: backend/src/server.ts
// Location: WebSocket server initialization (find exact line with grep above)

wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
  // ✅ ADD THIS DEBUG LOGGING
  logger.info('[WebSocket] Client connected', {
    url: req.url,
    origin: req.headers.origin,
    userAgent: req.headers['user-agent']
  });

  ws.on('error', (error) => {
    logger.error('[WebSocket] Connection error', { error: error.message, stack: error.stack });
  });

  ws.on('close', (code, reason) => {
    logger.info('[WebSocket] Connection closed', { code, reason: reason.toString() });
  });

  // ... rest of connection handler
});
```

**Step 3**: Check Middleware Order

Ensure body parsers come AFTER WebSocket server creation:

```typescript
// File: backend/src/server.ts
// CORRECT ORDER:

// 1. Create HTTP server
const server = http.createServer(app);

// 2. Create WebSocket server (BEFORE body parsers)
const wss = new WebSocket.Server({ server, path: '/ws/wesign' });

// 3. Setup middleware (AFTER WebSocket)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
```

#### Testing Steps

1. **Run wscat test**: `wscat -c ws://localhost:8082/ws/wesign`
2. **Check backend logs** for connection attempt
3. **Open browser DevTools** → Network → WS
4. **Refresh WeSign page**
5. **Observe WebSocket connection status**

#### Success Criteria

- [  ] wscat connects successfully
- [  ] Backend logs show "Client connected"
- [  ] Browser WebSocket shows "101 Switching Protocols"
- [  ] Frontend shows "Connected" badge (green)

---

### Fix #2.2: WebSocket Connection - Alternative Implementation

**Issue**: #2 (Alternative if basic fix fails)
**Priority**: P0 (Critical)
**Estimated Time**: 4 hours
**Status**: ⏳ Pending (depends on Fix #2.1)

#### Implementation (Socket.IO Migration)

If native WebSocket proves problematic, migrate to Socket.IO:

```bash
# Install Socket.IO
cd backend
npm install socket.io
npm install @socket.io/admin-ui

cd apps/frontend/dashboard
npm install socket.io-client
```

**Backend Changes**:

```typescript
// File: backend/src/server.ts

import { Server as SocketIOServer } from 'socket.io';

// Replace WebSocket.Server with Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: ['http://localhost:3001', 'http://localhost:5173'],
    credentials: true
  },
  path: '/socket.io/',
  transports: ['websocket', 'polling'] // Fallback to polling
});

io.on('connection', (socket) => {
  logger.info('[Socket.IO] Client connected', { socketId: socket.id });

  socket.on('disconnect', (reason) => {
    logger.info('[Socket.IO] Client disconnected', { socketId: socket.id, reason });
  });

  socket.on('error', (error) => {
    logger.error('[Socket.IO] Socket error', { error });
  });
});

// Export for use in ExecutionManager
export { io };
```

**Frontend Changes**:

```typescript
// File: apps/frontend/dashboard/src/services/WebSocketService.ts

import { io, Socket } from 'socket.io-client';

class WebSocketService {
  private socket: Socket | null = null;

  connect() {
    this.socket = io('http://localhost:8082', {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    this.socket.on('connect', () => {
      logger.info('[Socket.IO] Connected', { socketId: this.socket?.id });
      this.setState('connected');
    });

    this.socket.on('disconnect', (reason) => {
      logger.warn('[Socket.IO] Disconnected', { reason });
      this.setState('disconnected');
    });

    this.socket.on('connect_error', (error) => {
      logger.error('[Socket.IO] Connection error', { error });
      this.setState('error');
    });
  }
}
```

#### Success Criteria

- [  ] Socket.IO connects successfully
- [  ] Automatic reconnection works
- [  ] Polling fallback works if WebSocket blocked
- [  ] Real-time events flowing correctly

---

### Fix #3: Test Count Mismatch

**Issue**: #3 - 288 vs 533 Tests
**Priority**: P0 (Critical)
**Estimated Time**: 3 hours
**Status**: 📋 Ready to Start

#### Pre-Fix Assessment

**Diagnostic Steps**:

```bash
# 1. Test backend API directly
curl -s http://localhost:8082/api/test-banks | py -m json.tool > test-banks-api.json

# Check total count in response
cat test-banks-api.json | findstr /C:"\"total\""

# 2. Check frontend network request
# Open DevTools → Network → test-banks
# Compare response with API test above

# 3. Check frontend code for limits
cd apps/frontend/dashboard/src
grep -rn "limit" hooks/useWeSign.ts
grep -rn "slice" hooks/useWeSign.ts
```

#### Implementation Steps

**Step 1**: Verify API Response

Check `GET /api/test-banks` returns all 634 tests:

```bash
curl -s http://localhost:8082/api/test-banks | py -m json.tool | findstr /C:"total" /C:"tests"
```

Expected:
```json
{
  "total": 634,
  "tests": [ /* array of 634 items */ ]
}
```

**Step 2**: Check Frontend Hook for Limits

```typescript
// File: apps/frontend/dashboard/src/hooks/useWeSign.ts
// Search for:
// - .slice()
// - LIMIT
// - pageSize
// - per_page

// Remove any artificial limits:

// BEFORE (example):
const fetchTests = async () => {
  const response = await api.get('/test-banks?limit=288'); // ← REMOVE LIMIT
  return response.data;
};

// AFTER:
const fetchTests = async () => {
  const response = await api.get('/test-banks'); // ← No limit
  return response.data;
};
```

**Step 3**: Check for Pagination Logic

If pagination exists, ensure it loads all pages:

```typescript
// Implement "load more" or "load all" functionality
const fetchAllTests = async () => {
  let allTests = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await api.get(`/test-banks?page=${page}&limit=100`);
    allTests = [...allTests, ...response.data.tests];
    hasMore = response.data.hasMore;
    page++;
  }

  return allTests;
};
```

#### Testing Steps

1. **Clear browser cache**: Ctrl+Shift+Del → Clear cache
2. **Hard refresh**: Ctrl+Shift+R
3. **Check test count** on WeSign Testing Hub
4. **Verify**: Should show 634 tests

#### Success Criteria

- [  ] Backend API returns 634 tests
- [  ] Frontend fetches all 634 tests
- [  ] Dashboard shows "634 Total Tests"
- [  ] Test list scrollable with all tests visible
- [  ] No console errors during fetch

---

## Sprint 2: High Priority Features (Week 2)

**Goal**: Improve UX and enable all features
**Timeline**: 5 days
**Prerequisites**: Sprint 1 completed

---

### Fix #5: Navigation Bar Visibility

**Issue**: #5 - Hidden Menu Items
**Priority**: P1 (High)
**Estimated Time**: 1 hour
**Status**: 📋 Ready to Start

#### Implementation

```typescript
// File: apps/frontend/dashboard/src/components/Nav.tsx
// Location: Line 130

// BEFORE:
{navItems.filter(item => item.priority === 'tools').slice(0, 2).map((item) => {

// AFTER:
{navItems.filter(item => item.priority === 'tools').map((item) => {
  // Shows all 4 tools items: AI Assistant, Knowledge Base, WeSign Knowledge, Sub-Agents
```

#### Testing

1. Refresh dashboard
2. Check navigation bar
3. Verify all 4 "tools" items visible:
   - AI Assistant ✓
   - Knowledge Base ✓
   - WeSign Knowledge ✓
   - Sub-Agents ✓

#### Success Criteria

- [  ] All navigation items visible
- [  ] Links functional
- [  ] Active state highlights correctly

---

### Fix #8: Execution Queue Information

**Issue**: #8 - Showing UUIDs Instead of Test Names
**Priority**: P1 (High)
**Estimated Time**: 2 hours
**Status**: 📋 Ready to Start

#### Implementation

**Step 1**: Update Backend ExecutionHandle Type

```typescript
// File: backend/src/core/wesign/types.ts

export interface ExecutionHandle {
  executionId: string;
  testName: string;        // ← ADD
  testIds: string[];       // ← ADD
  framework: string;
  category?: string;       // ← ADD
  tags?: string[];         // ← ADD
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  error?: string;
  progress?: {
    total: number;
    completed: number;
    percentage: number;
  };
}
```

**Step 2**: Map Test IDs to Names in ExecutionManager

```typescript
// File: backend/src/core/wesign/ExecutionManager.ts
// Location: queueExecution method

async queueExecution(config: UnifiedTestConfig): Promise<string> {
  const executionId = uuidv4();

  // ✅ ADD: Resolve test names from IDs
  const testNames = await this.resolveTestNames(config.tests.testIds || []);
  const testName = testNames.length > 0
    ? testNames.length === 1
      ? testNames[0]
      : `${testNames.length} tests`
    : 'Unknown test';

  const executionHandle: ExecutionHandle = {
    executionId,
    testName,          // ← ADD
    testIds: config.tests.testIds || [],  // ← ADD
    category: this.detectCategory(config.tests.testIds),  // ← ADD
    framework: config.framework,
    status: 'queued',
    startTime: new Date()
  };

  // ... rest of method
}

// ✅ ADD: Helper method to resolve test names
private async resolveTestNames(testIds: string[]): Promise<string[]> {
  // Query test discovery database for test names
  // For now, extract from test ID path
  return testIds.map(id => {
    const match = id.match(/test_([^:]+)::([^:]+)/);
    return match ? match[2].replace(/_/g, ' ') : id;
  });
}

// ✅ ADD: Helper to detect category
private detectCategory(testIds?: string[]): string | undefined {
  if (!testIds || testIds.length === 0) return undefined;
  const firstTest = testIds[0];
  if (firstTest.includes('/auth/')) return 'Authentication';
  if (firstTest.includes('/documents/')) return 'Documents';
  if (firstTest.includes('/signing/')) return 'Signing';
  if (firstTest.includes('/contacts/')) return 'Contacts';
  return undefined;
}
```

**Step 3**: Update Frontend Display

```typescript
// File: apps/frontend/dashboard/src/pages/WeSignTestingHub/WeSignTestingHub.tsx
// Location: Line 316 (Execution Queue Panel)

// BEFORE:
<h4 className="font-medium text-sm truncate">{execution.testName || execution.id}</h4>

// AFTER:
<div>
  <h4 className="font-medium text-sm truncate">{execution.testName}</h4>
  {execution.category && (
    <p className="text-xs text-muted-foreground">{execution.category} • {execution.framework}</p>
  )}
  {execution.testIds && execution.testIds.length > 1 && (
    <p className="text-xs text-muted-foreground">{execution.testIds.length} tests</p>
  )}
</div>
```

#### Testing

1. Execute a test
2. Check Execution Queue panel
3. Verify displays:
   - Test name (not UUID)
   - Category
   - Framework
   - Count if multiple tests

#### Success Criteria

- [  ] Test names display correctly
- [  ] Category shown
- [  ] Framework shown
- [  ] Multi-test count shown

---

### Fix #9: Test Search and Filter

**Issue**: #9 - No Filtering for 634 Tests
**Priority**: P1 (High)
**Estimated Time**: 4 hours
**Status**: 📋 Ready to Start

#### Implementation

**Step 1**: Add State for Filters

```typescript
// File: apps/frontend/dashboard/src/pages/WeSignTestingHub/WeSignTestingHub.tsx

const [searchQuery, setSearchQuery] = useState('');
const [categoryFilter, setCategoryFilter] = useState<string>('');
const [statusFilter, setStatusFilter] = useState<string>('');
const [tagFilter, setTagFilter] = useState<string>('');

// Computed filtered tests
const filteredTests = useMemo(() => {
  if (!tests) return [];

  return tests.filter(test => {
    // Search filter
    const matchesSearch = !searchQuery ||
      test.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      test.description?.toLowerCase().includes(searchQuery.toLowerCase());

    // Category filter
    const matchesCategory = !categoryFilter || test.category === categoryFilter;

    // Status filter
    const matchesStatus = !statusFilter ||
      (statusFilter === 'passed' && test.lastResult?.status === 'passed') ||
      (statusFilter === 'failed' && test.lastResult?.status === 'failed') ||
      (statusFilter === 'never-run' && !test.lastResult);

    // Tag filter
    const matchesTag = !tagFilter || test.tags?.includes(tagFilter);

    return matchesSearch && matchesCategory && matchesStatus && matchesTag;
  });
}, [tests, searchQuery, categoryFilter, statusFilter, tagFilter]);
```

**Step 2**: Add Filter UI

```tsx
{/* Search and Filters - Add above test list */}
<div className="space-y-3 mb-4">
  <div className="flex gap-3">
    <Input
      type="text"
      placeholder="Search tests..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      className="flex-1"
    />
    <Button
      variant="outline"
      onClick={() => {
        setSearchQuery('');
        setCategoryFilter('');
        setStatusFilter('');
        setTagFilter('');
      }}
    >
      Clear Filters
    </Button>
  </div>

  <div className="flex gap-3">
    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
      <SelectTrigger className="w-48">
        <SelectValue placeholder="All Categories" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="">All Categories</SelectItem>
        <SelectItem value="auth">Authentication</SelectItem>
        <SelectItem value="documents">Documents</SelectItem>
        <SelectItem value="signing">Signing</SelectItem>
        <SelectItem value="contacts">Contacts</SelectItem>
        <SelectItem value="templates">Templates</SelectItem>
      </SelectContent>
    </Select>

    <Select value={statusFilter} onValueChange={setStatusFilter}>
      <SelectTrigger className="w-48">
        <SelectValue placeholder="All Statuses" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="">All Statuses</SelectItem>
        <SelectItem value="passed">Passed</SelectItem>
        <SelectItem value="failed">Failed</SelectItem>
        <SelectItem value="never-run">Never Run</SelectItem>
      </SelectContent>
    </Select>

    <Badge variant="secondary">
      {filteredTests.length} / {tests?.length || 0} tests
    </Badge>
  </div>
</div>

{/* Test List - Use filteredTests instead of tests */}
<div className="max-h-96 overflow-y-auto space-y-2">
  {filteredTests.map((test) => (
    // ... test rendering
  ))}
</div>
```

#### Testing

1. Type in search box → Tests filter in real-time
2. Select category → Shows only that category
3. Select status → Shows only tests with that status
4. Clear filters → Shows all 634 tests again

#### Success Criteria

- [  ] Search works (instant filtering)
- [  ] Category filter works
- [  ] Status filter works
- [  ] Filter badge shows correct count
- [  ] Clear filters resets all

---

### Fix #10: Analytics Insights Generation

**Issue**: #10 - No Insights Available
**Priority**: P1 (High)
**Estimated Time**: 4 hours
**Status**: 📋 Ready to Start

#### Implementation

**Step 1**: Check TestIntelligenceAgent Status

```bash
# Check if agent is running
curl -s http://localhost:8082/api/sub-agents | py -m json.tool

# Should show test-intelligence-agent with status: active
```

**Step 2**: Trigger Insights Generation

```typescript
// File: backend/src/services/subAgents/TestIntelligenceAgent.ts (or .com.ts)

// Add method to generate insights on demand
public async generateInsights(testIds?: string[]): Promise<TestInsights> {
  logger.info('[TestIntelligenceAgent] Generating insights', {
    testCount: testIds?.length || 'all'
  });

  const insights: TestInsights = {
    flakiness: await this.analyzeFlakiness(testIds),
    coverage: await this.analyzeCoverage(testIds),
    performance: await this.analyzePerformance(testIds)
  };

  // Store in database for future retrieval
  await this.storeInsights(insights);

  return insights;
}
```

**Step 3**: Add API Endpoint

```typescript
// File: backend/src/routes/wesign-unified.ts

router.post('/api/wesign/unified/insights/generate', async (req, res) => {
  try {
    const { testIds } = req.body;

    const agent = subAgentManager.getAgent('test-intelligence-agent');
    if (!agent) {
      return res.status(503).json({
        error: 'Test Intelligence Agent not available'
      });
    }

    const insights = await agent.generateInsights(testIds);

    res.json({
      success: true,
      data: insights
    });
  } catch (error) {
    logger.error('Failed to generate insights', { error });
    res.status(500).json({ error: 'Failed to generate insights' });
  }
});
```

**Step 4**: Add UI Button

```tsx
// File: apps/frontend/dashboard/src/pages/WeSignTestingHub/WeSignTestingHub.tsx
// In Analytics Tab

<div className="flex items-center justify-between mb-4">
  <h3 className="text-lg font-semibold">Test Insights</h3>
  <Button
    onClick={async () => {
      setGeneratingInsights(true);
      try {
        await api.post('/wesign/unified/insights/generate');
        await refetchInsights();
      } catch (error) {
        console.error('Failed to generate insights:', error);
      } finally {
        setGeneratingInsights(false);
      }
    }}
    disabled={generatingInsights}
  >
    {generatingInsights ? (
      <>
        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
        Generating...
      </>
    ) : (
      <>
        <Zap className="h-4 w-4 mr-2" />
        Generate Insights
      </>
    )}
  </Button>
</div>
```

#### Testing

1. Navigate to Analytics tab
2. Click "Generate Insights"
3. Wait for processing
4. Verify insights appear:
   - Flaky tests listed
   - Coverage gaps shown
   - Performance trends displayed

#### Success Criteria

- [  ] Button triggers insights generation
- [  ] Loading state shown during generation
- [  ] Insights appear after generation
- [  ] Data persists across page reloads

---

## Sprint 3: Testing & Polish (Week 3)

**Goal**: Production-ready dashboard
**Timeline**: 5 days

### Day 1-2: Comprehensive Testing

- [ ] Manual UI testing of all pages
- [ ] All interactive elements functional
- [ ] Responsive design on desktop + tablet
- [ ] No console errors on normal operations

### Day 3: Performance Testing

- [ ] Load 634 tests without lag
- [ ] Handle 10 concurrent executions
- [ ] Monitor memory usage
- [ ] Check for memory leaks

### Day 4: Documentation

- [ ] Update README with new features
- [ ] Update API documentation
- [ ] Create user guide
- [ ] Document known limitations

### Day 5: UAT

- [ ] User acceptance testing
- [ ] Gather feedback
- [ ] Address critical feedback
- [ ] Prepare production deployment

---

## Monitoring & Rollback

### Post-Fix Monitoring

After each fix:
1. Monitor backend logs for 1 hour
2. Check error rates in analytics
3. Monitor memory usage
4. Watch for new console errors

### Rollback Procedures

If a fix causes regression:
```bash
# Immediate rollback
git revert <commit-hash>
git push origin main

# Restart services
cd backend && npm run dev
cd apps/frontend/dashboard && npm run dev

# Verify system stable
curl -s http://localhost:8082/api/health
```

---

## Success Metrics Dashboard

```
┌──────────────────────────────────────────────────────┐
│                 FIX PROGRESS TRACKER                 │
├──────────────────────────────────────────────────────┤
│ Sprint 1: Critical Blockers                          │
│  [▓▓▓░░░░░░░] Issue #1: In Progress (30%)            │
│  [░░░░░░░░░░] Issue #2: Not Started (0%)             │
│  [░░░░░░░░░░] Issue #3: Not Started (0%)             │
│                                                      │
│ Sprint 2: High Priority                              │
│  [░░░░░░░░░░] Issue #5: Not Started (0%)             │
│  [░░░░░░░░░░] Issue #8: Not Started (0%)             │
│  [░░░░░░░░░░] Issue #9: Not Started (0%)             │
│  [░░░░░░░░░░] Issue #10: Not Started (0%)            │
│                                                      │
│ Sprint 3: Testing & Polish                           │
│  [░░░░░░░░░░] Not Started (0%)                       │
│                                                      │
│ Overall Progress: 5% Complete                        │
│ Estimated Completion: 2-3 weeks                      │
└──────────────────────────────────────────────────────┘
```

---

## Next Steps

1. **NOW**: Begin Fix #1.1 (Add event flow debug logging)
2. **TODAY**: Complete Sprint 1, Issue #1
3. **TOMORROW**: Start Issue #2 (WebSocket diagnostics)
4. **THIS WEEK**: Complete Sprint 1 (all P0 issues)
5. **NEXT WEEK**: Begin Sprint 2 (P1 issues)

---

**End of Fix Plan**

*Status: 🔧 ACTIVE - Currently working on Issue #1.1*
