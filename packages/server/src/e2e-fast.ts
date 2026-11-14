import { getMiniGame, listMiniGameIds } from '@monkey-mania-2/shared';
import { MATCH_TIMING, type MatchOptions } from './match.js';

/**
 * Test-only (E2E_FAST=1): two rounds of about 5 s each with short intro and results cards, so a
 * whole match takes well under a minute. Edits the tuning objects of this process only.
 */
export function e2eFast(): MatchOptions {
  MATCH_TIMING.introSeconds = 0.5;
  MATCH_TIMING.resultsSeconds = 0.5;
  for (const id of listMiniGameIds()) {
    const tuning = getMiniGame(id)?.tuning as Record<string, number> | undefined;
    if (!tuning) continue;
    for (const key of ['durationSeconds', 'roundSeconds', 'capSeconds']) {
      if (key in tuning) tuning[key] = 5;
    }
    if ('shrinkSeconds' in tuning) tuning.shrinkSeconds = 4;
  }
  return { rounds: 2 };
}
