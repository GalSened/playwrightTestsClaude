/**
 * WeSign Integration Middleware - Connects new unified core system with existing Express server
 * Provides seamless integration between legacy routes and new unified API
 */

import { Request, Response, NextFunction } from 'express';
import { globalWeSignCore } from '../core/wesign/WeSignCore';
import { globalEventBus } from '../core/wesign/EventBus';
import { globalPluginManager } from '../core/wesign/PluginManager';
import { EventType } from '../core/wesign/types';
import { logger } from '../utils/logger';

export class WeSignIntegrationMiddleware {
  private static instance: WeSignIntegrationMiddleware | null = null;
  private isInitialized = false;

  /**
   * Get singleton instance
   */
  public static getInstance(): WeSignIntegrationMiddleware {
    if (!WeSignIntegrationMiddleware.instance) {
      WeSignIntegrationMiddleware.instance = new WeSignIntegrationMiddleware();
    }
    return WeSignIntegrationMiddleware.instance;
  }

  /**
   * Initialize WeSign core system
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('WeSign integration middleware already initialized');
      return;
    }

    try {
      logger.info('Initializing WeSign integration middleware...');

      // Initialize the core system
      await globalWeSignCore.initialize();

      // Set up integration event handlers
      this.setupIntegrationHandlers();

      this.isInitialized = true;
      logger.info('WeSign integration middleware initialized successfully');

    } catch (error) {
      logger.error('WeSign integration middleware initialization failed', {
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Express middleware to ensure WeSign core is initialized
   */
  public ensureInitialized() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!this.isInitialized) {
          await this.initialize();
        }

        if (!globalWeSignCore.isReady()) {
          throw new Error('WeSign core system is not ready');
        }

        // Attach core instances to request for use in routes
        (req as any).wesignCore = globalWeSignCore;
        (req as any).eventBus = globalEventBus;
        (req as any).pluginManager = globalPluginManager;

        next();

      } catch (error) {
        logger.error('WeSign middleware initialization error', {
          error: error instanceof Error ? error.message : error,
          path: req.path
        });

        res.status(500).json({
          success: false,
          error: 'WeSign system initialization failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    };
  }

  /**
   * Middleware for handling WebSocket upgrades
   */
  public handleWebSocketUpgrade() {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (req.get('upgrade') && req.get('upgrade')?.toLowerCase() === 'websocket') {
        // Mark request as WebSocket upgrade
        (req as any).isWebSocketUpgrade = true;
        logger.debug('WebSocket upgrade detected', {
          path: req.path,
          executionId: req.params.executionId
        });
      }
      next();
    };
  }

  /**
   * Health check middleware
   */
  public healthCheck() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const health = await globalWeSignCore.getHealth();
        const stats = globalWeSignCore.getStats();

        (req as any).wesignHealth = health;
        (req as any).wesignStats = stats;

        next();

      } catch (error) {
        logger.error('WeSign health check failed in middleware', {
          error: error instanceof Error ? error.message : error
        });

        (req as any).wesignHealth = {
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error'
        };

        next();
      }
    };
  }

  /**
   * Request context middleware - adds request context to events
   */
  public addRequestContext() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const { v4: uuidv4 } = require('uuid');
      const requestId = uuidv4();
      const requestContext = {
        requestId,
        method: req.method,
        path: req.path,
        timestamp: new Date(),
        userAgent: req.get('User-Agent'),
        ip: req.ip
      };

      (req as any).wesignContext = requestContext;

      // Log request start
      logger.debug('WeSign request started', requestContext);

      // Log request completion
      res.on('finish', () => {
        logger.debug('WeSign request completed', {
          ...requestContext,
          statusCode: res.statusCode,
          duration: Date.now() - requestContext.timestamp.getTime()
        });
      });

      next();
    };
  }

  /**
   * Error handling middleware specific to WeSign operations
   */
  public errorHandler() {
    return (error: any, req: Request, res: Response, next: NextFunction): void => {
      logger.error('WeSign operation error', {
        error: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method,
        requestId: (req as any).wesignContext?.requestId
      });

      // If response already sent, pass to next error handler
      if (res.headersSent) {
        return next(error);
      }

      // Send appropriate error response
      const statusCode = error.statusCode || 500;
      const isProduction = process.env.NODE_ENV === 'production';

      res.status(statusCode).json({
        success: false,
        error: isProduction ? 'WeSign operation failed' : error.message,
        requestId: (req as any).wesignContext?.requestId,
        ...(isProduction ? {} : { stack: error.stack })
      });
    };
  }

  /**
   * Get initialization status
   */
  public getStatus(): { initialized: boolean; coreReady: boolean } {
    return {
      initialized: this.isInitialized,
      coreReady: globalWeSignCore.isReady()
    };
  }

  /**
   * Shutdown the middleware and clean up resources
   */
  public async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down WeSign integration middleware...');

      if (this.isInitialized) {
        await globalWeSignCore.shutdown();
        this.isInitialized = false;
      }

      logger.info('WeSign integration middleware shutdown complete');

    } catch (error) {
      logger.error('WeSign integration middleware shutdown failed', {
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  private setupIntegrationHandlers(): void {
    // Handle system-level events
    globalEventBus.subscribe(EventType.HEALTH_CHANGED, async (event) => {
      logger.info('WeSign system health changed', {
        status: event.data.status,
        message: event.data.message
      });
    });

    globalEventBus.subscribe(EventType.TEST_EXECUTION_STARTED, async (event) => {
      logger.info('WeSign test execution started', {
        executionId: event.data.executionId,
        framework: event.data.framework
      });
    });

    globalEventBus.subscribe(EventType.TEST_EXECUTION_COMPLETED, async (event) => {
      logger.info('WeSign test execution completed', {
        executionId: event.data.executionId,
        status: event.data.status,
        duration: event.data.duration
      });
    });

    logger.debug('WeSign integration event handlers configured');
  }
}

// Export singleton instance
export const wesignIntegrationMiddleware = WeSignIntegrationMiddleware.getInstance();