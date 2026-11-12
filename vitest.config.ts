import { defaultServerConditions } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Tests use @monkey-mania-2/shared from source, never a stale dist build.
  ssr: { resolve: { conditions: ['source', ...defaultServerConditions] } },
  test: { include: ['packages/*/src/**/*.test.ts'] },
});
