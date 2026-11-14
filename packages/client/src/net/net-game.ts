import {
  getMiniGame,
  INTRO_SECONDS,
  MAX_PLAYERS,
  NEUTRAL_INPUT,
  type BaseSnapshot,
  type PlayerInput,
  type RoomPhase,
  type SeatInfo,
  type ServerMessage,
  type Slot,
} from '@monkey-mania-2/shared';
import type { Connection } from '../connection';
import { SnapshotBuffer, TICK_MS } from './interpolation';
import { Predictor } from './prediction';

type RoundIntro = Extract<ServerMessage, { type: 'roundIntro' }>;

/** At most this many client ticks run in one frame (after a stall or a hidden tab). */
const MAX_TICKS_PER_FRAME = 5;

export interface DebugStats {
  pingMs: number;
  snapshotsPerSecond: number;
  correctionPx: number;
  predicting: boolean;
}

/**
 * The client side of a round, free of Phaser: samples input at 30 Hz and sends it, buffers
 * snapshots, predicts the local player, and builds the snapshot to draw each frame.
 */
export class NetGame {
  slot: Slot | null = null;
  phase: RoomPhase | null = null;
  miniGameId: string | null = null;
  intro: RoundIntro | null = null;
  /** Seats from the latest roomState, for names on the scoreboard. */
  seats: (SeatInfo | null)[] = [];
  /** Party points by slot, from the server's round and match results. */
  totals: number[] = Array.from({ length: MAX_PLAYERS }, () => 0);
  private introAt = 0;
  readonly buffer = new SnapshotBuffer();
  readonly predictor = new Predictor();
  private lastFrame: number | null = null;
  private acc = 0;
  private localTick = 0;
  private arrivals: number[] = [];

  constructor(
    private readonly conn: Connection,
    private readonly sampleInput: () => PlayerInput = () => ({ ...NEUTRAL_INPUT }),
    private readonly now: () => number = () => performance.now(),
  ) {
    conn.on('joined', (m) => (this.slot = m.slot));
    conn.on('roomState', (m) => {
      this.phase = m.phase;
      this.seats = m.seats;
    });
    conn.on('roundResult', (m) => this.setTotals(m.scores));
    conn.on('matchResult', (m) => this.setTotals(m.totals));
    conn.on('status', (s) => {
      if (s === 'closed') this.reset(null);
    });
    conn.on('roundIntro', (m) => this.reset(m));
    conn.on('snapshot', (m) => this.onSnapshot(m.miniGameId, m.state));
  }

  /** True while game keys belong to the game rather than the menus. */
  get inRound(): boolean {
    return this.phase === 'INTRO' || this.phase === 'PLAYING';
  }

  private setTotals(scores: { slot: Slot; total: number }[]): void {
    for (const s of scores) this.totals[s.slot] = s.total;
  }

  /** Whole seconds left on the intro card's countdown (3, 2, 1), 0 once it is over. */
  introCountdown(): number {
    return Math.max(0, Math.ceil(INTRO_SECONDS - (this.now() - this.introAt) / 1000));
  }

  private reset(intro: RoundIntro | null): void {
    this.intro = intro;
    this.introAt = this.now();
    if (!intro || intro.round === 1) this.totals = this.totals.map(() => 0);
    this.miniGameId = intro?.miniGameId ?? null;
    this.buffer.clear();
    this.predictor.clear();
    this.arrivals = [];
    if (!intro) this.slot = this.phase = null;
  }

  private moveSpeed(): number | undefined {
    return this.miniGameId === null ? undefined : getMiniGame(this.miniGameId)?.tuning.moveSpeed;
  }

  private onSnapshot(miniGameId: string, snap: BaseSnapshot): void {
    const t = this.now();
    this.miniGameId = miniGameId;
    this.buffer.push(snap, t);
    this.arrivals.push(t);
    while ((this.arrivals[0] as number) < t - 1000) this.arrivals.shift();
    const me = snap.players.find((p) => p.slot === this.slot);
    if (me && this.moveSpeed() !== undefined) this.predictor.reconcile(me.x, me.y, snap.tick);
  }

  private tick(): void {
    this.advance(this.sampleInput());
  }

  /** Send one input and step the prediction with it, so tick numbers and history stay in step. */
  private advance(input: PlayerInput): void {
    if (this.slot !== null && this.inRound) {
      this.conn.send({ type: 'input', tick: this.localTick, input });
    }
    this.localTick++;
    const speed = this.moveSpeed();
    const me = this.buffer.newest?.players.find((p) => p.slot === this.slot);
    if (this.phase === 'PLAYING' && speed !== undefined && me)
      this.predictor.step(input, speed, me.r);
  }

  /** Tell the server to stop moving us now (the tab is hidden, so no more ticks will run). */
  sendNeutral(): void {
    this.advance({ ...NEUTRAL_INPUT });
  }

  /** Run due client ticks and return what to draw now (null before the first snapshot). */
  frame(): BaseSnapshot | null {
    const t = this.now();
    this.acc += this.lastFrame === null ? 0 : t - this.lastFrame;
    this.lastFrame = t;
    this.acc = Math.min(this.acc, MAX_TICKS_PER_FRAME * TICK_MS);
    while (this.acc >= TICK_MS) {
      this.acc -= TICK_MS;
      this.tick();
    }

    const view = this.buffer.sample(t);
    if (!view) return null;
    const p = this.predictor;
    if (this.phase === 'PLAYING' && p.ready) {
      const me = view.players.find((pl) => pl.slot === this.slot);
      if (me) {
        const a = this.acc / TICK_MS;
        me.x = p.prevX + (p.x - p.prevX) * a;
        me.y = p.prevY + (p.y - p.prevY) * a;
      }
    }
    return view;
  }

  stats(): DebugStats {
    return {
      pingMs: this.predictor.pingMs,
      snapshotsPerSecond: this.arrivals.length,
      correctionPx: this.predictor.lastError,
      predicting: this.predictor.ready,
    };
  }
}
