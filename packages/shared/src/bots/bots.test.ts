import { describe, expect, it } from 'vitest';
import { ARENA, createRng, getMiniGame, runRound, type BaseSnapshot } from '../index';
import {
  DIFFICULTIES,
  createBotFor,
  flee,
  keepAwayFromEdge,
  pickBotNames,
  pickNearest,
  seek,
  withDifficulty,
  type Bot,
} from './index';

const snap = (tick: number, x = 100): BaseSnapshot => ({
  tick,
  players: [{ slot: 0, x, y: 100, r: 10 }],
});
const calm = { steeringNoise: 0, hesitationChance: 0, hesitationTicks: 0 };

describe('withDifficulty', () => {
  it('acts on a snapshot reactionTicks old', () => {
    const seenTicks: number[] = [];
    const bot: Bot = {
      decide(s) {
        seenTicks.push(s.tick);
        return { moveX: 0, moveY: 0, action: false };
      },
    };
    const fn = withDifficulty(bot, { ...calm, reactionTicks: 5 }, 1);
    for (let t = 0; t < 10; t++) fn(snap(t), 0, t);
    expect(seenTicks).toEqual([0, 0, 0, 0, 0, 0, 1, 2, 3, 4]);
  });

  it('noise is seeded and bounded', () => {
    const bot: Bot = { decide: () => ({ moveX: 1, moveY: 0, action: false }) };
    const d = { reactionTicks: 0, steeringNoise: 0.5, hesitationChance: 0, hesitationTicks: 0 };
    const run = (seed: number) => {
      const fn = withDifficulty(bot, d, seed);
      return Array.from({ length: 20 }, (_, t) => fn(snap(t), 0, t));
    };
    expect(run(7)).toEqual(run(7));
    expect(run(7)).not.toEqual(run(8));
    for (const i of run(7)) expect(Math.abs(Math.atan2(i.moveY, i.moveX))).toBeLessThanOrEqual(0.5);
  });

  it('hesitation freezes the bot for the configured ticks', () => {
    const bot: Bot = { decide: () => ({ moveX: 1, moveY: 0, action: false }) };
    const fn = withDifficulty(
      bot,
      { reactionTicks: 0, steeringNoise: 0, hesitationChance: 1, hesitationTicks: 3 },
      1,
    );
    const out = Array.from({ length: 6 }, (_, t) => fn(snap(t), 0, t).moveX);
    expect(out).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('has easy slower than hard', () => {
    expect(DIFFICULTIES.easy.reactionTicks).toBeGreaterThan(DIFFICULTIES.hard.reactionTicks);
    expect(DIFFICULTIES.easy.steeringNoise).toBeGreaterThan(DIFFICULTIES.hard.steeringNoise);
  });
});

describe('wander bots in a sandbox round', () => {
  const play = (seed: number) => {
    const sandbox = getMiniGame('sandbox')!;
    const fns = [0, 1, 2, 3].map((slot) =>
      withDifficulty(createBotFor('sandbox'), DIFFICULTIES.normal, seed * 10 + slot),
    );
    return runRound(sandbox, seed, fns);
  };
  it('is deterministic for a seed', () => {
    expect(JSON.stringify(play(5))).toBe(JSON.stringify(play(5)));
  });
  it('actually moves', () => {
    const start = getMiniGame('sandbox')!.snapshot(getMiniGame('sandbox')!.init(5, [0, 1, 2, 3]));
    expect(JSON.stringify(play(5).snapshot.players)).not.toBe(JSON.stringify(start.players));
  });
});

describe('steering helpers', () => {
  it('seek and flee', () => {
    expect(seek({ x: 0, y: 0 }, { x: 10, y: 0 })).toEqual({ x: 1, y: 0 });
    expect(flee({ x: 0, y: 0 }, { x: 10, y: 0 })).toEqual({ x: -1, y: 0 });
    expect(seek({ x: 1, y: 1 }, { x: 1, y: 1 })).toEqual({ x: 0, y: 0 });
  });
  it('keepAwayFromEdge pushes inward only near edges', () => {
    expect(keepAwayFromEdge({ x: ARENA.width / 2, y: ARENA.height / 2 })).toEqual({ x: 0, y: 0 });
    expect(keepAwayFromEdge({ x: 5, y: ARENA.height / 2 }).x).toBeGreaterThan(0);
    expect(keepAwayFromEdge({ x: ARENA.width - 5, y: 5 }).x).toBeLessThan(0);
  });
  it('pickNearest', () => {
    expect(pickNearest({ x: 0, y: 0 }, [])).toBeUndefined();
    const a = { x: 50, y: 0 };
    const b = { x: 5, y: 5 };
    expect(pickNearest({ x: 0, y: 0 }, [a, b])).toBe(b);
  });
});

describe('names', () => {
  it('picks distinct names deterministically', () => {
    const a = pickBotNames(4, createRng(3));
    expect(new Set(a).size).toBe(4);
    expect(pickBotNames(4, createRng(3))).toEqual(a);
  });
});
