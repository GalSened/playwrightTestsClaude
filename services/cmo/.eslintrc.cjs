/**
 * ESLint Configuration with NO_MOCKS Enforcement
 *
 * Static guard: blocks any import or file path that hints at mocks/fakes/stubs
 */

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  env: {
    node: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  rules: {
    // Disable any-types in tests (forces proper typing)
    '@typescript-eslint/no-explicit-any': 'warn',

    // Ban Jest (we use Vitest)
    'no-restricted-globals': [
      'error',
      {
        name: 'jest',
        message: 'Use Vitest instead of Jest. jest.mock is banned.',
      },
    ],

    // Ban mock imports globally
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['**/mocks/*', '**/__mocks__/*'],
            message: 'Mock imports are forbidden. Use real implementations.',
          },
          {
            group: ['**/fakes/*', '**/stubs/*', '**/doubles/*'],
            message: 'Test doubles are forbidden. Use real implementations.',
          },
          {
            group: ['**/InprocBus*'],
            message: 'InprocBus is forbidden in real-only tests. Use Redis Streams.',
          },
        ],
      },
    ],
  },
  overrides: [
    {
      // Stricter rules for E2E and integration tests
      files: [
        '**/test/e2e/**/*',
        '**/test/integration/**/*',
        '**/test/**/*.e2e.spec.ts',
        '**/test/**/*.integration.spec.ts',
      ],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['**/mocks/*', '**/__mocks__/*'],
                message: 'E2E/integration: Mock imports forbidden. Use real services.',
              },
              {
                group: ['**/fakes/*', '**/stubs/*', '**/doubles/*'],
                message: 'E2E/integration: Test doubles forbidden. Use real components.',
              },
              {
                group: ['**/InprocBus*', '**/inproc*'],
                message: 'E2E/integration: In-process transports forbidden. Use Redis/HTTP.',
              },
              {
                group: ['vitest', 'vi'],
                importNames: ['mock', 'doMock', 'unmock', 'doUnmock', 'spyOn'],
                message: 'E2E/integration: Vitest mocking APIs forbidden in real-only tests.',
              },
            ],
          },
        ],
      },
    },
    {
      // Allow test utilities in unit tests (but still block mocks)
      files: ['**/test/unit/**/*', '**/test/**/*.spec.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
};
