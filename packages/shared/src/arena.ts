import { DT, LOGICAL_HEIGHT, LOGICAL_WIDTH } from './constants.js';

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The full 640x360 play area. */
export const ARENA: Readonly<Bounds> = Object.freeze({
  x: 0,
  y: 0,
  width: LOGICAL_WIDTH,
  height: LOGICAL_HEIGHT,
});

/** A circle body. Velocity is in pixels per second and is used for knockback and drift. */
export interface Body {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
}

export function createBody(x: number, y: number, r: number): Body {
  return { x, y, r, vx: 0, vy: 0 };
}

/**
 * Advances a body by one tick of its velocity, then multiplies velocity by `damping`
 * (0 = stop at once, 1 = keep sliding). Damping is per tick.
 */
export function integrate(body: Body, damping: number): void {
  body.x += body.vx * DT;
  body.y += body.vy * DT;
  body.vx *= damping;
  body.vy *= damping;
  if (Math.abs(body.vx) < 0.01) body.vx = 0;
  if (Math.abs(body.vy) < 0.01) body.vy = 0;
}

/**
 * Keeps the whole circle inside `bounds`. Velocity into a wall is zeroed.
 * Returns true if the body touched a wall.
 */
export function clampToBounds(body: Body, bounds: Readonly<Bounds> = ARENA): boolean {
  let hit = false;
  const minX = bounds.x + body.r;
  const maxX = bounds.x + bounds.width - body.r;
  const minY = bounds.y + body.r;
  const maxY = bounds.y + bounds.height - body.r;
  if (body.x < minX) {
    body.x = minX;
    if (body.vx < 0) body.vx = 0;
    hit = true;
  } else if (body.x > maxX) {
    body.x = maxX;
    if (body.vx > 0) body.vx = 0;
    hit = true;
  }
  if (body.y < minY) {
    body.y = minY;
    if (body.vy < 0) body.vy = 0;
    hit = true;
  } else if (body.y > maxY) {
    body.y = maxY;
    if (body.vy > 0) body.vy = 0;
    hit = true;
  }
  return hit;
}

export function circlesOverlap(
  a: { x: number; y: number; r: number },
  b: { x: number; y: number; r: number },
): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const rr = a.r + b.r;
  return dx * dx + dy * dy < rr * rr;
}

/**
 * Pushes two overlapping circles apart along the line between their centres, half each.
 * Coincident centres separate along the x axis (a left, b right) so the result is deterministic.
 * Returns true if they overlapped.
 */
export function resolveCircles(a: Body, b: Body): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const rr = a.r + b.r;
  const distSq = dx * dx + dy * dy;
  if (distSq >= rr * rr) return false;
  const dist = Math.sqrt(distSq);
  if (dist === 0) {
    const half = rr / 2;
    a.x -= half;
    b.x += half;
    return true;
  }
  const push = (rr - dist) / 2;
  const nx = dx / dist;
  const ny = dy / dist;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  return true;
}

/** Resolves every pair once, in array order. Returns the number of overlapping pairs. */
export function resolveAll(bodies: readonly Body[]): number {
  let count = 0;
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      if (resolveCircles(bodies[i] as Body, bodies[j] as Body)) count++;
    }
  }
  return count;
}

/**
 * Sets the body's velocity to `speed` (pixels per second) pointing away from (fromX, fromY).
 * If the point is the body's centre, it is pushed along +x. Pair with `integrate` and damping.
 */
export function knockback(body: Body, fromX: number, fromY: number, speed: number): void {
  const dx = body.x - fromX;
  const dy = body.y - fromY;
  const len = Math.hypot(dx, dy);
  if (len === 0) {
    body.vx = speed;
    body.vy = 0;
    return;
  }
  body.vx = (dx / len) * speed;
  body.vy = (dy / len) * speed;
}
