/**
 * MINIMAL WEBSOCKET TEST SERVER
 * Purpose: Isolate whether "Invalid frame header" is environmental or code-related
 *
 * This is the SIMPLEST possible WebSocket server using the ws library.
 * If THIS fails, the issue is environmental/library-level.
 * If THIS works, the issue is in our application code.
 */

const { WebSocketServer } = require('ws');
const http = require('http');

console.log('='.repeat(80));
console.log('MINIMAL WEBSOCKET TEST SERVER');
console.log('='.repeat(80));

// Create HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('WebSocket Test Server Running\n');
});

// Create WebSocket server (noServer: true to match our production setup)
const wss = new WebSocketServer({ noServer: true });

// Handle upgrade
server.on('upgrade', (request, socket, head) => {
  console.log('\n[UPGRADE] Received upgrade request');
  console.log('  URL:', request.url);
  console.log('  Headers:', request.headers);

  wss.handleUpgrade(request, socket, head, (ws) => {
    console.log('[UPGRADE] handleUpgrade completed');
    wss.emit('connection', ws, request);
  });
});

// Handle connection
wss.on('connection', (ws, request) => {
  console.log('\n[CONNECTION] Client connected');
  console.log('  Remote Address:', request.socket.remoteAddress);
  console.log('  WebSocket State:', ws.readyState); // Should be 1 (OPEN)

  // Strategy 1: Send NOTHING immediately
  console.log('[STRATEGY] Waiting 500ms before sending first message...');

  setTimeout(() => {
    if (ws.readyState === 1) { // 1 = OPEN
      console.log('[SEND] Sending test message after 500ms delay');
      try {
        ws.send('Hello from minimal test server!', (error) => {
          if (error) {
            console.error('[ERROR] Failed to send message:', error);
          } else {
            console.log('[SEND] Message sent successfully');
          }
        });
      } catch (error) {
        console.error('[ERROR] Exception during send:', error);
      }
    } else {
      console.error('[ERROR] Connection closed before message could be sent');
      console.error('  Final State:', ws.readyState); // 2=CLOSING, 3=CLOSED
    }
  }, 500);

  // Handle messages from client
  ws.on('message', (data) => {
    console.log('[MESSAGE] Received from client:', data.toString());
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error('[ERROR] WebSocket error:', error);
  });

  // Handle close
  ws.on('close', (code, reason) => {
    console.log('[CLOSE] Client disconnected');
    console.log('  Code:', code);
    console.log('  Reason:', reason.toString());
  });
});

// Start server
const PORT = 9999;
server.listen(PORT, () => {
  console.log('\n' + '='.repeat(80));
  console.log(`SERVER LISTENING on port ${PORT}`);
  console.log('='.repeat(80));
  console.log('\nTest URLs:');
  console.log(`  HTTP: http://localhost:${PORT}`);
  console.log(`  WebSocket: ws://localhost:${PORT}/test`);
  console.log('\nTo test in browser console:');
  console.log(`  const ws = new WebSocket('ws://localhost:${PORT}/test');`);
  console.log(`  ws.onopen = () => console.log('Connected!');`);
  console.log(`  ws.onmessage = (e) => console.log('Message:', e.data);`);
  console.log(`  ws.onerror = (e) => console.error('Error:', e);`);
  console.log(`  ws.onclose = (e) => console.log('Closed:', e.code, e.reason);`);
  console.log('\n' + '='.repeat(80));
});

// Handle server errors
server.on('error', (error) => {
  console.error('\n[SERVER ERROR]', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n[SHUTDOWN] Closing server...');
  server.close(() => {
    console.log('[SHUTDOWN] Server closed');
    process.exit(0);
  });
});
