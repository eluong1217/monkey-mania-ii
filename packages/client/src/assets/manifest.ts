import raw from '../../../../assets/manifest.json';

export interface ImageEntry {
  key: string;
  file: string;
  width: number;
  height: number;
}
export interface AnimationEntry {
  name: string;
  start: number;
  end: number;
  fps: number;
  loop: boolean;
}
export interface SheetEntry {
  key: string;
  file: string;
  frameWidth: number;
  frameHeight: number;
  frames: number;
  animations: AnimationEntry[];
}
export interface AudioEntry {
  key: string;
  file: string;
  music: boolean;
}
export interface Manifest {
  images: ImageEntry[];
  sheets: SheetEntry[];
  audio: AudioEntry[];
}

/** Bundled with the client, so the game knows every key even when `assets/` is empty. */
export const manifest: Manifest = raw;

/** URL prefix the files are served under (see the assets plugin in vite.config.ts). */
export const ASSET_BASE = '/assets/';

/** Sprite-sheet key for a monkey: variants follow slot order red, blue, yellow, green. */
export const MONKEY_COLORS = ['red', 'blue', 'yellow', 'green'] as const;

export function monkeyColor(slot: number): string {
  return MONKEY_COLORS[slot % MONKEY_COLORS.length]!;
}

export function monkeyKey(slot: number, view: 'top' | 'side' = 'top'): string {
  return `monkey_${MONKEY_COLORS[slot % MONKEY_COLORS.length]}_${view}`;
}

/** Animation key registered with Phaser for a sheet's named animation. */
export function animKey(sheetKey: string, name: string): string {
  return `${sheetKey}:${name}`;
}

/** Returns a list of problems; empty when the manifest is sound. */
export function validateManifest(m: Manifest): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  const files = new Set<string>();
  const entries = [...m.images, ...m.sheets, ...m.audio];
  for (const e of entries) {
    if (seen.has(e.key)) problems.push(`duplicate key ${e.key}`);
    seen.add(e.key);
    if (files.has(e.file)) problems.push(`duplicate file ${e.file}`);
    files.add(e.file);
  }
  for (const i of m.images)
    if (!(i.width > 0 && i.height > 0)) problems.push(`${i.key}: bad size`);
  for (const s of m.sheets) {
    if (!(s.frameWidth > 0 && s.frameHeight > 0 && s.frames > 0)) problems.push(`${s.key}: bad size`);
    const names = new Set<string>();
    for (const a of s.animations) {
      if (names.has(a.name)) problems.push(`${s.key}: duplicate animation ${a.name}`);
      names.add(a.name);
      if (!(a.start >= 0 && a.start <= a.end && a.end < s.frames))
        problems.push(`${s.key}.${a.name}: frames ${a.start}-${a.end} outside 0-${s.frames - 1}`);
      if (!(a.fps > 0)) problems.push(`${s.key}.${a.name}: fps must be positive`);
    }
  }
  return problems;
}
