# Week 5 Day 8 - WebSocket Fix Investigation - Session Summary

**Date**: 2025-10-26 01:00 AM - 01:35 AM
**Duration**: ~35 minutes
**Issue**: P0 Critical - WebSocket "Invalid frame header" error
**Status**: ❌ **ISSUE NOT RESOLVED** - Requires deeper architectural change

---

## Executive Summary

Two fix attempts were made to resolve the WebSocket "Invalid frame header" error:
1. **Attempt #1**: Sequential message sending with `setImmediate()` + 10ms delays - **FAILED**
2. **Attempt #2**: Wait for client message or 200ms timeout before sending - **FAILED**

**Root Cause (Revised)**: The issue is at the **WebSocket protocol/framing level**, NOT at the application message level. The error occurs 10-30ms after connection establishment, BEFORE any application-level messages can be processed or even sent.

**Recommendation**: Consider switching to Socket.IO (already installed) or investigate if there's a fundamental protocol incompatibility between the `ws` library version and browser WebSocket implementation.

---

## Timeline of Work

### 00:57 - Initial Context Load
- Resumed from previous session
- Updated todo list for Week 5 Day 8-9 tasks
- Verified backend and frontend services running

### 01:00 - Root Cause Analysis
- Read `backend/src/server.ts` (lines 355-454) - WebSocket server initialization
- Read `backend/src/core/wesign/EventBus.ts` (lines 78-150) - Event broadcasting
- **Found**: Race condition between server.ts sending initial message and EventBus sending 10 historical events

### 01:05 - Fix Attempt #1 Implementation
**Changes Applied**:
- `server.ts` lines 378-381: Removed duplicate initial connection message
- `EventBus.ts` lines 78-128: Added `setImmediate()` wrapper and 10ms delays between messages
- `EventBus.ts` lines 218-248: Added connection state checks and error handling

**Testing**: Browser still shows "Invalid frame header" error
**Result**: ❌ FAILED

### 01:15 - Analysis of Failure
- Created `WEEK5_DAY8_FIX_ATTEMPT_1_FAILED.md` documenting findings
- Reviewed client-side `WebSocketService.ts` to understand message handling
- **Key Discovery**: Error occurs BEFORE `handleMessage()` can parse anything
- This indicates **protocol-level** issue, not application-level

###  01:20 - Fix Attempt #2 Implementation
**Strategy**: Wait for client to send a message OR timeout after 200ms before sending anything

**Changes Applied**:
- `EventBus.ts` lines 78-175: Complete rewrite of `addWebSocketClient()`
  - Added `onClientReady` message handler
  - Added 200ms fallback timeout
  - Increased initial delay to 50ms

**Testing**: Browser still shows "Invalid frame header" error
**Result**: ❌ FAILED

### 01:30 - Final Analysis
- Confirmed backend code changes loaded properly (forced restart)
- **Critical Finding**: Timeout code NEVER triggered - connection dies in <30ms
- **Timing Evidence**:
  ```
  01:30:02.066 - Connection opened
  01:30:02.078 - Invalid frame header (12ms later!)
  01:30:02.079 - Connection closed
  ```
- The 12ms timing is TOO FAST for any of our application-level delays to matter

---

## Technical Deep Dive

### The WebSocket Frame Structure Problem

WebSocket messages are sent as binary frames with this structure:
```
[FIN bit | Opcode | Payload Length | Masking Key | Payload Data]
```

The error "Invalid frame header" means the browser's WebSocket parser received malformed frame headers. This happens at the **protocol layer**, not the application layer.

### Why Application-Level Fixes Can't Work

```
Timeline:
T+0ms:    TCP/TLS handshake complete
T+5ms:    WebSocket HTTP upgrade complete
T+10ms:   Browser WebSocket reports OPEN state
T+12ms:   ❌ "Invalid frame header" error
T+13ms:   Connection terminates

Our attempted fixes:
- setImmediate() = ~1-2ms delay
- setTimeout(fn, 200) = 200ms delay
- Message handler = requires client to send first

The error happens at T+12ms, which is:
- BEFORE our 200ms timeout could fire
- BEFORE client's handleMessage() is called
- TOO FAST for even setImmediate() to help
```

