# Testing Hub UI Validation - Issues Tracker

**Date**: 2025-10-20
**Validation Guide**: See `UI_VALIDATION_GUIDE.md`
**Status**: In Progress

---

## Issue Severity Levels

- **P0 (Critical)**: Blocks core functionality, system unusable
- **P1 (High)**: Major feature broken, significant impact
- **P2 (Medium)**: Feature partially broken, workaround exists
- **P3 (Low)**: Minor issue, cosmetic, enhancement

---

## Issues Found

### Template Format

```markdown
### Issue #N: [Brief Title]

**Severity**: P0/P1/P2/P3
**Component**: Test Banks / Execution / Reports / Self-Healing / Scheduler / Analytics
**Browser**: Chrome / Firefox / Edge / Safari / All
**Discovered In**: Phase X - [Phase Name]
**Date**: 2025-10-20

**Description**:
[Clear description of what's wrong]

**Steps to Reproduce**:
1. Navigate to...
2. Click...
3. Observe...

**Expected Behavior**:
[What should happen]

**Actual Behavior**:
[What actually happens]

**Screenshot**: `screenshots/ui_validation/issue_N.png`

**Error Messages** (if any):
```
[Console errors or API errors]
```

**Workaround** (if any):
[Temporary solution]

**Recommended Fix**:
[Suggested solution]

**Status**: Open / In Progress / Fixed / Won't Fix
```

---

## Issues Log

### Issue #1: Backend Missing 'sqlite' Module - Critical Backend Crash (P0)

**Severity**: P0 (Critical)
**Component**: Backend / Database
**Browser**: All
**Discovered In**: Phase 2.1 - Backend Log Analysis
**Date**: 2025-10-20

**Description**:
Backend server is crashing repeatedly due to missing 'sqlite' module dependency.

**Steps to Reproduce**:
1. Start backend server with `npm run dev`
2. Server crashes immediately
3. Observe error in logs

**Expected Behavior**:
Backend should start successfully and maintain WebSocket connections.

**Actual Behavior**:
Backend crashes with "Error: Cannot find module 'sqlite'" and continuously restarts.

**Error Messages**:
```
Error: Cannot find module 'sqlite'
Require stack:
- C:\Users\gals\Desktop\playwrightTestsClaude\backend\src\routes\test-banks.ts
- C:\Users\gals\Desktop\playwrightTestsClaude\backend\src\server.ts
    at node:internal/modules/cjs/loader:1401:15
```

**Root Cause**:
The file `backend/src/routes/test-banks.ts:8` is trying to import 'sqlite' which is not installed in package.json.

