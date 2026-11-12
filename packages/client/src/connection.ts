import {
  encodeMessage,
  parseServerMessage,
  type ClientMessage,
  type ServerMessage,
} from '@monkey-mania-2/shared';

/** The subset of WebSocket the connection uses, so tests can pass a mock. */
export interface SocketLike {
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
}

export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'closed';

type ServerEvents = { [T in ServerMessage['type']]: Extract<ServerMessage, { type: T }> };
type Events = ServerEvents & { status: ConnectionStatus; badMessage: string };

type Handler<K extends keyof Events> = (payload: Events[K]) => void;

/** Typed wrapper around a WebSocket: parses server messages and emits them by `type`. */
export class Connection {
  status: ConnectionStatus = 'idle';
  private socket: SocketLike | null = null;
  private handlers: { [K in keyof Events]?: Handler<K>[] } = {};

  constructor(private readonly createSocket: () => SocketLike) {}

  on<K extends keyof Events>(event: K, handler: Handler<K>): () => void {
    const list = (this.handlers[event] ??= []) as Handler<K>[];
    list.push(handler);
    return () => {
      const i = list.indexOf(handler);
      if (i >= 0) list.splice(i, 1);
    };
  }

  /** Open the socket. Resolves true once open, false if it closes or errors first. */
  connect(): Promise<boolean> {
    this.close();
    this.setStatus('connecting');
    const socket = this.createSocket();
    this.socket = socket;
    return new Promise((resolve) => {
      socket.onopen = () => {
        this.setStatus('open');
        resolve(true);
      };
      socket.onclose = socket.onerror = () => {
        if (this.socket !== socket) return;
        this.socket = null;
        this.setStatus('closed');
        resolve(false);
      };
      socket.onmessage = (ev) => {
        if (typeof ev.data !== 'string') return;
        const result = parseServerMessage(ev.data);
        if (!result.ok) {
          this.emit('badMessage', result.error.message);
          return;
        }
        this.emit(result.message.type, result.message as never);
      };
    });
  }

  send(message: ClientMessage): boolean {
    if (this.status !== 'open' || !this.socket) return false;
    this.socket.send(encodeMessage(message));
    return true;
  }

  close(): void {
    const socket = this.socket;
    if (!socket) return;
    this.socket = null;
    socket.onopen = socket.onclose = socket.onerror = socket.onmessage = null;
    socket.close();
    this.setStatus('closed');
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.emit('status', status);
  }

  private emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    for (const h of [...((this.handlers[event] ?? []) as Handler<K>[])]) h(payload);
  }
}

/** Real WebSocket to the same host at /ws (Vite proxies it in dev). */
export function createBrowserSocket(): SocketLike {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return new WebSocket(`${proto}://${location.host}/ws`) as unknown as SocketLike;
}

// ---- Saved name and rejoin token (localStorage may throw or be absent) ----

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function store(): StorageLike | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

export function loadSaved(
  key: 'name' | 'rejoinToken',
  storage: StorageLike | null = store(),
): string {
  try {
    return storage?.getItem(`mm2.${key}`) ?? '';
  } catch {
    return '';
  }
}

export function save(
  key: 'name' | 'rejoinToken',
  value: string,
  storage: StorageLike | null = store(),
): void {
  try {
    storage?.setItem(`mm2.${key}`, value);
  } catch {
    /* ignore: private mode or quota */
  }
}
