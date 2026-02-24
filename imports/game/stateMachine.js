import { Meteor } from 'meteor/meteor';
import { GameRooms, Games, GameLog } from '../api/collections.js';
import { GamePhase, Alignment, GameResult, RoomStatus } from '../lib/collections/games.js';
import { Roles, getActionStrength } from './roles.js';
import { createThreatDeck, drawThreats } from './threats.js';
import { shuffleRoster } from './ai/crewRoster.js';
import { startPhaseTimer, clearPhaseTimer, getPhaseDuration } from './phaseTimer.js';
import { resolveTolls, resolveActions, resolveAccusation, checkGameEnd } from './resolution.js';
import { scheduleAiActions } from './ai/decisionEngine.js';
import { clearSuspicion, decaySuspicion, updateSuspicion, resetSuspicionOnReveal } from './ai/suspicionTracker.js';
import { registerResolver } from './resolverRegistry.js';

// In-memory lock to prevent concurrent phase resolution (race between timer, AI, and human callers)
const resolveLocks = new Map();

const DEFAULT_DOOM_THRESHOLD = 15;
const DEFAULT_MAX_ROUNDS = 10;
const DEFAULT_STARTING_RESOLVE = 3;
const MAX_RESOLVE = 5;
const COOK_STARTING_MEALS = 5;
// Probability that a phantom exists (80% chance)
const PHANTOM_PROBABILITY = 0.8;

// Check doom milestones and return any triggered skull objects.
// Only fires on upward crossings — doom decreases do not un-trigger.
export function checkDoomMilestones(oldDoom, newDoom, currentRound) {
  const milestones = [];
  if (oldDoom < 5 && newDoom >= 5) {
    milestones.push({ round: currentRound, reason: 'doom_rising', description: 'Doom rising' });
  }
  if (oldDoom < 10 && newDoom >= 10) {
    milestones.push({ round: currentRound, reason: 'doom_critical', description: 'Doom critical' });
  }
  return milestones;
}

