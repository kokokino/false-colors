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
};

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 6;
