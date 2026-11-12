/** Bump when a message changes incompatibly. Sent in createRoom / joinRoom. */
export const PROTOCOL_VERSION = 1;

/** Room codes: 4 uppercase letters, no I, L or O (easy to confuse with 1 and 0). */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';
export const ROOM_CODE_LENGTH = 4;
export const ROOM_CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/;

export const NAME_MAX_LENGTH = 12;

/** Maximum raw message length (UTF-16 code units) accepted from a client. */
export const MAX_CLIENT_MESSAGE_SIZE = 1024;
/** Maximum raw message length accepted from the server. */
export const MAX_SERVER_MESSAGE_SIZE = 65536;

export const MAX_REJOIN_TOKEN_LENGTH = 64;
/** Bots can fill at most this many seats (one seat is always a human). */
export const MAX_BOTS = 3;

export const ROOM_PHASES = ['LOBBY', 'INTRO', 'PLAYING', 'RESULTS', 'PODIUM'] as const;

export const ERROR_CODES = [
  'badJson',
  'tooLarge',
  'badMessage',
  'unknownType',
  'badVersion',
  'roomNotFound',
  'roomFull',
  'notHost',
  'badPhase',
  'rateLimited',
] as const;
