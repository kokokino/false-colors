// AI personality definitions for Phantom Tides
// Each personality adjusts behavior weights and dialogue style

export const Personalities = {
  grizzled: {
    id: 'grizzled',
    name: 'Grizzled',
    dialogueStyle: 'terse',
    traits: {
      tollCaution: 0.7,       // Prefers safe toll options
      actionOptimality: 0.9,  // Picks best threat to target
      suspicionThreshold: 0.6, // Moderate suspicion needed to accuse
      accuseEagerness: 0.3,   // Slow to accuse
      chatFrequency: 0.4,     // Speaks rarely
    },
    description: 'A weathered veteran. Few words, sharp eyes.',
  },
  nervous: {
    id: 'nervous',
    name: 'Nervous',
    dialogueStyle: 'worried',
    traits: {
      tollCaution: 0.5,
      actionOptimality: 0.7,
      suspicionThreshold: 0.4, // Quick to suspect
      accuseEagerness: 0.7,   // Eager to accuse
      chatFrequency: 0.8,     // Talks a lot
    },
    description: 'Twitchy and paranoid. Sees threats everywhere.',
  },
  jovial: {
    id: 'jovial',
    name: 'Jovial',
    dialogueStyle: 'cheerful',
    traits: {
      tollCaution: 0.4,
      actionOptimality: 0.8,
      suspicionThreshold: 0.7, // Hard to convince something is wrong
      accuseEagerness: 0.2,   // Very slow to accuse
      chatFrequency: 0.7,     // Chatty
    },
    description: 'Keeps spirits high even when doom rises.',
  },
  analytical: {
    id: 'analytical',
    name: 'Analytical',
    dialogueStyle: 'analytical',
    traits: {
      tollCaution: 0.6,
      actionOptimality: 0.95, // Highly optimal choices
      suspicionThreshold: 0.5,
      accuseEagerness: 0.5,   // Accuses when evidence supports it
      chatFrequency: 0.5,
    },
    description: 'Calculated and precise. Trusts numbers over feelings.',
  },
  reckless: {
    id: 'reckless',
    name: 'Reckless',
    dialogueStyle: 'bold',
    traits: {
      tollCaution: 0.3,       // Takes risky tolls
      actionOptimality: 0.6,  // Sometimes picks suboptimal targets
      suspicionThreshold: 0.5,
      accuseEagerness: 0.6,   // Fairly quick to accuse
      chatFrequency: 0.6,
    },
    description: 'Bold and impulsive. Acts first, thinks later.',
  },
  devout: {
    id: 'devout',
    name: 'Devout',
    dialogueStyle: 'solemn',
    traits: {
      tollCaution: 0.8,       // Very cautious
      actionOptimality: 0.85,
      suspicionThreshold: 0.55,
      accuseEagerness: 0.4,
      chatFrequency: 0.5,
    },
    description: 'Speaks in omens and prayers. Deeply superstitious.',
  },
};
