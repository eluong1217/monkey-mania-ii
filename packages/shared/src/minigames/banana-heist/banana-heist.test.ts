import { describe, expect, it } from 'vitest';
import { secondsToTicks } from '../../constants.js';
import { NEUTRAL_INPUT, type PlayerInput } from '../../input.js';
import { runRound } from '../../run-round.js';
import { DIFFICULTIES, withDifficulty } from '../../bots/difficulty.js';
import { createBotFor } from '../../bots/registry.js';
import { bananaHeist as game, stashPosition, tuning, type BananaHeistState } from './index.js';

const SLOTS = [0, 1, 2, 3];
const idle = (): PlayerInput[] => SLOTS.map(() => ({ ...NEUTRAL_INPUT }));
const fresh = (): BananaHeistState => {
  const s = game.init(1, SLOTS);
  s.nextSpawnAt = Infinity; // no random spawns in rule tests
  s.bananas = [];
  return s;
};
const place = (s: BananaHeistState, i: number, x: number, y: number) => {
  s.players[i]!.body.x = x;
  s.players[i]!.body.y = y;
};
/** Puts player i alone in the middle of the arena, away from stashes. */
const MID = [320, 180] as const;

describe('banana-heist rules', () => {
  it('picks up bananas to the carry cap and no further', () => {
    const s = fresh();
    place(s, 0, ...MID);
    for (let i = 0; i < 4; i++) s.bananas.push({ x: MID[0], y: MID[1] });
    game.step(s, idle(), 0);
    expect(s.players[0]!.carried).toBe(tuning.carryMax);
    expect(s.bananas).toHaveLength(1);
  });

  it('each carried banana slows movement by 15%', () => {
    const dist = (carried: number) => {
      const s = fresh();
      place(s, 0, ...MID);
      s.players[0]!.carried = carried;
      const go = idle();
      go[0] = { moveX: 1, moveY: 0, action: false };
      const x0 = s.players[0]!.body.x;
      game.step(s, go, 0);
      return s.players[0]!.body.x - x0;
    };
    const base = dist(0);
    expect(dist(1)).toBeCloseTo(base * (1 - tuning.carrySlow));
    expect(dist(3)).toBeCloseTo(base * (1 - 3 * tuning.carrySlow));
  });

  it('entering your own stash deposits everything carried', () => {
    const s = fresh();
    const [sx, sy] = stashPosition(0);
    place(s, 0, sx, sy);
    s.players[0]!.carried = 3;
    game.step(s, idle(), 0);
    expect(s.stash[0]).toBe(3);
    expect(s.players[0]!.carried).toBe(0);
  });

  it('stealing takes one banana after exactly 1 s on a rival stash', () => {
    const s = fresh();
    s.stash[1] = 2;
    const [sx, sy] = stashPosition(1);
    place(s, 0, sx, sy);
    const n = secondsToTicks(tuning.stealSeconds);
    for (let t = 0; t < n - 1; t++) game.step(s, idle(), t);
    expect(s.players[0]!.carried).toBe(0);
    game.step(s, idle(), n - 1);
    expect(s.players[0]!.carried).toBe(1);
    expect(s.stash[1]).toBe(1);
    // and it starts over for the next one
    for (let t = n; t < 2 * n; t++) game.step(s, idle(), t);
    expect(s.players[0]!.carried).toBe(2);
    expect(s.stash[1]).toBe(0);
  });

  it('leaving the stash cancels stealing progress', () => {
    const s = fresh();
    s.stash[1] = 2;
    const [sx, sy] = stashPosition(1);
    place(s, 0, sx, sy);
    const n = secondsToTicks(tuning.stealSeconds);
    for (let t = 0; t < n - 5; t++) game.step(s, idle(), t);
    place(s, 0, 320, 180);
    game.step(s, idle(), n - 5);
    place(s, 0, sx, sy);
    for (let t = n - 4; t < n + 4; t++) game.step(s, idle(), t);
    expect(s.players[0]!.carried).toBe(0);
  });

  it('cannot steal when full or from an empty stash', () => {
    const s = fresh();
    const [sx, sy] = stashPosition(1);
    place(s, 0, sx, sy);
    s.stash[1] = 0;
    for (let t = 0; t < 40; t++) game.step(s, idle(), t);
    expect(s.players[0]!.carried).toBe(0);
    s.stash[1] = 2;
    s.players[0]!.carried = tuning.carryMax;
    for (let t = 40; t < 80; t++) game.step(s, idle(), t);
    expect(s.stash[1]).toBe(2);
  });

  it('a hit cancels stealing, stuns for 1 s and scatters carried bananas', () => {
    const s = fresh();
    s.stash[1] = 3;
    const [sx, sy] = stashPosition(1);
    place(s, 0, sx, sy);
    s.players[0]!.carried = 2;
    place(s, 2, sx - 60, sy); // thrower to the left, facing right
    place(s, 1, 400, 300); // stash owner out of the line of fire
    place(s, 3, 600, 20);
    s.players[2]!.faceX = 1;
    s.players[2]!.faceY = 0;
    for (let t = 0; t < 10; t++) game.step(s, idle(), t);
    expect(s.players[0]!.stealTicks).toBeGreaterThan(0);
    const throwIn = idle();
    throwIn[2] = { moveX: 0, moveY: 0, action: true };
    let hitTick = -1;
    for (let t = 10; t < 40 && hitTick < 0; t++) {
      game.step(s, t === 10 ? throwIn : idle(), t);
      if (s.players[0]!.stunnedUntil > t) hitTick = t;
    }
    expect(hitTick).toBeGreaterThan(0);
    const victim = s.players[0]!;
    expect(victim.stunnedUntil).toBe(hitTick + secondsToTicks(tuning.stunSeconds));
    expect(victim.stealTicks).toBe(0);
    expect(victim.carried).toBe(0);
    expect(s.bananas).toHaveLength(2);
    expect(s.coconuts).toHaveLength(0);
    // stunned players cannot move
    const x = victim.body.x;
    const go = idle();
    go[0] = { moveX: -1, moveY: 0, action: false };
    game.step(s, go, hitTick + 1);
    expect(victim.body.x).toBe(x);
    // and can after the stun ends
    for (let t = hitTick + 2; t <= victim.stunnedUntil; t++) game.step(s, idle(), t);
    game.step(s, go, victim.stunnedUntil + 1);
    expect(victim.body.x).toBeLessThan(x);
  });

  it('a coconut does not hit its thrower and expires', () => {
    const s = fresh();
    place(s, 0, 320, 180);
    for (let i = 1; i < 4; i++) place(s, i, 20 + i * 5, 340);
    s.players[0]!.faceX = 1;
    s.players[0]!.faceY = 0;
    const th = idle();
    th[0] = { moveX: 0, moveY: 0, action: true };
    game.step(s, th, 0);
    expect(s.coconuts).toHaveLength(1);
    expect(s.players[0]!.stunnedUntil).toBe(0);
    for (let t = 1; t <= secondsToTicks(tuning.coconutLifeSeconds) + 1; t++)
      game.step(s, idle(), t);
    expect(s.coconuts).toHaveLength(0);
  });

  it('throw has a 1.5 s cooldown', () => {
    const s = fresh();
    place(s, 0, 100, 180);
    for (let i = 1; i < 4; i++) place(s, i, 20 + i * 5, 340);
    const th = idle();
    th[0] = { moveX: 0, moveY: 0, action: true };
    game.step(s, th, 0);
    game.step(s, th, 10);
    expect(s.coconuts).toHaveLength(1); // the second press was ignored
    const ready = secondsToTicks(tuning.throwCooldownSeconds);
    expect(s.players[0]!.throwCd.readyAt).toBe(ready);
    game.step(s, th, ready);
    expect(s.players[0]!.throwCd.readyAt).toBe(2 * ready);
    expect(
      s.coconuts.some((c) => c.expiresAt === ready + secondsToTicks(tuning.coconutLifeSeconds)),
    ).toBe(true);
  });

  it('scores the stash only: carried bananas do not count; ties share', () => {
    const s = fresh();
    s.stash = [2, 5, 2, 0];
    s.players[3]!.carried = 3;
    s.tick = secondsToTicks(tuning.roundSeconds) - 1;
    expect(game.isOver(s)).toBe(false);
    game.step(s, idle(), s.tick);
    expect(game.isOver(s)).toBe(true);
    expect(game.placements(s)).toEqual([[1], [0, 2], [3]]);
  });

  it('spawns bananas near the centre on a seeded timer, up to the ground cap', () => {
    const s = game.init(3, SLOTS);
    for (let t = 0; t < secondsToTicks(tuning.roundSeconds); t++) {
      s.players.forEach((p) => (p.stunnedUntil = Infinity)); // nobody picks anything up
      game.step(s, idle(), t);
    }
    expect(s.bananas.length).toBe(tuning.maxGroundSpawned);
    for (const b of s.bananas) {
      expect(Math.hypot(b.x - 320, b.y - 180)).toBeLessThanOrEqual(tuning.spawnSpread + 1);
    }
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

describe('banana-heist bots', () => {
  it('four normal bots finish 100 seeded rounds; no corner wins more than 40%', () => {
    const wins = [0, 0, 0, 0];
    let totalStash = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const fns = SLOTS.map((slot) =>
        withDifficulty(createBotFor(game.id), DIFFICULTIES.normal, seed * 10 + slot),
      );
      const result = runRound(game, seed, fns);
      expect(result.placements.flat().sort()).toEqual(SLOTS);
      const first = result.placements[0]!;
      for (const slot of first) wins[slot]! += 1 / first.length; // ties split the win
      totalStash += (result.snapshot as unknown as { stash: number[] }).stash.reduce(
        (a, b) => a + b,
        0,
      );
    }
    for (const w of wins) expect(w).toBeLessThanOrEqual(40);
    expect(totalStash / 100).toBeGreaterThan(4); // the bots actually play
  });
});
