import { describe, expect, it } from 'vitest';
import { secondsToTicks } from '../../constants.js';
import { NEUTRAL_INPUT, type PlayerInput } from '../../input.js';
import { runRound } from '../../run-round.js';
import { DIFFICULTIES, withDifficulty } from '../../bots/difficulty.js';
import { createBotFor } from '../../bots/registry.js';
import {
  kingOfTheStump as game,
  platformRadius,
  PLATFORM_X,
  PLATFORM_Y,
  tuning,
  type KingOfTheStumpState,
} from './index.js';

const SLOTS = [0, 1, 2, 3];
const idle = (): PlayerInput[] => SLOTS.map(() => ({ ...NEUTRAL_INPUT }));
const fresh = (): KingOfTheStumpState => game.init(1, SLOTS);
/** Puts player `i` at an offset from the platform centre. */
const place = (s: KingOfTheStumpState, i: number, dx: number, dy: number) => {
  s.players[i]!.body.x = PLATFORM_X + dx;
  s.players[i]!.body.y = PLATFORM_Y + dy;
};
/** Parks everyone far apart near the centre so they do not interact. */
const spread = (s: KingOfTheStumpState) => {
  place(s, 0, -60, -60);
  place(s, 1, 60, -60);
  place(s, 2, -60, 60);
  place(s, 3, 60, 60);
};
const act = (slot: number, moveX = 0, moveY = 0): PlayerInput[] => {
  const i = idle();
  i[slot] = { moveX, moveY, action: true };
  return i;
};

