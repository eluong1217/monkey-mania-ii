/** The only input a player ever sends: a move direction and one action button. */
export interface PlayerInput {
  /** -1 (left) .. 1 (right) */
  moveX: number;
  /** -1 (up) .. 1 (down) */
  moveY: number;
  action: boolean;
}

export const NEUTRAL_INPUT: Readonly<PlayerInput> = Object.freeze({
  moveX: 0,
  moveY: 0,
  action: false,
});

function axis(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(-1, Math.min(1, value));
}

/**
 * Turns anything (a parsed network message, a bot's output) into a valid PlayerInput.
 * Non-numbers and NaN/Infinity become 0, axes are clamped to -1..1, and the move vector is
 * limited to length 1 so diagonals are not faster. `action` is true only for literal `true`.
 */
export function sanitizeInput(raw: unknown): PlayerInput {
  if (typeof raw !== 'object' || raw === null) return { ...NEUTRAL_INPUT };
  const r = raw as Record<string, unknown>;
  let moveX = axis(r.moveX);
  let moveY = axis(r.moveY);
  const len = Math.hypot(moveX, moveY);
  if (len > 1) {
    moveX /= len;
    moveY /= len;
  }
  return { moveX, moveY, action: r.action === true };
}
