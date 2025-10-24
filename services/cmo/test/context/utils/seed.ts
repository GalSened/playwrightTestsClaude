/**
 * Seed Corpus Utility
 *
 * Generate test data for H4R→SCS→Pack integration tests
 */

import type { H4RCandidate } from '../../../src/context/h4r/types.js';

/**
 * Seed corpus configuration
 */
export interface SeedConfig {
  /**
   * Number of items to generate
   */
  count?: number;

  /**
   * Source distribution
   */
  sources?: Array<'postgres' | 'qdrant' | 'neo4j' | 'redis' | 'memory'>;

  /**
   * Date range for createdAt (days ago)
   */
  dateRange?: {
    min: number; // oldest (days ago)
    max: number; // newest (days ago)
  };

  /**
   * Access count range
   */
  accessRange?: {
    min: number;
    max: number;
  };

  /**
   * Content templates
   */
  templates?: string[];

  /**
   * Reference date (for deterministic tests)
   */
  now?: Date;
}

/**
 * Default content templates
 */
const DEFAULT_TEMPLATES = [
  // Test failure patterns
  'Test login-spec-001 failed with assertion error: expected true but got false',
  'Timeout exception occurred in checkout flow after 30s wait',
  'Element not found error: selector #login-button does not match any elements',
  'Network request failed with status 500 in payment submission',
  'Race condition detected in async test: order of operations inconsistent',

  // Selector issues
  'Selector .user-profile not found in DOM snapshot',
  'XPath locator //button[@id="submit"] failed to match',
  'Element with data-testid="checkout-btn" is not visible',

  // Flaky behavior
  'Test sometimes passes when retried: intermittent timing issue',
  'Flaky behavior in cart update: state inconsistency',

  // Success patterns
  'All assertions passed in authentication flow',
  'Successfully validated form submission with valid data',
  'API response matches expected schema',

  // Context
  'Previous test run showed similar selector issues in login module',
  'Related bug report #1234: login button selector changed in v2.3',
  'Code review comment: consider using data-testid for stability',

  // Critical issues
  'Critical production issue: payment processing down',
  'Security vulnerability detected in authentication flow',
  'Data loss risk: transaction rollback failing',
  'Urgent: user-facing error on checkout page',
];

/**
 * Generate random value in range
 */
function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate random date in range (days ago)
 */
function randomDate(minDaysAgo: number, maxDaysAgo: number, now: Date): Date {
  const daysAgo = randomInRange(minDaysAgo, maxDaysAgo);
  const date = new Date(now);
  date.setDate(date.getDate() - daysAgo);
  return date;
}

/**
 * Generate random importance score
 */
function randomImportance(): number {
  const rand = Math.random();
  if (rand < 0.1) return Math.random() * 0.3; // 10% low importance
  if (rand < 0.7) return 0.3 + Math.random() * 0.4; // 60% medium
  return 0.7 + Math.random() * 0.3; // 30% high importance
}

/**
 * Generate random trust score
 */
function randomTrust(): number {
  const rand = Math.random();
  if (rand < 0.05) return Math.random() * 0.3; // 5% low trust
  if (rand < 0.8) return 0.5 + Math.random() * 0.3; // 75% medium-high
  return 0.8 + Math.random() * 0.2; // 20% very high trust
}

/**
 * Generate random sensitivity score
 */
function randomSensitivity(): number {
  const rand = Math.random();
  if (rand < 0.7) return Math.random() * 0.3; // 70% public/low sensitivity
  if (rand < 0.9) return 0.3 + Math.random() * 0.4; // 20% medium
  return 0.7 + Math.random() * 0.3; // 10% high sensitivity
}

/**
 * Generate seed corpus of H4R candidates
 */
export function generateSeedCorpus(config: SeedConfig = {}): H4RCandidate[] {
  const {
    count = 50,
    sources = ['postgres'],
    dateRange = { min: 0, max: 90 },
    accessRange = { min: 0, max: 100 },
    templates = DEFAULT_TEMPLATES,
    now = new Date(),
  } = config;

  const corpus: H4RCandidate[] = [];

  for (let i = 0; i < count; i++) {
    const template = templates[i % templates.length];
    const source = sources[i % sources.length];

    const candidate: H4RCandidate = {
      id: `seed-${i.toString().padStart(4, '0')}`,
      content: {
        text: template,
        category: i < 5 ? 'test_failure' : i < 10 ? 'selector_issue' : 'general',
        timestamp: randomDate(dateRange.min, dateRange.max, now).toISOString(),
      },
      metadata: {
        source,
        createdAt: randomDate(dateRange.min, dateRange.max, now),
        accessCount: randomInRange(accessRange.min, accessRange.max),
        importance: randomImportance(),
        trust: randomTrust(),
        sensitivity: randomSensitivity(),
      },
    };

    corpus.push(candidate);
  }

  return corpus;
}

/**
 * Generate focused corpus for specific test scenarios
 */
