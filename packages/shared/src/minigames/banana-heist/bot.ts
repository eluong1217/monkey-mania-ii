import { secondsToTicks } from '../../constants.js';
import { distance, seek, toInput, type Vec } from '../../bots/steering.js';
import type { Bot } from '../../bots/types.js';
import { stashPosition, tuning, type BananaHeistSnapshot } from './index.js';

const THROW_RANGE = 190;
const STICKY = 1.3; // the current goal keeps this score bonus, so the bot does not dither

type Goal = 'collect' | 'deposit' | 'steal';

/**
 * Utility bot: scores collecting the nearest banana, depositing, and stealing from the richest
 * rival stash, then walks toward the best. Independently, throws a coconut at a loaded rival
 * who is in range and in line with where it is facing.
 */
export function createBananaHeistBot(): Bot {
  let goal: Goal | undefined;
  return {
    decide(snapshot, mySlot, tick) {
      const s = snapshot as BananaHeistSnapshot;
      const idx = s.players.findIndex((p) => p.slot === mySlot);
      const me = s.players[idx];
      if (!me || tick < (s.stunnedUntil[idx] ?? 0)) return toInput({ x: 0, y: 0 });

      const carried = s.carried[idx] ?? 0;
      const home = stashPosition(mySlot);
      const homeV: Vec = { x: home[0], y: home[1] };
      const bananas = s.entities.filter((e) => e.kind === 'banana');

      let nearest: Vec | undefined;
      let nearestD = Infinity;
      for (const b of bananas) {
        const d = distance(me, b);
        if (d < nearestD) {
          nearestD = d;
          nearest = b;
        }
      }

      let rich: { v: Vec; count: number } | undefined;
      s.players.forEach((p, i) => {
        if (i === idx) return;
        const count = s.stash[i] ?? 0;
        if (count > 0 && (!rich || count > rich.count)) {
          const [x, y] = stashPosition(p.slot);
          rich = { v: { x, y }, count };
        }
      });

      const scores: [Goal, number, Vec][] = [];
      if (nearest && carried < tuning.carryMax)
        scores.push(['collect', (120 * (tuning.carryMax - carried)) / (nearestD + 40), nearest]);
      if (carried > 0)
        scores.push([
          'deposit',
          (110 * carried ** 1.5) / (distance(me, homeV) + 40) +
            (carried >= tuning.carryMax ? 1 : 0),
          homeV,
        ]);
      if (rich && carried < tuning.carryMax) {
        const r = rich as { v: Vec; count: number };
        scores.push(['steal', (70 * Math.min(r.count, 4)) / (distance(me, r.v) + 80), r.v]);
      }

      let best: { goal: Goal; score: number; to: Vec } | undefined;
      for (const [g, score, to] of scores) {
        const adjusted = g === goal ? score * STICKY : score;
        if (!best || adjusted > best.score) best = { goal: g, score: adjusted, to };
      }
      goal = best?.goal;

      let move: Vec = { x: 0, y: 0 };
      if (best) {
        // Stay put once on the stash being robbed; otherwise walk toward the goal.
        move = distance(me, best.to) < 6 ? { x: 0, y: 0 } : seek(me, best.to);
      }

      // Throw at a loaded rival who is close and in line with our facing.
      let action = false;
      if (tick >= (s.throwReadyAt[idx] ?? 0)) {
        const fx = s.faceX[idx] ?? 0;
        const fy = s.faceY[idx] ?? 0;
        action = s.players.some((p, i) => {
          if (i === idx || (s.carried[i] ?? 0) < 1 || tick < (s.stunnedUntil[i] ?? 0)) return false;
          const d = distance(me, p);
          if (d > THROW_RANGE || d < me.r) return false;
          const to = seek(me, p);
          const reach = secondsToTicks(tuning.coconutLifeSeconds) * tuning.coconutSpeed;
          return fx * to.x + fy * to.y > 0.97 && d < reach;
        });
      }
      return toInput(move, action);
    },
  };
}
