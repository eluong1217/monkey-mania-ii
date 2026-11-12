import { clampToBounds, createBody, integrate, type Body } from '../../arena.js';
import { DT, LOGICAL_HEIGHT, LOGICAL_WIDTH, secondsToTicks } from '../../constants.js';
import { createCooldown, tryUse, type Cooldown } from '../../cooldown.js';
import { NEUTRAL_INPUT } from '../../input.js';
import {
  rankBy,
  type BaseSnapshot,
  type EntityView,
  type MiniGame,
  type Slot,
} from '../../minigame.js';
import { createRng, nextFloat, nextRange, pick, type Rng } from '../../rng.js';

/** Every balance number. Speeds in px/s, durations in seconds. */
export const tuning = {
  capSeconds: 45,
  // Monkeys
  playerRadius: 12,
  moveSpeed: 150,
  // Coconuts. The warning must let a monkey standing at the centre walk out of the radius:
  // warnSeconds * moveSpeed >= impactRadius (asserted in tests).
  impactRadius: 34,
  warnSeconds: 1.1,
  impactShowSeconds: 0.3,
  // Spawning ramps linearly from start to end over the capped round
  spawnStartInterval: 1.0,
  spawnEndInterval: 0.35,
  maxExtraPerBatch: 2, // batch size grows from 1 to 1 + this
  targetPlayerStart: 0.25, // chance a coconut aims at a player's current position
  targetPlayerEnd: 0.6,
  spawnMargin: 24,
  firstSpawnSeconds: 1.0,
  // Roll
  rollCooldownSeconds: 3,
  rollSpeed: 420,
  rollTicks: 6,
  rollInvulnSeconds: 0.45,
  damping: 0.85,
};

interface Coconut {
  x: number;
  y: number;
  /** Tick on which it lands. */
  landsAt: number;
  /** Tick it appeared as a shadow. */
  warnedAt: number;
}

interface Impact {
  x: number;
  y: number;
  until: number;
}

interface DodgePlayer {
  slot: Slot;
  body: Body;
  alive: boolean;
  /** Tick of elimination, or -1 while alive. */
  outAt: number;
  roll: Cooldown;
  rollLeft: number;
  rollDirX: number;
  rollDirY: number;
  invulnUntil: number;
}

export interface CoconutDodgeState {
  rng: Rng;
  tick: number;
  players: DodgePlayer[];
  coconuts: Coconut[];
  impacts: Impact[];
  nextSpawnAt: number;
}

export interface CoconutView extends EntityView {
  kind: 'shadow' | 'impact';
  /** Tick it lands (shadow) or fades (impact). */
  landsAt: number;
  /** Ticks of warning in total (shadow only; 0 for impact). */
  warnTicks: number;
}

export interface CoconutDodgeSnapshot extends BaseSnapshot {
  entities: CoconutView[];
  alive: boolean[];
  /** Elimination tick per slot index, -1 while alive. */
  outAt: number[];
  rollReadyAt: number[];
  invulnUntil: number[];
}

const SPAWNS: readonly [number, number][] = [
  [0.25, 0.3],
  [0.75, 0.3],
  [0.25, 0.7],
  [0.75, 0.7],
];

function ramp(tick: number): number {
  return Math.min(1, tick / secondsToTicks(tuning.capSeconds));
}

function spawnCoconut(state: CoconutDodgeState, tick: number): void {
  const { rng } = state;
  const k = ramp(tick);
  const aimChance =
    tuning.targetPlayerStart + (tuning.targetPlayerEnd - tuning.targetPlayerStart) * k;
  const alive = state.players.filter((p) => p.alive);
  let x: number;
  let y: number;
  if (alive.length > 0 && nextFloat(rng) < aimChance) {
    const p = pick(rng, alive);
    x = p.body.x;
    y = p.body.y;
  } else {
    x = nextRange(rng, tuning.spawnMargin, LOGICAL_WIDTH - tuning.spawnMargin);
    y = nextRange(rng, tuning.spawnMargin, LOGICAL_HEIGHT - tuning.spawnMargin);
  }
  state.coconuts.push({
    x,
    y,
    warnedAt: tick,
    landsAt: tick + secondsToTicks(tuning.warnSeconds),
  });
}

