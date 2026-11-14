/** Every server limit in one place. Defaults suit a small free-tier host; env vars override. */
export interface ServerConfig {
  /** Rooms that may exist at once; createRoom is refused beyond this. */
  maxRooms: number;
  /** Open WebSockets per client IP; extra sockets are closed on connect. */
  maxConnectionsPerIp: number;
  /** Largest WebSocket frame in bytes; bigger frames close the socket (ws maxPayload). */
  maxMessageBytes: number;
  /** Token bucket per socket: sustained rate and burst. Inputs arrive at ~30/s. */
  messagesPerSecond: number;
  messageBurst: number;
  /** A LOBBY or PODIUM room with no member activity for this long is closed. */
  idleLobbyMs: number;
  /** A room with no connected human is removed (and its match stopped) after this long. */
  emptyRoomMs: number;
  /** Ping interval; a socket that misses one pong is terminated. */
  heartbeatMs: number;
  /** Read the client IP from the last X-Forwarded-For entry (set behind Render's proxy). */
  trustProxy: boolean;
}

export const DEFAULT_CONFIG: Readonly<ServerConfig> = Object.freeze({
  maxRooms: 200,
  maxConnectionsPerIp: 8,
  maxMessageBytes: 4096,
  messagesPerSecond: 60,
  messageBurst: 90,
  idleLobbyMs: 15 * 60_000,
  emptyRoomMs: 30_000,
  heartbeatMs: 15_000,
  trustProxy: false,
});

const ENV: Record<Exclude<keyof ServerConfig, 'trustProxy'>, string> = {
  maxRooms: 'MAX_ROOMS',
  maxConnectionsPerIp: 'MAX_CONNECTIONS_PER_IP',
  maxMessageBytes: 'MAX_MESSAGE_BYTES',
  messagesPerSecond: 'MESSAGES_PER_SECOND',
  messageBurst: 'MESSAGE_BURST',
  idleLobbyMs: 'IDLE_LOBBY_MS',
  emptyRoomMs: 'EMPTY_ROOM_MS',
  heartbeatMs: 'HEARTBEAT_MS',
};

/** Defaults, overridden by any positive numeric env var named in ENV, plus TRUST_PROXY=1. */
export function configFromEnv(env: Record<string, string | undefined>): ServerConfig {
  const config: ServerConfig = { ...DEFAULT_CONFIG };
  for (const [key, name] of Object.entries(ENV) as [keyof typeof ENV, string][]) {
    const n = Number(env[name]);
    if (env[name] !== undefined && Number.isFinite(n) && n > 0) config[key] = n;
  }
  config.trustProxy = env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true';
  return config;
}
