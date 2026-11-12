import { describe, expect, it } from 'vitest';
import {
  createRng,
  DT,
  nextFloat,
  NEUTRAL_INPUT,
  sandbox,
  type PlayerInput,
  type SandboxState,
} from '@monkey-mania-2/shared';
import { TICK_MS } from './interpolation';
import { CORRECTION_RATE, DEFAULT_LAG_TICKS, Predictor, SNAP_DISTANCE } from './prediction';

const SPEED = 150;
const SANDBOX_SPEED = sandbox.tuning.moveSpeed as number;
const R = 12;
const RIGHT: PlayerInput = { moveX: 1, moveY: 0, action: false };

describe('Predictor', () => {
  it('moves at the mini-game speed and stays inside the arena', () => {
    const p = new Predictor();
    p.reset(100, 100);
    p.step(RIGHT, SPEED, R);
    expect(p.x).toBeCloseTo(100 + SPEED * DT);
    expect(p.prevX).toBe(100);
    p.reset(630, 100);
    p.step(RIGHT, SPEED, R);
    expect(p.x).toBe(640 - R);
  });

  it('does nothing until reset, and the first reconcile resets', () => {
    const p = new Predictor();
    p.step(RIGHT, SPEED, R);
    expect(p.ready).toBe(false);
    p.reconcile(50, 60, 1);
    expect([p.ready, p.x, p.y]).toEqual([true, 50, 60]);
  });

  it('compares against the position `lag` ticks ago, not the current one', () => {
    const p = new Predictor();
    p.reset(100, 100);
    for (let i = 0; i < 10; i++) p.step(RIGHT, SPEED, R);
    // The server is exactly DEFAULT_LAG_TICKS behind: no error, even though we are 25 px ahead.
    const lagged = 100 + (10 - DEFAULT_LAG_TICKS) * SPEED * DT;
    p.reconcile(lagged, 100, 1);
    expect(p.lastError).toBeCloseTo(0);
    expect(p.x).toBeCloseTo(100 + 10 * SPEED * DT);
  });

  it('removes a small error smoothly, CORRECTION_RATE per tick, without overshoot', () => {
    const p = new Predictor();
    p.reset(100, 100);
    p.reconcile(110, 100, 1); // 10 px error while standing still
    expect(p.lastError).toBeCloseTo(10);
    expect(p.x).toBe(100); // nothing applied yet
    p.step(NEUTRAL_INPUT, SPEED, R);
    expect(p.x).toBeCloseTo(100 + 10 * CORRECTION_RATE);
    for (let i = 0; i < 40; i++) p.step(NEUTRAL_INPUT, SPEED, R);
    expect(p.x).toBeCloseTo(110, 3);
    // The same server position again: history was shifted too, so there is nothing left to fix.
    p.reconcile(110, 100, 2);
    expect(p.lastError).toBeCloseTo(0, 3);
  });

  it('a newer measurement replaces the pending correction instead of adding to it', () => {
    const p = new Predictor();
    p.reset(100, 100);
    p.reconcile(120, 100, 1);
    p.step(NEUTRAL_INPUT, SPEED, R); // applied 5 px
    p.reconcile(120, 100, 2); // 15 px left, not 15 + 15
    for (let i = 0; i < 60; i++) p.step(NEUTRAL_INPUT, SPEED, R);
    expect(p.x).toBeCloseTo(120, 3);
  });

  it('snaps when the error is larger than SNAP_DISTANCE', () => {
    const p = new Predictor();
    p.reset(100, 100);
    p.reconcile(100 + SNAP_DISTANCE + 1, 200, 1);
    expect(p.x).toBe(100 + SNAP_DISTANCE + 1);
    expect(p.y).toBe(200);
    expect(p.prevX).toBe(p.x); // no tween across the snap
  });

  it('learns the lag from motion and ignores standing still', () => {
    const p = new Predictor();
    p.reset(100, 100);
    const trail: number[] = [];
    // Stand still for 20 ticks, then move: the start is what pins the lag down.
    for (let i = 0; i < 80; i++) {
      p.step(i < 20 ? NEUTRAL_INPUT : RIGHT, SPEED, R);
      trail.push(p.x);
      if (i >= 10) p.reconcile(trail[i - 10]!, 100, i); // the server is 10 ticks behind
      if (i === 25) expect(p.lag).toBe(DEFAULT_LAG_TICKS); // still only standing still
    }
    expect(p.lag).toBeGreaterThan(9.5);
    expect(p.pingMs).toBeCloseTo(p.lag * TICK_MS);
  });
});

