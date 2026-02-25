// Server-side phase timer management
// Tracks timeouts per game and auto-advances phases when time expires

const phaseTimers = new Map();

// Phase durations in milliseconds — novice (default) and expert modes
export const PhaseDurationsNovice = {
  character_reveal: 15000,
  threat: 3000,
  toll: 45000,
  discussion: 60000,
  action: 45000,
  accusation: 30000,
  accusation_result: 8000,
  round_end: 15000,
};

export const PhaseDurationsExpert = {
  character_reveal: 12000,
  threat: 2000,
  toll: 30000,
  discussion: 45000,
  action: 30000,
  accusation: 20000,
  accusation_result: 5000,
  round_end: 10000,
};

// Legacy export for backward compatibility in tests
export const PhaseDurations = PhaseDurationsNovice;

// Get duration for a phase based on expert mode
export function getPhaseDuration(phase, expertMode) {
  const durations = expertMode ? PhaseDurationsExpert : PhaseDurationsNovice;
  return durations[phase] || 30000;
}

// Start a timer for the current phase — calls onExpire when time's up
export function startPhaseTimer(gameId, phase, onExpire, expertMode) {
  clearPhaseTimer(gameId);

  const duration = getPhaseDuration(phase, expertMode);
  if (!duration) {
    return;
  }

  const timerId = Meteor.setTimeout(async () => {
    phaseTimers.delete(gameId);
    try {
      await onExpire(gameId);
    } catch (error) {
      console.error(`[phaseTimer] onExpire error for game ${gameId}:`, error);
    }
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
