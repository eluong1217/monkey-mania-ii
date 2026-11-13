import { describe, expect, it } from 'vitest';
import { secondsToTicks } from '../../constants.js';
import { NEUTRAL_INPUT, type PlayerInput } from '../../input.js';
import { runRound } from '../../run-round.js';
import { DIFFICULTIES, withDifficulty } from '../../bots/difficulty.js';
import { createBotFor } from '../../bots/registry.js';
import { coconutDodge as game, tuning, type CoconutDodgeState } from './index.js';

const SLOTS = [0, 1, 2, 3];
const idle = (): PlayerInput[] => SLOTS.map(() => ({ ...NEUTRAL_INPUT }));
const fresh = (): CoconutDodgeState => {
  const s = game.init(1, SLOTS);
  s.nextSpawnAt = Infinity; // no random spawns in rule tests
  return s;
};
const dropAt = (s: CoconutDodgeState, x: number, y: number, landsAt: number) =>
  s.coconuts.push({ x, y, landsAt, warnedAt: 0 });

describe('coconut-dodge rules', () => {
  it('eliminates players inside the radius when a coconut lands, not before or outside', () => {
    const s = fresh();
    const p0 = s.players[0]!.body;
    const p1 = s.players[1]!.body;
    dropAt(s, p0.x + tuning.impactRadius - 1, p0.y, 5);
    dropAt(s, p1.x + tuning.impactRadius + 5, p1.y, 5);
    for (let t = 0; t < 5; t++) game.step(s, idle(), t);
    expect(s.players.every((p) => p.alive)).toBe(true);
    game.step(s, idle(), 5);
    expect(s.players.map((p) => p.alive)).toEqual([false, true, true, true]);
    expect(s.players[0]!.outAt).toBe(5);
  });

  it('roll is invulnerable for its window, then vulnerable again; 3 s cooldown', () => {
    const s = fresh();
    const roll = idle();
    roll[0] = { moveX: 1, moveY: 0, action: true };
    game.step(s, roll, 0);
    expect(s.players[0]!.invulnUntil).toBe(secondsToTicks(tuning.rollInvulnSeconds));
    const p = s.players[0]!.body;
    dropAt(s, p.x, p.y, 3);
    for (let t = 1; t <= 3; t++) game.step(s, idle(), t);
    expect(s.players[0]!.alive).toBe(true);
    const later = secondsToTicks(tuning.rollInvulnSeconds);
    dropAt(s, s.players[0]!.body.x, s.players[0]!.body.y, later);
    for (let t = 4; t <= later; t++) game.step(s, idle(), t);
    expect(s.players[0]!.alive).toBe(false);
    // cooldown
    const s2 = fresh();
    game.step(s2, roll, 0);
    const ready = s2.players[0]!.roll.readyAt;
    expect(ready).toBe(secondsToTicks(tuning.rollCooldownSeconds));
    game.step(s2, roll, 10);
    expect(s2.players[0]!.roll.readyAt).toBe(ready);
  });

  it('roll moves farther than walking for the same ticks', () => {
    const a = fresh();
    const b = fresh();
    const roll = idle();
    roll[0] = { moveX: 1, moveY: 0, action: true };
    const walk = idle();
    walk[0] = { moveX: 1, moveY: 0, action: false };
    for (let t = 0; t < 8; t++) {
      game.step(a, t === 0 ? roll : walk, t);
      game.step(b, walk, t);
    }
    expect(a.players[0]!.body.x).toBeGreaterThan(b.players[0]!.body.x + 20);
  });

  it('placements are reverse elimination order and same-tick eliminations tie', () => {
    const s = fresh();
    s.players[2]!.body.x = 300;
    s.players[2]!.body.y = 100;
    s.players[3]!.body.x = 310;
    s.players[3]!.body.y = 100;
    dropAt(s, 305, 100, 2); // slots 2 and 3 out together, first
    dropAt(s, s.players[1]!.body.x, s.players[1]!.body.y, 6); // slot 1 out later
    for (let t = 0; t < 7; t++) game.step(s, idle(), t);
    expect(game.isOver(s)).toBe(true); // only slot 0 left
    expect(game.placements(s)).toEqual([[0], [1], [2, 3]]);
  });

  it('ends at the 45 s cap with survivors sharing first', () => {
    const s = fresh();
    s.players[3]!.alive = false;
    s.players[3]!.outAt = 10;
    const n = secondsToTicks(tuning.capSeconds);
    for (let t = 0; t < n - 1; t++) game.step(s, idle(), t);
    expect(game.isOver(s)).toBe(false);
    game.step(s, idle(), n - 1);
    expect(game.isOver(s)).toBe(true);
    expect(game.placements(s)).toEqual([[0, 1, 2], [3]]);
  });

  it('everyone out on the same tick is a four-way tie', () => {
    const s = fresh();
    for (const p of s.players) dropAt(s, p.body.x, p.body.y, 0);
    game.step(s, idle(), 0);
    expect(game.isOver(s)).toBe(true);
    expect(game.placements(s)).toEqual([[0, 1, 2, 3]]);
  });

  it('escape is possible: a monkey at a coconut centre can walk out before it lands', () => {
    expect(tuning.warnSeconds * tuning.moveSpeed).toBeGreaterThanOrEqual(tuning.impactRadius * 1.5);
    for (const [x, y] of [
      [320, 180],
      [tuning.playerRadius, tuning.playerRadius], // worst case: a corner
    ] as const) {
      const s = fresh();
      s.players[0]!.body.x = x;
      s.players[0]!.body.y = y;
      dropAt(s, x, y, secondsToTicks(tuning.warnSeconds));
      const go = idle();
      go[0] = { moveX: x < 100 ? 1 : -1, moveY: y < 100 ? 1 : 0, action: false };
      for (let t = 0; t <= secondsToTicks(tuning.warnSeconds); t++) game.step(s, go, t);
      expect(s.players[0]!.alive).toBe(true);
    }
  });

  it('spawned shadows always warn for the full time and ramp up', () => {
    const s = game.init(5, SLOTS);
    const counts: number[] = [];
    for (let t = 0; t < secondsToTicks(tuning.capSeconds); t++) {
      const before = s.coconuts.length;
      game.step(s, idle(), t);
      for (const c of s.coconuts.filter((c) => c.warnedAt === t)) {
        expect(c.landsAt - c.warnedAt).toBe(secondsToTicks(tuning.warnSeconds));
      }
      counts.push(s.coconuts.length - before);
      s.players.forEach((p) => (p.alive = true)); // keep everyone alive for the ramp check
    }
    const half = counts.length / 2;
    const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
    expect(sum(counts.slice(half))).toBeGreaterThan(sum(counts.slice(0, half)));
  });

  it('is deterministic for a seed', () => {
    const play = () =>
      runRound(
        game,
        42,
        SLOTS.map((slot) => withDifficulty(createBotFor(game.id), DIFFICULTIES.normal, slot)),
      );
    expect(JSON.stringify(play())).toBe(JSON.stringify(play()));
  });
});

describe('coconut-dodge bots', () => {
  it('four normal bots finish 100 seeded rounds with a median length of 15-40 s', () => {
    const lengths: number[] = [];
    for (let seed = 1; seed <= 100; seed++) {
      const fns = SLOTS.map((slot) =>
        withDifficulty(createBotFor(game.id), DIFFICULTIES.normal, seed * 10 + slot),
      );
      const result = runRound(game, seed, fns);
      expect(result.placements.flat().sort()).toEqual(SLOTS);
      lengths.push(result.ticks / 30);
    }
    lengths.sort((a, b) => a - b);
    const median = (lengths[49]! + lengths[50]!) / 2;
    expect(median).toBeGreaterThanOrEqual(15);
    expect(median).toBeLessThanOrEqual(40);
    // 100 full rounds take several seconds; allow headroom when the suite runs in parallel.
  }, 30_000);
});
