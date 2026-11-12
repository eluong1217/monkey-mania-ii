import { ARENA } from '../arena.js';
import { nextRange } from '../rng.js';
import { distance, seek, toInput, type Vec } from './steering.js';
import type { Bot } from './types.js';

/** Fallback bot: walks to random points in the arena. Works for any mini-game. */
export function createWanderBot(): Bot {
  let target: Vec | undefined;
  let retargetAt = 0;
  return {
    decide(snapshot, mySlot, tick, rng) {
      const me = snapshot.players.find((p) => p.slot === mySlot);
      if (!me) return toInput({ x: 0, y: 0 });
      if (!target || tick >= retargetAt || distance(me, target) < me.r + 4) {
        target = {
          x: nextRange(rng, 40, ARENA.width - 40),
          y: nextRange(rng, 40, ARENA.height - 40),
        };
        retargetAt = tick + 90;
      }
      return toInput(seek(me, target));
    },
  };
}
