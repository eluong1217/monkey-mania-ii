import { describe, expect, it } from 'vitest';
import {
  createBotFor,
  DIFFICULTIES,
  PROTOCOL_VERSION,
  runRound,
  sandbox,
  withDifficulty,
  type AnyMiniGame,
  type PlayerInput,
  type RoomPhase,
  type SeatInfo,
  type ServerMessage,
} from '@monkey-mania-2/shared';
import { Connection } from './connection.js';
import { botSeed, InputBuffer, Match, startMatch, type MatchRoom } from './match.js';
import { RoomManager } from './rooms.js';
import { MAX_CATCH_UP, Ticker, type Clock } from './ticker.js';

const PERIOD = 1000 / 30;
const INTRO_TICKS = 90;
const PLAY_TICKS = 300; // sandbox: 10 s
const RESULTS_TICKS = 120;

class FakeClock implements Clock {
  t = 0;
  private id = 0;
  timers: { at: number; fn: () => void; id: number }[] = [];
  /** Extra lateness added to each timer, to mimic a jittery event loop. */
  jitter: () => number = () => 0;
  now() {
    return this.t;
  }
  setTimeout(fn: () => void, ms: number) {
    const id = ++this.id;
    this.timers.push({ at: this.t + ms + this.jitter(), fn, id });
    return id;
  }
  clearTimeout(id: unknown) {
    this.timers = this.timers.filter((x) => x.id !== id);
  }
  advance(ms: number) {
    const end = this.t + ms;
    for (;;) {
      this.timers.sort((a, b) => a.at - b.at);
      const next = this.timers[0];
      if (!next || next.at > end) break;
      this.timers.shift();
      this.t = Math.max(this.t, next.at);
      next.fn();
    }
    this.t = end;
  }
}

class FakeSocket {
  sent: ServerMessage[] = [];
  send(d: string) {
    this.sent.push(JSON.parse(d) as ServerMessage);
  }
  close() {}
}

const constant = (input: PlayerInput) => (): PlayerInput => ({ ...input });

const BOT_SEATS: SeatInfo[] = [0, 1, 2, 3].map((slot) => ({
  slot,
  name: `Bot ${slot + 1}`,
  isBot: true,
  ready: true,
  connected: true,
}));

function fakeRoom() {
  const sent: ServerMessage[] = [];
  const room: MatchRoom & { sent: ServerMessage[] } = {
    phase: 'INTRO' as RoomPhase,
    match: null,
    sent,
    seatInfo: () => BOT_SEATS,
    broadcast: (m) => sent.push(m),
    broadcastState: () => {},
    isEmpty: () => false,
  };
  return room;
}

/** Two humans (slots 0 and 1) through real Connections, two bots, a fake clock. */
function humanRoom(seed: number) {
  const clock = new FakeClock();
  let match: Match | undefined;
  const mgr = new RoomManager({
    hooks: { onMatchStart: (room) => (match = startMatch(room, 'sandbox', { clock, seed })) },
  });
  const client = () => {
    const socket = new FakeSocket();
    const conn = new Connection(socket, mgr, () => clock.now());
    return { socket, conn, send: (m: unknown) => conn.receive(JSON.stringify(m)) };
  };
  const a = client();
  const b = client();
  a.send({ type: 'createRoom', v: PROTOCOL_VERSION, name: 'A' });
  const code = (a.socket.sent.find((m) => m.type === 'roomState') as { code: string }).code;
  b.send({ type: 'joinRoom', v: PROTOCOL_VERSION, code, name: 'B' });
  a.send({ type: 'setReady', ready: true });
  b.send({ type: 'setReady', ready: true });
  a.send({ type: 'startMatch' });
  const room = mgr.get(code)!;
  return { clock, mgr, room, a, b, match: () => match! };
}

const INPUT_A: PlayerInput = { moveX: 1, moveY: 0.5, action: true };
const INPUT_B: PlayerInput = { moveX: 1, moveY: 0, action: false };

function expectedRound(seed: number) {
  const bot = (slot: number) =>
    withDifficulty(createBotFor('sandbox'), DIFFICULTIES.normal, botSeed(seed, slot));
  return runRound(sandbox, seed, [constant(INPUT_A), constant(INPUT_B), bot(2), bot(3)]);
}

const snapshots = (sent: ServerMessage[]) =>
  sent.filter((m): m is Extract<ServerMessage, { type: 'snapshot' }> => m.type === 'snapshot');

