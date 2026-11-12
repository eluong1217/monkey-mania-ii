import { clampToBounds, createBody, integrate, type Body } from '../../arena.js';
import { DT, LOGICAL_WIDTH, secondsToTicks } from '../../constants.js';
import { createCooldown, tryUse, type Cooldown } from '../../cooldown.js';
import { NEUTRAL_INPUT } from '../../input.js';
import {
  rankBy,
  type BaseSnapshot,
  type EntityView,
  type MiniGame,
  type Slot,
} from '../../minigame.js';
import { createRng, nextFloat, nextInt, type Rng } from '../../rng.js';

/** Every balance number. Speeds in px/s, durations in seconds. */
export const tuning = {
  durationSeconds: 40,
  // Monkeys
  groundY: 298, // monkey centre; feet sit 32 px lower
  playerRadius: 20,
  moveSpeed: 200,
  // Spawning: interval shrinks linearly over the round
  spawnMargin: 40,
  spawnLanes: 8,
  spawnStartInterval: 1.0,
  spawnEndInterval: 0.35,
  // Fruit mix (the rest are apples)
  rottenChance: 0.18,
  bananaChance: 0.3,
  pineappleChance: 0.06,
  // Fruit fall speed (px/s) and size. Fall time x moveSpeed must stay >= half the arena width.
  appleSpeed: 110,
  bananaSpeed: 175,
  pineappleSpeed: 130,
  rottenSpeed: 110,
  pineappleDrift: 60,
  fruitRadius: 10,
  pineappleRadius: 12,
  fruitStartY: -12,
  fruitRemoveY: 330,
  // Points
  appleValue: 1,
  bananaValue: 2,
  pineappleValue: 5,
  rottenValue: -2,
  stunSeconds: 0.5,
  // Shove
  shoveCooldownSeconds: 2,
  shoveDashSpeed: 420,
  shoveBumpSpeed: 320,
  shoveDashTicks: 8,
  damping: 0.85,
};

export type FruitKind = 'apple' | 'banana' | 'pineapple' | 'rotten';

interface Fruit {
  kind: FruitKind;
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
}

interface FruitPlayer {
  slot: Slot;
  body: Body;
  score: number;
  facing: 1 | -1;
  stunnedUntil: number;
  shove: Cooldown;
  dashLeft: number;
}

export interface FruitFrenzyState {
  rng: Rng;
  tick: number;
  players: FruitPlayer[];
  fruit: Fruit[];
  /** Fractional tick of the next spawn. */
  nextSpawnAt: number;
  /** Shuffled lane indices still to be used. */
  lanes: number[];
}

export interface FruitView extends EntityView {
  kind: FruitKind;
  vx: number;
  vy: number;
}

export interface FruitFrenzySnapshot extends BaseSnapshot {
  entities: FruitView[];
  scores: number[];
  stunnedUntil: number[];
  shoveReadyAt: number[];
}

const VALUES: Record<FruitKind, number> = {
  apple: tuning.appleValue,
  banana: tuning.bananaValue,
  pineapple: tuning.pineappleValue,
  rotten: tuning.rottenValue,
};
export const FRUIT_VALUE: Readonly<Record<FruitKind, number>> = VALUES;

function spawnInterval(tick: number): number {
  const k = Math.min(1, tick / secondsToTicks(tuning.durationSeconds));
  return tuning.spawnStartInterval + (tuning.spawnEndInterval - tuning.spawnStartInterval) * k;
}

/** Next lane from a shuffled bag, so consecutive fruit never cluster and the width is covered. */
function nextLane(state: FruitFrenzyState): number {
  if (state.lanes.length === 0) {
    const bag = Array.from({ length: tuning.spawnLanes }, (_, i) => i);
    for (let i = bag.length - 1; i > 0; i--) {
      const j = nextInt(state.rng, 0, i);
      [bag[i], bag[j]] = [bag[j] as number, bag[i] as number];
    }
    state.lanes = bag;
  }
  return state.lanes.pop() as number;
}

function spawnFruit(state: FruitFrenzyState): void {
  const { rng } = state;
  const laneWidth = (LOGICAL_WIDTH - 2 * tuning.spawnMargin) / tuning.spawnLanes;
  const x = tuning.spawnMargin + (nextLane(state) + nextFloat(rng)) * laneWidth;
  const roll = nextFloat(rng);
  let kind: FruitKind;
  if (roll < tuning.pineappleChance) kind = 'pineapple';
  else if (roll < tuning.pineappleChance + tuning.rottenChance) kind = 'rotten';
  else if (roll < tuning.pineappleChance + tuning.rottenChance + tuning.bananaChance)
    kind = 'banana';
  else kind = 'apple';
  const speed = {
    apple: tuning.appleSpeed,
    banana: tuning.bananaSpeed,
    pineapple: tuning.pineappleSpeed,
    rotten: tuning.rottenSpeed,
  }[kind];
  const drift = kind === 'pineapple' ? (nextFloat(rng) < 0.5 ? -1 : 1) * tuning.pineappleDrift : 0;
  state.fruit.push({
    kind,
    x,
    y: tuning.fruitStartY,
    r: kind === 'pineapple' ? tuning.pineappleRadius : tuning.fruitRadius,
    vx: drift,
    vy: speed,
  });
}

