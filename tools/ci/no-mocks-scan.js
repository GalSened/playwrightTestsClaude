#!/usr/bin/env node
/**
 * NO_MOCKS CI Scanner
 *
 * Fast repository scan that fails the build on detection of mocks/fakes/stubs.
 * Excludes third-party node_modules and build artifacts.
 *
 * Usage:
 *   node tools/ci/no-mocks-scan.js
 *   npm run scan:no-mocks
 */

const { execSync } = require('node:child_process');
const path = require('node:path');

// Patterns to exclude from scan
const excludePatterns = [
  ':(exclude)node_modules',
  ':(exclude).git',
  ':(exclude)dist',
  ':(exclude)build',
  ':(exclude).next',
  ':(exclude)coverage',
  ':(exclude).cache',
  ':(exclude)test/_no_mocks_guard.ts', // Exclude guard file itself
  ':(exclude)test/setup.no-mocks.ts', // Exclude setup file
  ':(exclude)tools/ci/no-mocks-scan.js', // Exclude scanner itself
];

/**
 * Run git grep and capture output
 * @param {string} expr - Regular expression pattern
 * @returns {string} - Matched lines or empty string
 */
function gitGrep(expr) {
  try {
    // Use double quotes for Windows compatibility
    const cmd = process.platform === 'win32'
      ? `git grep -nE \"${expr}\" -- ${excludePatterns.join(' ')}`
      : `git grep -nE "${expr}" -- ${excludePatterns.join(' ')}`;

    const result = execSync(cmd, {
      stdio: 'pipe',
      encoding: 'utf-8',
      shell: true,
    });
    return result.toString().trim();
  } catch (err) {
    // git grep returns exit code 1 when no matches (not an error)
    if (err.status === 1) return '';
    // Silently ignore errors from shell interpretation
    if (err.stderr && err.stderr.includes('not recognized')) return '';
    throw err;
  }
}

console.log('🔍 Running NO_MOCKS repository scan...\n');

const violations = [];

// Scan 1: File/folder names containing mocks/fakes/stubs
console.log('Scanning for forbidden file/folder names...');
const fileViolations = gitGrep('/(\\b__mocks__\\b|\\bmocks?\\b|\\bfakes?\\b|\\bstubs?\\b|\\bInprocBus\\b)');
if (fileViolations) {
  violations.push({
    type: 'Forbidden file/folder names',
    details: fileViolations,
  });
}

// Scan 2: Vitest/Jest mocking API usage
console.log('Scanning for mocking API usage...');
const mockApiViolations = gitGrep('\\b(vi|jest)\\.(mock|doMock|unmock|doUnmock|spyOn)\\s*\\(');
if (mockApiViolations) {
  violations.push({
    type: 'Vitest/Jest mocking API usage',
    details: mockApiViolations,
  });
}

// Scan 3: Import statements from mock directories
console.log('Scanning for mock imports...');
const importViolations = gitGrep('from\\s+["\'].*/(mocks?|fakes?|stubs?|__mocks__)/');
if (importViolations) {
  violations.push({
    type: 'Imports from mock directories',
    details: importViolations,
  });
}

// Scan 4: InprocBus usage (in-process transport)
console.log('Scanning for InprocBus usage...');
const inprocViolations = gitGrep('\\bInprocBus\\b');
if (inprocViolations) {
  violations.push({
    type: 'InprocBus usage (use Redis Streams instead)',
    details: inprocViolations,
  });
}

// Report results
console.log('');
if (violations.length === 0) {
  console.log('✅ NO_MOCKS scan clean - no violations found\n');
  console.log('All tests are using real implementations.');
  process.exit(0);
} else {
  console.error('❌ NO_MOCKS scan found violations:\n');

  violations.forEach((violation, index) => {
    console.error(`${index + 1}. ${violation.type}:`);
    console.error(violation.details);
    console.error('');
  });

  console.error('Fix these violations before merging:');
  console.error('  - Remove mock/fake/stub files and imports');
  console.error('  - Replace vi.mock/jest.mock with real implementations');
  console.error('  - Use Redis Streams instead of InprocBus');
  console.error('  - Ensure E2E/integration tests use real services\n');

  process.exit(1);
}
