/**
 * Unified Event System - Central event distribution for WeSign platform
 * Replaces scattered WebSocket and event logic throughout the application
 */

import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { WeSignEvent, EventType, EventHandler } from './types';

export class EventBus {
  private subscribers = new Map<EventType, Set<EventHandler>>();
  private wsClients = new Set<WebSocket>();
  private eventHistory: WeSignEvent[] = [];
  private maxHistorySize = 1000;

  constructor() {
    logger.info('EventBus initialized - unified event system ready');
  }

  /**
   * Subscribe to specific event types
   */
  subscribe(eventType: EventType, handler: EventHandler): () => void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }

    const handlers = this.subscribers.get(eventType)!;
    handlers.add(handler);

    logger.debug('Event subscription added', {
      eventType,
      totalSubscribers: handlers.size
    });

    // Return unsubscribe function
    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.subscribers.delete(eventType);
      }
    };
  }

  /**
   * Publish event to all subscribers and WebSocket clients
   */
  async publish(event: WeSignEvent): Promise<void> {
    try {
      // Add to history
      this.addToHistory(event);

      // Notify subscribers
      await this.notifySubscribers(event);

      // Broadcast to WebSocket clients
      this.broadcastToWebSockets(event);

      logger.debug('Event published successfully', {
        id: event.id,
        type: event.type,
        subscriberCount: this.subscribers.get(event.type)?.size || 0,
        wsClientCount: this.wsClients.size
      });

    } catch (error) {
      logger.error('Failed to publish event', {
        event: event.id,
        error: error instanceof Error ? error.message : error
      });
    }
  }

  /**
   * Add WebSocket client for real-time updates
   */
  addWebSocketClient(ws: WebSocket): void {
    this.wsClients.add(ws);

    // SIMPLIFIED based on minimal test success
    // server.ts already waits 500ms before calling this method
    // So we can just send messages immediately here

    // Send connection acknowledgment
    this.sendToWebSocket(ws, {
      id: uuidv4(),
      timestamp: new Date(),
      source: 'EventBus',
      type: 'connection' as EventType,
      data: {
        status: 'connected',
        message: 'Connected to WeSign real-time updates'
      }
    });

    // Send recent events
    const recentEvents = this.eventHistory.slice(-10);
    recentEvents.forEach(event => {
      this.sendToWebSocket(ws, event);
    });

    // Handle client disconnect
    ws.on('close', () => {
      this.wsClients.delete(ws);
      logger.debug('WebSocket client disconnected', {
        remainingClients: this.wsClients.size
      });
    });

    ws.on('error', (error) => {
      logger.warn('WebSocket client error', { error });
      this.wsClients.delete(ws);
    });

    logger.info('WebSocket client connected to EventBus', {
      totalClients: this.wsClients.size
    });
  }

  /**
   * Get recent event history
   */
  getEventHistory(count: number = 50): WeSignEvent[] {
    return this.eventHistory.slice(-count);
  }

  /**
   * Get current statistics
   */
  getStats() {
    const subscriberStats = new Map<EventType, number>();
    this.subscribers.forEach((handlers, eventType) => {
      subscriberStats.set(eventType, handlers.size);
    });

    return {
      wsClients: this.wsClients.size,
      subscribers: Object.fromEntries(subscriberStats),
      eventHistory: this.eventHistory.length,
      uptime: process.uptime()
    };
  }

  /**
   * Create and publish a WeSign event
   */
  createAndPublish(type: EventType, source: string, data: any): Promise<void> {
    const event: WeSignEvent = {
      id: uuidv4(),
      timestamp: new Date(),
      source,
      type,
      data
    };

    return this.publish(event);
  }

  private async notifySubscribers(event: WeSignEvent): Promise<void> {
    const handlers = this.subscribers.get(event.type);
    if (!handlers || handlers.size === 0) {
      return;
    }

    // Execute all handlers in parallel
    const promises = Array.from(handlers).map(async handler => {
      try {
        await handler(event);
      } catch (error) {
        logger.error('Event handler failed', {
          eventId: event.id,
          eventType: event.type,
          error: error instanceof Error ? error.message : error
        });
      }
    });

    await Promise.allSettled(promises);
  }

  private broadcastToWebSockets(event: WeSignEvent): void {
    if (this.wsClients.size === 0) {
      return;
    }

    const clientsToRemove: WebSocket[] = [];

    this.wsClients.forEach(ws => {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          this.sendToWebSocket(ws, event);
        } else {
          clientsToRemove.push(ws);
        }
      } catch (error) {
        logger.warn('Failed to send event to WebSocket client', {
          eventId: event.id,
          error
        });
        clientsToRemove.push(ws);
      }
    });

    // Clean up disconnected clients
    clientsToRemove.forEach(ws => this.wsClients.delete(ws));
  }

  private sendToWebSocket(ws: WebSocket, event: WeSignEvent): void {
    // Safety check: only send if connection is open
    if (ws.readyState !== WebSocket.OPEN) {
      logger.warn('Attempted to send to non-open WebSocket', {
        readyState: ws.readyState,
        eventId: event.id
      });
      return;
    }

    try {
      const message = JSON.stringify({
        type: 'wesign-event',
        event: event
      });

      ws.send(message, (error) => {
        if (error) {
          logger.error('WebSocket send error', {
            eventId: event.id,
            error: error.message
          });
        }
      });
    } catch (error) {
      logger.error('Failed to serialize or send WebSocket message', {
        eventId: event.id,
        error: error instanceof Error ? error.message : error
      });
    }
  }

  private addToHistory(event: WeSignEvent): void {
    this.eventHistory.push(event);

    // Maintain history size limit
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Clean shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('EventBus shutting down...');

    // Close all WebSocket connections
    this.wsClients.forEach(ws => {
      try {
        ws.close(1000, 'Server shutdown');
      } catch (error) {
        // Ignore errors during shutdown
      }
    });

    // Clear subscribers
    this.subscribers.clear();

    logger.info('EventBus shutdown complete');
  }
}

// Global EventBus instance
export const globalEventBus = new EventBus();

// Export for compatibility with existing imports
export const eventBus = globalEventBus;
