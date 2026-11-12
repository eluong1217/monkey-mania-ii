import type { BaseSnapshot, CoconutDodgeSnapshot } from '@monkey-mania-2/shared';
import { drawPlayers, drawTimer } from './fallback';
import type { RenderScene } from './types';

/** Coconut Dodge: shadows that fill as they near landing, impact flashes, survivors list. */
export function coconutDodgeRenderer(snapshot: BaseSnapshot, scene: RenderScene): void {
  const s = snapshot as CoconutDodgeSnapshot;
  for (const e of s.entities ?? []) {
    if (e.kind === 'impact') {
      scene.circle(e.x, e.y, e.r, 0xffffff, 0.5);
      continue;
    }
    const left = Math.max(0, e.landsAt - s.tick);
    const fill = e.warnTicks > 0 ? 1 - left / e.warnTicks : 1;
    scene.ring(e.x, e.y, e.r, 0xff3b30, 2);
    scene.circle(e.x, e.y, e.r * fill, 0x000000, 0.35);
  }
  const me = scene.localSlot === null ? -1 : s.players.findIndex((p) => p.slot === scene.localSlot);
  const readyAt = me >= 0 ? s.rollReadyAt?.[me] : undefined;
  const alivePlayers = s.players.filter((_, i) => s.alive?.[i] !== false);
  drawPlayers({ ...s, players: alivePlayers }, scene);
  s.players.forEach((p, i) => {
    if (s.alive?.[i] === false) scene.text(p.x, p.y, 'X', { color: '#ff3b30', size: 16 });
  });
  const mine = me >= 0 ? s.players[me] : undefined;
  if (mine && s.alive?.[me] && readyAt !== undefined && s.tick >= readyAt)
    scene.circle(mine.x, mine.y, mine.r + 6, 0xffffff, 0.2);
  s.players.forEach((p, i) =>
    scene.text(80 + i * 160, 30, `P${p.slot + 1}${s.alive?.[i] === false ? ' OUT' : ''}`, {
      size: 12,
    }),
  );
  drawTimer(s, scene);
}
