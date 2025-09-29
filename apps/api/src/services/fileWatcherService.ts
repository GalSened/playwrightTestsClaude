/**
 * File Watcher Service
 * Watches test files for changes and triggers automatic re-discovery
 */

import chokidar from 'chokidar';
import path from 'path';
import { logger } from '../utils/logger';
import { testDiscoveryService } from './testDiscoveryService';

export interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink';
  filePath: string;
  timestamp: Date;
}

export class FileWatcherService {
  private watcher: chokidar.FSWatcher | null = null;
  private isWatching: boolean = false;
  private watchPath: string;
  private changeQueue: FileChangeEvent[] = [];
  private processingTimer: NodeJS.Timeout | null = null;

  constructor(watchPath: string = '../') {
    this.watchPath = path.resolve(watchPath);
    logger.info('File Watcher Service initialized', { watchPath: this.watchPath });
  }

  /**
   * Start watching test files for changes
   */
  async startWatching(): Promise<void> {
    if (this.isWatching) {
      logger.warn('File watcher is already running');
      return;
    }

    try {
      this.watcher = chokidar.watch('**/*test*.py', {
        cwd: this.watchPath,
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/__pycache__/**',
          '**/.pytest_cache/**',
          '**/venv/**',
          '**/env/**',
          '**/dist/**',
          '**/build/**'
        ],
        persistent: true,
        ignoreInitial: true, // Don't trigger events for existing files
        followSymlinks: false,
        depth: 10
      });

      // Set up event handlers
      this.watcher
        .on('add', (filePath) => this.handleFileChange('add', filePath))
        .on('change', (filePath) => this.handleFileChange('change', filePath))
        .on('unlink', (filePath) => this.handleFileChange('unlink', filePath))
        .on('error', (error) => {
          logger.error('File watcher error', { error });
        })
        .on('ready', () => {
          this.isWatching = true;
          logger.info('File watcher is ready and monitoring test files', {
            watchPath: this.watchPath,
            watching: true
          });
        });

      logger.info('File watcher started successfully');

    } catch (error) {
      logger.error('Failed to start file watcher', { error });
      throw error;
    }
  }

  /**
   * Stop watching files
   */
  async stopWatching(): Promise<void> {
    if (!this.isWatching || !this.watcher) {
      return;
    }

    try {
      await this.watcher.close();
      this.watcher = null;
      this.isWatching = false;

      if (this.processingTimer) {
        clearTimeout(this.processingTimer);
        this.processingTimer = null;
      }

      logger.info('File watcher stopped');

    } catch (error) {
      logger.error('Failed to stop file watcher', { error });
      throw error;
    }
  }

  /**
   * Handle file change events
   */
  private handleFileChange(type: 'add' | 'change' | 'unlink', filePath: string): void {
    const event: FileChangeEvent = {
      type,
      filePath: filePath.replace(/\\/g, '/'), // Normalize path separators
      timestamp: new Date()
    };

    logger.info('File change detected', { 
      type, 
      filePath: event.filePath,
      queueSize: this.changeQueue.length 
    });

    // Add to queue
    this.changeQueue.push(event);

    // Debounce processing - wait 2 seconds for more changes
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
    }

    this.processingTimer = setTimeout(() => {
      this.processChangeQueue();
    }, 2000);
  }

  /**
   * Process queued file changes
   */
  private async processChangeQueue(): Promise<void> {
    if (this.changeQueue.length === 0) {
      return;
    }

    const events = [...this.changeQueue];
    this.changeQueue = [];

    logger.info('Processing file change queue', { eventCount: events.length });

    try {
      // Group events by file path to handle multiple changes to same file
      const fileChanges = new Map<string, FileChangeEvent>();
      
      for (const event of events) {
        // Keep the latest event for each file
        const existing = fileChanges.get(event.filePath);
        if (!existing || event.timestamp > existing.timestamp) {
          fileChanges.set(event.filePath, event);
        }
      }

      // Process each unique file change
      for (const [filePath, event] of fileChanges) {
        await this.processFileChange(event);
      }

      logger.info('File change queue processed successfully', { 
        processedFiles: fileChanges.size 
      });

    } catch (error) {
      logger.error('Failed to process file change queue', { error, events });
    }
  }

  /**
   * Process a single file change
   */
  private async processFileChange(event: FileChangeEvent): Promise<void> {
    try {
      switch (event.type) {
        case 'add':
        case 'change':
          logger.info('Re-scanning modified test file', { filePath: event.filePath });
          
          // Trigger incremental scan for this file
          await this.scanSingleFile(event.filePath);
          
          logger.info('Test file re-scan completed', { filePath: event.filePath });
          break;

        case 'unlink':
          logger.info('Test file deleted, marking tests as inactive', { filePath: event.filePath });
          
          // Mark tests from this file as inactive
          await this.markFileTestsInactive(event.filePath);
          
          logger.info('Deleted file tests marked as inactive', { filePath: event.filePath });
          break;
      }

      // Emit real-time update event (for WebSocket clients)
      this.emitTestUpdateEvent(event);

    } catch (error) {
      logger.error('Failed to process file change', { error, event });
    }
  }

  /**
   * Scan a single file that was added or modified
   */
  private async scanSingleFile(filePath: string): Promise<void> {
    try {
      // Use the test discovery service to re-scan this specific file
      const fullPath = path.join(this.watchPath, filePath);
      const tests = await (testDiscoveryService as any).scanTestFile(filePath);
      
      if (tests && tests.length > 0) {
        await (testDiscoveryService as any).storeTests(tests);
        logger.info('Single file scan completed', { 
          filePath, 
          testsFound: tests.length,
          categories: [...new Set(tests.map((t: any) => t.category))]
        });
      }

    } catch (error) {
      logger.error('Failed to scan single file', { error, filePath });
    }
  }

  /**
   * Mark tests from deleted file as inactive
   */
  private async markFileTestsInactive(filePath: string): Promise<void> {
    try {
      // This would typically use the database to mark tests as inactive
      // For now, we'll trigger a sync operation
      await testDiscoveryService.syncWithFileSystem();
      
      logger.info('File deletion processed', { filePath });

    } catch (error) {
      logger.error('Failed to mark file tests as inactive', { error, filePath });
    }
  }

  /**
   * Emit real-time update event for WebSocket clients
   */
  private emitTestUpdateEvent(event: FileChangeEvent): void {
    // This would emit to WebSocket clients when implemented
    logger.debug('Test update event emitted', { event });
  }

  /**
   * Get watcher status
   */
  getStatus(): {
    isWatching: boolean;
    watchPath: string;
    queueSize: number;
    watchedPaths: string[];
  } {
    return {
      isWatching: this.isWatching,
      watchPath: this.watchPath,
      queueSize: this.changeQueue.length,
      watchedPaths: this.watcher ? Object.keys(this.watcher.getWatched()) : []
    };
  }

  /**
   * Manually trigger a full rescan
   */
  async triggerFullRescan(): Promise<void> {
    try {
      logger.info('Triggering manual full rescan');
      await testDiscoveryService.performFullScan();
      logger.info('Manual full rescan completed');
    } catch (error) {
      logger.error('Failed to trigger full rescan', { error });
      throw error;
    }
  }
}

// Export singleton instance
export const fileWatcherService = new FileWatcherService();