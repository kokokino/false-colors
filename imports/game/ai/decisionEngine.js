import { Meteor } from 'meteor/meteor';
import { Games, GameMessages } from '../../api/collections.js';
import { Alignment, GameConstants } from '../../lib/collections/games.js';
import { Personalities } from './personalities.js';
import { chooseLoyalToll, choosePhantomToll } from './tollStrategy.js';
import { chooseLoyalAction, choosePhantomAction } from './actionStrategy.js';
import { shouldLoyalAccuse, shouldPhantomAccuse, voteOnAccusation } from './accusationStrategy.js';
import { initSuspicion, updateSuspicion } from './suspicionTracker.js';
import { generateAiDialogue } from '../../ai/dialogueEngine.js';
import { getResolver } from '../resolverRegistry.js';

// Random delay between min and max milliseconds
function randomDelay(min, max) {
  return min + Math.floor(Math.random() * (max - min));
}

// Schedule AI actions for a given phase with human-like delays
// Optional specificPlayers array to schedule only certain AI players (e.g. mid-phase disconnect conversion)
export function scheduleAiActions(gameId, phase, specificPlayers) {
  // Run async — don't block the caller
  scheduleAsync(gameId, phase, specificPlayers).catch(err => console.error('[ai] schedule error:', err));
}

async function scheduleAsync(gameId, phase, specificPlayers) {
  const game = await Games.findOneAsync(gameId);
  if (!game) {
    return;
  }

  const aiPlayers = specificPlayers || game.players.filter(p => p.isAI);

  // Initialize suspicion tracking for AI players on first call
  const allSeats = game.players.map(p => p.seatIndex);
  for (const ai of aiPlayers) {
    initSuspicion(gameId, ai.seatIndex, allSeats);
  }

  switch (phase) {
    case 'toll':
      for (const ai of aiPlayers) {
        const delay = randomDelay(GameConstants.AI_DELAY_TOLL.min, GameConstants.AI_DELAY_TOLL.max);
        Meteor.setTimeout(() => {
          submitAiToll(gameId, ai).catch(err => console.error('[ai] toll error:', err));
        }, delay);
      }
      break;

    case 'discussion':
      for (const ai of aiPlayers) {
        scheduleAiDiscussion(gameId, ai, game);
      }
      break;

    case 'action':
      for (const ai of aiPlayers) {
        const delay = randomDelay(GameConstants.AI_DELAY_ACTION.min, GameConstants.AI_DELAY_ACTION.max);
        Meteor.setTimeout(() => {
          submitAiAction(gameId, ai).catch(err => console.error('[ai] action error:', err));
        }, delay);
      }
      break;

    case 'accusation':
      for (const ai of aiPlayers) {
        const delay = randomDelay(GameConstants.AI_DELAY_ACCUSATION.min, GameConstants.AI_DELAY_ACCUSATION.max);
        Meteor.setTimeout(() => {
          handleAiAccusation(gameId, ai).catch(err => console.error('[ai] accusation error:', err));
        }, delay);
      }
      break;

    case 'cook_nourish':
      for (const ai of aiPlayers) {
        if (ai.role === 'cook' && (ai.mealsRemaining || 0) > 0) {
          const delay = randomDelay(2000, 5000);
          Meteor.setTimeout(() => {
            submitAiCookNourish(gameId, ai).catch(err => console.error('[ai] nourish error:', err));
          }, delay);
        }
      }
      break;
  }
}

// AI toll submission — uses atomic $ne filter to prevent double-submission
async function submitAiToll(gameId, aiPlayer) {
  const game = await Games.findOneAsync(gameId);
  if (!game || game.currentPhase !== 'toll') {
    return;
  }

  const personality = Personalities[aiPlayer.personality];
  let choice;

  if (aiPlayer.alignment === Alignment.PHANTOM) {
    choice = choosePhantomToll(aiPlayer, game, personality, game.currentRound);
  } else {
    choice = chooseLoyalToll(aiPlayer, game, personality);
  }

  // Revealed phantom forced to doom
  if (aiPlayer.phantomRevealed) {
    choice = 'doom';
  }

  const updated = await Games.updateAsync(
    { _id: gameId, currentPhase: 'toll', 'tollSubmissions.seatIndex': { $ne: aiPlayer.seatIndex } },
    {
      $push: { tollSubmissions: { seatIndex: aiPlayer.seatIndex, choice } },
      $set: { updatedAt: new Date() },
    }
  );
  if (updated === 0) {
    return;
  }

  // Check if all players have submitted — resolve if so
  const updatedGame = await Games.findOneAsync(gameId);
  if (updatedGame && updatedGame.tollSubmissions.length >= updatedGame.players.length) {
    const resolveTollPhase = getResolver('resolveTollPhase');
    if (resolveTollPhase) {
      await resolveTollPhase(gameId);
    }
  }
}

