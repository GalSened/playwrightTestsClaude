import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';
import { logger } from '@/utils/logger';
import type { Page } from 'playwright';
import WeSignCodebaseAnalyzer, { WeSignCodeStructure } from './ai/wesignCodebaseAnalyzer';
import UnifiedKnowledgeService from './ai/unifiedKnowledgeService';
import { AIService } from './ai/aiService';

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
  wesignContext?: {
    component?: string;
    workflow?: string;
    feature?: string;
    isHebrewUI?: boolean;
    businessCriticality?: 'low' | 'medium' | 'high' | 'critical';
  };
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
  private codebaseAnalyzer: WeSignCodebaseAnalyzer;
  private knowledgeService: UnifiedKnowledgeService;
  private aiService: AIService;
  private codeStructure: WeSignCodeStructure | null = null;

  constructor(dbPath: string = 'data/healing.db') {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initializeSchema();

    // Initialize WeSign-aware services
    this.codebaseAnalyzer = new WeSignCodebaseAnalyzer();
    this.knowledgeService = new UnifiedKnowledgeService();
    this.aiService = new AIService();

    // Initialize WeSign codebase knowledge asynchronously
    this.initializeWeSignKnowledge();

    logger.info('WeSign-aware Self-healing service initialized', { path: dbPath });
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
   * Initialize WeSign codebase knowledge for intelligent healing
   */
  private async initializeWeSignKnowledge(): Promise<void> {
    try {
      logger.info('Initializing WeSign codebase knowledge for intelligent healing');
      this.codeStructure = await this.codebaseAnalyzer.analyzeFullCodebase();

      logger.info('WeSign-aware self-healing initialized', {
        features: this.codeStructure.features.length,
        workflows: this.codeStructure.workflows.length,
        components: this.codeStructure.frontend.components.length,
        controllers: this.codeStructure.backend.controllers.length
      });
    } catch (error) {
      logger.warn('Failed to initialize WeSign knowledge for self-healing:', error);
      // Continue without codebase knowledge - system still functional
    }
  }

  /**
   * Analyze error message and context to classify the type of failure with WeSign awareness
   */
  async classifyFailure(error: Error, context: FailureContext): Promise<string> {
    const errorMessage = error.message.toLowerCase();
    const url = context.url.toLowerCase();

    // WeSign-specific failure patterns
    if (context.wesignContext) {
      const { component, workflow, feature, isHebrewUI } = context.wesignContext;

      // Hebrew/RTL specific issues
      if (isHebrewUI || url.includes('/he') || errorMessage.includes('hebrew')) {
        if (errorMessage.includes('element not found') || errorMessage.includes('selector')) {
          return 'HEBREW_UI_SELECTOR_ISSUE';
        }
        if (errorMessage.includes('text') || errorMessage.includes('direction')) {
          return 'HEBREW_RTL_LAYOUT_ISSUE';
        }
      }

      // Digital Signature specific issues
      if (workflow === 'Digital Signature' || component?.includes('Signing') || url.includes('sign')) {
        if (errorMessage.includes('canvas') || errorMessage.includes('drawing')) {
          return 'SIGNING_CANVAS_ISSUE';
        }
        if (errorMessage.includes('document') || errorMessage.includes('pdf')) {
          return 'DOCUMENT_RENDERING_ISSUE';
        }
        if (errorMessage.includes('timeout')) {
          return 'SIGNING_TIMEOUT_ISSUE';
        }
      }

      // Contact Management specific issues
      if (workflow === 'Contact Management' || url.includes('contact')) {
        if (errorMessage.includes('form') || errorMessage.includes('validation')) {
          return 'CONTACT_FORM_ISSUE';
        }
        if (errorMessage.includes('list') || errorMessage.includes('table')) {
          return 'CONTACT_LIST_ISSUE';
        }
      }

      // Document Management specific issues
      if (workflow === 'Document Processing' || url.includes('document')) {
        if (errorMessage.includes('upload') || errorMessage.includes('file')) {
          return 'DOCUMENT_UPLOAD_ISSUE';
        }
        if (errorMessage.includes('preview') || errorMessage.includes('viewer')) {
          return 'DOCUMENT_PREVIEW_ISSUE';
        }
      }

      // Template Management specific issues
      if (workflow === 'Template Management' || url.includes('template')) {
        if (errorMessage.includes('editor') || errorMessage.includes('design')) {
          return 'TEMPLATE_EDITOR_ISSUE';
        }
      }

      // Authentication specific issues
      if (workflow === 'Authentication' || url.includes('auth') || url.includes('login')) {
        if (errorMessage.includes('token') || errorMessage.includes('session')) {
          return 'WESIGN_AUTH_TOKEN_ISSUE';
        }
        if (errorMessage.includes('unauthorized') || errorMessage.includes('forbidden')) {
          return 'WESIGN_AUTH_PERMISSION_ISSUE';
        }
      }
    }

    // Standard failure patterns with WeSign context awareness
    if (errorMessage.includes('element not found') ||
        errorMessage.includes('cannot locate element') ||
        errorMessage.includes('no such element') ||
        errorMessage.includes('locator.click: no element found') ||
        errorMessage.includes('selector not found')) {
      return this.classifyWeSignSelectorIssue(context);
    }

    // Timing and wait issues
    if (errorMessage.includes('timeout') ||
        errorMessage.includes('waiting for') ||
        errorMessage.includes('timed out') ||
        errorMessage.includes('element not ready') ||
        errorMessage.includes('element not visible')) {
      return this.classifyWeSignTimingIssue(context);
    }

    // Application bugs (server errors, API failures)
    if (context.consoleErrors?.some(e =>
        e.toLowerCase().includes('500') ||
        e.toLowerCase().includes('404') ||
        e.toLowerCase().includes('error') ||
        e.toLowerCase().includes('uncaught')) ||
       context.networkLogs?.some(log =>
        log.status >= 400)) {
      return 'WESIGN_APPLICATION_BUG';
    }

    // DOM changes and stale element issues
    if (errorMessage.includes('stale element') ||
        errorMessage.includes('element is not attached') ||
        errorMessage.includes('dom changed') ||
        errorMessage.includes('element detached')) {
      return 'WESIGN_DOM_CHANGE';
    }

    // Network and connectivity issues
    if (errorMessage.includes('network') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('fetch') ||
        errorMessage.includes('cors')) {
      return 'WESIGN_NETWORK_ISSUE';
    }

    return 'WESIGN_UNKNOWN';
  }

  /**
   * Classify WeSign-specific selector issues
   */
  private classifyWeSignSelectorIssue(context: FailureContext): string {
    const url = context.url.toLowerCase();

    if (url.includes('sign')) return 'WESIGN_SIGNING_SELECTOR_ISSUE';
    if (url.includes('contact')) return 'WESIGN_CONTACT_SELECTOR_ISSUE';
    if (url.includes('document')) return 'WESIGN_DOCUMENT_SELECTOR_ISSUE';
    if (url.includes('template')) return 'WESIGN_TEMPLATE_SELECTOR_ISSUE';
    if (url.includes('dashboard')) return 'WESIGN_DASHBOARD_SELECTOR_ISSUE';
    if (url.includes('/he') || context.wesignContext?.isHebrewUI) return 'WESIGN_HEBREW_SELECTOR_ISSUE';

    return 'WESIGN_SELECTOR_ISSUE';
  }

  /**
   * Classify WeSign-specific timing issues
   */
  private classifyWeSignTimingIssue(context: FailureContext): string {
    const url = context.url.toLowerCase();

    if (url.includes('sign')) return 'WESIGN_SIGNING_TIMING_ISSUE';
    if (url.includes('upload') || url.includes('document')) return 'WESIGN_DOCUMENT_TIMING_ISSUE';
    if (url.includes('api/')) return 'WESIGN_API_TIMING_ISSUE';

    return 'WESIGN_TIMING_ISSUE';
  }

  /**
   * Capture comprehensive failure context for analysis with WeSign awareness
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

      // Build WeSign-specific context
      const wesignContext = await this.buildWeSignContext(url, error.message, additionalContext);

      return {
        dom,
        screenshot,
        consoleErrors,
        networkLogs,
        error: error.message,
        url,
        selector: additionalContext?.selector,
        testId: additionalContext?.testId,
        testName: additionalContext?.testName,
        wesignContext
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
        testName: additionalContext?.testName,
        wesignContext: await this.buildWeSignContext(page.url().catch(() => ''), error.message, additionalContext)
      };
    }
  }

  /**
   * Build WeSign-specific context for failure analysis
   */
  private async buildWeSignContext(url: string, errorMessage: string, additionalContext?: any): Promise<any> {
    const urlLower = url.toLowerCase();
    const errorLower = errorMessage.toLowerCase();

    const context = {
      component: this.identifyWeSignComponent(urlLower, errorLower, additionalContext),
      workflow: this.identifyWeSignWorkflow(urlLower, errorLower, additionalContext),
      feature: this.identifyWeSignFeature(urlLower, errorLower, additionalContext),
      isHebrewUI: urlLower.includes('/he') || errorLower.includes('hebrew') || additionalContext?.isHebrewTest,
      businessCriticality: this.assessBusinessCriticality(urlLower, errorLower)
    };

    return context;
  }

  /**
   * Identify WeSign component from context
   */
  private identifyWeSignComponent(url: string, error: string, context?: any): string | undefined {
    if (url.includes('/contacts') || context?.testName?.includes('contact')) return 'ContactManagementComponent';
    if (url.includes('/documents') || context?.testName?.includes('document')) return 'DocumentManagementComponent';
    if (url.includes('/templates') || context?.testName?.includes('template')) return 'TemplateManagementComponent';
    if (url.includes('/sign') || context?.testName?.includes('sign')) return 'SigningComponent';
    if (url.includes('/auth') || url.includes('/login') || context?.testName?.includes('login')) return 'AuthenticationComponent';
    if (url.includes('/dashboard') || context?.testName?.includes('dashboard')) return 'DashboardComponent';

    return undefined;
  }

  /**
   * Identify WeSign workflow from context
   */
  private identifyWeSignWorkflow(url: string, error: string, context?: any): string | undefined {
    if (url.includes('/contacts') || context?.testName?.includes('contact')) return 'Contact Management';
    if (url.includes('/documents') || context?.testName?.includes('document')) return 'Document Processing';
    if (url.includes('/templates') || context?.testName?.includes('template')) return 'Template Management';
    if (url.includes('/sign') || context?.testName?.includes('sign')) return 'Digital Signature';
    if (url.includes('/auth') || url.includes('/login') || context?.testName?.includes('login')) return 'Authentication';
    if (url.includes('/dashboard') || context?.testName?.includes('dashboard')) return 'Dashboard Navigation';

    return undefined;
  }

  /**
   * Identify WeSign feature from context
   */
  private identifyWeSignFeature(url: string, error: string, context?: any): string | undefined {
    const component = this.identifyWeSignComponent(url, error, context);
    const isHebrew = url.includes('/he') || error.includes('hebrew');

    if (component && isHebrew) {
      return `${component.replace('Component', '')} (Hebrew)`;
    }

    return component?.replace('Component', '');
  }

  /**
   * Assess business criticality of the failure
   */
  private assessBusinessCriticality(url: string, error: string): 'low' | 'medium' | 'high' | 'critical' {
    // Critical: Authentication and core signing functionality
    if (url.includes('/auth') || url.includes('/login') || url.includes('/sign')) {
      return 'critical';
    }

    // High: Document and contact management
    if (url.includes('/documents') || url.includes('/contacts')) {
      return 'high';
    }

    // Medium: Templates and general features
    if (url.includes('/templates') || url.includes('/reports')) {
      return 'medium';
    }

    // Low: Dashboard and navigation
    return 'low';
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
   * Find alternative selectors for a failed selector using WeSign AI and codebase knowledge
   */
  async findAlternativeSelectors(
    originalSelector: string,
    domContent: string,
    context?: FailureContext
  ): Promise<{ selector: string; confidence: number }[]> {
    const alternatives: { selector: string; confidence: number }[] = [];

    try {
      // Use AI to analyze selector patterns with WeSign knowledge
      const aiAlternatives = await this.findAIAlternativeSelectors(originalSelector, domContent, context);
      alternatives.push(...aiAlternatives);

      // WeSign-specific selector patterns
      const wesignAlternatives = await this.findWeSignSpecificSelectors(originalSelector, domContent, context);
      alternatives.push(...wesignAlternatives);

      // Hebrew/RTL specific patterns
      if (context?.wesignContext?.isHebrewUI) {
        const hebrewAlternatives = await this.findHebrewUISelectors(originalSelector, domContent);
        alternatives.push(...hebrewAlternatives);
      }

      // Fallback to heuristic-based finding
      const heuristicAlternatives = await this.findHeuristicSelectors(originalSelector, domContent);
      alternatives.push(...heuristicAlternatives);

      // Remove duplicates and sort by confidence
      const uniqueAlternatives = alternatives.reduce((acc, current) => {
        const existing = acc.find(item => item.selector === current.selector);
        if (!existing || existing.confidence < current.confidence) {
          return acc.filter(item => item.selector !== current.selector).concat(current);
        }
        return acc;
      }, [] as { selector: string; confidence: number }[]);

      return uniqueAlternatives
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5); // Return top 5 alternatives

    } catch (error) {
      logger.error('Failed to find alternative selectors', { error, originalSelector });
      return [];
    }
  }

  /**
   * Use AI to find intelligent selector alternatives
   */
  private async findAIAlternativeSelectors(
    originalSelector: string,
    domContent: string,
    context?: FailureContext
  ): Promise<{ selector: string; confidence: number }[]> {
    try {
      const prompt = `
You are a WeSign platform expert helping to find alternative selectors for failed test automation.

ORIGINAL SELECTOR: ${originalSelector}
CONTEXT: ${context ? JSON.stringify(context.wesignContext, null, 2) : 'Generic'}
URL: ${context?.url || 'Unknown'}

DOM SNIPPET (first 2000 chars):
${domContent.substring(0, 2000)}

Find 3-5 alternative selectors that could work for the same element:
1. Use WeSign-specific patterns (app-, mat-, ng-, wesign- prefixes)
2. Consider Hebrew/RTL elements if applicable
3. Look for data-testid, aria-label, text content patterns
4. Prefer stable, semantic selectors over brittle ones

Return ONLY a JSON array:
[
  {"selector": "alternative-selector-1", "confidence": 0.9, "reason": "why this works"},
  {"selector": "alternative-selector-2", "confidence": 0.8, "reason": "why this works"}
]
      `;

      const response = await this.aiService.chatCompletion([
        { role: 'system', content: 'You are a WeSign UI automation expert. Return only valid JSON.' },
        { role: 'user', content: prompt }
      ], {
        reasoning_effort: 'medium',
        maxTokens: 1500
      });

      const suggestions = JSON.parse(response.choices[0].message.content || '[]');
      return suggestions.map((s: any) => ({
        selector: s.selector,
        confidence: s.confidence || 0.7
      }));

    } catch (error) {
      logger.warn('AI selector analysis failed, using fallback', { error });
      return [];
    }
  }

  /**
   * Find WeSign-specific alternative selectors
   */
  private async findWeSignSpecificSelectors(
    originalSelector: string,
    domContent: string,
    context?: FailureContext
  ): Promise<{ selector: string; confidence: number }[]> {
    const alternatives: { selector: string; confidence: number }[] = [];

    if (!context?.wesignContext) return alternatives;

    const { component, workflow } = context.wesignContext;

    // WeSign component-specific patterns
    if (component === 'ContactManagementComponent') {
      alternatives.push(
        ...this.extractSelectorsWithPatterns(domContent, [
          'contact-', 'add-contact', 'contact-form', 'contact-list',
          '[data-testid*="contact"]', '.contact-'
        ])
      );
    }

    if (component === 'SigningComponent') {
      alternatives.push(
        ...this.extractSelectorsWithPatterns(domContent, [
          'sign-', 'signature-', 'canvas', 'signing-',
          '[data-testid*="sign"]', '.sign-', '.signature-'
        ])
      );
    }

    if (component === 'DocumentManagementComponent') {
      alternatives.push(
        ...this.extractSelectorsWithPatterns(domContent, [
          'document-', 'doc-', 'file-', 'upload-',
          '[data-testid*="document"]', '.document-', '.file-'
        ])
      );
    }

    if (component === 'TemplateManagementComponent') {
      alternatives.push(
        ...this.extractSelectorsWithPatterns(domContent, [
          'template-', 'tmpl-', 'editor-',
          '[data-testid*="template"]', '.template-'
        ])
      );
    }

    return alternatives;
  }

  /**
   * Find Hebrew/RTL specific selectors
   */
  private async findHebrewUISelectors(
    originalSelector: string,
    domContent: string
  ): Promise<{ selector: string; confidence: number }[]> {
    const alternatives: { selector: string; confidence: number }[] = [];

    // Hebrew text patterns
    const hebrewTextRegex = /[\u0590-\u05FF]+/g;
    const hebrewMatches = domContent.match(hebrewTextRegex);

    if (hebrewMatches) {
      // Look for elements containing Hebrew text
      for (const hebrewText of hebrewMatches.slice(0, 3)) {
        alternatives.push({
          selector: `:has-text("${hebrewText}")`,
          confidence: 0.75
        });
      }
    }

    // RTL-specific attributes
    alternatives.push(
      ...this.extractSelectorsWithPatterns(domContent, [
        '[dir="rtl"]', '.rtl', '[lang="he"]', '.hebrew'
      ])
    );

    return alternatives;
  }

  /**
   * Extract selectors matching specific patterns
   */
  private extractSelectorsWithPatterns(
    domContent: string,
    patterns: string[]
  ): { selector: string; confidence: number }[] {
    const alternatives: { selector: string; confidence: number }[] = [];

    for (const pattern of patterns) {
      if (pattern.startsWith('[') && pattern.endsWith(']')) {
        // Attribute selector pattern
        const attrRegex = new RegExp(pattern.replace(/[\[\]]/g, '\\$&'), 'gi');
        const matches = domContent.match(attrRegex);
        if (matches) {
          alternatives.push({
            selector: pattern,
            confidence: 0.8
          });
        }
      } else if (pattern.includes('*')) {
        // Wildcard pattern
        const regex = new RegExp(pattern.replace('*', '[^"]*'), 'gi');
        const matches = domContent.match(regex);
        if (matches) {
          matches.slice(0, 2).forEach(match => {
            alternatives.push({
              selector: `[${match}]`,
              confidence: 0.7
            });
          });
        }
      } else {
        // Simple class or ID pattern
        if (domContent.includes(pattern)) {
          alternatives.push({
            selector: pattern.startsWith('.') || pattern.startsWith('#') ? pattern : `.${pattern}`,
            confidence: 0.6
          });
        }
      }
    }

    return alternatives;
  }

  /**
   * Fallback heuristic-based selector finding
   */
  private async findHeuristicSelectors(
    originalSelector: string,
    domContent: string
  ): Promise<{ selector: string; confidence: number }[]> {
    const alternatives: { selector: string; confidence: number }[] = [];

    // Look for elements with similar IDs or classes
    const idMatch = originalSelector.match(/#([^.\s\[]+)/);
    const classMatch = originalSelector.match(/\.([^#\s\[]+)/);

    if (idMatch) {
      const originalId = idMatch[1];

      // Look for similar ID patterns in DOM content
      const idRegex = /id="([^"]*(?:login|button|btn|submit|sign|contact|document)[^"]*)"/gi;
      let match;

      while ((match = idRegex.exec(domContent)) !== null) {
        const foundId = match[1];
        if (foundId !== originalId) {
          alternatives.push({
            selector: `#${foundId}`,
            confidence: 0.5
          });
        }
      }
    }

    // Look for button elements with WeSign-specific text content
    const buttonTextRegex = /<button[^>]*>([^<]*(?:login|sign|enter|submit|חתימה|התחבר|שלח)[^<]*)<\/button>/gi;
    let match;
    while ((match = buttonTextRegex.exec(domContent)) !== null) {
      alternatives.push({
        selector: `button:has-text("${match[1].trim()}")`,
        confidence: 0.6
      });
    }

    return alternatives;
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