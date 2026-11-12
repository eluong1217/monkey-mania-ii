import { clampToBounds, createBody, DT, type PlayerInput } from '@monkey-mania-2/shared';
import { TICK_MS } from './interpolation';

/** Fraction of the outstanding error removed each client tick (smooth correction). */
export const CORRECTION_RATE = 0.25;
/** An error larger than this (px) is snapped away at once instead of smoothed. */
export const SNAP_DISTANCE = 48;
/** Lag guess before the first measurement: ~150 ms of round trip at 30 Hz. */
export const DEFAULT_LAG_TICKS = 5;
const MAX_LAG_TICKS = 30;
/** Lag is measured from how far the server position moved over about this many ticks. */
const LAG_WINDOW = 10;
const HISTORY = MAX_LAG_TICKS + LAG_WINDOW + 2;
/** A displacement match closer than this (px) counts as a lag measurement... */
const MATCH_EPSILON = 1.5;
/** ...if every lag 2+ ticks away is worse by at least this much (px). */
const UNIQUE_MARGIN = 3;
const LAG_SMOOTHING = 0.3;

interface Point {
  x: number;
  y: number;
}

interface Sample extends Point {
  tick: number;
}

/**
 * Client-side prediction for the local player's movement, with reconciliation.
 *
 * The protocol has no input acks, so the predictor keeps its own recent positions and works out
 * how many ticks the server's view lags behind (`lag`): the lag at which its own past motion
 * matches how the server position moved. The server position is compared with the predicted
 * position from that many ticks ago; the difference is the prediction error. Small errors are
 * removed a fraction per tick, large ones are snapped. Every correction also shifts the history,
 * so the same error is never corrected twice.
 */
export class Predictor {
  x = 0;
  y = 0;
  /** Position before the last step, for drawing between ticks. */
  prevX = 0;
  prevY = 0;
  ready = false;
  /** Smoothed lag in ticks (fractional). */
  lag = DEFAULT_LAG_TICKS;
  /** Size (px) of the most recent measured error, for the debug overlay. */
  lastError = 0;
  private pending: Point = { x: 0, y: 0 };
  private history: Point[] = [];
  /** Recent server positions, for measuring the lag. */
  private samples: Sample[] = [];

  reset(x: number, y: number): void {
    this.x = this.prevX = x;
    this.y = this.prevY = y;
    this.pending = { x: 0, y: 0 };
    this.history = [{ x, y }];
    this.samples = [];
    this.lastError = 0;
    this.ready = true;
  }

  clear(): void {
    this.ready = false;
    this.history = [];
  }

  /** Round-trip estimate in ms (input sent → its effect seen in a snapshot). */
  get pingMs(): number {
    return this.lag * TICK_MS;
  }

  /** One client tick of movement: the shared arena's bounds with the mini-game's move speed. */
  step(input: PlayerInput, speed: number, radius: number): void {
    if (!this.ready) return;
    this.prevX = this.x;
    this.prevY = this.y;
    const dx = this.pending.x * CORRECTION_RATE;
    const dy = this.pending.y * CORRECTION_RATE;
    this.pending.x -= dx;
    this.pending.y -= dy;
    this.shift(dx, dy);
    const body = createBody(
      this.x + input.moveX * speed * DT,
      this.y + input.moveY * speed * DT,
      radius,
    );
    clampToBounds(body);
    this.x = body.x;
    this.y = body.y;
    this.history.push({ x: this.x, y: this.y });
    if (this.history.length > HISTORY) this.history.shift();
  }

  /** A snapshot for server tick `serverTick` says the local player is at (sx, sy). */
  reconcile(sx: number, sy: number, serverTick: number): void {
    if (!this.ready) return this.reset(sx, sy);
    this.measureLag(sx, sy, serverTick);
    const past = this.ago(Math.round(this.lag));
    const ex = sx - past.x;
    const ey = sy - past.y;
    this.lastError = Math.hypot(ex, ey);
    if (this.lastError > SNAP_DISTANCE) {
      this.shift(ex, ey);
      this.prevX = this.x;
      this.prevY = this.y;
      this.pending = { x: 0, y: 0 };
    } else {
      this.pending = { x: ex, y: ey };
    }
  }

  /** Predicted position `ticks` steps ago (the oldest kept if history is shorter). */
  private ago(ticks: number): Point {
    const h = this.history;
    return h[Math.max(0, h.length - 1 - ticks)] ?? { x: this.x, y: this.y };
  }

  private shift(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
    for (const p of this.history) {
      p.x += dx;
      p.y += dy;
    }
  }

  /**
   * Update `lag` when exactly one lag explains how the server position moved. Displacements are
   * compared, not positions, so a standing error (or a correction in progress) cannot bias it;
   * steady motion matches every lag equally and is skipped, so starts, stops and turns set it.
   */
  private measureLag(sx: number, sy: number, serverTick: number): void {
    const s = this.samples;
    s.push({ x: sx, y: sy, tick: serverTick });
    while (s.length > 1 && (s[0] as Sample).tick < serverTick - LAG_WINDOW) s.shift();
    const from = s[0] as Sample;
    const span = serverTick - from.tick;
    if (span < LAG_WINDOW / 2) return;
    const sdx = sx - from.x;
    const sdy = sy - from.y;
    const max = Math.min(MAX_LAG_TICKS, this.history.length - 1 - span);
    const errs: number[] = [];
    for (let l = 0; l <= max; l++) {
      const a = this.ago(l);
      const b = this.ago(l + span);
      errs.push(Math.hypot(sdx - (a.x - b.x), sdy - (a.y - b.y)));
    }
    let best = -1;
    for (let l = 0; l < errs.length; l++)
      if (best < 0 || (errs[l] as number) < (errs[best] as number)) best = l;
    if (best < 0 || (errs[best] as number) > MATCH_EPSILON) return;
    for (let l = 0; l < errs.length; l++) {
      if (Math.abs(l - best) >= 2 && (errs[l] as number) < MATCH_EPSILON + UNIQUE_MARGIN) return;
    }
    this.lag += (best - this.lag) * LAG_SMOOTHING;
  }
}
