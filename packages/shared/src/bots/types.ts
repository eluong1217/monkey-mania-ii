import type { PlayerInput } from '../input.js';
import type { BaseSnapshot, Slot } from '../minigame.js';
import type { Rng } from '../rng.js';

/**
 * A bot is a function from visible state to a PlayerInput. It sees only the snapshot, exactly
 * what a human could see. Use `rng` for any randomness (never Math.random). A bot may keep its
 * own state in a closure; the registry hands out a fresh bot per seat.
 */
export interface Bot {
  decide(snapshot: BaseSnapshot, mySlot: Slot, tick: number, rng: Rng): PlayerInput;
}

export type BotFactory = () => Bot;

export type DifficultyName = 'easy' | 'normal' | 'hard';

export interface Difficulty {
  /** The bot acts on a snapshot this many ticks old. */
  reactionTicks: number;
  /** Max random rotation (radians, +/-) applied to the move direction each tick. */
  steeringNoise: number;
  /** Per-tick chance of starting a hesitation (the bot freezes briefly). */
  hesitationChance: number;
  /** Length of a hesitation, in ticks. */
  hesitationTicks: number;
}
