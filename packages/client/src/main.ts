import Phaser from 'phaser';
import { LOGICAL_SIZE } from './config';
import { Screens } from './screens';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: LOGICAL_SIZE.width,
  height: LOGICAL_SIZE.height,
  backgroundColor: '#1d7a4a',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.CENTER_BOTH },
});

/** Integer-scale the 640x360 canvas to the largest whole multiple that fits the window. */
function fit(): void {
  const zoom = Math.max(
    1,
    Math.floor(Math.min(innerWidth / LOGICAL_SIZE.width, innerHeight / LOGICAL_SIZE.height)),
  );
  game.scale.setZoom(zoom);
}
fit();
addEventListener('resize', fit);

const ui = document.getElementById('ui');
if (ui) new Screens(ui);
