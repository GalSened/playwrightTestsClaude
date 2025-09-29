import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';
import { logger } from '@/utils/logger';
import type { Page } from 'playwright';

export interface FailureContext {
  dom: string;
  screenshot: Buffer;
  consoleErrors: string[];
  networkLogs: any[];
  error: string;
  url: string;
  selector?: string;
  testId?: string;
  testName?: string;
}

export interface HealingQueueItem {
  id?: number;
  test_id: string;
  test_name: string;
  failure_type: string;
  error_message: string;
  dom_snapshot?: string;
  screenshot?: Buffer;
  console_logs?: string;
  network_logs?: string;
  original_selector?: string;
  healed_selector?: string;
  confidence_score?: number;
  status?: string;
  healing_attempts?: number;
  created_at?: string;
}

export interface HealingStats {
  pending: number;
  healed: number;
  bugs: number;
  total: number;
  successRate: number;
  avgConfidence: number;
}

export class SelfHealingService {
  private db: Database.Database;
  private consoleErrors: string[] = [];
  private networkLogs: any[] = [];

  constructor(dbPath: string = 'data/healing.db') {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initializeSchema();
    
    logger.info('Self-healing database initialized', { path: dbPath });
  }

  private initializeSchema(): void {
    try {
      const schemaPath = join(__dirname, '../database/healing-schema.sql');
      const schema = readFileSync(schemaPath, 'utf8');
      this.db.exec(schema);
      logger.info('Self-healing database schema initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize self-healing database schema', { error });
      throw error;
    }
  }

  /**
   * Analyze error message and context to classify the type of failure
   */
  async classifyFailure(error: Error, context: FailureContext): Promise<string> {
    const errorMessage = error.message.toLowerCase();
    
    // Selector-related failures
    if (errorMessage.includes('element not found') || 
        errorMessage.includes('cannot locate element') ||
        errorMessage.includes('no such element') ||
        errorMessage.includes('locator.click: no element found') ||
        errorMessage.includes('selector not found')) {
      return 'SELECTOR_ISSUE';
    }

    // Timing and wait issues
    if (errorMessage.includes('timeout') || 
        errorMessage.includes('waiting for') ||
        errorMessage.includes('timed out') ||
        errorMessage.includes('element not ready') ||
        errorMessage.includes('element not visible')) {
      return 'TIMING_ISSUE';
    }

    // Application bugs (server errors, API failures)
    if (context.consoleErrors?.some(e => 
        e.toLowerCase().includes('500') || 
        e.toLowerCase().includes('404') ||
        e.toLowerCase().includes('error') ||
        e.toLowerCase().includes('uncaught')) ||
       context.networkLogs?.some(log => 
        log.status >= 400)) {
      return 'APPLICATION_BUG';
    }

    // DOM changes and stale element issues
    if (errorMessage.includes('stale element') ||
        errorMessage.includes('element is not attached') ||
        errorMessage.includes('dom changed') ||
        errorMessage.includes('element detached')) {
      return 'DOM_CHANGE';
    }

    // Network and connectivity issues
    if (errorMessage.includes('network') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('fetch') ||
        errorMessage.includes('cors')) {
      return 'NETWORK_ISSUE';
    }

    // Authentication and permission issues
    if (errorMessage.includes('unauthorized') ||
        errorMessage.includes('forbidden') ||
        errorMessage.includes('login') ||
        errorMessage.includes('session')) {
      return 'AUTH_ISSUE';
    }

    return 'UNKNOWN';
  }

  /**
   * Capture comprehensive failure context for analysis
   */
  async captureFailureContext(page: Page, error: Error, additionalContext?: any): Promise<FailureContext> {
    try {
      // Capture DOM state
      const dom = await page.content().catch(() => '');
      
      // Capture screenshot
      const screenshot = await page.screenshot({ 
        fullPage: true,
        type: 'png'
      }).catch(() => Buffer.alloc(0));

      // Get current URL
      const url = page.url();

      // Capture console errors (these should be collected during test execution)
      const consoleErrors = [...this.consoleErrors];

      // Capture network logs (these should be collected during test execution)
      const networkLogs = [...this.networkLogs];

      return {
        dom,
        screenshot,
        consoleErrors,
        networkLogs,
        error: error.message,
        url,
        selector: additionalContext?.selector,
        testId: additionalContext?.testId,
        testName: additionalContext?.testName
      };
    } catch (captureError) {
      logger.error('Failed to capture failure context', { captureError, originalError: error.message });
      
      return {
        dom: '',
        screenshot: Buffer.alloc(0),
        consoleErrors: this.consoleErrors,
        networkLogs: this.networkLogs,
        error: error.message,
        url: page.url().catch(() => ''),
        selector: additionalContext?.selector,
        testId: additionalContext?.testId,
        testName: additionalContext?.testName
      };
    }
  }

