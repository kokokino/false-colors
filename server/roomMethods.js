import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';
import { GameRooms } from '../imports/api/collections.js';
import { RoomStatus, MIN_PLAYERS, MAX_PLAYERS } from '../imports/lib/collections/games.js';
import { startGame } from '../imports/game/stateMachine.js';

const COUNTDOWN_SECONDS = 20;

// Track active countdown timers by roomId
const countdownTimers = new Map();

// Start the countdown timer for a room
function startCountdown(roomId) {
  if (countdownTimers.has(roomId)) {
    return; // Already running
  }

  const timerId = Meteor.setTimeout(async () => {
    countdownTimers.delete(roomId);

    const room = await GameRooms.findOneAsync(roomId);
    if (!room || room.status !== RoomStatus.WAITING) {
      return;
    }

    // Fill remaining seats with AI to reach minimum players
    const humanCount = room.players.length;
    const totalNeeded = Math.max(MIN_PLAYERS, humanCount);

    await GameRooms.updateAsync(roomId, {
      $set: {
        status: RoomStatus.STARTING,
        startedAt: new Date(),
      },
    });

    // Start the game (creates Games doc, assigns characters, fills AI)
    await startGame(roomId, totalNeeded);
  }, COUNTDOWN_SECONDS * 1000);

  countdownTimers.set(roomId, timerId);
}

// Cancel a countdown if the room empties
function cancelCountdown(roomId) {
  const timerId = countdownTimers.get(roomId);
  if (timerId) {
    Meteor.clearTimeout(timerId);
    countdownTimers.delete(roomId);
  }
}

Meteor.methods({
  // Find or create a game room — primary matchmaking entry point
  async 'matchmaking.findOrCreate'() {
    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in to play');
    }

    const user = await Meteor.users.findOneAsync(this.userId);
    if (!user) {
      throw new Meteor.Error('not-found', 'User not found');
    }

    // Check if already in an active room
    const existingRoom = await GameRooms.findOneAsync({
      'players.userId': this.userId,
      status: { $in: [RoomStatus.WAITING, RoomStatus.STARTING, RoomStatus.PLAYING] },
    });

    if (existingRoom) {
      return { alreadyPlaying: true, roomId: existingRoom._id };
    }

    // Find a joinable waiting room
    const openRoom = await GameRooms.findOneAsync({
      status: RoomStatus.WAITING,
      $expr: { $lt: [{ $size: '$players' }, MAX_PLAYERS] },
    }, {
      sort: { createdAt: -1 },
    });

    if (openRoom) {
      // Join existing room
      const usedSlots = openRoom.players.map(p => p.slot);
      let nextSlot = 0;
      while (usedSlots.includes(nextSlot)) {
        nextSlot++;
      }

      await GameRooms.updateAsync(openRoom._id, {
        $push: {
          players: {
            userId: this.userId,
            username: user.username || 'Anonymous',
            slot: nextSlot,
          },
        },
        $set: { lastActiveAt: new Date() },
      });

      // Check if room is now full — start immediately
      const updatedRoom = await GameRooms.findOneAsync(openRoom._id);
      if (updatedRoom && updatedRoom.players.length >= MAX_PLAYERS) {
        cancelCountdown(openRoom._id);
        await GameRooms.updateAsync(openRoom._id, {
          $set: { status: RoomStatus.STARTING, startedAt: new Date() },
        });
        await startGame(openRoom._id, MAX_PLAYERS);
      }

      return { roomId: openRoom._id };
    }

    // No open rooms — create new one
    const roomId = await GameRooms.insertAsync({
      hostId: this.userId,
      players: [{
        userId: this.userId,
        username: user.username || 'Anonymous',
        slot: 0,
      }],
      status: RoomStatus.WAITING,
      maxPlayers: MAX_PLAYERS,
      createdAt: new Date(),
      lastActiveAt: new Date(),
      countdownStartedAt: new Date(),
      startedAt: null,
      finishedAt: null,
    });

    // Start 20-second countdown
    startCountdown(roomId);

    return { roomId };
  },

  // Heartbeat — update room's lastActiveAt
  async 'rooms.touch'(roomId) {
    check(roomId, String);
    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }
    const result = await GameRooms.updateAsync(
      {
        _id: roomId,
        'players.userId': this.userId,
        status: { $in: [RoomStatus.WAITING, RoomStatus.STARTING, RoomStatus.PLAYING] },
      },
      { $set: { lastActiveAt: new Date() } }
    );
    if (result === 0) {
      throw new Meteor.Error('room-not-found', 'Room not found or no longer active');
    }
  },

  // Leave a room
  async 'rooms.leave'(roomId) {
    check(roomId, String);
    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }

    const room = await GameRooms.findOneAsync(roomId);
    if (!room) {
      throw new Meteor.Error('not-found', 'Room not found');
    }

    const playerInRoom = room.players.some(p => p.userId === this.userId);
    if (!playerInRoom) {
      throw new Meteor.Error('not-in-room', 'You are not in this room');
    }

    const remainingPlayers = room.players.filter(p => p.userId !== this.userId);

    if (remainingPlayers.length === 0) {
      // No players left — mark room as finished
      cancelCountdown(roomId);
      await GameRooms.updateAsync(roomId, {
        $set: { status: RoomStatus.FINISHED, finishedAt: new Date() },
      });
    } else if (room.hostId === this.userId) {
      // Host leaving — migrate host to next player
      await GameRooms.updateAsync(roomId, {
        $set: { hostId: remainingPlayers[0].userId },
        $pull: { players: { userId: this.userId } },
      });
    } else {
      // Non-host leaves
      await GameRooms.updateAsync(roomId, {
        $pull: { players: { userId: this.userId } },
      });
    }
  },
});
