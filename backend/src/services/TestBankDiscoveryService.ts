/**
 * Test Bank Discovery Service
 * Discovers and classifies tests into separate banks: E2E, API, and Load
 *
 * Architecture:
 * - E2E Bank: Pytest + Playwright tests (427 tests)
 * - API Bank: Postman + Newman tests (97 tests)
 * - Load Bank: K6 performance tests (9 scenarios)
 */

import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { logger } from '@/utils/logger';

const execAsync = promisify(exec);

// Database connection for test banks (separate from scheduler.db)
let testBanksDb: Database | null = null;

async function getTestBanksDb(): Promise<Database> {
  if (!testBanksDb) {
    const dbPath = path.join(process.cwd(), 'data', 'qa-intel.db');
    testBanksDb = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
  }
  return testBanksDb;
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface TestBankConfig {
  id: string;
  name: string;
  displayName: string;
  basePath: string;
  discoveryMethod: 'pytest' | 'newman' | 'k6';
  tableName: string;
  framework: string;
}

export interface E2ETest {
  id: string;
  test_bank_id: string;
  test_name: string;
  file_path: string;
  function_name: string;
  class_name?: string;
  module_path?: string;
  category: string;
  sub_category?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  tags?: string;
  markers?: string;
  description?: string;
  docstring?: string;
  line_number?: number;
  estimated_duration?: number;
  retry_attempts?: number;
  self_healing_enabled?: boolean;
  status: string;
  metadata?: string;
}

export interface APITest {
  id: string;
  test_bank_id: string;
  test_name: string;
  collection_name: string;
  collection_id?: string;
  folder_path?: string;
  folder_id?: string;
  request_name: string;
  request_id?: string;
  http_method: string;
  endpoint: string;
  full_url?: string;
  module: string;
  api_version?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  tags?: string;
  description?: string;
  expected_status?: number;
  timeout?: number;
  retry_attempts?: number;
  requires_auth?: boolean;
  status: string;
  metadata?: string;
}

export interface LoadTest {
  id: string;
  test_bank_id: string;
  test_name: string;
  file_path: string;
  scenario_type: 'smoke' | 'load' | 'stress' | 'spike' | 'soak' | 'volume';
  scenario_name?: string;
  target_endpoint?: string;
  target_module?: string;
  vus?: number;
  duration?: string;
  thresholds?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  tags?: string;
  description?: string;
  estimated_duration?: number;
  status: string;
  metadata?: string;
}

export interface TestBankDiscoveryResult {
  e2e: E2ETest[];
  api: APITest[];
  load: LoadTest[];
  summary: {
    e2e_count: number;
    api_count: number;
    load_count: number;
    total_count: number;
    discovery_time: number;
  };
}

// ============================================================================
// Test Bank Discovery Service
// ============================================================================

export class TestBankDiscoveryService extends EventEmitter {
  private testBanks: Map<string, TestBankConfig>;
  private readonly PROJECT_ROOT = path.resolve(process.cwd(), '..');
  private readonly TEMP_DIR = path.join(process.cwd(), 'temp');

  constructor() {
    super();

    this.testBanks = new Map([
      ['e2e', {
        id: 'e2e',
        name: 'e2e',
        displayName: 'End-to-End Tests',
        basePath: 'C:/Users/gals/seleniumpythontests-1/playwright_tests',
        discoveryMethod: 'pytest',
        tableName: 'e2e_tests',
        framework: 'playwright-pytest'
      }],
      ['api', {
        id: 'api',
        name: 'api',
        displayName: 'API Tests',
        basePath: 'C:/Users/gals/seleniumpythontests-1/playwright_tests/api_tests',
        discoveryMethod: 'newman',
        tableName: 'api_tests',
        framework: 'postman-newman'
      }],
      ['load', {
        id: 'load',
        name: 'load',
        displayName: 'Load Tests',
        basePath: 'C:/Users/gals/seleniumpythontests-1/playwright_tests/load_tests',
        discoveryMethod: 'k6',
        tableName: 'load_tests',
        framework: 'k6'
      }]
    ]);

    this.ensureTempDirectory();
  }

  /**
   * Ensure temp directory exists for discovery artifacts
   */
  private ensureTempDirectory(): void {
    if (!fs.existsSync(this.TEMP_DIR)) {
      fs.mkdirSync(this.TEMP_DIR, { recursive: true });
    }
  }

  /**
   * Discover all tests across all test banks
   */
  async discoverAll(): Promise<TestBankDiscoveryResult> {
    const startTime = Date.now();

    logger.info('🔍 Starting comprehensive test discovery across all banks...');

    try {
      // Discover tests from each bank in parallel
      const [e2eTests, apiTests, loadTests] = await Promise.all([
        this.discoverE2ETests(),
        this.discoverAPITests(),
        this.discoverLoadTests()
      ]);

      // Persist tests to database
      await this.persistE2ETests(e2eTests);
      await this.persistAPITests(apiTests);
      await this.persistLoadTests(loadTests);

      // Update test bank counts
      await this.updateTestBankCounts({
        e2e: e2eTests.length,
        api: apiTests.length,
        load: loadTests.length
      });

      const discoveryTime = Date.now() - startTime;

      const result: TestBankDiscoveryResult = {
        e2e: e2eTests,
        api: apiTests,
        load: loadTests,
        summary: {
          e2e_count: e2eTests.length,
          api_count: apiTests.length,
          load_count: loadTests.length,
          total_count: e2eTests.length + apiTests.length + loadTests.length,
          discovery_time: discoveryTime
        }
      };

      logger.info('✅ Test discovery completed successfully', {
        e2e: e2eTests.length,
        api: apiTests.length,
        load: loadTests.length,
        total: result.summary.total_count,
        duration: `${discoveryTime}ms`
      });

      this.emit('discoveryCompleted', result);

      return result;

    } catch (error: any) {
      logger.error('❌ Test discovery failed', {
        error: error.message,
        stack: error.stack
      });

      this.emit('discoveryFailed', error);
      throw error;
    }
  }

  /**
   * Discover E2E tests using pytest --collect-only
   */
  async discoverE2ETests(): Promise<E2ETest[]> {
    logger.info('📱 Discovering E2E tests using pytest...');

    const e2eConfig = this.testBanks.get('e2e')!;
    const testsPath = path.join(this.PROJECT_ROOT, e2eConfig.basePath);
    const outputFile = path.join(this.TEMP_DIR, 'e2e_discovery.json');

    try {
      // Run pytest discovery with JSON output
      const command = `py -m pytest "${testsPath}" --collect-only --quiet --json-report --json-report-file="${outputFile}"`;

      logger.debug('Running pytest discovery command:', command);

      await execAsync(command, {
        cwd: this.PROJECT_ROOT,
        timeout: 60000 // 60 seconds timeout
      });

      // Read discovery results
      const discoveryData = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
      const tests: E2ETest[] = [];

      // Parse from collectors array (used with --collect-only)
      if (discoveryData.collectors && Array.isArray(discoveryData.collectors)) {
        for (const collector of discoveryData.collectors) {
          if (collector.result && Array.isArray(collector.result)) {
            for (const item of collector.result) {
              // Include both Function and Coroutine types (async tests are Coroutine)
              if ((item.type === 'Function' || item.type === 'Coroutine') && item.nodeid) {
                tests.push(this.parseE2ETest({
                  nodeid: item.nodeid,
                  name: item.nodeid.split('::').pop(),
                  lineno: item.lineno
                }));
              }
            }
          }
        }
      }
      // Fallback: parse from tests array (used when tests actually run)
      else if (discoveryData.tests && Array.isArray(discoveryData.tests)) {
        for (const test of discoveryData.tests) {
          tests.push(this.parseE2ETest(test));
        }
      }

      logger.info(`✅ Discovered ${tests.length} E2E tests`);

      // Cleanup temp file
      if (fs.existsSync(outputFile)) {
        fs.unlinkSync(outputFile);
      }

      return tests;

    } catch (error: any) {
      logger.error('❌ E2E test discovery failed', {
        error: error.message,
        testsPath
      });

      // Fallback: scan files manually if pytest fails
      return this.discoverE2ETestsFallback(testsPath);
    }
  }

  /**
   * Parse E2E test from pytest JSON output
   */
  private parseE2ETest(pytestTest: any): E2ETest {
    const nodeid = pytestTest.nodeid || '';
    const parts = nodeid.split('::');
    const filePath = parts[0] || '';
    const className = parts.length > 2 ? parts[1] : undefined;
    const functionName = parts[parts.length - 1] || '';

    return {
      id: this.generateTestId('e2e', nodeid),
      test_bank_id: 'e2e',
      test_name: pytestTest.name || functionName,
      file_path: filePath,
      function_name: functionName,
      class_name: className,
      module_path: this.extractModulePath(filePath),
      category: this.extractCategoryFromPath(filePath),
      sub_category: this.extractSubCategory(functionName),
      priority: this.inferPriority(functionName),
      tags: JSON.stringify(pytestTest.markers || []),
      markers: JSON.stringify(pytestTest.markers || []),
      description: pytestTest.doc || '',
      docstring: pytestTest.doc || '',
      line_number: pytestTest.lineno,
      estimated_duration: 30,
      retry_attempts: 3,
      self_healing_enabled: true,
      status: 'active',
      metadata: JSON.stringify({
        keywords: pytestTest.keywords || [],
        parametrize: pytestTest.parametrize || false,
        fixtures: pytestTest.fixtures || []
      })
    };
  }

  /**
   * Discover API tests from Postman collection
   */
  async discoverAPITests(): Promise<APITest[]> {
    logger.info('🔌 Discovering API tests from Postman collection...');

    const apiConfig = this.testBanks.get('api')!;
    const collectionPath = path.join(
      this.PROJECT_ROOT,
      apiConfig.basePath,
      'WeSign_ULTIMATE_COMPLETE_API_TESTING_SUITE.json'
    );

    try {
      if (!fs.existsSync(collectionPath)) {
        logger.warn('⚠️ Postman collection not found', { collectionPath });
        return [];
      }

      const collection = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));
      const tests: APITest[] = [];

      const processItem = (item: any, folderPath: string = '') => {
        if (item.item && Array.isArray(item.item)) {
          // This is a folder
          const newPath = folderPath ? `${folderPath}/${item.name}` : item.name;
          for (const subItem of item.item) {
            processItem(subItem, newPath);
          }
        } else if (item.request) {
          // This is an API test request
          tests.push(this.parseAPITest(item, folderPath, collection.info?.name || 'Unknown'));
        }
      };

      if (collection.item && Array.isArray(collection.item)) {
        for (const item of collection.item) {
          processItem(item);
        }
      }

      logger.info(`✅ Discovered ${tests.length} API tests`);

      return tests;

    } catch (error: any) {
      logger.error('❌ API test discovery failed', {
        error: error.message,
        collectionPath
      });
      return [];
    }
  }

  /**
   * Parse API test from Postman collection item
   */
  private parseAPITest(item: any, folderPath: string, collectionName: string): APITest {
    const request = item.request;
    const method = typeof request === 'string' ? 'GET' : (request.method || 'GET');
    const url = typeof request === 'string' ? request : (request.url || '');
    const endpoint = this.extractEndpoint(url);
    const module = this.extractModuleFromFolder(folderPath);

    return {
      id: this.generateTestId('api', `${collectionName}-${folderPath}-${method}-${item.name}`),
      test_bank_id: 'api',
      test_name: item.name,
      collection_name: collectionName,
      folder_path: folderPath,
      request_name: item.name,
      http_method: method,
      endpoint: endpoint,
      full_url: typeof url === 'string' ? url : this.buildFullUrl(url),
      module: module,
      api_version: 'v3',
      priority: this.inferAPITestPriority(item.name, method),
      tags: JSON.stringify(this.extractAPITags(item, folderPath)),
      description: item.request?.description || item.description || '',
      expected_status: 200,
      timeout: 30000,
      retry_attempts: 2,
      requires_auth: !folderPath.includes('Login'),
      status: 'active',
      metadata: JSON.stringify({
        request: item.request,
        event: item.event || []
      })
    };
  }

  /**
   * Discover Load tests from K6 scenarios
   */
  async discoverLoadTests(): Promise<LoadTest[]> {
    logger.info('⚡ Discovering Load tests from K6 scenarios...');

    const loadConfig = this.testBanks.get('load')!;
    const scenariosPath = path.join(
      this.PROJECT_ROOT,
      loadConfig.basePath,
      'scenarios'
    );

    try {
      if (!fs.existsSync(scenariosPath)) {
        logger.warn('⚠️ K6 scenarios directory not found', { scenariosPath });
        return [];
      }

      const tests: LoadTest[] = [];
      const scriptFiles = this.findK6Scripts(scenariosPath);

      for (const scriptFile of scriptFiles) {
        const test = await this.parseLoadTest(scriptFile);
        if (test) {
          tests.push(test);
        }
      }

      logger.info(`✅ Discovered ${tests.length} Load test scenarios`);

      return tests;

    } catch (error: any) {
      logger.error('❌ Load test discovery failed', {
        error: error.message,
        scenariosPath
      });
      return [];
    }
  }

  /**
   * Parse Load test from K6 script file
   */
  private async parseLoadTest(scriptPath: string): Promise<LoadTest | null> {
    try {
      const content = fs.readFileSync(scriptPath, 'utf8');
      const fileName = path.basename(scriptPath, '.js');
      const scenarioType = this.extractScenarioTypeFromPath(scriptPath);
      const config = this.parseK6Config(content);

      return {
        id: this.generateTestId('load', scriptPath),
        test_bank_id: 'load',
        test_name: fileName,
        file_path: path.relative(this.PROJECT_ROOT, scriptPath),
        scenario_type: scenarioType,
        scenario_name: config.scenarioName || fileName,
        target_endpoint: config.targetEndpoint,
        target_module: config.targetModule,
        vus: config.vus || 10,
        duration: config.duration || '5m',
        thresholds: JSON.stringify(config.thresholds || {}),
        priority: this.inferLoadTestPriority(scenarioType),
        tags: JSON.stringify(config.tags || [scenarioType]),
        description: config.description || `${scenarioType} test for ${fileName}`,
        estimated_duration: this.parseDuration(config.duration || '5m'),
        status: 'active',
        metadata: JSON.stringify(config)
      };

    } catch (error: any) {
      logger.error('Failed to parse load test', {
        scriptPath,
        error: error.message
      });
      return null;
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Generate unique test ID
   */
  private generateTestId(bankId: string, identifier: string): string {
    const hash = this.simpleHash(identifier);
    return `${bankId}-${hash}`;
  }

  /**
   * Simple hash function for generating IDs
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Extract category from file path
   */
  private extractCategoryFromPath(filePath: string): string {
    const pathParts = filePath.split(/[/\\]/);

    // Check for category in path (e.g., tests/auth/test_file.py -> auth)
    const testsIndex = pathParts.findIndex(p => p === 'tests');
    if (testsIndex >= 0 && pathParts.length > testsIndex + 1) {
      return pathParts[testsIndex + 1];
    }

    // Fallback: extract from filename
    const fileName = path.basename(filePath, '.py');
    if (fileName.includes('auth')) return 'auth';
    if (fileName.includes('contact')) return 'contacts';
    if (fileName.includes('document')) return 'documents';
    if (fileName.includes('template')) return 'templates';
    if (fileName.includes('signing') || fileName.includes('sign')) return 'self_signing';

    return 'general';
  }

  /**
   * Extract subcategory from function name
   */
  private extractSubCategory(functionName: string): string | undefined {
    if (functionName.includes('login')) return 'login';
    if (functionName.includes('register')) return 'registration';
    if (functionName.includes('password')) return 'password';
    if (functionName.includes('session')) return 'session';
    if (functionName.includes('upload')) return 'upload';
    if (functionName.includes('download')) return 'download';
    if (functionName.includes('create')) return 'create';
    if (functionName.includes('edit') || functionName.includes('update')) return 'edit';
    if (functionName.includes('delete')) return 'delete';
    return undefined;
  }

  /**
   * Infer test priority from function name
   */
  private inferPriority(name: string): 'critical' | 'high' | 'medium' | 'low' {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('critical') || lowerName.includes('login') || lowerName.includes('auth')) {
      return 'critical';
    }
    if (lowerName.includes('comprehensive') || lowerName.includes('advanced')) {
      return 'high';
    }
    if (lowerName.includes('basic') || lowerName.includes('simple')) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Infer API test priority
   */
  private inferAPITestPriority(name: string, method: string): 'critical' | 'high' | 'medium' | 'low' {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('login') || lowerName.includes('auth')) return 'critical';
    if (lowerName.includes('sign') || lowerName.includes('document')) return 'high';
    if (method === 'DELETE') return 'high';
    return 'medium';
  }

  /**
   * Infer load test priority from scenario type
   */
  private inferLoadTestPriority(scenarioType: string): 'critical' | 'high' | 'medium' | 'low' {
    switch (scenarioType) {
      case 'smoke': return 'critical';
      case 'load': return 'high';
      case 'stress': return 'high';
      default: return 'medium';
    }
  }

  /**
   * Extract module path from file path
   */
  private extractModulePath(filePath: string): string {
    return filePath.replace(/\.py$/, '').replace(/[/\\]/g, '.');
  }

  /**
   * Extract endpoint from Postman URL object
   */
  private extractEndpoint(url: any): string {
    if (typeof url === 'string') {
      return url.split('?')[0]; // Remove query params
    }
    if (url.raw) {
      return url.raw.split('?')[0];
    }
    if (url.path && Array.isArray(url.path)) {
      return '/' + url.path.join('/');
    }
    return '/unknown';
  }

  /**
   * Build full URL from Postman URL object
   */
  private buildFullUrl(url: any): string {
    if (url.raw) return url.raw;
    if (typeof url === 'string') return url;

    const protocol = url.protocol || 'https';
    const host = Array.isArray(url.host) ? url.host.join('.') : (url.host || 'api.example.com');
    const path = Array.isArray(url.path) ? '/' + url.path.join('/') : '';

    return `${protocol}://${host}${path}`;
  }

  /**
   * Extract module from folder path
   */
  private extractModuleFromFolder(folderPath: string): string {
    const parts = folderPath.split('/');
    if (parts.length > 0) {
      const firstPart = parts[0].toLowerCase();
      if (firstPart.includes('user')) return 'users';
      if (firstPart.includes('contact')) return 'contacts';
      if (firstPart.includes('template')) return 'templates';
      if (firstPart.includes('document')) return 'documents';
      if (firstPart.includes('distribution')) return 'distribution';
      return firstPart;
    }
    return 'general';
  }

  /**
   * Extract API test tags
   */
  private extractAPITags(item: any, folderPath: string): string[] {
    const tags: string[] = ['api'];

    if (folderPath) {
      tags.push(...folderPath.toLowerCase().split('/').filter(Boolean));
    }

    const method = typeof item.request === 'string' ? 'GET' : (item.request?.method || 'GET');
    tags.push(method.toLowerCase());

    return [...new Set(tags)]; // Remove duplicates
  }

  /**
   * Find all K6 script files
   */
  private findK6Scripts(scenariosPath: string): string[] {
    const scripts: string[] = [];

    const walkDir = (dir: string) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
          walkDir(filePath);
        } else if (file.endsWith('.js') && !file.includes('node_modules')) {
          scripts.push(filePath);
        }
      }
    };

    walkDir(scenariosPath);
    return scripts;
  }

  /**
   * Extract scenario type from script path
   */
  private extractScenarioTypeFromPath(scriptPath: string): 'smoke' | 'load' | 'stress' | 'spike' | 'soak' | 'volume' {
    const pathLower = scriptPath.toLowerCase();
    if (pathLower.includes('smoke')) return 'smoke';
    if (pathLower.includes('stress')) return 'stress';
    if (pathLower.includes('spike')) return 'spike';
    if (pathLower.includes('soak')) return 'soak';
    if (pathLower.includes('volume')) return 'volume';
    return 'load';
  }

  /**
   * Parse K6 configuration from script content
   */
  private parseK6Config(content: string): any {
    const config: any = {
      vus: 10,
      duration: '5m',
      thresholds: {},
      tags: []
    };

    // Extract VUs
    const vusMatch = content.match(/vus:\s*(\d+)/);
    if (vusMatch) config.vus = parseInt(vusMatch[1]);

    // Extract duration
    const durationMatch = content.match(/duration:\s*['"]([^'"]+)['"]/);
    if (durationMatch) config.duration = durationMatch[1];

    // Extract description from comments
    const descMatch = content.match(/\/\*\*?\s*\n\s*\*\s*(.+?)\n/);
    if (descMatch) config.description = descMatch[1].trim();

    return config;
  }

  /**
   * Parse duration string to seconds
   */
  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smh])$/);
    if (!match) return 300; // Default 5 minutes

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      default: return 300;
    }
  }

  /**
   * Fallback E2E discovery by scanning files
   */
  private async discoverE2ETestsFallback(testsPath: string): Promise<E2ETest[]> {
    logger.warn('⚠️ Using fallback E2E discovery (file scanning)');

    // This is a simplified fallback - in production, you'd want to properly parse Python files
    return [];
  }

  // ============================================================================
  // Persistence Methods
  // ============================================================================

  /**
   * Persist E2E tests to database
   */
  private async persistE2ETests(tests: E2ETest[]): Promise<void> {
    logger.info(`💾 Persisting ${tests.length} E2E tests to database...`);

    const db = await getTestBanksDb();

    // Clear existing tests
    await db.run('DELETE FROM e2e_tests');

    // Insert new tests
    const stmt = await db.prepare(`
      INSERT INTO e2e_tests (
        id, test_bank_id, test_name, file_path, function_name, class_name,
        module_path, category, sub_category, priority, tags, markers,
        description, docstring, line_number, estimated_duration, retry_attempts,
        self_healing_enabled, status, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const test of tests) {
      await stmt.run(
        test.id, test.test_bank_id, test.test_name, test.file_path,
        test.function_name, test.class_name, test.module_path, test.category,
        test.sub_category, test.priority, test.tags, test.markers,
        test.description, test.docstring, test.line_number, test.estimated_duration,
        test.retry_attempts, test.self_healing_enabled ? 1 : 0, test.status, test.metadata
      );
    }

    await stmt.finalize();

    logger.info(`✅ Persisted ${tests.length} E2E tests`);
  }

  /**
   * Persist API tests to database
   */
  private async persistAPITests(tests: APITest[]): Promise<void> {
    logger.info(`💾 Persisting ${tests.length} API tests to database...`);

    const db = await getTestBanksDb();

    // Clear existing tests
    await db.run('DELETE FROM api_tests');

    // Insert new tests
    const stmt = await db.prepare(`
      INSERT INTO api_tests (
        id, test_bank_id, test_name, collection_name, folder_path, request_name,
        http_method, endpoint, full_url, module, api_version, priority, tags,
        description, expected_status, timeout, retry_attempts, requires_auth, status, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const test of tests) {
      await stmt.run(
        test.id, test.test_bank_id, test.test_name, test.collection_name,
        test.folder_path, test.request_name, test.http_method, test.endpoint,
        test.full_url, test.module, test.api_version, test.priority, test.tags,
        test.description, test.expected_status, test.timeout, test.retry_attempts,
        test.requires_auth ? 1 : 0, test.status, test.metadata
      );
    }

    await stmt.finalize();

    logger.info(`✅ Persisted ${tests.length} API tests`);
  }

  /**
   * Persist Load tests to database
   */
  private async persistLoadTests(tests: LoadTest[]): Promise<void> {
    logger.info(`💾 Persisting ${tests.length} Load tests to database...`);

    const db = await getTestBanksDb();

    // Clear existing tests
    await db.run('DELETE FROM load_tests');

    // Insert new tests
    const stmt = await db.prepare(`
      INSERT INTO load_tests (
        id, test_bank_id, test_name, file_path, scenario_type, scenario_name,
        target_endpoint, target_module, vus, duration, thresholds, priority,
        tags, description, estimated_duration, status, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const test of tests) {
      await stmt.run(
        test.id, test.test_bank_id, test.test_name, test.file_path,
        test.scenario_type, test.scenario_name, test.target_endpoint, test.target_module,
        test.vus, test.duration, test.thresholds, test.priority, test.tags,
        test.description, test.estimated_duration, test.status, test.metadata
      );
    }

    await stmt.finalize();

    logger.info(`✅ Persisted ${tests.length} Load tests`);
  }

  /**
   * Update test bank counts
   */
  private async updateTestBankCounts(counts: { e2e: number; api: number; load: number }): Promise<void> {
    logger.info('📊 Updating test bank counts...');

    const db = await getTestBanksDb();

    await db.run(
      'UPDATE test_banks SET test_count = ?, last_discovery = CURRENT_TIMESTAMP WHERE id = ?',
      counts.e2e, 'e2e'
    );

    await db.run(
      'UPDATE test_banks SET test_count = ?, last_discovery = CURRENT_TIMESTAMP WHERE id = ?',
      counts.api, 'api'
    );

    await db.run(
      'UPDATE test_banks SET test_count = ?, last_discovery = CURRENT_TIMESTAMP WHERE id = ?',
      counts.load, 'load'
    );

    logger.info('✅ Test bank counts updated');
  }

  /**
   * Get test bank statistics
   */
  async getTestBankStats() {
    const db = await getTestBanksDb();
    return await db.all('SELECT * FROM v_active_tests_summary');
  }
}

// Singleton instance
let discoveryServiceInstance: TestBankDiscoveryService | null = null;

export function getTestBankDiscoveryService(): TestBankDiscoveryService {
  if (!discoveryServiceInstance) {
    discoveryServiceInstance = new TestBankDiscoveryService();
  }
  return discoveryServiceInstance;
}

export async function discoverAllTestBanks(): Promise<TestBankDiscoveryResult> {
  const service = getTestBankDiscoveryService();
  return await service.discoverAll();
}
