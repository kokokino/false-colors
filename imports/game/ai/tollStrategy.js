// AI toll decision strategy
// Loyal: minimize collective harm. Phantom: escalate subtly.

import { Personalities } from './personalities.js';

// Loyal AI toll choice
export function chooseLoyalToll(player, game, personality) {
  const traits = personality.traits;
  const shipSupplies = game.shipSupplies || 0;

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

  // Personal supplies low — fall back to ship stores if doom is critical
  if (player.supplies <= 0 && shipSupplies > 0 && game.doomLevel > game.doomThreshold * 0.7) {
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
    // Occasionally pick curse to match loyal AI behavior
    if (Math.random() < 0.1 && player.curses.length < 2) {
      return 'curse';
    }
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

  // Late game (60%+): mostly doom, but occasionally curse to avoid statistical detection
  if (Math.random() < 0.08 && player.curses.length < 2) {
    return 'curse';
  }

  // Subtle sabotage: drain ship stores when personal supplies are empty
  const shipSupplies = game.shipSupplies || 0;
  if (player.supplies <= 0 && shipSupplies > 0 && Math.random() < 0.4) {
    return 'supply';
  }

  return 'doom';
}
