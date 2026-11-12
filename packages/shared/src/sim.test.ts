import { describe, expect, it } from 'vitest';
import {
  ARENA,
  clampToBounds,
  createBody,
  createCooldown,
  createRng,
  getMiniGame,
  integrate,
  isReady,
  knockback,
  nextFloat,
  nextInt,
  rankBy,
  remainingTicks,
  resolveAll,
  resolveCircles,
  runRound,
  sandbox,
  sanitizeInput,
  tryUse,
  type InputFn,
} from './index';

describe('sanitizeInput', () => {
  it('passes valid input through', () => {
    expect(sanitizeInput({ moveX: 0.5, moveY: -0.5, action: true })).toEqual({
      moveX: 0.5,
      moveY: -0.5,
      action: true,
    });
  });

  it('turns NaN, Infinity and non-numbers into 0', () => {
    expect(sanitizeInput({ moveX: NaN, moveY: Infinity, action: false })).toEqual({
      moveX: 0,
      moveY: 0,
      action: false,
    });
    expect(sanitizeInput({ moveX: '1', moveY: null })).toEqual({
      moveX: 0,
      moveY: 0,
      action: false,
    });
  });

  it('clamps out-of-range axes and normalises diagonals', () => {
    expect(sanitizeInput({ moveX: 5, moveY: 0 }).moveX).toBe(1);
    expect(sanitizeInput({ moveX: -99, moveY: 0 }).moveX).toBe(-1);
    const d = sanitizeInput({ moveX: 1, moveY: 1 });
    expect(Math.hypot(d.moveX, d.moveY)).toBeCloseTo(1);
  });

  it('accepts only literal true for action', () => {
    expect(sanitizeInput({ action: 1 }).action).toBe(false);
    expect(sanitizeInput({ action: 'true' }).action).toBe(false);
  });

  it('handles garbage', () => {
    for (const raw of [undefined, null, 42, 'x', []]) {
      expect(sanitizeInput(raw)).toEqual({ moveX: 0, moveY: 0, action: false });
    }
  });
});

describe('rng', () => {
  it('is reproducible per seed and stays in range', () => {
    const a = createRng(123);
    const b = createRng(123);
    const c = createRng(124);
    const sa = Array.from({ length: 100 }, () => nextFloat(a));
    const sb = Array.from({ length: 100 }, () => nextFloat(b));
    const sc = Array.from({ length: 100 }, () => nextFloat(c));
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
    expect(sa.every((v) => v >= 0 && v < 1)).toBe(true);
    const r = createRng(1);
    for (let i = 0; i < 200; i++) {
      const n = nextInt(r, 2, 4);
      expect(n >= 2 && n <= 4 && Number.isInteger(n)).toBe(true);
    }
  });
});

describe('arena', () => {
  it('clamps bodies inside the bounds and stops velocity into walls', () => {
    const b = createBody(-5, 400, 10);
    b.vx = -50;
    b.vy = 50;
    expect(clampToBounds(b)).toBe(true);
    expect(b).toEqual({ x: 10, y: ARENA.height - 10, r: 10, vx: 0, vy: 0 });
    const inside = createBody(100, 100, 10);
    expect(clampToBounds(inside)).toBe(false);
    expect(inside.x).toBe(100);
  });

  it('separates overlapping circles symmetrically', () => {
    const a = createBody(100, 100, 10);
    const b = createBody(110, 100, 10);
    expect(resolveCircles(a, b)).toBe(true);
    expect(a.x).toBeCloseTo(95);
    expect(b.x).toBeCloseTo(115);
    expect(resolveCircles(a, b)).toBe(false);
  });

  it('separates coincident circles deterministically', () => {
    const a = createBody(100, 100, 10);
    const b = createBody(100, 100, 10);
    resolveCircles(a, b);
    expect(a.x).toBe(90);
    expect(b.x).toBe(110);
  });

  it('resolveAll counts overlapping pairs', () => {
    const bodies = [createBody(0, 0, 10), createBody(5, 0, 10), createBody(200, 0, 10)];
    expect(resolveAll(bodies)).toBe(1);
  });

  it('knockback pushes away from the source and damps out', () => {
    const b = createBody(110, 100, 10);
    knockback(b, 100, 100, 300);
    expect(b.vx).toBeCloseTo(300);
    expect(b.vy).toBeCloseTo(0);
    integrate(b, 0.5);
    expect(b.x).toBeCloseTo(120);
    expect(b.vx).toBeCloseTo(150);
    for (let i = 0; i < 40; i++) integrate(b, 0.5);
    expect(b.vx).toBe(0);
  });
});

