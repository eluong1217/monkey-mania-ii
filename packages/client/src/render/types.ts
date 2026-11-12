import type { BaseSnapshot, Slot } from '@monkey-mania-2/shared';

/** Extra per-draw options for `RenderScene.sprite`; all optional. */
export interface SpriteOpts {
  flipX?: boolean;
  scaleX?: number;
  scaleY?: number;
  /** Degrees, clockwise. */
  angle?: number;
  alpha?: number;
  /** Draw order; defaults to `y`, which depth-sorts top-down scenes. */
  depth?: number;
  /** Vertical pivot, 0 = top, 1 = bottom. Defaults to 0.5. Squash and stretch uses 1 (feet). */
  originY?: number;
}

/**
 * What a renderer draws with. Kept to a few calls so renderers stay small and testable; the
 * Phaser scene implements it. Coordinates are logical pixels (640×360). Colours are 0xRRGGBB.
 */
export interface RenderScene {
  /** The local player's slot, or null when spectating/not seated. */
  readonly localSlot: Slot | null;
  /** Camera of the current mini-game; picks the top-down or side-view monkey sheets. */
  readonly view: 'top' | 'side';
  circle(x: number, y: number, r: number, fill: number, alpha?: number): void;
  /** A frame of a manifest sprite sheet centred on x,y (a placeholder when the art is missing). */
  sprite(key: string, frame: number, x: number, y: number, opts?: SpriteOpts): void;
  ring(x: number, y: number, r: number, color: number, width?: number): void;
  text(x: number, y: number, text: string, opts?: { color?: string; size?: number }): void;
}

/**
 * Draws one frame. `snapshot` is already positioned for display: remote players interpolated,
 * the local player predicted. Called every frame; draw everything, keep no state.
 */
export type Renderer = (snapshot: BaseSnapshot, scene: RenderScene) => void;

/** One colour per slot, matching the monkey sheets (red, blue, yellow, green), always paired with a "P1".."P4" label so colour is never the only cue. */
export const SLOT_COLORS: readonly number[] = [0xd9381e, 0x1c7ed6, 0xf2c200, 0x2f9e44];

export function slotColor(slot: Slot): number {
  return SLOT_COLORS[slot % SLOT_COLORS.length] ?? 0xffffff;
}
