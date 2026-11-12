import { afterEach, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { WebSocket } from 'ws';
import { PROTOCOL_VERSION, type ServerMessage } from '@monkey-mania-2/shared';
import { createApp } from './app.js';

let server: Server;
afterEach(() => new Promise<void>((r) => server.close(() => r())));

function open(port: number) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const msgs: ServerMessage[] = [];
  ws.on('message', (d) => msgs.push(JSON.parse(d.toString()) as ServerMessage));
  const ready = new Promise<void>((r) => ws.on('open', () => r()));
  const send = (m: object) => ws.send(JSON.stringify(m));
  const until = async (pred: (m: ServerMessage) => boolean) => {
    for (let i = 0; i < 200; i++) {
      const hit = [...msgs].reverse().find(pred);
      if (hit) return hit;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error('timeout');
  };
  return { ws, ready, send, until };
}

it('four real clients reach all-ready and start the match', async () => {
  server = createApp('/nonexistent');
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port;

  const health = await fetch(`http://127.0.0.1:${port}/healthz`);
  expect(health.status).toBe(200);

  const clients = Array.from({ length: 4 }, () => open(port));
  await Promise.all(clients.map((c) => c.ready));
  const [host, ...others] = clients as [ReturnType<typeof open>, ...ReturnType<typeof open>[]];

  host.send({ type: 'createRoom', v: PROTOCOL_VERSION, name: 'Host' });
  const rs = (await host.until((m) => m.type === 'roomState')) as { code: string };
  others.forEach((c, i) =>
    c.send({ type: 'joinRoom', v: PROTOCOL_VERSION, code: rs.code, name: `P${i}` }),
  );
  clients.forEach((c) => c.send({ type: 'setReady', ready: true }));
  await host.until((m) => m.type === 'roomState' && m.seats.every((s) => s !== null && s.ready));

  host.send({ type: 'startMatch' });
  await others[0]!.until((m) => m.type === 'roomState' && m.phase === 'INTRO');
  clients.forEach((c) => c.ws.close());
});