describe('match loop', () => {
  it('runs a sandbox round with 2 scripted humans and 2 bots', () => {
    const seed = 987654321;
    const { clock, room, a, b, match, mgr } = humanRoom(seed);
    let ticks = 0;
    while (room.phase !== 'PODIUM' && ticks < 1000) {
      a.send({ type: 'input', tick: ticks, input: INPUT_A });
      b.send({ type: 'input', tick: ticks, input: INPUT_B });
      clock.advance(PERIOD);
      ticks++;
    }
    expect(ticks).toBe(INTRO_TICKS + PLAY_TICKS + RESULTS_TICKS);
    expect(room.match).toBeNull();
    expect(clock.timers).toHaveLength(0);
    expect(match().ticker.stats.skipped).toBe(0);

    const expected = expectedRound(seed);
    const sent = a.socket.sent;
    const snaps = snapshots(sent);
    expect(snaps).toHaveLength(200); // 20 Hz over 10 s
    expect(snapshots(b.socket.sent)).toHaveLength(200);
    expect(snaps.at(-1)!.state).toEqual(JSON.parse(JSON.stringify(expected.snapshot)));
    expect(snaps.at(-1)!.tick).toBe(expected.ticks);

    const types = sent.map((m) => m.type);
    const intro = types.indexOf('roundIntro');
    const result = types.indexOf('roundResult');
    expect(intro).toBeGreaterThan(-1);
    expect(intro).toBeLessThan(types.indexOf('snapshot'));
    expect(result).toBeGreaterThan(types.lastIndexOf('snapshot'));
    const rr = sent[result] as Extract<ServerMessage, { type: 'roundResult' }>;
    expect(rr.placements).toEqual(expected.placements);
    expect(rr.placements).toEqual([[0], [1], [2], [3]]);
    expect(rr.scores.map((s) => s.points)).toEqual([3, 2, 1, 0]);
    expect(types).toContain('matchResult');

    const phases = sent.flatMap((m) => (m.type === 'roomState' ? [m.phase] : []));
    expect([...new Set(phases)]).toEqual(['LOBBY', 'INTRO', 'PLAYING', 'RESULTS', 'PODIUM']);
    // The seed is never sent.
    expect(JSON.stringify(sent)).not.toContain(String(seed));
    mgr.close();
  });

  it('a flooding, garbage-sending client cannot affect anyone else or stall the loop', () => {
    const seed = 42;
    const run = (flood: boolean) => {
      const { clock, room, a, b, mgr, match } = humanRoom(seed);
      let ticks = 0;
      while (room.phase !== 'PODIUM' && ticks < 1000) {
        a.send({ type: 'input', tick: ticks, input: INPUT_A });
        b.send({ type: 'input', tick: ticks, input: INPUT_B });
        if (flood) {
          // Through the connection: a spoofed slot that sanitises to INPUT_B gets past the
          // rate limiter (2 messages per tick); the flood after it is dropped there.
          b.send({ type: 'input', tick: 1, slot: 0, input: { moveX: 1e9, moveY: 'up' } });
          for (let i = 0; i < 50; i++) {
            b.conn.receive('not json {');
            b.conn.receive(null);
            b.conn.receive('x'.repeat(5000));
            b.send({ type: 'input', tick: -1, input: { moveX: -1 } });
            b.send({ type: 'input', tick: 1, input: 'left' });
            // These sanitise to INPUT_B: clamped, non-numbers zeroed, a bogus slot ignored.
            b.send({ type: 'input', tick: 1, slot: 0, input: { moveX: 1e9, moveY: 'up' } });
            b.send({ type: 'input', tick: 1, input: { moveX: 5, action: 'yes' } });
            b.send({ type: 'setReady', ready: true });
            b.send({ type: 'startMatch' });
          }
          // Straight into the match, past the rate limiter: everything is sanitised and the
          // latest input wins (the last one sanitises to INPUT_B).
          const m = match();
          const raw = (x: unknown) => m.input(1, x as PlayerInput);
          raw({ moveX: -1, moveY: 1, action: true });
          raw('left');
          raw(null);
          raw({ moveX: NaN, moveY: Infinity, action: 1 });
          raw({ moveX: 5, action: 'yes' });
        }
        clock.advance(PERIOD);
        ticks++;
      }
      const snaps = snapshots(a.socket.sent);
      mgr.close();
      return { ticks, count: snaps.length, last: snaps.at(-1)!.state };
    };
    const calm = run(false);
    const noisy = run(true);
    expect(noisy.ticks).toBe(calm.ticks);
    expect(noisy.count).toBe(200);
    expect(noisy.last).toEqual(calm.last);
  });

  it('stops and cleans up when every human leaves mid-round', () => {
    let ended = '';
    const clock = new FakeClock();
    const mgr = new RoomManager({
      hooks: {
        onMatchStart: (room) => startMatch(room, 'sandbox', { clock, onEnd: (r) => (ended = r) }),
      },
    });
    const socket = new FakeSocket();
    const conn = new Connection(socket, mgr, () => clock.now());
    conn.receive(JSON.stringify({ type: 'createRoom', v: PROTOCOL_VERSION, name: 'A' }));
    conn.receive(JSON.stringify({ type: 'setReady', ready: true }));
    conn.receive(JSON.stringify({ type: 'startMatch' }));
    clock.advance(PERIOD * (INTRO_TICKS + 30));
    const room = mgr.get(
      (socket.sent.find((m) => m.type === 'roomState') as { code: string }).code,
    )!;
    expect(room.phase).toBe('PLAYING');
    conn.disconnect();
    clock.advance(PERIOD * 2);
    expect(ended).toBe('empty');
    expect(room.match).toBeNull();
    // The match left nothing scheduled on its clock.
    expect(clock.timers).toHaveLength(0);
    mgr.close();
  });

  it("one room's exception does not affect another room", () => {
    const clock = new FakeClock();
    const broken: AnyMiniGame = {
      ...sandbox,
      id: 'broken',
      step(state, inputs, tick) {
        if (tick === 5) throw new Error('boom');
        return sandbox.step(state, inputs, tick);
      },
    };
    const logs: string[] = [];
    const bad = fakeRoom();
    const good = fakeRoom();
    let badEnd = '';
    let goodEnd = '';
    const m1 = new Match(bad, broken, {
      clock,
      seed: 1,
      log: (e) => logs.push(e),
      onEnd: (r) => (badEnd = r),
    });
    const m2 = new Match(good, sandbox, { clock, seed: 2, onEnd: (r) => (goodEnd = r) });
    bad.match = m1;
    good.match = m2;
    m1.start();
    m2.start();
    clock.advance(PERIOD * (INTRO_TICKS + PLAY_TICKS + RESULTS_TICKS + 5));
    expect(badEnd).toBe('error');
    expect(bad.phase).toBe('PODIUM');
    expect(bad.match).toBeNull();
    expect(logs).toContain('matchError');
    expect(goodEnd).toBe('finished');
    expect(snapshots(good.sent)).toHaveLength(200);
  });

  it('always sends the final state, even off the 20 Hz cadence', () => {
    const clock = new FakeClock();
    let steps = 0;
    // Ends after tick 4 (sim tick after the step), which is not a 20 Hz snapshot tick.
    const short: AnyMiniGame = {
      ...sandbox,
      id: 'short',
      step(state, inputs, tick) {
        steps++;
        return sandbox.step(state, inputs, tick);
      },
      isOver: () => steps >= 4,
    };
    const room = fakeRoom();
    const m = new Match(room, short, { clock, seed: 4 });
    room.match = m;
    m.start();
    clock.advance(PERIOD * (INTRO_TICKS + 10));
    const types = room.sent.map((x) => x.type);
    const snaps = snapshots(room.sent);
    expect(snaps.map((s) => s.tick)).toEqual([2, 3, 4]);
    expect(types.indexOf('roundResult')).toBe(types.lastIndexOf('snapshot') + 1);
  });

  it('ignores input outside PLAYING and stops cleanly', () => {
    const clock = new FakeClock();
    const room = fakeRoom();
    const m = new Match(room, sandbox, { clock, seed: 3 });
    m.start();
    expect(() => m.input(0, { moveX: 1, moveY: 0, action: true })).not.toThrow();
    m.stop();
    expect(clock.timers).toHaveLength(0);
  });
});

