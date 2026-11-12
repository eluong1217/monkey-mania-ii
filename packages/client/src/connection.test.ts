import { describe, expect, it, vi } from 'vitest';
import { PROTOCOL_VERSION, type ServerMessage } from '@monkey-mania-2/shared';
import { Connection, loadSaved, save, type SocketLike } from './connection';

class MockSocket implements SocketLike {
  sent: string[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  send(d: string) {
    this.sent.push(d);
  }
  close() {
    this.closed = true;
  }
  deliver(msg: ServerMessage | string) {
    this.onmessage?.({ data: typeof msg === 'string' ? msg : JSON.stringify(msg) });
  }
}

function setup() {
  const socket = new MockSocket();
  const conn = new Connection(() => socket);
  return { socket, conn };
}

describe('Connection', () => {
  it('connects, sends encoded messages and emits typed events', async () => {
    const { socket, conn } = setup();
    const statuses: string[] = [];
    conn.on('status', (s) => statuses.push(s));
    const p = conn.connect();
    socket.onopen?.();
    expect(await p).toBe(true);

    expect(conn.send({ type: 'createRoom', v: PROTOCOL_VERSION, name: 'Mo' })).toBe(true);
    expect(JSON.parse(socket.sent[0]!)).toEqual({
      type: 'createRoom',
      v: PROTOCOL_VERSION,
      name: 'Mo',
    });

    const onJoined = vi.fn();
    conn.on('joined', onJoined);
    socket.deliver({ type: 'joined', v: PROTOCOL_VERSION, slot: 2, rejoinToken: 'tok' });
    expect(onJoined).toHaveBeenCalledWith({
      type: 'joined',
      v: PROTOCOL_VERSION,
      slot: 2,
      rejoinToken: 'tok',
    });
    expect(statuses).toEqual(['connecting', 'open']);
  });

  it('emits server errors and ignores malformed messages', async () => {
    const { socket, conn } = setup();
    const p = conn.connect();
    socket.onopen?.();
    await p;
    const onError = vi.fn();
    const onBad = vi.fn();
    conn.on('error', onError);
    conn.on('badMessage', onBad);
    socket.deliver({ type: 'error', code: 'roomFull', message: 'Room is full' });
    socket.deliver('not json');
    expect(onError).toHaveBeenCalledOnce();
    expect(onBad).toHaveBeenCalledOnce();
  });

  it('reports failure and refuses to send when the socket closes', async () => {
    const { socket, conn } = setup();
    const p = conn.connect();
    socket.onclose?.();
    expect(await p).toBe(false);
    expect(conn.status).toBe('closed');
    expect(conn.send({ type: 'leave' })).toBe(false);
  });

  it('emits closed status when an open socket drops', async () => {
    const { socket, conn } = setup();
    const p = conn.connect();
    socket.onopen?.();
    await p;
    const onStatus = vi.fn();
    conn.on('status', onStatus);
    socket.onclose?.();
    expect(onStatus).toHaveBeenCalledWith('closed');
  });
});

describe('saved values', () => {
  it('round-trips through storage and survives a throwing storage', () => {
    const data = new Map<string, string>();
    const ok = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    };
    save('name', 'Bo', ok);
    expect(loadSaved('name', ok)).toBe('Bo');
    const bad = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(() => save('name', 'x', bad)).not.toThrow();
    expect(loadSaved('name', bad)).toBe('');
    expect(loadSaved('name', null)).toBe('');
  });
});
