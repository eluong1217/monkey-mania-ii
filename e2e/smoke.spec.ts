import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { startServer, type TestServer } from './server.js';

let server: TestServer;
test.beforeAll(async () => (server = await startServer()));
test.afterAll(async () => server.stop());
test.afterEach(() => expect(server.problems).toEqual([]));

/**
 * Audio files are not in the repo yet (A05), so decoding them fails. Drop this filter once the
 * sounds are in, so a real audio problem would show up here again.
 */
const KNOWN_NOISE = /decode audio|decoding audio|Failed to process file/;

/** Collects console errors and uncaught exceptions on a page. */
function watch(page: Page, name: string): string[] {
  const errors: string[] = [];
  page.on(
    'console',
    (m) =>
      m.type() === 'error' && !KNOWN_NOISE.test(m.text()) && errors.push(`${name}: ${m.text()}`),
  );
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  return errors;
}

/** Holds a random direction (and now and then taps Space) until the signal is aborted. */
async function mash(page: Page, signal: AbortSignal): Promise<void> {
  const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  let held: string | null = null;
  while (!signal.aborted) {
    if (held) await page.keyboard.up(held).catch(() => undefined);
    held = keys[Math.floor(Math.random() * keys.length)] ?? null;
    if (held) await page.keyboard.down(held).catch(() => undefined);
    if (Math.random() < 0.4) await page.keyboard.press('Space').catch(() => undefined);
    await page.waitForTimeout(150 + Math.random() * 250);
  }
  if (held) await page.keyboard.up(held).catch(() => undefined);
}

async function createRoom(page: Page, name: string): Promise<string> {
  await page.goto(server.url);
  await page.getByRole('button', { name: '▶ Play' }).click();
  await page.getByLabel('Your name').fill(name);
  await page.getByRole('button', { name: 'Create Room' }).click();
  const heading = await page.getByRole('heading', { name: /^Room [A-Z]{4}$/ }).innerText();
  return heading.slice('Room '.length);
}

/** Clicks Ready and waits until the server has shown the seat as ready. */
async function ready(page: Page): Promise<void> {
  const button = page.getByRole('button', { name: /ready/i });
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
}

async function joinByLink(page: Page, code: string, name: string): Promise<void> {
  await page.goto(`${server.url}/?room=${code}`);
  await page.getByLabel('Your name').fill(name);
  await page.getByRole('button', { name: 'Join Room' }).click();
  await expect(page.getByRole('heading', { name: `Room ${code}` })).toBeVisible();
}

async function newPage(context: BrowserContext, name: string) {
  const page = await context.newPage();
  return { page, errors: watch(page, name) };
}

test('two browsers and two bots play a whole match to the podium', async ({ browser }) => {
  const a = await newPage(await browser.newContext(), 'host');
  const b = await newPage(await browser.newContext(), 'guest');

  const code = await createRoom(a.page, 'Alice');
  await joinByLink(b.page, code, 'Bob');
  await expect(a.page.getByText('Bob')).toBeVisible();

  for (const { page } of [a, b]) await ready(page);
  await a.page.getByRole('button', { name: 'Start' }).click();

  const stop = new AbortController();
  const playing = [mash(a.page, stop.signal), mash(b.page, stop.signal)];
  const podium = (p: Page) => p.getByRole('heading', { name: 'Podium' });
  await expect(podium(a.page)).toBeVisible({ timeout: 60_000 });
  await expect(podium(b.page)).toBeVisible({ timeout: 10_000 });
  stop.abort();
  await Promise.all(playing);

  await expect(a.page.locator('ol.standings li')).toHaveCount(4);
  await expect(b.page.locator('ol.standings li')).toHaveCount(4);
  const rows = (p: Page) => p.locator('ol.standings li').allInnerTexts();
  const strip = (r: string[]) =>
    r.map((t) =>
      t
        .replace(/\s*\(you\)/, '')
        .replace(/\s+/g, ' ')
        .trim(),
    );
  const [ra, rb] = [strip(await rows(a.page)), strip(await rows(b.page))];
  expect(ra).toHaveLength(4);
  expect(ra).toEqual(rb);
  expect(ra.join(' ')).toMatch(/Alice/);
  expect(ra.join(' ')).toMatch(/Bob/);
  expect([...a.errors, ...b.errors]).toEqual([]);
});

test('a player who loses the connection mid-round rejoins their seat', async ({ browser }) => {
  const a = await newPage(await browser.newContext(), 'host');
  const b = await newPage(await browser.newContext(), 'guest');

  // Keep a handle on the guest's socket so the test can cut it.
  let cut: (() => void) | null = null;
  await b.page.routeWebSocket(/\/ws/, (route) => {
    const upstream = route.connectToServer();
    route.onMessage((m) => upstream.send(m));
    upstream.onMessage((m) => route.send(m));
    cut = () => void route.close({ code: 1006, reason: 'test cut' });
  });

  const code = await createRoom(a.page, 'Alice');
  await joinByLink(b.page, code, 'Bob');
  for (const { page } of [a, b]) await ready(page);
  await a.page.getByRole('button', { name: 'Start' }).click();

  // Wait for play to begin (intro cards are on the canvas, so use the server-driven screen change).
  await expect(b.page.getByRole('heading', { name: 'Room ' + code })).toBeHidden({
    timeout: 10_000,
  });
  expect(cut).not.toBeNull();
  (cut as unknown as () => void)();

  // The page reconnects by itself (a bot plays meanwhile) and carries on to the podium.
  const stop = new AbortController();
  const playing = [mash(a.page, stop.signal)];
  await expect(a.page.getByRole('heading', { name: 'Podium' })).toBeVisible({ timeout: 60_000 });
  await expect(b.page.getByRole('heading', { name: 'Podium' })).toBeVisible({ timeout: 20_000 });
  stop.abort();
  await Promise.all(playing);

  await expect(b.page.locator('ol.standings li')).toHaveCount(4);
  const names = await b.page.locator('ol.standings li').allInnerTexts();
  expect(names.join(' ')).toContain('Bob');
  expect(names.join(' ')).toContain('(you)');
  expect(a.errors).toEqual([]);
});
