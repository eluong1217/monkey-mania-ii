import type { BaseSnapshot, Slot } from '@monkey-mania-2/shared';

/**
 * What a renderer draws with. Kept to a few calls so renderers stay small and testable; the
 * Phaser scene implements it. Coordinates are logical pixels (640×360). Colours are 0xRRGGBB.
 */
export interface RenderScene {
  /** The local player's slot, or null when spectating/not seated. */
  readonly localSlot: Slot | null;
  circle(x: number, y: number, r: number, fill: number, alpha?: number): void;
  /** A frame of a manifest sprite sheet centred on x,y (a placeholder when the art is missing). */
  sprite(key: string, frame: number, x: number, y: number): void;
  ring(x: number, y: number, r: number, color: number, width?: number): void;
  text(x: number, y: number, text: string, opts?: { color?: string; size?: number }): void;
}

/**
 * Draws one frame. `snapshot` is already positioned for display: remote players interpolated,
 * the local player predicted. Called every frame; draw everything, keep no state.
 */
export type Renderer = (snapshot: BaseSnapshot, scene: RenderScene) => void;

/** One colour per slot, always paired with a "P1".."P4" label so colour is never the only cue. */
export const SLOT_COLORS: readonly number[] = [0xe8590c, 0x1c7ed6, 0xf2c200, 0xae3ec9];

export function slotColor(slot: Slot): number {
  return SLOT_COLORS[slot % SLOT_COLORS.length] ?? 0xffffff;
}
