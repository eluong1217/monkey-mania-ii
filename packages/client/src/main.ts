import Phaser from 'phaser';
import { sanitizeInput } from '@monkey-mania-2/shared';
import { PreloadScene } from './assets/preload-scene';
import { LOGICAL_SIZE } from './config';
import { Connection, createBrowserSocket } from './connection';
import { mountDebugOverlay } from './debug-overlay';
import { Keyboard } from './input';
import { NetGame } from './net/net-game';
import { simNetworkFromQuery, withSimNetwork } from './net/sim-network';
import { PlayScene } from './play-scene';
import { Screens } from './screens';
import { isTouchDevice, TouchControls } from './touch';

// Dev-only bad network: /?lag=150&drop=0.05 (round-trip ms added, share of snapshots dropped).
const sim = import.meta.env.DEV ? simNetworkFromQuery(location.search) : null;
const conn = new Connection(() =>
  sim ? withSimNetwork(createBrowserSocket(), sim) : createBrowserSocket(),
);
const keyboard = new Keyboard();
keyboard.attach(window);
const touch = isTouchDevice() ? new TouchControls(document.body) : null;
// Browsers that allow it (Android Chrome) go fullscreen on the first touch, hiding the bars.
if (touch && document.fullscreenEnabled) {
  document.addEventListener(
    'pointerup',
    () => void document.documentElement.requestFullscreen().catch(() => undefined),
    { once: true },
  );
}
const net = new NetGame(conn, () => {
  if (!touch) return keyboard.sample();
  touch.active = net.inRound;
  const k = keyboard.sample();
  const t = touch.sample();
  return sanitizeInput({
    moveX: k.moveX + t.moveX,
    moveY: k.moveY + t.moveY,
    action: k.action || t.action,
  });
});
conn.on('roomState', () => {
  keyboard.capturing = net.inRound;
  if (!net.inRound) fit(); // catch up on any resize held back during the round
});

/** Text on the canvas is rendered once, so the menu font must be ready before the first frame. */
const fontReady = document.fonts
  ? document.fonts.load('16px "Lilita One"').catch(() => undefined)
  : Promise.resolve();

let game: Phaser.Game;
void fontReady.then(() => {
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: LOGICAL_SIZE.width,
    height: LOGICAL_SIZE.height,
    backgroundColor: '#1d7a4a',
    // The art is pre-rendered low-poly, not pixel art: keep smooth filtering.
    pixelArt: false,
    antialias: true,
    roundPixels: false,
    scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [new PreloadScene(), new PlayScene(net)],
  });
  fit();
});

let lastWidth = 0;
let landscape = innerWidth >= innerHeight;

/**
 * Scale the 640x360 canvas to the largest whole multiple that fits the window. Only a window
 * smaller than 1x scales fractionally, so the picture stays crisp everywhere else.
 */
function fit(): void {
  // A phone's on-screen keyboard shrinks the window; keep the layout while typing a name.
  if (document.activeElement instanceof HTMLInputElement && innerWidth === lastWidth) return;
  // The address bar sliding in and out changes only the height; re-fitting mid-round makes the
  // picture jump between sizes. Hold the size until the round ends or the phone is rotated.
  if (touch && net.inRound && innerWidth === lastWidth) return;
  lastWidth = innerWidth;
  const raw = Math.min(innerWidth / LOGICAL_SIZE.width, innerHeight / LOGICAL_SIZE.height);
  const zoom = raw >= 1 ? Math.floor(raw) : Math.max(0.25, raw);
  game?.scale.setZoom(zoom);
  document.documentElement.style.setProperty('--zoom', String(zoom));
}
fit();
addEventListener('resize', () => {
  fit();
  // Rotating mid-round cancels any finger that was down; the next touch starts fresh.
  if (landscape !== innerWidth >= innerHeight) {
    landscape = !landscape;
    touch?.reset();
    keyboard.release();
  }
});

/** A hidden tab or locked phone stops ticking: stop moving, and start clean on return. */
function pause(): void {
  touch?.reset();
  keyboard.release();
  net.sendNeutral();
}
document.addEventListener('visibilitychange', () => document.hidden && pause());
addEventListener('pagehide', pause);

const ui = document.getElementById('ui');
if (ui) new Screens(ui, conn);
mountDebugOverlay(net, sim);
