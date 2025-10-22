/**
 * Test Resolver Service
 * Resolves tests from test-banks database based on execution configuration
 * Converts database test records into executable file paths
 */

import Database from 'better-sqlite3';
import path from 'path';
import { logger } from '@/utils/logger';
import type { UnifiedTestConfig } from '@/types/unified';
import { CATEGORY_MAP as CATEGORY_MAP_CONFIG } from '@/config/categoryMap';

export interface ResolvedTest {
  id: string;
  testId: string;
  testName: string;
  filePath: string;
  framework: string;
  category: string;
  type: 'e2e' | 'api' | 'load';
  priority: string;
  estimatedDuration?: number;
}

export class TestResolver {
  private db: Database.Database;

  // Category mapping: Frontend-friendly names → Database category names
  private readonly CATEGORY_MAP: Record<string, string[]> = CATEGORY_MAP_CONFIG;

  constructor() {
    const dbPath = path.join(process.cwd(), 'data', 'qa-intel.db');
    this.db = new Database(dbPath);
    logger.debug('TestResolver initialized', { dbPath });
  }

  /**
   * Resolve tests from test-banks database based on config
   */
  async resolveTests(config: UnifiedTestConfig): Promise<ResolvedTest[]> {
    const { tests } = config;
    const resolvedTests: ResolvedTest[] = [];

    logger.info('Resolving tests from database', {
      testIds: tests.testIds?.length,
      categories: tests.categories?.length,
      tags: tests.tags?.length,
      suites: tests.suites?.length,
      pattern: tests.pattern
    });

    try {
      // Resolve E2E tests
      if (config.framework === 'wesign' || config.framework === 'playwright') {
        const e2eTests = this.resolveE2ETests(tests);
        resolvedTests.push(...e2eTests);
      }

      // Resolve API tests
      if (config.framework === 'newman' || config.framework === 'postman') {
        const apiTests = this.resolveAPITests(tests);
        resolvedTests.push(...apiTests);
      }

      // Resolve Load tests
      if (config.framework === 'k6') {
        const loadTests = this.resolveLoadTests(tests);
        resolvedTests.push(...loadTests);
      }

      logger.info('Tests resolved successfully', {
        totalResolved: resolvedTests.length,
        e2e: resolvedTests.filter(t => t.type === 'e2e').length,
        api: resolvedTests.filter(t => t.type === 'api').length,
        load: resolvedTests.filter(t => t.type === 'load').length
      });

      return resolvedTests;

    } catch (error) {
      logger.error('Failed to resolve tests', {
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Resolve E2E tests from database
   */
  private resolveE2ETests(testsConfig: any): ResolvedTest[] {
    let query = 'SELECT * FROM e2e_tests WHERE status = ?';
    const params: any[] = ['active'];

    // Filter by specific test IDs
    if (testsConfig.testIds && testsConfig.testIds.length > 0) {
      const placeholders = testsConfig.testIds.map(() => '?').join(',');
      query += ` AND id IN (${placeholders})`;
      params.push(...testsConfig.testIds);
    }

    // Filter by categories with mapping
    if (testsConfig.categories && testsConfig.categories.length > 0) {
      const mappedCategories: string[] = [];
      testsConfig.categories.forEach((cat: string) => {
        const mapped = this.CATEGORY_MAP[cat.toLowerCase()];
        if (mapped) {
          mappedCategories.push(...mapped);
        } else {
          // Fallback: try exact match for unmapped categories
          mappedCategories.push(cat);
        }
      });

      logger.debug('Category mapping applied', {
        originalCategories: testsConfig.categories,
        mappedCategories,
        totalMapped: mappedCategories.length
      });

      if (mappedCategories.length > 0) {
        const placeholders = mappedCategories.map(() => '?').join(',');
        query += ` AND category IN (${placeholders})`;
        params.push(...mappedCategories);
      }
    }

    // Filter by tags (JSON contains check)
    if (testsConfig.tags && testsConfig.tags.length > 0) {
      const tagConditions = testsConfig.tags.map(() => `tags LIKE ?`).join(' OR ');
      query += ` AND (${tagConditions})`;
      testsConfig.tags.forEach((tag: string) => {
        params.push(`%"${tag}"%`);
      });
    }

    // Filter by suites (module_path)
    if (testsConfig.suites && testsConfig.suites.length > 0) {
      const suiteConditions = testsConfig.suites.map(() => `module_path LIKE ?`).join(' OR ');
      query += ` AND (${suiteConditions})`;
      testsConfig.suites.forEach((suite: string) => {
        params.push(`%${suite}%`);
      });
    }

    query += ' ORDER BY priority DESC, category, test_name';

    logger.debug('E2E query', { query, paramsCount: params.length });

    const tests = this.db.prepare(query).all(...params) as any[];

    return tests.map(test => ({
      id: test.id,
      testId: test.id,
      testName: test.test_name,
      filePath: test.file_path,
      framework: 'playwright',
      category: test.category || 'e2e',
      type: 'e2e' as const,
      priority: test.priority,
      estimatedDuration: test.estimated_duration
    }));
  }

  /**
   * Resolve API tests from database
   */
  private resolveAPITests(testsConfig: any): ResolvedTest[] {
    let query = 'SELECT * FROM api_tests WHERE status = ?';
    const params: any[] = ['active'];

    // Filter by specific test IDs
    if (testsConfig.testIds && testsConfig.testIds.length > 0) {
      const placeholders = testsConfig.testIds.map(() => '?').join(',');
      query += ` AND id IN (${placeholders})`;
      params.push(...testsConfig.testIds);
    }

    // Filter by modules (categories)
    if (testsConfig.categories && testsConfig.categories.length > 0) {
      const placeholders = testsConfig.categories.map(() => '?').join(',');
      query += ` AND module IN (${placeholders})`;
      params.push(...testsConfig.categories);
    }

    // Filter by tags
    if (testsConfig.tags && testsConfig.tags.length > 0) {
      const tagConditions = testsConfig.tags.map(() => `tags LIKE ?`).join(' OR ');
      query += ` AND (${tagConditions})`;
      testsConfig.tags.forEach((tag: string) => {
        params.push(`%"${tag}"%`);
      });
    }

    query += ' ORDER BY priority DESC, module, test_name';

    logger.debug('API query', { query, paramsCount: params.length });

    const tests = this.db.prepare(query).all(...params) as any[];

    // Group by collection for Newman execution
    return tests.map(test => ({
      id: test.id,
      testId: test.id,
      testName: test.test_name,
      filePath: test.collection_path || 'new_tests_for_wesign/api_tests/WeSign_ULTIMATE_COMPLETE_API_TESTING_SUITE.json',
      framework: 'newman',
      category: test.module || 'api',
      type: 'api' as const,
      priority: test.priority,
      estimatedDuration: test.estimated_duration
    }));
  }

  /**
   * Resolve Load tests from database
   */
  private resolveLoadTests(testsConfig: any): ResolvedTest[] {
    let query = 'SELECT * FROM load_tests WHERE status = ?';
    const params: any[] = ['active'];

    // Filter by specific test IDs
    if (testsConfig.testIds && testsConfig.testIds.length > 0) {
      const placeholders = testsConfig.testIds.map(() => '?').join(',');
      query += ` AND id IN (${placeholders})`;
      params.push(...testsConfig.testIds);
    }

    // Filter by scenario types (categories)
    if (testsConfig.categories && testsConfig.categories.length > 0) {
      const placeholders = testsConfig.categories.map(() => '?').join(',');
      query += ` AND scenario_type IN (${placeholders})`;
      params.push(...testsConfig.categories);
    }

    // Filter by tags
    if (testsConfig.tags && testsConfig.tags.length > 0) {
      const tagConditions = testsConfig.tags.map(() => `tags LIKE ?`).join(' OR ');
      query += ` AND (${tagConditions})`;
      testsConfig.tags.forEach((tag: string) => {
        params.push(`%"${tag}"%`);
      });
    }

    query += ' ORDER BY priority DESC, scenario_type, test_name';

    logger.debug('Load query', { query, paramsCount: params.length });

    const tests = this.db.prepare(query).all(...params) as any[];

    return tests.map(test => ({
      id: test.id,
      testId: test.id,
      testName: test.test_name,
      filePath: test.file_path || test.script_path,
      framework: 'k6',
      category: test.scenario_type || 'load',
      type: 'load' as const,
      priority: test.priority,
      estimatedDuration: test.estimated_duration
    }));
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

// Export singleton instance
export const testResolver = new TestResolver();
