/**
 * No-Mocks Guard
 *
 * Enforces NO_MOCKS=1 policy in E2E tests.
 * Throws if mock/fake/inproc modules are detected.
 */

if (process.env.NO_MOCKS === '1') {
  const forbidden = [/mock_/i, /fake/i, /inproc/i, /_mock\./i];
  const stack = new Error().stack ?? '';

  // Check loaded modules
  const loadedModules = Object.keys(require.cache || {});

  for (const modulePath of loadedModules) {
    for (const pattern of forbidden) {
      if (pattern.test(modulePath)) {
        throw new Error(
          `NO_MOCKS=1: Forbidden module detected in E2E path: ${modulePath}\n` +
          `Stack: ${stack}\n` +
          `E2E tests must use real components only.`
        );
      }
    }
  }

  // Check current file for forbidden imports (static analysis)
  const currentStack = stack.split('\n');
  for (const line of currentStack) {
    for (const pattern of forbidden) {
      if (pattern.test(line)) {
        console.warn(
          `⚠️  NO_MOCKS=1: Potential forbidden import detected in stack: ${line}`
        );
      }
    }
  }
}

// Export guard function for explicit checks
export function ensureNoMocks(context: string): void {
  if (process.env.NO_MOCKS === '1') {
    const forbidden = [/mock/i, /fake/i, /inproc/i];
    const stack = new Error().stack ?? '';

    for (const pattern of forbidden) {
      if (pattern.test(stack)) {
        throw new Error(
          `NO_MOCKS=1 violation in ${context}: Forbidden pattern detected in call stack\n${stack}`
        );
      }
    }
  }
}

// Log guard activation
if (process.env.NO_MOCKS === '1') {
  console.log('🛡️  NO_MOCKS=1 guard active - mocks/fakes/inproc modules are forbidden');
}
