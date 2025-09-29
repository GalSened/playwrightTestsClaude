/**
 * WebSocket Service for Real-time Updates
 * Handles real-time communication for test runs, notifications, and system events
 */

import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { enterpriseDb } from '../database/enterprise-database';

export interface AuthenticatedSocket extends Socket {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
}

export class WebSocketService {
  private io: Server;
  private connectedClients: Map<string, AuthenticatedSocket> = new Map();

  constructor(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true
      },
      path: '/socket.io/',
      transports: ['websocket', 'polling']
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    
    logger.info('WebSocket service initialized');
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('No authentication token provided'));
        }

        // Verify JWT token
        const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
        const decoded = jwt.verify(token, JWT_SECRET) as any;

        // Validate user exists and is active
        const user = await enterpriseDb.get(`
          SELECT u.*, t.name as tenant_name, t.subdomain, t.status as tenant_status
          FROM users u
          JOIN tenants t ON u.tenant_id = t.id
          WHERE u.id = ? AND u.is_active = true AND t.status = 'active'
        `, [decoded.userId]);

        if (!user) {
          return next(new Error('Invalid user or inactive account'));
        }

        // Attach user info to socket
        (socket as AuthenticatedSocket).userId = user.id;
        (socket as AuthenticatedSocket).tenantId = user.tenant_id;
        (socket as AuthenticatedSocket).email = user.email;
        (socket as AuthenticatedSocket).role = user.role;

        logger.info('WebSocket authentication successful', { 
          userId: user.id, 
          tenantId: user.tenant_id,
          email: user.email 
        });

        next();
      } catch (error) {
        logger.error('WebSocket authentication failed', { error });
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: Socket) => {
      const authSocket = socket as AuthenticatedSocket;
      
      logger.info('Client connected', { 
        socketId: socket.id,
        userId: authSocket.userId,
        tenantId: authSocket.tenantId 
      });

      // Store connected client
      this.connectedClients.set(socket.id, authSocket);

      // Join tenant-specific room for multi-tenancy
      socket.join(`tenant_${authSocket.tenantId}`);
      socket.join(`user_${authSocket.userId}`);

      // Handle client events
      this.setupClientEventHandlers(authSocket);

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        logger.info('Client disconnected', { 
          socketId: socket.id,
          userId: authSocket.userId,
          reason 
        });
        
        this.connectedClients.delete(socket.id);
      });

      // Send initial connection acknowledgment
      socket.emit('connected', {
        message: 'Connected to Playwright Smart Platform',
        userId: authSocket.userId,
        tenantId: authSocket.tenantId,
        timestamp: new Date().toISOString()
      });
    });
  }

  private setupClientEventHandlers(socket: AuthenticatedSocket) {
    // Subscribe to real-time test run updates
    socket.on('subscribe:testRuns', (data) => {
      logger.debug('Client subscribed to test runs', { 
        userId: socket.userId,
        filters: data 
      });
      
      socket.join(`testRuns_${socket.tenantId}`);
      socket.emit('subscription:confirmed', { 
        type: 'testRuns',
        tenantId: socket.tenantId 
      });
    });

    // Subscribe to system notifications
    socket.on('subscribe:notifications', () => {
      logger.debug('Client subscribed to notifications', { 
        userId: socket.userId 
      });
      
      socket.join(`notifications_${socket.tenantId}`);
      socket.emit('subscription:confirmed', { 
        type: 'notifications',
        tenantId: socket.tenantId 
      });
    });

    // Handle ping/pong for connection health
    socket.on('ping', (data) => {
      socket.emit('pong', {
        ...data,
        serverTime: new Date().toISOString()
      });
    });

    // Handle client-side errors
    socket.on('error', (error) => {
      logger.error('Client-side error', { 
        socketId: socket.id,
        userId: socket.userId,
        error 
      });
    });
  }

  // Public methods for emitting events

  /**
   * Emit test run created event to tenant
   */
  emitTestRunCreated(tenantId: string, testRun: any) {
    this.io.to(`tenant_${tenantId}`).emit('testRunCreated', {
      type: 'testRun:created',
      data: testRun,
      timestamp: new Date().toISOString()
    });
    
    logger.debug('Emitted testRunCreated event', { tenantId, testRunId: testRun.id });
  }

  /**
   * Emit test run updated event to tenant
   */
  emitTestRunUpdated(tenantId: string, testRun: any) {
    this.io.to(`tenant_${tenantId}`).emit('testRunUpdated', {
      type: 'testRun:updated',
      data: testRun,
      timestamp: new Date().toISOString()
    });
    
    logger.debug('Emitted testRunUpdated event', { tenantId, testRunId: testRun.id });
  }

  /**
   * Emit test run deleted event to tenant
   */
  emitTestRunDeleted(tenantId: string, testRunId: string) {
    this.io.to(`tenant_${tenantId}`).emit('testRunDeleted', {
      type: 'testRun:deleted',
      data: { id: testRunId },
      timestamp: new Date().toISOString()
    });
    
    logger.debug('Emitted testRunDeleted event', { tenantId, testRunId });
  }

  /**
   * Emit test case added event to tenant
   */
  emitTestCaseAdded(tenantId: string, testRunId: string, testCase: any) {
    this.io.to(`tenant_${tenantId}`).emit('testCaseAdded', {
      type: 'testCase:added',
      data: { testRunId, testCase },
      timestamp: new Date().toISOString()
    });
    
    logger.debug('Emitted testCaseAdded event', { 
      tenantId, 
      testRunId, 
      testCaseId: testCase.id 
    });
  }

  /**
   * Emit notification to specific user
   */
  emitUserNotification(userId: string, notification: {
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    data?: any;
  }) {
    this.io.to(`user_${userId}`).emit('notification', {
      type: 'notification',
      data: notification,
      timestamp: new Date().toISOString()
    });
    
    logger.debug('Emitted user notification', { userId, notificationId: notification.id });
  }

  /**
   * Emit tenant-wide notification
   */
  emitTenantNotification(tenantId: string, notification: {
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    data?: any;
  }) {
    this.io.to(`tenant_${tenantId}`).emit('notification', {
      type: 'notification',
      data: notification,
      timestamp: new Date().toISOString()
    });
    
    logger.debug('Emitted tenant notification', { tenantId, notificationId: notification.id });
  }

  /**
   * Emit system status update
   */
  emitSystemStatus(status: {
    status: 'healthy' | 'degraded' | 'down';
    message: string;
    services?: Array<{ name: string; status: string; responseTime?: number }>;
  }) {
    this.io.emit('systemStatus', {
      type: 'system:status',
      data: status,
      timestamp: new Date().toISOString()
    });
    
    logger.debug('Emitted system status', { status: status.status });
  }

  /**
   * Get connected clients count
   */
  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  /**
   * Get connected clients for tenant
   */
  getTenantClientsCount(tenantId: string): number {
    let count = 0;
    this.connectedClients.forEach(socket => {
      if (socket.tenantId === tenantId) {
        count++;
      }
    });
    return count;
  }

  /**
   * Broadcast to all connected clients
   */
  broadcast(event: string, data: any) {
    this.io.emit(event, {
      type: event,
      data,
      timestamp: new Date().toISOString()
    });
    
    logger.debug('Broadcasted event', { event, clientCount: this.connectedClients.size });
  }

  /**
   * Get server instance for direct access if needed
   */
  getServer(): Server {
    return this.io;
  }

  /**
   * Shutdown websocket service gracefully
   */
  async shutdown() {
    logger.info('Shutting down WebSocket service');
    
    // Notify all clients about shutdown
    this.broadcast('serverShutdown', {
      message: 'Server is shutting down. Please reconnect in a moment.',
      timestamp: new Date().toISOString()
    });

    // Close all connections
    this.io.close();
    this.connectedClients.clear();
    
    logger.info('WebSocket service shut down complete');
  }
}

export default WebSocketService;