import {
  circlesOverlap,
  clampToBounds,
  createBody,
  integrate,
  resolveAll,
  type Body,
} from '../../arena.js';
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
import { createRng, nextFloat, nextRange, type Rng } from '../../rng.js';

/** Every balance number. Speeds in px/s, durations in seconds. */
export const tuning = {
  roundSeconds: 60,
  // Monkeys
  playerRadius: 12,
  moveSpeed: 140,
  carryMax: 3,
  carrySlow: 0.15, // each carried banana slows movement by this fraction
  damping: 0.85,
  // Bananas
  bananaRadius: 6,
  spawnInterval: 1.2,
  spawnSpread: 70, // spawn within this distance of the arena centre
  maxGroundSpawned: 8, // timer stops spawning while this many lie on the ground
  startBananas: 4,
  scatterMin: 22,
  scatterMax: 50,
  // Stashes
  stashRadius: 30,
  stashMargin: 56,
  stealSeconds: 1,
  // Coconut throw
  throwCooldownSeconds: 1.5,
  coconutRadius: 6,
  coconutSpeed: 200,
  coconutLifeSeconds: 1.3,
  stunSeconds: 1,
};

interface Banana {
  x: number;
  y: number;
}

interface Coconut {
  x: number;
  y: number;
  vx: number;
  vy: number;
  owner: Slot;
  /** Tick on which it disappears. */
  expiresAt: number;
}

interface HeistPlayer {
  slot: Slot;
  body: Body;
  carried: number;
  /** Unit facing, used for throws. */
  faceX: number;
  faceY: number;
  throwCd: Cooldown;
  /** Tick on which the stun ends (stunned while tick < stunnedUntil). */
  stunnedUntil: number;
  /** Consecutive ticks spent stealing from `stealFrom`. */
  stealTicks: number;
  stealFrom: Slot;
}

export interface BananaHeistState {
  rng: Rng;
  tick: number;
  players: HeistPlayer[];
  /** Banana count in each slot's stash, indexed by position in `players`. */
  stash: number[];
  bananas: Banana[];
  coconuts: Coconut[];
  nextSpawnAt: number;
}

export interface HeistView extends EntityView {
  kind: 'banana' | 'coconut' | 'stash';
  /** Stash owner (stash only; -1 otherwise). */
  owner: number;
  /** Bananas in the stash (stash only; 0 otherwise). */
  count: number;
}

export interface BananaHeistSnapshot extends BaseSnapshot {
  entities: HeistView[];
  /** Per player, in `players` order. */
  stash: number[];
  carried: number[];
  stunnedUntil: number[];
  throwReadyAt: number[];
  /** Ticks of uninterrupted stealing so far, and the slot being stolen from (-1 if none). */
  stealTicks: number[];
  stealFrom: number[];
  faceX: number[];
  faceY: number[];
}

/** Stash centres, one per corner, indexed by slot. */
const m = tuning.stashMargin;
export const STASH_POSITIONS: readonly (readonly [number, number])[] = [
  [m, m],
  [LOGICAL_WIDTH - m, m],
  [m, LOGICAL_HEIGHT - m],
  [LOGICAL_WIDTH - m, LOGICAL_HEIGHT - m],
];

export function stashPosition(slot: Slot): readonly [number, number] {
  return STASH_POSITIONS[slot % STASH_POSITIONS.length] as readonly [number, number];
}

function isStunned(p: HeistPlayer, tick: number): boolean {
  return tick < p.stunnedUntil;
}

function addBanana(state: BananaHeistState, x: number, y: number): void {
  const r = tuning.bananaRadius;
  state.bananas.push({
    x: Math.min(LOGICAL_WIDTH - r, Math.max(r, x)),
    y: Math.min(LOGICAL_HEIGHT - r, Math.max(r, y)),
  });
}

function spawnBanana(state: BananaHeistState): void {
  const a = nextRange(state.rng, 0, Math.PI * 2);
  const d = Math.sqrt(nextFloat(state.rng)) * tuning.spawnSpread;
  addBanana(state, LOGICAL_WIDTH / 2 + Math.cos(a) * d, LOGICAL_HEIGHT / 2 + Math.sin(a) * d);
}