// AI action submission — uses atomic $ne filter to prevent double-submission
async function submitAiAction(gameId, aiPlayer) {
  const game = await Games.findOneAsync(gameId);
  if (!game || game.currentPhase !== 'action') {
    return;
  }

  if (!aiPlayer.hasNextAction) {
    return;
  }

  const personality = Personalities[aiPlayer.personality];
  let threatId;

  if (aiPlayer.alignment === Alignment.PHANTOM) {
    threatId = choosePhantomAction(aiPlayer, game, personality, game.currentRound);
  } else {
    threatId = chooseLoyalAction(aiPlayer, game, personality);
  }

  if (!threatId) {
    return;
  }

  const updated = await Games.updateAsync(
    { _id: gameId, currentPhase: 'action', 'actionSubmissions.seatIndex': { $ne: aiPlayer.seatIndex } },
    {
      $push: { actionSubmissions: { seatIndex: aiPlayer.seatIndex, threatId } },
      $set: { updatedAt: new Date() },
    }
  );
  if (updated === 0) {
    return;
  }

  // Check if all players with actions have submitted
  const updatedGame = await Games.findOneAsync(gameId);
  if (updatedGame) {
    const playersWithActions = updatedGame.players.filter(p => p.hasNextAction).length;
    if (updatedGame.actionSubmissions.length >= playersWithActions) {
      const resolveActionPhase = getResolver('resolveActionPhase');
      if (resolveActionPhase) {
        await resolveActionPhase(gameId);
      }
    }
  }
}

// AI Cook nourish — pick best target during round_end
async function submitAiCookNourish(gameId, aiPlayer) {
  const game = await Games.findOneAsync(gameId);
  if (!game || game.currentPhase !== 'round_end') {
    return;
  }

  // Re-check current player state
  const cook = game.players.find(p => p.seatIndex === aiPlayer.seatIndex && p.role === 'cook');
  if (!cook || (cook.mealsRemaining || 0) <= 0) {
    return;
  }

  const applyCookNourish = getResolver('applyCookNourish');
  if (!applyCookNourish) {
    return;
  }

  // Choose target based on alignment
  const nonRevealed = game.players.filter(p => !p.phantomRevealed);
  if (nonRevealed.length === 0) {
    return;
  }

  let target;
  if (cook.alignment === Alignment.PHANTOM && !cook.phantomRevealed) {
    // Phantom Cook: suboptimal nourish
    const personality = Personalities[cook.personality];
    const traits = personality?.traits || {};
    if (Math.random() < 0.3 + (1 - traits.actionOptimality) * 0.3) {
      // Heal highest resolve player (wasteful)
      const sortedByResolve = [...nonRevealed].sort((a, b) => b.resolve - a.resolve);
      target = sortedByResolve[0];
    } else {
      // Sometimes skip entirely
      if (Math.random() < 0.3) {
        // Update suspicion if someone is desperate (at 0 resolve)
        const desperate = nonRevealed.filter(p => p.resolve === 0);
        if (desperate.length > 0) {
          const aiPlayers = game.players.filter(p => p.isAI && p.seatIndex !== cook.seatIndex);
          for (const ai of aiPlayers) {
            updateSuspicion(gameId, ai.seatIndex, cook.seatIndex, 'cook_nourish_skipped');
          }
        }
        return;
      }
      // Pick randomly
      target = nonRevealed[Math.floor(Math.random() * nonRevealed.length)];
    }
  } else {
    // Loyal Cook: nourish lowest resolve player
    const sortedByResolve = [...nonRevealed].sort((a, b) => a.resolve - b.resolve);
    target = sortedByResolve[0];
  }

  if (target) {
    await applyCookNourish(gameId, cook.seatIndex, target.seatIndex);
  }
}