describe('cooldown', () => {
  it('blocks reuse until the duration passes', () => {
    const cd = createCooldown();
    expect(isReady(cd, 0)).toBe(true);
    expect(tryUse(cd, 10, 30)).toBe(true);
    expect(tryUse(cd, 11, 30)).toBe(false);
    expect(remainingTicks(cd, 25)).toBe(15);
    expect(tryUse(cd, 39, 30)).toBe(false);
    expect(tryUse(cd, 40, 30)).toBe(true);
    expect(cd.readyAt).toBe(70);
  });
});

describe('rankBy', () => {
  it('orders by score and groups ties', () => {
    const scores = [5, 9, 5, 1];
    expect(rankBy([0, 1, 2, 3], (s) => scores[s] as number)).toEqual([[1], [0, 2], [3]]);
  });

  it('treats Infinity as best for survival games', () => {
    const outAt = [Infinity, 100, 200, 100];
    expect(rankBy([0, 1, 2, 3], (s) => outAt[s] as number)).toEqual([[0], [2], [1, 3]]);
  });
});

describe('registry', () => {
  it('finds the sandbox by id and rejects unknown ids', () => {
    expect(getMiniGame('sandbox')).toBe(sandbox);
    expect(getMiniGame('nope')).toBeUndefined();
    expect(getMiniGame('toString')).toBeUndefined();
  });
});

/** Scripted inputs: deterministic pseudo-random wandering with presses, from its own seed. */
function scripted(seed: number): InputFn[] {
  return [0, 1, 2, 3].map((slot) => {
    const rng = createRng(seed * 10 + slot);
    return () => ({
      moveX: nextFloat(rng) * 2 - 1,
      moveY: nextFloat(rng) * 2 - 1,
      action: nextFloat(rng) < 0.1,
    });
  });
}

describe('runRound + sandbox', () => {
  it('completes a 10 s sandbox round with placements by slot order', () => {
    const result = runRound(sandbox, 42, scripted(1));
    expect(result.ticks).toBe(300);
    expect(result.placements).toEqual([[0], [1], [2], [3]]);
    expect(result.snapshot.timeLeft).toBe(0);
    for (const p of result.snapshot.players) {
      expect(p.x).toBeGreaterThanOrEqual(p.r);
      expect(p.x).toBeLessThanOrEqual(ARENA.width - p.r);
      expect(p.y).toBeGreaterThanOrEqual(p.r);
      expect(p.y).toBeLessThanOrEqual(ARENA.height - p.r);
    }
  });

  it('is deterministic: same seed and inputs give byte-identical snapshots', () => {
    const run = (seed: number) => {
      const frames: string[] = [];
      const r = runRound(sandbox, seed, scripted(7), {
        onSnapshot: (s) => frames.push(JSON.stringify(s)),
      });
      return { final: JSON.stringify(r.snapshot), frames };
    };
    const a = run(99);
    const b = run(99);
    expect(a.final).toBe(b.final);
    expect(a.frames).toEqual(b.frames);
    expect(run(100).final).not.toBe(a.final);
  });

  it('players move in response to input', () => {
    const right: InputFn = () => ({ moveX: 1, moveY: 0, action: false });
    const start = sandbox.snapshot(sandbox.init(5, [0]));
    const end = runRound(sandbox, 5, [right]).snapshot;
    expect(end.players[0]!.x).toBeGreaterThan(start.players[0]!.x);
  });

  it('snapshots do not alias state', () => {
    const state = sandbox.init(1, [0, 1, 2, 3]);
    const snap = sandbox.snapshot(state);
    snap.players[0]!.x = -1000;
    expect(state.players[0]!.body.x).not.toBe(-1000);
  });
});
