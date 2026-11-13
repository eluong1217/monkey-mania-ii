import { toInput } from '../../bots/steering.js';
import type { Bot } from '../../bots/types.js';
import { PLATFORM_X, PLATFORM_Y, tuning, type KingOfTheStumpSnapshot } from './index.js';

const EDGE_MARGIN = 38; // head for the middle when this close to the edge
const BACK_OFF_RANGE = 70;
const STAND_BEHIND = 22; // aim to stand this far from the rival on the centre side

/**
 * Stays toward the centre, faces the nearest rival and shoves when the rival is between it
 * and the edge (so the knockback pushes them off). Backs off while its shove is on cooldown.
 */
export function createKingOfTheStumpBot(): Bot {
  return {
    decide(snapshot, mySlot, tick) {
      const s = snapshot as KingOfTheStumpSnapshot;
      const idx = s.players.findIndex((p) => p.slot === mySlot);
      const me = s.players[idx];
      if (!me || !s.alive[idx]) return toInput({ x: 0, y: 0 });

      const toCentre = (x: number, y: number) => {
        const dx = PLATFORM_X - x;
        const dy = PLATFORM_Y - y;
        const l = Math.hypot(dx, dy);
        return l < 1e-6 ? { x: 0, y: 0 } : { x: dx / l, y: dy / l };
      };
      const dMe = Math.hypot(me.x - PLATFORM_X, me.y - PLATFORM_Y);
      const home = toCentre(me.x, me.y);

      let rival: { x: number; y: number } | undefined;
      let best = Infinity;
      s.players.forEach((p, i) => {
        if (i === idx || !s.alive[i]) return;
        const d = Math.hypot(p.x - me.x, p.y - me.y);
        if (d < best) {
          best = d;
          rival = p;
        }
      });
      if (!rival) return toInput(home);

      // Near the edge: get back to the middle first.
      if (dMe > s.platformR - EDGE_MARGIN) return toInput(home);

      const ready = tick >= (s.shoveReadyAt[idx] ?? 0);
      const rx = rival.x - me.x;
      const ry = rival.y - me.y;
      if (!ready) {
        // Back off and keep the middle.
        if (best < BACK_OFF_RANGE)
          return toInput({ x: home.x * 0.6 - rx / best, y: home.y * 0.6 - ry / best });
        return toInput(home);
      }

      const dRival = Math.hypot(rival.x - PLATFORM_X, rival.y - PLATFORM_Y);
      const outward = dRival >= dMe - 2;
      const facing = (s.faceX[idx] ?? 0) * (rx / best) + (s.faceY[idx] ?? 0) * (ry / best);
      if (best < tuning.shoveRange - 6 && outward) {
        // Close and the rival is on the edge side: step into them (this also turns us to face)
        // and shove once we do.
        return toInput({ x: rx / best, y: ry / best }, facing > 0.8);
      }
      // Otherwise get to the centre side of the rival.
      const back = toCentre(rival.x, rival.y);
      const tx = rival.x + back.x * STAND_BEHIND;
      const ty = rival.y + back.y * STAND_BEHIND;
      const dx = tx - me.x;
      const dy = ty - me.y;
      const l = Math.hypot(dx, dy);
      if (l < 4) return toInput({ x: rx / best, y: ry / best });
      return toInput({ x: dx / l, y: dy / l });
    },
  };
}
