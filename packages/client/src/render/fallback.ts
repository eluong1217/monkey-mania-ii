import type { BaseSnapshot } from '@monkey-mania-2/shared';
import { slotColor, type RenderScene } from './types';

export function drawTimer(snapshot: BaseSnapshot, scene: RenderScene): void {
  if (snapshot.timeLeft !== undefined) scene.text(320, 12, String(Math.ceil(snapshot.timeLeft)));
}

/** Players as slot-coloured circles with "P1".."P4" labels; the local one gets a white ring. */
export function drawPlayers(snapshot: BaseSnapshot, scene: RenderScene): void {
  for (const p of snapshot.players) {
    scene.circle(p.x, p.y, p.r, slotColor(p.slot));
    if (p.slot === scene.localSlot) scene.ring(p.x, p.y, p.r + 2, 0xffffff, 2);
    // Above the circle, or below it when that would leave the screen.
    const above = p.y - p.r - 8;
    scene.text(p.x, above < 6 ? p.y + p.r + 8 : above, `P${p.slot + 1}`);
  }
}

/**
 * Draws any snapshot from the `BaseSnapshot` fields alone: entities as pale circles tagged with
 * their kind's first letter, then players. A new mini-game is visible before it has a renderer.
 */
export function fallbackRenderer(snapshot: BaseSnapshot, scene: RenderScene): void {
  for (const e of snapshot.entities ?? []) {
    scene.circle(e.x, e.y, e.r, 0xdddddd, 0.9);
    if (e.r >= 4) scene.text(e.x, e.y, e.kind.charAt(0).toUpperCase(), { color: '#333', size: 8 });
  }
  drawPlayers(snapshot, scene);
  drawTimer(snapshot, scene);
}
