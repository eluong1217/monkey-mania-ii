import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import { DEFAULT_CONFIG, type ServerConfig } from './config.js';
import { CLOSE_POLICY, Connection } from './connection.js';
import { ipTag, jsonLog, type Log } from './log.js';
import { startMatch } from './match.js';
import type { RoomHooks } from './room.js';
import { RoomManager } from './rooms.js';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
};

export interface AppOptions {
  hooks?: RoomHooks;
  /** Limits; anything left out takes its default (see config.ts). */
  config?: Partial<ServerConfig>;
  log?: Log;
}

/** The client address. Behind a proxy, the last X-Forwarded-For hop is the one the proxy saw. */
function clientIp(req: IncomingMessage, trustProxy: boolean): string {
  const fwd = req.headers['x-forwarded-for'];
  if (trustProxy && typeof fwd === 'string') {
    const last = fwd.split(',').at(-1)?.trim();
    if (last) return last;
  }
  return req.socket.remoteAddress ?? 'unknown';
}

export interface App extends Server {
  /** Stop accepting new rooms; running matches continue. */
  drain(): void;
  /** Number of matches still running. */
  activeMatches(): number;
}

/**
 * Vite's hashed bundles (assets/index-<hash>.js) never change, so cache them for a year.
 * index.html must always be revalidated. Game art in assets/ keeps its names, so cache it briefly.
 */
function cacheControl(clientDir: string, file: string): string {
  if (file.startsWith(join(clientDir, 'assets') + sep)) {
    const rel = file.slice(join(clientDir, 'assets').length + 1);
    if (/^[^/\\]+-[\w-]{8}\.(js|css)$/.test(rel)) return 'public, max-age=31536000, immutable';
    return 'public, max-age=3600';
  }
  return 'no-cache';
}

/** HTTP server that serves the built client, /healthz, and a WebSocket endpoint at /ws. */
export function createApp(clientDir: string, options: AppOptions = {}): App {
  const config: ServerConfig = { ...DEFAULT_CONFIG, ...options.config };
  const log = options.log ?? jsonLog;
  const rooms = new RoomManager({
    hooks: options.hooks ?? {
      onMatchStart: (room) => {
        log('matchStart', { room: room.code });
        startMatch(room, undefined, {
          log: (event, data) => log(event, { room: room.code, ...data }),
        });
      },
    },
    config,
    log,
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
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': cacheControl(clientDir, file),
    });
    createReadStream(file).pipe(res);
  });
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: config.maxMessageBytes });
  const perIp = new Map<string, number>();
  const alive = new WeakMap<WebSocket, boolean>();
  wss.on('connection', (socket, req) => {
    const ip = clientIp(req, config.trustProxy);
    const count = perIp.get(ip) ?? 0;
    if (count >= config.maxConnectionsPerIp) {
      log('connectionRefused', { reason: 'maxConnectionsPerIp', ip: ipTag(ip) });
      socket.close(CLOSE_POLICY, 'too many connections');
      return;
    }
    perIp.set(ip, count + 1);
    alive.set(socket, true);
    const conn = new Connection(
      {
        send: (d) => socket.readyState === socket.OPEN && socket.send(d),
        close: (code, reason) => socket.close(code, reason),
      },
      rooms,
    );
    socket.on('pong', () => alive.set(socket, true));
    socket.on('message', (data, isBinary) => conn.receive(isBinary ? null : data.toString()));
    socket.on('close', (code) => {
      const n = (perIp.get(ip) ?? 1) - 1;
      if (n > 0) perIp.set(ip, n);
      else perIp.delete(ip);
      // 1009: frame over maxPayload, closed by ws itself.
      if (code === 1009) log('connectionClosed', { reason: 'maxMessageBytes', ip: ipTag(ip) });
      conn.disconnect();
    });
    socket.on('error', () => socket.terminate());
  });
  // Heartbeat: a socket that did not answer the last ping is dead (sleeping phone, lost wifi).
  // Terminating it fires 'close', so its seat goes to a bot until the player rejoins.
  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (!alive.get(socket)) {
        socket.terminate();
        continue;
      }
      alive.set(socket, false);
      socket.ping();
    }
    rooms.sweepIdle();
  }, config.heartbeatMs);
  heartbeat.unref();
  server.on('close', () => {
    clearInterval(heartbeat);
    rooms.close();
    wss.close();
  });
  return Object.assign(server, {
    drain: () => void (rooms.draining = true),
    activeMatches: () => rooms.activeMatches(),
  });
}
