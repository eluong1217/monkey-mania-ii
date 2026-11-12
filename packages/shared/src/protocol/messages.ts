import type { BaseSnapshot, Slot } from '../minigame.js';
import type { PlayerInput } from '../input.js';
import type { ERROR_CODES, ROOM_PHASES } from './constants.js';

export type RoomPhase = (typeof ROOM_PHASES)[number];
export type ErrorCode = (typeof ERROR_CODES)[number];

// ---- Client -> server ----

export type ClientMessage =
  | { type: 'createRoom'; v: number; name: string }
  | { type: 'joinRoom'; v: number; code: string; name: string; rejoinToken?: string }
  | { type: 'setReady'; ready: boolean }
  | { type: 'startMatch' }
  | { type: 'setBotCount'; count: number }
  | { type: 'input'; tick: number; input: PlayerInput }
  | { type: 'rematch' }
  | { type: 'leave' };

// ---- Server -> client ----

export interface SeatInfo {
  slot: Slot;
  /** Empty seats are `null` in `roomState.seats`; filled seats have this shape. */
  name: string;
  isBot: boolean;
  ready: boolean;
  connected: boolean;
}

export interface RoundScore {
  slot: Slot;
  /** Party points earned this round (already doubled in the final round). */
  points: number;
  /** Party points after this round. */
  total: number;
}

export type ServerMessage =
  | {
      type: 'roomState';
      code: string;
      /** Always 4 entries, indexed by slot; `null` is an empty seat. */
      seats: (SeatInfo | null)[];
      host: Slot;
      phase: RoomPhase;
    }
  | { type: 'joined'; v: number; slot: Slot; rejoinToken: string }
  | {
      type: 'roundIntro';
      round: number;
      totalRounds: number;
      miniGameId: string;
      displayName: string;
      controlsHint: string;
      view: 'side' | 'top';
    }
  | { type: 'snapshot'; tick: number; miniGameId: string; state: BaseSnapshot }
  | {
      type: 'roundResult';
      round: number;
      /** Ordered groups of slots; ties share a group. */
      placements: Slot[][];
      scores: RoundScore[];
    }
  | { type: 'matchResult'; placements: Slot[][]; totals: RoundScore[] }
  | { type: 'error'; code: ErrorCode; message: string };

export type ClientMessageType = ClientMessage['type'];
export type ServerMessageType = ServerMessage['type'];

export interface ParseFailure {
  code: ErrorCode;
  message: string;
}

export type ParseResult<T> = { ok: true; message: T } | { ok: false; error: ParseFailure };
