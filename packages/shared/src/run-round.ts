import { secondsToTicks } from './constants.js';
import { NEUTRAL_INPUT, sanitizeInput, type PlayerInput } from './input.js';
import type { AnyMiniGame, BaseSnapshot, Placements, Slot } from './minigame.js';

/** Produces one slot's input for a tick from the latest snapshot. Bots fit this shape. */
export type InputFn = (snapshot: BaseSnapshot, slot: Slot, tick: number) => PlayerInput;

export interface RoundResult {
  placements: Placements;
  snapshot: BaseSnapshot;
  ticks: number;
}

export interface RunRoundOptions {
  /** Safety stop. Default 5 minutes of ticks. */
  maxTicks?: number;
  /** Called with each snapshot after a step, e.g. to record a replay. */
  onSnapshot?: (snapshot: BaseSnapshot) => void;
}

/**
 * Runs a whole round headlessly. `inputFns[slot]` drives that slot; slots are 0..n-1.
 * A missing function means a neutral input. Each tick, every function sees the snapshot taken
 * before the step. Inputs are sanitised, exactly as the server does.
 */
export function runRound(
  miniGame: AnyMiniGame,
  seed: number,
  inputFns: readonly (InputFn | undefined)[],
  options: RunRoundOptions = {},
): RoundResult {
  const maxTicks = options.maxTicks ?? secondsToTicks(300);
  const slots = inputFns.map((_, i) => i);
  let state = miniGame.init(seed, slots);
  let tick = 0;
  while (!miniGame.isOver(state)) {
    if (tick >= maxTicks) throw new Error(`${miniGame.id} did not finish in ${maxTicks} ticks`);
    const snap = miniGame.snapshot(state);
    const inputs = slots.map((slot) => {
      const fn = inputFns[slot];
      return fn ? sanitizeInput(fn(snap, slot, tick)) : { ...NEUTRAL_INPUT };
    });
    state = miniGame.step(state, inputs, tick);
    tick++;
    options.onSnapshot?.(miniGame.snapshot(state));
  }
  return {
    placements: miniGame.placements(state),
    snapshot: miniGame.snapshot(state),
    ticks: tick,
  };
}
