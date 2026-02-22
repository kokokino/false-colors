// AI action decision strategy
// Loyal: target highest-utility threat. Phantom: target suboptimally.

import { Roles, getActionStrength } from '../roles.js';

// Calculate threat priority score (higher = more urgent)
function threatPriority(threat, role) {
  const strength = getActionStrength(role, threat.type);
  const remaining = threat.threshold - threat.progress;
  const urgency = threat.doomPerRound * remaining;
  const completionBonus = (remaining <= strength) ? threat.doomPerRound * 3 : 0;
  return (urgency + completionBonus) * strength;
}

// Loyal AI action choice — pick the highest-utility threat
export function chooseLoyalAction(player, game, personality) {
  const role = Object.values(Roles).find(r => r.id === player.role);
  if (!role) {
    console.warn(`[ai] chooseLoyalAction: unknown role "${player.role}", returning null`);
    return null;
  }
  if (game.activeThreats.length === 0) {
    return null;
  }

  const traits = personality.traits;

  // Score each threat
  const scored = game.activeThreats.map(threat => ({
    threatId: threat.id,
    score: threatPriority(threat, role),
  }));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Highly optimal personalities always pick best; others may vary slightly
  if (traits.actionOptimality > 0.85 || scored.length === 1) {
    return scored[0].threatId;
  }

  // Sometimes pick second-best (still defensible)
  if (scored.length > 1 && Math.random() > traits.actionOptimality) {
    return scored[1].threatId;
  }

  return scored[0].threatId;
}

// Phantom AI action choice — target suboptimally but defensibly
// actionOptimality: high = more subtle (cooperates more, picks 2nd), low = blunt (picks 3rd more)
export function choosePhantomAction(player, game, personality, round) {
  const role = Object.values(Roles).find(r => r.id === player.role);
  if (!role) {
    console.warn(`[ai] choosePhantomAction: unknown role "${player.role}", returning null`);
    return null;
  }
  if (game.activeThreats.length === 0) {
    return null;
  }

  const traits = personality.traits;
  const gameProgress = round / game.maxRounds;

  const scored = game.activeThreats.map(threat => ({
    threatId: threat.id,
    score: threatPriority(threat, role),
  }));

  scored.sort((a, b) => b.score - a.score);

  // Early game: cooperate proportional to actionOptimality
  // High optimality = cooperate more (subtle phantom), low = less cooperative
  const cooperateChance = 0.2 + (traits.actionOptimality * 0.3);
  if (gameProgress < 0.3 && Math.random() < cooperateChance) {
    return scored[0].threatId;
  }

  // Mid-late game: high optimality picks 2nd target (subtle waste), low picks 3rd (blunt)
  if (scored.length >= 3) {
    const thirdChance = 0.6 - (traits.actionOptimality * 0.4);
    if (Math.random() < thirdChance) {
      return scored[2].threatId;
    }
  }
  if (scored.length >= 2) {
    return scored[1].threatId;
  }

  return scored[0].threatId;
}
