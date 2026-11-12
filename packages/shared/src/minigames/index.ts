import type { AnyMiniGame } from '../minigame.js';
import { fruitFrenzy } from './fruit-frenzy/index.js';
import { sandbox } from './sandbox/index.js';

/** Every mini-game, keyed by id. To add one: import it and add one entry here. */
export const miniGames: Readonly<Record<string, AnyMiniGame>> = {
  [sandbox.id]: sandbox,
  [fruitFrenzy.id]: fruitFrenzy,
};

export function getMiniGame(id: string): AnyMiniGame | undefined {
  return Object.hasOwn(miniGames, id) ? miniGames[id] : undefined;
}

export function listMiniGameIds(): string[] {
  return Object.keys(miniGames);
}
