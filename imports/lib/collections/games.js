// Re-export collections from the canonical definition in api/collections.js
export { GameRooms, Games, GameMessages, GameLog } from '../../api/collections.js';

// Room status constants
export const RoomStatus = {
  WAITING: 'waiting',
  STARTING: 'starting',
  PLAYING: 'playing',
  FINISHED: 'finished',
};

// Game phase constants
export const GamePhase = {
  CHARACTER_REVEAL: 'character_reveal',
  THREAT: 'threat',
  TOLL: 'toll',
  DISCUSSION: 'discussion',
  ACTION: 'action',
  ACCUSATION: 'accusation',
  ROUND_END: 'round_end',
  FINISHED: 'finished',
};

// Alignment constants
export const Alignment = {
  LOYAL: 'loyal',
  PHANTOM: 'phantom',
};

// Game result constants
export const GameResult = {
  LOYAL_WIN: 'loyal_win',
  PHANTOM_WIN: 'phantom_win',
  DOOM_LOSS: 'doom_loss',
  CREW_LOSS: 'crew_loss', // Survived but skulls >= coins
};

export const MIN_PLAYERS = 6;
export const MAX_PLAYERS = 6;

export const GameConstants = {
  COUNTDOWN_SECONDS: 20,
  HEARTBEAT_MS: 120000,
  CHAT_MAX_LENGTH: 300,
  AI_DELAY_TOLL: { min: 1000, max: 3000 },
  AI_DELAY_ACTION: { min: 1000, max: 3000 },
  AI_DELAY_DISCUSSION: { min: 3000, max: 8000 },
  AI_DELAY_ACCUSATION: { min: 2000, max: 5000 },
  DISCUSSION_MAX_DELAY: 25000,
};
