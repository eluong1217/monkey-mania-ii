/**
 * Load check: N bot-only rooms run one sandbox match each on the real clock, all at once.
 * Usage: npm run bench -w @monkey-mania-2/server [-- rooms]
 * Every message is JSON-encoded as if sent, so the cost matches a real room.
 */
import { encodeMessage, MAX_PLAYERS, type RoomPhase, type SeatInfo } from '@monkey-mania-2/shared';
import { Match, startMatch, type MatchRoom } from './match.js';

const ROOMS = Number(process.argv[2] ?? 50);
const seats: SeatInfo[] = Array.from({ length: MAX_PLAYERS }, (_, slot) => ({
  slot,
  name: `Bot ${slot + 1}`,
  isBot: true,
  ready: true,
  connected: true,
}));

let bytes = 0;
const matches: Match[] = [];
const started = performance.now();
const done = new Promise<void>((resolve) => {
  let remaining = ROOMS;
  for (let i = 0; i < ROOMS; i++) {
    const room: MatchRoom = {
      phase: 'INTRO' as RoomPhase,
      match: null,
      seatInfo: () => seats,
      broadcast: (m) => {
        bytes += encodeMessage(m).length * MAX_PLAYERS;
      },
      broadcastState: () => {},
    };
    matches.push(
      startMatch(room, 'sandbox', {
        log: () => {},
        onEnd: () => {
          if (--remaining === 0) resolve();
        },
      }),
    );
  }
});

// Match timers are unref'd (in the server, the HTTP listener keeps the process alive).
const keepAlive = setInterval(() => {}, 1000);
await done;
clearInterval(keepAlive);
const wall = (performance.now() - started) / 1000;
const s = matches.map((m) => m.ticker.stats);
const sum = (f: (x: (typeof s)[number]) => number) => s.reduce((a, x) => a + f(x), 0);
const max = (f: (x: (typeof s)[number]) => number) => Math.max(...s.map(f));
const ticks = sum((x) => x.ticks);
console.log(
  JSON.stringify(
    {
      rooms: ROOMS,
      wallSeconds: +wall.toFixed(2),
      ticksPerRoom: ticks / ROOMS,
      expectedTicksPerRoom: (3 + 10 + 4) * 30,
      skippedTicks: sum((x) => x.skipped),
      meanLateMs: +(sum((x) => x.totalLateMs) / ticks).toFixed(3),
      maxLateMs: +max((x) => x.maxLateMs).toFixed(3),
      meanTickCostMs: +(sum((x) => x.totalStepMs) / ticks).toFixed(4),
      maxTickCostMs: +max((x) => x.maxStepMs).toFixed(3),
      mbSent: +(bytes / 1e6).toFixed(1),
    },
    null,
    2,
  ),
);
