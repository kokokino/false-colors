import { Roles } from './roles.js';
import { drawCurse } from './curses.js';
import { getActionStrength } from './roles.js';
import { GameResult } from '../lib/collections/games.js';

// Find role definition by id
function getRoleById(roleId) {
  return Object.values(Roles).find(r => r.id === roleId);
}

// Resolve all toll submissions simultaneously
// Each player chose: 'supply' (lose 1 supply), 'doom' (add 1 doom), or 'curse' (draw curse)
export function resolveTolls(game, submissions) {
  let doomIncrease = 0;
  const updatedPlayers = [...game.players.map(p => ({ ...p }))];

  for (const sub of submissions) {
    const playerIndex = updatedPlayers.findIndex(p => p.seatIndex === sub.seatIndex);
    if (playerIndex === -1) {
      continue;
    }

    const player = updatedPlayers[playerIndex];

    // Check for sea_madness curse (adds 1 doom to toll)
    const hasMadness = player.curses.some(c => c.effect === 'tollPenalty');

    switch (sub.choice) {
      case 'supply':
        updatedPlayers[playerIndex] = {
          ...player,
          supplies: Math.max(player.supplies - 1, 0),
        };
        if (hasMadness) {
          doomIncrease += 1;
        }
        break;
      case 'doom':
        doomIncrease += 1;
        if (hasMadness) {
          doomIncrease += 1;
        }
        break;
      case 'curse':
        const curse = drawCurse();
        updatedPlayers[playerIndex] = {
          ...player,
          curses: [...player.curses, curse],
        };
        if (hasMadness) {
          doomIncrease += 1;
        }
        break;
    }
  }

  return {
    players: updatedPlayers,
    doomLevel: Math.min(game.doomLevel + doomIncrease, game.doomThreshold + 10),
  };
}

// Resolve action submissions — apply strengths to threats, check completion
export function resolveActions(game, submissions) {
  const updatedThreats = game.activeThreats.map(t => ({ ...t }));
  const completedThreatIds = [];

  // Calculate strength contributions per threat
  const threatStrengths = {};
  for (const sub of submissions) {
    const player = game.players.find(p => p.seatIndex === sub.seatIndex);
    if (!player || !player.hasNextAction) {
      continue;
    }

    const role = getRoleById(player.role);
    if (!role) {
      continue;
    }

    const threat = updatedThreats.find(t => t.id === sub.threatId);
    if (!threat) {
      continue;
    }

    let strength = getActionStrength(role, threat.type);

    // Apply weakened_arm curse penalty
    const hasWeakenedArm = player.curses.some(c => c.effect === 'actionPenalty');
    if (hasWeakenedArm) {
      strength = Math.max(strength - 1, 0);
    }

    if (!threatStrengths[sub.threatId]) {
      threatStrengths[sub.threatId] = 0;
    }
    threatStrengths[sub.threatId] += strength;
  }

  // Apply strengths to threats and check completion
  for (const threat of updatedThreats) {
    const addedStrength = threatStrengths[threat.id] || 0;
    threat.progress += addedStrength;

    if (threat.progress >= threat.threshold) {
      completedThreatIds.push(threat.id);
    }
  }

  // Remove completed threats
  const remainingThreats = updatedThreats.filter(t => !completedThreatIds.includes(t.id));

  return {
    activeThreats: remainingThreats,
  };
}

// Resolve an accusation vote
// Returns { correct, updatedPlayers } where correct means the accused IS the phantom
export function resolveAccusation(game, accusation) {
  const { accuserSeat, targetSeat, votes } = accusation;

  // Count votes (majority needed)
  let votesFor = 0;
  let votesAgainst = 0;
  const voterCount = votes ? votes.length : 0;

  if (votes) {
    for (const vote of votes) {
      if (vote.guilty) {
        votesFor++;
      } else {
        votesAgainst++;
      }
    }
  }

  // Need majority to convict
  const convicted = votesFor > votesAgainst;

  if (!convicted) {
    return { correct: false, convicted: false };
  }

  // Check if target is actually the phantom
  const target = game.players.find(p => p.seatIndex === targetSeat);
  const correct = target && target.alignment === 'phantom';

  if (!correct) {
    // Wrong accusation — accuser loses next action
    // Unless target has phantom_whisper curse (accusationPenalty), which protects them
    const hasPhantomWhisper = target && target.curses.some(c => c.effect === 'accusationPenalty');
    if (hasPhantomWhisper) {
      return { correct: false, convicted: true };
    }
    const updatedPlayers = game.players.map(p => {
      if (p.seatIndex === accuserSeat) {
        return { ...p, hasNextAction: false };
      }
      return { ...p };
    });
    return { correct: false, convicted: true, updatedPlayers };
  }

  return { correct: true, convicted: true };
}

// Check if the game should end
export function checkGameEnd(game) {
  // Doom reached threshold — phantom wins (or everyone loses)
  if (game.doomLevel >= game.doomThreshold) {
    const hasPhantom = game.players.some(p => p.alignment === 'phantom');
    return {
      ended: true,
      result: hasPhantom ? GameResult.PHANTOM_WIN : GameResult.DOOM_LOSS,
      reason: 'doom_threshold',
    };
  }

  // All rounds complete — loyal win (survived)
  if (game.currentRound >= game.maxRounds) {
    return {
      ended: true,
      result: GameResult.LOYAL_WIN,
      reason: 'survived_all_rounds',
    };
  }

  // All active threats cleared and no threats left in deck
  if (game.activeThreats.length === 0 && game.threatDeck.length === 0) {
    return {
      ended: true,
      result: GameResult.LOYAL_WIN,
      reason: 'all_threats_cleared',
    };
  }

  return { ended: false };
}
