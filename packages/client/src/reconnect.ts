import type { ClientMessage } from '@monkey-mania-2/shared';
import { CLOSE_EVICTED, type Connection } from './connection';

/** Waits before each retry: quick at first, then every 8 s, for about 40 s in all. */
export const RECONNECT_DELAYS_MS = [500, 1000, 2000, 4000, 8000, 8000, 8000, 8000];

export interface Timers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

const browserTimers: Timers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as number),
};

/**
 * Keeps a player in their room across a dropped connection: when the socket closes while
 * `rejoinMessage()` returns a message (we are in a room), it reconnects with backoff and
 * sends it (a joinRoom carrying the rejoin token). The server plays the seat with a bot in
 * the meantime. Gives up when retries run out, when the server refuses the seat, or when the
 * server closed us on purpose (seat taken over by another window, room closed).
 */
export class Reconnector {
  /** True while retrying, for the "Reconnecting…" screen. */
  active = false;
  /** True once we gave up; cleared by the next successful join. */
  failed = false;
  private attempt = 0;
  private timer: unknown = null;

  constructor(
    private readonly conn: Connection,
    private readonly rejoinMessage: () => ClientMessage | null,
    private readonly onChange: () => void = () => {},
    private readonly timers: Timers = browserTimers,
    private readonly delays: readonly number[] = RECONNECT_DELAYS_MS,
  ) {
    conn.on('status', (s) => {
      if (s === 'closed') this.dropped();
    });
    conn.on('joined', () => {
      const was = this.active;
      this.reset();
      this.failed = false;
      if (was) this.onChange();
    });
    // While rejoining, any error means the seat is gone (room removed, or the match moved on).
    conn.on('error', () => {
      if (this.active) this.giveUp();
    });
  }

  /** Stop retrying (the player chose to leave). */
  stop(): void {
    this.reset();
  }

  private reset(): void {
    if (this.timer !== null) this.timers.clearTimeout(this.timer);
    this.timer = null;
    this.active = false;
    this.attempt = 0;
  }

  private giveUp(): void {
    this.reset();
    this.failed = true;
    this.onChange();
  }

  private dropped(): void {
    if (this.timer !== null) return;
    if (this.conn.closeCode === CLOSE_EVICTED || !this.rejoinMessage()) {
      if (this.active) this.giveUp();
      return;
    }
    const delay = this.delays[this.attempt];
    if (delay === undefined) return this.giveUp();
    this.attempt++;
    this.active = true;
    this.onChange();
    this.timer = this.timers.setTimeout(() => {
      this.timer = null;
      void this.conn.connect().then((ok) => {
        // On failure the socket's close has already scheduled the next try.
        if (!ok) return;
        const message = this.rejoinMessage();
        if (message) this.conn.send(message);
        else this.reset();
      });
    }, delay);
  }
}
