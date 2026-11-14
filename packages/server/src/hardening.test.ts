import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import { PROTOCOL_VERSION, sandbox, type ServerMessage } from '@monkey-mania-2/shared';
import { createApp, type App } from './app.js';
import { configFromEnv, DEFAULT_CONFIG, type ServerConfig } from './config.js';
import { Connection } from './connection.js';
import { Match } from './match.js';
import type { RoomHooks } from './room.js';
import { RoomManager } from './rooms.js';
import type { Clock } from './ticker.js';

const PERIOD = 1000 / 30;

class FakeClock implements Clock {
  t = 0;
  private id = 0;
  timers: { at: number; fn: () => void; id: number }[] = [];
  now() {
    return this.t;
  }
  setTimeout(fn: () => void, ms: number) {
    const id = ++this.id;
    this.timers.push({ at: this.t + ms, fn, id });
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
  closedWith: number | undefined;
  send(d: string) {
    this.sent.push(JSON.parse(d) as ServerMessage);
  }
  close(code?: number) {
    this.closedWith = code;
  }
  last<T extends ServerMessage['type']>(type: T) {
    return [...this.sent].reverse().find((m) => m.type === type) as
      Extract<ServerMessage, { type: T }> | undefined;
  }
}

type RoundResult = Extract<ServerMessage, { type: 'roundResult' }>;

/** A manager whose matches are two sandbox rounds on a fake clock. */
function world(config: Partial<ServerConfig> = {}, hooks?: RoomHooks) {
  const clock = new FakeClock();
  const logs: { event: string; data: Record<string, unknown> }[] = [];
  const mgr = new RoomManager({
    hooks: hooks ?? {
      onMatchStart: (room) => {
        const m = new Match(room, [sandbox], { clock, seed: 7, rounds: 2, log: () => {} });
        room.match = m;
        m.start();
      },
    },
    config,
    now: () => clock.now(),
    log: (event, data = {}) => logs.push({ event, data }),
  });
  const client = () => {
    const socket = new FakeSocket();
    const conn = new Connection(socket, mgr, () => clock.now());
    return { socket, conn, send: (m: unknown) => conn.receive(JSON.stringify(m)) };
  };
  return { clock, mgr, client, logs };
}

type Client = ReturnType<ReturnType<typeof world>['client']>;

/** Host A and guest B in a started match. */
function started(config: Partial<ServerConfig> = {}) {
  const w = world(config);
  const a = w.client();
  const b = w.client();
  a.send({ type: 'createRoom', v: PROTOCOL_VERSION, name: 'A' });
  const code = a.socket.last('roomState')!.code;
  b.send({ type: 'joinRoom', v: PROTOCOL_VERSION, code, name: 'B' });
  a.send({ type: 'setReady', ready: true });
  b.send({ type: 'setReady', ready: true });
  a.send({ type: 'startMatch' });
  const room = w.mgr.get(code)!;
  const until = (pred: () => boolean, inputs: Client[] = []) => {
    for (let i = 0; i < 5000 && !pred(); i++) {
      for (const c of inputs)
        c.send({ type: 'input', tick: i, input: { moveX: 1, moveY: 0, action: true } });
      w.clock.advance(PERIOD);
    }
    expect(pred()).toBe(true);
  };
  const token = (c: Client) => c.socket.last('joined')!.rejoinToken;
  return { ...w, a, b, code, room, until, token };
}

const rejoin = (c: Client, code: string, rejoinToken: string, name = 'Someone else') =>
  c.send({ type: 'joinRoom', v: PROTOCOL_VERSION, code, name, rejoinToken });

describe('reconnect', () => {
  it('a player who drops mid-round is played by a bot and gets their seat and score back', () => {
    const s = started();
    const { room, a, b, until } = s;
    until(() => room.phase === 'RESULTS', [a, b]);
    const r1 = b.socket.last('roundResult')!;
    const bTotal = r1.scores.find((x) => x.slot === 1)!.total;
    until(() => room.phase === 'PLAYING', [a, b]);
    s.clock.advance(PERIOD * 30);

    const token = s.token(b);
    b.conn.disconnect();
    expect(room.seatInfo()[1]).toMatchObject({ connected: false });
    // While B is away a bot moves the seat (a silent human would stand still).
    const pos = () => a.socket.last('snapshot')!.state.players.find((p) => p.slot === 1)!;
    const before = { ...pos() };
    s.clock.advance(PERIOD * 60);
    expect(Math.hypot(pos().x - before.x, pos().y - before.y)).toBeGreaterThan(1);

    const b2 = s.client();
    rejoin(b2, s.code, token);
    expect(b2.socket.last('joined')).toMatchObject({ slot: 1, rejoinToken: token });
    const seat = b2.socket.last('roomState')!.seats[1];
    expect(seat).toMatchObject({ name: 'B', connected: true, isBot: false });
    // Catch-up: last round's result (for the totals), then this round's intro, in that order.
    const types = b2.socket.sent.map((m) => m.type);
    expect(types.slice(0, 2)).toEqual(['joined', 'roomState']);
    expect(types.slice(2)).toEqual(['roundResult', 'roundIntro']);
    expect(b2.socket.last('roundIntro')).toMatchObject({ round: 2 });

    // Back in control: B's own input drives the seat again.
    for (let i = 0; i < 30; i++) {
      b2.send({ type: 'input', tick: i, input: { moveX: 0, moveY: 0, action: false } });
      s.clock.advance(PERIOD);
    }
    const still = { ...pos() };
    for (let i = 30; i < 60; i++) {
      b2.send({ type: 'input', tick: i, input: { moveX: 0, moveY: 0, action: false } });
      s.clock.advance(PERIOD);
    }
    expect(Math.hypot(pos().x - still.x, pos().y - still.y)).toBeLessThan(0.01);

    until(() => room.phase === 'PODIUM', [a, b2]);
    const r2 = b2.socket.last('roundResult') as RoundResult;
    const score = r2.scores.find((x) => x.slot === 1)!;
    expect(score.total).toBe(bTotal + score.points);
    expect(b2.socket.last('matchResult')!.totals.find((x) => x.slot === 1)!.total).toBe(
      score.total,
    );
    expect(s.logs.map((l) => l.event)).toContain('playerRejoined');
    s.mgr.close();
  });

  it('refuses a wrong rejoin token once the match has started', () => {
    const s = started();
    const real = s.token(s.b);
    s.b.conn.disconnect();
    for (const wrong of [
      '0'.repeat(32),
      real.slice(0, -1) + (real.endsWith('0') ? '1' : '0'),
      real.slice(0, 31),
      real + '0',
    ]) {
      const c = s.client();
      rejoin(c, s.code, wrong);
      expect(c.socket.last('error')).toMatchObject({ code: 'badPhase' });
      expect(c.socket.last('joined')).toBeUndefined();
    }
    expect(s.room.seatInfo()[1]).toMatchObject({ connected: false });
    // A bot seat has no token: an empty token never matches it either (rejected at parse).
    const c = s.client();
    rejoin(c, s.code, '');
    expect(c.socket.last('error')).toMatchObject({ code: 'badMessage' });
    s.mgr.close();
  });

  it('a stale token in the lobby just joins as a newcomer', () => {
    const w = world();
    const a = w.client();
    a.send({ type: 'createRoom', v: PROTOCOL_VERSION, name: 'A' });
    const b = w.client();
    rejoin(b, a.socket.last('roomState')!.code, 'f'.repeat(32), 'Bea');
    expect(b.socket.last('joined')).toMatchObject({ slot: 1 });
    w.mgr.close();
  });

  it('rejoining while the old socket is still open takes the seat over', () => {
    const s = started();
    const b2 = s.client();
    rejoin(b2, s.code, s.token(s.b));
    expect(b2.socket.last('joined')).toMatchObject({ slot: 1 });
    expect(s.b.socket.closedWith).toBe(4000);
    expect(s.b.socket.last('error')).toMatchObject({ code: 'badPhase' });
    // The evicted socket closing later does not free the seat it no longer holds.
    s.b.conn.disconnect();
    expect(s.room.seatInfo()[1]).toMatchObject({ connected: true });
    s.mgr.close();
  });
});

describe('host', () => {
  it('hands host to another human mid-match, and to a returning player if nobody else is left', () => {
    const s = started();
    const { room, a, b } = s;
    s.until(() => room.phase === 'PLAYING');
    const tokenA = s.token(a);
    const tokenB = s.token(b);
    a.conn.disconnect();
    expect(b.socket.last('roomState')!.host).toBe(1);
    const a2 = s.client();
    rejoin(a2, s.code, tokenA);
    // B is still here, so B stays host.
    expect(a2.socket.last('roomState')!.host).toBe(1);
    b.conn.disconnect();
    expect(a2.socket.last('roomState')!.host).toBe(0);
    a2.conn.disconnect();
    // Nobody connected: the host seat stays put until someone returns.
    const b2 = s.client();
    rejoin(b2, s.code, tokenB);
    expect(b2.socket.last('roomState')!.host).toBe(1);
    expect(s.logs.filter((l) => l.event === 'hostChanged').length).toBeGreaterThanOrEqual(3);
    s.mgr.close();
  });
});

describe('limits', () => {
  it('refuses new rooms past maxRooms', () => {
    const w = world({ maxRooms: 2 });
    for (let i = 0; i < 2; i++)
      w.client().send({ type: 'createRoom', v: PROTOCOL_VERSION, name: 'A' });
    const c = w.client();
    c.send({ type: 'createRoom', v: PROTOCOL_VERSION, name: 'A' });
    expect(c.socket.last('error')).toMatchObject({ code: 'rateLimited' });
    expect(w.mgr.size).toBe(2);
    w.mgr.close();
  });

  it('closes idle lobby rooms, but activity keeps them open', () => {
    const w = world({ idleLobbyMs: 60_000 });
    const a = w.client();
    a.send({ type: 'createRoom', v: PROTOCOL_VERSION, name: 'A' });
    const busy = w.client();
    busy.send({ type: 'createRoom', v: PROTOCOL_VERSION, name: 'B' });
    w.clock.t = 50_000;
    busy.send({ type: 'setReady', ready: true });
    w.clock.t = 61_000;
    w.mgr.sweepIdle();
    expect(w.mgr.get(a.socket.last('roomState')!.code)).toBeUndefined();
    expect(a.socket.closedWith).toBe(4000);
    expect(a.socket.last('error')?.message).toMatch(/idle/);
    expect(w.mgr.get(busy.socket.last('roomState')!.code)).toBeDefined();
    w.clock.t = 111_000;
    w.mgr.sweepIdle();
    expect(w.mgr.size).toBe(0);
    expect(w.logs.filter((l) => l.event === 'roomRemoved')).toHaveLength(2);
    w.mgr.close();
  });

  it('never sweeps a room with a running match', () => {
    const s = started({ idleLobbyMs: 1000 });
    s.until(() => s.room.phase === 'PLAYING');
    s.clock.t += 10_000;
    s.mgr.sweepIdle();
    expect(s.mgr.get(s.code)).toBe(s.room);
    s.mgr.close();
  });

  it('rate limits messages per second, then closes a socket that keeps flooding', () => {
    const w = world({ messagesPerSecond: 10, messageBurst: 5 });
    const a = w.client();
    a.send({ type: 'createRoom', v: PROTOCOL_VERSION, name: 'A' });
    for (let i = 0; i < 4; i++) a.send({ type: 'setReady', ready: true });
    expect(a.socket.last('error')).toBeUndefined();
    a.send({ type: 'setReady', ready: true });
    expect(a.socket.last('error')).toMatchObject({ code: 'rateLimited' });
    // After a pause the bucket refills and messages flow again.
    w.clock.t += 1000;
    const before = a.socket.sent.length;
    a.send({ type: 'setReady', ready: false });
    expect(a.socket.sent.length).toBe(before + 1);
    expect(a.socket.last('roomState')!.seats[0]?.ready).toBe(false);
    for (let i = 0; i < 20; i++) a.send({ type: 'setReady', ready: true });
    expect(a.socket.closedWith).toBe(1008);
    expect(w.mgr.size).toBe(1); // the room waits out its empty timer like any other leave
    w.mgr.close();
  });

  it('turns a handler exception into a plain error with no details', () => {
    const w = world(
      {},
      {
        onMatchStart: () => {
          throw new Error('secret internals at /srv/app.js:12');
        },
      },
    );
    const a = w.client();
    a.send({ type: 'createRoom', v: PROTOCOL_VERSION, name: 'A' });
    a.send({ type: 'setReady', ready: true });
    a.send({ type: 'startMatch' });
    const e = a.socket.last('error')!;
    expect(e.message).toBe('Something went wrong.');
    expect(JSON.stringify(a.socket.sent)).not.toContain('secret');
    expect(w.logs.find((l) => l.event === 'connectionError')?.data.error).toContain('secret');
    w.mgr.close();
  });

  it('reads limits from the environment', () => {
    const c = configFromEnv({
      MAX_ROOMS: '5',
      HEARTBEAT_MS: 'x',
      IDLE_LOBBY_MS: '-1',
      TRUST_PROXY: '1',
    });
    expect(c.maxRooms).toBe(5);
    expect(c.heartbeatMs).toBe(DEFAULT_CONFIG.heartbeatMs);
    expect(c.idleLobbyMs).toBe(DEFAULT_CONFIG.idleLobbyMs);
    expect(c.trustProxy).toBe(true);
  });
});

describe('socket limits (real server)', () => {
  let app: App | undefined;
  afterEach(() => {
    app?.close();
    app?.closeAllConnections();
    app = undefined;
    vi.useRealTimers();
  });

  async function serve(config: Partial<ServerConfig>) {
    const logs: { event: string; data?: Record<string, unknown> }[] = [];
    app = createApp('/nonexistent', { config, log: (event, data) => logs.push({ event, data }) });
    await new Promise<void>((r) => app!.listen(0, '127.0.0.1', r));
    const url = `ws://127.0.0.1:${(app.address() as AddressInfo).port}/ws`;
    const open = (options?: ConstructorParameters<typeof WebSocket>[2]) => {
      const ws = new WebSocket(url, options);
      const closed = new Promise<number>((r) => ws.on('close', (code) => r(code)));
      const opened = new Promise<void>((r) => ws.on('open', () => r()));
      ws.on('error', () => {});
      return { ws, opened, closed };
    };
    return { open, logs };
  }

  it('closes sockets past maxConnectionsPerIp, without logging the IP', async () => {
    const { open, logs } = await serve({ maxConnectionsPerIp: 2 });
    const a = open();
    const b = open();
    await Promise.all([a.opened, b.opened]);
    const c = open();
    expect(await c.closed).toBe(1008);
    // A freed slot can be reused.
    a.ws.close();
    await a.closed;
    await new Promise((r) => setTimeout(r, 20));
    const d = open();
    await d.opened;
    expect(d.ws.readyState).toBe(WebSocket.OPEN);
    const refused = logs.find((l) => l.event === 'connectionRefused');
    expect(refused?.data?.ip).toMatch(/^[0-9a-f]{10}$/);
    expect(JSON.stringify(logs)).not.toContain('127.0.0.1');
    b.ws.close();
    d.ws.close();
  });

  it('counts per forwarded IP only when trustProxy is on', async () => {
    const { open } = await serve({ maxConnectionsPerIp: 1, trustProxy: true });
    const as = (ip: string) => open({ headers: { 'x-forwarded-for': `6.6.6.6, ${ip}` } });
    const a = as('1.1.1.1');
    const b = as('2.2.2.2');
    await Promise.all([a.opened, b.opened]);
    const c = as('1.1.1.1');
    expect(await c.closed).toBe(1008);
    a.ws.close();
    b.ws.close();
  });

  it('closes a socket that sends a frame over maxMessageBytes', async () => {
    const { open } = await serve({ maxMessageBytes: 2000 });
    const a = open();
    await a.opened;
    a.ws.send('x'.repeat(3000));
    expect(await a.closed).toBe(1009);
  });

  it('terminates a socket that stops answering pings', async () => {
    const { open } = await serve({ heartbeatMs: 50 });
    const dead = open({ autoPong: false });
    const live = open();
    await Promise.all([dead.opened, live.opened]);
    expect(await dead.closed).toBe(1006);
    expect(live.ws.readyState).toBe(WebSocket.OPEN);
    live.ws.close();
  });
});
