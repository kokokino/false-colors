import { Migrations } from 'meteor/quave:migrations';
import { GameRooms, Games, GameMessages, GameLog } from '../../imports/api/collections.js';

const TTL_24_HOURS = 86400; // 24 hours in seconds

Migrations.add({
  version: 2,
  name: 'Create game collection indexes',
  async up() {
    const rooms = GameRooms.rawCollection();
    await rooms.createIndex({ status: 1, createdAt: -1 });
    await rooms.createIndex({ 'players.userId': 1 });
    await rooms.createIndex({ lastActiveAt: 1, status: 1 });
    await rooms.createIndex({ countdownStartedAt: 1 });
    console.log('Created GameRooms indexes');

    const games = Games.rawCollection();
    await games.createIndex({ roomId: 1 });
    await games.createIndex({ 'players.userId': 1, currentPhase: 1 });
    await games.createIndex({ updatedAt: 1 }, { expireAfterSeconds: TTL_24_HOURS });
    console.log('Created Games indexes (24h TTL)');

    const messages = GameMessages.rawCollection();
    await messages.createIndex({ gameId: 1, round: 1, createdAt: 1 });
    await messages.createIndex({ createdAt: 1 }, { expireAfterSeconds: TTL_24_HOURS });
    console.log('Created GameMessages indexes (24h TTL)');

    const logs = GameLog.rawCollection();
    await logs.createIndex({ gameId: 1, createdAt: 1 });
    await logs.createIndex({ createdAt: 1 }, { expireAfterSeconds: TTL_24_HOURS });
    console.log('Created GameLog indexes (24h TTL)');
  },
  async down() {
    const rooms = GameRooms.rawCollection();
    await rooms.dropIndex('status_1_createdAt_-1');
    await rooms.dropIndex('players.userId_1');
    await rooms.dropIndex('lastActiveAt_1_status_1');
    await rooms.dropIndex('countdownStartedAt_1');

    const games = Games.rawCollection();
    await games.dropIndex('roomId_1');
    await games.dropIndex('players.userId_1_currentPhase_1');
    await games.dropIndex('updatedAt_1');

    const messages = GameMessages.rawCollection();
    await messages.dropIndex('gameId_1_round_1_createdAt_1');
    await messages.dropIndex('createdAt_1');

    const logs = GameLog.rawCollection();
    await logs.dropIndex('gameId_1_createdAt_1');
    await logs.dropIndex('createdAt_1');

    console.log('Dropped all game indexes');
  }
});
