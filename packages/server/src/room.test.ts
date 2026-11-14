import { afterEach, describe, expect, it, vi } from 'vitest';
import { PROTOCOL_VERSION, type ServerMessage } from '@monkey-mania-2/shared';
import { Connection } from './connection.js';
import { RateLimiter } from './rate-limit.js';
import { RoomManager } from './rooms.js';

class FakeSocket {
  sent: ServerMessage[] = [];
  send(d: string) {
    this.sent.push(JSON.parse(d) as ServerMessage);
  }
  close() {}
  last(type: string) {
    return [...this.sent].reverse().find((m) => m.type === type);
  }
}

const started = vi.fn();
let mgr: RoomManager;
function setup(emptyRoomMs = 1000) {
  mgr = new RoomManager({ hooks: { onMatchStart: started }, config: { emptyRoomMs } });
}
function client() {
  const socket = new FakeSocket();
  const conn = new Connection(socket, mgr);
  const send = (m: object) => conn.receive(JSON.stringify(m));
  return { socket, conn, send };
}
const create = (c: ReturnType<typeof client>, name = 'Host') =>
  c.send({ type: 'createRoom', v: PROTOCOL_VERSION, name });
const join = (c: ReturnType<typeof client>, code: string, name = 'P') =>
  c.send({ type: 'joinRoom', v: PROTOCOL_VERSION, code, name });
const code = (c: ReturnType<typeof client>) =>
  (c.socket.last('roomState') as { code: string }).code;
const errCode = (c: ReturnType<typeof client>) =>
  (c.socket.last('error') as { code: string } | undefined)?.code;

afterEach(() => {
  mgr.close();
  vi.useRealTimers();
  started.mockClear();
});

describe('rooms', () => {
  it('creates a room with a valid code; creator is host in slot 0', () => {
    setup();
    const a = client();
    create(a);
    expect(code(a)).toMatch(/^[A-Z]{4}$/);
    expect(a.socket.last('joined')).toMatchObject({ slot: 0 });
    expect(a.socket.last('roomState')).toMatchObject({ host: 0, phase: 'LOBBY' });
  });

  it('joins by code and broadcasts state to everyone', () => {
    setup();
    const a = client();
    const b = client();
    create(a);
    join(b, code(a), 'Bea');
    expect(b.socket.last('joined')).toMatchObject({ slot: 1 });
    const seats = (a.socket.last('roomState') as { seats: ({ name: string } | null)[] }).seats;
    expect(seats[1]?.name).toBe('Bea');
  });

  it('rejects bad codes and full rooms', () => {
    setup();
    const a = client();
    create(a);
    const x = client();
    join(x, 'ZZZZ');
    expect(errCode(x)).toBe('roomNotFound');
    const y = client();
    join(y, 'bad');
    expect(errCode(y)).toBe('badMessage');
    for (let i = 0; i < 3; i++) join(client(), code(a));
    const late = client();
    join(late, code(a));
    expect(errCode(late)).toBe('roomFull');
  });

  it('sanitises names', () => {
    setup();
    const a = client();
    a.send({
      type: 'createRoom',
      v: PROTOCOL_VERSION,
      name: '  Ann\u0007\nLong Name That Is Too Long ',
    });
    const seats = (a.socket.last('roomState') as { seats: ({ name: string } | null)[] }).seats;
    expect(seats[0]?.name.length).toBeLessThanOrEqual(12);
    expect(seats[0]?.name).not.toContain('\u0007');
  });

  it('hands the host to the next human and frees seats on leave', () => {
    setup();
    const a = client();
    const b = client();
    create(a);
    join(b, code(a));
    a.conn.disconnect();
    const rs = b.socket.last('roomState') as { host: number; seats: unknown[] };
    expect(rs.host).toBe(1);
    expect(rs.seats[0]).toBeNull();
    const c = client();
    join(c, code(b));
    expect(c.socket.last('joined')).toMatchObject({ slot: 0 });
  });

  it('deletes empty rooms after the timeout, unless someone rejoins', () => {
    vi.useFakeTimers();
    setup(1000);
    const a = client();
    create(a);
    const c = code(a);
    a.send({ type: 'leave' });
    vi.advanceTimersByTime(500);
    const b = client();
    join(b, c);
    vi.advanceTimersByTime(5000);
    expect(mgr.get(c)).toBeDefined();
    b.conn.disconnect();
    vi.advanceTimersByTime(1001);
    expect(mgr.get(c)).toBeUndefined();
    expect(mgr.size).toBe(0);
  });

  it('only the host can start, and only when all humans are ready', () => {
    setup();
    const a = client();
    const b = client();
    create(a);
    join(b, code(a));
    b.send({ type: 'startMatch' });
    expect(errCode(b)).toBe('notHost');
    a.send({ type: 'startMatch' });
    expect(errCode(a)).toBe('badPhase');
    a.send({ type: 'setReady', ready: true });
    b.send({ type: 'setReady', ready: true });
    a.send({ type: 'startMatch' });
    expect(started).toHaveBeenCalledTimes(1);
    const rs = a.socket.last('roomState') as {
      phase: string;
      seats: ({ isBot: boolean } | null)[];
    };
    expect(rs.phase).toBe('INTRO');
    expect(rs.seats.map((s) => s?.isBot)).toEqual([false, false, true, true]);
  });

  it('rejects joins after the match starts and handles setBotCount permissions', () => {
    setup();
    const a = client();
    const b = client();
    create(a);
    join(b, code(a));
    b.send({ type: 'setBotCount', count: 1 });
    expect(errCode(b)).toBe('notHost');
    a.send({ type: 'setReady', ready: true });
    b.send({ type: 'setReady', ready: true });
    a.send({ type: 'startMatch' });
    const late = client();
    join(late, code(a));
    expect(errCode(late)).toBe('badPhase');
  });

  it('rejects room messages before joining', () => {
    setup();
    const a = client();
    a.send({ type: 'setReady', ready: true });
    expect(errCode(a)).toBe('badPhase');
  });

  it('replies with errors for invalid messages', () => {
    setup();
    const a = client();
    a.conn.receive('not json');
    expect(errCode(a)).toBe('badJson');
    a.conn.receive(JSON.stringify({ type: 'nope' }));
    expect(errCode(a)).toBe('unknownType');
  });

  it('rate limits a flooding connection', () => {
    setup();
    const a = client();
    create(a);
    for (let i = 0; i < 300; i++) a.send({ type: 'setReady', ready: i % 2 === 0 });
    expect(errCode(a)).toBe('rateLimited');
  });
});

describe('RateLimiter', () => {
  it('refills over time', () => {
    let t = 0;
    const rl = new RateLimiter(2, 1, () => t);
    expect(rl.allow()).toBe(true);
    expect(rl.allow()).toBe(true);
    expect(rl.allow()).toBe(false);
    t = 1000;
    expect(rl.allow()).toBe(true);
  });
});
