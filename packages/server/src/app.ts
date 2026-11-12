import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { WebSocketServer } from 'ws';
import { Connection } from './connection.js';
import { startMatch } from './match.js';
import type { RoomHooks } from './room.js';
import { RoomManager } from './rooms.js';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

export interface AppOptions {
  hooks?: RoomHooks;
  emptyTimeoutMs?: number;
}

/** HTTP server that serves the built client, /healthz, and a WebSocket endpoint at /ws. */
export function createApp(clientDir: string, options: AppOptions = {}): Server {
  const rooms = new RoomManager({
    hooks: options.hooks ?? { onMatchStart: (room) => startMatch(room) },
    emptyTimeoutMs: options.emptyTimeoutMs,
  });
  const server = createServer((req, res) => {
    const url = (req.url ?? '/').split('?')[0] ?? '/';
    if (url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok');
      return;
    }
    const path = normalize(decodeURIComponent(url));
    let file = join(clientDir, path);
    if (!file.startsWith(clientDir)) file = join(clientDir, 'index.html');
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(clientDir, 'index.html');
    if (!existsSync(file)) {
      res.writeHead(404).end('Client not built. Run npm run build.');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });
  wss.on('connection', (socket) => {
    const conn = new Connection(
      {
        send: (d) => socket.readyState === socket.OPEN && socket.send(d),
        close: () => socket.close(),
      },
      rooms,
    );
    socket.on('message', (data, isBinary) => conn.receive(isBinary ? null : data.toString()));
    socket.on('close', () => conn.disconnect());
    socket.on('error', () => socket.terminate());
  });
  server.on('close', () => {
    rooms.close();
    wss.close();
  });
  return server;
}
