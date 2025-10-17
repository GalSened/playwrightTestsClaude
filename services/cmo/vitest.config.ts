import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // NO_MOCKS=1: Load mock API blocker setup
    setupFiles: process.env.NO_MOCKS === '1'
      ? ['./test/setup.no-mocks.ts']
      : [],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
        'src/**/types.ts',
        'src/**/*.d.ts'
      ]
    },
    include: ['test/**/*.spec.ts'],
    testTimeout: 30000,
    hookTimeout: 30000
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
