import { describe, expect, it } from 'vitest';
import {
  createParty,
  currentMiniGame,
  introDone,
  partyPool,
  pickMiniGames,
  rematchParty,
  resultsDone,
  roundOver,
  roundPoints,
  roundSeed,
  scoreRound,
  standings,
  startParty,
} from './party.js';

const points = (p: Map<number, number>) => [0, 1, 2, 3].map((s) => p.get(s));

describe('scoring', () => {
  it('gives 3/2/1/0 by placement', () => {
    expect(points(roundPoints([[2], [0], [3], [1]], false))).toEqual([2, 0, 3, 1]);
  });

  it('ties share the higher value and the next place is skipped', () => {
    expect(points(roundPoints([[0, 1], [2], [3]], false))).toEqual([3, 3, 1, 0]);
    expect(points(roundPoints([[0], [1, 2], [3]], false))).toEqual([3, 2, 2, 0]);
    expect(points(roundPoints([[0], [1], [2, 3]], false))).toEqual([3, 2, 1, 1]);
    expect(points(roundPoints([[0, 1, 2, 3]], false))).toEqual([3, 3, 3, 3]);
  });

  it('doubles the final round', () => {
    expect(points(roundPoints([[0, 1], [2], [3]], true))).toEqual([6, 6, 2, 0]);
  });

  it('accumulates totals and reports per-round points', () => {
    const a = scoreRound([0, 0, 0, 0], [[1], [0], [2], [3]], false);
    expect(a.scores).toEqual([
      { slot: 0, points: 2, total: 2 },
      { slot: 1, points: 3, total: 3 },
      { slot: 2, points: 1, total: 1 },
      { slot: 3, points: 0, total: 0 },
    ]);
    const b = scoreRound(a.totals, [[3], [2], [1], [0]], true);
    expect(b.totals).toEqual([2, 5, 5, 6]);
  });

  it('ranks standings with ties', () => {
    expect(standings([5, 8, 5, 0], [0, 1, 2, 3])).toEqual([[1], [0, 2], [3]]);
    expect(standings([0, 0, 0, 0], [0, 1, 2, 3])).toEqual([[0, 1, 2, 3]]);
  });
});

describe('picker', () => {
  it('is seeded', () => {
    const pool = ['a', 'b', 'c', 'd'];
    expect(pickMiniGames(7, pool, 5)).toEqual(pickMiniGames(7, pool, 5));
    expect(pickMiniGames(7, pool, 5)).not.toEqual(pickMiniGames(8, pool, 5));
  });

  it('does not repeat until the pool is used up, nor at the reshuffle', () => {
    const pool = ['a', 'b', 'c', 'd'];
    for (let seed = 0; seed < 50; seed++) {
      const picks = pickMiniGames(seed, pool, 8);
      expect(new Set(picks.slice(0, 4)).size).toBe(4);
      expect(new Set(picks.slice(4)).size).toBe(4);
      expect(picks[4]).not.toBe(picks[3]);
    }
  });

  it('copes with a pool of one and rejects an empty pool', () => {
    expect(pickMiniGames(1, ['solo'], 3)).toEqual(['solo', 'solo', 'solo']);
    expect(() => pickMiniGames(1, [], 1)).toThrow();
  });

  it('leaves sandbox out unless it is all there is', () => {
    expect(partyPool(['sandbox', 'a', 'b'])).toEqual(['a', 'b']);
    expect(partyPool(['sandbox'])).toEqual(['sandbox']);
  });

  it('round 0 uses the match seed', () => {
    expect(roundSeed(123, 0)).toBe(123);
    expect(roundSeed(123, 1)).not.toBe(roundSeed(123, 2));
  });
});

describe('state machine', () => {
  it('walks a whole match and doubles only the last round', () => {
    let p = createParty(1, ['a', 'b'], 2);
    expect(p.phase).toBe('LOBBY');
    p = startParty(p);
    expect([p.phase, p.round]).toEqual(['INTRO', 1]);
    const first = currentMiniGame(p);
    p = introDone(p);
    expect(p.phase).toBe('PLAYING');
    let r = roundOver(p, [[0], [1], [2], [3]]);
    expect(r.party.phase).toBe('RESULTS');
    expect(r.scores.map((s) => s.points)).toEqual([3, 2, 1, 0]);
    p = resultsDone(r.party);
    expect([p.phase, p.round]).toEqual(['INTRO', 2]);
    expect(currentMiniGame(p)).not.toBe(first);
    r = roundOver(introDone(p), [[0], [1], [2], [3]]);
    expect(r.scores.map((s) => s.points)).toEqual([6, 4, 2, 0]);
    expect(r.party.totals).toEqual([9, 6, 3, 0]);
    p = resultsDone(r.party);
    expect(p.phase).toBe('PODIUM');
    p = rematchParty(p);
    expect([p.phase, p.round, ...p.totals]).toEqual(['LOBBY', 0, 0, 0, 0, 0]);
  });

  it('rejects every out-of-order transition', () => {
    const lobby = createParty(1, ['a']);
    const intro = startParty(lobby);
    const playing = introDone(intro);
    const results = roundOver(playing, [[0], [1], [2], [3]]).party;
    const podium = resultsDone({ ...results, round: results.totalRounds });
    expect(() => introDone(lobby)).toThrow();
    expect(() => roundOver(lobby, [])).toThrow();
    expect(() => resultsDone(lobby)).toThrow();
    expect(() => rematchParty(lobby)).toThrow();
    expect(() => startParty(intro)).toThrow();
    expect(() => introDone(playing)).toThrow();
    expect(() => resultsDone(intro)).toThrow();
    expect(() => roundOver(intro, [])).toThrow();
    expect(() => startParty(playing)).toThrow();
    expect(() => rematchParty(playing)).toThrow();
    expect(() => introDone(results)).toThrow();
    expect(() => roundOver(results, [])).toThrow();
    expect(() => rematchParty(results)).toThrow();
    expect(() => startParty(podium)).toThrow();
    expect(() => introDone(podium)).toThrow();
    expect(() => resultsDone(podium)).toThrow();
    expect(() => roundOver(podium, [])).toThrow();
  });
});
