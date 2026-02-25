import { Roles } from './roles.js';
import { drawCurse } from './curses.js';
import { getActionStrength } from './roles.js';
import { Alignment, GameResult } from '../lib/collections/games.js';

// Find role definition by id
function getRoleById(roleId) {
  return Object.values(Roles).find(r => r.id === roleId);
}

// Resolve all toll submissions simultaneously
// Each player chose: 'resolve' (lose 1 resolve), 'doom' (add 1 doom), or 'curse' (draw curse)
export function resolveTolls(game, submissions) {
  let doomIncrease = 0;
  const updatedPlayers = [...game.players.map(p => ({ ...p }))];
  const curseDetails = [];

  for (const sub of submissions) {
    const playerIndex = updatedPlayers.findIndex(p => p.seatIndex === sub.seatIndex);
    if (playerIndex === -1) {
      continue;
    }

    const player = updatedPlayers[playerIndex];

    // Check for sea_madness curse (adds 1 doom to toll)
    const hasMadness = player.curses.some(c => c.effect === 'tollPenalty');

    switch (sub.choice) {
      case 'resolve':
        if (player.resolve > 0) {
          updatedPlayers[playerIndex] = {
            ...player,
            resolve: player.resolve - 1,
          };
        }
        break;
      case 'doom':
        doomIncrease += 1;
        if (hasMadness) {
          doomIncrease += 1;
        }
        break;
      case 'curse':
        const curse = drawCurse(player.curses);
        updatedPlayers[playerIndex] = {
          ...player,
          curses: [...player.curses, curse],
        };
        curseDetails.push({ seatIndex: sub.seatIndex, curseName: curse.name, curseId: curse.id, curseDescription: curse.description });
        if (hasMadness) {
          doomIncrease += 1;
        }
        break;
    }
  }

  // Compute toll aggregate for visibility
  let resolveCount = 0;
  let doomCount = 0;
  let curseCount = 0;
  for (const sub of submissions) {
    if (sub.choice === 'resolve') {
      resolveCount++;
    } else if (sub.choice === 'doom') {
      doomCount++;
    } else if (sub.choice === 'curse') {
      curseCount++;
    }
  }

  return {
    players: updatedPlayers,
    doomLevel: Math.min(game.doomLevel + doomIncrease, game.doomThreshold + 10),
    tollAggregate: { resolveCount, doomCount, curseCount, curseDetails },
  };
}

