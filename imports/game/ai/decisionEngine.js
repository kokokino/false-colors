import { Meteor } from 'meteor/meteor';
import { Games, GameMessages } from '../../api/collections.js';
import { Alignment } from '../../lib/collections/games.js';
import { Personalities } from './personalities.js';
import { chooseLoyalToll, choosePhantomToll } from './tollStrategy.js';
import { chooseLoyalAction, choosePhantomAction } from './actionStrategy.js';
import { shouldLoyalAccuse, shouldPhantomAccuse, voteOnAccusation } from './accusationStrategy.js';
import { initSuspicion } from './suspicionTracker.js';
import { generateAiDialogue } from '../../ai/dialogueEngine.js';
import { getResolver } from '../resolverRegistry.js';

// Random delay between min and max milliseconds
function randomDelay(min, max) {
  return min + Math.floor(Math.random() * (max - min));
}

// Schedule AI actions for a given phase with human-like delays
export function scheduleAiActions(gameId, phase) {
  // Run async — don't block the caller
  scheduleAsync(gameId, phase).catch(err => console.error('[ai] schedule error:', err));
}

async function scheduleAsync(gameId, phase) {
  const game = await Games.findOneAsync(gameId);
  if (!game) {
    return;
  }

  const aiPlayers = game.players.filter(p => p.isAI);

  // Initialize suspicion tracking for AI players on first call
  const allSeats = game.players.map(p => p.seatIndex);
  for (const ai of aiPlayers) {
    initSuspicion(gameId, ai.seatIndex, allSeats);
  }

  switch (phase) {
    case 'toll':
      for (const ai of aiPlayers) {
        const delay = randomDelay(1000, 3000);
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
        const delay = randomDelay(1000, 3000);
        Meteor.setTimeout(() => {
          submitAiAction(gameId, ai).catch(err => console.error('[ai] action error:', err));
        }, delay);
      }
      break;

    case 'accusation':
      for (const ai of aiPlayers) {
        const delay = randomDelay(2000, 5000);
        Meteor.setTimeout(() => {
          handleAiAccusation(gameId, ai).catch(err => console.error('[ai] accusation error:', err));
        }, delay);
      }
      break;
  }
}

// AI toll submission
async function submitAiToll(gameId, aiPlayer) {
  const game = await Games.findOneAsync(gameId);
  if (!game || game.currentPhase !== 'toll') {
    return;
  }

  // Check not already submitted
  const alreadySubmitted = game.tollSubmissions.some(s => s.seatIndex === aiPlayer.seatIndex);
  if (alreadySubmitted) {
    return;
  }

  const personality = Personalities[aiPlayer.personality];
  let choice;

  if (aiPlayer.alignment === Alignment.PHANTOM) {
    choice = choosePhantomToll(aiPlayer, game, personality, game.currentRound);
  } else {
    choice = chooseLoyalToll(aiPlayer, game, personality);
  }

  await Games.updateAsync(gameId, {
    $push: {
      tollSubmissions: {
        seatIndex: aiPlayer.seatIndex,
        choice,
      },
    },
    $set: { updatedAt: new Date() },
  });

  // Check if all players have submitted — resolve if so
  const updatedGame = await Games.findOneAsync(gameId);
  if (updatedGame && updatedGame.tollSubmissions.length >= updatedGame.players.length) {
    const resolveTollPhase = getResolver('resolveTollPhase');
    if (resolveTollPhase) {
      await resolveTollPhase(gameId);
    }
  }
}

// AI action submission
async function submitAiAction(gameId, aiPlayer) {
  const game = await Games.findOneAsync(gameId);
  if (!game || game.currentPhase !== 'action') {
    return;
  }

  if (!aiPlayer.hasNextAction) {
    return;
  }

  const alreadySubmitted = game.actionSubmissions.some(s => s.seatIndex === aiPlayer.seatIndex);
  if (alreadySubmitted) {
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

  await Games.updateAsync(gameId, {
    $push: {
      actionSubmissions: {
        seatIndex: aiPlayer.seatIndex,
        threatId,
      },
    },
    $set: { updatedAt: new Date() },
  });

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

// Schedule AI discussion messages with 3-8 second delays
function scheduleAiDiscussion(gameId, aiPlayer, game) {
  const personality = Personalities[aiPlayer.personality];

  // Spectral chill curse limits to 1 message
  const hasSpectralChill = aiPlayer.curses.some(c => c.effect === 'discussionPenalty');
  const messageCount = hasSpectralChill ? 1
    : personality.traits.chatFrequency > 0.6 ? 2 + Math.floor(Math.random() * 2) : 1;

  for (let i = 0; i < messageCount; i++) {
    const delay = randomDelay(3000, 8000) + (i * randomDelay(3000, 6000));

    // Cap total delay at discussion phase duration minus buffer
    if (delay > 25000) {
      break;
    }

    Meteor.setTimeout(async () => {
      const currentGame = await Games.findOneAsync(gameId);
      if (!currentGame || currentGame.currentPhase !== 'discussion') {
        return;
      }

      let trigger;
      if (i === 0) {
        trigger = currentGame.currentRound === 1 ? 'greeting' : 'tollReaction';
      } else if (i === 1) {
        trigger = 'threatAssessment';
      } else {
        trigger = 'commentary';
      }
      const text = await generateAiDialogue(currentGame, aiPlayer, trigger);

      await GameMessages.insertAsync({
        gameId,
        round: currentGame.currentRound,
        seatIndex: aiPlayer.seatIndex,
        displayName: aiPlayer.displayName,
        text,
        createdAt: new Date(),
      });
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

    const currentGame = await Games.findOneAsync(gameId);
    if (!currentGame || !currentGame.accusation || currentGame.accusation.resolved) {
      return;
    }

    const newVotes = [...currentGame.accusation.votes, { seatIndex: aiPlayer.seatIndex, guilty }];
    await Games.updateAsync(gameId, {
      $set: {
        'accusation.votes': newVotes,
        updatedAt: new Date(),
      },
    });

    // Check if all eligible voters have voted
    const eligibleVoters = currentGame.players.length - 2;
    if (newVotes.length >= eligibleVoters) {
      const resolveAccusationPhase = getResolver('resolveAccusationPhase');
      if (resolveAccusationPhase) {
        await resolveAccusationPhase(gameId);
      }
    }
    return;
  }

  // No accusation yet — consider making one
  if (game.accusation) {
    return; // Already an accusation this round
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

  // Double-check no accusation has been made in the meantime
  const freshGame = await Games.findOneAsync(gameId);
  if (!freshGame || freshGame.accusation || freshGame.currentPhase !== 'accusation') {
    return;
  }

  await Games.updateAsync(gameId, {
    $set: {
      accusation: {
        accuserSeat: aiPlayer.seatIndex,
        targetSeat,
        votes: [],
        resolved: false,
      },
      updatedAt: new Date(),
    },
  });

  // Generate accusation dialogue
  const targetPlayer = freshGame.players.find(p => p.seatIndex === targetSeat);
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
