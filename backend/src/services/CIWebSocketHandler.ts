/**
 * CI/CD WebSocket Handler
 * Handles real-time CI/CD log streaming and updates
 * Integrates with existing QA Intelligence WebSocket infrastructure
 */

import { WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { eventBus } from '../core/wesign/EventBus';
import { EventType } from '../core/wesign/types';
import { CIOrchestrator } from './CIOrchestrator';
import { logger } from '../utils/logger';

interface CIWebSocketClient {
  ws: WebSocket;
  userId: string;
  tenantId: string;
  runId?: string;
  stageId?: string;
  subscriptions: Set<string>;
}

export class CIWebSocketHandler {
  private clients: Map<string, CIWebSocketClient> = new Map();
  private runSubscriptions: Map<string, Set<string>> = new Map(); // runId -> clientIds
  private stageSubscriptions: Map<string, Set<string>> = new Map(); // stageId -> clientIds
  private ciOrchestrator: CIOrchestrator;

  constructor() {
    this.ciOrchestrator = new CIOrchestrator();
    this.setupEventListeners();
    logger.info('CI WebSocket handler initialized');
  }

  private setupEventListeners(): void {
    // Subscribe to CI/CD events from EventBus
    eventBus.subscribe(EventType.CI_RUN_STARTED, this.handleCIRunEvent.bind(this));
    eventBus.subscribe(EventType.CI_RUN_COMPLETED, this.handleCIRunEvent.bind(this));
    eventBus.subscribe(EventType.CI_RUN_FAILED, this.handleCIRunEvent.bind(this));
    eventBus.subscribe(EventType.CI_RUN_CANCELLED, this.handleCIRunEvent.bind(this));

    eventBus.subscribe(EventType.CI_STAGE_STARTED, this.handleCIStageEvent.bind(this));
    eventBus.subscribe(EventType.CI_STAGE_COMPLETED, this.handleCIStageEvent.bind(this));
    eventBus.subscribe(EventType.CI_STAGE_FAILED, this.handleCIStageEvent.bind(this));
    eventBus.subscribe(EventType.CI_STAGE_LOG, this.handleCIStageLogEvent.bind(this));

    eventBus.subscribe(EventType.CI_ARTIFACT_CREATED, this.handleCIArtifactEvent.bind(this));
    eventBus.subscribe(EventType.CI_DEPLOYMENT_STARTED, this.handleCIDeploymentEvent.bind(this));
    eventBus.subscribe(EventType.CI_DEPLOYMENT_COMPLETED, this.handleCIDeploymentEvent.bind(this));
    eventBus.subscribe(EventType.CI_DEPLOYMENT_FAILED, this.handleCIDeploymentEvent.bind(this));
    eventBus.subscribe(EventType.CI_ROLLBACK_INITIATED, this.handleCIRollbackEvent.bind(this));
    eventBus.subscribe(EventType.CI_ROLLBACK_COMPLETED, this.handleCIRollbackEvent.bind(this));

    logger.info('CI WebSocket event listeners setup completed');
  }

  /**
   * Handle new WebSocket connection for CI/CD
   */
  async handleConnection(ws: WebSocket, req: any): Promise<void> {
    try {
      // Extract authentication from query parameters or headers
      const token = req.url?.split('token=')[1]?.split('&')[0] ||
                    req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        ws.close(1008, 'Authentication token required');
        return;
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'qa-intelligence-secret') as any;
      if (!decoded.userId) {
        ws.close(1008, 'Invalid authentication token');
        return;
      }

      const clientId = this.generateClientId();
      const client: CIWebSocketClient = {
        ws,
        userId: decoded.userId,
        tenantId: decoded.tenantId || 'default',
        subscriptions: new Set()
      };

      this.clients.set(clientId, client);

      // Setup WebSocket event handlers
      this.setupWebSocketHandlers(clientId, client);

      // Send connection success message
      this.sendToClient(clientId, {
        type: 'connection',
        status: 'connected',
        clientId,
        timestamp: new Date().toISOString(),
        message: 'Connected to CI/CD real-time updates'
      });

      logger.info('CI WebSocket client connected', {
        clientId,
        userId: decoded.userId,
        tenantId: decoded.tenantId,
        totalClients: this.clients.size
      });

    } catch (error) {
      logger.error('Failed to handle CI WebSocket connection', { error });
      ws.close(1011, 'Internal server error');
    }
  }

  private setupWebSocketHandlers(clientId: string, client: CIWebSocketClient): void {
    const { ws } = client;

    ws.on('message', async (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        await this.handleClientMessage(clientId, data);
      } catch (error) {
        logger.warn('Invalid WebSocket message from CI client', { error, clientId });
        this.sendError(clientId, 'Invalid message format');
      }
    });

    ws.on('close', (code: number, reason: Buffer) => {
      this.handleClientDisconnect(clientId, code, reason.toString());
    });

    ws.on('error', (error: Error) => {
      logger.error('CI WebSocket client error', { error, clientId });
      this.handleClientDisconnect(clientId, 1011, 'WebSocket error');
    });

    ws.on('ping', () => {
      ws.pong();
    });

    ws.on('pong', () => {
      // Client is alive, update last seen timestamp
      client.ws['lastSeen'] = Date.now();
    });
  }

  private async handleClientMessage(clientId: string, data: any): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) {
      logger.warn('Message from unknown CI WebSocket client', { clientId });
      return;
    }

    try {
      switch (data.type) {
        case 'subscribe_run':
          await this.handleSubscribeRun(clientId, data.runId);
          break;

        case 'unsubscribe_run':
          await this.handleUnsubscribeRun(clientId, data.runId);
          break;

        case 'subscribe_stage':
          await this.handleSubscribeStage(clientId, data.stageId);
          break;

        case 'unsubscribe_stage':
          await this.handleUnsubscribeStage(clientId, data.stageId);
          break;

        case 'get_run_status':
          await this.handleGetRunStatus(clientId, data.runId);
          break;

        case 'get_stage_logs':
          await this.handleGetStageLogs(clientId, data.stageId, data.options);
          break;

        case 'ping':
          this.sendToClient(clientId, {
            type: 'pong',
            timestamp: new Date().toISOString()
          });
          break;

        default:
          logger.warn('Unknown CI WebSocket message type', { type: data.type, clientId });
          this.sendError(clientId, `Unknown message type: ${data.type}`);
      }
    } catch (error) {
      logger.error('Error handling CI WebSocket message', { error, data, clientId });
      this.sendError(clientId, 'Failed to process message');
    }
  }

  private async handleSubscribeRun(clientId: string, runId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Verify client has access to this run
    const run = await this.ciOrchestrator.getCIRun(runId);
    if (!run) {
      this.sendError(clientId, `CI run not found: ${runId}`);
      return;
    }

    if (run.tenantId && run.tenantId !== client.tenantId) {
      this.sendError(clientId, 'Access denied to CI run');
      return;
    }

    // Add to run subscriptions
    if (!this.runSubscriptions.has(runId)) {
      this.runSubscriptions.set(runId, new Set());
    }
    this.runSubscriptions.get(runId)!.add(clientId);
    client.subscriptions.add(`run:${runId}`);
    client.runId = runId;

    // Send current run status
    await this.sendRunUpdate(clientId, runId);

    logger.debug('Client subscribed to CI run', { clientId, runId });
  }

  private async handleUnsubscribeRun(clientId: string, runId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Remove from run subscriptions
    const runClients = this.runSubscriptions.get(runId);
    if (runClients) {
      runClients.delete(clientId);
      if (runClients.size === 0) {
        this.runSubscriptions.delete(runId);
      }
    }

    client.subscriptions.delete(`run:${runId}`);
    if (client.runId === runId) {
      client.runId = undefined;
    }

    this.sendToClient(clientId, {
      type: 'unsubscribed',
      resource: 'run',
      runId,
      timestamp: new Date().toISOString()
    });

    logger.debug('Client unsubscribed from CI run', { clientId, runId });
  }

  private async handleSubscribeStage(clientId: string, stageId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Add to stage subscriptions
    if (!this.stageSubscriptions.has(stageId)) {
      this.stageSubscriptions.set(stageId, new Set());
    }
    this.stageSubscriptions.get(stageId)!.add(clientId);
    client.subscriptions.add(`stage:${stageId}`);
    client.stageId = stageId;

    this.sendToClient(clientId, {
      type: 'subscribed',
      resource: 'stage',
      stageId,
      timestamp: new Date().toISOString()
    });

    logger.debug('Client subscribed to CI stage', { clientId, stageId });
  }

  private async handleUnsubscribeStage(clientId: string, stageId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Remove from stage subscriptions
    const stageClients = this.stageSubscriptions.get(stageId);
    if (stageClients) {
      stageClients.delete(clientId);
      if (stageClients.size === 0) {
        this.stageSubscriptions.delete(stageId);
      }
    }

    client.subscriptions.delete(`stage:${stageId}`);
    if (client.stageId === stageId) {
      client.stageId = undefined;
    }

    this.sendToClient(clientId, {
      type: 'unsubscribed',
      resource: 'stage',
      stageId,
      timestamp: new Date().toISOString()
    });

    logger.debug('Client unsubscribed from CI stage', { clientId, stageId });
  }

  private async handleGetRunStatus(clientId: string, runId: string): Promise<void> {
    try {
      const runDetails = await this.ciOrchestrator.getCIRunDetails(runId);
      if (!runDetails) {
        this.sendError(clientId, `CI run not found: ${runId}`);
        return;
      }

      this.sendToClient(clientId, {
        type: 'run_status',
        runId,
        data: runDetails,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get CI run status', { error, clientId, runId });
      this.sendError(clientId, 'Failed to get run status');
    }
  }

  private async handleGetStageLogs(clientId: string, stageId: string, options: any = {}): Promise<void> {
    try {
      const logs = await this.ciOrchestrator.getStageLogs(stageId, options);

      this.sendToClient(clientId, {
        type: 'stage_logs',
        stageId,
        data: logs,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get CI stage logs', { error, clientId, stageId });
      this.sendError(clientId, 'Failed to get stage logs');
    }
  }

  private handleClientDisconnect(clientId: string, code: number, reason: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Remove from all subscriptions
    client.subscriptions.forEach(subscription => {
      if (subscription.startsWith('run:')) {
        const runId = subscription.replace('run:', '');
        const runClients = this.runSubscriptions.get(runId);
        if (runClients) {
          runClients.delete(clientId);
          if (runClients.size === 0) {
            this.runSubscriptions.delete(runId);
          }
        }
      } else if (subscription.startsWith('stage:')) {
        const stageId = subscription.replace('stage:', '');
        const stageClients = this.stageSubscriptions.get(stageId);
        if (stageClients) {
          stageClients.delete(clientId);
          if (stageClients.size === 0) {
            this.stageSubscriptions.delete(stageId);
          }
        }
      }
    });

    // Remove client
    this.clients.delete(clientId);

    logger.info('CI WebSocket client disconnected', {
      clientId,
      code,
      reason,
      totalClients: this.clients.size
    });
  }

  // ===============================
  // EVENT HANDLERS
  // ===============================

  private async handleCIRunEvent(event: any): Promise<void> {
    const runId = event.data.runId;
    const runClients = this.runSubscriptions.get(runId);

    if (runClients && runClients.size > 0) {
      const message = {
        type: 'ci_run_update',
        event: event.type,
        runId,
        data: event.data,
        timestamp: event.timestamp
      };

      runClients.forEach(clientId => {
        this.sendToClient(clientId, message);
      });

      logger.debug('Sent CI run event to subscribers', {
        event: event.type,
        runId,
        subscriberCount: runClients.size
      });
    }
  }

  private async handleCIStageEvent(event: any): Promise<void> {
    const stageId = event.data.stageId;
    const runId = event.data.runId;

    // Send to stage subscribers
    const stageClients = this.stageSubscriptions.get(stageId);
    if (stageClients && stageClients.size > 0) {
      const message = {
        type: 'ci_stage_update',
        event: event.type,
        stageId,
        runId,
        data: event.data,
        timestamp: event.timestamp
      };

      stageClients.forEach(clientId => {
        this.sendToClient(clientId, message);
      });
    }

    // Also send to run subscribers
    const runClients = this.runSubscriptions.get(runId);
    if (runClients && runClients.size > 0) {
      const message = {
        type: 'ci_stage_update',
        event: event.type,
        stageId,
        runId,
        data: event.data,
        timestamp: event.timestamp
      };

      runClients.forEach(clientId => {
        this.sendToClient(clientId, message);
      });
    }

    logger.debug('Sent CI stage event to subscribers', {
      event: event.type,
      stageId,
      runId,
      stageSubscribers: stageClients?.size || 0,
      runSubscribers: runClients?.size || 0
    });
  }

  private async handleCIStageLogEvent(event: any): Promise<void> {
    const stageId = event.data.stageId;
    const runId = event.data.runId;

    const message = {
      type: 'ci_stage_log',
      stageId,
      runId,
      logType: event.data.type, // stdout, stderr
      data: event.data.data,
      timestamp: event.timestamp
    };

    // Send to stage subscribers
    const stageClients = this.stageSubscriptions.get(stageId);
    if (stageClients && stageClients.size > 0) {
      stageClients.forEach(clientId => {
        this.sendToClient(clientId, message);
      });
    }

    // Also send to run subscribers
    const runClients = this.runSubscriptions.get(runId);
    if (runClients && runClients.size > 0) {
      runClients.forEach(clientId => {
        this.sendToClient(clientId, message);
      });
    }
  }

  private async handleCIArtifactEvent(event: any): Promise<void> {
    const runId = event.data.runId;
    const runClients = this.runSubscriptions.get(runId);

    if (runClients && runClients.size > 0) {
      const message = {
        type: 'ci_artifact_created',
        runId,
        data: event.data,
        timestamp: event.timestamp
      };

      runClients.forEach(clientId => {
        this.sendToClient(clientId, message);
      });
    }
  }

  private async handleCIDeploymentEvent(event: any): Promise<void> {
    const runId = event.data.runId;
    const runClients = this.runSubscriptions.get(runId);

    if (runClients && runClients.size > 0) {
      const message = {
        type: 'ci_deployment_update',
        event: event.type,
        runId,
        data: event.data,
        timestamp: event.timestamp
      };

      runClients.forEach(clientId => {
        this.sendToClient(clientId, message);
      });
    }
  }

  private async handleCIRollbackEvent(event: any): Promise<void> {
    const runId = event.data.originalRunId || event.data.runId;
    const runClients = this.runSubscriptions.get(runId);

    if (runClients && runClients.size > 0) {
      const message = {
        type: 'ci_rollback_update',
        event: event.type,
        runId,
        data: event.data,
        timestamp: event.timestamp
      };

      runClients.forEach(clientId => {
        this.sendToClient(clientId, message);
      });
    }
  }

  // ===============================
  // UTILITY METHODS
  // ===============================

  private async sendRunUpdate(clientId: string, runId: string): Promise<void> {
    try {
      const runDetails = await this.ciOrchestrator.getCIRunDetails(runId);
      if (runDetails) {
        this.sendToClient(clientId, {
          type: 'run_status',
          runId,
          data: runDetails,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error('Failed to send run update', { error, clientId, runId });
    }
  }

  private sendToClient(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      client.ws.send(JSON.stringify(message));
    } catch (error) {
      logger.error('Failed to send message to CI WebSocket client', { error, clientId });
      this.handleClientDisconnect(clientId, 1011, 'Send error');
    }
  }

  private sendError(clientId: string, error: string): void {
    this.sendToClient(clientId, {
      type: 'error',
      error,
      timestamp: new Date().toISOString()
    });
  }

  private generateClientId(): string {
    return `ci-client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ===============================
  // HEALTH CHECK AND MONITORING
  // ===============================

  public getStatus() {
    return {
      totalClients: this.clients.size,
      runSubscriptions: this.runSubscriptions.size,
      stageSubscriptions: this.stageSubscriptions.size,
      healthyClients: Array.from(this.clients.values()).filter(
        client => client.ws.readyState === WebSocket.OPEN
      ).length
    };
  }

  public async cleanup(): Promise<void> {
    // Close all client connections
    this.clients.forEach((client, clientId) => {
      try {
        client.ws.close(1001, 'Server shutdown');
      } catch (error) {
        // Ignore errors during cleanup
      }
    });

    // Clear all data
    this.clients.clear();
    this.runSubscriptions.clear();
    this.stageSubscriptions.clear();

    logger.info('CI WebSocket handler cleanup completed');
  }

  /**
   * Send heartbeat to all clients to check connectivity
   */
  public sendHeartbeat(): void {
    const message = {
      type: 'heartbeat',
      timestamp: new Date().toISOString()
    };

    let removedClients = 0;
    const clientsToRemove: string[] = [];

    this.clients.forEach((client, clientId) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.ping();
          this.sendToClient(clientId, message);
        } catch (error) {
          clientsToRemove.push(clientId);
        }
      } else {
        clientsToRemove.push(clientId);
      }
    });

    // Remove dead clients
    clientsToRemove.forEach(clientId => {
      this.handleClientDisconnect(clientId, 1006, 'Client unreachable');
      removedClients++;
    });

    if (removedClients > 0) {
      logger.info('Removed unreachable CI WebSocket clients during heartbeat', {
        removedCount: removedClients,
        remainingClients: this.clients.size
      });
    }
  }
}

// Export singleton instance
export const ciWebSocketHandler = new CIWebSocketHandler();