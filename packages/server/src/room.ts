import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  MAX_PLAYERS,
  type ErrorCode,
  type PlayerInput,
  type RoomPhase,
  type SeatInfo,
  type ServerMessage,
  type Slot,
} from '@monkey-mania-2/shared';
import { noLog, type Log } from './log.js';

/** Where a room sends messages for one human. A real socket or a test double. */
export interface Member {
  send(message: ServerMessage): void;
  /** The room dropped this member (seat taken over, room closed): tell them and disconnect. */
  evict?(message: string): void;
}

interface Seat {
  name: string;
  isBot: boolean;
  ready: boolean;
  connected: boolean;
  member: Member | null;
  rejoinToken: string;
}

/** The running match loop, as the room and connections see it. */
export interface MatchHandle {
  input(slot: Slot, input: PlayerInput): void;
  stop(reason?: 'stopped' | 'empty'): void;
}

export type RoomResult = { ok: true } | { ok: false; code: ErrorCode; message: string };
const OK: RoomResult = { ok: true };
const err = (code: ErrorCode, message: string): RoomResult => ({ ok: false, code, message });

/** Constant-time token check. Lengths are public (always 32 hex chars for real tokens). */
function tokenMatches(expected: string, given: string): boolean {
  if (!expected) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Round messages a rejoining player needs to catch up; the latest of each, in send order. */
const REPLAYED: ReadonlySet<ServerMessage['type']> = new Set([
  'roundIntro',
  'roundResult',
  'matchResult',
]);

export interface RoomHooks {
  /** Called once when the host starts the match, with the room in INTRO and bots seated. */
  onMatchStart(room: Room): void;
}

/** One lobby/match room. Plain logic: no sockets, no timers. */
export class Room {
  phase: RoomPhase = 'LOBBY';
  host: Slot = 0;
  /** Requested bot count (host setting). Empty seats are always filled with bots at start. */
  botCount = 0;
  /** Set while a match loop runs for this room. */
  match: MatchHandle | null = null;
  private readonly seats: (Seat | null)[] = Array.from({ length: MAX_PLAYERS }, () => null);
  private replay: ServerMessage[] = [];

  constructor(
    readonly code: string,
    private readonly hooks: RoomHooks,
    private readonly log: Log = noLog,
  ) {}

  /** Seats a human in the first free slot. Returns null when the room is full. */
  join(name: string, member: Member): { slot: Slot; rejoinToken: string } | null {
    const slot = this.seats.findIndex((s) => s === null);
    if (slot < 0) return null;
    const rejoinToken = randomBytes(16).toString('hex');
    this.seats[slot] = { name, isBot: false, ready: false, connected: true, member, rejoinToken };
    if (this.humanSlots().length === 1) this.host = slot;
    return { slot, rejoinToken };
  }

  /**
   * Gives a human seat back to whoever holds its rejoin token. The seat keeps its name and
   * score; a socket still holding it (a stale tab, or a drop the heartbeat has not noticed yet)
   * is returned as `replaced` so the caller can evict it. Null when no seat has that token.
   */
  rejoin(
    token: string,
    member: Member,
  ): { slot: Slot; rejoinToken: string; replaced: Member | null } | null {
    let found = -1;
    // Check every seat so the time taken does not depend on which one matched.
    this.seats.forEach((s, i) => {
      if (s && !s.isBot && tokenMatches(s.rejoinToken, token)) found = i;
    });
    const seat = this.seats[found];
    if (!seat) return null;
    const replaced = seat.member;
    seat.member = member;
    seat.connected = true;
    if (!this.seats[this.host]?.connected) this.setHost(found);
    return { slot: found, rejoinToken: seat.rejoinToken, replaced };
  }

  /** Sends a rejoined player the current round's intro and latest results, in order. */
  catchUp(slot: Slot): void {
    for (const m of this.replay) this.sendTo(slot, m);
  }

  /** Removes a human. In the lobby the seat is freed; later phases keep it, marked disconnected. */
  leave(slot: Slot): void {
    const seat = this.seats[slot];
    if (!seat || seat.isBot) return;
    if (this.phase === 'LOBBY') {
      this.seats[slot] = null;
    } else {
      seat.connected = false;
      seat.member = null;
    }
    if (this.host === slot) {
      const next = this.humanSlots().find((s) => this.seats[s]?.connected);
      if (next !== undefined) this.setHost(next);
    }
    this.broadcastState();
  }

  /** Disconnects every member (the room is closing). */
  evictAll(message: string): void {
    for (const seat of this.seats) {
      const member = seat?.member;
      if (!seat || !member) continue;
      seat.member = null;
      seat.connected = false;
      member.evict?.(message);
    }
  }

  private setHost(slot: Slot): void {
    if (this.host === slot) return;
    this.host = slot;
    this.log('hostChanged', { room: this.code, host: slot });
  }

  setReady(slot: Slot, ready: boolean): RoomResult {
    const seat = this.seats[slot];
    if (!seat) return err('badPhase', 'Not seated.');
    if (this.phase !== 'LOBBY') return err('badPhase', 'Ready can only change in the lobby.');
    seat.ready = ready;
    this.broadcastState();
    return OK;
  }

  setBotCount(slot: Slot, count: number): RoomResult {
    if (slot !== this.host) return err('notHost', 'Only the host can do that.');
    if (this.phase !== 'LOBBY') return err('badPhase', 'Bots can only change in the lobby.');
    this.botCount = count;
    return OK;
  }

  /** Host starts the match once every human is ready. Empty seats become bots. */
  start(slot: Slot): RoomResult {
    if (slot !== this.host) return err('notHost', 'Only the host can start the match.');
    if (this.phase !== 'LOBBY') return err('badPhase', 'The match has already started.');
    if (!this.humanSlots().every((s) => this.seats[s]?.ready))
      return err('badPhase', 'Everyone must be ready.');
    for (let i = 0; i < MAX_PLAYERS; i++) {
      if (this.seats[i] === null) {
        this.seats[i] = {
          name: `Bot ${i + 1}`,
          isBot: true,
          ready: true,
          connected: true,
          member: null,
          rejoinToken: '',
        };
      }
    }
    this.phase = 'INTRO';
    this.broadcastState();
    this.hooks.onMatchStart(this);
    return OK;
  }

  /** Podium -> lobby: bots leave, ready flags clear, disconnected humans are dropped. */
  rematch(slot: Slot): RoomResult {
    if (!this.seats[slot]) return err('badPhase', 'Not seated.');
    if (this.phase !== 'PODIUM') return err('badPhase', 'Rematch is only available on the podium.');
    this.phase = 'LOBBY';
    this.replay = [];
    for (let i = 0; i < MAX_PLAYERS; i++) {
      const seat = this.seats[i];
      if (!seat) continue;
      if (seat.isBot || !seat.connected) this.seats[i] = null;
      else seat.ready = false;
    }
    if (!this.seats[this.host]) this.setHost(this.humanSlots()[0] ?? 0);
    this.broadcastState();
    return OK;
  }

  /** Slots of seated humans (connected or not). */
  humanSlots(): Slot[] {
    const out: Slot[] = [];
    this.seats.forEach((s, i) => {
      if (s && !s.isBot) out.push(i);
    });
    return out;
  }

  /** True when no human is connected. */
  isEmpty(): boolean {
    return !this.seats.some((s) => s && !s.isBot && s.connected);
  }

  seatInfo(): (SeatInfo | null)[] {
    return this.seats.map((s, slot) =>
      s ? { slot, name: s.name, isBot: s.isBot, ready: s.ready, connected: s.connected } : null,
    );
  }

  roomState(): ServerMessage {
    return {
      type: 'roomState',
      code: this.code,
      seats: this.seatInfo(),
      host: this.host,
      phase: this.phase,
    };
  }

  broadcast(message: ServerMessage): void {
    if (REPLAYED.has(message.type)) {
      if (message.type === 'roundIntro' && message.round === 1) this.replay = [];
      this.replay = this.replay.filter((m) => m.type !== message.type);
      this.replay.push(message);
    }
    for (const seat of this.seats) seat?.member?.send(message);
  }

  broadcastState(): void {
    this.broadcast(this.roomState());
  }

  sendTo(slot: Slot, message: ServerMessage): void {
    this.seats[slot]?.member?.send(message);
  }
}
