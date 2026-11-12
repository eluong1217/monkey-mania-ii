import { defaultClientConditions, defineConfig } from 'vite';

export default defineConfig({
  // Use @monkey-mania-2/shared from source, so no shared build is needed for dev.
  resolve: { conditions: ['source', ...defaultClientConditions] },
  server: { proxy: { '/ws': { target: 'ws://localhost:3000', ws: true } } },
});
