import { describe, expect, it } from 'vitest';
import { animKey, manifest, monkeyKey, validateManifest } from './manifest';

describe('asset manifest', () => {
  it('is valid: unique keys and files, animations inside frame bounds', () => {
    expect(validateManifest(manifest)).toEqual([]);
  });

  it('catches duplicate keys and out-of-range animations', () => {
    const bad = structuredClone(manifest);
    bad.images.push({ ...bad.images[0]! });
    bad.sheets[0]!.animations.push({ name: 'x', start: 5, end: 9, fps: 4, loop: false });
    const problems = validateManifest(bad);
    expect(problems.some((p) => p.startsWith('duplicate key'))).toBe(true);
    expect(problems.some((p) => p.includes('outside 0-6'))).toBe(true);
  });

  it('has a monkey sheet for every slot and view', () => {
    const keys = new Set(manifest.sheets.map((s) => s.key));
    for (let slot = 0; slot < 4; slot++) {
      expect(keys.has(monkeyKey(slot))).toBe(true);
      expect(keys.has(monkeyKey(slot, 'side'))).toBe(true);
    }
    expect(animKey('monkey_red_top', 'run')).toBe('monkey_red_top:run');
  });
});
