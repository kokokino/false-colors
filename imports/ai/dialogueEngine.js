import { Meteor } from 'meteor/meteor';
import { Personalities } from '../game/ai/personalities.js';
import { getTemplate, fillSlots } from './templates/phantomTides.js';
import { callStyleTransfer } from './llmProxy.js';

// Decide whether to use LLM style transfer for this line
// ~20% of lines go through LLM for personality flair
function shouldUseLlm() {
  return Math.random() < 0.2;
}

// Generate dialogue for an AI player
// Returns text string ready to display
// Optional slotOverrides can provide specific slot values (e.g. player_name for accusation target)
export async function generateAiDialogue(game, aiPlayer, trigger, slotOverrides) {
  const personality = Personalities[aiPlayer.personality];
  if (!personality) {
    return 'Hmm...';
  }

  // Build slot data from game state, with optional overrides
  const slotData = { ...buildSlotData(game, aiPlayer), ...slotOverrides };

  // Get base template text
  const baseText = fillSlots(getTemplate(trigger, personality.dialogueStyle), slotData);

  // Decide whether to style-transfer via LLM
  if (shouldUseLlm() && game.llmCallsUsed < getMaxCalls()) {
    try {
      const styled = await callStyleTransfer(game._id, baseText, aiPlayer.personality);
      if (styled) {
        return styled;
      }
    } catch (error) {
      // Fallback to template text on any LLM error
      console.log(`[dialogue] LLM style transfer failed, using template: ${error.message}`);
    }
  }

  return baseText;
}

function getMaxCalls() {
  const settings = Meteor.settings?.private?.ai || {};
  return settings.maxCallsPerGame || 20;
}

function buildSlotData(game, aiPlayer) {
  const highestThreat = game.activeThreats.reduce((prev, curr) =>
    (curr.doomPerRound > (prev?.doomPerRound || 0)) ? curr : prev
  , null);

  const roundsLeft = game.maxRounds - game.currentRound;

  return {
    threat_name: highestThreat?.name || 'the unknown threat',
    threshold: highestThreat?.threshold?.toString() || '?',
    doom_per_round: highestThreat?.doomPerRound?.toString() || '?',
    player_name: game.players.find(p => p.seatIndex !== aiPlayer.seatIndex)?.displayName || 'someone',
    rounds_left: roundsLeft.toString(),
    doom_level: game.doomLevel.toString(),
    doom_threshold: game.doomThreshold.toString(),
  };
}
