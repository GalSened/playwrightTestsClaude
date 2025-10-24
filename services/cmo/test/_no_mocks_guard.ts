/**
 * No-Mocks Guard - Runtime Kill Switch
 *
 * Enforces NO_MOCKS=1 policy in E2E/integration tests.
 * Crashes if mock/fake/stub/inproc modules are detected.
 *
 * Usage: Import at top of test files:
 *   import '../_no_mocks_guard';
 */

if (process.env.NO_MOCKS === '1') {
  const disallow = [
    // Filenames or folder names we forbid in our codebase
    /(^|\/)(mock|mocks|fake|fakes|stub|stubs|double|doubles)(\/|\.|$)/i,
    /(^|\/)__mocks__(\/|$)/i,
    // Our known in-proc adapters (must not be used when NO_MOCKS=1)
    /(^|\/)InprocBus(\.ts|\.js)?$/i,
    // Test doubles patterns
    /_mock\./i,
    /\.mock\./i,
    /mock_/i,
    /fake_/i,
    /stub_/i,
  ];

  // Check loaded modules in require cache
  const loadedModules = Object.keys(require.cache || {});

  for (const modulePath of loadedModules) {
    // Only check files under our repo, ignore node_modules/ and toolchains
    if (modulePath.includes('node_modules')) continue;
    if (modulePath.includes('.git')) continue;
    if (modulePath.includes('dist')) continue;

    for (const pattern of disallow) {
      if (pattern.test(modulePath)) {
        throw new Error(
          `❌ NO_MOCKS=1 violation: "${modulePath}" loaded in this process.\n` +
          `E2E/integration tests must use real components only.\n` +
          `Remove mock/fake/stub imports or run without NO_MOCKS=1.`
        );
      }
    }
  }

  // Check current call stack for forbidden imports
  const stack = new Error().stack ?? '';
  const currentStack = stack.split('\n');
  for (const line of currentStack) {
    for (const pattern of disallow) {
      if (pattern.test(line) && !line.includes('node_modules')) {
        console.warn(
          `⚠️  NO_MOCKS=1: Potential forbidden import detected in stack:\n${line}`
        );
      }
    }
  }

  console.log('🛡️  NO_MOCKS=1 guard active - mocks/fakes/stubs/inproc forbidden');
}

/**
 * Explicit guard function for context-specific checks
 *
 * @param context - Description of where check is being performed
 */
export function ensureNoMocks(context: string): void {
  if (process.env.NO_MOCKS === '1') {
    const forbidden = [/mock/i, /fake/i, /stub/i, /inproc/i, /double/i];
    const stack = new Error().stack ?? '';

    for (const pattern of forbidden) {
      if (pattern.test(stack) && !stack.includes('node_modules')) {
        throw new Error(
          `❌ NO_MOCKS=1 violation in ${context}:\n` +
          `Forbidden pattern detected in call stack.\n` +
          `Stack: ${stack}`
        );
      }
    }
  }
}

/**
 * Validate required environment for real-only runs
 *
 * @param required - Array of required env var names
 */
export function assertRealReady(required: string[] = []): void {
  if (process.env.NO_MOCKS === '1') {
    const defaultRequired = ['TARGET_BASE_URL'];
    const allRequired = [...defaultRequired, ...required];
    const missing = allRequired.filter((k) => !process.env[k]);

    if (missing.length > 0) {
      throw new Error(
        `❌ NO_MOCKS=1: Missing required environment variables:\n` +
        `  ${missing.join(', ')}\n` +
        `Real-only tests require all endpoints/secrets to be configured.`
      );
    }
  }
}
