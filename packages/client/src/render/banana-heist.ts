import { bananaHeist, type BaseSnapshot, type BananaHeistSnapshot } from '@monkey-mania-2/shared';
import { monkeyColor } from '../assets/manifest';
import { drawPlayers, drawTimer, justActed } from './fallback';
import type { RenderScene } from './types';

/** Banana Heist: corner stashes with counts, bananas, coconuts, carried count above each monkey. */
export function bananaHeistRenderer(snapshot: BaseSnapshot, scene: RenderScene): void {
  const s = snapshot as BananaHeistSnapshot;
  for (const e of s.entities ?? []) {
    if (e.kind === 'stash') {
      scene.sprite(`stash_${monkeyColor(e.owner)}`, 0, e.x, e.y, { depth: -5 });
      scene.text(e.x, e.y + 24, String(e.count), { size: 14 });
    } else if (e.kind === 'banana') {
      scene.sprite('banana', 0, e.x, e.y);
    } else {
      scene.sprite('coconut', 0, e.x, e.y);
    }
  }
  drawPlayers(s, scene, (i) => ({
    stunned: (s.stunnedUntil?.[i] ?? 0) > s.tick,
    acted: justActed(s.throwReadyAt?.[i], s.tick, bananaHeist.tuning.throwCooldownSeconds),
  }));
  s.players.forEach((p, i) => {
    const carried = s.carried?.[i] ?? 0;
    if (carried > 0) scene.text(p.x, p.y - 36, `x${carried}`, { color: '#ffe135', size: 10 });
    if ((s.stunnedUntil?.[i] ?? 0) > s.tick)
      scene.sprite('stun_stars', 0, p.x, p.y - 28, { depth: p.y + 1 });
    if ((s.stealTicks?.[i] ?? 0) > 0) {
      const target = s.stealFrom?.[i] ?? -1;
      const stash = s.entities.find((e) => e.kind === 'stash' && e.owner === target);
      if (stash)
        scene.ring(
          stash.x,
          stash.y,
          stash.r * Math.min(1, (s.stealTicks[i] ?? 0) / 30),
          0xffffff,
          2,
        );
    }
    scene.text(80 + i * 160, 30, `P${p.slot + 1}: ${s.stash?.[i] ?? 0}`, { size: 12 });
  });
  drawTimer(s, scene);
}
