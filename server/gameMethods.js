import { Meteor } from 'meteor/meteor';
import { check, Match } from 'meteor/check';
import { Games, GameMessages } from '../imports/api/collections.js';
import { GamePhase } from '../imports/lib/collections/games.js';
import { resolveTollPhase, resolveActionPhase, resolveAccusationPhase } from '../imports/game/stateMachine.js';

Meteor.methods({
  // Submit a toll choice during TOLL phase
  async 'game.submitToll'(gameId, choice) {
    check(gameId, String);
    check(choice, Match.Where(v => ['supply', 'doom', 'curse'].includes(v)));

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

    // Check not already submitted
    const alreadySubmitted = game.tollSubmissions.some(s => s.seatIndex === player.seatIndex);
    if (alreadySubmitted) {
      throw new Meteor.Error('already-submitted', 'You already submitted your toll');
    }

    await Games.updateAsync(gameId, {
      $push: {
        tollSubmissions: {
          seatIndex: player.seatIndex,
          choice,
        },
      },
      $set: { updatedAt: new Date() },
    });

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

    // Check not already submitted
    const alreadySubmitted = game.actionSubmissions.some(s => s.seatIndex === player.seatIndex);
    if (alreadySubmitted) {
      throw new Meteor.Error('already-submitted', 'You already submitted your action');
    }

    await Games.updateAsync(gameId, {
      $push: {
        actionSubmissions: {
          seatIndex: player.seatIndex,
          threatId,
        },
      },
      $set: { updatedAt: new Date() },
    });

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
    if (trimmedText.length > 300) {
      throw new Meteor.Error('invalid-message', 'Message too long (max 300 characters)');
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

    await GameMessages.insertAsync({
      gameId,
      round: game.currentRound,
      seatIndex: player.seatIndex,
      displayName: player.displayName,
      text: trimmedText,
      createdAt: new Date(),
    });
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

    await Games.updateAsync(gameId, {
      $set: {
        accusation: {
          accuserSeat: accuser.seatIndex,
          targetSeat: targetSeatIndex,
          votes: [],
          resolved: false,
        },
        updatedAt: new Date(),
      },
    });
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

    // Check not already voted
    const alreadyVoted = game.accusation.votes.some(v => v.seatIndex === voter.seatIndex);
    if (alreadyVoted) {
      throw new Meteor.Error('already-voted', 'You already voted');
    }

    const newVotes = [...game.accusation.votes, { seatIndex: voter.seatIndex, guilty }];

    await Games.updateAsync(gameId, {
      $set: {
        'accusation.votes': newVotes,
        updatedAt: new Date(),
      },
    });

    // Check if all eligible voters have voted (total players - accuser - target)
    const eligibleVoters = game.players.length - 2;
    if (newVotes.length >= eligibleVoters) {
      await resolveAccusationPhase(gameId);
    }
  },
});
