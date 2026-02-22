// AI toll decision strategy
// Loyal: minimize collective harm. Phantom: escalate subtly.

import { Personalities } from './personalities.js';

// Loyal AI toll choice
export function chooseLoyalToll(player, game, personality) {
  const traits = personality.traits;

  // If player has plenty of supplies and doom is high, sacrifice supply
  if (player.supplies >= 2 && game.doomLevel > game.doomThreshold * 0.5) {
    return 'supply';
  }

  // If doom is low, adding doom is safer
  if (game.doomLevel < game.doomThreshold * 0.3) {
    // Cautious personalities prefer supply loss over doom
    if (traits.tollCaution > 0.6 && player.supplies >= 2) {
      return 'supply';
    }
    return 'doom';
  }

  // Mid-game: prefer supply if available, else curse over doom
  if (player.supplies >= 2) {
    return 'supply';
  }

  // Low supplies — take a curse to avoid doom
  if (player.curses.length < 2 && traits.tollCaution < 0.6) {
    return 'curse';
  }

  // Reluctantly add doom
  return 'doom';
}

// Phantom AI toll choice — cooperate early, sabotage later
export function choosePhantomToll(player, game, personality, round) {
  const gameProgress = round / game.maxRounds;

  // Early game (first 30%): cooperate to blend in
  if (gameProgress < 0.3) {
    if (player.supplies >= 2) {
      return 'supply';
    }
    return 'doom';
  }

  // Mid game (30-60%): start choosing doom more often, occasionally curse to blend in
  if (gameProgress < 0.6) {
    if (Math.random() < 0.15 && player.curses.length < 2) {
      return 'curse';
    }
    if (Math.random() < 0.6) {
      return 'doom';
    }
    if (player.supplies >= 1) {
      return 'supply';
    }
    return 'doom';
  }

  // Late game (60%+): always doom to push toward threshold
  return 'doom';
}
