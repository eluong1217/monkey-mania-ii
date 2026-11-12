/** Token bucket: `capacity` burst, refilled at `perSecond`. */
export class RateLimiter {
  private tokens: number;
  private last: number;

  constructor(
    private readonly capacity: number,
    private readonly perSecond: number,
    private readonly now: () => number = Date.now,
  ) {
    this.tokens = capacity;
    this.last = now();
  }

  /** Returns true if the message is allowed. */
  allow(): boolean {
    const t = this.now();
    this.tokens = Math.min(this.capacity, this.tokens + ((t - this.last) / 1000) * this.perSecond);
    this.last = t;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

/** Inputs arrive at ~30/s, so this leaves plenty of headroom for honest clients. */
export const MESSAGE_BURST = 90;
export const MESSAGES_PER_SECOND = 60;
