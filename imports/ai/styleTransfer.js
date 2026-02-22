// OpenRouter prompt builder for AI dialogue style transfer
// Takes base template text and a personality, returns a system/user prompt pair

import { Personalities } from '../game/ai/personalities.js';

const personalityDescriptions = {
  grizzled: 'You are a weathered, grizzled sailor. Speak in short, terse sentences. You\'ve seen it all and aren\'t easily impressed. Think Clint Eastwood at sea.',
  nervous: 'You are a nervous, anxious crew member. You worry constantly and see danger everywhere. Stutter slightly, use lots of qualifiers like "maybe", "perhaps", "I think".',
  jovial: 'You are a cheerful, optimistic sailor. Even in dire situations you crack jokes and keep spirits high. Use exclamation marks and positive language.',
  analytical: 'You are a methodical, data-driven officer. Speak precisely, reference numbers and probabilities. Cold logic over emotion.',
  reckless: 'You are a bold, fearless adventurer. Everything is exciting, danger is fun. Boastful but not cruel. Think action hero one-liners.',
  devout: 'You are a deeply superstitious, spiritual sailor. Reference omens, spirits, the sea\'s will, and fate. Speak in a solemn, ritualistic tone.',
};

// Build the prompt for OpenRouter style transfer
export function buildStyleTransferPrompt(baseText, personalityId) {
  const personality = Personalities[personalityId];
  if (!personality) {
    return null;
  }

  const systemPrompt = `You are roleplaying as a character on a ghost ship. ${personalityDescriptions[personalityId] || ''}

RULES:
- Rewrite the given line in your character's voice and style
- Keep it under 25 words
- Do NOT add action descriptions or stage directions
- Do NOT use quotation marks
- Stay in character at all times
- Only return the rewritten line, nothing else`;

  const userPrompt = `Rewrite this in character: "${baseText}"`;

  return { systemPrompt, userPrompt };
}
