import { logger } from '@/utils/logger';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hits: number;
  ttl: number;
}

export interface PredictiveCache<T> {
  get(key: string): T | null;
  set(key: string, value: T, ttl?: number): void;
  predictiveWarmup(patterns: string[]): Promise<void>;
  getStats(): CacheStats;
}

export interface CacheStats {
  size: number;
  hitRate: number;
  totalHits: number;
  totalMisses: number;
  averageResponseTime: number;
}

/**
 * High-Performance Cache with Predictive Warming
 * Targets sub-500ms response times with 85%+ hit rates
 */
export class SmartCache<T> implements PredictiveCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private hitCount = 0;
  private missCount = 0;
  private responseTimeSum = 0;
  private responseTimeCount = 0;

  // LRU tracking
  private accessOrder: string[] = [];

  constructor(
    private maxSize: number = 2000,
    private defaultTTL: number = 15 * 60 * 1000 // 15 minutes
  ) {}

  get(key: string): T | null {
    const startTime = Date.now();
    const entry = this.cache.get(key);

    if (entry && Date.now() - entry.timestamp < entry.ttl) {
      // Cache hit
      entry.hits++;
      this.hitCount++;
      this.updateAccessOrder(key);

      const responseTime = Date.now() - startTime;
      this.updateResponseTime(responseTime);

      return entry.data;
    }

    // Cache miss
    this.missCount++;
    if (entry) {
      this.cache.delete(key); // Remove expired entry
      this.removeFromAccessOrder(key);
    }

    return null;
  }

  set(key: string, value: T, ttl?: number): void {
    const entry: CacheEntry<T> = {
      data: value,
      timestamp: Date.now(),
      hits: 0,
      ttl: ttl || this.defaultTTL
    };

    // LRU eviction if needed
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, entry);
    this.updateAccessOrder(key);
  }

  async predictiveWarmup(patterns: string[]): Promise<void> {
    logger.info('Starting predictive cache warmup', { patterns: patterns.length });

    // Common Hebrew WeSign queries for pre-warming
    const hebrewQueries = [
      'איך אני מוסיף איש קשר חדש',
      'איך אני יוצר תבנית',
      'איך אני שולח מסמך לחתימה',
      'איך אני רואה את הסטטוס של המסמך',
      'איך אני מוחק איש קשר',
      'איך אני עורך תבנית קיימת'
    ];

    const englishQueries = [
      'how to add new contact',
      'how to create template',
      'how to send document for signature',
      'how to check document status',
      'how to delete contact',
      'how to edit existing template'
    ];

    const allQueries = [...hebrewQueries, ...englishQueries, ...patterns];

    // Pre-warm cache for common queries
    for (const query of allQueries) {
      const key = this.createCacheKey(query);
      if (!this.cache.has(key)) {
        // Mark as pre-warmed with placeholder
        this.set(key, { prewarmed: true, query } as any, 60 * 60 * 1000); // 1 hour TTL
      }
    }

    logger.info('Predictive cache warmup completed', {
      totalEntries: this.cache.size,
      prewarmedQueries: allQueries.length
    });
  }

  getStats(): CacheStats {
    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? this.hitCount / totalRequests : 0;
    const averageResponseTime = this.responseTimeCount > 0
      ? this.responseTimeSum / this.responseTimeCount
      : 0;

    return {
      size: this.cache.size,
      hitRate,
      totalHits: this.hitCount,
      totalMisses: this.missCount,
      averageResponseTime
    };
  }

  private createCacheKey(query: string): string {
    return query.toLowerCase().trim().substring(0, 100);
  }

  private updateAccessOrder(key: string): void {
    // Remove if exists and add to end (most recent)
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  private evictLRU(): void {
    if (this.accessOrder.length > 0) {
      const oldestKey = this.accessOrder[0];
      this.cache.delete(oldestKey);
      this.removeFromAccessOrder(oldestKey);
    }
  }

  private updateResponseTime(responseTime: number): void {
    this.responseTimeSum += responseTime;
    this.responseTimeCount++;
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.hitCount = 0;
    this.missCount = 0;
    this.responseTimeSum = 0;
    this.responseTimeCount = 0;
  }
}

