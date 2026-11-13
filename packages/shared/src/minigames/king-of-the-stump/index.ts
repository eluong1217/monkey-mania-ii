import { clampToBounds, createBody, integrate, resolveAll, type Body } from '../../arena.js';
import { DT, LOGICAL_HEIGHT, LOGICAL_WIDTH, secondsToTicks } from '../../constants.js';
import { createCooldown, tryUse, type Cooldown } from '../../cooldown.js';
import { NEUTRAL_INPUT } from '../../input.js';
import { rankBy, type BaseSnapshot, type MiniGame, type Slot } from '../../minigame.js';
import { createRng, type Rng } from '../../rng.js';

/** Every balance number. Speeds in px/s, durations in seconds, distances in px. */
export const tuning = {
  capSeconds: 45,
  // Monkeys
  playerRadius: 12,
  moveSpeed: 120,
  spawnRadius: 70, // distance from the centre at the start
  damping: 0.87, // per tick, applied to knockback velocity
  // Platform: shrinks linearly from start to min over shrinkSeconds, then stays
  platformStartRadius: 150,
  platformMinRadius: 45,
  shrinkSeconds: 40,
  // Shove
  shoveCooldownSeconds: 1.5,
  shoveRange: 40, // centre-to-centre reach
  shoveCone: 0.5, // min cos of the angle between facing and the target
  shoveKnockback: 340,
  shoveRecoil: 70,
  /** How long (seconds) the client may show the shove burst. */
  shoveShowSeconds: 0.2,
};

export const PLATFORM_X = LOGICAL_WIDTH / 2;
export const PLATFORM_Y = LOGICAL_HEIGHT / 2;

interface StumpPlayer {
  slot: Slot;
  body: Body;
  alive: boolean;
  /** Tick of elimination, or -1 while alive. */
  outAt: number;
  shove: Cooldown;
  /** Tick of the last shove, or -1. */
  shovedAt: number;
  faceX: number;
  faceY: number;
}

export interface KingOfTheStumpState {
  rng: Rng;
  tick: number;
  players: StumpPlayer[];
  platformR: number;
}

export interface KingOfTheStumpSnapshot extends BaseSnapshot {
  platformR: number;
  alive: boolean[];
  /** Elimination tick per player index, -1 while alive. */
  outAt: number[];
  shoveReadyAt: number[];
  shovedAt: number[];
  faceX: number[];
  faceY: number[];
}

/** Platform radius `tick` ticks into the round. */
export function platformRadius(tick: number): number {
  const k = Math.min(1, tick / secondsToTicks(tuning.shrinkSeconds));
  return tuning.platformStartRadius + (tuning.platformMinRadius - tuning.platformStartRadius) * k;
}

export const kingOfTheStump: MiniGame<KingOfTheStumpState, KingOfTheStumpSnapshot> = {
  id: 'king-of-the-stump',
  displayName: 'King of the Stump',
  controlsHint: 'Stay on the stump. Action: shove.',
  view: 'top',
  tuning,

  init(seed, playerSlots) {
    const rng = createRng(seed);
    const n = playerSlots.length;
    const players = playerSlots.map((slot, i) => {
      const a = ((i + 0.5) / n) * Math.PI * 2;
      const x = PLATFORM_X + Math.cos(a) * tuning.spawnRadius;
      const y = PLATFORM_Y + Math.sin(a) * tuning.spawnRadius;
      return {
        slot,
        body: createBody(x, y, tuning.playerRadius),
        alive: true,
        outAt: -1,
        shove: createCooldown(),
        shovedAt: -1,
        faceX: -Math.cos(a), // look at the centre
        faceY: -Math.sin(a),
      };
    });
    return { rng, tick: 0, players, platformR: platformRadius(0) };
  },

  step(state, inputs, tick) {
    // Shoves resolve first, all against the positions at the start of the tick, so slot order
    // does not matter.
    const hits: { target: StumpPlayer; from: StumpPlayer }[] = [];
    const shovers: StumpPlayer[] = [];
    for (const p of state.players) {
      if (!p.alive) continue;
      const input = inputs[p.slot] ?? NEUTRAL_INPUT;
      const len = Math.hypot(input.moveX, input.moveY);
      if (len > 0.1) {
        p.faceX = input.moveX / len;
        p.faceY = input.moveY / len;
      }
      if (input.action && tryUse(p.shove, tick, secondsToTicks(tuning.shoveCooldownSeconds))) {
        p.shovedAt = tick;
        shovers.push(p);
        for (const t of state.players) {
          if (t === p || !t.alive) continue;
          const dx = t.body.x - p.body.x;
          const dy = t.body.y - p.body.y;
          const d = Math.hypot(dx, dy);
          if (d > tuning.shoveRange) continue;
          if (d > 0 && (dx * p.faceX + dy * p.faceY) / d < tuning.shoveCone) continue;
          hits.push({ target: t, from: p });
        }
      }
    }
    for (const { target, from } of hits) {
      const dx = target.body.x - from.body.x;
      const dy = target.body.y - from.body.y;
      const d = Math.hypot(dx, dy);
      const nx = d > 0 ? dx / d : from.faceX;
      const ny = d > 0 ? dy / d : from.faceY;
      target.body.vx += nx * tuning.shoveKnockback;
      target.body.vy += ny * tuning.shoveKnockback;
    }
    for (const p of shovers) {
      p.body.vx -= p.faceX * tuning.shoveRecoil;
      p.body.vy -= p.faceY * tuning.shoveRecoil;
    }

    // Movement, then body pushing
    const alive = state.players.filter((p) => p.alive);
    for (const p of alive) {
      const input = inputs[p.slot] ?? NEUTRAL_INPUT;
      p.body.x += input.moveX * tuning.moveSpeed * DT;
      p.body.y += input.moveY * tuning.moveSpeed * DT;
      integrate(p.body, tuning.damping);
    }
    resolveAll(alive.map((p) => p.body));
    for (const p of alive) clampToBounds(p.body);

    // Platform shrink and falling off
    state.platformR = platformRadius(tick + 1);
    for (const p of alive) {
      if (Math.hypot(p.body.x - PLATFORM_X, p.body.y - PLATFORM_Y) > state.platformR) {
        p.alive = false;
        p.outAt = tick;
        p.body.vx = 0;
        p.body.vy = 0;
      }
    }

    state.tick = tick + 1;
    return state;
  },

  isOver(state) {
    const alive = state.players.filter((p) => p.alive).length;
    const floor = Math.min(1, state.players.length - 1);
    return alive <= floor || state.tick >= secondsToTicks(tuning.capSeconds);
  },

  placements(state) {
    const out = new Map(state.players.map((p) => [p.slot, p.alive ? Infinity : p.outAt]));
    return rankBy(
      state.players.map((p) => p.slot),
      (s) => out.get(s) as number,
    );
  },

  snapshot(state) {
    return {
      tick: state.tick,
      timeLeft: Math.max(0, tuning.capSeconds - state.tick * DT),
      players: state.players.map((p) => ({ slot: p.slot, x: p.body.x, y: p.body.y, r: p.body.r })),
      platformR: state.platformR,
      alive: state.players.map((p) => p.alive),
      outAt: state.players.map((p) => p.outAt),
      shoveReadyAt: state.players.map((p) => p.shove.readyAt),
      shovedAt: state.players.map((p) => p.shovedAt),
      faceX: state.players.map((p) => p.faceX),
      faceY: state.players.map((p) => p.faceY),
    };
  },
};
