/** Time source and timers. The real one wraps performance.now/setTimeout; tests pass a fake. */
export interface Clock {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const realClock: Clock = {
  now: () => performance.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms).unref(),
  clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
};

export interface TickerStats {
  /** Ticks run. */
  ticks: number;
  /** Ticks dropped because the loop fell too far behind. */
  skipped: number;
  /** How late each tick started versus its ideal time (ms). */
  maxLateMs: number;
  totalLateMs: number;
  /** Time spent inside onTick (ms). */
  maxStepMs: number;
  totalStepMs: number;
}

/** Most ticks run in one wake-up before the ticker gives up catching up and skips ahead. */
export const MAX_CATCH_UP = 3;

/**
 * Fixed-rate loop. Tick n is due at `origin + n * period`, so timer jitter never accumulates
 * into drift. A late wake runs the missed ticks (at most MAX_CATCH_UP); beyond that it skips.
 */
export class Ticker {
  readonly stats: TickerStats = {
    ticks: 0,
    skipped: 0,
    maxLateMs: 0,
    totalLateMs: 0,
    maxStepMs: 0,
    totalStepMs: 0,
  };
  private readonly period: number;
  private origin = 0;
  private n = 0;
  private handle: unknown = null;
  private running = false;

  constructor(
    private readonly clock: Clock,
    hz: number,
    private readonly onTick: () => void,
  ) {
    this.period = 1000 / hz;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.origin = this.clock.now();
    this.n = 1;
    this.schedule();
  }

  stop(): void {
    this.running = false;
    if (this.handle !== null) this.clock.clearTimeout(this.handle);
    this.handle = null;
  }

  private due(): number {
    return this.origin + this.n * this.period;
  }

  private schedule(): void {
    this.handle = this.clock.setTimeout(this.wake, Math.max(0, this.due() - this.clock.now()));
  }

  private readonly wake = (): void => {
    this.handle = null;
    if (!this.running) return;
    let steps = 0;
    while (this.running && steps < MAX_CATCH_UP && this.clock.now() >= this.due()) {
      const start = this.clock.now();
      const late = start - this.due();
      this.onTick();
      const cost = this.clock.now() - start;
      const s = this.stats;
      s.ticks++;
      s.totalLateMs += late;
      s.maxLateMs = Math.max(s.maxLateMs, late);
      s.totalStepMs += cost;
      s.maxStepMs = Math.max(s.maxStepMs, cost);
      this.n++;
      steps++;
    }
    if (!this.running) return;
    // Only skip once the catch-up budget is spent; otherwise the next wake runs what is due.
    if (steps === MAX_CATCH_UP) {
      const now = this.clock.now();
      while (now >= this.due()) {
        this.n++;
        this.stats.skipped++;
      }
    }
    this.schedule();
  };
}