**Impact**:
- Backend server unstable (continuous crashes)
- WebSocket connections fail (explains Issue #2 below)
- API endpoints return 500 errors
- Test count mismatch (frontend can't fetch data from crashing backend)
- **Blocks all UI validation** - system is non-functional

**Recommended Fix**:
1. Remove or update the import in test-banks.ts (line 8)
2. If needed, install the correct SQLite package: `npm install sqlite3` or use existing `better-sqlite3`
3. Ensure test-banks route uses the same database connection as the rest of the backend

**Status**: ✅ **FIXED** - Backend now stable (converted to better-sqlite3 synchronous API)

---

### Issue #2: WebSocket Connection Failures (P0 - Critical)

**Severity**: P0 (Critical)
**Component**: Real-Time Monitoring
**Browser**: Chromium (Playwright)
**Discovered In**: Phase 2.1 - Initial Page Load
**Date**: 2025-10-20

**Description**:
WebSocket connection to 'ws://localhost:8082/ws/wesign' repeatedly fails with "Invalid frame header" errors.

**Steps to Reproduce**:
1. Navigate to http://localhost:3001/wesign
2. Open browser console
3. Observe repeated WebSocket connection failures every 5 seconds

**Expected Behavior**:
WebSocket should establish stable connection and show "Connected" status.

**Actual Behavior**:
- Connection attempts every 5 seconds
- All connections fail with "Invalid frame header"
- UI shows "Disconnected" status permanently

**Error Messages** (from browser console):
```
WebSocket connection to 'ws://localhost:8082/ws/wesign' failed: Invalid frame header
[WebSocketService] WebSocket error occurred
[WebSocketService] Connection state changed: connected -> error
[WebSocketService] WebSocket connection closed: 1006 -
```

**Root Cause**:
**LINKED TO ISSUE #1** - Backend server is crashing due to missing 'sqlite' module, causing WebSocket server to be unstable or not properly initialized.

**Impact**:
- Real-time test execution updates not working
- Live monitoring features unavailable
- Test execution progress tracking broken
- User cannot see real-time status of running tests

**Recommended Fix**:
Fix Issue #1 first (backend crash), then WebSocket should stabilize.

**Status**: Open - BLOCKED BY ISSUE #1

---

### Issue #3: Test Count Mismatch - 288 vs 533 (P0 - Critical)

**Severity**: P0 (Critical)
**Component**: Test Banks / Data Synchronization
**Browser**: All
**Discovered In**: Phase 2.2 - Test Banks Display
**Date**: 2025-10-20

**Description**:
Frontend dashboard shows "288 Total Tests" but backend API reports 533 tests discovered.

**Expected**:
- E2E: 427 tests
- API: 97 tests
- Load: 9 tests
- **Total: 533 tests**

**Actual**:
- UI displays: **288 tests**
- **Discrepancy: 245 missing tests (46% data loss)**

**Evidence**:
- Backend API `GET /api/test-banks` verified correct (533 total)
- Backend logs show successful test discovery of 533 tests
- Frontend statistics card shows only 288
- Screenshot: `01_wesign_hub_initial_state.png`

**Root Cause**:
**LIKELY LINKED TO ISSUE #1** - Backend crashes may be preventing full data sync to frontend. Frontend may be fetching from a stale/incomplete cache or the API call is failing mid-transfer.

**Impact**:
- **46% of tests invisible to users**
- Cannot execute all discovered tests through UI
- Test coverage incomplete
- Critical data integrity issue

**Recommended Fix**:
1. Fix Issue #1 (backend stability)
2. Clear browser cache and reload
3. Check frontend API calls for errors
4. Verify database query returns all 533 tests
5. Check for pagination/limit issues in frontend fetch logic

**Status**: Open - BLOCKED BY ISSUE #1

---

<!-- Add issues below as discovered -->

### Example Issues (Remove after real issues are documented)

### Issue #1: Test Discovery Button Not Responsive

**Severity**: P1
**Component**: Test Banks
**Browser**: Chrome
**Discovered In**: Phase 2.3 - Test Discovery
**Date**: 2025-10-20

**Description**:
The "Discover All Tests" button does not respond to clicks on first attempt.

**Steps to Reproduce**:
1. Navigate to Test Banks page
2. Click "Discover All Tests" button
3. Nothing happens

**Expected Behavior**:
Button should trigger test discovery immediately with loading indicator.

**Actual Behavior**:
Button click has no effect. Second click works.

**Screenshot**: `screenshots/ui_validation/issue_1.png`

**Error Messages**: None

**Workaround**: Click the button twice

**Recommended Fix**:
- Check event handler attachment
- Add debouncing if needed
- Verify button state management

**Status**: Example (Delete this issue)

---

## Summary Statistics

**Total Issues**: 0
- P0 (Critical): 0
- P1 (High): 0
- P2 (Medium): 0
- P3 (Low): 0

**By Component**:
- Test Banks: 0
- Test Execution: 0
- Reports: 0
- Self-Healing: 0
- Scheduler: 0
- Analytics: 0
- Real-Time Monitor: 0
- AI Assistant: 0
- Other: 0

**By Status**:
- Open: 0
- In Progress: 0
- Fixed: 0
- Won't Fix: 0

---

## Action Items

### Priority Fixes (P0/P1)
<!-- List critical issues that must be fixed -->

1. [None yet]

### High Priority (P2)
<!-- List important issues to fix soon -->

1. [None yet]

### Enhancement Requests (P3)
<!-- List nice-to-have improvements -->

1. [None yet]

---

## Notes

<!-- Add any additional observations or context -->

-