describe('InputBuffer', () => {
  it('keeps the latest input briefly, then goes neutral', () => {
    const buf = new InputBuffer(8);
    expect(buf.get(0, 0)).toEqual({ moveX: 0, moveY: 0, action: false });
    buf.set(0, { moveX: 1, moveY: 0, action: false }, 10);
    buf.set(0, { moveX: 0, moveY: -1, action: true }, 10);
    expect(buf.get(0, 10)).toEqual({ moveX: 0, moveY: -1, action: true });
    expect(buf.get(0, 18)).toEqual({ moveX: 0, moveY: -1, action: true });
    expect(buf.get(0, 19)).toEqual({ moveX: 0, moveY: 0, action: false });
    expect(buf.get(1, 10)).toEqual({ moveX: 0, moveY: 0, action: false });
  });
});

describe('Ticker', () => {
  it('does not drift under timer jitter', () => {
    const clock = new FakeClock();
    let n = 0;
    clock.jitter = (() => {
      let i = 0;
      return () => ((i++ * 7919) % 13) / 2; // 0..6 ms late, deterministic
    })();
    const t = new Ticker(clock, 30, () => n++);
    t.start();
    clock.advance(10_000);
    expect(n).toBeGreaterThanOrEqual(299);
    expect(n).toBeLessThanOrEqual(300);
    expect(t.stats.skipped).toBe(0);
    t.stop();
  });

  it('catches up a few ticks after a stall, then skips the rest', () => {
    const clock = new FakeClock();
    let n = 0;
    let stall = false;
    const t = new Ticker(clock, 30, () => {
      n++;
      if (stall) {
        stall = false;
        clock.t += 500; // a 500 ms pause inside one tick
      }
    });
    t.start();
    clock.advance(PERIOD * 10);
    expect(n).toBe(10);
    stall = true;
    clock.advance(PERIOD);
    // The stalled tick, then at most MAX_CATCH_UP - 1 more in the same wake.
    expect(n).toBe(10 + MAX_CATCH_UP);
    expect(t.stats.skipped).toBeGreaterThan(0);
    t.stop();
  });
});
