import { join } from 'path';
import { readdirSync, statSync } from 'fs';
import { logger } from '@/utils/logger';

// WeSign test suite base path
export const WESIGN_TESTS_BASE_PATH = "C:\\Users\\gals\\seleniumpythontests-1\\playwright_tests";
export const WESIGN_TESTS_PATH = join(WESIGN_TESTS_BASE_PATH, "tests");

export interface TestSuite {
  id: string;
  name: string;
  description: string;
  category: string;
  testFiles: string[];
  markers: string[];
  basePath: string;
  estimatedDurationMs: number;
  priority: number;
}

export interface TestCategory {
  name: string;
  description: string;
  testCount: number;
  suites: TestSuite[];
}

/**
 * Registry for managing WeSign test suites and their execution
 */
export class TestSuiteRegistry {
  private static instance: TestSuiteRegistry;
  private suites: Map<string, TestSuite> = new Map();
  private categories: Map<string, TestCategory> = new Map();
  private initialized = false;

  private constructor() {}

  public static getInstance(): TestSuiteRegistry {
    if (!TestSuiteRegistry.instance) {
      TestSuiteRegistry.instance = new TestSuiteRegistry();
    }
    return TestSuiteRegistry.instance;
  }

  /**
   * Initialize the registry by discovering all WeSign tests
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    logger.info('Initializing TestSuiteRegistry', { basePath: WESIGN_TESTS_PATH });

    try {
      await this.discoverTestSuites();
      this.initialized = true;
      
      logger.info('TestSuiteRegistry initialized', { 
        suiteCount: this.suites.size,
        categoryCount: this.categories.size
      });
    } catch (error) {
      logger.error('Failed to initialize TestSuiteRegistry', { error });
      throw error;
    }
  }

  /**
   * Discover and catalog all test suites
   */
  private async discoverTestSuites(): Promise<void> {
    // Define the known test categories based on directory structure
    const categoryConfigs = [
      {
        name: 'auth',
        description: 'Authentication and authorization tests',
        markers: ['auth', 'login', 'security'],
        priority: 10
      },
      {
        name: 'documents', 
        description: 'Document management and processing tests',
        markers: ['documents', 'upload', 'processing'],
        priority: 8
      },
      {
        name: 'signing',
        description: 'Digital signature workflow tests', 
        markers: ['signing', 'signature', 'workflow'],
        priority: 9
      },
      {
        name: 'contacts',
        description: 'Contact and user management tests',
        markers: ['contacts', 'users', 'management'],
        priority: 6
      },
      {
        name: 'templates',
        description: 'Document template management tests',
        markers: ['templates', 'forms'],
        priority: 5
      },
      {
        name: 'reports',
        description: 'Reporting and analytics tests',
        markers: ['reports', 'analytics', 'dashboard'],
        priority: 4
      },
      {
        name: 'distribution',
        description: 'Document distribution and notification tests',
        markers: ['distribution', 'notifications', 'email'],
        priority: 7
      },
      {
        name: 'bulk_operations',
        description: 'Bulk operations and batch processing tests',
        markers: ['bulk', 'batch', 'operations'],
        priority: 3
      },
      {
        name: 'integration',
        description: 'External system integration tests',
        markers: ['integration', 'api', 'external'],
        priority: 2
      },
      {
        name: 'user_management',
        description: 'User administration and permissions tests',
        markers: ['user_management', 'admin', 'permissions'],
        priority: 6
      },
      {
        name: 'system',
        description: 'System-level and infrastructure tests',
        markers: ['system', 'infrastructure', 'performance'],
        priority: 1
      }
    ];

    // Scan each category directory
    for (const config of categoryConfigs) {
      const categoryPath = join(WESIGN_TESTS_PATH, config.name);
      
      try {
        const stat = statSync(categoryPath);
        if (!stat.isDirectory()) {
          continue;
        }

        const testFiles = this.discoverTestFiles(categoryPath);
        const testCount = testFiles.length;

        if (testCount === 0) {
          logger.warn(`No test files found in category: ${config.name}`);
          continue;
        }

        // Create suites for this category
        const categoryId = config.name;
        const categoryName = config.description;

        // Create main suite for the category
        const mainSuite: TestSuite = {
          id: `${categoryId}_full`,
          name: `${categoryName} - Full Suite`,
          description: `Complete test suite for ${config.description.toLowerCase()}`,
          category: categoryId,
          testFiles: testFiles,
          markers: config.markers,
          basePath: categoryPath,
          estimatedDurationMs: testCount * 30000, // Estimate 30s per test
          priority: config.priority
        };

        this.suites.set(mainSuite.id, mainSuite);

        // Create smoke test suite (first few tests)
        const smokeTestCount = Math.min(3, testCount);
        const smokeSuite: TestSuite = {
          id: `${categoryId}_smoke`,
          name: `${categoryName} - Smoke Tests`,
          description: `Critical smoke tests for ${config.description.toLowerCase()}`,
          category: categoryId,
          testFiles: testFiles.slice(0, smokeTestCount),
          markers: [...config.markers, 'smoke'],
          basePath: categoryPath,
          estimatedDurationMs: smokeTestCount * 20000, // Faster smoke tests
          priority: config.priority + 5 // Higher priority for smoke tests
        };

        this.suites.set(smokeSuite.id, smokeSuite);

        // Create category
        const category: TestCategory = {
          name: config.name,
          description: config.description,
          testCount: testCount,
          suites: [mainSuite, smokeSuite]
        };

        this.categories.set(config.name, category);

        logger.debug(`Discovered category: ${config.name}`, { 
          testCount, 
          suites: category.suites.length 
        });

      } catch (error) {
        logger.warn(`Failed to scan category: ${config.name}`, { error });
        continue;
      }
    }

    // Create special combined suites
    await this.createCombinedSuites();
  }

