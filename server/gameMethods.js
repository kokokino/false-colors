import { Meteor } from 'meteor/meteor';
import { check, Match } from 'meteor/check';
import { Games, GameMessages } from '../imports/api/collections.js';
import { GamePhase, GameConstants } from '../imports/lib/collections/games.js';
import { resolveTollPhase, resolveActionPhase, resolveAccusationPhase, checkReadyToAdvance, applyCookNourish } from '../imports/game/stateMachine.js';
import { scheduleAiVotesOnAccusation } from '../imports/game/ai/decisionEngine.js';

Meteor.methods({
  // Submit a toll choice during TOLL phase
  async 'game.submitToll'(gameId, choice) {
    check(gameId, String);
    check(choice, Match.Where(v => ['resolve', 'doom', 'curse'].includes(v)));

    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }

    const game = await Games.findOneAsync(gameId);
    if (!game) {
      throw new Meteor.Error('not-found', 'Game not found');
    }

    if (game.currentPhase !== GamePhase.TOLL) {
      throw new Meteor.Error('wrong-phase', 'Not in toll phase');
    }

    const player = game.players.find(p => p.userId === this.userId);
    if (!player) {
      throw new Meteor.Error('not-in-game', 'You are not in this game');
    }

    // Revealed phantom: forced to doom
    if (player.phantomRevealed) {
      if (choice !== 'doom') {
        throw new Meteor.Error('phantom-forced', 'Revealed phantom must choose doom');
      }
    }

    if (choice === 'resolve' && player.resolve <= 0) {
      throw new Meteor.Error('no-resolve', 'No resolve remaining');
    }

    // Atomic check-and-push: prevents TOCTOU double-submission race
    const updated = await Games.updateAsync(
      {
        _id: gameId,
        currentPhase: GamePhase.TOLL,
        'tollSubmissions.seatIndex': { $ne: player.seatIndex },
      },
      {
        $push: {
          tollSubmissions: {
            seatIndex: player.seatIndex,
            choice,
          },
        },
        $set: { updatedAt: new Date() },
      }
    );
    if (updated === 0) {
      throw new Meteor.Error('already-submitted', 'You already submitted your toll');
    }

    // Check if all players have submitted
    const updatedGame = await Games.findOneAsync(gameId);
    if (updatedGame.tollSubmissions.length >= updatedGame.players.length) {
      await resolveTollPhase(gameId);
    }
  },

  // Submit an action (assign to threat) during ACTION phase
  async 'game.submitAction'(gameId, threatId) {
    check(gameId, String);
    check(threatId, String);

    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }

    const game = await Games.findOneAsync(gameId);
    if (!game) {
      throw new Meteor.Error('not-found', 'Game not found');
    }

    if (game.currentPhase !== GamePhase.ACTION) {
      throw new Meteor.Error('wrong-phase', 'Not in action phase');
    }

    const player = game.players.find(p => p.userId === this.userId);
    if (!player) {
      throw new Meteor.Error('not-in-game', 'You are not in this game');
    }

    if (!player.hasNextAction) {
      throw new Meteor.Error('no-action', 'You have lost your action this round');
    }

    // Verify threat exists
    const threat = game.activeThreats.find(t => t.id === threatId);
    if (!threat) {
      throw new Meteor.Error('invalid-threat', 'Threat not found');
    }

    // Atomic check-and-push: prevents TOCTOU double-submission race
    const updated = await Games.updateAsync(
      {
        _id: gameId,
        currentPhase: GamePhase.ACTION,
        'actionSubmissions.seatIndex': { $ne: player.seatIndex },
      },
      {
        $push: {
          actionSubmissions: {
            seatIndex: player.seatIndex,
            threatId,
          },
        },
        $set: { updatedAt: new Date() },
      }
    );
    if (updated === 0) {
      throw new Meteor.Error('already-submitted', 'You already submitted your action');
    }

    // Check if all players with actions have submitted
    const updatedGame = await Games.findOneAsync(gameId);
    const playersWithActions = updatedGame.players.filter(p => p.hasNextAction).length;
    if (updatedGame.actionSubmissions.length >= playersWithActions) {
      await resolveActionPhase(gameId);
    }
  },

  // Send a chat message during DISCUSSION phase
  async 'game.sendMessage'(gameId, text) {
    check(gameId, String);
    check(text, String);

    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }

    const trimmedText = text.trim();
    if (trimmedText.length === 0) {
      throw new Meteor.Error('invalid-message', 'Message cannot be empty');
    }
    if (trimmedText.length > GameConstants.CHAT_MAX_LENGTH) {
      throw new Meteor.Error('invalid-message', `Message too long (max ${GameConstants.CHAT_MAX_LENGTH} characters)`);
    }

    const game = await Games.findOneAsync(gameId);
    if (!game) {
      throw new Meteor.Error('not-found', 'Game not found');
    }

    if (game.currentPhase !== GamePhase.DISCUSSION) {
      throw new Meteor.Error('wrong-phase', 'Not in discussion phase');
    }

    const player = game.players.find(p => p.userId === this.userId);
    if (!player) {
      throw new Meteor.Error('not-in-game', 'You are not in this game');
    }

    // Spectral chill curse limits player to 1 message per discussion phase
    const hasSpectralChill = player.curses.some(c => c.effect === 'discussionPenalty');
    if (hasSpectralChill) {
      const messageCount = await GameMessages.find({
        gameId,
        round: game.currentRound,
        seatIndex: player.seatIndex,
      }).countAsync();
      if (messageCount >= 1) {
        throw new Meteor.Error('curse-limit', 'Spectral Chill limits you to 1 message per discussion');
      }
    }

    const messageId = await GameMessages.insertAsync({
      gameId,
      round: game.currentRound,
      seatIndex: player.seatIndex,
      displayName: player.displayName,
      text: trimmedText,
      createdAt: new Date(),
    });

    // Post-insert guard: if two rapid calls both passed the pre-insert check,
    // remove the just-inserted message when the count exceeds the limit.
    if (hasSpectralChill) {
      const postCount = await GameMessages.find({
        gameId,
        round: game.currentRound,
        seatIndex: player.seatIndex,
      }).countAsync();
      if (postCount > 1) {
        await GameMessages.removeAsync(messageId);
        throw new Meteor.Error('curse-limit', 'Spectral Chill limits you to 1 message per discussion');
      }
    }
  },

  // Make an accusation during ACCUSATION phase
  async 'game.accuse'(gameId, targetSeatIndex) {
    check(gameId, String);
    check(targetSeatIndex, Match.Integer);

    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }

    const game = await Games.findOneAsync(gameId);
    if (!game) {
      throw new Meteor.Error('not-found', 'Game not found');
    }

    if (game.currentPhase !== GamePhase.ACCUSATION) {
      throw new Meteor.Error('wrong-phase', 'Not in accusation phase');
    }

    // Only one accusation per round
    if (game.accusation) {
      throw new Meteor.Error('accusation-exists', 'An accusation has already been made this round');
    }

    const accuser = game.players.find(p => p.userId === this.userId);
    if (!accuser) {
      throw new Meteor.Error('not-in-game', 'You are not in this game');
    }

    // One accusation per player per game
    if (accuser.hasAccused) {
      throw new Meteor.Error('already-accused', 'You have already used your accusation this game');
    }

    // No accusations before round 3
    if (game.currentRound < 3) {
      throw new Meteor.Error('too-early', 'Accusations begin in round 3');
    }

    // Revealed phantom cannot accuse
    if (accuser.phantomRevealed) {
      throw new Meteor.Error('phantom-revealed', 'Revealed phantoms cannot accuse');
    }

    if (!accuser.hasNextAction) {
      throw new Meteor.Error('no-action', 'You have lost your action and cannot accuse');
    }

    // Can't accuse yourself
    if (accuser.seatIndex === targetSeatIndex) {
      throw new Meteor.Error('invalid-target', 'You cannot accuse yourself');
    }

    const target = game.players.find(p => p.seatIndex === targetSeatIndex);
    if (!target) {
      throw new Meteor.Error('invalid-target', 'Target player not found');
    }

    // Mark accuser as having used their accusation
    const updatedPlayers = game.players.map(p => {
      if (p.seatIndex === accuser.seatIndex) {
        return { ...p, hasAccused: true };
      }
      return { ...p };
    });

    // Atomic check-and-set: prevents TOCTOU double-accusation race
    const updated = await Games.updateAsync(
      {
        _id: gameId,
        currentPhase: GamePhase.ACCUSATION,
        accusation: null,
      },
      {
        $set: {
          accusation: {
            accuserSeat: accuser.seatIndex,
            targetSeat: targetSeatIndex,
            votes: [],
            resolved: false,
          },
          players: updatedPlayers,
          updatedAt: new Date(),
        },
      }
    );
    if (updated === 0) {
      throw new Meteor.Error('accusation-exists', 'An accusation has already been made this round');
    }

    // Schedule AI players to vote on the human's accusation
    scheduleAiVotesOnAccusation(gameId, accuser.seatIndex, targetSeatIndex);
  },

  // Vote on an active accusation
  async 'game.voteAccusation'(gameId, guilty) {
    check(gameId, String);
    check(guilty, Boolean);

    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }

    const game = await Games.findOneAsync(gameId);
    if (!game) {
      throw new Meteor.Error('not-found', 'Game not found');
    }

    if (!game.accusation || game.accusation.resolved) {
      throw new Meteor.Error('no-accusation', 'No active accusation to vote on');
    }

    const voter = game.players.find(p => p.userId === this.userId);
    if (!voter) {
      throw new Meteor.Error('not-in-game', 'You are not in this game');
    }

    // Can't vote if you're the accuser or target
    if (voter.seatIndex === game.accusation.accuserSeat || voter.seatIndex === game.accusation.targetSeat) {
      throw new Meteor.Error('cannot-vote', 'The accuser and target cannot vote');
    }

    // Atomic check-and-push: prevents TOCTOU double-vote race
    const updated = await Games.updateAsync(
      {
        _id: gameId,
        'accusation.resolved': false,
        'accusation.votes.seatIndex': { $ne: voter.seatIndex },
      },
      {
        $push: {
          'accusation.votes': { seatIndex: voter.seatIndex, guilty },
        },
        $set: { updatedAt: new Date() },
      }
    );
    if (updated === 0) {
      throw new Meteor.Error('already-voted', 'You already voted');
    }

    // Check if all eligible voters have voted (total players - accuser - target)
    const updatedGame = await Games.findOneAsync(gameId);
    const eligibleVoters = updatedGame.players.length - 2;
    if (updatedGame.accusation.votes.length >= eligibleVoters) {
      await resolveAccusationPhase(gameId);
    }
  },

  // Signal ready to advance (discussion/accusation phases)
  async 'game.readyToAdvance'(gameId) {
    check(gameId, String);

    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }

    const game = await Games.findOneAsync(gameId);
    if (!game) {
      throw new Meteor.Error('not-found', 'Game not found');
    }

    const allowedPhases = [GamePhase.DISCUSSION, GamePhase.ACCUSATION, GamePhase.ROUND_END];
    if (!allowedPhases.includes(game.currentPhase)) {
      throw new Meteor.Error('wrong-phase', 'Cannot ready in this phase');
    }

    const player = game.players.find(p => p.userId === this.userId);
    if (!player) {
      throw new Meteor.Error('not-in-game', 'You are not in this game');
    }

    // Atomic add to readyPlayers
    await Games.updateAsync(
      { _id: gameId, 'readyPlayers': { $ne: player.seatIndex } },
      { $push: { readyPlayers: player.seatIndex }, $set: { updatedAt: new Date() } }
    );

    await checkReadyToAdvance(gameId);
  },

  // Cook nourish — restore 1 resolve to a crew member during ROUND_END
  async 'game.cookNourish'(gameId, targetSeatIndex) {
    check(gameId, String);
    check(targetSeatIndex, Match.Integer);

    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }

    const game = await Games.findOneAsync(gameId);
    if (!game) {
      throw new Meteor.Error('not-found', 'Game not found');
    }

    if (targetSeatIndex < 0 || targetSeatIndex >= game.players.length) {
      throw new Meteor.Error('invalid-target', 'Invalid target seat');
    }

    if (game.currentPhase !== GamePhase.ROUND_END) {
      throw new Meteor.Error('wrong-phase', 'Not in round end phase');
    }

    const cook = game.players.find(p => p.userId === this.userId);
    if (!cook) {
      throw new Meteor.Error('not-in-game', 'You are not in this game');
    }

    if (cook.role !== 'cook') {
      throw new Meteor.Error('not-cook', 'Only the Cook can nourish');
    }

    if (cook.phantomRevealed) {
      throw new Meteor.Error('not-authorized', 'Revealed phantom cannot nourish');
    }

    if ((cook.mealsRemaining || 0) <= 0) {
      throw new Meteor.Error('no-meals', 'No meals remaining');
    }

    const target = game.players.find(p => p.seatIndex === targetSeatIndex);
    if (!target) {
      throw new Meteor.Error('invalid-target', 'Target player not found');
    }

    if (target.phantomRevealed) {
      throw new Meteor.Error('invalid-target', 'Cannot nourish a revealed phantom');
    }

    const success = await applyCookNourish(gameId, cook.seatIndex, targetSeatIndex);
    if (!success) {
      throw new Meteor.Error('nourish-failed', 'Could not nourish target');
    }
  },

  // Set expert mode for current user
  async 'user.setExpertMode'(expertMode) {
    check(expertMode, Boolean);

    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }

    await Meteor.users.updateAsync(this.userId, {
      $set: { isExpertPlayer: expertMode },
    });
  },
});
