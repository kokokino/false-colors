// AI action decision strategy
// Loyal: target highest-utility threat. Phantom: target suboptimally.

import { getActionStrength } from '../roles.js';
import { Roles } from '../roles.js';

// Calculate threat priority score (higher = more urgent)
function threatPriority(threat, role) {
  const strength = getActionStrength(role, threat.type);
  const urgency = threat.doomPerRound * (threat.threshold - threat.progress);
  return urgency * strength;
}

// Loyal AI action choice — pick the highest-utility threat
export function chooseLoyalAction(player, game, personality) {
  const role = Object.values(Roles).find(r => r.id === player.role);
  if (!role || game.activeThreats.length === 0) {
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
export function choosePhantomAction(player, game, personality, round) {
  const role = Object.values(Roles).find(r => r.id === player.role);
  if (!role || game.activeThreats.length === 0) {
    return null;
  }

  const gameProgress = round / game.maxRounds;

  const scored = game.activeThreats.map(threat => ({
    threatId: threat.id,
    score: threatPriority(threat, role),
  }));

  scored.sort((a, b) => b.score - a.score);

  // Early game: cooperate 40% of the time
  if (gameProgress < 0.3 && Math.random() < 0.4) {
    return scored[0].threatId;
  }

  // Pick 2nd or 3rd priority (suboptimal but defensible)
  if (scored.length >= 3 && Math.random() < 0.5) {
    return scored[2].threatId;
  }
  if (scored.length >= 2) {
    return scored[1].threatId;
  }

  return scored[0].threatId;
}