/**
 * Query Optimizer for intelligent query processing
 */
export class QueryOptimizer {
  private queryPatterns = new Map<string, number>();
  private responseTimeThreshold = 500; // 500ms target

  // Common Hebrew-English term mappings for query optimization
  private termMappings = new Map([
    ['איך', 'how'],
    ['מה', 'what'],
    ['איפה', 'where'],
    ['מתי', 'when'],
    ['למה', 'why'],
    ['קשר', 'contact'],
    ['מסמך', 'document'],
    ['תבנית', 'template'],
    ['חתימה', 'signature'],
    ['הוסף', 'add'],
    ['יצר', 'create'],
    ['ערך', 'edit'],
    ['מחק', 'delete'],
    ['שלח', 'send'],
    ['פתח', 'open'],
    ['סגר', 'close'],
    ['שמור', 'save']
  ]);

  /**
   * Optimize query for faster processing
   */
  optimizeQuery(query: string): {
    optimizedQuery: string;
    language: 'hebrew' | 'english' | 'mixed';
    keywords: string[];
    priority: 'high' | 'medium' | 'low';
  } {
    const normalizedQuery = query.toLowerCase().trim();

    // Extract language
    const language = this.detectLanguageQuick(normalizedQuery);

    // Extract keywords
    const keywords = this.extractKeywords(normalizedQuery, language);

    // Determine priority based on common patterns
    const priority = this.calculatePriority(keywords);

    // Create optimized query
    const optimizedQuery = this.createOptimizedQuery(normalizedQuery, keywords, language);

    // Track pattern usage
    this.trackPattern(optimizedQuery);

    return {
      optimizedQuery,
      language,
      keywords,
      priority
    };
  }

  private detectLanguageQuick(query: string): 'hebrew' | 'english' | 'mixed' {
    const hebrewChars = (query.match(/[\u0590-\u05FF]/g) || []).length;
    const englishChars = (query.match(/[a-zA-Z]/g) || []).length;
    const totalChars = hebrewChars + englishChars;

    if (totalChars === 0) return 'english';

    const hebrewRatio = hebrewChars / totalChars;
    const englishRatio = englishChars / totalChars;

    if (hebrewRatio > 0.6) return 'hebrew';
    if (englishRatio > 0.6) return 'english';
    return 'mixed';
  }

  private extractKeywords(query: string, language: 'hebrew' | 'english' | 'mixed'): string[] {
    const words = query.split(/\s+/).filter(word => word.length > 1);
    const keywords: string[] = [];

    for (const word of words) {
      // Add original word
      keywords.push(word);

      // Add mapped equivalent if exists
      if (this.termMappings.has(word)) {
        keywords.push(this.termMappings.get(word)!);
      }

      // Reverse mapping for mixed language support
      for (const [hebrew, english] of this.termMappings.entries()) {
        if (word === english) {
          keywords.push(hebrew);
        }
      }
    }

    return [...new Set(keywords)]; // Remove duplicates
  }

  private calculatePriority(keywords: string[]): 'high' | 'medium' | 'low' {
    const highPriorityTerms = ['add', 'create', 'sign', 'send', 'הוסף', 'יצר', 'חתום', 'שלח'];
    const mediumPriorityTerms = ['edit', 'delete', 'view', 'ערך', 'מחק', 'ראה'];

    const hasHighPriority = keywords.some(keyword =>
      highPriorityTerms.includes(keyword.toLowerCase())
    );

    const hasMediumPriority = keywords.some(keyword =>
      mediumPriorityTerms.includes(keyword.toLowerCase())
    );

    if (hasHighPriority) return 'high';
    if (hasMediumPriority) return 'medium';
    return 'low';
  }

