import {
  clampToBounds,
  createBody,
  integrate,
  knockback,
  resolveAll,
  type Body,
} from '../../arena.js';
import { DT, LOGICAL_HEIGHT, LOGICAL_WIDTH, secondsToTicks, TICK_RATE } from '../../constants.js';
import { createCooldown, tryUse, type Cooldown } from '../../cooldown.js';
import { NEUTRAL_INPUT } from '../../input.js';
import type { BaseSnapshot, MiniGame, Slot } from '../../minigame.js';
import { createRng, nextRange, type Rng } from '../../rng.js';

/**
 * Placeholder round for building the server and client before real mini-games exist.
 * Four circles move around for 10 s; action is a small push on nearby rivals. Placements are
 * slot order.
 */
export const tuning = {
  durationSeconds: 10,
  radius: 12,
  moveSpeed: 150,
  pushRange: 40,
  pushSpeed: 300,
  pushCooldownSeconds: 1,
  damping: 0.85,
  spawnJitter: 20,
};

interface SandboxPlayer {
  slot: Slot;
  body: Body;
  push: Cooldown;
}

export interface SandboxState {
  rng: Rng;
  tick: number;
  players: SandboxPlayer[];
}

export interface SandboxSnapshot extends BaseSnapshot {
  pushReadyAt: number[];
}

const SPAWNS: readonly [number, number][] = [
  [0.25, 0.3],
  [0.75, 0.3],
  [0.25, 0.7],
  [0.75, 0.7],
];

export const sandbox: MiniGame<SandboxState, SandboxSnapshot> = {
  id: 'sandbox',
  displayName: 'Sandbox',
  controlsHint: 'Move around. Action: push.',
  view: 'top',
  tuning,

  init(seed, playerSlots) {
    const rng = createRng(seed);
    const players = playerSlots.map((slot) => {
      const [fx, fy] = SPAWNS[slot % SPAWNS.length] as [number, number];
      const x = fx * LOGICAL_WIDTH + nextRange(rng, -tuning.spawnJitter, tuning.spawnJitter);
      const y = fy * LOGICAL_HEIGHT + nextRange(rng, -tuning.spawnJitter, tuning.spawnJitter);
      return { slot, body: createBody(x, y, tuning.radius), push: createCooldown() };
    });
    return { rng, tick: 0, players };
  },

  step(state, inputs, tick) {
    const cooldown = secondsToTicks(tuning.pushCooldownSeconds);
    for (const p of state.players) {
      const input = inputs[p.slot] ?? NEUTRAL_INPUT;
      p.body.x += input.moveX * tuning.moveSpeed * DT;
      p.body.y += input.moveY * tuning.moveSpeed * DT;
      if (input.action && tryUse(p.push, tick, cooldown)) {
        for (const other of state.players) {
          if (other === p) continue;
          const d = Math.hypot(other.body.x - p.body.x, other.body.y - p.body.y);
          if (d <= tuning.pushRange) knockback(other.body, p.body.x, p.body.y, tuning.pushSpeed);
        }
      }
    }
    for (const p of state.players) integrate(p.body, tuning.damping);
    resolveAll(state.players.map((p) => p.body));
    for (const p of state.players) clampToBounds(p.body);
    state.tick = tick + 1;
    return state;
  },

  isOver(state) {
    return state.tick >= tuning.durationSeconds * TICK_RATE;
  },

  placements(state) {
    return state.players.map((p) => [p.slot]);
  },

  snapshot(state) {
    return {
      tick: state.tick,
      timeLeft: Math.max(0, tuning.durationSeconds - state.tick / TICK_RATE),
      players: state.players.map((p) => ({ slot: p.slot, x: p.body.x, y: p.body.y, r: p.body.r })),
      pushReadyAt: state.players.map((p) => p.push.readyAt),
    };
  },
};
