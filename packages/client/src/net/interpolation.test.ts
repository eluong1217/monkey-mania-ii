import { describe, expect, it } from 'vitest';
import { createRng, nextFloat, type BaseSnapshot } from '@monkey-mania-2/shared';
import { INTERP_DELAY_MS, MAX_EXTRAPOLATE_TICKS, SnapshotBuffer, TICK_MS } from './interpolation';

function snap(tick: number, x: number, y = 100): BaseSnapshot {
  return { tick, players: [{ slot: 1, x, y, r: 12 }], timeLeft: 10 - tick / 30 };
}

/** Snapshot arriving with a fixed one-way latency; tick 0 is sent at local time 0. */
const LATENCY = 75;
const arrival = (tick: number) => tick * TICK_MS + LATENCY;

describe('SnapshotBuffer', () => {
  it('returns null before any snapshot', () => {
    expect(new SnapshotBuffer().sample(0)).toBeNull();
  });

  it('renders delayMs behind the newest server tick', () => {
    const b = new SnapshotBuffer();
    b.push(snap(30, 0), arrival(30));
    const now = arrival(30);
    expect(b.renderTick(now)).toBeCloseTo(30 - INTERP_DELAY_MS / TICK_MS);
  });

  it('interpolates players linearly between the bracketing snapshots', () => {
    const b = new SnapshotBuffer();
    b.push(snap(10, 0), arrival(10));
    b.push(snap(13, 30), arrival(13));
    // Show tick 11.5: halfway from x=0 to x=30.
    const now = 11.5 * TICK_MS + LATENCY + INTERP_DELAY_MS;
    const v = b.sample(now)!;
    expect(v.players[0]!.x).toBeCloseTo(15);
    expect(v.players[0]!.slot).toBe(1);
  });

  it('takes non-player fields from the nearer snapshot', () => {
    const b = new SnapshotBuffer();
    b.push(snap(10, 0), arrival(10));
    b.push(snap(13, 30), arrival(13));
    const near10 = b.sample(10.5 * TICK_MS + LATENCY + INTERP_DELAY_MS)!;
    const near13 = b.sample(12.5 * TICK_MS + LATENCY + INTERP_DELAY_MS)!;
    expect(near10.tick).toBe(10);
    expect(near13.tick).toBe(13);
  });

  it('extrapolates at most MAX_EXTRAPOLATE_TICKS past the newest snapshot, then holds', () => {
    const b = new SnapshotBuffer();
    b.push(snap(10, 0), arrival(10));
    b.push(snap(11, 5), arrival(11));
    const far = b.sample(arrival(11) + 2000)!;
    expect(far.players[0]!.x).toBeCloseTo(5 + 5 * MAX_EXTRAPOLATE_TICKS);
  });

  it('ignores duplicate and out-of-order ticks, and resets for a new round', () => {
    const b = new SnapshotBuffer();
    b.push(snap(50, 0), arrival(50));
    b.push(snap(49, 999), arrival(50));
    b.push(snap(50, 999), arrival(50));
    expect(b.newest!.players[0]!.x).toBe(0);
    b.push(snap(2, 7), 99999);
    expect(b.newest!.tick).toBe(2);
    expect(b.sample(99999)!.players[0]!.x).toBe(7);
  });

  it('the clock offset follows the earliest arrival and absorbs jitter', () => {
    const b = new SnapshotBuffer();
    b.push(snap(10, 0), arrival(10) + 40); // late
    b.push(snap(11, 0), arrival(11)); // on time: offset drops at once
    expect(b.renderTick(arrival(11))).toBeCloseTo(11 - INTERP_DELAY_MS / TICK_MS);
    b.push(snap(12, 0), arrival(12) + 40); // late again: offset barely moves
    expect(b.renderTick(arrival(12))!).toBeGreaterThan(12 - INTERP_DELAY_MS / TICK_MS - 0.1);
  });

  it('stays smooth at the 20 Hz cadence with jitter and 5% dropped snapshots', () => {
    // A remote player moving right at 150 px/s (5 px per tick). Server sends on 2 of 3 ticks.
    const rng = createRng(7);
    const b = new SnapshotBuffer();
    const arrivals: { at: number; s: BaseSnapshot }[] = [];
    for (let tick = 1; tick <= 300; tick++) {
      if (Math.floor((tick * 20) / 30) === Math.floor(((tick - 1) * 20) / 30)) continue;
      if (nextFloat(rng) < 0.05) continue;
      arrivals.push({ at: arrival(tick) + nextFloat(rng) * 20, s: snap(tick, tick * 5) });
    }
    arrivals.sort((p, q) => p.at - q.at);
    let i = 0;
    let lastX: number | null = null;
    let maxStep = 0;
    for (let now = 0; now < arrival(300); now += 1000 / 60) {
      while (i < arrivals.length && arrivals[i]!.at <= now)
        b.push(arrivals[i]!.s, arrivals[i++]!.at);
      const v = b.sample(now);
      if (!v || now < 1000) continue; // warm-up
      const x = v.players[0]!.x;
      if (lastX !== null) {
        expect(x).toBeGreaterThanOrEqual(lastX - 1e-9); // never jumps backwards
        maxStep = Math.max(maxStep, x - lastX);
      }
      lastX = x;
    }
    // One 60 Hz frame of true motion is 2.5 px; allow some catch-up but no visible jumps.
    expect(maxStep).toBeLessThan(5);
  });
});
