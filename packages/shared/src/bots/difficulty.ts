import { NEUTRAL_INPUT, type PlayerInput } from '../input.js';
import type { BaseSnapshot, Slot } from '../minigame.js';
import type { InputFn } from '../run-round.js';
import { createRng, nextFloat, nextRange, type Rng } from '../rng.js';
import type { Bot, Difficulty, DifficultyName } from './types.js';

export const DIFFICULTIES: Readonly<Record<DifficultyName, Difficulty>> = {
  easy: { reactionTicks: 12, steeringNoise: 0.5, hesitationChance: 0.02, hesitationTicks: 10 },
  normal: { reactionTicks: 6, steeringNoise: 0.25, hesitationChance: 0.008, hesitationTicks: 6 },
  hard: { reactionTicks: 2, steeringNoise: 0.08, hesitationChance: 0.002, hesitationTicks: 3 },
};

/**
 * Wraps a bot with a difficulty: it decides from a snapshot `reactionTicks` old, rotates its
 * move direction by seeded noise, and occasionally freezes. Call once per tick, in order.
 * All randomness comes from `seed`, so a given seed always plays the same.
 */
export function withDifficulty(bot: Bot, difficulty: Difficulty, seed: number): InputFn {
  const rng: Rng = createRng(seed);
  const history: BaseSnapshot[] = [];
  let hesitating = 0;

  return (snapshot: BaseSnapshot, slot: Slot, tick: number): PlayerInput => {
    history.push(snapshot);
    if (history.length > difficulty.reactionTicks + 1) history.shift();
    const seen = history[0] as BaseSnapshot; // oldest kept = `reactionTicks` ago (or the first we have)

    const wanted = bot.decide(seen, slot, tick, rng);

    if (hesitating > 0) {
      hesitating--;
      return { ...NEUTRAL_INPUT };
    }
    if (nextFloat(rng) < difficulty.hesitationChance) {
      hesitating = difficulty.hesitationTicks - 1;
      return { ...NEUTRAL_INPUT };
    }

    const angle = nextRange(rng, -difficulty.steeringNoise, difficulty.steeringNoise);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      moveX: wanted.moveX * cos - wanted.moveY * sin,
      moveY: wanted.moveX * sin + wanted.moveY * cos,
      action: wanted.action,
    };
  };
}