export function generateFocusedCorpus(
  scenario: 'test_failures' | 'selector_issues' | 'flaky' | 'critical' | 'mixed',
  count: number = 10,
  now: Date = new Date()
): H4RCandidate[] {
  const templates: Record<typeof scenario, string[]> = {
    test_failures: [
      'Test failed with assertion error: expected 200 but got 404',
      'Timeout exception after 30s wait for element',
      'Error in test execution: undefined is not a function',
      'Test suite crashed with unhandled promise rejection',
      'Assertion failed: cart total does not match expected value',
    ],
    selector_issues: [
      'Selector #login-btn not found in DOM',
      'Element locator .user-menu failed to match',
      'XPath //button[@class="submit"] returned no results',
      'CSS selector [data-test="checkout"] is not visible',
      'Element with ID "payment-form" not found after navigation',
    ],
    flaky: [
      'Test intermittently fails on CI but passes locally',
      'Race condition in async operations causes flaky behavior',
      'Timing issue: sometimes element loads too slowly',
      'Inconsistent test results suggest flaky test',
      'Network timing causes occasional test failures',
    ],
    critical: [
      'Critical production outage in payment processing',
      'Security vulnerability: SQL injection possible',
      'Data loss detected in production database',
      'Urgent: user-facing error blocking checkouts',
      'Production incident: authentication service down',
    ],
    mixed: DEFAULT_TEMPLATES.slice(0, 10),
  };

  const scenarioTemplates = templates[scenario];

  return Array.from({ length: count }, (_, i) => ({
    id: `${scenario}-${i.toString().padStart(3, '0')}`,
    content: {
      text: scenarioTemplates[i % scenarioTemplates.length],
      scenario,
      index: i,
    },
    metadata: {
      source: 'postgres' as const,
      createdAt: new Date(now.getTime() - (count - i) * 24 * 60 * 60 * 1000),
      accessCount: i * 5,
      importance: scenario === 'critical' ? 0.9 : 0.5 + i * 0.05,
      trust: 0.7,
      sensitivity: scenario === 'critical' ? 0.8 : 0.2,
    },
  }));
}

/**
 * Generate corpus with specific signal characteristics
 */
export function generateSignalCorpus(
  signalProfile: {
    recency?: 'high' | 'low' | 'mixed';
    frequency?: 'high' | 'low' | 'mixed';
    importance?: 'high' | 'low' | 'mixed';
    sensitivity?: 'high' | 'low' | 'mixed';
  },
  count: number = 10,
  now: Date = new Date()
): H4RCandidate[] {
  const { recency, frequency, importance, sensitivity } = signalProfile;

  return Array.from({ length: count }, (_, i) => {
    // Recency
    let createdAt: Date;
    if (recency === 'high') {
      createdAt = new Date(now.getTime() - i * 60 * 60 * 1000); // hours ago
    } else if (recency === 'low') {
      createdAt = new Date(now.getTime() - (90 - i) * 24 * 60 * 60 * 1000); // months ago
    } else {
      createdAt = randomDate(0, 90, now);
    }

    // Frequency
    let accessCount: number;
    if (frequency === 'high') {
      accessCount = 80 + i * 2;
    } else if (frequency === 'low') {
      accessCount = i;
    } else {
      accessCount = randomInRange(0, 100);
    }

    // Importance
    let importanceScore: number;
    if (importance === 'high') {
      importanceScore = 0.8 + i * 0.02;
    } else if (importance === 'low') {
      importanceScore = 0.1 + i * 0.02;
    } else {
      importanceScore = randomImportance();
    }

    // Sensitivity
    let sensitivityScore: number;
    if (sensitivity === 'high') {
      sensitivityScore = 0.8 + i * 0.02;
    } else if (sensitivity === 'low') {
      sensitivityScore = 0.0 + i * 0.02;
    } else {
      sensitivityScore = randomSensitivity();
    }

    return {
      id: `signal-${i.toString().padStart(3, '0')}`,
      content: {
        text: `Test item ${i} with specific signal profile`,
        index: i,
      },
      metadata: {
        source: 'postgres' as const,
        createdAt,
        accessCount,
        importance: importanceScore,
        trust: 0.7,
        sensitivity: sensitivityScore,
      },
    };
  });
}

/**
 * Generate corpus for budget testing
 */
export function generateBudgetCorpus(
  itemSize: 'small' | 'medium' | 'large',
  count: number = 20
): H4RCandidate[] {
  const sizes = {
    small: 50,
    medium: 500,
    large: 5000,
  };

  const charCount = sizes[itemSize];

  return Array.from({ length: count }, (_, i) => ({
    id: `budget-${itemSize}-${i.toString().padStart(3, '0')}`,
    content: {
      text: 'x'.repeat(charCount),
      size: itemSize,
      index: i,
    },
    metadata: {
      source: 'postgres' as const,
      createdAt: new Date(),
      accessCount: 10,
      importance: 0.5,
      trust: 0.7,
      sensitivity: 0.2,
    },
  }));
}

/**
 * Generate deterministic corpus for CI tests
 */
export function generateDeterministicCorpus(
  seed: number = 42,
  count: number = 20
): H4RCandidate[] {
  // Simple seeded random for determinism
  let current = seed;
  const seededRandom = () => {
    current = (current * 1103515245 + 12345) % 2147483648;
    return current / 2147483648;
  };

  const baseDate = new Date('2025-10-01T12:00:00Z');

  return Array.from({ length: count }, (_, i) => {
    const daysAgo = Math.floor(seededRandom() * 90);
    const createdAt = new Date(baseDate);
    createdAt.setDate(createdAt.getDate() - daysAgo);

    return {
      id: `deterministic-${i.toString().padStart(3, '0')}`,
      content: {
        text: `Deterministic test item ${i} with seed ${seed}`,
        index: i,
      },
      metadata: {
        source: 'postgres' as const,
        createdAt,
        accessCount: Math.floor(seededRandom() * 100),
        importance: seededRandom() * 0.8 + 0.1,
        trust: seededRandom() * 0.3 + 0.6,
        sensitivity: seededRandom() * 0.5,
      },
    };
  });
}
