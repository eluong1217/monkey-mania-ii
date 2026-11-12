/**
 * Seeded RNG (mulberry32). A plain object so it can live inside mini-game state and be cloned
 * or serialised. Never use Math.random in the simulation.
 */
export interface Rng {
  s: number;
}

export function createRng(seed: number): Rng {
  return { s: seed >>> 0 };
}

/** Float in [0, 1). Advances the RNG. */
export function nextFloat(rng: Rng): number {
  rng.s = (rng.s + 0x6d2b79f5) >>> 0;
  let t = rng.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Float in [min, max). */
export function nextRange(rng: Rng, min: number, max: number): number {
  return min + nextFloat(rng) * (max - min);
}

/** Integer in [min, max] inclusive. */
export function nextInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(nextFloat(rng) * (max - min + 1));
}

/** True with the given probability (0..1). */
export function chance(rng: Rng, probability: number): boolean {
  return nextFloat(rng) < probability;
}

/** A random element. Throws on an empty array. */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick from empty array');
  return items[nextInt(rng, 0, items.length - 1)] as T;
}
