import { Meteor } from 'meteor/meteor';
import { GameRooms, Games, GameLog } from '../api/collections.js';
import { GamePhase, Alignment, GameResult, RoomStatus } from '../lib/collections/games.js';
import { RoleList, Roles, getActionStrength } from './roles.js';
import { createThreatDeck, drawThreats } from './threats.js';
import { shuffleRoster } from './ai/aiNames.js';
import { Personalities } from './ai/personalities.js';
import { startPhaseTimer, clearPhaseTimer, PhaseDurations } from './phaseTimer.js';
import { resolveTolls, resolveActions, resolveAccusation, checkGameEnd } from './resolution.js';
import { scheduleAiActions } from './ai/decisionEngine.js';
import { clearSuspicion, updateSuspicion } from './ai/suspicionTracker.js';
import { registerResolver } from './resolverRegistry.js';

// In-memory lock to prevent concurrent phase resolution (race between timer, AI, and human callers)
const resolveLocks = new Map();

const DEFAULT_DOOM_THRESHOLD = 15;
const DEFAULT_MAX_ROUNDS = 10;
const DEFAULT_STARTING_SUPPLIES = 3;
const DEFAULT_STARTING_SUPPLIES_MAX = 5;
// Probability that a phantom exists (80% chance)
const PHANTOM_PROBABILITY = 0.8;

// Start a game from a room — creates Games doc, assigns characters, fills AI seats
export async function startGame(roomId, totalPlayers) {
  const room = await GameRooms.findOneAsync(roomId);
  if (!room) {
    return;
  }

  const gameSettings = Meteor.settings.public?.game || {};
  const maxRounds = gameSettings.roundCount || DEFAULT_MAX_ROUNDS;
  const doomThreshold = gameSettings.doomThreshold || DEFAULT_DOOM_THRESHOLD;

  // Shuffle the crew roster to randomize character assignments
  const roster = shuffleRoster();
  const humanUserIds = room.players.map(p => p.userId);

  // Build player array — humans first, then AI fill-ins
  const players = [];
  for (let i = 0; i < totalPlayers; i++) {
    const character = roster[i];
    const isAI = i >= humanUserIds.length;
    const userId = isAI ? `ai_${character.roleId}_${roomId}` : humanUserIds[i];
    const personality = Personalities[character.personality];

    players.push({
      seatIndex: i,
      userId,
      displayName: character.characterName,
      role: character.roleId,
      isAI,
      alignment: Alignment.LOYAL, // Will assign phantom below
      personality: character.personality,
      hasNextAction: true,
      supplies: DEFAULT_STARTING_SUPPLIES,
      curses: [],
    });
  }

  // Assign phantom randomly (any seat — human or AI)
  if (Math.random() < PHANTOM_PROBABILITY) {
    const phantomIndex = Math.floor(Math.random() * players.length);
    players[phantomIndex].alignment = Alignment.PHANTOM;
  }

  // Create threat deck
  const threatDeck = createThreatDeck();

  const now = new Date();
  const gameId = await Games.insertAsync({
    roomId,
    theme: 'phantom_tides',
    players,
    currentRound: 1,
    maxRounds,
    currentPhase: GamePhase.THREAT,
    phaseStartedAt: now,
    phaseDeadline: new Date(now.getTime() + PhaseDurations.threat),
    doomLevel: 0,
    doomThreshold,
    shipSupplies: 10,
    activeThreats: [],
    threatDeck,
    tollSubmissions: [],
    actionSubmissions: [],
    revealedActions: null,
    lookoutReveal: null,
    accusation: null,
    result: null,
    endReason: null,
    llmCallsUsed: 0,
    createdAt: now,
    updatedAt: now,
  });

  // Update room to playing with gameId reference
  await GameRooms.updateAsync(roomId, {
    $set: { status: RoomStatus.PLAYING, gameId },
  });

  await appendLog(gameId, 1, GamePhase.THREAT, 'game_started', {
    playerCount: totalPlayers,
    humanCount: humanUserIds.length,
  });

  // Begin the first phase
  await runThreatPhase(gameId);

  return gameId;
}

