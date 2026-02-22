import { Meteor } from 'meteor/meteor';
import { UsedNonces, SubscriptionCache, GameRooms, Games, GameMessages, GameLog } from '../imports/api/collections.js';

Meteor.startup(async () => {
  // SSO user lookup index
  await Meteor.users.createIndexAsync({ 'services.sso.hubUserId': 1 });

  // TTL index: auto-delete nonces after 10 minutes
  await UsedNonces.createIndexAsync(
    { createdAt: 1 },
    { expireAfterSeconds: 600 }
  );

  // TTL index: auto-delete cache entries after 5 minutes
  await SubscriptionCache.createIndexAsync(
    { createdAt: 1 },
    { expireAfterSeconds: 300 }
  );

  // Game room indexes
  await GameRooms.createIndexAsync({ status: 1, createdAt: -1 });
  await GameRooms.createIndexAsync({ 'players.userId': 1 });
  await GameRooms.createIndexAsync({ lastActiveAt: 1, status: 1 });

  // Game indexes
  await Games.createIndexAsync({ roomId: 1 });
  await Games.createIndexAsync({ 'players.userId': 1, currentPhase: 1 });

  // Game messages indexes
  await GameMessages.createIndexAsync({ gameId: 1, round: 1, createdAt: 1 });

  // Game log indexes
  await GameLog.createIndexAsync({ gameId: 1, createdAt: 1 });
});
