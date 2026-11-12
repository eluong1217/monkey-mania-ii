import { randomInt } from 'node:crypto';
import {
  createBotFor,
  createRng,
  DIFFICULTIES,
  getMiniGame,
  NEUTRAL_INPUT,
  nextInt,
  sanitizeInput,
  secondsToTicks,
  TICK_RATE,
  withDifficulty,
  type AnyMiniGame,
  type BaseSnapshot,
  type DifficultyName,
  type InputFn,
  type Placements,
  type PlayerInput,
  type RoomPhase,
  type RoundScore,
  type SeatInfo,
  type ServerMessage,
  type Slot,
} from '@monkey-mania-2/shared';
import type { MatchHandle } from './room.js';
import { realClock, Ticker, type Clock } from './ticker.js';

export const MATCH_TIMING = {
  introSeconds: 3,
  resultsSeconds: 4,
  /** A silent human keeps their last input this long, then goes neutral. */
  inputHoldSeconds: 0.25,
  snapshotsPerSecond: 20,
};

/** What the match loop needs from a room. `Room` satisfies it; benches and tests can fake it. */
export interface MatchRoom {
  phase: RoomPhase;
  match: MatchHandle | null;
  seatInfo(): (SeatInfo | null)[];
  broadcast(message: ServerMessage): void;
  broadcastState(): void;
  isEmpty(): boolean;
}

export type MatchLog = (event: string, data: Record<string, unknown>) => void;

export interface MatchOptions {
  clock?: Clock;
  /** Round seed. Chosen randomly by default and never sent to clients. */
  seed?: number;
  difficulty?: DifficultyName;
  log?: MatchLog;
  /** Called once when the loop stops, for any reason. */
  onEnd?: (reason: 'finished' | 'empty' | 'error' | 'stopped') => void;
}

const defaultLog: MatchLog = (event, data) => {
  if (event === 'matchError') console.error(event, data);
};

/** Per-seat bot seed, derived from the round seed so a seed replays exactly. */
export function botSeed(seed: number, slot: Slot): number {
  const rng = createRng(seed ^ 0x9e3779b9);
  let s = 0;
  for (let i = 0; i <= slot; i++) s = nextInt(rng, 0, 0xffffffff);
  return s;
}

/** Placeholder party points (3/2/1/0, ties share the higher value). T09 owns real scoring. */
export function roundScores(placements: Placements): RoundScore[] {
  const values = [3, 2, 1, 0];
  const out: RoundScore[] = [];
  let position = 0;
  for (const group of placements) {
    const points = values[position] ?? 0;
    for (const slot of group) out.push({ slot, points, total: points });
    position += group.length;
  }
  return out.sort((a, b) => a.slot - b.slot);
}

/** Latest-input-wins buffer: one entry per slot, so a flood can never queue up work. */
export class InputBuffer {
  private readonly latest = new Map<Slot, { input: PlayerInput; tick: number }>();

  constructor(private readonly holdTicks: number) {}

  set(slot: Slot, input: PlayerInput, tick: number): void {
    this.latest.set(slot, { input: sanitizeInput(input), tick });
  }

  get(slot: Slot, tick: number): PlayerInput {
    const entry = this.latest.get(slot);
    if (!entry || tick - entry.tick > this.holdTicks) return { ...NEUTRAL_INPUT };
    return { ...entry.input };
  }
}

/**
 * Runs one mini-game round for a room: INTRO (roundIntro) → PLAYING (20 Hz snapshots) →
 * RESULTS (roundResult) → PODIUM (matchResult). Steps at 30 Hz on a drift-corrected ticker.
 */
export class Match implements MatchHandle {
  readonly seed: number;
  readonly ticker: Ticker;
  private readonly slots: Slot[];
  private readonly bots = new Map<Slot, InputFn>();
  private readonly inputs = new InputBuffer(secondsToTicks(MATCH_TIMING.inputHoldSeconds));
  private readonly log: MatchLog;
  private state: unknown;
  private snap: BaseSnapshot;
  /** Simulation tick (counts from 0 when PLAYING starts). */
  private tick = 0;
  /** Ticks spent in the current phase. */
  private phaseTicks = 0;
  private stopped = false;
  private placements: Placements = [];
  snapshotsSent = 0;