  /**
   * Add a failure to the healing queue
   */
  async addToHealingQueue(
    testId: string, 
    testName: string, 
    error: Error, 
    context: FailureContext
  ): Promise<number> {
    const failureType = await this.classifyFailure(error, context);
    
    const stmt = this.db.prepare(`
      INSERT INTO healing_queue (
        test_id, test_name, failure_type, error_message, 
        dom_snapshot, screenshot, console_logs, network_logs, 
        original_selector, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `);

    const result = stmt.run(
      testId,
      testName,
      failureType,
      error.message,
      context.dom,
      context.screenshot,
      JSON.stringify(context.consoleErrors),
      JSON.stringify(context.networkLogs),
      context.selector || null
    );

    logger.info('Added failure to healing queue', {
      testId,
      testName,
      failureType,
      queueId: result.lastInsertRowid
    });

    return result.lastInsertRowid as number;
  }

  /**
   * Get current healing statistics
   */
  async getHealingStats(): Promise<HealingStats> {
    const stmt = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'healed' THEN 1 END) as healed,
        COUNT(CASE WHEN status = 'bug_confirmed' THEN 1 END) as bugs,
        AVG(CASE WHEN confidence_score > 0 THEN confidence_score END) as avg_confidence
      FROM healing_queue
      WHERE date(created_at) >= date('now', '-7 days')
    `);

    const result = stmt.get() as any;
    const successRate = result.total > 0 ? Math.round((result.healed / result.total) * 100) : 0;

    return {
      pending: result.pending || 0,
      healed: result.healed || 0,
      bugs: result.bugs || 0,
      total: result.total || 0,
      successRate,
      avgConfidence: Math.round((result.avg_confidence || 0) * 100)
    };
  }

  /**
   * Get healing queue items with filtering options
   */
  async getHealingQueue(filters?: {
    status?: string;
    failureType?: string;
    limit?: number;
    offset?: number;
  }): Promise<HealingQueueItem[]> {
    let query = `
      SELECT 
        id, test_id, test_name, failure_type, error_message,
        original_selector, healed_selector, confidence_score,
        status, healing_attempts, created_at
      FROM healing_queue
      WHERE 1=1
    `;
    
    const params: any[] = [];

    if (filters?.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters?.failureType) {
      query += ' AND failure_type = ?';
      params.push(filters.failureType);
    }

    query += ' ORDER BY created_at DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
      
      if (filters?.offset) {
        query += ' OFFSET ?';
        params.push(filters.offset);
      }
    }

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as HealingQueueItem[];
  }

  /**
   * Update healing queue item status and results
   */
  async updateHealingItem(
    id: number, 
    updates: {
      status?: string;
      healedSelector?: string;
      confidenceScore?: number;
      healingAttempts?: number;
    }
  ): Promise<void> {
    const setClauses: string[] = [];
    const values: any[] = [];

    if (updates.status) {
      setClauses.push('status = ?');
      values.push(updates.status);
    }

    if (updates.healedSelector) {
      setClauses.push('healed_selector = ?');
      values.push(updates.healedSelector);
    }

    if (updates.confidenceScore !== undefined) {
      setClauses.push('confidence_score = ?');
      values.push(updates.confidenceScore);
    }

    if (updates.healingAttempts !== undefined) {
      setClauses.push('healing_attempts = ?');
      values.push(updates.healingAttempts);
    }

    if (updates.status === 'healed') {
      setClauses.push('healed_at = CURRENT_TIMESTAMP');
    }

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    setClauses.push('last_attempt_at = CURRENT_TIMESTAMP');
    
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE healing_queue 
      SET ${setClauses.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);
    logger.info('Updated healing queue item', { id, updates });
  }

  /**
   * Store learned healing patterns for future use
   */
  async storeHealingPattern(
    testType: string,
    originalPattern: string,
    healedPattern: string,
    confidence: number,
    pageUrl?: string,
    domContext?: string
  ): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO healing_patterns (
        test_type, original_pattern, healed_pattern, 
        confidence_score, page_url_pattern, dom_context,
        success_count, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 
        COALESCE((SELECT success_count + 1 FROM healing_patterns 
                  WHERE test_type = ? AND original_pattern = ?), 1),
        CURRENT_TIMESTAMP
      )
    `);

    stmt.run(
      testType, 
      originalPattern, 
      healedPattern, 
      confidence, 
      pageUrl || null, 
      domContext || null,
      testType, 
      originalPattern
    );

    logger.info('Stored healing pattern', { testType, originalPattern, healedPattern, confidence });
  }

  /**
   * Find existing healing patterns that might apply to a failure
   */
  async findHealingPattern(
    testType: string,
    originalSelector: string,
    pageUrl?: string
  ): Promise<any | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM healing_patterns 
      WHERE test_type = ? 
        AND (original_pattern = ? OR original_pattern LIKE ?)
        AND (page_url_pattern IS NULL OR ? LIKE '%' || page_url_pattern || '%')
      ORDER BY success_count DESC, confidence_score DESC
      LIMIT 1
    `);

    return stmt.get(testType, originalSelector, `%${originalSelector}%`, pageUrl || '') || null;
  }

  /**
   * Set up console and network monitoring for a page
   */
  setupPageMonitoring(page: Page): void {
    // Clear previous logs
    this.consoleErrors = [];
    this.networkLogs = [];

    // Listen for console events
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        this.consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
      }
    });

    // Listen for page errors
    page.on('pageerror', (error) => {
      this.consoleErrors.push(`[pageerror] ${error.message}`);
    });

    // Listen for network requests
    page.on('response', (response) => {
      this.networkLogs.push({
        url: response.url(),
        status: response.status(),
        statusText: response.statusText(),
        headers: response.headers()
      });
    });
  }

  /**
   * Clean up old healing queue items
   */
  async cleanup(olderThanDays: number = 30): Promise<number> {
    const stmt = this.db.prepare(`
      DELETE FROM healing_queue 
      WHERE created_at < date('now', '-' || ? || ' days')
        AND status IN ('healed', 'bug_confirmed', 'failed')
    `);

    const result = stmt.run(olderThanDays);
    logger.info('Cleaned up old healing queue items', { 
      deleted: result.changes, 
      olderThanDays 
    });

    return result.changes;
  }

  /**
   * Find alternative selectors for a failed selector
   */
  async findAlternativeSelectors(
    originalSelector: string,
    domContent: string
  ): Promise<{ selector: string; confidence: number }[]> {
    const alternatives: { selector: string; confidence: number }[] = [];
    
    try {
      // Simple heuristic-based selector finding
      // In a real implementation, you'd use DOM parsing and more sophisticated algorithms
      
      // Look for elements with similar IDs or classes
      const idMatch = originalSelector.match(/#([^.\s\[]+)/);
      const classMatch = originalSelector.match(/\.([^#\s\[]+)/);
      
      if (idMatch) {
        const originalId = idMatch[1];
        
        // Look for similar ID patterns in DOM content
        const idRegex = /id="([^"]*(?:login|button|btn|submit)[^"]*)"/gi;
        let match;
        
        while ((match = idRegex.exec(domContent)) !== null) {
          const foundId = match[1];
          if (foundId !== originalId) {
            alternatives.push({
              selector: `#${foundId}`,
              confidence: 0.8
            });
          }
        }
        
        // Look for class-based alternatives
        const classRegex = /class="([^"]*(?:login|button|btn|submit)[^"]*)"/gi;
        while ((match = classRegex.exec(domContent)) !== null) {
          const foundClass = match[1].split(' ')[0]; // Take first class
          if (foundClass) {
            alternatives.push({
              selector: `.${foundClass}`,
              confidence: 0.6
            });
          }
        }
      }
      
      // Look for button elements with text content
      const buttonTextRegex = /<button[^>]*>([^<]*(?:login|sign|enter|submit)[^<]*)<\/button>/gi;
      let match;
      while ((match = buttonTextRegex.exec(domContent)) !== null) {
        alternatives.push({
          selector: `button:has-text("${match[1].trim()}")`,
          confidence: 0.7
        });
      }
      
      // Sort by confidence and return top alternatives
      return alternatives
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3); // Return top 3 alternatives
        
    } catch (error) {
      logger.error('Failed to find alternative selectors', { error, originalSelector });
      return [];
    }
  }

  /**
   * Record a successful healing attempt
   */
  async recordHealing(
    testId: string,
    testName: string,
    failureType: string,
    originalSelector: string,
    healedSelector: string,
    confidence: number
  ): Promise<void> {
    try {
      // Store the healing pattern for future use
      await this.storeHealingPattern(
        'selector',
        originalSelector,
        healedSelector,
        confidence,
        'https://devtest.comda.co.il',
        `Test: ${testName}`
      );
      
      logger.info('Healing recorded successfully', {
        testId,
        testName,
        failureType,
        originalSelector,
        healedSelector,
        confidence
      });
      
    } catch (error) {
      logger.error('Failed to record healing', { error, testId, originalSelector, healedSelector });
      throw error;
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    this.db.close();
    logger.info('Self-healing database connection closed');
  }

  /**
   * Health check for the healing system
   */
  async healthCheck(): Promise<boolean> {
    try {
      this.db.prepare('SELECT 1').get();
      return true;
    } catch (error) {
      logger.error('Self-healing system health check failed', { error });
      return false;
    }
  }
}

// Singleton instance
let healingServiceInstance: SelfHealingService | null = null;

export function getSelfHealingService(): SelfHealingService {
  if (!healingServiceInstance) {
    const dbPath = process.env.HEALING_DB_PATH || 'data/healing.db';
    healingServiceInstance = new SelfHealingService(dbPath);
  }
  return healingServiceInstance;
}

export async function closeSelfHealingService(): Promise<void> {
  if (healingServiceInstance) {
    await healingServiceInstance.close();
    healingServiceInstance = null;
  }
}