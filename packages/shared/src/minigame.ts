import type { PlayerInput } from './input.js';

/** Seat index 0..3. */
export type Slot = number;

/** Ordered placement groups: `[[2], [0, 3], [1]]` means slot 2 won, 0 and 3 tied second. */
export type Placements = Slot[][];

/** One player as every snapshot must expose it. */
export interface PlayerView {
  slot: Slot;
  x: number;
  y: number;
  r: number;
}

/** A non-player circle (fruit, coconut, projectile...). */
export interface EntityView {
  kind: string;
  x: number;
  y: number;
  r: number;
}

/**
 * The shape every snapshot extends. `players` (and `entities`, if present) let the client's
 * fallback renderer and generic bots work on any mini-game. Add anything else you need.
 * Must be plain JSON: no class instances, Maps, undefined-valued keys, NaN or Infinity.
 */
export interface BaseSnapshot {
  tick: number;
  /** Seconds left in the round, if the round has a timer. */
  timeLeft?: number;
  players: PlayerView[];
  entities?: EntityView[];
}

export interface MiniGame<State, Snapshot extends BaseSnapshot = BaseSnapshot> {
  /** Kebab-case id, equal to the folder name under `src/minigames/`. */
  readonly id: string;
  readonly displayName: string;
  /** One short line for the intro card, e.g. "Move to catch fruit. Action: shove." */
  readonly controlsHint: string;
  readonly view: 'side' | 'top';
  /** Every balance number for this mini-game. Code reads numbers from here only. */
  readonly tuning: Readonly<Record<string, number>>;

  /** Fresh state. Create the RNG from `seed` and keep it in the state. */
  init(seed: number, playerSlots: readonly Slot[]): State;
  /**
   * Advances one tick. `inputs[slot]` is that slot's sanitised input this tick; `tick` counts
   * from 0. May mutate `state` and must return the next state. Deterministic: depends only on
   * its arguments and the RNG inside `state` (no Math.random, no clock).
   */
  step(state: State, inputs: readonly PlayerInput[], tick: number): State;
  isOver(state: State): boolean;
  /** Final (or current) ranking; every slot from `init` appears exactly once. */
  placements(state: State): Placements;
  /** What clients and bots see. Must not share mutable objects with `state`. */
  snapshot(state: State): Snapshot;
}

/** A mini-game of unknown state type, for registries and generic runners. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyMiniGame = MiniGame<any, BaseSnapshot>;

/**
 * Ranks slots by `score`, highest first; equal scores share a group. Group order is by score,
 * and within a group by the order of `slots`. For survival games, use the elimination tick as
 * the score (Infinity for still alive).
 */
export function rankBy(slots: readonly Slot[], score: (slot: Slot) => number): Placements {
  const scored = slots.map((slot, i) => ({ slot, i, s: score(slot) }));
  scored.sort((a, b) => b.s - a.s || a.i - b.i);
  const groups: Placements = [];
  let last: number | undefined;
  for (const { slot, s } of scored) {
    const current = groups[groups.length - 1];
    if (current && s === last) current.push(slot);
    else groups.push([slot]);
    last = s;
  }
  return groups;
}
