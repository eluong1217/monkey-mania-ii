import { describe, expect, it } from 'vitest';
import {
  MAX_CLIENT_MESSAGE_SIZE,
  PROTOCOL_VERSION as V,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_PATTERN,
  encodeMessage,
  parseClientMessage,
  parseServerMessage,
  sanitizeName,
  type ClientMessage,
  type ServerMessage,
} from './index';

const clientMessages: ClientMessage[] = [
  { type: 'createRoom', v: V, name: 'Bongo' },
  { type: 'joinRoom', v: V, code: 'ABCD', name: 'Kiki' },
  { type: 'joinRoom', v: V, code: 'ABCD', name: 'Kiki', rejoinToken: 'tok123' },
  { type: 'setReady', ready: true },
  { type: 'startMatch' },
  { type: 'setBotCount', count: 2 },
  { type: 'input', tick: 42, input: { moveX: 0.5, moveY: -0.5, action: true } },
  { type: 'rematch' },
  { type: 'leave' },
];

const seat = { slot: 0, name: 'Bongo', isBot: false, ready: true, connected: true };
const scores = [
  { slot: 0, points: 3, total: 3 },
  { slot: 1, points: 2, total: 2 },
];
const serverMessages: ServerMessage[] = [
  { type: 'roomState', code: 'ABCD', seats: [seat, null, null, null], host: 0, phase: 'LOBBY' },
  { type: 'joined', v: V, slot: 1, rejoinToken: 'tok' },
  {
    type: 'roundIntro',
    round: 1,
    totalRounds: 5,
    miniGameId: 'sandbox',
    displayName: 'Sandbox',
    controlsHint: 'Move around.',
    view: 'top',
  },
  {
    type: 'snapshot',
    tick: 7,
    miniGameId: 'sandbox',
    state: { tick: 7, players: [{ slot: 0, x: 1, y: 2, r: 8 }] },
  },
  { type: 'roundResult', round: 1, placements: [[0], [1, 2], [3]], scores },
  { type: 'matchResult', placements: [[0], [1]], totals: scores },
  { type: 'error', code: 'roomFull', message: 'Room is full.' },
];

describe('protocol round trips', () => {
  it.each(clientMessages)('client $type', (msg) => {
    const r = parseClientMessage(encodeMessage(msg));
    expect(r).toEqual({ ok: true, message: msg });
  });
  it.each(serverMessages)('server $type', (msg) => {
    const r = parseServerMessage(encodeMessage(msg));
    expect(r).toEqual({ ok: true, message: msg });
  });
  it('covers every message type', () => {
    expect(new Set(clientMessages.map((m) => m.type)).size).toBe(8);
    expect(new Set(serverMessages.map((m) => m.type)).size).toBe(7);
  });
});

describe('rejection', () => {
  const junk: unknown[] = [
    undefined,
    null,
    42,
    {},
    [],
    'not json',
    '',
    '[]',
    'null',
    '"x"',
    '{}',
    '{"type":5}',
    '{"type":"nope"}',
    '{"type":"__proto__"}',
    '{"type":"constructor"}',
  ];
  it.each(junk)('rejects %j without throwing', (raw) => {
    expect(parseClientMessage(raw).ok).toBe(false);
    expect(parseServerMessage(raw).ok).toBe(false);
  });

  it('reports unknown types', () => {
    const r = parseClientMessage('{"type":"hack"}');
    expect(r).toMatchObject({ ok: false, error: { code: 'unknownType' } });
  });

  it('rejects oversized messages', () => {
    const raw = JSON.stringify({
      type: 'createRoom',
      v: V,
      name: 'x'.repeat(MAX_CLIENT_MESSAGE_SIZE),
    });
    expect(parseClientMessage(raw)).toMatchObject({ ok: false, error: { code: 'tooLarge' } });
  });

  it('rejects wrong-typed fields', () => {
    const bad = [
      { type: 'createRoom', v: V, name: 5 },
      { type: 'createRoom', v: V, name: '   ' },
      { type: 'createRoom', v: V + 1, name: 'A' },
      { type: 'joinRoom', v: V, code: 'ABC', name: 'A' },
      { type: 'joinRoom', v: V, code: 'ABIO', name: 'A' },
      { type: 'joinRoom', v: V, code: 'ABCD', name: 'A', rejoinToken: 7 },
      { type: 'setReady', ready: 'yes' },
      { type: 'setBotCount', count: 4 },
      { type: 'setBotCount', count: 1.5 },
      { type: 'input', tick: -1, input: {} },
      { type: 'input', tick: 1.5, input: {} },
      { type: 'input', tick: 1, input: 'x' },
      { type: 'input', tick: 1, input: null },
    ];
    for (const m of bad)
      expect(parseClientMessage(JSON.stringify(m)).ok, JSON.stringify(m)).toBe(false);
  });

  it('rejects malformed server messages', () => {
    const bad = [
      { type: 'roomState', code: 'ABCD', seats: [null], host: 0, phase: 'LOBBY' },
      { type: 'roomState', code: 'ABCD', seats: [null, null, null, null], host: 0, phase: 'NOPE' },
      { type: 'joined', v: V, slot: 9, rejoinToken: 't' },
      { type: 'snapshot', tick: 1, miniGameId: 'x', state: { tick: 1 } },
      { type: 'roundResult', round: 1, placements: [[9]], scores: [] },
      { type: 'error', code: 'bogus', message: 'x' },
    ];
    for (const m of bad)
      expect(parseServerMessage(JSON.stringify(m)).ok, JSON.stringify(m)).toBe(false);
  });
});

describe('sanitising', () => {
  it('cleans names', () => {
    expect(sanitizeName('  Bo\u0000ngo\n  Jr  ')).toBe('Bo ngo Jr');
    expect(sanitizeName('x'.repeat(50))).toHaveLength(12);
    expect(sanitizeName(null)).toBe('');
  });
  it('sanitises input values and normalises room codes', () => {
    const r = parseClientMessage(
      '{"type":"input","tick":1,"input":{"moveX":9,"moveY":"a","action":1}}',
    );
    expect(r).toMatchObject({
      ok: true,
      message: { input: { moveX: 1, moveY: 0, action: false } },
    });
    const j = parseClientMessage(`{"type":"joinRoom","v":${V},"code":" abcd ","name":"A"}`);
    expect(j).toMatchObject({ ok: true, message: { code: 'ABCD' } });
  });
  it('room code alphabet has no ambiguous letters', () => {
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[ILO01]/);
    expect(ROOM_CODE_PATTERN.test('ABCD')).toBe(true);
  });
});
