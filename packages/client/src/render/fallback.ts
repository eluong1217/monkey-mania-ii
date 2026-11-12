import type { BaseSnapshot } from '@monkey-mania-2/shared';
import { manifest } from '../assets/manifest';
import { MonkeyAnimator } from './monkey';
import type { RenderScene } from './types';

export function drawTimer(snapshot: BaseSnapshot, scene: RenderScene): void {
  if (snapshot.timeLeft !== undefined) scene.text(320, 12, String(Math.ceil(snapshot.timeLeft)));
}

const animator = new MonkeyAnimator();

/** Players as animated monkeys; the local one gets a white ring. */
export function drawPlayers(snapshot: BaseSnapshot, scene: RenderScene): void {
  for (const p of snapshot.players) {
    if (p.slot === scene.localSlot) scene.ring(p.x, p.y + 30, p.r + 2, 0xffffff, 2); // at the feet, under the monkey
    animator.draw(scene, p, snapshot.tick, scene.view);
  }
}

/** Entity kinds that differ from their manifest image key. */
const KIND_ALIASES: Readonly<Record<string, string>> = {
  pineapple: 'pineapple_golden',
  'golden-pineapple': 'pineapple_golden',
  golden: 'pineapple_golden',
  rotten: 'rotten_fruit',
  'rotten-fruit': 'rotten_fruit',
  shadow: 'coconut_shadow_target',
  target: 'coconut_shadow_target',
  platform: 'tree_stump_platform',
  stump: 'tree_stump_platform',
};
const imageKeys = new Set(manifest.images.map((i) => i.key));

/** The manifest image for an entity kind, or undefined when there is no art for it. */
export function entityImage(kind: string): string | undefined {
  const key = Object.hasOwn(KIND_ALIASES, kind) ? KIND_ALIASES[kind] : kind;
  return key !== undefined && imageKeys.has(key) ? key : undefined;
}

/**
 * Draws any snapshot from the `BaseSnapshot` fields alone: entities as pale circles tagged with
 * their kind's first letter, then players. A new mini-game is visible before it has a renderer.
 */
export function fallbackRenderer(snapshot: BaseSnapshot, scene: RenderScene): void {
  for (const e of snapshot.entities ?? []) {
    const image = entityImage(e.kind);
    if (image) {
      scene.sprite(image, 0, e.x, e.y, image === 'tree_stump_platform' ? { depth: -1 } : undefined);
      continue;
    }
    scene.circle(e.x, e.y, e.r, 0xdddddd, 0.9);
    if (e.r >= 4) scene.text(e.x, e.y, e.kind.charAt(0).toUpperCase(), { color: '#333', size: 8 });
  }
  drawPlayers(snapshot, scene);
  drawTimer(snapshot, scene);
}
