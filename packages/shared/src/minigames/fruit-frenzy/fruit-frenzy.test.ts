import { describe, expect, it } from 'vitest';
import { LOGICAL_WIDTH, secondsToTicks } from '../../constants.js';
import { NEUTRAL_INPUT, type PlayerInput } from '../../input.js';
import { runRound } from '../../run-round.js';
import { DIFFICULTIES, withDifficulty } from '../../bots/difficulty.js';
import { createBotFor } from '../../bots/registry.js';
import { fruitFrenzy as game, tuning, type FruitFrenzyState } from './index.js';

const SLOTS = [0, 1, 2, 3];
const idle = (): PlayerInput[] => SLOTS.map(() => ({ ...NEUTRAL_INPUT }));
const fresh = (): FruitFrenzyState => {
  const s = game.init(1, SLOTS);
  s.nextSpawnAt = Infinity; // no random spawns in rule tests
  return s;
};
const dropOn = (
  s: FruitFrenzyState,
  slot: number,
  kind: 'apple' | 'banana' | 'pineapple' | 'rotten',
) => {
  const p = s.players[slot]!;
  s.fruit.push({ kind, x: p.body.x, y: p.body.y - 5, r: 10, vx: 0, vy: 100 });
};

describe('fruit-frenzy rules', () => {
  it('scores apple 1, banana 2, pineapple 5 and removes the fruit', () => {
    const s = fresh();
    dropOn(s, 0, 'apple');
    dropOn(s, 1, 'banana');
    dropOn(s, 2, 'pineapple');
    game.step(s, idle(), 0);
    expect(game.snapshot(s).scores).toEqual([1, 2, 5, 0]);
    expect(s.fruit).toHaveLength(0);
  });

  it('rotten fruit costs 2 and stuns 0.5 s: no movement, no catching', () => {
    const s = fresh();
    dropOn(s, 0, 'rotten');
    game.step(s, idle(), 0);
    expect(s.players[0]!.score).toBe(-2);
    const x = s.players[0]!.body.x;
    const right = idle();
    right[0] = { moveX: 1, moveY: 0, action: false };
    game.step(s, right, 1);
    expect(s.players[0]!.body.x).toBe(x);
    dropOn(s, 0, 'banana');
    game.step(s, idle(), 2);
    expect(s.players[0]!.score).toBe(-2); // stunned: missed it
    s.fruit = [];
    const free = 1 + secondsToTicks(tuning.stunSeconds);
    game.step(s, right, free);
    expect(s.players[0]!.body.x).toBeGreaterThan(x);
  });

  it('shove dashes, bumps a rival sideways, and has a 2 s cooldown', () => {
    const s = fresh();
    s.players[0]!.body.x = 100;
    s.players[1]!.body.x = 130;
    const input = idle();
    input[0] = { moveX: 1, moveY: 0, action: true };
    game.step(s, input, 0);
    expect(s.players[1]!.body.vx).toBeGreaterThan(0);
    for (let t = 1; t < 10; t++) game.step(s, idle(), t);
    expect(s.players[1]!.body.x).toBeGreaterThan(150);
    // A second press before the cooldown ends does nothing.
    s.players[0]!.body.vx = 0;
    game.step(s, input, 20);
    expect(s.players[0]!.body.vx).toBe(0);
    expect(s.players[0]!.shove.readyAt).toBe(secondsToTicks(tuning.shoveCooldownSeconds));
    game.step(s, input, secondsToTicks(tuning.shoveCooldownSeconds));
    expect(s.players[0]!.shove.readyAt).toBe(2 * secondsToTicks(tuning.shoveCooldownSeconds));
  });

  it('ends at 40 s', () => {
    const s = fresh();
    const n = secondsToTicks(tuning.durationSeconds);
    for (let t = 0; t < n - 1; t++) game.step(s, idle(), t);
    expect(game.isOver(s)).toBe(false);
    game.step(s, idle(), n - 1);
    expect(game.isOver(s)).toBe(true);
    expect(game.snapshot(s).timeLeft).toBe(0);
  });

  it('ranks by score and groups ties', () => {
    const s = fresh();
    s.players[0]!.score = 3;
    s.players[1]!.score = 7;
    s.players[2]!.score = 3;
    s.players[3]!.score = -2;
    expect(game.placements(s)).toEqual([[1], [0, 2], [3]]);
    s.players.forEach((p) => (p.score = 0));
    expect(game.placements(s)).toEqual([[0, 1, 2, 3]]);
  });
});

describe('fruit-frenzy spawns', () => {
  it('covers the width, stays in bounds, and every fruit is reachable by fall time', () => {
    const s = game.init(9, SLOTS);
    const xs: number[] = [];
    let seen = 0;
    for (let t = 0; t < secondsToTicks(tuning.durationSeconds); t++) {
      const before = s.fruit.length;
      game.step(s, idle(), t);
      for (const f of s.fruit.slice(before)) {
        if (f.y < 0) xs.push(f.x);
        seen++;
        const fallTime = (tuning.groundY - f.y) / f.vy;
        expect(fallTime * tuning.moveSpeed).toBeGreaterThanOrEqual(LOGICAL_WIDTH / 2 - 20);
      }
      for (const f of s.fruit) {
        expect(f.x).toBeGreaterThanOrEqual(tuning.spawnMargin);
        expect(f.x).toBeLessThanOrEqual(LOGICAL_WIDTH - tuning.spawnMargin);
      }
    }
    expect(seen).toBeGreaterThan(40);
    const lane = (x: number) =>
      Math.floor(((x - tuning.spawnMargin) / (LOGICAL_WIDTH - 80)) * tuning.spawnLanes);
    expect(new Set(xs.map(lane)).size).toBe(tuning.spawnLanes);
  });

  it('speeds up over the round', () => {
    // Interval check straight from the schedule: later gaps are shorter.
    const gaps: number[] = [];
    const s2 = game.init(3, SLOTS);
    let last = s2.nextSpawnAt;
    for (let t = 0; t < secondsToTicks(tuning.durationSeconds); t++) {
      game.step(s2, idle(), t);
      if (s2.nextSpawnAt !== last) {
        gaps.push(s2.nextSpawnAt - last);
        last = s2.nextSpawnAt;
      }
    }
    expect(gaps.at(-1)!).toBeLessThan(gaps[0]! * 0.5);
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

describe('fruit-frenzy bots', () => {
  it('four normal bots finish 100 seeded rounds with a positive top score', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const fns = SLOTS.map((slot) =>
        withDifficulty(createBotFor(game.id), DIFFICULTIES.normal, seed * 10 + slot),
      );
      const result = runRound(game, seed, fns);
      const scores = (result.snapshot as ReturnType<typeof game.snapshot>).scores;
      expect(Math.max(...scores)).toBeGreaterThan(0);
      expect(result.placements.flat().sort()).toEqual(SLOTS);
    }
  });
});
