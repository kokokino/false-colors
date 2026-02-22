// AI accusation and voting strategy
// Loyal: accuse when suspicion is high enough. Phantom: deflect.

import { getMostSuspicious, getSuspicion } from './suspicionTracker.js';

// Decide whether loyal AI should make an accusation
export function shouldLoyalAccuse(aiPlayer, game, personality) {
  const traits = personality.traits;
  const gameProgress = game.currentRound / game.maxRounds;

  // Don't accuse in early game unless very suspicious
  if (gameProgress < 0.3 && traits.accuseEagerness < 0.7) {
    return null;
  }

  const suspect = getMostSuspicious(game._id, aiPlayer.seatIndex);
  if (!suspect) {
    return null;
  }

  // Need suspicion above threshold (adjusted by eagerness and game progress)
  const threshold = traits.suspicionThreshold - (gameProgress * 0.15) - (traits.accuseEagerness * 0.1);
  if (suspect.score >= threshold) {
    return suspect.seatIndex;
  }

  return null;
}

// Decide whether phantom AI should accuse (to deflect)
export function shouldPhantomAccuse(aiPlayer, game, personality) {
  const gameProgress = game.currentRound / game.maxRounds;

  // Phantom sometimes accuses loyal players to create confusion
  if (gameProgress > 0.4 && Math.random() < 0.25) {
    // Pick a loyal player to accuse (not self)
    const loyalTargets = game.players.filter(p =>
      p.seatIndex !== aiPlayer.seatIndex && p.alignment === 'loyal'
    );
    if (loyalTargets.length > 0) {
      const target = loyalTargets[Math.floor(Math.random() * loyalTargets.length)];
      return target.seatIndex;
    }
  }

  return null;
}

// AI voting on an accusation
export function voteOnAccusation(aiPlayer, game, accusation, personality) {
  const traits = personality.traits;

  // If AI is the phantom and the target is NOT the phantom, vote guilty to create chaos
  if (aiPlayer.alignment === 'phantom') {
    const target = game.players.find(p => p.seatIndex === accusation.targetSeat);
    if (target && target.alignment !== 'phantom') {
      return Math.random() < 0.6; // Usually vote guilty against innocents
    }
    // Target IS the phantom (self or ally situation) — vote not guilty
    return false;
  }

  // Loyal AI: vote based on suspicion of the target
  const suspicion = getSuspicion(game._id, aiPlayer.seatIndex, accusation.targetSeat);
  const threshold = traits.suspicionThreshold * 0.8;
  return suspicion >= threshold;
}