### Possible Root Causes

#### 1. **Protocol Version Mismatch**
- `ws` library: v8.18.3 and v8.17.1 (multiple versions)
- Browser: Native WebSocket (RFC 6455)
- **Possibility**: Subtle protocol incompatibility

#### 2. **Frame Encoding Issue**
- Server might be sending frames with incorrect encoding
- Masking bit confusion (server-to-client frames must NOT be masked)
- Payload length calculation error

#### 3. **ws Library Bug with HTTP Server Setup**
- Using `noServer: true` option
- Manual upgrade handling
- Possible issue with how `wss.handleUpgrade()` is called

#### 4. **Multiple WebSocket Server Instances**
- Code shows TWO WebSocket-related initializations:
  - `/ws/wesign` (line 355-454)
  - CI WebSocket handler
- **Possible conflict** or shared port issue

---

## Files Modified During Session

### Attempt #1:
1. **backend/src/server.ts** (lines 378-381)
   - Removed: Initial connection message sending
   - Added: Comment explaining EventBus will handle messaging

2. **backend/src/core/wesign/EventBus.ts** (lines 78-128)
   - Added: `setImmediate()` wrapper
   - Added: Sequential sending with 10ms delays
   - Added: Connection state verification

3. **backend/src/core/wesign/EventBus.ts** (lines 218-248)
   - Added: `ws.readyState === WebSocket.OPEN` check
   - Added: Error callback to `ws.send()`
   - Added: Try-catch wrapper

### Attempt #2:
4. **backend/src/core/wesign/EventBus.ts** (lines 78-175)
   - Complete rewrite of `addWebSocketClient()`
   - Added: `onClientReady` message handler
   - Added: 200ms fallback timeout
   - Changed: 50ms initial delay (was 0ms)

---

## Evidence Collected

### Backend Logs Pattern:
```
[info]: WeSign WebSocket client connected     ← server.ts logs this
[info]: WebSocket client connected            ← EventBus logs this (~0ms later)
[info]: WeSign WebSocket client disconnected  ← ~30ms later
```

### Frontend Console Pattern:
```
[LOG] Connection state changed: disconnected -> connecting
[LOG] Connecting to WebSocket server
[LOG] WebSocket connection opened             ← Browser reports OPEN
[ERROR] Invalid frame header                  ← 10-30ms later
[LOG] Connection state changed: connected -> error -> disconnected
[LOG] Attempting reconnection 1/5 in 5000ms
```

### Key Observations:
1. ✅ Backend logs show connection accepted
2. ✅ Browser logs show connection opened (OPEN state)
3. ❌ Error occurs BEFORE any application messages are processed
4. ❌ Error is deterministic (happens 100% of the time)
5. ❌ Timing is extremely fast (10-30ms)
6. ❌ No logs from our new "Client ready timeout" code (never reached)

---

## Next Steps & Recommendations

### Option A: Switch to Socket.IO (RECOMMENDED)
**Pros**:
- Already installed in the project (`socket.io@4.8.1`)
- Higher-level abstraction hides frame-level details
- Built-in reconnection and heartbeat
- Widely used and battle-tested
- Handles browser compatibility automatically

**Cons**:
- Requires changes to both server and client code
- Different API from native WebSocket

**Effort**: ~2-3 hours
- Update server.ts to use Socket.IO server
- Update WebSocketService.ts to use socket.io-client
- Test all real-time features
- Update documentation

### Option B: Debug ws Library Configuration
**Investigation Points**:
1. Check if `noServer: true` is causing issues
2. Try different `perMessageDeflate` settings
3. Verify `wss.handleUpgrade()` is called correctly
4. Check for conflicting WebSocket servers on same port
5. Test with ws library downgrade (try v7.x)

