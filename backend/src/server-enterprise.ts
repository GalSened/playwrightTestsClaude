/**
 * Enterprise Server
 * Production-grade server with multi-tenancy, monitoring, and advanced features
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import WebSocketService from './services/websocket';

// Enterprise modules
import { enterpriseConfig, loadEnterpriseConfig } from './config/enterprise';
import { enterpriseDb } from './database/enterprise-database';
import { pgPool, supabaseClient } from './database/supabase-client';
import { 
  metricsMiddleware, 
  metricsHandler, 
  initializeMetrics,
  metricsHealthCheck 
} from './monitoring/metrics';
import { logger, requestLogger } from './utils/logger';
import { checkStorageHealth } from './utils/health-checks';

// Route modules
import { createEnterpriseTraceRouter } from './routes/enterprise-trace';
import { createEnterpriseAnalyticsRouter } from './routes/enterprise-analytics';
import { authRouter } from './routes/auth';
import { testRunsRouter } from './routes/test-runs';
// import { createSchedulesRouter } from './routes/schedules'; // Temporarily disabled - needs enterprise DB migration

// Middleware
import { tenantMiddleware } from './middleware/tenant';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/error-handler';

// JWT verification utility
interface JwtPayload {
  userId: string;
  tenantId: string;
  tenants: string[];
  role: string;
  email?: string;
  exp: number;
  iat: number;
}

async function verifyJwtToken(token: string): Promise<JwtPayload> {
  return new Promise((resolve, reject) => {
    const jwtSecret = process.env.JWT_SECRET || 'your-default-secret-key';
    
    jwt.verify(token, jwtSecret, (err, decoded) => {
      if (err) {
        logger.warn('JWT verification failed', { error: err.message });
        reject(new Error('Invalid JWT token'));
        return;
      }

      const payload = decoded as JwtPayload;
      
      // Validate required fields
      if (!payload.userId || !payload.tenantId || !payload.tenants) {
        reject(new Error('Invalid JWT payload structure'));
        return;
      }

      // Check token expiration
      if (payload.exp && Date.now() >= payload.exp * 1000) {
        reject(new Error('JWT token expired'));
        return;
      }

      resolve(payload);
    });
  });
}


const app = express();
const config = loadEnterpriseConfig();
const PORT = config.PORT;

// =============================================================================
// SECURITY & PERFORMANCE MIDDLEWARE
// =============================================================================

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "ws:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Compression
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6,
  threshold: 1024,
}));

// Rate limiting with IPv6 support
const limiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  message: {
    error: 'Too many requests',
    retryAfter: Math.ceil(config.RATE_LIMIT_WINDOW_MS / 1000),
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.ip === '127.0.0.1' && process.env.NODE_ENV === 'development',
});

app.use('/api/', limiter);

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Allow configured origins
    const allowedOrigins = [config.CORS_ORIGIN, 'http://localhost:3000', 'http://localhost:5173'];
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-Request-ID'],
}));

// Body parsing with size limits
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // Store raw body for webhook verification
    (req as any).rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// =============================================================================
// REQUEST TRACKING & LOGGING
// =============================================================================

// Request ID and logging
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] as string || 
    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const tenantId = req.headers['x-tenant-id'] as string || 'unknown';
    
    requestLogger.http('Request completed', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      requestId,
      tenantId,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      contentLength: res.get('Content-Length'),
    });
  });
  
  next();
});

// Metrics collection middleware
app.use(metricsMiddleware());

// =============================================================================
// ENTERPRISE MIDDLEWARE
// =============================================================================

// Tenant resolution middleware
app.use('/api/', tenantMiddleware());

// Enterprise Authentication Strategy:
// - Routes handle their own authentication (devAuth for dev, full auth for production)
// - No global auth conflicts
// - Health checks and metrics remain unprotected
// Note: Authentication is handled per-route for maximum flexibility and enterprise control

// =============================================================================
// HEALTH CHECKS & MONITORING
// =============================================================================

// Basic health check
app.get('/health', async (req, res) => {
  try {
    const dbHealthy = await enterpriseDb.healthCheck();
    const metricsHealth = metricsHealthCheck();
    const storageHealthy = await checkStorageHealth();
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '2.0.0',
      environment: config.NODE_ENV,
      features: {
        multiTenant: config.ENABLE_MULTI_TENANT,
        realTime: config.ENABLE_REAL_TIME_UPDATES,
        analytics: config.ENABLE_ADVANCED_ANALYTICS,
        backgroundJobs: config.ENABLE_BACKGROUND_JOBS,
      },
      services: {
        database: {
          healthy: dbHealthy,
          type: 'PostgreSQL',
          multiTenant: config.ENABLE_MULTI_TENANT,
        },
        metrics: {
          healthy: metricsHealth.healthy,
          enabled: config.ENABLE_METRICS,
        },
        storage: {
          healthy: storageHealthy,
          type: config.NODE_ENV === 'development' ? 'Local Storage' : 'Supabase Storage',
        },
      },
    };

    if (!dbHealthy || !metricsHealth.healthy || !storageHealthy) {
      return res.status(503).json({
        ...health,
        status: 'unhealthy',
      });
    }

    res.json(health);
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Detailed health check for load balancers
app.get('/health/ready', async (req, res) => {
  try {
    // More thorough readiness check
    const dbHealthy = await enterpriseDb.healthCheck();
    
    if (!dbHealthy) {
      throw new Error('Database not ready');
    }

    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Readiness check failed', { error });
    res.status(503).json({
      status: 'not ready',
      error: error instanceof Error ? error.message : 'Service not ready',
    });
  }
});

// Liveness probe for Kubernetes
app.get('/health/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Metrics endpoint
app.get('/metrics', metricsHandler);

// =============================================================================
// API ROUTES
// =============================================================================

// Authentication API (no tenant middleware needed)
app.use('/api/auth', authRouter);

// Test Runs API (with authentication required)
app.use('/api/test-runs', testRunsRouter);

// Enterprise Trace Viewer API
app.use('/api/reports', createEnterpriseTraceRouter());

// Enterprise Analytics API
app.use('/api/analytics', createEnterpriseAnalyticsRouter());

// Test Scheduler API (legacy compatibility)
// Temporarily disabled - needs enterprise DB migration
// app.use('/api/schedules', createSchedulesRouter());

// Tenant Management API
app.get('/api/tenants/current', (req, res) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  res.json({
    tenantId,
    features: {
      multiTenant: config.ENABLE_MULTI_TENANT,
      realTime: config.ENABLE_REAL_TIME_UPDATES,
      analytics: config.ENABLE_ADVANCED_ANALYTICS,
    },
  });
});

// =============================================================================
// WEBSOCKET SETUP (Real-time Features)
// =============================================================================

const server = createServer(app);
let wsService: WebSocketService;

if (config.ENABLE_REAL_TIME_UPDATES) {
  wsService = new WebSocketService(server);
  
  // Export WebSocket service for use in routes
  app.set('wsService', wsService);
  
  logger.info('🔄 Real-time WebSocket service initialized');
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

// 404 handler
app.use('*', (req, res) => {
  logger.warn('Route not found', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
  });
});

// Global error handler
app.use(errorHandler);

// =============================================================================
// SERVER STARTUP
// =============================================================================

async function startEnterpriseServer(): Promise<void> {
  try {
    logger.info('🚀 Starting Playwright Enterprise Server', {
      version: '2.0.0',
      environment: config.NODE_ENV,
      port: PORT,
    });

    // Initialize database
    logger.info('📊 Initializing enterprise database...');
    await enterpriseDb.initializeDatabase(config.DEFAULT_TENANT_ID);
    
    const dbHealthy = await enterpriseDb.healthCheck();
    if (!dbHealthy) {
      throw new Error('Database health check failed');
    }

    // Initialize metrics collection
    logger.info('📈 Initializing metrics collection...');
    initializeMetrics(enterpriseDb);

    // Start HTTP server
    const httpServer = server.listen(PORT, () => {
      logger.info('✅ Enterprise server started successfully', {
        port: PORT,
        environment: config.NODE_ENV,
        cors: config.CORS_ORIGIN,
        features: {
          multiTenant: config.ENABLE_MULTI_TENANT,
          realTime: config.ENABLE_REAL_TIME_UPDATES,
          analytics: config.ENABLE_ADVANCED_ANALYTICS,
          backgroundJobs: config.ENABLE_BACKGROUND_JOBS,
          metrics: config.ENABLE_METRICS,
        },
        endpoints: {
          api: `http://localhost:${PORT}/api`,
          health: `http://localhost:${PORT}/health`,
          metrics: `http://localhost:${PORT}/metrics`,
        },
      });

      if (config.ENABLE_REAL_TIME_UPDATES) {
        logger.info('🔄 Real-time WebSocket server enabled');
      }
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`📴 Received ${signal}, starting graceful shutdown...`);
      
      // Close HTTP server
      httpServer.close(async (err) => {
        if (err) {
          logger.error('Error closing HTTP server', { error: err });
        } else {
          logger.info('✅ HTTP server closed');
        }

        try {
          // Close WebSocket server
          if (io) {
            io.close();
            logger.info('✅ WebSocket server closed');
          }

          // Close database connections
          await enterpriseDb.close();
          logger.info('✅ Database connections closed');
          
          logger.info('🎯 Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          logger.error('❌ Error during shutdown', { error });
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('⚠️  Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('❌ Failed to start enterprise server', { error });
    process.exit(1);
  }
}

// =============================================================================
// PROCESS ERROR HANDLING
// =============================================================================

process.on('uncaughtException', (error) => {
  logger.error('💥 Uncaught exception', { error });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 Unhandled rejection', { reason, promise });
  process.exit(1);
});

// Start server if this file is executed directly
if (require.main === module) {
  startEnterpriseServer();
}

export { app, server, startEnterpriseServer };