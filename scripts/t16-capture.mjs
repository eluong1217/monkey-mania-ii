/* eslint-disable no-undef -- Node script; `window` and friends run inside the browser page */
// Plays one full match against bots in headless Chromium: screenshots each round and the podium,
// measures fps, and lists missing art files. Usage: node scripts/t16-capture.mjs http://localhost:3100
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:3000';
const out = 'tickets/T16-screenshots';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const missing = [];
const errors = [];
page.on('response', (r) => {
  if (r.url().includes('/assets/') && r.status() >= 400 && !/\.(mp3|ogg|wav)$/.test(r.url()))
    missing.push(r.url());
});
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(url);
await page.fill('#name', 'Tester');
await page.click('text=Create Room');
await page.click('button:has-text("Ready")');
await page.click('button:has-text("Start")');

await page.evaluate(() => {
  window.__frames = 0;
  const tick = () => ((window.__frames += 1), requestAnimationFrame(tick));
  requestAnimationFrame(tick);
});
const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'];
let held = null;
let lastFrames = 0;
const fps = [];
for (let t = 0; t < 420; t++) {
  await page.waitForTimeout(1000);
  const h1 = await page
    .locator('#ui h1')
    .first()
    .textContent({ timeout: 500 })
    .catch(() => null);
  if (h1 === 'Podium') break;
  if (h1 === 'Disconnected') {
    console.log('DISCONNECTED at t=' + t);
    break;
  }
  if (held) await page.keyboard.up(held);
  held = keys[Math.floor(Math.random() * keys.length)];
  await page.keyboard.down(held);
  const f = await page.evaluate(() => window.__frames);
  if (t > 2) fps.push(f - lastFrames);
  lastFrames = f;
  if (t % 6 === 4) await page.screenshot({ path: `${out}/shot-${String(t).padStart(3, '0')}.png` });
}
if (held) await page.keyboard.up(held);
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/podium.png` });
const sorted = [...fps].sort((a, b) => a - b);
console.log(
  JSON.stringify(
    {
      samples: fps.length,
      minFps: sorted[0],
      p5: sorted[Math.floor(sorted.length * 0.05)],
      median: sorted[Math.floor(sorted.length / 2)],
      missing: [...new Set(missing)],
      errors: [...new Set(errors)].slice(0, 10),
    },
    null,
    1,
  ),
);
await browser.close();