// Central phase advancement — the heart of the state machine
export async function advancePhase(gameId) {
  const game = await Games.findOneAsync(gameId);
  if (!game || game.currentPhase === GamePhase.FINISHED) {
    return;
  }

  clearPhaseTimer(gameId);

  const phaseOrder = [
    GamePhase.THREAT,
    GamePhase.TOLL,
    GamePhase.DISCUSSION,
    GamePhase.ACTION,
    GamePhase.ACCUSATION,
    GamePhase.ROUND_END,
  ];

  const currentIndex = phaseOrder.indexOf(game.currentPhase);
  const nextIndex = currentIndex + 1;

  if (nextIndex >= phaseOrder.length) {
    // Round complete — check game end or start new round
    await startNextRound(gameId);
    return;
  }

  const nextPhase = phaseOrder[nextIndex];
  const now = new Date();
  const duration = PhaseDurations[nextPhase] || 30000;

  await Games.updateAsync(gameId, {
    $set: {
      currentPhase: nextPhase,
      phaseStartedAt: now,
      phaseDeadline: new Date(now.getTime() + duration),
      updatedAt: now,
    },
  });

  // Execute phase logic
  switch (nextPhase) {
    case GamePhase.TOLL:
      await runTollPhase(gameId);
      break;
    case GamePhase.DISCUSSION:
      await runDiscussionPhase(gameId);
      break;
    case GamePhase.ACTION:
      await runActionPhase(gameId);
      break;
    case GamePhase.ACCUSATION:
      await runAccusationPhase(gameId);
      break;
    case GamePhase.ROUND_END:
      await runRoundEndPhase(gameId);
      break;
  }
}

// THREAT PHASE — generate threats, add doom from existing ones
async function runThreatPhase(gameId) {
  const game = await Games.findOneAsync(gameId);
  if (!game) {
    return;
  }

  // Existing threats add doom
  let doomFromThreats = 0;
  for (const threat of game.activeThreats) {
    doomFromThreats += threat.doomPerRound;
  }

  // Draw new threats
  const { drawn, remaining } = drawThreats([...game.threatDeck], game.currentRound);

  const newThreats = [...game.activeThreats, ...drawn];
  const newDoom = Math.min(game.doomLevel + doomFromThreats, game.doomThreshold + 10);

  await Games.updateAsync(gameId, {
    $set: {
      activeThreats: newThreats,
      threatDeck: remaining,
      doomLevel: newDoom,
      updatedAt: new Date(),
    },
  });

  await appendLog(gameId, game.currentRound, GamePhase.THREAT, 'threats_drawn', {
    newThreats: drawn.map(t => t.name),
    doomAdded: doomFromThreats,
  });

  // Auto-advance after display time
  startPhaseTimer(gameId, 'threat', advancePhase);
}

// TOLL PHASE — every player must choose a harmful action
async function runTollPhase(gameId) {
  // Clear previous submissions
  await Games.updateAsync(gameId, {
    $set: { tollSubmissions: [], updatedAt: new Date() },
  });

  // Schedule AI toll submissions with human-like delays
  scheduleAiActions(gameId, 'toll');

  // Timer auto-advances when expired (default tolls applied for non-submitters)
  startPhaseTimer(gameId, 'toll', async (gId) => {
    await resolveTollPhase(gId);
  });
}

// Resolve tolls when all submitted or timer expires
export async function resolveTollPhase(gameId) {
  const lockKey = `toll_${gameId}`;
  if (resolveLocks.get(lockKey)) {
    return;
  }
  resolveLocks.set(lockKey, true);
  try {
    const game = await Games.findOneAsync(gameId);
    if (!game || game.currentPhase !== GamePhase.TOLL) {
      return;
    }

    clearPhaseTimer(gameId);

    // Apply default toll (add 1 doom) for any player who didn't submit
    const submittedSeats = new Set(game.tollSubmissions.map(s => s.seatIndex));
    const defaultSubmissions = [];
    for (const player of game.players) {
      if (!submittedSeats.has(player.seatIndex)) {
        defaultSubmissions.push({
          seatIndex: player.seatIndex,
          choice: 'doom',
        });
      }
    }

    const allSubmissions = [...game.tollSubmissions, ...defaultSubmissions];
    const updates = resolveTolls(game, allSubmissions);

    await Games.updateAsync(gameId, {
      $set: { ...updates, updatedAt: new Date() },
    });

    // Update AI suspicion based on toll choices
    updateSuspicionFromTolls(game, allSubmissions);

    await appendLog(gameId, game.currentRound, GamePhase.TOLL, 'tolls_resolved', {
      submissions: allSubmissions.length,
    });

    await advancePhase(gameId);
  } finally {
    resolveLocks.delete(lockKey);
  }
}