**Effort**: ~4-6 hours (uncertain success rate)

### Option C: Use Separate Port for WebSocket
**Strategy**: Run WebSocket server on different port (e.g., 8083)

**Pros**:
- Isolates WebSocket from HTTP server
- Eliminates potential upgrade handler conflicts

**Cons**:
- CORS complexity
- Client needs to connect to different port
- Deployment/firewall considerations

**Effort**: ~1-2 hours

### Option D: Minimal WebSocket Test
**Strategy**: Create minimal reproducible test case

```typescript
// minimal-ws-test.ts
import { WebSocketServer } from 'ws';
import http from 'http';

const server = http.createServer();
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    ws.send('test'); // Just send one simple message
  });
});

server.listen(9000);
```

Test if THIS minimal case works. If yes → issue is in our code. If no → issue is environmental.

**Effort**: ~30 minutes

---

## Recommended Action Plan

1. **Immediate (Next Session)**:
   - Run Option D (minimal test) to isolate the issue
   - If minimal test FAILS → environmental/library issue
   - If minimal test WORKS → our code has the bug

2. **Short-term (This Week)**:
   - Implement Option A (Socket.IO migration)
   - This is the safest path to resolution
   - Socket.IO is already installed and proven

3. **Long-term (After Fix)**:
   - Document the root cause once found
   - Add integration tests for WebSocket connections
   - Consider adding WebSocket connection health monitoring

---

## Time Breakdown

- **Analysis & Investigation**: 15 minutes
- **Attempt #1 Implementation**: 10 minutes
- **Attempt #1 Testing**: 5 minutes
- **Attempt #2 Implementation**: 10 minutes
- **Attempt #2 Testing & Verification**: 10 minutes
- **Documentation**: 10 minutes
- **Total**: ~60 minutes (session time: 35 minutes active work)

---

## Impact Assessment

**Current State**:
- ❌ Real-time updates completely broken
- ❌ All 17 pages affected
- ❌ User experience degraded (no live test execution updates)
- ✅ Core functionality works (tests can still be run)
- ✅ System is stable otherwise

**Priority**: **P0 Critical** - Blocks Week 5 progress
**User Impact**: **High** - No real-time feedback during test execution
**Risk**: **Medium** - Core testing functionality unaffected, but UX significantly degraded

---

## Lessons Learned

1. **Protocol-level issues require protocol-level solutions**: Application code cannot fix frame encoding problems
2. **Fast failures indicate deep issues**: 10-30ms timing suggests handshake/protocol problem
3. **Test minimal cases first**: Should have created minimal WebSocket test before complex fixes
4. **Consider proven alternatives**: Socket.IO is battle-tested for these exact scenarios
5. **Evidence over assumptions**: The fact that timeout code never triggered told us everything

---

## Files Created This Session

1. `qa_intel/WEEK5_DAY8_WEBSOCKET_FIX_ANALYSIS.md` - Initial root cause analysis
2. `qa_intel/WEEK5_DAY8_FIX_ATTEMPT_1_FAILED.md` - Attempt #1 failure documentation
3. `qa_intel/WEEK5_DAY8_SESSION_SUMMARY.md` - This file

---

**Status**: ⏸️ **PAUSED** - Awaiting decision on Option A (Socket.IO) vs Option D (minimal test)

**Next Session Priority**: Create minimal WebSocket test to isolate issue, then proceed with Socket.IO migration if needed

---

## Appendix: Key Code Locations

- **WebSocket Server Init**: `backend/src/server.ts` lines 355-454
- **Event Broadcasting**: `backend/src/core/wesign/EventBus.ts` lines 78-175
- **Client Service**: `apps/frontend/dashboard/src/services/WebSocketService.ts`
- **Client Message Handler**: `WebSocketService.ts` lines 346-366

## Appendix: Related Issues

- None yet - this is the first major WebSocket issue encountered
- Should create GitHub issue once root cause confirmed

---

**End of Session Summary**
