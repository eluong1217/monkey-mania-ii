import { sanitizeInput, type PlayerInput } from '@monkey-mania-2/shared';

const LEFT = ['KeyA', 'ArrowLeft'];
const RIGHT = ['KeyD', 'ArrowRight'];
const UP = ['KeyW', 'ArrowUp'];
const DOWN = ['KeyS', 'ArrowDown'];
const ACTION = ['Space'];
const GAME_KEYS = new Set([...LEFT, ...RIGHT, ...UP, ...DOWN, ...ACTION]);

/** Tracks held keys; `sample()` turns them into a PlayerInput once per client tick. */
export class Keyboard {
  private readonly down = new Set<string>();
  /** While true, game keys do not scroll the page or press focused buttons. */
  capturing = false;

  attach(target: Window): void {
    target.addEventListener('keydown', (e) => {
      if (!GAME_KEYS.has(e.code)) return;
      this.down.add(e.code);
      if (this.capturing) e.preventDefault();
    });
    target.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
    });
    // Keys released while the window is unfocused would otherwise stay held.
    target.addEventListener('blur', () => this.release());
  }

  /** Forget every held key. */
  release(): void {
    this.down.clear();
  }

  private any(codes: string[]): boolean {
    return codes.some((c) => this.down.has(c));
  }

  sample(): PlayerInput {
    return sanitizeInput({
      moveX: Number(this.any(RIGHT)) - Number(this.any(LEFT)),
      moveY: Number(this.any(DOWN)) - Number(this.any(UP)),
      action: this.any(ACTION),
    });
  }
}
