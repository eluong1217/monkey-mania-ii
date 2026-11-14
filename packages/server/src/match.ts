import { randomInt } from 'node:crypto';
import {
  createBotFor,
  createParty,
  createRng,
  currentMiniGame,
  DIFFICULTIES,
  getMiniGame,
  INTRO_SECONDS,
  introDone,
  listMiniGameIds,
  MATCH_ROUNDS,
  NEUTRAL_INPUT,
  nextInt,
  partyPool,
  RESULTS_SECONDS,
  resultsDone,
  roundOver,
  roundSeed,
  sanitizeInput,
  secondsToTicks,
  standings,
  startParty,
  TICK_RATE,
  withDifficulty,
  type AnyMiniGame,
  type BaseSnapshot,
  type DifficultyName,
  type InputFn,
  type PartyState,
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
  introSeconds: INTRO_SECONDS,
  resultsSeconds: RESULTS_SECONDS,
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
}

export type MatchLog = (event: string, data: Record<string, unknown>) => void;

export interface MatchOptions {
  clock?: Clock;
  /** Round seed. Chosen randomly by default and never sent to clients. */
  seed?: number;
  difficulty?: DifficultyName;
  /** Rounds to play. Default: 5 for a mini-game pool, 1 for a single mini-game. */
  rounds?: number;
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
 * Runs a whole match for a room: for each round INTRO (roundIntro) → PLAYING (20 Hz snapshots)
 * → RESULTS (roundResult), then PODIUM (matchResult). Steps at 30 Hz on a drift-corrected ticker.
 * The phase and scores come from the pure `PartyState` in shared.
 */
export class Match implements MatchHandle {
  readonly seed: number;
  readonly ticker: Ticker;
  private readonly slots: Slot[];
  private readonly pool: ReadonlyMap<string, AnyMiniGame>;
  private readonly bots = new Map<Slot, InputFn>();
  private readonly inputs = new InputBuffer(secondsToTicks(MATCH_TIMING.inputHoldSeconds));
  private readonly log: MatchLog;
  private party: PartyState;
  private miniGame!: AnyMiniGame;
  private state: unknown;
  private snap!: BaseSnapshot;
  /** Simulation tick (counts from 0 when PLAYING starts). */
  private tick = 0;
  /** Ticks spent in the current phase. */
  private phaseTicks = 0;
  private stopped = false;
  private placements: Placements = [];
  snapshotsSent = 0;

  /** `pool` is one mini-game (one round) or several (a party of `options.rounds`, default 5). */
  constructor(
    private readonly room: MatchRoom,
    pool: AnyMiniGame | readonly AnyMiniGame[],
    private readonly options: MatchOptions = {},
  ) {
    const games = Array.isArray(pool) ? (pool as AnyMiniGame[]) : [pool as AnyMiniGame];
    this.pool = new Map(games.map((g) => [g.id, g]));
    this.seed = options.seed ?? randomInt(0, 2 ** 32);
    this.log = options.log ?? defaultLog;
    this.slots = room
      .seatInfo()
      .filter((s): s is SeatInfo => s !== null)
      .map((s) => s.slot);
    const rounds = options.rounds ?? (Array.isArray(pool) ? MATCH_ROUNDS : 1);
    this.party = createParty(
      this.seed,
      games.map((g) => g.id),
      rounds,
    );
    this.ticker = new Ticker(options.clock ?? realClock, TICK_RATE, this.onTick);
  }

  start(): void {
    this.party = startParty(this.party);
    this.beginRound();
    if (this.room.phase === 'INTRO') this.phaseTicks = 0;
    else this.setPhase('INTRO');
    this.announceIntro();
    this.ticker.start();
  }

  /** Fresh mini-game state and bots for the current round. */
  private beginRound(): void {
    const g = this.pool.get(currentMiniGame(this.party)) as AnyMiniGame;
    this.miniGame = g;
    this.state = g.init(roundSeed(this.seed, this.party.round - 1), this.slots);
    this.snap = g.snapshot(this.state);
    this.tick = 0;
    this.bots.clear();
    for (const seat of this.room.seatInfo()) {
      if (seat?.isBot) this.addBot(seat.slot);
    }
  }

