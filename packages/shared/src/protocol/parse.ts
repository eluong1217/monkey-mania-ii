import { sanitizeInput } from '../input.js';
import { MAX_PLAYERS } from '../constants.js';
import {
  ERROR_CODES,
  MAX_BOTS,
  MAX_CLIENT_MESSAGE_SIZE,
  MAX_REJOIN_TOKEN_LENGTH,
  MAX_SERVER_MESSAGE_SIZE,
  NAME_MAX_LENGTH,
  PROTOCOL_VERSION,
  ROOM_CODE_PATTERN,
  ROOM_PHASES,
} from './constants.js';
import type {
  ClientMessage,
  ParseResult,
  RoundScore,
  SeatInfo,
  ServerMessage,
} from './messages.js';

const MAX_SLOT_INDEX = MAX_PLAYERS - 1;

type Obj = Record<string, unknown>;

const fail = <T>(
  code: 'badJson' | 'tooLarge' | 'badMessage' | 'unknownType' | 'badVersion',
  message: string,
): ParseResult<T> => ({
  ok: false,
  error: { code, message },
});

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g;

/** Strips control characters, collapses whitespace, trims and truncates. May return ''. */
export function sanitizeName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const cleaned = raw.replace(CONTROL_CHARS, ' ');
  return Array.from(cleaned.replace(/\s+/g, ' ').trim()).slice(0, NAME_MAX_LENGTH).join('').trim();
}

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const isStr = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
const isSlot = (v: unknown): v is number => isInt(v, 0, MAX_SLOT_INDEX);

function decode(raw: unknown, maxSize: number): ParseResult<Obj & { type: string }> {
  if (typeof raw !== 'string') return fail('badJson', 'Message must be a string.');
  if (raw.length > maxSize) return fail('tooLarge', 'Message too large.');
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return fail('badJson', 'Message is not valid JSON.');
  }
  if (!isObj(value) || typeof value.type !== 'string')
    return fail('badMessage', 'Message needs a string "type".');
  return { ok: true, message: value as Obj & { type: string } };
}

/** Validates a raw WebSocket payload from a client. Never throws. */
export function parseClientMessage(raw: unknown): ParseResult<ClientMessage> {
  const d = decode(raw, MAX_CLIENT_MESSAGE_SIZE);
  if (!d.ok) return d;
  const m = d.message;
  const bad = (what: string) => fail<ClientMessage>('badMessage', `Invalid ${m.type}: ${what}.`);
  switch (m.type) {
    case 'createRoom': {
      if (m.v !== PROTOCOL_VERSION) return fail('badVersion', 'Protocol version mismatch.');
      const name = sanitizeName(m.name);
      if (!name) return bad('name');
      return { ok: true, message: { type: 'createRoom', v: m.v, name } };
    }
    case 'joinRoom': {
      if (m.v !== PROTOCOL_VERSION) return fail('badVersion', 'Protocol version mismatch.');
      const code = typeof m.code === 'string' ? m.code.trim().toUpperCase() : '';
      if (!ROOM_CODE_PATTERN.test(code)) return bad('code');
      const name = sanitizeName(m.name);
      if (!name) return bad('name');
      const out: ClientMessage = { type: 'joinRoom', v: m.v, code, name };
      if (m.rejoinToken !== undefined) {
        if (!isStr(m.rejoinToken, MAX_REJOIN_TOKEN_LENGTH) || !m.rejoinToken)
          return bad('rejoinToken');
        out.rejoinToken = m.rejoinToken;
      }
      return { ok: true, message: out };
    }
    case 'setReady':
      if (typeof m.ready !== 'boolean') return bad('ready');
      return { ok: true, message: { type: 'setReady', ready: m.ready } };
    case 'startMatch':
    case 'rematch':
    case 'leave':
      return { ok: true, message: { type: m.type } };
    case 'setBotCount':
      if (!isInt(m.count, 0, MAX_BOTS)) return bad('count');
      return { ok: true, message: { type: 'setBotCount', count: m.count } };
    case 'input':
      if (!isInt(m.tick, 0, Number.MAX_SAFE_INTEGER)) return bad('tick');
      if (!isObj(m.input)) return bad('input');
      return { ok: true, message: { type: 'input', tick: m.tick, input: sanitizeInput(m.input) } };
    default:
      return fail('unknownType', 'Unknown message type.');
  }
}

