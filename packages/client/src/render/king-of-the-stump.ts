import {
  kingOfTheStump,
  type BaseSnapshot,
  type KingOfTheStumpSnapshot,
} from '@monkey-mania-2/shared';
import { drawPlayers, justActed } from './fallback';
import type { RenderScene } from './types';

const CX = 320;
const CY = 180;
const ART = 256; // tree_stump_platform is a full-bleed disc

/** King of the Stump: the shrinking stump sprite, monkeys (fallen ones in the out pose), shove squash. */
export function kingOfTheStumpRenderer(snapshot: BaseSnapshot, scene: RenderScene): void {
  const s = snapshot as KingOfTheStumpSnapshot;
  const k = (s.platformR * 2) / ART;
  scene.sprite('tree_stump_platform', 0, CX, CY, { depth: -10, scaleX: k, scaleY: k });

  drawPlayers(s, scene, (i) => ({
    out: s.alive?.[i] === false,
    acted: justActed(s.shoveReadyAt?.[i], s.tick, kingOfTheStump.tuning.shoveCooldownSeconds),
  }));
  s.players.forEach((p, i) => {
    if (s.alive?.[i] === false) return;
    if (s.tick - (s.shovedAt?.[i] ?? -99) < 6)
      scene.sprite(
        'dust_puff',
        0,
        p.x + (s.faceX?.[i] ?? 0) * 20,
        p.y + 20 + (s.faceY?.[i] ?? 0) * 12,
        {
          alpha: 0.8,
          depth: p.y + 1,
        },
      );
  });
}