// DISCUSSION PHASE — 30s chat window
async function runDiscussionPhase(gameId) {
  // Schedule AI chat messages with human-like delays
  scheduleAiActions(gameId, 'discussion');

  startPhaseTimer(gameId, 'discussion', advancePhase);
}

// ACTION PHASE — each player assigns their action to a threat
async function runActionPhase(gameId) {
  await Games.updateAsync(gameId, {
    $set: {
      actionSubmissions: [],
      revealedActions: null,
      lookoutReveal: null,
      updatedAt: new Date(),
    },
  });

  // Schedule AI action submissions
  scheduleAiActions(gameId, 'action');

  startPhaseTimer(gameId, 'action', async (gId) => {
    await resolveActionPhase(gId);
  });
}

// Resolve actions when all submitted or timer expires
export async function resolveActionPhase(gameId) {
  const lockKey = `action_${gameId}`;
  if (resolveLocks.get(lockKey)) {
    return;
  }
  resolveLocks.set(lockKey, true);
  try {
    const game = await Games.findOneAsync(gameId);
    if (!game || game.currentPhase !== GamePhase.ACTION) {
      return;
    }

    clearPhaseTimer(gameId);

    // Default action: assign to first threat for non-submitters who have actions
    const submittedSeats = new Set(game.actionSubmissions.map(s => s.seatIndex));
    const defaultSubmissions = [];
    for (const player of game.players) {
      if (!submittedSeats.has(player.seatIndex) && player.hasNextAction) {
        const defaultThreat = game.activeThreats[0];
        if (defaultThreat) {
          defaultSubmissions.push({
            seatIndex: player.seatIndex,
            threatId: defaultThreat.id,
          });
        }
      }
    }

    const allSubmissions = [...game.actionSubmissions, ...defaultSubmissions];

    // Lookout passive: reveal one other player's action early
    let lookoutReveal = null;
    const lookout = game.players.find(p => p.role === 'lookout');
    if (lookout) {
      const hasNoLookout = lookout.curses.some(c => c.effect === 'noLookout');
      if (!hasNoLookout) {
        const otherSubmissions = allSubmissions.filter(s => s.seatIndex !== lookout.seatIndex);
        if (otherSubmissions.length > 0) {
          const picked = otherSubmissions[Math.floor(Math.random() * otherSubmissions.length)];
          const pickedPlayer = game.players.find(p => p.seatIndex === picked.seatIndex);
          lookoutReveal = {
            seatIndex: picked.seatIndex,
            displayName: pickedPlayer?.displayName || 'Unknown',
            role: pickedPlayer?.role || 'unknown',
            threatId: picked.threatId,
          };
        }
      }
    }

    // Reveal all actions simultaneously
    const revealedActions = allSubmissions.map(sub => {
      const player = game.players.find(p => p.seatIndex === sub.seatIndex);
      return {
        seatIndex: sub.seatIndex,
        displayName: player?.displayName || 'Unknown',
        role: player?.role || 'unknown',
        threatId: sub.threatId,
      };
    });

    const updates = resolveActions(game, allSubmissions);

    await Games.updateAsync(gameId, {
      $set: {
        lookoutReveal,
        revealedActions,
        ...updates,
        updatedAt: new Date(),
      },
    });

    // Update AI suspicion based on action choices
    updateSuspicionFromActions(game, allSubmissions);

    await appendLog(gameId, game.currentRound, GamePhase.ACTION, 'actions_resolved', {
      actions: revealedActions,
    });

    await advancePhase(gameId);
  } finally {
    resolveLocks.delete(lockKey);
  }
}

