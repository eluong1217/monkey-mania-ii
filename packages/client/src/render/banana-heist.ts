import type { BaseSnapshot, BananaHeistSnapshot } from '@monkey-mania-2/shared';
import { drawPlayers, drawTimer } from './fallback';
import { slotColor, type RenderScene } from './types';

/** Banana Heist: corner stashes with counts, bananas, coconuts, carried count above each monkey. */
export function bananaHeistRenderer(snapshot: BaseSnapshot, scene: RenderScene): void {
  const s = snapshot as BananaHeistSnapshot;
  for (const e of s.entities ?? []) {
    if (e.kind === 'stash') {
      scene.circle(e.x, e.y, e.r, slotColor(e.owner), 0.35);
      scene.ring(e.x, e.y, e.r, slotColor(e.owner), 2);
      scene.text(e.x, e.y, String(e.count), { size: 16 });
    } else if (e.kind === 'banana') {
      scene.circle(e.x, e.y, e.r, 0xffe135);
    } else {
      scene.circle(e.x, e.y, e.r, 0x6b3e1f);
    }
  }
  drawPlayers(s, scene);
  s.players.forEach((p, i) => {
    const carried = s.carried?.[i] ?? 0;
    const stunned = (s.stunnedUntil?.[i] ?? 0) > s.tick;
    if (carried > 0) scene.text(p.x, p.y - 36, `x${carried}`, { color: '#ffe135', size: 10 });
    if (stunned) scene.text(p.x, p.y - 46, 'STUN', { color: '#ff3b30', size: 10 });
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
