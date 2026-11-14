import Phaser from 'phaser';
import { getMiniGame, secondsToTicks, type BaseSnapshot } from '@monkey-mania-2/shared';
import { monkeyColor, monkeyKey } from './assets/manifest';
import { isTouchDevice } from './touch';
import type { NetGame } from './net/net-game';
import { getRenderer, type RenderScene, type SpriteOpts } from './render';

/** The smallest text drawn on the canvas, in logical pixels. */
const MIN_TEXT_PX = 8;

/** Control hints name the on-screen controls on phones and the keys elsewhere. */
const TOUCH = isTouchDevice();
const MOVE_HINT = TOUCH ? 'LEFT THUMB STICK' : 'WASD / ARROWS';
const ACTION_HINT = TOUCH ? 'GO! BUTTON' : 'SPACE';

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
      this.introCard(intro);
    } else if (view && miniGameId && (phase === 'PLAYING' || phase === 'RESULTS')) {
      getRenderer(miniGameId)(view, this);
      if (phase === 'PLAYING') this.hud(view, miniGameId);
    }
    if (phase === 'INTRO' || phase === 'PLAYING' || phase === 'RESULTS') this.scoreboard();
    for (let i = this.used; i < this.labels.length; i++) this.labels[i]?.setVisible(false);
    for (let i = this.usedSprites; i < this.sprites.length; i++) this.sprites[i]?.setVisible(false);
  }

  /** Intro card: title, which monkey is yours, and the action button with what it does. */
  private introCard(intro: NonNullable<NetGame['intro']>): void {
    const g = this.gfx;
    const action = /Action:\s*(.*?)\.?$/.exec(intro.controlsHint)?.[1] ?? 'action';
    const goal = intro.controlsHint.replace(/\s*Action:.*$/, '');
    this.text(320, 40, `Round ${intro.round} of ${intro.totalRounds}`, { size: 14 });
    this.text(320, 80, intro.displayName, { size: 30, color: '#ffd23f' });
    this.text(320, 116, goal, { size: 13 });
    this.text(320, 235, String(Math.max(1, this.net.introCountdown())), { size: 44 });
    const slot = this.net.slot;
    if (slot !== null) {
      // Left: your monkey, bobbing, labelled in words and with a pointer.
      const bob = Math.sin(this.time.now / 200) * 3;
      g.fillStyle(0x000000, 0.45).fillRoundedRect(60, 140, 160, 150, 14);
      this.sprite(monkeyKey(slot, this.view), 0, 140, 215 + bob, { scaleX: 1.5, scaleY: 1.5 });
      this.text(140, 156, `YOU ARE P${slot + 1} (${monkeyColor(slot).toUpperCase()})`, {
        size: 11,
        color: '#ffd23f',
      });
      this.text(140, 276, 'This is your monkey', { size: 9 });
    }
    // Right: move keys and the action key.
    g.fillStyle(0x000000, 0.45).fillRoundedRect(420, 140, 160, 150, 14);
    this.text(500, 156, 'MOVE', { size: 11, color: '#ffd23f' });
    this.text(500, 176, MOVE_HINT, { size: 11 });
    this.text(500, 206, 'ACTION', { size: 11, color: '#ffd23f' });
    g.fillStyle(0xfff6dc).fillRoundedRect(450, 220, 100, 26, 6);
    g.lineStyle(3, 0x5a3b00).strokeRoundedRect(450, 220, 100, 26, 6);
    this.text(500, 233, ACTION_HINT, { size: TOUCH ? 11 : 14, color: '#2b1a00', stroke: false });
    this.text(500, 264, action.toUpperCase(), { size: 14 });
    if (intro.round === intro.totalRounds)
      this.text(320, 312, 'Final round: double points!', { size: 14, color: '#ffd23f' });
  }

  /** In-round HUD: timer, a score or alive/out status per player, and your action's cooldown. */
  private hud(view: BaseSnapshot, miniGameId: string): void {
    const snap = view as BaseSnapshot & Record<string, unknown>;
    const nums = (k: string): number[] | undefined =>
      Array.isArray(snap[k]) ? (snap[k] as number[]) : undefined;
    const scores = nums('scores') ?? nums('stash');
    const alive = Array.isArray(snap.alive) ? (snap.alive as boolean[]) : undefined;
    const cellX = [56, 176, 464, 584];
    view.players.forEach((p, i) => {
      const x = cellX[i] ?? 56;
      const out = alive?.[i] === false;
      const value = out ? 'OUT' : scores ? String(scores[i] ?? 0) : 'IN';
      this.sprite(`seat_badge_${monkeyColor(p.slot)}`, 0, x - 28, 22, {
        depth: 9000,
        scaleX: 0.7,
        scaleY: 0.7,
      });
      const you = p.slot === this.net.slot ? 'YOU: ' : '';
      this.text(x + 32, 22, `${you}${value}`, {
        size: 13,
        color: out ? '#ff9a8a' : '#ffffff',
      });
    });
    if (view.timeLeft !== undefined) {
      this.sprite('timer_icon', 0, 296, 20, { depth: 9000, scaleX: 0.5, scaleY: 0.5 });
      const t = Math.ceil(view.timeLeft);
      this.text(332, 20, String(t), { size: 22, color: t <= 5 ? '#ff9a8a' : '#ffffff' });
      this.text(320, 42, 'THIS ROUND', { size: 8 });
    }
    // Cooldown of the local action: any "<name>ReadyAt" array against its "...CooldownSeconds" tuning.
    const slot = this.net.slot;
    const mi = view.players.findIndex((p) => p.slot === slot);
    const readyKey = Object.keys(snap).find((k) => /ReadyAt$/.test(k) && Array.isArray(snap[k]));
    const tuning = getMiniGame(miniGameId)?.tuning ?? {};
    const cdKey = Object.keys(tuning).find((k) => /CooldownSeconds$/.test(k));
    if (mi < 0 || !readyKey || !cdKey || alive?.[mi] === false) return;
    const left = Math.max(0, ((snap[readyKey] as number[])[mi] ?? 0) - view.tick);
    const frac = 1 - Math.min(1, left / Math.max(1, secondsToTicks(tuning[cdKey]!)));
    const cx = 36;
    const cy = 316;
    this.sprite('cooldown_ring', 0, cx, cy, {
      depth: 9000,
      scaleX: 0.55,
      scaleY: 0.55,
      alpha: left ? 0.6 : 1,
    });
    this.gfx.lineStyle(5, left ? 0x9aa0a6 : 0xffd23f).beginPath();
    this.gfx.arc(cx, cy, 20, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, frac));
    this.gfx.strokePath();
    this.text(cx + 60, cy - 8, left ? `${(left / 30).toFixed(1)}s` : 'READY', {
      size: 12,
      color: left ? '#c9cdd2' : '#ffd23f',
    });
    this.text(cx + 60, cy + 8, ACTION_HINT, { size: 9 });
  }

  /** Compact party scores along the bottom edge, always visible during a round. */
  private scoreboard(): void {
    this.gfx.fillStyle(0x000000, 0.6).fillRect(0, 338, 640, 22);
    for (const seat of this.net.seats) {
      if (!seat) continue;
      const you = seat.slot === this.net.slot ? 'YOU ' : '';
      this.sprite(`seat_badge_${monkeyColor(seat.slot)}`, 0, 16 + seat.slot * 160, 349, {
        depth: 9000,
        scaleX: 0.4,
        scaleY: 0.4,
      });
      this.text(
        90 + seat.slot * 160,
        349,
        `${you}${seat.name.slice(0, 8)}: ${this.net.totals[seat.slot] ?? 0} pts`,
        { size: 11 },
      );
    }
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

  text(
    x: number,
    y: number,
    text: string,
    opts: { color?: string; size?: number; stroke?: boolean } = {},
  ): void {
    let label = this.labels[this.used];
    if (!label) {
      label = this.add
        .text(0, 0, '', { fontFamily: '"Lilita One", sans-serif' })
        .setOrigin(0.5)
        .setDepth(10000);
      this.labels.push(label);
    }
    this.used++;
    label.setVisible(true).setPosition(Math.round(x), Math.round(y));
    // Re-styling re-renders the text texture, so only touch it when something changed.
    const color = opts.color ?? '#ffffff';
    const size = Math.max(MIN_TEXT_PX, opts.size ?? 10);
    const stroke = opts.stroke !== false;
    const key = `${color}|${size}|${stroke}|${text}`;
    if (label.name !== key) {
      label
        .setName(key)
        .setText(text)
        .setColor(color)
        .setFontSize(size)
        .setStroke('#000000', stroke ? Math.max(2, Math.round(size / 5)) : 0);
    }
  }
}
