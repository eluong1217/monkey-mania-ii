import Phaser from 'phaser';
import { getMiniGame } from '@monkey-mania-2/shared';
import type { NetGame } from './net/net-game';
import { getRenderer, type RenderScene, type SpriteOpts } from './render';

/** Draws the current round each frame through the renderer registry. */
export class PlayScene extends Phaser.Scene implements RenderScene {
  private gfx!: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  private sprites: Phaser.GameObjects.Sprite[] = [];
  private usedSprites = 0;
  private used = 0;
  view: 'top' | 'side' = 'top';

  constructor(private readonly net: NetGame) {
    super('play');
  }

  get localSlot(): number | null {
    return this.net.slot;
  }

  create(): void {
    // Above the backdrop and platform (-1000, -1) but below every y-sorted sprite, so rings are
    // ground markers that monkeys stand on.
    this.gfx = this.add.graphics().setDepth(-0.5);
  }

  override update(): void {
    this.gfx.clear();
    this.used = 0;
    this.usedSprites = 0;
    const view = this.net.frame();
    const { phase, intro, miniGameId } = this.net;
    this.view = (miniGameId && getMiniGame(miniGameId)?.view) || 'top';
    this.drawBackground(phase, miniGameId, view?.players.find((p) => p.slot === this.net.slot)?.x);
    if (phase === 'INTRO' && intro) {
      this.text(320, 160, intro.displayName, { size: 24 });
      this.text(320, 196, intro.controlsHint);
    } else if (view && miniGameId && phase !== 'LOBBY' && phase !== null) {
      getRenderer(miniGameId)(view, this);
    }
    for (let i = this.used; i < this.labels.length; i++) this.labels[i]?.setVisible(false);
    for (let i = this.usedSprites; i < this.sprites.length; i++) this.sprites[i]?.setVisible(false);
  }

  /** Title before a room, lobby art around matches, and the mini-game's own backdrop in a round. */
  private drawBackground(phase: string | null, miniGameId: string | null, playerX?: number): void {
    const inRound = phase === 'INTRO' || phase === 'PLAYING' || phase === 'RESULTS';
    const key = !phase ? 'bg_title' : inRound && miniGameId ? `bg_${miniGameId}` : 'bg_lobby';
    if (!this.textures.exists(key)) return; // sandbox has no backdrop
    // Light parallax in side view only: the backdrop drifts against the player. It is drawn
    // slightly oversize so the drift never shows an edge.
    const side = this.view === 'side' && inRound;
    const drift = side && playerX !== undefined ? ((320 - playerX) / 320) * 8 : 0;
    this.sprite(key, 0, 320 + drift, 180, {
      depth: -1000,
      scaleX: side ? 1.04 : 1,
      scaleY: side ? 1.04 : 1,
    });
  }

  circle(x: number, y: number, r: number, fill: number, alpha = 1): void {
    this.gfx.fillStyle(fill, alpha).fillCircle(x, y, r);
  }

  sprite(key: string, frame: number, x: number, y: number, opts: SpriteOpts = {}): void {
    let s = this.sprites[this.usedSprites];
    if (!s) {
      s = this.add.sprite(0, 0, key);
      this.sprites.push(s);
    }
    this.usedSprites++;
    if (s.texture.key !== key) s.setTexture(key);
    // Single images only have the base frame; sheets have numbered ones.
    s.setFrame(s.texture.has(String(frame)) ? frame : '__BASE');
    s.setVisible(true)
      .setPosition(Math.round(x), Math.round(y))
      .setOrigin(0.5, opts.originY ?? 0.5)
      .setFlipX(opts.flipX ?? false)
      .setScale(opts.scaleX ?? 1, opts.scaleY ?? 1)
      .setAngle(opts.angle ?? 0)
      .setAlpha(opts.alpha ?? 1)
      .setDepth(opts.depth ?? y);
  }

  ring(x: number, y: number, r: number, color: number, width = 1): void {
    this.gfx.lineStyle(width, color, 1).strokeCircle(x, y, r);
  }

  text(x: number, y: number, text: string, opts: { color?: string; size?: number } = {}): void {
    let label = this.labels[this.used];
    if (!label) {
      label = this.add.text(0, 0, '', { fontFamily: 'monospace' }).setOrigin(0.5).setDepth(10000);
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
