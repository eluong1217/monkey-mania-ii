/** A tick-based cooldown. Plain data so it can live in state and snapshots. */
export interface Cooldown {
  /** First tick on which the action may be used again. */
  readyAt: number;
}

export function createCooldown(): Cooldown {
  return { readyAt: 0 };
}

export function isReady(cd: Cooldown, tick: number): boolean {
  return tick >= cd.readyAt;
}

/** Ticks left until ready (0 when ready). Handy for HUD cooldown indicators. */
export function remainingTicks(cd: Cooldown, tick: number): number {
  return Math.max(0, cd.readyAt - tick);
}

/**
 * If ready, starts the cooldown for `durationTicks` and returns true; otherwise returns false.
 * Typical use: `if (input.action && tryUse(p.shove, tick, secondsToTicks(tuning.shoveCooldown)))`.
 */
export function tryUse(cd: Cooldown, tick: number, durationTicks: number): boolean {
  if (!isReady(cd, tick)) return false;
  cd.readyAt = tick + durationTicks;
  return true;
}
