import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, type App } from './app.js';

let app: App | undefined;
afterEach(() => {
  app?.close();
  app = undefined;
});

async function start(): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'mm2-'));
  mkdirSync(join(dir, 'assets/sprites'), { recursive: true });
  writeFileSync(join(dir, 'index.html'), '<html></html>');
  writeFileSync(join(dir, 'assets/index-C9aocqWp.js'), '//');
  writeFileSync(join(dir, 'assets/sprites/monkey.png'), 'x');
  app = createApp(dir);
  await new Promise<void>((r) => app!.listen(0, r));
  return `http://localhost:${(app.address() as AddressInfo).port}`;
}

describe('server', () => {
  it('creates an app', () => {
    app = createApp('/nonexistent');
    expect(app.listening).toBe(false);
  });

  it('answers /healthz', async () => {
    const res = await fetch(`${await start()}/healthz`);
    expect(res.status).toBe(200);
  });

  it('sets caching headers', async () => {
    const base = await start();
    const cc = async (p: string) => (await fetch(base + p)).headers.get('cache-control');
    expect(await cc('/')).toBe('no-cache');
    expect(await cc('/assets/index-C9aocqWp.js')).toContain('immutable');
    expect(await cc('/assets/sprites/monkey.png')).toBe('public, max-age=3600');
  });

  it('reports no active matches and drains', async () => {
    await start();
    expect(app!.activeMatches()).toBe(0);
    app!.drain();
  });
});