// Schedule AI discussion messages with 3-8 second delays
function scheduleAiDiscussion(gameId, aiPlayer, game) {
  const personality = Personalities[aiPlayer.personality];

  // Spectral chill curse limits to 1 message
  const hasSpectralChill = aiPlayer.curses.some(c => c.effect === 'discussionPenalty');
  const messageCount = hasSpectralChill ? 1
    : personality.traits.chatFrequency > 0.6 ? 2 + Math.floor(Math.random() * 2) : 1;

  for (let i = 0; i < messageCount; i++) {
    const delay = randomDelay(GameConstants.AI_DELAY_DISCUSSION.min, GameConstants.AI_DELAY_DISCUSSION.max) + (i * randomDelay(3000, 6000));

    // Cap total delay at discussion phase duration minus buffer
    if (delay > GameConstants.DISCUSSION_MAX_DELAY) {
      break;
    }

    Meteor.setTimeout(async () => {
      try {
        const currentGame = await Games.findOneAsync(gameId);
        if (!currentGame || currentGame.currentPhase !== 'discussion') {
          return;
        }

        let trigger;
        const doomHigh = currentGame.doomLevel > currentGame.doomThreshold * 0.6;
        const tollAgg = currentGame.tollAggregate;
        const doomTolls = tollAgg ? tollAgg.doomCount : 0;

        if (i === 0) {
          if (currentGame.phantomJustRevealed) {
            trigger = 'phantomRevealedReaction';
          } else if (currentGame.currentRound === 1) {
            trigger = 'greeting';
          } else if (doomTolls >= 2) {
            trigger = 'tollObservation';
          } else {
            trigger = 'tollReaction';
          }
        } else if (i === 1) {
          // Comment on cook nourish, actions, or doom
          if (currentGame.lastNourishTarget && Math.random() < 0.6) {
            trigger = 'cookObservation';
          } else if (currentGame.revealedActions?.length > 0 && Math.random() < 0.5) {
            trigger = 'actionObservation';
          } else if (doomHigh && Math.random() < 0.4) {
            trigger = 'doomWarning';
          } else {
            trigger = 'threatAssessment';
          }
        } else {
          if ((currentGame.goldCoins || []).length > 0 || (currentGame.skulls || []).length > 0) {
            trigger = (Math.random() < 0.3) ? 'scoreObservation' : (doomHigh ? 'doomWarning' : 'commentary');
          } else {
            trigger = doomHigh && Math.random() < 0.5 ? 'doomWarning' : 'commentary';
          }
        }

        // Build slot overrides for specific triggers
        let slotOverrides;
        if (trigger === 'phantomRevealedReaction' && currentGame.phantomJustRevealed) {
          slotOverrides = { player_name: currentGame.phantomJustRevealed };
        } else if (trigger === 'cookObservation' && currentGame.lastNourishTarget) {
          slotOverrides = { player_name: currentGame.lastNourishTarget };
        }

        const text = await generateAiDialogue(currentGame, aiPlayer, trigger, slotOverrides);

        await GameMessages.insertAsync({
          gameId,
          round: currentGame.currentRound,
          seatIndex: aiPlayer.seatIndex,
          displayName: aiPlayer.displayName,
          text,
          createdAt: new Date(),
        });
      } catch (err) {
        console.error('[ai] discussion error:', err);
      }
    }, delay);
  }
}

