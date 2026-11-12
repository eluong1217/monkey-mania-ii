import { bananaHeistRenderer } from './banana-heist';
import { coconutDodgeRenderer } from './coconut-dodge';
import { fallbackRenderer } from './fallback';
import { fruitFrenzyRenderer } from './fruit-frenzy';
import { sandboxRenderer } from './sandbox';
import type { Renderer } from './types';

/**
 * Renderers keyed by mini-game id, mirroring the shared registry. To add one: write
 * `render/<id>.ts` exporting a `Renderer` and add one entry here. Ids without an entry use the
 * fallback renderer.
 */
export const renderers: Readonly<Record<string, Renderer>> = {
  sandbox: sandboxRenderer,
  'fruit-frenzy': fruitFrenzyRenderer,
  'coconut-dodge': coconutDodgeRenderer,
  'banana-heist': bananaHeistRenderer,
};

export function getRenderer(miniGameId: string): Renderer {
  return Object.hasOwn(renderers, miniGameId)
    ? (renderers[miniGameId] as Renderer)
    : fallbackRenderer;
}

export { fallbackRenderer } from './fallback';
export * from './types';
