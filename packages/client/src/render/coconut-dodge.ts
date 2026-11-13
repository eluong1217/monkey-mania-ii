import { coconutDodge, type BaseSnapshot, type CoconutDodgeSnapshot } from '@monkey-mania-2/shared';
import { drawPlayers, justActed } from './fallback';
import type { RenderScene } from './types';

const FALL_PX_PER_TICK = 8;
const SPRITE = 32;

/** Coconut Dodge: shadow targets that darken as they near landing, a coconut dropping onto each, splats. */
export function coconutDodgeRenderer(snapshot: BaseSnapshot, scene: RenderScene): void {
  const s = snapshot as CoconutDodgeSnapshot;
  for (const e of s.entities ?? []) {
    if (e.kind === 'impact') {
      scene.sprite('splat', 0, e.x, e.y, {
        depth: -2,
        scaleX: (e.r * 2) / 64,
        scaleY: (e.r * 2) / 64,
      });
      continue;
    }
    const left = Math.max(0, e.landsAt - s.tick);
    const fill = e.warnTicks > 0 ? 1 - left / e.warnTicks : 1;
    const size = (e.r * 2) / SPRITE;
    scene.sprite('coconut_shadow_target', 0, e.x, e.y, {
      depth: -2,
      scaleX: size,
      scaleY: size,
      alpha: 0.4 + 0.6 * fill,
    });
    // The coconut itself falls in from above the shadow, over every monkey.
    if (left > 0 && left <= 12)
      scene.sprite('coconut', 0, e.x, e.y - left * FALL_PX_PER_TICK, { depth: 5000 });
  }
  drawPlayers(s, scene, (i) => ({
    out: s.alive?.[i] === false,
    acted: justActed(s.rollReadyAt?.[i], s.tick, coconutDodge.tuning.rollCooldownSeconds),
  }));
  const me = scene.localSlot === null ? -1 : s.players.findIndex((p) => p.slot === scene.localSlot);
  const mine = me >= 0 ? s.players[me] : undefined;
  if (mine && s.alive?.[me] && (s.rollReadyAt?.[me] ?? 0) <= s.tick)
    scene.ring(mine.x, mine.y + 30, mine.r + 8, 0xffffff, 1);
}
