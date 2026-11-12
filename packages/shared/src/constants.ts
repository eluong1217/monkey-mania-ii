export const GAME_NAME = 'Monkey Mania II';
export const LOGICAL_WIDTH = 640;
export const LOGICAL_HEIGHT = 360;
/** Fixed simulation rate in ticks per second. */
export const TICK_RATE = 30;
/** Seconds per tick. Speeds in tuning objects are pixels per second; multiply by DT per tick. */
export const DT = 1 / TICK_RATE;
export const MAX_PLAYERS = 4;

/** Whole ticks for a duration in seconds (rounded, never negative). */
export function secondsToTicks(seconds: number): number {
  return Math.max(0, Math.round(seconds * TICK_RATE));
}
