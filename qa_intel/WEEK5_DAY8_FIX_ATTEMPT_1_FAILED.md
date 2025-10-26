# Week 5 Day 8 - WebSocket Fix Attempt #1 - FAILED ❌

**Date**: 2025-10-26 01:15 AM
**Issue**: P0 Critical - WebSocket "Invalid frame header" error
**Status**: Fix Attempt #1 Failed - Issue persists

---

## Fix Attempt #1 Summary

### Changes Applied:
1. ✅ **server.ts (lines 378-381)**: Removed duplicate initial connection message
2. ✅ **EventBus.ts (lines 78-128)**: Added `setImmediate()` and sequential sending with 10ms delays
3. ✅ **EventBus.ts (lines 218-248)**: Added safety checks to `sendToWebSocket`

### Result: ❌ FAILED

**Evidence**:
- Browser console still shows: `ERROR: WebSocket connection to 'ws://localhost:8082/ws/wesign' failed: Invalid frame header`
- Backend logs show: Connected → Disconnected pattern repeating every 5 seconds
- Pattern:
  ```
  [info]: WeSign WebSocket client connected
  [info]: WebSocket client connected (from EventBus)
  [info]: WeSign WebSocket client disconnected  ← IMMEDIATE disconnect
  ```

---

## Root Cause Analysis - REVISED

### Initial Hypothesis (INCORRECT):
❌ Race condition between server.ts sending initial message and EventBus sending 10 historical events

### Revised Hypothesis (LIKELY CORRECT):
The issue is MORE FUNDAMENTAL than message overlap. Possible causes:

#### Theory 1: `setImmediate()` is NOT enough delay
- `setImmediate()` defers to next tick of event loop (~1ms)
- WebSocket handshake might not be fully complete yet
- The connection state shows `OPEN` but the client parser might not be ready

#### Theory 2: ws library version incompatibility
- Using `ws` library on server side
- Browser native WebSocket on client side
- Possible protocol mismatch or frame encoding issue

#### Theory 3: Multiple WebSocket server instances
- Notice TWO log lines on each connection:
  1. "WeSign WebSocket client connected" (from server.ts line 373)
  2. "WebSocket client connected" (from EventBus line 125)
- These fire MILLISECONDS apart
- This is expected (server.ts → EventBus.addWebSocketClient)
- But timing suggests EventBus message might be sent BEFORE client fully processes server handshake

#### Theory 4: EventBus sending wrong message format
- EventBus constructs WeSignEvent with specific structure
- Client might expect different initial message format
- Need to verify client WebSocket message parsing logic

---

## Observations from Logs

### Backend Behavior:
```
01:11:33 [info]: WeSign WebSocket client connected
01:11:33 [info]: WebSocket client connected  ← ~0ms later
01:11:33 [info]: WeSign WebSocket client disconnected  ← ~30ms later
```

### Client Behavior (Browser Console):
```
01:11:33.422 [LOG] Connection state changed: disconnected -> connecting
01:11:33.422 [LOG] Connecting to WebSocket server
01:11:33.469 [LOG] WebSocket connection opened  ← 47ms to open
01:11:33.470 [LOG] Connection state changed: connecting -> connected
01:11:33.501 [ERROR] Invalid frame header  ← 32ms later, ERROR
01:11:33.501 [LOG] Connection state changed: connected -> error → disconnected
```

**Key Timing**:
- Connection opens at `.469`
- State changes to connected at `.470`
- Error occurs at `.501` (31ms after connection opened)
- This is EXACTLY when the first message would arrive with `setImmediate()` + 10ms setTimeout

---

## Next Steps for Attempt #2

### Option A: Much Longer Delay
```typescript
setImmediate(() => {
  setTimeout(() => {
    // Send message AFTER 100ms delay
    if (ws.readyState === WebSocket.OPEN) {
      this.sendToWebSocket(ws, connectionEvent);
    }
  }, 100); // Was: 0ms, Try: 100ms
});
```

### Option B: Wait for Client "ping" First
```typescript
addWebSocketClient(ws: WebSocket): void {
  this.wsClients.add(ws);

  // Don't send ANYTHING until client sends first message
  const onFirstMessage = () => {
    ws.off('message', onFirstMessage);
    // NOW send connection ack + history
    this.sendToWebSocket(ws, connectionEvent);
    // Send history...
  };

  ws.on('message', onFirstMessage);
}
```

### Option C: Send ONLY Text Message (No JSON)
```typescript
// Try sending plain text first
ws.send('CONNECTED');
```

### Option D: Verify Client-Side WebSocket Implementation
Need to check:
- `apps/frontend/dashboard/src/services/WebSocketService.ts`
- How client processes incoming messages
- If client expects specific handshake sequence

### Option E: Check ws Library Version
```bash
cd backend
npm list ws
# Check if need to upgrade/downgrade
```

---

## Decision: Next Action

**Proceed with Option D first** - Verify client-side implementation before making more server changes.

Then try **Option B** (wait for client ping) as it's the safest approach that guarantees client is ready.

---

## Time Spent
- Analysis: 15 minutes
- Code changes: 10 minutes
- Testing: 5 minutes
- **Total**: 30 minutes

## Files Modified (Attempt #1)
- `backend/src/server.ts` (lines 378-381)
- `backend/src/core/wesign/EventBus.ts` (lines 78-128, 218-248)

## Next Session
- [ ] Read `WebSocketService.ts` client implementation
- [ ] Implement Option B (wait for client ping)
- [ ] Test with 100ms delay (Option A) as fallback
- [ ] Check ws library version (Option E)

---

**Status**: ⏸️ Paused - Need to investigate client-side implementation before proceeding
