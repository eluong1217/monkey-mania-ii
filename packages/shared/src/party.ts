import { createRng, nextInt, type Rng } from './rng.js';
import type { Placements, Slot } from './minigame.js';
import { MAX_PLAYERS } from './constants.js';
import type { RoundScore } from './protocol/messages.js';

/** Rounds in a full match. */
export const MATCH_ROUNDS = 5;
/** Seconds of intro card and results card between and after rounds. */
export const INTRO_SECONDS = 3;
export const RESULTS_SECONDS = 4;
/** Party points by finishing position (1st..4th). */
export const PLACE_POINTS: readonly number[] = [3, 2, 1, 0];
/** The last round of a match is worth this many times the normal points. */
export const FINAL_ROUND_MULTIPLIER = 2;

// ---- Scoring ----

/** Points per slot for one round. Ties share the higher value; the final round is doubled. */
export function roundPoints(placements: Placements, isFinal: boolean): Map<Slot, number> {
  const out = new Map<Slot, number>();
  let position = 0;
  for (const group of placements) {
    const base = PLACE_POINTS[position] ?? 0;
    for (const slot of group) out.set(slot, isFinal ? base * FINAL_ROUND_MULTIPLIER : base);
    position += group.length;
  }
  return out;
}

/** Applies one round to the running totals (indexed by slot). Returns new totals and per-slot scores. */
export function scoreRound(
  totals: readonly number[],
  placements: Placements,
  isFinal: boolean,
): { totals: number[]; scores: RoundScore[] } {
  const points = roundPoints(placements, isFinal);
  const next = Array.from({ length: MAX_PLAYERS }, (_, slot) => totals[slot] ?? 0);
  const scores: RoundScore[] = [];
  for (let slot = 0; slot < MAX_PLAYERS; slot++) {
    const p = points.get(slot) ?? 0;
    next[slot] = (next[slot] ?? 0) + p;
    scores.push({ slot, points: p, total: next[slot] ?? 0 });
  }
  return { totals: next, scores };
}

/** Final standings from running totals: highest first, equal totals share a group. */
export function standings(totals: readonly number[], slots: readonly Slot[]): Placements {
  const sorted = [...slots].sort((a, b) => (totals[b] ?? 0) - (totals[a] ?? 0) || a - b);
  const groups: Placements = [];
  let last: number | undefined;
  for (const slot of sorted) {
    const t = totals[slot] ?? 0;
    const current = groups[groups.length - 1];
    if (current && t === last) current.push(slot);
    else groups.push([slot]);
    last = t;
  }
  return groups;
}

// ---- Picker ----

/** `sandbox` is only a placeholder: leave it out unless nothing else is registered. */
export function partyPool(ids: readonly string[]): string[] {
  const real = ids.filter((id) => id !== 'sandbox');
  return real.length > 0 ? real : [...ids];
}

function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = nextInt(rng, 0, i);
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

/**
 * Picks `count` mini-games from `pool`: random, seeded, and no repeat until every game has
 * been used. When the pool runs out it is reshuffled, never starting with the game just played.
 */
export function pickMiniGames(seed: number, pool: readonly string[], count: number): string[] {
  if (pool.length === 0) throw new Error('pickMiniGames: empty pool');
  const rng = createRng(seed);
  const out: string[] = [];
  let bag: string[] = [];
  while (out.length < count) {
    if (bag.length === 0) {
      bag = shuffled(pool, rng);
      const prev = out[out.length - 1];
      if (bag.length > 1 && bag[0] === prev) bag.push(bag.shift() as string);
    }
    out.push(bag.shift() as string);
  }
  return out;
}

/** Seed for round `index` (0-based) of a match. Round 0 uses the match seed itself. */
export function roundSeed(matchSeed: number, index: number): number {
  return (matchSeed + Math.imul(index, 0x9e3779b1)) >>> 0;
}

// ---- State machine ----

export type PartyPhase = 'LOBBY' | 'INTRO' | 'PLAYING' | 'RESULTS' | 'PODIUM';

/** Pure state of a match: LOBBY → INTRO → PLAYING → RESULTS → (INTRO … | PODIUM) → LOBBY. */
export interface PartyState {
  phase: PartyPhase;
  /** 1-based number of the current round (0 in the lobby). */
  round: number;
  totalRounds: number;
  /** Mini-game id per round, picked up front. */
  schedule: readonly string[];
  /** Party points by slot. */
  totals: readonly number[];
}

function expect(party: PartyState, phase: PartyPhase, action: string): void {
  if (party.phase !== phase) throw new Error(`Cannot ${action} in ${party.phase} (needs ${phase})`);
}

export function createParty(
  seed: number,
  pool: readonly string[],
  rounds = MATCH_ROUNDS,
): PartyState {
  return {
    phase: 'LOBBY',
    round: 0,
    totalRounds: rounds,
    schedule: pickMiniGames(seed, pool, rounds),
    totals: Array.from({ length: MAX_PLAYERS }, () => 0),
  };
}

/** The mini-game id of the current round. */
export function currentMiniGame(party: PartyState): string {
  return party.schedule[party.round - 1] ?? party.schedule[0] ?? '';
}

export function isFinalRound(party: PartyState): boolean {
  return party.round >= party.totalRounds;
}

/** LOBBY → INTRO (round 1). */
export function startParty(party: PartyState): PartyState {
  expect(party, 'LOBBY', 'start');
  return { ...party, phase: 'INTRO', round: 1 };
}

/** INTRO → PLAYING. */
export function introDone(party: PartyState): PartyState {
  expect(party, 'INTRO', 'finish the intro');
  return { ...party, phase: 'PLAYING' };
}

/** PLAYING → RESULTS, adding the round's points. */
export function roundOver(
  party: PartyState,
  placements: Placements,
): { party: PartyState; scores: RoundScore[] } {
  expect(party, 'PLAYING', 'end the round');
  const { totals, scores } = scoreRound(party.totals, placements, isFinalRound(party));
  return { party: { ...party, phase: 'RESULTS', totals }, scores };
}

/** RESULTS → INTRO of the next round, or PODIUM after the last one. */
export function resultsDone(party: PartyState): PartyState {
  expect(party, 'RESULTS', 'finish the results');
  return isFinalRound(party)
    ? { ...party, phase: 'PODIUM' }
    : { ...party, phase: 'INTRO', round: party.round + 1 };
}

/** PODIUM → LOBBY with fresh totals; the caller supplies a new schedule via `createParty`. */
export function rematchParty(party: PartyState): PartyState {
  expect(party, 'PODIUM', 'rematch');
  return { ...party, phase: 'LOBBY', round: 0, totals: party.totals.map(() => 0) };
}
