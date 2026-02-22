// Server-only suspicion tracking for AI players
// Tracks observable behavior to build suspicion scores on all other players

// In-memory suspicion state per game (cleared when game ends)
const gameState = new Map();

function getState(gameId) {
  if (!gameState.has(gameId)) {
    gameState.set(gameId, {});
  }
  return gameState.get(gameId);
}

// Initialize suspicion tracking for an AI player
export function initSuspicion(gameId, aiSeatIndex, allSeats) {
  const state = getState(gameId);
  if (!state[aiSeatIndex]) {
    state[aiSeatIndex] = {};
  }
  for (const seat of allSeats) {
    if (seat !== aiSeatIndex && state[aiSeatIndex][seat] === undefined) {
      state[aiSeatIndex][seat] = 0.0;
    }
  }
}

// Update suspicion based on an observed action
// eventType: 'toll_doom', 'toll_supply', 'toll_curse', 'action_optimal', 'action_suboptimal', 'accused_loyal'
export function updateSuspicion(gameId, aiSeatIndex, targetSeat, eventType) {
  const state = getState(gameId);
  if (!state[aiSeatIndex] || state[aiSeatIndex][targetSeat] === undefined) {
    return;
  }

  const deltas = {
    toll_doom: 0.1,         // Choosing doom is slightly suspicious
    toll_supply: -0.05,     // Self-sacrifice is reassuring
    toll_curse: 0.0,        // Neutral
    action_optimal: -0.1,   // Good targeting reduces suspicion
    action_suboptimal: 0.15, // Bad targeting raises suspicion
    accused_loyal: 0.2,     // Accusing a loyal player is very suspicious
    defended_self_well: -0.1,
    voted_guilty_on_acquitted: 0.1, // Voting guilty on someone who was acquitted is mildly suspicious
  };

  const delta = deltas[eventType] || 0;
  state[aiSeatIndex][targetSeat] = Math.max(0, Math.min(1, state[aiSeatIndex][targetSeat] + delta));
}

// Get suspicion score for a specific target
export function getSuspicion(gameId, aiSeatIndex, targetSeat) {
  const state = getState(gameId);
  if (!state[aiSeatIndex]) {
    return 0;
  }
  return state[aiSeatIndex][targetSeat] || 0;
}

// Get the most suspicious player from an AI's perspective
export function getMostSuspicious(gameId, aiSeatIndex) {
  const state = getState(gameId);
  if (!state[aiSeatIndex]) {
    return null;
  }

  let maxSeat = null;
  let maxScore = 0;

  for (const [seat, score] of Object.entries(state[aiSeatIndex])) {
    if (score > maxScore) {
      maxScore = score;
      maxSeat = parseInt(seat, 10);
    }
  }

  return maxSeat !== null ? { seatIndex: maxSeat, score: maxScore } : null;
}

// Decay all suspicion scores for a game by a multiplicative rate
// At 10% decay, each score is multiplied by 0.9 per round
export function decaySuspicion(gameId, decayRate = 0.1) {
  const state = getState(gameId);
  for (const aiSeat of Object.keys(state)) {
    for (const targetSeat of Object.keys(state[aiSeat])) {
      state[aiSeat][targetSeat] *= (1 - decayRate);
    }
  }
}

// Clean up state for a finished game
export function clearSuspicion(gameId) {
  gameState.delete(gameId);
}
