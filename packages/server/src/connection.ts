import {
  encodeMessage,
  parseClientMessage,
  type ClientMessage,
  type ErrorCode,
  type ServerMessage,
  type Slot,
} from '@monkey-mania-2/shared';
import { MESSAGES_PER_SECOND, MESSAGE_BURST, RateLimiter } from './rate-limit.js';
import type { Member, Room } from './room.js';
import type { RoomManager } from './rooms.js';

/** The slice of a WebSocket a connection needs. */
export interface Socket {
  send(data: string): void;
  close(): void;
}

/** Per-socket protocol handler. Testable with a fake socket. */
export class Connection implements Member {
  private room: Room | null = null;
  private slot: Slot = 0;
  private readonly limiter: RateLimiter;

  constructor(
    private readonly socket: Socket,
    private readonly rooms: RoomManager,
    now?: () => number,
  ) {
    this.limiter = new RateLimiter(MESSAGE_BURST, MESSAGES_PER_SECOND, now);
  }

  send(message: ServerMessage): void {
    this.socket.send(encodeMessage(message));
  }

  private error(code: ErrorCode, message: string): void {
    this.send({ type: 'error', code, message });
  }

  /** Handle one raw frame from the client. Never throws. */
  receive(raw: unknown): void {
    if (!this.limiter.allow()) return this.error('rateLimited', 'Slow down.');
    const parsed = parseClientMessage(raw);
    if (!parsed.ok) return this.error(parsed.error.code, parsed.error.message);
    this.handle(parsed.message);
  }

  /** Socket closed: free the seat. */
  disconnect(): void {
    this.leaveRoom();
  }

  private leaveRoom(): void {
    const room = this.room;
    if (!room) return;
    this.room = null;
    room.leave(this.slot);
    this.rooms.afterLeave(room);
  }

  private seat(room: Room): void {
    this.room = room;
  }

  private handle(m: ClientMessage): void {
    switch (m.type) {
      case 'createRoom':
      case 'joinRoom': {
        if (this.room) return this.error('badPhase', 'Already in a room.');
        let room: Room | undefined;
        if (m.type === 'createRoom') {
          room = this.rooms.create();
        } else {
          room = this.rooms.get(m.code);
          if (!room) return this.error('roomNotFound', 'No room with that code.');
          if (room.phase !== 'LOBBY') return this.error('badPhase', 'That match already started.');
        }
        const seated = room.join(m.name, this);
        if (!seated) {
          if (m.type === 'createRoom') this.rooms.afterLeave(room);
          return this.error('roomFull', 'That room is full.');
        }
        this.slot = seated.slot;
        this.seat(room);
        this.rooms.touch(room);
        this.send({ type: 'joined', v: m.v, slot: seated.slot, rejoinToken: seated.rejoinToken });
        room.broadcastState();
        return;
      }
      case 'leave':
        return this.leaveRoom();
      default: {
        const room = this.room;
        if (!room) {
          // Stray input after leaving is harmless; everything else needs a room.
          if (m.type === 'input') return;
          return this.error('badPhase', 'Join a room first.');
        }
        let result;
        switch (m.type) {
          case 'setReady':
            result = room.setReady(this.slot, m.ready);
            break;
          case 'setBotCount':
            result = room.setBotCount(this.slot, m.count);
            break;
          case 'startMatch':
            result = room.start(this.slot);
            break;
          case 'rematch':
            result = room.rematch(this.slot);
            break;
          case 'input':
            // Latest input wins; the match ignores it outside PLAYING. The slot is ours, never the message's.
            room.match?.input(this.slot, m.input);
            return;
        }
        if (!result.ok) this.error(result.code, result.message);
      }
    }
  }
}
