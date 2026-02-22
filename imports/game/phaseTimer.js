// Server-side phase timer management
// Tracks timeouts per game and auto-advances phases when time expires

const phaseTimers = new Map();

// Phase durations in milliseconds
export const PhaseDurations = {
  threat: 2000,       // Auto display
  toll: 30000,        // 30s for player choice
  discussion: 30000,  // 30s for chat
  action: 30000,      // 30s for action assignment
  accusation: 15000,  // 15s window
  round_end: 2000,    // Auto display
};

// Start a timer for the current phase — calls onExpire when time's up
export function startPhaseTimer(gameId, phase, onExpire) {
  clearPhaseTimer(gameId);

  const duration = PhaseDurations[phase];
  if (!duration) {
    return;
  }

  const timerId = Meteor.setTimeout(() => {
    phaseTimers.delete(gameId);
    onExpire(gameId);
  }, duration);

  phaseTimers.set(gameId, timerId);
}

// Clear an existing timer for a game
export function clearPhaseTimer(gameId) {
  const timerId = phaseTimers.get(gameId);
  if (timerId) {
    Meteor.clearTimeout(timerId);
    phaseTimers.delete(gameId);
  }
}
