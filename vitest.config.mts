import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'server/tests/**/*.test.ts',
      'web/src/**/*.test.ts',
    ],
    pool: 'forks',
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
