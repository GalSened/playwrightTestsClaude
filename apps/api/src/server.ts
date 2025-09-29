import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { schedulesRouter } from '@/routes/schedules';
import { authRouter } from '@/routes/auth';
import { testRunsRouter } from '@/routes/test-runs-simple';
import { reportsRouter } from '@/routes/reports';
import { testExecutionRouter } from '@/routes/test-execution';
import { testDiscoveryRouter } from '@/routes/test-discovery';
import mcpRegressionRouter from '@/routes/mcp-regression';
import aiRouter from '@/routes/ai';
import { knowledgeRouter } from '@/routes/knowledge';
import analyticsRouter from '@/routes/analytics';
import healingRouter from '@/routes/healing';
import testGeneratorRouter from '@/routes/testGenerator';
import testBankRouter from '@/routes/testBank';
import subAgentsRouter from '@/routes/subAgents';
import { jiraRouter } from '@/routes/jira';
import wesignRouter from '@/routes/wesign';
import { realtimeAnalyticsRouter } from '@/routes/realtime-analytics';
import { wesignKnowledgeRouter } from '@/routes/wesign-knowledge';
import { i18nRouter } from '@/routes/i18n';
import { testCodeGenerationRouter } from '@/routes/test-code-generation';
import { getDatabase, initializeFullDatabase, validateDatabaseIntegrity, getDatabaseStats } from '@/database/database';
import { startWorker, stopWorker, getWorker } from '@/workers/scheduler';
import { agentOrchestrator } from '@/services/subAgents/AgentOrchestrator';
import { TestIntelligenceAgent } from '@/services/subAgents/TestIntelligenceAgent';
import { JiraIntegrationAgent } from '@/services/subAgents/JiraIntegrationAgent';
import { contextManager } from '@/services/subAgents/ContextManager';
import { workflowPersistenceService } from '@/services/subAgents/WorkflowPersistenceService';
import { dataConsistencyService } from '@/services/subAgents/DataConsistencyService';
import { FailureAnalysisAgent } from '@/services/ai/failure-analysis-agent';
import { logger, requestLogger } from '@/utils/logger';

const app = express();
const PORT = process.env.PORT || 8082;

// Initialize sub-agents
async function initializeSubAgents(): Promise<void> {
  try {
    logger.info('Starting sub-agents initialization...');
    
    // Initialize context manager
    contextManager.on('contextUpdated', (data) => {
      logger.debug('Context updated', { agentId: data.agentId, timestamp: data.timestamp });
    });

    // Initialize Test Intelligence Agent
    const testIntelligenceAgent = new TestIntelligenceAgent();
    await agentOrchestrator.registerAgent(testIntelligenceAgent);
    
    // Initialize Jira Integration Agent
    const jiraIntegrationAgent = new JiraIntegrationAgent();
    await agentOrchestrator.registerAgent(jiraIntegrationAgent);
    
    // Initialize Failure Analysis Agent
    const failureAnalysisAgent = new FailureAnalysisAgent();
    await agentOrchestrator.registerAgent(failureAnalysisAgent);
    
    // Subscribe to context updates
    contextManager.subscribe('test-intelligence-agent', ['failureHistory', 'codeChanges', 'systemHealth']);
    contextManager.subscribe('jira-integration-agent', ['testRun', 'failureHistory']);
    contextManager.subscribe('failure-analysis-agent', ['failureHistory', 'testRun', 'systemHealth']);
    
    logger.info('Sub-agents system initialized successfully', {
      totalAgents: Object.keys(agentOrchestrator.getAgentStatus()).length
    });
  } catch (error) {
    logger.error('Failed to initialize sub-agents:', error);
    throw error;
  }
}

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(compression());

// CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3003', 'http://localhost:5173'], // Add 3000 for QA Intelligence frontend, 3001 for secondary frontend, 3003 for dev frontend, 5173 for Vite dev
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with']
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    requestLogger.http('Request completed', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent')
    });
  });
  
  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbHealthy = await getDatabase().healthCheck();
    const worker = getWorker();
    const workerStatus = worker.getStatus();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      database: {
        healthy: dbHealthy,
        path: process.env.DATABASE_PATH || 'scheduler.db'
      },
      worker: {
        running: workerStatus.isRunning,
        activeExecutions: workerStatus.activeExecutions,
        maxConcurrent: workerStatus.maxConcurrentExecutions,
        uptime: workerStatus.uptime
      },
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API routes
app.use('/api/auth', authRouter);
app.use('/api/schedules', schedulesRouter);
app.use('/api/test-runs', testRunsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/execute', testExecutionRouter);
app.use('/api/tests', testDiscoveryRouter);
app.use('/api/mcp-regression', mcpRegressionRouter);
app.use('/api/ai', aiRouter);
app.use('/api/knowledge', knowledgeRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/healing', healingRouter);
app.use('/api/test-generator', testGeneratorRouter);
app.use('/api/test-bank', testBankRouter);
app.use('/api/sub-agents', subAgentsRouter);
app.use('/api/wesign', wesignRouter);
app.use('/api/jira', jiraRouter);
app.use('/api/realtime', realtimeAnalyticsRouter);
app.use('/api/wesign-knowledge', wesignKnowledgeRouter);
app.use('/api/i18n', i18nRouter);
app.use('/api/test-code-generation', testCodeGenerationRouter);


// API Health check endpoint (mirrors /health)
app.get('/api/health', async (req, res) => {
  try {
    const dbHealthy = await getDatabase().healthCheck();
    const worker = getWorker();
    const workerStatus = worker.getStatus();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      database: {
        healthy: dbHealthy,
        path: process.env.DATABASE_PATH || 'scheduler.db'
      },
      worker: {
        running: workerStatus.isRunning,
        activeExecutions: workerStatus.activeExecutions,
        maxConcurrent: workerStatus.maxConcurrentExecutions,
        uptime: workerStatus.uptime
      },
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Worker management endpoints (for development/debugging)
if (process.env.NODE_ENV === 'development') {
  app.get('/api/worker/status', (req, res) => {
    const worker = getWorker();
    res.json(worker.getStatus());
  });

  app.post('/api/worker/restart', async (req, res) => {
    try {
      await stopWorker();
      await startWorker();
      res.json({ message: 'Worker restarted successfully' });
    } catch (error) {
      logger.error('Failed to restart worker', { error });
      res.status(500).json({ error: 'Failed to restart worker' });
    }
  });
}

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`
  });
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body
  });

  res.status(error.statusCode || 500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

async function startServer(): Promise<void> {
  try {
    // Initialize comprehensive database system
    logger.info('Initializing comprehensive database system');
    await initializeFullDatabase();
    
    // Validate database integrity
    const dbHealthy = await validateDatabaseIntegrity();
    if (!dbHealthy) {
      throw new Error('Database integrity validation failed');
    }

    // Get initial database statistics
    const dbStats = await getDatabaseStats();
    logger.info('Database initialized successfully', dbStats);

    // Start the scheduler worker
    logger.info('Starting scheduler worker');
    await startWorker();

    // Initialize sub-agents system
    logger.info('Initializing sub-agents system');
    await initializeSubAgents();

    // Start consistency monitoring
    logger.info('Starting data consistency monitoring');
    // dataConsistencyService starts automatically

    // Start the HTTP server
    const server = app.listen(PORT, () => {
      logger.info('Server started successfully', {
        port: PORT,
        env: process.env.NODE_ENV || 'development',
        cors: process.env.CORS_ORIGIN || 'http://localhost:5173',
        dbStats
      });
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown`);
      
      server.close(async (err) => {
        if (err) {
          logger.error('Error closing HTTP server', { error: err });
        } else {
          logger.info('HTTP server closed');
        }

        try {
          await stopWorker();
          logger.info('Worker stopped');
          
          await agentOrchestrator.shutdown();
          logger.info('Sub-agents system stopped');
          
          await db.close();
          logger.info('Database connection closed');
          
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown', { error });
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
  process.exit(1);
});

// Start the server
if (require.main === module) {
  startServer();
}

export { app, startServer };