  private addBot(slot: Slot): void {
    const difficulty = DIFFICULTIES[this.options.difficulty ?? 'normal'];
    const seed = roundSeed(this.seed, this.party.round - 1);
    this.bots.set(
      slot,
      withDifficulty(createBotFor(this.miniGame.id), difficulty, botSeed(seed, slot)),
    );
  }

  private announceIntro(): void {
    this.room.broadcast({
      type: 'roundIntro',
      round: this.party.round,
      totalRounds: this.party.totalRounds,
      miniGameId: this.miniGame.id,
      displayName: this.miniGame.displayName,
      controlsHint: this.miniGame.controlsHint,
      view: this.miniGame.view,
    });
  }

  /** A human's input. Ignored outside PLAYING and for bot or unknown seats. */
  input(slot: Slot, input: PlayerInput): void {
    if (this.stopped || this.room.phase !== 'PLAYING') return;
    if (!this.slots.includes(slot) || this.bots.has(slot)) return;
    this.inputs.set(slot, input, this.tick);
  }

  /** Ends the loop. The room manager passes 'empty' when the last human's grace period ran out. */
  stop(reason: 'stopped' | 'empty' = 'stopped'): void {
    this.end(reason);
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
      this.phaseTicks++;
      switch (this.room.phase) {
        case 'INTRO':
          if (this.phaseTicks >= secondsToTicks(MATCH_TIMING.introSeconds)) {
            this.party = introDone(this.party);
            this.setPhase('PLAYING');
          }
          return;
        case 'PLAYING':
          return this.play();
        case 'RESULTS':
          if (this.phaseTicks >= secondsToTicks(MATCH_TIMING.resultsSeconds)) this.afterResults();
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

  /**
   * A human who left mid-match is played by a bot from the next tick; one who rejoins takes the
   * seat back. Scores are kept by slot, so neither changes them.
   */
  private syncSeats(): void {
    for (const seat of this.room.seatInfo()) {
      if (!seat || seat.isBot) continue;
      if (!seat.connected && !this.bots.has(seat.slot)) {
        this.addBot(seat.slot);
        this.log('botReplaced', { slot: seat.slot, round: this.party.round });
      } else if (seat.connected && this.bots.has(seat.slot)) {
        this.bots.delete(seat.slot);
        this.log('humanRestored', { slot: seat.slot, round: this.party.round });
      }
    }
  }

  private play(): void {
    const g = this.miniGame;
    this.syncSeats();
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
      const result = roundOver(this.party, placements);
      this.party = result.party;
      this.setPhase('RESULTS');
      this.room.broadcast({
        type: 'roundResult',
        round: this.party.round,
        placements,
        scores: result.scores,
      });
    }
  }

  private afterResults(): void {
    this.party = resultsDone(this.party);
    if (this.party.phase === 'INTRO') {
      this.beginRound();
      this.setPhase('INTRO');
      this.announceIntro();
      return;
    }
    this.setPhase('PODIUM');
    const placements = standings(this.party.totals, this.slots);
    const totals: RoundScore[] = this.slots.map((slot) => ({
      slot,
      points: 0,
      total: this.party.totals[slot] ?? 0,
    }));
    this.room.broadcast({ type: 'matchResult', placements, totals });
    this.end('finished');
  }
}

/**
 * Starts a match for a room already in INTRO. With a mini-game id it plays that one game for
 * one round (tests, tools); without one it plays a full party from every registered game.
 */
export function startMatch(room: MatchRoom, miniGameId?: string, options?: MatchOptions): Match {
  let pool: AnyMiniGame | AnyMiniGame[];
  if (miniGameId === undefined) {
    pool = partyPool(listMiniGameIds()).map((id) => getMiniGame(id) as AnyMiniGame);
  } else {
    const g = getMiniGame(miniGameId);
    if (!g) throw new Error(`Unknown mini-game: ${miniGameId}`);
    pool = g;
  }
  room.match?.stop();
  const match = new Match(room, pool, options);
  room.match = match;
  match.start();
  return match;
}
