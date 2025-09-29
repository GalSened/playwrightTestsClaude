/**
 * WeSign Knowledge Initializer
 * Automatically initializes WeSign codebase knowledge on system startup
 */

import { logger } from '@/utils/logger';
import { WeSignKnowledgeIntegrator } from './wesignKnowledgeIntegrator';

export class WeSignKnowledgeInitializer {
  private integrator: WeSignKnowledgeIntegrator;
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    this.integrator = new WeSignKnowledgeIntegrator();
  }

  /**
   * Initialize WeSign knowledge base (can be called multiple times safely)
   * @param timeout - Optional timeout in milliseconds (default: 5 minutes)
   */
  async initialize(timeout: number = 300000): Promise<void> {
    if (this.initialized) {
      logger.info('WeSign knowledge base already initialized');
      return;
    }

    if (this.initializationPromise) {
      logger.info('WeSign knowledge base initialization in progress, waiting...');
      await this.initializationPromise;
      return;
    }

    this.initializationPromise = this.performInitializationWithTimeout(timeout);
    await this.initializationPromise;
  }

  /**
   * Initialize WeSign knowledge base in background (non-blocking)
   * This method doesn't throw errors and logs them instead
   */
  initializeInBackground(timeout: number = 300000): void {
    if (this.initialized) {
      logger.info('WeSign knowledge base already initialized');
      return;
    }

    if (this.initializationPromise) {
      logger.info('WeSign knowledge base initialization already in progress');
      return;
    }

    this.initializationPromise = this.performInitializationWithTimeout(timeout)
      .then(() => {
        logger.info('WeSign knowledge base initialization completed successfully in background');
      })
      .catch((error) => {
        logger.warn('WeSign knowledge base initialization failed in background, will retry later:', error);
      });
  }

  private async performInitializationWithTimeout(timeout: number): Promise<void> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`WeSign knowledge initialization timed out after ${timeout}ms`));
      }, timeout);
    });

    try {
      await Promise.race([this.performInitialization(), timeoutPromise]);
    } catch (error) {
      this.initializationPromise = null; // Allow retry
      throw error;
    }
  }

  private async performInitialization(): Promise<void> {
    try {
      logger.info('Starting WeSign knowledge base initialization');

      const knowledgeBase = await this.integrator.initializeWeSignKnowledge();

      this.initialized = true;

      logger.info('WeSign knowledge base initialization completed successfully', {
        components: knowledgeBase.componentMap.size,
        workflows: knowledgeBase.workflowMap.size,
        selectors: knowledgeBase.selectorMap.size,
        apis: knowledgeBase.apiEndpointMap.size,
        lastUpdated: knowledgeBase.lastUpdated
      });

    } catch (error) {
      logger.error('WeSign knowledge base initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get initialization status
   */
  getStatus(): { initialized: boolean; lastUpdated?: Date } {
    return {
      initialized: this.initialized,
      lastUpdated: this.initialized ? new Date() : undefined
    };
  }

  /**
   * Force re-initialization
   */
  async refresh(): Promise<void> {
    logger.info('Forcing WeSign knowledge base refresh');
    this.initialized = false;
    this.initializationPromise = null;
    await this.initialize();
  }
}

// Singleton instance for application-wide use
export const wesignKnowledgeInitializer = new WeSignKnowledgeInitializer();