// AI accusation handling
async function handleAiAccusation(gameId, aiPlayer) {
  const game = await Games.findOneAsync(gameId);
  if (!game || game.currentPhase !== 'accusation') {
    return;
  }

  const personality = Personalities[aiPlayer.personality];

  // If there's an active accusation, vote on it
  if (game.accusation && !game.accusation.resolved) {
    // Don't vote if accuser or target
    if (aiPlayer.seatIndex === game.accusation.accuserSeat || aiPlayer.seatIndex === game.accusation.targetSeat) {
      return;
    }
    const alreadyVoted = game.accusation.votes.some(v => v.seatIndex === aiPlayer.seatIndex);
    if (alreadyVoted) {
      return;
    }

    const guilty = voteOnAccusation(aiPlayer, game, game.accusation, personality);

    // Atomic check-and-push: prevents TOCTOU double-vote race
    const updated = await Games.updateAsync(
      {
        _id: gameId,
        'accusation.resolved': false,
        'accusation.votes.seatIndex': { $ne: aiPlayer.seatIndex },
      },
      {
        $push: { 'accusation.votes': { seatIndex: aiPlayer.seatIndex, guilty } },
        $set: { updatedAt: new Date() },
      }
    );
    if (updated === 0) {
      return;
    }

    // Re-read to check if all eligible voters have voted
    const updatedGame = await Games.findOneAsync(gameId);
    if (updatedGame && updatedGame.accusation) {
      const eligibleVoters = updatedGame.players.length - 2;
      if (updatedGame.accusation.votes.length >= eligibleVoters) {
        const resolveAccusationPhase = getResolver('resolveAccusationPhase');
        if (resolveAccusationPhase) {
          await resolveAccusationPhase(gameId);
        }
      }
    }
    return;
  }

  // No accusation yet — consider making one
  if (game.accusation) {
    return; // Already an accusation this round
  }

  // Revealed phantom cannot accuse
  if (aiPlayer.phantomRevealed) {
    return;
  }

  let targetSeat;
  if (aiPlayer.alignment === Alignment.PHANTOM) {
    targetSeat = shouldPhantomAccuse(aiPlayer, game, personality);
  } else {
    targetSeat = shouldLoyalAccuse(aiPlayer, game, personality);
  }

  if (targetSeat === null) {
    return;
  }

  // Mark hasAccused atomically with the accusation
  const updatedPlayers = game.players.map(p => {
    if (p.seatIndex === aiPlayer.seatIndex) {
      return { ...p, hasAccused: true };
    }
    return { ...p };
  });

  // Atomic check-and-set: prevents TOCTOU double-accusation race
  const updated = await Games.updateAsync(
    {
      _id: gameId,
      currentPhase: 'accusation',
      accusation: null,
    },
    {
      $set: {
        accusation: {
          accuserSeat: aiPlayer.seatIndex,
          targetSeat,
          votes: [],
          resolved: false,
        },
        players: updatedPlayers,
        updatedAt: new Date(),
      },
    }
  );
  if (updated === 0) {
    return;
  }

  // Generate accusation dialogue
  const freshGame = await Games.findOneAsync(gameId);
  const targetPlayer = freshGame ? freshGame.players.find(p => p.seatIndex === targetSeat) : null;
  const accusationText = await generateAiDialogue(freshGame, aiPlayer, 'accusation', {
    player_name: targetPlayer?.displayName || 'someone',
  });
  await GameMessages.insertAsync({
    gameId,
    round: freshGame.currentRound,
    seatIndex: aiPlayer.seatIndex,
    displayName: aiPlayer.displayName,
    text: accusationText,
    createdAt: new Date(),
  });

  // If the target is AI, generate defense dialogue after a short delay
  if (targetPlayer && targetPlayer.isAI) {
    Meteor.setTimeout(async () => {
      try {
        const currentGame = await Games.findOneAsync(gameId);
        if (!currentGame || currentGame.currentPhase !== 'accusation') {
          return;
        }
        const defenseText = await generateAiDialogue(currentGame, targetPlayer, 'defense', {
          player_name: aiPlayer.displayName,
        });
        await GameMessages.insertAsync({
          gameId,
          round: currentGame.currentRound,
          seatIndex: targetPlayer.seatIndex,
          displayName: targetPlayer.displayName,
          text: defenseText,
          createdAt: new Date(),
        });
      } catch (err) {
        console.error('[ai] defense dialogue error:', err);
      }
    }, randomDelay(1500, 3000));
  }

  // Schedule other AIs to vote after a short delay
  const otherAis = freshGame.players.filter(p =>
    p.isAI && p.seatIndex !== aiPlayer.seatIndex && p.seatIndex !== targetSeat
  );
  for (const other of otherAis) {
    const voteDelay = randomDelay(2000, 5000);
    Meteor.setTimeout(() => handleAiAccusation(gameId, other), voteDelay);
  }
}
