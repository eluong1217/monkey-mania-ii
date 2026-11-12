import { describe, expect, it } from 'vitest';
import type { ServerMessage } from '@monkey-mania-2/shared';
import { Connection, type SocketLike } from '../connection';
import { NetGame } from './net-game';

function setup() {
  let now = 0;
  const socket: SocketLike = {
    send() {},
    close() {},
    onopen: null,
    onclose: null,
    onerror: null,
    onmessage: null,
  };
  const conn = new Connection(() => socket);
  void conn.connect();
  socket.onopen?.();
  const net = new NetGame(conn, undefined, () => now);
  const deliver = (m: ServerMessage) => socket.onmessage?.({ data: JSON.stringify(m) });
  const intro = (round: number): ServerMessage => ({
    type: 'roundIntro',
    round,
    totalRounds: 5,
    miniGameId: 'sandbox',
    displayName: 'Sandbox',
    controlsHint: 'Move',
    view: 'top',
  });
  return { net, deliver, intro, advance: (ms: number) => (now += ms) };
}

describe('NetGame party state', () => {
  it('keeps running totals across rounds and clears them for a new match', () => {
    const { net, deliver, intro } = setup();
    deliver(intro(1));
    deliver({
      type: 'roundResult',
      round: 1,
      placements: [[1], [0], [2], [3]],
      scores: [0, 1, 2, 3].map((slot) => ({ slot, points: 3 - slot, total: 3 - slot })),
    });
    expect(net.totals).toEqual([3, 2, 1, 0]);
    deliver(intro(2));
    expect(net.totals).toEqual([3, 2, 1, 0]);
    deliver(intro(1));
    expect(net.totals).toEqual([0, 0, 0, 0]);
  });

  it('counts the intro down 3, 2, 1', () => {
    const { net, deliver, intro, advance } = setup();
    deliver(intro(1));
    expect(net.introCountdown()).toBe(3);
    advance(1100);
    expect(net.introCountdown()).toBe(2);
    advance(1000);
    expect(net.introCountdown()).toBe(1);
    advance(5000);
    expect(net.introCountdown()).toBe(0);
  });
});
