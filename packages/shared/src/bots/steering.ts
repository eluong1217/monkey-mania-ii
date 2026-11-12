import { ARENA } from '../arena.js';
import type { PlayerInput } from '../input.js';

export interface Vec {
  x: number;
  y: number;
}

/** Unit vector pointing from `from` to `to`; zero if they coincide. */
export function seek(from: Vec, to: Vec): Vec {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  return len < 1e-6 ? { x: 0, y: 0 } : { x: dx / len, y: dy / len };
}

/** Unit vector pointing directly away from `threat`. */
export function flee(from: Vec, threat: Vec): Vec {
  const v = seek(from, threat);
  return { x: 0 - v.x, y: 0 - v.y };
}

/**
 * A push back toward the arena centre that grows from 0 to 1 over `margin` px as `pos` nears
 * an edge; zero in the middle. Add it to another steering vector.
 */
export function keepAwayFromEdge(pos: Vec, margin = 60): Vec {
  const ramp = (d: number) => Math.max(0, 1 - d / margin);
  return {
    x: ramp(pos.x) - ramp(ARENA.width - pos.x),
    y: ramp(pos.y) - ramp(ARENA.height - pos.y),
  };
}

/** The item closest to `from`, or undefined for an empty list. */
export function pickNearest<T extends Vec>(from: Vec, items: readonly T[]): T | undefined {
  let best: T | undefined;
  let bestD = Infinity;
  for (const item of items) {
    const d = (item.x - from.x) ** 2 + (item.y - from.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = item;
    }
  }
  return best;
}

export function distance(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Turns a steering vector into a PlayerInput (the input is sanitised later; length is capped). */
export function toInput(v: Vec, action = false): PlayerInput {
  const len = Math.hypot(v.x, v.y);
  const k = len > 1 ? 1 / len : 1;
  return { moveX: v.x * k, moveY: v.y * k, action };
}
