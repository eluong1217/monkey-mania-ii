import { ARENA } from '../../arena.js';
import { DT } from '../../constants.js';
import { toInput } from '../../bots/steering.js';
import type { Bot } from '../../bots/types.js';
import { tuning, type CoconutDodgeSnapshot } from './index.js';

const PAD = 14; // stay this far outside a shadow's edge
const HORIZON = 1.2; // seconds of shadows considered
const ANGLES = 16;

/**
 * Looks at 16 headings (and standing still), predicts where each would put it when every
 * shadow lands, and picks the one with the least overlap, preferring open space and its
 * current heading. Rolls only when even the best heading leaves it inside a shadow that is
 * about to land.
 */
export function createCoconutDodgeBot(): Bot {
  let lastDx = 0;
  let lastDy = 0;
  return {
    decide(snapshot, mySlot, tick) {
      const s = snapshot as CoconutDodgeSnapshot;
      const me = s.players.find((p) => p.slot === mySlot);
      const idx = s.players.findIndex((p) => p.slot === mySlot);
      if (!me || !s.alive[idx]) return toInput({ x: 0, y: 0 });

      const shadows = s.entities
        .filter((e) => e.kind === 'shadow')
        .map((e) => ({ ...e, t: Math.max(0, (e.landsAt - tick) * DT) }))
        .filter((e) => e.t <= HORIZON);

      const evaluate = (dx: number, dy: number) => {
        let danger = 0;
        let urgent = 0;
        for (const sh of shadows) {
          const px = Math.min(
            ARENA.width - me.r,
            Math.max(me.r, me.x + dx * tuning.moveSpeed * sh.t),
          );
          const py = Math.min(
            ARENA.height - me.r,
            Math.max(me.r, me.y + dy * tuning.moveSpeed * sh.t),
          );
          const over = sh.r + PAD - Math.hypot(px - sh.x, py - sh.y);
          if (over > 0) {
            danger += over;
            if (sh.r - Math.hypot(px - sh.x, py - sh.y) > 0)
              urgent = Math.max(urgent, 1 / (sh.t + 0.1));
          }
        }
        // Open space: end point near the middle and clear of walls.
        const ex = me.x + dx * tuning.moveSpeed * 0.5;
        const ey = me.y + dy * tuning.moveSpeed * 0.5;
        const wall = Math.min(ex, ARENA.width - ex, ey, ARENA.height - ey);
        const open = -Math.max(0, 50 - wall) * 0.3 - Math.hypot(ex - 320, ey - 180) * 0.02;
        const keep = dx * lastDx + dy * lastDy > 0.9 ? 0.5 : 0;
        return { danger, urgent, value: -danger * 10 + open + keep };
      };

      let best = { dx: 0, dy: 0, ...evaluate(0, 0) };
      for (let i = 0; i < ANGLES; i++) {
        const a = (i / ANGLES) * Math.PI * 2;
        const dx = Math.cos(a);
        const dy = Math.sin(a);
        const e = evaluate(dx, dy);
        if (e.value > best.value + 1e-9) best = { dx, dy, ...e };
      }
      lastDx = best.dx;
      lastDy = best.dy;

      const rollReady = tick >= (s.rollReadyAt[idx] ?? 0);
      const trapped = best.urgent > 0 && best.danger > 0;
      const soon = shadows.some((sh) => sh.t < 0.35 && Math.hypot(me.x - sh.x, me.y - sh.y) < sh.r);
      const action = rollReady && trapped && soon;
      return toInput({ x: best.dx, y: best.dy }, action);
    },
  };
}