  /**
   * Discover test files in a directory
   */
  private discoverTestFiles(dirPath: string): string[] {
    const testFiles: string[] = [];

    try {
      const files = readdirSync(dirPath);
      
      for (const file of files) {
        const filePath = join(dirPath, file);
        const stat = statSync(filePath);

        if (stat.isFile() && this.isTestFile(file)) {
          testFiles.push(filePath);
        } else if (stat.isDirectory()) {
          // Recursively scan subdirectories
          const subFiles = this.discoverTestFiles(filePath);
          testFiles.push(...subFiles);
        }
      }
    } catch (error) {
      logger.warn(`Failed to scan directory: ${dirPath}`, { error });
    }

    return testFiles.sort();
  }

  /**
   * Check if a file is a test file
   */
  private isTestFile(filename: string): boolean {
    return (
      filename.endsWith('.py') && 
      (filename.startsWith('test_') || filename.includes('_test.py') || filename.endsWith('_converted.py'))
    );
  }

  /**
   * Create combined test suites for common scenarios
   */
  private async createCombinedSuites(): Promise<void> {
    // Critical Path Suite (auth + documents + signing)
    const criticalSuites = ['auth_smoke', 'documents_smoke', 'signing_smoke'];
    const criticalTestFiles: string[] = [];
    
    for (const suiteId of criticalSuites) {
      const suite = this.suites.get(suiteId);
      if (suite) {
        criticalTestFiles.push(...suite.testFiles);
      }
    }

    if (criticalTestFiles.length > 0) {
      const criticalSuite: TestSuite = {
        id: 'critical_path',
        name: 'Critical Path - End-to-End',
        description: 'Essential user journey tests covering login, document upload, and signing',
        category: 'combined',
        testFiles: criticalTestFiles,
        markers: ['critical', 'e2e', 'smoke'],
        basePath: WESIGN_TESTS_PATH,
        estimatedDurationMs: criticalTestFiles.length * 25000,
        priority: 15 // Highest priority
      };

      this.suites.set(criticalSuite.id, criticalSuite);
    }

    // Regression Suite (all main suites)
    const allTestFiles: string[] = [];
    const regressionSuites = Array.from(this.suites.values()).filter(s => s.id.endsWith('_full'));
    
    for (const suite of regressionSuites) {
      allTestFiles.push(...suite.testFiles);
    }

    if (allTestFiles.length > 0) {
      const regressionSuite: TestSuite = {
        id: 'full_regression',
        name: 'Full Regression Suite',
        description: 'Complete test coverage across all WeSign functionality',
        category: 'combined',
        testFiles: allTestFiles,
        markers: ['regression', 'full'],
        basePath: WESIGN_TESTS_PATH,
        estimatedDurationMs: allTestFiles.length * 35000, // Longer for full coverage
        priority: 1 // Lower priority due to long duration
      };

      this.suites.set(regressionSuite.id, regressionSuite);
    }
  }

  /**
   * Get all available test suites
   */
  public getAllSuites(): TestSuite[] {
    return Array.from(this.suites.values()).sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get suite by ID
   */
  public getSuite(suiteId: string): TestSuite | undefined {
    return this.suites.get(suiteId);
  }

  /**
   * Get all categories
   */
  public getAllCategories(): TestCategory[] {
    return Array.from(this.categories.values());
  }

  /**
   * Get suites by category
   */
  public getSuitesByCategory(categoryName: string): TestSuite[] {
    return Array.from(this.suites.values()).filter(suite => suite.category === categoryName);
  }

  /**
   * Search suites by name or description
   */
  public searchSuites(query: string): TestSuite[] {
    const searchTerm = query.toLowerCase();
    return Array.from(this.suites.values()).filter(suite => 
      suite.name.toLowerCase().includes(searchTerm) ||
      suite.description.toLowerCase().includes(searchTerm) ||
      suite.markers.some(marker => marker.toLowerCase().includes(searchTerm))
    );
  }

  /**
   * Validate that a suite exists and can be executed
   */
  public validateSuite(suiteId: string): { valid: boolean; errors: string[] } {
    const suite = this.suites.get(suiteId);
    const errors: string[] = [];

    if (!suite) {
      errors.push(`Suite not found: ${suiteId}`);
      return { valid: false, errors };
    }

    // Validate test files exist
    for (const testFile of suite.testFiles) {
      try {
        statSync(testFile);
      } catch (error) {
        errors.push(`Test file not found: ${testFile}`);
      }
    }

    // Validate base path
    try {
      const stat = statSync(suite.basePath);
      if (!stat.isDirectory()) {
        errors.push(`Base path is not a directory: ${suite.basePath}`);
      }
    } catch (error) {
      errors.push(`Base path not accessible: ${suite.basePath}`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Get execution statistics for all suites
   */
  public getExecutionStats(): {
    totalSuites: number;
    totalTestFiles: number;
    totalEstimatedDuration: number;
    categoryCounts: Record<string, number>;
  } {
    const suites = this.getAllSuites();
    const allTestFiles = new Set<string>();
    const categoryCounts: Record<string, number> = {};
    let totalEstimatedDuration = 0;

    for (const suite of suites) {
      suite.testFiles.forEach(file => allTestFiles.add(file));
      categoryCounts[suite.category] = (categoryCounts[suite.category] || 0) + 1;
      totalEstimatedDuration += suite.estimatedDurationMs;
    }

    return {
      totalSuites: suites.length,
      totalTestFiles: allTestFiles.size,
      totalEstimatedDuration,
      categoryCounts
    };
  }
}

// Export singleton instance
export const testSuiteRegistry = TestSuiteRegistry.getInstance();