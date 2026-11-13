import Phaser from 'phaser';
import { PreloadScene } from './assets/preload-scene';
import { LOGICAL_SIZE } from './config';
import { Connection, createBrowserSocket } from './connection';
import { mountDebugOverlay } from './debug-overlay';
import { Keyboard } from './input';
import { NetGame } from './net/net-game';
import { simNetworkFromQuery, withSimNetwork } from './net/sim-network';
import { PlayScene } from './play-scene';
import { Screens } from './screens';

// Dev-only bad network: /?lag=150&drop=0.05 (round-trip ms added, share of snapshots dropped).
const sim = import.meta.env.DEV ? simNetworkFromQuery(location.search) : null;
const conn = new Connection(() =>
  sim ? withSimNetwork(createBrowserSocket(), sim) : createBrowserSocket(),
);
const keyboard = new Keyboard();
keyboard.attach(window);
const net = new NetGame(conn, () => keyboard.sample());
conn.on('roomState', () => (keyboard.capturing = net.inRound));

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

/** Integer-scale the 640x360 canvas to the largest whole multiple that fits the window. */
function fit(): void {
  const zoom = Math.max(
    1,
    Math.floor(Math.min(innerWidth / LOGICAL_SIZE.width, innerHeight / LOGICAL_SIZE.height)),
  );
  game?.scale.setZoom(zoom);
}
addEventListener('resize', fit);

const ui = document.getElementById('ui');
if (ui) new Screens(ui, conn);
mountDebugOverlay(net, sim);
