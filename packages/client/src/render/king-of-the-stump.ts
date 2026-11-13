import type { BaseSnapshot, KingOfTheStumpSnapshot } from '@monkey-mania-2/shared';
import { drawPlayers, drawTimer } from './fallback';
import type { RenderScene } from './types';

const CX = 320;
const CY = 180;

/** King of the Stump: the shrinking platform with a bold edge, shove bursts, survivors list. */
export function kingOfTheStumpRenderer(snapshot: BaseSnapshot, scene: RenderScene): void {
  const s = snapshot as KingOfTheStumpSnapshot;
  scene.circle(CX, CY, s.platformR, 0x8b5a2b, 0.9);
  scene.ring(CX, CY, s.platformR, 0xffffff, 3);
  scene.ring(CX, CY, s.platformR - 5, 0x5a3a1a, 2);

  const alivePlayers = s.players.filter((_, i) => s.alive?.[i] !== false);
  drawPlayers({ ...s, players: alivePlayers }, scene);
  s.players.forEach((p, i) => {
    if (s.alive?.[i] === false) return;
    if (s.tick - (s.shovedAt?.[i] ?? -99) < 6)
      scene.circle(
        p.x + (s.faceX?.[i] ?? 0) * 18,
        p.y + (s.faceY?.[i] ?? 0) * 18,
        10,
        0xffffff,
        0.6,
      );
  });
  const me = scene.localSlot === null ? -1 : s.players.findIndex((p) => p.slot === scene.localSlot);
  const mine = me >= 0 ? s.players[me] : undefined;
  if (mine && s.alive?.[me] && s.tick >= (s.shoveReadyAt?.[me] ?? 0))
    scene.circle(mine.x, mine.y, mine.r + 6, 0xffffff, 0.2);
  s.players.forEach((p, i) =>
    scene.text(80 + i * 160, 30, `P${p.slot + 1}${s.alive?.[i] === false ? ' OUT' : ''}`, {
      size: 12,
    }),
  );
  drawTimer(s, scene);
}
