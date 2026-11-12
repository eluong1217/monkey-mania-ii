import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { WebSocketServer } from 'ws';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

/** HTTP server that serves the built client plus a WebSocket endpoint at /ws. */
export function createApp(clientDir: string): Server {
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/'));
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
  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (socket) => socket.close());
  return server;
}
