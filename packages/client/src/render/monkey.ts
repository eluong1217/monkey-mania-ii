import type { PlayerView, Slot } from '@monkey-mania-2/shared';
import { monkeyKey } from '../assets/manifest';
import type { RenderScene } from './types';

/** Frame numbers in every monkey sheet; see the animations in assets/manifest.json. */
export const FRAME = { idle: 0, run: [1, 2], action: 3, stunned: 4, out: 5, win: 6 } as const;

export type Pose = 'idle' | 'run' | 'action' | 'stunned' | 'out' | 'win';

/** Hints a mini-game renderer can pass when it knows more than the position says. */
export interface MonkeyHints {
  stunned?: boolean;
  out?: boolean;
  win?: boolean;
  /** True on the snapshot where the action fires (shove, roll, throw); starts a squash. */
  acted?: boolean;
}

interface Motion {
  x: number;
  y: number;
  tick: number;
  facing: 1 | -1;
  /** performance-clock ms at which the last action squash began. */
  squashAt: number;
  moving: boolean;
  acting: boolean;
}

const RUN_FRAME_MS = 125;
const SQUASH_MS = 180;
const MOVE_EPSILON = 0.15;

/**
 * Code-driven motion for monkeys: idle bob, lean and bounce into movement, squash and stretch on
 * the action, wobble while stunned. Remembers each slot's last position to tell if it is moving
 * and which way it faces, so make one per renderer and call `draw` every frame for every player.
 */
export class MonkeyAnimator {
  private readonly motion = new Map<Slot, Motion>();

  constructor(private readonly now: () => number = () => performance.now()) {}

  draw(
    scene: RenderScene,
    p: PlayerView,
    tick: number,
    view: 'top' | 'side' = 'top',
    hints: MonkeyHints = {},
  ): void {
    const t = this.now();
    let m = this.motion.get(p.slot);
    // A new round restarts the tick counter; forget the old position so nothing slides in.
    if (!m || tick < m.tick) {
      m = { x: p.x, y: p.y, tick, facing: 1, squashAt: -Infinity, moving: false, acting: false };
      this.motion.set(p.slot, m);
    }
    const dx = p.x - m.x;
    const dy = p.y - m.y;
    if (tick !== m.tick) {
      m.moving = Math.hypot(dx, dy) > MOVE_EPSILON;
      if (Math.abs(dx) > MOVE_EPSILON) m.facing = dx > 0 ? 1 : -1;
      m.x = p.x;
      m.y = p.y;
      m.tick = tick;
    }
    if (hints.acted && !m.acting) m.squashAt = t; // squash once per action, not every frame
    m.acting = hints.acted === true;

    const pose: Pose = hints.out
      ? 'out'
      : hints.win
        ? 'win'
        : hints.stunned
          ? 'stunned'
          : t - m.squashAt < SQUASH_MS
            ? 'action'
            : m.moving
              ? 'run'
              : 'idle';
    const frame =
      pose === 'run'
        ? FRAME.run[Math.floor(t / RUN_FRAME_MS) % FRAME.run.length]!
        : pose === 'idle'
          ? FRAME.idle
          : pose === 'action'
            ? FRAME.action
            : FRAME[pose];

    let scaleX = 1;
    let scaleY = 1;
    let angle = 0;
    let lift = 0;
    const s = t / 1000;
    if (pose === 'idle') {
      scaleY = 1 + Math.sin(s * 3) * 0.03; // breathing bob
      scaleX = 2 - scaleY;
    } else if (pose === 'run') {
      lift = Math.abs(Math.sin(s * 14)) * 3; // hop with each step
      angle = 8 * m.facing; // lean into the move
    } else if (pose === 'action') {
      const k = (t - m.squashAt) / SQUASH_MS; // 0..1
      scaleX = 1 + 0.25 * (1 - k);
      scaleY = 1 - 0.25 * (1 - k);
    } else if (pose === 'stunned') {
      angle = Math.sin(s * 22) * 10;
    } else if (pose === 'win') {
      lift = Math.abs(Math.sin(s * 8)) * 6;
      scaleY = 1 + Math.sin(s * 16) * 0.05;
    }

    const size = 64;
    scene.sprite(monkeyKey(p.slot, view), frame, p.x, p.y + size / 2 - lift, {
      flipX: m.facing < 0,
      scaleX,
      scaleY,
      angle,
      originY: 1,
      depth: p.y,
      alpha: pose === 'out' ? 0.7 : 1,
    });
  }
}
