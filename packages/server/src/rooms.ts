import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@monkey-mania-2/shared';
import { Room, type RoomHooks } from './room.js';

export interface RoomManagerOptions {
  hooks: RoomHooks;
  /** Delay before a room with no connected humans is deleted. */
  emptyTimeoutMs?: number;
  /** Returns a number in [0, 1). Injectable for tests. */
  random?: () => number;
}

export const DEFAULT_EMPTY_TIMEOUT_MS = 30_000;

export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly emptyTimeoutMs: number;
  private readonly random: () => number;
  private readonly hooks: RoomHooks;

  constructor(options: RoomManagerOptions) {
    this.hooks = options.hooks;
    this.emptyTimeoutMs = options.emptyTimeoutMs ?? DEFAULT_EMPTY_TIMEOUT_MS;
    this.random = options.random ?? Math.random;
  }

  get size(): number {
    return this.rooms.size;
  }

  create(): Room {
    let code: string;
    do {
      code = Array.from(
        { length: ROOM_CODE_LENGTH },
        () => ROOM_CODE_ALPHABET[Math.floor(this.random() * ROOM_CODE_ALPHABET.length)],
      ).join('');
    } while (this.rooms.has(code));
    const room = new Room(code, this.hooks);
    this.rooms.set(code, room);
    return room;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  /** Call after a join: a room that has someone in it must not be deleted. */
  touch(room: Room): void {
    const t = this.timers.get(room.code);
    if (t) clearTimeout(t);
    this.timers.delete(room.code);
  }

  /** Call after a leave: schedules deletion if nobody is connected. */
  afterLeave(room: Room): void {
    if (!room.isEmpty() || this.timers.has(room.code)) return;
    const t = setTimeout(() => {
      this.timers.delete(room.code);
      if (room.isEmpty()) {
        room.match?.stop();
        this.rooms.delete(room.code);
      }
    }, this.emptyTimeoutMs);
    t.unref();
    this.timers.set(room.code, t);
  }

  close(): void {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    for (const room of this.rooms.values()) room.match?.stop();
    this.rooms.clear();
  }
}
