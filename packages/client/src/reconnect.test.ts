import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION, type ClientMessage, type ServerMessage } from '@monkey-mania-2/shared';
import { CLOSE_EVICTED, Connection, type SocketLike } from './connection';
import { Reconnector, type Timers } from './reconnect';

class MockSocket implements SocketLike {
  sent: ClientMessage[] = [];
  onopen: (() => void) | null = null;
  onclose: ((ev?: { code?: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  send(d: string) {
    this.sent.push(JSON.parse(d) as ClientMessage);
  }
  close() {}
  deliver(m: ServerMessage) {
    this.onmessage?.({ data: JSON.stringify(m) });
  }
}

class FakeTimers implements Timers {
  pending: { fn: () => void; ms: number; id: number }[] = [];
  private id = 0;
  setTimeout(fn: () => void, ms: number) {
    this.pending.push({ fn, ms, id: ++this.id });
    return this.id;
  }
  clearTimeout(h: unknown) {
    this.pending = this.pending.filter((t) => t.id !== h);
  }
  /** Run the next timer; returns its delay. */
  fire(): number {
    const t = this.pending.shift();
    if (!t) throw new Error('no timer');
    t.fn();
    return t.ms;
  }
}

const REJOIN: ClientMessage = {
  type: 'joinRoom',
  v: PROTOCOL_VERSION,
  code: 'ABCD',
  name: 'Mo',
  rejoinToken: 'a'.repeat(32),
};

async function setup() {
  const sockets: MockSocket[] = [];
  const conn = new Connection(() => {
    const s = new MockSocket();
    sockets.push(s);
    return s;
  });
  const timers = new FakeTimers();
  let inRoom = true;
  const rc = new Reconnector(
    conn,
    () => (inRoom ? REJOIN : null),
    undefined,
    timers,
    [100, 200, 400],
  );
  const p = conn.connect();
  sockets[0]!.onopen?.();
  await p;
  const flush = () => new Promise((r) => setTimeout(r, 0));
  return { conn, rc, sockets, timers, flush, leave: () => (inRoom = false) };
}

describe('Reconnector', () => {
  it('retries with backoff and sends the rejoin message once connected', async () => {
    const { rc, sockets, timers, flush } = await setup();
    sockets[0]!.onclose?.({ code: 1006 });
    expect(rc.active).toBe(true);
    expect(timers.fire()).toBe(100);
    sockets[1]!.onclose?.({ code: 1006 }); // the server is still unreachable
    expect(timers.fire()).toBe(200);
    sockets[2]!.onopen?.();
    await flush();
    expect(sockets[2]!.sent).toEqual([REJOIN]);
    expect(rc.active).toBe(true);
    sockets[2]!.deliver({
      type: 'joined',
      v: PROTOCOL_VERSION,
      slot: 1,
      rejoinToken: 'a'.repeat(32),
    });
    expect(rc.active).toBe(false);
    // The backoff starts over for the next drop.
    sockets[2]!.onclose?.({ code: 1006 });
    expect(timers.fire()).toBe(100);
  });

  it('gives up after the last delay', async () => {
    const { rc, sockets, timers } = await setup();
    sockets[0]!.onclose?.();
    for (let i = 1; i <= 3; i++) {
      timers.fire();
      sockets[i]!.onclose?.();
    }
    expect(rc.active).toBe(false);
    expect(rc.failed).toBe(true);
    expect(timers.pending).toHaveLength(0);
  });

  it('gives up when the server refuses the seat', async () => {
    const { rc, sockets, timers, flush } = await setup();
    sockets[0]!.onclose?.();
    timers.fire();
    sockets[1]!.onopen?.();
    await flush();
    sockets[1]!.deliver({
      type: 'error',
      code: 'roomNotFound',
      message: 'No room with that code.',
    });
    expect(rc.failed).toBe(true);
    expect(timers.pending).toHaveLength(0);
  });

  it('does not reconnect after being evicted or after leaving', async () => {
    const evicted = await setup();
    evicted.sockets[0]!.onclose?.({ code: CLOSE_EVICTED });
    expect(evicted.rc.active).toBe(false);
    expect(evicted.timers.pending).toHaveLength(0);

    const left = await setup();
    left.leave();
    left.conn.close();
    expect(left.timers.pending).toHaveLength(0);
  });
});
