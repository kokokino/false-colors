// AI toll decision strategy
// Loyal: minimize collective harm. Phantom: escalate subtly.

// Loyal AI toll choice — uses resolve (renamed from supplies)
export function chooseLoyalToll(player, game, personality) {
  const traits = personality.traits;

  // If player has plenty of resolve and doom is high, sacrifice resolve
  if (player.resolve >= 2 && game.doomLevel > game.doomThreshold * 0.5) {
    return 'resolve';
  }

  // If doom is low, adding doom is safer
  if (game.doomLevel < game.doomThreshold * 0.3) {
    // Cautious personalities prefer resolve loss over doom
    if (traits.tollCaution > 0.6 && player.resolve >= 2) {
      return 'resolve';
    }
    return 'doom';
  }

  // Mid-game: prefer resolve if available
  if (player.resolve >= 2) {
    // Cautious personalities sacrifice resolve over doom even at moderate doom levels
    return 'resolve';
  }

  // Cautious personalities strongly avoid curses when they already have one
  if (traits.tollCaution > 0.6 && player.curses.length >= 1) {
    // Prefer resolve sacrifice if possible, otherwise reluctantly add doom
    if (player.resolve >= 1) {
      return 'resolve';
    }
    return 'doom';
  }

  // Low caution personalities take curses more freely when resolve is low
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
// Revealed phantom: always doom (server-enforced, but we return it here too)
export function choosePhantomToll(player, game, personality, round) {
  // Revealed phantom always picks doom
  if (player.phantomRevealed) {
    return 'doom';
  }

  const traits = personality.traits;
  const gameProgress = round / game.maxRounds;

  // tollCaution shifts the early-game cooperation window
  const earlyThreshold = 0.2 + (traits.tollCaution * 0.25);
  const midThreshold = earlyThreshold + 0.3;

  // Early game: cooperate to blend in
  if (gameProgress < earlyThreshold) {
    if (Math.random() < 0.1 && player.curses.length < 2) {
      return 'curse';
    }
    if (player.resolve >= 2) {
      return 'resolve';
    }
    return 'doom';
  }

  // Mid game: start choosing doom more, use tollCaution to weight doom-vs-curse
  if (gameProgress < midThreshold) {
    const curseChance = 0.05 + (traits.tollCaution * 0.15);
    if (Math.random() < curseChance && player.curses.length < 2) {
      return 'curse';
    }
    const doomChance = 0.75 - (traits.tollCaution * 0.25);
    if (Math.random() < doomChance) {
      return 'doom';
    }
    if (player.resolve >= 1) {
      return 'resolve';
    }
    return 'doom';
  }

  // Late game: mostly doom, occasionally curse to avoid statistical detection
  const lateCurseChance = 0.03 + (traits.tollCaution * 0.08);
  if (Math.random() < lateCurseChance && player.curses.length < 2) {
    return 'curse';
  }

  return 'doom';
}
