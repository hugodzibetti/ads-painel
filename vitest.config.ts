import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/server/db.ts', 'src/server/extraction.ts', 'src/server/prompts.ts', 'src/frontend/toolProvider.ts'],
    },
  },
});
