import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';
import { GameRooms, Games, GameMessages, GameLog } from '../imports/api/collections.js';
import { RoomStatus } from '../imports/lib/collections/games.js';

// Publish current user's subscription data
Meteor.publish('userData', function() {
  if (!this.userId) {
    return this.ready();
  }

  return Meteor.users.find(
    { _id: this.userId },
    {
      fields: {
        username: 1,
        emails: 1,
        subscriptions: 1,
        'services.sso.hubUserId': 1
      }
    }
  );
});

// Room publications
Meteor.publish('rooms.lobby', function() {
  if (!this.userId) {
    return this.ready();
  }
  return GameRooms.find(
    { status: RoomStatus.WAITING },
    {
      fields: {
        hostId: 1,
        players: 1,
        status: 1,
        maxPlayers: 1,
        countdownStartedAt: 1,
        createdAt: 1,
      },
      sort: { createdAt: -1 },
      limit: 50,
    }
  );
});

Meteor.publish('rooms.current', function(roomId) {
  check(roomId, String);
  if (!this.userId) {
    return this.ready();
  }
  return GameRooms.find(
    {
      _id: roomId,
      'players.userId': this.userId,
    },
    {
      fields: {
        hostId: 1,
        players: 1,
        status: 1,
        maxPlayers: 1,
        countdownStartedAt: 1,
        gameId: 1,
        createdAt: 1,
        startedAt: 1,
        finishedAt: 1,
      },
    }
  );
});

// Game publication — uses observeChanges to strip secrets
// NEVER publishes: players[].alignment, players[].isAI, actionSubmissions, tollSubmissions, llmCallsUsed, threatDeck
Meteor.publish('game', async function(gameId) {
  check(gameId, String);
  if (!this.userId) {
    return this.ready();
  }

  // Verify caller is a player in this game
  const membership = await Games.findOneAsync({ _id: gameId, 'players.userId': this.userId });
  if (!membership) {
    return this.ready();
  }

  const sub = this;
  const handle = await Games.find({ _id: gameId }).observeChanges({
    added(id, fields) {
      sub.added('games', id, stripSecrets(fields));
    },
    changed(id, fields) {
      sub.changed('games', id, stripSecrets(fields));
    },
    removed(id) {
      sub.removed('games', id);
    },
  });

  sub.ready();
  sub.onStop(() => handle.stop());
});

// Strip secret fields from game documents before publishing
function stripSecrets(fields) {
  const safe = { ...fields };

  // Strip secret player fields
  if (safe.players) {
    safe.players = safe.players.map(p => {
      const { alignment, isAI, ...publicFields } = p;
      return publicFields;
    });
  }

  // Never publish these fields
  delete safe.actionSubmissions;
  delete safe.tollSubmissions;
  delete safe.llmCallsUsed;
  delete safe.threatDeck;

  return safe;
}

// Game messages publication — no isAI field exists, so messages are identical for all senders
Meteor.publish('gameMessages', async function(gameId) {
  check(gameId, String);
  if (!this.userId) {
    return this.ready();
  }
  // Verify caller is a player in this game
  const membership = await Games.findOneAsync({ _id: gameId, 'players.userId': this.userId });
  if (!membership) {
    return this.ready();
  }
  return GameMessages.find(
    { gameId },
    { sort: { createdAt: 1 }, limit: 200 }
  );
});

// Game log publication — all events visible
Meteor.publish('gameLog', async function(gameId) {
  check(gameId, String);
  if (!this.userId) {
    return this.ready();
  }
  // Verify caller is a player in this game
  const membership = await Games.findOneAsync({ _id: gameId, 'players.userId': this.userId });
  if (!membership) {
    return this.ready();
  }
  return GameLog.find(
    { gameId },
    { sort: { createdAt: 1 }, limit: 500 }
  );
});
