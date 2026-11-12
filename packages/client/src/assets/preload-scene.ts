import Phaser from 'phaser';
import { ASSET_BASE, animKey, manifest } from './manifest';
import { imagePlaceholder, sheetPlaceholder } from './placeholders';

/**
 * Loads everything in the manifest behind a progress bar, replaces any file that failed to load
 * with a generated placeholder (audio is simply left out), registers the sheet animations, then
 * starts the play scene. The game therefore runs with any subset of the assets present.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('preload');
  }

  preload(): void {
    const bar = this.add.graphics();
    this.load.on('progress', (p: number) => {
      bar.clear().fillStyle(0x333333).fillRect(220, 170, 200, 12);
      bar.fillStyle(0xffd23f).fillRect(220, 170, 200 * p, 12);
    });
    // A missing file is expected; never let it stop the game.
    this.load.on('loaderror', () => undefined);

    this.load.setBaseURL(ASSET_BASE);
    for (const i of manifest.images) this.load.image(i.key, i.file);
    for (const s of manifest.sheets)
      this.load.spritesheet(s.key, s.file, { frameWidth: s.frameWidth, frameHeight: s.frameHeight });
    for (const a of manifest.audio) this.load.audio(a.key, a.file);
  }

  create(): void {
    const tex = this.textures;
    for (const i of manifest.images)
      if (!tex.exists(i.key)) tex.addCanvas(i.key, imagePlaceholder(i));
    for (const s of manifest.sheets) {
      if (!tex.exists(s.key))
        tex.addSpriteSheet(s.key, sheetPlaceholder(s) as unknown as HTMLImageElement, {
          frameWidth: s.frameWidth,
          frameHeight: s.frameHeight,
        });
      for (const a of s.animations)
        this.anims.create({
          key: animKey(s.key, a.name),
          frames: this.anims.generateFrameNumbers(s.key, { start: a.start, end: a.end }),
          frameRate: a.fps,
          repeat: a.loop ? -1 : 0,
        });
    }
    this.scene.start('play');
  }
}
