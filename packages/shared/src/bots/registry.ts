import { createFruitFrenzyBot } from '../minigames/fruit-frenzy/bot.js';
import { createWanderBot } from './wander.js';
import type { Bot, BotFactory } from './types.js';

/**
 * Bot factories keyed by mini-game id. Each mini-game ticket adds one line here. A factory
 * is called once per bot seat, so a bot may keep per-seat state in a closure.
 */
export const botFactories: Record<string, BotFactory> = {
  'fruit-frenzy': createFruitFrenzyBot,
};

/** The mini-game's bot, or the wander bot when it has none. */
export function createBotFor(miniGameId: string): Bot {
  const factory = Object.hasOwn(botFactories, miniGameId) ? botFactories[miniGameId] : undefined;
  return (factory ?? createWanderBot)();
}