/**
 * End to end, headless: the real sandbox sim as the server, 150 ms round trip (75 ms each way,
 * ±5 ms jitter), 5% of snapshots dropped, snapshots on 2 of every 3 ticks.
 */
describe('prediction against a laggy server', () => {
  it('does not rubber-band while moving, turning and stopping', () => {
    const rng = createRng(42);
    const oneWay = () => 75 + (nextFloat(rng) - 0.5) * 10;
    let state: SandboxState = sandbox.init(1, [0]);
    let serverInput: PlayerInput = { ...NEUTRAL_INPUT };
    const p = new Predictor();
    const toServer: { at: number; input: PlayerInput }[] = [];
    const toClient: { at: number; x: number; y: number; tick: number }[] = [];
    const script = (tick: number): PlayerInput => {
      const phase = Math.floor(tick / 30) % 5; // right, down, stop, left, up+left
      return [
        { moveX: 1, moveY: 0, action: false },
        { moveX: 0, moveY: 1, action: false },
        NEUTRAL_INPUT,
        { moveX: -1, moveY: 0, action: false },
        { moveX: -Math.SQRT1_2, moveY: -Math.SQRT1_2, action: false },
      ][phase]!;
    };

    let maxError = 0;
    let maxJump = 0;
    let clientTick = 0;
    let serverTick = 0;
    const serverPhase = 13; // ms; the two 30 Hz clocks are not aligned
    const end = 290 * TICK_MS;
    for (let now = 0; now < end; now += 1) {
      // Deliveries due now.
      while (toServer[0] && toServer[0].at <= now) serverInput = toServer.shift()!.input;
      while (toClient[0] && toClient[0].at <= now) {
        const s = toClient.shift()!;
        p.reconcile(s.x, s.y, s.tick);
        if (now > 1000) maxError = Math.max(maxError, p.lastError);
      }
      // Server tick.
      if (now >= serverPhase + serverTick * TICK_MS) {
        state = sandbox.step(state, [serverInput], serverTick);
        serverTick++;
        const snapTick =
          Math.floor((serverTick * 20) / 30) > Math.floor(((serverTick - 1) * 20) / 30);
        if (serverTick === 1) p.reset(state.players[0]!.body.x, state.players[0]!.body.y);
        else if (snapTick && nextFloat(rng) >= 0.05) {
          const b = state.players[0]!.body;
          toClient.push({ at: now + oneWay(), x: b.x, y: b.y, tick: serverTick });
          toClient.sort((a, c) => a.at - c.at);
        }
      }
      // Client tick.
      if (now >= clientTick * TICK_MS) {
        const input = script(clientTick);
        toServer.push({ at: now + oneWay(), input });
        toServer.sort((a, c) => a.at - c.at);
        const before = { x: p.x, y: p.y };
        p.step(input, SANDBOX_SPEED, R);
        maxJump = Math.max(maxJump, Math.hypot(p.x - before.x, p.y - before.y));
        clientTick++;
      }
    }
    // The learned lag matches the round trip, measured in whole client ticks (~133-167 ms here).
    expect(p.pingMs).toBeGreaterThan(120);
    expect(p.pingMs).toBeLessThan(200);
    // At most about one tick of motion is ever mispredicted (an input landing on the other side
    // of a server tick), and it is smoothed: per-tick motion never exceeds speed + a little.
    expect(maxError).toBeLessThan(SANDBOX_SPEED * DT + 0.5);
    expect(maxJump).toBeLessThan(SANDBOX_SPEED * DT + 2);
  });
});
