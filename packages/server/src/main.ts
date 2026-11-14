import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { configFromEnv } from './config.js';
import { e2eFast } from './e2e-fast.js';

const here = dirname(fileURLToPath(import.meta.url));
const clientDir = resolve(here, '../../client/dist');
const port = Number(process.env.PORT ?? 3000);

/** After SIGTERM, how long running matches get to finish before we exit anyway. */
const DRAIN_MS = Number(process.env.DRAIN_MS ?? 60_000);

const app = createApp(clientDir, {
  config: configFromEnv(process.env),
  ...(process.env.E2E_FAST === '1' ? { match: e2eFast() } : {}),
});
app.listen(port, () => {
  console.log(`Monkey Mania II server listening on http://localhost:${port}`);
});

let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal}: no new rooms; waiting up to ${DRAIN_MS / 1000}s for matches to finish`);
  app.drain();
  const deadline = Date.now() + DRAIN_MS;
  const timer = setInterval(() => {
    if (app.activeMatches() === 0 || Date.now() >= deadline) {
      clearInterval(timer);
      console.log('Shutting down.');
      app.close();
      app.closeAllConnections();
      process.exit(0);
    }
  }, 1000);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