function scatter(state: BananaHeistState, p: HeistPlayer): void {
  for (let i = 0; i < p.carried; i++) {
    const a = nextRange(state.rng, 0, Math.PI * 2);
    const d = nextRange(state.rng, tuning.scatterMin, tuning.scatterMax);
    addBanana(state, p.body.x + Math.cos(a) * d, p.body.y + Math.sin(a) * d);
  }
  p.carried = 0;
}

export const bananaHeist: MiniGame<BananaHeistState, BananaHeistSnapshot> = {
  id: 'banana-heist',
  displayName: 'Banana Heist',
  controlsHint: 'Carry bananas home. Stand on a rival stash to steal. Action: throw coconut.',
  view: 'top',
  tuning,

  init(seed, playerSlots) {
    const rng = createRng(seed);
    const players = playerSlots.map((slot) => {
      const [sx, sy] = stashPosition(slot);
      // Start just inside the arena from the stash, facing the centre.
      const dx = LOGICAL_WIDTH / 2 - sx;
      const dy = LOGICAL_HEIGHT / 2 - sy;
      const len = Math.hypot(dx, dy);
      return {
        slot,
        body: createBody(
          sx + (dx / len) * (tuning.stashRadius + 6),
          sy + (dy / len) * (tuning.stashRadius + 6),
          tuning.playerRadius,
        ),
        carried: 0,
        faceX: dx / len,
        faceY: dy / len,
        throwCd: createCooldown(),
        stunnedUntil: 0,
        stealTicks: 0,
        stealFrom: -1,
      };
    });
    const state: BananaHeistState = {
      rng,
      tick: 0,
      players,
      stash: players.map(() => 0),
      bananas: [],
      coconuts: [],
      nextSpawnAt: secondsToTicks(tuning.spawnInterval),
    };
    for (let i = 0; i < tuning.startBananas; i++) spawnBanana(state);
    return state;
  },

  step(state, inputs, tick) {
    const stealNeeded = secondsToTicks(tuning.stealSeconds);

    // Movement and throws
    for (const p of state.players) {
      const input = inputs[p.slot] ?? NEUTRAL_INPUT;
      if (isStunned(p, tick)) {
        p.body.vx = 0;
        p.body.vy = 0;
        continue;
      }
      const len = Math.hypot(input.moveX, input.moveY);
      if (len > 0.1) {
        p.faceX = input.moveX / len;
        p.faceY = input.moveY / len;
      }
      if (input.action && tryUse(p.throwCd, tick, secondsToTicks(tuning.throwCooldownSeconds))) {
        const off = p.body.r + tuning.coconutRadius + 1;
        state.coconuts.push({
          x: p.body.x + p.faceX * off,
          y: p.body.y + p.faceY * off,
          vx: p.faceX * tuning.coconutSpeed,
          vy: p.faceY * tuning.coconutSpeed,
          owner: p.slot,
          expiresAt: tick + secondsToTicks(tuning.coconutLifeSeconds),
        });
      }
      const speed = tuning.moveSpeed * (1 - tuning.carrySlow * p.carried);
      p.body.x += input.moveX * speed * DT;
      p.body.y += input.moveY * speed * DT;
      integrate(p.body, tuning.damping);
      clampToBounds(p.body);
    }
    resolveAll(state.players.map((p) => p.body));
    for (const p of state.players) clampToBounds(p.body);

    // Stashes: deposit at your own, steal from a rival's
    state.players.forEach((p, i) => {
      if (isStunned(p, tick)) {
        p.stealTicks = 0;
        p.stealFrom = -1;
        return;
      }
      let on = -1;
      state.players.forEach((q, j) => {
        const [sx, sy] = stashPosition(q.slot);
        if (Math.hypot(p.body.x - sx, p.body.y - sy) <= tuning.stashRadius) on = j;
      });
      if (on === i) {
        state.stash[i]! += p.carried;
        p.carried = 0;
      }
      const target = on !== -1 && on !== i ? on : -1;
      const canSteal = target !== -1 && p.carried < tuning.carryMax && state.stash[target]! > 0;
      if (!canSteal) {
        p.stealTicks = 0;
        p.stealFrom = -1;
        return;
      }
      if (p.stealFrom !== target) {
        p.stealFrom = target;
        p.stealTicks = 0;
      }
      p.stealTicks++;
      if (p.stealTicks >= stealNeeded) {
        state.stash[target]!--;
        p.carried++;
        p.stealTicks = 0;
      }
    });

    // Pickups
    for (const p of state.players) {
      if (isStunned(p, tick)) continue;
      const reach = p.body.r + tuning.bananaRadius;
      state.bananas = state.bananas.filter((b) => {
        if (p.carried >= tuning.carryMax) return true;
        if (Math.hypot(p.body.x - b.x, p.body.y - b.y) > reach) return true;
        p.carried++;
        return false;
      });
    }

    // Coconuts in flight
    const flying: Coconut[] = [];
    for (const c of state.coconuts) {
      c.x += c.vx * DT;
      c.y += c.vy * DT;
      if (c.expiresAt <= tick || c.x < 0 || c.x > LOGICAL_WIDTH || c.y < 0 || c.y > LOGICAL_HEIGHT)
        continue;
      const circle = { x: c.x, y: c.y, r: tuning.coconutRadius };
      const victim = state.players.find(
        (p) => p.slot !== c.owner && !isStunned(p, tick) && circlesOverlap(circle, p.body),
      );
      if (victim) {
        victim.stunnedUntil = tick + secondsToTicks(tuning.stunSeconds);
        victim.stealTicks = 0;
        victim.stealFrom = -1;
        scatter(state, victim);
        continue;
      }
      flying.push(c);
    }
    state.coconuts = flying;

    // Spawns
    while (state.nextSpawnAt <= tick) {
      if (state.bananas.length < tuning.maxGroundSpawned) spawnBanana(state);
      state.nextSpawnAt += tuning.spawnInterval / DT;
    }

    state.tick = tick + 1;
    return state;
  },

  isOver(state) {
    return state.tick >= secondsToTicks(tuning.roundSeconds);
  },

  placements(state) {
    const stash = new Map(state.players.map((p, i) => [p.slot, state.stash[i] as number]));
    return rankBy(
      state.players.map((p) => p.slot),
      (s) => stash.get(s) as number,
    );
  },

  snapshot(state) {
    const entities: HeistView[] = [
      ...state.players.map((p, i) => {
        const [x, y] = stashPosition(p.slot);
        return {
          kind: 'stash' as const,
          x,
          y,
          r: tuning.stashRadius,
          owner: p.slot,
          count: state.stash[i] as number,
        };
      }),
      ...state.bananas.map((b) => ({
        kind: 'banana' as const,
        x: b.x,
        y: b.y,
        r: tuning.bananaRadius,
        owner: -1,
        count: 0,
      })),
      ...state.coconuts.map((c) => ({
        kind: 'coconut' as const,
        x: c.x,
        y: c.y,
        r: tuning.coconutRadius,
        owner: c.owner,
        count: 0,
      })),
    ];
    return {
      tick: state.tick,
      timeLeft: Math.max(0, tuning.roundSeconds - state.tick * DT),
      players: state.players.map((p) => ({ slot: p.slot, x: p.body.x, y: p.body.y, r: p.body.r })),
      entities,
      stash: [...state.stash],
      carried: state.players.map((p) => p.carried),
      stunnedUntil: state.players.map((p) => p.stunnedUntil),
      throwReadyAt: state.players.map((p) => p.throwCd.readyAt),
      stealTicks: state.players.map((p) => p.stealTicks),
      stealFrom: state.players.map((p) => p.stealFrom),
      faceX: state.players.map((p) => p.faceX),
      faceY: state.players.map((p) => p.faceY),
    };
  },
};
