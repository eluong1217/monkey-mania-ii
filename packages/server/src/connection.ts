import {
  encodeMessage,
  parseClientMessage,
  type ClientMessage,
  type ErrorCode,
  type ServerMessage,
  type Slot,
} from '@monkey-mania-2/shared';
import { RateLimiter } from './rate-limit.js';
import type { Member, Room } from './room.js';
import type { RoomManager } from './rooms.js';

/** Close codes the client acts on. 4000: do not reconnect (seat taken over or room closed). */
export const CLOSE_EVICTED = 4000;
/** Policy violation: flooding, or too many sockets from one address. */
export const CLOSE_POLICY = 1008;

/** The slice of a WebSocket a connection needs. */
export interface Socket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

/** Per-socket protocol handler. Testable with a fake socket. */
export class Connection implements Member {
  private room: Room | null = null;
  private slot: Slot = 0;
  private readonly limiter: RateLimiter;
  /** Second bucket: how many dropped messages we tolerate before closing the socket. */
  private readonly strikes: RateLimiter;
  private warned = false;
  private closed = false;
  /** Highest input tick accepted on this socket; older or repeated ticks are dropped. */
  private lastInputTick = -1;

  constructor(
    private readonly socket: Socket,
    private readonly rooms: RoomManager,
    now?: () => number,
  ) {
    const { messageBurst, messagesPerSecond } = rooms.config;
    this.limiter = new RateLimiter(messageBurst, messagesPerSecond, now);
    this.strikes = new RateLimiter(messageBurst, 1, now);
  }

  send(message: ServerMessage): void {
    if (!this.closed) this.socket.send(encodeMessage(message));
  }

  private error(code: ErrorCode, message: string): void {
    this.send({ type: 'error', code, message });
  }

  /** The room dropped us: say why and close without freeing the seat (it is not ours now). */
  evict(message: string): void {
    this.room = null;
    this.error('badPhase', message);
    this.close(CLOSE_EVICTED, 'evicted');
  }

  private close(code: number, reason: string): void {
    if (this.closed) return;
    this.closed = true;
    this.socket.close(code, reason);
  }

  /** Handle one raw frame from the client. Never throws. */
  receive(raw: unknown): void {
    if (this.closed) return;
    if (!this.limiter.allow()) {
      if (!this.strikes.allow()) {
        this.rooms.log('floodClosed', { room: this.room?.code ?? null });
        this.leaveRoom();
        return this.close(CLOSE_POLICY, 'rate limit');
      }
      // One error per burst of drops, so a flood is not answered with a flood.
      if (!this.warned) this.error('rateLimited', 'Slow down.');
      this.warned = true;
      return;
    }
    this.warned = false;
    const parsed = parseClientMessage(raw);
    if (!parsed.ok) return this.error(parsed.error.code, parsed.error.message);
    try {
      this.handle(parsed.message);
    } catch (error) {
      // A bug must not crash the process or leak details: log it here, send a plain error.
      this.rooms.log('connectionError', {
        room: this.room?.code ?? null,
        type: parsed.message.type,
        error: String(error),
      });
      this.error('badMessage', 'Something went wrong.');
    }
  }

  /** Socket closed: mark the seat disconnected (mid-match a bot takes over until rejoin). */
  disconnect(): void {
    this.closed = true;
    this.leaveRoom();
  }

  private leaveRoom(): void {
    const room = this.room;
    if (!room) return;
    this.room = null;
    room.leave(this.slot);
    this.rooms.log('playerLeft', { room: room.code, slot: this.slot, phase: room.phase });
    this.rooms.afterLeave(room);
  }

  private seated(room: Room, slot: Slot, rejoinToken: string, v: number): void {
    this.room = room;
    this.slot = slot;
    this.rooms.touch(room);
    this.send({ type: 'joined', v, slot, rejoinToken });
    room.broadcastState();
  }

  private handle(m: ClientMessage): void {
    switch (m.type) {
      case 'createRoom': {
        if (this.room) return this.error('badPhase', 'Already in a room.');
        if (this.rooms.draining)
          return this.error('badPhase', 'Server is restarting. Try again in a minute.');
        const room = this.rooms.create();
        if (!room) return this.error('rateLimited', 'The server is busy. Try again later.');
        const seat = room.join(m.name, this);
        if (!seat) return this.error('roomFull', 'That room is full.');
        this.seated(room, seat.slot, seat.rejoinToken, m.v);
        this.rooms.log('playerJoined', { room: room.code, slot: seat.slot });
        return;
      }
      case 'joinRoom': {
        if (this.room) return this.error('badPhase', 'Already in a room.');
        const room = this.rooms.get(m.code);
        if (!room) return this.error('roomNotFound', 'No room with that code.');
        if (m.rejoinToken !== undefined) {
          const back = room.rejoin(m.rejoinToken, this);
          if (back) {
            back.replaced?.evict?.('You joined from another window.');
            this.seated(room, back.slot, back.rejoinToken, m.v);
            room.catchUp(back.slot);
            this.rooms.log('playerRejoined', {
              room: room.code,
              slot: back.slot,
              phase: room.phase,
            });
            return;
          }
        }
        // A token that matches no seat is only refused once the match has started; in the lobby
        // it is just a stale token from an earlier room, so join as a newcomer.
        if (room.phase !== 'LOBBY') return this.error('badPhase', 'That match already started.');
        const seat = room.join(m.name, this);
        if (!seat) return this.error('roomFull', 'That room is full.');
        this.seated(room, seat.slot, seat.rejoinToken, m.v);
        this.rooms.log('playerJoined', { room: room.code, slot: seat.slot });
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
        if (m.type === 'input') {
          // Replayed or reordered inputs are dropped. The tick is the client's own counter and
          // is never used for timing: the match stamps inputs with its own tick, and the slot
          // is ours, never the message's. A future-dated tick only blocks this socket's own
          // later inputs, so it buys nothing.
          if (m.tick <= this.lastInputTick) return;
          this.lastInputTick = m.tick;
          room.match?.input(this.slot, m.input);
          return;
        }
        this.rooms.activity(room);
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
        }
        if (!result.ok) this.error(result.code, result.message);
      }
    }
  }
}