export const coconutDodge: MiniGame<CoconutDodgeState, CoconutDodgeSnapshot> = {
  id: 'coconut-dodge',
  displayName: 'Coconut Dodge',
  controlsHint: 'Stay out of the shadows. Action: roll.',
  view: 'top',
  tuning,

  init(seed, playerSlots) {
    const rng = createRng(seed);
    const players = playerSlots.map((slot) => {
      const [fx, fy] = SPAWNS[slot % SPAWNS.length] as [number, number];
      return {
        slot,
        body: createBody(fx * LOGICAL_WIDTH, fy * LOGICAL_HEIGHT, tuning.playerRadius),
        alive: true,
        outAt: -1,
        roll: createCooldown(),
        rollLeft: 0,
        rollDirX: 0,
        rollDirY: 0,
        invulnUntil: 0,
      };
    });
    return {
      rng,
      tick: 0,
      players,
      coconuts: [],
      impacts: [],
      nextSpawnAt: secondsToTicks(tuning.firstSpawnSeconds),
    };
  },

  step(state, inputs, tick) {
    // Movement and roll
    for (const p of state.players) {
      if (!p.alive) continue;
      const input = inputs[p.slot] ?? NEUTRAL_INPUT;
      if (input.action && tryUse(p.roll, tick, secondsToTicks(tuning.rollCooldownSeconds))) {
        let dx = input.moveX;
        let dy = input.moveY;
        const len = Math.hypot(dx, dy);
        if (len < 0.1) {
          dx = p.rollDirX; // no direction held: roll the way we last moved
          dy = p.rollDirY;
        } else {
          dx /= len;
          dy /= len;
        }
        if (dx === 0 && dy === 0) dx = 1;
        p.rollDirX = dx;
        p.rollDirY = dy;
        p.rollLeft = tuning.rollTicks;
        p.body.vx = dx * tuning.rollSpeed;
        p.body.vy = dy * tuning.rollSpeed;
        p.invulnUntil = tick + secondsToTicks(tuning.rollInvulnSeconds);
      }
      const len = Math.hypot(input.moveX, input.moveY);
      if (len > 0.1) {
        p.rollDirX = input.moveX / len;
        p.rollDirY = input.moveY / len;
      }
      if (p.rollLeft > 0) {
        p.rollLeft--;
        if (p.rollLeft === 0) {
          p.body.vx = 0;
          p.body.vy = 0;
        }
      } else {
        p.body.x += input.moveX * tuning.moveSpeed * DT;
        p.body.y += input.moveY * tuning.moveSpeed * DT;
      }
      integrate(p.body, p.rollLeft > 0 ? 1 : tuning.damping);
      clampToBounds(p.body);
    }

    // Landings
    const falling: Coconut[] = [];
    for (const c of state.coconuts) {
      if (c.landsAt > tick) {
        falling.push(c);
        continue;
      }
      state.impacts.push({
        x: c.x,
        y: c.y,
        until: tick + secondsToTicks(tuning.impactShowSeconds),
      });
      for (const p of state.players) {
        if (!p.alive || tick < p.invulnUntil) continue;
        if (Math.hypot(p.body.x - c.x, p.body.y - c.y) <= tuning.impactRadius) {
          p.alive = false;
          p.outAt = tick;
          p.rollLeft = 0;
          p.body.vx = 0;
          p.body.vy = 0;
        }
      }
    }
    state.coconuts = falling;
    state.impacts = state.impacts.filter((i) => i.until > tick);

    // Spawns
    while (state.nextSpawnAt <= tick) {
      const k = ramp(tick);
      const batch = 1 + Math.floor(k * (tuning.maxExtraPerBatch + 0.999));
      for (let i = 0; i < batch; i++) spawnCoconut(state, tick);
      const interval =
        tuning.spawnStartInterval + (tuning.spawnEndInterval - tuning.spawnStartInterval) * k;
      state.nextSpawnAt += interval / DT;
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
    const warnTicks = secondsToTicks(tuning.warnSeconds);
    const entities: CoconutView[] = [
      ...state.impacts.map((i) => ({
        kind: 'impact' as const,
        x: i.x,
        y: i.y,
        r: tuning.impactRadius,
        landsAt: i.until,
        warnTicks: 0,
      })),
      ...state.coconuts.map((c) => ({
        kind: 'shadow' as const,
        x: c.x,
        y: c.y,
        r: tuning.impactRadius,
        landsAt: c.landsAt,
        warnTicks,
      })),
    ];
    return {
      tick: state.tick,
      timeLeft: Math.max(0, tuning.capSeconds - state.tick * DT),
      players: state.players.map((p) => ({ slot: p.slot, x: p.body.x, y: p.body.y, r: p.body.r })),
      entities,
      alive: state.players.map((p) => p.alive),
      outAt: state.players.map((p) => p.outAt),
      rollReadyAt: state.players.map((p) => p.roll.readyAt),
      invulnUntil: state.players.map((p) => p.invulnUntil),
    };
  },
};
