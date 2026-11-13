import { fruitFrenzy, type BaseSnapshot, type FruitFrenzySnapshot } from '@monkey-mania-2/shared';
import { drawPlayers, entityImage, justActed } from './fallback';
import type { RenderScene } from './types';

const COLORS: Record<string, number> = {
  apple: 0xd9381e,
  banana: 0xf2c200,
  pineapple: 0xffb300,
  rotten: 0x6b8e23,
};

/** Fruit Frenzy: labelled coloured fruit, monkeys, scores along the top, shove-ready halo. */
export function fruitFrenzyRenderer(snapshot: BaseSnapshot, scene: RenderScene): void {
  const s = snapshot as FruitFrenzySnapshot;
  for (const e of s.entities ?? []) {
    const image = entityImage(e.kind);
    if (image) scene.sprite(image, 0, e.x, e.y);
    else {
      scene.circle(e.x, e.y, e.r, COLORS[e.kind] ?? 0xdddddd);
      scene.text(e.x, e.y, e.kind.charAt(0).toUpperCase(), { color: '#222', size: 8 });
    }
  }
  const me = s.players.find((p) => p.slot === scene.localSlot);
  const readyAt = scene.localSlot === null ? undefined : s.shoveReadyAt?.[scene.localSlot];
  if (me && readyAt !== undefined && s.tick >= readyAt)
    scene.circle(me.x, me.y + 30, me.r + 6, 0xffffff, 0.2);
  drawPlayers(s, scene, (i) => ({
    stunned: (s.stunnedUntil?.[i] ?? 0) > s.tick,
    acted: justActed(s.shoveReadyAt?.[i], s.tick, fruitFrenzy.tuning.shoveCooldownSeconds),
  }));
}
