import { TICK_RATE, type BaseSnapshot, type PlayerView } from '@monkey-mania-2/shared';

export const TICK_MS = 1000 / TICK_RATE;
/** Remote entities are drawn this far in the past, so there is usually a snapshot either side. */
export const INTERP_DELAY_MS = 100;
/** If snapshots stop arriving, keep moving along the last velocity for at most this long. */
export const MAX_EXTRAPOLATE_TICKS = 2;
/** How fast the clock offset drifts up toward a later arrival (per snapshot). */
const OFFSET_RISE = 0.05;
const KEEP_TICKS = TICK_RATE;

interface Entry {
  tick: number;
  snap: BaseSnapshot;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpPlayers(a: BaseSnapshot, b: BaseSnapshot, t: number): PlayerView[] {
  return b.players.map((pb) => {
    const pa = a.players.find((p) => p.slot === pb.slot);
    if (!pa) return { ...pb };
    return {
      slot: pb.slot,
      x: lerp(pa.x, pb.x, t),
      y: lerp(pa.y, pb.y, t),
      r: lerp(pa.r, pb.r, t),
    };
  });
}

/**
 * Buffers server snapshots and samples them at a point ~100 ms in the past.
 *
 * The server tick is mapped to local time with `offset` (local ms at server tick 0). Each
 * arrival gives a sample `now - tick·TICK_MS`; an earlier-than-expected arrival is taken at
 * once and a later one only nudges the offset, so jitter shows up as buffer slack, not stutter.
 */
export class SnapshotBuffer {
  private entries: Entry[] = [];
  private offset: number | null = null;

  constructor(readonly delayMs = INTERP_DELAY_MS) {}

  clear(): void {
    this.entries = [];
    this.offset = null;
  }

  get newest(): BaseSnapshot | undefined {
    return this.entries[this.entries.length - 1]?.snap;
  }

  /** Add a snapshot that arrived at local time `nowMs`. Old or duplicate ticks are ignored. */
  push(snap: BaseSnapshot, nowMs: number): void {
    const last = this.entries[this.entries.length - 1];
    if (last && snap.tick <= last.tick) {
      // A tick far in the past means a new round restarted the counter.
      if (last.tick - snap.tick < TICK_RATE) return;
      this.clear();
    }
    this.entries.push({ tick: snap.tick, snap });
    // Keep about a second of history; rendering only ever looks a few ticks back.
    while (this.entries.length > 2 && (this.entries[0] as Entry).tick < snap.tick - KEEP_TICKS)
      this.entries.shift();
    const sample = nowMs - snap.tick * TICK_MS;
    if (this.offset === null || sample < this.offset) this.offset = sample;
    else this.offset += (sample - this.offset) * OFFSET_RISE;
  }

  /** The (fractional) server tick being displayed at local time `nowMs`. */
  renderTick(nowMs: number): number | null {
    if (this.offset === null) return null;
    return (nowMs - this.offset - this.delayMs) / TICK_MS;
  }

  /** Players interpolated for `nowMs`; other fields from the snapshot nearest in time. */
  sample(nowMs: number): BaseSnapshot | null {
    const at = this.renderTick(nowMs);
    const n = this.entries.length;
    if (at === null || n === 0) return null;
    const first = this.entries[0] as Entry;
    const last = this.entries[n - 1] as Entry;

    if (at <= first.tick || n === 1)
      return { ...first.snap, players: first.snap.players.map((p) => ({ ...p })) };

    if (at >= last.tick) {
      const prev = this.entries[n - 2] as Entry;
      const ahead = Math.min(at - last.tick, MAX_EXTRAPOLATE_TICKS);
      const t = 1 + ahead / (last.tick - prev.tick);
      return { ...last.snap, players: lerpPlayers(prev.snap, last.snap, t) };
    }

    let i = n - 2;
    while (i > 0 && (this.entries[i] as Entry).tick > at) i--;
    const a = this.entries[i] as Entry;
    const b = this.entries[i + 1] as Entry;
    const t = (at - a.tick) / (b.tick - a.tick);
    return { ...(t < 0.5 ? a.snap : b.snap), players: lerpPlayers(a.snap, b.snap, t) };
  }
}
