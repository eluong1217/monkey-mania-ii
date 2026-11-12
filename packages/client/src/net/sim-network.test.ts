import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SocketLike } from '../connection';
import { simNetworkFromQuery, withSimNetwork } from './sim-network';

function mockSocket(): SocketLike & { sent: string[] } {
  return {
    sent: [],
    onopen: null,
    onclose: null,
    onerror: null,
    onmessage: null,
    send(d: string) {
      this.sent.push(d);
    },
    close() {},
  };
}

afterEach(() => vi.useRealTimers());

describe('sim network', () => {
  it('parses the dev query flags', () => {
    expect(simNetworkFromQuery('?room=ABCD')).toBeNull();
    expect(simNetworkFromQuery('?lag=150&drop=0.05')).toEqual({ lagMs: 150, drop: 0.05 });
    expect(simNetworkFromQuery('?lag=-5&drop=9')).toEqual({ lagMs: 0, drop: 1 });
  });

  it('delays both directions by half the lag, in order, and drops only snapshots', () => {
    vi.useFakeTimers();
    const inner = mockSocket();
    let r = 0;
    const outer = withSimNetwork(inner, {
      lagMs: 150,
      drop: 0.5,
      random: () => (r++ % 2 ? 0.9 : 0.1),
    });
    const got: unknown[] = [];
    outer.onmessage = (ev) => got.push(JSON.parse(ev.data as string).n);

    outer.send('a');
    outer.send('b');
    vi.advanceTimersByTime(74);
    expect(inner.sent).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(inner.sent).toEqual(['a', 'b']);

    for (let n = 0; n < 4; n++) inner.onmessage!({ data: JSON.stringify({ type: 'snapshot', n }) });
    inner.onmessage!({ data: JSON.stringify({ type: 'roomState', n: 'kept' }) });
    vi.advanceTimersByTime(75);
    expect(got).toEqual([1, 3, 'kept']);
  });
});