  private createOptimizedQuery(
    originalQuery: string,
    keywords: string[],
    language: 'hebrew' | 'english' | 'mixed'
  ): string {
    // For high-frequency patterns, use simplified query
    const pattern = keywords.slice(0, 3).join(' ');

    if (this.queryPatterns.has(pattern) && this.queryPatterns.get(pattern)! > 5) {
      return pattern; // Use simplified pattern for common queries
    }

    return originalQuery;
  }

  private trackPattern(query: string): void {
    const pattern = query.substring(0, 50);
    const current = this.queryPatterns.get(pattern) || 0;
    this.queryPatterns.set(pattern, current + 1);
  }

  getOptimizationStats(): {
    trackedPatterns: number;
    topPatterns: Array<{pattern: string; frequency: number}>;
  } {
    const patterns = Array.from(this.queryPatterns.entries())
      .map(([pattern, frequency]) => ({ pattern, frequency }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);

    return {
      trackedPatterns: this.queryPatterns.size,
      topPatterns: patterns
    };
  }
}

/**
 * Response Streaming for real-time user experience
 */
export class ResponseStreamer {
  private activeStreams = new Map<string, NodeJS.Timeout>();

  /**
   * Stream response in chunks for better perceived performance
   */
  async streamResponse(
    response: string,
    onChunk: (chunk: string, isComplete: boolean) => void,
    chunkSize: number = 50
  ): Promise<void> {
    const streamId = Math.random().toString(36).substring(7);
    const words = response.split(' ');
    let currentIndex = 0;

    const streamChunk = () => {
      if (currentIndex >= words.length) {
        onChunk('', true); // Signal completion
        this.activeStreams.delete(streamId);
        return;
      }

      const chunk = words.slice(currentIndex, currentIndex + chunkSize).join(' ');
      currentIndex += chunkSize;

      onChunk(chunk, false);

      // Schedule next chunk
      const timeout = setTimeout(streamChunk, 50); // 50ms intervals
      this.activeStreams.set(streamId, timeout);
    };

    streamChunk();
  }

  stopStream(streamId: string): void {
    const timeout = this.activeStreams.get(streamId);
    if (timeout) {
      clearTimeout(timeout);
      this.activeStreams.delete(streamId);
    }
  }

  stopAllStreams(): void {
    this.activeStreams.forEach(timeout => clearTimeout(timeout));
    this.activeStreams.clear();
  }
}

/**
 * Performance Monitor for real-time optimization
 */
export class PerformanceMonitor {
  private metrics: Array<{
    timestamp: number;
    operation: string;
    duration: number;
    success: boolean;
  }> = [];

  private readonly MAX_METRICS = 1000;

  recordOperation(operation: string, duration: number, success: boolean): void {
    this.metrics.push({
      timestamp: Date.now(),
      operation,
      duration,
      success
    });

    // Keep only recent metrics
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }
  }

  getPerformanceReport(): {
    averageResponseTime: number;
    successRate: number;
    slowQueries: Array<{operation: string; duration: number}>;
    recentTrends: {
      last10Average: number;
      last100Average: number;
      improvement: number;
    };
  } {
    const recent = this.metrics.slice(-100);
    const last10 = this.metrics.slice(-10);

    const averageResponseTime = recent.length > 0
      ? recent.reduce((sum, m) => sum + m.duration, 0) / recent.length
      : 0;

    const successRate = recent.length > 0
      ? recent.filter(m => m.success).length / recent.length
      : 0;

    const slowQueries = recent
      .filter(m => m.duration > 1000)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5);

    const last10Average = last10.length > 0
      ? last10.reduce((sum, m) => sum + m.duration, 0) / last10.length
      : 0;

    const last100Average = recent.length > 0
      ? recent.reduce((sum, m) => sum + m.duration, 0) / recent.length
      : 0;

    const improvement = last100Average > 0
      ? ((last100Average - last10Average) / last100Average) * 100
      : 0;

    return {
      averageResponseTime,
      successRate,
      slowQueries,
      recentTrends: {
        last10Average,
        last100Average,
        improvement
      }
    };
  }
}

export { SmartCache as default };