// ACCUSATION PHASE — optional player-initiated
async function runAccusationPhase(gameId) {
  await Games.updateAsync(gameId, {
    $set: { accusation: null, updatedAt: new Date() },
  });

  // Schedule AI accusation decisions
  scheduleAiActions(gameId, 'accusation');

  startPhaseTimer(gameId, 'accusation', async (gId) => {
    // If no accusation was made, just advance
    const game = await Games.findOneAsync(gId);
    if (game && !game.accusation) {
      await advancePhase(gId);
    } else if (game && game.accusation && !game.accusation.resolved) {
      // Resolve any pending accusation
      await resolveAccusationPhase(gId);
    } else {
      await advancePhase(gId);
    }
  });
}

// Resolve accusation vote
export async function resolveAccusationPhase(gameId) {
  const lockKey = `accusation_${gameId}`;
  if (resolveLocks.get(lockKey)) {
    return;
  }
  resolveLocks.set(lockKey, true);
  try {
    const game = await Games.findOneAsync(gameId);
    if (!game || !game.accusation) {
      await advancePhase(gameId);
      return;
    }

    clearPhaseTimer(gameId);

    const result = resolveAccusation(game, game.accusation);

    await Games.updateAsync(gameId, {
      $set: {
        accusation: { ...game.accusation, resolved: true, ...result },
        players: result.updatedPlayers || game.players,
        updatedAt: new Date(),
      },
    });

    await appendLog(gameId, game.currentRound, GamePhase.ACCUSATION, 'accusation_resolved', {
      accuserSeat: game.accusation.accuserSeat,
      targetSeat: game.accusation.targetSeat,
      correct: result.correct,
    });

    // On acquittal, reduce suspicion of the target and increase suspicion of the accuser
    if (!result.correct) {
      const aiPlayers = game.players.filter(p => p.isAI);
      for (const ai of aiPlayers) {
        if (ai.seatIndex !== game.accusation.targetSeat) {
          updateSuspicion(game._id, ai.seatIndex, game.accusation.targetSeat, 'defended_self_well');
        }
        if (ai.seatIndex !== game.accusation.accuserSeat) {
          updateSuspicion(game._id, ai.seatIndex, game.accusation.accuserSeat, 'accused_loyal');
        }
      }
    }

    // Check if phantom was caught — game might end
    if (result.correct) {
      await finishGame(gameId, GameResult.LOYAL_WIN, 'phantom_caught');
      return;
    }

    await advancePhase(gameId);
  } finally {
    resolveLocks.delete(lockKey);
  }
}

// ROUND END PHASE — check win/loss, increment round
async function runRoundEndPhase(gameId) {
  const game = await Games.findOneAsync(gameId);
  if (!game) {
    return;
  }

  // Apply Cook's passive heal and curse drain in a single pass
  const hasCook = game.players.some(p => p.role === 'cook');
  const updatedPlayers = game.players.map(p => {
    let supplies = p.supplies;
    if (hasCook) {
      supplies = Math.min(supplies + 1, DEFAULT_STARTING_SUPPLIES_MAX);
    }
    const hasDrain = p.curses.some(c => c.effect === 'supplyDrain');
    if (hasDrain) {
      supplies = Math.max(supplies - 1, 0);
    }
    return { ...p, supplies };
  });
  await Games.updateAsync(gameId, {
    $set: { players: updatedPlayers, updatedAt: new Date() },
  });

  // Check game end conditions
  const endCheck = checkGameEnd(await Games.findOneAsync(gameId));
  if (endCheck.ended) {
    await finishGame(gameId, endCheck.result, endCheck.reason);
    return;
  }

  // Auto-advance after display, then start next round
  startPhaseTimer(gameId, 'round_end', async (gId) => {
    await startNextRound(gId);
  });
}

