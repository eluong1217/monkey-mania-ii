import Phaser from 'phaser';
import type { NetGame } from './net/net-game';
import { getRenderer, type RenderScene } from './render';

/** Draws the current round each frame through the renderer registry. */
export class PlayScene extends Phaser.Scene implements RenderScene {
  private gfx!: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  private sprites: Phaser.GameObjects.Sprite[] = [];
  private usedSprites = 0;
  private used = 0;

  constructor(private readonly net: NetGame) {
    super('play');
  }

  get localSlot(): number | null {
    return this.net.slot;
  }

  create(): void {
    this.gfx = this.add.graphics();
  }

  override update(): void {
    this.gfx.clear();
    this.used = 0;
    this.usedSprites = 0;
    const view = this.net.frame();
    const { phase, intro, miniGameId } = this.net;
    if (phase === 'INTRO' && intro) {
      this.text(320, 160, intro.displayName, { size: 24 });
      this.text(320, 196, intro.controlsHint);
    } else if (view && miniGameId && phase !== 'LOBBY' && phase !== null) {
      getRenderer(miniGameId)(view, this);
    }
    for (let i = this.used; i < this.labels.length; i++) this.labels[i]?.setVisible(false);
    for (let i = this.usedSprites; i < this.sprites.length; i++) this.sprites[i]?.setVisible(false);
  }

  circle(x: number, y: number, r: number, fill: number, alpha = 1): void {
    this.gfx.fillStyle(fill, alpha).fillCircle(x, y, r);
  }

  sprite(key: string, frame: number, x: number, y: number): void {
    let s = this.sprites[this.usedSprites];
    if (!s) {
      s = this.add.sprite(0, 0, key);
      this.sprites.push(s);
    }
    this.usedSprites++;
    if (s.texture.key !== key) s.setTexture(key);
    s.setFrame(frame).setVisible(true).setPosition(Math.round(x), Math.round(y));
  }

  ring(x: number, y: number, r: number, color: number, width = 1): void {
    this.gfx.lineStyle(width, color, 1).strokeCircle(x, y, r);
  }

  text(x: number, y: number, text: string, opts: { color?: string; size?: number } = {}): void {
    let label = this.labels[this.used];
    if (!label) {
      label = this.add.text(0, 0, '', { fontFamily: 'monospace' }).setOrigin(0.5).setDepth(1);
      this.labels.push(label);
    }
    this.used++;
    label.setVisible(true).setPosition(Math.round(x), Math.round(y));
    // Re-styling re-renders the text texture, so only touch it when something changed.
    const color = opts.color ?? '#ffffff';
    const size = opts.size ?? 10;
    const key = `${color}|${size}|${text}`;
    if (label.name !== key) {
      label.setName(key).setText(text).setColor(color).setFontSize(size);
    }
  }
}
