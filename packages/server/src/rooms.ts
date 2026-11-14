import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@monkey-mania-2/shared';
import { DEFAULT_CONFIG, type ServerConfig } from './config.js';
import { noLog, type Log } from './log.js';
import { Room, type RoomHooks } from './room.js';

export interface RoomManagerOptions {
  hooks: RoomHooks;
  /** Limits; anything left out takes its default. */
  config?: Partial<ServerConfig>;
  /** Returns a number in [0, 1). Injectable for tests. */
  random?: () => number;
  /** Wall clock in ms, for idle tracking. Injectable for tests. */
  now?: () => number;
  log?: Log;
}

export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly lastActive = new Map<Room, number>();
  readonly config: ServerConfig;
  private readonly random: () => number;
  private readonly now: () => number;
  private readonly hooks: RoomHooks;
  readonly log: Log;

  constructor(options: RoomManagerOptions) {
    this.hooks = options.hooks;
    this.config = { ...DEFAULT_CONFIG, ...options.config };
    this.random = options.random ?? Math.random;
    this.now = options.now ?? Date.now;
    this.log = options.log ?? noLog;
  }

  /** True once shutdown has begun: no new rooms, existing ones play on. */
  draining = false;

  get size(): number {
    return this.rooms.size;
  }

  /** Rooms whose match loop is still running. */
  activeMatches(): number {
    let n = 0;
    for (const room of this.rooms.values()) if (room.match) n++;
    return n;
  }

  /** A new empty room, or null when `maxRooms` already exist. */
  create(): Room | null {
    if (this.rooms.size >= this.config.maxRooms) {
      this.log('roomRefused', { reason: 'maxRooms', rooms: this.rooms.size });
      return null;
    }
    let code: string;
    do {
      code = Array.from(
        { length: ROOM_CODE_LENGTH },
        () => ROOM_CODE_ALPHABET[Math.floor(this.random() * ROOM_CODE_ALPHABET.length)],
      ).join('');
    } while (this.rooms.has(code));
    const room = new Room(code, this.hooks, this.log);
    this.rooms.set(code, room);
    this.activity(room);
    this.log('roomCreated', { room: code, rooms: this.rooms.size });
    return room;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  /** A member did something in the room; resets its idle clock. */
  activity(room: Room): void {
    this.lastActive.set(room, this.now());
  }

  /** Call after a join: a room that has someone in it must not be deleted. */
  touch(room: Room): void {
    this.activity(room);
    const t = this.timers.get(room.code);
    if (t) clearTimeout(t);
    this.timers.delete(room.code);
  }

  /** Call after a leave: schedules deletion if nobody is connected. */
  afterLeave(room: Room): void {
    if (!room.isEmpty() || this.timers.has(room.code)) return;
    const t = setTimeout(() => {
      this.timers.delete(room.code);
      if (room.isEmpty()) this.remove(room, 'empty');
    }, this.config.emptyRoomMs);
    t.unref();
    this.timers.set(room.code, t);
  }

  /** Closes LOBBY/PODIUM rooms nobody has touched for `idleLobbyMs`. Runs on the heartbeat. */
  sweepIdle(): void {
    const cutoff = this.now() - this.config.idleLobbyMs;
    for (const room of [...this.rooms.values()]) {
      if (room.match || (room.phase !== 'LOBBY' && room.phase !== 'PODIUM')) continue;
      if ((this.lastActive.get(room) ?? 0) > cutoff) continue;
      room.evictAll('This room closed after being idle.');
      this.remove(room, 'idle');
    }
  }

  private remove(room: Room, reason: 'empty' | 'idle'): void {
    if (this.rooms.get(room.code) !== room) return;
    const t = this.timers.get(room.code);
    if (t) clearTimeout(t);
    this.timers.delete(room.code);
    room.match?.stop('empty');
    this.rooms.delete(room.code);
    this.lastActive.delete(room);
    this.log('roomRemoved', { room: room.code, reason, rooms: this.rooms.size });
  }

  close(): void {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    for (const room of this.rooms.values()) room.match?.stop();
    this.rooms.clear();
    this.lastActive.clear();
  }
}