describe('king-of-the-stump rules', () => {
  it('shrinks steadily from the start radius to the minimum and then stays', () => {
    expect(platformRadius(0)).toBe(tuning.platformStartRadius);
    const mid = platformRadius(secondsToTicks(tuning.shrinkSeconds) / 2);
    expect(mid).toBeCloseTo((tuning.platformStartRadius + tuning.platformMinRadius) / 2);
    expect(platformRadius(secondsToTicks(tuning.shrinkSeconds))).toBe(tuning.platformMinRadius);
    expect(platformRadius(secondsToTicks(tuning.capSeconds))).toBe(tuning.platformMinRadius);
    const s = fresh();
    spread(s);
    for (let t = 0; t < 30; t++) game.step(s, idle(), t);
    expect(s.platformR).toBeCloseTo(platformRadius(30));
    expect(s.platformR).toBeLessThan(tuning.platformStartRadius);
  });

  it('eliminates a monkey whose centre leaves the platform, and not before', () => {
    const s = fresh();
    spread(s);
    place(s, 0, tuning.platformStartRadius - 3, 0);
    game.step(s, idle(), 0);
    expect(s.players[0]!.alive).toBe(true);
    const go = idle();
    go[0] = { moveX: 1, moveY: 0, action: false };
    for (let t = 1; t < 5; t++) game.step(s, go, t);
    expect(s.players[0]!.alive).toBe(false);
    expect(s.players[0]!.outAt).toBeGreaterThan(0);
    expect(s.players.slice(1).every((p) => p.alive)).toBe(true);
  });

  it('eliminates a monkey caught outside by the shrinking edge', () => {
    const s = fresh();
    spread(s);
    place(s, 0, platformRadius(1) + 0.5, 0); // inside now, outside a tick later at the latest
    game.step(s, idle(), 0);
    let t = 1;
    while (s.players[0]!.alive && t < 60) game.step(s, idle(), t++);
    expect(s.players[0]!.alive).toBe(false);
  });

  it('shove knocks back a rival in front, with recoil, and ignores one behind', () => {
    const s = fresh();
    spread(s);
    place(s, 0, 0, 0);
    place(s, 1, 30, 0); // in front (facing +x)
    place(s, 2, 0, 30); // beside (outside the cone)
    const before = [1, 2].map((i) => s.players[i]!.body.x);
    game.step(s, act(0, 1, 0), 0);
    for (let t = 1; t < 10; t++) game.step(s, idle(), t);
    expect(s.players[1]!.body.x - before[0]!).toBeGreaterThan(30);
    expect(s.players[2]!.body.x).toBeCloseTo(before[1]!, 0);
    // recoil: the shover ends up behind where it started
    expect(s.players[0]!.body.x).toBeLessThan(PLATFORM_X);
  });

  it('shove has limited range and a 1.5 s cooldown', () => {
    const s = fresh();
    spread(s);
    place(s, 0, 0, 0);
    place(s, 1, tuning.shoveRange + 20, 0);
    game.step(s, act(0, 1, 0), 0);
    expect(s.players[1]!.body.vx).toBe(0);
    expect(s.players[0]!.shove.readyAt).toBe(secondsToTicks(tuning.shoveCooldownSeconds));
    const ready = s.players[0]!.shove.readyAt;
    game.step(s, act(0, 1, 0), 10); // still cooling down
    expect(s.players[0]!.shove.readyAt).toBe(ready);
    expect(s.players[0]!.shovedAt).toBe(0);
    game.step(s, act(0, 1, 0), ready);
    expect(s.players[0]!.shovedAt).toBe(ready);
  });

  it('a shove can push a monkey off the platform', () => {
    const s = fresh();
    spread(s);
    place(s, 0, tuning.platformStartRadius - 40, 0);
    place(s, 1, tuning.platformStartRadius - 12, 0);
    game.step(s, act(0, 1, 0), 0);
    for (let t = 1; t < 15; t++) game.step(s, idle(), t);
    expect(s.players[1]!.alive).toBe(false);
    expect(s.players[0]!.alive).toBe(true);
  });

  it('monkeys push each other on contact', () => {
    const s = fresh();
    spread(s);
    place(s, 0, -20, 0);
    place(s, 1, 0, 0);
    const go = idle();
    go[0] = { moveX: 1, moveY: 0, action: false };
    const start = s.players[1]!.body.x;
    for (let t = 0; t < 30; t++) game.step(s, go, t);
    expect(s.players[1]!.body.x).toBeGreaterThan(start + 10);
    const gap = s.players[1]!.body.x - s.players[0]!.body.x;
    expect(gap).toBeGreaterThanOrEqual(2 * tuning.playerRadius - 0.001);
  });

  it('placements are reverse elimination order and same-tick eliminations tie', () => {
    const s = fresh();
    spread(s);
    place(s, 2, tuning.platformStartRadius + 5, 0);
    place(s, 3, 0, tuning.platformStartRadius + 5);
    game.step(s, idle(), 0); // slots 2 and 3 out together
    place(s, 1, tuning.platformStartRadius + 5, 0);
    game.step(s, idle(), 1);
    expect(game.isOver(s)).toBe(true); // only slot 0 left
    expect(game.placements(s)).toEqual([[0], [1], [2, 3]]);
  });

  it('ends at the 45 s cap with survivors sharing first', () => {
    const s = fresh();
    place(s, 0, -26, 0);
    place(s, 1, 26, 0);
    place(s, 2, 0, -26);
    s.players[3]!.alive = false;
    s.players[3]!.outAt = 10;
    const n = secondsToTicks(tuning.capSeconds);
    for (let t = 0; t < n - 1; t++) game.step(s, idle(), t);
    expect(game.isOver(s)).toBe(false);
    game.step(s, idle(), n - 1);
    expect(game.isOver(s)).toBe(true);
    expect(game.placements(s)).toEqual([[0, 1, 2], [3]]);
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

describe('king-of-the-stump bots', () => {
  it('four normal bots finish 100 seeded rounds with a median length of 10-35 s', () => {
    const lengths: number[] = [];
    const wins = [0, 0, 0, 0];
    for (let seed = 1; seed <= 100; seed++) {
      const fns = SLOTS.map((slot) =>
        withDifficulty(createBotFor(game.id), DIFFICULTIES.normal, seed * 10 + slot),
      );
      const result = runRound(game, seed, fns);
      expect(result.placements.flat().sort()).toEqual(SLOTS);
      lengths.push(result.ticks / 30);
      const first = result.placements[0]!;
      for (const slot of first) wins[slot]! += 1 / first.length;
    }
    lengths.sort((a, b) => a - b);
    const median = (lengths[49]! + lengths[50]!) / 2;
    expect(median).toBeGreaterThanOrEqual(10);
    expect(median).toBeLessThanOrEqual(35);
    expect(Math.max(...wins)).toBeLessThan(45);
  });
});
