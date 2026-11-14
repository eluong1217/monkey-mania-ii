import { NEUTRAL_INPUT, type PlayerInput } from '@monkey-mania-2/shared';

/** How far (CSS px) the thumb moves for full speed. */
const RADIUS = 48;
/** Stick travel below this share of the radius counts as standing still. */
const DEADZONE = 0.15;

/** True on phones and tablets (a coarse primary pointer). */
export function isTouchDevice(): boolean {
  return matchMedia('(pointer: coarse)').matches;
}

/**
 * On-screen controls: a floating stick anywhere on the left half and an action button on the
 * right. `sample()` returns the same PlayerInput the keyboard does. Hidden unless `active`.
 */
export class TouchControls {
  private readonly root = document.createElement('div');
  private readonly base = document.createElement('div');
  private readonly knob = document.createElement('div');
  private readonly button = document.createElement('button');
  private stickId: number | null = null;
  private originX = 0;
  private originY = 0;
  private moveX = 0;
  private moveY = 0;
  private buttonId: number | null = null;
  /** A tap shorter than one client tick still counts as one press. */
  private tapped = false;

  constructor(parent: HTMLElement) {
    const zone = document.createElement('div');
    this.root.id = 'touch';
    this.root.hidden = true;
    zone.className = 'touch-zone';
    this.base.className = 'touch-base';
    this.knob.className = 'touch-knob';
    this.base.hidden = true;
    this.button.className = 'touch-action';
    this.button.type = 'button';
    this.button.tabIndex = -1;
    this.button.textContent = 'GO!';
    this.button.setAttribute('aria-label', 'Action');
    this.base.append(this.knob);
    this.root.append(zone, this.base, this.button);
    parent.append(this.root);

    zone.addEventListener('pointerdown', (e) => this.stickDown(e, zone));
    zone.addEventListener('pointermove', (e) => this.stickMove(e));
    for (const type of ['pointerup', 'pointercancel']) {
      zone.addEventListener(type, (e) => {
        if ((e as PointerEvent).pointerId === this.stickId) this.releaseStick();
      });
      this.button.addEventListener(type, (e) => {
        if ((e as PointerEvent).pointerId === this.buttonId) this.buttonId = null;
        this.button.classList.remove('held');
      });
    }
    this.button.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.button.setPointerCapture(e.pointerId);
      this.buttonId = e.pointerId;
      this.tapped = true;
      this.button.classList.add('held');
    });
    // iOS Safari ignores user-scalable=no and touch-action: none, and treats quick button taps
    // as a double-tap zoom and stick-plus-button as a pinch. Cancelling the touch events stops it.
    const noop = (e: Event): void => e.preventDefault();
    for (const type of ['touchstart', 'touchmove', 'touchend']) {
      this.root.addEventListener(type, noop, { passive: false });
    }
    for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
      document.addEventListener(type, noop);
    }
    // No long-press menu on the controls.
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  set active(on: boolean) {
    if (this.root.hidden === !on) return;
    this.root.hidden = !on;
    if (!on) this.reset();
  }

  /** Let go of everything (tab hidden, device rotated). */
  reset(): void {
    this.releaseStick();
    this.buttonId = null;
    this.tapped = false;
    this.button.classList.remove('held');
  }

  sample(): PlayerInput {
    if (this.root.hidden) return { ...NEUTRAL_INPUT };
    const action = this.buttonId !== null || this.tapped;
    this.tapped = false;
    return { moveX: this.moveX, moveY: this.moveY, action };
  }

  private stickDown(e: PointerEvent, zone: HTMLElement): void {
    if (this.stickId !== null) return;
    e.preventDefault();
    zone.setPointerCapture(e.pointerId);
    this.stickId = e.pointerId;
    this.originX = e.clientX;
    this.originY = e.clientY;
    this.base.style.left = `${e.clientX}px`;
    this.base.style.top = `${e.clientY}px`;
    this.base.hidden = false;
    this.knob.style.transform = '';
  }

  private stickMove(e: PointerEvent): void {
    if (e.pointerId !== this.stickId) return;
    let dx = e.clientX - this.originX;
    let dy = e.clientY - this.originY;
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) {
      // Dragging past the edge pulls the stick along, so reversing is quick.
      this.originX += (dx / len) * (len - RADIUS);
      this.originY += (dy / len) * (len - RADIUS);
      this.base.style.left = `${this.originX}px`;
      this.base.style.top = `${this.originY}px`;
      dx = (dx / len) * RADIUS;
      dy = (dy / len) * RADIUS;
    }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const mag = Math.min(1, Math.hypot(dx, dy) / RADIUS);
    if (mag < DEADZONE) {
      this.moveX = this.moveY = 0;
    } else {
      this.moveX = dx / RADIUS;
      this.moveY = dy / RADIUS;
    }
  }

  private releaseStick(): void {
    this.stickId = null;
    this.moveX = this.moveY = 0;
    this.base.hidden = true;
  }
}
