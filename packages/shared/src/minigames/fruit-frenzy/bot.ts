import { toInput } from '../../bots/steering.js';
import type { Bot } from '../../bots/types.js';
import { FRUIT_VALUE, tuning, type FruitFrenzySnapshot } from './index.js';

const DANGER_X = 34; // stay this far (px) from a rotten fruit about to land on us
const DANGER_SECONDS = 0.9;
const SHOVE_REACH = 70;

/**
 * Goes for the fruit with the best value per second of travel that it can actually reach,
 * steps out from under rotten fruit, and shoves a rival that is about to beat it to a pineapple.
 */
export function createFruitFrenzyBot(): Bot {
  return {
    decide(snapshot, mySlot, tick) {
      const s = snapshot as FruitFrenzySnapshot;
      const me = s.players.find((p) => p.slot === mySlot);
      if (!me) return toInput({ x: 0, y: 0 });
      const catchY = tuning.groundY;
      const stunned = tick < (s.stunnedUntil[mySlot] ?? 0);
      if (stunned) return toInput({ x: 0, y: 0 });

      // Where each fruit will be when it reaches the catch line, and how long that takes.
      const fruit = s.entities.map((f) => {
        const t = Math.max(0, (catchY - f.y) / f.vy);
        return { f, t, x: f.x + f.vx * t, value: FRUIT_VALUE[f.kind] };
      });

      // Dodge rotten fruit that is about to land on us.
      for (const e of fruit) {
        if (e.value < 0 && e.t < DANGER_SECONDS && Math.abs(e.x - me.x) < DANGER_X) {
          return toInput({ x: e.x >= me.x ? -1 : 1, y: 0 });
        }
      }

      let best: (typeof fruit)[number] | undefined;
      let bestScore = 0;
      for (const e of fruit) {
        if (e.value <= 0) continue;
        const travel = Math.abs(e.x - me.x) / tuning.moveSpeed;
        if (travel > e.t + 0.05) continue; // cannot get there in time
        const score = e.value / (0.3 + Math.max(travel, 0.1));
        if (score > bestScore) {
          bestScore = score;
          best = e;
        }
      }

      const goal = best ? best.x : 320;
      const dx = goal - me.x;
      const move = Math.abs(dx) < 4 ? 0 : Math.sign(dx);

      // Shove a rival that is closer to the pineapple I am chasing.
      let action = false;
      if (best && best.f.kind === 'pineapple' && tick >= (s.shoveReadyAt[mySlot] ?? 0)) {
        for (const o of s.players) {
          if (o.slot === mySlot) continue;
          const ahead = Math.sign(o.x - me.x) === Math.sign(dx);
          if (
            ahead &&
            Math.abs(o.x - me.x) < SHOVE_REACH &&
            Math.abs(o.x - best.x) < Math.abs(me.x - best.x)
          ) {
            action = true;
          }
        }
      }
      return toInput({ x: move, y: 0 }, action);
    },
  };
}
