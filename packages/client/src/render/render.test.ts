import { describe, expect, it } from 'vitest';
import type { BaseSnapshot } from '@monkey-mania-2/shared';
import { fallbackRenderer, getRenderer, renderers, slotColor, type RenderScene } from './index';

function recorder(localSlot: number | null = 0) {
  const calls: string[] = [];
  const scene: RenderScene = {
    localSlot,
    circle: (x, y, r, fill) => calls.push(`circle ${x},${y},${r} #${fill.toString(16)}`),
    ring: (x, y) => calls.push(`ring ${x},${y}`),
    text: (x, y, t) => calls.push(`text ${t}`),
  };
  return { scene, calls };
}

const snap: BaseSnapshot = {
  tick: 5,
  timeLeft: 9.2,
  players: [
    { slot: 0, x: 10, y: 20, r: 12 },
    { slot: 3, x: 50, y: 60, r: 12 },
  ],
  entities: [{ kind: 'banana', x: 100, y: 100, r: 6 }],
};

describe('renderer registry', () => {
  it('has sandbox and falls back for unknown ids', () => {
    expect(getRenderer('sandbox')).toBe(renderers.sandbox);
    expect(getRenderer('not-a-game')).toBe(fallbackRenderer);
    expect(getRenderer('toString')).toBe(fallbackRenderer);
  });

  it('fallback draws every entity and player, labels slots and marks the local player', () => {
    const { scene, calls } = recorder(3);
    fallbackRenderer(snap, scene);
    expect(calls).toContain('circle 100,100,6 #dddddd');
    expect(calls).toContain(`circle 10,20,12 #${slotColor(0).toString(16)}`);
    expect(calls).toContain('text P1');
    expect(calls).toContain('text P4');
    expect(calls).toContain('text B');
    expect(calls).toContain('ring 50,60');
    expect(calls).toContain('text 10');
  });

  it('sandbox draws players with labels', () => {
    const { scene, calls } = recorder(0);
    getRenderer('sandbox')({ ...snap, pushReadyAt: [0, 0, 0, 0] } as BaseSnapshot, scene);
    expect(calls).toContain('text P1');
    expect(calls).toContain('ring 10,20');
  });
});
