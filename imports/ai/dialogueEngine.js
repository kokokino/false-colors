import { Meteor } from 'meteor/meteor';
import { Personalities } from '../game/ai/personalities.js';
import { Roles, getActionStrength } from '../game/roles.js';
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

// Find the best player to mention: the specialist for the highest-doom threat (excluding self),
// falling back to a random other player.
function pickRelevantPlayer(game, aiPlayer) {
  const others = game.players.filter(p => p.seatIndex !== aiPlayer.seatIndex);
  if (others.length === 0) {
    return 'someone';
  }

  const highestThreat = game.activeThreats.reduce((prev, curr) =>
    (curr.doomPerRound > (prev?.doomPerRound || 0)) ? curr : prev
  , null);

  if (highestThreat) {
    let bestPlayer = null;
    let bestStrength = 0;
    for (const player of others) {
      const role = Object.values(Roles).find(r => r.id === player.role);
      if (role) {
        const strength = getActionStrength(role, highestThreat.type);
        if (strength > bestStrength) {
          bestStrength = strength;
          bestPlayer = player;
        }
      }
    }
    if (bestPlayer) {
      return bestPlayer.displayName;
    }
  }

  return others[Math.floor(Math.random() * others.length)].displayName;
}

// Find a player who made a suboptimal action choice worth commenting on
function findInterestingAction(game) {
  const actions = game.revealedActions;
  if (!actions || actions.length === 0) {
    return null;
  }

  for (const action of actions) {
    const player = game.players.find(p => p.seatIndex === action.seatIndex);
    if (!player) {
      continue;
    }
    const role = Object.values(Roles).find(r => r.id === player.role);
    if (!role) {
      continue;
    }
    const targetedThreat = game.activeThreats.find(t => t.id === action.threatId);
    if (!targetedThreat) {
      continue;
    }
    const targetedStrength = getActionStrength(role, targetedThreat.type);
    const bestStrength = Math.max(...game.activeThreats.map(t => getActionStrength(role, t.type)));

    if (targetedStrength < bestStrength) {
      // Find their specialty type
      const specialtyThreats = game.activeThreats.filter(t => getActionStrength(role, t.type) === bestStrength);
      return {
        playerName: player.displayName,
        targetedThreatName: targetedThreat.name,
        specialtyType: specialtyThreats[0]?.type || 'their specialty',
      };
    }
  }
  return null;
}

export function buildSlotData(game, aiPlayer) {
  const highestThreat = game.activeThreats.reduce((prev, curr) =>
    (curr.doomPerRound > (prev?.doomPerRound || 0)) ? curr : prev
  , null);

  const roundsLeft = Math.max(0, game.maxRounds - game.currentRound);
  const tollAgg = game.tollAggregate || {};
  const coins = (game.goldCoins || []).length;
  const skulls = (game.skulls || []).length;

  // Cook nourish data
  const cook = game.players.find(p => p.role === 'cook');
  const cookName = cook ? cook.displayName : 'the Cook';

  // Find interesting action observation
  const interestingAction = findInterestingAction(game);

  return {
    threat_name: highestThreat?.name || 'the unknown threat',
    threshold: highestThreat?.threshold?.toString() || '?',
    doom_per_round: highestThreat?.doomPerRound?.toString() || '?',
    player_name: pickRelevantPlayer(game, aiPlayer),
    rounds_left: roundsLeft.toString(),
    doom_level: game.doomLevel.toString(),
    doom_threshold: game.doomThreshold.toString(),
    doom_remaining: Math.max(0, game.doomThreshold - game.doomLevel).toString(),
    doom_percent: Math.round((game.doomLevel / game.doomThreshold) * 100).toString(),
    // Toll aggregate
    resolve_tolls: (tollAgg.resolveCount || 0).toString(),
    doom_tolls: (tollAgg.doomCount || 0).toString(),
    curse_tolls: (tollAgg.curseCount || 0).toString(),
    // Scoring
    coins: coins.toString(),
    skulls: skulls.toString(),
    // Cook
    cook_name: cookName,
    // Action observation
    action_player: interestingAction?.playerName || 'someone',
    action_threat: interestingAction?.targetedThreatName || 'a threat',
    action_specialty: interestingAction?.specialtyType || 'their specialty',
  };
}