  constructor(
    private readonly room: MatchRoom,
    private readonly miniGame: AnyMiniGame,
    private readonly options: MatchOptions = {},
  ) {
    this.seed = options.seed ?? randomInt(0, 2 ** 32);
    this.log = options.log ?? defaultLog;
    const seats = room.seatInfo();
    this.slots = seats.filter((s): s is SeatInfo => s !== null).map((s) => s.slot);
    const difficulty = DIFFICULTIES[options.difficulty ?? 'normal'];
    for (const seat of seats) {
      if (seat?.isBot) {
        const bot = createBotFor(miniGame.id);
        this.bots.set(seat.slot, withDifficulty(bot, difficulty, botSeed(this.seed, seat.slot)));
      }
    }
    this.state = miniGame.init(this.seed, this.slots);
    this.snap = miniGame.snapshot(this.state);
    this.ticker = new Ticker(options.clock ?? realClock, TICK_RATE, this.onTick);
  }

  start(): void {
    if (this.room.phase === 'INTRO') this.phaseTicks = 0;
    else this.setPhase('INTRO');
    this.room.broadcast({
      type: 'roundIntro',
      round: 1,
      totalRounds: 1,
      miniGameId: this.miniGame.id,
      displayName: this.miniGame.displayName,
      controlsHint: this.miniGame.controlsHint,
      view: this.miniGame.view,
    });
    this.ticker.start();
  }

  /** A human's input. Ignored outside PLAYING and for bot or unknown seats. */
  input(slot: Slot, input: PlayerInput): void {
    if (this.stopped || this.room.phase !== 'PLAYING') return;
    if (!this.slots.includes(slot) || this.bots.has(slot)) return;
    this.inputs.set(slot, input, this.tick);
  }

  stop(): void {
    this.end('stopped');
  }

  private end(reason: 'finished' | 'empty' | 'error' | 'stopped'): void {
    if (this.stopped) return;
    this.stopped = true;
    this.ticker.stop();
    if (this.room.match === this) this.room.match = null;
    this.log('matchEnd', { reason, simTicks: this.tick, ...this.ticker.stats });
    this.options.onEnd?.(reason);
  }

  private setPhase(phase: RoomPhase): void {
    this.room.phase = phase;
    this.phaseTicks = 0;
    this.room.broadcastState();
  }

  private readonly onTick = (): void => {
    try {
      if (this.room.isEmpty()) return this.end('empty');
      this.phaseTicks++;
      switch (this.room.phase) {
        case 'INTRO':
          if (this.phaseTicks >= secondsToTicks(MATCH_TIMING.introSeconds))
            this.setPhase('PLAYING');
          return;
        case 'PLAYING':
          return this.play();
        case 'RESULTS':
          if (this.phaseTicks >= secondsToTicks(MATCH_TIMING.resultsSeconds)) this.finish();
          return;
        default:
          return this.end('stopped');
      }
    } catch (error) {
      // Contain the failure to this room: stop its loop and park it on the podium.
      this.log('matchError', {
        miniGameId: this.miniGame.id,
        tick: this.tick,
        error: String(error),
      });
      this.end('error');
      try {
        this.setPhase('PODIUM');
      } catch {
        // Nothing more to do for this room.
      }
    }
  };

  private play(): void {
    const g = this.miniGame;
    const inputs: PlayerInput[] = [];
    for (const slot of this.slots) {
      const bot = this.bots.get(slot);
      inputs[slot] = bot
        ? sanitizeInput(bot(this.snap, slot, this.tick))
        : this.inputs.get(slot, this.tick);
    }
    this.state = g.step(this.state, inputs, this.tick);
    this.tick++;
    this.snap = g.snapshot(this.state);
    const rate = MATCH_TIMING.snapshotsPerSecond;
    const over = g.isOver(this.state);
    // 20 Hz, plus always the final state so clients see how the round ended.
    if (
      over ||
      Math.floor((this.tick * rate) / TICK_RATE) > Math.floor(((this.tick - 1) * rate) / TICK_RATE)
    ) {
      this.room.broadcast({
        type: 'snapshot',
        tick: this.tick,
        miniGameId: g.id,
        state: this.snap,
      });
      this.snapshotsSent++;
    }
    if (over) {
      const placements = (this.placements = g.placements(this.state));
      this.setPhase('RESULTS');
      this.room.broadcast({
        type: 'roundResult',
        round: 1,
        placements,
        scores: roundScores(placements),
      });
    }
  }

  private finish(): void {
    this.setPhase('PODIUM');
    this.room.broadcast({
      type: 'matchResult',
      placements: this.placements,
      totals: roundScores(this.placements),
    });
    this.end('finished');
  }
}

/** Starts the given registered mini-game (default `sandbox`) for a room already in INTRO. */
export function startMatch(room: MatchRoom, miniGameId = 'sandbox', options?: MatchOptions): Match {
  const miniGame = getMiniGame(miniGameId);
  if (!miniGame) throw new Error(`Unknown mini-game: ${miniGameId}`);
  room.match?.stop();
  const match = new Match(room, miniGame, options);
  room.match = match;
  match.start();
  return match;
}