// Start a new round
async function startNextRound(gameId) {
  const game = await Games.findOneAsync(gameId);
  if (!game || game.currentPhase === GamePhase.FINISHED) {
    return;
  }

  const nextRound = game.currentRound + 1;
  const now = new Date();

  // Restore hasNextAction for all players
  const resetPlayers = game.players.map(p => ({
    ...p,
    hasNextAction: true,
  }));

  await Games.updateAsync(gameId, {
    $set: {
      currentRound: nextRound,
      currentPhase: GamePhase.THREAT,
      phaseStartedAt: now,
      phaseDeadline: new Date(now.getTime() + PhaseDurations.threat),
      tollSubmissions: [],
      actionSubmissions: [],
      revealedActions: null,
      accusation: null,
      players: resetPlayers,
      updatedAt: now,
    },
  });

  await appendLog(gameId, nextRound, GamePhase.THREAT, 'round_started', {
    round: nextRound,
  });

  await runThreatPhase(gameId);
}

// Finish the game
async function finishGame(gameId, result, reason) {
  clearPhaseTimer(gameId);

  const now = new Date();
  await Games.updateAsync(gameId, {
    $set: {
      currentPhase: GamePhase.FINISHED,
      result,
      endReason: reason,
      updatedAt: now,
    },
  });

  // Also update the room
  const game = await Games.findOneAsync(gameId);
  if (game) {
    await GameRooms.updateAsync(game.roomId, {
      $set: { status: RoomStatus.FINISHED, finishedAt: now },
    });
  }

  await appendLog(gameId, game?.currentRound || 0, GamePhase.FINISHED, 'game_ended', {
    result,
    reason,
  });

  // Clean up in-memory suspicion state
  clearSuspicion(gameId);
}

// Update AI suspicion scores based on toll results
function updateSuspicionFromTolls(game, submissions) {
  const aiPlayers = game.players.filter(p => p.isAI);
  for (const ai of aiPlayers) {
    for (const sub of submissions) {
      if (sub.seatIndex === ai.seatIndex) {
        continue;
      }
      const eventType = sub.choice === 'doom' ? 'toll_doom'
        : sub.choice === 'supply' ? 'toll_supply'
        : 'toll_curse';
      updateSuspicion(game._id, ai.seatIndex, sub.seatIndex, eventType);
    }
  }
}

// Update AI suspicion scores based on action results
// Treats near-completion threats (progress/threshold > 0.6) as valid targets
// to avoid false suspicion on loyal players finishing off threats.
function updateSuspicionFromActions(game, submissions) {
  if (game.activeThreats.length === 0) {
    return;
  }

  const aiPlayers = game.players.filter(p => p.isAI);
  for (const ai of aiPlayers) {
    for (const sub of submissions) {
      if (sub.seatIndex === ai.seatIndex) {
        continue;
      }
      const player = game.players.find(p => p.seatIndex === sub.seatIndex);
      if (!player) {
        continue;
      }
      const role = Object.values(Roles).find(r => r.id === player.role);
      if (!role) {
        continue;
      }
      // Check if the player targeted their best threat
      const targetedThreat = game.activeThreats.find(t => t.id === sub.threatId);
      if (!targetedThreat) {
        continue;
      }
      const targetedStrength = getActionStrength(role, targetedThreat.type);
      const bestStrength = Math.max(...game.activeThreats.map(t => getActionStrength(role, t.type)));

      // Targeting a near-completion threat is valid cooperative play
      const nearCompletion = targetedThreat.threshold > 0 && (targetedThreat.progress / targetedThreat.threshold) > 0.6;
      const eventType = (targetedStrength >= bestStrength || nearCompletion) ? 'action_optimal' : 'action_suboptimal';
      updateSuspicion(game._id, ai.seatIndex, sub.seatIndex, eventType);
    }
  }
}

// Append to game log
async function appendLog(gameId, round, phase, type, data) {
  await GameLog.insertAsync({
    gameId,
    round,
    phase,
    type,
    data,
    createdAt: new Date(),
  });
}

// Register resolve functions so decisionEngine can call them without circular imports
registerResolver('resolveTollPhase', resolveTollPhase);
registerResolver('resolveActionPhase', resolveActionPhase);
registerResolver('resolveAccusationPhase', resolveAccusationPhase);
