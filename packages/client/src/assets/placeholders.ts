import { SLOT_COLORS } from '../render/types';
import type { ImageEntry, SheetEntry } from './manifest';
import { MONKEY_COLORS } from './manifest';

function canvas(w: number, h: number): CanvasRenderingContext2D {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c.getContext('2d') as CanvasRenderingContext2D;
}

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/** Stable pastel from a key, so different missing images are told apart. */
function tint(key: string): string {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 45% 45%)`;
}

/** A labelled box for a missing image. */
export function imagePlaceholder(e: ImageEntry): HTMLCanvasElement {
  const ctx = canvas(e.width, e.height);
  ctx.fillStyle = tint(e.key);
  ctx.fillRect(0, 0, e.width, e.height);
  ctx.strokeStyle = '#fff';
  ctx.strokeRect(0.5, 0.5, e.width - 1, e.height - 1);
  ctx.fillStyle = '#fff';
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(e.key.slice(0, Math.max(4, Math.floor(e.width / 5))), e.width / 2, e.height / 2);
  return ctx.canvas;
}

/**
 * A missing sheet. Monkey sheets get the original look: a slot-coloured circle with "P1".."P4"
 * above it (the circle matches the sim's 12 px player radius in a 64 px frame). Others get a
 * labelled box per frame.
 */
export function sheetPlaceholder(e: SheetEntry): HTMLCanvasElement {
  const { frameWidth: fw, frameHeight: fh } = e;
  const ctx = canvas(fw * e.frames, fh);
  const variant = MONKEY_COLORS.findIndex((c) => e.key.startsWith(`monkey_${c}_`));
  for (let i = 0; i < e.frames; i++) {
    ctx.save();
    ctx.translate(i * fw, 0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '10px monospace';
    ctx.fillStyle = '#fff';
    if (variant >= 0) {
      const r = fw * 0.1875;
      ctx.beginPath();
      ctx.arc(fw / 2, fh / 2, r, 0, Math.PI * 2);
      ctx.fillStyle = hex(SLOT_COLORS[variant] ?? 0xffffff);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(`P${variant + 1}`, fw / 2, fh / 2 - r - 8);
    } else {
      ctx.fillStyle = tint(e.key);
      ctx.fillRect(0, 0, fw, fh);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(0.5, 0.5, fw - 1, fh - 1);
      ctx.fillStyle = '#fff';
      ctx.fillText(String(i), fw / 2, fh / 2);
    }
    ctx.restore();
  }
  return ctx.canvas;
}
