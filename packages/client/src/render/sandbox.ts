import type { BaseSnapshot, SandboxSnapshot } from '@monkey-mania-2/shared';
import { drawPlayers } from './fallback';
import type { RenderScene } from './types';

/** Sandbox: coloured circles with slot labels; a faint halo shows when your push is ready. */
export function sandboxRenderer(snapshot: BaseSnapshot, scene: RenderScene): void {
  const s = snapshot as SandboxSnapshot;
  const me = s.players.find((p) => p.slot === scene.localSlot);
  const readyAt = scene.localSlot === null ? undefined : s.pushReadyAt?.[scene.localSlot];
  if (me && readyAt !== undefined && s.tick >= readyAt)
    scene.circle(me.x, me.y, me.r + 6, 0xffffff, 0.2);
  drawPlayers(s, scene);
}
