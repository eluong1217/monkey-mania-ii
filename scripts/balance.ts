/**
 * Balance harness: plays bot-only rounds headlessly and prints numbers to tune against.
 *
 *   npm run balance -- --game <id|all> --rounds 1000 --difficulty normal [--seed 1] [--mixed]
 *
 * No server, no sockets. Same seed gives identical output.
 */
import { TICK_RATE } from '../packages/shared/src/constants.js';
import {
  DIFFICULTIES,
  createBotFor,
  getMiniGame,
  listMiniGameIds,
  runRound,
  withDifficulty,
  type AnyMiniGame,
  type DifficultyName,
  type InputFn,
  type Placements,
} from '../packages/shared/src/index.js';

const SEATS = 4;
/** Placeholder round is not a real game, so `--game all` skips it. */
const SKIP_IN_ALL = new Set(['sandbox']);
/** Games that expose a per-player score in their snapshot, for the score-spread column. */
const SCORE_KEY: Record<string, string> = { 'fruit-frenzy': 'scores', 'banana-heist': 'stash' };

interface Args {
  game: string;
  rounds: number;
  difficulty: DifficultyName;
  seed: number;
  mixed: boolean;
}

function parseArgs(argv: string[]): Args {
  const get = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const difficulty = get('difficulty') ?? 'normal';
  if (!Object.hasOwn(DIFFICULTIES, difficulty)) {
    throw new Error(`--difficulty must be one of: ${Object.keys(DIFFICULTIES).join(', ')}`);
  }
  const rounds = Number(get('rounds') ?? 1000);
  const seed = Number(get('seed') ?? 1);
  if (!Number.isInteger(rounds) || rounds < 1)
    throw new Error('--rounds must be a positive integer');
  if (!Number.isInteger(seed)) throw new Error('--seed must be an integer');
  const game = get('game');
  if (!game)
    throw new Error(
      'usage: --game <id|all> [--rounds N] [--difficulty easy|normal|hard] [--seed N] [--mixed]',
    );
  return {
    game,
    rounds,
    difficulty: difficulty as DifficultyName,
    seed,
    mixed: argv.includes('--mixed'),
  };
}

function resolveGames(game: string): AnyMiniGame[] {
  if (game === 'all') {
    return listMiniGameIds()
      .filter((id) => !SKIP_IN_ALL.has(id))
      .map((id) => getMiniGame(id) as AnyMiniGame);
  }
  const found = getMiniGame(game);
  if (!found)
    throw new Error(`unknown mini-game "${game}". Known: ${listMiniGameIds().join(', ')}`);
  return [found];
}

interface GameStats {
  rounds: number;
  timeouts: number;
  wins: number[];
  ticks: number[];
  anyTie: number;
  spreadSum: number;
  spreadRounds: number;
}

/** Seat controllers for one round. Bots are built fresh per round so no state leaks between rounds. */
function seatFns(game: AnyMiniGame, roundSeed: number, difficulties: DifficultyName[]): InputFn[] {
  return difficulties.map((d, slot) =>
    withDifficulty(createBotFor(game.id), DIFFICULTIES[d], roundSeed * SEATS + slot + 1),
  );
}

/** Nearest-rank percentile on a sorted array. */
function percentile(sorted: number[], p: number): number {
  return sorted[Math.floor(p * (sorted.length - 1))] ?? 0;
}

function scoreOf(game: AnyMiniGame, snapshot: unknown, slot: number): number | undefined {
  const key = SCORE_KEY[game.id];
  if (!key) return undefined;
  const arr = (snapshot as Record<string, unknown>)[key];
  return Array.isArray(arr) ? Number(arr[slot] ?? 0) : undefined;
}

function winnersOf(placements: Placements): number[] {
  return placements[0] ?? [];
}

function runGame(game: AnyMiniGame, args: Args, difficulties: DifficultyName[]): GameStats {
  const stats: GameStats = {
    rounds: 0,
    timeouts: 0,
    wins: Array.from({ length: SEATS }, () => 0),
    ticks: [],
    anyTie: 0,
    spreadSum: 0,
    spreadRounds: 0,
  };
  for (let r = 0; r < args.rounds; r++) {
    const roundSeed = args.seed + r;
    const fns = seatFns(game, roundSeed, difficulties);
    let result;
    try {
      result = runRound(game, roundSeed, fns);
    } catch (err) {
      // runRound only throws its "did not finish" error for the safety cap; anything else is a bug.
      if (err instanceof Error && err.message.includes('did not finish')) {
        stats.timeouts++;
        continue;
      }
      throw err;
    }
    stats.rounds++;
    stats.ticks.push(result.ticks);
    for (const slot of winnersOf(result.placements)) stats.wins[slot] = (stats.wins[slot] ?? 0) + 1;
    if (result.placements.some((group) => group.length > 1)) stats.anyTie++;

    const first = result.placements[0]?.[0];
    const last = result.placements[result.placements.length - 1]?.[0];
    if (first !== undefined && last !== undefined) {
      const hi = scoreOf(game, result.snapshot, first);
      const lo = scoreOf(game, result.snapshot, last);
      if (hi !== undefined && lo !== undefined) {
        stats.spreadSum += hi - lo;
        stats.spreadRounds++;
      }
    }
  }
  return stats;
}

function pct(n: number, d: number): string {
  return d === 0 ? '-' : `${((100 * n) / d).toFixed(1)}%`;
}

function printStats(
  game: AnyMiniGame,
  stats: GameStats,
  label: string,
  seatLabels: string[],
): void {
  const sorted = [...stats.ticks].sort((a, b) => a - b);
  const sec = (ticks: number) => (ticks / TICK_RATE).toFixed(1) + 's';
  console.log(`\n${game.displayName} (${game.id}) — ${label}`);
  console.log(`  rounds played: ${stats.rounds}   timeouts: ${stats.timeouts}`);
  console.log(
    `  round length: median ${sec(percentile(sorted, 0.5))}   p10 ${sec(percentile(sorted, 0.1))}   p90 ${sec(percentile(sorted, 0.9))}`,
  );
  console.log(`  tie frequency (any shared placement): ${pct(stats.anyTie, stats.rounds)}`);
  const spread =
    stats.spreadRounds > 0
      ? (stats.spreadSum / stats.spreadRounds).toFixed(2)
      : 'n/a (no score in snapshot)';
  console.log(`  score spread, first minus last (mean): ${spread}`);
  console.log('  win rate per seat (in first place group):');
  seatLabels.forEach((name, slot) => {
    console.log(`    ${name.padEnd(8)} ${pct(stats.wins[slot] ?? 0, stats.rounds)}`);
  });
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const games = resolveGames(args.game);
  console.log(
    `balance: game=${args.game} rounds=${args.rounds} difficulty=${args.difficulty} seed=${args.seed}${args.mixed ? ' mixed' : ''}`,
  );

  for (const game of games) {
    if (args.mixed) {
      // One hard bot (seat 0) against three easy bots.
      const diffs: DifficultyName[] = ['hard', 'easy', 'easy', 'easy'];
      const stats = runGame(game, args, diffs);
      printStats(game, stats, 'mixed: 1 hard vs 3 easy', ['hard', 'easy', 'easy', 'easy']);
      console.log(`  hard bot wins: ${pct(stats.wins[0] ?? 0, stats.rounds)}`);
    } else {
      const diffs: DifficultyName[] = Array.from({ length: SEATS }, () => args.difficulty);
      const stats = runGame(game, args, diffs);
      printStats(game, stats, args.difficulty, ['seat 0', 'seat 1', 'seat 2', 'seat 3']);
    }
  }
}

main();