// Start a game from a room — creates Games doc, assigns characters, fills AI seats
export async function startGame(roomId, totalPlayers) {
  // Atomic guard: only start if room is still in WAITING or STARTING state
  const claimed = await GameRooms.updateAsync(
    { _id: roomId, status: { $in: [RoomStatus.WAITING, RoomStatus.STARTING] } },
    { $set: { status: RoomStatus.STARTING } }
  );
  if (claimed === 0) {
    return;
  }

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

  // Determine expert mode: all human players must have isExpertPlayer: true
  let expertMode = false;
  if (humanUserIds.length > 0) {
    const humanUsers = await Meteor.users.find(
      { _id: { $in: humanUserIds } },
      { fields: { isExpertPlayer: 1 } }
    ).fetchAsync();
    expertMode = humanUsers.length > 0 && humanUsers.every(u => u.isExpertPlayer === true);
  }

  // Build player array — humans first, then AI fill-ins
  const players = [];
  for (let i = 0; i < totalPlayers; i++) {
    const character = roster[i];
    const isAI = i >= humanUserIds.length;
    const userId = isAI ? `ai_${character.roleId}_${roomId}` : humanUserIds[i];

    const player = {
      seatIndex: i,
      userId,
      displayName: character.characterName,
      role: character.roleId,
      isAI,
      alignment: Alignment.LOYAL, // Will assign phantom below
      personality: character.personality,
      hasNextAction: true,
      resolve: DEFAULT_STARTING_RESOLVE,
      curses: [],
      hasAccused: false,
      phantomRevealed: false,
    };

    // Cook gets meals
    if (character.roleId === 'cook') {
      player.mealsRemaining = COOK_STARTING_MEALS;
    }

    players.push(player);
  }

  // Assign phantom randomly (any seat — human or AI)
  if (Math.random() < PHANTOM_PROBABILITY) {
    const phantomIndex = Math.floor(Math.random() * players.length);
    players[phantomIndex].alignment = Alignment.PHANTOM;
  }

  // Create threat deck
  const threatDeck = createThreatDeck();

  const now = new Date();
  const phaseDuration = getPhaseDuration('threat', expertMode);
  const gameId = await Games.insertAsync({
    roomId,
    theme: 'phantom_tides',
    players,
    currentRound: 1,
    maxRounds,
    currentPhase: GamePhase.THREAT,
    phaseStartedAt: now,
    phaseDeadline: new Date(now.getTime() + phaseDuration),
    doomLevel: 0,
    doomAtRoundStart: 0,
    doomThreshold,
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
    expertMode,
    goldCoins: [],
    skulls: [],
    threatsDefeated: 0,
    readyPlayers: [],
    tollAggregate: null,
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
// expectedPhase: if provided, bail out if game is no longer in this phase (prevents sequential double-advance)
export async function advancePhase(gameId, expectedPhase) {
  const lockKey = `advance_${gameId}`;
  if (resolveLocks.get(lockKey)) {
    return;
  }
  resolveLocks.set(lockKey, true);
  try {
    const game = await Games.findOneAsync(gameId);
    if (!game || game.currentPhase === GamePhase.FINISHED) {
      return;
    }
    if (expectedPhase && game.currentPhase !== expectedPhase) {
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
    const duration = getPhaseDuration(nextPhase, game.expertMode);

    await Games.updateAsync(gameId, {
      $set: {
        currentPhase: nextPhase,
        phaseStartedAt: now,
        phaseDeadline: new Date(now.getTime() + duration),
        readyPlayers: [],
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
  } finally {
    resolveLocks.delete(lockKey);
  }
}

// THREAT PHASE — generate threats, add doom from existing ones, escalate old threats
async function runThreatPhase(gameId) {
  const game = await Games.findOneAsync(gameId);
  if (!game) {
    return;
  }

  // Existing threats add doom and escalate if active 2+ rounds
  let doomFromThreats = 0;
  const newSkulls = [];
  const updatedThreats = game.activeThreats.map(t => {
    const threat = { ...t };
    doomFromThreats += threat.doomPerRound;

    // Track cumulative doom for skull threshold
    threat.totalDoomCaused = (threat.totalDoomCaused || 0) + threat.doomPerRound;

    // Escalation: threats active for 2+ rounds get worse
    const roundsActive = game.currentRound - (threat.roundAdded || 1);
    if (roundsActive >= 2 && !threat.escalated) {
      threat.escalated = true;
      threat.doomPerRound += 1;
      newSkulls.push({
        round: game.currentRound,
        reason: 'threat_escalated',
        description: `${threat.name} worsens`,
      });
    }

    // Skull for threats causing 4+ cumulative doom
    if (threat.totalDoomCaused >= 4 && !threat.skullAwarded) {
      threat.skullAwarded = true;
      newSkulls.push({
        round: game.currentRound,
        reason: 'threat_ravaged',
        description: `${threat.name} ravaged the ship`,
      });
    }

    return threat;
  });

  // Draw new threats
  const { drawn, remaining } = drawThreats([...game.threatDeck], game.currentRound);

  const allThreats = [...updatedThreats, ...drawn];
  const newDoom = Math.min(game.doomLevel + doomFromThreats, game.doomThreshold + 10);

  // Doom milestone skulls
  const milestoneSkulls = checkDoomMilestones(game.doomLevel, newDoom, game.currentRound);
  newSkulls.push(...milestoneSkulls);

  const updateOp = {
    $set: {
      activeThreats: allThreats,
      threatDeck: remaining,
      doomLevel: newDoom,
      updatedAt: new Date(),
    },
  };
  if (newSkulls.length > 0) {
    updateOp.$push = { skulls: { $each: newSkulls } };
  }

  await Games.updateAsync(gameId, updateOp);

  await appendLog(gameId, game.currentRound, GamePhase.THREAT, 'threats_drawn', {
    newThreats: drawn.map(t => t.name),
    doomAdded: doomFromThreats,
  });

  // Check doom threshold after adding doom from threats
  if (newDoom >= game.doomThreshold) {
    const hasPhantom = game.players.some(p => p.alignment === Alignment.PHANTOM);
    await finishGame(gameId, hasPhantom ? GameResult.PHANTOM_WIN : GameResult.DOOM_LOSS, 'doom_threshold');
    return;
  }

  // Auto-advance after display time
  startPhaseTimer(gameId, 'threat', (gId) => advancePhase(gId, GamePhase.THREAT), game.expertMode);
}

// TOLL PHASE — every player must choose a harmful action
async function runTollPhase(gameId) {
  const game = await Games.findOneAsync(gameId);
  // Clear previous submissions
  await Games.updateAsync(gameId, {
    $set: { tollSubmissions: [], updatedAt: new Date() },
  });

  // Schedule AI toll submissions with human-like delays
  scheduleAiActions(gameId, 'toll');

  // Timer auto-advances when expired (default tolls applied for non-submitters)
  startPhaseTimer(gameId, 'toll', async (gId) => {
    await resolveTollPhase(gId);
  }, game?.expertMode);
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

    // Check doom milestones from toll-induced doom increase
    const tollMilestoneSkulls = checkDoomMilestones(game.doomLevel, updates.doomLevel, game.currentRound);

    const tollUpdateOp = { $set: { ...updates, updatedAt: new Date() } };
    if (tollMilestoneSkulls.length > 0) {
      tollUpdateOp.$push = { skulls: { $each: tollMilestoneSkulls } };
    }

    await Games.updateAsync(gameId, tollUpdateOp);

    // Update AI suspicion based on toll choices
    updateSuspicionFromTolls(game, allSubmissions);

    await appendLog(gameId, game.currentRound, GamePhase.TOLL, 'tolls_resolved', {
      submissions: allSubmissions.length,
      ...updates.tollAggregate,
    });

    await advancePhase(gameId, GamePhase.TOLL);
  } finally {
    resolveLocks.delete(lockKey);
  }
}

// DISCUSSION PHASE — chat window
async function runDiscussionPhase(gameId) {
  const game = await Games.findOneAsync(gameId);
  // Schedule AI chat messages with human-like delays
  // Flags (lastNourishTarget, phantomJustRevealed) are cleared at the start of ACTION phase
  // so that AI setTimeout callbacks can still read them during discussion.
  scheduleAiActions(gameId, 'discussion');

  startPhaseTimer(gameId, 'discussion', (gId) => advancePhase(gId, GamePhase.DISCUSSION), game?.expertMode);
}

// ACTION PHASE — each player assigns their action to a threat
async function runActionPhase(gameId) {
  const game = await Games.findOneAsync(gameId);
  await Games.updateAsync(gameId, {
    $set: {
      actionSubmissions: [],
      revealedActions: null,
      lookoutReveal: null,
      updatedAt: new Date(),
    },
    $unset: { lastNourishTarget: '', phantomJustRevealed: '' },
  });

  // Schedule AI action submissions
  scheduleAiActions(gameId, 'action');

  startPhaseTimer(gameId, 'action', async (gId) => {
    await resolveActionPhase(gId);
  }, game?.expertMode);
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
      const hasNoLookout = game.players.some(p => p.curses.some(c => c.effect === 'noLookout'));
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

    // Resolve actions (includes zero-resolve penalty and phantom cap)
    const actionResult = resolveActions(game, allSubmissions);

    // Reveal all actions simultaneously — now includes computed strength
    const revealedActions = allSubmissions.map(sub => {
      const player = game.players.find(p => p.seatIndex === sub.seatIndex);
      return {
        seatIndex: sub.seatIndex,
        displayName: player?.displayName || 'Unknown',
        role: player?.role || 'unknown',
        threatId: sub.threatId,
        strength: actionResult.playerStrengths[sub.seatIndex] || 0,
      };
    });

    // Award gold coins for completed threats and reduce doom
    const newCoins = [];
    let doomReduction = 0;
    let newDefeated = 0;
    for (const threat of (actionResult.completedThreats || [])) {
      newCoins.push({
        round: game.currentRound,
        reason: 'threat_resolved',
        description: `Defeated ${threat.name}`,
      });
      doomReduction += 1;
      newDefeated += 1;
    }

    const newDoom = Math.max(0, game.doomLevel - doomReduction);

    const updateOp = {
      $set: {
        lookoutReveal,
        revealedActions,
        activeThreats: actionResult.activeThreats,
        doomLevel: newDoom,
        updatedAt: new Date(),
      },
      $inc: { threatsDefeated: newDefeated },
    };
    if (newCoins.length > 0) {
      updateOp.$push = { goldCoins: { $each: newCoins } };
    }

    await Games.updateAsync(gameId, updateOp);

    // Update AI suspicion based on action choices
    updateSuspicionFromActions(game, allSubmissions);

    await appendLog(gameId, game.currentRound, GamePhase.ACTION, 'actions_resolved', {
      actions: revealedActions.map(a => {
        const threat = game.activeThreats.find(t => t.id === a.threatId);
        return { ...a, threatName: threat?.name || 'Unknown' };
      }),
    });

    await advancePhase(gameId, GamePhase.ACTION);
  } finally {
    resolveLocks.delete(lockKey);
  }
}

// ACCUSATION PHASE — optional player-initiated
async function runAccusationPhase(gameId) {
  const game = await Games.findOneAsync(gameId);
  await Games.updateAsync(gameId, {
    $set: { accusation: null, updatedAt: new Date() },
  });

  // Schedule AI accusation decisions
  scheduleAiActions(gameId, 'accusation');

  startPhaseTimer(gameId, 'accusation', async (gId) => {
    // If no accusation was made, just advance
    const g = await Games.findOneAsync(gId);
    if (g && !g.accusation) {
      await advancePhase(gId, GamePhase.ACCUSATION);
    } else if (g && g.accusation && !g.accusation.resolved) {
      // Resolve any pending accusation
      await resolveAccusationPhase(gId);
    } else {
      await advancePhase(gId, GamePhase.ACCUSATION);
    }
  }, game?.expertMode);
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
      await advancePhase(gameId, GamePhase.ACCUSATION);
      return;
    }

    clearPhaseTimer(gameId);

    const result = resolveAccusation(game, game.accusation);

    // Build update operations
    const setOp = {
      accusation: { ...game.accusation, resolved: true, ...result },
      players: result.updatedPlayers || game.players,
      updatedAt: new Date(),
    };

    // Flag correct accusation so next discussion triggers phantomRevealedReaction
    if (result.correct) {
      const target = game.players.find(p => p.seatIndex === game.accusation.targetSeat);
      setOp.phantomJustRevealed = target?.displayName || 'the phantom';
    }

    // Apply doom change from accusation
    if (result.doomChange) {
      setOp.doomLevel = Math.max(0, Math.min(game.doomLevel + result.doomChange, game.doomThreshold + 10));
    }

    const updateOp = { $set: setOp };

    // Push scoring events
    if (result.goldCoin) {
      updateOp.$push = { goldCoins: result.goldCoin };
    }
    if (result.skull) {
      const allSkulls = [result.skull];
      // Check doom milestones from wrong accusation doom increase
      if (result.doomChange > 0) {
        const accusationMilestones = checkDoomMilestones(game.doomLevel, setOp.doomLevel, game.currentRound);
        allSkulls.push(...accusationMilestones);
      }
      if (!updateOp.$push) {
        updateOp.$push = {};
      }
      updateOp.$push.skulls = { $each: allSkulls };
    }

    await Games.updateAsync(gameId, updateOp);

    await appendLog(gameId, game.currentRound, GamePhase.ACCUSATION, 'accusation_resolved', {
      accuserSeat: game.accusation.accuserSeat,
      targetSeat: game.accusation.targetSeat,
      correct: result.correct,
    });

    // On correct accusation, update suspicion: max phantom, reward accuser, reset stale scores
    if (result.correct) {
      // Reset all suspicion scores — phantom is confirmed, stale data is irrelevant
      resetSuspicionOnReveal(game._id, game.accusation.targetSeat);

      // Reduce suspicion of the accuser (good detective work)
      const aiPlayers = game.players.filter(p => p.isAI);
      for (const ai of aiPlayers) {
        if (ai.seatIndex !== game.accusation.accuserSeat) {
          updateSuspicion(game._id, ai.seatIndex, game.accusation.accuserSeat, 'accused_phantom');
        }
      }
    }

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
      // Track guilty voters on acquitted players as mildly suspicious
      if (game.accusation.votes) {
        const guiltyVoters = game.accusation.votes
          .filter(v => v.guilty)
          .map(v => v.seatIndex);
        for (const ai of aiPlayers) {
          for (const voterSeat of guiltyVoters) {
            if (voterSeat !== ai.seatIndex) {
              updateSuspicion(game._id, ai.seatIndex, voterSeat, 'voted_guilty_on_acquitted');
            }
          }
        }
      }
    }

    // Check if doom threshold was crossed by wrong accusation
    if (result.doomChange > 0) {
      const updatedGame = await Games.findOneAsync(gameId);
      if (updatedGame && updatedGame.doomLevel >= updatedGame.doomThreshold) {
        const hasPhantom = updatedGame.players.some(p => p.alignment === Alignment.PHANTOM);
        await finishGame(gameId, hasPhantom ? GameResult.PHANTOM_WIN : GameResult.DOOM_LOSS, 'doom_threshold');
        return;
      }
    }

    // Phantom caught — game continues now (no longer ends)
    await advancePhase(gameId, GamePhase.ACCUSATION);
  } finally {
    resolveLocks.delete(lockKey);
  }
}

// ROUND END PHASE — Cook nourish, curse drain, score clean sailing, check win/loss
async function runRoundEndPhase(gameId) {
  const game = await Games.findOneAsync(gameId);
  if (!game) {
    return;
  }

  // Apply curse drain (rotting_stores) — no more passive Cook heal
  const updatedPlayers = game.players.map(p => {
    let resolve = p.resolve;
    const hasDrain = p.curses.some(c => c.effect === 'resolveDrain');
    if (hasDrain) {
      resolve = Math.max(resolve - 1, 0);
    }
    return { ...p, resolve };
  });
  await Games.updateAsync(gameId, {
    $set: { players: updatedPlayers, updatedAt: new Date() },
  });

  // Check for "clean sailing" gold coin — awarded if doom didn't increase this round
  // or if all threats are cleared
  const newCoins = [];
  if (game.activeThreats.length === 0) {
    newCoins.push({
      round: game.currentRound,
      reason: 'clean_sailing',
      description: 'All threats cleared',
    });
  } else if (game.doomLevel <= (game.doomAtRoundStart || 0)) {
    newCoins.push({
      round: game.currentRound,
      reason: 'clean_sailing',
      description: 'Smooth sailing',
    });
  }
  if (newCoins.length > 0) {
    await Games.updateAsync(gameId, { $push: { goldCoins: { $each: newCoins } } });
  }

  // Decay suspicion so one-time offenders fade over quiet rounds
  decaySuspicion(gameId);

  // Check game end conditions
  const freshGame = await Games.findOneAsync(gameId);
  const endCheck = checkGameEnd(freshGame);
  if (endCheck.ended) {
    await finishGame(gameId, endCheck.result, endCheck.reason);
    return;
  }

  // Schedule AI Cook nourish during round_end (skip if Cook is a revealed phantom)
  const cook = freshGame.players.find(p => p.role === 'cook');
  if (cook && (cook.mealsRemaining || 0) > 0 && !cook.phantomRevealed) {
    scheduleAiActions(gameId, 'cook_nourish');
  }

  // Timer to advance
  startPhaseTimer(gameId, 'round_end', async (gId) => {
    await startNextRound(gId, GamePhase.ROUND_END);
  }, game.expertMode);
}

// Cook nourish action — called from gameMethods or AI
// Uses resolveLock to prevent TOCTOU race from double-clicks or network retries
export async function applyCookNourish(gameId, cookSeatIndex, targetSeatIndex) {
  const lockKey = `nourish_${gameId}`;
  if (resolveLocks.get(lockKey)) {
    return false;
  }
  resolveLocks.set(lockKey, true);
  try {
    const game = await Games.findOneAsync(gameId);
    if (!game || game.currentPhase !== GamePhase.ROUND_END) {
      return false;
    }

    const cook = game.players.find(p => p.seatIndex === cookSeatIndex && p.role === 'cook');
    if (!cook || (cook.mealsRemaining || 0) <= 0 || cook.phantomRevealed) {
      return false;
    }

    const target = game.players.find(p => p.seatIndex === targetSeatIndex);
    if (!target || target.phantomRevealed) {
      return false;
    }

    const updatedPlayers = game.players.map(p => {
      if (p.seatIndex === targetSeatIndex) {
        return { ...p, resolve: Math.min(p.resolve + 1, MAX_RESOLVE) };
      }
      if (p.seatIndex === cookSeatIndex) {
        return { ...p, mealsRemaining: (p.mealsRemaining || 0) - 1 };
      }
      return { ...p };
    });

    const updated = await Games.updateAsync(
      { _id: gameId, currentPhase: GamePhase.ROUND_END },
      {
        $set: {
          players: updatedPlayers,
          lastNourishTarget: target.displayName,
          updatedAt: new Date(),
        },
      }
    );
    if (updated === 0) {
      return false;
    }

    await appendLog(gameId, game.currentRound, GamePhase.ROUND_END, 'cook_nourish', {
      cookSeat: cookSeatIndex,
      targetSeat: targetSeatIndex,
      targetName: target.displayName,
    });

    // Update AI suspicion for Cook nourish choice (works for both human and AI cooks)
    const nonRevealed = game.players.filter(p => !p.phantomRevealed && p.seatIndex !== cookSeatIndex);
    const desperate = nonRevealed.filter(p => p.resolve === 0);
    const aiObservers = game.players.filter(p => p.isAI && p.seatIndex !== cookSeatIndex);
    if (desperate.length > 0 && target.resolve > 0) {
      for (const ai of aiObservers) {
        updateSuspicion(gameId, ai.seatIndex, cookSeatIndex, 'cook_nourish_wasteful');
      }
    } else {
      // Optimal nourish: target has the lowest resolve among non-revealed players
      const lowestResolve = Math.min(...nonRevealed.map(p => p.resolve));
      if (target.resolve <= lowestResolve) {
        for (const ai of aiObservers) {
          updateSuspicion(gameId, ai.seatIndex, cookSeatIndex, 'cook_nourish_optimal');
        }
      }
    }

    return true;
  } finally {
    resolveLocks.delete(lockKey);
  }
}

// Start a new round — expectedPhase guard prevents double-advance from timer + readyToAdvance
async function startNextRound(gameId, expectedPhase) {
  const game = await Games.findOneAsync(gameId);
  if (!game || game.currentPhase === GamePhase.FINISHED) {
    return;
  }
  if (expectedPhase && game.currentPhase !== expectedPhase) {
    return;
  }

  const nextRound = game.currentRound + 1;
  const now = new Date();
  const phaseDuration = getPhaseDuration('threat', game.expertMode);

  // Restore hasNextAction for all players
  // Revealed phantom: toll forced to doom (server-enforced)
  const resetPlayers = game.players.map(p => ({
    ...p,
    hasNextAction: true,
  }));

  await Games.updateAsync(gameId, {
    $set: {
      currentRound: nextRound,
      currentPhase: GamePhase.THREAT,
      phaseStartedAt: now,
      phaseDeadline: new Date(now.getTime() + phaseDuration),
      doomAtRoundStart: game.doomLevel,
      tollSubmissions: [],
      actionSubmissions: [],
      revealedActions: null,
      lookoutReveal: null,
      accusation: null,
      readyPlayers: [],
      tollAggregate: null,
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

  const game = await Games.findOneAsync(gameId);
  if (!game) {
    return;
  }

  // Unmask all phantoms so observeChanges detects a real diff on the players array
  const revealedPlayers = game.players.map(p => {
    if (p.alignment === 'phantom' && !p.phantomRevealed) {
      return { ...p, phantomRevealed: true };
    }
    return p;
  });

  const now = new Date();
  await Games.updateAsync(gameId, {
    $set: {
      currentPhase: GamePhase.FINISHED,
      result,
      endReason: reason,
      players: revealedPlayers,
      updatedAt: now,
    },
  });

  if (game.roomId) {
    await GameRooms.updateAsync(game.roomId, {
      $set: { status: RoomStatus.FINISHED, finishedAt: now },
    });
  }

  await appendLog(gameId, game.currentRound || 0, GamePhase.FINISHED, 'game_ended', {
    result,
    reason,
  });

  // Clean up in-memory suspicion state
  clearSuspicion(gameId);
}

// Check if all humans are ready to advance (early submit)
export async function checkReadyToAdvance(gameId) {
  const game = await Games.findOneAsync(gameId);
  if (!game) {
    return;
  }
  const humanPlayers = game.players.filter(p => !p.isAI);
  const allReady = humanPlayers.every(p => (game.readyPlayers || []).includes(p.seatIndex));
  if (allReady && humanPlayers.length > 0) {
    // If accusation phase has an unresolved accusation, resolve it first
    if (game.currentPhase === GamePhase.ACCUSATION && game.accusation && !game.accusation.resolved) {
      await resolveAccusationPhase(gameId);
    } else {
      await advancePhase(gameId, game.currentPhase);
    }
  }
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
        : sub.choice === 'resolve' ? 'toll_resolve'
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

      // Reward for targeting escalated threats that match specialty
      if (targetedThreat.escalated && targetedStrength >= bestStrength) {
        updateSuspicion(game._id, ai.seatIndex, sub.seatIndex, 'action_targeted_escalated');
      }

      // Extra suspicion for ignoring escalated threats when you're the specialist
      if (!targetedThreat.escalated) {
        const escalatedThreats = game.activeThreats.filter(t => t.escalated);
        for (const et of escalatedThreats) {
          if (getActionStrength(role, et.type) >= bestStrength) {
            updateSuspicion(game._id, ai.seatIndex, sub.seatIndex, 'action_ignored_escalated');
          }
        }
      }
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

// Convert a human player to AI mid-game (disconnect or explicit leave)
export async function convertToAi(gameId, seatIndex) {
  const game = await Games.findOneAsync(gameId);
  if (!game || game.currentPhase === GamePhase.FINISHED) {
    return;
  }

  const player = game.players.find(p => p.seatIndex === seatIndex);
  if (!player || player.isAI) {
    return;
  }

  // Atomically set isAI for this player
  const updatedPlayers = game.players.map(p => {
    if (p.seatIndex === seatIndex) {
      return { ...p, isAI: true };
    }
    return { ...p };
  });

  await Games.updateAsync(gameId, {
    $set: { players: updatedPlayers, updatedAt: new Date() },
  });

  await appendLog(gameId, game.currentRound, game.currentPhase, 'player_replaced_by_ai', {
    seatIndex,
    displayName: player.displayName,
  });

  // If the game is in a timed phase and this player hasn't submitted, schedule their AI action
  const timedPhases = [GamePhase.TOLL, GamePhase.ACTION, GamePhase.ACCUSATION];
  if (timedPhases.includes(game.currentPhase)) {
    const aiPlayer = { ...player, isAI: true };
    scheduleAiActions(gameId, game.currentPhase, [aiPlayer]);
  }
}

// Register resolve functions so decisionEngine can call them without circular imports
registerResolver('resolveTollPhase', resolveTollPhase);
registerResolver('resolveActionPhase', resolveActionPhase);
registerResolver('resolveAccusationPhase', resolveAccusationPhase);
registerResolver('applyCookNourish', applyCookNourish);