function isSeat(v: unknown): v is SeatInfo {
  return (
    isObj(v) &&
    isSlot(v.slot) &&
    isStr(v.name, NAME_MAX_LENGTH * 2) &&
    typeof v.isBot === 'boolean' &&
    typeof v.ready === 'boolean' &&
    typeof v.connected === 'boolean'
  );
}

const isPlacements = (v: unknown): v is number[][] =>
  Array.isArray(v) &&
  v.length <= 4 &&
  v.every((g) => Array.isArray(g) && g.length <= 4 && g.every(isSlot));

const isScores = (v: unknown): v is RoundScore[] =>
  Array.isArray(v) &&
  v.length <= 4 &&
  v.every((s) => isObj(s) && isSlot(s.slot) && isInt(s.points, 0, 1e6) && isInt(s.total, 0, 1e6));

/** Validates a raw payload from the server. Never throws. */
export function parseServerMessage(raw: unknown): ParseResult<ServerMessage> {
  const d = decode(raw, MAX_SERVER_MESSAGE_SIZE);
  if (!d.ok) return d;
  const m = d.message;
  const bad = (what: string) => fail<ServerMessage>('badMessage', `Invalid ${m.type}: ${what}.`);
  const ok = (message: unknown): ParseResult<ServerMessage> => ({
    ok: true,
    message: message as ServerMessage,
  });
  switch (m.type) {
    case 'roomState':
      if (typeof m.code !== 'string' || !ROOM_CODE_PATTERN.test(m.code)) return bad('code');
      if (
        !Array.isArray(m.seats) ||
        m.seats.length !== 4 ||
        !m.seats.every((s) => s === null || isSeat(s))
      )
        return bad('seats');
      if (!isSlot(m.host)) return bad('host');
      if (!(ROOM_PHASES as readonly unknown[]).includes(m.phase)) return bad('phase');
      return ok(m);
    case 'joined':
      if (m.v !== PROTOCOL_VERSION) return fail('badVersion', 'Protocol version mismatch.');
      if (!isSlot(m.slot)) return bad('slot');
      if (!isStr(m.rejoinToken, MAX_REJOIN_TOKEN_LENGTH) || !m.rejoinToken)
        return bad('rejoinToken');
      return ok(m);
    case 'roundIntro':
      if (!isInt(m.round, 1, 99) || !isInt(m.totalRounds, 1, 99)) return bad('round');
      if (!isStr(m.miniGameId, 64) || !isStr(m.displayName, 64) || !isStr(m.controlsHint, 200))
        return bad('text');
      if (m.view !== 'side' && m.view !== 'top') return bad('view');
      return ok(m);
    case 'snapshot':
      if (!isInt(m.tick, 0, Number.MAX_SAFE_INTEGER) || !isStr(m.miniGameId, 64))
        return bad('header');
      if (
        !isObj(m.state) ||
        !isInt(m.state.tick, 0, Number.MAX_SAFE_INTEGER) ||
        !Array.isArray(m.state.players)
      )
        return bad('state');
      return ok(m);
    case 'roundResult':
      if (!isInt(m.round, 1, 99)) return bad('round');
      if (!isPlacements(m.placements) || !isScores(m.scores)) return bad('results');
      return ok(m);
    case 'matchResult':
      if (!isPlacements(m.placements) || !isScores(m.totals)) return bad('results');
      return ok(m);
    case 'error':
      if (!(ERROR_CODES as readonly unknown[]).includes(m.code) || !isStr(m.message, 500))
        return bad('error');
      return ok(m);
    default:
      return fail('unknownType', 'Unknown message type.');
  }
}

/** Serialises a message. Convenience so callers don't hand-roll JSON.stringify. */
export function encodeMessage(message: ClientMessage | ServerMessage): string {
  return JSON.stringify(message);
}
