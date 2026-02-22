// AI toll decision strategy
// Loyal: minimize collective harm. Phantom: escalate subtly.

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

  // Mid-game: prefer supply if available
  if (player.supplies >= 2) {
    // Cautious personalities sacrifice supply over doom even at moderate doom levels
    return 'supply';
  }

  // Cautious personalities strongly avoid curses when they already have one
  if (traits.tollCaution > 0.6 && player.curses.length >= 1) {
    // Prefer supply sacrifice if possible, otherwise reluctantly add doom
    if (player.supplies >= 1) {
      return 'supply';
    }
    return 'doom';
  }

  // Personal supplies low — fall back to ship stores if doom is critical
  if (player.supplies <= 0 && shipSupplies > 0 && game.doomLevel > game.doomThreshold * 0.7) {
    return 'supply';
  }

  // Low caution personalities take curses more freely when supplies are low
  if (player.curses.length < 2 && traits.tollCaution < 0.5) {
    return 'curse';
  }

  // Moderate caution: take curse only if no curses yet
  if (player.curses.length === 0 && traits.tollCaution < 0.7) {
    return 'curse';
  }

  // Reluctantly add doom
  return 'doom';
}

// Phantom AI toll choice — cooperate early, sabotage later
// tollCaution shifts phase thresholds: high = cooperate longer, low = escalate earlier
export function choosePhantomToll(player, game, personality, round) {
  const traits = personality.traits;
  const gameProgress = round / game.maxRounds;

  // tollCaution shifts the early-game cooperation window
  // High tollCaution (0.8) → early phase extends to 40%, low (0.3) → shrinks to 20%
  const earlyThreshold = 0.2 + (traits.tollCaution * 0.25);
  const midThreshold = earlyThreshold + 0.3;

  // Early game: cooperate to blend in
  if (gameProgress < earlyThreshold) {
    if (Math.random() < 0.1 && player.curses.length < 2) {
      return 'curse';
    }
    if (player.supplies >= 2) {
      return 'supply';
    }
    return 'doom';
  }

  // Mid game: start choosing doom more, use tollCaution to weight doom-vs-curse
  if (gameProgress < midThreshold) {
    // Cautious phantoms pick curse more to blend in; reckless phantoms push doom
    const curseChance = 0.05 + (traits.tollCaution * 0.15);
    if (Math.random() < curseChance && player.curses.length < 2) {
      return 'curse';
    }
    const doomChance = 0.75 - (traits.tollCaution * 0.25);
    if (Math.random() < doomChance) {
      return 'doom';
    }
    if (player.supplies >= 1) {
      return 'supply';
    }
    return 'doom';
  }

  // Late game: mostly doom, occasionally curse to avoid statistical detection
  const lateCurseChance = 0.03 + (traits.tollCaution * 0.08);
  if (Math.random() < lateCurseChance && player.curses.length < 2) {
    return 'curse';
  }

  // Subtle sabotage: drain ship stores when personal supplies are empty
  const shipSupplies = game.shipSupplies || 0;
  if (player.supplies <= 0 && shipSupplies > 0 && Math.random() < 0.4) {
    return 'supply';
  }

  return 'doom';
}
