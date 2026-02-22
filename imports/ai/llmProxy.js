import { Meteor } from 'meteor/meteor';
import { Games } from '../api/collections.js';
import { buildStyleTransferPrompt } from './styleTransfer.js';

// Call OpenRouter for style transfer with model fallback chain
export async function callStyleTransfer(gameId, baseText, personalityId) {
  const settings = Meteor.settings?.private?.ai || {};
  const apiKey = settings.openRouterApiKey;

  if (!apiKey) {
    return null; // No API key configured — use template text
  }

  const models = settings.openRouterModels || [
    'mistralai/mistral-small-creative',
    'meta-llama/llama-4-scout',
    'openai/gpt-4o-mini',
  ];
  const baseUrl = settings.openRouterBaseUrl || 'https://openrouter.ai/api/v1';
  const maxTokens = settings.maxTokensPerCall || 100;
  const temperature = settings.temperature || 0.8;
  const maxCalls = settings.maxCallsPerGame || 20;

  // Check per-game call cap
  const game = await Games.findOneAsync(gameId);
  if (!game || game.llmCallsUsed >= maxCalls) {
    return null;
  }

  const prompt = buildStyleTransferPrompt(baseText, personalityId);
  if (!prompt) {
    return null;
  }

  // Increment call counter once before trying the fallback chain
  await Games.updateAsync(gameId, {
    $inc: { llmCallsUsed: 1 },
    $set: { updatedAt: new Date() },
  });

  // Try each model in the fallback chain
  for (const model of models) {
    try {
      const result = await callOpenRouter(baseUrl, apiKey, model, prompt, maxTokens, temperature);
      return result;
    } catch (error) {
      console.log(`[llmProxy] Model ${model} failed: ${error.message}`);
      continue;
    }
  }

  // All models failed — return null (caller uses template)
  return null;
}

async function callOpenRouter(baseUrl, apiKey, model, prompt, maxTokens, temperature) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://false-colors.kokokino.com',
        'X-Title': 'False Colors',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: prompt.systemPrompt },
          { role: 'user', content: prompt.userPrompt },
        ],
        max_tokens: maxTokens,
        temperature,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`OpenRouter returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim();

    if (!text) {
      throw new Error('Empty response from OpenRouter');
    }

    // Strip any quotation marks the model may have added
    return text.replace(/^["']|["']$/g, '');
  } finally {
    clearTimeout(timeoutId);
  }
}
