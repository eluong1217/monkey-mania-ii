import { nextInt, type Rng } from '../rng.js';

export const BOT_NAMES: readonly string[] = [
  'Bananarama',
  'Coco',
  'Gorilla Glue',
  'Mango Mike',
  'Banjo',
  'Chimpy',
  'Peaches',
  'Rumble',
  'Zippy',
  'Kiwi',
];

/** `count` distinct bot names, chosen with the given RNG. */
export function pickBotNames(count: number, rng: Rng): string[] {
  const pool = [...BOT_NAMES];
  const out: string[] = [];
  while (out.length < count && pool.length > 0) {
    out.push(pool.splice(nextInt(rng, 0, pool.length - 1), 1)[0] as string);
  }
  return out;
}