export const fruitFrenzy: MiniGame<FruitFrenzyState, FruitFrenzySnapshot> = {
  id: 'fruit-frenzy',
  displayName: 'Fruit Frenzy',
  controlsHint: 'Move to catch fruit, dodge the rotten ones. Action: shove.',
  view: 'side',
  tuning,

  init(seed, playerSlots) {
    const rng = createRng(seed);
    const n = Math.max(1, playerSlots.length);
    const players = playerSlots.map((slot, i) => ({
      slot,
      body: createBody(((i + 0.5) / n) * LOGICAL_WIDTH, tuning.groundY, tuning.playerRadius),
      score: 0,
      facing: 1 as const,
      stunnedUntil: 0,
      shove: createCooldown(),
      dashLeft: 0,
    }));
    return {
      rng,
      tick: 0,
      players,
      fruit: [],
      nextSpawnAt: secondsToTicks(0.5),
      lanes: [],
    };
  },

  step(state, inputs, tick) {
    const shoveCooldown = secondsToTicks(tuning.shoveCooldownSeconds);

    for (const p of state.players) {
      const stunned = tick < p.stunnedUntil;
      const input = stunned ? NEUTRAL_INPUT : (inputs[p.slot] ?? NEUTRAL_INPUT);
      p.body.x += input.moveX * tuning.moveSpeed * DT;
      if (input.moveX > 0.1) p.facing = 1;
      else if (input.moveX < -0.1) p.facing = -1;
      if (input.action && tryUse(p.shove, tick, shoveCooldown)) {
        p.body.vx = p.facing * tuning.shoveDashSpeed;
        p.dashLeft = tuning.shoveDashTicks;
      }
    }

    // A dashing monkey bumps rivals it overlaps sideways.
    for (const p of state.players) {
      if (p.dashLeft <= 0) continue;
      p.dashLeft--;
      for (const o of state.players) {
        if (o === p) continue;
        if (Math.abs(o.body.x - p.body.x) < p.body.r + o.body.r) {
          o.body.vx = p.facing * tuning.shoveBumpSpeed;
        }
      }
    }

    for (const p of state.players) {
      integrate(p.body, tuning.damping);
      clampToBounds(p.body);
    }

    // Fruit: fall, drift, get caught or hit the ground.
    const kept: Fruit[] = [];
    for (const f of state.fruit) {
      f.x += f.vx * DT;
      f.y += f.vy * DT;
      if (f.vx !== 0) {
        const lo = tuning.spawnMargin;
        const hi = LOGICAL_WIDTH - tuning.spawnMargin;
        if (f.x < lo || f.x > hi) {
          f.x = Math.min(hi, Math.max(lo, f.x));
          f.vx = -f.vx;
        }
      }
      let catcher: FruitPlayer | undefined;
      let best = Infinity;
      for (const p of state.players) {
        if (tick < p.stunnedUntil) continue;
        const dx = f.x - p.body.x;
        const dy = f.y - p.body.y;
        const rr = f.r + p.body.r;
        const d2 = dx * dx + dy * dy;
        if (d2 < rr * rr && d2 < best) {
          best = d2;
          catcher = p;
        }
      }
      if (catcher) {
        catcher.score += VALUES[f.kind];
        if (f.kind === 'rotten') {
          catcher.stunnedUntil = tick + secondsToTicks(tuning.stunSeconds);
          catcher.dashLeft = 0;
        }
        continue;
      }
      if (f.y <= tuning.fruitRemoveY) kept.push(f);
    }
    state.fruit = kept;

    // Spawns
    while (state.nextSpawnAt <= tick) {
      spawnFruit(state);
      state.nextSpawnAt += spawnInterval(tick) / DT;
    }

    state.tick = tick + 1;
    return state;
  },

  isOver(state) {
    return state.tick >= secondsToTicks(tuning.durationSeconds);
  },

  placements(state) {
    const byslot = new Map(state.players.map((p) => [p.slot, p.score]));
    return rankBy(
      state.players.map((p) => p.slot),
      (s) => byslot.get(s) as number,
    );
  },

  snapshot(state) {
    return {
      tick: state.tick,
      timeLeft: Math.max(0, tuning.durationSeconds - state.tick * DT),
      players: state.players.map((p) => ({ slot: p.slot, x: p.body.x, y: p.body.y, r: p.body.r })),
      entities: state.fruit.map((f) => ({
        kind: f.kind,
        x: f.x,
        y: f.y,
        r: f.r,
        vx: f.vx,
        vy: f.vy,
      })),
      scores: state.players.map((p) => p.score),
      stunnedUntil: state.players.map((p) => p.stunnedUntil),
      shoveReadyAt: state.players.map((p) => p.shove.readyAt),
    };
  },
};
