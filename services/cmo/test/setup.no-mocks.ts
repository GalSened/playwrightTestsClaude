/**
 * Vitest Mock API Blocker
 *
 * Disables all mocking APIs when NO_MOCKS=1 is set.
 * Throws runtime errors on any attempt to use vi.mock, vi.spyOn, etc.
 *
 * Usage: Add to vitest.config.ts setupFiles when NO_MOCKS=1
 */

import './_no_mocks_guard';

declare const vi: any;

// Guard Vitest/Jest mocking APIs
if (process.env.NO_MOCKS === '1' && typeof vi !== 'undefined') {
  const thrower = (name: string) => {
    return () => {
      throw new Error(
        `❌ NO_MOCKS=1: ${name} is disabled in real-only tests.\n` +
        `E2E and integration tests must use real implementations.\n` +
        `Remove ${name} calls or run without NO_MOCKS=1.`
      );
    };
  };

  // Block all Vitest mocking APIs
  vi.mock = thrower('vi.mock');
  vi.unmock = thrower('vi.unmock');
  vi.doMock = thrower('vi.doMock');
  vi.doUnmock = thrower('vi.doUnmock');
  vi.spyOn = thrower('vi.spyOn');
  vi.fn = thrower('vi.fn');
  vi.mocked = thrower('vi.mocked');
  vi.isMockFunction = thrower('vi.isMockFunction');

  console.log('🚫 NO_MOCKS=1: All Vitest mocking APIs disabled');
}

// Also check for Jest (if accidentally imported)
declare const jest: any;

if (process.env.NO_MOCKS === '1' && typeof jest !== 'undefined') {
  const thrower = (name: string) => {
    return () => {
      throw new Error(
        `❌ NO_MOCKS=1: ${name} is disabled.\n` +
        `Use Vitest instead of Jest, and avoid all mocking in real-only tests.`
      );
    };
  };

  jest.mock = thrower('jest.mock');
  jest.unmock = thrower('jest.unmock');
  jest.doMock = thrower('jest.doMock');
  jest.spyOn = thrower('jest.spyOn');
  jest.fn = thrower('jest.fn');

  console.log('🚫 NO_MOCKS=1: Jest mocking APIs disabled (use Vitest)');
}
