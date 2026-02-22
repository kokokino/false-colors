// AI accusation and voting strategy
// Loyal: accuse when suspicion is high enough. Phantom: deflect.
// Now respects: hasAccused (one per game), round < 3 gate, revealed phantom restrictions

import { Alignment } from '../../lib/collections/games.js';
import { getMostSuspicious, getSuspicion } from './suspicionTracker.js';

// Decide whether loyal AI should make an accusation
export function shouldLoyalAccuse(aiPlayer, game, personality) {
  // Already used accusation this game
  if (aiPlayer.hasAccused) {
    return null;
  }

  // No accusations before round 3
  if (game.currentRound < 3) {
    return null;
  }

  const traits = personality.traits;
  const gameProgress = game.currentRound / game.maxRounds;

  // Don't accuse in early game unless very suspicious
  // (now gated by round 3 minimum, so this mainly affects rounds 3-4)
  if (gameProgress < 0.3 && traits.accuseEagerness < 0.7) {
    return null;
  }

  const suspect = getMostSuspicious(game._id, aiPlayer.seatIndex);
  if (!suspect) {
    return null;
  }

  // Don't accuse revealed phantoms
  const suspectPlayer = game.players.find(p => p.seatIndex === suspect.seatIndex);
  if (suspectPlayer && suspectPlayer.phantomRevealed) {
    return null;
  }

  // Higher threshold since accusations now cost +3 doom / +1 skull
  // Base threshold is higher, eagerness and progress still help
  const threshold = (traits.suspicionThreshold + 0.1) - (gameProgress * 0.15) - (traits.accuseEagerness * 0.1);
  if (suspect.score >= threshold) {
    return suspect.seatIndex;
  }

  return null;
}

// Decide whether phantom AI should accuse (to deflect)
// Revealed phantom cannot accuse
export function shouldPhantomAccuse(aiPlayer, game, personality) {
  if (aiPlayer.phantomRevealed) {
    return null;
  }

  if (aiPlayer.hasAccused) {
    return null;
  }

  if (game.currentRound < 3) {
    return null;
  }

  const traits = personality.traits;
  const gameProgress = game.currentRound / game.maxRounds;

  const deflectStart = 0.5 - (traits.accuseEagerness * 0.2);
  const deflectChance = 0.15 + (traits.accuseEagerness * 0.2);

  if (gameProgress > deflectStart && Math.random() < deflectChance) {
    // Pick randomly from non-self, non-revealed players
    const targets = game.players.filter(p => p.seatIndex !== aiPlayer.seatIndex && !p.phantomRevealed);
    if (targets.length > 0) {
      const target = targets[Math.floor(Math.random() * targets.length)];
      return target.seatIndex;
    }
  }

  return null;
}

// AI voting on an accusation
export function voteOnAccusation(aiPlayer, game, accusation, personality) {
  const traits = personality.traits;

  // Phantom voting: no alignment knowledge, uses chaos factor
  if (aiPlayer.alignment === Alignment.PHANTOM) {
    // Never vote guilty on self
    if (accusation.targetSeat === aiPlayer.seatIndex) {
      return false;
    }
    // Vote guilty 60% of the time on anyone else to create chaos
    return Math.random() < 0.6;
  }

  // Loyal AI: vote based on suspicion of the target
  const suspicion = getSuspicion(game._id, aiPlayer.seatIndex, accusation.targetSeat);
  const threshold = traits.suspicionThreshold * 0.8;
  return suspicion >= threshold;
}