// Resolve action submissions — apply strengths to threats, check completion
export function resolveActions(game, submissions) {
  const updatedThreats = game.activeThreats.map(t => ({ ...t }));
  const completedThreatIds = [];

  // Calculate strength contributions per threat
  const threatStrengths = {};
  // Track per-player strength for the reveal
  const playerStrengths = {};
  for (const sub of submissions) {
    const player = game.players.find(p => p.seatIndex === sub.seatIndex);
    if (!player || !player.hasNextAction) {
      continue;
    }

    const role = getRoleById(player.role);
    if (!role) {
      console.warn(`[resolveActions] Unknown role "${player.role}" for seat ${player.seatIndex}, skipping`);
      continue;
    }

    const threat = updatedThreats.find(t => t.id === sub.threatId);
    if (!threat) {
      console.warn(`[resolveActions] Unknown threat "${sub.threatId}" for seat ${sub.seatIndex}, skipping`);
      continue;
    }

    let strength = getActionStrength(role, threat.type);

    // Apply weakened_arm curse penalty
    const hasWeakenedArm = player.curses.some(c => c.effect === 'actionPenalty');
    if (hasWeakenedArm) {
      strength = Math.max(strength - 1, 0);
    }

    // Zero resolve penalty: -1 action strength (min 0)
    if (player.resolve <= 0) {
      strength = Math.max(strength - 1, 0);
    }

    // Revealed phantom: action strength capped at 1
    if (player.phantomRevealed) {
      strength = Math.min(strength, 1);
    }

    if (!threatStrengths[sub.threatId]) {
      threatStrengths[sub.threatId] = 0;
    }
    threatStrengths[sub.threatId] += strength;
    playerStrengths[sub.seatIndex] = strength;
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

  // Collect completed threat names for scoring
  const completedThreats = updatedThreats.filter(t => completedThreatIds.includes(t.id));

  return {
    activeThreats: remainingThreats,
    completedThreats,
    playerStrengths,
  };
}

// Resolve an accusation vote
// Returns { correct, updatedPlayers, doomChange, goldCoin, skull } where correct means the accused IS the phantom
export function resolveAccusation(game, accusation) {
  const { accuserSeat, targetSeat, votes } = accusation;

  // Count votes (majority needed)
  let votesFor = 0;
  let votesAgainst = 0;

  if (votes) {
    for (const vote of votes) {
      if (vote.guilty) {
        votesFor++;
      } else {
        votesAgainst++;
      }
    }
  }

  // Strict majority required — ties result in acquittal
  const convicted = votesFor > votesAgainst;

  if (!convicted) {
    return { correct: false, convicted: false };
  }

  // Check if target is actually the phantom
  const target = game.players.find(p => p.seatIndex === targetSeat);
  const correct = target && target.alignment === Alignment.PHANTOM;

  if (!correct) {
    // Wrong accusation — accuser loses next action + 3 doom + 1 skull
    // Unless target has phantom_whisper curse (accusationPenalty): accuser keeps their action
    const hasPhantomWhisper = target && target.curses.some(c => c.effect === 'accusationPenalty');
    const updatedPlayers = game.players.map(p => {
      if (p.seatIndex === accuserSeat && !hasPhantomWhisper) {
        return { ...p, hasNextAction: false };
      }
      return { ...p };
    });
    return {
      correct: false,
      convicted: true,
      updatedPlayers,
      doomChange: 2,
      skull: { round: game.currentRound, reason: 'false_accusation', description: 'False accusation' },
    };
  }

  // Correct accusation — phantom revealed but stays in game
  const updatedPlayers = game.players.map(p => {
    if (p.seatIndex === targetSeat) {
      return { ...p, phantomRevealed: true };
    }
    return { ...p };
  });
  return {
    correct: true,
    convicted: true,
    updatedPlayers,
    doomChange: -3,
    goldCoin: { round: game.currentRound, reason: 'phantom_unmasked', description: 'Phantom unmasked' },
  };
}

// Check if the game should end
export function checkGameEnd(game) {
  // Doom reached threshold — instant loss (phantom wins or everyone loses)
  if (game.doomLevel >= game.doomThreshold) {
    const hasPhantom = game.players.some(p => p.alignment === Alignment.PHANTOM);
    return {
      ended: true,
      result: hasPhantom ? GameResult.PHANTOM_WIN : GameResult.DOOM_LOSS,
      reason: 'doom_threshold',
    };
  }

  // All rounds complete — compare coins to skulls
  if (game.currentRound >= game.maxRounds) {
    const coins = (game.goldCoins || []).length;
    const skulls = (game.skulls || []).length;
    if (coins > skulls) {
      return {
        ended: true,
        result: GameResult.LOYAL_WIN,
        reason: 'survived_all_rounds',
      };
    }
    return {
      ended: true,
      result: GameResult.CREW_LOSS,
      reason: 'skulls_exceed_coins',
    };
  }

  // All active threats cleared and no threats left in deck — check scoring
  if (game.activeThreats.length === 0 && game.threatDeck.length === 0) {
    const coins = (game.goldCoins || []).length;
    const skulls = (game.skulls || []).length;
    if (coins > skulls) {
      return {
        ended: true,
        result: GameResult.LOYAL_WIN,
        reason: 'all_threats_cleared',
      };
    }
    return {
      ended: true,
      result: GameResult.CREW_LOSS,
      reason: 'skulls_exceed_coins',
    };
  }

  return { ended: false };
}
